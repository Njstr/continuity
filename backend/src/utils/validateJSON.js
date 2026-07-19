// Extracts a JSON object from a raw model response (models sometimes wrap
// JSON in prose or code fences despite instructions), then validates it
// against a minimal shape descriptor. If invalid, the caller can ask the
// model to repair it once before giving up.

function extractJSON(text) {
  const clean = String(text).replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in response");
  }
  return JSON.parse(clean.slice(start, end + 1));
}

// shape: { requiredKeys: string[] } — intentionally lightweight (not a full
// JSON-schema engine) so it stays fast and dependency-free. Extend here if
// stricter per-field validation is needed later.
function validateShape(obj, shape = {}) {
  const missing = (shape.requiredKeys || []).filter((k) => !(k in obj));
  return { valid: missing.length === 0, missing };
}

/**
 * Parses + validates a model's raw text response. If parsing/validation
 * fails, asks the provider once to repair its own output before throwing.
 */
async function parseAndValidate(provider, rawText, { shape, system, messages } = {}) {
  try {
    const parsed = extractJSON(rawText);
    const { valid, missing } = validateShape(parsed, shape);
    if (valid) return parsed;
    throw new Error(`Missing required keys: ${missing.join(", ")}`);
  } catch (firstErr) {
    if (!system || !messages) {
      firstErr.code = "AI_JSON_PARSE_ERROR";
      throw firstErr;
    }
    // one repair attempt: show the model its own broken output and ask it to fix it
    const repairPrompt = [
      ...messages,
      { role: "assistant", content: rawText },
      {
        role: "user",
        content: `That was not valid JSON matching the required shape (error: ${firstErr.message}). Reply with ONLY the corrected JSON object, nothing else.`,
      },
    ];
    try {
      const repaired = await provider.complete(system, repairPrompt, { maxTokens: 1000 });
      const parsed = extractJSON(repaired);
      const { valid, missing } = validateShape(parsed, shape);
      if (!valid) throw new Error(`Repair attempt still missing keys: ${missing.join(", ")}`);
      return parsed;
    } catch (repairErr) {
      repairErr.code = "AI_JSON_PARSE_ERROR";
      throw repairErr;
    }
  }
}

module.exports = { extractJSON, validateShape, parseAndValidate };
