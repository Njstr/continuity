const AIProvider = require("./AIProvider");

class NvidiaProvider extends AIProvider {
  constructor({ apiKey, model }) {
    super();
    this.apiKey = apiKey;
    this.model = model;
  }

  get name() {
    return "nvidia";
  }

  async complete(system, messages, options = {}) {
    const res = await fetch(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: system },
            ...messages,
          ],
          max_tokens: options.maxTokens || 1000,
          temperature: 0.7,
        }),
        signal: options.signal,
      }
    );

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const data = await res.json();
    return data.choices[0].message.content;
  }
}

module.exports = NvidiaProvider;