import React, { useRef, useState } from "react";
import { Lock, Upload, Loader2, AlertCircle } from "lucide-react";
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
  if (v === null || v === undefined) return "—";
  if (unit === "currency") return Number(v).toLocaleString();
  return v;
}

// Metrics on this page are read-only by design — they only change when the
// founder uploads a real financial document. This keeps the numbers the
// AI reasons from grounded in something the founder actually submitted,
// not free-typed guesses that quietly drift from reality over time.
export function MetricsHome({ metrics, onApplyMetrics, unlocked }) {
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
    <div style={{ ...styles.screenPad, position: "relative" }}>
      <div style={{ fontFamily: F.mono, fontSize: 11, color: C.muted, letterSpacing: 1 }}>STARTUP HEALTH</div>
      <h2 style={styles.h2}>Metrics</h2>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>
        {unlocked
          ? "Sourced from the financial documents you've uploaded — not manually editable. Upload a newer document any time to update these."
          : "Upload a financial document to populate this page. Numbers here come from what you submit, not manual entry."}
      </p>

      {unlocked && <div style={{ marginBottom: 20 }}>{uploadButton}</div>}

      <div style={{ filter: unlocked ? "none" : "blur(6px)", pointerEvents: unlocked ? "auto" : "none", userSelect: unlocked ? "auto" : "none" }}>
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
                      <span style={{ fontSize: 17, fontFamily: F.mono, color: C.text }}>{formatValue(metrics?.[f.key], f.unit)}</span>
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

      {!unlocked && (
        <div
          style={{
            position: "absolute", top: 90, left: 16, right: 16, bottom: 16,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            textAlign: "center", padding: "24px 20px", gap: 14,
          }}
        >
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "26px 22px", maxWidth: 320, boxShadow: "0 8px 30px rgba(0,0,0,0.4)" }}>
            <Lock size={22} color={C.accent} style={{ marginBottom: 10 }} />
            <div style={{ fontFamily: F.display, fontSize: 18, marginBottom: 6 }}>Upload your financials to unlock Metrics</div>
            <p style={{ fontSize: 12.5, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>
              Submit a PDF or DOCX with your revenue, profit, and expenses — the AI will pull the numbers out for you to confirm.
            </p>
            {uploadButton}
          </div>
        </div>
      )}

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
