const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const aiService = require("../services/aiService");

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { profile, businessState, metrics, missions } = req.body;
    if (!profile) return res.status(400).json({ error: true, message: "profile is required" });
    const prediction = await aiService.generatePrediction(req.userId, { profile, businessState, metrics, missions });
    res.json(prediction);
  })
);

module.exports = router;
