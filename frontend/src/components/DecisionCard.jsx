import React, { useState } from "react";
import { TrendingUp, TrendingDown, Minus, HelpCircle, Check, Loader2 } from "lucide-react";
import { C, F } from "../styles/theme";

const DIRECTION_ICON = { increase: TrendingUp, decrease: TrendingDown, flat: Minus, uncertain: HelpCircle };
const DIRECTION_COLOR = { increase: C.accent2, decrease: "#d85050", flat: C.muted, uncertain: C.muted };

function Row({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10.5, color: C.muted, fontFamily: F.mono, letterSpacing: 0.4, marginBottom: 3 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 13, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

export function DecisionCard({ decisionText, simulation, recordedStatus, onAct }) {
  const [modifyOpen, setModifyOpen] = useState(false);
  const [modifyText, setModifyText] = useState("");
  const [acting, setActing] = useState(false);

  const s = simulation || {};
  const predictions = s.predictions || [];

  async function act(status, finalDecisionText) {
    if (acting) return;
    setActing(true);
    await onAct(status, finalDecisionText);
    setActing(false);
    setModifyOpen(false);
  }

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, maxWidth: "100%" }}>
      <div style={{ fontSize: 10.5, color: C.accent, fontFamily: F.mono, letterSpacing: 0.5, marginBottom: 8 }}>DECISION SIMULATION</div>

      {s.currentSituation && <Row label="Current situation">{s.currentSituation}</Row>}

      {predictions.length > 0 && (
        <Row label="Likely effects">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {predictions.map((p, i) => {
              const Icon = DIRECTION_ICON[p.direction] || HelpCircle;
              const color = DIRECTION_COLOR[p.direction] || C.muted;
              const range = p.predictedLow != null && p.predictedHigh != null ? ` (${p.predictedLow}–${p.predictedHigh})` : "";
              return (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <Icon size={14} color={color} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <span style={{ fontWeight: 600 }}>{p.metric}</span>
                    {range && <span style={{ color: C.muted }}>{range}</span>}
                    {p.reasoning && <div style={{ fontSize: 12, color: C.muted }}>{p.reasoning}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </Row>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        {["bestCase", "expectedCase", "worstCase"].map((k) =>
          s[k] ? (
            <div key={k} style={{ background: C.surface2, borderRadius: 8, padding: "7px 8px" }}>
              <div style={{ fontSize: 9.5, color: C.muted, fontFamily: F.mono, marginBottom: 3 }}>
                {k === "bestCase" ? "BEST" : k === "expectedCase" ? "EXPECTED" : "WORST"}
              </div>
              <div style={{ fontSize: 11.5, lineHeight: 1.4 }}>{s[k]}</div>
            </div>
          ) : null
        )}
      </div>

      {s.keyAssumptions?.length > 0 && <Row label="Assumes">{s.keyAssumptions.join(" · ")}</Row>}
      {s.mainRisks?.length > 0 && <Row label="Risks">{s.mainRisks.join(" · ")}</Row>}

      {s.overallConfidence && (
        <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 10 }}>
          {s.overallConfidence === "high"
            ? "Fairly confident in this read given your numbers."
            : s.overallConfidence === "medium"
            ? "Reasonable but not certain — real uncertainty here."
            : "Rough directional read — a lot is still unknown."}
        </div>
      )}

      {!recordedStatus && !modifyOpen && (
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <button onClick={() => act("proceeded", decisionText)} disabled={acting} style={btnStyle(true)}>
            {acting ? <Loader2 className="spin" size={13} /> : "Proceed"}
          </button>
          <button onClick={() => setModifyOpen(true)} disabled={acting} style={btnStyle(false)}>
            Modify
          </button>
          <button onClick={() => act("decided_later", decisionText)} disabled={acting} style={btnStyle(false)}>
            Not now
          </button>
        </div>
      )}

      {modifyOpen && (
        <div style={{ marginTop: 4 }}>
          <input
            autoFocus
            value={modifyText}
            onChange={(e) => setModifyText(e.target.value)}
            placeholder="What's the modified version?"
            style={{ width: "100%", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: C.text, fontSize: 13, marginBottom: 6 }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => act("modified", modifyText.trim() || decisionText)} disabled={acting || !modifyText.trim()} style={btnStyle(true)}>
              {acting ? <Loader2 className="spin" size={13} /> : "Save modified decision"}
            </button>
            <button onClick={() => setModifyOpen(false)} style={btnStyle(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {recordedStatus && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.accent2, marginTop: 4 }}>
          <Check size={13} />
          {recordedStatus === "proceeded" && "Recorded — I'll check back on this."}
          {recordedStatus === "modified" && "Recorded the modified decision — I'll check back on this."}
          {recordedStatus === "decided_later" && "Noted. Bring it up again whenever you're ready."}
        </div>
      )}
    </div>
  );
}

function btnStyle(primary) {
  return {
    flex: 1,
    background: primary ? C.accent : "transparent",
    color: primary ? "#1A1400" : C.muted,
    border: `1px solid ${primary ? C.accent : C.border}`,
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 12.5,
    fontWeight: primary ? 600 : 400,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}
