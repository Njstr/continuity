import React from "react";
import { Anchor, Home as HomeIcon, Zap, History as HistoryIcon, MoreHorizontal } from "lucide-react";
import { styles } from "../styles/styles";
import { C, F } from "../styles/theme";

export function Header({ companyProfile }) {
  return (
    <div style={styles.header}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Anchor size={16} color={C.accent} />
        <span style={styles.brand}>FounderOS</span>
      </div>
      <div style={styles.stageBadge}>{companyProfile.stage}</div>
    </div>
  );
}

const NAV_ITEMS = [
  { key: "dashboard", icon: HomeIcon, label: "Home" },
  { key: "simulator", icon: Zap, label: "Simulate" },
  { key: "history", icon: HistoryIcon, label: "History" },
  { key: "more", icon: MoreHorizontal, label: "More" },
];

const IMPLICIT_MORE_SCREENS = ["terms"];

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
