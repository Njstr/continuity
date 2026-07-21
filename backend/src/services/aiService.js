const config = require("../config");
const { createProvider } = require("../providers");
const { retry, withTimeout } = require("../utils/retry");
const { parseAndValidate } = require("../utils/validateJSON");
const memoryService = require("./memoryService");
const executionPatternRepo = require("../repositories/executionPatternRepository");

// aiService — the single choke point every route calls through.
//
// generateMission(), generateDecision(), generateHealth(), etc. all share
// this one client instead of duplicating provider calls, retry logic,
// timeout handling, and JSON validation in every route file.

const provider = createProvider(config);

/**
 * Low-level call: retry + timeout + optional JSON validation, wrapped
 * around whatever provider is currently configured.
 */
async function callAI(system, messages, { json = false, shape, maxTokens = 1000 } = {}) {
  const rawText = await retry(
    (attempt) =>
      withTimeout(
        (signal) => provider.complete(system, messages, { maxTokens, signal }),
        config.requestTimeoutMs
      ),
    { attempts: 2 }
  );

  if (!json) return rawText;
  return parseAndValidate(provider, rawText, { shape, system, messages });
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

async function chat(userId, { profile, missions, feedback, history, patterns, mode, scenario, metrics }) {
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

  const system = `You are the AI mentor inside Founder Companion — a supportive, honest, calm, evidence-based co-founder to ${profile.founderName}, founder of ${profile.startupName} (${profile.oneLiner}). Current stage: ${profile.stage}. Strengths: ${(profile.strengths || []).join(", ")}. Growth areas: ${(profile.growthAreas || []).join(", ")}. Recent missions: ${(missions || []).slice(-5).map((m) => `${m.title} (${m.status})`).join("; ") || "none yet"}.
${metrics ? `\nCURRENT STARTUP METRICS (read these automatically — never ask the founder to restate numbers you already have here): ${JSON.stringify(metrics)}` : ""}

FOUNDER MEMORY (use naturally, don't just recite it):
${memoryBlock}
${patterns?.length ? `\nPATTERNS TO PROACTIVELY MENTION IF RELEVANT: ${patterns.map((p) => p.insight).join(" | ")}` : ""}
${downvoteNotes.length ? `\nFounder has flagged responses unhelpful for: ${downvoteNotes.join("; ")}. Adjust accordingly.` : ""}

Never use generic motivational quotes or fake certainty, and never surface a raw confidence percentage, accuracy score, or model name — express certainty only in plain language (e.g. "I'm fairly sure" vs "this is a rough guess"). Explain your reasoning briefly. Keep responses conversational and concise. If a question touches legal, financial, tax, or health territory, note briefly you're not a licensed professional.`;

  const reply = await callAI(system, history, { maxTokens: 1000 });

  // Only remember substantive exchanges, not every "ok thanks"
  if (lastUserMsg.length > 40) {
    memoryService.remember(userId, { type: "mentor_note", text: `Founder asked: "${lastUserMsg.slice(0, 200)}" → mentor: "${reply.slice(0, 200)}"` });
  }
  return reply;
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

async function generateDecisionSimulation(userId, { companyProfile, metrics, decision, history, decisionContext }) {
  const system = withMemoryContext(
    userId,
    `decision simulation: ${decision}`,
    `You are the Decision Simulator inside FounderOS. A founder is about to make a business decision. Predict the plausible consequences on their real startup metrics. Output ONLY JSON:
{
  "predictions": [
    { "metric": "human label e.g. Revenue", "metricKey": "one of the known metric keys this plausibly affects, or a short camelCase key if none fit", "currentValue": number|null, "predictedLow": number|null, "predictedHigh": number|null, "direction": "increase"|"decrease"|"flat"|"uncertain", "reasoning": "1 sentence explaining WHY it changes", "confidence": "low"|"medium"|"high" }
  ] (3-6 of the metrics this decision most plausibly affects — skip metrics it wouldn't touch, use null for currentValue if the founder's baseline for that metric is unknown, and null for predictedLow/High if you genuinely can't ground a range without inventing one),
  "bestCase": "1-2 sentences, plausible optimistic scenario",
  "expectedCase": "1-2 sentences, the most likely scenario",
  "worstCase": "1-2 sentences, plausible pessimistic scenario",
  "keyAssumptions": [2-4 short strings — what has to be true for this prediction to hold],
  "mainRisks": [2-4 short strings],
  "unknownVariables": [1-3 short strings — specific things you don't know that would meaningfully change this prediction if known],
  "overallConfidence": "low"|"medium"|"high"
}
Never invent a precise number where the founder's baseline is unknown — say the range is uncertain instead. Ground every reasoning string in the actual company context given, not generic startup wisdom. If pastLearning entries are given, apply them — don't repeat an assumption previously flagged as wrong for this founder without accounting for it. Present this as a forecast, never a guarantee.`
  );
  const userMsg = JSON.stringify({
    companyProfile,
    currentMetrics: metrics,
    decision,
    decisionContext: decisionContext || undefined,
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
  providerName: provider.name,
};
