const { db } = require("../db/connection");

const insertStmt = db.prepare(`
  INSERT INTO feedback (user_id, context, content, rating, comment, prompt, simulated, simulation_result, metrics_snapshot, created_at)
  VALUES (@userId, @context, @content, @rating, @comment, @prompt, @simulated, @simulationResult, @metricsSnapshot, @createdAt)
`);

const SELECT_COLUMNS = `
  id, user_id AS userId, context, content, rating, comment, prompt,
  simulated, simulation_result AS simulationResult, metrics_snapshot AS metricsSnapshot,
  created_at AS createdAt
`;

// Admin/aggregate view — every user, newest first.
const listStmt = db.prepare(`
  SELECT ${SELECT_COLUMNS}
  FROM feedback
  ORDER BY id DESC
  LIMIT ?
`);

// Founder-facing view — scoped to one user (device id or account id),
// which is what powers the in-app Feedback Center.
const listForUserStmt = db.prepare(`
  SELECT ${SELECT_COLUMNS}
  FROM feedback
  WHERE user_id = ?
  ORDER BY id DESC
  LIMIT ?
`);

function safeJsonStringify(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function parseRow(row) {
  if (!row) return row;
  return {
    ...row,
    simulated: !!row.simulated,
    simulationResult: row.simulationResult ? safeJsonParse(row.simulationResult) : null,
    metricsSnapshot: row.metricsSnapshot ? safeJsonParse(row.metricsSnapshot) : null,
  };
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function add(entry) {
  const info = insertStmt.run({
    userId: String(entry.userId || "local"),
    context: entry.context || "general",
    content: entry.content || null,
    rating: entry.rating || null,
    comment: entry.comment || null,
    prompt: entry.prompt || null,
    simulated: entry.simulated ? 1 : 0,
    simulationResult: safeJsonStringify(entry.simulationResult),
    metricsSnapshot: safeJsonStringify(entry.metricsSnapshot),
    createdAt: new Date().toISOString(),
  });
  return info.lastInsertRowid;
}

function list({ limit = 200 } = {}) {
  return listStmt.all(limit).map(parseRow);
}

function listForUser(userId, { limit = 200 } = {}) {
  return listForUserStmt.all(String(userId || "local"), limit).map(parseRow);
}

module.exports = { add, list, listForUser };
