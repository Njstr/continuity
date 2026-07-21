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
`;
