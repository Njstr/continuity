// Tests for services/searxngService.js — run with `npm test` (uses
// Node's built-in test runner, no extra dependency). Spins up a tiny
// self-contained mock SearXNG HTTP server so these tests never depend on
// a real SearXNG instance being reachable.

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");

const MOCK_RESULTS = {
  results: [
    { title: "Best AI agent frameworks 2026", url: "https://example.com/ai-agents", content: "A roundup of frameworks for building autonomous agents.", engine: "google", category: "general", publishedDate: "2026-01-15" },
    { title: "r/AIagents", url: "https://www.reddit.com/r/AIagents/", content: "Community for people building AI agents", engine: "reddit", category: "general" },
    { title: "Someone's post about agents", url: "https://www.reddit.com/r/AIagents/comments/abc123/my_agent_setup/", content: "Here's how I built my agent stack", engine: "reddit", category: "general" },
    { title: "Duplicate of first result", url: "https://example.com/ai-agents", content: "duplicate", engine: "bing", category: "general" },
    { title: "Bad url test", url: "javascript:alert(1)", content: "should be dropped", engine: "test", category: "general" },
  ],
  suggestions: ["ai agent frameworks", "autonomous agents"],
};

function startMockServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://localhost");
      const q = url.searchParams.get("q");
      if (q === "TRIGGER_TIMEOUT") return; // never respond
      if (q === "TRIGGER_MALFORMED") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end("{not valid json");
      }
      if (q === "TRIGGER_EMPTY") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ results: [] }));
      }
      if (q === "TRIGGER_RATE_LIMIT") {
        res.writeHead(429);
        return res.end("rate limited");
      }
      if (q === "TRIGGER_500") {
        res.writeHead(500);
        return res.end("internal error");
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(MOCK_RESULTS));
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function freshSearxngService(searxngUrl) {
  const base = path.join(__dirname, "..");
  process.env.SEARXNG_URL = searxngUrl || "";
  process.env.SEARXNG_TIMEOUT_MS = "1200";
  delete require.cache[require.resolve(path.join(base, "src/config/index.js"))];
  delete require.cache[require.resolve(path.join(base, "src/services/searxngService.js"))];
  return require(path.join(base, "src/services/searxngService.js"));
}

test("sanitizeUrl", async (t) => {
  const svc = freshSearxngService();
  await t.test("accepts https URL", () => assert.equal(svc.sanitizeUrl("https://example.com/page"), "https://example.com/page"));
  await t.test("accepts http URL", () => assert.ok(svc.sanitizeUrl("http://example.com")));
  await t.test("rejects javascript: URL", () => assert.equal(svc.sanitizeUrl("javascript:alert(1)"), null));
  await t.test("rejects data: URL", () => assert.equal(svc.sanitizeUrl("data:text/html,<script>"), null));
  await t.test("rejects malformed string", () => assert.equal(svc.sanitizeUrl("not a url"), null));
  await t.test("rejects non-string input", () => assert.equal(svc.sanitizeUrl(123), null));
});

test("classifyRedditUrl", async (t) => {
  const svc = freshSearxngService();
  await t.test("identifies subreddit with trailing slash", () => assert.equal(svc.classifyRedditUrl("https://www.reddit.com/r/startups/").type, "community"));
  await t.test("identifies subreddit without trailing slash", () => assert.equal(svc.classifyRedditUrl("https://reddit.com/r/startups").type, "community"));
  await t.test("identifies old.reddit.com subreddit", () => assert.equal(svc.classifyRedditUrl("https://old.reddit.com/r/startups/").type, "community"));
  await t.test("identifies individual post as post, not community", () =>
    assert.equal(svc.classifyRedditUrl("https://www.reddit.com/r/startups/comments/abc123/some_post/").type, "post")
  );
  await t.test("identifies user profile", () => assert.equal(svc.classifyRedditUrl("https://www.reddit.com/user/someuser/").type, "user_profile"));
  await t.test("identifies wiki page as other, not community", () => assert.equal(svc.classifyRedditUrl("https://www.reddit.com/r/startups/wiki/index").type, "other"));
  await t.test("rejects non-reddit domain even with /r/ path", () => assert.equal(svc.classifyRedditUrl("https://example.com/r/startups/"), null));
});

