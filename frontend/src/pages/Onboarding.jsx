import React, { useState } from "react";
import { Anchor, ChevronRight, X } from "lucide-react";
import { styles } from "../styles/styles";
import { C, F, globalCss } from "../styles/theme";
import { COUNTRIES, COUNTRY_TO_CURRENCY, TERMS_INTRO, TERMS_BODY, todayStr } from "../constants";

// One screen. Founder Name, Startup Name, Description, Country (needed
// for currency formatting and legal grounding — the app genuinely can't
// format money or give jurisdiction-aware advice without it). Everything
// else — industry, business model, pricing, goals, competitors — gets
// learned naturally through conversation later (see extractCompanyContext
// on the backend), never asked as a form field here.
export function Onboarding({ onDone }) {
  const [founderName, setFounderName] = useState("");
  const [startupName, setStartupName] = useState("");
  const [description, setDescription] = useState("");
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [agreed, setAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const canSubmit = founderName.trim() && startupName.trim() && description.trim().length >= 10 && agreed;

  function finish() {
    if (!canSubmit) return;
    const companyProfile = {
      founderName: founderName.trim(),
      startupName: startupName.trim(),
      oneLiner: description.trim(),
      industry: null,
      businessModel: null,
      stage: null,
      teamSize: null,
      country,
      currency: COUNTRY_TO_CURRENCY[country] || "USD",
      createdAt: todayStr(),
    };
    // Metrics start genuinely empty — not zero, not guessed — until a real
    // financial document unlocks the Metrics tab.
    onDone(companyProfile, {});
  }

  return (
    <div style={styles.onboardWrap}>
      <style>{globalCss}</style>
      <div style={styles.onboardTop}>
        <Anchor size={18} color={C.accent} />
        <span style={styles.brand}>FounderOS</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={styles.stepBadge}>LET'S GET STARTED</div>
        <h2 style={{ ...styles.qLabel, marginBottom: 16 }}>Tell me about your startup</h2>

        <div style={styles.fieldGroup}>
          <label style={styles.fieldLabel}>Your name</label>
          <input style={styles.selectInput} value={founderName} onChange={(e) => setFounderName(e.target.value)} placeholder="Your name" />
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.fieldLabel}>Startup name</label>
          <input style={styles.selectInput} value={startupName} onChange={(e) => setStartupName(e.target.value)} placeholder="What's it called?" />
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.fieldLabel}>What are you building?</label>
          <textarea
            style={{ ...styles.selectInput, minHeight: 110, resize: "vertical", fontFamily: F.body, paddingTop: 10 }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A sentence or two is plenty — I'll learn the rest as we talk."
          />
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.fieldLabel}>Country</label>
          <select style={styles.selectInput} value={country} onChange={(e) => setCountry(e.target.value)}>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginTop: 10 }}>
        <label style={{ ...styles.agreeRow, justifyContent: "center" }}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={styles.agreeCheckbox} />
          <span style={{ fontSize: 13 }}>
            I accept the{" "}
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setShowTerms(true); }}
              style={{ background: "none", border: "none", padding: 0, color: C.accent, textDecoration: "underline", cursor: "pointer", font: "inherit" }}
            >
              Terms and Conditions
            </button>
          </span>
        </label>
        <button style={{ ...styles.primaryBtn, width: "100%", opacity: canSubmit ? 1 : 0.5 }} disabled={!canSubmit} onClick={finish}>
          Enter FounderOS <ChevronRight size={16} />
        </button>
      </div>

      {showTerms && (
        <div
          onClick={() => setShowTerms(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "flex-end" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderRadius: "16px 16px 0 0", padding: "16px 18px 24px", width: "100%", maxHeight: "78vh", display: "flex", flexDirection: "column" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontFamily: F.display, fontSize: 17 }}>Terms & Conditions</span>
              <button onClick={() => setShowTerms(false)} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ overflowY: "auto" }}>
              <p style={styles.termsP}><b>{TERMS_INTRO}</b></p>
              {TERMS_BODY.map((p, idx) => (
                <p key={idx} style={styles.termsP}>{p}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
