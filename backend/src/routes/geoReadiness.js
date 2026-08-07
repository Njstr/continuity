const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const aiService = require("../services/aiService");
const analytics = require("../services/analyticsService");

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { profile, history } = req.body;
    if (!profile) {
      return res.status(400).json({ error: true, message: "profile is required" });
    }
    const result = await aiService.analyzeGeoReadiness(req.userId, { profile, history });
    analytics.track(req.userId, "geo_readiness_checked");
    res.json(result);
  })
);

module.exports = router;
