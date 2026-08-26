const { runMigrations } = require("./src/db/migrate");
const { close: closeDb } = require("./src/db/connection");
const config = require("./src/config");

// Run pending migrations before the app (and its DB-backed routes) comes
// up at all — this is what makes "automatic DB creation" true on a fresh
// Railway deploy with an empty volume.
runMigrations();

const app = require("./src/app");

const server = app.listen(config.port, () => {
  console.log(`FounderOS backend running on port ${config.port} [${config.nodeEnv}]`);
  console.log(`AI provider: ${config.aiProvider}`);
  console.log(`Auth: ${config.authEnabled ? "enabled (cloud mode)" : "disabled (local mode)"}`);
  console.log(`CORS allowlist: ${config.frontendUrls.length ? config.frontendUrls.join(", ") : "(none set — dev mode allows all)"}`);
});

// ---- Graceful shutdown ----
// Railway (and most PaaS) send SIGTERM before killing a container on
// redeploy/scale-down. Without this, in-flight requests get dropped and
// the SQLite WAL file can be left in a slightly less clean state.
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[server] received ${signal}, shutting down gracefully…`);

  server.close(() => {
    console.log("[server] HTTP server closed");
    try {
      closeDb();
      console.log("[server] database connection closed");
    } catch (err) {
      console.error("[server] error closing database:", err.message);
    }
    process.exit(0);
  });

  // Safety net: force-exit if something hangs longer than 10s.
  setTimeout(() => {
    console.error("[server] forced shutdown after timeout");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  console.error("[server] unhandled rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[server] uncaught exception:", err);
  shutdown("uncaughtException");
});
