const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const aiService = require("../services/aiService");

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { profile, businessState } = req.body;
    if (!profile) return res.status(400).json({ error: true, message: "profile is required" });
    const lesson = await aiService.generateLesson(req.userId, { profile, businessState });
    res.json(lesson);
  })
);

module.exports = router;
