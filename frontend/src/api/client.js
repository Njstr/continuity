import { getDeviceId } from "../utils/deviceId";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";

if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  // This build is running in production but was never told where the
  // backend lives — it'll fall back to localhost and fail every request.
  // Loud console warning beats a silent, confusing failure.
  // eslint-disable-next-line no-console
  console.warn(
    "[Founder Companion] VITE_API_URL was not set at build time — the app is pointing at localhost:8787 and will not work. Set VITE_API_URL in your Vercel project settings and redeploy."
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

export const api = {
  // ---- AI generation ----
  onboard: (answers) => request("/api/onboarding", { body: { answers } }),
  mission: (profile, missions, businessState) => request("/api/mission", { body: { profile, missions, businessState } }),
  missionOutcome: (title, status, reason) => request("/api/mission/complete", { body: { title, status, reason } }),
  decision: (profile, question, pastDecisions) => request("/api/decision", { body: { profile, question, pastDecisions } }),
  health: (profile, metrics, missions) => request("/api/health", { body: { profile, metrics, missions } }),
  metricsRecommendation: (profile, metrics) => request("/api/metrics", { body: { profile, metrics } }),
  chat: (profile, missions, history, mode, scenario, metrics) => request("/api/chat", { body: { profile, missions, history, mode, scenario, metrics } }),
  generateChatTitle: (messages) => request("/api/chat/title", { body: { messages } }),

  // ---- Chat history (database-backed, same trust boundary as feedback) ----
  getConversations: () => request("/api/conversations", { method: "GET" }),
  putConversations: (conversations) => request("/api/conversations", { method: "PUT", body: { conversations } }).catch(() => {}),
  weeklyReview: (profile, answers, missions, businessMetrics) => request("/api/weekly-review", { body: { profile, answers, missions, businessMetrics } }),
  patterns: (profile, missions, decisions, metricsHistory) =>
    request("/api/patterns", { body: { profile, missions, decisions, metricsHistory } }),
  getPatterns: () => request("/api/patterns", { method: "GET" }),
  businessAdvice: (profile, businessState, metrics) => request("/api/business-advice", { body: { profile, businessState, metrics } }),
  missionImpact: (profile, businessState, mission) => request("/api/mission-impact", { body: { profile, businessState, mission } }),
  founderBrief: (profile, businessState, missions, decisions, healthLatest, patterns) =>
    request("/api/founder-brief", { body: { profile, businessState, missions, decisions, healthLatest, patterns } }),
  lesson: (profile, businessState) => request("/api/lesson", { body: { profile, businessState } }),
  predict: (profile, businessState, metrics, missions) => request("/api/prediction", { body: { profile, businessState, metrics, missions } }),
  simulateDecision: (companyProfile, metrics, decision, history, decisionContext) =>
    request("/api/decision-simulation", { body: { companyProfile, metrics, decision, history, decisionContext } }),
  checkReadiness: (companyProfile, metrics, decision) =>
    request("/api/decision-readiness", { body: { companyProfile, metrics, decision } }),
  learningSummary: (decision, accuracyResults, feedbackText, feedbackDifference, feedbackRating) =>
    request("/api/learning-summary", { body: { decision, accuracyResults, feedbackText, feedbackDifference, feedbackRating } }),
  startupHealth: (companyProfile, metrics) => request("/api/startup-health", { body: { companyProfile, metrics } }),
  founderAdvisor: (companyProfile, metrics, decisions, healthLatest) =>
    request("/api/advisor", { body: { companyProfile, metrics, decisions, healthLatest } }),

  // ---- Memory ----
  getMemory: () => request("/api/memory", { method: "GET" }),
  addMemory: (type, text) => request("/api/memory", { body: { type, text } }),

  // ---- Timeline ----
  logEvent: (type, title, meta) => request("/api/timeline", { body: { type, title, meta } }),
  getTimeline: () => request("/api/timeline", { method: "GET" }),

  // ---- Auth (only relevant if the backend has AUTH_ENABLED=true) ----
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
