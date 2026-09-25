// permissionRepository.js — backs §5 Level 2 of the autonomous-operating-
// model spec: "For recurring activities, FounderOS can ask once... If
// YES, save that permission and allow the system to continue within the
// approved scope. Do not repeatedly ask the same permission."
//
// `scope` is a stable machine key the caller defines (e.g.
// "monitor_competitor_pricing") — not free text — so `isGranted` can be
// checked cheaply before FounderOS does anything that scope covers,
// without re-deriving or re-parsing what was originally asked.

const { db } = require("../db/connection");

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function nowISO() {
  return new Date().toISOString();
}

const COLUMNS = `id, user_id AS userId, scope, description, status, granted_at AS grantedAt, revoked_at AS revokedAt, created_at AS createdAt, updated_at AS updatedAt`;

const getStmt = db.prepare(`SELECT ${COLUMNS} FROM permissions WHERE user_id = ? AND scope = ?`);
const listStmt = db.prepare(`SELECT ${COLUMNS} FROM permissions WHERE user_id = ? ORDER BY created_at DESC`);
const insertStmt = db.prepare(`
  INSERT INTO permissions (id, user_id, scope, description, status, granted_at, revoked_at, created_at, updated_at)
  VALUES (@id, @userId, @scope, @description, @status, @grantedAt, @revokedAt, @createdAt, @updatedAt)
`);
const updateStmt = db.prepare(`
  UPDATE permissions SET status = @status, granted_at = @grantedAt, revoked_at = @revokedAt, updated_at = @updatedAt WHERE id = @id
`);

// Returns null if this scope has never been asked about for this founder
// — the caller's signal to actually ask (once). Returns the current
// record (granted or revoked) otherwise.
function getPermission(userId, scope) {
  return getStmt.get(String(userId), scope) || null;
}

function listPermissions(userId) {
  return listStmt.all(String(userId));
}

// Records the founder's answer. Idempotent on (userId, scope) — a second
// call (e.g. the founder later revokes a previously granted permission,
// or grants one they'd revoked) updates the existing row rather than
// creating a duplicate, which is what the unique index in the migration
// enforces at the DB level too.
function setPermission(userId, scope, description, granted) {
  const existing = getPermission(userId, scope);
  const ts = nowISO();
  if (existing) {
    updateStmt.run({
      id: existing.id,
      status: granted ? "granted" : "revoked",
      grantedAt: granted ? ts : existing.grantedAt,
      revokedAt: granted ? null : ts,
      updatedAt: ts,
    });
    return getPermission(userId, scope);
  }
  insertStmt.run({
    id: uid("perm"),
    userId: String(userId),
    scope,
    description,
    status: granted ? "granted" : "revoked",
    grantedAt: granted ? ts : null,
    revokedAt: granted ? null : ts,
    createdAt: ts,
    updatedAt: ts,
  });
  return getPermission(userId, scope);
}

// Convenience check for the common case: "am I clear to just do this?"
function isGranted(userId, scope) {
  const p = getPermission(userId, scope);
  return !!p && p.status === "granted";
}

module.exports = { getPermission, listPermissions, setPermission, isGranted };
