const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

const BASE = path.join(__dirname, "..");

function freshDb() {
  const dataDir = path.join(os.tmpdir(), `founderos-permissions-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dataDir, { recursive: true });
  process.env.DATA_DIR = dataDir;
  for (const m of ["src/config/index.js", "src/db/connection.js", "src/db/migrate.js", "src/repositories/permissionRepository.js"]) {
    const p = path.join(BASE, m);
    try {
      delete require.cache[require.resolve(p)];
    } catch (e) {}
  }
  require(path.join(BASE, "src/db/migrate.js")).runMigrations();
  return require(path.join(BASE, "src/repositories/permissionRepository.js"));
}

test("permissionRepository — never-asked scope returns null, not granted", () => {
  const repo = freshDb();
  assert.equal(repo.getPermission("u1", "monitor_competitor_pricing"), null);
  assert.equal(repo.isGranted("u1", "monitor_competitor_pricing"), false);
});

test("permissionRepository — grant persists and isGranted reflects it", () => {
  const repo = freshDb();
  repo.setPermission("u1", "monitor_competitor_pricing", "Continuously monitor competitor pricing", true);
  assert.equal(repo.isGranted("u1", "monitor_competitor_pricing"), true);
  const p = repo.getPermission("u1", "monitor_competitor_pricing");
  assert.equal(p.status, "granted");
  assert.ok(p.grantedAt);
  assert.equal(p.revokedAt, null);
});

test("permissionRepository — a denied ask is remembered as not-granted, and never re-asked", () => {
  const repo = freshDb();
  repo.setPermission("u1", "monitor_competitor_pricing", "Continuously monitor competitor pricing", false);
  assert.equal(repo.isGranted("u1", "monitor_competitor_pricing"), false);
  const p = repo.getPermission("u1", "monitor_competitor_pricing");
  assert.notEqual(p, null, "a denied scope must still be a recorded answer, not treated as never-asked");
  assert.equal(p.status, "revoked");
});

test("permissionRepository — revoking a previously granted permission updates in place, no duplicate row", () => {
  const repo = freshDb();
  repo.setPermission("u1", "monitor_competitor_pricing", "Continuously monitor competitor pricing", true);
  repo.setPermission("u1", "monitor_competitor_pricing", "Continuously monitor competitor pricing", false);
  assert.equal(repo.isGranted("u1", "monitor_competitor_pricing"), false);
  const all = repo.listPermissions("u1");
  assert.equal(all.filter((p) => p.scope === "monitor_competitor_pricing").length, 1, "must update in place, not insert a second row");
});

test("permissionRepository — scopes and users are isolated from each other", () => {
  const repo = freshDb();
  repo.setPermission("u1", "monitor_competitor_pricing", "d1", true);
  repo.setPermission("u1", "monitor_social_mentions", "d2", false);
  repo.setPermission("u2", "monitor_competitor_pricing", "d1", false);

  assert.equal(repo.isGranted("u1", "monitor_competitor_pricing"), true);
  assert.equal(repo.isGranted("u1", "monitor_social_mentions"), false);
  assert.equal(repo.isGranted("u2", "monitor_competitor_pricing"), false, "u2's grant must be independent of u1's for the same scope");
  assert.equal(repo.listPermissions("u1").length, 2);
});
