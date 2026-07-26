import React, { useEffect, useState } from "react";
import { ChevronRight, Loader2, Info } from "lucide-react";
import { Section } from "./common";
import { styles } from "../styles/styles";
import { C, F } from "../styles/theme";
import { METRICS_FIELDS } from "../constants";
import { loadJSON, saveJSON } from "../utils/storage";
import { api } from "../api/client";

export function MetricsPanel({ profile }) {
  const [metrics, setMetrics] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [rec, setRec] = useState(null);
  const [loadingRec, setLoadingRec] = useState(false);
  const [openInfo, setOpenInfo] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const m = await loadJSON("metrics", {});
      const r = await loadJSON("metricsRecommendation", null);
      setMetrics(m);
      setRec(r);
      setEditing(Object.keys(m).length === 0);
      setLoaded(true);
    })();
  }, []);

  async function getRecommendation(currentMetrics) {
    setLoadingRec(true);
    setError(null);
    try {
      const parsed = await api.metricsRecommendation(profile, currentMetrics);
      setRec(parsed);
      await saveJSON("metricsRecommendation", parsed);
    } catch (e) {
      setError(e.message || "Couldn't reach the server.");
    }
    setLoadingRec(false);
  }

  async function save() {
    await saveJSON("metrics", metrics);
    setEditing(false);
    await getRecommendation(metrics);
  }

  if (!loaded) return null;
  const hasAny = METRICS_FIELDS.some((f) => metrics[f.key]);

  return (
    <Section title="STARTUP METRICS">
      {editing ? (
        <>
          <p style={{ fontSize: 12.5, color: C.muted, marginBottom: 10 }}>
            Fill in what you know — leave the rest blank. The mentor uses this to ground its advice in your actual numbers.
          </p>
          <div style={styles.metricsGrid}>
            {METRICS_FIELDS.map((f) => (
              <div key={f.key}>
                <div style={styles.metricLabelRow}>
                  <label style={styles.metricLabel}>{f.label}</label>
                  <button style={styles.infoBtn} onClick={() => setOpenInfo(openInfo === f.key ? null : f.key)} aria-label={`About ${f.label}`}>
                    <Info size={12} color={openInfo === f.key ? C.accent : C.muted} />
                  </button>
                </div>
                <input
                  style={styles.metricInput}
                  value={metrics[f.key] || ""}
                  onChange={(e) => setMetrics({ ...metrics, [f.key]: e.target.value })}
                  placeholder="—"
                />
                {openInfo === f.key && <p style={styles.infoText}>{f.info}</p>}
              </div>
            ))}
          </div>
          <button style={{ ...styles.primaryBtn, marginTop: 12 }} onClick={save}>
            Save & get recommendation <ChevronRight size={15} />
          </button>
        </>
      ) : (
        <>
          <div style={styles.metricsGrid}>
            {METRICS_FIELDS.filter((f) => metrics[f.key]).map((f) => (
              <div key={f.key} style={styles.metricChip}>
                <div style={styles.metricLabelRow}>
                  <div style={styles.metricChipLabel}>{f.label}</div>
                  <button style={styles.infoBtn} onClick={() => setOpenInfo(openInfo === f.key ? null : f.key)} aria-label={`About ${f.label}`}>
                    <Info size={11} color={openInfo === f.key ? C.accent : C.muted} />
                  </button>
                </div>
                <div style={styles.metricChipVal}>{metrics[f.key]}</div>
                {openInfo === f.key && <p style={styles.infoText}>{f.info}</p>}
              </div>
            ))}
          </div>
          <button style={{ ...styles.ghostBtn, marginTop: 12 }} onClick={() => setEditing(true)}>
            {hasAny ? "Update metrics" : "Add metrics"}
          </button>

          {error && <p style={{ fontSize: 12, color: C.accent, marginTop: 10 }}>{error}</p>}
          {loadingRec && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
              <Loader2 className="spin" size={16} color={C.accent} />
              <span style={{ fontSize: 12, color: C.muted }}>Analyzing your numbers…</span>
            </div>
          )}

          {rec && !loadingRec && (
            <div style={styles.recCard}>
              <div style={styles.missionLabel}>WHAT TO DO NEXT</div>
              <p style={styles.missionText}>{rec.summary}</p>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                {(rec.nextSteps || []).map((s, idx) => (
                  <div key={idx} style={styles.recStep}>
                    <span style={{ fontFamily: F.mono, fontSize: 11, color: C.accent }}>{String(idx + 1).padStart(2, "0")}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{s.title}</div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{s.why}</div>
                    </div>
                  </div>
                ))}
              </div>
              {rec.biggestRisk && <p style={{ fontSize: 12, color: C.accent, marginTop: 12 }}>Biggest risk: {rec.biggestRisk}</p>}
            </div>
          )}
        </>
      )}
    </Section>
  );
}
