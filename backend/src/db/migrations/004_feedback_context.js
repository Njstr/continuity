// 004_feedback_context — widens the feedback table with the extra context
// the FounderOS V2 Feedback Center needs: the founder's original prompt,
// whether the reply came from the inline Decision Simulator, the raw
// simulation payload at that moment, and the metrics snapshot it was
// computed against. Stored as TEXT (JSON-encoded) for the two structured
// fields, same pattern as kv_store — Postgres equivalent: JSONB.

module.exports = {
  id: "004_feedback_context",
  up(db) {
    db.exec(`
      ALTER TABLE feedback ADD COLUMN prompt TEXT;
      ALTER TABLE feedback ADD COLUMN simulated INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE feedback ADD COLUMN simulation_result TEXT;
      ALTER TABLE feedback ADD COLUMN metrics_snapshot TEXT;
    `);
  },
};
