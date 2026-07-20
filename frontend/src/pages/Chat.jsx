import React, { useEffect, useRef, useState } from "react";
import { Loader2, Send, Target, ChevronRight } from "lucide-react";
import { FeedbackWidget } from "../components/common";
import { styles } from "../styles/styles";
import { C } from "../styles/theme";
import { todayStr } from "../constants";
import { api } from "../api/client";

export function Chat({ profile, missions, chatlog, setChatlog, onFeedback, setScreen }) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const todayMission = missions.find((m) => m.date === todayStr());

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatlog, sending]);

  useEffect(() => {
    if (chatlog.length === 0 && profile.welcomeNote) {
      setChatlog([{ role: "assistant", content: profile.welcomeNote, ts: Date.now() }]);
    }
    // eslint-disable-next-line
  }, []);

  async function send() {
    if (!input.trim() || sending) return;
    const userMsg = { role: "user", content: input.trim(), ts: Date.now() };
    const next = [...chatlog, userMsg];
    setChatlog(next);
    setInput("");
    setSending(true);
    try {
      const history = next.slice(-10).map((m) => ({ role: m.role, content: m.content }));
      const feedback = await getStoredFeedback();
      const { reply } = await api.chat(profile, missions, feedback, history);
      setChatlog([...next, { role: "assistant", content: reply, ts: Date.now() }]);
    } catch (e) {
      setChatlog([...next, { role: "assistant", content: e.message || "Couldn't reach the server just now — try again in a moment.", ts: Date.now() }]);
    }
    setSending(false);
  }

  return (
    <div style={styles.chatWrap}>
      <div style={styles.missionBanner} onClick={() => setScreen && setScreen("mission")}>
        <Target size={13} color={C.accent} />
        <span style={{ fontSize: 11.5, flex: 1 }}>
          {todayMission ? `Today: ${todayMission.title}${todayMission.status === "done" ? " ✓" : ""}` : "No mission generated yet today"}
        </span>
        <ChevronRight size={13} color={C.muted} />
      </div>
      <div style={styles.chatScroll}>
        {chatlog.map((m, idx) => (
          <div key={idx} style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={m.role === "user" ? styles.bubbleUser : styles.bubbleAssistant}>{m.content}</div>
            </div>
            {m.role === "assistant" && <FeedbackWidget context="chat" content={m.content} onFeedback={onFeedback} compact />}
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
        <input style={styles.chatInput} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask your mentor anything…" onKeyDown={(e) => e.key === "Enter" && send()} />
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
