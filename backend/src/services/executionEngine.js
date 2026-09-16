// executionEngine.js — orchestrates the evidence-gated task loop described
// in the FounderOS execution-engine spec. This file is the "production
// safety" layer: aiService's execution functions PROPOSE (a score, a
// classification, a candidate task); everything in this file DECIDES,
// by checking those proposals against real thresholds and real
// dependency state in the database before ever writing a status change.
//
// The one rule this file exists to enforce: a task's status only ever
// becomes COMPLETED inside verifyEvidence(), and only after checking
// `verificationScore >= task.requiredThreshold` in a plain JS `if`
// statement. No other code path sets status to COMPLETED. If the model
// says "great, that's done!" in some other context, that text never
// reaches the founder from here — see classifyExecutionMessage's own
// restriction (aiService.js) and how its output is used below.

const aiService = require("./aiService");
const repo = require("../repositories/executionRepository");
const decisionRepo = require("../repositories/decisionLifecycleRepository");
const aiTools = require("./aiTools");
const webResearch = require("./webResearchService");

// ---- Per-founder mutex (§8 — race-condition protection) ----
// better-sqlite3 is synchronous, but the generation path awaits AI calls
// in between DB reads/writes — that's a real yield point where two
// concurrent requests for the same founder (e.g. two GET /progress calls
// firing close together on page load) could both observe "no task
// exists" and each generate one. This chains same-founder calls through
// one at a time so the second call always sees what the first one just
// created, rather than racing it. Scoped in-process, which matches this
// app's actual deployment shape (single Node process per backend
// instance, SQLite file, no horizontal scaling) — a distributed lock
// would be solving a problem this architecture doesn't have.
const founderLocks = new Map();
function withFounderLock(userId, fn) {
  const key = String(userId);
  const tail = founderLocks.get(key) || Promise.resolve();
  const run = tail.then(fn, fn);
  founderLocks.set(key, run.catch(() => {}));
  return run;
}

function priorityScore(factors = {}) {
  const impact = clamp01(factors.impact);
  const urgency = clamp01(factors.urgency);
  const uncertaintyReduction = clamp01(factors.uncertaintyReduction);
  const riskReduction = clamp01(factors.riskReduction);
  const effort = Math.max(clamp01(factors.effort), 0.1); // floor so division never explodes
  // Multiplicative on the "why this matters now" factors, divided by
  // effort — matches the spec's conceptual formula. Multiplicative
  // (rather than additive/averaged) is deliberate: a task that's high
  // impact but zero urgency and zero uncertainty-reduction shouldn't
  // outrank a task that's solidly good on every dimension.
  return (impact * urgency * uncertaintyReduction * riskReduction) / effort;
}
function clamp01(n) {
  const v = Number(n);
  if (Number.isNaN(v)) return 0.5;
  return Math.max(0, Math.min(1, v));
}

// ---- Founder/startup state change tracking (§4/§8 — revisit eligibility) ----
// The same flat fields synthesizeFounderState outputs (aiService.js). This
// is the list a task's own revisitConditions is allowed to name, and the
// list mergeStateWithChangeLog watches for real value changes on.
const TRACKED_STATE_FIELDS = [
  "founderName", "founderRole", "founderExperience", "founderSkills", "founderGoals",
  "startupName", "goal", "stage", "problem", "targetCustomer", "currentSolution",
  "businessModel", "traction", "revenue", "competitors", "fundingStatus",
];

// Folds a per-field "when did this last actually change" map into the
// founder_state blob itself (under changeLog.fieldUpdatedAt) rather than
// standing up a separate history table — the whole state is already one
// JSON blob per founder, and this is just one more fact about it. This is
// the "documented reason" §4 asks for: not "time passed" but "this
// specific field's value is different than it was when the task
// completed," checked deterministically in isDuplicateOfCompleted below.
function mergeStateWithChangeLog(priorState, newState) {
  const now = new Date().toISOString();
  const priorFieldUpdatedAt = (priorState && priorState.changeLog && priorState.changeLog.fieldUpdatedAt) || {};
  const fieldUpdatedAt = { ...priorFieldUpdatedAt };
  if (priorState) {
    for (const field of TRACKED_STATE_FIELDS) {
      const before = JSON.stringify(priorState[field] ?? null);
      const after = JSON.stringify(newState[field] ?? null);
      if (before !== after && after !== "null") {
        fieldUpdatedAt[field] = now;
      }
    }
  }
  return { ...newState, changeLog: { fieldUpdatedAt } };
}

