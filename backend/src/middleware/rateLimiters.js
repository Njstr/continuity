const rateLimit = require("express-rate-limit");

// Keyed by resolved userId when available (set by the auth middleware,
// which runs before these on /api/*) so one device/account can't starve
// others behind a shared IP (NAT, campus wifi, etc.); falls back to IP.
function keyByUser(req) {
  return req.userId || req.ip;
}

const jsonRateLimitResponse = (req, res) => {
  res.status(429).json({ error: true, message: "Too many requests. Please slow down and try again shortly.", code: "RATE_LIMITED" });
};

// General API traffic.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUser,
  handler: jsonRateLimitResponse,
});

// AI-generation endpoints cost real money per call — a tighter limit here
// protects the OpenRouter bill from a runaway client or abuse, separate
// from the general browsing/reading limit above.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUser,
  handler: jsonRateLimitResponse,
});

// Auth endpoints: strict, IP-based (no userId yet at login/register time),
// to slow down credential-stuffing / brute force attempts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitResponse,
});

module.exports = { apiLimiter, aiLimiter, authLimiter };
