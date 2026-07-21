import React, { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Section } from "./common";
import { styles } from "../styles/styles";
import { C, F } from "../styles/theme";
import { HEALTH_CATEGORIES, todayStr } from "../constants";
import { loadJSON, saveJSON } from "../utils/storage";
import { api } from "../api/client";

export function HealthPanel({ profile, missions }) {
  const [history, setHistory] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openCat, setOpenCat] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const h = await loadJSON("healthHistory", []);
      setHistory(h);
      setLoaded(true);
    })();
  }, []);

  async function runCheck() {
    setLoading(true);
    setError(null);
    try {
      const metrics = await loadJSON("metrics", {});
      const parsed = await api.health(profile, metrics, missions);
      const snapshot = { date: todayStr(), ...parsed };
      const updated = [...history.filter((h) => h.date !== todayStr()), snapshot].slice(-12);
      setHistory(updated);
      await saveJSON("healthHistory", updated);
      api.logEvent("health_check", `Health check: ${parsed.overallScore}/100`);
    } catch (e) {
      setError(e.message || "Couldn't run the health check.");
    }
    setLoading(false);
  }

  if (!loaded) return null;
  const latest = history[history.length - 1];

  return (
    <Section title="STARTUP HEALTH">
      {!latest && !loading && (
        <p style={{ fontSize: 12.5, color: C.muted, marginBottom: 10 }}>
          Run a health check to get a read across product, growth, sales, revenue, retention, execution, finances, team, and your own wellbeing.
        </p>
      )}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Loader2 className="spin" size={16} color={C.accent} />
          <span style={{ fontSize: 12, color: C.muted }}>Running a full health check…</span>
        </div>
      )}
      {error && !loading && <p style={{ fontSize: 12, color: C.accent, marginBottom: 10 }}>{error}</p>}
      {latest && !loading && (
        <>
          <div style={styles.healthScoreRow}>
            <div>
              <div style={{ fontFamily: F.mono, fontSize: 30 }}>{latest.overallScore}</div>
              <div style={{ fontSize: 10, color: C.muted, letterSpacing: 0.4 }}>OVERALL / 100</div>
            </div>
            <div style={{ fontSize: 11, color: C.muted, fontFamily: F.mono }}>as of {latest.date}</div>
          </div>
          <div style={styles.healthGrid}>
            {HEALTH_CATEGORIES.map((cat) => {
              const c = (latest.categories || {})[cat] || { score: 0, reason: "" };
              return (
                <div key={cat} style={styles.healthChip} onClick={() => setOpenCat(openCat === cat ? null : cat)}>
                  <div style={styles.metricLabelRow}>
                    <span style={{ fontSize: 11 }}>{cat}</span>
                    <span style={{ fontFamily: F.mono, fontSize: 11, color: C.accent }}>{c.score}</span>
                  </div>
                  <div style={styles.barTrack}>
                    <div style={{ ...styles.barFill, width: `${c.score}%` }} />
                  </div>
                  {openCat === cat && <p style={styles.infoText}>{c.reason}</p>}
                </div>
              );
            })}
          </div>
          {(latest.topRisks || []).length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={styles.missionLabel}>TOP RISKS</div>
              {latest.topRisks.map((r, idx) => (
                <p key={idx} style={{ ...styles.missionText, marginTop: 4 }}>• {r}</p>
              ))}
            </div>
          )}
          {(latest.topImprovements || []).length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ ...styles.missionLabel, color: C.accent2 }}>TOP IMPROVEMENTS</div>
              {latest.topImprovements.map((r, idx) => (
                <p key={idx} style={{ ...styles.missionText, marginTop: 4 }}>• {r}</p>
              ))}
            </div>
          )}
        </>
      )}
      <button style={{ ...styles.ghostBtn, marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={runCheck} disabled={loading}>
        <RefreshCw size={13} /> {latest ? "Re-run health check" : "Run health check"}
      </button>
    </Section>
  );
}