// ---- Duplicate-objective detection (§3/§4/§6 Rule 3/Rule 4) ----
// Deterministic, backend-enforced — never relies solely on the model
// honoring "don't repeat yourself" in a prompt.
function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function titleOverlap(a, b) {
  const wordsA = new Set(slugify(a).split("_").filter(Boolean));
  const wordsB = new Set(slugify(b).split("_").filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let shared = 0;
  wordsA.forEach((w) => {
    if (wordsB.has(w)) shared += 1;
  });
  return shared / Math.min(wordsA.size, wordsB.size);
}

// A candidate proposed task is "substantially equivalent" to a completed
// one when they share a normalized objectiveKey, OR (fallback, for tasks
// created before objectiveKey existed / model wording drift) the same
// category plus heavily overlapping title wording. It only counts as a
// genuine duplicate — one the backend rejects outright — when NONE of the
// matched task's own revisitConditions fields have actually changed since
// it completed, per founderState's changeLog. "A significant amount of
// time has passed" is deliberately NOT on its own a revisit trigger here;
// the spec's own example of that is judgment the AI can raise via
// whyItMatters on a future call, but the hard backend gate only reacts to
// documented field changes it can check in plain code.
function isDuplicateOfCompleted(candidate, completedTasks, founderState) {
  const candidateKey = slugify(candidate.objectiveKey || candidate.title);
  const fieldUpdatedAt = (founderState && founderState.changeLog && founderState.changeLog.fieldUpdatedAt) || {};

  const match = completedTasks.find((t) => {
    const completedKey = slugify(t.objectiveKey || t.title);
    if (candidateKey && completedKey && candidateKey === completedKey) return true;
    if (candidate.category && t.category && candidate.category === t.category && titleOverlap(candidate.title, t.title) >= 0.6) return true;
    return false;
  });

  if (!match) return { duplicate: false };

  const revisitFields = match.revisitConditions || [];
  const revisitJustified = revisitFields.some((field) => {
    const changedAt = fieldUpdatedAt[field];
    return !!changedAt && !!match.completedAt && changedAt > match.completedAt;
  });

  return { duplicate: !revisitJustified, matchedTask: match, revisitJustified };
}

// Recomputes priority for every non-completed task and returns the
// highest-scoring one that's actually unblocked (all dependencies
// COMPLETED). This — not "whatever the AI generated first" — is what
// decides which single task the founder sees. Dependency gating is
// enforced here in plain code, not left to the model to respect.
function selectCurrentTask(userId) {
  const all = repo.listTasks(userId);
  const completedIds = new Set(all.filter((t) => t.status === "COMPLETED").map((t) => t.id));
  const completedTitles = new Set(all.filter((t) => t.status === "COMPLETED").map((t) => t.title));

  // Prefer a task already in progress or awaiting more evidence — don't
  // abandon mid-flight work just because something else scores higher.
  const inFlight = all.find((t) => t.status === "IN_PROGRESS" || t.status === "AWAITING_EVIDENCE");
  if (inFlight) return inFlight;

  const eligible = all.filter((t) => {
    if (t.status !== "LOCKED" && t.status !== "AVAILABLE") return false;
    const deps = t.dependencies || [];
    const unblocked = deps.every((depIdOrTitle) => completedIds.has(depIdOrTitle) || completedTitles.has(depIdOrTitle));
    return unblocked;
  });

  if (eligible.length === 0) return null;

  // Recompute scores fresh (priority is a function of current state, not
  // a value fixed at creation time — §3/§12).
  eligible.forEach((t) => {
    const score = priorityScore(t.priorityFactors);
    repo.setPriority(t.id, userId, score, t.priorityFactors);
  });
  eligible.sort((a, b) => priorityScore(b.priorityFactors) - priorityScore(a.priorityFactors));
  const winner = eligible[0];
  // Newly-unblocked/eligible tasks move from LOCKED to AVAILABLE the
  // moment their dependencies clear, even before the founder is shown
  // one — status should always reflect real unlock state, not just "the
  // one currently being shown."
  eligible.forEach((t) => {
    if (t.status === "LOCKED") repo.setStatus(t.id, userId, "AVAILABLE");
  });
  return repo.getTask(winner.id, userId);
}

// ---- Structured context assembly (§14 of the context-aware-task-generation spec) ----
// This is the ONLY place startup/founder context gets collected from the
// database before a task-generation decision — aiService.proposeNextTasks
// never fetches anything itself, it only reasons over whatever this
// function handed it. Keeping the two separate is the actual backend
// architecture the spec asks for: "collect and structure context first,
// then pass it to the AI," not one AI call that also decides what's
// relevant. Exported standalone (not just used internally) so it can be
// reasoned about/tested independently of task creation.
const RECENT_CHANGE_WINDOW_DAYS = 14;

function buildStartupContext(userId) {
  const state = repo.getFounderState(userId) || {};
  const allTasks = repo.listTasks(userId);
  const completedTasks = allTasks.filter((t) => t.status === "COMPLETED").sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  // "Blocked" here means the existing, real LOCKED-with-a-dependency
  // state this system already tracks — not a separate concept invented
  // for this spec. No skip/overdue concept exists anywhere in this
  // codebase (no due dates, no skip action in the UI), so neither is
  // fabricated here; see the implementation summary for that scoping call.
  const blockedTasks = allTasks.filter((t) => t.status === "LOCKED" && (t.dependencies || []).length > 0);

  // §15 — relevance over volume: only the last 5 completed tasks, and
  // only their distilled outcome (or a fallback summary string) rather
  // than raw evidence text, go to the model.
  const recentlyCompletedWithOutcomes = completedTasks.slice(0, 5).map((t) => ({
    title: t.title,
    objectiveKey: t.objectiveKey,
    category: t.category,
    completedAt: t.completedAt,
    // Pre-010 tasks, and tasks completed via a background activity match
    // rather than the interactive flow, have no structured outcome —
    // fall back to the verification notes string rather than silently
    // dropping context for them.
    summary: (t.outcome && t.outcome.summary) || t.verificationNotes || null,
    discoveries: (t.outcome && t.outcome.discoveries) || [],
    decisions: (t.outcome && t.outcome.decisions) || [],
    implications: (t.outcome && t.outcome.implications) || [],
  }));

  // §4/§9 — "recent changes" derived straight from founder_state's own
  // change log (see mergeStateWithChangeLog above), never re-derived or
  // guessed here. A field counts as "recent" if it changed after the
  // most recently completed task (so the next decision can see what's
  // new since then) or, with no completed tasks yet, within the last
  // RECENT_CHANGE_WINDOW_DAYS — this is what keeps "time passed alone"
  // from ever being mistaken for a real change.
  const fieldUpdatedAt = (state.changeLog && state.changeLog.fieldUpdatedAt) || {};
  const sinceISO = (completedTasks[0] && completedTasks[0].completedAt) || new Date(Date.now() - RECENT_CHANGE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const recentChanges = Object.entries(fieldUpdatedAt)
    .filter(([, changedAt]) => changedAt > sinceISO)
    .map(([field, changedAt]) => `${field} changed (as of ${changedAt})`);

  // §1/§14 — "previous decisions" / "relevant decisions". Kept small and
  // recent; a lookup failure here is a missing nice-to-have signal, never
  // something that should block task generation.
  let recentDecisions = [];
  try {
    recentDecisions = decisionRepo.listDecisions(userId, { limit: 5 }).map((d) => ({
      decisionText: d.decisionText,
      finalDecisionText: d.finalDecisionText,
      status: d.status,
    }));
  } catch (e) {
    recentDecisions = [];
  }

  return {
    founderState: state,
    currentBottleneck: state.currentBottleneck || null,
    currentMilestone: state.currentMilestone || null,
    recentChanges,
    completedTasks,
    recentlyCompletedWithOutcomes,
    blockedTasks: blockedTasks.map((t) => t.title),
    recentDecisions,
    activeTaskTitles: allTasks.map((t) => t.title),
    // Only ever populated on the readiness-gate path (assessFounderReadiness,
    // called before this function is ever reached) — by the time
    // buildStartupContext runs, state.ready is already true.
    missingCriticalInformation: [],
  };
}

// §6-§10 of the autonomous-execution spec — runs the actual research
// pipeline (plan -> search -> fetch -> synthesize) for one topic, end to
// end. Never fabricates success: if the underlying search genuinely
// fails (see webResearchService.research), this rethrows rather than
// returning a fake result — callers must not persist anything as
// completed when this throws (§17).
function startupResearchContext(founderState) {
  return {
    startupName: founderState.startupName,
    problem: founderState.problem,
    targetCustomer: founderState.targetCustomer,
    currentSolution: founderState.currentSolution,
    businessModel: founderState.businessModel,
    stage: founderState.stage,
    competitors: founderState.competitors,
  };
}

const MAX_RESEARCH_SOURCES = 5;

async function runResearch(userId, topic, founderState) {
  const startupContext = startupResearchContext(founderState || {});
  const plan = await aiService.planResearchQueries(userId, { topic, startupContext });
  const queries = plan.queries && plan.queries.length ? plan.queries : [topic];
  const retrieval = await webResearch.research(queries, { maxSourcesToFetch: MAX_RESEARCH_SOURCES }); // throws SEARXNG_* on total failure — never caught here
  const synthesis = await aiService.synthesizeResearch(userId, { topic, startupContext, sources: retrieval.sources });
  return { topic, queries: retrieval.queriesRun, queriesFailed: retrieval.queriesFailed, sources: retrieval.sources, ...synthesis };
}

// §8/§16 of the context-aware-task-generation spec, extended by §1-§5 of
// the autonomous-execution spec — the actual decision step: propose ->
// deterministically filter duplicates (§6 Rule 3/Rule 4, unchanged) ->
// retry once if everything was rejected -> for each accepted candidate,
// classify and EXECUTE what FounderOS can execute itself instead of
// reflexively turning it into a founder task. Never reached with a
// pending task already in play — see generateTasksIfNeeded's hasEligible
// guard, checked before this is ever called.
//
// Returns { createdTasks, autonomousExecutions, failedAutonomous } — the
// created Task rows (autonomous ones already COMPLETED with their real
// result; founder-required ones AVAILABLE/LOCKED as before), plus the
// raw research results/failures so the caller can compose an honest
// founder-facing narration of what actually happened this turn (see
// aiService.draftAutonomousExecutionReply).
async function determineNextAction(userId, context) {
  async function proposeAndFilter(excludedObjectiveKeys) {
    const proposal = await aiService.proposeNextTasks(userId, {
      founderState: context.founderState,
      completedTasks: context.completedTasks,
      recentlyCompletedWithOutcomes: context.recentlyCompletedWithOutcomes,
      recentChanges: context.recentChanges,
      blockedTasks: context.blockedTasks,
      recentDecisions: context.recentDecisions,
      activeTaskTitles: context.activeTaskTitles,
      excludedObjectiveKeys,
    });
    const rejectedKeys = [];
    const accepted = (proposal.tasks || []).filter((t) => {
      const { duplicate } = isDuplicateOfCompleted(t, context.completedTasks, context.founderState);
      if (duplicate) rejectedKeys.push(slugify(t.objectiveKey || t.title));
      return !duplicate;
    });
    return { accepted, rejectedKeys };
  }

  let { accepted, rejectedKeys } = await proposeAndFilter([]);
  if (accepted.length === 0 && rejectedKeys.length > 0) {
    ({ accepted } = await proposeAndFilter(rejectedKeys));
  }

  const VALID_ACTION_TYPES = new Set(aiService.ACTION_TYPES || ["AUTONOMOUS", "APPROVAL_REQUIRED", "FOUNDER_REQUIRED"]);
  const createdTasks = [];
  const autonomousExecutions = [];
  const failedAutonomous = [];

  for (const t of accepted) {
    let actionType = VALID_ACTION_TYPES.has(t.actionType) ? t.actionType : "FOUNDER_REQUIRED";
    // §45 — no tool that can actually execute an approval-required
    // external action exists anywhere in this codebase yet (no email
    // send, no publish capability). Never pretend otherwise: downgrade
    // to FOUNDER_REQUIRED rather than parking the founder on a
    // WAITING_FOR_APPROVAL state nothing will ever move out of.
    if (actionType === "APPROVAL_REQUIRED") actionType = "FOUNDER_REQUIRED";

    if (actionType === "AUTONOMOUS") {
      if (!t.needsResearch || !t.researchTopic) continue; // nothing genuinely autonomous proposed here — skip rather than fabricate a result
      try {
        const result = await runResearch(userId, t.researchTopic, context.founderState);
        const created = repo.createTask({
          userId,
          title: t.title,
          objective: t.objective,
          whyItMatters: result.conclusion,
          dependencies: [],
          steps: t.steps || [],
          completionCriteria: t.completionCriteria,
          evidenceRequirements: t.evidenceRequirements,
          requiredThreshold: t.requiredThreshold,
          priorityFactors: t.priorityFactors,
          priorityScore: priorityScore(t.priorityFactors),
          status: "AVAILABLE", // transitioned to COMPLETED just below via setStatus so completed_at is set correctly
          category: t.category || null,
          objectiveKey: slugify(t.objectiveKey || t.title) || null,
          revisitConditions: t.revisitConditions || [],
          reason: t.reason || null,
          whyNow: t.whyNow || null,
          expectedOutcome: t.expectedOutcome || null,
          contextReferences: t.contextReferences || [],
          actionType: "AUTONOMOUS",
          autonomousWork: [],
          executionState: "COMPLETED",
        });
        // Autonomous work is never shown to the founder as a pending
        // "task" at all (§1/§5) — it's created already resolved, purely
        // so it participates in the same duplicate/revisit machinery
        // every other task does (see migration 011's comment).
        const finalized = repo.setStatus(created.id, userId, "COMPLETED", { completed: true });
        repo.recordOutcome(created.id, userId, {
          summary: result.conclusion,
          discoveries: result.facts || [],
          decisions: [],
          implications: result.inferences || [],
        });
        createdTasks.push(finalized);
        autonomousExecutions.push(result);
      } catch (e) {
        // §17/§18 — never mark research completed on a genuine failure.
        // Nothing is persisted for this candidate; the objective stays
        // open for a future pass to retry.
        failedAutonomous.push({ topic: t.researchTopic, reason: e.code || e.message });
        // eslint-disable-next-line no-console
        console.error(`[executionEngine] autonomous research failed for user ${userId}, topic "${t.researchTopic}":`, e.message);
      }
      continue;
    }

    // FOUNDER_REQUIRED (including any APPROVAL_REQUIRED downgraded above)
    // — §4C/§20: do everything genuinely possible before delegating. If
    // the model flagged useful research prep, actually run it (not just
    // assert it happened) and fold the real findings into the task.
    let autonomousWork = [];
    let whyNow = t.whyNow;
    if (t.needsResearch && t.researchTopic) {
      try {
        const result = await runResearch(userId, t.researchTopic, context.founderState);
        autonomousExecutions.push(result);
        autonomousWork = (result.facts || [])
          .slice(0, 3)
          .map((f) => `Researched and found: ${f}`);
        if (result.recommendation) autonomousWork.push(`Identified: ${result.recommendation}`);
        if (!autonomousWork.length) autonomousWork = [`Researched "${result.topic}" (${(result.sources || []).length} sources) to prepare this.`];
        whyNow = [t.whyNow, result.conclusion].filter(Boolean).join(" ");
      } catch (e) {
        // §28 — honest about a failed prep attempt, never silently
        // dropped and never presented as if the prep succeeded.
        failedAutonomous.push({ topic: t.researchTopic, reason: e.code || e.message });
        autonomousWork = [`Tried to research this first, but live web research is unavailable right now (${e.code || "error"}) — proceeding without that prep.`];
      }
    }

    const created = repo.createTask({
      userId,
      title: t.title,
      objective: t.objective,
      whyItMatters: whyNow || t.reason || null,
      dependencies: [], // dependsOnTitle resolved below, once every candidate has a real row
      steps: t.steps || [],
      completionCriteria: t.completionCriteria,
      evidenceRequirements: t.evidenceRequirements,
      requiredThreshold: t.requiredThreshold,
      priorityFactors: t.priorityFactors,
      priorityScore: priorityScore(t.priorityFactors),
      status: "LOCKED",
      category: t.category || null,
      objectiveKey: slugify(t.objectiveKey || t.title) || null,
      revisitConditions: t.revisitConditions || [],
      reason: t.reason || null,
      whyNow: whyNow || null,
      expectedOutcome: t.expectedOutcome || null,
      contextReferences: t.contextReferences || [],
      actionType: "FOUNDER_REQUIRED",
      autonomousWork,
      executionState: "WAITING_FOR_FOUNDER",
    });
    createdTasks.push(created);
  }

  // Resolve dependsOnTitle now that every candidate (autonomous or
  // founder-required) has a real row — matched by title rather than
  // position, since a failed autonomous attempt above means candidate
  // index and createdTasks index can drift apart.
  const candidateByTitle = new Map(accepted.map((t) => [t.title, t]));
  createdTasks.forEach((c) => {
    if (c.actionType !== "FOUNDER_REQUIRED") return; // autonomous tasks are already COMPLETED, never locked on anything
    const candidate = candidateByTitle.get(c.title);
    const dependsOnTitle = candidate?.dependsOnTitle;
    if (dependsOnTitle) {
      const depTask = createdTasks.find((x) => x.title === dependsOnTitle) || context.completedTasks.find((x) => x.title === dependsOnTitle);
      if (depTask && depTask.status !== "COMPLETED") {
        repo.addDependencyAndLock(c.id, userId, depTask.id);
        return;
      }
      // depTask either doesn't exist or already completed (including an
      // autonomous action that resolved in this very round) — nothing
      // left to block on.
    }
    repo.setStatus(c.id, userId, "AVAILABLE");
  });

  return { createdTasks, autonomousExecutions, failedAutonomous };
}

// §6 Rule 2 (unchanged, verified): `hasEligible` below is the actual
// backend enforcement of "never generate a new task while a pending task
// exists" — this function is only ever reached via ensureCurrentTask,
// which itself only calls this after selectCurrentTask already came back
// empty. There is no code path from a chat message or a progress-summary
// request to the AI task generator that skips this check. §9: nothing in
// this function or anywhere upstream of it is triggered by elapsed time —
// it only ever runs because selectCurrentTask found no eligible task,
// which only happens because one was just completed/never existed, never
// because a clock fired.
//
// §15 — the execution loop: after one round, if everything created was
// autonomous and already resolved, loop again to see whether the NEXT
// action is now determinable, rather than stopping just because the
// first thing was handled. Bounded by MAX_AUTONOMOUS_LOOP_ROUNDS — there
// is no background job system in this codebase, so the whole loop must
// finish inside this one request/response cycle; §16's "don't
// over-automate blindly" is the other half of why this is capped rather
// than unbounded.
const MAX_AUTONOMOUS_LOOP_ROUNDS = 3;

async function generateTasksIfNeeded(userId) {
  const existing = repo.listTasks(userId);
  const hasEligible = existing.some((t) => t.status === "LOCKED" || t.status === "AVAILABLE" || t.status === "IN_PROGRESS" || t.status === "AWAITING_EVIDENCE");
  if (hasEligible) return { autonomousExecutions: [], failedAutonomous: [] };

  const autonomousExecutions = [];
  const failedAutonomous = [];
  for (let round = 0; round < MAX_AUTONOMOUS_LOOP_ROUNDS; round++) {
    const context = buildStartupContext(userId);
    const result = await determineNextAction(userId, context);
    autonomousExecutions.push(...result.autonomousExecutions);
    failedAutonomous.push(...result.failedAutonomous);

    const hasFounderRequired = result.createdTasks.some((t) => t.actionType !== "AUTONOMOUS");
    if (hasFounderRequired) break; // a real founder-facing task now exists — that's the current task, stop here
    if (result.createdTasks.length === 0) break; // nothing more to do right now
    // else: everything this round was autonomous and already resolved —
    // loop again for the next action.
  }
  return { autonomousExecutions, failedAutonomous };
}

// §9 — defensive backstop for the (should-be-rare) case where founder
// state is genuinely ready but the model proposed zero usable tasks.
// Grounded only in fields already present in founderState — never
// invents specifics the founder hasn't actually provided.
function createFallbackTask(userId, state) {
  const needsValidation = !state.validationLevel || state.validationLevel === "none";
  const title = needsValidation
    ? `Talk to 5 people about: ${state.problem || "the problem you're solving"}`
    : `Decide the next concrete step toward: ${state.goal || "your current goal"}`;
  const whyNow = state.currentBottleneck
    ? `This is the most grounded next step available given the current bottleneck: ${state.currentBottleneck}.`
    : "This is the most grounded next step available from what's currently known about your startup.";
  const task = repo.createTask({
    userId,
    title,
    objective: needsValidation ? "Find out if this problem is real and worth solving for these people." : "Turn your current goal into one concrete, executable action.",
    whyItMatters: whyNow,
    reason: whyNow,
    whyNow,
    expectedOutcome: needsValidation ? "A clearer read on whether this problem is real and worth solving for these people." : "One concrete action taken toward the current goal.",
    contextReferences: state.currentBottleneck ? [state.currentBottleneck] : [],
    dependencies: [],
    steps: [{ title: "Get started", instructions: needsValidation ? "Talk to 5 people who might have this problem and ask how they deal with it today." : "Write down the single most concrete thing you could do this week toward this goal, then do it." }],
    completionCriteria: "A concrete action taken with real evidence of what happened.",
    evidenceRequirements: "Specific notes on what was done and what was learned — not just a claim that it happened.",
    requiredThreshold: 0.5,
    priorityFactors: { impact: 0.7, urgency: 0.6, uncertaintyReduction: 0.6, riskReduction: 0.5, effort: 0.4 },
    priorityScore: 0,
    status: "AVAILABLE",
    // This is genuinely a founder action (talk to people / decide a next
    // step) — no research prep applies here since it's the emergency
    // backstop, not a model-classified candidate.
    actionType: "FOUNDER_REQUIRED",
    autonomousWork: [],
    executionState: "WAITING_FOR_FOUNDER",
  });
  repo.setPriority(task.id, userId, priorityScore(task.priorityFactors), task.priorityFactors);
  return repo.getTask(task.id, userId);
}

// Lock-free core of "what task should the founder be looking at, creating
// one if needed" — factored out so both ensureCurrentTask (locked
// entry point for callers outside the onboarding flow) and
// handleOnboardingMessage (which already holds the lock for the whole
// onboarding turn, and must not re-acquire it — see that function's own
// comment) can share the exact same logic without ever nesting
// withFounderLock calls on the same key, which would deadlock against
// itself.
//
// Returns { task, autonomousExecutions, failedAutonomous } — the latter
// two are only ever non-empty when this call itself triggered new
// generation (an existing task short-circuits with both empty arrays),
// letting callers compose an honest "here's what I actually did" reply
// (§22-24) instead of the plain task reveal when real autonomous work
// happened this turn.
async function _resolveCurrentTask(userId, state) {
  const existing = selectCurrentTask(userId);
  if (existing) return { task: existing, autonomousExecutions: [], failedAutonomous: [] };
  const { autonomousExecutions, failedAutonomous } = await generateTasksIfNeeded(userId);
  const task = selectCurrentTask(userId) || createFallbackTask(userId, state || repo.getFounderState(userId) || {});
  return { task, autonomousExecutions, failedAutonomous };
}

// The single source of truth for "what task should the founder see right
// now" — used by both GET /execution/progress and handleMessage, so the
// two entry points can never drift into different behavior (§10). Never
// returns null except on a genuine unexpected failure, which it does not
// swallow (§9) — callers should let that propagate to the route's
// asyncHandler/errorHandler rather than catching it here.
//
// Only ever called once founder_state.ready is true — the pre-task
// onboarding conversation (still-missing-critical-info) is handled
// entirely by handleOnboardingMessage/ensureOnboardingPrompt below, which
// never creates a Task row at all. See those functions' comments for why
// onboarding stopped being modeled as a fake task.
//
// bootstrapped: true means a task was just created by this call (so the
// caller shouldn't also try to interpret an incoming chat message as
// evidence against a task the founder hasn't been shown yet).
async function ensureCurrentTask(userId, profile) {
  return withFounderLock(userId, async () => {
    const preexisting = selectCurrentTask(userId);
    if (preexisting) return { task: preexisting, bootstrapped: false, autonomousExecutions: [], failedAutonomous: [] };
    const { task, autonomousExecutions, failedAutonomous } = await _resolveCurrentTask(userId);
    return { task, bootstrapped: true, autonomousExecutions, failedAutonomous };
  });
}

// §22-24 — composes the founder-facing turn reply, choosing between a
// real "here's what I did" narration (when autonomous work actually
// happened this turn) and the plain templated task reveal (when
// nothing autonomous ran — e.g. a straightforward founder-required
// action with no useful research prep). Never calls the narration path
// with nothing to narrate.
async function composeTaskTurnReply(userId, task, autonomousExecutions, failedAutonomous) {
  if ((autonomousExecutions && autonomousExecutions.length) || (failedAutonomous && failedAutonomous.length)) {
    return aiService.draftAutonomousExecutionReply(userId, {
      objective: task.objective,
      executedActions: autonomousExecutions,
      founderRequiredTask: task.actionType === "FOUNDER_REQUIRED" ? task : null,
      failedActions: failedAutonomous,
    });
  }
  return describeTaskReveal(task);
}

// Natural, varied phrasing for introducing a newly-active task in chat —
// no card, no "Start Task" button, just a normal message (see the
// conversational-UI spec). Deterministic/templated rather than another AI
// call: it's fast, free, and task.title/whyItMatters/step instructions
// are already written in natural language by proposeNextTasks, so a
// light template is enough to read like a real sentence, not a form.
const REVEAL_OPENERS = ["Today's task:", "Your next task:", "Next up:", "Here's what's next:"];
function describeTaskReveal(task) {
  const opener = REVEAL_OPENERS[Math.floor(Math.random() * REVEAL_OPENERS.length)];
  const firstStep = task.steps?.[0];
  const titleSentence = /[.!?]$/.test(task.title.trim()) ? task.title.trim() : `${task.title.trim()}.`;
  let msg = `${opener} ${titleSentence}`;
  const why = task.whyNow || task.whyItMatters;
  if (why) msg += ` ${why}`;
  if (firstStep?.instructions) msg += `\n\n${firstStep.instructions}`;
  return msg;
}

// ---- Conversational onboarding (fixes the "feels like a form" bug) ----
// Before founder_state.ready is true, the founder is not doing a "task" —
// they're just talking to FounderOS about who they are and what they're
// building. This used to be modeled as a fake Task ("Tell FounderOS what
// you're building") pushed through the exact same reveal/evidence/
// verification pipeline as a real execution task, which is what produced
// the bug: a "Today's task:" framing, a hardcoded "FounderOS doesn't yet
// know enough..." explanation surfaced verbatim to the founder, and a new
// fake task re-created (with the same exposed reasoning) every time the
// founder answered but a field was still missing.
//
// Fix: this phase creates NO Task row at all. Every turn is a single
// aiService.synthesizeOnboardingTurn call that extracts+merges whatever
// the founder just said into founder_state AND drafts the exact natural
// reply to show them (see that function's prompt for the "never expose
// internal reasoning" rules — enforced at the one place the text is
// actually produced, not bolted on afterward). Once every CRITICAL field
// is known, the first real task is generated and its reveal is chained
// into the same reply — the same pattern already used when a task
// completes and the next one reveals in the same message.

// §1 of the first-time-experience spec — the fixed, reviewed opening
// message for a genuinely brand-new founder (see ensureOnboardingPrompt
// below for exactly when this is used vs. an AI-generated follow-up).
// Deliberately NOT run through the AI: this is the single highest-stakes
// line FounderOS ever shows someone, and a canned, warm message
// guarantees the "your intelligent co-founder just sat down beside you"
// tone every single time, with zero risk of an off-tone generation on a
// cold start. Asks exactly one open, non-presumptuous question and
// explicitly invites a messy/half-formed answer — never a questionnaire,
// never an assumption about what the founder is building, never a task.
const WELCOME_MESSAGE = `Welcome to FounderOS 👋

This is your space to think, build, experiment, and turn ideas into reality — with an AI partner alongside you.

You don't need to have everything figured out before we start. We can talk through an idea, make sense of where things stand, explore possibilities, plan something, or eventually turn an idea into real work.

For now, I just want to get to know you and what you're building.

What are you working on right now?

Tell me about it however you want — even if it's messy, half-formed, or you're not sure where it's going yet. We'll figure it out together.`;

async function handleOnboardingMessage(userId, { profile, text, recentHistory }) {
  return withFounderLock(userId, async () => {
    const priorState = repo.getFounderState(userId);
    // Re-check under the lock: a concurrent turn may have just reached
    // readiness right before this one acquired it.
    if (priorState?.ready) {
      const { task, autonomousExecutions, failedAutonomous } = await _resolveCurrentTask(userId, priorState);
      const started = task.status === "AVAILABLE" ? repo.setStatus(task.id, userId, "IN_PROGRESS") : task;
      const reply = await composeTaskTurnReply(userId, started, autonomousExecutions, failedAutonomous);
      return { event: "task_started", reply, task: started, currentStep: started.steps?.[started.currentStepIndex] };
    }

    const recentMessages = text ? [...(recentHistory || []), { role: "user", content: text }] : recentHistory || [];
    const turn = await aiService.synthesizeOnboardingTurn(userId, { profile, priorState, recentMessages });
    const { ready, reply, ...stateFields } = turn;
    const merged = mergeStateWithChangeLog(priorState, stateFields);
    // Stored so a page reload (ensureOnboardingPrompt below) can replay
    // this exact question without spending another AI call — cleared the
    // moment readiness is reached since there's nothing left to ask.
    merged.onboardingPrompt = ready ? null : reply;
    const saved = repo.saveFounderState(userId, merged, { ready: !!ready });

    if (!ready) {
      return { event: "onboarding", reply, task: null, currentStep: null };
    }

    const { task, autonomousExecutions, failedAutonomous } = await _resolveCurrentTask(userId, saved);
    const started = task.status === "AVAILABLE" ? repo.setStatus(task.id, userId, "IN_PROGRESS") : task;
    const taskReply = await composeTaskTurnReply(userId, started, autonomousExecutions, failedAutonomous);
    return { event: "task_started", reply: `${reply}\n\n${taskReply}`, task: started, currentStep: started.steps?.[started.currentStepIndex] };
  });
}

// Page-load counterpart to handleOnboardingMessage: there's no new
// founder message to extract anything from, so this never spends an AI
// call on a plain app-open/refresh once a prompt has already been asked
// — it just replays the stored onboardingPrompt. Only calls the model for
// a returning-but-not-ready founder; a genuinely first-ever contact (no
// founder_state row exists at all) gets the fixed WELCOME_MESSAGE below
// instead of an AI-generated first line — see its own comment for why.
async function ensureOnboardingPrompt(userId, profile, state) {
  if (state?.onboardingPrompt) return { prompt: state.onboardingPrompt };
  return withFounderLock(userId, async () => {
    const latest = repo.getFounderState(userId);
    if (latest?.ready) return { prompt: null };
    if (latest?.onboardingPrompt) return { prompt: latest.onboardingPrompt };

    // Genuinely first-ever contact — no founder_state row exists yet at
    // all, meaning nothing has ever been asked or answered. This is the
    // single most important impression FounderOS makes ("your
    // intelligent co-founder just sat down beside you," not "your
    // productivity manager has arrived with today's assignments" — see
    // the first-time-experience spec), so it's a fixed, reviewed message
    // rather than an AI-generated one: guarantees the right tone every
    // time instead of leaving a founder's very first line to per-call
    // model variance. It asks exactly one open question and explicitly
    // invites a messy, half-formed answer — never a questionnaire, never
    // an assumption about what they're building.
    if (!latest) {
      repo.saveFounderState(userId, { onboardingPrompt: WELCOME_MESSAGE }, { ready: false });
      return { prompt: WELCOME_MESSAGE };
    }

    const turn = await aiService.synthesizeOnboardingTurn(userId, { profile, priorState: latest, recentMessages: [] });
    const { ready, reply, ...stateFields } = turn;
    const merged = mergeStateWithChangeLog(latest, stateFields);
    merged.onboardingPrompt = ready ? null : reply;
    repo.saveFounderState(userId, merged, { ready: !!ready });
    return { prompt: ready ? null : reply };
  });
}

// The single entry point the chat route calls for every message once the
// founder has an active execution context. Returns { reply, task, event }
// — event is one of: onboarding | task_started | in_progress | insufficient
// | completed | stuck. `reply` is always the natural-language text
// actually shown in the conversation — it is only ever generated from a
// real, checked state transition, never copied verbatim from a model
// call that merely claimed one. There is no separate task UI to keep in
// sync with this — the message list IS the task interface (see Chat.jsx).
async function handleMessage(userId, { profile, text, recentHistory }) {
  // Founder_state not ready yet -> this is still the onboarding
  // conversation, not a task. Routed here BEFORE ensureCurrentTask so no
  // Task row is ever created/consulted for this phase — see
  // handleOnboardingMessage's own comment for why.
  const priorState = repo.getFounderState(userId);
  if (!priorState?.ready) {
    return handleOnboardingMessage(userId, { profile, text, recentHistory });
  }

  const { task: current, autonomousExecutions, failedAutonomous } = await ensureCurrentTask(userId, profile);

  // AVAILABLE means the founder hasn't been shown this task yet (whether
  // it was just created this call or simply became unblocked earlier) —
  // this is the reveal turn. Don't also try to interpret the founder's
  // current message as evidence against a task they haven't seen.
  if (current.status === "AVAILABLE") {
    const started = repo.setStatus(current.id, userId, "IN_PROGRESS");
    const reply = await composeTaskTurnReply(userId, started, autonomousExecutions, failedAutonomous);
    return { event: "task_started", reply, task: started, currentStep: started.steps[started.currentStepIndex] };
  }

  const task = current;
  const currentStep = task.steps[task.currentStepIndex];
  const classification = await aiService.classifyExecutionMessage(userId, { task, currentStep, founderMessage: text, recentHistory, canSearch: aiService.providerSupportsTools });

  if (classification.intent === "STUCK") {
    return handleStuck(userId, task, currentStep, text, repo.getFounderState(userId));
  }

  if (classification.intent === "EVIDENCE") {
    return verifyEvidence(userId, task, currentStep, classification.extractedEvidence || text);
  }

  // Founder asked something that genuinely needs a real web search (§5 of
  // the SearXNG integration spec — "find communities", "what's the
  // latest", etc.) — a single search-then-answer pass, not a full
  // multi-round tool loop, to match this function's own single-shot
  // per-turn architecture. Reuses aiTools.executeTool so there's exactly
  // one place in the codebase that actually talks to SearXNG and exactly
  // one place that turns its failures into founder-safe text (§10).
  if (classification.needsSearch && classification.searchQuery) {
    const toolResult = await aiTools.executeTool("web_search", { query: classification.searchQuery });
    const reply = await aiService.answerFromSearchResults(userId, { founderMessage: text, searchResultText: toolResult.textForModel, task });
    return { event: "in_progress", reply, task, currentStep, sources: toolResult.sources };
  }

  // QUESTION or OFF_TOPIC — model-drafted reply is safe to show as-is
  // here, since classifyExecutionMessage is instructed to never draft a
  // completion claim, and we don't touch task state on this branch at all.
  return { event: "in_progress", reply: classification.responseText, task, currentStep };
}

// The safety-gated core: verificationScore is proposed by the model,
// but whether the task/step actually advances is decided right here by
// comparing it to the task's required_threshold — a plain number
// comparison, not something the model can talk its way around.
async function verifyEvidence(userId, task, currentStep, evidenceText, { source = "manual", activityId = null, relevanceScore = null } = {}) {
  // Cumulative evidence already submitted for THIS step, so the AI can
  // respond naturally with real progress ("that's 2 of the 5 so far")
  // instead of judging each message in isolation — this is what lets the
  // conversation read like the spec's example flow rather than treating
  // every reply as a fresh, disconnected verification.
  const priorEvidenceForStep = (task.evidenceSubmitted || [])
    .filter((e) => e.stepIndex === task.currentStepIndex)
    .map((e) => e.text);

  const verification = await aiService.verifyTaskEvidence(userId, { task, currentStep, evidenceText, priorEvidenceForStep });
  const evidenceLog = [...(task.evidenceSubmitted || []), { stepIndex: task.currentStepIndex, text: evidenceText, submittedAt: new Date().toISOString(), source }];

  const sufficient = verification.verificationScore >= task.requiredThreshold;
  const strength = verification.verificationScore >= 0.75 ? "strong" : verification.verificationScore >= 0.5 ? "medium" : "weak";

  repo.recordEvidence(task.id, userId, {
    evidenceSubmitted: evidenceLog,
    verificationScore: verification.verificationScore,
    verificationStatus: sufficient ? "sufficient" : verification.verificationStatus,
    verificationNotes: verification.notes,
  });

  // Structured evidence ledger (§3 of the activity/evidence spec) — a
  // real row per piece of evidence, separate from the legacy JSON blob
  // above (kept as-is for backward compatibility). Same threshold-checked
  // verificationScore either way — manual and activity-sourced evidence
  // go through this exact same enforcement, never a separate path.
  repo.addEvidence({
    taskId: task.id,
    userId,
    activityId,
    kind: source === "activity" ? "activity" : "manual",
    content: evidenceText,
    relevanceScore,
    strength,
    verificationStatus: sufficient ? "verified" : "needs_more_evidence",
    verificationScore: verification.verificationScore,
    notes: verification.notes,
  });

  if (!sufficient) {
    const updated = repo.setStatus(task.id, userId, "AWAITING_EVIDENCE");
    return { event: "insufficient", reply: verification.feedbackToFounder, task: updated, currentStep };
  }

  const isLastStep = task.currentStepIndex >= task.steps.length - 1;
  if (!isLastStep) {
    repo.setStatus(task.id, userId, "IN_PROGRESS"); // clears AWAITING_EVIDENCE if a prior attempt on this task was rejected
    const updated = repo.setCurrentStep(task.id, userId, task.currentStepIndex + 1);
    const nextStep = updated.steps[updated.currentStepIndex];
    // The next step's own instructions get folded naturally into the
    // conversational reply itself (rather than shown in a separate step
    // box), matching the "conversation is the interface" spec — but only
    // when the AI's own feedback doesn't already effectively cover it, to
    // avoid sounding redundant. Kept simple: append it as a natural
    // follow-up sentence only if the AI's feedback text doesn't already
    // ask a next-action question.
    const feedback = verification.feedbackToFounder || "";
    const alreadyPrompts = /\?\s*$/.test(feedback.trim());
    const reply = alreadyPrompts ? feedback : `${feedback}\n\n${nextStep.instructions}`;
    return { event: "in_progress", reply, task: updated, currentStep: nextStep };
  }

  // Final step verified — task genuinely complete. This is the only
  // place in the entire codebase that sets a task to COMPLETED.
  const completed = repo.setStatus(task.id, userId, "COMPLETED", { completed: true });

  // §6/§7/§13 of the context-aware-task-generation spec — capture the
  // structured outcome now, from THIS task's own evidence, so the next
  // determineNextAction call has real discoveries/implications to build a
  // causal chain on instead of just a completed title. Independent of the
  // founder-state resynthesis below, which is about the startup's overall
  // picture — this is specifically about what this one task found.
  try {
    const evidenceForThisTask = (completed.evidenceSubmitted || []).map((e) => ({ text: e.text }));
    const outcome = await aiService.synthesizeTaskOutcome(userId, { task: completed, evidenceLog: evidenceForThisTask, verificationNotes: verification.notes });
    if (outcome && !outcome.error) repo.recordOutcome(task.id, userId, outcome);
  } catch (e) {
    // Same principle as the state-resynthesis catch below — never block a
    // real completion the founder is waiting on, but don't let the
    // failure vanish silently either. Falls back to verificationNotes
    // wherever outcome would have been used (see buildStartupContext).
    // eslint-disable-next-line no-console
    console.error(`[executionEngine] task-outcome synthesis failed for task ${task.id}, user ${userId}:`, e.message);
  }

  // Reprioritize now, with the new evidence in hand, rather than working
  // down a list decided before this evidence existed (§12).
  let freshState;
  try {
    const priorState = repo.getFounderState(userId);
    freshState = await aiService.synthesizeFounderState(userId, {
      profile: null,
      recentMessages: [{ role: "user", content: evidenceText }],
      priorState,
    });
    // §4/§8 — this is exactly the moment a completed task's underlying
    // assumptions (targetCustomer, problem, etc.) might have just shifted
    // based on what the founder reported as evidence, so the change log
    // gets updated right here, not just on the readiness-gate path.
    if (freshState && !freshState.error) repo.saveFounderState(userId, mergeStateWithChangeLog(priorState, freshState), { ready: true });
  } catch (e) {
    // Resynthesis failing shouldn't block a genuine completion the
    // founder is waiting on — but it must not vanish silently either
    // (§15 of the automatic-verification spec: don't swallow errors on
    // critical task operations). Logged for real visibility; state
    // simply carries forward unchanged and the next task generation
    // pass will resynthesize again anyway.
    // eslint-disable-next-line no-console
    console.error(`[executionEngine] founder-state resynthesis failed after completing task ${task.id} for user ${userId}:`, e.message);
  }

  // Chain the next task's reveal into the same reply — "That's verified.
  // ... Next task: X." in one natural message, no separate round trip and
  // no card to wait for (see the conversational-UI spec's example flow).
  // Only done for interactive (manual, chat-triggered) completions: a
  // background activity match (source: "activity", e.g. a document
  // upload happening to satisfy the current task) runs outside any chat
  // turn, so there's no live response to deliver a reveal message into —
  // chaining a transition here would silently advance the next task to
  // IN_PROGRESS with nobody ever having been told, which is exactly the
  // "founder never sees no active task, but also never gets skipped past
  // one" balance this architecture is built to avoid getting wrong. For
  // that case, the next task is simply left AVAILABLE and gets revealed
  // through the normal mount-time/handleMessage path the next time the
  // founder actually opens the app or sends a message.
  let reply = verification.feedbackToFounder;
  let nextTask = null;
  let nextStep = null;
  if (source !== "activity") {
    try {
      const { task: next, autonomousExecutions, failedAutonomous } = await ensureCurrentTask(userId, null);
      if (next && next.status === "AVAILABLE") {
        const started = repo.setStatus(next.id, userId, "IN_PROGRESS");
        const nextReply = await composeTaskTurnReply(userId, started, autonomousExecutions, failedAutonomous);
        reply = `${reply}\n\n${nextReply}`;
        nextTask = started;
        nextStep = started.steps[started.currentStepIndex];
      } else if (next) {
        nextTask = next;
        nextStep = next.steps?.[next.currentStepIndex];
      }
    } catch (e) {
      // Same principle as above — a failure here shouldn't erase the
      // completion the founder just earned, but it must be visible in
      // logs, not silently dropped. The founder still sees their task
      // marked complete; the next task simply reveals on their next
      // message instead of this one.
      // eslint-disable-next-line no-console
      console.error(`[executionEngine] failed to fetch/reveal next task after completing ${task.id} for user ${userId}:`, e.message);
    }
  }

  return {
    event: "completed",
    reply,
    task: nextTask || completed,
    currentStep: nextStep,
    completedTask: completed,
  };
}

async function handleStuck(userId, task, currentStep, founderMessage, founderState) {
  const diagnosis = await aiService.diagnoseStuck(userId, { task, currentStep, founderMessage, founderState });

  if (diagnosis.needsPrerequisiteTask && diagnosis.prerequisiteTask) {
    const prereqWhyNow = `Unblocks "${task.title}" — ${diagnosis.diagnosis === "other" ? "the founder got stuck on it" : `the founder got stuck (${diagnosis.diagnosis})`}.`;
    const prereq = repo.createTask({
      userId,
      title: diagnosis.prerequisiteTask.title,
      objective: diagnosis.prerequisiteTask.objective,
      whyItMatters: prereqWhyNow,
      reason: prereqWhyNow,
      whyNow: prereqWhyNow,
      expectedOutcome: `Unblocks "${task.title}" so it can be completed.`,
      contextReferences: [`stuck on "${task.title}": ${diagnosis.diagnosis}`],
      dependencies: [],
      steps: diagnosis.prerequisiteTask.steps || [],
      completionCriteria: diagnosis.prerequisiteTask.completionCriteria,
      evidenceRequirements: diagnosis.prerequisiteTask.evidenceRequirements,
      requiredThreshold: diagnosis.prerequisiteTask.requiredThreshold,
      priorityFactors: { impact: 0.8, urgency: 0.9, uncertaintyReduction: 0.7, riskReduction: 0.6, effort: 0.3 },
      priorityScore: 0,
      status: "AVAILABLE",
      // A stuck-recovery prerequisite is, by construction, something the
      // founder still needs to do (diagnoseStuck never proposes autonomous
      // work here) — classified consistently with every other
      // founder-facing task rather than left unclassified.
      actionType: "FOUNDER_REQUIRED",
      autonomousWork: [],
      executionState: "WAITING_FOR_FOUNDER",
    });
    repo.setPriority(prereq.id, userId, priorityScore(prereq.priorityFactors), prereq.priorityFactors);
    // The original task now depends on the new prerequisite and goes
    // back to LOCKED — selectCurrentTask will surface the prerequisite
    // instead until it's genuinely completed.
    repo.addDependencyAndLock(task.id, userId, prereq.id);
    const updatedTask = selectCurrentTask(userId); // should resolve to the new prereq
    return { event: "stuck", reply: diagnosis.responseToFounder, task: updatedTask, currentStep: updatedTask?.steps?.[0] };
  }

  return { event: "in_progress", reply: diagnosis.responseToFounder, task, currentStep };
}

// GET /execution/progress must never hand back an empty state (see the
// auto-creation spec). If there's no current task, this generates one
// using the exact same idempotent, lock-protected path handleMessage
// uses, so "load the app" and "send a message" can never disagree about
// what the founder should be looking at. It also performs the one-time
// AVAILABLE -> IN_PROGRESS reveal transition itself and reports whether
// it just did — the caller (Chat.jsx, on mount) uses that to decide
// whether to inject exactly one natural "Today's task: ..." message into
// the conversation, never more than once per task (see describeTaskReveal
// and the conversational-UI spec's "don't repeatedly announce" rule).
//
// If founder_state isn't ready yet, there is no task to show at all —
// this surfaces the onboarding question instead (via ensureOnboardingPrompt,
// which reuses a stored prompt rather than spending an AI call on a plain
// page load), so "load the app" and "send a message" still never disagree
// during the onboarding phase either.
async function getProgressSummary(userId, profile) {
  let state = repo.getFounderState(userId);
  if (!state?.ready) {
    const result = await ensureOnboardingPrompt(userId, profile, state);
    if (result.prompt) {
      return { completed: [], current: null, totalCompleted: 0, needsAnnouncement: true, announcementText: result.prompt };
    }
    // Readiness was reached during this call (rare, e.g. a race with a
    // concurrent chat message) — fall through to the normal task path.
    state = repo.getFounderState(userId);
  }

  const { task: current, autonomousExecutions, failedAutonomous } = await ensureCurrentTask(userId, profile);
  let announced = current;
  let needsAnnouncement = false;
  let announcementText = null;
  if (current && current.status === "AVAILABLE") {
    announced = repo.setStatus(current.id, userId, "IN_PROGRESS");
    needsAnnouncement = true;
    announcementText = await composeTaskTurnReply(userId, announced, autonomousExecutions, failedAutonomous);
  }
  const all = repo.listTasks(userId);
  return {
    completed: all.filter((t) => t.status === "COMPLETED"),
    current: announced ? { ...announced, evidenceItems: repo.listEvidenceForTask(announced.id, userId) } : null,
    totalCompleted: all.filter((t) => t.status === "COMPLETED").length,
    needsAnnouncement,
    announcementText,
  };
}

module.exports = {
  handleMessage,
  selectCurrentTask,
  ensureCurrentTask,
  getProgressSummary,
  priorityScore,
  verifyEvidence,
  buildStartupContext,
  determineNextAction,
  handleOnboardingMessage,
  runResearch,
};
