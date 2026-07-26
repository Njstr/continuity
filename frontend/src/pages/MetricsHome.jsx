import React, { useState } from "react";
import { styles } from "../styles/styles";
import { C, F } from "../styles/theme";
import { METRIC_GROUPS } from "../constants";
import { MetricInfoButton, MetricInfoModal } from "../components/MetricInfoModal";

const UNIT_PREFIX = { currency: "" };

function formatUnitHint(unit) {
  if (unit === "percent") return "%";
  if (unit === "months") return "mo";
  return "";
}

export function MetricsHome({ metrics, setMetrics }) {
  const [openInfo, setOpenInfo] = useState(null); // { label, info }
  const [dirty, setDirty] = useState(false);
  const [draft, setDraft] = useState(metrics || {});

  function update(key, value) {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  }

  function save() {
    const cleaned = {};
    Object.entries(draft).forEach(([k, v]) => (cleaned[k] = v === "" || v === null ? 0 : Number(v)));
    setMetrics(cleaned);
    setDraft(cleaned);
    setDirty(false);
  }

  return (
    <div style={styles.screenPad}>
      <div style={{ fontFamily: F.mono, fontSize: 11, color: C.muted, letterSpacing: 1 }}>STARTUP HEALTH</div>
      <h2 style={styles.h2}>Metrics</h2>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>
        Every number here is what your AI cofounder reads before every conversation — keep it current and you'll never have to re-explain your numbers in chat.
      </p>

      {METRIC_GROUPS.map((group) => (
        <div key={group.key} style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontFamily: F.mono, color: C.accent2, letterSpacing: 0.6, marginBottom: 8 }}>
            {group.label.toUpperCase()}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {group.fields.map((f) => (
              <div key={f.key} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 10.5, color: C.muted, fontFamily: F.mono, lineHeight: 1.3 }}>{f.label}</span>
                  <MetricInfoButton info={f.info} onClick={() => setOpenInfo({ label: f.label, info: f.info })} />
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <input
                    type="number"
                    value={draft[f.key] ?? 0}
                    onChange={(e) => update(f.key, e.target.value)}
                    style={{ width: "100%", background: "transparent", border: "none", color: C.text, fontFamily: F.mono, fontSize: 17, padding: 0 }}
                  />
                  {formatUnitHint(f.unit) && <span style={{ fontSize: 11, color: C.muted, fontFamily: F.mono }}>{formatUnitHint(f.unit)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {dirty && (
        <button style={{ ...styles.primaryBtn, width: "100%", marginTop: 4 }} onClick={save}>
          Save changes
        </button>
      )}

      {openInfo && <MetricInfoModal label={openInfo.label} info={openInfo.info} onClose={() => setOpenInfo(null)} />}
    </div>
  );
}
