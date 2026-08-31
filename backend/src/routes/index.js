const express = require("express");
const { aiLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

// AI-generation routes get the tighter, cost-aware limiter in addition to
// the general API limiter already applied in app.js.
router.use("/chat", aiLimiter, require("./chat"));
router.use("/decision-compare", aiLimiter, require("./decisionCompare"));
router.use("/validate-idea", aiLimiter, require("./validateIdea"));
router.use("/geo-readiness", aiLimiter, require("./geoReadiness"));
router.use("/decisions", aiLimiter, require("./decisions"));
router.use("/execution", aiLimiter, require("./execution"));
router.use("/metrics", aiLimiter, require("./metricsExtract"));
router.use("/translate", aiLimiter, require("./translate"));

// Lighter, non-generative routes — general limiter only.
router.use("/analytics", require("./analytics"));
router.use("/feedback", require("./feedback"));
router.use("/conversations", require("./conversations"));
router.use("/documents", require("./documents"));

// Note: routes/auth.js exists but is intentionally not mounted here yet —
// it's infrastructure for the optional AUTH_ENABLED account mode (see
// config/index.js), not currently wired into the shipped, device-ID-based
// product. Leave it as-is rather than mounting or deleting it; mounting
// it is a deliberate future decision, not a cleanup task.

module.exports = router;
