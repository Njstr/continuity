// 007_execution_engine — backs the evidence-gated execution loop: a
// structured founder_state snapshot the task engine reasons from, and a
// task graph (tasks + dependency edges) with evidence and verification
// tracked per task. This is deliberately separate from `decisions` /
// `predictions` (the Decide loop) — that system is about forecasting and
// checking a single decision's outcome; this one is about sequencing and
// gating *what the founder does next*, task by task, with evidence
// required before the next one unlocks. Different lifecycle, different
// tables, same conventions (see decisionLifecycleRepository.js).
//
// Critical design point (see executionRepository.js / executionEngine.js):
// verification_score and status transitions are written by application
// code after checking verification_score against required_threshold —
// never directly from unvalidated model output. The DB schema itself
// doesn't enforce this (SQLite can't express "only advance if score >=
// threshold"), so that guarantee lives in the repository/service layer,
// not here. This file only defines the shape.

module.exports = {
  id: "007_execution_engine",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS founder_state (
        user_id TEXT PRIMARY KEY,
        state_json TEXT NOT NULL,
        ready INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        objective TEXT NOT NULL,
        why_it_matters TEXT,
        dependencies TEXT,            -- JSON array of task ids that must be COMPLETED first
        steps TEXT NOT NULL,          -- JSON array of { title, instructions }
        current_step_index INTEGER NOT NULL DEFAULT 0,
        completion_criteria TEXT,
        evidence_requirements TEXT,
        required_threshold REAL NOT NULL DEFAULT 0.6,
        priority_factors TEXT,        -- JSON: { impact, urgency, uncertaintyReduction, riskReduction, effort }
        priority_score REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'LOCKED',  -- LOCKED | AVAILABLE | IN_PROGRESS | AWAITING_EVIDENCE | COMPLETED
        evidence_submitted TEXT,      -- JSON array of { stepIndex, text, submittedAt }
        verification_score REAL,
        verification_status TEXT,     -- sufficient | insufficient | claim_only
        verification_notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);
    `);
  },
};
