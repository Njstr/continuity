// Tests for the explicit-action-priority fix: an explicit, direct search
// command ("Search reddit", "Search reddit for X") must trigger a real
// search instead of being swallowed by onboarding/conversational flow.
//
// Originally written against a self-hosted SearXNG instance; updated
// when the search provider switched to Tavily (see tavilyService.js's
// module comment for why). Tavily's API is POST with a JSON body and a
// hardcoded https://api.tavily.com/search URL (no per-deployment
// SEARXNG_URL-style config), so these tests redirect global.fetch for
// that exact URL to a local mock server, and read the query from the
// POST body instead of a query-string param. Error codes are the
// provider-neutral SEARCH_* namespace (previously SEARXNG_*).
//
// Pattern otherwise matches the rest of this suite: a real local HTTP
// server standing in for the search provider (not stubbed at the
// aiTools boundary), a real scratch SQLite DATA_DIR, and aiService
// stubbed via require.cache injection for the parts that would otherwise
// need a real AI provider call.

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

const BASE = path.join(__dirname, "..");

function startMockTavily(handler) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let raw = "";
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", () => {
        let body = {};
        try {
          body = JSON.parse(raw);
        } catch (e) {}
        handler(body, res);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function fixedResultsHandler(results) {
  return (body, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ results }));
  };
}

function neverRespondHandler() {
  return (body, res) => {
    /* never respond — for timeout testing */
  };
}

