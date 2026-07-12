import React from "react";
import { CheckCircle2, Circle, Flame, TrendingUp, Star } from "lucide-react";
import { Section, Vital, EditableLine } from "../components/common";
import { BadgesRow } from "../components/BadgesRow";
import { HealthPanel } from "../components/HealthPanel";
import { MetricsPanel } from "../components/MetricsPanel";
import { TodayFocus } from "../components/TodayFocus";
import { styles } from "../styles/styles";
import { C } from "../styles/theme";
import { STAGES, todayStr } from "../constants";

export function Dashboard({ profile, missions, setProfile }) {
  const stageIdx = STAGES.indexOf(profile.stage);
  const skills = Object.entries(profile.skills || {});

  return (
    <div style={styles.screenPad}>
      <div style={styles.welcomeBlock}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.muted, letterSpacing: 1 }}>{todayStr()}</div>
        <EditableLine tag="h1" style={styles.h1} value={profile.startupName} onSave={(v) => setProfile({ ...profile, startupName: v })} />
        <EditableLine tag="p" style={{ color: C.muted, fontSize: 14, marginTop: 2 }} value={profile.oneLiner} onSave={(v) => setProfile({ ...profile, oneLiner: v })} />
      </div>

      <TodayFocus profile={profile} missions={missions} />

      <Section title="COURSE">
        <div style={styles.stageTrack}>
          {STAGES.map((s, idx) => (
            <div key={s} style={styles.stageStep}>
              <div style={{ ...styles.stageDot, background: idx <= stageIdx ? C.accent : "transparent", borderColor: idx <= stageIdx ? C.accent : C.border }} />
              {idx < STAGES.length - 1 && <div style={{ ...styles.stageLine, background: idx < stageIdx ? C.accent : C.border }} />}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 13, color: C.text, marginTop: 8 }}>
          Currently at <b style={{ color: C.accent }}>{profile.stage}</b>
        </div>
      </Section>

      <Section title="VITALS">
        <div style={styles.vitalsGrid}>
          <Vital icon={Flame} label="Streak" value={`${profile.streak || 0}d`} />
          <Vital icon={TrendingUp} label="Growth score" value={profile.growthScore ?? "—"} />
          <Vital icon={CheckCircle2} label="Missions done" value={profile.missionsCompleted || 0} />
          <Vital icon={Star} label="Total logged" value={profile.missionsTotal || 0} />
        </div>
      </Section>

      <BadgesRow profile={profile} />
      <HealthPanel profile={profile} missions={missions} />
      <MetricsPanel profile={profile} />

      <Section title="FOUNDER SKILL LEVELS">
        <div style={styles.skillList}>
          {skills.map(([name, v]) => (
            <div key={name} style={styles.skillRow}>
              <div style={styles.skillLabelRow}>
                <span style={{ fontSize: 13 }}>{name}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.muted }}>LVL {v.current} → {v.target}</span>
              </div>
              <div style={styles.barTrack}>
                <div style={{ ...styles.barFillMuted, width: `${(v.target / 10) * 100}%` }} />
                <div style={{ ...styles.barFill, width: `${(v.current / 10) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="STRENGTHS & GROWTH AREAS">
        <div style={styles.tagRow}>
          {(profile.strengths || []).map((s) => (
            <span key={s} style={{ ...styles.tag, borderColor: C.accent2, color: C.accent2 }}>{s}</span>
          ))}
        </div>
        <div style={{ ...styles.tagRow, marginTop: 8 }}>
          {(profile.growthAreas || []).map((s) => (
            <span key={s} style={{ ...styles.tag, borderColor: C.accent, color: C.accent }}>{s}</span>
          ))}
        </div>
      </Section>

      <Section title="RECENT LOG">
        {missions.length === 0 && <p style={{ color: C.muted, fontSize: 13 }}>No entries yet. Your first mission is waiting in the Mission tab.</p>}
        <div style={styles.logList}>
          {missions.slice(-6).reverse().map((m, idx) => (
            <div key={idx} style={styles.logRow}>
              {m.status === "done" ? <CheckCircle2 size={15} color={C.accent2} /> : m.status === "skipped" ? <Circle size={15} color={C.muted} /> : <Circle size={15} color={C.accent} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}>{m.title}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.muted }}>{m.date}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
