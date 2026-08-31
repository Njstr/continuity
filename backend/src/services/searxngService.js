// searxngService.js — the one place in the codebase that talks to the
// configured SearXNG instance. Nothing else (routes, UI, the AI tool
// layer) constructs a SearXNG request directly — they all call search()
// here, matching the same "single choke point" pattern aiService.js uses
// for AI providers. SEARXNG_URL and the other settings live in
// config/index.js only; nothing here is ever sent to the browser.

const config = require("../config");
const { withTimeout } = require("../utils/retry");

const ALLOWED_CATEGORIES = new Set(["general", "news", "it", "science", "files", "images", "videos", "music", "social media", "map"]);
const ALLOWED_TIME_RANGES = new Set(["day", "week", "month", "year"]);
const MAX_QUERY_LENGTH = 400;

function isSearxngConfigured() {
  return !!config.searxngUrl;
}

// ---- Input validation (§9) ----
// The AI proposes these parameters via the tool call, so they're
// untrusted input just like anything else a user could indirectly steer
// — validated and clamped here rather than passed straight into a
// request to an internal service.
function validateSearchParams({ query, categories, engines, language, timeRange, page, maxResults }) {
  if (typeof query !== "string" || !query.trim()) {
    const err = new Error("query is required");
    err.code = "INVALID_QUERY";
    throw err;
  }
  const cleanQuery = query.trim().slice(0, MAX_QUERY_LENGTH);

  const cleanCategories = Array.isArray(categories) ? categories.filter((c) => ALLOWED_CATEGORIES.has(c)) : [];
  // engines are passed through as a comma-separated allowlist-by-format
  // (alnum, underscore, hyphen only) rather than a hardcoded engine list,
  // since SearXNG instances can be configured with different enabled
  // engines — but we still reject anything that isn't a plausible engine
  // name to stop parameter injection into the upstream query string.
  const cleanEngines = Array.isArray(engines) ? engines.filter((e) => typeof e === "string" && /^[a-zA-Z0-9_\-. ]{1,40}$/.test(e)).slice(0, 10) : [];
  const cleanLanguage = typeof language === "string" && /^[a-zA-Z-]{2,10}$/.test(language) ? language : undefined;
  const cleanTimeRange = ALLOWED_TIME_RANGES.has(timeRange) ? timeRange : undefined;
  const cleanPage = Number.isInteger(page) && page >= 1 && page <= 10 ? page : 1;
  const cleanMaxResults = Math.min(Math.max(Number.isInteger(maxResults) ? maxResults : config.searxngMaxResults, 1), config.searxngMaxResults);

  return { query: cleanQuery, categories: cleanCategories, engines: cleanEngines, language: cleanLanguage, timeRange: cleanTimeRange, page: cleanPage, maxResults: cleanMaxResults };
}

