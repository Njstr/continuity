// tavilyService.js — the one place in the codebase that talks to the
// Tavily Search API (https://api.tavily.com/search). Replaces
// searxngService.js as the provider behind aiTools.js's web_search tool
// and webResearchService.js's research pipeline, after the self-hosted
// SearXNG instance proved unreliable to keep running on Render (dead
// upstream engines rate-limited/blocked on the shared host IP — see
// prior debugging in this codebase's history). searxngService.js is left
// in place, fully working and tested, in case self-hosting is revisited
// later — nothing currently requires it.
//
// Error codes are intentionally renamed from the old SEARXNG_* namespace
// to a provider-neutral SEARCH_* one (SEARCH_NOT_CONFIGURED,
// SEARCH_TIMEOUT, SEARCH_UNREACHABLE, SEARCH_RATE_LIMITED,
// SEARCH_UNAUTHORIZED, SEARCH_MALFORMED_RESPONSE, plus the
// already-neutral INVALID_QUERY) — leaving "SEARXNG_TIMEOUT" in logs and
// user-facing error branches once Tavily is the actual provider would be
// actively misleading during the next debugging session. Every consumer
// (aiTools.js, executionEngine.js, webResearchService.js,
// routes/execution.js, config/index.js) was updated to the new names in
// the same change as this file.

const config = require("../config");
const { withTimeout } = require("../utils/retry");
const { sanitizeUrl, dedupeByUrl } = require("./searchResultUtils");

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
const ALLOWED_TIME_RANGES = new Set(["day", "week", "month", "year"]);
const MAX_QUERY_LENGTH = 400;

function isConfigured() {
  return !!config.tavilyApiKey;
}

// ---- Input validation ----
// Same reasoning as the old searxngService.js: the AI proposes these
// parameters via the tool call, so they're untrusted input, validated
// and clamped here rather than passed straight into an upstream request.
//
// `categories` and `engines` are accepted for backward compatibility with
// the existing web_search tool schema in aiTools.js (unchanged, so
// nothing else needed to be touched there), but Tavily has no concept of
// selecting individual search engines, so `engines` is accepted and
// silently ignored. `categories` is coarsely folded into Tavily's `topic`
// (general/news) — the two enums don't line up 1:1, so anything other
// than "news" maps to Tavily's default "general" topic rather than
// guessing a finer mapping that doesn't really exist on Tavily's side.
// `page` (SearXNG-style pagination) has no Tavily equivalent either — a
// single call returns up to maxResults, so `page` is accepted but ignored.
function validateSearchParams({ query, categories, timeRange, maxResults }) {
  if (typeof query !== "string" || !query.trim()) {
    const err = new Error("query is required");
    err.code = "INVALID_QUERY";
    throw err;
  }
  const cleanQuery = query.trim().slice(0, MAX_QUERY_LENGTH);
  const cleanTopic = Array.isArray(categories) && categories.includes("news") ? "news" : "general";
  const cleanTimeRange = ALLOWED_TIME_RANGES.has(timeRange) ? timeRange : undefined;
  const cleanMaxResults = Math.min(Math.max(Number.isInteger(maxResults) ? maxResults : config.tavilyMaxResults, 1), Math.min(config.tavilyMaxResults, 20)); // Tavily caps at 20 results per call

  return { query: cleanQuery, topic: cleanTopic, timeRange: cleanTimeRange, maxResults: cleanMaxResults };
}

function normalizeResult(raw) {
  const url = sanitizeUrl(raw.url);
  if (!url) return null; // drop anything without a safe, well-formed URL
  return {
    title: typeof raw.title === "string" ? raw.title.slice(0, 300) : url,
    url,
    snippet: typeof raw.content === "string" ? raw.content.slice(0, 600) : "",
    source: "tavily",
    category: "general",
    publishedDate: null, // Tavily's base /search response doesn't include a reliable publish date field
    thumbnail: null,
  };
}

/**
 * Runs a single search against the Tavily Search API and returns
 * normalized, deduplicated results. Never throws for "no results"
 * (returns an empty array) — only throws for genuine failures (not
 * configured, unauthorized, unreachable, timeout, malformed response),
 * which callers translate into a friendly message rather than crashing.
 */
async function search(params) {
  if (!isConfigured()) {
    const err = new Error("Web search is not configured on this server.");
    err.code = "SEARCH_NOT_CONFIGURED";
    throw err;
  }

  const { query, topic, timeRange, maxResults } = validateSearchParams(params);

  const body = {
    query,
    topic,
    max_results: maxResults,
    include_answer: false, // we only use the results list, not Tavily's synthesized answer — skip the extra generation cost/latency
  };
  if (timeRange) body.time_range = timeRange;

  let res;
  try {
    res = await withTimeout(
      (signal) =>
        fetch(TAVILY_SEARCH_URL, {
          method: "POST",
          signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.tavilyApiKey}`,
          },
          body: JSON.stringify(body),
        }),
      config.tavilyTimeoutMs
    );
  } catch (err) {
    if (err.code === "TIMEOUT") {
      const timeoutErr = new Error("Web search timed out.");
      timeoutErr.code = "SEARCH_TIMEOUT";
      throw timeoutErr;
    }
    // Connection refused / DNS failure / Tavily down.
    const connErr = new Error("Could not reach the web search service.");
    connErr.code = "SEARCH_UNREACHABLE";
    connErr.cause = err;
    throw connErr;
  }

  if (res.status === 401 || res.status === 403) {
    const err = new Error("Web search authentication failed — the API key is missing or invalid.");
    err.code = "SEARCH_UNAUTHORIZED";
    throw err;
  }
  if (res.status === 429) {
    const err = new Error("Web search is rate-limited right now.");
    err.code = "SEARCH_RATE_LIMITED";
    throw err;
  }
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    const err = new Error(`Tavily returned ${res.status}`);
    err.code = "SEARCH_ERROR";
    err.status = res.status;
    err.detail = errBody.slice(0, 300);
    throw err;
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    const malformedErr = new Error("Web search returned an unreadable response.");
    malformedErr.code = "SEARCH_MALFORMED_RESPONSE";
    throw malformedErr;
  }

  const rawResults = Array.isArray(data?.results) ? data.results : [];
  const normalized = dedupeByUrl(rawResults.map(normalizeResult).filter(Boolean)).slice(0, maxResults);

  return {
    query,
    results: normalized,
    suggestions: [], // Tavily has no query-suggestions concept; kept for interface parity with the old provider
  };
}

module.exports = { search, isConfigured };
