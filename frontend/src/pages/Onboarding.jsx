import React, { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Search,
  Target,
  Users,
  MessageCircle,
  TrendingUp,
  X,
} from "lucide-react";
import { styles } from "../styles/styles";
import { C, F, globalCss } from "../styles/theme";
import { COUNTRIES, COUNTRY_TO_CURRENCY, TERMS_INTRO, TERMS_BODY, todayStr } from "../constants";

/*
 * FounderOS onboarding
 *
 * This is intentionally a single-page product introduction.
 * It does NOT ask the founder for their name, startup, industry,
 * stage, business model, team size, etc. Those details are learned
 * conversationally after entering Chat.
 *
 * Layout:
 *   [ problem card ]       [ problem card ]
 *
 *              [ central card ]
 *
 *   [ problem card ]       [ problem card ]
 *
 * The central card sits above the four surrounding cards.
 */

const BENEFITS = [
  {
    key: "chaos",
    icon: Search,
    title: "Too much to figure out?",
    description: "Bring your ideas, tasks, and decisions into one place.",
  },
  {
    key: "next",
    icon: Target,
    title: "Not sure what to do next?",
    description: "Get clear, personalized next steps for your goals.",
  },
  {
    key: "connected",
    icon: TrendingUp,
    title: "Everything connected.",
    description: "Keep your business knowledge in one place and easy to access.",
  },
  {
    key: "advisor",
    icon: MessageCircle,
    title: "An advisor you can trust.",
    description: "Chat with your AI co-founder whenever you need to think things through.",
  },
];

