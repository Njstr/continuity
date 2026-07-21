import React, { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { FeedbackWidget } from "../components/common";
import { styles } from "../styles/styles";
import { api } from "../api/client";

// A lightweight heuristic — not an AI call — to catch "I'm planning to do
// X" style messages so we can silently run the Decision Simulator and fold
// the result into a normal-sounding chat reply, instead of making the
// founder open a separate simulator screen.
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

export function Chat({ profile, metrics, chatlog, setChatlog, onFeedback }) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatlog, sending]);

  useEffect(() => {
    if (chatlog.length === 0 && profile?.welcomeNote) {
      setChatlog([{ role: "assistant", content: profile.welcomeNote, ts: Date.now() }]);
    }
    // eslint-disable-next-line
  }, []);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    const userMsg = { role: "user", content: text, ts: Date.now() };
    const next = [...chatlog, userMsg];
    setChatlog(next);
    setInput("");
    setSending(true);

    try {
      if (profile && looksLikePlanningStatement(text)) {
        // Run the decision simulator silently — the founder never sees a
        // separate "simulator" mode, just a mentor who thinks it through.
        const result = await api.simulateDecision(profile, metrics, text, []);
        const reply = composeSimulationReply(text, result);
        setChatlog([...next, { role: "assistant", content: reply, ts: Date.now(), simulated: true, prompt: text, simulationResult: result }]);
      } else {
        const history = next.slice(-10).map((m) => ({ role: m.role, content: m.content }));
        const feedback = await getStoredFeedback();
        const { reply } = await api.chat(profile, [], feedback, history, undefined, undefined, metrics);
        setChatlog([...next, { role: "assistant", content: reply, ts: Date.now(), prompt: text }]);
      }
    } catch (e) {
      setChatlog([...next, { role: "assistant", content: e.message || "Couldn't reach the server just now — try again in a moment.", ts: Date.now() }]);
    }
    setSending(false);
  }

  return (
    <div style={styles.chatWrap}>
      <div style={styles.chatScroll}>
        {chatlog.map((m, idx) => (
          <div key={idx} style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{ ...(m.role === "user" ? styles.bubbleUser : styles.bubbleAssistant), whiteSpace: "pre-line" }}>{m.content}</div>
            </div>
            {m.role === "assistant" && (
              <FeedbackWidget
                context={m.simulated ? "decision_simulation" : "chat"}
                content={m.content}
                onFeedback={onFeedback}
                compact
                meta={{ prompt: m.prompt, simulated: !!m.simulated, simulationResult: m.simulationResult, metricsSnapshot: metrics }}
              />
            )}
          </div>
        ))}
        {sending && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={styles.bubbleAssistant}>
              <Loader2 className="spin" size={14} />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div style={styles.chatInputRow}>
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
    </div>
  );
}

async function getStoredFeedback() {
  try {
    const raw = localStorage.getItem("fc:feedback");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
