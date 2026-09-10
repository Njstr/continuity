import React, { useState } from "react";
import { Search, Compass, Brain, BarChart3, RefreshCw, Target, ArrowRight, CheckCircle2, Anchor, Sparkles, X } from "lucide-react";
import { styles } from "../styles/styles";
import { C, F, globalCss } from "../styles/theme";
import { COUNTRIES, COUNTRY_TO_CURRENCY, TERMS_INTRO, TERMS_BODY, todayStr } from "../constants";

// This is a single, non-interactive-required visualization of what
// FounderOS does — not a form. Per the redesign spec, onboarding no
// longer asks the founder for anything; a minimal placeholder profile is
// created here instead, and the founder's actual name/startup/what-
// they're-building gets learned the same way everything else does in
// this product: conversationally, via the execution engine's own
// "tell me what you're building" info-gathering task the moment they
// first arrive in chat (see backend/src/services/executionEngine.js —
// createInfoGatheringTask). Country/currency default to the first option
// and can be corrected any time afterward in More -> Startup Profile —
// this page's whole point is to be understood in ~20 seconds, not to
// collect anything.
//
// This component renders its own <style>{globalCss}</style> (like the
// boot screen does) rather than relying on App.jsx's main render path —
// App.jsx's !companyProfile branch mounts this component standalone,
// before the global stylesheet would otherwise be injected, so the
// responsive/animation CSS classes below (.onboard-*) need it here to
// actually take effect.

const CAPABILITIES = [
  { key: "validate", icon: Search, title: "Validate", phrase: "Find evidence before building", angle: -90 },
  { key: "guide", icon: Compass, title: "Guide", phrase: "Know what to do next", angle: -30 },
  { key: "decide", icon: Brain, title: "Decide", phrase: "Think through important choices", angle: 30 },
  { key: "execute", icon: Target, title: "Execute", phrase: "Turn decisions into action", angle: 90 },
  { key: "measure", icon: BarChart3, title: "Measure", phrase: "Track what actually matters", angle: 150 },
  { key: "learn", icon: RefreshCw, title: "Learn", phrase: "Update your understanding", angle: 210 },
];

// Compact, realistic mini previews of the actual product — not
// illustrations. Validate/Guide/Decide/Measure match the spec's own
// examples; Learn/Execute are designed to match that same register and,
// where possible, reuse real product language (e.g. "Today's task:" is
// the literal opening FounderOS uses when it reveals a task in chat).
function NodePreview({ nodeKey }) {
  const rowStyle = { display: "flex", justifyContent: "space-between", gap: 8, fontSize: 10.5, fontFamily: F.mono, color: C.muted };
  if (nodeKey === "validate") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 8 }}>
        {["Reddit", "Competitors", "Customer pain", "Market signals"].map((r) => (
          <div key={r} style={rowStyle}>
            <span>{r}</span>
            <CheckCircle2 size={11} color={C.accent2} />
          </div>
        ))}
        <div style={{ fontSize: 10.5, fontFamily: F.mono, color: C.accent2, marginTop: 3 }}>Evidence found: 23</div>
      </div>
    );
  }
  if (nodeKey === "guide") {
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 10, fontFamily: F.mono, color: C.muted, letterSpacing: 0.3 }}>NEXT BEST ACTION</div>
        <div style={{ fontSize: 12, marginTop: 3 }}>Interview 5 users</div>
        <div style={{ fontSize: 10, fontFamily: F.mono, color: C.accent, marginTop: 2 }}>High impact · 45 min</div>
      </div>
    );
  }
  if (nodeKey === "decide") {
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12 }}>Build Feature X?</div>
        <div style={{ marginTop: 5 }}>
          <div style={rowStyle}><span>Evidence</span></div>
          <div style={{ height: 4, background: C.border, borderRadius: 2, marginTop: 2, overflow: "hidden" }}>
            <div style={{ width: "78%", height: "100%", background: C.accent2 }} />
          </div>
        </div>
        <div style={{ marginTop: 5 }}>
          <div style={rowStyle}><span>Risk</span></div>
          <div style={{ height: 4, background: C.border, borderRadius: 2, marginTop: 2, overflow: "hidden" }}>
            <div style={{ width: "32%", height: "100%", background: C.accent }} />
          </div>
        </div>
        <div style={{ fontSize: 10, fontFamily: F.mono, color: C.accent2, marginTop: 5 }}>Recommendation: Validate first</div>
      </div>
    );
  }
  if (nodeKey === "measure") {
    return (
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        {[["MRR", "\u20b949.9K"], ["Users", "128"], ["Growth", "+18%"]].map(([label, val]) => (
          <div key={label}>
            <div style={{ fontSize: 9.5, fontFamily: F.mono, color: C.muted }}>{label.toUpperCase()}</div>
            <div style={{ fontSize: 12.5, marginTop: 2 }}>{val}</div>
          </div>
        ))}
      </div>
    );
  }
  if (nodeKey === "learn") {
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12, lineHeight: 1.4 }}>Pattern noticed: pricing comes up in every interview.</div>
        <div style={{ fontSize: 10, fontFamily: F.mono, color: C.accent2, marginTop: 4 }}>3 patterns found</div>
      </div>
    );
  }
  if (nodeKey === "execute") {
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 10, fontFamily: F.mono, color: C.muted, letterSpacing: 0.3 }}>TODAY'S TASK</div>
        <div style={{ fontSize: 12, marginTop: 3 }}>Talk to 5 customers</div>
        <div style={{ display: "flex", gap: 3, marginTop: 5 }}>
          {[1, 1, 1, 0, 0].map((filled, i) => (
            <div key={i} style={{ width: 12, height: 4, borderRadius: 2, background: filled ? C.accent2 : C.border }} />
          ))}
        </div>
      </div>
    );
  }
  return null;
}

