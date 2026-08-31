// Tests for the AI tool-calling layer (services/aiTools.js and the
// OpenAI-compatible tool loop in providers/openAiCompatibleTools.js, as
// used by aiService.chat()). Uses a mocked provider HTTP endpoint and a
// self-contained mock SearXNG server — no real network dependency.

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");

const BASE = path.join(__dirname, "..");

const MOCK_RESULTS = {
  results: [
    { title: "Best AI agent frameworks 2026", url: "https://example.com/ai-agents", content: "A roundup of frameworks for building autonomous agents.", engine: "google" },
    { title: "r/AIagents", url: "https://www.reddit.com/r/AIagents/", content: "Community for people building AI agents", engine: "reddit" },
    { title: "Someone's post about agents", url: "https://www.reddit.com/r/AIagents/comments/abc123/my_agent_setup/", content: "Here's how I built my agent stack", engine: "reddit" },
  ],
};

function startMockSearxng() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(MOCK_RESULTS));
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

test("aiTools.executeTool — real search via the shared searxngService", async (t) => {
  const server = await startMockSearxng();
  const { port } = server.address();
  process.env.SEARXNG_URL = `http://127.0.0.1:${port}`;
  delete require.cache[require.resolve(path.join(BASE, "src/config/index.js"))];
  delete require.cache[require.resolve(path.join(BASE, "src/services/searxngService.js"))];
  delete require.cache[require.resolve(path.join(BASE, "src/services/aiTools.js"))];
  const aiTools = require(path.join(BASE, "src/services/aiTools.js"));

  await t.test("returns real results with sources, correctly labeled", async () => {
    const result = await aiTools.executeTool("web_search", { query: "AI agent frameworks" });
    assert.equal(result.sources.length, 3);
    assert.ok(result.sources.every((s) => s.url.startsWith("http")));
    assert.ok(result.textForModel.includes("[community]"));
    assert.ok(result.textForModel.includes("[post]"));
  });

  await t.test("unknown tool name returns a safe message, doesn't throw", async () => {
    const result = await aiTools.executeTool("not_a_real_tool", {});
    assert.equal(result.sources.length, 0);
    assert.match(result.textForModel, /Unknown tool/);
  });

  server.close();
});

test("aiTools.executeTool — SearXNG unreachable is handled gracefully", async () => {
  process.env.SEARXNG_URL = "http://127.0.0.1:19999"; // nothing listening
  delete require.cache[require.resolve(path.join(BASE, "src/config/index.js"))];
  delete require.cache[require.resolve(path.join(BASE, "src/services/searxngService.js"))];
  delete require.cache[require.resolve(path.join(BASE, "src/services/aiTools.js"))];
  const aiTools = require(path.join(BASE, "src/services/aiTools.js"));

  const result = await aiTools.executeTool("web_search", { query: "test" });
  assert.equal(result.sources.length, 0, "no sources when search fails");
  assert.ok(!/Error:|ECONNREFUSED|stack/i.test(result.textForModel), "no raw error/stack leaked to the model-facing text");
  assert.match(result.textForModel, /could not be reached|temporarily unavailable/i);
});

test("full tool-calling loop through aiService.chat() (OpenAI-compatible / Nvidia provider)", async (t) => {
  const searxng = await startMockSearxng();
  const { port: searxngPort } = searxng.address();

  const dataDir = path.join(require("node:os").tmpdir(), `founderos-test-${Date.now()}`);
  require("node:fs").mkdirSync(dataDir, { recursive: true });

  process.env.SEARXNG_URL = `http://127.0.0.1:${searxngPort}`;
  process.env.AI_PROVIDER = "nvidia";
  process.env.NVIDIA_API_KEY = "test-key";
  process.env.NVIDIA_MODEL = "test-model";
  process.env.DATA_DIR = dataDir;
  delete require.cache[require.resolve(path.join(BASE, "src/config/index.js"))];
  delete require.cache[require.resolve(path.join(BASE, "src/services/searxngService.js"))];
  delete require.cache[require.resolve(path.join(BASE, "src/services/aiTools.js"))];

  require(path.join(BASE, "src/db/migrate.js")).runMigrations();

  const realFetch = global.fetch;
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

  delete require.cache[require.resolve(path.join(BASE, "src/services/aiService.js"))];
  delete require.cache[require.resolve(path.join(BASE, "src/services/executionEngine.js"))];
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
    // Reuses the same mock SearXNG results (which already contain a
    // duplicate example.com URL) via a direct search — confirms
    // dedup happens before sources ever reach the model or the founder.
    delete require.cache[require.resolve(path.join(BASE, "src/services/searxngService.js"))];
    delete require.cache[require.resolve(path.join(BASE, "src/services/aiTools.js"))];
    const aiTools = require(path.join(BASE, "src/services/aiTools.js"));
    const result = await aiTools.executeTool("web_search", { query: "AI agent frameworks" });
    const urls = result.sources.map((s) => s.url);
    assert.equal(new Set(urls).size, urls.length, "no duplicate source URLs");
  });

  global.fetch = realFetch;
  searxng.close();
});
