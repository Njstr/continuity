import React from "react";
import { BookOpen, Lock } from "lucide-react";
import { Section } from "../components/common";
import { styles } from "../styles/styles";
import { C } from "../styles/theme";
import { COURSES } from "../constants";

export function Courses() {
  return (
    <div style={styles.screenPad}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.muted, letterSpacing: 1 }}>
        LEARN
      </div>
      <h2 style={styles.h2}>Courses</h2>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>
        Structured lessons to go with your daily missions. Full lesson content is coming soon — here's what's planned.
      </p>

      <Section title={`${COURSES.length} COURSES`}>
        {COURSES.map((c) => (
          <div key={c.id} style={styles.courseCard}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <BookOpen size={15} color={C.accent} />
              <div style={styles.courseCardTitle}>{c.title}</div>
            </div>
            <p style={styles.courseCardDesc}>{c.description}</p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={styles.courseCardMeta}>{c.lessons} lessons</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.muted }}>
                <Lock size={11} /> Coming soon
              </span>
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}
