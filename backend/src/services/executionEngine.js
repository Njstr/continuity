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

async function generateTasksIfNeeded(userId, founderState) {
  const existing = repo.listTasks(userId);
  const hasEligible = existing.some((t) => t.status === "LOCKED" || t.status === "AVAILABLE" || t.status === "IN_PROGRESS" || t.status === "AWAITING_EVIDENCE");
  if (hasEligible) return;

  const completedTasks = existing.filter((t) => t.status === "COMPLETED");
  const proposal = await aiService.proposeNextTasks(userId, {
    founderState,
    completedTasks,
    activeTaskTitles: existing.map((t) => t.title),
  });

  // Two passes: create every proposed task first (LOCKED by default so
  // dependency titles can resolve to real ids), then resolve
  // dependsOnTitle -> actual task id/title for the dependency check in
  // selectCurrentTask.
  const created = (proposal.tasks || []).map((t) =>
    repo.createTask({
      userId,
      title: t.title,
      objective: t.objective,
      whyItMatters: t.whyItMatters,
      dependencies: [], // filled in below once all titles exist
      steps: t.steps || [],
      completionCriteria: t.completionCriteria,
      evidenceRequirements: t.evidenceRequirements,
      requiredThreshold: t.requiredThreshold,
      priorityFactors: t.priorityFactors,
      priorityScore: priorityScore(t.priorityFactors),
      status: "LOCKED",
    })
  );

  proposal.tasks.forEach((t, i) => {
    if (t.dependsOnTitle) {
      const depTask =
        created.find((c) => c.title === t.dependsOnTitle) ||
        completedTasks.find((c) => c.title === t.dependsOnTitle);
      if (depTask) {
        repo.addDependencyAndLock(created[i].id, userId, depTask.id);
      }
    } else {
      // No dependency named — eligible immediately, pending selectCurrentTask's unlock pass.
      repo.setStatus(created[i].id, userId, "AVAILABLE");
    }
  });
}

// §9 — when there isn't enough founder info to responsibly synthesize
// real state, the right move is a real task whose purpose is getting
// that info — never an invented/assumed startup position. This reuses
// the exact same Task shape, evidence system, and verification path as
// every other task; the founder's freeform answer is just evidence like
// any other, checked against a deliberately low, self-report-friendly
// threshold since there's no "execution" to prove here, only a genuine
// description.
function createInfoGatheringTask(userId, assessment) {
  const missing = (assessment.missingInfo || []).join(", ") || "the basics of what you're building";
  const task = repo.createTask({
    userId,
    title: "Tell FounderOS what you're building",
    objective: "Give enough detail for FounderOS to identify your actual highest-priority next action, instead of generic advice.",
    whyItMatters: `FounderOS doesn't yet know enough to responsibly point you at a real next step — specifically ${missing}. Guessing here would mean sending you after the wrong thing.`,
    dependencies: [],
    steps: [
      {
        title: "Describe your startup",
        instructions: assessment.clarifyingQuestion || "In a few sentences: what are you building, who's it for, and what — if anything — have you already done or learned so far?",
      },
    ],
    completionCriteria: "A real, specific description covering what's being built, who it's for, and what's already been done (even if the answer is 'nothing yet').",
    evidenceRequirements: "A genuine written description — a one-word or single-sentence non-answer isn't enough, but this is self-reported information, not proof of an executed task.",
    requiredThreshold: 0.4,
    priorityFactors: { impact: 1, urgency: 1, uncertaintyReduction: 1, riskReduction: 0.5, effort: 0.1 },
    priorityScore: 0,
    status: "AVAILABLE",
  });
  repo.setPriority(task.id, userId, priorityScore(task.priorityFactors), task.priorityFactors);
  return repo.getTask(task.id, userId);
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
  const task = repo.createTask({
    userId,
    title,
    objective: needsValidation ? "Find out if this problem is real and worth solving for these people." : "Turn your current goal into one concrete, executable action.",
    whyItMatters: "This is the most grounded next step available from what's currently known about your startup.",
    dependencies: [],
    steps: [{ title: "Get started", instructions: needsValidation ? "Talk to 5 people who might have this problem and ask how they deal with it today." : "Write down the single most concrete thing you could do this week toward this goal, then do it." }],
    completionCriteria: "A concrete action taken with real evidence of what happened.",
    evidenceRequirements: "Specific notes on what was done and what was learned — not just a claim that it happened.",
    requiredThreshold: 0.5,
    priorityFactors: { impact: 0.7, urgency: 0.6, uncertaintyReduction: 0.6, riskReduction: 0.5, effort: 0.4 },
    priorityScore: 0,
    status: "AVAILABLE",
  });
  repo.setPriority(task.id, userId, priorityScore(task.priorityFactors), task.priorityFactors);
  return repo.getTask(task.id, userId);
}

// The single source of truth for "what task should the founder see right
// now" — used by both GET /execution/progress and handleMessage, so the
// two entry points can never drift into different behavior (§10). Never
// returns null except on a genuine unexpected failure, which it does not
// swallow (§9) — callers should let that propagate to the route's
// asyncHandler/errorHandler rather than catching it here.
//
// bootstrapped: true means a task was just created by this call (so the
// caller shouldn't also try to interpret an incoming chat message as
// evidence against a task the founder hasn't been shown yet).
async function ensureCurrentTask(userId, profile, recentMessages = []) {
  return withFounderLock(userId, async () => {
    const existing = selectCurrentTask(userId);
    if (existing) return { task: existing, bootstrapped: false };

    let state = repo.getFounderState(userId);
    if (!state?.ready) {
      const assessment = await aiService.assessFounderReadiness(userId, { profile, recentMessages });
      if (!assessment.ready) {
        return { task: createInfoGatheringTask(userId, assessment), bootstrapped: true };
      }
      const synthesized = await aiService.synthesizeFounderState(userId, { profile, recentMessages, priorState: state });
      state = repo.saveFounderState(userId, synthesized, { ready: true });
    }

    await generateTasksIfNeeded(userId, state);
    const generated = selectCurrentTask(userId);
    return { task: generated || createFallbackTask(userId, state), bootstrapped: true };
  });
}

