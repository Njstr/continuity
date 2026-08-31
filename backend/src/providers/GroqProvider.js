const AIProvider = require("./AIProvider");
const { completeWithTools } = require("./openAiCompatibleTools");

class GroqProvider extends AIProvider {
  constructor({ apiKey, model }) {
    super();
    if (!apiKey) throw new Error("GROQ_API_KEY is not set");
    this.apiKey = apiKey;
    this.model = model || "llama-3.3-70b-versatile";
  }

  get name() {
    return "groq";
  }

  get supportsTools() {
    return true;
  }

  async complete(system, messages, options = {}) {
    return completeWithTools(
      {
        endpoint: "https://api.groq.com/openai/v1/chat/completions",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        model: this.model,
        providerName: "Groq",
      },
      system,
      messages,
      options
    );
  }
}

module.exports = GroqProvider;
