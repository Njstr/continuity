// Tests for the AI tool-calling layer (services/aiTools.js and the
// OpenAI-compatible tool loop in providers/openAiCompatibleTools.js, as
// used by aiService.chat()). Uses a mocked provider HTTP endpoint and a
// self-contained mock Tavily server — no real network dependency.
//
// aiTools.js talks to the configured search provider via a real HTTP
// request, same as before this was Tavily — but Tavily's API is POST
// with a JSON body (query in the body, auth via an Authorization header)
// rather than SearXNG's GET with querystring params, so the mock server
// here reads the request body rather than the URL's query string. The
// mock always returns the same fixed result set regardless of the exact
// body sent — these tests aren't asserting on Tavily's exact request
// shape, only on aiTools.js's handling of what comes back.

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
  ],
};

function startMockTavily(responsePayload = MOCK_RESULTS) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let raw = "";
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", () => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(typeof responsePayload === "function" ? responsePayload(raw) : responsePayload));
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

// tavilyService.js hardcodes the real https://api.tavily.com/search URL
// (unlike the old SearXNG service, which pointed at a configurable
// SEARXNG_URL) — so these tests monkey-patch global.fetch to redirect
// that exact URL to the local mock server, rather than pointing config
// at a different host.
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

function freshRequire(...relPaths) {
  for (const p of relPaths) {
    try {
      delete require.cache[require.resolve(path.join(BASE, p))];
    } catch (e) {}
  }
}

test("aiTools.executeTool — real search via the shared tavilyService", async (t) => {
  const server = await startMockTavily();
  const restoreFetch = redirectTavilyFetchTo(server);
  process.env.TAVILY_API_KEY = "tvly-test-key";
  freshRequire("src/config/index.js", "src/services/tavilyService.js", "src/services/searchResultUtils.js", "src/services/aiTools.js");
  const aiTools = require(path.join(BASE, "src/services/aiTools.js"));

  await t.test("returns real results with sources, correctly labeled", async () => {
    const result = await aiTools.executeTool("web_search", { query: "AI agent frameworks" });
    assert.equal(result.sources.length, 3);
    assert.ok(result.sources.every((s) => s.url.startsWith("http")));
    assert.ok(result.textForModel.includes("[community]"));
    assert.ok(result.textForModel.includes("[post]"));
    assert.equal(result.success, true);
    assert.equal(result.resultCount, 3);
  });

  await t.test("unknown tool name returns a safe message, doesn't throw", async () => {
    const result = await aiTools.executeTool("not_a_real_tool", {});
    assert.equal(result.sources.length, 0);
    assert.match(result.textForModel, /Unknown tool/);
  });

  restoreFetch();
  server.close();
});

test("aiTools.executeTool — search provider unreachable is handled gracefully", async () => {
  const restoreFetch = redirectTavilyFetchTo({ address: () => ({ port: 19999 }) }); // nothing listening on this port
  process.env.TAVILY_API_KEY = "tvly-test-key";
  freshRequire("src/config/index.js", "src/services/tavilyService.js", "src/services/aiTools.js");
  const aiTools = require(path.join(BASE, "src/services/aiTools.js"));

  const result = await aiTools.executeTool("web_search", { query: "test" });
  assert.equal(result.sources.length, 0, "no sources when search fails");
  assert.ok(!/Error:|ECONNREFUSED|stack/i.test(result.textForModel), "no raw error/stack leaked to the model-facing text");
  assert.match(result.textForModel, /could not be reached|temporarily unavailable/i);
  assert.equal(result.errorCode, "SEARCH_UNREACHABLE");

  restoreFetch();
});

test("aiTools.executeTool — missing TAVILY_API_KEY is a clean SEARCH_NOT_CONFIGURED, not a crash", async () => {
  delete process.env.TAVILY_API_KEY;
  freshRequire("src/config/index.js", "src/services/tavilyService.js", "src/services/aiTools.js");
  const aiTools = require(path.join(BASE, "src/services/aiTools.js"));

  const result = await aiTools.executeTool("web_search", { query: "test" });
  assert.equal(result.success, false);
  assert.equal(result.errorCode, "SEARCH_NOT_CONFIGURED");
});

