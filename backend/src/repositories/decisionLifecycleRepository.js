const { db } = require("../db/connection");

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function nowISO() {
  return new Date().toISOString();
}
function toJSON(v) {
  return v === undefined || v === null ? null : JSON.stringify(v);
}
function fromJSON(v) {
  if (!v) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

// ---- decisions ----
const insertDecisionStmt = db.prepare(`
  INSERT INTO decisions (id, user_id, decision_text, final_decision_text, rationale, status, created_at, decided_at)
  VALUES (@id, @userId, @decisionText, @finalDecisionText, @rationale, @status, @createdAt, @decidedAt)
`);
const updateDecisionStatusStmt = db.prepare(`
  UPDATE decisions SET status = ?, final_decision_text = ?, rationale = ?, decided_at = ? WHERE id = ? AND user_id = ?
`);
const getDecisionStmt = db.prepare(`SELECT id, user_id AS userId, decision_text AS decisionText, final_decision_text AS finalDecisionText, rationale, status, created_at AS createdAt, decided_at AS decidedAt FROM decisions WHERE id = ? AND user_id = ?`);
const listDecisionsStmt = db.prepare(`SELECT id, user_id AS userId, decision_text AS decisionText, final_decision_text AS finalDecisionText, rationale, status, created_at AS createdAt, decided_at AS decidedAt FROM decisions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`);

function createDecision({ userId, decisionText }) {
  const id = uid("dec");
  insertDecisionStmt.run({ id, userId: String(userId), decisionText, finalDecisionText: null, rationale: null, status: "pending", createdAt: nowISO(), decidedAt: null });
  return getDecisionStmt.get(id, String(userId));
}
function setDecisionStatus(id, userId, { status, finalDecisionText, rationale }) {
  updateDecisionStatusStmt.run(status, finalDecisionText || null, rationale || null, nowISO(), id, String(userId));
  return getDecisionStmt.get(id, String(userId));
}
function getDecision(id, userId) {
  return getDecisionStmt.get(id, String(userId));
}
function listDecisions(userId, { limit = 100 } = {}) {
  return listDecisionsStmt.all(String(userId), limit);
}

// ---- predictions (write-once — no update statement exists on purpose) ----
const insertPredictionStmt = db.prepare(`
  INSERT INTO predictions (id, decision_id, user_id, company_snapshot, current_situation, expected_impact, assumptions, risks, best_case, expected_case, worst_case, confidence, evaluation_date, created_at)
  VALUES (@id, @decisionId, @userId, @companySnapshot, @currentSituation, @expectedImpact, @assumptions, @risks, @bestCase, @expectedCase, @worstCase, @confidence, @evaluationDate, @createdAt)
`);
const PRED_COLUMNS = `id, decision_id AS decisionId, user_id AS userId, company_snapshot AS companySnapshot, current_situation AS currentSituation, expected_impact AS expectedImpact, assumptions, risks, best_case AS bestCase, expected_case AS expectedCase, worst_case AS worstCase, confidence, evaluation_date AS evaluationDate, created_at AS createdAt`;
const getPredictionByDecisionStmt = db.prepare(`SELECT ${PRED_COLUMNS} FROM predictions WHERE decision_id = ?`);
const getPredictionStmt = db.prepare(`SELECT ${PRED_COLUMNS} FROM predictions WHERE id = ? AND user_id = ?`);
// Due for check-in: evaluation_date has passed AND no outcome recorded yet.
const dueForCheckInStmt = db.prepare(`
  SELECT ${PRED_COLUMNS} FROM predictions p
  WHERE p.user_id = ? AND p.evaluation_date IS NOT NULL AND p.evaluation_date <= ?
    AND NOT EXISTS (SELECT 1 FROM decision_outcomes o WHERE o.decision_id = p.decision_id)
  ORDER BY p.evaluation_date ASC
`);

function parsePredictionRow(row) {
  if (!row) return row;
  return {
    ...row,
    companySnapshot: fromJSON(row.companySnapshot),
    expectedImpact: fromJSON(row.expectedImpact) || [],
    assumptions: fromJSON(row.assumptions) || [],
    risks: fromJSON(row.risks) || [],
  };
}

function createPrediction({ decisionId, userId, companySnapshot, currentSituation, expectedImpact, assumptions, risks, bestCase, expectedCase, worstCase, confidence, evaluationDate }) {
  const id = uid("pred");
  insertPredictionStmt.run({
    id,
    decisionId,
    userId: String(userId),
    companySnapshot: toJSON(companySnapshot),
    currentSituation: currentSituation || null,
    expectedImpact: toJSON(expectedImpact),
    assumptions: toJSON(assumptions),
    risks: toJSON(risks),
    bestCase: bestCase || null,
    expectedCase: expectedCase || null,
    worstCase: worstCase || null,
    confidence: confidence || null,
    evaluationDate: evaluationDate || null,
    createdAt: nowISO(),
  });
  return parsePredictionRow(getPredictionStmt.get(id, String(userId)));
}
function getPredictionByDecision(decisionId) {
  return parsePredictionRow(getPredictionByDecisionStmt.get(decisionId));
}
function listDueForCheckIn(userId, asOfISO = nowISO()) {
  return dueForCheckInStmt.all(String(userId), asOfISO).map(parsePredictionRow);
}

// ---- decision_outcomes ----
const insertOutcomeStmt = db.prepare(`
  INSERT INTO decision_outcomes (id, decision_id, prediction_id, user_id, actual_update, actual_metrics_snapshot, comparison_summary, assumptions_review, recorded_at)
  VALUES (@id, @decisionId, @predictionId, @userId, @actualUpdate, @actualMetricsSnapshot, @comparisonSummary, @assumptionsReview, @recordedAt)
`);
const OUT_COLUMNS = `id, decision_id AS decisionId, prediction_id AS predictionId, user_id AS userId, actual_update AS actualUpdate, actual_metrics_snapshot AS actualMetricsSnapshot, comparison_summary AS comparisonSummary, assumptions_review AS assumptionsReview, recorded_at AS recordedAt`;
const getOutcomeByDecisionStmt = db.prepare(`SELECT ${OUT_COLUMNS} FROM decision_outcomes WHERE decision_id = ?`);
const listOutcomesForUserStmt = db.prepare(`SELECT ${OUT_COLUMNS} FROM decision_outcomes WHERE user_id = ? ORDER BY recorded_at DESC LIMIT ?`);

function parseOutcomeRow(row) {
  if (!row) return row;
  return { ...row, actualMetricsSnapshot: fromJSON(row.actualMetricsSnapshot), assumptionsReview: fromJSON(row.assumptionsReview) || [] };
}

function createOutcome({ decisionId, predictionId, userId, actualUpdate, actualMetricsSnapshot, comparisonSummary, assumptionsReview }) {
  const id = uid("out");
  insertOutcomeStmt.run({
    id,
    decisionId,
    predictionId,
    userId: String(userId),
    actualUpdate,
    actualMetricsSnapshot: toJSON(actualMetricsSnapshot),
    comparisonSummary: comparisonSummary || null,
    assumptionsReview: toJSON(assumptionsReview),
    recordedAt: nowISO(),
  });
  return parseOutcomeRow(getOutcomeByDecisionStmt.get(decisionId));
}
function getOutcomeByDecision(decisionId) {
  return parseOutcomeRow(getOutcomeByDecisionStmt.get(decisionId));
}
function listOutcomesForUser(userId, { limit = 50 } = {}) {
  return listOutcomesForUserStmt.all(String(userId), limit).map(parseOutcomeRow);
}

// ---- learned_patterns ----
const insertPatternStmt = db.prepare(`
  INSERT INTO learned_patterns (id, user_id, pattern_text, category, based_on_decision_ids, created_at, updated_at)
  VALUES (@id, @userId, @patternText, @category, @basedOn, @createdAt, @updatedAt)
`);
const PAT_COLUMNS = `id, user_id AS userId, pattern_text AS patternText, category, based_on_decision_ids AS basedOnDecisionIds, created_at AS createdAt, updated_at AS updatedAt`;
const listPatternsStmt = db.prepare(`SELECT ${PAT_COLUMNS} FROM learned_patterns WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?`);

function addPattern({ userId, patternText, category, basedOnDecisionIds }) {
  const id = uid("pat");
  const ts = nowISO();
  insertPatternStmt.run({ id, userId: String(userId), patternText, category: category || null, basedOn: toJSON(basedOnDecisionIds), createdAt: ts, updatedAt: ts });
}
function listPatterns(userId, { limit = 20 } = {}) {
  return listPatternsStmt.all(String(userId), limit).map((r) => ({ ...r, basedOnDecisionIds: fromJSON(r.basedOnDecisionIds) || [] }));
}

module.exports = {
  createDecision, setDecisionStatus, getDecision, listDecisions,
  createPrediction, getPredictionByDecision, listDueForCheckIn,
  createOutcome, getOutcomeByDecision, listOutcomesForUser,
  addPattern, listPatterns,
};
