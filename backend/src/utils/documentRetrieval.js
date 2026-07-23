// Lexical retrieval, not semantic/vector search. This is a deliberate,
// disclosed scope cut: real semantic search needs an embeddings provider
// and a vector index (or an extension like sqlite-vss), which is real
// infra to stand up. This term-overlap scorer is honest about what it is
// — it finds chunks that share vocabulary with the question, which works
// reasonably for direct lookups ("what is our maternity leave policy")
// but will miss purely conceptual matches with no shared wording. Good
// enough to ship v1 on; worth upgrading if recall turns out to matter.

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;
const STOPWORDS = new Set(
  "a an the is are was were be been being of on in to for with and or but if then so as at by from this that these those it its our your their his her they he she we you i what which who whom how when where why do does did can could should would will shall not no yes about into over under again further".split(" ")
);

function chunkText(text, filename) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    const chunk = text.slice(start, end);
    if (chunk.trim()) chunks.push({ filename, text: chunk.trim() });
    if (end >= text.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

function tokenize(str) {
  return (str.toLowerCase().match(/[a-z0-9']+/g) || []).filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function scoreChunk(queryTerms, chunk) {
  const chunkTerms = tokenize(chunk.text);
  if (!chunkTerms.length) return 0;
  const chunkSet = new Set(chunkTerms);
  let hits = 0;
  for (const term of queryTerms) if (chunkSet.has(term)) hits++;
  // Normalize slightly by chunk length so one giant chunk doesn't always win
  // just by containing more words overall.
  return hits / Math.sqrt(chunkTerms.length);
}

// documents: [{ filename, extractedText }]. Returns the top N chunks
// across ALL given documents, each tagged with its source filename.
function retrieveRelevantChunks(documents, query, { topN = 5 } = {}) {
  const queryTerms = tokenize(query);
  if (!queryTerms.length || !documents.length) return [];

  const allChunks = documents.flatMap((doc) => chunkText(doc.extractedText || "", doc.filename));
  const scored = allChunks
    .map((chunk) => ({ ...chunk, score: scoreChunk(queryTerms, chunk) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, topN);
}

module.exports = { retrieveRelevantChunks, chunkText };
