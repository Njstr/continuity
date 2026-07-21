import React, { useMemo, useState } from "react";
import { Search, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, MessageCircle, Zap, Inbox } from "lucide-react";
import { styles } from "../styles/styles";
import { C, F } from "../styles/theme";

const CONTEXT_META = {
  chat: { label: "Chat", icon: MessageCircle },
  decision_simulation: { label: "Decision Simulation", icon: Zap },
  general: { label: "General", icon: Inbox },
};

function fmtDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function FeedbackCenter({ feedback, setScreen }) {
  const [query, setQuery] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all"); // all | up | down
  const [contextFilter, setContextFilter] = useState("all"); // all | chat | decision_simulation | general
  const [openId, setOpenId] = useState(null);

  const sorted = useMemo(() => [...(feedback || [])].sort((a, b) => (b.ts || 0) - (a.ts || 0)), [feedback]);

  const filtered = sorted.filter((f) => {
    if (ratingFilter !== "all" && f.rating !== ratingFilter) return false;
    if (contextFilter !== "all" && (f.context || "general") !== contextFilter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const haystack = [f.prompt, f.content, f.comment].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const FilterChip = ({ active, onClick, children }) => (
    <button
      onClick={onClick}
      style={{
        background: active ? C.accent : "transparent",
        color: active ? "#1A1400" : C.muted,
        border: `1px solid ${active ? C.accent : C.border}`,
        borderRadius: 20,
        padding: "5px 11px",
        fontSize: 11.5,
        fontFamily: F.mono,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );

  return (
    <div style={styles.screenPad}>
      <div style={{ fontFamily: F.mono, fontSize: 11, color: C.muted, letterSpacing: 1 }}>FEEDBACK CENTER</div>
      <h2 style={styles.h2}>Feedback History</h2>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
        Every rating and comment you've given the AI, in one searchable place. This is also what quietly improves future advice.
      </p>

      <div style={{ position: "relative", marginBottom: 10 }}>
        <Search size={14} color={C.muted} style={{ position: "absolute", left: 12, top: 12 }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search prompts, replies, comments…"
          style={{ ...styles.selectInput, paddingLeft: 34 }}
        />
      </div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 8, paddingBottom: 2 }}>
        <FilterChip active={ratingFilter === "all"} onClick={() => setRatingFilter("all")}>All ratings</FilterChip>
        <FilterChip active={ratingFilter === "up"} onClick={() => setRatingFilter("up")}>👍 Helpful</FilterChip>
        <FilterChip active={ratingFilter === "down"} onClick={() => setRatingFilter("down")}>👎 Not helpful</FilterChip>
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 16, paddingBottom: 2 }}>
        <FilterChip active={contextFilter === "all"} onClick={() => setContextFilter("all")}>All types</FilterChip>
        <FilterChip active={contextFilter === "chat"} onClick={() => setContextFilter("chat")}>Chat</FilterChip>
        <FilterChip active={contextFilter === "decision_simulation"} onClick={() => setContextFilter("decision_simulation")}>Decision Simulation</FilterChip>
        <FilterChip active={contextFilter === "general"} onClick={() => setContextFilter("general")}>General</FilterChip>
      </div>

      {filtered.length === 0 && (
        <p style={styles.emptyStateText}>
          {sorted.length === 0 ? "No feedback yet — rate a chat reply with 👍/👎 and it'll show up here." : "Nothing matches that search/filter."}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((f, idx) => {
          const meta = CONTEXT_META[f.context] || CONTEXT_META.general;
          const Icon = meta.icon;
          const id = f.ts || idx;
          const open = openId === id;
          return (
            <div key={id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, cursor: "pointer" }} onClick={() => setOpenId(open ? null : id)}>
                <Icon size={13} color={C.accent} />
                <span style={{ fontSize: 10.5, color: C.muted, fontFamily: F.mono, letterSpacing: 0.4 }}>{meta.label.toUpperCase()}</span>
                <span style={{ fontSize: 10.5, color: C.muted, fontFamily: F.mono, marginLeft: "auto" }}>{fmtDate(f.ts)}</span>
                {f.rating === "up" && <ThumbsUp size={13} color={C.accent2} />}
                {f.rating === "down" && <ThumbsDown size={13} color={C.accent} />}
                {open ? <ChevronUp size={14} color={C.muted} /> : <ChevronDown size={14} color={C.muted} />}
              </div>

              {f.prompt && (
                <div style={{ fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: C.muted }}>You: </span>
                  {f.prompt}
                </div>
              )}

              {!open ? (
                <div style={{ fontSize: 12.5, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.content}
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-line", background: C.surface2, borderRadius: 8, padding: "8px 10px", marginBottom: f.comment ? 8 : 0 }}>
                    {f.content}
                  </div>
                  {f.comment && (
                    <div style={{ fontSize: 12.5, color: C.accent }}>
                      <span style={{ color: C.muted }}>Your note: </span>
                      {f.comment}
                    </div>
                  )}
                  {f.simulated && f.simulationResult && (
                    <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>
                      Simulation captured — {f.simulationResult.predictions?.length || 0} metric{(f.simulationResult.predictions?.length || 0) === 1 ? "" : "s"} projected at the time.
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
