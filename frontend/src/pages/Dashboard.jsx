import React, { useEffect, useMemo, useState } from "react";
import { Zap, Loader2, ChevronRight } from "lucide-react";
import { Section, EditableLine } from "../components/common";
import { styles } from "../styles/styles";
import { C, F } from "../styles/theme";
import { ALL_METRIC_FIELDS, CURRENCIES } from "../constants";
import { averageError, formatAccuracyPct, accuracyLabel } from "../utils/predictionAccuracy";
import { loadJSON, saveJSON } from "../utils/storage";
import { api } from "../api/client";

// Home — the company's command center. Answers at a glance: where do
// things stand, is the last decision panning out, how accurate has the
// Simulator actually been, and one clear next action: Simulate a Decision.
export function Dashboard({ companyProfile, setCompanyProfile, metrics, decisions, setScreen, onSelectDecision }) {
  const [health, setHealth] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  useEffect(() => {
    (async () => {
      const cached = await loadJSON("startupHealth", null);
      if (cached) setHealth(cached);
    })();
  }, []);

  async function refreshHealth() {
    setLoadingHealth(true);
    try {
      const result = await api.startupHealth(companyProfile, metrics);
      setHealth(result);
      await saveJSON("startupHealth", result);
    } catch (e) {
      console.error(e);
    }
    setLoadingHealth(false);
  }

  const currency = (CURRENCIES.find((c) => c.code === companyProfile.currency) || CURRENCIES[0]).symbol;
  const lastDecision = decisions[decisions.length - 1];
  const completedDecisions = decisions.filter((d) => d.status === "completed" && d.accuracyResults?.length);
  const allAccuracy = completedDecisions.flatMap((d) => d.accuracyResults);
  const avgErr = averageError(allAccuracy);
  const acc = accuracyLabel(avgErr);

  const knownMetrics = useMemo(() => ALL_METRIC_FIELDS.filter((f) => metrics[f.key] !== null && metrics[f.key] !== undefined && metrics[f.key] !== "").slice(0, 6), [metrics]);

  return (
    <div style={styles.screenPad}>
      <div style={styles.homeHeaderRow}>
        <div style={styles.homeCompanyBlock}>
          <span style={styles.homeCompanyLabel}>COMMAND CENTER</span>
          <EditableLine tag="div" style={styles.homeCompanyName} value={companyProfile.companyName} onSave={(v) => setCompanyProfile({ ...companyProfile, companyName: v })} />
        </div>
      </div>

      <button style={styles.cmdBigCta} onClick={() => setScreen("simulator")}>
        <Zap size={22} />
        <span style={styles.cmdBigCtaLabel}>Simulate a Decision</span>
        <span style={styles.cmdBigCtaSub}>Predict the consequences before you commit</span>
      </button>

      <Section title="STARTUP HEALTH SCORE">
        {health ? (
          <>
            <div style={styles.healthScoreBig}>
              <div style={styles.healthScoreNum}>{health.score}</div>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: F.mono }}>/ 100 · DATA COMPLETENESS: {(health.dataCompleteness || "unknown").toUpperCase()}</div>
            </div>
            <p style={{ ...styles.missionText, textAlign: "center" }}>{health.reasoning}</p>
          </>
        ) : (
          <p style={styles.emptyStateText}>Not calculated yet.</p>
        )}
        <button style={{ ...styles.ghostBtn, width: "100%", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={refreshHealth} disabled={loadingHealth}>
          {loadingHealth ? <Loader2 className="spin" size={14} /> : null} {health ? "Recalculate" : "Calculate health score"}
        </button>
      </Section>

      {knownMetrics.length > 0 && (
        <Section title="CURRENT METRICS">
          <div style={styles.metricSummaryGrid}>
            {knownMetrics.map((f) => (
              <div key={f.key} style={styles.metricSummaryCard}>
                <div style={styles.metricSummaryLabel}>{f.label}</div>
                <div style={styles.metricSummaryValue}>{f.unit === "currency" ? currency : ""}{metrics[f.key]}{f.unit === "percent" ? "%" : ""}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="LAST DECISION">
        {lastDecision ? (
          <div style={styles.lastDecisionCard} onClick={() => onSelectDecision(lastDecision.id)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{lastDecision.decisionText}</span>
              <ChevronRight size={15} color={C.muted} />
            </div>
            <span style={{ ...styles.statusChip, borderColor: C.border, color: C.muted }}>{lastDecision.status}</span>
          </div>
        ) : (
          <p style={styles.emptyStateText}>No decisions simulated yet — that's what the button above is for.</p>
        )}
      </Section>

      <Section title="PREDICTION ACCURACY">
        {avgErr !== null ? (
          <>
            <p style={styles.missionText}>
              Across {completedDecisions.length} completed simulation{completedDecisions.length === 1 ? "" : "s"}, average simulation accuracy is{" "}
              <b style={{ color: acc.color }}>{acc.emoji} {formatAccuracyPct(avgErr)}</b>.
            </p>
            <p style={{ fontSize: 11.5, color: acc.color, marginTop: 4 }}>{acc.label} match between predicted and actual outcomes.</p>
          </>
        ) : (
          <p style={styles.emptyStateText}>No completed simulations with reported outcomes yet — accuracy tracking starts once you mark a decision Implemented and report back what actually happened.</p>
        )}
      </Section>

      {decisions.length > 0 && (
        <Section title="RECENT SIMULATIONS">
          {decisions.slice().reverse().slice(0, 5).map((d) => (
            <div key={d.id} style={styles.lastDecisionCard} onClick={() => onSelectDecision(d.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13 }}>{d.decisionText}</span>
                <span style={{ ...styles.statusChip, borderColor: C.border, color: C.muted }}>{d.status}</span>
              </div>
            </div>
          ))}
          <button style={{ ...styles.ghostBtn, width: "100%", marginTop: 4 }} onClick={() => setScreen("history")}>
            View all decisions <ChevronRight size={14} />
          </button>
        </Section>
      )}
    </div>
  );
}