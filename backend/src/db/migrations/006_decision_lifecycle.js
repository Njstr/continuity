// 006_decision_lifecycle — backs the core "Decide" loop: a founder's
// decision, the prediction snapshot made at that moment (never edited
// after creation — see predictions.created_at comment), what actually
// happened later, and patterns synthesized across outcomes over time.
//
// Previously this all lived in a single localStorage array on the
// frontend (App.jsx `decisions` state) — fine for a prototype, wrong for
// something that's supposed to remember what it believed months ago and
// compare it to reality. This makes that real and durable.

module.exports = {
  id: "006_decision_lifecycle",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        decision_text TEXT NOT NULL,
        final_decision_text TEXT,
        rationale TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        decided_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_decisions_user ON decisions(user_id);

      -- IMMUTABLE once written. No repository function updates a row in
      -- this table after INSERT — that's the actual mechanism behind "the
      -- historical prediction must not silently change," not just a
      -- comment. If you're tempted to add an UPDATE here, don't; add a
      -- new row in decision_outcomes instead.
      CREATE TABLE IF NOT EXISTS predictions (
        id TEXT PRIMARY KEY,
        decision_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        company_snapshot TEXT NOT NULL,
        current_situation TEXT,
        expected_impact TEXT NOT NULL,
        assumptions TEXT,
        risks TEXT,
        best_case TEXT,
        expected_case TEXT,
        worst_case TEXT,
        confidence TEXT,
        evaluation_date TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_predictions_decision ON predictions(decision_id);
      CREATE INDEX IF NOT EXISTS idx_predictions_user_eval ON predictions(user_id, evaluation_date);

      CREATE TABLE IF NOT EXISTS decision_outcomes (
        id TEXT PRIMARY KEY,
        decision_id TEXT NOT NULL,
        prediction_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        actual_update TEXT NOT NULL,
        actual_metrics_snapshot TEXT,
        comparison_summary TEXT,
        assumptions_review TEXT,
        recorded_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_outcomes_decision ON decision_outcomes(decision_id);

      CREATE TABLE IF NOT EXISTS learned_patterns (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        pattern_text TEXT NOT NULL,
        category TEXT,
        based_on_decision_ids TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_patterns_user ON learned_patterns(user_id);
    `);
  },
};