function CapabilityNode({ node, style, delay }) {
  const Icon = node.icon;
  return (
    <div
      className="onboard-node"
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: "10px 12px",
        animationDelay: `${delay}ms`,
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Icon size={14} color={C.accent} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>{node.title}</span>
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{node.phrase}</div>
      <NodePreview nodeKey={node.key} />
    </div>
  );
}

// Desktop ring geometry — a fixed pixel stage so the SVG connecting
// lines and the absolutely-positioned node cards agree on exactly the
// same coordinate space.
const STAGE_W = 640;
const STAGE_H = 480;
const CENTER = { x: STAGE_W / 2, y: STAGE_H / 2 };
const RADIUS = 205;
const NODE_W = 172;

function orbitPosition(angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTER.x + RADIUS * Math.cos(rad), y: CENTER.y + RADIUS * Math.sin(rad) };
}

function CenterCard({ style, delay }) {
  return (
    <div
      className="onboard-node"
      style={{
        background: C.surface2, border: `1px solid ${C.accent}55`, borderRadius: 16,
        padding: "18px 20px", animationDelay: `${delay}ms`, ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Sparkles size={14} color={C.accent} />
        <span style={{ fontFamily: F.display, fontSize: 15, fontWeight: 600 }}>FounderOS</span>
      </div>
      <div style={{ fontSize: 10.5, fontFamily: F.mono, color: C.muted, letterSpacing: 0.4, marginTop: 1 }}>AI CO-FOUNDER</div>
      <div style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 12 }}>
        "Your biggest uncertainty right now is whether users will pay for this problem."
      </div>
      <div style={{ fontSize: 10, fontFamily: F.mono, color: C.muted, letterSpacing: 0.3, marginTop: 12 }}>RECOMMENDED NEXT STEP</div>
      <div style={{ fontSize: 12.5, marginTop: 3 }}>Interview 5 potential customers about willingness to pay.</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: C.accent, marginTop: 10, fontWeight: 600 }}>
        Start task <ArrowRight size={12} />
      </div>
    </div>
  );
}

