const express = require("express");
const { aiLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

// AI-generation routes get the tighter, cost-aware limiter in addition to
// the general API limiter already applied in app.js.
router.use("/onboarding", aiLimiter, require("./onboarding"));
router.use("/mission", aiLimiter, require("./mission"));
router.use("/decision", aiLimiter, require("./decision"));
router.use("/health", aiLimiter, require("./health"));
router.use("/metrics", aiLimiter, require("./metrics"));
router.use("/chat", aiLimiter, require("./chat"));
router.use("/weekly-review", aiLimiter, require("./weeklyReview"));
router.use("/patterns", aiLimiter, require("./patterns"));
router.use("/business-advice", aiLimiter, require("./businessAdvice"));
router.use("/mission-impact", aiLimiter, require("./missionImpact"));
router.use("/founder-brief", aiLimiter, require("./founderBrief"));
router.use("/lesson", aiLimiter, require("./lesson"));
router.use("/prediction", aiLimiter, require("./prediction"));
router.use("/decision-simulation", aiLimiter, require("./decisionSimulation"));
router.use("/decision-compare", aiLimiter, require("./decisionCompare"));
router.use("/decision-readiness", aiLimiter, require("./decisionReadiness"));
router.use("/learning-summary", aiLimiter, require("./learningSummary"));
router.use("/startup-health", aiLimiter, require("./startupHealth"));
router.use("/advisor", aiLimiter, require("./advisor"));   // <-- new line

// Lighter, non-generative routes — general limiter only.
router.use("/memory", require("./memory"));
router.use("/timeline", require("./timeline"));
router.use("/analytics", require("./analytics"));
router.use("/feedback", require("./feedback"));
router.use("/conversations", require("./conversations"));
router.use("/documents", require("./documents"));

module.exports = router;
