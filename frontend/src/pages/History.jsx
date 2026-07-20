import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Star, Calendar, X, Check, Loader2, Sparkles } from "lucide-react";
import { Section } from "../components/common";
import { styles } from "../styles/styles";
import { C, F } from "../styles/theme";
import { FOLLOWUP_OPTIONS, FEEDBACK_DIFFERENCE_REASONS, CONFIDENCE_COLOR, todayStr } from "../constants";
import { computeAccuracy, formatAccuracyPct, accuracyLabel, ACCURACY_EXPLANATION } from "../utils/predictionAccuracy";
import { api } from "../api/client";

const STATUS_COLOR = { planned: C.muted, implemented: C.accent, cancelled: "#E36B48", completed: C.accent2 };

export function History({ decisions, setDecisions, activeDecisionId, setActiveDecisionId, setScreen }) {
  const decision = decisions.find((d) => d.id === activeDecisionId);

  if (activeDecisionId && decision) {
    return <DecisionDetail decision={decision} decisions={decisions} setDecisions={setDecisions} onBack={() => setActiveDecisionId(null)} />;
  }

  return (
    <div style={styles.screenPad}>
      <div style={{ fontFamily: F.mono, fontSize: 11, color: C.muted, letterSpacing: 1 }}>DECISION HISTORY</div>
      <h2 style={styles.h2}>Every decision you've simulated</h2>

      {decisions.length === 0 ? (
        <p style={styles.emptyStateText}>Nothing yet — run your first simulation from Home.</p>
      ) : (
        decisions.slice().reverse().map((d) => (
          <div key={d.id} style={styles.decisionCard} onClick={() => setActiveDecisionId(d.id)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{d.decisionText}</span>
              <ChevronRight size={15} color={C.muted} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
              <span style={{ ...styles.statusChip, borderColor: STATUS_COLOR[d.status], color: STATUS_COLOR[d.status] }}>{d.status}</span>
              <span style={{ fontFamily: F.mono, fontSize: 10.5, color: C.muted }}>{d.date}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function DecisionDetail({ decision, decisions, setDecisions, onBack }) {
  const [followUpPicker, setFollowUpPicker] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [reportingActuals, setReportingActuals] = useState(false);
  const [actuals, setActuals] = useState({});
  const [accuracyDraft, setAccuracyDraft] = useState(null);
  const [feedbackStep, setFeedbackStep] = useState(false);
  const [rating, setRating] = useState(0);
  const [reasons, setReasons] = useState([]);
  const [feedbackText, setFeedbackText] = useState("");
  const [generatingLearning, setGeneratingLearning] = useState(false);

  async function updateDecision(patch) {
    const updated = decisions.map((d) => (d.id === decision.id ? { ...d, ...patch } : d));
    await setDecisions(updated);
  }

  async function markImplemented(days) {
    const date = days ? new Date(Date.now() + days * 86400000).toISOString().slice(0, 10) : customDate;
    await updateDecision({ status: "implemented", followUpDate: date });
    setFollowUpPicker(false);
    api.logEvent("decision_implemented", decision.decisionText, { followUpDate: date });
  }

  async function markCancelled() {
    await updateDecision({ status: "cancelled" });
    api.logEvent("decision_cancelled", decision.decisionText);
  }

  function submitActuals() {
    const results = computeAccuracy(decision.predictions, actuals);
    setAccuracyDraft(results);
    setReportingActuals(false);
    setFeedbackStep(true);
  }

  async function submitFeedback() {
    const completedPatch = {
      status: "completed",
      actualMetrics: actuals,
      accuracyResults: accuracyDraft,
      feedbackRating: rating,
      feedbackDifference: reasons.join(", "),
      feedbackText,
    };
    const afterCompletion = decisions.map((d) => (d.id === decision.id ? { ...d, ...completedPatch } : d));
    await setDecisions(afterCompletion);
    api.logEvent("decision_completed", decision.decisionText, { rating });
    setFeedbackStep(false);

    // Generate the real learning record — this is what future simulations
    // for this founder actually see as context, not a "weight update".
    // Chained off `afterCompletion` directly (not the `decisions` prop,
    // which won't reflect the first update until the next render) so this
    // second write can't clobber the first.
    setGeneratingLearning(true);
    try {
      const learning = await api.learningSummary(
        { ...decision, ...completedPatch },
        accuracyDraft,
        feedbackText,
        reasons.join(", "),
        rating
      );
      const afterLearning = afterCompletion.map((d) => (d.id === decision.id ? { ...d, learningSummary: learning } : d));
      await setDecisions(afterLearning);
    } catch (e) {
      console.error(e);
    }
    setGeneratingLearning(false);
  }

  function toggleReason(r) {
    setReasons((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }

  return (
    <div style={styles.screenPad}>
      <button style={styles.backRow} onClick={onBack}>
        <ChevronLeft size={16} /> Back to History
      </button>

      <h2 style={{ ...styles.h2, marginTop: 14 }}>{decision.decisionText}</h2>
      <span style={{ ...styles.statusChip, borderColor: STATUS_COLOR[decision.status], color: STATUS_COLOR[decision.status] }}>{decision.status}</span>

      <Section title="PREDICTED CONSEQUENCES">
        {(decision.predictions || []).map((p, idx) => (
          <div key={idx} style={styles.predictionCard}>
            <div style={styles.predictionHeaderRow}>
              <span style={styles.predictionMetricName}>{p.metric}</span>
              <span style={{ ...styles.difficultyChip, borderColor: CONFIDENCE_COLOR[p.confidence] || C.muted, color: CONFIDENCE_COLOR[p.confidence] || C.muted }}>{p.confidence}</span>
            </div>
            <div style={styles.predictionMiniLabel}>PREDICTED RANGE</div>
            <div style={styles.predictionValue}>{p.predictedLow !== null && p.predictedLow !== undefined ? `${p.predictedLow} – ${p.predictedHigh}` : "Uncertain"}</div>
            <p style={{ ...styles.missionText, color: C.muted, marginTop: 6 }}>{p.reasoning}</p>
          </div>
        ))}
      </Section>

      <Section title="SCENARIOS">
        <div style={styles.scenarioBlock}><div style={{ ...styles.scenarioLabel, color: C.accent2 }}>BEST CASE</div><p style={styles.missionText}>{decision.bestCase}</p></div>
        <div style={styles.scenarioBlock}><div style={styles.scenarioLabel}>EXPECTED CASE</div><p style={styles.missionText}>{decision.expectedCase}</p></div>
        <div style={styles.scenarioBlock}><div style={{ ...styles.scenarioLabel, color: C.accent }}>WORST CASE</div><p style={styles.missionText}>{decision.worstCase}</p></div>
      </Section>

      {decision.status === "planned" && !followUpPicker && (
        <div style={styles.missionActions}>
          <button style={styles.primaryBtn} onClick={() => setFollowUpPicker(true)}>Mark Implemented</button>
          <button style={styles.ghostBtn} onClick={markCancelled}>Cancel Decision</button>
        </div>
      )}

      {followUpPicker && (
        <Section title="WHEN SHOULD WE FOLLOW UP?">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {FOLLOWUP_OPTIONS.map((o) => (
              <button key={o.key} style={styles.templateChip} onClick={() => (o.days ? markImplemented(o.days) : null)}>
                <Calendar size={13} style={{ marginRight: 6, verticalAlign: -2 }} />{o.label}
              </button>
            ))}
            {FOLLOWUP_OPTIONS.find((o) => o.key === "custom") && (
              <div style={{ display: "flex", gap: 8 }}>
                <input type="date" style={styles.selectInput} value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
                <button style={styles.primaryBtn} disabled={!customDate} onClick={() => markImplemented(null)}>Set</button>
              </div>
            )}
          </div>
        </Section>
      )}

      {decision.status === "implemented" && (
        <Section title={`FOLLOW-UP: ${decision.followUpDate}`}>
          {!reportingActuals ? (
            <button style={{ ...styles.primaryBtn, width: "100%" }} onClick={() => setReportingActuals(true)}>Report actual results</button>
          ) : (
            <>
              <p style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Enter what actually happened for each predicted metric — leave blank if still unknown.</p>
              {(decision.predictions || []).map((p, idx) => (
                <div key={idx} style={styles.fieldGroup}>
                  <label style={styles.fieldLabel}>{p.metric} (predicted {p.predictedLow ?? "—"}–{p.predictedHigh ?? "—"})</label>
                  <input type="number" style={styles.selectInput} value={actuals[p.metricKey] ?? ""} onChange={(e) => setActuals({ ...actuals, [p.metricKey]: e.target.value })} placeholder="Actual value" />
                </div>
              ))}
              <button style={{ ...styles.primaryBtn, width: "100%", marginTop: 8 }} onClick={submitActuals}>Calculate accuracy <Check size={15} /></button>
            </>
          )}
        </Section>
      )}

      {feedbackStep && (
        <Section title="HOW ACCURATE WAS THIS PREDICTION?">
          <div style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} style={{ background: "transparent", border: "none", cursor: "pointer" }} onClick={() => setRating(n)}>
                <Star size={22} fill={n <= rating ? C.accent : "none"} color={C.accent} />
              </button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: C.muted, marginTop: 12, marginBottom: 6 }}>What differed from reality? (optional, pick any)</p>
          <div style={styles.goalGrid}>
            {FEEDBACK_DIFFERENCE_REASONS.map((r) => (
              <button key={r} style={{ ...styles.goalChip, ...(reasons.includes(r) ? styles.goalChipActive : {}) }} onClick={() => toggleReason(r)}>{r}</button>
            ))}
          </div>
          <textarea rows={3} style={{ ...styles.textarea, marginTop: 10 }} placeholder="Anything else worth noting?" value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} />
          <button style={{ ...styles.primaryBtn, width: "100%", marginTop: 10 }} disabled={!rating} onClick={submitFeedback}>Submit & Complete</button>
        </Section>
      )}

      {decision.status === "completed" && decision.accuracyResults?.length > 0 && (
        <Section title="SIMULATION ACCURACY">
          {(() => {
            const avgAcc = accuracyLabel(
              decision.accuracyResults
                .filter((a) => a.errorPct !== null && Number.isFinite(a.errorPct))
                .reduce((sum, a, _, arr) => sum + a.errorPct / arr.length, 0)
            );
            return (
              <div style={{ ...styles.recCard, textAlign: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: C.muted, fontFamily: F.mono, letterSpacing: 0.5 }}>SIMULATION ACCURACY</div>
                <div style={{ fontFamily: F.mono, fontSize: 34, marginTop: 4, color: avgAcc.color }}>
                  {avgAcc.accuracy !== null ? avgAcc.accuracy.toFixed(1) + "%" : "—"}
                </div>
                <div style={{ fontSize: 13, marginTop: 4, color: avgAcc.color }}>
                  {avgAcc.emoji} {avgAcc.label} match between predicted and actual outcome.
                </div>
                <p style={{ fontSize: 11.5, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>{ACCURACY_EXPLANATION}</p>
              </div>
            );
          })()}
          {decision.accuracyResults.map((a, idx) => {
            const al = accuracyLabel(a.errorPct);
            return (
              <div key={idx} style={styles.accuracyRow}>
                <span>{a.metric}</span>
                <span style={{ fontFamily: F.mono }}>
                  predicted ~{a.predictedMid?.toFixed?.(0) ?? "—"} · actual {a.actual} ·{" "}
                  <b style={{ color: al.color }}>{al.emoji} {formatAccuracyPct(a.errorPct)} accuracy</b>
                </span>
              </div>
            );
          })}
          {decision.feedbackRating && (
            <div style={{ marginTop: 12 }}>
              <div style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={16} fill={n <= decision.feedbackRating ? C.accent : "none"} color={C.accent} />)}
              </div>
              {decision.feedbackDifference && <p style={{ ...styles.missionText, marginTop: 6, color: C.muted }}>{decision.feedbackDifference}</p>}
              {decision.feedbackText && <p style={{ ...styles.missionText, marginTop: 4 }}>{decision.feedbackText}</p>}
            </div>
          )}
        </Section>
      )}

      {decision.status === "completed" && (
        <Section title="LEARNING RECORD">
          {generatingLearning && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Loader2 className="spin" size={15} color={C.accent} />
              <span style={{ fontSize: 12, color: C.muted }}>Extracting what to apply next time…</span>
            </div>
          )}
          {!generatingLearning && decision.learningSummary && (
            <>
              {decision.learningSummary.whatWasWrong?.length > 0 && (
                <>
                  <div style={{ ...styles.missionLabel, color: C.accent }}>WHAT THE PREDICTION GOT WRONG</div>
                  {decision.learningSummary.whatWasWrong.map((w, idx) => <p key={idx} style={{ ...styles.missionText, marginTop: 4 }}>• {w}</p>)}
                </>
              )}
              <div style={{ ...styles.missionLabel, color: C.accent2, marginTop: decision.learningSummary.whatWasWrong?.length ? 12 : 0 }}>
                <Sparkles size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
                LESSONS FOR FUTURE PREDICTIONS
              </div>
              {(decision.learningSummary.lessonsForFuture || []).map((l, idx) => <p key={idx} style={{ ...styles.missionText, marginTop: 4 }}>• {l}</p>)}
              <p style={{ fontSize: 10.5, color: C.muted, marginTop: 10 }}>
                Fed back as context into your next few decision simulations — not a fixed rule applied forever.
              </p>
            </>
          )}
          {!generatingLearning && !decision.learningSummary && (
            <p style={styles.emptyStateText}>No learning record generated for this decision.</p>
          )}
        </Section>
      )}
    </div>
  );
}