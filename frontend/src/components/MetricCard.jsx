import React, { useState } from "react";
import { styles } from "../styles/styles";
import { C } from "../styles/theme";

export function MetricCard({ label, value, trend, trendGood, why }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={styles.metricCard2}>
      <div style={styles.metricCardLabel}>{label}</div>
      <div style={styles.metricCardValue}>{value}</div>
      {trend !== undefined && trend !== null && (
        <div style={{ ...styles.metricCardTrend, color: trendGood ? C.accent2 : C.accent }}>{trend}</div>
      )}
      {why && (
        <>
          <button style={styles.metricWhyBtn} onClick={() => setOpen(!open)}>
            {open ? "Hide" : "Why?"}
          </button>
          {open && <p style={styles.metricWhyText}>{why}</p>}
        </>
      )}
    </div>
  );
}
