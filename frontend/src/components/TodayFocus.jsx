import React, { useEffect, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { Section } from "./common";
import { styles } from "../styles/styles";
import { C } from "../styles/theme";
import { todayStr } from "../constants";
import { loadJSON, saveJSON } from "../utils/storage";

// Turns "here's information" into "here's today's execution plan" — pulls
// from whatever the founder already has (today's mission, latest weekly
// priorities, latest health-check risk, weakest skill) rather than making
// a fresh AI call, so it's instant and works offline.
export function TodayFocus({ profile, missions }) {
  const [checks, setChecks] = useState({});
  const [items, setItems] = useState(null);

  useEffect(() => {
    (async () => {
      const key = "dailyFocus:" + todayStr();
      const saved = await loadJSON(key, {});
      setChecks(saved);

      const todayMission = missions.find((m) => m.date === todayStr());
      const reviews = await loadJSON("weeklyReviews", []);
      const lastReview = reviews[reviews.length - 1];
      const topPriority = lastReview?.report?.topPriorities?.[0];
      const healthHistory = await loadJSON("healthHistory", []);
      const lastHealth = healthHistory[healthHistory.length - 1];
      const topRisk = lastHealth?.topRisks?.[0];

      const skills = Object.entries(profile.skills || {});
      const weakest = skills.sort((a, b) => a[1].current - b[1].current)[0];

      setItems([
        { key: "mission", tag: "MISSION", label: todayMission ? todayMission.title : "Generate today's mission in the Mission tab" },
        { key: "topPriority", tag: "TOP PRIORITY", label: topPriority ? topPriority.title : "Run a Weekly Review to surface this" },
        { key: "risk", tag: "BIGGEST RISK", label: topRisk || "Run a Startup Health check to surface this" },
        { key: "customer", tag: "CUSTOMER TASK", label: "Talk to one real customer or prospect today" },
        { key: "sales", tag: "SALES TASK", label: "Follow up with one lead or ask one person to pay" },
        { key: "learning", tag: "LEARNING TASK", label: weakest ? `Spend 20 minutes improving: ${weakest[0]}` : "Pick one skill to sharpen today" },
      ]);
    })();
  }, [profile, missions]);

  async function toggle(key) {
    const updated = { ...checks, [key]: !checks[key] };
    setChecks(updated);
    await saveJSON("dailyFocus:" + todayStr(), updated);
  }

  if (!items) return null;
  const doneCount = items.filter((i) => checks[i.key]).length;

  return (
    <Section title={`TODAY'S FOCUS (${doneCount}/${items.length})`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item) => {
          const done = !!checks[item.key];
          return (
            <div key={item.key} style={{ ...styles.focusItem, ...(done ? styles.focusItemDone : {}) }} onClick={() => toggle(item.key)}>
              {done ? <CheckCircle2 size={16} color={C.accent2} /> : <Circle size={16} color={C.muted} />}
              <div style={{ flex: 1 }}>
                <div style={styles.focusItemTag}>{item.tag}</div>
                <div style={{ ...styles.focusItemLabel, textDecoration: done ? "line-through" : "none" }}>{item.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
