const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const aiService = require("../services/aiService");
const analytics = require("../services/analyticsService");
const fileStore = require("../store/fileStore");
const feedbackRepository = require("../repositories/feedbackRepository");
const documentsRepository = require("../repositories/documentsRepository");
const decisionRepo = require("../repositories/decisionLifecycleRepository");

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { profile, missions, history, mode, scenario, metrics, documentIds } = req.body;
    if (!profile || !history?.length) {
      return res.status(400).json({ error: true, message: "profile and history are required" });
    }
    // Safety net, not the primary fix: the primary fix is client-side
    // (Chat.jsx now flattens decision-simulation messages before ever
    // building history — see toHistoryMessage). This guards the route
    // itself against any empty-content message reaching the AI provider,
    // in case an older cached frontend build or another caller sends one
    // — that's what caused every message to fail after a Decision
    // Simulator interaction (handoff doc §9/§13).
    const sanitizedHistory = history
      .map((m) => (m && typeof m.content === "string" && m.content.trim() === "" ? null : m))
      .filter(Boolean);
    if (!sanitizedHistory.length) {
      return res.status(400).json({ error: true, message: "history contained no usable messages" });
    }
    const populationPatterns = fileStore.get(req.userId, "patterns", { patterns: [] }).patterns;
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

    // Decision history + this founder's own learned patterns — previously
    // only pulled into the dedicated Decision Simulator call, not ordinary
    // chat. Every reply should be able to reference "your last pricing
    // experiment underperformed by X" without the founder having to
    // re-trigger a simulation to surface it.
    const recentDecisions = decisionRepo.listDecisions(req.userId, { limit: 8 }).map((d) => ({
      ...d,
      prediction: decisionRepo.getPredictionByDecision(d.id),
      outcome: decisionRepo.getOutcomeByDecision(d.id),
    }));
    const learnedPatterns = decisionRepo.listPatterns(req.userId, { limit: 10 });

    const reply = await aiService.chat(req.userId, {
      profile, missions, feedback, history: sanitizedHistory, mode, scenario, metrics, documents,
      patterns: populationPatterns,
      recentDecisions,
      learnedPatterns,
    });
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
