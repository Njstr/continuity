const AnthropicProvider = require("./AnthropicProvider");
const GeminiProvider = require("./GeminiProvider");
const OpenRouterProvider = require("./OpenRouterProvider");
const GroqProvider = require("./GroqProvider");

// Changing AI_PROVIDER in .env swaps the entire backend to a different
// vendor with zero frontend changes and zero route changes — every route
// only ever calls the shared aiService, which calls whatever this returns.
function createProvider(config) {
  switch ((config.aiProvider || "anthropic").toLowerCase()) {
    case "anthropic":
      return new AnthropicProvider({ apiKey: config.anthropicApiKey, model: config.anthropicModel });
    case "gemini":
      return new GeminiProvider({ apiKey: config.geminiApiKey, model: config.geminiModel });
    case "openrouter":
      return new OpenRouterProvider({ apiKey: config.openrouterApiKey, model: config.openrouterModel });
    case "groq":
      return new GroqProvider({ apiKey: config.groqApiKey, model: config.groqModel });
    case "nvidia":
      return new NvidiaProvider({
        apiKey: config.nvidiaApiKey,
        model: config.nvidiaModel,
      });
    default:
      throw new Error(`Unknown AI_PROVIDER: ${config.aiProvider}`);
  }
}

module.exports = { createProvider };
