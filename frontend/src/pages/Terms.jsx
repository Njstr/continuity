import React from "react";
import { ChevronLeft } from "lucide-react";
import { styles } from "../styles/styles";
import { TERMS_INTRO, TERMS_BODY } from "../constants";

export function Terms({ setScreen }) {
  return (
    <div style={styles.screenPad}>
      <button style={styles.backRow} onClick={() => setScreen("more")}>
        <ChevronLeft size={16} /> Back
      </button>
      <h2 style={{ ...styles.h2, marginTop: 14 }}>Terms & Disclaimer</h2>
      <div style={styles.termsBlock}>
        <p style={styles.termsP}><b>{TERMS_INTRO}</b></p>
        {TERMS_BODY.map((p, idx) => (
          <p key={idx} style={styles.termsP}>{p}</p>
        ))}
        <p style={{ ...styles.termsP, color: "#8B93A1", fontSize: 12 }}>
          By continuing to use FounderOS, you acknowledge and accept these terms.
        </p>
      </div>
    </div>
  );
}
