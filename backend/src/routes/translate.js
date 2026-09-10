const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const aiService = require("../services/aiService");
const { isNonEmptyString } = require("../utils/validateInput");

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { text, targetLanguage } = req.body;
    if (!isNonEmptyString(text, { max: 4000 })) {
      return res.status(400).json({ error: true, message: "text must be 1-4000 characters" });
    }
    const translated = await aiService.translateText(req.userId, { text, targetLanguage: targetLanguage || "Hindi" });
    res.json({ translated });
  })
);

module.exports = router;
