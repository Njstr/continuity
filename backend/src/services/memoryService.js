const fileStore = require("../store/fileStore");

// memoryService — the Founder Memory system.
//
// Every meaningful event (a mission outcome, a decision, a customer
// interview note, a mentor exchange worth remembering) gets written here
// as a small tagged entry. Before any AI call that benefits from context,
// the backend retrieves the most relevant entries and folds them into the
// system prompt, so the mentor "remembers" months of progress.
//
// Retrieval here is intentionally simple — recency + lexical keyword
// overlap — not embeddings/vector search. That's the natural upgrade path
// once memory volume justifies it (swap retrieve() to call a vector DB;
// remember()/the storage shape don't need to change).

const MEMORY_TYPES = [
  "goal", "strength", "weakness", "personality", "preference",
  "startup_history", "customer_interview", "decision", "win",
  "failure", "recurring_blocker", "mentor_note",
  // Reasoning-engine context extraction (see aiService.extractCompanyContext)
  "company_fact", "assumption", "validated_assumption", "rejected_assumption",
  "risk", "experiment", "pivot",
];

function remember(userId, entry) {
  const record = {
    id: Date.now() + Math.random().toString(36).slice(2, 7),
    type: MEMORY_TYPES.includes(entry.type) ? entry.type : "mentor_note",
    text: String(entry.text || "").slice(0, 1000),
    tags: entry.tags || [],
    date: new Date().toISOString(),
  };
  return fileStore.append(userId, "memory", record, { max: 2000 });
}

function allMemories(userId) {
  return fileStore.get(userId, "memory", []);
}

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);
}

/**
 * Returns the most relevant memory entries for a given query/context,
 * blending recency with lexical overlap. Cheap and dependency-free.
 */
function retrieve(userId, query, { limit = 12 } = {}) {
  const memories = allMemories(userId);
  if (memories.length === 0) return [];

  const queryWords = new Set(tokenize(query));
  const now = Date.now();

  const scored = memories.map((m) => {
    const words = tokenize(m.text);
    const overlap = words.filter((w) => queryWords.has(w)).length;
    const ageMs = now - new Date(m.date).getTime();
    const recencyScore = Math.max(0, 1 - ageMs / (1000 * 60 * 60 * 24 * 90)); // decays over ~90 days
    return { ...m, score: overlap * 2 + recencyScore };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .sort((a, b) => new Date(a.date) - new Date(b.date)); // chronological for prompt readability
}

// "Memory graph" — pragmatic version: memories are grouped into the
// causal chain the spec describes (Vision → Product/Customer →
// Assumptions → Experiments → Results → Lessons → Decisions) instead of
// a flat chronological list, so the model can reason across relationships
// directly from prompt structure. A literal graph database (explicit
// nodes/edges, graph queries) is a materially bigger, separate piece of
// infrastructure — this gets most of the real reasoning benefit without
// standing up a new storage layer for it.
const GRAPH_GROUPS = [
  { label: "VISION & GOALS", types: ["goal"] },
  { label: "PRODUCT, CUSTOMER & COMPANY FACTS", types: ["company_fact", "startup_history"] },
  { label: "ASSUMPTIONS", types: ["assumption"] },
  { label: "EXPERIMENTS & CUSTOMER CONTACT", types: ["experiment", "customer_interview"] },
  { label: "RESULTS", types: ["validated_assumption", "rejected_assumption", "win", "failure"] },
  { label: "LESSONS & PIVOTS", types: ["recurring_blocker", "pivot", "mentor_note"] },
  { label: "DECISIONS", types: ["decision"] },
  { label: "RISKS", types: ["risk"] },
  { label: "ABOUT THE FOUNDER", types: ["strength", "weakness", "personality", "preference"] },
];

function memoriesToPromptBlock(memories) {
  if (!memories.length) return "No prior memory yet — this may be an early conversation with this founder.";
  const used = new Set();
  const sections = [];
  for (const group of GRAPH_GROUPS) {
    const items = memories.filter((m) => group.types.includes(m.type));
    if (!items.length) continue;
    items.forEach((m) => used.add(m));
    sections.push(`${group.label}:\n${items.map((m) => `- [${m.date.slice(0, 10)}] ${m.text}`).join("\n")}`);
  }
  const leftover = memories.filter((m) => !used.has(m));
  if (leftover.length) {
    sections.push(`OTHER:\n${leftover.map((m) => `- [${m.type}, ${m.date.slice(0, 10)}] ${m.text}`).join("\n")}`);
  }
  return sections.join("\n\n");
}

module.exports = { remember, retrieve, allMemories, memoriesToPromptBlock, MEMORY_TYPES };
