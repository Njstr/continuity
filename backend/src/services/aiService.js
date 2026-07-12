const config = require("../config");
const { createProvider } = require("../providers");
const { retry, withTimeout } = require("../utils/retry");
const { parseAndValidate } = require("../utils/validateJSON");
const memoryService = require("./memoryService");

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

// ---------------- Feature-specific generators ----------------

async function generateProfile(userId, answers) {
  const system = `You are the onboarding intelligence for Founder Companion, an AI co-founder for first-generation founders. Given raw onboarding answers, output ONLY a JSON object (no markdown, no prose) with this exact shape:
{
  "founderName": string, "startupName": string, "oneLiner": string,
  "stage": "Idea"|"Problem Validation"|"Solution Validation"|"MVP"|"Early Customers"|"Product-Market Fit"|"Growth"|"Scale"|"Fundraising"|"Expansion",
  "strengths": [2-3 short strings], "growthAreas": [2-3 short strings],
  "skills": { one key per skill in ["Customer Discovery","Sales","Marketing","Negotiation","Hiring","Leadership","Product Thinking","Finance","Fundraising","Networking","Execution","Strategic Thinking"], each {"current": number 1-10, "target": number 1-10} },
  "welcomeNote": "2-3 warm, honest, specific sentences referencing something they actually said",
  "growthScore": number 1-100
}
Estimate skill levels conservatively. Be specific, never generic.`;
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

async function generateMission(userId, { profile, missions }) {
  const system = withMemoryContext(
    userId,
    `mission for stage ${profile.stage} growth areas ${(profile.growthAreas || []).join(" ")}`,
    `You are the daily mentor for a first-generation founder using Founder Companion. Given their profile and memory, output ONLY JSON: {"title": string, "minutes": number, "impact": string, "why": string}. The mission must be one concrete, specific action achievable today, matched to their current stage and weakest growth area. Never generic advice — name the exact action.`
  );
  const userMsg = JSON.stringify({
    stage: profile.stage,
    growthAreas: profile.growthAreas,
    skills: profile.skills,
    recentMissions: (missions || []).slice(-5).map((m) => m.title),
  });
  const mission = await callAI(system, [{ role: "user", content: userMsg }], {
    json: true,
    shape: { requiredKeys: ["title", "impact", "why"] },
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

async function generateWeeklyReport(userId, { profile, answers, missions }) {
  const system = withMemoryContext(
    userId,
    "weekly founder review",
    `You are the weekly review analyst inside Founder Companion. Output ONLY JSON:
{ "progressSummary": string, "keyAccomplishments": [strings], "repeatedProblems": [strings], "metricsTrend": string, "strategicAdvice": string, "topPriorities": [{"title": string, "why": string}] (exactly 3) }
Never use generic encouragement. Reference what they actually wrote.`
  );
  const userMsg = JSON.stringify({ stage: profile.stage, answers, recentMissions: (missions || []).slice(-7).map((m) => ({ title: m.title, status: m.status })) });
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

async function chat(userId, { profile, missions, feedback, history, patterns }) {
  const lastUserMsg = history[history.length - 1]?.content || "";
  const memoryBlock = memoryService.memoriesToPromptBlock(memoryService.retrieve(userId, lastUserMsg));
  const downvoteNotes = (feedback || [])
    .filter((f) => f.context === "chat" && f.rating === "down")
    .slice(-3)
    .map((f) => f.comment)
    .filter(Boolean);

  const system = `You are the AI mentor inside Founder Companion — a supportive, honest, calm, evidence-based co-founder to ${profile.founderName}, founder of ${profile.startupName} (${profile.oneLiner}). Current stage: ${profile.stage}. Strengths: ${(profile.strengths || []).join(", ")}. Growth areas: ${(profile.growthAreas || []).join(", ")}. Recent missions: ${(missions || []).slice(-5).map((m) => `${m.title} (${m.status})`).join("; ") || "none yet"}.

FOUNDER MEMORY (use naturally, don't just recite it):
${memoryBlock}
${patterns?.length ? `\nPATTERNS TO PROACTIVELY MENTION IF RELEVANT: ${patterns.map((p) => p.insight).join(" | ")}` : ""}
${downvoteNotes.length ? `\nFounder has flagged responses unhelpful for: ${downvoteNotes.join("; ")}. Adjust accordingly.` : ""}

Never use generic motivational quotes or fake certainty. Explain your reasoning briefly. Keep responses conversational and concise. If a question touches legal, financial, tax, or health territory, note briefly you're not a licensed professional.`;

  const reply = await callAI(system, history, { maxTokens: 1000 });

  // Only remember substantive exchanges, not every "ok thanks"
  if (lastUserMsg.length > 40) {
    memoryService.remember(userId, { type: "mentor_note", text: `Founder asked: "${lastUserMsg.slice(0, 200)}" → mentor: "${reply.slice(0, 200)}"` });
  }
  return reply;
}

module.exports = {
  generateProfile,
  generateMission,
  generateDecision,
  generateHealth,
  generateMetricsRecommendation,
  generateWeeklyReport,
  detectPatterns,
  chat,
  providerName: provider.name,
};
