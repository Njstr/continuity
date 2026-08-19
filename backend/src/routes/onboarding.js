const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const aiService = require("../services/aiService");
const analytics = require("../services/analyticsService");
const { isNonEmptyString } = require("../utils/validateInput");

const router = express.Router();

// Natural-language onboarding: the founder describes their startup in
// their own words instead of filling out a multi-step questionnaire.
// Unknown fields come back as null, never guessed — the frontend's review
// step asks specifically for whatever's missing.
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { description } = req.body;
    if (!isNonEmptyString(description, { max: 3000 })) {
      return res.status(400).json({ error: true, message: "description must be 1-3000 characters" });
    }
    const profile = await aiService.extractCompanyProfile(req.userId, { description });
    analytics.track(req.userId, "onboarding_profile_extracted");
    res.json(profile);
  })
);

module.exports = router;
