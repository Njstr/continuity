import React, { useState } from "react";
import {
  HelpCircle, Mail, ChevronRight, Check, ShieldAlert, History, Download,
  Bell, Info, Edit2,
} from "lucide-react";
import { Section, EditableLine } from "../components/common";
import { styles } from "../styles/styles";
import { C, F } from "../styles/theme";
import { FAQS, INDUSTRIES, BUSINESS_MODELS, STARTUP_STAGES, COUNTRIES, CURRENCIES } from "../constants";

// More — the secondary-functionality hub: Company Profile, Decision
// History, Export Reports, Settings, Help & Support, Feedback, About.
// Metrics management lives in its own top-level tab (see MetricsHome).
export function More({ setScreen, onFeedback, companyProfile, setCompanyProfile, decisions }) {
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

  function exportReports() {
    const rows = [["Decision", "Date", "Status", "Feedback Rating"]];
    decisions.forEach((d) => {
      rows.push([d.decisionText, d.date, d.status, d.feedbackRating || ""]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `founderos-decisions-${companyProfile.companyName || "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={styles.screenPad}>
      <Section title="COMPANY PROFILE">
        {!editingProfile ? (
          <>
            <p style={styles.missionText}>{companyProfile.companyName} · {companyProfile.industry}</p>
            <p style={{ ...styles.missionText, color: C.muted }}>{companyProfile.stage} · {companyProfile.businessModel} · {companyProfile.teamSize} people · {companyProfile.country} ({companyProfile.currency})</p>
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

      <Section title="DECISION HISTORY">
        <button style={styles.linkRow} onClick={() => setScreen("history")}>
          <History size={15} color={C.accent} />
          <span>View all decisions ({decisions.length})</span>
          <ChevronRight size={15} color={C.muted} style={{ marginLeft: "auto" }} />
        </button>
      </Section>

      <Section title="EXPORT REPORTS">
        <button style={{ ...styles.ghostBtn, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={exportReports} disabled={decisions.length === 0}>
          <Download size={13} /> Export decisions as CSV
        </button>
      </Section>

      <Section title="NOTIFICATIONS">
        <p style={{ fontSize: 12.5, color: C.muted }}>
          <Bell size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
          Follow-up reminders are coming soon — for now, check Decision History for anything awaiting a follow-up report.
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