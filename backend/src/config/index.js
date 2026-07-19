require("dotenv").config();
const path = require("path");

function req(name, fallback) {
  return process.env[name] ?? fallback;
}

const nodeEnv = req("NODE_ENV", "development");
const isProduction = nodeEnv === "production";

// FRONTEND_URL drives CORS. Accepts a comma-separated list so you can
// allow a preview deployment + production domain at once, e.g.
// "https://app.example.com,https://app-git-preview.vercel.app"
const frontendUrlRaw = req("FRONTEND_URL", "");
const frontendUrls = frontendUrlRaw
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const config = {
  nodeEnv,
  isProduction,
  port: parseInt(req("PORT", "8787"), 10),
  aiProvider: req("AI_PROVIDER", "nvidia"),

  anthropicApiKey: req("ANTHROPIC_API_KEY", ""),
  anthropicModel: req("ANTHROPIC_MODEL", "claude-sonnet-4-6"),

  geminiApiKey: req("GEMINI_API_KEY", ""),
  geminiModel: req("GEMINI_MODEL", "gemini-2.0-flash"),

  openrouterApiKey: req("OPENROUTER_API_KEY", ""),
  openrouterModel: req("OPENROUTER_MODEL", "anthropic/claude-sonnet-5"),

  nvidiaApiKey: req("NVIDIA_API_KEY", ""),
  nvidiaModel: req("NVIDIA_MODEL", "google/diffusiongemma-26b-a4b-it"),

  groqApiKey: req("GROQ_API_KEY", ""),
  groqModel: req("GROQ_MODEL", "llama-3.3-70b-versatile"),

  jwtSecret: req("JWT_SECRET", "dev-secret-change-me"),
  authEnabled: req("AUTH_ENABLED", "false") === "true",
  analyticsEnabled: req("ANALYTICS_ENABLED", "true") === "true",

  // Simple shared-secret gate on GET /api/feedback, since there's no real
  // admin role system yet. Not set = the endpoint is closed entirely.
  adminToken: req("ADMIN_TOKEN", ""),
  requestTimeoutMs: parseInt(req("REQUEST_TIMEOUT_MS", "30000"), 10),

  frontendUrls, // [] means "no explicit allowlist"
  dataDir: req("DATA_DIR", path.join(__dirname, "../../data")),
};

// ---- Fail fast on unsafe production configuration ----
// Better to crash at boot with a clear message than to silently run
// insecurely in front of real users.
function validate() {
  const problems = [];

  if (isProduction && !config.openrouterApiKey && config.aiProvider === "openrouter") {
    problems.push("AI_PROVIDER is 'openrouter' but OPENROUTER_API_KEY is not set.");
  }
  if (isProduction && !config.nvidiaApiKey && config.aiProvider === "nvidia") {
  problems.push("AI_PROVIDER is 'nvidia' but NVIDIA_API_KEY is not set.");
  }
  if (isProduction && config.authEnabled && config.jwtSecret === "dev-secret-change-me") {
    problems.push("AUTH_ENABLED is true but JWT_SECRET is still the default dev value — set a real secret.");
  }
  if (isProduction && config.frontendUrls.length === 0) {
    problems.push("FRONTEND_URL is not set — CORS will reject your deployed frontend. Set it to your Vercel URL.");
  }

  if (problems.length) {
    console.error("\n[config] Refusing to start with unsafe production configuration:");
    problems.forEach((p) => console.error("  - " + p));
    console.error("");
    process.exit(1);
  }
}

if (isProduction) validate();

module.exports = config;
