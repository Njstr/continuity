const config = require("../config");

// errorHandler — the last stop for every error in the app. Converts
// internal errors (provider failures, timeouts, validation errors, bad
// client input) into consistent, friendly JSON the frontend can render
// without special-casing each failure mode.

function classify(err) {
  // Malformed JSON in the request body (body-parser sets err.type)
  if (err.type === "entity.parse.failed") {
    return { status: 400, message: "Request body is not valid JSON." };
  }
  if (err.code === "TIMEOUT") return { status: 504, message: "The AI took too long to respond. Please try again." };
  if (err.code === "NO_API_KEY") return { status: 500, message: "The AI service isn't configured yet — try again shortly." };
  if (err.code === "AI_JSON_PARSE_ERROR") return { status: 502, message: "The AI returned something we couldn't parse. Please try again." };

  // Any error thrown by an AI provider (Anthropic/OpenAI/Gemini/Groq/etc)
  // gets sanitized here regardless of its HTTP status — this used to only
  // catch 429 and 5xx, which meant a 401 (misconfigured API key) or other
  // 4xx from the provider fell through to the generic branch below and
  // leaked the raw provider error body (including JSON) straight to the
  // founder. The founder never needs to know it was a 401 vs a 500 vs a
  // malformed request to the provider — all of that is an operator
  // problem, visible in server logs, never in the chat UI.
  if (err.code === "PROVIDER_ERROR") {
    if (err.status === 429) return { status: 429, message: "The AI provider is rate-limiting us right now. Please try again in a moment." };
    return { status: 502, message: "The AI service is temporarily unavailable. Please try again in a moment." };
  }

  if (err.status === 429) return { status: 429, message: "The AI provider is rate-limiting us right now. Please try again in a moment." };
  if (err.status && err.status >= 500) return { status: 502, message: "The AI provider had an error. Please try again." };
  return { status: err.status && err.status < 500 ? err.status : 500, message: err.message || "Something went wrong." };
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const { status, message } = classify(err);
  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}:`, config.isProduction ? err.message : err);
  }
  res.status(status).json({ error: true, message, code: err.code || null });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: true, message: `No route ${req.method} ${req.originalUrl}` });
}

module.exports = { errorHandler, notFoundHandler };
