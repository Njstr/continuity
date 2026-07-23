// Note: pdfjs-dist logs a couple of harmless "Cannot polyfill DOMMatrix/
// Path2D" warnings once, at boot, when this module is first required.
// They're about rendering support we never use (we only extract text) —
// safe to ignore, not a per-request cost.
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
const mammoth = require("mammoth");

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

async function extractPdfText(buffer) {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer), verbosity: 0 });
  const doc = await loadingTask.promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item) => item.str).join(" ") + "\n";
  }
  return { text: text.trim(), numPages: doc.numPages };
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
    const result = await mammoth.extractRawText({ buffer });
    return { text: (result.value || "").trim(), needsOcr: false };
  }

  if (/\.(txt|md|markdown)$/i.test(originalname) || (mimetype || "").startsWith("text/")) {
    return { text: buffer.toString("utf-8").trim(), needsOcr: false };
  }

  throw new Error(`Unsupported file type: ${mimetype || originalname}`);
}

module.exports = { extractText, isSupportedFile, SUPPORTED_MIME_TYPES };
