// Note: pdfjs-dist logs a couple of harmless "Cannot polyfill DOMMatrix/
// Path2D" warnings once, at boot, when this module is first required.
// They're about rendering support we never use (we only extract text) —
// safe to ignore, not a per-request cost.
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
const mammoth = require("mammoth");
const cheerio = require("cheerio");

const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "text/plain",
  "text/markdown",
  "text/x-markdown",
]);

function isSupportedFile(file) {
  if (SUPPORTED_MIME_TYPES.has(file.mimetype)) return true;
  // Some browsers send text/markdown as application/octet-stream — fall
  // back to the extension for .md/.txt.
  return /\.(txt|md|markdown)$/i.test(file.originalname);
}

// Real OCR (tesseract or a hosted OCR API) is not wired up yet — see the
// note in the upload route. This is a heuristic: a PDF with very little
// extractable text relative to its page count is almost certainly a
// scanned image, so we flag it honestly instead of quietly returning near-
// empty "knowledge" that the AI would then answer questions about.
function looksScanned(text, numPages) {
  if (!numPages) return false;
  const avgCharsPerPage = text.length / numPages;
  return avgCharsPerPage < 40;
}

// ---- PDF: layout-aware extraction ----
// Naive extraction (join every text item with a space) flattens tables
// into one run-on line — "Metric Jan Feb Mar MRR 40000 42000 45000" — with
// no way to tell which number belongs to which column. That's exactly the
// case that matters most for financial data.
//
// pdfjs gives each text fragment its own (x, y) position. This groups
// fragments into rows by y-position, then within a row inserts a column
// separator wherever there's a horizontal gap much bigger than normal
// word-spacing — which, in a real table, is almost always a column
// boundary. Good on regular grid tables; imperfect on merged cells,
// rotated text, or true multi-column page layouts (those can interleave
// rows from two columns). That's a real, disclosed limitation, not a bug
// to silently accept as "good enough."
const ROW_Y_TOLERANCE = 3; // px — fragments within this are the same row
// Normal inter-word spacing is roughly 0.25-0.5x the font size in most
// fonts; real column gaps in tables run several times that. 1.5x gives
// comfortable margin between the two without being so high it misses
// tightly-spaced tables.
const COLUMN_GAP_FONT_MULTIPLIER = 1.5;

function reconstructPageLayout(items) {
  if (!items.length) return "";

  const sorted = [...items].sort((a, b) => {
    const ay = a.transform[5];
    const by = b.transform[5];
    if (Math.abs(ay - by) > ROW_Y_TOLERANCE) return by - ay; // PDF y grows upward — top of page first
    return a.transform[4] - b.transform[4]; // left to right within a row
  });

  const rows = [];
  let currentRow = [];
  let currentY = null;
  for (const item of sorted) {
    const y = item.transform[5];
    if (currentY !== null && Math.abs(y - currentY) > ROW_Y_TOLERANCE) {
      rows.push(currentRow);
      currentRow = [];
    }
    currentRow.push(item);
    currentY = y;
  }
  if (currentRow.length) rows.push(currentRow);

  return rows.map(buildRowLine).filter(Boolean).join("\n");
}

function buildRowLine(row) {
  let line = "";
  let prevEndX = null;

  row.forEach((item) => {
    const x = item.transform[4];
    // pdfjs reports an accurate .width for real glyph runs; it also
    // synthesizes whitespace-only items to represent horizontal gaps
    // between separately-drawn text runs (e.g. table cells) — those
    // gap-fill items are the actual signal for "is this a column
    // boundary", NOT the single space character in their .str.
    const width = item.width != null ? item.width : item.str.length * (item.transform[0] || 6) * 0.5;
    const isGapFill = item.str.trim() === "";
    const columnFontScale = item.transform[0] || 12;

    if (isGapFill) {
      if (width > columnFontScale * COLUMN_GAP_FONT_MULTIPLIER) {
        if (!line.endsWith("  |  ")) line += line ? "  |  " : "";
      } else if (width > 0 && line && !line.endsWith(" ")) {
        line += " ";
      }
      prevEndX = x + width;
      return;
    }

    if (prevEndX !== null) {
      const gap = x - prevEndX;
      if (gap > columnFontScale * COLUMN_GAP_FONT_MULTIPLIER) {
        if (!line.endsWith("  |  ")) line += line ? "  |  " : "";
      } else if (gap > 1 && line && !line.endsWith(" ")) {
        line += " ";
      }
    }
    line += item.str;
    prevEndX = x + width;
  });

  return line.trim();
}

async function extractPdfText(buffer) {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer), verbosity: 0 });
  const doc = await loadingTask.promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += reconstructPageLayout(content.items) + "\n\n";
  }
  return { text: text.trim(), numPages: doc.numPages };
}

// ---- DOCX: table-aware extraction ----
// mammoth.extractRawText() strips table markup entirely, same flattening
// problem as naive PDF extraction. Converting to HTML first preserves
// <table> structure, which we then turn into markdown-style pipe tables —
// readable by both a human skimming logs and the downstream retrieval/
// extraction prompts, and immune to the "which column is this" ambiguity
// plain-text flattening causes.
async function extractDocxText(buffer) {
  const { value: html } = await mammoth.convertToHtml({ buffer });
  const $ = cheerio.load(html);

  $("table").each((_, table) => {
    const rows = [];
    $(table)
      .find("tr")
      .each((__, tr) => {
        const cells = $(tr)
          .find("td, th")
          .map((___, cell) => $(cell).text().trim().replace(/\s+/g, " "))
          .get();
        if (cells.length) rows.push(`| ${cells.join(" | ")} |`);
      });
    if (rows.length > 1) {
      const colCount = rows[0].split("|").length - 2;
      rows.splice(1, 0, `| ${Array(Math.max(colCount, 1)).fill("---").join(" | ")} |`);
    }
    $(table).replaceWith(`\n${rows.join("\n")}\n`);
  });

  return $.root()
    .text()
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractText(file) {
  const { mimetype, originalname, buffer } = file;

  if (mimetype === "application/pdf" || /\.pdf$/i.test(originalname)) {
    const { text, numPages } = await extractPdfText(buffer);
    return { text, needsOcr: looksScanned(text, numPages) };
  }

  if (
    mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    /\.docx$/i.test(originalname)
  ) {
    const text = await extractDocxText(buffer);
    return { text: text.trim(), needsOcr: false };
  }

  if (/\.(txt|md|markdown)$/i.test(originalname) || (mimetype || "").startsWith("text/")) {
    return { text: buffer.toString("utf-8").trim(), needsOcr: false };
  }

  throw new Error(`Unsupported file type: ${mimetype || originalname}`);
}

module.exports = { extractText, isSupportedFile, SUPPORTED_MIME_TYPES };
