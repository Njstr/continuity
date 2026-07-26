const AIProvider = require("./AIProvider");

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

  async complete(system, messages, options = {}) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
      const err = new Error(`Groq API error ${res.status}: ${body.slice(0, 300)}`);
      err.status = res.status;
      err.retryable = res.status === 429 || res.status >= 500;
      throw err;
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content || "";
  }
}

module.exports = GroqProvider;
