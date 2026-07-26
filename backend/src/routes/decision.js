const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const aiService = require("../services/aiService");
const analytics = require("../services/analyticsService");
const { isNonEmptyString } = require("../utils/validateInput");

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { profile, question, pastDecisions } = req.body;
    if (!profile || !isNonEmptyString(question, { max: 2000 })) {
      return res.status(400).json({ error: true, message: "profile is required and question must be 1-2000 characters" });
    }
    const result = await aiService.generateDecision(req.userId, { profile, question, pastDecisions });
    analytics.track(req.userId, "decision_requested");
    res.json(result);
  })
);

module.exports = router;