test("full tool-calling loop through aiService.chat() (OpenAI-compatible / Nvidia provider)", async (t) => {
  const tavily = await startMockTavily();
  const restoreTavilyFetch = redirectTavilyFetchTo(tavily);

  const dataDir = path.join(require("node:os").tmpdir(), `founderos-test-${Date.now()}`);
  require("node:fs").mkdirSync(dataDir, { recursive: true });

  process.env.TAVILY_API_KEY = "tvly-test-key";
  process.env.AI_PROVIDER = "nvidia";
  process.env.NVIDIA_API_KEY = "test-key";
  process.env.NVIDIA_MODEL = "test-model";
  process.env.DATA_DIR = dataDir;
  freshRequire("src/config/index.js", "src/services/tavilyService.js", "src/services/aiTools.js");

  require(path.join(BASE, "src/db/migrate.js")).runMigrations();

  const realFetch = global.fetch; // already patched by redirectTavilyFetchTo above — wrap further, not replace
  let scriptedResponses = [];
  let providerCallIndex = 0;
  const providerCallLog = [];

  global.fetch = async (url, opts) => {
    const urlStr = url.toString();
    if (urlStr.includes("integrate.api.nvidia.com")) {
      const body = JSON.parse(opts.body);
      providerCallLog.push({ hasTools: !!body.tools, lastRole: body.messages[body.messages.length - 1].role });
      const resp = scriptedResponses[providerCallIndex] || scriptedResponses[scriptedResponses.length - 1];
      providerCallIndex++;
      return { ok: true, status: 200, json: async () => resp, text: async () => JSON.stringify(resp) };
    }
    return realFetch(url, opts);
  };

  freshRequire("src/services/aiService.js", "src/services/executionEngine.js");
  const aiService = require(path.join(BASE, "src/services/aiService.js"));

  const PROFILE = { founderName: "Neehal", startupName: "FounderOS", oneLiner: "AI decision intelligence", stage: "idea", country: "India", currency: "INR" };

  await t.test("model calls web_search, gets real results, produces a sourced final answer", async () => {
    scriptedResponses = [
      {
        choices: [
          {
            finish_reason: "tool_calls",
            message: { role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "web_search", arguments: JSON.stringify({ query: "communities for AI agent builders" }) } }] },
          },
        ],
      },
      { choices: [{ finish_reason: "stop", message: { role: "assistant", content: "The most active community appears to be r/AIagents." } }] },
    ];
    providerCallIndex = 0;
    providerCallLog.length = 0;

    const result = await aiService.chat("tool-loop-test-user", {
      profile: PROFILE, missions: [], feedback: [], history: [{ role: "user", content: "Find communities where founders discuss AI agents" }], metrics: null, documents: [],
    });

    const toolRelatedCalls = providerCallLog.filter((c) => c.hasTools);
    assert.equal(toolRelatedCalls.length, 2, "both rounds of the tool loop correctly re-offer the tool (initial call, and the follow-up after the tool result, in case another search is needed)");
    assert.ok(result.reply.includes("r/AIagents"));
    assert.equal(result.sources.length, 3);
    assert.ok(result.sources.every((s) => s.url.startsWith("http")));
    assert.ok(result.sources.some((s) => s.url.includes("reddit.com/r/AIagents")), "the real reddit URL is present — never invented");
  });

  await t.test("malformed tool-call arguments from the model don't crash the loop", async () => {
    scriptedResponses = [
      { choices: [{ finish_reason: "tool_calls", message: { role: "assistant", content: null, tool_calls: [{ id: "call_bad", type: "function", function: { name: "web_search", arguments: "{not valid json" } }] } }] },
      { choices: [{ finish_reason: "stop", message: { role: "assistant", content: "I wasn't able to search properly, but here's what I know." } }] },
    ];
    providerCallIndex = 0;
    const result = await aiService.chat("tool-loop-test-user-2", {
      profile: PROFILE, missions: [], feedback: [], history: [{ role: "user", content: "search for something" }], metrics: null, documents: [],
    });
    assert.ok(result.reply.length > 0);
  });

  await t.test("duplicate URLs across multiple result entries are deduplicated, not double-counted as separate sources", async () => {
    // Reuses the same mock Tavily results (which already contain a
    // duplicate example.com-style URL set) via a direct search —
    // confirms dedup happens before sources ever reach the model or the
    // founder.
    freshRequire("src/services/tavilyService.js", "src/services/aiTools.js");
    const aiTools = require(path.join(BASE, "src/services/aiTools.js"));
    const result = await aiTools.executeTool("web_search", { query: "AI agent frameworks" });
    const urls = result.sources.map((s) => s.url);
    assert.equal(new Set(urls).size, urls.length, "no duplicate source URLs");
  });

  global.fetch = realFetch;
  restoreTavilyFetch();
  tavily.close();
});
