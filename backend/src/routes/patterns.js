const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const aiService = require("../services/aiService");
const fileStore = require("../store/fileStore");

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { profile, missions, decisions, metricsHistory } = req.body;
    if (!profile) return res.status(400).json({ error: true, message: "profile is required" });
    const result = await aiService.detectPatterns(req.userId, { profile, missions, decisions, metricsHistory });
    // cached so /api/chat can proactively reference the latest patterns
    fileStore.set(req.userId, "patterns", result);
    res.json(result);
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(fileStore.get(req.userId, "patterns", { patterns: [] }));
  })
);

module.exports = router;
