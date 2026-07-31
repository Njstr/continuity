const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const aiService = require("../services/aiService");

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { profile, businessState, missions, decisions, healthLatest, patterns } = req.body;
    if (!profile) return res.status(400).json({ error: true, message: "profile is required" });
    const brief = await aiService.generateFounderBrief(req.userId, { profile, businessState, missions, decisions, healthLatest, patterns });
    res.json(brief);
  })
);

module.exports = router;
