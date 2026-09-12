const { db } = require("../db/connection");

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function nowISO() {
  return new Date().toISOString();
}
function toJSON(v) {
  return v === undefined || v === null ? null : JSON.stringify(v);
}
function fromJSON(v, fallback = null) {
  if (!v) return fallback;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

// ---- founder_state ----
const getStateStmt = db.prepare(`SELECT user_id AS userId, state_json AS stateJson, ready, created_at AS createdAt, updated_at AS updatedAt FROM founder_state WHERE user_id = ?`);
const upsertStateStmt = db.prepare(`
  INSERT INTO founder_state (user_id, state_json, ready, created_at, updated_at)
  VALUES (@userId, @stateJson, @ready, @createdAt, @updatedAt)
  ON CONFLICT(user_id) DO UPDATE SET state_json = @stateJson, ready = @ready, updated_at = @updatedAt
`);

function getFounderState(userId) {
  const row = getStateStmt.get(String(userId));
  if (!row) return null;
  return { ...fromJSON(row.stateJson, {}), ready: !!row.ready, updatedAt: row.updatedAt };
}

function saveFounderState(userId, state, { ready }) {
  const existing = getStateStmt.get(String(userId));
  const ts = nowISO();
  upsertStateStmt.run({
    userId: String(userId),
    stateJson: toJSON(state),
    ready: ready ? 1 : 0,
    createdAt: existing ? existing.createdAt : ts,
    updatedAt: ts,
  });
  return getFounderState(userId);
}

// ---- tasks ----
const TASK_COLUMNS = `
  id, user_id AS userId, title, objective, why_it_matters AS whyItMatters,
  dependencies, steps, current_step_index AS currentStepIndex,
  completion_criteria AS completionCriteria, evidence_requirements AS evidenceRequirements,
  required_threshold AS requiredThreshold, priority_factors AS priorityFactors, priority_score AS priorityScore,
  status, evidence_submitted AS evidenceSubmitted, verification_score AS verificationScore,
  verification_status AS verificationStatus, verification_notes AS verificationNotes,
  evidence_config AS evidenceConfig,
  category, objective_key AS objectiveKey, revisit_conditions AS revisitConditions,
  reason, why_now AS whyNow, expected_outcome AS expectedOutcome, context_references AS contextReferences,
  outcome_json AS outcomeJson,
  created_at AS createdAt, updated_at AS updatedAt, completed_at AS completedAt
`;

const insertTaskStmt = db.prepare(`
  INSERT INTO tasks (id, user_id, title, objective, why_it_matters, dependencies, steps, current_step_index, completion_criteria, evidence_requirements, required_threshold, priority_factors, priority_score, status, evidence_config, category, objective_key, revisit_conditions, reason, why_now, expected_outcome, context_references, created_at, updated_at)
  VALUES (@id, @userId, @title, @objective, @whyItMatters, @dependencies, @steps, 0, @completionCriteria, @evidenceRequirements, @requiredThreshold, @priorityFactors, @priorityScore, @status, @evidenceConfig, @category, @objectiveKey, @revisitConditions, @reason, @whyNow, @expectedOutcome, @contextReferences, @createdAt, @updatedAt)
`);
const getTaskStmt = db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ? AND user_id = ?`);
const listTasksStmt = db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE user_id = ? ORDER BY created_at ASC`);
const listByStatusStmt = db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE user_id = ? AND status = ? ORDER BY priority_score DESC`);
const listCompletedStmt = db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE user_id = ? AND status = 'COMPLETED' ORDER BY completed_at DESC LIMIT ?`);

