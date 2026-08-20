const config = require("../config");
const { createProvider } = require("../providers");
const { retry, withTimeout } = require("../utils/retry");
const { parseAndValidate } = require("../utils/validateJSON");
const memoryService = require("./memoryService");
const executionPatternRepo = require("../repositories/executionPatternRepository");
const documentRetrieval = require("../utils/documentRetrieval");

// aiService — the single choke point every route calls through.
//
// generateMission(), generateDecision(), generateHealth(), etc. all share
// this one client instead of duplicating provider calls, retry logic,
// timeout handling, and JSON validation in every route file.

// ---- Response Completion & Continuity: streaming note ----
// This backend does not use streaming responses anywhere — every provider
// call in this file is a single non-streaming request/response (see
// providers/*.js). That means the "streaming safeguard" requirement from
// the completion-and-continuity spec is structurally satisfied by
// construction rather than needing separate stream-vs-network-cutoff
// handling: there is no partial stream to prematurely treat as complete.
// The equivalent successful-completion signal is the provider's own
// stop/finish reason, which is exactly what completeAIReply below checks
// before a reply is ever returned to a route (and from there, the
// frontend). If streaming is ever added later, that stop/finish-reason
// check is exactly what needs to move from "after the full response
// arrives" to "when the stream's own completion event fires" — see
// completeAIReply and each provider's `truncated`/`stopReason` fields.

const provider = createProvider(config);

// Heuristic, not exhaustive — governs whether a chat message triggers live
// web search grounding (see chat()). False negatives just mean a
// borderline question doesn't get search-grounded; false positives just
// mean an ordinary question spends a search call it didn't need. Neither
// is a safety issue, so a broad-but-imperfect keyword match is fine here.
const LEGAL_REGULATORY_PATTERN =
  /\b(labou?r laws?|employment laws?|company laws?|tax(es|ation)?|gst|vat|rbi|sebi|mca|compliance|regulations?|regulatory|court judgu?ments?|legal(ly)?|is it legal|labou?r codes?|minimum wage|maternity leave|paternity leave|termination laws?|notice period|incorporation|company registration|statutory|government notifications?)\b/i;

/**
 * Low-level call: retry + timeout + optional JSON validation, wrapped
 * around whatever provider is currently configured.
 */
async function callAI(system, messages, { json = false, shape, maxTokens = 1000, enableWebSearch = false, returnCitations = false, returnMeta = false } = {}) {
  const raw = await retry(
    (attempt) =>
      withTimeout(
        (signal) => provider.complete(system, messages, { maxTokens, signal, enableWebSearch: enableWebSearch && provider.supportsWebSearch }),
        config.requestTimeoutMs
      ),
    { attempts: 2 }
  );
  const rawText = raw.text;
  const citations = raw.citations || [];

  if (!json) {
    if (returnMeta) return { text: rawText, citations, truncated: !!raw.truncated, stopReason: raw.stopReason };
    return returnCitations ? { text: rawText, citations } : rawText;
  }
  const parsed = await parseAndValidate(provider, rawText, { shape, system, messages });
  return returnCitations ? { ...parsed, citations } : parsed;
}

// ---- Response Completion & Continuity ----
// Every free-text reply the founder actually reads as a chat bubble goes
// through completeAIReply instead of calling callAI directly. Two
// independent signals decide whether a reply needs more work before it's
// shown:
//   1. The provider's own stop/finish reason said it was cut off for
//      hitting the token budget (raw.truncated) — the strongest signal.
//   2. A heuristic on the text itself (looksIncomplete) catches cases the
//      provider doesn't clearly flag — trailing conjunctions, an open
//      quote, a bullet with nothing after it, a trailing colon, no
//      terminal punctuation at all.
// If either fires, we ask the model to continue from exactly where it
// left off (not restate/repeat) and append the continuation, up to a
// small retry budget. If it's still not complete after that budget, we
// never hand the founder a visibly cut-off answer — we trim back to the
// last complete sentence/bullet instead, which is always a valid (if
// shorter) complete thought.

const DANGLING_ENDINGS = /^(because|so|but|and|or|if|when|which|that|while|as|though|although|since|for|nor|yet|to|with|of|in|on|at|the|a|an)$/i;

