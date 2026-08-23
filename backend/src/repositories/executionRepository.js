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
  created_at AS createdAt, updated_at AS updatedAt, completed_at AS completedAt
`;

const insertTaskStmt = db.prepare(`
  INSERT INTO tasks (id, user_id, title, objective, why_it_matters, dependencies, steps, current_step_index, completion_criteria, evidence_requirements, required_threshold, priority_factors, priority_score, status, created_at, updated_at)
  VALUES (@id, @userId, @title, @objective, @whyItMatters, @dependencies, @steps, 0, @completionCriteria, @evidenceRequirements, @requiredThreshold, @priorityFactors, @priorityScore, @status, @createdAt, @updatedAt)
`);
const getTaskStmt = db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ? AND user_id = ?`);
const listTasksStmt = db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE user_id = ? ORDER BY created_at ASC`);
const listByStatusStmt = db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE user_id = ? AND status = ? ORDER BY priority_score DESC`);
const listCompletedStmt = db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE user_id = ? AND status = 'COMPLETED' ORDER BY completed_at DESC LIMIT ?`);

function parseTaskRow(row) {
  if (!row) return null;
  return {
    ...row,
    dependencies: fromJSON(row.dependencies, []),
    steps: fromJSON(row.steps, []),
    priorityFactors: fromJSON(row.priorityFactors, {}),
    evidenceSubmitted: fromJSON(row.evidenceSubmitted, []),
  };
}

function createTask({ userId, title, objective, whyItMatters, dependencies, steps, completionCriteria, evidenceRequirements, requiredThreshold, priorityFactors, priorityScore, status }) {
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

module.exports = {
  getFounderState, saveFounderState,
  createTask, getTask, listTasks, listByStatus, listCompleted,
  setStatus, setCurrentStep, recordEvidence, setPriority, addDependencyAndLock,
};
