const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const config = require("../config");
const userStore = require("../store/userStore");
const { isValidEmail } = require("../utils/validateInput");

// authService — a working but intentionally minimal auth scaffold.
//
// This exists to "prepare the architecture for cloud sync" per spec, not
// to be a hardened production auth system on its own. Users are now
// stored in SQLite (via userStore -> userRepository) rather than flat
// JSON files, and rate limiting on these endpoints is applied in
// middleware/rateLimiters.js (authLimiter). Still worth adding before
// real end-user growth: email verification and password reset flows.
//
// Local mode (AUTH_ENABLED=false, the default) bypasses all of this —
// every request is scoped to a device id instead of a logged-in account,
// so the app keeps working with zero setup.

async function register(email, password) {
  if (!isValidEmail(email) || !password || password.length < 8) {
    const err = new Error("A valid email and a password of at least 8 characters are required.");
    err.status = 400;
    throw err;
  }
  if (userStore.findByEmail(email)) {
    const err = new Error("An account with that email already exists.");
    err.status = 409;
    throw err;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = { id: crypto.randomUUID(), email, passwordHash, createdAt: new Date().toISOString() };
  userStore.create(user);
  return issueToken(user);
}

async function login(email, password) {
  const user = userStore.findByEmail(email);
  if (!user) {
    const err = new Error("Invalid email or password.");
    err.status = 401;
    throw err;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    const err = new Error("Invalid email or password.");
    err.status = 401;
    throw err;
  }
  return issueToken(user);
}

function issueToken(user) {
  const token = jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, { expiresIn: "30d" });
  return { token, user: { id: user.id, email: user.email } };
}

function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

module.exports = { register, login, verifyToken };