function looksIncomplete(text) {
  const t = (text || "").trim();
  if (!t) return true;

  // Unclosed code fence — legitimate code/JSON blocks are otherwise
  // allowed to end without sentence punctuation, so check this first.
  const fenceCount = (t.match(/```/g) || []).length;
  if (fenceCount % 2 !== 0) return true;
  if (fenceCount > 0 && t.trimEnd().endsWith("```")) return false;

  const lastLine = t.split("\n").filter((l) => l.trim()).pop() || "";

  // Trailing bullet/numbered marker with nothing after it
  if (/^[-*•]\s*$/.test(lastLine) || /^\d+[.)]\s*$/.test(lastLine)) return true;

  // Odd number of double quotes = an opened-but-unclosed quotation
  if ((t.match(/"/g) || []).length % 2 !== 0) return true;

  // Trailing colon strongly implies a list/explanation was about to follow
  if (/:\s*$/.test(t)) return true;

  // Ends with a bare dangling conjunction/preposition/article (no
  // terminal punctuation right after it) — a sentence fragment
  const trailingWord = (t.match(/[A-Za-z']+$/) || [""])[0];
  if (DANGLING_ENDINGS.test(trailingWord) && !/[.!?]\s*$/.test(t)) return true;

  // No terminal punctuation anywhere at the end — except a bullet/numbered
  // list item is legitimately allowed to end without one (this project's
  // own system prompt asks for terse bullets, not full sentences), as
  // long as it isn't just a bare marker (already caught above).
  const isBulletLine = /^([-*•]|\d+[.)])\s+\S/.test(lastLine);
  if (!isBulletLine && !/[.!?)\]"'’”]\s*$/.test(t)) return true;

  return false;
}

// Trims text back to the last sentence/bullet that is itself complete —
// used only when continuation attempts are exhausted and we still can't
// hand back a clean answer. Always produces a valid (if shorter) complete
// thought rather than a visibly cut-off one.
function trimToLastCompleteThought(text) {
  const t = (text || "").trim();
  if (!t) return t;
  // Prefer the last complete sentence terminator across the whole text.
  const sentenceEnd = Math.max(t.lastIndexOf(". "), t.lastIndexOf("! "), t.lastIndexOf("? "), t.lastIndexOf(".\n"), t.lastIndexOf("!\n"), t.lastIndexOf("?\n"));
  if (sentenceEnd > 20) return t.slice(0, sentenceEnd + 1).trim();
  // Fall back to the last complete bullet line if no sentence break exists.
  const lines = t.split("\n");
  while (lines.length && (looksIncomplete(lines[lines.length - 1]) || !lines[lines.length - 1].trim())) {
    lines.pop();
  }
  const trimmed = lines.join("\n").trim();
  return trimmed || t; // never return empty — an untrimmed partial beats nothing
}

const MAX_CONTINUATIONS = 2;

/**
 * Wraps callAI for every reply the founder reads directly. Guarantees the
 * returned text is never a visibly truncated response — see module
 * comment above. Same options as callAI (json is not supported here on
 * purpose; this is for free-text chat replies only).
 */
async function completeAIReply(system, messages, options = {}) {
  const { skipHeuristic = false, ...callOptions } = options;
  const isIncomplete = (t) => (skipHeuristic ? false : looksIncomplete(t));
  let { text, citations, truncated } = await callAI(system, messages, { ...callOptions, returnMeta: true });
  let attempts = 0;
  let workingMessages = messages;

  while ((truncated || isIncomplete(text)) && attempts < MAX_CONTINUATIONS) {
    attempts += 1;
    workingMessages = [
      ...workingMessages,
      { role: "assistant", content: text },
      {
        role: "user",
        content:
          "Continue your previous reply from exactly where it left off. Do not repeat or restate anything already written, do not add a new greeting or preamble — just complete the thought naturally and finish with a proper ending.",
      },
    ];
    const cont = await callAI(system, workingMessages, { ...callOptions, returnMeta: true });
    text = `${text}${text.endsWith(" ") || cont.text.startsWith(" ") ? "" : " "}${cont.text}`.trim();
    truncated = cont.truncated;
    citations = [...citations, ...(cont.citations || [])];
  }

  if (truncated || isIncomplete(text)) {
    // Continuation budget exhausted and it's still not a complete
    // thought — never show a visibly cut-off answer. Trim back to the
    // last complete sentence/bullet, which is always valid even if
    // shorter than intended. Skipped when skipHeuristic is set (e.g.
    // translations) since trimming by English sentence-boundary rules
    // would mangle non-English text — the truncated-flag continuation
    // loop above already did what it safely can in that case.
    if (!skipHeuristic) text = trimToLastCompleteThought(text);
  }

  return options.returnCitations || options.returnMeta ? { text, citations, truncated: false } : text;
}

function withMemoryContext(userId, queryText, extra = "") {
  const memories = memoryService.retrieve(userId, queryText);
  return `${extra}\n\nRELEVANT FOUNDER MEMORY (most relevant first is not guaranteed — read all before answering):\n${memoryService.memoriesToPromptBlock(memories)}`;
}

async function chat(userId, { profile, missions, feedback, history, patterns, recentDecisions, learnedPatterns, mode, scenario, metrics, documents }) {
  const lastUserMsg = history[history.length - 1]?.content || "";

  // ---- AI Simulator (Part 11) ----
  // A distinct persona: the AI plays the counterpart (investor, customer,
  // candidate...) instead of being the founder's mentor, so they can
  // practice a high-stakes conversation before having it for real.
  if (mode === "simulator" && scenario) {
    const system = `You are role-playing as the counterpart in a founder's practice conversation — NOT as their mentor. Scenario: ${scenario}. Stay fully in character as that counterpart (investor/customer/candidate/negotiator, whichever the scenario implies) — be realistically skeptical, ask real follow-up questions, don't make it easy, but stay plausible and professional. Founder's company for context: ${profile.startupName} — ${profile.oneLiner}, stage ${profile.stage}. If the founder explicitly asks for feedback or says the practice is over, break character and give a short, honest evaluation: 2-3 concrete strengths, 2-3 concrete areas to improve, framed as an opinion from someone who just role-played this scenario with them — never a fabricated numeric score.`;
    return completeAIReply(system, history, { maxTokens: 1000 });
  }

  const memoryBlock = memoryService.memoriesToPromptBlock(memoryService.retrieve(userId, lastUserMsg, { limit: 20 }));
  const downvoteNotes = (feedback || [])
    .filter((f) => f.context === "chat" && f.rating === "down")
    .slice(-3)
    .map((f) => f.comment)
    .filter(Boolean);

  // ---- Decision history + this founder's own learned patterns ----
  // Distinct from `patterns` below (population-level, anonymized,
  // cross-founder patterns). This is THIS founder's own recorded
  // decisions, predictions, and outcomes — closes the gap where that
  // history only fed the dedicated Decision Simulator, not ordinary chat.
  const decisionHistoryBlock = recentDecisions?.length
    ? `\nTHIS FOUNDER'S DECISION HISTORY (reference naturally when relevant — never announce that you're "retrieving" it):\n${recentDecisions
        .map((d) => {
          const parts = [`- "${d.finalDecisionText || d.decisionText}" (${d.status})`];
          if (d.prediction) parts.push(`predicted: ${d.prediction.expectedCase}`);
          if (d.outcome) parts.push(`actual: ${d.outcome.actualUpdate} — ${d.outcome.comparisonSummary}`);
          return parts.join(" | ");
        })
        .join("\n")}`
    : "";
  const learnedPatternsBlock = learnedPatterns?.length
    ? `\nPATTERNS LEARNED SPECIFICALLY ABOUT THIS FOUNDER (apply these — e.g. if their forecasts in a category consistently run high, adjust accordingly and say so):\n${learnedPatterns.map((p) => `- ${p.patternText}`).join("\n")}`
    : "";

  // ---- Uploaded document context ----
  // Retrieval here is lexical (keyword-overlap), not semantic/vector
  // search — see documentRetrieval.js for why. Chunks are only included
  // when they actually share vocabulary with the question, and the model
  // is explicitly told not to invent citations for anything it wasn't
  // given here.
  const relevantChunks = documents?.length ? documentRetrieval.retrieveRelevantChunks(documents, lastUserMsg, { topN: 6 }) : [];
  const documentBlock = relevantChunks.length
    ? `\nCOMPANY DOCUMENTS (use these to answer if relevant; quote/paraphrase accurately, never invent content that isn't here):\n${relevantChunks
        .map((c, i) => `[Doc ${i + 1}: ${c.filename}]\n${c.text}`)
        .join("\n\n")}`
    : "";

  // ---- Jurisdiction + legal/regulatory grounding ----
  // No AI system can guarantee "correct and current in every jurisdiction"
  // — the honest goal here is narrower: always reason from the founder's
  // actual country, and when the question smells like law/tax/compliance,
  // check the live web instead of leaning on static training data. Real
  // web search only runs on providers that support it (see
  // AIProvider.supportsWebSearch) — on others this block still shapes the
  // answer with the founder's country, it just can't verify against
  // anything current.
  const isLegalOrRegulatoryQuestion = LEGAL_REGULATORY_PATTERN.test(lastUserMsg);
  const canSearch = isLegalOrRegulatoryQuestion && provider.supportsWebSearch;

  const jurisdictionBlock = `\nFOUNDER'S JURISDICTION: ${profile.country || "not specified"}. When advice touches law, tax, employment, compliance, or regulation, ground it specifically in this jurisdiction — not generic "startup wisdom." Laws frequently vary by state/province/region WITHIN a country too; say so explicitly rather than implying one national answer covers every region. ${
    canSearch
      ? "You have live web search available for this question — use it to check current law/rates/regulations rather than relying on your training data, which may be outdated."
      : "You do NOT have live web access right now — if this needs current external verification (a specific law, rate, or regulation), say plainly that you're working from general knowledge that may be outdated, rather than presenting it as current or authoritative."
  } Regardless of search access: always close legal/tax/compliance-adjacent answers by recommending the founder verify anything consequential with a licensed lawyer or accountant in ${profile.country || "their country"} before acting — you are not a substitute for one, and getting this wrong has real consequences for them.`;

  const isSubstantive = lastUserMsg.length > 40;

  // First-principles reasoning: internal only — the output should read as
  // one natural, flowing answer that happens to be well-reasoned, not a
  // visible reasoning readout bolted onto the end of it.
  const reasoningInstructions = isSubstantive
    ? `

REASON FROM FIRST PRINCIPLES BEFORE YOU ANSWER (internal — never expose this as a labeled section, checklist, or trailing block; weave whatever's actually useful into the natural prose of your answer, the way an experienced cofounder would just... know it):
1. Understand the real problem, then break it into its smallest actual components — don't accept the founder's framing of the problem at face value if it's really a symptom of something else (e.g. "I need more users" may really be "no activation" or "no distribution" or "no PMF").
2. Separate what's a fact, what's an opinion, and what's simply unknown right now.
3. Identify the assumptions this situation depends on (market, customer, technical, financial, team) — if a conclusion leans on a weak or untested one, say so plainly rather than stating the conclusion with false confidence.
4. Apply whichever of these lenses actually illuminate this specific situation — never force all of them, most questions need one or two: economics, psychology/human behavior, incentives, systems thinking, game theory, engineering/technical constraints, time, capital, risk, scalability.
5. Weigh real trade-offs and think one step past the obvious first-order effect — what does this cause next?
6. For anything you're recommending, internally check: what evidence actually supports this, what would contradict it, what's missing, and does that add up to real confidence or just a plausible-sounding guess? Let that calibrate how certain you sound — plain language, never a fabricated percentage.
7. When it's genuinely useful, ground the recommendation in best-case / most-likely-case / worst-case terms and name an early warning sign that would tell the founder the plan isn't working — but only when that framing adds something, not as a reflex format.
8. Don't default to agreement. If the founder's reasoning has a weak assumption, a contradiction with something they've said before, or missing information that would change the answer, say so directly and respectfully — the goal is their best decision, not making them feel good about their current one.

Draw on THIS FOUNDER'S DECISION HISTORY and PATTERNS LEARNED ABOUT THIS FOUNDER above naturally — the way a cofounder who's been there the whole time would, e.g. "your last two pricing experiments came in under forecast, so I'd treat this estimate the same way" — never phrase it as "I retrieved" or "based on my memory search," just know it.`
    : "";

  const system = `You are the AI mentor inside FounderOS — a supportive, honest, calm, evidence-based co-founder to ${profile.founderName}, founder of ${profile.startupName} (${profile.oneLiner}). Current stage: ${profile.stage}. Strengths: ${(profile.strengths || []).join(", ")}. Growth areas: ${(profile.growthAreas || []).join(", ")}. Recent missions: ${(missions || []).slice(-5).map((m) => `${m.title} (${m.status})`).join("; ") || "none yet"}.
${metrics ? `\nCURRENT STARTUP METRICS (read these automatically — never ask the founder to restate numbers you already have here): ${JSON.stringify(metrics)}` : ""}
${documentBlock}
${jurisdictionBlock}
${decisionHistoryBlock}
${learnedPatternsBlock}
${reasoningInstructions}

FOUNDER MEMORY, GROUPED BY HOW IT CONNECTS (vision → product/customer → assumptions → experiments → results → lessons → decisions — use these relationships when reasoning, and answer as if you genuinely remember this founder's history, never as if you searched for it):
${memoryBlock}
${patterns?.length ? `\nGENERAL PATTERNS SEEN ACROSS FOUNDERS AT SIMILAR STAGES (population-level, not specific to this founder — mention only if genuinely relevant): ${patterns.map((p) => p.insight).join(" | ")}` : ""}
${downvoteNotes.length ? `\nFounder has flagged responses unhelpful for: ${downvoteNotes.join("; ")}. Adjust accordingly.` : ""}

Never use generic motivational quotes or fake certainty, and never surface a raw confidence percentage, accuracy score, or model name anywhere in your reply — express certainty only in plain language.

SCOPE: You exist to help this founder build their company — strategy, hiring, pricing, sales, marketing, fundraising, customers, financials, product, operations, growth, decisions, and anything grounded in their actual business. If a message is clearly unrelated to their company (sports, movies, general trivia, unrelated coding help, etc.), say briefly and warmly that you're focused on helping them build ${profile.startupName}, and redirect back to something relevant — don't just refuse coldly, and don't be rigid about borderline cases (a founder venting about a bad day, or asking something tangential but work-adjacent, is still in scope).

RESPONSE STYLE — this matters as much as the content:
- Whenever you state a money amount, format it as the founder's currency symbol immediately followed by the number with proper locale-appropriate comma grouping — e.g. "₹30,000" for INR (Indian digit grouping: thousands, then lakhs/crores, e.g. ₹3,00,000 not ₹300,000), "$30,000" for USD (Western grouping). Founder's currency: ${profile.currency || "USD"}. Never show a raw unformatted number like "30000" for a money amount.
- Be direct. Lead with the answer or the recommendation, not a preamble.
- Default to short bullet points or numbered steps over paragraphs, especially for anything actionable.
- Cut narrative framing ("let's think about this...", "here's the thing..."). State it plainly.
- End actionable answers with a clear next step, not a vague sign-off.
- Keep the reply as short as the question allows — a one-line answer to a one-line question is correct, not lazy. Expand only when the founder's question genuinely needs the detail.
- Stay roughly within 300 tokens even when the first-principles reasoning above surfaces a lot — pick what's most useful to say, don't try to fit everything in.
- Always finish on a complete thought: either a complete statement or, only when you genuinely still need something from the founder to move forward, a complete question. Never end mid-sentence, mid-bullet, or on a dangling word like "because"/"so"/"and"/"which"; never end with a colon unless the list right after it is actually there; never end with an unfinished quotation. If you're running long, wrap up the point you're on rather than cutting it off — a shorter complete answer is always better than a longer unfinished one. Don't force a question onto every reply just to have one — a clear closing statement is often the right ending.
${relevantChunks.length ? `\nWhen you use a company document above, end your reply with a short "Sources Used" line naming the document(s) by filename (e.g. "Sources Used: Employee_Handbook.pdf").` : ""}`;

  const { text: replyText, citations } = await completeAIReply(system, history, { maxTokens: 450, enableWebSearch: canSearch, returnCitations: true });
  // Real citations only, appended programmatically — never asking the
  // model to remember/generate a source list itself.
  const reply = citations.length ? `${replyText}\n\nWeb sources checked: ${citations.map((c) => c.url).join(", ")}` : replyText;

  // Only remember substantive exchanges, not every "ok thanks"
  if (isSubstantive) {
    memoryService.remember(userId, { type: "mentor_note", text: `Founder asked: "${lastUserMsg.slice(0, 200)}" → mentor: "${reply.slice(0, 200)}"` });
    // Context extraction runs in the background — never blocks or slows
    // the reply the founder is waiting on. See extractCompanyContext.
    extractCompanyContext(userId, lastUserMsg).catch(() => {});
  }
  return reply;
}

// ---- Context Extraction Layer ----
// Runs after substantive exchanges only, in the background (never blocks
// the reply). Pulls structured startup facts out of what the founder just
// said and stores them as typed memory entries, so future conversations
// retrieve "target customer: X" precisely instead of relying on the
// freeform mentor_note recap to happen to contain it. This is additive to
// — not a replacement for — the existing mentor_note memory.
async function extractCompanyContext(userId, text) {
  const system = `Extract any NEW structured startup facts explicitly stated in this founder message. Do not infer or guess — only what's actually said. Output ONLY JSON:
{
  "facts": [
    { "type": "company_fact"|"assumption"|"validated_assumption"|"rejected_assumption"|"risk"|"experiment"|"pivot"|"goal", "text": "short factual statement, e.g. 'Target customer is solo consultants, not agencies'" }
  ]
}
Categories: company_fact = stable facts (product, industry, pricing, business model, target customer, value proposition). assumption = something the founder believes but hasn't verified. validated_assumption / rejected_assumption = an assumption they've now confirmed true/false with real evidence. risk = a named risk or constraint. experiment = something they tried or are trying. pivot = a real change in direction. goal = a stated objective.
If nothing new and concrete is stated, output { "facts": [] }. Never fabricate a fact that wasn't actually said.`;

  const result = await callAI(system, [{ role: "user", content: text }], {
    json: true,
    shape: { requiredKeys: ["facts"] },
    maxTokens: 300,
  });
  (result.facts || []).slice(0, 5).forEach((f) => {
    if (f.text) memoryService.remember(userId, { type: f.type, text: String(f.text).slice(0, 300) });
  });
  return result.facts || [];
}

async function translateText(userId, { text, targetLanguage }) {
  const system = `Translate the following text into ${targetLanguage}. Preserve the original meaning, tone, formatting (line breaks, bullets), and any numbers/currency exactly. Output ONLY the translated text — no preamble, no explanation, no notes about the translation. Always translate the entire text through to its natural end — never stop partway through.`;
  const translated = await completeAIReply(system, [{ role: "user", content: text }], { maxTokens: 800, skipHeuristic: true });
  return translated.trim();
}

async function generateChatTitle(userId, { messages }) {
  const system = `Generate a short title (3-6 words, no quotes, no trailing punctuation, title case) summarizing what this conversation is about so far. Output ONLY the title text, nothing else.`;
  const transcript = (messages || [])
    .slice(0, 6)
    .map((m) => `${m.role === "user" ? "Founder" : "Mentor"}: ${m.content}`)
    .join("\n");
  const raw = await callAI(system, [{ role: "user", content: transcript }], { maxTokens: 20 });
  const title = String(raw || "")
    .replace(/["'.\n]+$/g, "")
    .replace(/^["']|["']$/g, "")
    .trim()
    .slice(0, 60);
  return title || "New Chat";
}

async function extractMetricsFromDocument(userId, { text, metricFields }) {
  const system = `You extract startup metric values from a document, for a founder to review before anything is saved. You will be given a list of metric fields (key, label, unit) and a document's text.

The document's tables (if any) are formatted as pipe-delimited rows, e.g.:
Metric  |  Jan  |  Feb  |  Mar
MRR  |  40000  |  42000  |  45000
Read the header row carefully to know what each column means before extracting values — a table often has ONE metric per row and MULTIPLE time periods as columns (or vice versa). When a metric appears multiple times across periods (e.g. monthly columns), extract the MOST RECENT period's value, not the first column, unless the founder's question context suggests otherwise — the goal is "what is this metric right now."

Rules:
- Extract a value ONLY if it is explicitly and unambiguously stated in the text for that specific metric.
- Never estimate, infer, average, or calculate a value that isn't directly stated.
- If a field isn't mentioned, or you can't confidently tell which row/column it belongs to, leave it out entirely — do not guess. A wrong column match (e.g. reading Feb's number as Jan's) is worse than leaving a field blank.
- Percentages should be plain numbers (e.g. "4.2" for 4.2%, not "0.042").
- Currency values should be plain numbers with no symbols or commas.

Output ONLY JSON: { "values": { "<metricKey>": <number>, ... } } — include only the keys you're confident about. If nothing is found, output { "values": {} }.

Metric fields to look for:
${metricFields.map((f) => `- ${f.key} (${f.label}, unit: ${f.unit || "count"})`).join("\n")}`;

  const result = await callAI(system, [{ role: "user", content: text.slice(0, 16000) }], {
    json: true,
    shape: { requiredKeys: ["values"] },
    maxTokens: 600,
  });
  return result.values || {};
}

// ---- Product Validation ----
// "Does this pain actually exist?" — checked against real people talking
// about it (Reddit, Quora, Hacker News, forums), not the model's training-
// data guess about what founders usually assume. Uses the same hosted web
// search + real-citation mechanism as the legal-grounding feature in
// chat() — same honesty rules apply: never invent a thread, quote, or
// signal that wasn't actually found, and say plainly when search isn't
// available rather than quietly falling back to generic reasoning dressed
// up as evidence. A dedicated function (rather than folding into chat())
// because this is a deliberate research action the founder explicitly
// asks for, with an output shape (verdict + evidence) distinct enough
// from a normal mentor reply to warrant its own system prompt.
// ---- GEO (Generative Engine Optimization) Readiness ----
// What this deliberately is NOT: there is no way to pay for or otherwise
// directly manipulate what ChatGPT, Claude, or any other AI assistant
// says about a startup — no "connector" to those products exists for
// this, and none is faked here. What's real: AI assistants that browse
// the live web surface whatever's actually out there (Reddit, G2,
// Capterra, Quora, a startup's own FAQ/structured data). This function
// checks that real, controllable surface — using the same hosted web
// search + genuine citations as the validation feature — and produces
// concrete, publishable content to improve it.
async function analyzeGeoReadiness(userId, { profile, history }) {
  const canSearch = provider.supportsWebSearch;

  const system = `You are running an AI-discoverability ("GEO") check for a founder — the goal is to see what AI assistants that browse the live web would currently find when asked about this startup or its problem space, and to give them content that makes future discovery more likely.

Be direct about the reality: there is no way to buy or manipulate ranking inside ChatGPT, Claude, or any other AI assistant's own responses — that mechanism does not exist. What genuinely helps is being clearly, factually present on the surfaces those assistants actually search: the startup's own site (especially FAQ-style content and structured data), Reddit/Quora threads where the problem is discussed, comparison/review sites (G2, Capterra) if relevant, and Product Hunt or similar launch platforms. Never imply otherwise.

${
  canSearch
    ? `You have live web search — use it now. Search for "${profile.startupName}" and for the problem space described in their one-liner, to see what (if anything) currently surfaces about them or close competitors.`
    : "You do NOT have live web search access right now — say so plainly rather than guessing what search would currently surface."
}

Founder: ${profile.founderName}, building ${profile.startupName} — ${profile.oneLiner}. Stage: ${profile.stage}. Industry: ${profile.industry || "not specified"}.

Output format — structured, under 300 tokens total, bullets over prose:
- Current visibility: one honest line on what search actually turned up (or "search unavailable" if it wasn't). Do not invent mentions that weren't found.
- AI-friendly description: 1-2 sentences written the way you'd want an AI assistant to describe this startup if quoting it directly — clear, factual, no marketing fluff.
- 2-3 FAQ-style Q&As the founder should publish on their own site (real questions a prospect would ask an assistant, answered plainly) — these are the exact content shape live-search assistants tend to quote.
- Where to focus next: 1-2 specific real platforms/communities (not "social media" — name the actual subreddit/site) worth a genuine presence, given their industry.

Never invent a "connect your startup to ChatGPT" step — it doesn't exist. Everything here should be something the founder can literally publish or do today. Always finish on a complete statement or, if genuinely needed, a complete question — never end mid-sentence, mid-bullet, or on a trailing colon/conjunction.`;

  const recentHistory = (history || [])
    .slice(-4)
    .map((m) => ({ role: m.role, content: m.content }))
    .filter((m) => typeof m.content === "string" && m.content.trim() !== "");
  const { text, citations } = await completeAIReply(system, [...recentHistory, { role: "user", content: "Run a GEO / AI-visibility check for my startup." }], {
    maxTokens: 500,
    enableWebSearch: canSearch,
    returnCitations: true,
  });
  const reply = citations.length ? `${text}\n\nSources checked: ${citations.map((c) => c.url).join(", ")}` : text;
  return { reply, citations };
}

async function validateProductIdea(userId, { profile, idea, history }) {
  const canSearch = provider.supportsWebSearch;

  const system = `You are running a real-world validation check for a founder's product idea — the goal is to find out if the pain point they're building for actually shows up in how real people talk, not to reassure them.

${
  canSearch
    ? "You have live web search — use it now. Search Reddit, Quora, Hacker News, and relevant forums/communities for people describing this specific pain point in their own words. Look for genuine complaints, frustration, or workaround-seeking — not marketing pages, SEO listicles, or other startups' landing pages."
    : "You do NOT have live web search access right now. Say so plainly and clearly — do not present general reasoning as if it were evidence. Instead, name 2-3 specific subreddits/forums/communities the founder should go check themselves, and what search terms would surface the real conversations."
}

Founder: ${profile.founderName}, building ${profile.startupName} — ${profile.oneLiner}. Stage: ${profile.stage}.

Output format — structured, under 300 tokens, bullets over prose:
- Verdict: exactly one of "Strong signal", "Moderate signal", "Weak signal", or "No clear evidence found" — pick the honest one, never round up.
- What real people are actually saying: 2-4 bullets, each grounded in something genuinely found (brief paraphrase, not a long quote) — omit this section entirely if search wasn't available or found nothing.
- Recommendation: 1-2 direct sentences.
- Next step: one concrete action, not vague encouragement.

A founder who hears "unclear, go talk to 10 people directly" and acts on it is better off than one who hears an inflated "yes, people want this." Never invent a thread, quote, subreddit, or number that wasn't actually found. Always finish on a complete statement or, if genuinely needed, a complete question — never end mid-sentence, mid-bullet, or on a trailing colon/conjunction.`;

  const recentHistory = (history || [])
    .slice(-6)
    .map((m) => ({ role: m.role, content: m.content }))
    .filter((m) => typeof m.content === "string" && m.content.trim() !== "");
  const { text, citations } = await completeAIReply(system, [...recentHistory, { role: "user", content: idea }], {
    maxTokens: 500,
    enableWebSearch: canSearch,
    returnCitations: true,
  });
  const reply = citations.length ? `${text}\n\nSources checked: ${citations.map((c) => c.url).join(", ")}` : text;
  return { reply, citations };
}

// ---- Compare Options (Growth A-vs-B decisions, e.g. "ads or cold outreach?") ----
// The single-path Decision Simulator above is built for "what happens if I
// do X" — it doesn't naturally produce a side-by-side recommendation for
// "should I do X or Y". This is a distinct shape: two named paths, their
// tradeoffs for THIS founder specifically, and a real recommendation
// (not a coin flip framed as "both have merit").
async function compareGrowthOptions(userId, { profile, metrics, question, history }) {
  const system = withMemoryContext(
    userId,
    `growth options comparison: ${question}`,
    `You are helping a founder choose between two growth paths they're weighing against each other (e.g. paid ads vs. cold outreach, SEO vs. paid, in-house vs. agency). Ground everything in their actual stage, metrics, and profile — never generic startup wisdom. Output ONLY JSON:
{
  "optionA": { "label": "short name for the first path, in the founder's own words", "howItWorks": "1 sentence", "prosForThisFounder": [2-3 short strings, specific to their stage/metrics], "consForThisFounder": [2-3 short strings], "costProfile": "1 short phrase, e.g. 'front-loaded cash spend, faster feedback'" },
  "optionB": { same shape as optionA for the second path },
  "recommendation": "optionA"|"optionB"|"both"|"neither",
  "reasoning": "2-3 sentences explaining the recommendation, grounded in this founder's actual numbers and stage — not a generic tradeoff essay",
  "conditionalGuidance": "1-2 sentences: the specific thing that would flip this recommendation the other way",
  "firstStep": "1 concrete, specific next action for whichever path was recommended"
}
Never hedge into "it depends, both are valid" as the recommendation unless the founder's context is genuinely too thin to differentiate — in that case set recommendation to "neither" and use conditionalGuidance to say what info would resolve it. Never surface a raw confidence percentage or score.`
  );
  const userMsg = JSON.stringify({
    profile,
    currentMetrics: metrics,
    question,
    recentDecisions: (history || []).slice(-3).map((d) => ({ decisionText: d.decisionText, status: d.status })),
  });
  return callAI(system, [{ role: "user", content: userMsg }], {
    json: true,
    shape: { requiredKeys: ["optionA", "optionB", "recommendation", "reasoning", "firstStep"] },
  });
}

async function generateDecisionSimulation(userId, { companyProfile, metrics, decision, history, decisionContext, patterns }) {
  const system = withMemoryContext(
    userId,
    `decision simulation: ${decision}`,
    `You are the Decision Simulator inside FounderOS. A founder is about to make a business decision. Predict the plausible consequences on their real startup metrics. Output ONLY JSON:
{
  "currentSituation": "1-2 sentences summarizing ONLY the company context actually relevant to this specific decision — not a general recap.",
  "predictions": [
    { "metric": "human label e.g. Revenue", "metricKey": "one of the known metric keys this plausibly affects, or a short camelCase key if none fit", "currentValue": number|null, "predictedLow": number|null, "predictedHigh": number|null, "direction": "increase"|"decrease"|"flat"|"uncertain", "reasoning": "1 sentence explaining WHY it changes", "confidence": "low"|"medium"|"high" }
  ] (3-6 of the metrics this decision most plausibly affects — skip metrics it wouldn't touch, use null for currentValue if the founder's baseline for that metric is unknown, and null for predictedLow/High if you genuinely can't ground a range without inventing one),
  "bestCase": "1-2 sentences, plausible optimistic scenario",
  "expectedCase": "1-2 sentences, the most likely scenario",
  "worstCase": "1-2 sentences, plausible pessimistic scenario",
  "keyAssumptions": [2-4 short strings — what has to be true for this prediction to hold],
  "mainRisks": [2-4 short strings],
  "unknownVariables": [1-3 short strings — specific things you don't know that would meaningfully change this prediction if known],
  "overallConfidence": "low"|"medium"|"high",
  "evaluationHorizonDays": number — how many days from now this decision's real outcome could reasonably be judged (e.g. a pricing change: ~30, a hire: ~90, a new market entry: ~180). Pick the smallest honest horizon, not the safest-sounding one.
}
Never invent a precise number where the founder's baseline is unknown — say the range is uncertain instead. Ground every reasoning string in the actual company context given, not generic startup wisdom. If pastDecisions or learnedPatterns are given, actively apply them — if a pattern says this founder's forecasts in this category have run consistently high or low, adjust the expected case accordingly and say so in the reasoning, don't just silently repeat the same optimism. Present this as a forecast, never a guarantee.`
  );
  const userMsg = JSON.stringify({
    companyProfile,
    currentMetrics: metrics,
    decision,
    decisionContext: decisionContext || undefined,
    learnedPatterns: (patterns || []).map((p) => p.patternText),
    pastDecisions: (history || []).slice(-5).map((d) => ({
      decisionText: d.decisionText,
      status: d.status,
      overallConfidence: d.overallConfidence,
      accuracySummary: d.accuracyResults?.length
        ? d.accuracyResults.map((a) => `${a.metric}: predicted ~${a.predictedMid}, actual ${a.actual}`).join("; ")
        : undefined,
      feedbackText: d.feedbackText,
      feedbackDifference: d.feedbackDifference,
      pastLearning: d.learningSummary
        ? { whatWasWrong: d.learningSummary.whatWasWrong, lessonsForFuture: d.learningSummary.lessonsForFuture }
        : undefined,
    })),
  });
  return callAI(system, [{ role: "user", content: userMsg }], {
    json: true,
    shape: { requiredKeys: ["predictions", "bestCase", "expectedCase", "worstCase", "overallConfidence"] },
  });
}

// ---- Decision Outcome Comparison ----
// The other half of the loop generateLearningSummary started: takes the
// immutable prediction as it was actually written down, plus what the
// founder now reports really happened, and produces the prediction-vs-
// reality explanation. Also proposes a cross-decision pattern update when
// the evidence supports one — the route decides whether to persist it,
// this function never touches the database itself.
async function compareOutcomeToPrediction(userId, { decisionText, prediction, actualUpdate, actualMetrics, pastPatterns }) {
  const system = `You are reviewing a founder-made decision against what actually happened, for FounderOS's decision-learning loop. Be honest and specific — the goal is learning, not grading.

Output ONLY JSON:
{
  "comparisonSummary": "3-5 sentences: what was predicted, what actually happened, and WHY it likely differed (execution, timing, wrong assumption, external event, or the prediction was simply right) — grounded in the specifics given, not generic hedging.",
  "assumptionsReview": [ { "assumption": "one of the original key assumptions, verbatim or close to it", "held": true|false, "note": "1 short sentence why" } ],
  "suggestedPattern": { "shouldRecord": true|false, "patternText": "1 sentence, only if shouldRecord is true — a specific, evidence-grounded pattern worth applying to FUTURE similar decisions for this founder (e.g. 'Hiring ramp time has run ~2x the original estimate across 2 decisions')", "category": "e.g. hiring, pricing, marketing, growth, product" }
}
Only set shouldRecord true if the evidence genuinely supports a reusable pattern — a single ambiguous data point isn't one. Never fabricate a pattern to seem insightful.`;

  const userMsg = JSON.stringify({
    decisionText,
    prediction: {
      currentSituation: prediction.currentSituation,
      expectedImpact: prediction.expectedImpact,
      assumptions: prediction.assumptions,
      risks: prediction.risks,
      bestCase: prediction.bestCase,
      expectedCase: prediction.expectedCase,
      worstCase: prediction.worstCase,
    },
    actualUpdate,
    actualMetrics: actualMetrics || undefined,
    priorPatternsAlreadyKnown: (pastPatterns || []).map((p) => p.patternText),
  });
  return callAI(system, [{ role: "user", content: userMsg }], {
    json: true,
    shape: { requiredKeys: ["comparisonSummary", "assumptionsReview"] },
  });
}

module.exports = {
  chat,
  generateChatTitle,
  translateText,
  compareGrowthOptions,
  validateProductIdea,
  analyzeGeoReadiness,
  extractMetricsFromDocument,
  extractCompanyContext,
  generateDecisionSimulation,
  compareOutcomeToPrediction,
  providerName: provider.name,
};
