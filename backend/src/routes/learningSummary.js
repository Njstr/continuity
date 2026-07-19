const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const aiService = require("../services/aiService");

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { decision, accuracyResults, feedbackText, feedbackDifference, feedbackRating } = req.body;
    if (!decision) return res.status(400).json({ error: true, message: "decision is required" });
    const result = await aiService.generateLearningSummary(req.userId, { decision, accuracyResults, feedbackText, feedbackDifference, feedbackRating });
    res.json(result);
  })
);

module.exports = router;
