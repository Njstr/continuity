import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send, Plus, FileText, X, AlertCircle, BarChart3, Clock } from "lucide-react";
import { FeedbackWidget } from "../components/common";
import { MetricsExtractionReview } from "../components/MetricsExtractionReview";
import { DecisionCard } from "../components/DecisionCard";
import { styles } from "../styles/styles";
import { C, F } from "../styles/theme";
import { ALL_METRIC_FIELDS } from "../constants";
import { api } from "../api/client";

// A lightweight heuristic — not an AI call — to catch "I'm planning to do
// X" style messages so we can silently run the Decision Simulator and fold
// the result into a normal-sounding chat reply, instead of making the
// founder open a separate simulator screen.
// Distinct from a single-path planning statement: "should I do X or Y"
// style questions get a real side-by-side recommendation instead of a
// single decision projection. Checked BEFORE the planning patterns below,
// since "should I ... or ..." would otherwise also match those.
const COMPARISON_PATTERNS = [
  /\bshould i\b[\s\S]*\bor\b/i,
  /\bwhich (one )?(is better|should i)\b/i,
  /\b\w+\s+vs\.?\s+\w+/i,
];

// Product validation — checked FIRST, before comparison/planning
// detection, since it's a deliberate, specific research action a founder
// asks for explicitly. False-negative risk (missing a validation ask) is
// worse here than a false positive, so this list is intentionally broad.
const VALIDATION_PATTERNS = [
  /\bvalidate (this|my|the)\b.*\b(idea|product|startup|concept)\b/i,
  /\b(is there|does).*(real )?demand\b/i,
  /\bdoes this (pain|problem) (point )?(really |actually )?exist\b/i,
  /\bwill people (actually |really )?pay for this\b/i,
  /\bdo people (actually |really )?want this\b/i,
  /\b(product|market) validation\b/i,
  /\bis this a real problem\b/i,
  /\bis anyone (actually |really )?struggling with\b/i,
  /\bcheck if (this|my idea) (is real|has demand|resonates)\b/i,
];

function looksLikeValidationRequest(text) {
  return VALIDATION_PATTERNS.some((re) => re.test(text));
}

// GEO = Generative Engine Optimization — "how do I get AI assistants to
// find/recommend my startup." Checked separately from validation since
// the output shape (visibility check + publishable content) is different.
const GEO_PATTERNS = [
  /\bgeo\b/i,
  /\bgenerative engine optimi[sz]ation\b/i,
  /\brank(ing)? (higher |better )?on (chatgpt|claude|ai|google)\b/i,
  /\bget (found|recommended|discovered) by ai\b/i,
  /\boptimi[sz]e for ai search\b/i,
  /\bai visibility\b/i,
  /\bshow up (on|in) chatgpt\b/i,
  /\bget chatgpt to (recommend|mention|talk about)\b/i,
  /\bai seo\b/i,
];

function looksLikeGeoRequest(text) {
  return GEO_PATTERNS.some((re) => re.test(text));
}

function looksLikeComparisonQuestion(text) {
  return COMPARISON_PATTERNS.some((re) => re.test(text));
}

function composeComparisonReply(result) {
  const { optionA: a, optionB: b, recommendation, reasoning, conditionalGuidance, firstStep } = result;
  const lines = [];

  lines.push(`${a.label}: ${a.howItWorks || ""}`.trim());
  if (a.prosForThisFounder?.length) lines.push(`Pros: ${a.prosForThisFounder.join("; ")}`);
  if (a.consForThisFounder?.length) lines.push(`Cons: ${a.consForThisFounder.join("; ")}`);
  if (a.costProfile) lines.push(`Cost profile: ${a.costProfile}`);

  lines.push(`\n${b.label}: ${b.howItWorks || ""}`.trim());
  if (b.prosForThisFounder?.length) lines.push(`Pros: ${b.prosForThisFounder.join("; ")}`);
  if (b.consForThisFounder?.length) lines.push(`Cons: ${b.consForThisFounder.join("; ")}`);
  if (b.costProfile) lines.push(`Cost profile: ${b.costProfile}`);

  const recLabel =
    recommendation === "optionA" ? a.label : recommendation === "optionB" ? b.label : recommendation === "both" ? "a mix of both" : null;
  lines.push(`\nMy read: ${recLabel ? `go with ${recLabel}.` : "I don't have enough to confidently pick one yet."} ${reasoning || ""}`.trim());
  if (conditionalGuidance) lines.push(`\nWhat would change my mind: ${conditionalGuidance}`);
  if (firstStep) lines.push(`\nFirst step: ${firstStep}`);

  return lines.join("\n");
}

