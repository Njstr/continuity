const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const aiService = require("../services/aiService");
const analytics = require("../services/analyticsService");

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { profile, metrics, missions } = req.body;
    if (!profile) return res.status(400).json({ error: true, message: "profile is required" });
    const result = await aiService.generateHealth(req.userId, { profile, metrics, missions });
    analytics.track(req.userId, "health_check_run");
    res.json(result);
  })
);

module.exports = router;
