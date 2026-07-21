import React, { useState } from "react";
import { Loader2, Zap, ArrowRight, Check, HelpCircle, SkipForward } from "lucide-react";
import { Section } from "../components/common";
import { styles } from "../styles/styles";
import { C, F } from "../styles/theme";
import { AIFounderAdvisor } from "../components/AIFounderAdvisor";
import { DECISION_CATEGORIES, CURRENCIES, CONFIDENCE_COLOR, todayStr } from "../constants";
import { api } from "../api/client";

function uid() {
  return "d_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Simulator — the heart of FounderOS. Pick or type a decision. If key
// context is missing, it asks first (never predicts on too little info).
// The result is always honest ranges with reasoning, never a fake-precise
// single number or a fabricated confidence percentage.
export function Simulator({ companyProfile, metrics, decisions, setDecisions, setScreen, onSelectDecision }) {
  const [category, setCategory] = useState(null);
  const [decisionText, setDecisionText] = useState("");
  const [checkingReadiness, setCheckingReadiness] = useState(false);
  const [questions, setQuestions] = useState(null); // null = not checked yet, [] = ready, [...] = needs answers
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [saved, setSaved] = useState(false);

  async function startSimulation() {
    if (!decisionText.trim()) return;
    setCheckingReadiness(true);
    setError(null);
    setQuestions(null);
    try {
      const r = await api.checkReadiness(companyProfile, metrics, decisionText.trim());
      if (r.readyToPredict || !r.missingInfo?.length) {
        setQuestions([]);
        await runSimulation({});
      } else {
        setQuestions(r.missingInfo);
      }
    } catch (e) {
      // Readiness check is a nicety, not a blocker — fall straight through to simulating.
      setQuestions([]);
      await runSimulation({});
    }
    setCheckingReadiness(false);
  }

  async function runSimulation(decisionContext) {
    setLoading(true);
    setError(null);
    setResult(null);
    setSaved(false);
    try {
      const r = await api.simulateDecision(companyProfile, metrics, decisionText.trim(), decisions, decisionContext);
      setResult(r);
    } catch (e) {
      setError(e.message || "Couldn't reach the server.");
    }
    setLoading(false);
  }

  async function saveDecision(status) {
    const entry = {
      id: uid(),
      date: todayStr(),
      decisionText: decisionText.trim(),
      decisionContext: answers,
      baselineMetrics: metrics,
      predictions: result.predictions,
      bestCase: result.bestCase,
      expectedCase: result.expectedCase,
      worstCase: result.worstCase,
      keyAssumptions: result.keyAssumptions,
      mainRisks: result.mainRisks,
      unknownVariables: result.unknownVariables,
      overallConfidence: result.overallConfidence,
      status,
      followUpDate: null,
      actualMetrics: null,
      accuracyResults: null,
      feedbackRating: null,
      feedbackDifference: null,
      feedbackText: null,
      learningSummary: null,
    };
    const updated = [...decisions, entry];
    await setDecisions(updated);
    setSaved(true);
    api.logEvent("decision_simulated", entry.decisionText, { status });
    setTimeout(() => onSelectDecision(entry.id), 600);
  }

  function fmt(v) {
    if (v === null || v === undefined) return "Unknown";
    return v;
  }

  const busy = checkingReadiness || loading;

  return (
    <div style={styles.screenPad}>
      <div style={{ fontFamily: F.mono, fontSize: 11, color: C.muted, letterSpacing: 1 }}>DECISION SIMULATOR</div>
      <h2 style={styles.h2}>What decision are you considering?</h2>

      <div style={styles.goalGrid}>
        {DECISION_CATEGORIES.map((c) => (
          <button key={c.key} style={{ ...styles.categoryChip, ...(category === c.key ? styles.categoryChipActive : {}) }} onClick={() => setCategory(category === c.key ? null : c.key)}>
            {c.label}
          </button>
        ))}
      </div>

      {category && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {DECISION_CATEGORIES.find((c) => c.key === category).templates.map((t) => (
            <button key={t} style={styles.templateChip} onClick={() => setDecisionText(t)}>{t}</button>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <label style={styles.fieldLabel}>Or describe it in your own words</label>
        <textarea
          rows={3}
          style={styles.textarea}
          placeholder='e.g. "Hire three senior engineers and spend ₹5 lakh on Meta Ads."'
          value={decisionText}
          onChange={(e) => setDecisionText(e.target.value)}
        />
      </div>

      {error && <p style={{ fontSize: 12, color: C.accent, marginTop: 8 }}>{error}</p>}

      {questions === null && (
        <button style={{ ...styles.primaryBtn, width: "100%", marginTop: 12, opacity: decisionText.trim() ? 1 : 0.4 }} disabled={!decisionText.trim() || busy} onClick={startSimulation}>
          {checkingReadiness ? <Loader2 className="spin" size={16} /> : <>Simulate <Zap size={16} /></>}
        </button>
      )}

      {questions && questions.length > 0 && !result && (
        <Section title="A FEW QUICK QUESTIONS FIRST">
          <p style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
            These specific answers would meaningfully sharpen the prediction — skip any you don't know.
          </p>
          {questions.map((q, idx) => (
            <div key={idx} style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>
                <HelpCircle size={12} style={{ verticalAlign: -1, marginRight: 4 }} color={C.accent} />
                {q.question} <span style={{ color: C.muted }}>— {q.why}</span>
              </label>
              <input style={styles.selectInput} value={answers[q.question] || ""} onChange={(e) => setAnswers({ ...answers, [q.question]: e.target.value })} />
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button style={{ ...styles.primaryBtn, flex: 1 }} disabled={loading} onClick={() => runSimulation(answers)}>
              {loading ? <Loader2 className="spin" size={15} /> : <>Continue <ArrowRight size={15} /></>}
            </button>
            <button style={styles.ghostBtn} onClick={() => runSimulation({})} disabled={loading}>
              <SkipForward size={14} /> Skip all
            </button>
          </div>
        </Section>
      )}

      {result && (
        <>
          <Section title="PREDICTED CONSEQUENCES">
            {(result.predictions || []).map((p, idx) => (
              <div key={idx} style={styles.predictionCard}>
                <div style={styles.predictionHeaderRow}>
                  <span style={styles.predictionMetricName}>{p.metric}</span>
                  <span style={{ ...styles.difficultyChip, borderColor: CONFIDENCE_COLOR[p.confidence] || C.muted, color: CONFIDENCE_COLOR[p.confidence] || C.muted }}>
                    {p.confidence} confidence
                  </span>
                </div>
                <div style={styles.predictionCompareRow}>
                  <div style={styles.predictionCurrentBlock}>
                    <div style={styles.predictionMiniLabel}>CURRENT</div>
                    <div style={styles.predictionValue}>{fmt(p.currentValue)}</div>
                  </div>
                  <ArrowRight size={16} style={styles.predictionArrow} />
                  <div style={styles.predictionRangeBlock}>
                    <div style={styles.predictionMiniLabel}>PREDICTED RANGE</div>
                    <div style={styles.predictionValue}>
                      {p.predictedLow !== null && p.predictedLow !== undefined ? `${fmt(p.predictedLow)} – ${fmt(p.predictedHigh)}` : "Uncertain"}
                    </div>
                  </div>
                </div>
                <p style={{ ...styles.missionText, color: C.muted }}>{p.reasoning}</p>
              </div>
            ))}
          </Section>

          <Section title="SCENARIOS">
            <div style={styles.scenarioBlock}>
              <div style={{ ...styles.scenarioLabel, color: C.accent2 }}>BEST CASE</div>
              <p style={styles.missionText}>{result.bestCase}</p>
            </div>
            <div style={styles.scenarioBlock}>
              <div style={{ ...styles.scenarioLabel, color: C.text }}>EXPECTED CASE</div>
              <p style={styles.missionText}>{result.expectedCase}</p>
            </div>
            <div style={styles.scenarioBlock}>
              <div style={{ ...styles.scenarioLabel, color: C.accent }}>WORST CASE</div>
              <p style={styles.missionText}>{result.worstCase}</p>
            </div>
          </Section>

          <Section title="KEY ASSUMPTIONS">
            {(result.keyAssumptions || []).map((a, idx) => <p key={idx} style={{ ...styles.missionText, marginTop: 4 }}>• {a}</p>)}
          </Section>

          <Section title="MAIN RISKS">
            {(result.mainRisks || []).map((r, idx) => <p key={idx} style={{ ...styles.missionText, marginTop: 4, color: C.accent }}>• {r}</p>)}
          </Section>

          {result.unknownVariables?.length > 0 && (
            <Section title="UNKNOWN VARIABLES">
              <p style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Things that would meaningfully change this prediction if known:</p>
              {result.unknownVariables.map((u, idx) => <p key={idx} style={{ ...styles.missionText, marginTop: 4, color: C.muted }}>• {u}</p>)}
            </Section>
          )}

          <p style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
            This is a forecast, not a guarantee — treat it as a structured way to think through the decision, not a promise of the outcome.
          </p>

          {!saved ? (
            <button style={{ ...styles.primaryBtn, width: "100%" }} onClick={() => saveDecision("planned")}>
              Save as Planned <Check size={16} />
            </button>
          ) : (
            <p style={{ fontSize: 13, color: C.accent2, textAlign: "center" }}>Saved to Decision History.</p>
          )}
        </>
      )}
      <AIFounderAdvisor companyProfile={companyProfile} metrics={metrics} decisions={decisions} />
    </div>
  );
}
