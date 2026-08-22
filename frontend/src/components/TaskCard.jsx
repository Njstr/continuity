import React, { useState } from "react";
import { Check, Loader2, HelpCircle, Lock } from "lucide-react";
import { C, F } from "../styles/theme";

// The execution engine deliberately never shows the whole task list (see
// spec §2/§16) — this card renders exactly one task, one step at a time,
// with an evidence-submission box gating progress to the next step. It
// never claims a step/task is complete on its own; `task.status` and
// `task.currentStepIndex` always come straight from the backend's
// already-verified state (see executionEngine.js) — this component has
// no completion logic of its own to get wrong.

const EVENT_LABEL = {
  task_started: null,
  in_progress: null,
  insufficient: "NEEDS MORE EVIDENCE",
  completed: "TASK COMPLETED",
  stuck: "ADJUSTING THE PLAN",
};

export function TaskCard({ task, currentStep, event, feedbackText, onSubmitEvidence }) {
  const [evidence, setEvidence] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!task) return null;
  const isCompleted = task.status === "COMPLETED";
  const step = currentStep || task.steps?.[task.currentStepIndex];
  const stepNum = (task.currentStepIndex ?? 0) + 1;
  const totalSteps = task.steps?.length || 1;

  async function submit() {
    if (!evidence.trim() || submitting) return;
    setSubmitting(true);
    await onSubmitEvidence(evidence.trim());
    setSubmitting(false);
    setEvidence("");
  }

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, maxWidth: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 10.5, color: isCompleted ? C.accent2 : C.accent, fontFamily: F.mono, letterSpacing: 0.5 }}>
          {isCompleted ? "✓ TASK COMPLETED" : "CURRENT TASK"}
        </div>
        {!isCompleted && (
          <div style={{ fontSize: 10.5, color: C.muted, fontFamily: F.mono }}>
            STEP {stepNum} OF {totalSteps}
          </div>
        )}
      </div>

      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, lineHeight: 1.3 }}>{task.title}</div>

      {task.whyItMatters && !isCompleted && (
        <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5, marginBottom: 12 }}>
          <span style={{ color: C.text, fontWeight: 500 }}>Why: </span>
          {task.whyItMatters}
        </div>
      )}

      {EVENT_LABEL[event] && event !== "completed" && (
        <div
          style={{
            display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontFamily: F.mono, letterSpacing: 0.3,
            color: event === "stuck" ? C.accent : "#d85050", background: C.surface2, border: `1px solid ${C.border}`,
            borderRadius: 6, padding: "3px 8px", marginBottom: 10,
          }}
        >
          {event === "insufficient" ? <HelpCircle size={11} /> : <Lock size={11} />}
          {EVENT_LABEL[event]}
        </div>
      )}

      {feedbackText && (
        <div style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 12, whiteSpace: "pre-line" }}>{feedbackText}</div>
      )}

      {!isCompleted && step && (
        <div style={{ background: C.surface2, borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>{step.title}</div>
          <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.55 }}>{step.instructions}</div>
        </div>
      )}

      {isCompleted ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.accent2 }}>
          <Check size={13} />
          Evidence verified — moving to the next thing.
        </div>
      ) : (
        <div>
          <textarea
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder={task.evidenceRequirements ? `What actually happened? (${task.evidenceRequirements.slice(0, 70)}${task.evidenceRequirements.length > 70 ? "…" : ""})` : "What actually happened when you did this?"}
            rows={3}
            style={{
              width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px",
              color: C.text, fontSize: 13, fontFamily: F.body, resize: "vertical", marginBottom: 8,
            }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={submit}
              disabled={submitting || !evidence.trim()}
              style={{
                flex: 1, background: evidence.trim() ? C.accent : "transparent", color: evidence.trim() ? "#1A1400" : C.muted,
                border: `1px solid ${evidence.trim() ? C.accent : C.border}`, borderRadius: 8, padding: "9px 10px",
                fontSize: 12.5, fontWeight: 600, cursor: evidence.trim() ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              {submitting ? <Loader2 className="spin" size={13} /> : "Submit evidence"}
            </button>
            <button
              onClick={() => onSubmitEvidence("I'm stuck and can't do this step right now.")}
              disabled={submitting}
              style={{
                background: "transparent", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8,
                padding: "9px 12px", fontSize: 12.5, cursor: "pointer",
              }}
            >
              I'm stuck
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
