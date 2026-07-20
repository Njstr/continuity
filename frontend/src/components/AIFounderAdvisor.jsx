import React, { useEffect, useState } from "react";
import { Loader2, RefreshCw, Brain, ChevronDown, ChevronUp, Zap, AlertTriangle, TrendingUp, Lightbulb, Search, CalendarClock } from "lucide-react";
import { Section } from "./common";
import { styles } from "../styles/styles";
import { C, F } from "../styles/theme";
import { loadJSON, saveJSON } from "../utils/storage";
import { api } from "../api/client";

// Color coding, kept separate from the shared theme tokens so this feature
// is additive — nothing in styles.js/theme.js is touched.
const SEVERITY_COLOR = {
  critical: "#E36B48",
  high: C.accent,
  medium: "#E3C548",
  low: C.accent2,
  healthy: C.accent2,
};
const SEVERITY_DOT = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢",
  healthy: "🟢",
};
const PRIORITY_COLOR = {
  Critical: "#E36B48",
  High: C.accent,
  Medium: "#E3C548",
  Low: C.accent2,
};

function CollapsibleCard({ headerLeft, headerRight, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ ...styles.faqItem, cursor: "pointer" }} onClick={() => setOpen(!open)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>{headerLeft}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {headerRight}
          {open ? <ChevronUp size={14} color={C.muted} /> : <ChevronDown size={14} color={C.muted} />}
        </div>
      </div>
      {open && <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
}

function Chip({ label, color }) {
  return (
    <span style={{ fontSize: 10.5, fontFamily: F.mono, padding: "3px 8px", borderRadius: 20, border: `1px solid ${color}`, color }}>
      {label}
    </span>
  );
}

// AIFounderAdvisor — synthesizes metrics, missions, decisions, health, and
// predictions (all already generated elsewhere in the app) into a single
// mentor-style briefing. Generation logic lives entirely in
// api.founderAdvisor / aiService.generateFounderAdvisor on the backend —
// this component only renders whatever JSON shape comes back, so swapping
// the underlying LLM provider never requires touching this file.
export function AIFounderAdvisor({ profile, businessState, metrics, missions, decisions }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const cached = await loadJSON("founderAdvisor", null);
      if (cached) setData(cached);
      setLoaded(true);
      if (!cached) run();
    })();
    // eslint-disable-next-line
  }, []);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const healthLatest = await loadJSON("startupHealth", null);
      const prediction = await loadJSON("prediction", null);
      const result = await api.founderAdvisor(profile, businessState, metrics, missions, decisions, healthLatest, prediction);
      setData(result);
      await saveJSON("founderAdvisor", result);
    } catch (e) {
      setError(e.message || "Couldn't reach the server.");
    }
    setLoading(false);
  }

  if (!loaded) return null;

  return (
    <Section title="🧠 AI FOUNDER ADVISOR">
      {error && <p style={{ fontSize: 12, color: C.accent, marginBottom: 10 }}>{error}</p>}

      {loading && !data && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Loader2 className="spin" size={16} color={C.accent} />
          <span style={{ fontSize: 12, color: C.muted }}>Reviewing your startup like a co-founder would…</span>
        </div>
      )}

      {!data && !loading && !error && (
        <p style={styles.emptyStateText}>Not generated yet.</p>
      )}

      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* ---- Top Priorities ---- */}
          {data.topPriorities?.length > 0 && (
            <div>
              <div style={{ ...styles.missionLabel, marginBottom: 8 }}>TOP PRIORITIES</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.topPriorities.map((p, idx) => (
                  <CollapsibleCard
                    key={idx}
                    headerLeft={
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: F.mono, fontSize: 11, color: C.muted }}>#{idx + 1}</span>
                        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{p.title}</span>
                      </div>
                    }
                    headerRight={<Chip label={p.priority} color={PRIORITY_COLOR[p.priority] || C.muted} />}
                  >
                    <p style={{ ...styles.missionText, color: C.muted }}>{p.why}</p>
                    <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                      <div><div style={styles.predictionMiniLabel}>IMPACT</div><div style={{ fontSize: 12.5 }}>{p.impact}</div></div>
                      <div><div style={styles.predictionMiniLabel}>EFFORT</div><div style={{ fontSize: 12.5 }}>{p.effort}</div></div>
                      <div><div style={styles.predictionMiniLabel}>TIME</div><div style={{ fontSize: 12.5 }}>{p.time}</div></div>
                    </div>
                  </CollapsibleCard>
                ))}
              </div>
            </div>
          )}

          {/* ---- Next Best Action ---- */}
          {data.nextBestAction && (
            <div>
              <div style={{ ...styles.missionLabel, marginBottom: 8, color: C.accent2 }}>
                <Zap size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
                NEXT BEST ACTION
              </div>
              <div style={styles.recCard}>
                <p style={{ fontSize: 14.5, fontWeight: 600, margin: 0 }}>{data.nextBestAction.title}</p>
                <p style={{ ...styles.missionText, color: C.muted, marginTop: 6 }}>{data.nextBestAction.reasoning}</p>
                {data.nextBestAction.estimatedImpact?.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                    {data.nextBestAction.estimatedImpact.map((s, i) => (
                      <span key={i} style={{ ...styles.metaChip, color: C.accent2, borderColor: C.accent2 }}>{s}</span>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
                  <div><div style={styles.predictionMiniLabel}>TIME</div><div style={{ fontSize: 12.5 }}>{data.nextBestAction.estimatedTime}</div></div>
                  <div><div style={styles.predictionMiniLabel}>CONFIDENCE</div><div style={{ fontSize: 12.5 }}>{data.nextBestAction.confidence}%</div></div>
                </div>
              </div>
            </div>
          )}

          {/* ---- Risks Detected ---- */}
          {data.risks?.length > 0 && (
            <div>
              <div style={{ ...styles.missionLabel, marginBottom: 8 }}>
                <AlertTriangle size={11} style={{ verticalAlign: -1, marginRight: 4 }} color={C.accent} />
                RISKS DETECTED
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.risks.map((r, idx) => (
                  <CollapsibleCard
                    key={idx}
                    headerLeft={
                      <span style={{ fontSize: 13 }}>
                        {SEVERITY_DOT[r.severity] || "⚪"} {r.label}
                      </span>
                    }
                    headerRight={<Chip label={r.severity} color={SEVERITY_COLOR[r.severity] || C.muted} />}
                  >
                    <p style={{ ...styles.missionText, color: C.muted }}>{r.description}</p>
                    <p style={{ ...styles.missionText, marginTop: 6 }}><b style={{ color: C.accent2 }}>Mitigation:</b> {r.mitigation}</p>
                  </CollapsibleCard>
                ))}
              </div>
            </div>
          )}

          {/* ---- Growth Opportunities ---- */}
          {data.opportunities?.length > 0 && (
            <div>
              <div style={{ ...styles.missionLabel, marginBottom: 8, color: C.accent2 }}>
                <TrendingUp size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
                GROWTH OPPORTUNITIES
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.opportunities.map((o, idx) => (
                  <div key={idx} style={styles.faqItem}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{o.title}</div>
                    <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                      <div><div style={styles.predictionMiniLabel}>IMPACT</div><div style={{ fontSize: 12.5 }}>{o.expectedImpact}</div></div>
                      <div><div style={styles.predictionMiniLabel}>DIFFICULTY</div><div style={{ fontSize: 12.5 }}>{o.difficulty}</div></div>
                      <div><div style={styles.predictionMiniLabel}>TIMELINE</div><div style={{ fontSize: 12.5 }}>{o.timeline}</div></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ---- AI Insights ---- */}
          {data.insights?.length > 0 && (
            <div>
              <div style={{ ...styles.missionLabel, marginBottom: 8 }}>
                <Lightbulb size={11} style={{ verticalAlign: -1, marginRight: 4 }} color={C.accent} />
                AI INSIGHTS
              </div>
              {data.insights.map((s, idx) => (
                <p key={idx} style={{ ...styles.missionText, marginTop: 6 }}>• {s}</p>
              ))}
            </div>
          )}

          {/* ---- Root Cause Analysis ---- */}
          {data.rootCauseAnalysis?.length > 0 && (
            <div>
              <div style={{ ...styles.missionLabel, marginBottom: 8 }}>
                <Search size={11} style={{ verticalAlign: -1, marginRight: 4 }} color={C.accent} />
                ROOT CAUSE ANALYSIS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.rootCauseAnalysis.map((rc, idx) => (
                  <div key={idx} style={styles.faqItem}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.accent }}>{rc.problem}</div>
                    {(rc.likelyCauses || []).map((c, i) => (
                      <p key={i} style={{ ...styles.missionText, marginTop: 4, color: C.muted }}>• {c}</p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ---- 30-Day Action Plan ---- */}
          {data.actionPlan && (
            <div>
              <div style={{ ...styles.missionLabel, marginBottom: 8 }}>
                <CalendarClock size={11} style={{ verticalAlign: -1, marginRight: 4 }} color={C.accent2} />
                30-DAY ACTION PLAN
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  ["week1", "WEEK 1 — HIGHEST PRIORITY"],
                  ["week2", "WEEK 2 — GROWTH"],
                  ["week3", "WEEK 3 — OPTIMIZATION"],
                  ["week4", "WEEK 4 — REVIEW & NEXT DECISIONS"],
                ].map(([key, label]) =>
                  data.actionPlan[key]?.length > 0 ? (
                    <div key={key} style={styles.faqItem}>
                      <div style={{ fontSize: 11, fontFamily: F.mono, color: C.accent2, letterSpacing: 0.5 }}>{label}</div>
                      {data.actionPlan[key].map((t, i) => (
                        <p key={i} style={{ ...styles.missionText, marginTop: 4 }}>• {t}</p>
                      ))}
                    </div>
                  ) : null
                )}
              </div>
            </div>
          )}

          {/* ---- Confidence + Missing Info ---- */}
          <div style={{ ...styles.faqItem, cursor: "default" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ ...styles.missionLabel, margin: 0 }}>RECOMMENDATION CONFIDENCE</div>
              <span style={{ fontFamily: F.mono, fontSize: 15, color: C.accent }}>{data.overallConfidence}%</span>
            </div>
            {data.confidenceReasoning && <p style={{ ...styles.missionText, color: C.muted, marginTop: 6 }}>{data.confidenceReasoning}</p>}
            {data.missingInfo?.length > 0 && (
              <>
                <p style={{ fontSize: 11.5, color: C.muted, marginTop: 10, marginBottom: 4 }}>
                  This would sharpen these recommendations:
                </p>
                {data.missingInfo.map((m, idx) => (
                  <p key={idx} style={{ ...styles.missionText, marginTop: 2, color: C.muted }}>• {m}</p>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      <button
        style={{ ...styles.ghostBtn, marginTop: 14, display: "inline-flex", alignItems: "center", gap: 6 }}
        onClick={run}
        disabled={loading}
      >
        {loading ? <Loader2 className="spin" size={14} /> : <RefreshCw size={13} />}
        {data ? "Refresh advisor" : "Generate advisor briefing"}
      </button>
    </Section>
  );
}