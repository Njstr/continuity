const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const aiService = require("../services/aiService");
const analytics = require("../services/analyticsService");

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { companyProfile, metrics, decisions, healthLatest } = req.body;
    if (!companyProfile) return res.status(400).json({ error: true, message: "companyProfile is required" });
    const result = await aiService.generateFounderAdvisor(req.userId, {
      companyProfile,
      metrics,
      decisions,
      healthLatest,
    });
    analytics.track(req.userId, "founder_advisor_run");
    res.json(result);
  })
);

module.exports = router;