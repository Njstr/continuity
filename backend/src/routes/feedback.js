const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const feedbackRepository = require("../repositories/feedbackRepository");
const { isNonEmptyString, capString } = require("../utils/validateInput");
const config = require("../config");

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { context, content, rating, comment, prompt, simulated, simulationResult, metricsSnapshot } = req.body;
    if (!context) return res.status(400).json({ error: true, message: "context is required" });
    if (content && !isNonEmptyString(content, { max: 5000 })) {
      return res.status(400).json({ error: true, message: "content must be 5000 characters or fewer" });
    }
    if (prompt && !isNonEmptyString(prompt, { max: 5000 })) {
      return res.status(400).json({ error: true, message: "prompt must be 5000 characters or fewer" });
    }
    if (simulationResult && JSON.stringify(simulationResult).length > 20000) {
      return res.status(400).json({ error: true, message: "simulationResult payload too large" });
    }
    if (metricsSnapshot && JSON.stringify(metricsSnapshot).length > 20000) {
      return res.status(400).json({ error: true, message: "metricsSnapshot payload too large" });
    }

    const id = feedbackRepository.add({
      userId: req.userId,
      context: capString(context, 50),
      content: capString(content, 5000),
      rating: rating || null,
      comment: capString(comment, 2000),
      prompt: capString(prompt, 5000),
      simulated: !!simulated,
      simulationResult: simulationResult || null,
      metricsSnapshot: metricsSnapshot || null,
    });
    res.status(201).json({ ok: true, id });
  })
);

// Founder-facing feedback history — scoped to req.userId (device id in
// local mode, account id once AUTH_ENABLED=true), same trust boundary as
// every other per-user resource in the app. This is what the in-app
// Feedback Center reads, as distinct from the admin-token-gated GET below
// which is an aggregate, cross-user view for you as the app owner.
router.get(
  "/mine",
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
    res.json({ feedback: feedbackRepository.listForUser(req.userId, { limit }) });
  })
);

// Read access to the aggregate, cross-user view is gated behind a shared
// admin token (?token=... or Authorization: Bearer ...) since there's no
// real admin-role system yet. Set ADMIN_TOKEN in your backend env to
// enable this at all — unset means the endpoint always returns 404, so it
// doesn't quietly sit open.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!config.adminToken) {
      return res.status(404).json({ error: true, message: "Not found" });
    }
    const provided = req.query.token || (req.header("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (provided !== config.adminToken) {
      return res.status(401).json({ error: true, message: "Invalid or missing admin token" });
    }
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
    res.json({ feedback: feedbackRepository.list({ limit }) });
  })
);

module.exports = router;
