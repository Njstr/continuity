import React, { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Section, FeedbackWidget } from "../components/common";
import { styles } from "../styles/styles";
import { C, F } from "../styles/theme";
import { todayStr } from "../constants";
import { api } from "../api/client";

export function Mission({ profile, setProfile, missions, setMissions, onFeedback }) {
  const [loading, setLoading] = useState(false);
  const [mission, setMission] = useState(() => missions.find((m) => m.date === todayStr()) || null);
  const [reasonPrompt, setReasonPrompt] = useState(false);
  const [error, setError] = useState(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const m = await api.mission(profile, missions);
      const entry = { ...m, date: todayStr(), status: "pending" };
      setMission(entry);
      await setMissions([...missions.filter((x) => x.date !== todayStr()), entry]);
    } catch (e) {
      setError(e.message || "Couldn't reach the server.");
      const entry = {
        title: "Talk to one potential customer about their biggest daily frustration related to your problem space.",
        minutes: 30,
        impact: "Reduces uncertainty about real customer pain.",
        why: "Every stage of your startup depends on knowing this cold.",
        date: todayStr(),
        status: "pending",
      };
      setMission(entry);
      await setMissions([...missions.filter((x) => x.date !== todayStr()), entry]);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!mission) generate();
    // eslint-disable-next-line
  }, []);

  async function markDone() {
    const updatedMission = { ...mission, status: "done" };
    setMission(updatedMission);
    const exists = missions.find((m) => m.date === mission.date);
    await setMissions(exists ? missions.map((m) => (m.date === mission.date ? updatedMission : m)) : [...missions, updatedMission]);
    await setProfile({ ...profile, streak: (profile.streak || 0) + 1, missionsCompleted: (profile.missionsCompleted || 0) + 1, missionsTotal: (profile.missionsTotal || 0) + 1 });
    api.missionOutcome(mission.title, "done");
    api.logEvent("mission_completed", mission.title);
  }

  async function markSkipped(reason) {
    const updatedMission = { ...mission, status: "skipped", reason };
    setMission(updatedMission);
    const exists = missions.find((m) => m.date === mission.date);
    await setMissions(exists ? missions.map((m) => (m.date === mission.date ? updatedMission : m)) : [...missions, updatedMission]);
    await setProfile({ ...profile, streak: 0, missionsTotal: (profile.missionsTotal || 0) + 1 });
    api.missionOutcome(mission.title, "skipped", reason);
    api.logEvent("mission_skipped", mission.title, { reason });
    setReasonPrompt(false);
  }

  if (loading || !mission) {
    return (
      <div style={{ ...styles.screenPad, ...styles.centerCol }}>
        <Loader2 className="spin" size={22} color={C.accent} />
        <p style={{ color: C.muted, fontFamily: F.mono, fontSize: 12, marginTop: 10 }}>PLOTTING TODAY'S MISSION…</p>
      </div>
    );
  }

  return (
    <div style={styles.screenPad}>
      <div style={{ fontFamily: F.mono, fontSize: 11, color: C.muted, letterSpacing: 1 }}>TODAY'S MISSION</div>
      <h2 style={styles.h2}>{mission.title}</h2>
      {error && <p style={{ fontSize: 12, color: C.accent, marginBottom: 8 }}>{error} — showing a fallback mission.</p>}
      <div style={styles.missionMeta}>
        <span style={styles.metaChip}>~{mission.minutes} min</span>
      </div>
      <div style={styles.missionBlock}>
        <div style={styles.missionLabel}>EXPECTED IMPACT</div>
        <p style={styles.missionText}>{mission.impact}</p>
      </div>
      <div style={styles.missionBlock}>
        <div style={styles.missionLabel}>WHY IT MATTERS</div>
        <p style={styles.missionText}>{mission.why}</p>
      </div>

      <FeedbackWidget context="mission" content={mission.title} onFeedback={onFeedback} />

      {mission.status === "pending" && !reasonPrompt && (
        <div style={styles.missionActions}>
          <button style={styles.primaryBtn} onClick={markDone}>
            <CheckCircle2 size={16} /> Done
          </button>
          <button style={styles.ghostBtn} onClick={() => setReasonPrompt(true)}>Couldn't get to it</button>
        </div>
      )}

      {reasonPrompt && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>WHAT GOT IN THE WAY?</div>
          <div style={styles.tagRow}>
            {["Fear", "Lack of time", "Didn't know how", "Lost motivation", "Distractions", "Unexpected events"].map((r) => (
              <button key={r} style={styles.chipBtn} onClick={() => markSkipped(r)}>{r}</button>
            ))}
          </div>
        </div>
      )}

      {mission.status === "done" && (
        <div style={styles.celebrate}>
          <Sparkles size={18} color={C.accent} />
          <p style={{ fontSize: 13, marginTop: 6 }}>
            Logged. That's {profile.streak} in a row — every one of these compounds into the founder you're becoming.
          </p>
        </div>
      )}

      {mission.status === "skipped" && (
        <div style={styles.celebrate}>
          <p style={{ fontSize: 13, color: C.muted }}>
            Noted — "{mission.reason}". No shame in it. Streak reset, but tomorrow's a clean page. Talk to your Mentor if you want to work through it.
          </p>
        </div>
      )}
    </div>
  );
}
