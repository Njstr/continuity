const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const aiService = require("../services/aiService");
const analytics = require("../services/analyticsService");
const { isNonEmptyString } = require("../utils/validateInput");

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { profile, metrics, question, history } = req.body;
    if (!profile || !isNonEmptyString(question, { max: 500 })) {
      return res.status(400).json({ error: true, message: "profile is required and question must be 1-500 characters" });
    }
    const result = await aiService.compareGrowthOptions(req.userId, { profile, metrics, question, history });
    analytics.track(req.userId, "growth_options_compared");
    res.json(result);
  })
);

module.exports = router;
