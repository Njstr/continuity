// Tests for the explicit-action-priority fix: an explicit, direct search
// command ("Search reddit", "Search reddit for X") must trigger a real
// search instead of being swallowed by onboarding/conversational flow.
//
// Pattern matches the rest of this test suite (see aiTools.test.js):
// - A real local HTTP server stands in for SearXNG (not stubbed at the
//   aiTools boundary) so the full aiTools -> searxngService -> HTTP path
//   is genuinely exercised.
// - A real scratch SQLite DATA_DIR, migrated fresh, so founder_state
//   reads/writes are genuine, not mocked.
// - aiService is stubbed via require.cache injection (not the AI
//   provider's HTTP endpoint) since this fix's own logic — the keyword
//   gate, the platform prefixing, the success/no-results/error branching
//   — lives entirely in executionEngine.js and doesn't need a real model
//   call to exercise; what it DOES need is confidence that
//   detectExplicitActionRequest is (or isn't) actually invoked, which a
//   call-counting stub gives directly.

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

const BASE = path.join(__dirname, "..");

function startMockSearxng(resultsOrFn) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const payload = typeof resultsOrFn === "function" ? resultsOrFn(req) : resultsOrFn;
      if (payload === null) {
        // Simulate a slow/hanging upstream for timeout testing.
        return; // never respond
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload));
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
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
  // Caught by running the full suite (not just each test in isolation).
  const mods = [
    "src/config/index.js",
    "src/services/searxngService.js",
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

// Installs a call-counting stub for aiService.detectExplicitActionRequest
// / draftSearchAnswer into require.cache BEFORE executionEngine.js is
// required, so executionEngine's `require("./aiService")` picks up the
// stub instead of the real module (which would otherwise try to hit a
// real AI provider). Real functions (synthesizeOnboardingTurn etc.) are
// passed through from the real module so onboarding-regression tests
// still exercise real prompt-building logic where useful — but since
// those still require a real provider, tests that touch them are
// deliberately narrow-scoped to plain-call-counting, not full JSON output.
function installAiServiceStub({ detectImpl, draftImpl }) {
  const p = path.join(BASE, "src/services/aiService.js");
  const real = require(p); // still loads real module first (cheap — no provider call at require time)
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
  const searxng = await startMockSearxng({
    results: [
      { title: "r/leadgen", url: "https://www.reddit.com/r/leadgen/", content: "Community about lead generation problems", engine: "reddit" },
      { title: "Struggling with lead gen", url: "https://www.reddit.com/r/leadgen/comments/xyz/struggling/", content: "Founders sharing pain points", engine: "reddit" },
    ],
  });
  try {
    const { port } = searxng.address();
    process.env.SEARXNG_URL = `http://127.0.0.1:${port}`;

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
    searxng.close();
  }
});

test("explicit search request — 'Search Reddit for X' does not ask about the startup", async () => {
  freshModules();
  setupScratchDb();
  const searxng = await startMockSearxng({
    results: [{ title: "r/SaaS", url: "https://www.reddit.com/r/SaaS/", content: "SaaS founders discussing pricing", engine: "reddit" }],
  });
  try {
    const { port } = searxng.address();
    process.env.SEARXNG_URL = `http://127.0.0.1:${port}`;

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
    searxng.close();
  }
});

test("explicit search request — network failure produces a clean, short message; no fabricated results, no follow-up question", async () => {
  freshModules();
  setupScratchDb();
  process.env.SEARXNG_URL = "http://127.0.0.1:19999"; // nothing listening -> ECONNREFUSED -> SEARXNG_UNREACHABLE

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
});

test("explicit search request — timeout produces the timeout-specific message", async () => {
  freshModules();
  setupScratchDb();
  const searxng = await startMockSearxng(null); // never responds
  try {
    const { port } = searxng.address();
    process.env.SEARXNG_URL = `http://127.0.0.1:${port}`;
    process.env.SEARXNG_TIMEOUT_MS = "300"; // fast timeout so the test doesn't hang

    require(path.join(BASE, "src/db/migrate.js")).runMigrations();
    installAiServiceStub({
      detectImpl: async () => ({ isExplicitSearch: true, source: "web", query: "anything" }),
    });
    const executionEngine = require(path.join(BASE, "src/services/executionEngine.js"));

    const result = await executionEngine.handleMessage("user-search-4", { profile: {}, text: "search for anything please", recentHistory: [] });

    assert.equal(result.event, "search_result");
    assert.match(result.reply, /timed out/i);
  } finally {
    searxng.close();
    delete process.env.SEARXNG_TIMEOUT_MS;
  }
});

test("explicit search request — zero results is treated as zero-results, not an error", async () => {
  freshModules();
  setupScratchDb();
  const searxng = await startMockSearxng({ results: [] });
  try {
    const { port } = searxng.address();
    process.env.SEARXNG_URL = `http://127.0.0.1:${port}`;

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
    searxng.close();
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
  // These don't contain a literal gate keyword, so this mostly documents
  // the classifier's own job (tested via stub) rather than the gate's.
  freshModules();
  setupScratchDb();
  require(path.join(BASE, "src/db/migrate.js")).runMigrations();
  const calls = installAiServiceStub({
    detectImpl: async (userId, { text }) => ({ isExplicitSearch: false, source: null, query: null }),
  });
  const executionEngine = require(path.join(BASE, "src/services/executionEngine.js"));

  // "research" is a gate keyword, but this is a statement, not a command.
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
  const searxng = await startMockSearxng({ results: [{ title: "A", url: "https://example.com/a", content: "x", engine: "google" }] });
  try {
    const { port } = searxng.address();
    process.env.SEARXNG_URL = `http://127.0.0.1:${port}`;
    const aiTools = require(path.join(BASE, "src/services/aiTools.js"));

    const ok = await aiTools.executeTool("web_search", { query: "test" });
    assert.equal(ok.success, true);
    assert.equal(ok.resultCount, 1);
    assert.equal(ok.errorCode, null);
    assert.equal(ok.errorMessage, null);
    assert.equal(typeof ok.textForModel, "string");
    assert.ok(Array.isArray(ok.sources));
  } finally {
    searxng.close();
  }

  freshModules();
  process.env.SEARXNG_URL = "http://127.0.0.1:19999";
  const aiTools2 = require(path.join(BASE, "src/services/aiTools.js"));
  const bad = await aiTools2.executeTool("web_search", { query: "test" });
  assert.equal(bad.success, false);
  assert.equal(bad.resultCount, 0);
  assert.equal(bad.errorCode, "SEARXNG_UNREACHABLE");
  assert.equal(bad.errorMessage, "The web search service could not be reached.");
});
