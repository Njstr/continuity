const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const config = require("../config");
const { db } = require("../db/connection");

const router = express.Router();

// Every real data table except schema_migrations, which must survive so
// the migration runner doesn't try to re-apply everything on next boot.
const WIPEABLE_TABLES = [
  "users", "kv_store", "feedback", "execution_patterns",
  "documents", "decisions", "predictions", "decision_outcomes", "learned_patterns",
];

function checkAdminToken(req, res) {
  if (!config.adminToken) {
    res.status(404).json({ error: true, message: "Not found" });
    return false;
  }
  const provided = req.query.token || (req.header("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (provided !== config.adminToken) {
    res.status(401).json({ error: true, message: "Invalid or missing admin token" });
    return false;
  }
  return true;
}

// Irreversible — deletes every row from every real table, for every user,
// not just the caller's own data. Requires BOTH the admin token AND an
// exact confirmation phrase in the body, on purpose: a wrong query param
// or a copy-pasted curl command shouldn't be able to trigger this by
// accident. Table schemas are untouched, only their contents.
router.post(
  "/wipe-data",
  asyncHandler(async (req, res) => {
    if (!checkAdminToken(req, res)) return;
    if (req.body?.confirm !== "DELETE ALL DATA") {
      return res.status(400).json({
        error: true,
        message: 'This permanently deletes ALL data for ALL users. To proceed, POST { "confirm": "DELETE ALL DATA" } with your admin token.',
      });
    }

    const deletedCounts = {};
    const wipe = db.transaction(() => {
      for (const table of WIPEABLE_TABLES) {
        const { count } = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
        db.prepare(`DELETE FROM ${table}`).run();
        deletedCounts[table] = count;
      }
    });
    wipe();

    res.json({ ok: true, deletedCounts, note: "Table schemas untouched, only row data deleted. This cannot be undone." });
  })
);

module.exports = router;
