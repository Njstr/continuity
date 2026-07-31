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
async function callAI(system, messages, { json = false, shape, maxTokens = 1000, enableWebSearch = false, returnCitations = false } = {}) {
  const raw = await retry(
    (attempt) =>
      withTimeout(
        (signal) => provider.complete(system, messages, { maxTokens, signal, enableWebSearch: enableWebSearch && provider.supportsWebSearch }),
        config.requestTimeoutMs
      ),
    { attempts: 2 }
  );
  const rawText = typeof raw === "string" ? raw : raw.text;
  const citations = typeof raw === "string" ? [] : raw.citations || [];

  if (!json) return returnCitations ? { text: rawText, citations } : rawText;
  const parsed = await parseAndValidate(provider, rawText, { shape, system, messages });
  return returnCitations ? { ...parsed, citations } : parsed;
}

function withMemoryContext(userId, queryText, extra = "") {
  const memories = memoryService.retrieve(userId, queryText);
  return `${extra}\n\nRELEVANT FOUNDER MEMORY (most relevant first is not guaranteed — read all before answering):\n${memoryService.memoriesToPromptBlock(memories)}`;
}

// ---- Founder OS Brief (new homepage, Part 1) ----
// Answers exactly five questions — everything else on Home is secondary.
async function generateFounderBrief(userId, { profile, businessState, missions, decisions, healthLatest, patterns }) {
  const system = withMemoryContext(
    userId,
    "founder OS daily brief",
    `You are the Founder Operating System brief generator inside Founder Companion. Synthesize everything given into the five things that actually matter today. Output ONLY JSON:
{
  "biggestProblem": "1-2 sentences: the single most important problem right now, not a list",
  "whyHappening": "1-2 sentences: the root cause, grounded in the actual data given",
  "todayFocus": "1 sentence: what they should do about it today (this frames their mission, doesn't replace it)",
  "expectedImpact": "1 sentence: what changes if they act on this today",
  "amIImproving": { "trend": "up"|"down"|"flat", "reasoning": "1 sentence grounded in real trend data given (health history, mission completion rate, business metrics) — say so plainly if there isn't enough history yet" }
}
Never invent a problem if the data doesn't support one — if things genuinely look fine, say so and point to the next opportunity instead of manufacturing urgency.`
  );
  const userMsg = JSON.stringify({
    stage: profile.stage,
    growthAreas: profile.growthAreas,
    businessState,
    recentMissions: (missions || []).slice(-6).map((m) => ({ title: m.title, status: m.status, problemDetected: m.problemDetected })),
    recentDecisions: (decisions || []).slice(-3).map((d) => ({ question: d.question, resolved: d.resolved })),
    latestHealthCheck: healthLatest || undefined,
    detectedPatterns: (patterns || []).map((p) => p.insight),
  });
  return callAI(system, [{ role: "user", content: userMsg }], {
    json: true,
    shape: { requiredKeys: ["biggestProblem", "whyHappening", "todayFocus", "amIImproving"] },
  });
}

// ---- AI Learning (Part 13) — replaces static courses ----
async function generateLesson(userId, { profile, businessState }) {
  const system = withMemoryContext(
    userId,
    "personalized lesson",
    `You are the AI Learning system inside Founder Companion. Identify the founder's single biggest knowledge gap right now from their profile and business state, then generate a focused 15-minute lesson to close it — not a generic course, a specific lesson for their specific situation. Output ONLY JSON:
{
  "gapIdentified": "1 sentence naming the specific knowledge gap",
  "evidence": "1 sentence: what indicates this gap (a weak skill score, a business metric, a stated goal)",
  "lessonTitle": string,
  "sections": [ {"heading": string, "content": "2-4 sentences, concrete and specific, not generic startup advice"} ] (3-5 sections, reads in about 15 minutes),
  "immediateMissionTitle": "1 sentence: the specific action to take right after finishing this lesson, to convert learning into execution immediately"
}`
  );
  const userMsg = JSON.stringify({ stage: profile.stage, growthAreas: profile.growthAreas, skills: profile.skills, businessState });
  return callAI(system, [{ role: "user", content: userMsg }], {
    json: true,
    shape: { requiredKeys: ["gapIdentified", "lessonTitle", "sections"] },
  });
}