// §16 — backward compatibility: tasks created before migration 008 have
// evidence_config = NULL in the database. Rather than requiring a data
// migration that guesses at every old task's intent, application code
// treats a NULL config as "fall back to the pre-existing text-based
// evidence_requirements + required_threshold behavior" — which is
// exactly what those tasks were already using and already work with. A
// default object is still returned here (never null) so callers never
// need a separate null-check branch.
function defaultEvidenceConfig(task) {
  return {
    required: true,
    preferredTypes: ["text"],
    alternativeTypes: [],
    minimumStrength: "medium",
    canAutoVerify: false, // legacy tasks never had automatic-evidence matching built for them
    legacy: true,
  };
}

function parseTaskRow(row) {
  if (!row) return null;
  return {
    ...row,
    dependencies: fromJSON(row.dependencies, []),
    steps: fromJSON(row.steps, []),
    priorityFactors: fromJSON(row.priorityFactors, {}),
    evidenceSubmitted: fromJSON(row.evidenceSubmitted, []),
    evidenceConfig: fromJSON(row.evidenceConfig, null) || defaultEvidenceConfig(row),
    // Pre-009 rows have objectiveKey/category = NULL and revisitConditions
    // = NULL — treated by executionEngine as "never an exact-key
    // duplicate" / "no documented reason to revisit", never as an error.
    revisitConditions: fromJSON(row.revisitConditions, []),
    // Pre-010 rows have reason/whyNow/expectedOutcome = NULL — callers
    // fall back to whyItMatters, which every task (old or new) has.
    contextReferences: fromJSON(row.contextReferences, []),
    // Pre-010 rows, and tasks completed via a background activity match
    // rather than the interactive flow (see executionEngine.verifyEvidence's
    // `source !== "activity"` guard), have outcomeJson = NULL — callers
    // fall back to verificationNotes, never treat this as an error.
    outcome: fromJSON(row.outcomeJson, null),
  };
}

function createTask({ userId, title, objective, whyItMatters, dependencies, steps, completionCriteria, evidenceRequirements, requiredThreshold, priorityFactors, priorityScore, status, evidenceConfig, category, objectiveKey, revisitConditions, reason, whyNow, expectedOutcome, contextReferences }) {
  const id = uid("task");
  const ts = nowISO();
  insertTaskStmt.run({
    id,
    userId: String(userId),
    title,
    objective,
    whyItMatters: whyItMatters || null,
    dependencies: toJSON(dependencies || []),
    steps: toJSON(steps || []),
    completionCriteria: completionCriteria || null,
    evidenceRequirements: evidenceRequirements || null,
    requiredThreshold: requiredThreshold != null ? requiredThreshold : 0.6,
    priorityFactors: toJSON(priorityFactors || {}),
    priorityScore: priorityScore || 0,
    status: status || "LOCKED",
    evidenceConfig: toJSON(evidenceConfig || null),
    category: category || null,
    objectiveKey: objectiveKey || null,
    revisitConditions: toJSON(revisitConditions || []),
    reason: reason || null,
    whyNow: whyNow || null,
    expectedOutcome: expectedOutcome || null,
    contextReferences: toJSON(contextReferences || []),
    createdAt: ts,
    updatedAt: ts,
  });
  return getTask(id, userId);
}

function getTask(id, userId) {
  return parseTaskRow(getTaskStmt.get(id, String(userId)));
}
function listTasks(userId) {
  return listTasksStmt.all(String(userId)).map(parseTaskRow);
}
function listByStatus(userId, status) {
  return listByStatusStmt.all(String(userId), status).map(parseTaskRow);
}
function listCompleted(userId, { limit = 50 } = {}) {
  return listCompletedStmt.all(String(userId), limit).map(parseTaskRow);
}

const updateStatusStmt = db.prepare(`UPDATE tasks SET status = ?, updated_at = ?, completed_at = ? WHERE id = ? AND user_id = ?`);
function setStatus(id, userId, status, { completed = false } = {}) {
  updateStatusStmt.run(status, nowISO(), completed ? nowISO() : null, id, String(userId));
  return getTask(id, userId);
}

