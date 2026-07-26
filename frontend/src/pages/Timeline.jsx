import React, { useEffect, useState } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { styles } from "../styles/styles";
import { C } from "../styles/theme";
import { api } from "../api/client";

const TYPE_LABELS = {
  onboarding_completed: "Onboarded",
  mission_completed: "Mission completed",
  mission_skipped: "Mission skipped",
  metrics_updated: "Metrics updated",
  health_check: "Health check",
  decision: "Decision logged",
  weekly_review: "Weekly review",
  badge_unlocked: "Badge unlocked",
};

export function Timeline({ setScreen }) {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { timeline } = await api.getTimeline();
        setEvents(timeline);
      } catch (e) {
        setError(e.message || "Couldn't load timeline.");
        setEvents([]);
      }
    })();
  }, []);

  return (
    <div style={styles.screenPad}>
      <button style={styles.backRow} onClick={() => setScreen("more")}>
        <ChevronLeft size={16} /> Back
      </button>
      <h2 style={{ ...styles.h2, marginTop: 14 }}>Founder Timeline</h2>
      <p style={{ fontSize: 12.5, color: C.muted, marginTop: -4, marginBottom: 12 }}>
        Every mission, decision, health check, and review — automatically recorded, most recent first.
      </p>

      {events === null && !error && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Loader2 className="spin" size={16} color={C.accent} />
          <span style={{ fontSize: 12, color: C.muted }}>Loading…</span>
        </div>
      )}
      {error && <p style={{ fontSize: 12, color: C.accent }}>{error}</p>}
      {events && events.length === 0 && <p style={{ fontSize: 13, color: C.muted }}>Nothing recorded yet — it fills in as you use the app.</p>}

      {events && events.length > 0 && (
        <div>
          {events.map((e, idx) => (
            <div key={idx} style={styles.timelineRow}>
              <div style={styles.timelineDotCol}>
                <div style={styles.timelineDot} />
                {idx < events.length - 1 && <div style={styles.timelineLine} />}
              </div>
              <div style={styles.timelineContent}>
                <div style={styles.timelineType}>{(TYPE_LABELS[e.type] || e.type).toUpperCase()}</div>
                <div style={styles.timelineTitle}>{e.title}</div>
                <div style={styles.timelineDate}>{new Date(e.date).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
