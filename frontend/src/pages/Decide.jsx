import React, { useEffect, useState } from "react";
import { Loader2, Scale } from "lucide-react";
import { Section } from "../components/common";
import { DecisionHistoryItem } from "../components/DecisionHistoryItem";
import { styles } from "../styles/styles";
import { C, F } from "../styles/theme";
import { todayStr } from "../constants";
import { loadJSON, saveJSON } from "../utils/storage";
import { api } from "../api/client";

export function Decide({ profile }) {
  const [decisions, setDecisions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const d = await loadJSON("decisions", []);
      setDecisions(d);
      setLoaded(true);
    })();
  }, []);

  async function submit() {
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.decision(profile, question.trim(), decisions);
      const entry = { id: Date.now(), date: todayStr(), question: question.trim(), ...result, actualOutcome: "", resolved: false };
      const updated = [...decisions, entry];
      setDecisions(updated);
      await saveJSON("decisions", updated);
      setCurrent(entry);
      setQuestion("");
      api.logEvent("decision", entry.question);
    } catch (e) {
      setError(e.message || "Couldn't reach the server.");
    }
    setLoading(false);
  }

  async function saveOutcome(id, outcome) {
    const updated = decisions.map((d) => (d.id === id ? { ...d, actualOutcome: outcome, resolved: true } : d));
    setDecisions(updated);
    await saveJSON("decisions", updated);
  }

  if (!loaded) return null;

  return (
    <div style={styles.screenPad}>
      <div style={{ fontFamily: F.mono, fontSize: 11, color: C.muted, letterSpacing: 1 }}>DECISION ASSISTANT</div>
      <h2 style={styles.h2}>What decision are you facing?</h2>
      <textarea
        rows={3}
        style={styles.textarea}
        placeholder="e.g. Should I hire a second engineer now or wait until we hit $10k MRR?"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />
      {error && <p style={{ fontSize: 12, color: C.accent, marginTop: 6 }}>{error}</p>}
      <button style={{ ...styles.primaryBtn, marginTop: 10, opacity: question.trim() ? 1 : 0.4 }} disabled={!question.trim() || loading} onClick={submit}>
        {loading ? <Loader2 className="spin" size={15} /> : <>Break it down <Scale size={15} /></>}
      </button>

      {current && (
        <div style={styles.recCard}>
          <div style={styles.missionLabel}>SITUATION</div>
          <p style={styles.missionText}>{current.situation}</p>

          <div style={{ ...styles.missionLabel, marginTop: 14 }}>OPTIONS</div>
          {(current.options || []).map((o, idx) => (
            <div key={idx} style={{ marginTop: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{o.name}</div>
              {(o.advantages || []).map((a, idx2) => (
                <p key={idx2} style={{ fontSize: 12, color: C.accent2, margin: "3px 0 0" }}>+ {a}</p>
              ))}
              {(o.risks || []).map((r, idx2) => (
                <p key={idx2} style={{ fontSize: 12, color: C.accent, margin: "3px 0 0" }}>− {r}</p>
              ))}
            </div>
          ))}

          <div style={{ ...styles.missionLabel, marginTop: 14 }}>CONFIDENCE: {current.probability?.level?.toUpperCase()}</div>
          <p style={styles.missionText}>{current.probability?.reasoning}</p>

          <div style={{ ...styles.missionLabel, marginTop: 14, color: C.accent2 }}>RECOMMENDATION</div>
          <p style={{ ...styles.missionText, fontWeight: 600 }}>{current.recommendation?.choice}</p>
          <p style={styles.missionText}>{current.recommendation?.reasoning}</p>

          <div style={{ ...styles.missionLabel, marginTop: 14 }}>ACTION PLAN</div>
          {(current.actionPlan || []).map((s, idx) => (
            <p key={idx} style={{ ...styles.missionText, marginTop: 4 }}>{idx + 1}. {s}</p>
          ))}
        </div>
      )}

      {decisions.length > 0 && (
        <Section title="DECISION HISTORY">
          <div style={styles.logList}>
            {decisions.slice().reverse().map((d) => (
              <DecisionHistoryItem key={d.id} d={d} open={expanded === d.id} onToggle={() => setExpanded(expanded === d.id ? null : d.id)} onSaveOutcome={saveOutcome} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