test("discoverRedditCommunities", async (t) => {
  const svc = freshSearxngService();
  const results = [
    { url: "https://www.reddit.com/r/startups/", snippet: "A community for startup founders" },
    { url: "https://www.reddit.com/r/startups/comments/abc/pricing_help/", snippet: "How do I price my SaaS" },
    { url: "https://www.reddit.com/r/startups/comments/def/another_post/", snippet: "Another post here" },
    { url: "https://www.reddit.com/r/SaaS/comments/xyz/growth_tips/", snippet: "Growth tips for SaaS" },
    { url: "https://www.reddit.com/user/founder123/", snippet: "profile" },
    { url: "https://example.com/not-reddit", snippet: "irrelevant" },
  ];
  const communities = svc.discoverRedditCommunities(results);
  await t.test("finds exactly 2 distinct communities", () => assert.equal(communities.length, 2));
  await t.test("ranks higher-mention community first", () => {
    assert.equal(communities[0].subreddit, "startups");
    assert.ok(communities[0].mentionCount > communities[1].mentionCount);
  });
  await t.test("produces a clean canonical community URL", () => assert.equal(communities[0].url, "https://www.reddit.com/r/startups/"));
  await t.test("carries evidence snippets", () => assert.ok(communities[0].evidenceSnippets.length > 0));
});

test("search() — not configured", async () => {
  const svc = freshSearxngService("");
  assert.equal(svc.isSearxngConfigured(), false);
  await assert.rejects(() => svc.search({ query: "test" }), (err) => {
    assert.equal(err.code, "SEARXNG_NOT_CONFIGURED");
    assert.ok(!/http|localhost/i.test(err.message), "must not leak internal URL details");
    return true;
  });
});

test("search() — full network path against a real mock server", async (t) => {
  const server = await startMockServer();
  const { port } = server.address();
  const svc = freshSearxngService(`http://127.0.0.1:${port}`);

  await t.test("returns normalized, deduplicated, safe results", async () => {
    const result = await svc.search({ query: "AI agent frameworks", maxResults: 10 });
    assert.equal(result.results.length, 3, "5 raw - 1 dup - 1 unsafe url = 3");
    assert.ok(result.results.every((r) => r.url.startsWith("http")));
    assert.ok(!result.results.some((r) => r.url.includes("javascript:")));
    assert.equal(new Set(result.results.map((r) => r.url)).size, result.results.length, "no duplicate urls");
    assert.equal(result.results[0].source, "google");
    assert.equal(result.suggestions.length, 2);
  });

  await t.test("Reddit-scoped results correctly identify community vs post", async () => {
    const result = await svc.search({ query: "AI agent frameworks" });
    const redditResults = result.results.filter((r) => r.url.includes("reddit.com"));
    const communities = svc.discoverRedditCommunities(redditResults);
    assert.equal(communities.length, 1);
    assert.equal(communities[0].subreddit, "AIagents");
  });

  await t.test("empty results — returns empty array, not an error", async () => {
    const empty = await svc.search({ query: "TRIGGER_EMPTY" });
    assert.deepEqual(empty.results, []);
  });

  await t.test("malformed response throws SEARXNG_MALFORMED_RESPONSE", async () => {
    await assert.rejects(() => svc.search({ query: "TRIGGER_MALFORMED" }), (err) => {
      assert.equal(err.code, "SEARXNG_MALFORMED_RESPONSE");
      return true;
    });
  });

  await t.test("rate limiting throws SEARXNG_RATE_LIMITED", async () => {
    await assert.rejects(() => svc.search({ query: "TRIGGER_RATE_LIMIT" }), (err) => {
      assert.equal(err.code, "SEARXNG_RATE_LIMITED");
      return true;
    });
  });

  await t.test("upstream 500 throws SEARXNG_ERROR", async () => {
    await assert.rejects(() => svc.search({ query: "TRIGGER_500" }), (err) => {
      assert.equal(err.code, "SEARXNG_ERROR");
      return true;
    });
  });

  await t.test("timeout throws SEARXNG_TIMEOUT within a bounded time", async () => {
    const start = Date.now();
    await assert.rejects(() => svc.search({ query: "TRIGGER_TIMEOUT" }), (err) => {
      assert.equal(err.code, "SEARXNG_TIMEOUT");
      return true;
    });
    assert.ok(Date.now() - start < 3000);
  });

  server.close();
});

test("search() — connection failure when nothing is listening", async () => {
  const svc = freshSearxngService("http://127.0.0.1:19999");
  await assert.rejects(() => svc.search({ query: "test" }), (err) => {
    assert.equal(err.code, "SEARXNG_UNREACHABLE");
    return true;
  });
});

test("search() — invalid query is rejected before any request is made", async () => {
  const server = await startMockServer();
  const { port } = server.address();
  const svc = freshSearxngService(`http://127.0.0.1:${port}`);
  await assert.rejects(() => svc.search({ query: "" }), (err) => {
    assert.equal(err.code, "INVALID_QUERY");
    return true;
  });
  server.close();
});
