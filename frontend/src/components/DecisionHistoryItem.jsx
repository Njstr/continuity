import React, { useState } from "react";
import { Scale } from "lucide-react";
import { styles } from "../styles/styles";
import { C } from "../styles/theme";

export const DecisionHistoryItem = React.memo(function DecisionHistoryItem({ d, open, onToggle, onSaveOutcome }) {
  const [outcome, setOutcome] = useState(d.actualOutcome || "");
  return (
    <div style={styles.faqItem} onClick={onToggle}>
      <div style={styles.faqQ}>
        <Scale size={14} color={C.accent} />
        <span>{d.question}</span>
      </div>
      {open && (
        <div onClick={(e) => e.stopPropagation()}>
          <p style={styles.faqA}>
            <b>Recommended:</b> {d.recommendation?.choice}
          </p>
          <p style={{ ...styles.faqA, color: C.muted }}>{d.date}</p>
          <div style={{ marginTop: 8 }}>
            <label style={styles.metricLabel}>What actually happened? (optional)</label>
            <textarea
              rows={2}
              style={styles.commentTextarea}
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="Update the outcome once you know it"
            />
            <button style={{ ...styles.commentSendBtn, marginTop: 6 }} onClick={() => onSaveOutcome(d.id, outcome)}>
              {d.resolved ? "Update outcome" : "Log outcome"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