// ---- Prediction Engine (Part 10) ----
// Deliberately qualitative, not fake statistics. An LLM has no calibrated
// model behind a number like "PMF probability: 61%" — presenting one would
// dress up a guess as science. These are reasoned, labeled AI opinions,
// with the real numeric ones (runway, revenue/customer trend) computed
// separately from actual data, not asked of the model at all.
async function generatePrediction(userId, { profile, businessState, metrics, missions }) {
  const system = `You are a startup analyst inside Founder Companion. Based on the evidence given, assess each of the following with a CATEGORICAL label only (Low/Medium/High, or Slowing/Steady/Accelerating where noted) plus one sentence of concrete reasoning — never a fabricated percentage or precise statistic, since no calibrated model backs a number like that. Output ONLY JSON:
{
  "pmfLikelihood": {"label": "Low"|"Medium"|"High", "reasoning": string},
  "investorReadiness": {"label": "Low"|"Medium"|"High", "reasoning": string},
  "founderBurnoutRisk": {"label": "Low"|"Medium"|"High", "reasoning": string},
  "executionMomentum": {"label": "Slowing"|"Steady"|"Accelerating", "reasoning": string}
}
Base every label strictly on the evidence given. If evidence is thin for a category, say so in the reasoning and default to the more conservative label rather than guessing optimistically.`;
  const userMsg = JSON.stringify({
    stage: profile.stage,
    businessState,
    metrics,
    missionCompletionRate: missions?.length ? missions.filter((m) => m.status === "done").length / missions.length : null,
    recentMissionStatuses: (missions || []).slice(-10).map((m) => m.status),
  });
  return callAI(system, [{ role: "user", content: userMsg }], {
    json: true,
    shape: { requiredKeys: ["pmfLikelihood", "investorReadiness", "founderBurnoutRisk", "executionMomentum"] },
  });
}

// ---------------- Feature-specific generators ----------------

async function generateProfile(userId, answers) {
  const system = `You are the onboarding intelligence for Founder Companion, an AI co-founder for first-generation founders. You'll receive structured business setup answers (company name, industry, business model, company stage, revenue/expenses/cash/customers, team size, and business goals) rather than a freeform bio — infer the founder's likely strengths and growth areas from what the business data implies (e.g., pre-revenue with a goal of "Acquire Customers" suggests weak Sales/Customer Discovery; already at "Scaling" suggests stronger Execution). Output ONLY a JSON object (no markdown, no prose) with this exact shape:
{
  "founderName": string, "startupName": string, "oneLiner": string,
  "stage": "Idea"|"Problem Validation"|"Solution Validation"|"MVP"|"Early Customers"|"Product-Market Fit"|"Growth"|"Scale"|"Fundraising"|"Expansion",
  "strengths": [2-3 short strings], "growthAreas": [2-3 short strings],
  "skills": { one key per skill in ["Decision Quality","Execution Speed","Learning Velocity","Leadership","Sales","Negotiation","Marketing","Technical Ability","Risk Tolerance","Focus","Adaptability","Consistency","Communication","Strategic Thinking"], each {"current": number 1-10, "target": number 1-10} },
  "welcomeNote": "2-3 warm, honest, specific sentences referencing their actual company/industry/stage",
  "growthScore": number 1-100
}
Map their "companyStage" (Pre-Revenue/Revenue/Growing/Scaling) onto the 10-option "stage" enum sensibly. Estimate skill levels conservatively. Be specific, never generic.`;
  const userMsg = Object.entries(answers).map(([k, v]) => `${k}: ${v}`).join("\n");
  const profile = await callAI(system, [{ role: "user", content: userMsg }], {
    json: true,
    shape: { requiredKeys: ["founderName", "startupName", "stage", "skills"] },
  });

  memoryService.remember(userId, { type: "startup_history", text: `Onboarded as founder of ${profile.startupName}: ${profile.oneLiner}. Stage: ${profile.stage}.` });
  memoryService.remember(userId, { type: "strength", text: `Initial strengths: ${(profile.strengths || []).join(", ")}` });
  memoryService.remember(userId, { type: "weakness", text: `Initial growth areas: ${(profile.growthAreas || []).join(", ")}` });
  return profile;
}

async function generateMission(userId, { profile, missions, businessState }) {
  const system = withMemoryContext(
    userId,
    `mission for stage ${profile.stage} growth areas ${(profile.growthAreas || []).join(" ")}`,
    `You are the daily mentor for a first-generation founder using Founder Companion. Never generate a random or generic mission — every mission must be traceable to a specific detected problem. Given their profile, business state, and memory, output ONLY JSON:
{
  "title": string, "description": "1 short sentence, plain-language summary for a card view", "minutes": number,
  "difficulty": "Easy"|"Medium"|"Hard", "xp": number (20-40 Easy, 40-60 Medium, 60-90 Hard),
  "impact": string, "why": string,
  "checklist": [{"label": string, "done": false}] (2-4 concrete sub-steps, omit entirely if the mission is a single atomic action),
  "problemDetected": "1 sentence: the specific problem this mission addresses",
  "evidence": "1 sentence: what in their profile/business state/history indicates this problem",
  "whyNow": "1 sentence: why this is the highest-leverage thing to do today specifically, not last week or next week",
  "confidence": "low"|"medium"|"high",
  "estimatedROI": "1 short phrase, e.g. 'high — directly addresses the biggest growth blocker'",
  "risk": "1 short phrase describing the main risk of doing this mission, or 'low' if minimal",
  "businessMetricAffected": one of ["revenue","customers","retention","cac","runway","execution","none"],
  "verificationMethod": "1 short phrase: how completion proof should be judged, e.g. 'a working URL' or 'a screenshot of the conversation'"
}
Match this to their current stage, weakest growth area, and business state if given. Name the exact action — never generic advice.`
  );
  const userMsg = JSON.stringify({
    stage: profile.stage,
    growthAreas: profile.growthAreas,
    skills: profile.skills,
    businessState: businessState || undefined,
    recentMissions: (missions || []).slice(-5).map((m) => m.title),
  });
  const mission = await callAI(system, [{ role: "user", content: userMsg }], {
    json: true,
    shape: { requiredKeys: ["title", "impact", "why", "problemDetected"] },
  });
  return mission;
}

