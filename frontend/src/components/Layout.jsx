import React from "react";
import { Anchor, MessageCircle, BarChart3, MoreHorizontal, PanelLeft } from "lucide-react";
import { styles } from "../styles/styles";
import { C, F } from "../styles/theme";

export function Header({ companyProfile, onToggleSidebar }) {
  return (
    <div style={styles.header}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            aria-label="Toggle chat history"
            style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", padding: 4, display: "flex" }}
          >
            <PanelLeft size={18} />
          </button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Anchor size={16} color={C.accent} />
          <span style={styles.brand}>FounderOS</span>
        </div>
      </div>
      <div style={styles.stageBadge}>{companyProfile.stage}</div>
    </div>
  );
}

const NAV_ITEMS = [
  { key: "chats", icon: MessageCircle, label: "Chats" },
  { key: "metrics", icon: BarChart3, label: "Metrics" },
  { key: "more", icon: MoreHorizontal, label: "More" },
];

const IMPLICIT_MORE_SCREENS = ["terms", "history", "learning", "feedback-center"];

export function NavBar({ screen, setScreen }) {
  return (
    <div style={styles.nav}>
      {NAV_ITEMS.map((it) => {
        const active = screen === it.key || (it.key === "more" && IMPLICIT_MORE_SCREENS.includes(screen));
        const Icon = it.icon;
        return (
          <button
            key={it.key}
            onClick={() => setScreen(it.key)}
            style={{ ...styles.navBtn, color: active ? C.accent : C.muted }}
          >
            <Icon size={19} strokeWidth={active ? 2.4 : 1.8} />
            <span style={{ fontSize: 10, fontFamily: F.mono, letterSpacing: 0.5 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
