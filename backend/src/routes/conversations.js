const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const fileStore = require("../store/fileStore");

const router = express.Router();

// Chat history is stored as a single JSON blob per user, same pattern as
// the existing "patterns" bucket — simplest thing that works for a
// single-device-at-a-time founder tool. If this ever needs real-time
// multi-device merge, that's the point to introduce a dedicated table.
const MAX_BYTES = 2 * 1024 * 1024; // 2MB cap — plenty for years of chat history

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const conversations = fileStore.get(req.userId, "conversations", []);
    res.json({ conversations });
  })
);

router.put(
  "/",
  asyncHandler(async (req, res) => {
    const { conversations } = req.body;
    if (!Array.isArray(conversations)) {
      return res.status(400).json({ error: true, message: "conversations must be an array" });
    }
    const size = JSON.stringify(conversations).length;
    if (size > MAX_BYTES) {
      return res.status(413).json({ error: true, message: "conversations payload too large" });
    }
    fileStore.set(req.userId, "conversations", conversations);
    res.json({ ok: true });
  })
);

module.exports = router;
