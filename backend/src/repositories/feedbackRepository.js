const { db } = require("../db/connection");

const insertStmt = db.prepare(`
  INSERT INTO feedback (user_id, context, content, rating, comment, created_at)
  VALUES (@userId, @context, @content, @rating, @comment, @createdAt)
`);

const listStmt = db.prepare(`
  SELECT id, user_id AS userId, context, content, rating, comment, created_at AS createdAt
  FROM feedback
  ORDER BY id DESC
  LIMIT ?
`);

function add(entry) {
  const info = insertStmt.run({
    userId: String(entry.userId || "local"),
    context: entry.context || "general",
    content: entry.content || null,
    rating: entry.rating || null,
    comment: entry.comment || null,
    createdAt: new Date().toISOString(),
  });
  return info.lastInsertRowid;
}

function list({ limit = 200 } = {}) {
  return listStmt.all(limit);
}

module.exports = { add, list };
