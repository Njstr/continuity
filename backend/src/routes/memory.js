const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const memoryService = require("../services/memoryService");

const router = express.Router();

// Read-only: lets the frontend show the founder what the AI remembers
// about them (transparency), and lets them manually add a memory (e.g.
// "remember that I hate cold calling").
router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ memories: memoryService.allMemories(req.userId) });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { type, text } = req.body;
    if (!text) return res.status(400).json({ error: true, message: "text is required" });
    const memories = memoryService.remember(req.userId, { type, text });
    res.json({ memories });
  })
);

module.exports = router;
