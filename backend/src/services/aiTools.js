// aiTools.js — FounderOS's tools available to the AI via the generic
// tool-calling contract in AIProvider.js. Currently just web_search
// (SearXNG-backed), but built so a second tool is just another entry in
// TOOLS plus a case in executeTool — nothing provider-specific lives here.

const searxngService = require("./searxngService");

const WEB_SEARCH_TOOL = {
  name: "web_search",
  description:
    "Search the live web (general web, Reddit, GitHub, forums, news, documentation, or a specific site) and get back real, current results with source URLs. Use this when the founder is asking about something that needs current information you don't already know from the conversation — finding communities, researching competitors, checking what people are currently saying about something, finding documentation or examples, or anything time-sensitive. Don't use it for things answerable from the conversation itself or from general knowledge that doesn't change (e.g. explaining a concept). You can call this more than once in a row for a genuinely multi-part research question (e.g. a general search plus a Reddit-scoped search), but keep searches purposeful — don't run more than a few for one question.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "The search query. For Reddit/community discovery, use site:reddit.com or site:reddit.com/r/ in the query." },
      categories: {
        type: "array",
        items: { type: "string", enum: ["general", "news", "it", "science", "files", "images", "videos", "music", "social media", "map"] },
        description: "Optional. Narrows results to these categories.",
      },
      engines: { type: "array", items: { type: "string" }, description: "Optional. Specific search engines to use, if you need to target one in particular." },
      language: { type: "string", description: "Optional. Language code, e.g. 'en'." },
      time_range: { type: "string", enum: ["day", "week", "month", "year"], description: "Optional. Restricts results to a recent time window — useful for 'latest'/'current' questions." },
      page: { type: "integer", description: "Optional. Result page number, for going beyond the first page." },
      max_results: { type: "integer", description: "Optional. How many results to return (server caps this regardless)." },
    },
    required: ["query"],
  },
};

const TOOLS = [WEB_SEARCH_TOOL];

// Formats normalized search results into plain text for the model to
// read and reason over — separate from what the founder eventually sees
// (the frontend renders `sources` as real clickable cards, not this
// text). Reddit results get a lightweight community/post/other label so
// the model can tell a subreddit apart from an individual post without
// re-deriving that itself.
function formatResultsForModel(query, results) {
  if (!results.length) return `No results found for "${query}".`;
  const lines = results.map((r, i) => {
    const redditTag = r.url.includes("reddit.com") ? ` [${searxngService.classifyRedditUrl(r.url)?.type || "reddit"}]` : "";
    const date = r.publishedDate ? ` (${r.publishedDate})` : "";
    return `${i + 1}. ${r.title}${redditTag}${date}\n   ${r.url}\n   ${r.snippet}`;
  });
  return `Results for "${query}":\n\n${lines.join("\n\n")}`;
}

// Per-error-code friendly text, used two ways: appended with the
// "answer from what you know" hedge for the AGENTIC tool-calling loop
// (the model reads this and decides what to say), and used bare — no
// hedge, no invitation to fall back into conversation — for the
// deterministic explicit-action path in executionEngine.js, where the
// whole point is that a founder who explicitly asked FounderOS to search
// gets a clean, short, terminal failure message, never a pivot back into
// chatting.
const ERROR_MESSAGES = {
  SEARXNG_NOT_CONFIGURED: "Web search is not set up on this server right now.",
  SEARXNG_TIMEOUT: "The search timed out.",
  SEARXNG_UNREACHABLE: "The web search service could not be reached.",
  SEARXNG_RATE_LIMITED: "Web search is rate-limited right now.",
  SEARXNG_MALFORMED_RESPONSE: "The web search service returned an unreadable response.",
  INVALID_QUERY: "That search query wasn't valid.",
};
const DEFAULT_ERROR_MESSAGE = "Web search is temporarily unavailable.";

/**
 * Executes a tool call by name. Returns { textForModel, sources,
 * success, errorCode, resultCount, errorMessage }.
 *
 * textForModel/sources are the original, unchanged AIProvider
 * tool-calling contract — `sources` accumulate into the response's
 * `citations`, which is how the founder-facing Sources list gets built
 * from something the AI can never invent: only real URLs a real search
 * actually returned.
 *
 * success/errorCode/resultCount/errorMessage are additive fields (safe —
 * both AIProvider implementations only ever destructure textForModel/
 * sources, see providers/AnthropicProvider.js and
 * providers/openAiCompatibleTools.js) added for the DETERMINISTIC
 * explicit-action path in executionEngine.js, which needs to reliably
 * tell apart SUCCESS-with-results, SUCCESS-with-zero-results, and a
 * genuine ERROR — a distinction the plain textForModel string alone
 * can't safely be parsed back out of.
 */
async function executeTool(name, args) {
  if (name !== "web_search") {
    return { textForModel: `Unknown tool: ${name}`, sources: [], success: false, errorCode: "UNKNOWN_TOOL", resultCount: 0, errorMessage: "That tool isn't available." };
  }

  try {
    const { results } = await searxngService.search({
      query: args.query,
      categories: args.categories,
      engines: args.engines,
      language: args.language,
      timeRange: args.time_range,
      page: args.page,
      maxResults: args.max_results,
    });
    return {
      textForModel: formatResultsForModel(args.query, results),
      sources: results.map((r) => ({ url: r.url, title: r.title })),
      success: true,
      errorCode: null,
      resultCount: results.length,
      errorMessage: null,
    };
  } catch (e) {
    // Handled gracefully — the model gets a plain-language reason it can
    // pass along to the founder, never a raw error/stack, and the turn
    // doesn't crash just because search failed.
    const friendly = ERROR_MESSAGES[e.code] || DEFAULT_ERROR_MESSAGE;
    // eslint-disable-next-line no-console
    console.error(`[aiTools] web_search failed (${e.code || "unknown"}):`, e.message);
    return {
      textForModel: `${friendly} Answer from what you already know if possible, and let the founder know live search wasn't available.`,
      sources: [],
      success: false,
      errorCode: e.code || "UNKNOWN_ERROR",
      resultCount: 0,
      errorMessage: friendly,
    };
  }
}

module.exports = { TOOLS, executeTool };