// founder has an active execution context. Returns { reply, task, event }
// — event is one of: gathering | task_started | in_progress | insufficient
// | completed | stuck | all_done. `reply` is always the text actually
// shown; it is only ever generated from a real, checked state transition,
// never copied verbatim from a model call that merely claimed one.
async function handleMessage(userId, { profile, text, recentHistory }) {
  const { task: current } = await ensureCurrentTask(userId, profile, recentHistory);

  // AVAILABLE means the founder hasn't been shown this task yet (whether
  // it was just created this call or simply became unblocked earlier) —
  // this is the reveal turn. Don't also try to interpret the founder's
  // current message as evidence against a task they haven't seen.
  if (current.status === "AVAILABLE") {
    const started = repo.setStatus(current.id, userId, "IN_PROGRESS");
    return { event: "task_started", reply: null, task: started, currentStep: started.steps[started.currentStepIndex] };
  }

  const task = current;
  const currentStep = task.steps[task.currentStepIndex];
  const classification = await aiService.classifyExecutionMessage(userId, { task, currentStep, founderMessage: text, recentHistory });

  if (classification.intent === "STUCK") {
    return handleStuck(userId, task, currentStep, text, repo.getFounderState(userId));
  }

  if (classification.intent === "EVIDENCE") {
    return verifyEvidence(userId, task, currentStep, classification.extractedEvidence || text);
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
async function verifyEvidence(userId, task, currentStep, evidenceText) {
  const verification = await aiService.verifyTaskEvidence(userId, { task, currentStep, evidenceText });
  const evidenceLog = [...(task.evidenceSubmitted || []), { stepIndex: task.currentStepIndex, text: evidenceText, submittedAt: new Date().toISOString() }];

  const sufficient = verification.verificationScore >= task.requiredThreshold;

  repo.recordEvidence(task.id, userId, {
    evidenceSubmitted: evidenceLog,
    verificationScore: verification.verificationScore,
    verificationStatus: sufficient ? "sufficient" : verification.verificationStatus,
    verificationNotes: verification.notes,
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
    // Feedback only — the next step's title/instructions are already
    // shown in TaskCard's dedicated step box, so repeating them in the
    // reply text here would just duplicate what's on screen.
    return {
      event: "in_progress",
      reply: verification.feedbackToFounder,
      task: updated,
      currentStep: nextStep,
    };
  }

  // Final step verified — task genuinely complete. This is the only
  // place in the entire codebase that sets a task to COMPLETED.
  const completed = repo.setStatus(task.id, userId, "COMPLETED", { completed: true });

  // Reprioritize now, with the new evidence in hand, rather than working
  // down a list decided before this evidence existed (§12).
  const freshState = await aiService.synthesizeFounderState(userId, {
    profile: null,
    recentMessages: [{ role: "user", content: evidenceText }],
    priorState: repo.getFounderState(userId),
  }).catch(() => repo.getFounderState(userId)); // if resynthesis fails, don't block completion on it
  if (freshState && !freshState.error) repo.saveFounderState(userId, freshState, { ready: true });

  return {
    event: "completed",
    reply: verification.feedbackToFounder,
    task: completed,
    currentStep: null,
  };
}

async function handleStuck(userId, task, currentStep, founderMessage, founderState) {
  const diagnosis = await aiService.diagnoseStuck(userId, { task, currentStep, founderMessage, founderState });

  if (diagnosis.needsPrerequisiteTask && diagnosis.prerequisiteTask) {
    const prereq = repo.createTask({
      userId,
      title: diagnosis.prerequisiteTask.title,
      objective: diagnosis.prerequisiteTask.objective,
      whyItMatters: `Unblocks "${task.title}"`,
      dependencies: [],
      steps: diagnosis.prerequisiteTask.steps || [],
      completionCriteria: diagnosis.prerequisiteTask.completionCriteria,
      evidenceRequirements: diagnosis.prerequisiteTask.evidenceRequirements,
      requiredThreshold: diagnosis.prerequisiteTask.requiredThreshold,
      priorityFactors: { impact: 0.8, urgency: 0.9, uncertaintyReduction: 0.7, riskReduction: 0.6, effort: 0.3 },
      priorityScore: 0,
      status: "AVAILABLE",
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

// §7 — GET /execution/progress must never hand back an empty state. If
// there's no current task, this generates one using the exact same
// idempotent, lock-protected path handleMessage uses, so "load the app"
// and "send a message" can never disagree about what the founder should
// be looking at.
async function getProgressSummary(userId, profile) {
  const { task: current } = await ensureCurrentTask(userId, profile, []);
  const all = repo.listTasks(userId);
  return {
    completed: all.filter((t) => t.status === "COMPLETED"),
    current,
    totalCompleted: all.filter((t) => t.status === "COMPLETED").length,
  };
}

module.exports = { handleMessage, selectCurrentTask, ensureCurrentTask, getProgressSummary, priorityScore };
