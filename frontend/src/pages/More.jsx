import React, { useEffect, useState } from "react";
import {
  HelpCircle, Mail, ChevronRight, ChevronDown, ChevronUp, Check, X, Clock, Edit3, ShieldAlert, Download,
  Bell, Info, Edit2, Loader2,
} from "lucide-react";
import { Section, EditableLine } from "../components/common";
import { styles } from "../styles/styles";
import { C, F } from "../styles/theme";
import { FAQS, INDUSTRIES, BUSINESS_MODELS, STARTUP_STAGES, COUNTRIES, CURRENCIES } from "../constants";
import { api } from "../api/client";

const STATUS_META = {
  proceeded: { label: "Proceeded", icon: Check, color: C.accent2 },
  not_proceeded: { label: "Didn't proceed", icon: X, color: C.muted },
  modified: { label: "Modified", icon: Edit3, color: C.accent },
  decided_later: { label: "Deciding later", icon: Clock, color: C.muted },
};

// Decision History — an inline section within More, not a separate page,
// per the product spec ("never create separate pages for Decision
// History"). Fetches from the real backend decision lifecycle rather than
// the old localStorage-only array.
function DecisionHistorySection() {
  const [decisions, setDecisions] = useState(null);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    api.listDecisionsV2().then(({ decisions }) => setDecisions(decisions)).catch(() => setDecisions([]));
  }, []);

  function exportCsv() {
    const rows = [["Decision", "Status", "Date", "Predicted", "Actual"]];
    (decisions || []).forEach((d) => {
      rows.push([d.finalDecisionText || d.decisionText, d.status, d.createdAt, d.prediction?.expectedCase || "", d.outcome?.actualUpdate || ""]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "founderos-decisions.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Section title="DECISION HISTORY">
      {decisions === null && (
        <div style={{ display: "flex", justifyContent: "center", padding: 16 }}>
          <Loader2 className="spin" size={16} color={C.accent} />
        </div>
      )}
      {decisions?.length === 0 && <p style={{ fontSize: 12.5, color: C.muted }}>No decisions recorded yet — ask FounderOS about one in Chats.</p>}
      {decisions?.map((d) => {
        const meta = STATUS_META[d.status] || STATUS_META.decided_later;
        const Icon = meta.icon;
        const open = openId === d.id;
        return (
          <div key={d.id} style={{ borderBottom: `1px solid ${C.border}`, padding: "8px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => setOpenId(open ? null : d.id)}>
              <Icon size={13} color={meta.color} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {d.finalDecisionText || d.decisionText}
              </span>
              {open ? <ChevronUp size={14} color={C.muted} /> : <ChevronDown size={14} color={C.muted} />}
            </div>
            {open && (
              <div style={{ marginTop: 6, paddingLeft: 21 }}>
                {d.prediction && <p style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Predicted: {d.prediction.expectedCase}</p>}
                {d.outcome ? (
                  <>
                    <p style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Actual: {d.outcome.actualUpdate}</p>
                    <p style={{ fontSize: 12 }}>{d.outcome.comparisonSummary}</p>
                  </>
                ) : d.prediction ? (
                  <p style={{ fontSize: 11.5, color: C.accent }}>Not checked in yet — FounderOS will ask in Chats once it's due.</p>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
      {decisions?.length > 0 && (
        <button style={{ ...styles.ghostBtn, marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={exportCsv}>
          <Download size={13} /> Export as CSV
        </button>
      )}
    </Section>
  );
}

// More — the secondary-functionality hub: Company Profile, Decision
// History, Settings, Help & Support, Feedback, About. Metrics management
// lives in its own top-level tab (see MetricsHome).
export function More({ setScreen, onFeedback, companyProfile, setCompanyProfile }) {
  const [openFaq, setOpenFaq] = useState(null);
  const [fbText, setFbText] = useState("");
  const [fbSent, setFbSent] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState(companyProfile);

  function submitFeedback() {
    if (!fbText.trim()) return;
    onFeedback({ context: "general", content: fbText.trim(), rating: null });
    setFbText("");
    setFbSent(true);
    setTimeout(() => setFbSent(false), 3000);
  }

  function saveProfile() {
    setCompanyProfile({ ...profileDraft, teamSize: Number(profileDraft.teamSize) || 0 });
    setEditingProfile(false);
  }

  return (
    <div style={styles.screenPad}>
      <Section title="COMPANY PROFILE">
        {!editingProfile ? (
          <>
            <p style={styles.missionText}>{companyProfile.companyName} · {companyProfile.industry}</p>
            <p style={{ ...styles.missionText, color: C.muted }}>
              {[companyProfile.stage, companyProfile.businessModel, companyProfile.teamSize ? `${companyProfile.teamSize} people` : null, companyProfile.country]
                .filter(Boolean)
                .join(" · ") || "Add more details anytime"}
            </p>
            <button style={{ ...styles.ghostBtn, marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => { setProfileDraft(companyProfile); setEditingProfile(true); }}>
              <Edit2 size={13} /> Edit
            </button>
          </>
        ) : (
          <>
            <div style={styles.fieldGroup}><label style={styles.fieldLabel}>Company name</label><input style={styles.selectInput} value={profileDraft.companyName} onChange={(e) => setProfileDraft({ ...profileDraft, companyName: e.target.value })} /></div>
            <div style={styles.fieldGroup}><label style={styles.fieldLabel}>Industry</label><select style={styles.selectInput} value={profileDraft.industry} onChange={(e) => setProfileDraft({ ...profileDraft, industry: e.target.value })}>{INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}</select></div>
            <div style={styles.fieldGroup}><label style={styles.fieldLabel}>Stage</label><select style={styles.selectInput} value={profileDraft.stage} onChange={(e) => setProfileDraft({ ...profileDraft, stage: e.target.value })}>{STARTUP_STAGES.map((i) => <option key={i} value={i}>{i}</option>)}</select></div>
            <div style={styles.fieldGroup}><label style={styles.fieldLabel}>Business model</label><select style={styles.selectInput} value={profileDraft.businessModel} onChange={(e) => setProfileDraft({ ...profileDraft, businessModel: e.target.value })}>{BUSINESS_MODELS.map((i) => <option key={i} value={i}>{i}</option>)}</select></div>
            <div style={styles.fieldGroup}><label style={styles.fieldLabel}>Team size</label><input type="number" style={styles.selectInput} value={profileDraft.teamSize} onChange={(e) => setProfileDraft({ ...profileDraft, teamSize: e.target.value })} /></div>
            <div style={styles.fieldGroup}><label style={styles.fieldLabel}>Country</label><select style={styles.selectInput} value={profileDraft.country} onChange={(e) => setProfileDraft({ ...profileDraft, country: e.target.value })}>{COUNTRIES.map((i) => <option key={i} value={i}>{i}</option>)}</select></div>
            <div style={styles.fieldGroup}><label style={styles.fieldLabel}>Currency</label><select style={styles.selectInput} value={profileDraft.currency} onChange={(e) => setProfileDraft({ ...profileDraft, currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}</select></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={styles.primaryBtn} onClick={saveProfile}><Check size={15} /> Save</button>
              <button style={styles.ghostBtn} onClick={() => setEditingProfile(false)}>Cancel</button>
            </div>
          </>
        )}
      </Section>

      <DecisionHistorySection />

      <Section title="NOTIFICATIONS">
        <p style={{ fontSize: 12.5, color: C.muted }}>
          <Bell size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
          Decision check-ins happen naturally in Chats once a prediction is due for review.
        </p>
      </Section>

      <Section title="SEND FEEDBACK">
        <textarea rows={5} style={{ ...styles.textarea, minHeight: 110 }} placeholder="Your feedback…" value={fbText} onChange={(e) => setFbText(e.target.value)} />
        <button style={{ ...styles.primaryBtn, marginTop: 8, opacity: fbText.trim() ? 1 : 0.4 }} disabled={!fbText.trim()} onClick={submitFeedback}>
          {fbSent ? <>Sent <Check size={15} /></> : <>Submit feedback <ChevronRight size={15} /></>}
        </button>
      </Section>

      <Section title="HELP & SUPPORT">
        <div style={styles.faqList}>
          {FAQS.map((f, idx) => (
            <div key={idx} style={styles.faqItem} onClick={() => setOpenFaq(openFaq === idx ? null : idx)}>
              <div style={styles.faqQ}><HelpCircle size={14} color={C.accent} /><span>{f.q}</span></div>
              {openFaq === idx && <p style={styles.faqA}>{f.a}</p>}
            </div>
          ))}
        </div>
        <div style={styles.contactRow}><Mail size={14} color={C.muted} /><span style={{ fontSize: 12, color: C.muted }}>support@founderos.app</span></div>
      </Section>

      <Section title="ABOUT FOUNDEROS">
        <p style={{ ...styles.missionText, marginBottom: 10 }}>
          <Info size={13} style={{ verticalAlign: -2, marginRight: 4 }} color={C.accent} />
          FounderOS is an AI Decision Intelligence Platform — it helps you predict the plausible consequences of a business decision before you make it, then measures how accurate those predictions actually were.
        </p>
        <button style={styles.linkRow} onClick={() => setScreen("terms")}>
          <ShieldAlert size={15} color={C.accent} />
          <span>Terms & Conditions, Disclaimer</span>
          <ChevronRight size={15} color={C.muted} style={{ marginLeft: "auto" }} />
        </button>
      </Section>
    </div>
  );
}