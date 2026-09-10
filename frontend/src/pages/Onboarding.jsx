import React, { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  FileText,
  Lightbulb,
  MessageCircle,
  Network,
  Users,
} from "lucide-react";
import { styles } from "../styles/styles";
import { C, F, globalCss } from "../styles/theme";
import { COUNTRIES, COUNTRY_TO_CURRENCY, TERMS_INTRO, TERMS_BODY, todayStr } from "../constants";

/*
 * FounderOS onboarding is intentionally not a form or carousel.
 * It is one compact visual page that explains the product through five
 * small product-style visuals. All founder/company information is learned
 * later through the chat experience.
 */

function MiniChaosVisual() {
  const notes = [
    { label: "Ideas", x: 8, y: 4, r: -8 },
    { label: "Notes", x: 58, y: 0, r: 7 },
    { label: "To-dos", x: 20, y: 48, r: 5 },
    { label: "Research", x: 72, y: 43, r: -5 },
  ];
  return (
    <div className="onboard-visual onboard-chaos">
      <div className="onboard-paper onboard-paper-main"><FileText size={24} /></div>
      {notes.map((n) => (
        <div key={n.label} className="onboard-float-tag" style={{ left: `${n.x}%`, top: `${n.y}%`, transform: `rotate(${n.r}deg)` }}>
          {n.label}
        </div>
      ))}
      <div className="onboard-scribble" />
    </div>
  );
}

function MiniPlanVisual() {
  const rows = ["Validate idea", "Talk to customers", "Refine model", "Build MVP"];
  return (
    <div className="onboard-visual onboard-plan">
      <div className="onboard-plan-window">
        {rows.map((row, i) => (
          <div className="onboard-plan-row" key={row}>
            <span className={`onboard-check ${i === 1 ? "done" : ""}`}>{i === 1 && <Check size={10} strokeWidth={3} />}</span>
            <span>{row}</span>
          </div>
        ))}
      </div>
      <div className="onboard-hand-note">clear next step →</div>
    </div>
  );
}

function MiniConnectedVisual() {
  return (
    <div className="onboard-visual onboard-connected">
      <div className="onboard-connection-line line-a" />
      <div className="onboard-connection-line line-b" />
      <div className="onboard-connection-line line-c" />
      <div className="onboard-connection-core"><Network size={22} /></div>
      <div className="onboard-connection-node node-a"><BarChart3 size={15} /></div>
      <div className="onboard-connection-node node-b"><Users size={15} /></div>
      <div className="onboard-connection-node node-c"><FileText size={15} /></div>
      <div className="onboard-connection-node node-d">$</div>
    </div>
  );
}

function MiniAdvisorVisual() {
  return (
    <div className="onboard-visual onboard-advisor">
      <div className="onboard-chat-bubble user-bubble">Can you help me with pricing?</div>
      <div className="onboard-chat-bubble ai-bubble">Here’s a strategy that could work…</div>
      <div className="onboard-ai-spark"><MessageCircle size={15} /></div>
    </div>
  );
}

function MiniGrowthVisual() {
  return (
    <div className="onboard-visual onboard-growth">
      <div className="onboard-growth-grid" />
      <svg viewBox="0 0 220 110" className="onboard-growth-chart" aria-hidden="true">
        <path d="M14 92 C45 88, 61 79, 85 76 S124 60, 145 51 S178 32, 205 12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {[{ x: 14, y: 92 }, { x: 85, y: 76 }, { x: 145, y: 51 }, { x: 205, y: 12 }].map((p, i) => (
        <span key={i} className="onboard-growth-dot" style={{ left: `${(p.x / 220) * 100}%`, top: `${(p.y / 110) * 100}%` }} />
      ))}
      <span className="onboard-growth-label label-idea">Idea</span>
      <span className="onboard-growth-label label-validation">Validation</span>
      <span className="onboard-growth-label label-growth">Growth</span>
    </div>
  );
}

