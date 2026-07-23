const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const aiService = require("../services/aiService");
const analytics = require("../services/analyticsService");
const fileStore = require("../store/fileStore");
const feedbackRepository = require("../repositories/feedbackRepository");
const documentsRepository = require("../repositories/documentsRepository");

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { profile, missions, history, mode, scenario, metrics, documentIds } = req.body;
    if (!profile || !history?.length) {
      return res.status(400).json({ error: true, message: "profile and history are required" });
    }
    const patterns = fileStore.get(req.userId, "patterns", { patterns: [] }).patterns;
    // Read straight from the DB rather than trusting a client-supplied
    // feedback array — feedback is submit-only from the frontend's side,
    // this is the one place it flows back in, server-side only.
    const feedback = feedbackRepository.listForUser(req.userId, { limit: 20 });

    // Document context: whatever was explicitly attached to this message,
    // plus the founder's persistent knowledge base — deduped by id.
    const attached = (documentIds || [])
      .map((id) => documentsRepository.get(id, req.userId))
      .filter(Boolean);
    const persistent = documentsRepository.listPersistent(req.userId);
    const seen = new Set();
    const documents = [...attached, ...persistent].filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)));

    const reply = await aiService.chat(req.userId, { profile, missions, feedback, history, patterns, mode, scenario, metrics, documents });
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
