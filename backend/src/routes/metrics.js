const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const aiService = require("../services/aiService");

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { profile, metrics } = req.body;
    if (!profile || !metrics) return res.status(400).json({ error: true, message: "profile and metrics are required" });
    const result = await aiService.generateMetricsRecommendation(req.userId, { profile, metrics });
    res.json(result);
  })
);

module.exports = router;
