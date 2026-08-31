// 008_activity_evidence — adds the Activity/Evidence layer described in
// the "automatic task verification" spec, on top of the existing
// execution-engine tables from 007 (not replacing them).
//
// Three concerns, kept genuinely separate per that spec's own framing:
//   activities     — things FounderOS actually observed happening
//                    (a document upload, a decision recorded, a chat
//                    message) — source of truth for "what happened."
//   task_evidence  — the join between an activity (or a manual founder
//                    submission) and a specific task, with a relevance/
//                    strength/verification judgment attached. One
//                    activity can produce evidence rows against more
//                    than one task.
//   tasks.evidence_config — a new column on the existing tasks table
//                    describing what kind of evidence a task actually
//                    needs and whether FounderOS can auto-verify it,
//                    without disturbing any existing column tasks already
//                    relies on (required_threshold, evidence_submitted,
//                    etc. all stay exactly as they were for anything that
//                    doesn't read the new column).
//
// Backward compatibility: existing tasks (created before this migration)
// get evidence_config = NULL. Application code treats NULL as "use the
// existing text-based evidence_requirements / required_threshold
// behavior" — see executionRepository.parseTaskRow's default handling —
// so nothing about already-running tasks changes just because this
// migration ran.

module.exports = {
  id: "008_activity_evidence",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,           -- e.g. document_uploaded, decision_recorded, chat_message_sent
        source TEXT NOT NULL,         -- module that produced it, e.g. documents, decisions, chat, execution
        entity_id TEXT,               -- id of the thing this activity is about, if any (document id, decision id...)
        metadata TEXT,                -- JSON, activity-type-specific
        description TEXT NOT NULL,    -- human-readable, e.g. 'Uploaded "interview-notes.pdf"'
        dedupe_key TEXT,              -- see activityRepository.record() — prevents e.g. 20 rapid edits becoming 20 rows
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_activities_dedupe ON activities(user_id, dedupe_key);

      CREATE TABLE IF NOT EXISTS task_evidence (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        activity_id TEXT,              -- NULL for manually-typed evidence (kind='manual')
        kind TEXT NOT NULL,            -- 'activity' | 'manual'
        content TEXT,                  -- the manual text, or a synthesized description for activity-derived evidence
        relevance_score REAL,          -- 0-1, how relevant this activity is to this task (from matching)
        strength TEXT,                 -- 'weak' | 'medium' | 'strong'
        verification_status TEXT NOT NULL DEFAULT 'evidence_found', -- evidence_found | needs_more_evidence | verified | rejected
        verification_score REAL,       -- 0-1, from the same verifyTaskEvidence scoring used for manual evidence
        notes TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_task_evidence_task ON task_evidence(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_evidence_activity ON task_evidence(activity_id);

      ALTER TABLE tasks ADD COLUMN evidence_config TEXT;
    `);
  },
};
