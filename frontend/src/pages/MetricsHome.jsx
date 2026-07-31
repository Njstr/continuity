import React, { useRef, useState } from "react";
import { Upload, Loader2, AlertCircle } from "lucide-react";
import { styles } from "../styles/styles";
import { C, F } from "../styles/theme";
import { METRIC_GROUPS, ALL_METRIC_FIELDS } from "../constants";
import { MetricInfoButton, MetricInfoModal } from "../components/MetricInfoModal";
import { MetricsExtractionReview } from "../components/MetricsExtractionReview";
import { api } from "../api/client";

function formatUnitHint(unit) {
  if (unit === "percent") return "%";
  if (unit === "months") return "mo";
  return "";
}

function formatValue(v, unit) {
  if (v === null || v === undefined) return "Unknown";
  if (unit === "currency") return Number(v).toLocaleString();
  return v;
}

// Metrics on this page are read-only by design — they only change when the
// founder uploads a real financial document, never by typing a number in.
// The tab itself is always freely browsable (no lock/blur gate) — what's
// honest here isn't hiding the page, it's showing "Unknown" instead of a
// fabricated or default value for anything not yet actually submitted.
export function MetricsHome({ metrics, onApplyMetrics }) {
  const [openInfo, setOpenInfo] = useState(null);
  const [uploadState, setUploadState] = useState(null); // { status: 'uploading'|'extracting'|'error', filename, error }
  const [review, setReview] = useState(null); // { filename, values }
  const fileInputRef = useRef(null);

  async function handleFile(file) {
    if (!file) return;
    setUploadState({ status: "uploading", filename: file.name });
    try {
      const { documents } = await api.uploadDocuments([file], null);
      const doc = documents[0];
      if (doc.error) {
        setUploadState({ status: "error", filename: file.name, error: doc.error });
        return;
      }
      setUploadState({ status: "extracting", filename: file.name });
      const metricFields = ALL_METRIC_FIELDS.map((f) => ({ key: f.key, label: f.label, unit: f.unit }));
      const { values } = await api.extractDocumentMetrics(doc.id, metricFields);
      const hasAny = values && Object.values(values).some((v) => v !== null && v !== undefined);
      setUploadState(null);
      if (!hasAny) {
        setUploadState({ status: "error", filename: file.name, error: "No clearly stated financial values found in this document. Try a different file." });
        return;
      }
      // Mark it as the founder's financial source of record — reasonable
      // given they uploaded it specifically to populate this page.
      api.setDocumentPersistent(doc.id, true).catch(() => {});
      setReview({ filename: file.name, values });
    } catch (e) {
      setUploadState({ status: "error", filename: file.name, error: e.message || "Upload failed." });
    }
  }

  const uploadButton = (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt,.md,.markdown"
        style={{ display: "none" }}
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploadState?.status === "uploading" || uploadState?.status === "extracting"}
        style={{ ...styles.primaryBtn, display: "inline-flex", alignItems: "center", gap: 8, width: "100%", justifyContent: "center" }}
      >
        {uploadState?.status === "uploading" || uploadState?.status === "extracting" ? (
          <>
            <Loader2 className="spin" size={15} /> {uploadState.status === "uploading" ? "Reading document…" : "Finding your numbers…"}
          </>
        ) : (
          <>
            <Upload size={15} /> Upload financial PDF/DOCX
          </>
        )}
      </button>
      {uploadState?.status === "error" && (
        <div style={{ display: "flex", gap: 6, alignItems: "flex-start", marginTop: 8, fontSize: 12, color: "#d85050" }}>
          <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{uploadState.error}</span>
        </div>
      )}
    </div>
  );

  return (
    <div style={styles.screenPad}>
      <div style={{ fontFamily: F.mono, fontSize: 11, color: C.muted, letterSpacing: 1 }}>STARTUP HEALTH</div>
      <h2 style={styles.h2}>Metrics</h2>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>
        Sourced from the financial documents you upload — not manually editable. Anything not yet submitted shows as Unknown, never a guessed or default number.
      </p>

      <div style={{ marginBottom: 20 }}>{uploadButton}</div>

      <div>
        {METRIC_GROUPS.map((group) => {
          const fields = [...group.fields].sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0));
          return (
            <div key={group.key} style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 11, fontFamily: F.mono, color: C.accent2, letterSpacing: 0.6, marginBottom: 8 }}>
                {group.label.toUpperCase()}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {fields.map((f) => (
                  <div
                    key={f.key}
                    style={{
                      background: C.surface, border: `1px solid ${f.priority ? C.accent : C.border}`, borderRadius: 12, padding: "10px 12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 10.5, color: C.muted, fontFamily: F.mono, lineHeight: 1.3 }}>{f.label}</span>
                      <MetricInfoButton info={f.info} onClick={() => setOpenInfo({ label: f.label, info: f.info })} />
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                      <span style={{ fontSize: metrics?.[f.key] == null ? 13 : 17, fontFamily: F.mono, color: metrics?.[f.key] == null ? C.muted : C.text, fontStyle: metrics?.[f.key] == null ? "italic" : "normal" }}>
                        {formatValue(metrics?.[f.key], f.unit)}
                      </span>
                      {formatUnitHint(f.unit) && metrics?.[f.key] != null && (
                        <span style={{ fontSize: 11, color: C.muted, fontFamily: F.mono }}>{formatUnitHint(f.unit)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {openInfo && <MetricInfoModal label={openInfo.label} info={openInfo.info} onClose={() => setOpenInfo(null)} />}
      {review && (
        <MetricsExtractionReview
          filename={review.filename}
          values={review.values}
          onCancel={() => setReview(null)}
          onApply={(toApply) => {
            onApplyMetrics(toApply);
            setReview(null);
          }}
        />
      )}
    </div>
  );
}
