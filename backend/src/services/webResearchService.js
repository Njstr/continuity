// webResearchService.js — the clean abstraction §6/§31 of the autonomous-
// execution spec asks for. searxngService.js (unchanged) stays the one
// place that talks to SearXNG directly; this service sits one layer up
// and owns the actual RESEARCH PIPELINE (§7): plan queries -> search ->
// dedupe -> rank -> fetch top sources -> extract readable content ->
// return normalized, structured sources. Nothing above this service
// talks to SearXNG or does raw HTTP fetching of external pages directly
// — executionEngine and aiService only ever call research()/search()/
// fetchAndExtract() here.
//
// ---- Why SearXNG was "not working" (§37) ----
// searxngService.js itself (request construction, timeout handling,
// response parsing, error codes) is solid — see its own comments. The
// actual failure mode traced to config/index.js: `searxngUrl` defaults to
// an empty string, and unlike the AI-provider keys, there was no boot-
// time validation flagging a missing SEARXNG_URL — so every web_search
// call was silently short-circuiting into the SEARXNG_NOT_CONFIGURED
// branch in aiTools.js, which aiTools already handles "gracefully" (tells
// the model to answer from its own knowledge) rather than surfacing the
// real problem anywhere visible. The app never crashed, which is exactly
// why this was easy to miss: FounderOS quietly never did live research at
// all. This service doesn't change that error-handling contract (still
// throws the same SEARXNG_* error codes searxngService already defines —
// see fetchAndExtract below for one further, genuinely new failure mode),
// but a new diagnostic endpoint (GET /execution/research-health) now
// makes this checkable directly instead of inferred from behavior — see
// routes/execution.js. There is also a second, very common real-world
// SearXNG gotcha this codebase can't detect from here at all: SearXNG
// ships with its JSON API format DISABLED by default (`search: formats:`
// in searxng's own settings.yml must include `- json`) — if SEARXNG_URL
// IS set and the instance IS reachable but format=json still gets
// rejected, that's almost always the cause. See the implementation
// summary's "environment/configuration" section for the exact fix.

const cheerio = require("cheerio");
const searxngService = require("./searxngService");
const config = require("../config");
const { withTimeout } = require("../utils/retry");

// ---- search() ----
// Thin, typed passthrough to searxngService — kept here (rather than
// having callers reach into searxngService directly) so this module is
// the single place other services import for ANY web-research need,
// search or fetch alike (§31).
async function search(params) {
  return searxngService.search(params);
}

// ---- fetchAndExtract(url) ----
// The genuinely new capability (§6/§31) — searxngService only ever
// returns search-result snippets, never full page content. This fetches
// a specific URL and extracts its readable text, the same way
// extractText.js already handles uploaded HTML-producing documents
// (mammoth's DOCX->HTML path) — reusing cheerio rather than introducing
// a second HTML-parsing dependency.
const FETCH_TIMEOUT_MS = 8000;
const MAX_EXTRACTED_CHARS = 6000; // enough for real analysis without storing/forwarding unbounded page content (§32)
const MAX_FETCH_BYTES = 3_000_000; // refuse to buffer pathologically large pages

async function fetchAndExtract(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    const err = new Error("Not a valid URL.");
    err.code = "INVALID_URL";
    throw err;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    const err = new Error("Only http(s) URLs can be fetched.");
    err.code = "INVALID_URL";
    throw err;
  }

  let res;
  try {
    res = await withTimeout(
      (signal) => fetch(parsed.toString(), { signal, headers: { Accept: "text/html,application/xhtml+xml" }, redirect: "follow" }),
      FETCH_TIMEOUT_MS
    );
  } catch (err) {
    if (err.code === "TIMEOUT") {
      const e = new Error(`Fetching ${url} timed out.`);
      e.code = "FETCH_TIMEOUT";
      throw e;
    }
    const e = new Error(`Could not reach ${url}.`);
    e.code = "FETCH_UNREACHABLE";
    e.cause = err;
    throw e;
  }

  if (!res.ok) {
    const e = new Error(`${url} returned ${res.status}.`);
    e.code = "FETCH_HTTP_ERROR";
    e.status = res.status;
    throw e;
  }

  const contentType = res.headers.get("content-type") || "";
  if (!/text\/html|application\/xhtml/.test(contentType) && contentType !== "") {
    // Not a page we can meaningfully extract readable text from (PDF,
    // image, JSON API, etc.) — a clean, honest failure rather than
    // returning garbage or binary data as "content".
    const e = new Error(`${url} is not an HTML page (content-type: ${contentType}).`);
    e.code = "FETCH_NOT_HTML";
    throw e;
  }

  const reader = res.body?.getReader ? res.body.getReader() : null;
  let html;
  if (reader) {
    const chunks = [];
    let total = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_FETCH_BYTES) {
        reader.cancel().catch(() => {});
        break;
      }
      chunks.push(value);
    }
    html = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf-8");
  } else {
    html = await res.text();
  }

  const $ = cheerio.load(html);
  $("script, style, noscript, nav, header, footer, svg, iframe, form").remove();
  const title = $("title").first().text().trim() || parsed.hostname;
  // Cheerio's .text() concatenates block-level elements with no
  // separator (e.g. "<h1>A</h1><p>B</p>" -> "AB") — inserting a newline
  // text node after each common block element first keeps the extracted
  // text actually readable/line-separated for the AI to reason over.
  $("p, div, h1, h2, h3, h4, h5, h6, li, br, tr, blockquote, section, article").after("\n");
  const text = $("body")
    .text()
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim()
    .slice(0, MAX_EXTRACTED_CHARS);

  return {
    url: parsed.toString(),
    title,
    content: text,
    retrievedAt: new Date().toISOString(),
  };
}

