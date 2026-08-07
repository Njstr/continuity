const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const aiService = require("../services/aiService");
const { isNonEmptyString } = require("../utils/validateInput");

const router = express.Router();

// "Revenue was ₹3.2 lakh this month" typed in chat, checked against the
// Metrics field list — same conservative-extraction rules and same
// confirm-before-write flow as document-based extraction, just a second
// on-ramp into it.
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { text, metricFields } = req.body;
    if (!isNonEmptyString(text, { max: 2000 })) {
      return res.status(400).json({ error: true, message: "text must be 1-2000 characters" });
    }
    if (!Array.isArray(metricFields) || !metricFields.length) {
      return res.status(400).json({ error: true, message: "metricFields is required" });
    }
    const values = await aiService.extractMetricsFromChatText(req.userId, { text, metricFields });
    res.json({ values });
  })
);

module.exports = router;
