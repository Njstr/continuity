import { getDeviceId } from "../utils/deviceId";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";

if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  // This build is running in production but was never told where the
  // backend lives — it'll fall back to localhost and fail every request.
  // Loud console warning beats a silent, confusing failure.
  // eslint-disable-next-line no-console
  console.warn(
    "[FounderOS] VITE_API_URL was not set at build time — the app is pointing at localhost:8787 and will not work. Set VITE_API_URL in your Vercel project settings and redeploy."
  );
}

const REQUEST_TIMEOUT_MS = 30000;

class ApiError extends Error {
  constructor(message, { code, status, offline } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.offline = offline;
  }
}

function authHeaders() {
  const token = localStorage.getItem("fc:authToken");
  const headers = { "Content-Type": "application/json", "X-Device-Id": getDeviceId() };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function withTimeout(fn, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

// Single retry for transient network failures — the backend already does
// its own retry against the AI provider, this covers the frontend↔backend
// hop itself (e.g. a flaky mobile connection).
async function request(path, { method = "POST", body, retryOnce = true } = {}) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new ApiError("You're offline — reconnect and try again.", { offline: true, code: "OFFLINE" });
  }

  const attempt = async () => {
    try {
      const res = await withTimeout(
        (signal) =>
          fetch(`${BASE_URL}${path}`, {
            method,
            headers: authHeaders(),
            body: body ? JSON.stringify(body) : undefined,
            signal,
          }),
        REQUEST_TIMEOUT_MS
      );

      if (!res.ok) {
        let message = `Request failed (${res.status})`;
        let code = null;
        try {
          const data = await res.json();
          message = data.message || message;
          code = data.code || null;
        } catch {
          /* non-JSON error body */
        }
        throw new ApiError(message, { status: res.status, code });
      }
      return res.json();
    } catch (err) {
      if (err.name === "AbortError") {
        throw new ApiError("That took too long to respond. Please try again.", { code: "TIMEOUT" });
      }
      if (err instanceof ApiError) throw err;
      // fetch network failure (server down, no connectivity, CORS, etc.)
      throw new ApiError("Couldn't reach the server. Is the backend running?", { code: "NETWORK_ERROR" });
    }
  };

  try {
    return await attempt();
  } catch (err) {
    const retryable = retryOnce && (err.code === "TIMEOUT" || err.code === "NETWORK_ERROR" || err.status >= 500);
    if (!retryable) throw err;
    return request(path, { method, body, retryOnce: false });
  }
}

// Document upload uses multipart/form-data (not JSON), so it can't go
// through request() — same error handling and auth headers, different
// transport. No retry-on-failure here: retrying a multi-MB upload
// silently on a flaky connection is more likely to duplicate documents
// than to help.
async function uploadFiles(path, formData) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new ApiError("You're offline — reconnect and try again.", { offline: true, code: "OFFLINE" });
  }
  const token = localStorage.getItem("fc:authToken");
  const headers = { "X-Device-Id": getDeviceId() };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await withTimeout(
      (signal) => fetch(`${BASE_URL}${path}`, { method: "POST", headers, body: formData, signal }),
      60000 // uploads/extraction can legitimately take longer than a chat call
    );
    if (!res.ok) {
      let message = `Upload failed (${res.status})`;
      try {
        const data = await res.json();
        message = data.message || message;
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(message, { status: res.status });
    }
    return res.json();
  } catch (err) {
    if (err.name === "AbortError") throw new ApiError("Upload took too long. Try a smaller file or check your connection.", { code: "TIMEOUT" });
    if (err instanceof ApiError) throw err;
    throw new ApiError("Couldn't reach the server. Is the backend running?", { code: "NETWORK_ERROR" });
  }
}

export const api = {
  // ---- AI generation ----
  chat: (profile, missions, history, mode, scenario, metrics, documentIds) =>
    request("/api/chat", { body: { profile, missions, history, mode, scenario, metrics, documentIds } }),
  generateChatTitle: (messages) => request("/api/chat/title", { body: { messages } }),

  // ---- Documents (in-chat upload) ----
  uploadDocuments: (files, conversationId) => {
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    if (conversationId) formData.append("conversationId", conversationId);
    return uploadFiles("/api/documents/upload", formData);
  },
  setDocumentPersistent: (id, persistent) => request(`/api/documents/${id}`, { method: "PATCH", body: { persistent } }),
  extractDocumentMetrics: (id, metricFields) => request(`/api/documents/${id}/extract-metrics`, { body: { metricFields } }),
  deleteDocument: (id) => request(`/api/documents/${id}`, { method: "DELETE" }),
  getPersistentDocuments: () => request("/api/documents", { method: "GET" }),
  getConversations: () => request("/api/conversations", { method: "GET" }),

  // ---- Decision lifecycle ----
  simulateDecisionV2: (profile, metrics, decisionText, decisionContext) =>
    request("/api/decisions/simulate", { body: { profile, metrics, decisionText, decisionContext } }),
  recordDecision: (payload) => request("/api/decisions", { body: payload }),
  listDecisionsV2: () => request("/api/decisions", { method: "GET" }),
  getDueForCheckIn: () => request("/api/decisions/due", { method: "GET" }),
  recordDecisionOutcome: (decisionId, actualUpdate, actualMetrics) =>
    request(`/api/decisions/${decisionId}/outcome`, { body: { actualUpdate, actualMetrics } }),
  listLearnedPatterns: () => request("/api/decisions/patterns", { method: "GET" }),
  extractMetricsFromText: (text, metricFields) => request("/api/metrics/extract", { body: { text, metricFields } }),
  translate: (text, targetLanguage) => request("/api/translate", { body: { text, targetLanguage } }),
  putConversations: (conversations) => request("/api/conversations", { method: "PUT", body: { conversations } }).catch(() => {}),

  compareGrowthOptions: (profile, metrics, question, history) => request("/api/decision-compare", { body: { profile, metrics, question, history } }),
  validateIdea: (profile, idea, history) => request("/api/validate-idea", { body: { profile, idea, history } }),
  geoReadinessCheck: (profile, history) => request("/api/geo-readiness", { body: { profile, history } }),

  // ---- Auth (only relevant if the backend has AUTH_ENABLED=true — see
  // config/index.js. Not currently wired into the shipped, device-ID-based
  // product; kept here as the matching frontend half of that optional,
  // deliberately-not-yet-activated account mode.) ----
  authStatus: () => request("/api/auth/status", { method: "GET" }),
  register: (email, password) => request("/api/auth/register", { body: { email, password } }),
  login: (email, password) => request("/api/auth/login", { body: { email, password } }),

  // ---- Feedback ----
  submitFeedback: (entry) => request("/api/feedback", { body: entry }).catch(() => {}),
  getMyFeedback: (limit) => request(`/api/feedback/mine?limit=${limit || 200}`, { method: "GET" }),

  // ---- Analytics ----
  track: (event, props) => request("/api/analytics/track", { body: { event, props } }).catch(() => {}),
};

export { ApiError };