// ---- Ranking (§7 "rank/select useful sources") ----
// Deterministic, not another AI call — a source's relevance to the
// research topic is approximated by keyword overlap between the topic
// and the result's title+snippet, with a small bonus for query/engine
// diversity (a source that showed up for more than one distinct planned
// query is more likely to be genuinely central to the topic than
// incidental). This is a heuristic, not a claim of true relevance
// ranking — good enough to pick which handful of sources are worth the
// cost of a real fetch, not used for anything more consequential than that.
function tokenize(s) {
  return new Set(
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function rankResults(results, topic) {
  const topicWords = tokenize(topic);
  const byUrl = new Map();
  for (const r of results) {
    const key = r.url.replace(/\/$/, "").toLowerCase();
    if (!byUrl.has(key)) {
      const words = tokenize(`${r.title} ${r.snippet}`);
      let overlap = 0;
      words.forEach((w) => {
        if (topicWords.has(w)) overlap += 1;
      });
      byUrl.set(key, { ...r, _score: overlap, _queryHits: 1 });
    } else {
      byUrl.get(key)._queryHits += 1; // showed up for more than one planned query
    }
  }
  return [...byUrl.values()]
    .map((r) => ({ ...r, _score: r._score + (r._queryHits - 1) * 2 }))
    .sort((a, b) => b._score - a._score);
}

// ---- The full pipeline (§7) ----
// plan queries -> search each -> dedupe -> rank -> fetch+extract the top
// N -> return normalized sources. This is the RETRIEVAL half of research
// — cross-source analysis/synthesis (fact vs inference vs uncertainty,
// confidence, conclusion) is deliberately NOT done here; that's
// aiService.synthesizeResearch's job, kept separate so this service stays
// pure retrieval (testable without any AI call) and the reasoning layer
// stays swappable/promptable independently (§7's own "SearXNG is the
// retrieval layer, FounderOS is the reasoning layer" instruction).
//
// planQueries: array of 2-5 query strings, already generated by the
// caller (aiService.planResearchQueries) — this function does not call
// the AI itself, to keep it a plain, fast, unit-testable service.
async function research(planQueries, { maxSourcesToFetch = 5, timeRange } = {}) {
  if (!searxngService.isSearxngConfigured()) {
    const err = new Error("Web search is not configured on this server.");
    err.code = "SEARXNG_NOT_CONFIGURED";
    throw err;
  }

  const queries = (planQueries || []).slice(0, 5).filter((q) => typeof q === "string" && q.trim());
  if (!queries.length) {
    const err = new Error("No research queries to run.");
    err.code = "INVALID_QUERY";
    throw err;
  }

  // Run planned searches; one query failing (e.g. a transient timeout)
  // doesn't abort the whole research pass as long as at least one
  // succeeds — but if EVERY query fails, that's a real failure the
  // caller must not paper over (§17 — never fabricate success).
  const searchOutcomes = await Promise.allSettled(queries.map((q) => search({ query: q, timeRange })));
  const succeeded = searchOutcomes.filter((o) => o.status === "fulfilled");
  if (succeeded.length === 0) {
    const firstError = searchOutcomes[0].reason;
    throw firstError; // propagate the real SearXNG error code/message
  }

  const allResults = succeeded.flatMap((o) => o.value.results);
  const ranked = rankResults(allResults, queries.join(" "));
  const toFetch = ranked.slice(0, maxSourcesToFetch);

  // Fetching full page content is best-effort per source — a single page
  // failing to fetch (dead link, blocked, non-HTML) just means that
  // source contributes its search snippet instead of full content, not a
  // reason to fail the whole research pass.
  const fetched = await Promise.allSettled(toFetch.map((r) => fetchAndExtract(r.url)));

  const sources = toFetch.map((r, i) => {
    const outcome = fetched[i];
    const extracted = outcome.status === "fulfilled" ? outcome.value : null;
    return {
      title: extracted?.title || r.title,
      url: r.url,
      snippet: r.snippet,
      content: extracted?.content || null, // null is honest: fetch failed, only the snippet is available
      source: r.source,
      publishedDate: r.publishedDate || null,
      retrievedAt: extracted?.retrievedAt || null,
      fetchFailed: outcome.status === "rejected" ? (outcome.reason?.code || "FETCH_FAILED") : null,
      relevance: r._score,
    };
  });

  return {
    queriesRun: queries,
    queriesFailed: searchOutcomes.filter((o) => o.status === "rejected").map((o) => o.reason?.code || "SEARCH_FAILED"),
    totalResultsFound: allResults.length,
    sources,
  };
}

module.exports = { search, fetchAndExtract, research, isSearxngConfigured: searxngService.isSearxngConfigured };
