// 010_task_context_fields — backs the context-aware task generation spec.
//
// Two additions to the existing `tasks` table:
//
//   reason, why_now, expected_outcome, context_references
//     — the explicit "why this, why now" fields a context-aware task must
//       carry (§11/§16/§17 of the spec): reason = the underlying
//       rationale, why_now = what's happening RIGHT NOW that makes this
//       the right action, expected_outcome = what this should reveal/
//       produce, context_references = a JSON array of short strings
//       naming which specific pieces of context (an evidence item, a
//       stated goal, a prior task's finding) actually drove this
//       decision — so a task's "why" can be traced back to something
//       real instead of asserted. `objective` (existing column) stays
//       the 1-sentence purpose; `completionCriteria` (existing column)
//       continues to serve as the task's success criteria — no
//       duplicate column added for that, see executionEngine.js.
//
//   outcome_json
//     — captured once, at completion (see executionEngine.verifyEvidence
//       and aiService.synthesizeTaskOutcome): { summary, discoveries[],
//       decisions[], implications[] }. This is what turns "task: done"
//       into something the NEXT task-generation pass can actually build
//       on (§6/§7/§13 — the causal chain: observation → task → result →
//       learning → next task). Stored on the task itself, not a separate
//       table, since it's a fact about that one task's outcome and never
//       queried independently of its task.
//
// Backward compatible: existing tasks get NULL for all five columns.
// Application code treats a NULL outcome_json as "no structured outcome
// captured for this task" (pre-migration tasks, or a task completed via
// a background activity match rather than the interactive flow) and
// falls back to the existing verification_notes string — never an error.

module.exports = {
  id: "010_task_context_fields",
  up(db) {
    db.exec(`
      ALTER TABLE tasks ADD COLUMN reason TEXT;
      ALTER TABLE tasks ADD COLUMN why_now TEXT;
      ALTER TABLE tasks ADD COLUMN expected_outcome TEXT;
      ALTER TABLE tasks ADD COLUMN context_references TEXT;
      ALTER TABLE tasks ADD COLUMN outcome_json TEXT;
    `);
  },
};
