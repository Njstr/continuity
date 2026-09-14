const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const executionEngine = require("../services/executionEngine");
const executionRepository = require("../repositories/executionRepository");
const analytics = require("../services/analyticsService");
const activityRepository = require("../repositories/activityRepository");
const webResearchService = require("../services/webResearchService");
const { isNonEmptyString } = require("../utils/validateInput");

const router = express.Router();

// Single entry point — every founder message while an execution context
// is active flows through here. See executionEngine.handleMessage for the
// full state machine; this route is a thin wrapper that validates input
// and tracks the resulting event.
router.post(
  "/message",
  asyncHandler(async (req, res) => {
    const { profile, text, recentHistory } = req.body;
    if (!profile || !isNonEmptyString(text, { max: 4000 })) {
      return res.status(400).json({ error: true, message: "profile is required and text must be 1-4000 characters" });
    }
    // Recorded for the activity/evidence audit trail and for matching
    // against OTHER tasks later (e.g. a detail mentioned here turns out
    // relevant to a future task). Not re-matched against the CURRENT
    // task here — handleMessage below already does exactly that,
    // directly and more precisely, as this route's whole purpose.
    activityRepository.record({
      userId: req.userId,
      type: "chat_message_sent",
      source: "chat",
      entityId: null,
      metadata: { length: text.length },
      description: text.length > 200 ? `${text.slice(0, 200)}…` : text,
    });
    const result = await executionEngine.handleMessage(req.userId, { profile, text, recentHistory: recentHistory || [] });
    analytics.track(req.userId, `execution_${result.event}`);
    // Attach the current evidence checklist so the TaskCard can show
    // auto-detected evidence live, not just on the next full page load.
    if (result.task) {
      result.task = { ...result.task, evidenceItems: executionRepository.listEvidenceForTask(result.task.id, req.userId) };
    }
    res.json(result);
  })
);

// Progress view — completed task history + current task, kept separate
// from the chat stream itself. Per the auto-creation spec: this must
// never hand back current: null just because generation hasn't happened
// yet — see executionEngine.getProgressSummary. Since founder profile is
// only ever stored client-side (never persisted server-side — see
// routes/chat.js taking `profile` in every request body), a GET here
// still needs it to bootstrap the very first task for a founder with no
// prior chat activity at all; a JSON-encoded query param is the
// pragmatic way to carry that on a GET without inventing a server-side
// profile store just for this.
router.get(
  "/progress",
  asyncHandler(async (req, res) => {
    let profile = null;
    if (req.query.profile) {
      try {
        profile = JSON.parse(req.query.profile);
      } catch {
        return res.status(400).json({ error: true, message: "profile query param must be valid JSON" });
      }
    }
    const summary = await executionEngine.getProgressSummary(req.userId, profile);
    res.json(summary);
  })
);

// §37/§46 of the autonomous-execution spec — a real, live, LLM-independent
// check of the web-research pipeline, since the actual root cause of
// "SearXNG isn't working" was invisible before this (see
// webResearchService.js's module comment for the full story: a missing
// SEARXNG_URL silently short-circuits every search into a friendly
// message the founder never sees as an error). This hits SearXNG
// directly, with a trivial query, and reports exactly what happened —
// configured or not, reachable or not, real results or not — so the
// question "is search actually working right now" has a direct answer
// instead of an inference from chat behavior.
router.get(
  "/research-health",
  asyncHandler(async (req, res) => {
    const configured = webResearchService.isSearxngConfigured();
    if (!configured) {
      return res.json({
        configured: false,
        reachable: false,
        message: "SEARXNG_URL is not set on this server — live web research is unavailable. Set SEARXNG_URL to your SearXNG instance's base URL and restart.",
      });
    }
    try {
      const { results } = await webResearchService.search({ query: "founderos health check", maxResults: 1 });
      res.json({
        configured: true,
        reachable: true,
        resultsReturned: results.length,
        message:
          results.length > 0
            ? "SearXNG is configured and returned real results."
            : "SearXNG is reachable and responded, but returned zero results for a trivial test query — if this persists for real queries too, check that JSON format is enabled in SearXNG's settings.yml (search.formats must include 'json') and that the configured engines are enabled.",
      });
    } catch (e) {
      res.json({
        configured: true,
        reachable: false,
        errorCode: e.code || "UNKNOWN",
        message: `SearXNG is configured (SEARXNG_URL is set) but the request failed: ${e.message}. If this is SEARXNG_UNREACHABLE, check the URL/host/port and container networking. If it's a non-JSON/parse error, SearXNG's JSON API format is very commonly disabled by default — add 'json' under search.formats in its settings.yml.`,
      });
    }
  })
);

module.exports = router;
