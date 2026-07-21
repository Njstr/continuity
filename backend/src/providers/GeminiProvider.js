const AIProvider = require("./AIProvider");

class GeminiProvider extends AIProvider {
  constructor({ apiKey, model }) {
    super();
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    this.apiKey = apiKey;
    this.model = model || "gemini-2.0-flash";
  }

  get name() {
    return "gemini";
  }

  async complete(system, messages, options = {}) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { maxOutputTokens: options.maxTokens || 1000 },
      }),
      signal: options.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const err = new Error(`Gemini API error ${res.status}: ${body.slice(0, 300)}`);
      err.status = res.status;
      err.retryable = res.status === 429 || res.status >= 500;
      throw err;
    }

    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    return parts.map((p) => p.text || "").join("\n");
  }
}

module.exports = GeminiProvider;
