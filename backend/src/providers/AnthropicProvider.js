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

  get supportsWebSearch() {
    return true;
  }

  get supportsTools() {
    return true;
  }

  async _rawComplete(system, messages, tools, options) {
    const body = { model: this.model, max_tokens: options.maxTokens || 1000, system, messages };
    if (tools.length) body.tools = tools;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      const err = new Error(`Anthropic API error ${res.status}: ${errBody.slice(0, 300)}`);
      err.status = res.status;
      err.retryable = res.status === 429 || res.status >= 500;
      err.code = "PROVIDER_ERROR";
      throw err;
    }
    return res.json();
  }

  async complete(system, messages, options = {}) {
    // Anthropic's own hosted search tool — Anthropic runs the search and
    // the loop itself server-side, distinct from options.tools below (our
    // own custom tools, e.g. the SearXNG-backed web_search — see
    // services/aiTools.js). The two mechanisms don't overlap in practice
    // (existing callers use one or the other, never both), but Anthropic's
    // API allows mixing hosted and custom tools in the same array, so this
    // stays additive rather than either/or.
    const hostedTools = options.enableWebSearch ? [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }] : [];
    const customTools = (options.tools || []).map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
    const tools = [...hostedTools, ...customTools];

    const citations = [];
    const seenCitationUrls = new Set();
    function collectCitations(textBlocks) {
      textBlocks.forEach((b) => {
        (b.citations || []).forEach((c) => {
          if (c.url && !seenCitationUrls.has(c.url)) {
            seenCitationUrls.add(c.url);
            citations.push({ url: c.url, title: c.title || c.url });
          }
        });
      });
    }

    let conversation = messages;
    let data = await this._rawComplete(system, conversation, tools, options);
    let rounds = 0;
    const maxRounds = options.maxToolRounds || 3;

    // Our own custom tool_use loop — distinct from Anthropic's hosted
    // server_tool_use blocks (already fully resolved server-side by the
    // time we see the response, never need surfacing here). Only enters
    // this loop when the model actually calls one of OUR tools and a
    // toolExecutor was supplied; a request with only enableWebSearch and
    // no custom tools never touches this at all.
    while (data.stop_reason === "tool_use" && options.toolExecutor && rounds < maxRounds) {
      rounds += 1;
      const textBlocks = (data.content || []).filter((b) => b.type === "text");
      collectCitations(textBlocks);
      const toolUseBlocks = (data.content || []).filter((b) => b.type === "tool_use");
      if (!toolUseBlocks.length) break; // stop_reason said tool_use but nothing to actually execute — avoid an infinite loop

      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => {
          try {
            const result = await options.toolExecutor(block.name, block.input || {});
            (result.sources || []).forEach((s) => {
              if (s.url && !seenCitationUrls.has(s.url)) {
                seenCitationUrls.add(s.url);
                citations.push({ url: s.url, title: s.title || s.url });
              }
            });
            return { type: "tool_result", tool_use_id: block.id, content: result.textForModel };
          } catch (e) {
            // A failed tool call is reported back to the MODEL as a tool
            // error (Anthropic's own convention for this), not thrown —
            // the model can then tell the founder search failed and
            // answer from what it already knows, rather than the whole
            // turn crashing because one tool call failed.
            return { type: "tool_result", tool_use_id: block.id, content: `Tool error: ${e.message}`, is_error: true };
          }
        })
      );

      conversation = [...conversation, { role: "assistant", content: data.content }, { role: "user", content: toolResults }];
      data = await this._rawComplete(system, conversation, tools, options);
    }

    const finalTextBlocks = (data.content || []).filter((b) => b.type === "text");
    const text = finalTextBlocks.map((b) => b.text).join("\n").trim();
    collectCitations(finalTextBlocks);
    // "max_tokens" means Anthropic cut the response off to fit the token
    // budget, not that the model chose to stop — this is the truncation
    // signal aiService's completion-safety wrapper acts on. "end_turn" /
    // "stop_sequence" all mean the model finished on its own; a
    // still-pending "tool_use" here means maxToolRounds was hit without a
    // final answer, which the caller's completeness check will catch and
    // continue like any other incomplete reply.
    const truncated = data.stop_reason === "max_tokens";

    return { text, citations, truncated, stopReason: data.stop_reason };
  }
}

module.exports = AnthropicProvider;
