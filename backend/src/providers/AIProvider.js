// AIProvider — the interface every LLM provider adapter implements.
// The rest of the backend only ever talks to this interface, never to a
// specific vendor SDK/API directly. To add a new provider, implement this
// class and register it in providers/index.js.

class AIProvider {
  /**
   * @param {string} system - system prompt
   * @param {Array<{role: 'user'|'assistant', content: string}>} messages
   * @param {{ json?: boolean, maxTokens?: number, enableWebSearch?: boolean }} options
   * @returns {Promise<{text: string, citations: Array<{url:string,title:string}>, truncated: boolean, stopReason: string}>}
   *   Always this shape. `truncated` is true when the provider's own
   *   finish/stop reason says the output was cut off for hitting the
   *   token limit (as opposed to a normal end-of-turn) — aiService uses
   *   this to decide whether a reply needs continuation before it's ever
   *   shown to the founder. `citations` is only ever non-empty for
   *   providers that support live web search grounding (see
   *   `supportsWebSearch`) and only when it was requested.
   */
  // eslint-disable-next-line no-unused-vars
  async complete(system, messages, options = {}) {
    throw new Error("complete() not implemented by provider");
  }

  // Whether this provider can ground responses in live web search. False by
  // default — most providers here don't have a hosted search tool, and
  // aiService falls back to telling the model plainly it has no live web
  // access rather than pretending otherwise.
  get supportsWebSearch() {
    return false;
  }

  get name() {
    return "unknown-provider";
  }
}

module.exports = AIProvider;