function BenefitCard({ className = "", visual, title, text }) {
  return (
    <article className={`onboard-benefit ${className}`}>
      {visual}
      <div className="onboard-benefit-copy">
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </article>
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
    <div className="onboard-page">
      <style>{globalCss}</style>
      <style>{`
        .onboard-page {
          min-height: 100vh;
          min-height: 100dvh;
          background:
            radial-gradient(circle at 50% 22%, rgba(112, 71, 255, .12), transparent 28%),
            radial-gradient(circle at 50% 78%, rgba(57, 78, 180, .08), transparent 34%),
            ${C.bg};
          color: ${C.text};
          font-family: ${F.body};
          overflow-x: hidden;
          position: relative;
          padding: 28px 18px 30px;
        }
        .onboard-page::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(180deg, rgba(255,255,255,.018), transparent 35%, rgba(89,65,220,.025));
        }
        .onboard-shell { width: min(100%, 760px); margin: 0 auto; position: relative; z-index: 1; }
        .onboard-top { display: flex; justify-content: space-between; align-items: center; }
        .onboard-brand { display: flex; align-items: center; gap: 8px; font-family: ${F.display}; font-size: 19px; font-weight: 700; }
        .onboard-brand-mark { color: #8f65ff; filter: drop-shadow(0 0 10px rgba(143,101,255,.55)); }
        .onboard-note { color: #a4a9ca; font-size: 11px; letter-spacing: .1px; }
        .onboard-hero { text-align: center; margin: 30px auto 24px; }
        .onboard-kicker { color: #a47dff; font-family: ${F.mono}; font-size: 9px; letter-spacing: 1.6px; text-transform: uppercase; }
        .onboard-hero h1 { margin: 8px 0 5px; font-family: ${F.display}; font-size: clamp(25px, 6vw, 38px); line-height: 1.12; letter-spacing: -.5px; }
        .onboard-hero h1 span { color: #9060ff; }
        .onboard-hero p { margin: 0 auto; max-width: 510px; color: #a7acc7; font-size: 13px; line-height: 1.5; }
        .onboard-benefits { position: relative; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 0 auto; padding: 12px 0 8px; }
        .onboard-benefits::before { content:""; position:absolute; width: 330px; height: 330px; border: 1px solid rgba(122,90,255,.14); border-radius: 50%; left: 50%; top: 50%; transform: translate(-50%,-50%); box-shadow: 0 0 80px rgba(89,65,220,.08); pointer-events:none; }
        .onboard-benefit { min-width: 0; min-height: 205px; position: relative; z-index: 1; overflow: hidden; border: 1px solid rgba(96,105,170,.29); border-radius: 18px; background: linear-gradient(145deg, rgba(20,25,46,.88), rgba(12,16,30,.93)); box-shadow: inset 0 1px 0 rgba(255,255,255,.025), 0 14px 38px rgba(0,0,0,.18); padding: 12px; transform: rotate(var(--tilt, 0deg)); }
        .onboard-benefit:nth-child(1) { --tilt: -1deg; }
        .onboard-benefit:nth-child(2) { --tilt: 1deg; }
        .onboard-benefit:nth-child(3) { --tilt: 1deg; }
        .onboard-benefit:nth-child(4) { --tilt: -1deg; }
        .onboard-benefit-copy { position: relative; z-index: 2; margin-top: 7px; padding: 0 3px; }
        .onboard-benefit h2 { margin: 0; font-family: ${F.display}; font-size: 15px; line-height: 1.2; }
        .onboard-benefit p { margin: 5px 0 0; color: #9ea6c6; font-size: 11px; line-height: 1.42; max-width: 250px; }
        .onboard-benefit-center { grid-column: 1 / -1; width: min(290px, 76%); justify-self: center; margin: -24px 0 -20px; min-height: 215px; z-index: 4; --tilt: 0deg !important; border-color: rgba(139,91,255,.78); box-shadow: 0 0 0 1px rgba(139,91,255,.12), 0 18px 55px rgba(68,38,190,.25), inset 0 1px 0 rgba(255,255,255,.04); background: linear-gradient(145deg, rgba(28,27,62,.98), rgba(13,16,34,.98)); }
        .onboard-benefit-center .onboard-benefit-copy { text-align: center; }
        .onboard-benefit-center h2 { font-size: 19px; }
        .onboard-benefit-center h2 span { color: #9b68ff; }
        .onboard-benefit-center p { margin-left: auto; margin-right: auto; font-size: 11.5px; }
        .onboard-visual { height: 103px; border-radius: 13px; position: relative; overflow: hidden; background: radial-gradient(circle at 50% 50%, rgba(94,73,184,.16), transparent 65%); }
        .onboard-paper { position: absolute; color: #b8b1ff; display:flex; align-items:center; justify-content:center; }
        .onboard-paper-main { left: 38%; top: 19%; width: 58px; height: 70px; border-radius: 7px; background: linear-gradient(145deg, #d5d2ee, #77709c); color: #423d64; transform: rotate(-4deg); box-shadow: 0 8px 20px rgba(0,0,0,.25); }
        .onboard-float-tag { position:absolute; padding: 6px 9px; border-radius: 6px; background: rgba(25,29,55,.94); border: 1px solid rgba(132,117,225,.55); color:#d9d6ff; font-size:9px; box-shadow: 0 5px 16px rgba(0,0,0,.2); }
        .onboard-scribble { position:absolute; width:78px; height:42px; border:2px solid rgba(128,106,219,.7); border-radius:50%; left:35%; top:29%; transform:rotate(-18deg); opacity:.7; }
        .onboard-plan-window { position:absolute; left: 12%; right: 12%; top: 7%; padding: 9px; border-radius: 10px; background: rgba(19,24,48,.92); border: 1px solid rgba(113,122,181,.3); box-shadow: 0 9px 25px rgba(0,0,0,.22); }
        .onboard-plan-row { display:flex; align-items:center; gap:7px; padding: 5px 4px; border-bottom: 1px solid rgba(113,122,181,.13); font-size:9px; color:#c5c8dc; }
        .onboard-plan-row:last-child { border-bottom:0; }
        .onboard-check { width: 12px; height:12px; border-radius:50%; border:1px solid #777fba; display:flex; align-items:center; justify-content:center; flex:0 0 auto; }
        .onboard-check.done { background:#8a5dff; border-color:#a47cff; color:white; box-shadow:0 0 10px rgba(138,93,255,.5); }
        .onboard-hand-note { position:absolute; right:3%; bottom:5%; color:#b18cff; font-family:cursive; font-size:9px; transform:rotate(-7deg); }
        .onboard-connected { min-height:103px; }
        .onboard-connection-core { position:absolute; left:50%; top:50%; width:48px; height:48px; margin:-24px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#bfa9ff; background:rgba(72,55,150,.48); border:1px solid #8d6cff; box-shadow:0 0 25px rgba(114,74,255,.25); }
        .onboard-connection-node { position:absolute; width:30px; height:30px; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#c8c5ed; background:linear-gradient(145deg, #252950, #171b35); border:1px solid rgba(122,131,207,.42); box-shadow:0 5px 15px rgba(0,0,0,.25); font-size:12px; }
        .node-a{left:13%;top:11%}.node-b{right:13%;top:9%}.node-c{left:10%;bottom:9%}.node-d{right:10%;bottom:10%}
        .onboard-connection-line { position:absolute; left:50%; top:50%; height:1px; width:90px; background:linear-gradient(90deg, transparent, rgba(129,104,255,.7), transparent); transform-origin:left center; }
        .line-a{transform:rotate(218deg)}.line-b{transform:rotate(325deg)}.line-c{transform:rotate(142deg)}
        .onboard-advisor { padding: 8px; }
        .onboard-chat-bubble { position:absolute; border-radius:10px; padding:7px 9px; font-size:9px; line-height:1.25; max-width:76%; }
        .user-bubble { left:5%; top:9%; background:rgba(45,50,81,.95); color:#d4d6e6; border:1px solid rgba(124,132,184,.2); }
        .ai-bubble { right:4%; bottom:10%; background:linear-gradient(135deg,#7141ff,#4b2ce0); color:#fff; box-shadow:0 8px 18px rgba(84,45,220,.28); }
        .onboard-ai-spark { position:absolute; left:48%; top:45%; width:26px;height:26px;border-radius:50%; display:flex;align-items:center;justify-content:center; color:#c7b7ff; background:#171735; border:1px solid #805cff; box-shadow:0 0 18px rgba(128,92,255,.5); }
        .onboard-growth-grid { position:absolute; inset:8px; background:repeating-linear-gradient(0deg, transparent 0 23px, rgba(120,128,178,.07) 24px), repeating-linear-gradient(90deg, transparent 0 43px, rgba(120,128,178,.05) 44px); }
        .onboard-growth-chart { position:absolute; inset:6px 8px; width:calc(100% - 16px); height:calc(100% - 12px); color:#a879ff; filter:drop-shadow(0 0 5px rgba(154,104,255,.55)); }
        .onboard-growth-dot { position:absolute; width:7px;height:7px;border-radius:50%; background:#d0bdff; border:2px solid #8d60ff; box-shadow:0 0 10px #8d60ff; transform:translate(-50%,-50%); }
        .onboard-growth-label { position:absolute; color:#a7a8c8; font-size:8px; }.label-idea{left:5%;bottom:9%}.label-validation{left:38%;bottom:28%}.label-growth{right:5%;top:8%}
        .onboard-cta { text-align:center; margin: 25px auto 0; max-width: 390px; }
        .onboard-cta button { width:100%; min-height:48px; border:0; border-radius:999px; color:white; background:linear-gradient(100deg,#7a46ff,#5731ee); font-family:${F.body}; font-size:14px; font-weight:700; cursor:pointer; box-shadow:0 10px 30px rgba(91,48,225,.3); display:flex; justify-content:center; align-items:center; gap:8px; transition:transform .18s ease, box-shadow .18s ease, opacity .18s ease; }
        .onboard-cta button:not(:disabled):active { transform:translateY(1px) scale(.99); }
        .onboard-cta button:disabled { cursor:not-allowed; opacity:.55; box-shadow:none; }
        .onboard-terms { display:flex; justify-content:center; align-items:center; gap:7px; margin-top:11px; color:#858ca8; font-size:10px; }
        .onboard-terms input { width:14px; height:14px; accent-color:#8253ff; margin:0; }
        .onboard-terms a { color:#a77eff; text-decoration:underline; }
        .onboard-foot { text-align:center; margin-top:22px; color:#555c78; font-family:${F.mono}; font-size:8px; letter-spacing:2.5px; line-height:1.8; }
        .onboard-modal-backdrop { position:fixed; inset:0; z-index:50; background:rgba(0,0,0,.68); display:flex; align-items:flex-end; }
        .onboard-modal { width:100%; max-height:78vh; overflow:auto; background:${C.surface}; border-top:1px solid ${C.border}; border-radius:18px 18px 0 0; padding:17px 18px 24px; }
        .onboard-modal-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; font-family:${F.display}; font-size:17px; }
        .onboard-modal-close { border:0; background:transparent; color:${C.muted}; cursor:pointer; }
        @media (max-width: 520px) {
          .onboard-page { padding: 20px 13px 24px; }
          .onboard-note { font-size:10px; }
          .onboard-hero { margin-top:25px; margin-bottom:18px; }
          .onboard-hero h1 { font-size:27px; }
          .onboard-hero p { font-size:11.5px; max-width:340px; }
          .onboard-benefits { gap:9px; padding-top:9px; }
          .onboard-benefit { min-height:175px; padding:9px; border-radius:15px; }
          .onboard-visual { height:86px; }
          .onboard-benefit h2 { font-size:13px; }
          .onboard-benefit p { font-size:9.5px; margin-top:4px; }
          .onboard-benefit-center { width:min(245px, 68%); min-height:184px; margin-top:-20px; margin-bottom:-17px; }
          .onboard-benefit-center h2 { font-size:16px; }
          .onboard-benefit-center p { font-size:10px; }
          .onboard-cta { margin-top:19px; }
          .onboard-cta button { min-height:46px; font-size:13px; }
          .onboard-foot { margin-top:17px; font-size:7px; letter-spacing:2px; }
        }
        @media (max-width: 360px) {
          .onboard-page { padding-left:10px; padding-right:10px; }
          .onboard-benefit { min-height:164px; }
          .onboard-visual { height:78px; }
          .onboard-benefit p { font-size:9px; }
          .onboard-benefit-center { width:64%; min-height:171px; }
          .onboard-float-tag { font-size:8px; padding:5px 6px; }
        }
      `}</style>

      <main className="onboard-shell">
        <header className="onboard-top">
          <div className="onboard-brand"><span className="onboard-brand-mark">✦</span>Founder<span style={{ color: "#8e60ff" }}>OS</span></div>
          <div className="onboard-note">No forms. Just talk.</div>
        </header>

        <section className="onboard-hero">
          <div className="onboard-kicker">Your AI co-founder</div>
          <h1>From chaos to <span>clarity.</span></h1>
          <p>FounderOS helps you think, decide, and move forward — without another complicated setup.</p>
        </section>

        <section className="onboard-benefits" aria-label="How FounderOS helps founders">
          <BenefitCard
            visual={<MiniChaosVisual />}
            title="Too much to figure out?"
            text="Bring your ideas, tasks, and decisions into one place."
          />
          <BenefitCard
            visual={<MiniPlanVisual />}
            title="Not sure what to do next?"
            text="Get clear, personalized next steps for your goals."
          />
          <BenefitCard
            className="onboard-benefit-center"
            visual={<MiniAdvisorVisual />}
            title={<>Build with <span>clarity.</span></>}
            text="Just talk. FounderOS learns your context and helps you move forward."
          />
          <BenefitCard
            visual={<MiniConnectedVisual />}
            title="Everything connected."
            text="Keep your business knowledge in one place and easy to access."
          />
          <BenefitCard
            visual={<MiniGrowthVisual />}
            title="An advisor you can trust."
            text="Think through pricing, customers, strategy, and decisions in chat."
          />
        </section>

        <section className="onboard-cta">
          <button onClick={start} disabled={!agreed || starting}>
            {starting ? "Starting…" : "Start with FounderOS"}
            {!starting && <ArrowRight size={16} />}
          </button>
          <label className="onboard-terms">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>I accept the <a href="#terms" onClick={(e) => { e.preventDefault(); setShowTerms(true); }}>Terms and Conditions</a></span>
          </label>
        </section>

        <footer className="onboard-foot">FOUNDERS BUILD<br />A BRIGHTER TOMORROW</footer>
      </main>

      {showTerms && (
        <div className="onboard-modal-backdrop" onClick={() => setShowTerms(false)}>
          <div className="onboard-modal" onClick={(e) => e.stopPropagation()}>
            <div className="onboard-modal-head">
              <span>Terms & Conditions</span>
              <button className="onboard-modal-close" onClick={() => setShowTerms(false)} aria-label="Close terms">×</button>
            </div>
            <p style={styles.termsP}>{TERMS_INTRO}</p>
            {TERMS_BODY.map((t, i) => <p key={i} style={{ ...styles.termsP, marginTop: 10 }}>{t}</p>)}
          </div>
        </div>
      )}
    </div>
  );
}
