import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send, Plus, FileText, X, AlertCircle } from "lucide-react";
import { FeedbackWidget } from "../components/common";
import { styles } from "../styles/styles";
import { C, F } from "../styles/theme";
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

// Turns the raw Decision Simulator JSON into a natural-language reply.
// Deliberately never prints a raw confidence percentage, error rate, or
// model score — those stay internal. Confidence is only ever expressed as
// a sentence, per the FounderOS V2 spec.
function composeSimulationReply(decisionText, result) {
  const lines = [];
  lines.push(result.expectedCase || "Here's my read on that.");

  const effects = (result.predictions || []).slice(0, 4).map((p) => {
    const dir =
      p.direction === "increase" ? "go up" : p.direction === "decrease" ? "go down" : p.direction === "flat" ? "stay roughly flat" : "move, though it's hard to say which way";
    let range = "";
    if (p.predictedLow !== null && p.predictedLow !== undefined && p.predictedHigh !== null && p.predictedHigh !== undefined) {
      range = ` — likely somewhere between ${p.predictedLow} and ${p.predictedHigh}`;
    }
    return `• ${p.metric} would probably ${dir}${range}. ${p.reasoning || ""}`.trim();
  });
  if (effects.length) {
    lines.push("\nLikely effects:\n" + effects.join("\n"));
  }

  if (result.bestCase) lines.push(`\nBest case: ${result.bestCase}`);
  if (result.worstCase) lines.push(`Worst case: ${result.worstCase}`);
  if (result.mainRisks?.length) lines.push(`\nMain risks: ${result.mainRisks.join("; ")}.`);
  if (result.keyAssumptions?.length) lines.push(`This assumes: ${result.keyAssumptions.join("; ")}.`);

  const confidencePhrase =
    result.overallConfidence === "high"
      ? "I'm fairly confident in this read given what I know about your numbers."
      : result.overallConfidence === "medium"
      ? "Take this as a reasonable but not certain read — there's real uncertainty here."
      : "Treat this as a rough directional read — there's a lot I don't know yet, so hold it loosely.";
  lines.push(`\n${confidencePhrase}`);

  return lines.join("\n");
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

function DocChip({ att, onRemove, onConsent }) {
  const uploading = att.status === "uploading";
  const errored = att.status === "error";
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
    </div>
  );
}

export function Chat({ profile, metrics, conversation, onUpdateMessages, onTitleGenerated, onFeedback }) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const endRef = useRef(null);
  const fileInputRef = useRef(null);
  const messages = conversation?.messages || [];
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
    } catch (e) {
      setAttachments((prev) => prev.map((a) => (pendingIds.includes(a.id) ? { ...a, status: "error", error: e.message || "Upload failed." } : a)));
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
      if (profile && looksLikeComparisonQuestion(text)) {
        // "Should I do X or Y" — a real side-by-side recommendation,
        // distinct from projecting a single decision's effects.
        const result = await api.compareGrowthOptions(profile, metrics, text, []);
        const reply = composeComparisonReply(result);
        final = [...next, { role: "assistant", content: reply, ts: Date.now(), compared: true, prompt: text, comparisonResult: result }];
      } else if (profile && looksLikePlanningStatement(text)) {
        // Run the decision simulator silently — the founder never sees a
        // separate "simulator" mode, just a mentor who thinks it through.
        const result = await api.simulateDecision(profile, metrics, text, []);
        const reply = composeSimulationReply(text, result);
        final = [...next, { role: "assistant", content: reply, ts: Date.now(), simulated: true, prompt: text, simulationResult: result }];
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
                <div style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", gap: 4 }}>
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
                  <div style={{ ...(m.role === "user" ? styles.bubbleUser : styles.bubbleAssistant), whiteSpace: "pre-line" }}>{m.content}</div>
                </div>
              </div>
              {m.role === "assistant" && (
                <FeedbackWidget
                  context={m.compared ? "growth_comparison" : m.simulated ? "decision_simulation" : "chat"}
                  content={m.content}
                  onFeedback={onFeedback}
                  compact
                  meta={{
                    prompt: m.prompt,
                    simulated: !!m.simulated,
                    simulationResult: m.simulationResult || m.comparisonResult,
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
            <DocChip key={att.id} att={att} onRemove={removeAttachment} onConsent={setConsent} />
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
    </div>
  );
}