const PLANNING_PATTERNS = [
  /\b(i want to|i'm planning to|im planning to|i plan to|i'm thinking about|im thinking about|i'm thinking of|im thinking of|i'm considering|im considering|considering)\b/i,
  /\b(should i|what happens if|what if i|thinking of hiring|thinking of raising|thinking of launching)\b/i,
  /\b(i'm going to|im going to|i'll be|about to)\b.*(hire|launch|raise|price|pricing|spend|cut|expand|scale|fire|layoff)/i,
];

function looksLikePlanningStatement(text) {
  return PLANNING_PATTERNS.some((re) => re.test(text));
}

// Chat-stated metrics — "Revenue was ₹3.2 lakh this month" should be able
// to update Metrics too, not just document uploads. Broad on purpose:
// false positives just mean a wasted extraction call that finds nothing
// (silently ignored), while a missed real statement means the founder's
// numbers stay stale. Confirmation before writing (via the same
// MetricsExtractionReview modal document uploads use) is what actually
// keeps this safe, not the detector being conservative.
const METRIC_MENTION_KEYWORDS =
  /\b(revenue|mrr|arr|profit|expenses?|burn|cash|runway|customers?|users?|churn|retention|conversion|cac|ltv|nps|traffic|leads?|deals? closed|sales calls?|team size|engineers?|valuation|raised|equity|margin)\b/i;

function looksLikeMetricMention(text) {
  return /\d/.test(text) && METRIC_MENTION_KEYWORDS.test(text);
}

const GREETINGS = [
  (name) => `Hi ${name}, what are we solving today?`,
  (name) => `Hey ${name} — what's on your mind?`,
  (name) => `Morning, ${name}. What's the priority right now?`,
  (name) => `Hi ${name}! Tell me what's happening with the business.`,
  (name) => `Hey ${name}, what's the biggest thing you're wrestling with today?`,
];

function pickGreeting(profile) {
  const name = profile?.founderName?.trim() || "there";
  const template = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
  return template(name);
}

const ACCEPTED_EXTENSIONS = ".pdf,.docx,.txt,.md,.markdown";

function formatBytes(n) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}

