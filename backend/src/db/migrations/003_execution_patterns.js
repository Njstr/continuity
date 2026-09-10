// 003_execution_patterns — the schema for the "Founder Intelligence Engine"
// (spec Part 9). Deliberately NOT wired into any AI prompt yet: with a
// handful of users, "founders like you" insights would be statistically
// meaningless — worse, they'd be a plausible-sounding fabrication. This
// table exists so the data collection starts now (anonymized, no user_id,
// no PII) and the aggregate-learning feature can be turned on honestly
// once there's enough real volume to say something true.

module.exports = {
  id: "003_execution_patterns",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS execution_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_model TEXT,
        company_stage TEXT,
        mission_category TEXT,
        difficulty TEXT,
        outcome TEXT,
        revenue_delta_sign TEXT,
        customers_delta_sign TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_exec_patterns_model_stage ON execution_patterns(business_model, company_stage);
    `);
  },
};
