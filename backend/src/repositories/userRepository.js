const { db } = require("../db/connection");

const findByEmailStmt = db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE");
const findByIdStmt = db.prepare("SELECT * FROM users WHERE id = ?");
const insertStmt = db.prepare(
  "INSERT INTO users (id, email, password_hash, created_at) VALUES (@id, @email, @passwordHash, @createdAt)"
);

function rowToUser(row) {
  if (!row) return null;
  return { id: row.id, email: row.email, passwordHash: row.password_hash, createdAt: row.created_at };
}

function findByEmail(email) {
  return rowToUser(findByEmailStmt.get(String(email || "")));
}

function findById(id) {
  return rowToUser(findByIdStmt.get(id));
}

function create(user) {
  insertStmt.run({
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    createdAt: user.createdAt,
  });
  return user;
}

module.exports = { findByEmail, findById, create };
