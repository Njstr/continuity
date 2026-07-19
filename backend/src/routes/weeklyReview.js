const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const aiService = require("../services/aiService");
const analytics = require("../services/analyticsService");

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { profile, answers, missions } = req.body;
    if (!profile || !answers) return res.status(400).json({ error: true, message: "profile and answers are required" });
    const report = await aiService.generateWeeklyReport(req.userId, { profile, answers, missions });
    analytics.track(req.userId, "weekly_review_submitted");
    res.json(report);
  })
);

module.exports = router;
