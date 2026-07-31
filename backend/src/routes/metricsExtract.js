const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const aiService = require("../services/aiService");
const { isNonEmptyString } = require("../utils/validateInput");

const router = express.Router();

// Powers "We reached ₹4 lakh MRR" style chat statements updating Metrics —
// same conservative extraction (only explicit, unambiguous values) and
// same confirm-before-write flow as document uploads. Reuses
// extractMetricsFromDocument directly since it already operates on plain
// text, not specifically document-derived text.
router.post(
  "/extract",
  asyncHandler(async (req, res) => {
    const { text, metricFields } = req.body;
    if (!isNonEmptyString(text, { max: 2000 })) {
      return res.status(400).json({ error: true, message: "text must be 1-2000 characters" });
    }
    if (!Array.isArray(metricFields) || !metricFields.length) {
      return res.status(400).json({ error: true, message: "metricFields is required" });
    }
    const values = await aiService.extractMetricsFromDocument(req.userId, { text, metricFields });
    res.json({ values });
  })
);

module.exports = router;
