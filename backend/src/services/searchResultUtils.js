// searchResultUtils.js — pure functions that operate on normalized search
// results ({ title, url, snippet, ... }), independent of which search
// provider produced them. Extracted out of searxngService.js when
// tavilyService.js was added, so both providers share one implementation
// instead of copy-pasting (and risking the two drifting apart).

// ---- URL sanitization ----
// Result URLs come from an upstream search provider, not from our own
// users, but they're still untrusted external input by the time they
// reach our frontend — only ever return well-formed http(s) URLs, never
// javascript:/data:/file: schemes or anything else a compromised or
// misbehaving provider could sneak in.
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

// ---- Reddit/community discovery ----
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

function dedupeByUrl(results) {
  const seen = new Set();
  return results.filter((r) => {
    const key = r.url.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = { sanitizeUrl, classifyRedditUrl, discoverRedditCommunities, dedupeByUrl };
