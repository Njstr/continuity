const AIProvider = require("./AIProvider");
const { completeWithTools } = require("./openAiCompatibleTools");

class NvidiaProvider extends AIProvider {
  constructor({ apiKey, model }) {
    super();
    this.apiKey = apiKey;
    this.model = model;
  }

  get name() {
    return "nvidia";
  }

  get supportsTools() {
    return true;
  }

  async complete(system, messages, options = {}) {
    return completeWithTools(
      {
        endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        model: this.model,
        providerName: "Nvidia",
        extraBody: { temperature: 0.7 },
      },
      system,
      messages,
      options
    );
  }
}

module.exports = NvidiaProvider;
