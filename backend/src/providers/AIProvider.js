// AIProvider — the interface every LLM provider adapter implements.
// The rest of the backend only ever talks to this interface, never to a
// specific vendor SDK/API directly. To add a new provider, implement this
// class and register it in providers/index.js.

class AIProvider {
  /**
   * @param {string} system - system prompt
   * @param {Array<{role: 'user'|'assistant', content: string}>} messages
   * @param {{ json?: boolean, maxTokens?: number, enableWebSearch?: boolean }} options
   * @returns {Promise<string|{text: string, citations: Array<{url:string,title:string}>}>}
   *   Plain string normally. Providers that support live web search grounding
   *   (see `supportsWebSearch`) may return {text, citations} instead when
   *   `enableWebSearch` was requested — real citations from the search
   *   results, never invented. aiService handles both return shapes.
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
