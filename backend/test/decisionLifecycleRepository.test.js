// Regression tests for the user_id scoping fix on getPredictionByDecision
// / getOutcomeByDecision — these previously looked up predictions/
// outcomes by decision_id alone, with no ownership check in the SQL
// itself. Not exploitable through any current route (every caller
// pre-scopes the decision via getDecision(id, userId) first), but the
// functions themselves were unsafe to call with an untrusted id. These
// tests assert the fix directly: a user cannot fetch another user's
// prediction/outcome even by decision id alone.

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

const BASE = path.join(__dirname, "..");

function freshDb() {
  const dataDir = path.join(os.tmpdir(), `founderos-decision-repo-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dataDir, { recursive: true });
  process.env.DATA_DIR = dataDir;
  for (const m of ["src/config/index.js", "src/db/connection.js", "src/db/migrate.js", "src/repositories/decisionLifecycleRepository.js"]) {
    const p = path.join(BASE, m);
    try {
      delete require.cache[require.resolve(p)];
    } catch (e) {}
  }
  require(path.join(BASE, "src/db/migrate.js")).runMigrations();
  return require(path.join(BASE, "src/repositories/decisionLifecycleRepository.js"));
}

test("getPredictionByDecision — a different user cannot read another user's prediction by decision id", () => {
  const repo = freshDb();
  const decision = repo.createDecision({ userId: "user-a", decisionText: "Raise prices to $99" });
  repo.setDecisionStatus(decision.id, "user-a", { status: "proceeded", finalDecisionText: "Raise prices to $99" });
  repo.createPrediction({
    decisionId: decision.id,
    userId: "user-a",
    companySnapshot: { arr: 1000 },
    currentSituation: "Growing slowly",
    expectedImpact: ["ARR increases"],
    assumptions: ["Churn stays flat"],
    risks: ["Some churn increase"],
    bestCase: "ARR +20%",
    expectedCase: "ARR +10%",
    worstCase: "ARR -5%",
    confidence: 0.7,
    evaluationDate: new Date(Date.now() + 86400000).toISOString(),
  });

  // Owner can read it.
  const ownPrediction = repo.getPredictionByDecision(decision.id, "user-a");
  assert.notEqual(ownPrediction, null);
  assert.equal(ownPrediction.currentSituation, "Growing slowly");

  // A different user, even knowing the exact decision id, cannot.
  // (parsePredictionRow passes a not-found row through unchanged, and
  // better-sqlite3's .get() returns undefined — not null — for no match;
  // that's pre-existing, unrelated to this scoping fix.)
  const otherUsersView = repo.getPredictionByDecision(decision.id, "user-b");
  assert.equal(otherUsersView, undefined, "a prediction must not be readable by any user other than its owner");
});

test("getOutcomeByDecision — a different user cannot read another user's outcome by decision id", () => {
  const repo = freshDb();
  const decision = repo.createDecision({ userId: "user-a", decisionText: "Cut the marketing budget" });
  repo.setDecisionStatus(decision.id, "user-a", { status: "proceeded", finalDecisionText: "Cut the marketing budget" });
  const prediction = repo.createPrediction({
    decisionId: decision.id,
    userId: "user-a",
    companySnapshot: { arr: 500 },
    currentSituation: "High CAC",
    expectedImpact: [],
    assumptions: [],
    risks: [],
    bestCase: "CAC drops",
    expectedCase: "CAC flat",
    worstCase: "Growth stalls",
    confidence: 0.5,
  });
  repo.createOutcome({
    decisionId: decision.id,
    predictionId: prediction.id,
    userId: "user-a",
    actualUpdate: "CAC dropped 15%",
    actualMetricsSnapshot: { cac: 40 },
    comparisonSummary: "Better than expected",
    assumptionsReview: [],
  });

  const ownOutcome = repo.getOutcomeByDecision(decision.id, "user-a");
  assert.notEqual(ownOutcome, null);
  assert.equal(ownOutcome.actualUpdate, "CAC dropped 15%");

  const otherUsersView = repo.getOutcomeByDecision(decision.id, "user-b");
  assert.equal(otherUsersView, undefined, "an outcome must not be readable by any user other than its owner");
});

test("createOutcome still returns the just-created outcome to its own owner (scoping fix didn't break the write path)", () => {
  const repo = freshDb();
  const decision = repo.createDecision({ userId: "user-a", decisionText: "Hire a second engineer" });
  const prediction = repo.createPrediction({ decisionId: decision.id, userId: "user-a", companySnapshot: { founders: 1 }, currentSituation: "Solo founder", expectedImpact: [], assumptions: [], risks: [] });
  const outcome = repo.createOutcome({
    decisionId: decision.id,
    predictionId: prediction.id,
    userId: "user-a",
    actualUpdate: "Hired, velocity roughly doubled",
    actualMetricsSnapshot: null,
    comparisonSummary: "As expected",
    assumptionsReview: [],
  });
  assert.notEqual(outcome, null, "createOutcome must still return the row it just wrote, for its own user");
  assert.equal(outcome.actualUpdate, "Hired, velocity roughly doubled");
});