const advanceStepStmt = db.prepare(`UPDATE tasks SET current_step_index = ?, updated_at = ? WHERE id = ? AND user_id = ?`);
function setCurrentStep(id, userId, stepIndex) {
  advanceStepStmt.run(stepIndex, nowISO(), id, String(userId));
  return getTask(id, userId);
}

// Evidence + verification are written together, atomically, by the same
// application-code path that just checked the threshold — see
// executionEngine.verifyEvidence. There is deliberately no separate "just
// mark completed" write path that skips this.
const recordEvidenceStmt = db.prepare(`
  UPDATE tasks SET evidence_submitted = ?, verification_score = ?, verification_status = ?, verification_notes = ?, updated_at = ?
  WHERE id = ? AND user_id = ?
`);
function recordEvidence(id, userId, { evidenceSubmitted, verificationScore, verificationStatus, verificationNotes }) {
  recordEvidenceStmt.run(toJSON(evidenceSubmitted), verificationScore, verificationStatus, verificationNotes || null, nowISO(), id, String(userId));
  return getTask(id, userId);
}

const updatePriorityStmt = db.prepare(`UPDATE tasks SET priority_score = ?, priority_factors = ?, updated_at = ? WHERE id = ? AND user_id = ?`);
function setPriority(id, userId, score, factors) {
  updatePriorityStmt.run(score, toJSON(factors || {}), nowISO(), id, String(userId));
}

// §6/§7/§13 of the context-aware-task-generation spec: captured once, at
// real completion, so the NEXT task-generation pass has something
// concrete to build on instead of re-deriving it from raw evidence text
// every time. See aiService.synthesizeTaskOutcome for how this is
// produced, and executionEngine.verifyEvidence for where it's called.
const recordOutcomeStmt = db.prepare(`UPDATE tasks SET outcome_json = ?, updated_at = ? WHERE id = ? AND user_id = ?`);
function recordOutcome(id, userId, outcome) {
  recordOutcomeStmt.run(toJSON(outcome || null), nowISO(), id, String(userId));
  return getTask(id, userId);
}

const addDependencyStmt = db.prepare(`UPDATE tasks SET dependencies = ?, status = ?, updated_at = ? WHERE id = ? AND user_id = ?`);
function addDependencyAndLock(id, userId, newDepTaskId) {
  const task = getTask(id, userId);
  if (!task) return null;
  const deps = [...new Set([...(task.dependencies || []), newDepTaskId])];
  addDependencyStmt.run(toJSON(deps), "LOCKED", nowISO(), id, String(userId));
  return getTask(id, userId);
}

// ---- task_evidence ----
// The real, queryable evidence ledger (§3) — separate from tasks'
// existing evidence_submitted JSON blob, which stays untouched for
// backward compatibility. Every piece of evidence, automatic or manual,
// gets a row here; a task's displayed "evidence" is just this table
// filtered by task_id, which is also what lets one activity legitimately
// produce evidence rows against more than one task (§2) without any
// data duplication on the activities side.
const EVIDENCE_COLUMNS = `
  id, task_id AS taskId, user_id AS userId, activity_id AS activityId, kind,
  content, relevance_score AS relevanceScore, strength,
  verification_status AS verificationStatus, verification_score AS verificationScore,
  notes, created_at AS createdAt
`;
const insertEvidenceStmt = db.prepare(`
  INSERT INTO task_evidence (id, task_id, user_id, activity_id, kind, content, relevance_score, strength, verification_status, verification_score, notes, created_at)
  VALUES (@id, @taskId, @userId, @activityId, @kind, @content, @relevanceScore, @strength, @verificationStatus, @verificationScore, @notes, @createdAt)
`);
const listEvidenceForTaskStmt = db.prepare(`SELECT ${EVIDENCE_COLUMNS} FROM task_evidence WHERE task_id = ? AND user_id = ? ORDER BY created_at ASC`);
const existsForActivityAndTaskStmt = db.prepare(`SELECT id FROM task_evidence WHERE task_id = ? AND activity_id = ? LIMIT 1`);

