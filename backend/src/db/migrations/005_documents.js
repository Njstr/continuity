// 005_documents — backs the in-chat document upload feature. Each row is
// one uploaded file's extracted text plus metadata. `persistent` reflects
// the founder's explicit "remember this?" choice: 0 = scoped to the
// conversation it was uploaded in only, 1 = available as context in every
// future conversation for that founder too.

module.exports = {
  id: "005_documents",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        conversation_id TEXT,
        filename TEXT NOT NULL,
        mime_type TEXT,
        char_count INTEGER NOT NULL DEFAULT 0,
        extracted_text TEXT NOT NULL,
        needs_ocr INTEGER NOT NULL DEFAULT 0,
        persistent INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_documents_user ON documents (user_id);
      CREATE INDEX IF NOT EXISTS idx_documents_conversation ON documents (conversation_id);
    `);
  },
};
