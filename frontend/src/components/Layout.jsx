import React from "react";
import { Anchor, LayoutGrid, Target, Scale, MessageCircle, MoreHorizontal } from "lucide-react";
import { styles } from "../styles/styles";
import { C, F } from "../styles/theme";

export function Header({ profile }) {
  return (
    <div style={styles.header}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Anchor size={16} color={C.accent} />
        <span style={styles.brand}>Founder Companion</span>
      </div>
      <div style={styles.stageBadge}>{profile.stage}</div>
    </div>
  );
}

const NAV_ITEMS = [
  { key: "dashboard", icon: LayoutGrid, label: "Log" },
  { key: "mission", icon: Target, label: "Mission" },
  { key: "decide", icon: Scale, label: "Decide" },
  { key: "chat", icon: MessageCircle, label: "Mentor" },
  { key: "more", icon: MoreHorizontal, label: "More" },
];

export function NavBar({ screen, setScreen }) {
  return (
    <div style={styles.nav}>
      {NAV_ITEMS.map((it) => {
        const active = screen === it.key || (it.key === "more" && ["terms", "weekly", "timeline"].includes(screen));
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
