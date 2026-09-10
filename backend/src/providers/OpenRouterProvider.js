const AIProvider = require("./AIProvider");
const { completeWithTools } = require("./openAiCompatibleTools");

class OpenRouterProvider extends AIProvider {
  constructor({ apiKey, model }) {
    super();
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
    this.apiKey = apiKey;
    this.model = model || "anthropic/claude-sonnet-5";
  }

  get name() {
    return "openrouter";
  }

  get supportsTools() {
    return true;
  }

  async complete(system, messages, options = {}) {
    return completeWithTools(
      {
        endpoint: "https://openrouter.ai/api/v1/chat/completions",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        model: this.model,
        providerName: "OpenRouter",
      },
      system,
      messages,
      options
    );
  }
}

module.exports = OpenRouterProvider;
