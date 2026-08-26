// Design tokens — unchanged from the original build. Preserving these
// exactly is what keeps the "mission control / ship's log" identity intact
// through this refactor.

export const C = {
  bg: "#0E1116",
  surface: "#161B22",
  surface2: "#1E2530",
  border: "#2A3140",
  text: "#EDEAE3",
  muted: "#8B93A1",
  accent: "#E3A548",
  accent2: "#4FB0A5",
};

export const F = {
  display: "'Fraunces', Georgia, serif",
  body: "'Inter', -apple-system, sans-serif",
  mono: "'IBM Plex Mono', monospace",
};

export const globalCss = `
* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; padding: 0; background: ${C.bg}; }
body { font-family: ${F.body}; color: ${C.text}; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
::placeholder { color: #5A6272; }
textarea:focus, input:focus { outline: 2px solid ${C.accent}; outline-offset: 1px; }
button:focus-visible { outline: 2px solid ${C.accent}; outline-offset: 2px; }

/* Decision Simulation Best/Expected/Worst cards — stacked on phones,
   three columns on tablets/desktop. Content-driven breakpoint (420px)
   rather than device-specific, so it holds up in any narrow container. */
.scenario-grid { display: grid; grid-template-columns: 1fr; gap: 8px; }
@media (min-width: 420px) {
  .scenario-grid { grid-template-columns: 1fr 1fr 1fr; }
}

/* Shared chat-content column — used by both the conversation/message
   area and the composer, so they can never independently drift apart in
   width. Full viewport width (minus a small safe side margin) on phones
   and tablets; centered and capped at 960px on laptop/desktop, like
   ChatGPT/Claude. No media query needed: width and max-width combine
   naturally — calc(100% - 32px) alone stays under 960px on any viewport
   narrower than ~992px, and max-width only takes over once the viewport
   is wide enough to exceed it. The composer's outer bar
   (.chat-composer-bar) stays full-width so its top border still spans
   the whole panel; only this shared inner column is constrained. */
.chat-content-col { width: calc(100% - 32px); max-width: 960px; margin: 0 auto; }
`;
