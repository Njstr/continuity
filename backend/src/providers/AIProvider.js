// AIProvider — the interface every LLM provider adapter implements.
// The rest of the backend only ever talks to this interface, never to a
// specific vendor SDK/API directly. To add a new provider, implement this
// class and register it in providers/index.js.

class AIProvider {
  /**
   * @param {string} system - system prompt
   * @param {Array<{role: 'user'|'assistant', content: string}>} messages
   * @param {{ json?: boolean, maxTokens?: number, enableWebSearch?: boolean, tools?: Array<{name: string, description: string, parameters: object}>, toolExecutor?: (name: string, args: object) => Promise<{textForModel: string, sources?: Array<{url:string,title:string}>}>, maxToolRounds?: number }} options
   * @returns {Promise<{text: string, citations: Array<{url:string,title:string}>, truncated: boolean, stopReason: string}>}
   *   Always this shape. `truncated` is true when the provider's own
   *   finish/stop reason says the output was cut off for hitting the
   *   token limit (as opposed to a normal end-of-turn) — aiService uses
   *   this to decide whether a reply needs continuation before it's ever
   *   shown to the founder.
   *
   *   Tool-calling contract (see `supportsTools`): when `options.tools` is
   *   passed along with `options.toolExecutor`, a provider that supports
   *   tools runs its OWN native tool-use loop internally — call the
   *   model, and if it requests a tool, call `toolExecutor(name, args)`,
   *   feed the result back in whatever wire format that provider's API
   *   expects (Anthropic: tool_use/tool_result content blocks; OpenAI-
   *   compatible APIs: tool_calls + role:"tool" messages), and repeat
   *   until the model produces a final text answer or `maxToolRounds` is
   *   reached (default 3 — "don't blindly perform dozens of searches").
   *   This keeps every provider's specific wire format fully internal to
   *   that provider; aiService.js never sees a raw tool_use block from
   *   any vendor. `toolExecutor` returns `sources` alongside the text
   *   result it hands back to the model — those accumulate into the same
   *   `citations` array a hosted web-search grounding call would
   *   populate, so callers only ever handle one "real sources used"
   *   field regardless of which mechanism produced them.
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

  // Whether this provider supports the generic tool-calling contract
  // described above. False by default — providers without this run the
  // model with no tools available, and aiService simply doesn't offer the
  // web_search tool for that turn rather than erroring.
  get supportsTools() {
    return false;
  }

  get name() {
    return "unknown-provider";
  }
}

module.exports = AIProvider;
