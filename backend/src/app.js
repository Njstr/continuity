const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const config = require("./config");
const resolveUser = require("./middleware/auth");
const requestLogger = require("./middleware/requestLogger");
const { apiLimiter, authLimiter } = require("./middleware/rateLimiters");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const authRoutes = require("./routes/auth");
const apiRoutes = require("./routes");
const aiService = require("./services/aiService");
const { db } = require("./db/connection");

const app = express();

// Both Vercel and Railway sit their apps behind a reverse proxy — this
// makes req.ip / rate limiting / secure cookies behave correctly instead
// of seeing the proxy's IP for every request.
app.set("trust proxy", 1);

app.use(helmet());
app.use(compression());
app.use(requestLogger());

// ---- CORS ----
// In production, only origins in FRONTEND_URL are allowed. In
// development, no FRONTEND_URL means "allow anything" so local frontend
// dev work never gets blocked by a CORS misconfiguration.
const corsOptions = {
  origin(origin, callback) {
    if (!config.isProduction) return callback(null, true);
    if (!origin) return callback(null, true); // same-origin / server-to-server / curl
    if (config.frontendUrls.includes(origin)) return callback(null, true);
    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
};
app.use(cors(corsOptions));

app.use(express.json({ limit: "1mb" }));

// ---- Health check (Railway healthcheckPath) ----
app.get("/health", (req, res) => {
  let dbOk = true;
  try {
    db.prepare("SELECT 1").get();
  } catch {
    dbOk = false;
  }
  res.json({
    status: dbOk ? "ok" : "degraded",
    uptimeSeconds: Math.round(process.uptime()),
    provider: aiService.providerName,
    authEnabled: config.authEnabled,
    db: dbOk ? "connected" : "unavailable",
    env: config.nodeEnv,
  });
});
// Back-compat alias for the earlier prototype's health path.
app.get("/health-check", (req, res) => res.redirect(307, "/health"));

app.use("/api", apiLimiter);

// Auth endpoints are reachable without a token (you need them to get one)
// but are rate-limited more strictly against brute force.
app.use("/api/auth", authLimiter, authRoutes);

// Everything else requires a resolved user — either a device id (local
// mode, default) or a verified JWT (AUTH_ENABLED=true).
app.use("/api", resolveUser, apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