// tavilyService.js hardcodes the real Tavily URL, so redirect fetch for
// that exact URL to the local mock server instead of pointing config at
// a different host.
function redirectTavilyFetchTo(mockServerOrPort) {
  const realFetch = global.fetch;
  const port = typeof mockServerOrPort === "number" ? mockServerOrPort : mockServerOrPort.address().port;
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

function freshModules(extra = []) {
  // NOTE: db/migrate.js and db/connection.js MUST both be busted together
  // — connection.js opens its DB file once at require time, keyed to
  // config.dataDir at that moment. If migrate.js stays cached across
  // tests while connection.js/executionRepository.js get fresh copies (or
  // vice versa), migrate.js runs its migrations against the OLD cached
  // connection/dataDir while the freshly-required repository reads from
  // a DIFFERENT (new, unmigrated) dataDir — silently produces "no such
  // table" errors that look unrelated to the actual code under test.
  const mods = [
    "src/config/index.js",
    "src/services/tavilyService.js",
    "src/services/searchResultUtils.js",
    "src/services/aiTools.js",
    "src/services/aiService.js",
    "src/services/executionEngine.js",
    "src/repositories/executionRepository.js",
    "src/repositories/decisionLifecycleRepository.js",
    "src/db/connection.js",
    "src/db/migrate.js",
    ...extra,
  ];
  for (const m of mods) {
    const p = path.join(BASE, m);
    try {
      delete require.cache[require.resolve(p)];
    } catch (e) {
      /* not yet loaded, fine */
    }
  }
}

function setupScratchDb() {
  const dataDir = path.join(os.tmpdir(), `founderos-explicit-search-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dataDir, { recursive: true });
  process.env.DATA_DIR = dataDir;
  return dataDir;
}

function installAiServiceStub({ detectImpl, draftImpl }) {
  const p = path.join(BASE, "src/services/aiService.js");
  const real = require(p);
  const calls = { detect: 0, draft: 0, onboarding: 0 };
  const stub = {
    ...real,
    detectExplicitActionRequest: async (...args) => {
      calls.detect++;
      return detectImpl(...args);
    },
    draftSearchAnswer: async (...args) => {
      calls.draft++;
      return draftImpl ? draftImpl(...args) : "stubbed draft answer";
    },
    synthesizeOnboardingTurn: async (...args) => {
      calls.onboarding++;
      return { ready: false, reply: "stubbed onboarding reply", founderName: null };
    },
  };
  require.cache[require.resolve(p)] = { id: require.resolve(p), filename: require.resolve(p), loaded: true, exports: stub };
  return calls;
}

test("explicit search request — 'Search Reddit' alone finds results, never asks for a name", async () => {
  freshModules();
  setupScratchDb();
  const tavily = await startMockTavily(
    fixedResultsHandler([
      { title: "r/leadgen", url: "https://www.reddit.com/r/leadgen/", content: "Community about lead generation problems" },
      { title: "Struggling with lead gen", url: "https://www.reddit.com/r/leadgen/comments/xyz/struggling/", content: "Founders sharing pain points" },
    ])
  );
  const restoreFetch = redirectTavilyFetchTo(tavily);
  try {
    process.env.TAVILY_API_KEY = "tvly-test-key";

    require(path.join(BASE, "src/db/migrate.js")).runMigrations();
    const calls = installAiServiceStub({
      detectImpl: async (userId, { text }) => {
        assert.equal(text, "Search Reddit");
        return { isExplicitSearch: true, source: "reddit", query: "lead generation problems" };
      },
      draftImpl: async (userId, { query, source, textForModel }) => {
        assert.equal(query, "lead generation problems");
        assert.equal(source, "reddit");
        assert.ok(textForModel.includes("leadgen"));
        return "Found some real Reddit threads about lead generation pain points.";
      },
    });
    const executionEngine = require(path.join(BASE, "src/services/executionEngine.js"));

    const result = await executionEngine.handleMessage("user-search-1", { profile: {}, text: "Search Reddit", recentHistory: [] });

    assert.equal(result.event, "search_result");
    assert.equal(result.task, null);
    assert.ok(!/name|what.*building|tell me about/i.test(result.reply), "must not fall back into an onboarding question");
    assert.equal(result.reply, "Found some real Reddit threads about lead generation pain points.");
    assert.equal(calls.detect, 1);
    assert.equal(calls.draft, 1);
    assert.equal(calls.onboarding, 0, "must never touch the onboarding path");
    assert.equal(result.sources.length, 2);
  } finally {
    restoreFetch();
    tavily.close();
  }
});

test("explicit search request — 'Search Reddit for X' does not ask about the startup", async () => {
  freshModules();
  setupScratchDb();
  const tavily = await startMockTavily(fixedResultsHandler([{ title: "r/SaaS", url: "https://www.reddit.com/r/SaaS/", content: "SaaS founders discussing pricing" }]));
  const restoreFetch = redirectTavilyFetchTo(tavily);
  try {
    process.env.TAVILY_API_KEY = "tvly-test-key";

    require(path.join(BASE, "src/db/migrate.js")).runMigrations();
    const calls = installAiServiceStub({
      detectImpl: async () => ({ isExplicitSearch: true, source: "reddit", query: "SaaS pricing discussions" }),
      draftImpl: async () => "Here's what people are saying about SaaS pricing on Reddit.",
    });
    const executionEngine = require(path.join(BASE, "src/services/executionEngine.js"));

    const result = await executionEngine.handleMessage("user-search-2", { profile: {}, text: "Search Reddit for people discussing SaaS pricing", recentHistory: [] });

    assert.equal(result.event, "search_result");
    assert.ok(!/what.*startup|tell me more about your|what are you building/i.test(result.reply));
    assert.equal(calls.onboarding, 0);
  } finally {
    restoreFetch();
    tavily.close();
  }
});

test("explicit search request — network failure produces a clean, short message; no fabricated results, no follow-up question", async () => {
  freshModules();
  setupScratchDb();
  const restoreFetch = redirectTavilyFetchTo(19999); // nothing listening -> ECONNREFUSED -> SEARCH_UNREACHABLE
  try {
    process.env.TAVILY_API_KEY = "tvly-test-key";

    require(path.join(BASE, "src/db/migrate.js")).runMigrations();
    const calls = installAiServiceStub({
      detectImpl: async () => ({ isExplicitSearch: true, source: "reddit", query: "anything" }),
    });
    const executionEngine = require(path.join(BASE, "src/services/executionEngine.js"));

    const result = await executionEngine.handleMessage("user-search-3", { profile: {}, text: "Search Reddit for anything", recentHistory: [] });

    assert.equal(result.event, "search_result");
    assert.equal(result.task, null);
    assert.equal(calls.draft, 0, "must not attempt to draft an answer from nonexistent results");
    assert.ok(!/\?$/.test(result.reply.trim()), "must be a terminal statement, not a follow-up question");
    assert.ok(!/ECONNREFUSED|Error:|stack/i.test(result.reply), "no raw error leaked");
    assert.match(result.reply, /couldn't search|please try again/i);
  } finally {
    restoreFetch();
  }
});

test("explicit search request — timeout produces the timeout-specific message", async () => {
  freshModules();
  setupScratchDb();
  const tavily = await startMockTavily(neverRespondHandler());
  const restoreFetch = redirectTavilyFetchTo(tavily);
  try {
    process.env.TAVILY_API_KEY = "tvly-test-key";
    process.env.TAVILY_TIMEOUT_MS = "300"; // fast timeout so the test doesn't hang

    require(path.join(BASE, "src/db/migrate.js")).runMigrations();
    installAiServiceStub({
      detectImpl: async () => ({ isExplicitSearch: true, source: "web", query: "anything" }),
    });
    const executionEngine = require(path.join(BASE, "src/services/executionEngine.js"));

    const result = await executionEngine.handleMessage("user-search-4", { profile: {}, text: "search for anything please", recentHistory: [] });

    assert.equal(result.event, "search_result");
    assert.match(result.reply, /timed out/i);
  } finally {
    restoreFetch();
    tavily.close();
    delete process.env.TAVILY_TIMEOUT_MS;
  }
});

test("explicit search request — zero results is treated as zero-results, not an error", async () => {
  freshModules();
  setupScratchDb();
  const tavily = await startMockTavily(fixedResultsHandler([]));
  const restoreFetch = redirectTavilyFetchTo(tavily);
  try {
    process.env.TAVILY_API_KEY = "tvly-test-key";

    require(path.join(BASE, "src/db/migrate.js")).runMigrations();
    const calls = installAiServiceStub({
      detectImpl: async () => ({ isExplicitSearch: true, source: "linkedin", query: "extremely obscure niche topic" }),
    });
    const executionEngine = require(path.join(BASE, "src/services/executionEngine.js"));

    const result = await executionEngine.handleMessage("user-search-5", { profile: {}, text: "search linkedin for an extremely obscure niche topic", recentHistory: [] });

    assert.equal(result.event, "search_result");
    assert.equal(calls.draft, 0, "no AI draft call for the zero-results case — fixed template only");
    assert.match(result.reply, /couldn't find relevant LinkedIn discussions/i);
  } finally {
    restoreFetch();
    tavily.close();
  }
});

test("non-trigger conversational messages never reach the classifier at all", async () => {
  freshModules();
  setupScratchDb();
  require(path.join(BASE, "src/db/migrate.js")).runMigrations();
  const calls = installAiServiceStub({
    detectImpl: async () => {
      throw new Error("must not be called for non-trigger messages");
    },
  });
  const executionEngine = require(path.join(BASE, "src/services/executionEngine.js"));

  for (const text of ["Why do startups struggle with customer acquisition?", "I'm thinking about lead generation", "I have a problem with lead generation"]) {
    const result = await executionEngine.handleExplicitSearchRequest("user-non-trigger", { text, recentHistory: [] });
    assert.equal(result, null, `"${text}" must not be treated as an explicit search request`);
  }
  assert.equal(calls.detect, 0, "keyword gate must filter these out before any AI call");
});

test("classifier correctly says no for topic-adjacent conversation even when the keyword gate lets it through", async () => {
  freshModules();
  setupScratchDb();
  require(path.join(BASE, "src/db/migrate.js")).runMigrations();
  const calls = installAiServiceStub({
    detectImpl: async (userId, { text }) => ({ isExplicitSearch: false, source: null, query: null }),
  });
  const executionEngine = require(path.join(BASE, "src/services/executionEngine.js"));

  const result = await executionEngine.handleExplicitSearchRequest("user-adjacent", { text: "I've been doing a lot of research on my own about this problem", recentHistory: [] });
  assert.equal(result, null);
  assert.equal(calls.detect, 1, "gate correctly let it through to the classifier");
});

test("regression — onboarding flow is completely unaffected for an ordinary (non-search) message", async () => {
  freshModules();
  setupScratchDb();
  require(path.join(BASE, "src/db/migrate.js")).runMigrations();
  const calls = installAiServiceStub({
    detectImpl: async () => {
      throw new Error("must not be called — no gate keyword in this message");
    },
  });
  const executionEngine = require(path.join(BASE, "src/services/executionEngine.js"));

  const result = await executionEngine.handleMessage("user-onboarding-1", { profile: {}, text: "My name is Sam and I'm building a scheduling tool", recentHistory: [] });

  assert.equal(result.event, "onboarding");
  assert.equal(result.reply, "stubbed onboarding reply");
  assert.equal(calls.onboarding, 1);
  assert.equal(calls.detect, 0);
});

test("aiTools.executeTool additive fields are correct for success, zero-results, and error, and remain backward-compatible", async () => {
  freshModules();
  const tavily = await startMockTavily(fixedResultsHandler([{ title: "A", url: "https://example.com/a", content: "x" }]));
  const restore1 = redirectTavilyFetchTo(tavily);
  try {
    process.env.TAVILY_API_KEY = "tvly-test-key";
    const aiTools = require(path.join(BASE, "src/services/aiTools.js"));

    const ok = await aiTools.executeTool("web_search", { query: "test" });
    assert.equal(ok.success, true);
    assert.equal(ok.resultCount, 1);
    assert.equal(ok.errorCode, null);
    assert.equal(ok.errorMessage, null);
    assert.equal(typeof ok.textForModel, "string");
    assert.ok(Array.isArray(ok.sources));
  } finally {
    restore1();
    tavily.close();
  }

  freshModules();
  const restore2 = redirectTavilyFetchTo(19999);
  try {
    process.env.TAVILY_API_KEY = "tvly-test-key";
    const aiTools2 = require(path.join(BASE, "src/services/aiTools.js"));
    const bad = await aiTools2.executeTool("web_search", { query: "test" });
    assert.equal(bad.success, false);
    assert.equal(bad.resultCount, 0);
    assert.equal(bad.errorCode, "SEARCH_UNREACHABLE");
    assert.equal(bad.errorMessage, "The web search service could not be reached.");
  } finally {
    restore2();
  }
});
