import React, { useState } from "react";
import { X, BarChart3 } from "lucide-react";
import { C, F } from "../styles/theme";
import { ALL_METRIC_FIELDS } from "../constants";

const FIELD_BY_KEY = Object.fromEntries(ALL_METRIC_FIELDS.map((f) => [f.key, f]));

function unitHint(unit) {
  if (unit === "percent") return "%";
  if (unit === "months") return "mo";
  return "";
}

export function MetricsExtractionReview({ values, filename, onCancel, onApply }) {
  const entries = Object.entries(values).filter(([, v]) => v !== null && v !== undefined);
  const [checked, setChecked] = useState(() => Object.fromEntries(entries.map(([k]) => [k, true])));
  const [edited, setEdited] = useState(() => Object.fromEntries(entries));

  function toggle(key) {
    setChecked((c) => ({ ...c, [key]: !c[key] }));
  }
  function updateValue(key, v) {
    setEdited((e) => ({ ...e, [key]: v }));
  }
  function apply() {
    const toApply = {};
    entries.forEach(([key]) => {
      if (checked[key]) toApply[key] = Number(edited[key]);
    });
    onApply(toApply);
  }

  const selectedCount = entries.filter(([k]) => checked[k]).length;

  return (
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", zIndex: 50 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderRadius: "16px 16px 0 0", padding: "16px 18px 22px", width: "100%", maxHeight: "78vh", overflowY: "auto" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <BarChart3 size={16} color={C.accent} />
            <span style={{ fontFamily: F.display, fontSize: 16 }}>Metrics found in {filename}</span>
          </div>
          <button onClick={onCancel} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
          Only values explicitly stated in the document are shown. Review, edit if needed, then apply — nothing changes on your Metrics tab until you do.
        </p>

        {entries.length === 0 ? (
          <p style={{ fontSize: 13, color: C.muted }}>No clearly stated metric values found in this document.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {entries.map(([key]) => {
              const field = FIELD_BY_KEY[key];
              if (!field) return null;
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 10px" }}>
                  <input type="checkbox" checked={!!checked[key]} onChange={() => toggle(key)} style={{ width: 15, height: 15, flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, flex: 1 }}>{field.label}</span>
                  <input
                    type="number"
                    value={edited[key]}
                    onChange={(e) => updateValue(key, e.target.value)}
                    disabled={!checked[key]}
                    style={{ width: 84, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontFamily: F.mono, fontSize: 13, padding: "4px 6px", textAlign: "right" }}
                  />
                  <span style={{ fontSize: 11, color: C.muted, width: 18 }}>{unitHint(field.unit)}</span>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={{ flex: 1, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 10, color: C.muted, padding: "10px 12px", fontSize: 13, cursor: "pointer" }}>
            Cancel
          </button>
          <button
            onClick={apply}
            disabled={selectedCount === 0}
            style={{
              flex: 2, background: selectedCount ? C.accent : C.border, border: "none", borderRadius: 10, color: "#1A1400",
              padding: "10px 12px", fontSize: 13, fontWeight: 600, cursor: selectedCount ? "pointer" : "not-allowed",
            }}
          >
            Apply {selectedCount || ""} to Metrics
          </button>
        </div>
      </div>
    </div>
  );
}
