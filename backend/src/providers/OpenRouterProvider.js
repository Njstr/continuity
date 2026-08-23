const AIProvider = require("./AIProvider");

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

  async complete(system, messages, options = {}) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options.maxTokens || 1000,
        messages: [{ role: "system", content: system }, ...messages],
      }),
      signal: options.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const err = new Error(`OpenRouter API error ${res.status}: ${body.slice(0, 300)}`);
      err.status = res.status;
      err.retryable = res.status === 429 || res.status >= 500;
      err.code = "PROVIDER_ERROR";
      throw err;
    }

    const data = await res.json();
    const choice = data?.choices?.[0];
    // "length" means the API cut the response off at max_tokens rather
    // than the model reaching a natural end — aiService's completion-
    // safety wrapper uses this to decide whether to continue the reply
    // before it's ever shown to the founder.
    return {
      text: choice?.message?.content || "",
      citations: [],
      truncated: choice?.finish_reason === "length",
      stopReason: choice?.finish_reason,
    };
  }
}

module.exports = OpenRouterProvider;
