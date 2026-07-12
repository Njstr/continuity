const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const aiService = require("../services/aiService");
const analytics = require("../services/analyticsService");
const fileStore = require("../store/fileStore");

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { profile, missions, feedback, history } = req.body;
    if (!profile || !history?.length) {
      return res.status(400).json({ error: true, message: "profile and history are required" });
    }
    const patterns = fileStore.get(req.userId, "patterns", { patterns: [] }).patterns;
    const reply = await aiService.chat(req.userId, { profile, missions, feedback, history, patterns });
    analytics.track(req.userId, "chat_message_sent");
    res.json({ reply });
  })
);

module.exports = router;
