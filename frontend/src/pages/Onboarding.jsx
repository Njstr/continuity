import React, { useState } from "react";
import { Anchor, ChevronRight, Loader2 } from "lucide-react";
import { styles } from "../styles/styles";
import { C, F, globalCss } from "../styles/theme";
import { STARTUP_STAGES, todayStr } from "../constants";
import { api } from "../api/client";

// Onboarding — two short steps, not a questionnaire. The founder describes
// their startup in their own words; the AI pulls out whatever's genuinely
// inferable and leaves the rest null. No metrics step: Metrics only ever
// comes from an uploaded financial document now (see MetricsHome), so
// asking for numbers here would just be manual entry by another name.
export function Onboarding({ onDone }) {
  const [step, setStep] = useState("describe"); // describe | review
  const [founderName, setFounderName] = useState("");
  const [description, setDescription] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState(null);
  const [extracted, setExtracted] = useState(null); // { startupName, oneLiner, industry, businessModel, stage, teamSize, country }

  const canSubmitDescribe = founderName.trim() && description.trim().length >= 10;

  async function handleDescribe() {
    if (!canSubmitDescribe || extracting) return;
    setExtracting(true);
    setError(null);
    try {
      const result = await api.onboard(description.trim());
      setExtracted(result);
      setStep("review");
    } catch (e) {
      setError(e.message || "Couldn't process that just now — try again.");
    }
    setExtracting(false);
  }

  function finish() {
    const companyProfile = {
      founderName: founderName.trim(),
      startupName: extracted.startupName?.trim() || "My Startup",
      oneLiner: extracted.oneLiner || description.trim().slice(0, 200),
      industry: extracted.industry || null,
      businessModel: extracted.businessModel || null,
      stage: extracted.stage || null,
      teamSize: extracted.teamSize ?? null,
      country: extracted.country || null,
      createdAt: todayStr(),
    };
    // Metrics start genuinely empty — not zero, not guessed — until a real
    // financial document unlocks the Metrics tab.
    onDone(companyProfile, {});
  }

  function updateField(key, value) {
    setExtracted((prev) => ({ ...prev, [key]: value === "" ? null : value }));
  }

  return (
    <div style={styles.onboardWrap}>
      <style>{globalCss}</style>
      <div style={styles.onboardTop}>
        <Anchor size={18} color={C.accent} />
        <span style={styles.brand}>FounderOS</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {step === "describe" && (
          <>
            <div style={styles.stepBadge}>LET'S GET STARTED</div>
            <h2 style={{ ...styles.qLabel, marginBottom: 16 }}>Tell me about your startup</h2>

            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Your name</label>
              <input style={styles.selectInput} value={founderName} onChange={(e) => setFounderName(e.target.value)} placeholder="Your name" />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>What are you building?</label>
              <textarea
                style={{ ...styles.selectInput, minHeight: 120, resize: "vertical", fontFamily: F.body, paddingTop: 10 }}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. We're building a SaaS product for retailers. We currently have 27 paying customers. Pre-seed, based in India, small team of 3."
              />
              <p style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>
                Write it however feels natural — industry, stage, team size, whatever you know. I'll figure out what I can from it.
              </p>
            </div>

            {error && <p style={{ fontSize: 12.5, color: "#d85050", marginBottom: 8 }}>{error}</p>}
          </>
        )}

        {step === "review" && extracted && (
          <>
            <div style={styles.stepBadge}>QUICK CHECK</div>
            <h2 style={{ ...styles.qLabel, marginBottom: 6 }}>Here's what I picked up</h2>
            <p style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
              Anything blank means I genuinely couldn't tell from what you wrote — fill it in or leave it, your call.
            </p>

            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Startup name</label>
              <input style={styles.selectInput} value={extracted.startupName || ""} onChange={(e) => updateField("startupName", e.target.value)} placeholder="Not sure yet" />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>One-liner</label>
              <input style={styles.selectInput} value={extracted.oneLiner || ""} onChange={(e) => updateField("oneLiner", e.target.value)} placeholder="Not sure yet" />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Stage</label>
              <select style={styles.selectInput} value={extracted.stage || ""} onChange={(e) => updateField("stage", e.target.value)}>
                <option value="">Not sure yet</option>
                {STARTUP_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Industry</label>
              <input style={styles.selectInput} value={extracted.industry || ""} onChange={(e) => updateField("industry", e.target.value)} placeholder="Not sure yet" />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Business model</label>
              <input style={styles.selectInput} value={extracted.businessModel || ""} onChange={(e) => updateField("businessModel", e.target.value)} placeholder="Not sure yet" />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Team size</label>
              <input
                type="number"
                style={styles.selectInput}
                value={extracted.teamSize ?? ""}
                onChange={(e) => updateField("teamSize", e.target.value === "" ? null : Number(e.target.value))}
                placeholder="Not sure yet"
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Country</label>
              <input style={styles.selectInput} value={extracted.country || ""} onChange={(e) => updateField("country", e.target.value)} placeholder="Not sure yet" />
            </div>
          </>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        {step === "describe" ? (
          <button style={{ ...styles.primaryBtn, flex: 1, opacity: canSubmitDescribe && !extracting ? 1 : 0.5 }} disabled={!canSubmitDescribe || extracting} onClick={handleDescribe}>
            {extracting ? <Loader2 className="spin" size={16} /> : <>Continue <ChevronRight size={16} /></>}
          </button>
        ) : (
          <button style={{ ...styles.primaryBtn, flex: 1 }} onClick={finish}>
            Enter FounderOS <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
