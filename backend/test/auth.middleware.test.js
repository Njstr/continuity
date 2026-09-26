// Regression tests for resolveUser's device-id handling in local
// (AUTH_ENABLED=false) mode. Previously a missing X-Device-Id silently
// fell back to the literal string "local" — since this header is the
// only thing separating one founder's data from another's when auth is
// off, any client omitting it would transparently share data with every
// other client that also omitted it. The fix rejects instead.

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

const BASE = path.join(__dirname, "..");

// auth.js -> authService.js -> userRepository.js prepares SQL statements
// against the `users` table at require time (not lazily), so even
// resolveUser's local-mode path — which never itself touches the DB —
// fails at require() against an unmigrated scratch database. A real
// migrated DB is needed here purely to satisfy that require-time
// preparation, not because these tests exercise it.
function freshAuthMiddleware() {
  const dataDir = path.join(os.tmpdir(), `founderos-auth-mw-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dataDir, { recursive: true });
  process.env.DATA_DIR = dataDir;
  for (const m of ["src/config/index.js", "src/db/connection.js", "src/db/migrate.js", "src/repositories/userRepository.js", "src/services/authService.js", "src/middleware/auth.js"]) {
    const p = path.join(BASE, m);
    try {
      delete require.cache[require.resolve(p)];
    } catch (e) {}
  }
  delete process.env.AUTH_ENABLED;
  require(path.join(BASE, "src/db/migrate.js")).runMigrations();
  return require(path.join(BASE, "src/middleware/auth.js"));
}

function mockReq(headers = {}) {
  return { header: (name) => headers[name] };
}
function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

test("resolveUser — missing X-Device-Id is rejected with 400, not defaulted to a shared account", () => {
  const resolveUser = freshAuthMiddleware();
  const req = mockReq({});
  const res = mockRes();
  let nextCalled = false;
  resolveUser(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false, "next() must not be called when the device id is missing");
  assert.equal(res.statusCode, 400);
  assert.equal(req.userId, undefined, "userId must never be silently set to a shared default");
});

test("resolveUser — a real X-Device-Id is accepted and passed through as userId", () => {
  const resolveUser = freshAuthMiddleware();
  const req = mockReq({ "X-Device-Id": "dev_abc123" });
  const res = mockRes();
  let nextCalled = false;
  resolveUser(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(req.userId, "dev_abc123");
  assert.equal(res.statusCode, null, "must not write any error response on the success path");
});

test("resolveUser — two different device ids never collide on the same userId", () => {
  const resolveUser = freshAuthMiddleware();
  const reqA = mockReq({ "X-Device-Id": "dev_aaa" });
  const reqB = mockReq({ "X-Device-Id": "dev_bbb" });
  resolveUser(reqA, mockRes(), () => {});
  resolveUser(reqB, mockRes(), () => {});
  assert.notEqual(reqA.userId, reqB.userId);
});
