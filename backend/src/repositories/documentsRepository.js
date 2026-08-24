const { db } = require("../db/connection");

const insertStmt = db.prepare(`
  INSERT INTO documents (id, user_id, conversation_id, filename, mime_type, char_count, extracted_text, needs_ocr, persistent, created_at)
  VALUES (@id, @userId, @conversationId, @filename, @mimeType, @charCount, @extractedText, @needsOcr, @persistent, @createdAt)
`);

const SELECT_COLUMNS = `
  id, user_id AS userId, conversation_id AS conversationId, filename, mime_type AS mimeType,
  char_count AS charCount, extracted_text AS extractedText, needs_ocr AS needsOcr,
  persistent, created_at AS createdAt
`;

const getStmt = db.prepare(`SELECT ${SELECT_COLUMNS} FROM documents WHERE id = ? AND user_id = ?`);

const listForConversationStmt = db.prepare(`
  SELECT ${SELECT_COLUMNS} FROM documents WHERE user_id = ? AND conversation_id = ? ORDER BY created_at DESC
`);

// Persistent knowledge base — documents the founder explicitly chose to
// remember, usable as context in ANY conversation, not just the one they
// were uploaded in.
const listPersistentStmt = db.prepare(`
  SELECT ${SELECT_COLUMNS} FROM documents WHERE user_id = ? AND persistent = 1 ORDER BY created_at DESC
`);

const listAllForUserStmt = db.prepare(`
  SELECT ${SELECT_COLUMNS} FROM documents WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
`);

const setPersistentStmt = db.prepare(`UPDATE documents SET persistent = ? WHERE id = ? AND user_id = ?`);
const deleteStmt = db.prepare(`DELETE FROM documents WHERE id = ? AND user_id = ?`);
const deleteNonPersistentForConversationStmt = db.prepare(`
  DELETE FROM documents WHERE user_id = ? AND conversation_id = ? AND persistent = 0
`);

function parseRow(row) {
  if (!row) return row;
  return { ...row, needsOcr: !!row.needsOcr, persistent: !!row.persistent };
}

function add(entry) {
  insertStmt.run({
    id: entry.id,
    userId: String(entry.userId),
    conversationId: entry.conversationId || null,
    filename: entry.filename,
    mimeType: entry.mimeType || null,
    charCount: entry.charCount || 0,
    extractedText: entry.extractedText || "",
    needsOcr: entry.needsOcr ? 1 : 0,
    persistent: entry.persistent ? 1 : 0,
    createdAt: new Date().toISOString(),
  });
  return get(entry.id, entry.userId);
}

function get(id, userId) {
  return parseRow(getStmt.get(id, String(userId)));
}

function listForConversation(userId, conversationId) {
  return listForConversationStmt.all(String(userId), conversationId).map(parseRow);
}

function listPersistent(userId) {
  return listPersistentStmt.all(String(userId)).map(parseRow);
}

function listAllForUser(userId, { limit = 200 } = {}) {
  return listAllForUserStmt.all(String(userId), limit).map(parseRow);
}

function setPersistent(id, userId, persistent) {
  setPersistentStmt.run(persistent ? 1 : 0, id, String(userId));
  return get(id, userId);
}

function remove(id, userId) {
  deleteStmt.run(id, String(userId));
}

function deleteNonPersistentForConversation(userId, conversationId) {
  deleteNonPersistentForConversationStmt.run(String(userId), conversationId);
}

module.exports = { add, get, listForConversation, listPersistent, listAllForUser, setPersistent, remove, deleteNonPersistentForConversation };