function addEvidence({ taskId, userId, activityId, kind, content, relevanceScore, strength, verificationStatus, verificationScore, notes }) {
  const id = uid("ev");
  insertEvidenceStmt.run({
    id,
    taskId,
    userId: String(userId),
    activityId: activityId || null,
    kind,
    content: content || null,
    relevanceScore: relevanceScore != null ? relevanceScore : null,
    strength: strength || null,
    verificationStatus: verificationStatus || "evidence_found",
    verificationScore: verificationScore != null ? verificationScore : null,
    notes: notes || null,
    createdAt: nowISO(),
  });
  return id;
}
function listEvidenceForTask(taskId, userId) {
  return listEvidenceForTaskStmt.all(taskId, String(userId));
}
// §14 dedupe guard specific to evidence: the same activity should never
// produce two evidence rows against the same task even if matching runs
// twice (e.g. a retried request).
function hasEvidenceForActivity(taskId, activityId) {
  return !!existsForActivityAndTaskStmt.get(taskId, activityId);
}

module.exports = {
  getFounderState, saveFounderState,
  createTask, getTask, listTasks, listByStatus, listCompleted,
  setStatus, setCurrentStep, recordEvidence, recordOutcome, setPriority, addDependencyAndLock,
  addEvidence, listEvidenceForTask, hasEvidenceForActivity,
};  const ts = nowISO();
  upsertStateStmt.run({
    userId: String(userId),
    stateJson: toJSON(state),
    ready: ready ? 1 : 0,
    createdAt: existing ? existing.createdAt : ts,
    updatedAt: ts,
  });
  return getFounderState(userId);
}

// ---- tasks ----
const TASK_COLUMNS = `
  id, user_id AS userId, title, objective, why_it_matters AS whyItMatters,
  dependencies, steps, current_step_index AS currentStepIndex,
  completion_criteria AS completionCriteria, evidence_requirements AS evidenceRequirements,
  required_threshold AS requiredThreshold, priority_factors AS priorityFactors, priority_score AS priorityScore,
  status, evidence_submitted AS evidenceSubmitted, verification_score AS verificationScore,
  verification_status AS verificationStatus, verification_notes AS verificationNotes,
  evidence_config AS evidenceConfig,
  category, objective_key AS objectiveKey, revisit_conditions AS revisitConditions,
  created_at AS createdAt, updated_at AS updatedAt, completed_at AS completedAt
`;

const insertTaskStmt = db.prepare(`
  INSERT INTO tasks (id, user_id, title, objective, why_it_matters, dependencies, steps, current_step_index, completion_criteria, evidence_requirements, required_threshold, priority_factors, priority_score, status, evidence_config, category, objective_key, revisit_conditions, created_at, updated_at)
  VALUES (@id, @userId, @title, @objective, @whyItMatters, @dependencies, @steps, 0, @completionCriteria, @evidenceRequirements, @requiredThreshold, @priorityFactors, @priorityScore, @status, @evidenceConfig, @category, @objectiveKey, @revisitConditions, @createdAt, @updatedAt)
`);
const getTaskStmt = db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ? AND user_id = ?`);
const listTasksStmt = db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE user_id = ? ORDER BY created_at ASC`);
const listByStatusStmt = db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE user_id = ? AND status = ? ORDER BY priority_score DESC`);
const listCompletedStmt = db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE user_id = ? AND status = 'COMPLETED' ORDER BY completed_at DESC LIMIT ?`);

