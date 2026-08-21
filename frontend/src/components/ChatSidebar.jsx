import React from "react";
import { Plus, X, MessageSquare, Trash2 } from "lucide-react";
import { C, F } from "../styles/theme";

function relativeDay(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ChatSidebar({ open, onClose, conversations, activeConversationId, onSelect, onNewChat, onDelete }) {
  const sorted = [...(conversations || [])].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 55,
          opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.2s ease",
        }}
      />
      <div
        style={{
          position: "fixed", top: 0, left: 0, bottom: 0, width: "min(300px, 84vw)",
          background: C.surface, borderRight: `1px solid ${C.border}`, zIndex: 60,
          display: "flex", flexDirection: "column",
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.22s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 14px 10px" }}>
          <span style={{ fontFamily: F.display, fontSize: 15 }}>Chats</span>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", padding: 4 }} aria-label="Close chat history">
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "0 12px 10px" }}>
          <button
            onClick={onNewChat}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 8, justifyContent: "center",
              background: C.accent, color: "#1A1400", border: "none", borderRadius: 10,
              padding: "9px 12px", fontSize: 13.5, fontWeight: 600, cursor: "pointer",
            }}
          >
            <Plus size={15} /> New chat
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 12px" }}>
          {sorted.length === 0 && (
            <div style={{ fontSize: 12.5, color: C.muted, padding: "10px 8px" }}>No chats yet.</div>
          )}
          {sorted.map((c) => {
            const active = c.id === activeConversationId;
            return (
              <div
                key={c.id}
                onClick={() => onSelect(c.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 10,
                  cursor: "pointer", marginBottom: 2,
                  background: active ? C.surface2 : "transparent",
                  border: active ? `1px solid ${C.border}` : "1px solid transparent",
                }}
              >
                <MessageSquare size={14} color={active ? C.accent : C.muted} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.title || "New Chat"}
                  </div>
                  <div style={{ fontSize: 10.5, color: C.muted, fontFamily: F.mono }}>{relativeDay(c.updatedAt || c.createdAt)}</div>
                </div>
                {onDelete && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                    style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", padding: 4, flexShrink: 0 }}
                    aria-label="Delete chat"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
