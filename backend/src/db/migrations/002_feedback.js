// 002_feedback — a dedicated table for user feedback, separate from the
// generic per-user kv_store. Feedback needs to be readable in aggregate
// across every user (you, the app owner, reviewing it), unlike memory/
// timeline/analytics which are intentionally scoped to one founder at a
// time — so this gets its own real table instead of living in a bucket.

module.exports = {
  id: "002_feedback",
  up(db) {
    db.exec(`
      -- Postgres equivalent: id INTEGER GENERATED ALWAYS AS IDENTITY, created_at TIMESTAMPTZ
      CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        context TEXT NOT NULL,
        content TEXT,
        rating TEXT,
        comment TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at);
      CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);
    `);
  },
};
