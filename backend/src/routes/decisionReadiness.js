const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const aiService = require("../services/aiService");
const { isNonEmptyString } = require("../utils/validateInput");

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { companyProfile, metrics, decision } = req.body;
    if (!companyProfile || !isNonEmptyString(decision, { max: 500 })) {
      return res.status(400).json({ error: true, message: "companyProfile is required and decision must be 1-500 characters" });
    }
    const result = await aiService.checkDecisionReadiness(req.userId, { companyProfile, metrics, decision });
    res.json(result);
  })
);

module.exports = router;