export function Onboarding({ onDone }) {
  const [agreed, setAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [starting, setStarting] = useState(false);

  async function start() {
    if (!agreed || starting) return;
    setStarting(true);
    const country = COUNTRIES[0];
    const companyProfile = {
      founderName: "",
      startupName: "",
      oneLiner: "",
      industry: null,
      businessModel: null,
      stage: null,
      teamSize: null,
      country,
      currency: COUNTRY_TO_CURRENCY[country] || "USD",
      createdAt: todayStr(),
    };
    await onDone(companyProfile, {});
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: F.body, display: "flex", flexDirection: "column", padding: "18px 20px 24px" }}>
      <style>{globalCss}</style>

      {/* Top: wordmark only */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, ...styles.brand }}>
        <Anchor size={16} color={C.accent} />
        <span>Founder<span style={{ color: C.accent, fontStyle: "italic" }}>OS</span></span>
      </div>

      {/* Headline — compact, no long paragraphs */}
      <div style={{ textAlign: "center", marginTop: 18 }}>
        <div style={{ fontSize: 10.5, fontFamily: F.mono, letterSpacing: 1.2, color: C.accent }}>YOUR AI CO-FOUNDER</div>
        <h1 style={{ fontFamily: F.display, fontSize: "clamp(20px, 3.4vw, 28px)", lineHeight: 1.25, margin: "8px auto 0", maxWidth: 620 }}>
          Your AI co-founder for the journey from idea to validated business.
        </h1>
        <p style={{ fontSize: 13, color: C.muted, margin: "8px auto 0", maxWidth: 520, lineHeight: 1.5 }}>
          FounderOS helps you figure out what to validate, what to do next, what to measure, and when to change direction.
        </p>
      </div>

      {/* Centerpiece — desktop orbit */}
      <div className="onboard-orbit-desktop" style={{ position: "relative", width: STAGE_W, maxWidth: "100%", height: STAGE_H, margin: "14px auto 0" }}>
        <svg width={STAGE_W} height={STAGE_H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          {CAPABILITIES.map((node, i) => {
            const p = orbitPosition(node.angle);
            return (
              <line
                key={node.key}
                className="onboard-line"
                x1={CENTER.x}
                y1={CENTER.y}
                x2={p.x}
                y2={p.y}
                stroke={C.border}
                strokeWidth="1.5"
                style={{ animationDelay: `${i * 90}ms` }}
              />
            );
          })}
        </svg>

        {CAPABILITIES.map((node, i) => {
          const p = orbitPosition(node.angle);
          return (
            <CapabilityNode
              key={node.key}
              node={node}
              delay={i * 90 + 150}
              style={{
                position: "absolute",
                width: NODE_W,
                left: p.x,
                top: p.y,
                transform: "translate(-50%, -50%)",
              }}
            />
          );
        })}

        <CenterCard delay={80} style={{ position: "absolute", left: CENTER.x, top: CENTER.y, transform: "translate(-50%, -50%)", width: 300 }} />
      </div>

      {/* Centerpiece — mobile reflow (genuinely different layout, not a shrunk ring) */}
      <div className="onboard-orbit-mobile-wrap" style={{ marginTop: 16 }}>
        <CenterCard delay={0} style={{ maxWidth: 480, margin: "0 auto", padding: "16px 18px" }} />
        <div className="onboard-orbit-mobile" style={{ maxWidth: 480, margin: "10px auto 0" }}>
          {CAPABILITIES.map((node, i) => (
            <CapabilityNode key={node.key} node={node} delay={i * 70} />
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{ textAlign: "center", marginTop: 22, maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
        <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 600 }}>Stop figuring it out alone.</div>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3 }}>Let FounderOS help you figure out what to do next.</div>

        <label style={{ ...styles.agreeRow, justifyContent: "center", marginTop: 14, fontSize: 11.5, color: C.muted }}>
          <input type="checkbox" style={styles.agreeCheckbox} checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            I accept the{" "}
            <a href="#terms" onClick={(e) => { e.preventDefault(); setShowTerms(true); }} style={{ color: C.accent, textDecoration: "underline" }}>
              Terms and Conditions
            </a>
          </span>
        </label>

        <button
          style={{ ...styles.primaryBtn, width: "100%", marginTop: 12, opacity: agreed ? 1 : 0.5, cursor: agreed ? "pointer" : "not-allowed" }}
          onClick={start}
          disabled={!agreed || starting}
        >
          {starting ? "Starting\u2026" : "Start with FounderOS"} {!starting && <ArrowRight size={15} />}
        </button>
        <button
          style={{ background: "transparent", border: "none", color: C.muted, fontSize: 11.5, marginTop: 8, cursor: agreed ? "pointer" : "not-allowed", textDecoration: "underline", opacity: agreed ? 1 : 0.5 }}
          onClick={start}
          disabled={!agreed || starting}
        >
          Skip intro
        </button>
      </div>

      {showTerms && (
        <div
          onClick={() => setShowTerms(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "flex-end" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderRadius: "16px 16px 0 0", padding: "16px 18px 24px", width: "100%", maxHeight: "78vh", display: "flex", flexDirection: "column" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontFamily: F.display, fontSize: 17 }}>Terms & Conditions</span>
              <button onClick={() => setShowTerms(false)} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ overflowY: "auto" }}>
              <p style={styles.termsP}>{TERMS_INTRO}</p>
              {TERMS_BODY.map((t, i) => (
                <p key={i} style={{ ...styles.termsP, marginTop: 10 }}>{t}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
