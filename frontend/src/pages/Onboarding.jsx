import React, { useState } from "react";
import { Anchor, Sparkles, ChevronRight } from "lucide-react";
import { styles } from "../styles/styles";
import { C, F, globalCss } from "../styles/theme";
import { QUESTIONS, todayStr } from "../constants";
import { api } from "../api/client";

export function Onboarding({ onDone }) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState({});
  const [val, setVal] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const q = QUESTIONS[i];

  async function next() {
    const updated = { ...answers, [q.key]: val };
    setAnswers(updated);
    setVal("");
    if (i < QUESTIONS.length - 1) {
      setI(i + 1);
    } else {
      setGenerating(true);
      setError(null);
      try {
        const profile = await api.onboard(updated);
        onDone({ ...profile, streak: 0, missionsCompleted: 0, missionsTotal: 0, createdAt: todayStr(), rawOnboarding: updated });
      } catch (e) {
        setError(e.message || "Couldn't reach the server.");
        onDone(fallbackProfile(updated));
      }
      setGenerating(false);
    }
  }

  if (generating) {
    return (
      <div style={styles.bootWrap}>
        <style>{globalCss}</style>
        <Sparkles className="spin" size={26} color={C.accent} />
        <p style={{ color: C.muted, marginTop: 14, fontFamily: F.mono, fontSize: 13, letterSpacing: 0.5 }}>
          CHARTING YOUR STARTING COORDINATES…
        </p>
      </div>
    );
  }

  return (
    <div style={styles.onboardWrap}>
      <style>{globalCss}</style>
      <div style={styles.onboardTop}>
        <Anchor size={18} color={C.accent} />
        <span style={styles.brand}>Founder Companion</span>
      </div>
      <div style={styles.onboardCard}>
        <div style={{ fontFamily: F.mono, fontSize: 12, color: C.muted, letterSpacing: 1 }}>
          ENTRY {String(i + 1).padStart(2, "0")} / {String(QUESTIONS.length).padStart(2, "0")}
        </div>
        <h2 style={styles.qLabel}>{q.label}</h2>
        {error && <p style={{ fontSize: 12, color: C.accent }}>{error} — continuing with a basic profile.</p>}
        <textarea
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={q.placeholder}
          style={styles.textarea}
          rows={4}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && val.trim()) {
              e.preventDefault();
              next();
            }
          }}
        />
        <button style={{ ...styles.primaryBtn, opacity: val.trim() ? 1 : 0.4 }} disabled={!val.trim()} onClick={next}>
          {i < QUESTIONS.length - 1 ? "Continue" : "Chart my course"} <ChevronRight size={16} />
        </button>
      </div>
      <div style={styles.dots}>
        {QUESTIONS.map((_, idx) => (
          <div key={idx} style={{ ...styles.dot, background: idx <= i ? C.accent : C.border }} />
        ))}
      </div>
    </div>
  );
}

function fallbackProfile(answers) {
  const SKILL_LIST = [
    "Customer Discovery", "Sales", "Marketing", "Negotiation", "Hiring",
    "Leadership", "Product Thinking", "Finance", "Fundraising",
    "Networking", "Execution", "Strategic Thinking",
  ];
  const skills = {};
  SKILL_LIST.forEach((s) => (skills[s] = { current: 2, target: 7 }));
  return {
    founderName: answers.founderName || "Founder",
    startupName: answers.startupName || "Your Startup",
    oneLiner: answers.startupName || "",
    stage: "Idea",
    strengths: ["Willingness to start"],
    growthAreas: ["Customer discovery", "Sales"],
    skills,
    welcomeNote: "I couldn't reach the server just now, but I've got the essentials — let's get moving.",
    growthScore: 10,
    streak: 0,
    missionsCompleted: 0,
    missionsTotal: 0,
    createdAt: todayStr(),
    rawOnboarding: answers,
  };
}
