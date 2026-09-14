// 011_action_execution — backs the autonomous-execution transformation
// spec: every planned action must be classified (AUTONOMOUS /
// APPROVAL_REQUIRED / FOUNDER_REQUIRED), and a FOUNDER_REQUIRED task must
// be able to show what FounderOS already did before delegating.
//
// Three additions to the existing `tasks` table:
//
//   action_type      — "AUTONOMOUS" | "APPROVAL_REQUIRED" | "FOUNDER_REQUIRED".
//                       Deliberately NOT a new concept bolted onto a new
//                       table: an autonomous action still gets a Task row
//                       (created already COMPLETED, with its real result
//                       in outcome_json — see executionEngine.js), so it
//                       still participates in the exact same duplicate-
//                       detection/revisit-eligibility machinery
//                       (objective_key, revisit_conditions) built for
//                       every other task, rather than a second parallel
//                       "autonomous action log."
//
//   autonomous_work  — JSON array of short strings: what FounderOS
//                       already did before asking the founder to do the
//                       remaining, genuinely human-required part (§4C/§20
//                       — "do everything possible before delegating").
//                       Only meaningful on FOUNDER_REQUIRED tasks; NULL
//                       (rendered as []) on everything else.
//
//   execution_state  — the richer state-machine label §14 asks for
//                       (IDENTIFIED/PLANNING/EXECUTING/WAITING_FOR_APPROVAL/
//                       WAITING_FOR_FOUNDER/VERIFYING/COMPLETED/FAILED/
//                       BLOCKED), layered ON TOP OF the existing `status`
//                       column rather than replacing it — `status`
//                       (LOCKED/AVAILABLE/IN_PROGRESS/AWAITING_EVIDENCE/
//                       COMPLETED) keeps driving the reveal/evidence UI
//                       exactly as it already did (backward compatible,
//                       §41), while execution_state is the semantic label
//                       this spec's action-classification/approval flow
//                       actually reasons over. Two fields tracking related
//                       but distinct things — not a duplicate state
//                       system, since neither alone fully describes what
//                       the other does.
//
// Backward compatible: existing tasks get action_type = NULL (treated as
// "FOUNDER_REQUIRED" by application code, since every pre-existing task
// WAS a founder-facing task under the old model) and execution_state =
// NULL (treated per existing `status`, since nothing before this
// migration ever set it).

module.exports = {
  id: "011_action_execution",
  up(db) {
    db.exec(`
      ALTER TABLE tasks ADD COLUMN action_type TEXT;
      ALTER TABLE tasks ADD COLUMN autonomous_work TEXT;
      ALTER TABLE tasks ADD COLUMN execution_state TEXT;
    `);
  },
};
