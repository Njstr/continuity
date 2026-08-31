import React from "react";
import { Link2 } from "lucide-react";
import { C, F } from "../styles/theme";

// Renders the real sources a reply was grounded in — always structured
// data from an actual search (see aiService.js's `sources`/`citations`
// fields), never text the model could invent. Deliberately separate from
// the reply bubble itself so "AI analysis" and "Sources" stay visually
// distinct, per the SearXNG integration spec (§7/§8): the founder should
// always be able to see and open exactly what backed an answer.
export function SourcesList({ sources }) {
  if (!sources || !sources.length) return null;
  return (
    <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4, maxWidth: "82%" }}>
      <div style={{ fontSize: 10.5, fontFamily: F.mono, letterSpacing: 0.4, color: C.muted }}>SOURCES</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {sources.slice(0, 8).map((s, i) => {
          let domain = s.url;
          try {
            domain = new URL(s.url).hostname.replace(/^www\./, "");
          } catch {
            // Malformed URL somehow slipped through — fall back to
            // showing the raw string rather than crashing the render;
            // the backend already validates URLs before this ever
            // reaches the frontend (see searxngService.sanitizeUrl), so
            // this is a defensive backstop, not the expected path.
          }
          return (
            <a
              key={`${s.url}-${i}`}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "6px 9px",
                background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8,
                textDecoration: "none", color: C.text, fontSize: 12.5, minWidth: 0,
              }}
            >
              <Link2 size={12} color={C.muted} style={{ flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{s.title || domain}</span>
              <span style={{ color: C.muted, fontSize: 11, flexShrink: 0, marginLeft: "auto" }}>{domain}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
