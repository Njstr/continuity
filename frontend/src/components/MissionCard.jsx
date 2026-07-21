import React from "react";
import { Clock, ChevronRight } from "lucide-react";
import { styles } from "../styles/styles";
import { C } from "../styles/theme";
import { DIFFICULTY_COLOR } from "../constants";

export function MissionCard({ mission, onStart }) {
  const diffColor = DIFFICULTY_COLOR[mission.difficulty] || C.muted;
  return (
    <div style={styles.missionCard}>
      <div style={styles.missionCardTop}>
        <div style={styles.missionCardTitle}>{mission.title}</div>
      </div>
      {(mission.description || mission.impact) && (
        <p style={styles.missionCardDesc}>{mission.description || mission.impact}</p>
      )}
      <div style={styles.missionCardMetaRow}>
        <span style={{ ...styles.difficultyChip, borderColor: diffColor, color: diffColor }}>
          {mission.difficulty || "Medium"}
        </span>
        <span style={styles.xpChip}>+{mission.xp || 30} XP</span>
        <span style={styles.metaChip}>
          <Clock size={10} style={{ marginRight: 3, verticalAlign: -1 }} />
          ~{mission.minutes || 20} min
        </span>
      </div>
      <button style={{ ...styles.primaryBtn, width: "100%" }} onClick={() => onStart(mission)}>
        {mission.status === "in_progress" ? "Resume" : "Start Now"} <ChevronRight size={15} />
      </button>
    </div>
  );
}
