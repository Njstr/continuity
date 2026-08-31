const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const aiService = require("../services/aiService");
const analytics = require("../services/analyticsService");
const { isNonEmptyString } = require("../utils/validateInput");

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { profile, idea, history } = req.body;
    if (!profile || !isNonEmptyString(idea, { max: 1000 })) {
      return res.status(400).json({ error: true, message: "profile is required and idea must be 1-1000 characters" });
    }
    const result = await aiService.validateProductIdea(req.userId, { profile, idea, history });
    analytics.track(req.userId, "product_idea_validated");
    res.json(result);
  })
);

module.exports = router;
