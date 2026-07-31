const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const aiService = require("../services/aiService");
const analytics = require("../services/analyticsService");
const decisionRepo = require("../repositories/decisionLifecycleRepository");
const { isNonEmptyString } = require("../utils/validateInput");

const router = express.Router();

function addDays(iso, days) {
  const d = iso ? new Date(iso) : new Date();
  d.setDate(d.getDate() + (days || 60));
  return d.toISOString();
}

// Step 4 of the loop: simulate a decision. Does NOT persist anything yet —
// this is the founder reviewing before committing (step 5). Reuses the
// existing Decision Simulator, now also given the founder's persisted
// history and learned patterns instead of whatever the client happened to
// pass in.
router.post(
  "/simulate",
  asyncHandler(async (req, res) => {
    const { profile, metrics, decisionText, decisionContext } = req.body;
    if (!profile || !isNonEmptyString(decisionText, { max: 1000 })) {
      return res.status(400).json({ error: true, message: "profile is required and decisionText must be 1-1000 characters" });
    }
    const pastDecisions = decisionRepo.listDecisions(req.userId, { limit: 5 });
    const patterns = decisionRepo.listPatterns(req.userId, { limit: 10 });
    const simulation = await aiService.generateDecisionSimulation(req.userId, {
      companyProfile: profile,
      metrics,
      decision: decisionText,
      decisionContext,
      history: pastDecisions,
      patterns,
    });
    analytics.track(req.userId, "decision_simulated");
    res.json({ simulation, appliedPatterns: patterns });
  })
);

// Steps 5-6: founder has reviewed the simulation and made a call. This is
// the only place a decision + its prediction snapshot get written —
// predictions are immutable from this point forward (see the repository
// and migration comments).
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { decisionText, finalDecisionText, rationale, status, simulation } = req.body;
    if (!isNonEmptyString(decisionText, { max: 1000 })) {
      return res.status(400).json({ error: true, message: "decisionText must be 1-1000 characters" });
    }
    if (!["proceeded", "not_proceeded", "modified", "decided_later"].includes(status)) {
      return res.status(400).json({ error: true, message: "status must be one of: proceeded, not_proceeded, modified, decided_later" });
    }

    const decision = decisionRepo.createDecision({ userId: req.userId, decisionText });
    decisionRepo.setDecisionStatus(decision.id, req.userId, {
      status,
      finalDecisionText: finalDecisionText || decisionText,
      rationale,
    });

    let prediction = null;
    // Only worth recording a prediction if the founder is actually moving
    // forward with something — "not proceeding" or "deciding later" has
    // nothing to check reality against later.
    if (simulation && (status === "proceeded" || status === "modified")) {
      prediction = decisionRepo.createPrediction({
        decisionId: decision.id,
        userId: req.userId,
        companySnapshot: req.body.companySnapshot || null,
        currentSituation: simulation.currentSituation,
        expectedImpact: simulation.predictions,
        assumptions: simulation.keyAssumptions,
        risks: simulation.mainRisks,
        bestCase: simulation.bestCase,
        expectedCase: simulation.expectedCase,
        worstCase: simulation.worstCase,
        confidence: simulation.overallConfidence,
        evaluationDate: addDays(decision.decidedAt, simulation.evaluationHorizonDays),
      });
    }

    analytics.track(req.userId, "decision_recorded");
    res.status(201).json({ decision: decisionRepo.getDecision(decision.id, req.userId), prediction });
  })
);

// Step 3/8: Decisions list, with prediction + outcome attached where they
// exist, for the Decisions screen and Today's due-for-review queue.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const decisions = decisionRepo.listDecisions(req.userId, { limit: 100 });
    const enriched = decisions.map((d) => ({
      ...d,
      prediction: decisionRepo.getPredictionByDecision(d.id),
      outcome: decisionRepo.getOutcomeByDecision(d.id),
    }));
    res.json({ decisions: enriched });
  })
);

// Today: what's actually due for a check-in right now.
router.get(
  "/due",
  asyncHandler(async (req, res) => {
    const due = decisionRepo.listDueForCheckIn(req.userId);
    const withDecisions = due.map((p) => ({ prediction: p, decision: decisionRepo.getDecision(p.decisionId, req.userId) }));
    res.json({ due: withDecisions });
  })
);

// Steps 7-9: founder reports what actually happened. Generates the
// comparison, and — only when the evidence genuinely supports it —
// records a new cross-decision pattern used to adjust future simulations.
router.post(
  "/:id/outcome",
  asyncHandler(async (req, res) => {
    const { actualUpdate, actualMetrics } = req.body;
    if (!isNonEmptyString(actualUpdate, { max: 2000 })) {
      return res.status(400).json({ error: true, message: "actualUpdate must be 1-2000 characters" });
    }
    const decision = decisionRepo.getDecision(req.params.id, req.userId);
    if (!decision) return res.status(404).json({ error: true, message: "Decision not found." });
    const prediction = decisionRepo.getPredictionByDecision(decision.id);
    if (!prediction) return res.status(400).json({ error: true, message: "This decision has no recorded prediction to compare against." });
    if (decisionRepo.getOutcomeByDecision(decision.id)) {
      return res.status(409).json({ error: true, message: "An outcome has already been recorded for this decision." });
    }

    const pastPatterns = decisionRepo.listPatterns(req.userId, { limit: 10 });
    const comparison = await aiService.compareOutcomeToPrediction(req.userId, {
      decisionText: decision.decisionText,
      prediction,
      actualUpdate,
      actualMetrics,
      pastPatterns,
    });

    const outcome = decisionRepo.createOutcome({
      decisionId: decision.id,
      predictionId: prediction.id,
      userId: req.userId,
      actualUpdate,
      actualMetricsSnapshot: actualMetrics,
      comparisonSummary: comparison.comparisonSummary,
      assumptionsReview: comparison.assumptionsReview,
    });

    if (comparison.suggestedPattern?.shouldRecord && comparison.suggestedPattern.patternText) {
      decisionRepo.addPattern({
        userId: req.userId,
        patternText: comparison.suggestedPattern.patternText,
        category: comparison.suggestedPattern.category,
        basedOnDecisionIds: [decision.id],
      });
    }

    analytics.track(req.userId, "decision_outcome_recorded");
    res.status(201).json({ outcome, newPattern: comparison.suggestedPattern?.shouldRecord ? comparison.suggestedPattern : null });
  })
);

router.get(
  "/patterns",
  asyncHandler(async (req, res) => {
    res.json({ patterns: decisionRepo.listPatterns(req.userId, { limit: 20 }) });
  })
);

module.exports = router;
