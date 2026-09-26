const config = require("../config");
const authService = require("../services/authService");

// resolveUser — attaches req.userId to every request.
//
// AUTH_ENABLED=false (default): "local mode". The frontend sends a random
// per-install device id in X-Device-Id; that id scopes all of that
// device's data. No login required, nothing to configure.
//
// AUTH_ENABLED=true: requires a valid "Authorization: Bearer <jwt>" from
// /api/auth/login or /api/auth/register, and req.userId becomes the real
// account id — this is what enables cross-device cloud sync later.
function resolveUser(req, res, next) {
  if (!config.authEnabled) {
    // Reject rather than default to a shared "local" id: in local mode
    // this header is the ONLY thing separating one founder's data from
    // another's (no login at all). Silently bucketing every headerless
    // request into the same literal account would mean any client that
    // omits it — a stripped proxy, a raw API call, a future non-browser
    // client — transparently shares data with every other headerless
    // client. The frontend always sends a real generated id (see
    // utils/deviceId.js), so this never fires for normal app usage; it
    // only catches the cases where something upstream should be fixed
    // instead of silently working around.
    const deviceId = req.header("X-Device-Id");
    if (!deviceId) {
      return res.status(400).json({ error: true, message: "Missing X-Device-Id header." });
    }
    req.userId = deviceId;
    return next();
  }

  const authHeader = req.header("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: true, message: "Missing Authorization header." });
  }
  try {
    const payload = authService.verifyToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: true, message: "Invalid or expired token." });
  }
}

module.exports = resolveUser;
