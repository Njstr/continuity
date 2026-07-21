import React, { useState } from "react";
import { Anchor, ChevronRight, ChevronLeft, SkipForward } from "lucide-react";
import { styles } from "../styles/styles";
import { C, F, globalCss } from "../styles/theme";
import { INDUSTRIES, BUSINESS_MODELS, STARTUP_STAGES, COUNTRIES, CURRENCIES, METRIC_GROUPS, emptyMetrics, todayStr } from "../constants";

const TOTAL_STEPS = 2 + METRIC_GROUPS.length; // company info + N metric groups + review

// Onboarding — pure data collection, no AI call needed. FounderOS isn't
// building a founder personality profile anymore; it needs the company's
// real numbers, honestly marked Unknown where they're not known, because
// the Decision Simulator's honesty depends on never inventing a baseline.
export function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [company, setCompany] = useState({
    founderName: "", companyName: "", industry: INDUSTRIES[0], businessModel: BUSINESS_MODELS[0],
    stage: STARTUP_STAGES[0], teamSize: "", country: COUNTRIES[0], currency: CURRENCIES[0].code,
  });
  const [metrics, setMetrics] = useState(emptyMetrics());

  const isCompanyStep = step === 0;
  const isReviewStep = step === TOTAL_STEPS - 1;
  const metricGroupIndex = step - 1;
  const currentGroup = !isCompanyStep && !isReviewStep ? METRIC_GROUPS[metricGroupIndex] : null;

  function finish() {
    const companyProfile = { ...company, teamSize: Number(company.teamSize) || 0, createdAt: todayStr() };
    onDone(companyProfile, metrics);
  }

  const canAdvance = !isCompanyStep || (company.founderName.trim() && company.companyName.trim());

  return (
    <div style={styles.onboardWrap}>
      <style>{globalCss}</style>
      <div style={styles.onboardTop}>
        <Anchor size={18} color={C.accent} />
        <span style={styles.brand}>FounderOS — Company Setup</span>
      </div>

      <div style={styles.wizardProgressRow}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div key={i} style={{ ...styles.wizardProgressSeg, ...(i <= step ? styles.wizardProgressSegActive : {}) }} />
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {isCompanyStep && (
          <>
            <div style={styles.stepBadge}>COMPANY INFORMATION</div>
            <h2 style={{ ...styles.qLabel, marginBottom: 16 }}>Tell us about your company</h2>
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Your name</label>
              <input style={styles.selectInput} value={company.founderName} onChange={(e) => setCompany({ ...company, founderName: e.target.value })} placeholder="Your name" />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Company name</label>
              <input style={styles.selectInput} value={company.companyName} onChange={(e) => setCompany({ ...company, companyName: e.target.value })} placeholder="Acme Inc." />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Industry</label>
              <select style={styles.selectInput} value={company.industry} onChange={(e) => setCompany({ ...company, industry: e.target.value })}>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Startup stage</label>
              <select style={styles.selectInput} value={company.stage} onChange={(e) => setCompany({ ...company, stage: e.target.value })}>
                {STARTUP_STAGES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Business model</label>
              <select style={styles.selectInput} value={company.businessModel} onChange={(e) => setCompany({ ...company, businessModel: e.target.value })}>
                {BUSINESS_MODELS.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Team size</label>
              <input type="number" min="0" style={styles.selectInput} value={company.teamSize} onChange={(e) => setCompany({ ...company, teamSize: e.target.value })} placeholder="0" />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Country</label>
              <select style={styles.selectInput} value={company.country} onChange={(e) => setCompany({ ...company, country: e.target.value })}>
                {COUNTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Currency</label>
              <select style={styles.selectInput} value={company.currency} onChange={(e) => setCompany({ ...company, currency: e.target.value })}>
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
              </select>
            </div>
          </>
        )}

        {currentGroup && (
          <>
            <div style={styles.stepBadge}>CURRENT STARTUP METRICS</div>
            <h2 style={{ ...styles.qLabel, marginBottom: 6 }}>{currentGroup.label}</h2>
            <p style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
              Don't know a number? Leave it blank — it's marked Unknown, never guessed for you.
            </p>
            {currentGroup.fields.map((f) => (
              <div key={f.key} style={styles.metricFieldRow}>
                <label style={{ ...styles.fieldLabel, flex: 1, marginBottom: 0 }}>{f.label}</label>
                <input
                  type="number"
                  style={{ ...styles.metricFieldInput, flex: "0 0 110px" }}
                  value={metrics[f.key] ?? ""}
                  onChange={(e) => setMetrics({ ...metrics, [f.key]: e.target.value === "" ? null : e.target.value })}
                  placeholder="Unknown"
                />
              </div>
            ))}
          </>
        )}

        {isReviewStep && (
          <>
            <div style={styles.stepBadge}>READY</div>
            <h2 style={{ ...styles.qLabel, marginBottom: 10 }}>You're set up</h2>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>
              {company.companyName} — {company.industry}, {company.stage}. You can update any of these numbers anytime from More → Startup Metrics Management.
            </p>
          </>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        {step > 0 && (
          <button style={styles.ghostBtn} onClick={() => setStep(step - 1)}>
            <ChevronLeft size={15} />
          </button>
        )}
        {!isReviewStep ? (
          <>
            <button style={{ ...styles.primaryBtn, flex: 1, opacity: canAdvance ? 1 : 0.4 }} disabled={!canAdvance} onClick={() => setStep(step + 1)}>
              Continue <ChevronRight size={16} />
            </button>
          </>
        ) : (
          <button style={{ ...styles.primaryBtn, flex: 1 }} onClick={finish}>
            Enter FounderOS <ChevronRight size={16} />
          </button>
        )}
      </div>
      {currentGroup && (
        <button style={{ ...styles.ghostBtn, marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={() => setStep(step + 1)}>
          <SkipForward size={13} /> Skip this section
        </button>
      )}
    </div>
  );
}