function MiniVisual({ type }) {
  if (type === "chaos") {
    return (
      <div className="onboard-visual onboard-chaos">
        {["Ideas", "To-dos", "Notes", "???"].map((label, i) => (
          <div
            key={label}
            className={`onboard-note onboard-note-${i}`}
          >
            {label}
          </div>
        ))}
        <div className="onboard-scribble" />
      </div>
    );
  }

  if (type === "next") {
    return (
      <div className="onboard-visual onboard-checklist">
        {["Validate idea", "Find customers", "Plan roadmap"].map((item, i) => (
          <div className="onboard-check-row" key={item}>
            <span className={`onboard-check ${i === 0 ? "done" : ""}`}>
              {i === 0 && <CheckCircle2 size={13} />}
            </span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    );
  }

  if (type === "connected") {
    return (
      <div className="onboard-visual onboard-connected">
        <div className="onboard-hub">✦</div>
        <div className="onboard-orb onboard-orb-1">▤</div>
        <div className="onboard-orb onboard-orb-2">↗</div>
        <div className="onboard-orb onboard-orb-3">♙</div>
        <div className="onboard-orb onboard-orb-4">$</div>
        <div className="onboard-connect-line line-1" />
        <div className="onboard-connect-line line-2" />
        <div className="onboard-connect-line line-3" />
        <div className="onboard-connect-line line-4" />
      </div>
    );
  }

  return (
    <div className="onboard-visual onboard-chat-preview">
      <div className="onboard-chat-bubble user">Can you help me with pricing?</div>
      <div className="onboard-chat-bubble ai">
        Here's a strategy that could work...
      </div>
      <div className="onboard-spark">✦</div>
    </div>
  );
}

function BenefitCard({ benefit, index }) {
  const Icon = benefit.icon;

  return (
    <div
      className={`onboard-benefit onboard-benefit-${index + 1}`}
      style={{ animationDelay: `${index * 90 + 100}ms` }}
    >
      <div className="onboard-benefit-visual">
        <MiniVisual type={benefit.key} />
      </div>

      <div className="onboard-benefit-copy">
        <div className="onboard-benefit-icon">
          <Icon size={13} />
        </div>
        <h2>{benefit.title}</h2>
        <p>{benefit.description}</p>
      </div>
    </div>
  );
}

function CenterCard() {
  return (
    <div className="onboard-center-card">
      <div className="onboard-center-glow" />

      <div className="onboard-robot">
        <div className="onboard-robot-face">
          <span />
          <span />
        </div>
        <div className="onboard-robot-body">
          <div className="onboard-robot-heart">✦</div>
        </div>
      </div>

      <div className="onboard-center-label">
        <span>✦</span>
        FounderOS
      </div>

      <h2>
        Build with
        <br />
        <span>clarity.</span>
      </h2>

      <p>
        Just talk. FounderOS learns about your business and helps you move
        forward.
      </p>
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

    // Deliberately keep onboarding data-free. Chat learns the founder's
    // identity, company, product, stage, goals, etc. conversationally.
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
          box-sizing: border-box;
          background:
            radial-gradient(circle at 50% 38%, rgba(117, 72, 255, 0.10), transparent 30%),
            radial-gradient(circle at 18% 48%, rgba(66, 91, 255, 0.055), transparent 28%),
            ${C.bg};
          color: ${C.text};
          font-family: ${F.body};
          padding: 28px 20px 32px;
          display: flex;
          flex-direction: column;
          overflow-x: hidden;
        }

        .onboard-page * {
          box-sizing: border-box;
        }

        .onboard-topbar {
          width: min(920px, 100%);
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .onboard-wordmark {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: ${F.display};
          font-size: 19px;
          font-weight: 650;
          letter-spacing: -0.4px;
        }

        .onboard-wordmark-star {
          color: ${C.accent};
          font-size: 22px;
          line-height: 1;
          filter: drop-shadow(0 0 10px ${C.accent}88);
        }

        .onboard-top-note {
          color: ${C.muted};
          font-size: 11px;
          letter-spacing: 0.2px;
        }

        .onboard-heading {
          text-align: center;
          width: min(680px, 100%);
          margin: 38px auto 0;
        }

        .onboard-eyebrow {
          color: ${C.accent};
          font-family: ${F.mono};
          font-size: 10px;
          letter-spacing: 1.8px;
          text-transform: uppercase;
        }

        .onboard-heading h1 {
          margin: 9px 0 0;
          font-family: ${F.display};
          font-size: clamp(29px, 5vw, 46px);
          line-height: 1.08;
          letter-spacing: -1.6px;
          font-weight: 700;
        }

        .onboard-heading h1 span {
          color: ${C.accent};
          text-shadow: 0 0 28px ${C.accent}44;
        }

        .onboard-heading p {
          margin: 12px auto 0;
          max-width: 510px;
          color: ${C.muted};
          font-size: 14px;
          line-height: 1.55;
        }

        .onboard-stage {
          position: relative;
          width: min(700px, 100%);
          height: 620px;
          margin: 28px auto 0;
        }

        .onboard-stage-ring {
          position: absolute;
          width: 360px;
          height: 360px;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          border: 1px solid ${C.accent}22;
          border-radius: 50%;
          box-shadow:
            0 0 70px ${C.accent}08,
            inset 0 0 60px ${C.accent}05;
        }

        .onboard-stage-ring::before,
        .onboard-stage-ring::after {
          content: "";
          position: absolute;
          inset: 25px;
          border: 1px solid ${C.accent}10;
          border-radius: 50%;
        }

        .onboard-stage-ring::after {
          inset: 75px;
          border-color: ${C.accent}12;
        }

        .onboard-benefit {
          position: absolute;
          width: 235px;
          min-height: 245px;
          padding: 14px;
          border: 1px solid ${C.border};
          border-radius: 22px;
          background:
            linear-gradient(145deg, ${C.surface2}, rgba(10, 13, 27, 0.76));
          box-shadow:
            0 18px 50px rgba(0, 0, 0, 0.25),
            0 0 35px ${C.accent}06;
          opacity: 0;
          animation: onboard-card-in 650ms cubic-bezier(.2,.8,.2,1) forwards;
          backdrop-filter: blur(10px);
          z-index: 2;
        }

        .onboard-benefit::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          background: linear-gradient(135deg, ${C.accent}08, transparent 45%);
        }

        .onboard-benefit-1 {
          left: 0;
          top: 34px;
          transform: rotate(-2deg);
        }

        .onboard-benefit-2 {
          right: 0;
          top: 34px;
          transform: rotate(2deg);
        }

        .onboard-benefit-3 {
          left: 0;
          bottom: 34px;
          transform: rotate(2deg);
        }

        .onboard-benefit-4 {
          right: 0;
          bottom: 34px;
          transform: rotate(-2deg);
        }

        .onboard-benefit:hover {
          transform: translateY(-4px) rotate(0deg);
          border-color: ${C.accent}55;
        }

        .onboard-benefit-visual {
          height: 128px;
          border-radius: 15px;
          border: 1px solid ${C.border};
          background: rgba(5, 8, 18, 0.62);
          overflow: hidden;
          position: relative;
        }

        .onboard-benefit-copy {
          position: relative;
          z-index: 2;
          padding: 11px 2px 2px;
        }

        .onboard-benefit-icon {
          display: none;
        }

        .onboard-benefit h2 {
          margin: 0;
          font-family: ${F.display};
          font-size: 17px;
          line-height: 1.2;
          letter-spacing: -0.3px;
        }

        .onboard-benefit p {
          margin: 6px 0 0;
          color: ${C.muted};
          font-size: 11.5px;
          line-height: 1.45;
        }

        /* Central card */
        .onboard-center-card {
          position: absolute;
          width: 250px;
          min-height: 300px;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          z-index: 5;
          border: 1px solid ${C.accent}75;
          border-radius: 27px;
          padding: 22px 20px 19px;
          background:
            radial-gradient(circle at 50% 18%, ${C.accent}18, transparent 32%),
            linear-gradient(145deg, rgba(31, 25, 68, 0.98), rgba(10, 12, 28, 0.98));
          box-shadow:
            0 0 0 1px ${C.accent}10,
            0 22px 70px rgba(0, 0, 0, 0.45),
            0 0 55px ${C.accent}1c;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .onboard-center-glow {
          position: absolute;
          width: 170px;
          height: 170px;
          top: 2px;
          left: 50%;
          transform: translateX(-50%);
          border-radius: 50%;
          background: ${C.accent}12;
          filter: blur(30px);
          pointer-events: none;
        }

        .onboard-robot {
          position: relative;
          width: 76px;
          height: 82px;
          margin-bottom: 8px;
          z-index: 2;
        }

        .onboard-robot-face {
          position: absolute;
          left: 7px;
          top: 7px;
          width: 62px;
          height: 46px;
          border: 2px solid #b7a8ff;
          border-radius: 23px 23px 19px 19px;
          background: #17182e;
          box-shadow: 0 0 24px ${C.accent}38;
        }

        .onboard-robot-face::before {
          content: "";
          position: absolute;
          width: 5px;
          height: 5px;
          left: -7px;
          top: 17px;
          border-radius: 50%;
          background: ${C.accent};
          box-shadow: 71px 0 0 ${C.accent};
        }

        .onboard-robot-face span {
          position: absolute;
          top: 18px;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #bdb3ff;
        }

        .onboard-robot-face span:first-child { left: 19px; }
        .onboard-robot-face span:last-child { right: 19px; }

        .onboard-robot-body {
          position: absolute;
          left: 18px;
          bottom: 0;
          width: 40px;
          height: 31px;
          border-radius: 12px 12px 17px 17px;
          border: 1px solid ${C.accent}77;
          background: #242142;
        }

        .onboard-robot-heart {
          color: ${C.accent};
          font-size: 13px;
          text-align: center;
          margin-top: 7px;
        }

        .onboard-center-label {
          display: flex;
          align-items: center;
          gap: 5px;
          color: ${C.text};
          font-family: ${F.display};
          font-size: 13px;
          font-weight: 650;
          position: relative;
          z-index: 2;
        }

        .onboard-center-label span {
          color: ${C.accent};
        }

        .onboard-center-card h2 {
          margin: 12px 0 0;
          font-family: ${F.display};
          font-size: 29px;
          line-height: 1.04;
          letter-spacing: -1px;
          position: relative;
          z-index: 2;
        }

        .onboard-center-card h2 span {
          color: ${C.accent};
          text-shadow: 0 0 20px ${C.accent}44;
        }

        .onboard-center-card p {
          max-width: 190px;
          margin: 13px 0 0;
          color: ${C.muted};
          font-size: 11.5px;
          line-height: 1.55;
          position: relative;
          z-index: 2;
        }

        /* Mini product visuals */
        .onboard-visual {
          width: 100%;
          height: 100%;
          position: relative;
          overflow: hidden;
        }

        .onboard-note {
          position: absolute;
          padding: 7px 10px;
          border-radius: 8px;
          color: #e8e4ff;
          font-size: 9px;
          background: linear-gradient(145deg, #2b2a4d, #181a32);
          border: 1px solid ${C.accent}45;
          box-shadow: 0 8px 18px rgba(0,0,0,.24);
        }

        .onboard-note-0 { left: 20px; top: 23px; transform: rotate(-7deg); }
        .onboard-note-1 { right: 20px; top: 18px; transform: rotate(8deg); }
        .onboard-note-2 { left: 31px; bottom: 20px; transform: rotate(5deg); }
        .onboard-note-3 { right: 30px; bottom: 25px; transform: rotate(-5deg); }

        .onboard-scribble {
          position: absolute;
          width: 54px;
          height: 42px;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%) rotate(-12deg);
          border: 2px solid ${C.accent}77;
          border-radius: 48% 52% 44% 56%;
          border-right-color: transparent;
          border-bottom-color: ${C.accent}33;
        }

        .onboard-checklist {
          padding: 17px 14px;
        }

        .onboard-check-row {
          height: 29px;
          margin-bottom: 7px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 8px;
          border-radius: 8px;
          background: rgba(31, 34, 61, .8);
          color: #c6c4df;
          font-size: 9.5px;
          border: 1px solid rgba(130, 122, 220, .12);
        }

        .onboard-check {
          width: 13px;
          height: 13px;
          border: 1px solid #77789d;
          border-radius: 50%;
          flex: 0 0 auto;
        }

        .onboard-check.done {
          border-color: ${C.accent};
          color: white;
          display: grid;
          place-items: center;
          background: ${C.accent}cc;
        }

        .onboard-connected .onboard-hub {
          position: absolute;
          width: 38px;
          height: 38px;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          border: 1px solid ${C.accent};
          border-radius: 50%;
          display: grid;
          place-items: center;
          color: ${C.accent};
          background: #1b1835;
          box-shadow: 0 0 22px ${C.accent}35;
          z-index: 2;
        }

        .onboard-orb {
          position: absolute;
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border: 1px solid ${C.accent}55;
          border-radius: 9px;
          color: #d6d0ff;
          background: #1b1d36;
          font-size: 13px;
          z-index: 2;
        }

        .onboard-orb-1 { left: 28px; top: 22px; }
        .onboard-orb-2 { right: 28px; top: 22px; }
        .onboard-orb-3 { left: 28px; bottom: 22px; }
        .onboard-orb-4 { right: 28px; bottom: 22px; }

        .onboard-connect-line {
          position: absolute;
          height: 1px;
          width: 72px;
          background: linear-gradient(90deg, transparent, ${C.accent}66, transparent);
          left: 50%;
          top: 50%;
          transform-origin: left center;
        }

        .line-1 { transform: rotate(-145deg); }
        .line-2 { transform: rotate(-35deg); }
        .line-3 { transform: rotate(145deg); }
        .line-4 { transform: rotate(35deg); }

        .onboard-chat-preview {
          padding: 17px 12px;
        }

        .onboard-chat-bubble {
          max-width: 82%;
          padding: 9px 10px;
          border-radius: 10px;
          font-size: 9px;
          line-height: 1.35;
          position: absolute;
        }

        .onboard-chat-bubble.user {
          right: 12px;
          top: 22px;
          color: #d9d6ef;
          background: #292b4a;
        }

        .onboard-chat-bubble.ai {
          left: 12px;
          bottom: 24px;
          color: white;
          background: linear-gradient(135deg, #6545e9, #4530c5);
          box-shadow: 0 8px 24px ${C.accent}2c;
        }

        .onboard-spark {
          position: absolute;
          right: 12px;
          bottom: 17px;
          color: ${C.accent};
          font-size: 17px;
          filter: drop-shadow(0 0 8px ${C.accent});
        }

        /* CTA */
        .onboard-cta {
          width: min(470px, 100%);
          margin: 0 auto;
          text-align: center;
        }

        .onboard-cta-title {
          font-family: ${F.display};
          font-size: 17px;
          font-weight: 650;
        }

        .onboard-cta-subtitle {
          color: ${C.muted};
          font-size: 11.5px;
          margin-top: 5px;
        }

        .onboard-agree {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 7px;
          margin-top: 15px;
          color: ${C.muted};
          font-size: 11px;
        }

        .onboard-agree input {
          accent-color: ${C.accent};
          width: 14px;
          height: 14px;
        }

        .onboard-agree a {
          color: ${C.accent};
          text-decoration: underline;
        }

        .onboard-start {
          width: 100%;
          margin-top: 12px;
          min-height: 48px;
          border: 0;
          border-radius: 999px;
          background: linear-gradient(100deg, #7448ff, #5335ec);
          color: white;
          font-family: ${F.display};
          font-size: 14px;
          font-weight: 650;
          box-shadow: 0 12px 35px ${C.accent}25;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          transition: transform .18s ease, opacity .18s ease, box-shadow .18s ease;
        }

        .onboard-start:not(:disabled):hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 42px ${C.accent}35;
        }

        .onboard-start:disabled {
          opacity: .45;
          cursor: not-allowed;
        }

        .onboard-note-bottom {
          color: ${C.muted};
          font-size: 10.5px;
          margin-top: 9px;
        }

        .onboard-footer {
          text-align: center;
          margin-top: 28px;
          color: ${C.muted};
          opacity: .5;
          font-family: ${F.mono};
          font-size: 8px;
          letter-spacing: 2.3px;
          line-height: 1.7;
        }

        @keyframes onboard-card-in {
          from { opacity: 0; transform: translateY(16px) scale(.97) rotate(0deg); }
          to { opacity: 1; }
        }

        /* Android/mobile: keep the visuals small and centered rather than
           letting them fill the entire screen. */
        @media (max-width: 700px) {
          .onboard-page {
            padding: 22px 16px 25px;
          }

          .onboard-top-note {
            display: none;
          }

          .onboard-heading {
            margin-top: 29px;
          }

          .onboard-heading h1 {
            font-size: clamp(28px, 8.5vw, 37px);
            letter-spacing: -1px;
          }

          .onboard-heading p {
            font-size: 12.5px;
            max-width: 330px;
          }

          .onboard-stage {
            width: min(500px, 100%);
            height: 535px;
            margin-top: 21px;
          }

          .onboard-stage-ring {
            width: 290px;
            height: 290px;
          }

          .onboard-benefit {
            width: 154px;
            min-height: 184px;
            padding: 9px;
            border-radius: 17px;
          }

          .onboard-benefit-1 {
            left: 0;
            top: 25px;
          }

          .onboard-benefit-2 {
            right: 0;
            top: 25px;
          }

          .onboard-benefit-3 {
            left: 0;
            bottom: 25px;
          }

          .onboard-benefit-4 {
            right: 0;
            bottom: 25px;
          }

          .onboard-benefit-visual {
            height: 88px;
            border-radius: 11px;
          }

          .onboard-benefit h2 {
            font-size: 12.5px;
          }

          .onboard-benefit p {
            font-size: 9px;
            line-height: 1.35;
            margin-top: 4px;
          }

          .onboard-note {
            padding: 5px 7px;
            font-size: 7px;
          }

          .onboard-note-0 { left: 12px; top: 14px; }
          .onboard-note-1 { right: 12px; top: 12px; }
          .onboard-note-2 { left: 18px; bottom: 12px; }
          .onboard-note-3 { right: 18px; bottom: 13px; }

          .onboard-checklist {
            padding: 10px 8px;
          }

          .onboard-check-row {
            height: 20px;
            margin-bottom: 4px;
            padding: 0 5px;
            gap: 5px;
            font-size: 7px;
          }

          .onboard-check {
            width: 9px;
            height: 9px;
          }

          .onboard-check.done svg {
            width: 8px;
            height: 8px;
          }

          .onboard-connected .onboard-hub {
            width: 28px;
            height: 28px;
            font-size: 10px;
          }

          .onboard-orb {
            width: 26px;
            height: 26px;
            font-size: 9px;
            border-radius: 7px;
          }

          .onboard-orb-1 { left: 17px; top: 12px; }
          .onboard-orb-2 { right: 17px; top: 12px; }
          .onboard-orb-3 { left: 17px; bottom: 12px; }
          .onboard-orb-4 { right: 17px; bottom: 12px; }

          .onboard-connect-line {
            width: 49px;
          }

          .onboard-chat-preview {
            padding: 10px 7px;
          }

          .onboard-chat-bubble {
            padding: 6px 7px;
            font-size: 7px;
            border-radius: 7px;
          }

          .onboard-chat-bubble.user {
            right: 7px;
            top: 13px;
          }

          .onboard-chat-bubble.ai {
            left: 7px;
            bottom: 13px;
          }

          .onboard-spark {
            right: 7px;
            bottom: 9px;
            font-size: 12px;
          }

          .onboard-center-card {
            width: 178px;
            min-height: 226px;
            padding: 15px 13px 13px;
            border-radius: 21px;
          }

          .onboard-robot {
            width: 57px;
            height: 61px;
            transform: scale(.76);
            margin-top: -3px;
            margin-bottom: -1px;
          }

          .onboard-center-label {
            font-size: 10px;
          }

          .onboard-center-card h2 {
            font-size: 23px;
            margin-top: 8px;
          }

          .onboard-center-card p {
            max-width: 145px;
            font-size: 9px;
            margin-top: 8px;
            line-height: 1.45;
          }

          .onboard-cta {
            max-width: 330px;
          }

          .onboard-cta-title {
            font-size: 15px;
          }

          .onboard-cta-subtitle {
            font-size: 10px;
          }

          .onboard-start {
            min-height: 46px;
            font-size: 13px;
          }

          .onboard-footer {
            margin-top: 22px;
          }
        }

        @media (max-width: 380px) {
          .onboard-stage {
            height: 505px;
          }

          .onboard-benefit {
            width: 143px;
            min-height: 176px;
          }

          .onboard-center-card {
            width: 168px;
            min-height: 216px;
          }

          .onboard-benefit-1,
          .onboard-benefit-2 {
            top: 20px;
          }

          .onboard-benefit-3,
          .onboard-benefit-4 {
            bottom: 20px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .onboard-benefit {
            animation: none;
            opacity: 1;
          }

          .onboard-start,
          .onboard-benefit {
            transition: none;
          }
        }
      `}</style>

      <header className="onboard-topbar">
        <div className="onboard-wordmark">
          <span className="onboard-wordmark-star">✦</span>
          <span>
            Founder<span style={{ color: C.accent }}>OS</span>
          </span>
        </div>

        <div className="onboard-top-note">No forms. Just talk.</div>
      </header>

      <section className="onboard-heading">
        <div className="onboard-eyebrow">YOUR AI CO-FOUNDER</div>
        <h1>
          From chaos to <span>clarity.</span>
        </h1>
        <p>
          Your co-founder for the real world. Think, decide, validate and
          execute — through one conversation.
        </p>
      </section>

      <section className="onboard-stage" aria-label="FounderOS capabilities">
        <div className="onboard-stage-ring" />

        {BENEFITS.map((benefit, index) => (
          <BenefitCard key={benefit.key} benefit={benefit} index={index} />
        ))}

        <CenterCard />
      </section>

      <section className="onboard-cta">
        <div className="onboard-cta-title">Ready to start building?</div>import React, { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Search,
  Target,
  Users,
  MessageCircle,
  TrendingUp,
  X,
} from "lucide-react";
import { styles } from "../styles/styles";
import { C, F, globalCss } from "../styles/theme";
import { COUNTRIES, COUNTRY_TO_CURRENCY, TERMS_INTRO, TERMS_BODY, todayStr } from "../constants";

/*
 * FounderOS onboarding
 *
 * This is intentionally a single-page product introduction.
 * It does NOT ask the founder for their name, startup, industry,
 * stage, business model, team size, etc. Those details are learned
 * conversationally after entering Chat.
 *
 * Layout:
 *   [ problem card ]       [ problem card ]
 *
 *              [ central card ]
 *
 *   [ problem card ]       [ problem card ]
 *
 * The central card sits above the four surrounding cards.
 */

const BENEFITS = [
  {
    key: "chaos",
    icon: Search,
    title: "Too much to figure out?",
    description: "Bring your ideas, tasks, and decisions into one place.",
  },
  {
    key: "next",
    icon: Target,
    title: "Not sure what to do next?",
    description: "Get clear, personalized next steps for your goals.",
  },
  {
    key: "connected",
    icon: TrendingUp,
    title: "Everything connected.",
    description: "Keep your business knowledge in one place and easy to access.",
  },
  {
    key: "advisor",
    icon: MessageCircle,
    title: "An advisor you can trust.",
    description: "Chat with your AI co-founder whenever you need to think things through.",
  },
];

function MiniVisual({ type }) {
  if (type === "chaos") {
    return (
      <div className="onboard-visual onboard-chaos">
        {["Ideas", "To-dos", "Notes", "???"].map((label, i) => (
          <div
            key={label}
            className={`onboard-note onboard-note-${i}`}
          >
            {label}
          </div>
        ))}
        <div className="onboard-scribble" />
      </div>
    );
  }

  if (type === "next") {
    return (
      <div className="onboard-visual onboard-checklist">
        {["Validate idea", "Find customers", "Plan roadmap"].map((item, i) => (
          <div className="onboard-check-row" key={item}>
            <span className={`onboard-check ${i === 0 ? "done" : ""}`}>
              {i === 0 && <CheckCircle2 size={13} />}
            </span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    );
  }

  if (type === "connected") {
    return (
      <div className="onboard-visual onboard-connected">
        <div className="onboard-hub">✦</div>
        <div className="onboard-orb onboard-orb-1">▤</div>
        <div className="onboard-orb onboard-orb-2">↗</div>
        <div className="onboard-orb onboard-orb-3">♙</div>
        <div className="onboard-orb onboard-orb-4">$</div>
        <div className="onboard-connect-line line-1" />
        <div className="onboard-connect-line line-2" />
        <div className="onboard-connect-line line-3" />
        <div className="onboard-connect-line line-4" />
      </div>
    );
  }

  return (
    <div className="onboard-visual onboard-chat-preview">
      <div className="onboard-chat-bubble user">Can you help me with pricing?</div>
      <div className="onboard-chat-bubble ai">
        Here's a strategy that could work...
      </div>
      <div className="onboard-spark">✦</div>
    </div>
  );
}

function BenefitCard({ benefit, index }) {
  const Icon = benefit.icon;

  return (
    <div
      className={`onboard-benefit onboard-benefit-${index + 1}`}
      style={{ animationDelay: `${index * 90 + 100}ms` }}
    >
      <div className="onboard-benefit-visual">
        <MiniVisual type={benefit.key} />
      </div>

      <div className="onboard-benefit-copy">
        <div className="onboard-benefit-icon">
          <Icon size={13} />
        </div>
        <h2>{benefit.title}</h2>
        <p>{benefit.description}</p>
      </div>
    </div>
  );
}

function CenterCard() {
  return (
    <div className="onboard-center-card">
      <div className="onboard-center-glow" />

      <div className="onboard-robot">
        <div className="onboard-robot-face">
          <span />
          <span />
        </div>
        <div className="onboard-robot-body">
          <div className="onboard-robot-heart">✦</div>
        </div>
      </div>

      <div className="onboard-center-label">
        <span>✦</span>
        FounderOS
      </div>

      <h2>
        Build with
        <br />
        <span>clarity.</span>
      </h2>

      <p>
        Just talk. FounderOS learns about your business and helps you move
        forward.
      </p>
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

    // Deliberately keep onboarding data-free. Chat learns the founder's
    // identity, company, product, stage, goals, etc. conversationally.
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
          box-sizing: border-box;
          background:
            radial-gradient(circle at 50% 38%, rgba(117, 72, 255, 0.10), transparent 30%),
            radial-gradient(circle at 18% 48%, rgba(66, 91, 255, 0.055), transparent 28%),
            ${C.bg};
          color: ${C.text};
          font-family: ${F.body};
          padding: 28px 20px 32px;
          display: flex;
          flex-direction: column;
          overflow-x: hidden;
        }

        .onboard-page * {
          box-sizing: border-box;
        }

        .onboard-topbar {
          width: min(920px, 100%);
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .onboard-wordmark {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: ${F.display};
          font-size: 19px;
          font-weight: 650;
          letter-spacing: -0.4px;
        }

        .onboard-wordmark-star {
          color: ${C.accent};
          font-size: 22px;
          line-height: 1;
          filter: drop-shadow(0 0 10px ${C.accent}88);
        }

        .onboard-top-note {
          color: ${C.muted};
          font-size: 11px;
          letter-spacing: 0.2px;
        }

        .onboard-heading {
          text-align: center;
          width: min(680px, 100%);
          margin: 38px auto 0;
        }

        .onboard-eyebrow {
          color: ${C.accent};
          font-family: ${F.mono};
          font-size: 10px;
          letter-spacing: 1.8px;
          text-transform: uppercase;
        }

        .onboard-heading h1 {
          margin: 9px 0 0;
          font-family: ${F.display};
          font-size: clamp(29px, 5vw, 46px);
          line-height: 1.08;
          letter-spacing: -1.6px;
          font-weight: 700;
        }

        .onboard-heading h1 span {
          color: ${C.accent};
          text-shadow: 0 0 28px ${C.accent}44;
        }

        .onboard-heading p {
          margin: 12px auto 0;
          max-width: 510px;
          color: ${C.muted};
          font-size: 14px;
          line-height: 1.55;
        }

        .onboard-stage {
          position: relative;
          width: min(700px, 100%);
          height: 620px;
          margin: 28px auto 0;
        }

        .onboard-stage-ring {
          position: absolute;
          width: 360px;
          height: 360px;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          border: 1px solid ${C.accent}22;
          border-radius: 50%;
          box-shadow:
            0 0 70px ${C.accent}08,
            inset 0 0 60px ${C.accent}05;
        }

        .onboard-stage-ring::before,
        .onboard-stage-ring::after {
          content: "";
          position: absolute;
          inset: 25px;
          border: 1px solid ${C.accent}10;
          border-radius: 50%;
        }

        .onboard-stage-ring::after {
          inset: 75px;
          border-color: ${C.accent}12;
        }

        .onboard-benefit {
          position: absolute;
          width: 235px;
          min-height: 245px;
          padding: 14px;
          border: 1px solid ${C.border};
          border-radius: 22px;
          background:
            linear-gradient(145deg, ${C.surface2}, rgba(10, 13, 27, 0.76));
          box-shadow:
            0 18px 50px rgba(0, 0, 0, 0.25),
            0 0 35px ${C.accent}06;
          opacity: 0;
          animation: onboard-card-in 650ms cubic-bezier(.2,.8,.2,1) forwards;
          backdrop-filter: blur(10px);
          z-index: 2;
        }

        .onboard-benefit::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          background: linear-gradient(135deg, ${C.accent}08, transparent 45%);
        }

        .onboard-benefit-1 {
          left: 0;
          top: 34px;
          transform: rotate(-2deg);
        }

        .onboard-benefit-2 {
          right: 0;
          top: 34px;
          transform: rotate(2deg);
        }

        .onboard-benefit-3 {
          left: 0;
          bottom: 34px;
          transform: rotate(2deg);
        }

        .onboard-benefit-4 {
          right: 0;
          bottom: 34px;
          transform: rotate(-2deg);
        }

        .onboard-benefit:hover {
          transform: translateY(-4px) rotate(0deg);
          border-color: ${C.accent}55;
        }

        .onboard-benefit-visual {
          height: 128px;
          border-radius: 15px;
          border: 1px solid ${C.border};
          background: rgba(5, 8, 18, 0.62);
          overflow: hidden;
          position: relative;
        }

        .onboard-benefit-copy {
          position: relative;
          z-index: 2;
          padding: 11px 2px 2px;
        }

        .onboard-benefit-icon {
          display: none;
        }

        .onboard-benefit h2 {
          margin: 0;
          font-family: ${F.display};
          font-size: 17px;
          line-height: 1.2;
          letter-spacing: -0.3px;
        }

        .onboard-benefit p {
          margin: 6px 0 0;
          color: ${C.muted};
          font-size: 11.5px;
          line-height: 1.45;
        }

        /* Central card */
        .onboard-center-card {
          position: absolute;
          width: 250px;
          min-height: 300px;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          z-index: 5;
          border: 1px solid ${C.accent}75;
          border-radius: 27px;
          padding: 22px 20px 19px;
          background:
            radial-gradient(circle at 50% 18%, ${C.accent}18, transparent 32%),
            linear-gradient(145deg, rgba(31, 25, 68, 0.98), rgba(10, 12, 28, 0.98));
          box-shadow:
            0 0 0 1px ${C.accent}10,
            0 22px 70px rgba(0, 0, 0, 0.45),
            0 0 55px ${C.accent}1c;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .onboard-center-glow {
          position: absolute;
          width: 170px;
          height: 170px;
          top: 2px;
          left: 50%;
          transform: translateX(-50%);
          border-radius: 50%;
          background: ${C.accent}12;
          filter: blur(30px);
          pointer-events: none;
        }

        .onboard-robot {
          position: relative;
          width: 76px;
          height: 82px;
          margin-bottom: 8px;
          z-index: 2;
        }

        .onboard-robot-face {
          position: absolute;
          left: 7px;
          top: 7px;
          width: 62px;
          height: 46px;
          border: 2px solid #b7a8ff;
          border-radius: 23px 23px 19px 19px;
          background: #17182e;
          box-shadow: 0 0 24px ${C.accent}38;
        }

        .onboard-robot-face::before {
          content: "";
          position: absolute;
          width: 5px;
          height: 5px;
          left: -7px;
          top: 17px;
          border-radius: 50%;
          background: ${C.accent};
          box-shadow: 71px 0 0 ${C.accent};
        }

        .onboard-robot-face span {
          position: absolute;
          top: 18px;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #bdb3ff;
        }

        .onboard-robot-face span:first-child { left: 19px; }
        .onboard-robot-face span:last-child { right: 19px; }

        .onboard-robot-body {
          position: absolute;
          left: 18px;
          bottom: 0;
          width: 40px;
          height: 31px;
          border-radius: 12px 12px 17px 17px;
          border: 1px solid ${C.accent}77;
          background: #242142;
        }

        .onboard-robot-heart {
          color: ${C.accent};
          font-size: 13px;
          text-align: center;
          margin-top: 7px;
        }

        .onboard-center-label {
          display: flex;
          align-items: center;
          gap: 5px;
          color: ${C.text};
          font-family: ${F.display};
          font-size: 13px;
          font-weight: 650;
          position: relative;
          z-index: 2;
        }

        .onboard-center-label span {
          color: ${C.accent};
        }

        .onboard-center-card h2 {
          margin: 12px 0 0;
          font-family: ${F.display};
          font-size: 29px;
          line-height: 1.04;
          letter-spacing: -1px;
          position: relative;
          z-index: 2;
        }

        .onboard-center-card h2 span {
          color: ${C.accent};
          text-shadow: 0 0 20px ${C.accent}44;
        }

        .onboard-center-card p {
          max-width: 190px;
          margin: 13px 0 0;
          color: ${C.muted};
          font-size: 11.5px;
          line-height: 1.55;
          position: relative;
          z-index: 2;
        }

        /* Mini product visuals */
        .onboard-visual {
          width: 100%;
          height: 100%;
          position: relative;
          overflow: hidden;
        }

        .onboard-note {
          position: absolute;
          padding: 7px 10px;
          border-radius: 8px;
          color: #e8e4ff;
          font-size: 9px;
          background: linear-gradient(145deg, #2b2a4d, #181a32);
          border: 1px solid ${C.accent}45;
          box-shadow: 0 8px 18px rgba(0,0,0,.24);
        }

        .onboard-note-0 { left: 20px; top: 23px; transform: rotate(-7deg); }
        .onboard-note-1 { right: 20px; top: 18px; transform: rotate(8deg); }
        .onboard-note-2 { left: 31px; bottom: 20px; transform: rotate(5deg); }
        .onboard-note-3 { right: 30px; bottom: 25px; transform: rotate(-5deg); }

        .onboard-scribble {
          position: absolute;
          width: 54px;
          height: 42px;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%) rotate(-12deg);
          border: 2px solid ${C.accent}77;
          border-radius: 48% 52% 44% 56%;
          border-right-color: transparent;
          border-bottom-color: ${C.accent}33;
        }

        .onboard-checklist {
          padding: 17px 14px;
        }

        .onboard-check-row {
          height: 29px;
          margin-bottom: 7px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 8px;
          border-radius: 8px;
          background: rgba(31, 34, 61, .8);
          color: #c6c4df;
          font-size: 9.5px;
          border: 1px solid rgba(130, 122, 220, .12);
        }

        .onboard-check {
          width: 13px;
          height: 13px;
          border: 1px solid #77789d;
          border-radius: 50%;
          flex: 0 0 auto;
        }

        .onboard-check.done {
          border-color: ${C.accent};
          color: white;
          display: grid;
          place-items: center;
          background: ${C.accent}cc;
        }

        .onboard-connected .onboard-hub {
          position: absolute;
          width: 38px;
          height: 38px;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          border: 1px solid ${C.accent};
          border-radius: 50%;
          display: grid;
          place-items: center;
          color: ${C.accent};
          background: #1b1835;
          box-shadow: 0 0 22px ${C.accent}35;
          z-index: 2;
        }

        .onboard-orb {
          position: absolute;
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border: 1px solid ${C.accent}55;
          border-radius: 9px;
          color: #d6d0ff;
          background: #1b1d36;
          font-size: 13px;
          z-index: 2;
        }

        .onboard-orb-1 { left: 28px; top: 22px; }
        .onboard-orb-2 { right: 28px; top: 22px; }
        .onboard-orb-3 { left: 28px; bottom: 22px; }
        .onboard-orb-4 { right: 28px; bottom: 22px; }

        .onboard-connect-line {
          position: absolute;
          height: 1px;
          width: 72px;
          background: linear-gradient(90deg, transparent, ${C.accent}66, transparent);
          left: 50%;
          top: 50%;
          transform-origin: left center;
        }

        .line-1 { transform: rotate(-145deg); }
        .line-2 { transform: rotate(-35deg); }
        .line-3 { transform: rotate(145deg); }
        .line-4 { transform: rotate(35deg); }

        .onboard-chat-preview {
          padding: 17px 12px;
        }

        .onboard-chat-bubble {
          max-width: 82%;
          padding: 9px 10px;
          border-radius: 10px;
          font-size: 9px;
          line-height: 1.35;
          position: absolute;
        }

        .onboard-chat-bubble.user {
          right: 12px;
          top: 22px;
          color: #d9d6ef;
          background: #292b4a;
        }

        .onboard-chat-bubble.ai {
          left: 12px;
          bottom: 24px;
          color: white;
          background: linear-gradient(135deg, #6545e9, #4530c5);
          box-shadow: 0 8px 24px ${C.accent}2c;
        }

        .onboard-spark {
          position: absolute;
          right: 12px;
          bottom: 17px;
          color: ${C.accent};
          font-size: 17px;
          filter: drop-shadow(0 0 8px ${C.accent});
        }

        /* CTA */
        .onboard-cta {
          width: min(470px, 100%);
          margin: 0 auto;
          text-align: center;
        }

        .onboard-cta-title {
          font-family: ${F.display};
          font-size: 17px;
          font-weight: 650;
        }

        .onboard-cta-subtitle {
          color: ${C.muted};
          font-size: 11.5px;
          margin-top: 5px;
        }

        .onboard-agree {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 7px;
          margin-top: 15px;
          color: ${C.muted};
          font-size: 11px;
        }

        .onboard-agree input {
          accent-color: ${C.accent};
          width: 14px;
          height: 14px;
        }

        .onboard-agree a {
          color: ${C.accent};
          text-decoration: underline;
        }

        .onboard-start {
          width: 100%;
          margin-top: 12px;
          min-height: 48px;
          border: 0;
          border-radius: 999px;
          background: linear-gradient(100deg, #7448ff, #5335ec);
          color: white;
          font-family: ${F.display};
          font-size: 14px;
          font-weight: 650;
          box-shadow: 0 12px 35px ${C.accent}25;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          transition: transform .18s ease, opacity .18s ease, box-shadow .18s ease;
        }

        .onboard-start:not(:disabled):hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 42px ${C.accent}35;
        }

        .onboard-start:disabled {
          opacity: .45;
          cursor: not-allowed;
        }

        .onboard-note-bottom {
          color: ${C.muted};
          font-size: 10.5px;
          margin-top: 9px;
        }

        .onboard-footer {
          text-align: center;
          margin-top: 28px;
          color: ${C.muted};
          opacity: .5;
          font-family: ${F.mono};
          font-size: 8px;
          letter-spacing: 2.3px;
          line-height: 1.7;
        }

        @keyframes onboard-card-in {
          from { opacity: 0; transform: translateY(16px) scale(.97) rotate(0deg); }
          to { opacity: 1; }
        }

        /* Android/mobile: keep the visuals small and centered rather than
           letting them fill the entire screen. */
        @media (max-width: 700px) {
          .onboard-page {
            padding: 22px 16px 25px;
          }

          .onboard-top-note {
            display: none;
          }

          .onboard-heading {
            margin-top: 29px;
          }

          .onboard-heading h1 {
            font-size: clamp(28px, 8.5vw, 37px);
            letter-spacing: -1px;
          }

          .onboard-heading p {
            font-size: 12.5px;
            max-width: 330px;
          }

          .onboard-stage {
            width: min(500px, 100%);
            height: 535px;
            margin-top: 21px;
          }

          .onboard-stage-ring {
            width: 290px;
            height: 290px;
          }

          .onboard-benefit {
            width: 154px;
            min-height: 184px;
            padding: 9px;
            border-radius: 17px;
          }

          .onboard-benefit-1 {
            left: 0;
            top: 25px;
          }

          .onboard-benefit-2 {
            right: 0;
            top: 25px;
          }

          .onboard-benefit-3 {
            left: 0;
            bottom: 25px;
          }

          .onboard-benefit-4 {
            right: 0;
            bottom: 25px;
          }

          .onboard-benefit-visual {
            height: 88px;
            border-radius: 11px;
          }

          .onboard-benefit h2 {
            font-size: 12.5px;
          }

          .onboard-benefit p {
            font-size: 9px;
            line-height: 1.35;
            margin-top: 4px;
          }

          .onboard-note {
            padding: 5px 7px;
            font-size: 7px;
          }

          .onboard-note-0 { left: 12px; top: 14px; }
          .onboard-note-1 { right: 12px; top: 12px; }
          .onboard-note-2 { left: 18px; bottom: 12px; }
          .onboard-note-3 { right: 18px; bottom: 13px; }

          .onboard-checklist {
            padding: 10px 8px;
          }

          .onboard-check-row {
            height: 20px;
            margin-bottom: 4px;
            padding: 0 5px;
            gap: 5px;
            font-size: 7px;
          }

          .onboard-check {
            width: 9px;
            height: 9px;
          }

          .onboard-check.done svg {
            width: 8px;
            height: 8px;
          }

          .onboard-connected .onboard-hub {
            width: 28px;
            height: 28px;
            font-size: 10px;
          }

          .onboard-orb {
            width: 26px;
            height: 26px;
            font-size: 9px;
            border-radius: 7px;
          }

          .onboard-orb-1 { left: 17px; top: 12px; }
          .onboard-orb-2 { right: 17px; top: 12px; }
          .onboard-orb-3 { left: 17px; bottom: 12px; }
          .onboard-orb-4 { right: 17px; bottom: 12px; }

          .onboard-connect-line {
            width: 49px;
          }

          .onboard-chat-preview {
            padding: 10px 7px;
          }

          .onboard-chat-bubble {
            padding: 6px 7px;
            font-size: 7px;
            border-radius: 7px;
          }

          .onboard-chat-bubble.user {
            right: 7px;
            top: 13px;
          }

          .onboard-chat-bubble.ai {
            left: 7px;
            bottom: 13px;
          }

          .onboard-spark {
            right: 7px;
            bottom: 9px;
            font-size: 12px;
          }

          .onboard-center-card {
            width: 178px;
            min-height: 226px;
            padding: 15px 13px 13px;
            border-radius: 21px;
          }

          .onboard-robot {
            width: 57px;
            height: 61px;
            transform: scale(.76);
            margin-top: -3px;
            margin-bottom: -1px;
          }

          .onboard-center-label {
            font-size: 10px;
          }

          .onboard-center-card h2 {
            font-size: 23px;
            margin-top: 8px;
          }

          .onboard-center-card p {
            max-width: 145px;
            font-size: 9px;
            margin-top: 8px;
            line-height: 1.45;
          }

          .onboard-cta {
            max-width: 330px;
          }

          .onboard-cta-title {
            font-size: 15px;
          }

          .onboard-cta-subtitle {
            font-size: 10px;
          }

          .onboard-start {
            min-height: 46px;
            font-size: 13px;
          }

          .onboard-footer {
            margin-top: 22px;
          }
        }

        @media (max-width: 380px) {
          .onboard-stage {
            height: 505px;
          }

          .onboard-benefit {
            width: 143px;
            min-height: 176px;
          }

          .onboard-center-card {
            width: 168px;
            min-height: 216px;
          }

          .onboard-benefit-1,
          .onboard-benefit-2 {
            top: 20px;
          }

          .onboard-benefit-3,
          .onboard-benefit-4 {
            bottom: 20px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .onboard-benefit {
            animation: none;
            opacity: 1;
          }

          .onboard-start,
          .onboard-benefit {
            transition: none;
          }
        }
      `}</style>

      <header className="onboard-topbar">
        <div className="onboard-wordmark">
          <span className="onboard-wordmark-star">✦</span>
          <span>
            Founder<span style={{ color: C.accent }}>OS</span>
          </span>
        </div>

        <div className="onboard-top-note">No forms. Just talk.</div>
      </header>

      <section className="onboard-heading">
        <div className="onboard-eyebrow">YOUR AI CO-FOUNDER</div>
        <h1>
          From chaos to <span>clarity.</span>
        </h1>
        <p>
          Your co-founder for the real world. Think, decide, validate and
          execute — through one conversation.
        </p>
      </section>

      <section className="onboard-stage" aria-label="FounderOS capabilities">
        <div className="onboard-stage-ring" />

        {BENEFITS.map((benefit, index) => (
          <BenefitCard key={benefit.key} benefit={benefit} index={index} />
        ))}

        <CenterCard />
      </section>

      <section className="onboard-cta">
        <div className="onboard-cta-title">Ready to start building?</div>
        <div className="onboard-cta-subtitle">
          No onboarding forms. Just a conversation.
        </div>

        <label className="onboard-agree">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>
            I accept the{" "}
            <a
              href="#terms"
              onClick={(e) => {
                e.preventDefault();
                setShowTerms(true);
              }}
            >
              Terms and Conditions
            </a>
          </span>
        </label>

        <button
          className="onboard-start"
          onClick={start}
          disabled={!agreed || starting}
        >
          {starting ? "Starting…" : "Start with FounderOS"}
          {!starting && <ArrowRight size={15} />}
        </button>

        <div className="onboard-note-bottom">
          FounderOS learns about your company inside Chat.
        </div>
      </section>

      <footer className="onboard-footer">
        FOUNDERS BUILD
        <br />
        A BRIGHTER TOMORROW
      </footer>

      {showTerms && (
        <div
          onClick={() => setShowTerms(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.68)",
            zIndex: 50,
            display: "flex",
            alignItems: "flex-end",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: C.surface,
              borderTop: `1px solid ${C.border}`,
              borderRadius: "16px 16px 0 0",
              padding: "16px 18px 24px",
              width: "100%",
              maxHeight: "78vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <span style={{ fontFamily: F.display, fontSize: 17 }}>
                Terms & Conditions
              </span>

              <button
                onClick={() => setShowTerms(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: C.muted,
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ overflowY: "auto" }}>
              <p style={styles.termsP}>{TERMS_INTRO}</p>

              {TERMS_BODY.map((t, i) => (
                <p
                  key={i}
                  style={{ ...styles.termsP, marginTop: 10 }}
                >
                  {t}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import React, { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Search,
  Target,
  Users,
  MessageCircle,
  TrendingUp,
  X,
} from "lucide-react";
import { styles } from "../styles/styles";
import { C, F, globalCss } from "../styles/theme";
import { COUNTRIES, COUNTRY_TO_CURRENCY, TERMS_INTRO, TERMS_BODY, todayStr } from "../constants";

/*
 * FounderOS onboarding
 *
 * This is intentionally a single-page product introduction.
 * It does NOT ask the founder for their name, startup, industry,
 * stage, business model, team size, etc. Those details are learned
 * conversationally after entering Chat.
 *
 * Layout:
 *   [ problem card ]       [ problem card ]
 *
 *              [ central card ]
 *
 *   [ problem card ]       [ problem card ]
 *
 * The central card sits above the four surrounding cards.
 */

const BENEFITS = [
  {
    key: "chaos",
    icon: Search,
    title: "Too much to figure out?",
    description: "Bring your ideas, tasks, and decisions into one place.",
  },
  {
    key: "next",
    icon: Target,
    title: "Not sure what to do next?",
    description: "Get clear, personalized next steps for your goals.",
  },
  {
    key: "connected",
    icon: TrendingUp,
    title: "Everything connected.",
    description: "Keep your business knowledge in one place and easy to access.",
  },
  {
    key: "advisor",
    icon: MessageCircle,
    title: "An advisor you can trust.",
    description: "Chat with your AI co-founder whenever you need to think things through.",
  },
];

function MiniVisual({ type }) {
  if (type === "chaos") {
    return (
      <div className="onboard-visual onboard-chaos">
        {["Ideas", "To-dos", "Notes", "???"].map((label, i) => (
          <div
            key={label}
            className={`onboard-note onboard-note-${i}`}
          >
            {label}
          </div>
        ))}
        <div className="onboard-scribble" />
      </div>
    );
  }

  if (type === "next") {
    return (
      <div className="onboard-visual onboard-checklist">
        {["Validate idea", "Find customers", "Plan roadmap"].map((item, i) => (
          <div className="onboard-check-row" key={item}>
            <span className={`onboard-check ${i === 0 ? "done" : ""}`}>
              {i === 0 && <CheckCircle2 size={13} />}
            </span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    );
  }

  if (type === "connected") {
    return (
      <div className="onboard-visual onboard-connected">
        <div className="onboard-hub">✦</div>
        <div className="onboard-orb onboard-orb-1">▤</div>
        <div className="onboard-orb onboard-orb-2">↗</div>
        <div className="onboard-orb onboard-orb-3">♙</div>
        <div className="onboard-orb onboard-orb-4">$</div>
        <div className="onboard-connect-line line-1" />
        <div className="onboard-connect-line line-2" />
        <div className="onboard-connect-line line-3" />
        <div className="onboard-connect-line line-4" />
      </div>
    );
  }

  return (
    <div className="onboard-visual onboard-chat-preview">
      <div className="onboard-chat-bubble user">Can you help me with pricing?</div>
      <div className="onboard-chat-bubble ai">
        Here's a strategy that could work...
      </div>
      <div className="onboard-spark">✦</div>
    </div>
  );
}

function BenefitCard({ benefit, index }) {
  const Icon = benefit.icon;

  return (
    <div
      className={`onboard-benefit onboard-benefit-${index + 1}`}
      style={{ animationDelay: `${index * 90 + 100}ms` }}
    >
      <div className="onboard-benefit-visual">
        <MiniVisual type={benefit.key} />
      </div>

      <div className="onboard-benefit-copy">
        <div className="onboard-benefit-icon">
          <Icon size={13} />
        </div>
        <h2>{benefit.title}</h2>
        <p>{benefit.description}</p>
      </div>
    </div>
  );
}

function CenterCard() {
  return (
    <div className="onboard-center-card">
      <div className="onboard-center-glow" />

      <div className="onboard-robot">
        <div className="onboard-robot-face">
          <span />
          <span />
        </div>
        <div className="onboard-robot-body">
          <div className="onboard-robot-heart">✦</div>
        </div>
      </div>

      <div className="onboard-center-label">
        <span>✦</span>
        FounderOS
      </div>

      <h2>
        Build with
        <br />
        <span>clarity.</span>
      </h2>

      <p>
        Just talk. FounderOS learns about your business and helps you move
        forward.
      </p>
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

    // Deliberately keep onboarding data-free. Chat learns the founder's
    // identity, company, product, stage, goals, etc. conversationally.
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
          box-sizing: border-box;
          background:
            radial-gradient(circle at 50% 38%, rgba(117, 72, 255, 0.10), transparent 30%),
            radial-gradient(circle at 18% 48%, rgba(66, 91, 255, 0.055), transparent 28%),
            ${C.bg};
          color: ${C.text};
          font-family: ${F.body};
          padding: 28px 20px 32px;
          display: flex;
          flex-direction: column;
          overflow-x: hidden;
        }

        .onboard-page * {
          box-sizing: border-box;
        }

        .onboard-topbar {
          width: min(920px, 100%);
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .onboard-wordmark {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: ${F.display};
          font-size: 19px;
          font-weight: 650;
          letter-spacing: -0.4px;
        }

        .onboard-wordmark-star {
          color: ${C.accent};
          font-size: 22px;
          line-height: 1;
          filter: drop-shadow(0 0 10px ${C.accent}88);
        }

        .onboard-top-note {
          color: ${C.muted};
          font-size: 11px;
          letter-spacing: 0.2px;
        }

        .onboard-heading {
          text-align: center;
          width: min(680px, 100%);
          margin: 38px auto 0;
        }

        .onboard-eyebrow {
          color: ${C.accent};
          font-family: ${F.mono};
          font-size: 10px;
          letter-spacing: 1.8px;
          text-transform: uppercase;
        }

        .onboard-heading h1 {
          margin: 9px 0 0;
          font-family: ${F.display};
          font-size: clamp(29px, 5vw, 46px);
          line-height: 1.08;
          letter-spacing: -1.6px;
          font-weight: 700;
        }

        .onboard-heading h1 span {
          color: ${C.accent};
          text-shadow: 0 0 28px ${C.accent}44;
        }

        .onboard-heading p {
          margin: 12px auto 0;
          max-width: 510px;
          color: ${C.muted};
          font-size: 14px;
          line-height: 1.55;
        }

        .onboard-stage {
          position: relative;
          width: min(700px, 100%);
          height: 620px;
          margin: 28px auto 0;
        }

        .onboard-stage-ring {
          position: absolute;
          width: 360px;
          height: 360px;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          border: 1px solid ${C.accent}22;
          border-radius: 50%;
          box-shadow:
            0 0 70px ${C.accent}08,
            inset 0 0 60px ${C.accent}05;
        }

        .onboard-stage-ring::before,
        .onboard-stage-ring::after {
          content: "";
          position: absolute;
          inset: 25px;
          border: 1px solid ${C.accent}10;
          border-radius: 50%;
        }

        .onboard-stage-ring::after {
          inset: 75px;
          border-color: ${C.accent}12;
        }

        .onboard-benefit {
          position: absolute;
          width: 235px;
          min-height: 245px;
          padding: 14px;
          border: 1px solid ${C.border};
          border-radius: 22px;
          background:
            linear-gradient(145deg, ${C.surface2}, rgba(10, 13, 27, 0.76));
          box-shadow:
            0 18px 50px rgba(0, 0, 0, 0.25),
            0 0 35px ${C.accent}06;
          opacity: 0;
          animation: onboard-card-in 650ms cubic-bezier(.2,.8,.2,1) forwards;
          backdrop-filter: blur(10px);
          z-index: 2;
        }

        .onboard-benefit::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          background: linear-gradient(135deg, ${C.accent}08, transparent 45%);
        }

        .onboard-benefit-1 {
          left: 0;
          top: 34px;
          transform: rotate(-2deg);
        }

        .onboard-benefit-2 {
          right: 0;
          top: 34px;
          transform: rotate(2deg);
        }

        .onboard-benefit-3 {
          left: 0;
          bottom: 34px;
          transform: rotate(2deg);
        }

        .onboard-benefit-4 {
          right: 0;
          bottom: 34px;
          transform: rotate(-2deg);
        }

        .onboard-benefit:hover {
          transform: translateY(-4px) rotate(0deg);
          border-color: ${C.accent}55;
        }

        .onboard-benefit-visual {
          height: 128px;
          border-radius: 15px;
          border: 1px solid ${C.border};
          background: rgba(5, 8, 18, 0.62);
          overflow: hidden;
          position: relative;
        }

        .onboard-benefit-copy {
          position: relative;
          z-index: 2;
          padding: 11px 2px 2px;
        }

        .onboard-benefit-icon {
          display: none;
        }

        .onboard-benefit h2 {
          margin: 0;
          font-family: ${F.display};
          font-size: 17px;
          line-height: 1.2;
          letter-spacing: -0.3px;
        }

        .onboard-benefit p {
          margin: 6px 0 0;
          color: ${C.muted};
          font-size: 11.5px;
          line-height: 1.45;
        }

        /* Central card */
        .onboard-center-card {
          position: absolute;
          width: 250px;
          min-height: 300px;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          z-index: 5;
          border: 1px solid ${C.accent}75;
          border-radius: 27px;
          padding: 22px 20px 19px;
          background:
            radial-gradient(circle at 50% 18%, ${C.accent}18, transparent 32%),
            linear-gradient(145deg, rgba(31, 25, 68, 0.98), rgba(10, 12, 28, 0.98));
          box-shadow:
            0 0 0 1px ${C.accent}10,
            0 22px 70px rgba(0, 0, 0, 0.45),
            0 0 55px ${C.accent}1c;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .onboard-center-glow {
          position: absolute;
          width: 170px;
          height: 170px;
          top: 2px;
          left: 50%;
          transform: translateX(-50%);
          border-radius: 50%;
          background: ${C.accent}12;
          filter: blur(30px);
          pointer-events: none;
        }

        .onboard-robot {
          position: relative;
          width: 76px;
          height: 82px;
          margin-bottom: 8px;
          z-index: 2;
        }

        .onboard-robot-face {
          position: absolute;
          left: 7px;
          top: 7px;
          width: 62px;
          height: 46px;
          border: 2px solid #b7a8ff;
          border-radius: 23px 23px 19px 19px;
          background: #17182e;
          box-shadow: 0 0 24px ${C.accent}38;
        }

        .onboard-robot-face::before {
          content: "";
          position: absolute;
          width: 5px;
          height: 5px;
          left: -7px;
          top: 17px;
          border-radius: 50%;
          background: ${C.accent};
          box-shadow: 71px 0 0 ${C.accent};
        }

        .onboard-robot-face span {
          position: absolute;
          top: 18px;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #bdb3ff;
        }

        .onboard-robot-face span:first-child { left: 19px; }
        .onboard-robot-face span:last-child { right: 19px; }

        .onboard-robot-body {
          position: absolute;
          left: 18px;
          bottom: 0;
          width: 40px;
          height: 31px;
          border-radius: 12px 12px 17px 17px;
          border: 1px solid ${C.accent}77;
          background: #242142;
        }

        .onboard-robot-heart {
          color: ${C.accent};
          font-size: 13px;
          text-align: center;
          margin-top: 7px;
        }

        .onboard-center-label {
          display: flex;
          align-items: center;
          gap: 5px;
          color: ${C.text};
          font-family: ${F.display};
          font-size: 13px;
          font-weight: 650;
          position: relative;
          z-index: 2;
        }

        .onboard-center-label span {
          color: ${C.accent};
        }

        .onboard-center-card h2 {
          margin: 12px 0 0;
          font-family: ${F.display};
          font-size: 29px;
          line-height: 1.04;
          letter-spacing: -1px;
          position: relative;
          z-index: 2;
        }

        .onboard-center-card h2 span {
          color: ${C.accent};
          text-shadow: 0 0 20px ${C.accent}44;
        }

        .onboard-center-card p {
          max-width: 190px;
          margin: 13px 0 0;
          color: ${C.muted};
          font-size: 11.5px;
          line-height: 1.55;
          position: relative;
          z-index: 2;
        }

        /* Mini product visuals */
        .onboard-visual {
          width: 100%;
          height: 100%;
          position: relative;
          overflow: hidden;
        }

        .onboard-note {
          position: absolute;
          padding: 7px 10px;
          border-radius: 8px;
          color: #e8e4ff;
          font-size: 9px;
          background: linear-gradient(145deg, #2b2a4d, #181a32);
          border: 1px solid ${C.accent}45;
          box-shadow: 0 8px 18px rgba(0,0,0,.24);
        }

        .onboard-note-0 { left: 20px; top: 23px; transform: rotate(-7deg); }
        .onboard-note-1 { right: 20px; top: 18px; transform: rotate(8deg); }
        .onboard-note-2 { left: 31px; bottom: 20px; transform: rotate(5deg); }
        .onboard-note-3 { right: 30px; bottom: 25px; transform: rotate(-5deg); }

        .onboard-scribble {
          position: absolute;
          width: 54px;
          height: 42px;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%) rotate(-12deg);
          border: 2px solid ${C.accent}77;
          border-radius: 48% 52% 44% 56%;
          border-right-color: transparent;
          border-bottom-color: ${C.accent}33;
        }

        .onboard-checklist {
          padding: 17px 14px;
        }

        .onboard-check-row {
          height: 29px;
          margin-bottom: 7px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 8px;
          border-radius: 8px;
          background: rgba(31, 34, 61, .8);
          color: #c6c4df;
          font-size: 9.5px;
          border: 1px solid rgba(130, 122, 220, .12);
        }

        .onboard-check {
          width: 13px;
          height: 13px;
          border: 1px solid #77789d;
          border-radius: 50%;
          flex: 0 0 auto;
        }

        .onboard-check.done {
          border-color: ${C.accent};
          color: white;
          display: grid;
          place-items: center;
          background: ${C.accent}cc;
        }

        .onboard-connected .onboard-hub {
          position: absolute;
          width: 38px;
          height: 38px;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          border: 1px solid ${C.accent};
          border-radius: 50%;
          display: grid;
          place-items: center;
          color: ${C.accent};
          background: #1b1835;
          box-shadow: 0 0 22px ${C.accent}35;
          z-index: 2;
        }

        .onboard-orb {
          position: absolute;
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border: 1px solid ${C.accent}55;
          border-radius: 9px;
          color: #d6d0ff;
          background: #1b1d36;
          font-size: 13px;
          z-index: 2;
        }

        .onboard-orb-1 { left: 28px; top: 22px; }
        .onboard-orb-2 { right: 28px; top: 22px; }
        .onboard-orb-3 { left: 28px; bottom: 22px; }
        .onboard-orb-4 { right: 28px; bottom: 22px; }

        .onboard-connect-line {
          position: absolute;
          height: 1px;
          width: 72px;
          background: linear-gradient(90deg, transparent, ${C.accent}66, transparent);
          left: 50%;
          top: 50%;
          transform-origin: left center;
        }

        .line-1 { transform: rotate(-145deg); }
        .line-2 { transform: rotate(-35deg); }
        .line-3 { transform: rotate(145deg); }
        .line-4 { transform: rotate(35deg); }

        .onboard-chat-preview {
          padding: 17px 12px;
        }

        .onboard-chat-bubble {
          max-width: 82%;
          padding: 9px 10px;
          border-radius: 10px;
          font-size: 9px;
          line-height: 1.35;
          position: absolute;
        }

        .onboard-chat-bubble.user {
          right: 12px;
          top: 22px;
          color: #d9d6ef;
          background: #292b4a;
        }

        .onboard-chat-bubble.ai {
          left: 12px;
          bottom: 24px;
          color: white;
          background: linear-gradient(135deg, #6545e9, #4530c5);
          box-shadow: 0 8px 24px ${C.accent}2c;
        }

        .onboard-spark {
          position: absolute;
          right: 12px;
          bottom: 17px;
          color: ${C.accent};
          font-size: 17px;
          filter: drop-shadow(0 0 8px ${C.accent});
        }

        /* CTA */
        .onboard-cta {
          width: min(470px, 100%);
          margin: 0 auto;
          text-align: center;
        }

        .onboard-cta-title {
          font-family: ${F.display};
          font-size: 17px;
          font-weight: 650;
        }

        .onboard-agree {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 7px;
          margin-top: 15px;
          color: ${C.muted};
          font-size: 11px;
        }

        .onboard-agree input {
          accent-color: ${C.accent};
          width: 14px;
          height: 14px;
        }

        .onboard-agree a {
          color: ${C.accent};
          text-decoration: underline;
        }

        .onboard-start {
          width: 100%;
          margin-top: 12px;
          min-height: 48px;
          border: 0;
          border-radius: 999px;
          background: linear-gradient(100deg, #7448ff, #5335ec);
          color: white;
          font-family: ${F.display};
          font-size: 14px;
          font-weight: 650;
          box-shadow: 0 12px 35px ${C.accent}25;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          transition: transform .18s ease, opacity .18s ease, box-shadow .18s ease;
        }

        .onboard-start:not(:disabled):hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 42px ${C.accent}35;
        }

        .onboard-start:disabled {
          opacity: .45;
          cursor: not-allowed;
        }

        .onboard-note-bottom {
          color: ${C.muted};
          font-size: 10.5px;
          margin-top: 9px;
        }

        .onboard-footer {
          text-align: center;
          margin-top: 28px;
          color: ${C.muted};
          opacity: .5;
          font-family: ${F.mono};
          font-size: 8px;
          letter-spacing: 2.3px;
          line-height: 1.7;
        }

        @keyframes onboard-card-in {
          from { opacity: 0; transform: translateY(16px) scale(.97) rotate(0deg); }
          to { opacity: 1; }
        }

        /* Android/mobile: keep the visuals small and centered rather than
           letting them fill the entire screen. */
        @media (max-width: 700px) {
          .onboard-page {
            padding: 22px 16px 25px;
          }

          .onboard-top-note {
            display: none;
          }

          .onboard-heading {
            margin-top: 29px;
          }

          .onboard-heading h1 {
            font-size: clamp(28px, 8.5vw, 37px);
            letter-spacing: -1px;
          }

          .onboard-heading p {
            font-size: 12.5px;
            max-width: 330px;
          }

          .onboard-stage {
            width: min(500px, 100%);
            height: 535px;
            margin-top: 21px;
          }

          .onboard-stage-ring {
            width: 290px;
            height: 290px;
          }

          .onboard-benefit {
            width: 154px;
            min-height: 184px;
            padding: 9px;
            border-radius: 17px;
          }

          .onboard-benefit-1 {
            left: 0;
            top: 25px;
          }

          .onboard-benefit-2 {
            right: 0;
            top: 25px;
          }

          .onboard-benefit-3 {
            left: 0;
            bottom: 25px;
          }

          .onboard-benefit-4 {
            right: 0;
            bottom: 25px;
          }

          .onboard-benefit-visual {
            height: 88px;
            border-radius: 11px;
          }

          .onboard-benefit h2 {
            font-size: 12.5px;
          }

          .onboard-benefit p {
            font-size: 9px;
            line-height: 1.35;
            margin-top: 4px;
          }

          .onboard-note {
            padding: 5px 7px;
            font-size: 7px;
          }

          .onboard-note-0 { left: 12px; top: 14px; }
          .onboard-note-1 { right: 12px; top: 12px; }
          .onboard-note-2 { left: 18px; bottom: 12px; }
          .onboard-note-3 { right: 18px; bottom: 13px; }

          .onboard-checklist {
            padding: 10px 8px;
          }

          .onboard-check-row {
            height: 20px;
            margin-bottom: 4px;
            padding: 0 5px;
            gap: 5px;
            font-size: 7px;
          }

          .onboard-check {
            width: 9px;
            height: 9px;
          }

          .onboard-check.done svg {
            width: 8px;
            height: 8px;
          }

          .onboard-connected .onboard-hub {
            width: 28px;
            height: 28px;
            font-size: 10px;
          }

          .onboard-orb {
            width: 26px;
            height: 26px;
            font-size: 9px;
            border-radius: 7px;
          }

          .onboard-orb-1 { left: 17px; top: 12px; }
          .onboard-orb-2 { right: 17px; top: 12px; }
          .onboard-orb-3 { left: 17px; bottom: 12px; }
          .onboard-orb-4 { right: 17px; bottom: 12px; }

          .onboard-connect-line {
            width: 49px;
          }

          .onboard-chat-preview {
            padding: 10px 7px;
          }

          .onboard-chat-bubble {
            padding: 6px 7px;
            font-size: 7px;
            border-radius: 7px;
          }

          .onboard-chat-bubble.user {
            right: 7px;
            top: 13px;
          }

          .onboard-chat-bubble.ai {
            left: 7px;
            bottom: 13px;
          }

          .onboard-spark {
            right: 7px;
            bottom: 9px;
            font-size: 12px;
          }

          .onboard-center-card {
            width: 178px;
            min-height: 226px;
            padding: 15px 13px 13px;
            border-radius: 21px;
          }

          .onboard-robot {
            width: 57px;
            height: 61px;
            transform: scale(.76);
            margin-top: -3px;
            margin-bottom: -1px;
          }

          .onboard-center-label {
            font-size: 10px;
          }

          .onboard-center-card h2 {
            font-size: 23px;
            margin-top: 8px;
          }

          .onboard-center-card p {
            max-width: 145px;
            font-size: 9px;
            margin-top: 8px;
            line-height: 1.45;
          }

          .onboard-cta {
            max-width: 330px;
          }

          .onboard-cta-title {
            font-size: 15px;
          }

          .onboard-start {
            min-height: 46px;
            font-size: 13px;
          }

          .onboard-footer {
            margin-top: 22px;
          }
        }

        @media (max-width: 380px) {
          .onboard-stage {
            height: 505px;
          }

          .onboard-benefit {
            width: 143px;
            min-height: 176px;
          }

          .onboard-center-card {
            width: 168px;
            min-height: 216px;
          }

          .onboard-benefit-1,
          .onboard-benefit-2 {
            top: 20px;
          }

          .onboard-benefit-3,
          .onboard-benefit-4 {
            bottom: 20px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .onboard-benefit {
            animation: none;
            opacity: 1;
          }

          .onboard-start,
          .onboard-benefit {
            transition: none;
          }
        }
      `}</style>

      <header className="onboard-topbar">
        <div className="onboard-wordmark">
          <span className="onboard-wordmark-star">✦</span>
          <span>
            Founder<span style={{ color: C.accent }}>OS</span>
          </span>
        </div>
      </header>

      <section className="onboard-heading">
        <div className="onboard-eyebrow">YOUR AI CO-FOUNDER</div>
        <h1>
          From chaos to <span>clarity.</span>
        </h1>
        <p>
          Your co-founder for the real world. Think, decide, validate and
          execute — through one conversation.
        </p>
      </section>

      <section className="onboard-stage" aria-label="FounderOS capabilities">
        <div className="onboard-stage-ring" />

        {BENEFITS.map((benefit, index) => (
          <BenefitCard key={benefit.key} benefit={benefit} index={index} />
        ))}

        <CenterCard />
      </section>

      <section className="onboard-cta">
        <div className="onboard-cta-title">Ready to start building?</div>

        <label className="onboard-agree">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>
            I accept the{" "}
            <a
              href="#terms"
              onClick={(e) => {
                e.preventDefault();
                setShowTerms(true);
              }}
            >
              Terms and Conditions
            </a>
          </span>
        </label>

        <button
          className="onboard-start"
          onClick={start}
          disabled={!agreed || starting}
        >
          {starting ? "Starting…" : "Start with FounderOS"}
          {!starting && <ArrowRight size={15} />}
        </button>
      </section>

      <footer className="onboard-footer">
        FOUNDERS BUILD
        <br />
        A BRIGHTER TOMORROW
      </footer>

      {showTerms && (
        <div
          onClick={() => setShowTerms(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.68)",
            zIndex: 50,
            display: "flex",
            alignItems: "flex-end",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: C.surface,
              borderTop: `1px solid ${C.border}`,
              borderRadius: "16px 16px 0 0",
              padding: "16px 18px 24px",
              width: "100%",
              maxHeight: "78vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <span style={{ fontFamily: F.display, fontSize: 17 }}>
                Terms & Conditions
              </span>

              <button
                onClick={() => setShowTerms(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: C.muted,
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ overflowY: "auto" }}>
              <p style={styles.termsP}>{TERMS_INTRO}</p>

              {TERMS_BODY.map((t, i) => (
                <p
                  key={i}
                  style={{ ...styles.termsP, marginTop: 10 }}
                >
                  {t}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


        <label className="onboard-agree">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>
            I accept the{" "}
            <a
              href="#terms"
              onClick={(e) => {
                e.preventDefault();
                setShowTerms(true);
              }}
            >
              Terms and Conditions
            </a>
          </span>
        </label>

        <button
          className="onboard-start"
          onClick={start}
          disabled={!agreed || starting}
        >
          {starting ? "Starting…" : "Start with FounderOS"}
          {!starting && <ArrowRight size={15} />}
        </button>

        <div className="onboard-note-bottom">
          FounderOS learns about your company inside Chat.
        </div>
      </section>

      <footer className="onboard-footer">
        FOUNDERS BUILD
        <br />
        A BRIGHTER TOMORROW
      </footer>

      {showTerms && (
        <div
          onClick={() => setShowTerms(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.68)",
            zIndex: 50,
            display: "flex",
            alignItems: "flex-end",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: C.surface,
              borderTop: `1px solid ${C.border}`,
              borderRadius: "16px 16px 0 0",
              padding: "16px 18px 24px",
              width: "100%",
              maxHeight: "78vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <span style={{ fontFamily: F.display, fontSize: 17 }}>
                Terms & Conditions
              </span>

              <button
                onClick={() => setShowTerms(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: C.muted,
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ overflowY: "auto" }}>
              <p style={styles.termsP}>{TERMS_INTRO}</p>

              {TERMS_BODY.map((t, i) => (
                <p
                  key={i}
                  style={{ ...styles.termsP, marginTop: 10 }}
                >
                  {t}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
