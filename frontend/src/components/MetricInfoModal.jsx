import React from "react";
import { X, Info } from "lucide-react";
import { C, F } from "../styles/theme";

export function MetricInfoButton({ info, onClick }) {
  if (!info) return null;
  return (
    <button
      onClick={onClick}
      aria-label="What is this metric?"
      style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2, display: "flex", color: C.muted }}
    >
      <Info size={13} />
    </button>
  );
}

export function MetricInfoModal({ label, info, onClose }) {
  if (!info) return null;
  const rows = [
    ["Definition", info.definition],
    ["Why it matters", info.why],
    ["Healthy range", info.healthyRange],
    ["How to improve it", info.improve],
  ];
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", zIndex: 50 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderRadius: "16px 16px 0 0", padding: "16px 18px 26px", width: "100%", maxHeight: "80vh", overflowY: "auto" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontFamily: F.display, fontSize: 17 }}>{label}</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>
        {rows.map(([title, text]) =>
          text ? (
            <div key={title} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10.5, color: C.accent, fontFamily: F.mono, letterSpacing: 0.5, marginBottom: 3 }}>{title.toUpperCase()}</div>
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>{text}</div>
            </div>
          ) : null
        )}
        {(info.influencedBy?.length || info.influences?.length) && (
          <div style={{ display: "flex", gap: 20, marginTop: 6 }}>
            {info.influencedBy?.length > 0 && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10.5, color: C.muted, fontFamily: F.mono, marginBottom: 4 }}>INFLUENCED BY</div>
                <div style={{ fontSize: 12, color: C.muted }}>{info.influencedBy.join(", ")}</div>
              </div>
            )}
            {info.influences?.length > 0 && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10.5, color: C.muted, fontFamily: F.mono, marginBottom: 4 }}>INFLUENCES</div>
                <div style={{ fontSize: 12, color: C.muted }}>{info.influences.join(", ")}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
