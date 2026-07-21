const { db } = require("../db/connection");

// bucketRepository — same get/set/append contract the old fileStore had,
// backed by SQLite's kv_store table instead of one JSON file per bucket.
//
// append() still does read-modify-write of the whole JSON array, exactly
// like the old file-based version did — deliberately, so behavior is
// identical to before. The natural next optimization (once any bucket
// gets large/hot) is a normalized append-only table with an index; this
// repository is the only place that would need to change for that.

const getStmt = db.prepare("SELECT value FROM kv_store WHERE user_id = ? AND bucket = ?");
const upsertStmt = db.prepare(`
  INSERT INTO kv_store (user_id, bucket, value, updated_at)
  VALUES (@userId, @bucket, @value, @updatedAt)
  ON CONFLICT(user_id, bucket) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);

function get(userId, bucket, fallback = null) {
  const row = getStmt.get(String(userId || "local"), bucket);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value);
  } catch {
    return fallback;
  }
}

function set(userId, bucket, value) {
  upsertStmt.run({
    userId: String(userId || "local"),
    bucket,
    value: JSON.stringify(value),
    updatedAt: new Date().toISOString(),
  });
  return value;
}

function append(userId, bucket, entry, { max = 500 } = {}) {
  const list = get(userId, bucket, []);
  list.push(entry);
  const trimmed = list.length > max ? list.slice(list.length - max) : list;
  set(userId, bucket, trimmed);
  return trimmed;
}

module.exports = { get, set, append };
