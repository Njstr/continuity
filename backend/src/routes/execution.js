const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const executionEngine = require("../services/executionEngine");
const executionRepository = require("../repositories/executionRepository");
const analytics = require("../services/analyticsService");
const activityRepository = require("../repositories/activityRepository");
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

module.exports = router;
