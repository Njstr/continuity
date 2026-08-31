// openAiCompatibleTools.js — the OpenAI-style function-calling loop
// shared by OpenRouterProvider, GroqProvider, and NvidiaProvider. Those
// three APIs all speak the exact same /chat/completions + tools/tool_calls
// wire format (just different base URLs, auth headers, and models), so
// this loop is written once here instead of being copy-pasted three
// times — each provider stays a thin adapter that supplies its own
// endpoint/headers/model and calls this.
//
// See AIProvider.js for the full tool-calling contract this implements.

async function completeWithTools({ endpoint, headers, model, providerName, extraBody }, system, messages, options = {}) {
  const tools = (options.tools || []).map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

  async function rawComplete(msgs) {
    const body = {
      model,
      messages: [{ role: "system", content: system }, ...msgs],
      max_tokens: options.maxTokens || 1000,
      ...(extraBody || {}),
    };
    if (tools.length) body.tools = tools;

    const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body), signal: options.signal });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      const err = new Error(`${providerName} API error ${res.status}: ${bodyText.slice(0, 300)}`);
      err.status = res.status;
      err.retryable = res.status === 429 || res.status >= 500;
      err.code = "PROVIDER_ERROR";
      throw err;
    }
    return res.json();
  }

  const citations = [];
  const seenUrls = new Set();
  function collectSources(sources) {
    (sources || []).forEach((s) => {
      if (s.url && !seenUrls.has(s.url)) {
        seenUrls.add(s.url);
        citations.push({ url: s.url, title: s.title || s.url });
      }
    });
  }

  let conversation = messages;
  let data = await rawComplete(conversation);
  let rounds = 0;
  const maxRounds = options.maxToolRounds || 3;

  while (data?.choices?.[0]?.finish_reason === "tool_calls" && options.toolExecutor && rounds < maxRounds) {
    rounds += 1;
    const choice = data.choices[0];
    const toolCalls = choice.message?.tool_calls || [];
    if (!toolCalls.length) break; // finish_reason said tool_calls but nothing to execute — avoid an infinite loop

    const toolResultMessages = await Promise.all(
      toolCalls.map(async (tc) => {
        let args = {};
        try {
          args = JSON.parse(tc.function?.arguments || "{}");
        } catch {
          // Malformed arguments from the model — treat as empty rather
          // than crashing the whole turn; the tool executor's own
          // validation will report back what's actually missing.
        }
        try {
          const result = await options.toolExecutor(tc.function.name, args);
          collectSources(result.sources);
          return { role: "tool", tool_call_id: tc.id, content: result.textForModel };
        } catch (e) {
          // A failed tool call is reported back to the MODEL as a tool
          // result describing the error, not thrown — the model can then
          // tell the founder search failed and answer from what it
          // already knows, rather than the whole turn crashing.
          return { role: "tool", tool_call_id: tc.id, content: `Tool error: ${e.message}` };
        }
      })
    );

    conversation = [...conversation, choice.message, ...toolResultMessages];
    data = await rawComplete(conversation);
  }

  const finalChoice = data?.choices?.[0];
  return {
    text: finalChoice?.message?.content || "",
    citations,
    // "length" means the API cut the response off at max_tokens rather
    // than the model reaching a natural end — aiService's completion-
    // safety wrapper uses this to decide whether to continue the reply
    // before it's ever shown to the founder. A still-pending "tool_calls"
    // here means maxToolRounds was hit without a final answer, which the
    // caller's completeness check will catch and continue like any other
    // incomplete reply.
    truncated: finalChoice?.finish_reason === "length",
    stopReason: finalChoice?.finish_reason,
  };
}

module.exports = { completeWithTools };
