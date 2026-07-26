const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const fileStore = require("../store/fileStore");

const router = express.Router();

// Generic event log the frontend calls from any screen ("mission
// completed", "decision logged", "badge unlocked", etc.) so the Timeline
// view has one consistent chronological feed instead of stitching several
// data sources together on the client.
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { type, title, meta } = req.body;
    if (!type || !title) return res.status(400).json({ error: true, message: "type and title are required" });
    const entry = { type, title, meta: meta || {}, date: new Date().toISOString() };
    const timeline = fileStore.append(req.userId, "timeline", entry, { max: 1000 });
    res.json({ timeline });
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const timeline = fileStore.get(req.userId, "timeline", []);
    res.json({ timeline: timeline.slice().reverse() });
  })
);

module.exports = router;
