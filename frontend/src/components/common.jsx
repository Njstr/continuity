import React, { useState } from "react";
import { Check, ThumbsUp, ThumbsDown, Edit2, X } from "lucide-react";
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

  if (sent) {
    return (
      <div style={{ ...styles.feedbackRow, opacity: 0.6 }}>
        <Check size={12} color={C.accent2} />
        <span style={{ fontSize: 11, color: C.muted }}>Thanks — noted</span>
      </div>
    );
  }

  return (
    <div>
      <div style={styles.feedbackRow}>
        {!compact && <span style={{ fontSize: 11, color: C.muted }}>Helpful?</span>}
        <button style={{ ...styles.feedbackBtn, color: rated === "up" ? C.accent2 : C.muted }} onClick={() => rate("up")}>
          <ThumbsUp size={13} />
        </button>
        <button style={{ ...styles.feedbackBtn, color: rated === "down" ? C.accent : C.muted }} onClick={() => rate("down")}>
          <ThumbsDown size={13} />
        </button>
      </div>
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
    </div>
  );
}
