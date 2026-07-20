const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const aiService = require("../services/aiService");
const analytics = require("../services/analyticsService");

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { profile, businessState, metrics, missions, decisions, healthLatest, prediction } = req.body;
    if (!profile) return res.status(400).json({ error: true, message: "profile is required" });
    const result = await aiService.generateFounderAdvisor(req.userId, {
      profile,
      businessState,
      metrics,
      missions,
      decisions,
      healthLatest,
      prediction,
    });
    analytics.track(req.userId, "founder_advisor_run");
    res.json(result);
  })
);

module.exports = router;