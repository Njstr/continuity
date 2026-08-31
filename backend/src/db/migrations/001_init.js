// 001_init — the starting schema. Written in plain, portable SQL (no
// SQLite-only tricks beyond AUTOINCREMENT) so a future move to Postgres is
// a small, mechanical rewrite rather than a redesign. Where syntax must
// differ, the Postgres equivalent is noted in a comment.

module.exports = {
  id: "001_init",
  up(db) {
    db.exec(`
      -- Postgres equivalent: id TEXT PRIMARY KEY, ... , created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

      -- Generic per-user, per-bucket JSON value store. This is a direct
      -- swap-in for the old fileStore's one-JSON-file-per-user-per-bucket
      -- design (same get/set/append semantics), just persisted in SQLite
      -- instead of the filesystem. Postgres equivalent: value JSONB
      -- instead of TEXT, everything else identical.
      CREATE TABLE IF NOT EXISTS kv_store (
        user_id TEXT NOT NULL,
        bucket TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, bucket)
      );
    `);
  },
};
