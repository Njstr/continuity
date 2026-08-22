const { db } = require("../db/connection");

// Strictly anonymized: no user_id, no founder name, no company name. Only
// aggregate-safe categories (business model, stage, mission type, outcome
// direction) — the minimum needed for future honest cross-founder learning.

const insertStmt = db.prepare(`
  INSERT INTO execution_patterns
    (business_model, company_stage, mission_category, difficulty, outcome, revenue_delta_sign, customers_delta_sign, created_at)
  VALUES (@businessModel, @companyStage, @missionCategory, @difficulty, @outcome, @revenueDeltaSign, @customersDeltaSign, @createdAt)
`);

function sign(n) {
  if (!n || n === 0) return "flat";
  return n > 0 ? "positive" : "negative";
}

function log({ businessModel, companyStage, missionCategory, difficulty, outcome, revenueDelta, customersDelta }) {
  insertStmt.run({
    businessModel: businessModel || "unknown",
    companyStage: companyStage || "unknown",
    missionCategory: missionCategory || "general",
    difficulty: difficulty || "Medium",
    outcome: outcome || "done",
    revenueDeltaSign: sign(revenueDelta),
    customersDeltaSign: sign(customersDelta),
    createdAt: new Date().toISOString(),
  });
}

function count() {
  return db.prepare("SELECT COUNT(*) AS c FROM execution_patterns").get().c;
}

module.exports = { log, count };
