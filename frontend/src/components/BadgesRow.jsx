import React, { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { Section } from "./common";
import { styles } from "../styles/styles";
import { C } from "../styles/theme";
import { BADGES } from "../constants";
import { loadJSON } from "../utils/storage";

export function BadgesRow({ profile }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      const metrics = await loadJSON("metrics", {});
      const decisions = await loadJSON("decisions", []);
      const reviews = await loadJSON("weeklyReviews", []);
      setData({
        missionsCompleted: profile.missionsCompleted || 0,
        streak: profile.streak || 0,
        hasMetrics: Object.values(metrics).some(Boolean),
        decisionsCount: decisions.length,
        reviewsCount: reviews.length,
      });
    })();
  }, [profile.missionsCompleted, profile.streak]);

  if (!data) return null;

  return (
    <Section title="ACHIEVEMENTS">
      <div style={styles.badgeRow}>
        {BADGES.map((b) => {
          const unlocked = b.test(data);
          const Icon = unlocked ? b.icon : Lock;
          return (
            <div key={b.key} style={{ ...styles.badgeChip, opacity: unlocked ? 1 : 0.45 }}>
              <Icon size={16} color={unlocked ? C.accent : C.muted} />
              <span style={{ fontSize: 9.5, color: unlocked ? C.text : C.muted, textAlign: "center" }}>{b.label}</span>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
