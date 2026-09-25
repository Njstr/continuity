// 012_permissions — backs §5 Level 2 of the autonomous-operating-model
// spec: recurring activities FounderOS can ask permission for ONCE, then
// never ask again within that approved scope.
//
// Deliberately a separate table from `decisions`/`predictions`
// (006_decision_lifecycle) rather than reusing that system: a decision
// there is a founder-made strategic call with a tracked prediction and
// outcome comparison over time — a fundamentally heavier-weight object.
// A permission here is a simple, static yes/no gate ("can FounderOS keep
// doing X going forward") with no prediction to evaluate and no outcome
// to compare against. Conflating the two would mean either bloating
// `decisions` with fields that don't apply to a permission grant, or
// silently treating a permission grant as if it were a tracked business
// decision — neither is right, so this is its own small table instead.
//
// One row per (user_id, scope) — enforced by the unique index — so
// asking about the same scope twice updates the existing grant/revoke
// record rather than creating a duplicate the application would then
// have to disambiguate between.

module.exports = {
  id: "012_permissions",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS permissions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        scope TEXT NOT NULL,            -- stable machine key, e.g. "monitor_competitor_pricing"
        description TEXT NOT NULL,      -- the human-readable ask, e.g. "Continuously monitor competitor pricing"
        status TEXT NOT NULL DEFAULT 'granted', -- granted | revoked
        granted_at TEXT,
        revoked_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_permissions_user_scope ON permissions(user_id, scope);
    `);
  },
};
