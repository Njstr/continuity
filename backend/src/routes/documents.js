const express = require("express");
const multer = require("multer");
const asyncHandler = require("../utils/asyncHandler");
const documentsRepository = require("../repositories/documentsRepository");
const analytics = require("../services/analyticsService");
const { extractText, isSupportedFile } = require("../utils/extractText");

const router = express.Router();

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB per file
const MAX_FILES_PER_UPLOAD = 5;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES_PER_UPLOAD },
});

function uid() {
  return `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function runMulter(req, res) {
  return new Promise((resolve, reject) => {
    upload.array("files", MAX_FILES_PER_UPLOAD)(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          err.status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
          err.message =
            err.code === "LIMIT_FILE_SIZE"
              ? `Files must be under ${MAX_FILE_BYTES / (1024 * 1024)}MB.`
              : err.code === "LIMIT_FILE_COUNT"
              ? `You can upload up to ${MAX_FILES_PER_UPLOAD} files at once.`
              : err.message;
        }
        return reject(err);
      }
      resolve();
    });
  });
}

router.post(
  "/upload",
  asyncHandler(async (req, res) => {
    await runMulter(req, res);
    const files = req.files || [];
    const conversationId = req.body.conversationId || null;

    if (!files.length) {
      return res.status(400).json({ error: true, message: "No files were uploaded." });
    }

    const results = [];
    for (const file of files) {
      if (!isSupportedFile(file)) {
        results.push({ filename: file.originalname, error: "Unsupported file type. Upload PDF, DOCX, TXT, or Markdown." });
        continue;
      }
      try {
        const { text, needsOcr } = await extractText(file);
        if (!text && !needsOcr) {
          results.push({ filename: file.originalname, error: "Couldn't find any readable text in this file." });
          continue;
        }
        const doc = documentsRepository.add({
          id: uid(),
          userId: req.userId,
          conversationId,
          filename: file.originalname,
          mimeType: file.mimetype,
          charCount: text.length,
          extractedText: text,
          needsOcr,
          persistent: false,
        });
        analytics.track(req.userId, "document_uploaded");
        results.push({
          id: doc.id,
          filename: doc.filename,
          charCount: doc.charCount,
          needsOcr: doc.needsOcr,
          preview: text.slice(0, 240),
        });
      } catch (e) {
        results.push({ filename: file.originalname, error: "Couldn't process this file. It may be corrupted or password-protected." });
      }
    }

    res.status(201).json({ documents: results });
  })
);

// Founder's explicit "remember this?" choice — persistent=true makes it
// usable as context in every future conversation, not just this one.
router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const { persistent } = req.body;
    if (typeof persistent !== "boolean") {
      return res.status(400).json({ error: true, message: "persistent must be true or false" });
    }
    const existing = documentsRepository.get(req.params.id, req.userId);
    if (!existing) return res.status(404).json({ error: true, message: "Document not found." });
    const updated = documentsRepository.setPersistent(req.params.id, req.userId, persistent);
    res.json({ document: updated });
  })
);

// The founder's persistent knowledge base — documents available across
// every conversation, not just the one they were uploaded in.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ documents: documentsRepository.listPersistent(req.userId) });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = documentsRepository.get(req.params.id, req.userId);
    if (!existing) return res.status(404).json({ error: true, message: "Document not found." });
    documentsRepository.remove(req.params.id, req.userId);
    res.json({ ok: true });
  })
);

module.exports = router;
