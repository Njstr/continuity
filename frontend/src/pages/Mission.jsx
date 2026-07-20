import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, Circle, Loader2, Sparkles, ChevronLeft, Camera, Link2, FileText } from "lucide-react";
import { Section, FeedbackWidget } from "../components/common";
import { styles } from "../styles/styles";
import { C, F } from "../styles/theme";
import { todayStr, estimateDifficulty, estimateXP } from "../constants";
import { formatCurrency } from "../utils/businessMetrics";
import { loadJSON, saveJSON } from "../utils/storage";
import { api } from "../api/client";

function uid() {
  return "m_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// MissionMode — launched from Home's "Start Now" (existing mission) or
// "Generate a new mission" (missionId === null). Handles: generation
// fallback, the timer + optional checklist while a mission is active, and
// the Publish Proof flow before a mission is allowed to count as done.
export function Mission({ profile, setProfile, missions, setMissions, onFeedback, missionId, setScreen, businessState, setBusinessState }) {
  const [loading, setLoading] = useState(!missionId);
  const [mission, setMission] = useState(() => missions.find((m) => m.id === missionId) || null);
  const [reasonPrompt, setReasonPrompt] = useState(false);
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [showProof, setShowProof] = useState(false);
  const [proofType, setProofType] = useState("description");
  const [proofUrl, setProofUrl] = useState("");
  const [proofDescription, setProofDescription] = useState("");
  const [proofImage, setProofImage] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [impact, setImpact] = useState(null);
  const tickRef = useRef(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const m = await api.mission(profile, missions);
      const difficulty = m.difficulty || estimateDifficulty(m.minutes);
      const xp = m.xp || estimateXP(m.minutes, difficulty);
      const entry = { ...m, id: uid(), date: todayStr(), status: "in_progress", startedAt: Date.now(), difficulty, xp };
      setMission(entry);
      await setMissions([...missions, entry]);
    } catch (e) {
      setError(e.message || "Couldn't reach the server.");
      const entry = {
        id: uid(),
        title: "Talk to one potential customer about their biggest daily frustration related to your problem space.",
        description: "A focused customer conversation to reduce uncertainty about real pain points.",
        minutes: 30,
        impact: "Reduces uncertainty about real customer pain.",
        why: "Every stage of your startup depends on knowing this cold.",
        difficulty: "Medium",
        xp: 40,
        date: todayStr(),
        status: "in_progress",
        startedAt: Date.now(),
      };
      setMission(entry);
      await setMissions([...missions, entry]);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!mission && !missionId) {
      generate();
    } else if (mission && mission.status === "pending") {
      // Entering an existing pending mission starts it.
      const started = { ...mission, status: "in_progress", startedAt: mission.startedAt || Date.now() };
      setMission(started);
      setMissions(missions.map((m) => (m.id === started.id ? started : m)));
    }
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (!mission || mission.status !== "in_progress") return;
    const start = mission.startedAt || Date.now();
    tickRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(tickRef.current);
  }, [mission?.startedAt, mission?.status]);

  function toggleChecklistItem(idx) {
    const checklist = mission.checklist.map((c, i) => (i === idx ? { ...c, done: !c.done } : c));
    const updated = { ...mission, checklist };
    setMission(updated);
    setMissions(missions.map((m) => (m.id === updated.id ? updated : m)));
  }

  function openProofStep() {
    clearInterval(tickRef.current);
    setShowProof(true);
  }

  async function handleImagePick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("That image is a bit large — try one under 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProofImage(reader.result);
    reader.readAsDataURL(file);
  }

  async function publishProof() {
    setPublishing(true);
    const updatedMission = {
      ...mission,
      status: "done",
      completedAt: Date.now(),
      proofType,
      proofUrl: proofType === "link" ? proofUrl : undefined,
      proofDescription: proofType === "description" ? proofDescription : undefined,
      proofImage: proofType === "screenshot" ? proofImage : undefined,
    };
    setMission(updatedMission);
    await setMissions(missions.map((m) => (m.id === updatedMission.id ? updatedMission : m)));
    await setProfile({
      ...profile,
      streak: (profile.streak || 0) + 1,
      missionsCompleted: (profile.missionsCompleted || 0) + 1,
      missionsTotal: (profile.missionsTotal || 0) + 1,
      xp: (profile.xp || 0) + (mission.xp || 0),
    });
    api.missionOutcome(mission.title, "done");
    api.logEvent("mission_completed", mission.title, { xp: mission.xp });

    // Part 4/5 — estimate this mission's plausible business impact and
    // fold it straight into the startup state, so Metrics reflects real
    // progress without the founder re-entering numbers by hand.
    if (businessState && setBusinessState) {
      try {
        const result = await api.missionImpact(profile, businessState, updatedMission);
        const d = result.deltas || {};
        const nextState = {
          ...businessState,
          monthlyRevenue: (businessState.monthlyRevenue || 0) + (d.monthlyRevenue || 0),
          customers: Math.max(0, (businessState.customers || 0) + (d.customers || 0)),
          marketingSpend: Math.max(0, (businessState.marketingSpend || 0) + (d.marketingSpend || 0)),
          monthlyExpenses: Math.max(0, (businessState.monthlyExpenses || 0) + (d.monthlyExpenses || 0)),
          hostingCost: Math.max(0, (businessState.hostingCost || 0) + (d.hostingCost || 0)),
          aiCost: Math.max(0, (businessState.aiCost || 0) + (d.aiCost || 0)),
          cash: (businessState.cash || 0) + (d.cash || 0),
        };
        setBusinessState(nextState);
        const history = await loadJSON("businessHistory", []);
        const updatedHistory = [...history, { ...nextState, date: todayStr() }].slice(-60);
        await saveJSON("businessHistory", updatedHistory);
        setImpact({ ...result, deltas: d });
      } catch (e) {
        // Business impact is a bonus insight, not core to completing the
        // mission — fail silently rather than blocking the celebration.
        console.error(e);
      }
    }

    setPublishing(false);
  }

  async function markSkipped(reason) {
    const updatedMission = { ...mission, status: "skipped", reason };
    setMission(updatedMission);
    await setMissions(missions.map((m) => (m.id === updatedMission.id ? updatedMission : m)));
    await setProfile({ ...profile, streak: 0, missionsTotal: (profile.missionsTotal || 0) + 1 });
    api.missionOutcome(mission.title, "skipped", reason);
    api.logEvent("mission_skipped", mission.title, { reason });
    setReasonPrompt(false);
  }

  if (loading || !mission) {
    return (
      <div style={{ ...styles.screenPad, ...styles.centerCol }}>
        <Loader2 className="spin" size={22} color={C.accent} />
        <p style={{ color: C.muted, fontFamily: F.mono, fontSize: 12, marginTop: 10 }}>PLOTTING YOUR MISSION…</p>
      </div>
    );
  }

  // ---- Mission accomplished (already published) ----
  if (mission.status === "done") {
    const d = impact?.deltas || {};
    const impactRows = [
      d.monthlyRevenue ? { label: "Revenue", value: formatCurrency(d.monthlyRevenue), positive: d.monthlyRevenue > 0 } : null,
      d.customers ? { label: "Customers", value: `${d.customers > 0 ? "+" : ""}${d.customers}`, positive: d.customers > 0 } : null,
      d.marketingSpend ? { label: "Marketing spend", value: formatCurrency(d.marketingSpend), positive: d.marketingSpend < 0 } : null,
      d.monthlyExpenses ? { label: "Expenses", value: formatCurrency(d.monthlyExpenses), positive: d.monthlyExpenses < 0 } : null,
      d.hostingCost ? { label: "Hosting cost", value: formatCurrency(d.hostingCost), positive: d.hostingCost < 0 } : null,
      d.aiCost ? { label: "AI cost", value: formatCurrency(d.aiCost), positive: d.aiCost < 0 } : null,
      d.cash ? { label: "Cash balance", value: formatCurrency(d.cash), positive: d.cash > 0 } : null,
      impact?.healthDelta ? { label: "Startup health", value: `${impact.healthDelta > 0 ? "+" : ""}${impact.healthDelta}`, positive: impact.healthDelta > 0 } : null,
    ].filter(Boolean);

    return (
      <div style={styles.screenPad}>
        <button style={styles.backRow} onClick={() => setScreen("dashboard")}>
          <ChevronLeft size={16} /> Back to Home
        </button>
        <div style={{ ...styles.celebrate, marginTop: 16, textAlign: "center" }}>
          <Sparkles size={20} color={C.accent} />
          <p style={{ fontSize: 14, marginTop: 8 }}>
            Mission complete — <b style={{ color: C.accent }}>+{mission.xp} XP</b> earned. That's {profile.streak} in a row.
          </p>
        </div>

        {impact && (
          <Section title="BUSINESS IMPACT">
            {impact.summary && <p style={{ ...styles.missionText, marginBottom: 10 }}>{impact.summary}</p>}
            {impactRows.length === 0 ? (
              <p style={styles.emptyStateText}>This mission didn't move any tracked numbers — that's normal for some missions.</p>
            ) : (
              impactRows.map((row, idx) => (
                <div key={idx} style={styles.impactRow}>
                  <span style={styles.impactLabel}>{row.label}</span>
                  <span style={{ ...styles.impactValue, ...(row.positive ? styles.impactPositive : styles.impactNegative) }}>
                    {row.positive ? "✓ " : ""}{row.value}
                  </span>
                </div>
              ))
            )}
          </Section>
        )}
      </div>
    );
  }

  // ---- Publish proof step ----
  if (showProof) {
    return (
      <div style={styles.screenPad}>
        <div style={{ fontFamily: F.mono, fontSize: 11, color: C.muted, letterSpacing: 1 }}>MISSION COMPLETED 🎉</div>
        <h2 style={styles.h2}>Publish your proof</h2>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>
          A quick record of what you actually did — this is what turns advice into evidence.
        </p>

        <div style={styles.proofOptionRow}>
          <button
            style={{ ...styles.proofOptionBtn, ...(proofType === "screenshot" ? styles.proofOptionBtnActive : {}) }}
            onClick={() => setProofType("screenshot")}
          >
            <Camera size={18} />
            <span style={{ fontSize: 11 }}>Screenshot</span>
          </button>
          <button
            style={{ ...styles.proofOptionBtn, ...(proofType === "link" ? styles.proofOptionBtnActive : {}) }}
            onClick={() => setProofType("link")}
          >
            <Link2 size={18} />
            <span style={{ fontSize: 11 }}>Paste Link</span>
          </button>
          <button
            style={{ ...styles.proofOptionBtn, ...(proofType === "description" ? styles.proofOptionBtnActive : {}) }}
            onClick={() => setProofType("description")}
          >
            <FileText size={18} />
            <span style={{ fontSize: 11 }}>Description</span>
          </button>
        </div>

        {proofType === "screenshot" && (
          <>
            <input type="file" accept="image/*" onChange={handleImagePick} style={{ fontSize: 12, color: C.muted }} />
            {proofImage && <img src={proofImage} alt="preview" style={styles.proofPreviewImg} />}
          </>
        )}
        {proofType === "link" && (
          <input style={styles.metricInput} placeholder="https://…" value={proofUrl} onChange={(e) => setProofUrl(e.target.value)} />
        )}
        {proofType === "description" && (
          <textarea rows={4} style={styles.textarea} placeholder="What did you actually do?" value={proofDescription} onChange={(e) => setProofDescription(e.target.value)} />
        )}

        {error && <p style={{ fontSize: 12, color: C.accent, marginTop: 8 }}>{error}</p>}

        <button
          style={{ ...styles.primaryBtn, width: "100%", marginTop: 16, opacity: publishing ? 0.6 : 1 }}
          disabled={publishing}
          onClick={publishProof}
        >
          {publishing ? <Loader2 className="spin" size={15} /> : "Publish Proof"}
        </button>
      </div>
    );
  }

  // ---- Mission mode (active) ----
  return (
    <div style={styles.screenPad}>
      <button style={styles.backRow} onClick={() => setScreen("dashboard")}>
        <ChevronLeft size={16} /> Back to Home
      </button>
      <div style={{ fontFamily: F.mono, fontSize: 11, color: C.muted, letterSpacing: 1, marginTop: 14 }}>MISSION MODE</div>
      <h2 style={styles.h2}>{mission.title}</h2>
      {error && <p style={{ fontSize: 12, color: C.accent, marginBottom: 8 }}>{error} — showing a fallback mission.</p>}

      <div style={styles.missionMeta}>
        <span style={styles.metaChip}>~{mission.minutes} min</span>
        <span style={{ ...styles.difficultyChip, borderColor: C.muted, color: C.muted }}>{mission.difficulty}</span>
        <span style={styles.xpChip}>+{mission.xp} XP</span>
      </div>

      <div style={styles.timerDisplay}>{formatElapsed(elapsed)}</div>

      <div style={styles.missionBlock}>
        <div style={styles.missionLabel}>OBJECTIVE</div>
        <p style={styles.missionText}>{mission.why || mission.impact}</p>
      </div>
      {mission.impact && mission.why && (
        <div style={styles.missionBlock}>
          <div style={styles.missionLabel}>EXPECTED IMPACT</div>
          <p style={styles.missionText}>{mission.impact}</p>
        </div>
      )}

      {Array.isArray(mission.checklist) && mission.checklist.length > 0 && (
        <div style={styles.missionBlock}>
          <div style={styles.missionLabel}>CHECKLIST</div>
          {mission.checklist.map((item, idx) => (
            <div key={idx} style={styles.checklistItem} onClick={() => toggleChecklistItem(idx)}>
              {item.done ? <CheckCircle2 size={16} color={C.accent2} /> : <Circle size={16} color={C.muted} />}
              <span style={{ ...styles.checklistLabel, textDecoration: item.done ? "line-through" : "none", color: item.done ? C.muted : C.text }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      )}

      <FeedbackWidget context="mission" content={mission.title} onFeedback={onFeedback} />

      {!reasonPrompt && (
        <div style={styles.missionActions}>
          <button style={styles.primaryBtn} onClick={openProofStep}>
            <CheckCircle2 size={16} /> Mark Mission Complete
          </button>
          <button style={styles.ghostBtn} onClick={() => setReasonPrompt(true)}>Couldn't get to it</button>
        </div>
      )}

      {reasonPrompt && (
        <Section title="WHAT GOT IN THE WAY?">
          <div style={styles.tagRow}>
            {["Fear", "Lack of time", "Didn't know how", "Lost motivation", "Distractions", "Unexpected events"].map((r) => (
              <button key={r} style={styles.chipBtn} onClick={() => markSkipped(r)}>{r}</button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