function DocChip({ att, onRemove, onConsent, onReviewMetrics }) {
  const uploading = att.status === "uploading";
  const errored = att.status === "error";
  const metricsFound = att.detectedMetrics && Object.values(att.detectedMetrics).some((v) => v !== null && v !== undefined);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        background: errored ? "rgba(220,80,80,0.08)" : C.surface2,
        border: `1px solid ${errored ? "rgba(220,80,80,0.35)" : C.border}`,
        borderRadius: 10,
        padding: "7px 9px",
        minWidth: 150,
        maxWidth: 220,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {uploading ? (
          <Loader2 className="spin" size={13} color={C.muted} />
        ) : errored ? (
          <AlertCircle size={13} color="#d85050" />
        ) : (
          <FileText size={13} color={C.accent} />
        )}
        <span style={{ fontSize: 11.5, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
          {att.filename}
        </span>
        <button onClick={() => onRemove(att.id)} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", padding: 0, display: "flex" }}>
          <X size={12} />
        </button>
      </div>
      {uploading && <span style={{ fontSize: 10, color: C.muted, fontFamily: F.mono }}>Reading document…</span>}
      {errored && <span style={{ fontSize: 10, color: "#d85050" }}>{att.error}</span>}
      {att.status === "ready" && att.needsOcr && (
        <span style={{ fontSize: 10, color: "#c9a34e" }}>Looks like a scanned file — text may be incomplete.</span>
      )}
      {att.status === "ready" && att.askConsent && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
          <span style={{ fontSize: 10, color: C.muted }}>Remember for future chats?</span>
          <button onClick={() => onConsent(att.id, true)} style={{ fontSize: 10, color: C.accent, background: "transparent", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}>
            Yes
          </button>
          <button onClick={() => onConsent(att.id, false)} style={{ fontSize: 10, color: C.muted, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
            No
          </button>
        </div>
      )}
      {att.status === "ready" && !att.askConsent && (
        <span style={{ fontSize: 10, color: C.muted, fontFamily: F.mono }}>
          {att.persistent ? "Remembered" : "This chat only"}
        </span>
      )}
      {metricsFound && (
        <button
          onClick={() => onReviewMetrics(att)}
          style={{
            display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, color: C.accent, background: "transparent",
            border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 6px", cursor: "pointer", marginTop: 2, alignSelf: "flex-start",
          }}
        >
          <BarChart3 size={11} /> Metrics found — Review
        </button>
      )}
    </div>
  );
}

export function Chat({ profile, metrics, conversation, onUpdateMessages, onTitleGenerated, onFeedback, onApplyMetrics }) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [metricsReview, setMetricsReview] = useState(null); // { filename, values }
  const [pendingCheckIn, setPendingCheckIn] = useState(null); // { decisionId, decisionText }
  const endRef = useRef(null);
  const fileInputRef = useRef(null);
  const messages = conversation?.messages || [];
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const conversationId = conversation?.id;
  const greeting = useMemo(() => pickGreeting(profile), [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // Attachments are scoped to the conversation they were dropped into —
  // switching chats clears whatever was pending (still processed/stored
  // server-side, just no longer queued to attach to a message here).
  useEffect(() => {
    setAttachments([]);
    setPendingCheckIn(null);
  }, [conversationId]);

  // Decision check-ins happen naturally inside chat, not on a separate
  // page — when a fresh conversation opens and a past decision is due for
  // review, FounderOS asks about it directly instead of the plain
  // greeting. The founder's next reply is treated as the outcome report.
  useEffect(() => {
    if (!conversationId || messages.length > 0) return;
    let cancelled = false;
    api
      .getDueForCheckIn()
      .then(({ due }) => {
        if (cancelled || !due?.length) return;
        const { decision, prediction } = due[0];
        const content = `Before we get into anything else — a while back you decided: "${decision.finalDecisionText || decision.decisionText}"\n\nExpected: ${prediction.expectedCase}\n\nWhat actually happened?`;
        setPendingCheckIn({ decisionId: decision.id, decisionText: decision.finalDecisionText || decision.decisionText });
        onUpdateMessages(conversationId, [{ role: "assistant", content, ts: Date.now(), isCheckInPrompt: true }]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  async function maybeGenerateTitle(finalMessages) {
    if (conversation?.title || !conversationId) return;
    const realMessages = finalMessages.filter((m) => m.role === "user" || m.role === "assistant");
    if (realMessages.length < 2) return;
    try {
      const { title } = await api.generateChatTitle(realMessages);
      if (title) onTitleGenerated(conversationId, title);
    } catch {
      // non-critical — chat stays labeled "New Chat" until it's tried again next message
    }
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length || !conversationId) return;
    const pendingIds = files.map((_, i) => `pending_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`);
    setAttachments((prev) => [...prev, ...files.map((f, i) => ({ id: pendingIds[i], filename: f.name, status: "uploading" }))]);

    try {
      const { documents } = await api.uploadDocuments(files, conversationId);
      setAttachments((prev) => {
        const withoutPending = prev.filter((a) => !pendingIds.includes(a.id));
        const resolved = documents.map((d, i) =>
          d.error
            ? { id: pendingIds[i], filename: d.filename, status: "error", error: d.error }
            : { id: d.id, filename: d.filename, charCount: d.charCount, needsOcr: d.needsOcr, status: "ready", askConsent: true, persistent: null }
        );
        return [...withoutPending, ...resolved];
      });
      // Quietly check whether this document contains metric-shaped values
      // worth surfacing — never applied automatically, just detected.
      documents.filter((d) => !d.error).forEach((d) => checkForMetrics(d.id));
    } catch (e) {
      setAttachments((prev) => prev.map((a) => (pendingIds.includes(a.id) ? { ...a, status: "error", error: e.message || "Upload failed." } : a)));
    }
  }

  async function checkForMetrics(docId) {
    try {
      const metricFields = ALL_METRIC_FIELDS.map((f) => ({ key: f.key, label: f.label, unit: f.unit }));
      const { values } = await api.extractDocumentMetrics(docId, metricFields);
      const hasAny = values && Object.values(values).some((v) => v !== null && v !== undefined);
      if (hasAny) {
        setAttachments((prev) => prev.map((a) => (a.id === docId ? { ...a, detectedMetrics: values } : a)));
      }
    } catch {
      // non-critical — founder can still ask the AI about the doc's numbers directly in chat
    }
  }

  function removeAttachment(id) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function setConsent(id, persistent) {
    setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, persistent, askConsent: false } : a)));
    try {
      await api.setDocumentPersistent(id, persistent);
    } catch {
      // non-critical — worst case it stays conversation-scoped until retried
    }
  }

  async function handleDecisionAct(msgIndex, status, finalDecisionText) {
    const msg = messagesRef.current[msgIndex];
    if (!msg?.decisionText) return;
    try {
      await api.recordDecision({
        decisionText: msg.decisionText,
        finalDecisionText,
        status,
        simulation: msg.decisionSimulation,
        companySnapshot: metrics,
      });
    } catch {
      // If this fails the founder can just tell the AI directly — the
      // card stays actionable (recordedStatus isn't set) so they can retry.
      return;
    }
    onUpdateMessages(
      conversationId,
      messagesRef.current.map((m, i) => (i === msgIndex ? { ...m, recordedStatus: status } : m))
    );
  }

  async function send() {
    const text = input.trim();
    const readyDocs = attachments.filter((a) => a.status === "ready");
    if ((!text && readyDocs.length === 0) || sending || !conversationId) return;

    const docNames = readyDocs.map((a) => a.filename);
    const docIds = readyDocs.map((a) => a.id);
    const userMsg = {
      role: "user",
      content: text || "Please review the attached document.",
      ts: Date.now(),
      documentNames: docNames.length ? docNames : undefined,
    };
    const next = [...messages, userMsg];
    onUpdateMessages(conversationId, next);
    setInput("");
    setAttachments([]);
    setSending(true);

    let final = next;
    try {
      if (pendingCheckIn) {
        // The founder is answering the check-in prompt — record the real
        // outcome against the immutable prediction, not a normal chat reply.
        const { outcome, newPattern } = await api.recordDecisionOutcome(pendingCheckIn.decisionId, text);
        const parts = [outcome.comparisonSummary];
        if (newPattern) parts.push(`\nNoted for next time: ${newPattern.patternText}`);
        final = [...next, { role: "assistant", content: parts.join("\n"), ts: Date.now(), prompt: text }];
        setPendingCheckIn(null);
      } else if (profile && looksLikeGeoRequest(text)) {
        // Real web-search-grounded AI-discoverability check — see
        // aiService.analyzeGeoReadiness. No fake "connect to ChatGPT"
        // step exists because no such mechanism exists.
        const history = next.slice(-4).map((m) => ({ role: m.role, content: m.content }));
        const { reply } = await api.geoReadinessCheck(profile, history);
        final = [...next, { role: "assistant", content: reply, ts: Date.now(), geoChecked: true, prompt: text }];
      } else if (profile && looksLikeValidationRequest(text)) {
        // Real web search against Reddit/Quora/HN/forums for genuine
        // evidence the pain point exists — see aiService.validateProductIdea.
        const history = next.slice(-6).map((m) => ({ role: m.role, content: m.content }));
        const { reply } = await api.validateIdea(profile, text, history);
        final = [...next, { role: "assistant", content: reply, ts: Date.now(), validated: true, prompt: text }];
      } else if (profile && looksLikeComparisonQuestion(text)) {
        // "Should I do X or Y" — a real side-by-side recommendation,
        // distinct from projecting a single decision's effects.
        const result = await api.compareGrowthOptions(profile, metrics, text, []);
        const reply = composeComparisonReply(result);
        final = [...next, { role: "assistant", content: reply, ts: Date.now(), compared: true, prompt: text, comparisonResult: result }];
      } else if (profile && looksLikePlanningStatement(text)) {
        // Run the real Decision Simulator (same engine backing the
        // decision-lifecycle tables) and render it as a structured card,
        // not a wall of text — the founder never leaves this chat to do
        // it. See DecisionCard for the Proceed/Modify/Not-now actions.
        const { simulation, appliedPatterns } = await api.simulateDecisionV2(profile, metrics, text);
        final = [
          ...next,
          {
            role: "assistant",
            content: "",
            ts: Date.now(),
            decisionText: text,
            decisionSimulation: simulation,
            appliedPatterns,
            prompt: text,
          },
        ];
      } else {
        const history = next.slice(-10).map((m) => ({ role: m.role, content: m.content }));
        const { reply } = await api.chat(profile, [], history, undefined, undefined, metrics, docIds);
        final = [...next, { role: "assistant", content: reply, ts: Date.now(), prompt: text }];
      }
    } catch (e) {
      final = [...next, { role: "assistant", content: e.message || "Couldn't reach the server just now — try again in a moment.", ts: Date.now() }];
    }
    onUpdateMessages(conversationId, final);
    setSending(false);
    maybeGenerateTitle(final);

    // "We reached ₹4 lakh MRR" — check in the background whether this
    // message stated real metric values worth offering to save. Never
    // applied automatically; same confirm-before-write review modal
    // document uploads use.
    if (looksLikeMetricMention(text)) {
      const userMsgIndex = next.length - 1;
      checkForMetricsInMessage(text, userMsgIndex);
    }
  }

  async function checkForMetricsInMessage(text, userMsgIndex) {
    try {
      const metricFields = ALL_METRIC_FIELDS.map((f) => ({ key: f.key, label: f.label, unit: f.unit }));
      const { values } = await api.extractMetricsFromText(text, metricFields);
      const hasAny = values && Object.values(values).some((v) => v !== null && v !== undefined);
      if (!hasAny) return;
      const current = messagesRef.current;
      if (!current[userMsgIndex] || current[userMsgIndex].role !== "user") return;
      onUpdateMessages(
        conversationId,
        current.map((m, i) => (i === userMsgIndex ? { ...m, detectedMetricsFromText: values } : m))
      );
    } catch {
      // non-critical — founder can still just tell the AI to update Metrics directly
    }
  }

  return (
    <div
      style={{ ...styles.chatWrap, position: "relative" }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      {dragOver && (
        <div
          style={{
            position: "absolute", inset: 0, zIndex: 30, background: "rgba(0,0,0,0.55)",
            border: `2px dashed ${C.accent}`, borderRadius: 12, margin: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: F.mono, fontSize: 13, color: C.accent, pointerEvents: "none",
          }}
        >
          Drop to upload
        </div>
      )}
      <div style={styles.chatScroll}>
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 28px" }}>
            <div
              style={{
                fontFamily: F.display,
                fontWeight: 400,
                fontSize: 26,
                lineHeight: 1.35,
                textAlign: "center",
                color: C.text,
                letterSpacing: 0.2,
              }}
            >
              {greeting}
            </div>
          </div>
        ) : (
          messages.map((m, idx) => (
            <div key={idx} style={{ width: "100%" }}>
              <div style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", gap: 4, maxWidth: m.decisionSimulation ? "100%" : undefined }}>
                  {m.documentNames?.length > 0 && (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {m.documentNames.map((name, i) => (
                        <span
                          key={i}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, color: C.muted,
                            background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "3px 7px",
                          }}
                        >
                          <FileText size={10} /> {name}
                        </span>
                      ))}
                    </div>
                  )}
                  {m.decisionSimulation ? (
                    <DecisionCard
                      decisionText={m.decisionText}
                      simulation={m.decisionSimulation}
                      recordedStatus={m.recordedStatus}
                      onAct={(status, finalText) => handleDecisionAct(idx, status, finalText)}
                    />
                  ) : (
                    <div style={{ ...(m.role === "user" ? styles.bubbleUser : styles.bubbleAssistant), whiteSpace: "pre-line" }}>{m.content}</div>
                  )}
                  {m.role === "user" && m.detectedMetricsFromText && (
                    <button
                      onClick={() => setMetricsReview({ filename: "this message", values: m.detectedMetricsFromText })}
                      style={{
                        display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, color: C.accent, background: "transparent",
                        border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 6px", cursor: "pointer",
                      }}
                    >
                      <BarChart3 size={11} /> Metrics found — Review
                    </button>
                  )}
                </div>
              </div>
              {m.role === "assistant" && !m.decisionSimulation && (
                <FeedbackWidget
                  context={
                    m.geoChecked ? "geo_readiness" : m.validated ? "product_validation" : m.compared ? "growth_comparison" : "chat"
                  }
                  content={m.content}
                  onFeedback={onFeedback}
                  compact
                  meta={{
                    prompt: m.prompt,
                    simulated: !!m.simulated,
                    simulationResult: m.comparisonResult,
                    metricsSnapshot: metrics,
                  }}
                />
              )}
            </div>
          ))
        )}
        {sending && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={styles.bubbleAssistant}>
              <Loader2 className="spin" size={14} />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {attachments.length > 0 && (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 14px 8px" }}>
          {attachments.map((att) => (
            <DocChip key={att.id} att={att} onRemove={removeAttachment} onConsent={setConsent} onReviewMetrics={(a) => setMetricsReview({ filename: a.filename, values: a.detectedMetrics })} />
          ))}
        </div>
      )}

      <div style={styles.chatInputRow}>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach document"
          style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", padding: "0 4px", display: "flex", alignItems: "center" }}
        >
          <Plus size={19} />
        </button>
        <input
          style={styles.chatInput}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything, or tell me what's happening…"
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button style={styles.sendBtn} onClick={send} disabled={sending}>
          <Send size={16} />
        </button>
      </div>
      <div style={{ fontSize: 10.5, color: C.muted, textAlign: "center", padding: "0 16px 10px", fontFamily: F.mono }}>
        FounderOS is AI and can make mistakes. Please double check responses.
      </div>
      {metricsReview && (
        <MetricsExtractionReview
          filename={metricsReview.filename}
          values={metricsReview.values}
          onCancel={() => setMetricsReview(null)}
          onApply={(toApply) => {
            onApplyMetrics?.(toApply);
            setMetricsReview(null);
          }}
        />
      )}
    </div>
  );
}