async function generateDecision(userId, { profile, question, pastDecisions }) {
  const system = withMemoryContext(
    userId,
    question,
    `You are the Decision Assistant inside Founder Companion. Given the founder's profile, memory, and the decision they face, output ONLY JSON:
{ "situation": string, "options": [{"name": string, "advantages": [strings], "risks": [strings]}], "probability": {"level": "low"|"medium"|"high", "reasoning": string}, "recommendation": {"choice": string, "reasoning": string}, "actionPlan": [3-5 strings] }
Be honest about uncertainty. Never invent facts about their business.`
  );
  const userMsg = JSON.stringify({
    stage: profile.stage,
    decision: question,
    pastDecisions: (pastDecisions || []).slice(-3).map((d) => ({ question: d.question, choice: d.recommendation?.choice })),
  });
  const result = await callAI(system, [{ role: "user", content: userMsg }], {
    json: true,
    shape: { requiredKeys: ["situation", "options", "recommendation", "actionPlan"] },
  });
  memoryService.remember(userId, { type: "decision", text: `Decision: "${question}" → recommended: ${result.recommendation?.choice}` });
  return result;
}

async function generateHealth(userId, { profile, metrics, missions }) {
  const categories = ["Product", "Growth", "Sales", "Revenue", "Customer Satisfaction", "Retention", "Execution", "Financial Health", "Team", "Founder Wellbeing"];
  const system = withMemoryContext(
    userId,
    "startup health check",
    `You are a startup health analyst inside Founder Companion. Output ONLY JSON: {"overallScore": number 0-100, "categories": { one key per category in ${JSON.stringify(categories)}, each {"score": number 0-100, "reason": string} }, "topRisks": [2-3 strings], "topImprovements": [2-3 strings]}. Score conservatively (40-55) where evidence is thin. Never inflate to be encouraging.`
  );
  const userMsg = JSON.stringify({
    stage: profile.stage,
    skills: profile.skills,
    metrics,
    recentMissions: (missions || []).slice(-8).map((m) => ({ title: m.title, status: m.status })),
  });
  return callAI(system, [{ role: "user", content: userMsg }], {
    json: true,
    shape: { requiredKeys: ["overallScore", "categories"] },
  });
}

async function generateMetricsRecommendation(userId, { profile, metrics }) {
  const system = withMemoryContext(
    userId,
    "startup metrics recommendation",
    `You are a startup analyst inside Founder Companion. Output ONLY JSON: {"summary": string, "nextSteps": [{"title": string, "why": string}] (2-4 items), "biggestRisk": string, "confidence": "low"|"medium"|"high"}. Base this strictly on the numbers given.`
  );
  const userMsg = JSON.stringify({ stage: profile.stage, startup: profile.startupName, metrics });
  return callAI(system, [{ role: "user", content: userMsg }], {
    json: true,
    shape: { requiredKeys: ["summary", "nextSteps"] },
  });
}

async function generateWeeklyReport(userId, { profile, answers, missions, businessMetrics }) {
  const system = withMemoryContext(
    userId,
    "weekly founder review",
    `You are the weekly review analyst inside Founder Companion. Output ONLY JSON:
{ "progressSummary": string, "keyAccomplishments": [strings], "repeatedProblems": [strings], "metricsTrend": string, "strategicAdvice": string, "topPriorities": [{"title": string, "why": string}] (exactly 3)${businessMetrics ? `, "businessSnapshot": {"topImprovement": string, "needsAttention": string}` : ""} }
Never use generic encouragement. Reference what they actually wrote.${businessMetrics ? " Also reference the business metrics given — call out the single biggest improvement and the single area needing attention." : ""}`
  );
  const userMsg = JSON.stringify({
    stage: profile.stage,
    answers,
    recentMissions: (missions || []).slice(-7).map((m) => ({ title: m.title, status: m.status })),
    businessMetrics: businessMetrics || undefined,
  });
  const report = await callAI(system, [{ role: "user", content: userMsg }], {
    json: true,
    shape: { requiredKeys: ["progressSummary", "topPriorities"] },
  });
  memoryService.remember(userId, { type: "mentor_note", text: `Weekly review: ${report.progressSummary}` });
  if (report.repeatedProblems?.length) {
    memoryService.remember(userId, { type: "recurring_blocker", text: report.repeatedProblems.join("; ") });
  }
  return report;
}

