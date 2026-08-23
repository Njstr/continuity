const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const config = require("../config");

// connection.js — the ONLY file that knows this is SQLite.
//
// Repositories talk to this module, not to better-sqlite3 directly, so
// migrating to Postgres later means rewriting this file (swap to a `pg`
// Pool + promisified query helper) and the two repository files — nothing
// in services/ or routes/ has to change.

if (!fs.existsSync(config.dataDir)) {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

const dbPath = path.join(config.dataDir, "founder-os.sqlite");
const db = new Database(dbPath);

// WAL mode: much better concurrent read/write behavior under real traffic
// than the default rollback journal, at the cost of a couple extra files
// next to the .sqlite file (-wal, -shm) — normal and expected.
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function close() {
  db.close();
}

module.exports = { db, dbPath, close };
