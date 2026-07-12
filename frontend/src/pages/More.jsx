import React, { useState } from "react";
import { HelpCircle, Mail, ChevronRight, Check, ShieldAlert, ClipboardList, History, Sparkles, Loader2 } from "lucide-react";
import { Section } from "../components/common";
import { styles } from "../styles/styles";
import { C } from "../styles/theme";
import { FAQS } from "../constants";
import { loadJSON } from "../utils/storage";
import { api } from "../api/client";

export function More({ setScreen, onFeedback, profile, missions }) {
  const [openFaq, setOpenFaq] = useState(null);
  const [fbText, setFbText] = useState("");
  const [fbSent, setFbSent] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [patterns, setPatterns] = useState(null);
  const [patternError, setPatternError] = useState(null);

  function submitFeedback() {
    if (!fbText.trim()) return;
    onFeedback({ context: "general", content: fbText.trim(), rating: null });
    setFbText("");
    setFbSent(true);
    setTimeout(() => setFbSent(false), 3000);
  }

  async function runPatternDetection() {
    setDetecting(true);
    setPatternError(null);
    try {
      const decisions = await loadJSON("decisions", []);
      const healthHistory = await loadJSON("healthHistory", []);
      const result = await api.patterns(profile, missions, decisions, healthHistory);
      setPatterns(result.patterns || []);
    } catch (e) {
      setPatternError(e.message || "Couldn't reach the server.");
    }
    setDetecting(false);
  }

  return (
    <div style={styles.screenPad}>
      <Section title="SEND FEEDBACK">
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>
          Tell us what's working, what's broken, or what a good co-founder AI should do differently. Every note here shapes what gets built next.
        </p>
        <textarea rows={6} style={{ ...styles.textarea, minHeight: 130 }} placeholder="Your feedback…" value={fbText} onChange={(e) => setFbText(e.target.value)} />
        <button style={{ ...styles.primaryBtn, marginTop: 8, opacity: fbText.trim() ? 1 : 0.4 }} disabled={!fbText.trim()} onClick={submitFeedback}>
          {fbSent ? <>Sent <Check size={15} /></> : <>Submit feedback <ChevronRight size={15} /></>}
        </button>
      </Section>

      <Section title="PATTERN DETECTION">
        <p style={{ fontSize: 12.5, color: C.muted, marginBottom: 10 }}>
          Have the mentor scan your mission, decision, and health history for patterns worth knowing about.
        </p>
        {patternError && <p style={{ fontSize: 12, color: C.accent, marginBottom: 8 }}>{patternError}</p>}
        {patterns && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
            {patterns.map((p, idx) => (
              <div key={idx} style={{ ...styles.faqItem, cursor: "default" }}>
                <div style={styles.faqQ}>
                  <Sparkles size={14} color={p.severity === "risk" ? C.accent : C.accent2} />
                  <span>{p.insight}</span>
                </div>
                <p style={styles.faqA}>{p.evidence}</p>
              </div>
            ))}
          </div>
        )}
        <button style={{ ...styles.ghostBtn, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={runPatternDetection} disabled={detecting}>
          {detecting ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />} {patterns ? "Re-scan for patterns" : "Detect patterns"}
        </button>
      </Section>

      <Section title="HELP & SUPPORT">
        <div style={styles.faqList}>
          {FAQS.map((f, idx) => (
            <div key={idx} style={styles.faqItem} onClick={() => setOpenFaq(openFaq === idx ? null : idx)}>
              <div style={styles.faqQ}>
                <HelpCircle size={14} color={C.accent} />
                <span>{f.q}</span>
              </div>
              {openFaq === idx && <p style={styles.faqA}>{f.a}</p>}
            </div>
          ))}
        </div>
        <div style={styles.contactRow}>
          <Mail size={14} color={C.muted} />
          <span style={{ fontSize: 12, color: C.muted }}>support@foundercompanion.app</span>
        </div>
      </Section>

      <Section title="RITUALS">
        <button style={styles.linkRow} onClick={() => setScreen("weekly")}>
          <ClipboardList size={15} color={C.accent} />
          <span>Weekly Founder Review</span>
          <ChevronRight size={15} color={C.muted} style={{ marginLeft: "auto" }} />
        </button>
        <button style={{ ...styles.linkRow, marginTop: 8 }} onClick={() => setScreen("timeline")}>
          <History size={15} color={C.accent} />
          <span>Founder Timeline</span>
          <ChevronRight size={15} color={C.muted} style={{ marginLeft: "auto" }} />
        </button>
      </Section>

      <Section title="LEGAL">
        <button style={styles.linkRow} onClick={() => setScreen("terms")}>
          <ShieldAlert size={15} color={C.accent} />
          <span>Terms & Conditions, Disclaimer</span>
          <ChevronRight size={15} color={C.muted} style={{ marginLeft: "auto" }} />
        </button>
      </Section>
    </div>
  );
}