async function detectPatterns(userId, { profile, missions, decisions, metricsHistory }) {
  const system = `You are a pattern-detection analyst inside Founder Companion. Given a founder's historical activity, find non-obvious, specific patterns worth surfacing proactively — the kind a sharp co-founder would notice but the founder hasn't said out loud. Output ONLY JSON: {"patterns": [ {"insight": string, "evidence": string, "severity": "info"|"watch"|"risk"} ] } (2-5 items). Only report patterns you can actually support from the data given — never invent trends.`;
  const userMsg = JSON.stringify({
    stage: profile.stage,
    missions: (missions || []).map((m) => ({ title: m.title, status: m.status, date: m.date })),
    decisions: (decisions || []).map((d) => ({ question: d.question, date: d.date })),
    metricsHistory: metricsHistory || [],
  });
  const result = await callAI(system, [{ role: "user", content: userMsg }], {
    json: true,
    shape: { requiredKeys: ["patterns"] },
  });
  for (const p of result.patterns || []) {
    memoryService.remember(userId, { type: "mentor_note", text: `Detected pattern: ${p.insight}` });
  }
  return result;
}

async function chat(userId, { profile, missions, feedback, history, patterns, mode, scenario, metrics, documents }) {
  const lastUserMsg = history[history.length - 1]?.content || "";

  // ---- AI Simulator (Part 11) ----
  // A distinct persona: the AI plays the counterpart (investor, customer,
  // candidate...) instead of being the founder's mentor, so they can
  // practice a high-stakes conversation before having it for real.
  if (mode === "simulator" && scenario) {
    const system = `You are role-playing as the counterpart in a founder's practice conversation — NOT as their mentor. Scenario: ${scenario}. Stay fully in character as that counterpart (investor/customer/candidate/negotiator, whichever the scenario implies) — be realistically skeptical, ask real follow-up questions, don't make it easy, but stay plausible and professional. Founder's company for context: ${profile.startupName} — ${profile.oneLiner}, stage ${profile.stage}. If the founder explicitly asks for feedback or says the practice is over, break character and give a short, honest evaluation: 2-3 concrete strengths, 2-3 concrete areas to improve, framed as an opinion from someone who just role-played this scenario with them — never a fabricated numeric score.`;
    return callAI(system, history, { maxTokens: 1000 });
  }

  const memoryBlock = memoryService.memoriesToPromptBlock(memoryService.retrieve(userId, lastUserMsg));
  const downvoteNotes = (feedback || [])
    .filter((f) => f.context === "chat" && f.rating === "down")
    .slice(-3)
    .map((f) => f.comment)
    .filter(Boolean);

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

  const reasoningBlock = isSubstantive
    ? `

INTERNAL REASONING (do this thinking before you answer, whether or not you show it):
- Contradictions: does anything the founder believes or wants conflict with something else they've said (now or in memory)? e.g. wanting enterprise customers while refusing sales, premium pricing for a student audience, claiming validation with no real customer contact.
- Missing information: what's the one or two pieces of information that would most change your recommendation if you had them? Only ask if it's truly material — don't interrogate.
- Root cause: if they've described a symptom ("I need more users"), what's the actual underlying problem (no activation? no distribution? no PMF?) — address that, not the symptom.
- Risk: the single biggest risk in what they're describing, if any — market, technical, financial, execution, or founder-side.
- Opportunity: a genuinely higher-leverage option they may be missing, if one exists.
- Prioritization: if multiple things matter, name the ONE highest-impact next step — resist listing many.
- Decision quality: is their current thinking grounded in evidence, a labeled assumption, emotion, or guesswork? Say which, plainly, when it matters.

If — and only if — this reasoning surfaced something genuinely worth naming (not for routine or trivial exchanges), end your reply with a compact block in exactly this format:

🧠 Reasoning
Core Problem: [1 short line]
Biggest Assumption: [1 short line, or "None flagged" if nothing stood out]
Main Risk: [1 short line, or "None flagged"]
Missing Information: [1 short line, or "Nothing critical missing"]
Recommended Next Step: [1 short, concrete action]
Confidence: [Low / Medium / High — never a percentage or fabricated score]

Skip this block entirely for greetings, acknowledgments, simple factual lookups, or anything where forcing a reasoning summary would just be noise.`
    : "";

  const system = `You are the AI mentor inside Founder Companion — a supportive, honest, calm, evidence-based co-founder to ${profile.founderName}, founder of ${profile.startupName} (${profile.oneLiner}). Current stage: ${profile.stage}. Strengths: ${(profile.strengths || []).join(", ")}. Growth areas: ${(profile.growthAreas || []).join(", ")}. Recent missions: ${(missions || []).slice(-5).map((m) => `${m.title} (${m.status})`).join("; ") || "none yet"}.
${metrics ? `\nCURRENT STARTUP METRICS (read these automatically — never ask the founder to restate numbers you already have here): ${JSON.stringify(metrics)}` : ""}
${documentBlock}
${jurisdictionBlock}
${reasoningBlock}

FOUNDER MEMORY (use naturally, don't just recite it):
${memoryBlock}
${patterns?.length ? `\nPATTERNS TO PROACTIVELY MENTION IF RELEVANT: ${patterns.map((p) => p.insight).join(" | ")}` : ""}
${downvoteNotes.length ? `\nFounder has flagged responses unhelpful for: ${downvoteNotes.join("; ")}. Adjust accordingly.` : ""}

Never use generic motivational quotes or fake certainty, and never surface a raw confidence percentage, accuracy score, or model name anywhere in your reply, including the reasoning block — express certainty only in plain language or the Low/Medium/High label specified above.

SCOPE: You exist to help this founder build their company — strategy, hiring, pricing, sales, marketing, fundraising, customers, financials, product, operations, growth, decisions, and anything grounded in their actual business. If a message is clearly unrelated to their company (sports, movies, general trivia, unrelated coding help, etc.), say briefly and warmly that you're focused on helping them build ${profile.startupName}, and redirect back to something relevant — don't just refuse coldly, and don't be rigid about borderline cases (a founder venting about a bad day, or asking something tangential but work-adjacent, is still in scope).

RESPONSE STYLE — this matters as much as the content:
- Whenever you state a money amount, format it as the founder's currency symbol immediately followed by the number with proper locale-appropriate comma grouping — e.g. "₹30,000" for INR (Indian digit grouping: thousands, then lakhs/crores, e.g. ₹3,00,000 not ₹300,000), "$30,000" for USD (Western grouping). Founder's currency: ${profile.currency || "USD"}. Never show a raw unformatted number like "30000" for a money amount.
- Be direct. Lead with the answer or the recommendation, not a preamble.
- Default to short bullet points or numbered steps over paragraphs, especially for anything actionable.
- Cut narrative framing ("let's think about this...", "here's the thing..."). State it plainly.
- End actionable answers with a clear next step, not a vague sign-off.
- Keep the main reply as short as the question allows — a one-line answer to a one-line question is correct, not lazy. Expand only when the founder's question genuinely needs the detail.
- The main reply should stay roughly within 250 tokens; the optional Reasoning block adds a small amount on top of that when it's actually warranted — the total should still read as compact, not as two separate essays.
${relevantChunks.length ? `\nWhen you use a company document above, end your reply with a short "Sources Used" line naming the document(s) by filename (e.g. "Sources Used: Employee_Handbook.pdf").` : ""}`;

  const { text: replyText, citations } = await callAI(system, history, { maxTokens: 450, enableWebSearch: canSearch, returnCitations: true });
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
  const system = `Translate the following text into ${targetLanguage}. Preserve the original meaning, tone, formatting (line breaks, bullets), and any numbers/currency exactly. Output ONLY the translated text — no preamble, no explanation, no notes about the translation.`;
  const translated = await callAI(system, [{ role: "user", content: text }], { maxTokens: 800 });
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

// ---- Metrics extraction from uploaded documents ----
// Deliberately conservative: the model is told to extract ONLY values
// explicitly and unambiguously stated in the text, never to estimate,
// infer, or average. This function returns candidates for the founder to
// review — it never writes to the Metrics tab itself; that's a client-side
// decision after explicit confirmation, on purpose.
// ---- Natural-language onboarding ----
// Replaces a multi-step questionnaire: the founder describes their
// startup in their own words, this pulls out whatever's genuinely
// inferable. Anything not clearly stated stays null — never guessed —
// so the review step can ask specifically for what's missing instead of
// silently making something up.
async function extractCompanyProfile(userId, { description }) {
  const system = `Extract startup profile fields from a founder's own free-text description of their company. Output ONLY JSON:
{
  "startupName": string|null,
  "oneLiner": string|null — a short, factual description in the founder's own words, not marketing copy,
  "industry": string|null,
  "businessModel": string|null — e.g. "Subscription", "Marketplace", "Usage-based", only if genuinely inferable,
  "stage": string|null — one of "Idea", "Pre-seed", "Seed", "Series A", "Series B+", "Bootstrapped", "Growth" — only if stated or strongly implied,
  "teamSize": number|null,
  "country": string|null
}
Extract ONLY what's explicitly stated or unambiguously implied. If the founder didn't mention something, output null for it — never infer a plausible-sounding default. A missing field the founder gets asked about directly is much better than a wrong guess treated as fact.`;

  return callAI(system, [{ role: "user", content: description.slice(0, 3000) }], {
    json: true,
    shape: { requiredKeys: ["startupName", "oneLiner"] },
    maxTokens: 400,
  });
}

// ---- Chat-stated metric updates ----
// "Revenue was ₹3.2 lakh this month" typed directly into chat should be
// able to update Metrics too, not just document uploads — same
// conservative extraction and same confirm-before-write flow the
// document path uses (see extractMetricsFromDocument and
// MetricsExtractionReview on the frontend). This does not bypass the
// Metrics lock: applying a value here still goes through the same
// confirmation step, it's just a second on-ramp, not a shortcut around it.
async function extractMetricsFromChatText(userId, { text, metricFields }) {
  const system = `A founder just typed a message that may contain startup metric values. Extract ONLY values explicitly and unambiguously stated — never estimate or infer. Casual phrasing is fine ("we made 3.2 lakh this month" means revenue; "got 46 new customers" means monthly new customers) but the number itself must be stated, not implied.

Output ONLY JSON: { "values": { "<metricKey>": <number>, ... } } — include only keys you're confident about. Output { "values": {} } if the message doesn't clearly state any metric value.

Metric fields to look for:
${metricFields.map((f) => `- ${f.key} (${f.label}, unit: ${f.unit || "count"})`).join("\n")}`;

  const result = await callAI(system, [{ role: "user", content: text.slice(0, 2000) }], {
    json: true,
    shape: { requiredKeys: ["values"] },
    maxTokens: 300,
  });
  return result.values || {};
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

Never invent a "connect your startup to ChatGPT" step — it doesn't exist. Everything here should be something the founder can literally publish or do today.`;

  const recentHistory = (history || []).slice(-4).map((m) => ({ role: m.role, content: m.content }));
  const { text, citations } = await callAI(system, [...recentHistory, { role: "user", content: "Run a GEO / AI-visibility check for my startup." }], {
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

A founder who hears "unclear, go talk to 10 people directly" and acts on it is better off than one who hears an inflated "yes, people want this." Never invent a thread, quote, subreddit, or number that wasn't actually found.`;

  const recentHistory = (history || []).slice(-6).map((m) => ({ role: m.role, content: m.content }));
  const { text, citations } = await callAI(system, [...recentHistory, { role: "user", content: idea }], {
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

async function generateBusinessAdvice(userId, { profile, businessState, metrics }) {
  const system = withMemoryContext(
    userId,
    "business advice",
    `You are the AI Business Advisor inside Founder Companion. Given the founder's current business state and computed metrics, output ONLY JSON: {"recommendations": [string] (3-5 short, specific, evidence-based recommendations)}. Each recommendation must reference an actual number or trend from the data given — never generic advice like "grow faster". If a metric looks concerning (low runway, rising CAC, negative net profit), say so plainly.`
  );
  const userMsg = JSON.stringify({ stage: profile.stage, businessState, metrics });
  return callAI(system, [{ role: "user", content: userMsg }], {
    json: true,
    shape: { requiredKeys: ["recommendations"] },
  });
}

async function generateMissionImpact(userId, { profile, businessState, mission }) {
  const dnaKeys = Object.keys(profile.skills || {});
  const system = `You are a business analyst inside Founder Companion, estimating the plausible business impact of a mission the founder just completed, verifying whether it actually achieved what it set out to do, and updating their Founder DNA. Given the mission (including what it predicted — problemDetected, businessMetricAffected, verificationMethod — and the proof they submitted) and the business's current state, output ONLY JSON:
{
  "deltas": { "monthlyRevenue": number, "customers": number, "marketingSpend": number, "monthlyExpenses": number, "hostingCost": number, "aiCost": number, "cash": number } (each a realistic CHANGE, zero if not plausibly affected — most should be 0),
  "summary": "1 short sentence describing the business impact",
  "healthDelta": number (-5 to +5),
  "worked": "yes"|"partially"|"unclear"|"no" (did the proof submitted actually satisfy the mission's own verificationMethod and address its problemDetected?),
  "workedReasoning": "1 sentence explaining the worked assessment, referencing the actual proof given",
  "dnaDeltas": { 1-2 keys from ${JSON.stringify(dnaKeys)}, each a small integer -1 to +2 } (which Founder DNA dimensions this specific mission's execution should nudge, and by how much — omit dimensions with no plausible connection)
}
Be conservative and realistic — a single mission rarely moves revenue by more than a few thousand. Base everything on the mission's actual content and proof, not wishful thinking. If the proof is thin (e.g. a vague description), say "worked": "unclear" rather than assuming success.`;
  const userMsg = JSON.stringify({
    mission: {
      title: mission.title, description: mission.description, why: mission.why, impact: mission.impact,
      problemDetected: mission.problemDetected, businessMetricAffected: mission.businessMetricAffected, verificationMethod: mission.verificationMethod,
      proofType: mission.proofType, proofDescription: mission.proofDescription, proofUrl: mission.proofUrl, hasScreenshot: !!mission.proofImage,
    },
    businessState,
    currentSkills: profile.skills,
  });
  const result = await callAI(system, [{ role: "user", content: userMsg }], {
    json: true,
    shape: { requiredKeys: ["deltas", "summary"] },
  });

  // Anonymized execution-pattern logging (Part 9 foundation) — no PII, not
  // read back into any prompt yet. See migrations/003_execution_patterns.js.
  try {
    executionPatternRepo.log({
      businessModel: businessState?.businessModel,
      companyStage: businessState?.companyStage,
      missionCategory: mission.businessMetricAffected || "general",
      difficulty: mission.difficulty,
      outcome: result.worked || "unclear",
      revenueDelta: result.deltas?.monthlyRevenue,
      customersDelta: result.deltas?.customers,
    });
  } catch (e) {
    console.error("[executionPatternRepo] log failed:", e.message);
  }

  return result;
}

// ============================================================
// FounderOS V2 — AI Decision Intelligence Platform
// ============================================================

// ---- Decision Simulator (the core loop) ----
// Deliberately returns RANGES with reasoning, never a fake-precise single
// number or a fabricated "confidence score" percentage. An LLM has no
// calibrated model behind "73% confidence" — a range plus a stated
// confidence LABEL plus real reasoning is the honest version of the same
// idea, and it's what actually helps a founder reason about risk.
// ---- Clarifying Questions ----
// Never predict on too little information — ask the minimum needed first.
async function checkDecisionReadiness(userId, { companyProfile, metrics, decision }) {
  const system = `You are a pre-flight check for the FounderOS Decision Simulator. Given a founder's decision and their known company metrics, decide whether there's enough information to make a grounded prediction, or whether a couple of quick answers would meaningfully improve it. Output ONLY JSON:
{
  "readyToPredict": boolean,
  "missingInfo": [ {"question": string, "why": "1 short phrase — why this specific answer would change the prediction"} ] (0-4 items; empty if readyToPredict is true)
}
Only ask for information that would genuinely change the prediction's direction or magnitude — not everything theoretically useful. If the company's known metrics already cover the essentials for this specific decision, set readyToPredict true with an empty list rather than asking for the sake of it.`;
  const userMsg = JSON.stringify({ companyProfile, knownMetrics: metrics, decision });
  return callAI(system, [{ role: "user", content: userMsg }], {
    json: true,
    shape: { requiredKeys: ["readyToPredict", "missingInfo"] },
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

// ---- Learning Record ----
// Real learning, honestly described: this writes a reflection on what the
// simulation got right/wrong, and stores it so future simulate calls for
// this founder see it as context (via pastDecisions.pastLearning above and
// memory). This is NOT a weight update or a model version bump — there is
// no trainable model here — it's richer context for the next prediction,
// which is the honest version of "the system learns from outcomes."
async function generateLearningSummary(userId, { decision, accuracyResults, feedbackText, feedbackDifference, feedbackRating }) {
  const system = `You are the FounderOS Learning Engine. A decision simulation has been completed and the founder reported actual outcomes. Identify what the prediction got wrong (if anything) and extract a lesson for future predictions. Output ONLY JSON:
{
  "whatWasWrong": [0-3 short strings — specific assumptions or predictions that didn't hold up, empty array if the prediction was essentially accurate],
  "lessonsForFuture": [1-3 short strings — concrete, specific things to weigh differently next time a similar decision is simulated for this company]
}
Ground everything in the actual accuracy numbers and founder feedback given — never invent a lesson unsupported by the data.`;
  const userMsg = JSON.stringify({
    decisionText: decision.decisionText,
    predictions: (decision.predictions || []).map((p) => ({ metric: p.metric, predictedLow: p.predictedLow, predictedHigh: p.predictedHigh, reasoning: p.reasoning })),
    keyAssumptions: decision.keyAssumptions,
    accuracyResults,
    feedbackRating,
    feedbackDifference,
    feedbackText,
  });
  const result = await callAI(system, [{ role: "user", content: userMsg }], {
    json: true,
    shape: { requiredKeys: ["whatWasWrong", "lessonsForFuture"] },
  });
  if (result.lessonsForFuture?.length) {
    memoryService.remember(userId, { type: "recurring_blocker", text: `Decision "${decision.decisionText}" lesson: ${result.lessonsForFuture.join("; ")}` });
  }
  return result;
}

// ---- Startup Health Score (Home command center) ----
async function generateStartupHealth(userId, { companyProfile, metrics }) {
  const system = `You are a startup health analyst inside FounderOS. Given the company's profile and whatever metrics are known (many may be null/Unknown — never invent values for those), output ONLY JSON:
{ "score": number 0-100, "reasoning": "2-3 sentences grounded in the actual known metrics", "dataCompleteness": "low"|"medium"|"high" (how much of the metric picture is actually known vs Unknown) }
Score conservatively when data is thin — a 45-55 "we don't know enough yet" is more honest than a confident-looking number built on mostly-null data. Say so plainly in the reasoning if data completeness is low.`;
  const userMsg = JSON.stringify({ companyProfile, metrics });
  return callAI(system, [{ role: "user", content: userMsg }], {
    json: true,
    shape: { requiredKeys: ["score", "reasoning"] },
  });
}

// ---- AI Founder Advisor ----
// Synthesizes companyProfile, metrics, decision history, and the cached
// startup health score into one mentor-style briefing. Schema is
// deliberately kept compact (fewer items, short strings) so the full
// response reliably fits in a modest token budget without truncation —
// a summary-grade briefing, not an essay. Never invents data it wasn't
// given; anything unknown goes in missingInfo.
async function generateFounderAdvisor(userId, { companyProfile, metrics, decisions, healthLatest }) {
  const system = withMemoryContext(
    userId,
    "AI Founder Advisor briefing",
    `You are the AI Founder Advisor inside FounderOS — reason like an experienced startup mentor who just reviewed this founder's company profile, metrics, decision history, and latest health check. Be concise: every string is a short, high-density sentence or phrase, never a paragraph. Never repeat a metric back as insight — explain the underlying WHY briefly. Never invent data you weren't given — unknowns go in missingInfo. Output ONLY compact JSON, no markdown, no whitespace beyond what's needed:
{
  "topPriorities": [ { "title": string, "priority": "Critical"|"High"|"Medium"|"Low", "why": "max 15 words", "impact": "Very High"|"High"|"Medium"|"Low", "effort": "Low"|"Medium"|"High", "time": "short e.g. '2 days'" } ] (exactly 3 items, highest impact first),
  "nextBestAction": { "title": string, "reasoning": "max 20 words", "estimatedImpact": [1-2 short strings], "estimatedTime": string, "confidence": number(0-100) },
  "risks": [ { "severity": "critical"|"high"|"medium"|"low"|"healthy", "label": "max 5 words", "description": "max 15 words", "mitigation": "max 15 words" } ] (exactly 3 items),
  "opportunities": [ { "title": string, "expectedImpact": "max 6 words", "difficulty": "Low"|"Medium"|"High", "timeline": "short" } ] (exactly 2 items),
  "insights": [2 short one-sentence observations, max 20 words each],
  "rootCauseAnalysis": [ { "problem": "short name", "likelyCauses": [2-3 short phrases, max 6 words each] } ] (0-1 items; omit array entirely if nothing is clearly underperforming),
  "actionPlan": { "week1": [2 short phrases], "week2": [2 short phrases], "week3": [2 short phrases], "week4": [2 short phrases] },
  "overallConfidence": number(0-100),
  "confidenceReasoning": "max 15 words",
  "missingInfo": [0-2 short phrases]
}
Stay strictly within these item counts and word limits — brevity is required, not optional. Base every claim on the evidence given; adjust substance to this founder's actual stage and numbers, never generic advice.`
  );

  const userMsg = JSON.stringify({
    companyProfile,
    currentMetrics: metrics,
    recentDecisions: (decisions || []).slice(-4).map((d) => ({
      decisionText: d.decisionText,
      status: d.status,
      overallConfidence: d.overallConfidence,
      accuracySummary: d.accuracyResults?.length
        ? d.accuracyResults.map((a) => `${a.metric}: predicted ~${a.predictedMid}, actual ${a.actual}`).join("; ")
        : undefined,
      pastLearning: d.learningSummary?.lessonsForFuture,
    })),
    latestHealthCheck: healthLatest ? { score: healthLatest.score, reasoning: healthLatest.reasoning } : undefined,
  });

  const result = await callAI(system, [{ role: "user", content: userMsg }], {
    json: true,
    maxTokens: 1400,
    shape: { requiredKeys: ["topPriorities", "nextBestAction", "risks", "opportunities", "insights", "actionPlan", "overallConfidence"] },
  });

  if (result.insights?.length) {
    memoryService.remember(userId, { type: "mentor_note", text: `Founder Advisor insight: ${result.insights[0]}` });
  }
  return result;
}
module.exports = {
  generateProfile,
  generateMission,
  generateDecision,
  generateHealth,
  generateMetricsRecommendation,
  generateWeeklyReport,
  detectPatterns,
  generateBusinessAdvice,
  generateMissionImpact,
  generateFounderBrief,
  generateLesson,
  generatePrediction,
  generateDecisionSimulation,
  checkDecisionReadiness,
  generateLearningSummary,
  generateStartupHealth,
  generateFounderAdvisor,
  chat,
  generateChatTitle,
  translateText,
  compareGrowthOptions,
  validateProductIdea,
  analyzeGeoReadiness,
  extractMetricsFromDocument,
  extractCompanyContext,
  extractMetricsFromChatText,
  extractCompanyProfile,
  compareOutcomeToPrediction,
  providerName: provider.name,
};
