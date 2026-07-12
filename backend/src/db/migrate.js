const { db } = require("./connection");

const MIGRATIONS = [require("./migrations/001_init"), require("./migrations/002_feedback")];

function ensureMigrationsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
}

function appliedIds() {
  return new Set(db.prepare("SELECT id FROM schema_migrations").all().map((r) => r.id));
}

/**
 * Runs every migration in MIGRATIONS that hasn't been applied yet, each
 * inside its own transaction, and records it so it never runs twice —
 * safe to call on every server boot ("automatic DB creation").
 */
function runMigrations() {
  ensureMigrationsTable();
  const applied = appliedIds();
  const pending = MIGRATIONS.filter((m) => !applied.has(m.id));

  if (pending.length === 0) {
    console.log("[db] schema up to date, no migrations to run");
    return;
  }

  for (const migration of pending) {
    const run = db.transaction(() => {
      migration.up(db);
      db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)").run(
        migration.id,
        new Date().toISOString()
      );
    });
    run();
    console.log(`[db] applied migration: ${migration.id}`);
  }
}

module.exports = { runMigrations };
