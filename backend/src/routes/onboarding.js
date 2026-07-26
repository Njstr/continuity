const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const aiService = require("../services/aiService");
const analytics = require("../services/analyticsService");

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { answers } = req.body;
    if (!answers) return res.status(400).json({ error: true, message: "answers is required" });
    const profile = await aiService.generateProfile(req.userId, answers);
    analytics.track(req.userId, "onboarding_completed");
    res.json(profile);
  })
);

module.exports = router;
