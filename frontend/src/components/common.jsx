import React, { useState } from "react";
import { Check, ThumbsUp, ThumbsDown, Edit2, X, Volume2, VolumeX, Languages, Loader2 } from "lucide-react";
import { api } from "../api/client";
import { styles } from "../styles/styles";
import { C } from "../styles/theme";

export const Section = React.memo(function Section({ title, children }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>{title}</div>
      {children}
    </div>
  );
});

export const Vital = React.memo(function Vital({ icon: Icon, label, value }) {
  return (
    <div style={styles.vitalCard}>
      <Icon size={15} color={C.accent} />
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, marginTop: 6 }}>{value}</div>
      <div style={{ fontSize: 10, color: C.muted, letterSpacing: 0.4 }}>{label}</div>
    </div>
  );
});

export function EditableLine({ tag = "p", style, value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");

  function startEdit() {
    setVal(value || "");
    setEditing(true);
  }

  function commit() {
    const clean = val.trim();
    if (clean) onSave(clean);
    setEditing(false);
  }

  if (editing) {
    return (
      <div style={styles.editRow}>
        <input
          autoFocus
          style={styles.editInput}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
        />
        <button style={styles.editIconBtn} onClick={commit}>
          <Check size={14} color={C.accent2} />
        </button>
        <button style={styles.editIconBtn} onClick={() => setEditing(false)}>
          <X size={14} color={C.muted} />
        </button>
      </div>
    );
  }

  const Tag = tag;
  return (
    <div style={styles.editRow}>
      <Tag style={style}>{value}</Tag>
      <button style={styles.editIconBtn} onClick={startEdit}>
        <Edit2 size={13} color={C.muted} />
      </button>
    </div>
  );
}

export function FeedbackWidget({ context, content, onFeedback, compact, meta }) {
  const [rated, setRated] = useState(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [translated, setTranslated] = useState(null); // null | { loading: true } | { text }
  const [translateError, setTranslateError] = useState(null);

  function rate(r) {
    setRated(r);
    if (r === "down") {
      setShowComment(true);
    } else {
      onFeedback({ context, content, rating: r, ...meta });
      setSent(true);
    }
  }

  function submitComment() {
    onFeedback({ context, content, rating: rated, comment, ...meta });
    setShowComment(false);
    setSent(true);
  }

  function toggleSpeak() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel(); // stop anything else already playing
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  async function toggleTranslate() {
    if (translated) {
      setTranslated(null); // toggle back to original
      return;
    }
    setTranslateError(null);
    setTranslated({ loading: true });
    try {
      const { translated: text } = await api.translate(content, "Hindi");
      setTranslated({ text });
    } catch (e) {
      setTranslateError(e.message || "Couldn't translate that.");
      setTranslated(null);
    }
  }

  const utilityRow = (
    <div style={{ ...styles.feedbackRow, opacity: 1 }}>
      {!sent && (
        <>
          {!compact && <span style={{ fontSize: 11, color: C.muted }}>Helpful?</span>}
          <button style={{ ...styles.feedbackBtn, color: rated === "up" ? C.accent2 : C.muted }} onClick={() => rate("up")}>
            <ThumbsUp size={13} />
          </button>
          <button style={{ ...styles.feedbackBtn, color: rated === "down" ? C.accent : C.muted }} onClick={() => rate("down")}>
            <ThumbsDown size={13} />
          </button>
        </>
      )}
      {sent && (
        <>
          <Check size={12} color={C.accent2} />
          <span style={{ fontSize: 11, color: C.muted }}>Thanks — noted</span>
        </>
      )}
      <button style={{ ...styles.feedbackBtn, color: speaking ? C.accent : C.muted }} onClick={toggleSpeak} aria-label="Read aloud">
        {speaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
      </button>
      <button
        style={{ ...styles.feedbackBtn, color: translated ? C.accent : C.muted, display: "inline-flex", alignItems: "center", gap: 3, width: "auto", padding: "2px 6px" }}
        onClick={toggleTranslate}
        disabled={translated?.loading}
      >
        {translated?.loading ? <Loader2 className="spin" size={12} /> : <Languages size={13} />}
        <span style={{ fontSize: 11 }}>{translated?.text ? "Original" : "Translate"}</span>
      </button>
    </div>
  );

  return (
    <div>
      {utilityRow}
      {showComment && (
        <div style={styles.commentBox}>
          <textarea
            autoFocus
            rows={3}
            style={styles.commentTextarea}
            placeholder="What was off about it? (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <button style={styles.commentSendBtn} onClick={submitComment}>Send feedback</button>
        </div>
      )}
      {translateError && <p style={{ fontSize: 11, color: "#d85050", marginTop: 4 }}>{translateError}</p>}
      {translated?.text && (
        <div style={{ marginTop: 6, padding: "8px 10px", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-line" }}>
          {translated.text}
        </div>
      )}
    </div>
  );
}
