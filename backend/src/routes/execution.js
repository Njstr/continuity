const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const executionEngine = require("../services/executionEngine");
const analytics = require("../services/analyticsService");
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
    const result = await executionEngine.handleMessage(req.userId, { profile, text, recentHistory: recentHistory || [] });
    analytics.track(req.userId, `execution_${result.event}`);
    res.json(result);
  })
);

// Progress view (§20) — completed task history + current task, kept
// separate from the chat stream itself.
router.get(
  "/progress",
  asyncHandler(async (req, res) => {
    res.json(executionEngine.getProgressSummary(req.userId));
  })
);

module.exports = router;
