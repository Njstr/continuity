// AIProvider — the interface every LLM provider adapter implements.
// The rest of the backend only ever talks to this interface, never to a
// specific vendor SDK/API directly. To add a new provider, implement this
// class and register it in providers/index.js.

class AIProvider {
  /**
   * @param {string} system - system prompt
   * @param {Array<{role: 'user'|'assistant', content: string}>} messages
   * @param {{ json?: boolean, maxTokens?: number }} options
   * @returns {Promise<string>} raw text response from the model
   */
  // eslint-disable-next-line no-unused-vars
  async complete(system, messages, options = {}) {
    throw new Error("complete() not implemented by provider");
  }

  get name() {
    return "unknown-provider";
  }
}

module.exports = AIProvider;
