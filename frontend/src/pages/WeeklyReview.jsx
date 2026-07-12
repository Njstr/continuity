import React, { useEffect, useState } from "react";
import { ChevronLeft, ArrowRight, ClipboardList, Loader2 } from "lucide-react";
import { Section } from "../components/common";
import { styles } from "../styles/styles";
import { C } from "../styles/theme";
import { WEEKLY_QUESTIONS, todayStr } from "../constants";
import { loadJSON, saveJSON } from "../utils/storage";
import { api } from "../api/client";

export function WeeklyReview({ profile, missions, setScreen }) {
  const [reviews, setReviews] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const r = await loadJSON("weeklyReviews", []);
      setReviews(r);
      setLoaded(true);
    })();
  }, []);

  const lastReview = reviews[reviews.length - 1];
  const filledCount = WEEKLY_QUESTIONS.filter((q) => (answers[q.key] || "").trim()).length;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const report = await api.weeklyReview(profile, answers, missions);
      const entry = { date: todayStr(), answers, report };
      const updated = [...reviews, entry];
      setReviews(updated);
      await saveJSON("weeklyReviews", updated);
      setAnswers({});
      api.logEvent("weekly_review", `Weekly review: ${report.progressSummary?.slice(0, 60)}`);
    } catch (e) {
      setError(e.message || "Couldn't reach the server.");
    }
    setSubmitting(false);
  }

  if (!loaded) return null;

  return (
    <div style={styles.screenPad}>
      <button style={styles.backRow} onClick={() => setScreen("more")}>
        <ChevronLeft size={16} /> Back
      </button>
      <h2 style={{ ...styles.h2, marginTop: 14 }}>Weekly Founder Review</h2>
      <p style={{ fontSize: 12.5, color: C.muted, marginTop: -4, marginBottom: 4 }}>
        {lastReview ? `Last review: ${lastReview.date}` : "No reviews yet — this is your first."}
      </p>

      <Section title="THIS WEEK">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {WEEKLY_QUESTIONS.map((q) => (
            <div key={q.key}>
              <label style={styles.metricLabel}>{q.label}</label>
              {q.key === "energy" ? (
                <input type="number" min={1} max={10} style={styles.metricInput} value={answers[q.key] || ""} onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.value })} placeholder="1–10" />
              ) : (
                <textarea rows={2} style={styles.textarea} value={answers[q.key] || ""} onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.value })} />
              )}
            </div>
          ))}
        </div>
        {error && <p style={{ fontSize: 12, color: C.accent, marginTop: 10 }}>{error}</p>}
        <button style={{ ...styles.primaryBtn, marginTop: 14, opacity: filledCount > 0 ? 1 : 0.4 }} disabled={filledCount === 0 || submitting} onClick={submit}>
          {submitting ? <Loader2 className="spin" size={15} /> : <>Generate weekly report <ArrowRight size={15} /></>}
        </button>
      </Section>

      {reviews.length > 0 && (
        <Section title="REVIEW HISTORY">
          <div style={styles.logList}>
            {reviews.slice().reverse().map((r, idx) => (
              <div key={idx} style={styles.faqItem} onClick={() => setExpanded(expanded === idx ? null : idx)}>
                <div style={styles.faqQ}>
                  <ClipboardList size={14} color={C.accent} />
                  <span>{r.date} — {r.report?.progressSummary?.slice(0, 60) || "Review"}…</span>
                </div>
                {expanded === idx && (
                  <div>
                    <p style={styles.faqA}>{r.report?.progressSummary}</p>
                    {(r.report?.topPriorities || []).length > 0 && (
                      <>
                        <div style={{ ...styles.missionLabel, marginTop: 8 }}>TOP PRIORITIES</div>
                        {r.report.topPriorities.map((p, i) => (
                          <p key={i} style={{ ...styles.missionText, marginTop: 4 }}>{i + 1}. {p.title}</p>
                        ))}
                      </>
                    )}
                    {r.report?.strategicAdvice && (
                      <>
                        <div style={{ ...styles.missionLabel, marginTop: 8, color: C.accent2 }}>ADVICE</div>
                        <p style={styles.missionText}>{r.report.strategicAdvice}</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