// §16 — backward compatibility: tasks created before migration 008 have
// evidence_config = NULL in the database. Rather than requiring a data
// migration that guesses at every old task's intent, application code
// treats a NULL config as "fall back to the pre-existing text-based
// evidence_requirements + required_threshold behavior" — which is
// exactly what those tasks were already using and already work with. A
// default object is still returned here (never null) so callers never
// need a separate null-check branch.
function defaultEvidenceConfig(task) {
  return {
    required: true,
    preferredTypes: ["text"],
    alternativeTypes: [],
    minimumStrength: "medium",
    canAutoVerify: false, // legacy tasks never had automatic-evidence matching built for them
    legacy: true,
  };
}

function parseTaskRow(row) {
  if (!row) return null;
  return {
    ...row,
    dependencies: fromJSON(row.dependencies, []),
    steps: fromJSON(row.steps, []),
    priorityFactors: fromJSON(row.priorityFactors, {}),
    evidenceSubmitted: fromJSON(row.evidenceSubmitted, []),
    evidenceConfig: fromJSON(row.evidenceConfig, null) || defaultEvidenceConfig(row),
    // Pre-009 rows have objectiveKey/category = NULL and revisitConditions
    // = NULL — treated by executionEngine as "never an exact-key
    // duplicate" / "no documented reason to revisit", never as an error.
    revisitConditions: fromJSON(row.revisitConditions, []),
  };
}

function createTask({ userId, title, objective, whyItMatters, dependencies, steps, completionCriteria, evidenceRequirements, requiredThreshold, priorityFactors, priorityScore, status, evidenceConfig, category, objectiveKey, revisitConditions }) {
  const id = uid("task");
  const ts = nowISO();
  insertTaskStmt.run({
    id,
    userId: String(userId),
    title,
    objective,
    whyItMatters: whyItMatters || null,
    dependencies: toJSON(dependencies || []),
    steps: toJSON(steps || []),
    completionCriteria: completionCriteria || null,
    evidenceRequirements: evidenceRequirements || null,
    requiredThreshold: requiredThreshold != null ? requiredThreshold : 0.6,
    priorityFactors: toJSON(priorityFactors || {}),
    priorityScore: priorityScore || 0,
    status: status || "LOCKED",
    evidenceConfig: toJSON(evidenceConfig || null),
    category: category || null,
    objectiveKey: objectiveKey || null,
    revisitConditions: toJSON(revisitConditions || []),
    createdAt: ts,
    updatedAt: ts,
  });
  return getTask(id, userId);
}

function getTask(id, userId) {
  return parseTaskRow(getTaskStmt.get(id, String(userId)));
}
function listTasks(userId) {
  return listTasksStmt.all(String(userId)).map(parseTaskRow);
}
function listByStatus(userId, status) {
  return listByStatusStmt.all(String(userId), status).map(parseTaskRow);
}
function listCompleted(userId, { limit = 50 } = {}) {
  return listCompletedStmt.all(String(userId), limit).map(parseTaskRow);
}

const updateStatusStmt = db.prepare(`UPDATE tasks SET status = ?, updated_at = ?, completed_at = ? WHERE id = ? AND user_id = ?`);
function setStatus(id, userId, status, { completed = false } = {}) {
  updateStatusStmt.run(status, nowISO(), completed ? nowISO() : null, id, String(userId));
  return getTask(id, userId);
}

const advanceStepStmt = db.prepare(`UPDATE tasks SET current_step_index = ?, updated_at = ? WHERE id = ? AND user_id = ?`);
function setCurrentStep(id, userId, stepIndex) {
  advanceStepStmt.run(stepIndex, nowISO(), id, String(userId));
  return getTask(id, userId);
}

// Evidence + verification are written together, atomically, by the same
// application-code path that just checked the threshold — see
// executionEngine.verifyEvidence. There is deliberately no separate "just
// mark completed" write path that skips this.
const recordEvidenceStmt = db.prepare(`
  UPDATE tasks SET evidence_submitted = ?, verification_score = ?, verification_status = ?, verification_notes = ?, updated_at = ?
  WHERE id = ? AND user_id = ?
`);
function recordEvidence(id, userId, { evidenceSubmitted, verificationScore, verificationStatus, verificationNotes }) {
  recordEvidenceStmt.run(toJSON(evidenceSubmitted), verificationScore, verificationStatus, verificationNotes || null, nowISO(), id, String(userId));
  return getTask(id, userId);
}

