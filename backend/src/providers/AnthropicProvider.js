const AIProvider = require("./AIProvider");

class AnthropicProvider extends AIProvider {
  constructor({ apiKey, model }) {
    super();
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    this.apiKey = apiKey;
    this.model = model || "claude-sonnet-4-6";
  }

  get name() {
    return "anthropic";
  }

  async complete(system, messages, options = {}) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options.maxTokens || 1000,
        system,
        messages,
      }),
      signal: options.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const err = new Error(`Anthropic API error ${res.status}: ${body.slice(0, 300)}`);
      err.status = res.status;
      err.retryable = res.status === 429 || res.status >= 500;
      throw err;
    }

    const data = await res.json();
    return (data.content || [])
      .map((b) => (b.type === "text" ? b.text : ""))
      .filter(Boolean)
      .join("\n");
  }
}

module.exports = AnthropicProvider;
