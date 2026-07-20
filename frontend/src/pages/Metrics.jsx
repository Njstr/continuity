import React, { useEffect, useState } from "react";
import { Loader2, Sparkles, Edit2, Check, X } from "lucide-react";
import { Section } from "../components/common";
import { MetricCard } from "../components/MetricCard";
import { HealthPanel } from "../components/HealthPanel";
import { styles } from "../styles/styles";
import { C, F } from "../styles/theme";
import { todayStr } from "../constants";
import { computeMetrics, explainMetric, formatCurrency, formatPct, formatMonths } from "../utils/businessMetrics";
import { loadJSON, saveJSON } from "../utils/storage";
import { api } from "../api/client";
import { AIFounderAdvisor } from "../components/AIFounderAdvisor";

// Metrics — Part 3 of the Business Setup redesign. Every figure here is
// CALCULATED from `businessState` (see utils/businessMetrics.js), never
// typed in directly. The only manual input left is updating the small set
// of raw business inputs themselves (revenue, expenses, cash, etc.) —
// exactly the fields real integrations (Stripe, Analytics...) would feed
// automatically later without changing this page at all.
export function Metrics({ profile, missions, businessState, setBusinessState }) {
  const [history, setHistory] = useState([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(businessState);
  const [advice, setAdvice] = useState(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [adviceError, setAdviceError] = useState(null);

  useEffect(() => {
    (async () => setHistory(await loadJSON("businessHistory", [])))();
  }, []);

  const previous = history.length >= 2 ? history[history.length - 2] : null;
  const m = computeMetrics(businessState, previous);

  async function saveInputs() {
    const updated = {
      ...businessState,
      monthlyRevenue: Number(draft.monthlyRevenue) || 0,
      monthlyExpenses: Number(draft.monthlyExpenses) || 0,
      cash: Number(draft.cash) || 0,
      customers: Number(draft.customers) || 0,
      employees: Number(draft.employees) || 0,
      avgProductPrice: Number(draft.avgProductPrice) || 0,
      marketingSpend: Number(draft.marketingSpend) || 0,
      hostingCost: Number(draft.hostingCost) || 0,
      aiCost: Number(draft.aiCost) || 0,
    };
    setBusinessState(updated);
    const updatedHistory = [...history, { ...updated, date: todayStr() }].slice(-60);
    setHistory(updatedHistory);
    await saveJSON("businessHistory", updatedHistory);
    setEditing(false);
  }

  async function runAdvice() {
    setLoadingAdvice(true);
    setAdviceError(null);
    try {
      const result = await api.businessAdvice(profile, businessState, m);
      setAdvice(result.recommendations || []);
    } catch (e) {
      setAdviceError(e.message || "Couldn't reach the server.");
    }
    setLoadingAdvice(false);
  }

  const trend = (val, positiveIsGood = true) => {
    if (val === null || val === undefined) return { text: null, good: true };
    const good = positiveIsGood ? val >= 0 : val <= 0;
    return { text: `${val >= 0 ? "+" : ""}${Math.round(val)} vs last update`, good };
  };
  const revTrend = trend(m.revenueTrend);
  const custTrend = trend(m.customersTrend);

  return (
    <div style={styles.screenPad}>
      <div style={{ fontFamily: F.mono, fontSize: 11, color: C.muted, letterSpacing: 1 }}>BUSINESS INTELLIGENCE</div>
      <h2 style={styles.h2}>Metrics</h2>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
        Calculated automatically from your business data — nothing here is manually entered.
      </p>

      <div style={styles.metricsGridWide}>
        <MetricCard label="REVENUE" value={formatCurrency(m.revenue)} trend={revTrend.text} trendGood={revTrend.good} why={explainMetric("revenue", m, businessState)} />
        <MetricCard label="MRR" value={formatCurrency(m.mrr)} why={explainMetric("mrr", m, businessState)} />
        <MetricCard label="ARR" value={formatCurrency(m.arr)} why={explainMetric("arr", m, businessState)} />
        <MetricCard label="GROSS PROFIT" value={formatCurrency(m.grossProfit)} why={explainMetric("grossProfit", m, businessState)} />
        <MetricCard label="NET PROFIT" value={formatCurrency(m.netProfit)} why={explainMetric("netProfit", m, businessState)} />
        <MetricCard label="BURN RATE" value={formatCurrency(m.burnRate) + "/mo"} why={explainMetric("burnRate", m, businessState)} />
        <MetricCard label="RUNWAY" value={formatMonths(m.runwayMonths)} why={explainMetric("runway", m, businessState)} />
        <MetricCard label="CAC" value={formatCurrency(m.cac)} why={explainMetric("cac", m, businessState)} />
        <MetricCard label="LTV" value={formatCurrency(m.ltv)} why={explainMetric("ltv", m, businessState)} />
        <MetricCard label="CHURN" value={formatPct(m.churnRate)} why={explainMetric("churn", m, businessState)} />
        <MetricCard label="RETENTION" value={formatPct(m.retentionRate)} why={explainMetric("retention", m, businessState)} />
        <MetricCard label="CUSTOMERS" value={String(m.customers)} trend={custTrend.text} trendGood={custTrend.good} why="Total customers, as updated by your business inputs or completed missions." />
      </div>

      <Section title="CASH FLOW">
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 10.5, color: C.accent2, fontFamily: F.mono }}>MONEY IN</div>
            <div style={{ fontFamily: F.mono, fontSize: 18 }}>{formatCurrency(m.cashIn)}</div>
          </div>
          <div style={{ color: C.muted }}>vs</div>
          <div>
            <div style={{ fontSize: 10.5, color: C.accent, fontFamily: F.mono }}>MONEY OUT</div>
            <div style={{ fontFamily: F.mono, fontSize: 18 }}>{formatCurrency(m.cashOut)}</div>
          </div>
        </div>
        <p style={styles.metricWhyText}>{explainMetric("cashflow", m, businessState)}</p>
      </Section>

      <Section title="AI BUSINESS ADVISOR">
        {adviceError && <p style={{ fontSize: 12, color: C.accent, marginBottom: 8 }}>{adviceError}</p>}
        {advice && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
            {advice.map((a, idx) => (
              <div key={idx} style={{ ...styles.faqItem, cursor: "default" }}>
                <div style={styles.faqQ}>
                  <Sparkles size={13} color={C.accent} />
                  <span style={{ fontSize: 13 }}>{a}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        <button style={{ ...styles.ghostBtn, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={runAdvice} disabled={loadingAdvice}>
          {loadingAdvice ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
          {advice ? "Re-analyze" : "Analyze my business"}
        </button>
      </Section>

      <AIFounderAdvisor
        profile={profile}
        businessState={businessState}
        metrics={m}
        missions={missions}
        decisions={[]}
      />

      <HealthPanel profile={profile} missions={missions} />

      <Section title="BUSINESS INPUTS">
        {!editing ? (
          <button style={{ ...styles.ghostBtn, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => { setDraft(businessState); setEditing(true); }}>
            <Edit2 size={13} /> Update business data
          </button>
        ) : (
          <>
            {[
              ["monthlyRevenue", "Monthly revenue (₹)"],
              ["monthlyExpenses", "Monthly expenses (₹)"],
              ["cash", "Cash available (₹)"],
              ["customers", "Customers"],
              ["employees", "Team size"],
              ["avgProductPrice", "Avg product price (₹)"],
              ["marketingSpend", "Monthly marketing spend (₹)"],
              ["hostingCost", "Monthly hosting cost (₹)"],
              ["aiCost", "Monthly AI/tooling cost (₹)"],
            ].map(([key, label]) => (
              <div key={key} style={styles.fieldGroup}>
                <label style={styles.fieldLabel}>{label}</label>
                <input type="number" style={styles.selectInput} value={draft[key] ?? ""} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8 }}>
              <button style={styles.primaryBtn} onClick={saveInputs}><Check size={15} /> Save</button>
              <button style={styles.ghostBtn} onClick={() => setEditing(false)}><X size={15} /></button>
            </div>
          </>
        )}
        <p style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>
          Connect Stripe, Razorpay, or Google Analytics later (More → coming soon) to replace these manual numbers with live data automatically — every metric above recalculates the same way either way.
        </p>
      </Section>
    </div>
  );
}
