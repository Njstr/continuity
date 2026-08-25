const { db } = require("../db/connection");

function uid() {
  return `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function nowISO() {
  return new Date().toISOString();
}
function toJSON(v) {
  return v === undefined || v === null ? null : JSON.stringify(v);
}
function fromJSON(v, fallback = null) {
  if (!v) return fallback;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

const insertStmt = db.prepare(`
  INSERT INTO activities (id, user_id, type, source, entity_id, metadata, description, dedupe_key, created_at)
  VALUES (@id, @userId, @type, @source, @entityId, @metadata, @description, @dedupeKey, @createdAt)
`);
const findRecentByDedupeStmt = db.prepare(`
  SELECT id FROM activities WHERE user_id = ? AND dedupe_key = ? AND created_at > ? ORDER BY created_at DESC LIMIT 1
`);
const updateStmt = db.prepare(`UPDATE activities SET metadata = ?, description = ?, created_at = ? WHERE id = ?`);
const COLUMNS = `id, user_id AS userId, type, source, entity_id AS entityId, metadata, description, dedupe_key AS dedupeKey, created_at AS createdAt`;
const getStmt = db.prepare(`SELECT ${COLUMNS} FROM activities WHERE id = ?`);
const listRecentStmt = db.prepare(`SELECT ${COLUMNS} FROM activities WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`);

function parseRow(row) {
  if (!row) return null;
  return { ...row, metadata: fromJSON(row.metadata, {}) };
}

// §14 — dedupe window: if the same (user, dedupeKey) happened within the
// last few minutes, update that row's timestamp/metadata instead of
// inserting a new one. Callers pass a dedupeKey that captures "this is
// the same underlying thing happening again" — e.g.
// `document_edited:${documentId}` for repeated edits to one document —
// so 20 rapid edits become one row with a fresh timestamp, not 20 rows.
// Genuinely distinct events (different document, different type) always
// get their own row regardless of window.
const DEDUPE_WINDOW_MS = 5 * 60 * 1000;

function record({ userId, type, source, entityId, metadata, description, dedupeKey }) {
  const ts = nowISO();
  if (dedupeKey) {
    const windowStart = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();
    const existing = findRecentByDedupeStmt.get(String(userId), dedupeKey, windowStart);
    if (existing) {
      updateStmt.run(toJSON(metadata), description, ts, existing.id);
      return getActivity(existing.id);
    }
  }
  const id = uid();
  insertStmt.run({
    id,
    userId: String(userId),
    type,
    source,
    entityId: entityId || null,
    metadata: toJSON(metadata || {}),
    description,
    dedupeKey: dedupeKey || null,
    createdAt: ts,
  });
  return getActivity(id);
}

function getActivity(id) {
  return parseRow(getStmt.get(id));
}
function listRecent(userId, { limit = 50 } = {}) {
  return listRecentStmt.all(String(userId), limit).map(parseRow);
}

module.exports = { record, getActivity, listRecent };
