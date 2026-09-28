// Tests for services/tavilyService.js — run with `npm test` (Node's
// built-in test runner). Spins up a tiny self-contained mock Tavily HTTP
// server so these tests never depend on the real api.tavily.com being
// reachable or a real API key being available.
//
// Unlike searxngService.js (which read a configurable SEARXNG_URL),
// tavilyService.js talks to the real, hardcoded
// https://api.tavily.com/search — so instead of pointing config at a
// different host, these tests monkey-patch global.fetch to redirect that
// exact URL to the local mock server. The request body (JSON, read via
// the request's 'data'/'end' events) carries the trigger keyword instead
// of a query-string param, since Tavily's API is POST.

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");

const BASE = path.join(__dirname, "..");

const MOCK_RESULTS = {
  results: [
    { title: "Best AI agent frameworks 2026", url: "https://example.com/ai-agents", content: "A roundup of frameworks for building autonomous agents." },
    { title: "r/AIagents", url: "https://www.reddit.com/r/AIagents/", content: "Community for people building AI agents" },
    { title: "Someone's post about agents", url: "https://www.reddit.com/r/AIagents/comments/abc123/my_agent_setup/", content: "Here's how I built my agent stack" },
    { title: "Duplicate of first result", url: "https://example.com/ai-agents", content: "duplicate" },
    { title: "Bad url test", url: "javascript:alert(1)", content: "should be dropped" },
  ],
};

function startMockServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let raw = "";
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", () => {
        let body = {};
        try {
          body = JSON.parse(raw);
        } catch (e) {}
        const q = body.query;
        const auth = req.headers["authorization"] || "";

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
        if (q === "TRIGGER_UNAUTHORIZED" || auth === "Bearer tvly-bad-key") {
          res.writeHead(401);
          return res.end(JSON.stringify({ detail: "Unauthorized" }));
        }
        if (q === "TRIGGER_CHECK_TOPIC") {
          res.writeHead(200, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ results: [], _echoedTopic: body.topic, _echoedTimeRange: body.time_range }));
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(MOCK_RESULTS));
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function redirectTavilyFetchTo(mockServer) {
  const realFetch = global.fetch;
  const { port } = mockServer.address();
  global.fetch = async (url, opts) => {
    if (url === "https://api.tavily.com/search") {
      return realFetch(`http://127.0.0.1:${port}`, opts);
    }
    return realFetch(url, opts);
  };
  return () => {
    global.fetch = realFetch;
  };
}

function freshTavilyService(apiKey) {
  process.env.TAVILY_API_KEY = apiKey === undefined ? "tvly-test-key" : apiKey;
  process.env.TAVILY_TIMEOUT_MS = "1200";
  for (const p of ["src/config/index.js", "src/services/tavilyService.js", "src/services/searchResultUtils.js"]) {
    try {
      delete require.cache[require.resolve(path.join(BASE, p))];
    } catch (e) {}
  }
  return require(path.join(BASE, "src/services/tavilyService.js"));
}

test("isConfigured", () => {
  const notConfigured = freshTavilyService("");
  assert.equal(notConfigured.isConfigured(), false);
  const configured = freshTavilyService("tvly-real-key");
  assert.equal(configured.isConfigured(), true);
});

test("search — rejects empty/missing query before making any request", async () => {
  const tavily = freshTavilyService();
  await assert.rejects(() => tavily.search({ query: "" }), (err) => err.code === "INVALID_QUERY");
  await assert.rejects(() => tavily.search({ query: "   " }), (err) => err.code === "INVALID_QUERY");
  await assert.rejects(() => tavily.search({ query: undefined }), (err) => err.code === "INVALID_QUERY");
});

test("search — not configured throws SEARCH_NOT_CONFIGURED without making any request", async () => {
  const tavily = freshTavilyService("");
  await assert.rejects(() => tavily.search({ query: "anything" }), (err) => err.code === "SEARCH_NOT_CONFIGURED");
});

test("search — real success path: normalizes, dedupes, and drops unsafe URLs", async (t) => {
  const server = await startMockServer();
  const restore = redirectTavilyFetchTo(server);
  const tavily = freshTavilyService();

  await t.test("returns normalized, deduplicated, sanitized results", async () => {
    const { results, query } = await tavily.search({ query: "AI agent frameworks" });
    assert.equal(query, "AI agent frameworks");
    // 5 raw results -> 1 duplicate + 1 unsafe (javascript:) URL dropped -> 3 remain
    assert.equal(results.length, 3);
    assert.ok(results.every((r) => r.url.startsWith("http")));
    assert.ok(!results.some((r) => r.url.startsWith("javascript:")));
    const urls = results.map((r) => r.url);
    assert.equal(new Set(urls).size, urls.length, "no duplicate URLs");
  });

  await t.test("zero results is not an error", async () => {
    const { results } = await tavily.search({ query: "TRIGGER_EMPTY" });
    assert.deepEqual(results, []);
  });

  restore();
  server.close();
});

