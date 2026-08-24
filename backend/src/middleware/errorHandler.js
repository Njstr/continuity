const config = require("../config");

// errorHandler — the last stop for every error in the app. Converts
// internal errors (provider failures, timeouts, validation errors, bad
// client input) into consistent, friendly JSON the frontend can render
// without special-casing each failure mode. Nothing that looks like a
// stack trace, raw JSON, a database error, or a Node internals message
// should ever reach res.json() here — detailed information stays in
// server logs only (see console.error below).

// Mirrors the frontend's own final-catch-all pattern (see
// frontend/src/utils/errorTranslator.js) — a second, independent layer
// that guards against a raw technical-looking message slipping through
// even from a spot that set err.status itself.
const TECHNICAL_LOOKING = /\{.*"(error|type|message)"|^\s*at\s|Error:|ECONNREFUSED|ENOTFOUND|SQLITE|constraint failed|Cannot read propert|is not a function|is not defined|undefined is not|stack trace/is;

function classify(err) {
  // Malformed JSON in the request body (body-parser sets err.type)
  if (err.type === "entity.parse.failed") {
    return { status: 400, message: "That request wasn't formatted correctly. Please try again." };
  }
  if (err.code === "TIMEOUT") return { status: 504, message: "FounderOS took too long to respond. Please try again." };
  if (err.code === "NO_API_KEY") return { status: 500, message: "FounderOS isn't fully set up yet — try again shortly." };
  if (err.code === "AI_JSON_PARSE_ERROR") return { status: 502, message: "FounderOS couldn't quite finish that response. Please try again." };

  // Any error thrown by an AI provider (Anthropic/OpenAI/Gemini/Groq/etc)
  // gets sanitized here regardless of its HTTP status — this used to only
  // catch 429 and 5xx, which meant a 401 (misconfigured API key) or other
  // 4xx from the provider fell through to the generic branch below and
  // leaked the raw provider error body (including JSON) straight to the
  // founder. The founder never needs to know it was a 401 vs a 500 vs a
  // malformed request to the provider, or that a "provider" is involved
  // at all — all of that is an operator problem, visible in server logs,
  // never in the chat UI.
  if (err.code === "PROVIDER_ERROR") {
    if (err.status === 429) return { status: 429, message: "FounderOS is getting a lot of requests right now. Please try again in a moment." };
    return { status: 502, message: "FounderOS is having trouble responding right now. Please try again in a moment." };
  }

  if (err.status === 429) return { status: 429, message: "FounderOS is getting a lot of requests right now. Please try again in a moment." };
  if (err.status && err.status >= 500) return { status: 502, message: "FounderOS is having trouble responding right now. Please try again." };

  // A controlled 4xx from our own route code (e.g. "profile is required")
  // — these are always deliberately-written, safe, user-facing strings at
  // every call site (see routes/*.js), so it's fine to pass them through
  // as-is. Still guarded by the technical-looking check below in case
  // that ever stops being true somewhere.
  if (err.status && err.status < 500 && err.message && !TECHNICAL_LOOKING.test(err.message)) {
    return { status: err.status, message: err.message };
  }

  // Genuinely unexpected error (a bug, a database failure, a thrown
  // exception with no status set at all) — never forward err.message
  // here. It could be anything: a SQL constraint message, a stack-trace
  // string, a TypeError naming an internal variable. Log the real thing
  // server-side (see errorHandler below) and tell the founder something
  // safe and generic instead.
  return { status: err.status && err.status < 500 ? err.status : 500, message: "Something went wrong on our end. Please try again." };
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const { status, message } = classify(err);
  if (status >= 500 || TECHNICAL_LOOKING.test(err.message || "")) {
    console.error(`[error] ${req.method} ${req.originalUrl}:`, config.isProduction ? err.message : err);
  }
  res.status(status).json({ error: true, message, code: err.code || null });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: true, message: "That page or request doesn't exist." });
}

module.exports = { errorHandler, notFoundHandler };