// ---- URL sanitization (§9) ----
// Result URLs come from the upstream search engines via SearXNG, not
// from our own users, but they're still untrusted external input by the
// time they reach our frontend — only ever return well-formed http(s)
// URLs, never javascript:/data:/file: schemes or anything else a
// compromised or misbehaving engine could sneak in.
function sanitizeUrl(raw) {
  if (typeof raw !== "string") return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function normalizeResult(raw) {
  const url = sanitizeUrl(raw.url);
  if (!url) return null; // drop anything without a safe, well-formed URL
  return {
    title: typeof raw.title === "string" ? raw.title.slice(0, 300) : url,
    url,
    snippet: typeof raw.content === "string" ? raw.content.slice(0, 600) : "",
    source: typeof raw.engine === "string" ? raw.engine : (raw.engines || [])[0] || "web",
    category: typeof raw.category === "string" ? raw.category : "general",
    publishedDate: typeof raw.publishedDate === "string" ? raw.publishedDate : raw.publishedDate ? String(raw.publishedDate) : null,
    thumbnail: sanitizeUrl(raw.img_src || raw.thumbnail || null),
  };
}

function dedupeByUrl(results) {
  const seen = new Set();
  return results.filter((r) => {
    const key = r.url.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Runs a single search against the configured SearXNG instance and
 * returns normalized, deduplicated results. Never throws for "no
 * results" (returns an empty array) — only throws for genuine failures
 * (not configured, unreachable, timeout, malformed response), which
 * callers translate into a friendly message rather than crashing (§10).
 */
async function search(params) {
  if (!isSearxngConfigured()) {
    const err = new Error("Web search is not configured on this server.");
    err.code = "SEARXNG_NOT_CONFIGURED";
    throw err;
  }

  const { query, categories, engines, language, timeRange, page, maxResults } = validateSearchParams(params);

  const url = new URL("/search", config.searxngUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("pageno", String(page));
  if (categories.length) url.searchParams.set("categories", categories.join(","));
  if (engines.length) url.searchParams.set("engines", engines.join(","));
  if (language) url.searchParams.set("language", language);
  if (timeRange) url.searchParams.set("time_range", timeRange);

  let res;
  try {
    res = await withTimeout((signal) => fetch(url.toString(), { signal, headers: { Accept: "application/json" } }), config.searxngTimeoutMs);
  } catch (err) {
    if (err.code === "TIMEOUT") {
      const timeoutErr = new Error("Web search timed out.");
      timeoutErr.code = "SEARXNG_TIMEOUT";
      throw timeoutErr;
    }
    // Connection refused / DNS failure / instance down.
    const connErr = new Error("Could not reach the web search service.");
    connErr.code = "SEARXNG_UNREACHABLE";
    connErr.cause = err;
    throw connErr;
  }

  if (res.status === 429) {
    const err = new Error("Web search is rate-limited right now.");
    err.code = "SEARXNG_RATE_LIMITED";
    throw err;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`SearXNG returned ${res.status}`);
    err.code = "SEARXNG_ERROR";
    err.status = res.status;
    err.detail = body.slice(0, 300);
    throw err;
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    const malformedErr = new Error("Web search returned an unreadable response.");
    malformedErr.code = "SEARXNG_MALFORMED_RESPONSE";
    throw malformedErr;
  }

  const rawResults = Array.isArray(data?.results) ? data.results : [];
  const normalized = dedupeByUrl(rawResults.map(normalizeResult).filter(Boolean)).slice(0, maxResults);

  return {
    query,
    results: normalized,
    suggestions: Array.isArray(data?.suggestions) ? data.suggestions.slice(0, 5) : [],
  };
}

// ---- Reddit/community discovery (§4) ----
// A subreddit/community page is exactly reddit.com/r/<name>[/] — nothing
// after that. A post is .../r/<name>/comments/.... A user profile is
// /user/<name>. Anything else (wiki pages, search pages, multireddits)
// is treated as "other" and excluded from the community list rather than
// guessed at.
const SUBREDDIT_RE = /^https?:\/\/(?:www\.|old\.)?reddit\.com\/r\/([a-zA-Z0-9_]+)\/?$/i;
const POST_RE = /^https?:\/\/(?:www\.|old\.)?reddit\.com\/r\/([a-zA-Z0-9_]+)\/comments\//i;

function classifyRedditUrl(url) {
  if (SUBREDDIT_RE.test(url)) return { type: "community", subreddit: url.match(SUBREDDIT_RE)[1] };
  if (POST_RE.test(url)) return { type: "post", subreddit: url.match(POST_RE)[1] };
  if (/^https?:\/\/(?:www\.|old\.)?reddit\.com\/user\//i.test(url)) return { type: "user_profile", subreddit: null };
  if (/^https?:\/\/(?:www\.|old\.)?reddit\.com\//i.test(url)) return { type: "other", subreddit: null };
  return null; // not a reddit URL at all
}

/**
 * Given a set of normalized search results (typically from one or more
 * reddit-scoped searches), identifies actual subreddit communities —
 * distinct from individual posts, profiles, or other reddit pages — dedupes
 * by subreddit name, and ranks by how many distinct results reference
 * that community (a rough relevance signal: a subreddit mentioned by
 * multiple posts/results is more likely to be an active, relevant one
 * than a single stray link).
 */
function discoverRedditCommunities(results) {
  const bySubreddit = new Map();
  for (const r of results) {
    const classified = classifyRedditUrl(r.url);
    if (!classified || !classified.subreddit) continue;
    const name = classified.subreddit.toLowerCase();
    if (!bySubreddit.has(name)) {
      bySubreddit.set(name, { subreddit: classified.subreddit, url: `https://www.reddit.com/r/${classified.subreddit}/`, mentionCount: 0, evidenceSnippets: [] });
    }
    const entry = bySubreddit.get(name);
    entry.mentionCount += 1;
    if (r.snippet && entry.evidenceSnippets.length < 3) entry.evidenceSnippets.push(r.snippet.slice(0, 200));
    // A direct hit on the community page itself (not just a post from it)
    // is stronger evidence than an indirect post reference.
    if (classified.type === "community") entry.mentionCount += 2;
  }
  return [...bySubreddit.values()].sort((a, b) => b.mentionCount - a.mentionCount);
}

module.exports = { search, isSearxngConfigured, discoverRedditCommunities, classifyRedditUrl, sanitizeUrl };
