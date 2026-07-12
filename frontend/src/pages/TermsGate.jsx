import React, { useState } from "react";
import { ShieldAlert, ChevronRight } from "lucide-react";
import { styles } from "../styles/styles";
import { globalCss } from "../styles/theme";
import { TERMS_INTRO, TERMS_BODY } from "../constants";

export function TermsGate({ onAccept }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <div style={styles.gateWrap}>
      <style>{globalCss}</style>
      <div style={styles.gateTop}>
        <ShieldAlert size={18} />
        <span style={styles.brand}>Terms & Disclaimer</span>
      </div>
      <div style={styles.gateScroll}>
        <p style={styles.termsP}><b>{TERMS_INTRO}</b></p>
        {TERMS_BODY.map((p, idx) => (
          <p key={idx} style={styles.termsP}>{p}</p>
        ))}
      </div>
      <div style={styles.gateFooter}>
        <label style={styles.agreeRow}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={styles.agreeCheckbox} />
          <span style={{ fontSize: 13 }}>I agree to the Terms & Conditions</span>
        </label>
        <button style={{ ...styles.primaryBtn, opacity: agreed ? 1 : 0.4, width: "100%" }} disabled={!agreed} onClick={onAccept}>
          Continue <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
