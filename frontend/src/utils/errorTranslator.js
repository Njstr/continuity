// Centralized error translator. The backend already sanitizes AI-provider
// errors before they leave the server (see backend/src/middleware/
// errorHandler.js) — this is the second layer: phrases network-level
// failures (offline, timeout) naturally, and acts as a final catch-all so
// nothing that looks like raw JSON, a stack trace, or an HTTP status code
// can ever render as a chat bubble, regardless of where it came from.

const TECHNICAL_LOOKING = /\{.*"(error|type|message)"|^\s*at\s|Error:|status\s*\d{3}|stack trace/is;

const CODE_MESSAGES = {
  OFFLINE: "Your internet connection appears to have been interrupted. Reconnect and try again.",
  TIMEOUT: "That took longer than expected. Please try again.",
  NETWORK_ERROR: "I couldn't reach the server just now. Check your connection and try again.",
};

export function toFriendlyError(err) {
  if (!err) return "Something went wrong. Please try again.";

  const code = err.code;
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];

  const status = err.status;
  if (status === 429) return "I'm getting a lot of requests right now — give it a moment and try again.";
  if (status === 401 || status === 403) return "That action isn't available right now. Try again shortly.";
  if (status >= 500) return "FounderOS is having trouble responding right now. Please try again in a moment.";

  const message = typeof err.message === "string" ? err.message : "";

  // File-specific phrasing, matched by content since these can come from
  // several different upload/extraction call sites.
  if (/scanned/i.test(message)) return "I couldn't read this PDF because it appears to be scanned rather than text-based.";
  if (/unsupported file/i.test(message)) return "This file format isn't supported yet — try a PDF, DOCX, TXT, or Markdown file.";
  if (/password.protected|corrupt/i.test(message)) return "I couldn't open this file — it may be corrupted or password-protected.";

  // Final catch-all: if it still looks technical (raw JSON, a stack
  // trace, an HTTP status buried in text), never show it verbatim.
  if (!message || TECHNICAL_LOOKING.test(message)) {
    return "Something went wrong on my end. Please try again.";
  }
  return message;
}
