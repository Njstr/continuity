import React, { useMemo } from "react";
import { ChevronLeft, Sparkles } from "lucide-react";
import { Section } from "../components/common";
import { styles } from "../styles/styles";
import { C, F } from "../styles/theme";
import { computeAccuracy, averageError, formatErrorPct } from "../utils/predictionAccuracy";

// Learning Dashboard — every number here is computed from real accuracy
// data (predicted range midpoint vs. actual reported outcome). No
// "model version" or "weight update" concepts — there's no trainable
// model. What's real: your accuracy trend over time, and the actual
// lessons extracted from completed decisions (see LEARNING RECORD on
// each decision) that get fed back into future predictions as context.
export function Learning({ decisions, setScreen }) {
  const completed = useMemo(() => decisions.filter((d) => d.status === "completed" && d.accuracyResults?.length), [decisions]);

  const stats = useMemo(() => {
    const allResults = completed.flatMap((d) => d.accuracyResults.map((a) => ({ ...a, decisionText: d.decisionText, date: d.date })));
    const avgErr = averageError(allResults);
    const sorted = allResults.filter((a) => a.errorPct !== null).slice().sort((a, b) => a.errorPct - b.errorPct);
    const mostAccurate = sorted[0] || null;
    const leastAccurate = sorted[sorted.length - 1] || null;

    const confidenceCounts = { low: 0, medium: 0, high: 0 };
    decisions.forEach((d) => {
      if (d.overallConfidence && confidenceCounts[d.overallConfidence] !== undefined) confidenceCounts[d.overallConfidence]++;
    });

    const trend = completed
      .map((d) => ({ date: d.date, decisionText: d.decisionText, avgError: averageError(d.accuracyResults) }))
      .filter((t) => t.avgError !== null)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const lessons = decisions
      .filter((d) => d.learningSummary?.lessonsForFuture?.length)
      .map((d) => ({ date: d.date, decisionText: d.decisionText, lessons: d.learningSummary.lessonsForFuture }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    return { avgErr, mostAccurate, leastAccurate, confidenceCounts, trend, lessons };
  }, [completed, decisions]);

  return (
    <div style={styles.screenPad}>
      <button style={styles.backRow} onClick={() => setScreen("more")}>
        <ChevronLeft size={16} /> Back
      </button>
      <h2 style={{ ...styles.h2, marginTop: 14 }}>Prediction Learning</h2>
      <p style={{ fontSize: 12.5, color: C.muted, marginBottom: 16 }}>
        Every number below is computed from real reported outcomes — nothing here is estimated or invented.
      </p>

      <Section title="OVERVIEW">
        <div style={styles.osGrid}>
          <div style={styles.osCard}>
            <div style={styles.osCardLabel}>PREDICTIONS MADE</div>
            <div style={styles.osCardValue}>{decisions.length}</div>
          </div>
          <div style={styles.osCard}>
            <div style={styles.osCardLabel}>COMPLETED DECISIONS</div>
            <div style={styles.osCardValue}>{completed.length}</div>
          </div>
          <div style={styles.osCard}>
            <div style={styles.osCardLabel}>OVERALL ACCURACY</div>
            <div style={styles.osCardValue}>{stats.avgErr !== null ? `${(100 - stats.avgErr).toFixed(0)}%` : "—"}</div>
          </div>
          <div style={styles.osCard}>
            <div style={styles.osCardLabel}>AVG PREDICTION ERROR</div>
            <div style={styles.osCardValue}>{formatErrorPct(stats.avgErr)}</div>
          </div>
        </div>
      </Section>

      <Section title="CONFIDENCE DISTRIBUTION">
        <div style={styles.osGrid}>
          <div style={styles.osCard}><div style={styles.osCardLabel}>LOW</div><div style={{ ...styles.osCardValue, ...styles.osBadgeLow }}>{stats.confidenceCounts.low}</div></div>
          <div style={styles.osCard}><div style={styles.osCardLabel}>MEDIUM</div><div style={{ ...styles.osCardValue, ...styles.osBadgeMedium }}>{stats.confidenceCounts.medium}</div></div>
          <div style={styles.osCard}><div style={styles.osCardLabel}>HIGH</div><div style={{ ...styles.osCardValue, ...styles.osBadgeHigh }}>{stats.confidenceCounts.high}</div></div>
        </div>
      </Section>

      {stats.mostAccurate && (
        <Section title="MOST ACCURATE PREDICTION">
          <p style={styles.missionText}>{stats.mostAccurate.decisionText} — {stats.mostAccurate.metric}</p>
          <p style={{ fontSize: 12, color: C.accent2, marginTop: 2 }}>{formatErrorPct(stats.mostAccurate.errorPct)} error</p>
        </Section>
      )}

      {stats.leastAccurate && stats.leastAccurate !== stats.mostAccurate && (
        <Section title="LEAST ACCURATE PREDICTION">
          <p style={styles.missionText}>{stats.leastAccurate.decisionText} — {stats.leastAccurate.metric}</p>
          <p style={{ fontSize: 12, color: C.accent, marginTop: 2 }}>{formatErrorPct(stats.leastAccurate.errorPct)} error</p>
        </Section>
      )}

      {stats.trend.length > 0 && (
        <Section title="ACCURACY TREND">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {stats.trend.map((t, idx) => (
              <div key={idx} style={styles.accuracyRow}>
                <span style={{ fontFamily: F.mono, fontSize: 10.5, color: C.muted }}>{t.date}</span>
                <span style={{ fontSize: 12, flex: 1, marginLeft: 10 }}>{t.decisionText}</span>
                <span style={{ fontFamily: F.mono, color: C.accent }}>{formatErrorPct(t.avgError)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="LEARNING ENTRIES">
        {stats.lessons.length === 0 ? (
          <p style={styles.emptyStateText}>No lessons recorded yet — these accumulate as decisions are completed with reported outcomes.</p>
        ) : (
          stats.lessons.map((l, idx) => (
            <div key={idx} style={{ ...styles.faqItem, cursor: "default", marginBottom: 8 }}>
              <div style={styles.faqQ}>
                <Sparkles size={13} color={C.accent2} />
                <span style={{ fontSize: 12.5 }}>{l.decisionText}</span>
              </div>
              {l.lessons.map((lesson, i) => <p key={i} style={styles.faqA}>• {lesson}</p>)}
            </div>
          ))
        )}
      </Section>
    </div>
  );
}