const updatePriorityStmt = db.prepare(`UPDATE tasks SET priority_score = ?, priority_factors = ?, updated_at = ? WHERE id = ? AND user_id = ?`);
function setPriority(id, userId, score, factors) {
  updatePriorityStmt.run(score, toJSON(factors || {}), nowISO(), id, String(userId));
}

const addDependencyStmt = db.prepare(`UPDATE tasks SET dependencies = ?, status = ?, updated_at = ? WHERE id = ? AND user_id = ?`);
function addDependencyAndLock(id, userId, newDepTaskId) {
  const task = getTask(id, userId);
  if (!task) return null;
  const deps = [...new Set([...(task.dependencies || []), newDepTaskId])];
  addDependencyStmt.run(toJSON(deps), "LOCKED", nowISO(), id, String(userId));
  return getTask(id, userId);
}

// ---- task_evidence ----
// The real, queryable evidence ledger (§3) — separate from tasks'
// existing evidence_submitted JSON blob, which stays untouched for
// backward compatibility. Every piece of evidence, automatic or manual,
// gets a row here; a task's displayed "evidence" is just this table
// filtered by task_id, which is also what lets one activity legitimately
// produce evidence rows against more than one task (§2) without any
// data duplication on the activities side.
const EVIDENCE_COLUMNS = `
  id, task_id AS taskId, user_id AS userId, activity_id AS activityId, kind,
  content, relevance_score AS relevanceScore, strength,
  verification_status AS verificationStatus, verification_score AS verificationScore,
  notes, created_at AS createdAt
`;
const insertEvidenceStmt = db.prepare(`
  INSERT INTO task_evidence (id, task_id, user_id, activity_id, kind, content, relevance_score, strength, verification_status, verification_score, notes, created_at)
  VALUES (@id, @taskId, @userId, @activityId, @kind, @content, @relevanceScore, @strength, @verificationStatus, @verificationScore, @notes, @createdAt)
`);
const listEvidenceForTaskStmt = db.prepare(`SELECT ${EVIDENCE_COLUMNS} FROM task_evidence WHERE task_id = ? AND user_id = ? ORDER BY created_at ASC`);
const existsForActivityAndTaskStmt = db.prepare(`SELECT id FROM task_evidence WHERE task_id = ? AND activity_id = ? LIMIT 1`);

function addEvidence({ taskId, userId, activityId, kind, content, relevanceScore, strength, verificationStatus, verificationScore, notes }) {
  const id = uid("ev");
  insertEvidenceStmt.run({
    id,
    taskId,
    userId: String(userId),
    activityId: activityId || null,
    kind,
    content: content || null,
    relevanceScore: relevanceScore != null ? relevanceScore : null,
    strength: strength || null,
    verificationStatus: verificationStatus || "evidence_found",
    verificationScore: verificationScore != null ? verificationScore : null,
    notes: notes || null,
    createdAt: nowISO(),
  });
  return id;
}
function listEvidenceForTask(taskId, userId) {
  return listEvidenceForTaskStmt.all(taskId, String(userId));
}
// §14 dedupe guard specific to evidence: the same activity should never
// produce two evidence rows against the same task even if matching runs
// twice (e.g. a retried request).
function hasEvidenceForActivity(taskId, activityId) {
  return !!existsForActivityAndTaskStmt.get(taskId, activityId);
}

module.exports = {
  getFounderState, saveFounderState,
  createTask, getTask, listTasks, listByStatus, listCompleted,
  setStatus, setCurrentStep, recordEvidence, setPriority, addDependencyAndLock,
  addEvidence, listEvidenceForTask, hasEvidenceForActivity,
};
