// activityEvidenceEngine.js — bridges the Activity layer (things
// FounderOS observed) to the execution engine's evidence system, so the
// founder isn't asked to manually re-describe work FounderOS already saw
// happen. See migration 008 for the schema this reads/writes.
//
// Design principle this file exists to enforce: an activity becomes
// evidence only after a relevance judgment (deterministic or AI), and
// evidence only completes a task after the exact same threshold check
// executionEngine.verifyEvidence already enforces for manual evidence —
// this file never marks anything complete on its own; it only ever calls
// into that one existing, already-safety-checked function.

const repo = require("../repositories/executionRepository");
const activityRepo = require("../repositories/activityRepository");
const aiService = require("../services/aiService");
const executionEngine = require("./executionEngine");

// §12 — obvious (task-type, activity-type) pairs that don't need an AI
// call to know they're related. Kept deliberately small and conservative
// — anything not listed here falls through to the AI matcher rather than
// guessing. Each entry maps an activity `type` to the kind of task title/
// evidenceRequirements language it plausibly satisfies; the actual
// decision still runs through the same wording check as the AI path
// would reach for, just skipping the network round-trip when it's this
// unambiguous.
const DETERMINISTIC_HINTS = {
  document_uploaded: /\b(document|upload|file|pdf|notes|research|report)\b/i,
  metrics_extracted_from_document: /\b(metric|financial|revenue|number|data)\b/i,
  decision_recorded: /\b(decision|decide|pricing|hire|launch)\b/i,
  decision_outcome_recorded: /\b(outcome|result|check.?in|follow.?up)\b/i,
};

function deterministicMatch(task, activity) {
  const pattern = DETERMINISTIC_HINTS[activity.type];
  if (!pattern) return null;
  const haystack = `${task.title} ${task.evidenceRequirements || ""} ${task.completionCriteria || ""}`;
  if (!pattern.test(haystack)) return null;
  // Still a real judgment, just made without an AI round-trip — a
  // system-observed action is inherently stronger than a bare claim, but
  // capped at "medium" here since a deterministic keyword match hasn't
  // actually confirmed the activity covers what the task needs the way
  // an AI read of the actual content could.
  return { relevant: true, relevanceScore: 0.6, strength: "medium", reasoning: "Deterministic type/keyword match." };
}

// The main entry point — called after any real, meaningful action in the
// product (see the route hooks in documents.js, decisions.js, chat.js).
// Records the activity, then checks it against the founder's current
// task only (the whole architecture surfaces exactly one active task at
// a time, so there's never a large task list to fan this out across).
async function recordActivity(userId, { type, source, entityId, metadata, description, dedupeKey }) {
  const activity = activityRepo.record({ userId, type, source, entityId, metadata, description, dedupeKey });

  try {
    await matchAgainstCurrentTask(userId, activity);
  } catch (e) {
    // Matching is a best-effort enhancement on top of an activity that's
    // already safely recorded — a matching failure should never make the
    // triggering action (an upload, a decision save) look like it failed.
    // Still logged, not swallowed silently (see the audit note in
    // routes/*.js hooks and the production-readiness pass's error-handling
    // work).
    // eslint-disable-next-line no-console
    console.error(`[activityEvidenceEngine] matching failed for activity ${activity.id}:`, e.message);
  }

  return activity;
}

async function matchAgainstCurrentTask(userId, activity) {
  const task = executionEngine.selectCurrentTask(userId);
  if (!task) return null;
  // Only tasks actually waiting on the founder can receive automatic
  // evidence — a LOCKED/dependency-blocked task isn't "current" yet.
  if (!["AVAILABLE", "IN_PROGRESS", "AWAITING_EVIDENCE"].includes(task.status)) return null;

  const evidenceConfig = task.evidenceConfig || {};
  if (evidenceConfig.canAutoVerify === false && evidenceConfig.legacy) {
    // Legacy task with no evidence_config (§16) — still allow matching
    // (more evidence is never harmful to surface), but don't let it
    // silently auto-complete a task that predates this system without at
    // least going through the same scoring/threshold check every other
    // task uses. verifyEvidence below applies that check regardless, so
    // this is really just documentation of intent, not a code branch.
  }

  // §14 — never let the same activity produce two evidence rows against
  // the same task (e.g. if recordActivity somehow ran twice for one
  // event).
  if (repo.hasEvidenceForActivity(task.id, activity.id)) return null;

  const currentStep = task.steps?.[task.currentStepIndex];

  let match = deterministicMatch(task, activity);
  if (!match) {
    match = await aiService.matchActivityToTask(userId, { task, currentStep, activity }).catch((e) => {
      console.error(`[activityEvidenceEngine] AI match call failed for task ${task.id}, activity ${activity.id}:`, e.message);
      return { relevant: false };
    });
  }

  if (!match?.relevant) return null;

  // Route through the exact same evidence-verification path manual
  // submissions use — same threshold check, same completion enforcement,
  // no parallel logic to drift out of sync with it. The activity's own
  // description becomes the "evidence text" fed into that scoring.
  return executionEngine.verifyEvidence(userId, task, currentStep, activity.description, {
    source: "activity",
    activityId: activity.id,
    relevanceScore: match.relevanceScore,
  });
}

module.exports = { recordActivity, matchAgainstCurrentTask };
