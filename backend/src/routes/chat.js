const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const aiService = require("../services/aiService");
const analytics = require("../services/analyticsService");
const fileStore = require("../store/fileStore");
const feedbackRepository = require("../repositories/feedbackRepository");

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { profile, missions, history, mode, scenario, metrics } = req.body;
    if (!profile || !history?.length) {
      return res.status(400).json({ error: true, message: "profile and history are required" });
    }
    const patterns = fileStore.get(req.userId, "patterns", { patterns: [] }).patterns;
    // Read straight from the DB rather than trusting a client-supplied
    // feedback array — feedback is submit-only from the frontend's side,
    // this is the one place it flows back in, server-side only.
    const feedback = feedbackRepository.listForUser(req.userId, { limit: 20 });
    const reply = await aiService.chat(req.userId, { profile, missions, feedback, history, patterns, mode, scenario, metrics });
    analytics.track(req.userId, mode === "simulator" ? "simulator_message_sent" : "chat_message_sent");
    res.json({ reply });
  })
);

router.post(
  "/title",
  asyncHandler(async (req, res) => {
    const { messages } = req.body;
    if (!messages?.length) {
      return res.status(400).json({ error: true, message: "messages are required" });
    }
    const title = await aiService.generateChatTitle(req.userId, { messages });
    res.json({ title });
  })
);

module.exports = router;
