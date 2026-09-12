// 009_task_dedup_fields — backs the founder/startup information gate,
// duplicate-objective prevention, and revisit-eligibility rules described
// in the "information gate + duplicate task prevention" spec.
//
// Three new columns on the existing `tasks` table (not a new table —
// these are just more facts about a task, same lifecycle as everything
// else already on this row):
//
//   category            — coarse bucket (e.g. "customer_validation",
//                          "fundraising") used for fast duplicate/history
//                          lookups without needing an AI call.
//   objective_key        — a normalized, stable identifier for what the
//                          task is actually FOR (e.g.
//                          "validate_customer_problem"), independent of
//                          the human-readable title/wording. This is what
//                          "substantially equivalent" duplicate detection
//                          actually compares — see
//                          executionEngine.isDuplicateOfCompleted.
//   revisit_conditions   — JSON array of founder_state field names (e.g.
//                          ["targetCustomer","problem"]) that, if they
//                          change AFTER this task completes, justify
//                          proposing an equivalent task again. Checked
//                          against founder_state's own change log (see
//                          executionEngine's state change tracking) —
//                          nothing new to store on the founder_state side,
//                          it already gets a `changeLog` field folded into
//                          its existing JSON blob.
//
// Backward compatibility: existing tasks get all three columns as NULL.
// Application code treats a NULL objective_key as "never matches an
// exact-key duplicate" (falls back to the title-similarity check instead)
// and a NULL revisit_conditions as "no known reason to ever revisit" —
// see executionEngine.isDuplicateOfCompleted's defaults. Nothing about
// already-running or already-completed tasks breaks just because this
// migration ran.

module.exports = {
  id: "009_task_dedup_fields",
  up(db) {
    db.exec(`
      ALTER TABLE tasks ADD COLUMN category TEXT;
      ALTER TABLE tasks ADD COLUMN objective_key TEXT;
      ALTER TABLE tasks ADD COLUMN revisit_conditions TEXT;

      CREATE INDEX IF NOT EXISTS idx_tasks_user_objective_key ON tasks(user_id, objective_key);
    `);
  },
};
