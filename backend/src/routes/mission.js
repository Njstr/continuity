const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const aiService = require("../services/aiService");
const analytics = require("../services/analyticsService");

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { profile, missions } = req.body;
    if (!profile) return res.status(400).json({ error: true, message: "profile is required" });
    const mission = await aiService.generateMission(req.userId, { profile, missions });
    res.json(mission);
  })
);

router.post(
  "/complete",
  asyncHandler(async (req, res) => {
    const { title, status, reason } = req.body;
    analytics.track(req.userId, status === "done" ? "mission_completed" : "mission_skipped", { title, reason });
    res.json({ ok: true });
  })
);

module.exports = router;