test("search — categories maps onto Tavily's topic, unmapped categories fall back to 'general'", async (t) => {
  const server = await startMockServer();
  const restore = redirectTavilyFetchTo(server);
  const tavily = freshTavilyService();

  await t.test("['news'] maps to topic 'news'", async () => {
    let capturedBody = null;
    const realFetch = global.fetch;
    global.fetch = async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return realFetch(url, opts);
    };
    await tavily.search({ query: "TRIGGER_CHECK_TOPIC", categories: ["news"] });
    assert.equal(capturedBody.topic, "news");
    global.fetch = realFetch;
  });

  await t.test("no categories / unmapped categories fall back to 'general'", async () => {
    let capturedBody = null;
    const realFetch = global.fetch;
    global.fetch = async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return realFetch(url, opts);
    };
    await tavily.search({ query: "TRIGGER_CHECK_TOPIC", categories: ["it", "science"] });
    assert.equal(capturedBody.topic, "general");
    global.fetch = realFetch;
  });

  await t.test("time_range passes through unchanged for allowed values, dropped for invalid ones", async () => {
    let capturedBody = null;
    const realFetch = global.fetch;
    global.fetch = async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return realFetch(url, opts);
    };
    await tavily.search({ query: "TRIGGER_CHECK_TOPIC", timeRange: "week" });
    assert.equal(capturedBody.time_range, "week");
    await tavily.search({ query: "TRIGGER_CHECK_TOPIC", timeRange: "not-a-real-range" });
    assert.equal(capturedBody.time_range, undefined);
    global.fetch = realFetch;
  });

  restore();
  server.close();
});

test("search — unauthorized (bad API key) is SEARCH_UNAUTHORIZED, not a generic error", async () => {
  const server = await startMockServer();
  const restore = redirectTavilyFetchTo(server);
  const tavily = freshTavilyService("tvly-bad-key");

  await assert.rejects(() => tavily.search({ query: "anything" }), (err) => err.code === "SEARCH_UNAUTHORIZED");

  restore();
  server.close();
});

test("search — rate limited (429) is SEARCH_RATE_LIMITED", async () => {
  const server = await startMockServer();
  const restore = redirectTavilyFetchTo(server);
  const tavily = freshTavilyService();

  await assert.rejects(() => tavily.search({ query: "TRIGGER_RATE_LIMIT" }), (err) => err.code === "SEARCH_RATE_LIMITED");

  restore();
  server.close();
});

test("search — malformed (non-JSON) response is SEARCH_MALFORMED_RESPONSE", async () => {
  const server = await startMockServer();
  const restore = redirectTavilyFetchTo(server);
  const tavily = freshTavilyService();

  await assert.rejects(() => tavily.search({ query: "TRIGGER_MALFORMED" }), (err) => err.code === "SEARCH_MALFORMED_RESPONSE");

  restore();
  server.close();
});

test("search — generic 5xx is SEARCH_ERROR with the status attached", async () => {
  const server = await startMockServer();
  const restore = redirectTavilyFetchTo(server);
  const tavily = freshTavilyService();

  await assert.rejects(() => tavily.search({ query: "TRIGGER_500" }), (err) => err.code === "SEARCH_ERROR" && err.status === 500);

  restore();
  server.close();
});

test("search — timeout throws SEARCH_TIMEOUT within the configured window, not hanging forever", async () => {
  const server = await startMockServer();
  const restore = redirectTavilyFetchTo(server);
  const tavily = freshTavilyService();

  const start = Date.now();
  await assert.rejects(() => tavily.search({ query: "TRIGGER_TIMEOUT" }), (err) => err.code === "SEARCH_TIMEOUT");
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 3000, `should time out near the configured 1200ms window, took ${elapsed}ms`);

  restore();
  server.close();
});

test("search — connection failure when nothing is listening", async () => {
  const restore = redirectTavilyFetchTo({ address: () => ({ port: 19999 }) });
  const tavily = freshTavilyService();

  await assert.rejects(() => tavily.search({ query: "anything" }), (err) => err.code === "SEARCH_UNREACHABLE");

  restore();
});
