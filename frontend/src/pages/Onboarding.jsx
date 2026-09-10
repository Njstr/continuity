import React, { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Search, Target, TrendingUp, X } from "lucide-react";
import { styles } from "../styles/styles";
import { C, F, globalCss } from "../styles/theme";
import { COUNTRIES, COUNTRY_TO_CURRENCY, TERMS_INTRO, TERMS_BODY, todayStr } from "../constants";

/*
 * FounderOS onboarding
 *
 * Single-screen product introduction.
 * No founder/company questions are collected here; the existing Chat flow
 * handles that conversationally after this page.
 *
 * Desktop:
 *   two cards on top + two cards on bottom, with the FounderOS card
 *   centered and layered above them.
 *
 * Mobile:
 *   the same composition is scaled with viewport-relative dimensions so
 *   the complete experience stays inside one screen with no page scrolling.
 */

const BENEFITS = [
  {
    key: "validate",
    icon: Search,
    title: "Validate",
    description: "Find real evidence before building.",
  },
  {
    key: "guide",
    icon: Target,
    title: "Guide",
    description: "Know what to do next with clarity.",
  },
  {
    key: "decide",
    icon: TrendingUp,
    title: "Decide",
    description: "Think through important choices.",
  },
  {
    key: "measure",
    icon: TrendingUp,
    title: "Measure",
    description: "Track what actually matters.",
  },
];

function MiniVisual({ type }) {
  if (type === "validate") {
    return (
      <div className="ob-visual ob-validate">
        {[
          ["Reddit", "✓"],
          ["Competitors", "✓"],
          ["Customer pain", "✓"],
          ["Market signals", "✓"],
        ].map(([label, check]) => (
          <div className="ob-evidence-row" key={label}>
            <span className="ob-evidence-icon">⌕</span>
            <span>{label}</span>
            <CheckCircle2 size={14} className="ob-evidence-check" />
          </div>
        ))}
      </div>
    );
  }

  if (type === "guide") {
    return (
      <div className="ob-visual ob-guide">
        <div className="ob-mini-label">NEXT BEST ACTION</div>
        <div className="ob-action-row">
          <span>Interview 5 users</span>
          <ArrowRight size={13} />
        </div>
        <div className="ob-action-meta">
          <span>◷ 45 min</span>
          <span>▮▮ High impact</span>
        </div>
      </div>
    );
  }

  if (type === "decide") {
    return (
      <div className="ob-visual ob-decide">
        <div className="ob-mini-question">Build Feature X?</div>
        <div className="ob-meter">
          <span>Evidence</span>
          <div className="ob-meter-track">
            <div className="ob-meter-fill evidence" />
          </div>
          <b>78%</b>
        </div>
        <div className="ob-meter">
          <span>Risk</span>
          <div className="ob-meter-track">
            <div className="ob-meter-fill risk" />
          </div>
          <b>32%</b>
        </div>
      </div>
    );
  }

  return (
    <div className="ob-visual ob-measure">
      <div className="ob-metric">
        <span>MRR</span>
        <b>₹49.9K</b>
        <em>↗ 18%</em>
      </div>
      <svg viewBox="0 0 150 65" preserveAspectRatio="none" aria-hidden="true">
        <path
          d="M2 55 C20 49, 25 53, 39 40 S65 47, 78 30 S105 35, 118 19 S137 22, 148 8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M2 55 C20 49, 25 53, 39 40 S65 47, 78 30 S105 35, 118 19 S137 22, 148 8 V65 H2 Z"
          fill="currentColor"
          opacity=".08"
        />
      </svg>
    </div>
  );
}

function BenefitCard({ benefit, index }) {
  const Icon = benefit.icon;

  return (
    <article className={`ob-benefit ob-benefit-${index + 1}`}>
      <div className="ob-card-visual">
        <MiniVisual type={benefit.key} />
      </div>

      <div className="ob-card-copy">
        <div className="ob-card-title-row">
          <span className="ob-card-icon">
            <Icon size={12} />
          </span>
          <h2>{benefit.title}</h2>
        </div>
        <p>{benefit.description}</p>
      </div>
    </article>
  );
}

function CenterCard() {
  return (
    <article className="ob-center">
      <div className="ob-center-glow" />

      <div className="ob-center-star">✦</div>

      <div className="ob-center-brand">
        Founder<span>OS</span>
      </div>

      <div className="ob-center-divider" />

      <div className="ob-center-message">
        A clearer
        <br />
        <span>tomorrow.</span>
      </div>
    </article>
  );
}

export function Onboarding({ onDone }) {
  const [agreed, setAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    // Lock document scrolling while this full-screen onboarding is mounted.
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  async function start() {
    if (!agreed || starting) return;

    setStarting(true);

    // Keep onboarding data-free. Founder/company details are learned in Chat.
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
    <div className="ob-page">
      <style>{globalCss}</style>

      <style>{`
        .ob-page {
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100dvh;
          min-height: 0;
          overflow: hidden;
          box-sizing: border-box;
          background:
            radial-gradient(circle at 50% 44%, rgba(126, 78, 255, .10), transparent 28%),
            radial-gradient(circle at 50% 100%, rgba(61, 69, 125, .10), transparent 34%),
            ${C.bg};
          color: ${C.text};
          font-family: ${F.body};
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: clamp(14px, 2.2vh, 28px) clamp(14px, 3vw, 38px);
          isolation: isolate;
        }

        .ob-page *,
        .ob-page *::before,
        .ob-page *::after {
          box-sizing: border-box;
        }

        .ob-top {
          width: min(920px, 100%);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex: 0 0 auto;
        }

        .ob-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: ${F.display};
          font-size: clamp(16px, 1.8vw, 21px);
          font-weight: 650;
          letter-spacing: -.45px;
        }

        .ob-logo-star {
          color: #f0b34a;
          font-size: 21px;
          line-height: 1;
          filter: drop-shadow(0 0 9px rgba(240,179,74,.35));
        }

        .ob-heading {
          text-align: center;
          width: min(720px, 100%);
          margin-top: clamp(18px, 3.5vh, 38px);
          flex: 0 0 auto;
        }

        .ob-eyebrow {
          color: #f0b34a;
          font-family: ${F.mono};
          font-size: 9px;
          letter-spacing: 2px;
        }

        .ob-heading h1 {
          margin: 8px 0 0;
          font-family: ${F.display};
          font-size: clamp(30px, 4.5vw, 49px);
          line-height: 1;
          letter-spacing: -1.7px;
        }

        .ob-heading h1 span {
          color: #f0b34a;
          text-shadow: 0 0 25px rgba(240,179,74,.18);
        }

        .ob-heading p {
          max-width: 600px;
          margin: 12px auto 0;
          color: ${C.muted};
          font-size: clamp(11px, 1.25vw, 14px);
          line-height: 1.45;
        }

        /* The main composition is intentionally bounded. Nothing in it
           determines page height, which keeps the viewport non-scrollable. */
        .ob-stage {
          position: relative;
          width: min(820px, 94vw);
          height: min(540px, 48vh);
          min-height: 365px;
          margin-top: clamp(14px, 2.4vh, 26px);
          flex: 1 1 auto;
          max-height: 540px;
        }

        .ob-ring {
          position: absolute;
          width: min(430px, 50%);
          aspect-ratio: 1;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          border: 1px solid rgba(240,179,74,.20);
          border-radius: 50%;
          box-shadow: 0 0 55px rgba(122,74,255,.08);
          pointer-events: none;
        }

        .ob-ring::before {
          content: "";
          position: absolute;
          inset: 15%;
          border: 1px solid rgba(126,78,255,.12);
          border-radius: 50%;
        }

        .ob-benefit {
          position: absolute;
          width: clamp(205px, 27vw, 255px);
          height: clamp(190px, 21vh, 225px);
          padding: 11px;
          border: 1px solid rgba(126, 105, 218, .30);
          border-radius: 20px;
          background: linear-gradient(145deg, rgba(26,27,48,.96), rgba(13,15,29,.94));
          box-shadow: 0 16px 45px rgba(0,0,0,.30), 0 0 35px rgba(104,71,230,.07);
          z-index: 2;
        }

        .ob-benefit-1 {
          left: 12%;
          top: 1%;
          transform: rotate(-1.2deg);
        }

        .ob-benefit-2 {
          right: 12%;
          top: 1%;
          transform: rotate(1.2deg);
        }

        .ob-benefit-3 {
          left: 12%;
          bottom: 1%;
          transform: rotate(1.2deg);
        }

        .ob-benefit-4 {
          right: 12%;
          bottom: 1%;
          transform: rotate(-1.2deg);
        }

        .ob-card-visual {
          height: 58%;
          min-height: 105px;
          border: 1px solid rgba(126,105,218,.18);
          border-radius: 13px;
          background: rgba(8,10,21,.62);
          overflow: hidden;
        }

        .ob-card-copy {
          padding: 10px 4px 0;
        }

        .ob-card-title-row {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .ob-card-icon {
          width: 20px;
          height: 20px;
          flex: 0 0 20px;
          border-radius: 6px;
          display: grid;
          place-items: center;
          color: #c8bcff;
          background: rgba(126,78,255,.13);
          border: 1px solid rgba(126,78,255,.25);
        }

        .ob-benefit h2 {
          margin: 0;
          font-family: ${F.display};
          font-size: 18px;
          line-height: 1.1;
          letter-spacing: -.35px;
        }

        .ob-benefit p {
          margin: 5px 0 0 27px;
          color: ${C.muted};
          font-size: 11px;
          line-height: 1.35;
        }

        /* Center card */
        .ob-center {
          position: absolute;
          width: clamp(205px, 25vw, 270px);
          aspect-ratio: .92;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          z-index: 5;
          border: 2px solid rgba(126,78,255,.82);
          border-radius: 24px;
          background:
            radial-gradient(circle at 50% 25%, rgba(126,78,255,.18), transparent 40%),
            linear-gradient(145deg, rgba(29,27,58,.99), rgba(12,14,29,.99));
          box-shadow:
            0 0 0 1px rgba(126,78,255,.08),
            0 25px 70px rgba(0,0,0,.45),
            0 0 55px rgba(126,78,255,.16);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          overflow: hidden;
        }

        .ob-center-glow {
          position: absolute;
          width: 80%;
          aspect-ratio: 1;
          top: -12%;
          border-radius: 50%;
          background: rgba(126,78,255,.10);
          filter: blur(25px);
        }

        .ob-center-star {
          position: relative;
          z-index: 1;
          color: #f0b34a;
          font-size: clamp(28px, 3.2vw, 38px);
          line-height: 1;
          filter: drop-shadow(0 0 11px rgba(240,179,74,.30));
        }

        .ob-center-brand {
          position: relative;
          z-index: 1;
          margin-top: 10px;
          font-family: ${F.display};
          font-size: clamp(18px, 2vw, 25px);
          font-weight: 650;
        }

        .ob-center-brand span {
          color: #f0b34a;
        }

        .ob-center-divider {
          position: relative;
          z-index: 1;
          width: 55%;
          height: 1px;
          margin: 16px 0 13px;
          background: rgba(190,180,255,.16);
        }

        .ob-center-message {
          position: relative;
          z-index: 1;
          font-family: ${F.mono};
          font-size: clamp(10px, 1.1vw, 13px);
          line-height: 1.8;
          letter-spacing: 4px;
          text-transform: uppercase;
          color: ${C.muted};
        }

        .ob-center-message span {
          color: #f0b34a;
        }

        /* Mini visual 1 */
        .ob-visual {
          position: relative;
          width: 100%;
          height: 100%;
          color: #d9d4ef;
        }

        .ob-validate {
          padding: 12px 13px;
        }

        .ob-evidence-row {
          display: grid;
          grid-template-columns: 17px 1fr 16px;
          align-items: center;
          gap: 7px;
          height: 25%;
          color: #c4c0d8;
          font-size: 9.5px;
          border-bottom: 1px solid rgba(126,105,218,.08);
        }

        .ob-evidence-icon {
          color: #a99aff;
          font-size: 15px;
        }

        .ob-evidence-check {
          color: #2fbd75;
        }

        /* Mini visual 2 */
        .ob-guide {
          padding: 14px;
        }

        .ob-mini-label {
          color: #85839e;
          font-family: ${F.mono};
          font-size: 8px;
          letter-spacing: .6px;
        }

        .ob-action-row {
          margin-top: 8px;
          height: 39px;
          padding: 0 10px;
          border: 1px solid rgba(126,78,255,.35);
          border-radius: 9px;
          background: rgba(76,54,151,.18);
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 10px;
        }

        .ob-action-row svg {
          color: #c1b3ff;
        }

        .ob-action-meta {
          display: flex;
          justify-content: space-between;
          margin-top: 8px;
          color: #777692;
          font-size: 8px;
        }

        .ob-action-meta span:last-child {
          color: #45c983;
        }

        /* Mini visual 3 */
        .ob-decide {
          padding: 13px;
        }

        .ob-mini-question {
          font-size: 11px;
          margin-bottom: 13px;
        }

        .ob-meter {
          display: grid;
          grid-template-columns: 48px 1fr 27px;
          align-items: center;
          gap: 7px;
          margin-top: 9px;
          color: #85839e;
          font-size: 8px;
        }

        .ob-meter b {
          color: #c8c2dd;
          font-weight: 500;
          text-align: right;
        }

        .ob-meter-track {
          height: 7px;
          border-radius: 999px;
          background: rgba(116,108,156,.22);
          overflow: hidden;
        }

        .ob-meter-fill {
          height: 100%;
          border-radius: inherit;
        }

        .ob-meter-fill.evidence {
          width: 78%;
          background: #42c98b;
        }

        .ob-meter-fill.risk {
          width: 32%;
          background: #f0b34a;
        }

        /* Mini visual 4 */
        .ob-measure {
          padding: 13px;
          color: #43c98b;
        }

        .ob-metric {
          display: flex;
          flex-direction: column;
          position: relative;
          z-index: 1;
        }

        .ob-metric span {
          color: #85839e;
          font-family: ${F.mono};
          font-size: 8px;
        }

        .ob-metric b {
          color: #e4e0f0;
          font-size: 18px;
          margin-top: 3px;
        }

        .ob-metric em {
          color: #42c98b;
          font-size: 9px;
          font-style: normal;
          margin-top: 3px;
        }

        .ob-measure svg {
          position: absolute;
          left: 12px;
          right: 12px;
          bottom: 7px;
          width: calc(100% - 24px);
          height: 48px;
        }

        /* Bottom */
        .ob-bottom {
          width: min(470px, 100%);
          text-align: center;
          flex: 0 0 auto;
          margin-top: clamp(4px, 1vh, 10px);
        }

        .ob-bottom-title {
          font-family: ${F.display};
          font-size: 16px;
          font-weight: 650;
        }

        .ob-start {
          width: 100%;
          height: 48px;
          margin-top: 10px;
          border: 0;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: linear-gradient(100deg, #7448ff, #5134df);
          color: white;
          font-family: ${F.display};
          font-size: 14px;
          font-weight: 650;
          box-shadow: 0 12px 35px rgba(108,68,240,.23);
        }

        .ob-start:disabled {
          opacity: .48;
          cursor: not-allowed;
        }

        .ob-agree {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 7px;
          margin-top: 8px;
          color: ${C.muted};
          font-size: 10.5px;
        }

        .ob-agree input {
          width: 14px;
          height: 14px;
          margin: 0;
          accent-color: #7448ff;
        }

        .ob-agree a {
          color: #f0b34a;
          text-decoration: underline;
        }

        .ob-footer {
          margin-top: clamp(6px, 1.2vh, 12px);
          color: ${C.muted};
          opacity: .52;
          font-family: ${F.mono};
          font-size: 7px;
          letter-spacing: 2.5px;
          text-align: center;
          flex: 0 0 auto;
        }

        /* Tablet/mobile */
        @media (max-width: 700px) {
          .ob-page {
            padding: 11px 12px 9px;
          }

          .ob-top {
            width: 100%;
          }

          .ob-logo {
            font-size: 15px;
          }

          .ob-logo-star {
            font-size: 18px;
          }

          .ob-heading {
            margin-top: 14px;
          }

          .ob-eyebrow {
            font-size: 7px;
            letter-spacing: 1.5px;
          }

          .ob-heading h1 {
            font-size: clamp(25px, 8vw, 33px);
            letter-spacing: -1px;
            line-height: 1.02;
          }

          .ob-heading p {
            max-width: 320px;
            margin-top: 7px;
            font-size: 9.5px;
            line-height: 1.35;
          }

          .ob-stage {
            width: min(380px, 100%);
            height: clamp(300px, 43vh, 360px);
            min-height: 300px;
            margin-top: 8px;
          }

          .ob-ring {
            width: 57%;
          }

          .ob-benefit {
            width: 116px;
            height: clamp(132px, 17vh, 151px);
            padding: 7px;
            border-radius: 14px;
          }

          .ob-benefit-1 {
            left: 10%;
            top: 0;
          }

          .ob-benefit-2 {
            right: 10%;
            top: 0;
          }

          .ob-benefit-3 {
            left: 10%;
            bottom: 0;
          }

          .ob-benefit-4 {
            right: 10%;
            bottom: 0;
          }

          .ob-card-visual {
            height: 66px;
            min-height: 0;
            border-radius: 9px;
          }

          .ob-card-copy {
            padding: 7px 2px 0;
          }

          .ob-card-icon {
            width: 16px;
            height: 16px;
            flex-basis: 16px;
            border-radius: 5px;
          }

          .ob-card-icon svg {
            width: 9px;
            height: 9px;
          }

          .ob-benefit h2 {
            font-size: 11px;
            letter-spacing: -.2px;
          }

          .ob-benefit p {
            margin: 4px 0 0 22px;
            font-size: 7.5px;
            line-height: 1.25;
          }

          .ob-center {
            width: 137px;
            height: 151px;
            border-radius: 17px;
          }

          .ob-center-star {
            font-size: 25px;
          }

          .ob-center-brand {
            margin-top: 6px;
            font-size: 13px;
          }

          .ob-center-divider {
            margin: 9px 0 8px;
            width: 50%;
          }

          .ob-center-message {
            font-size: 7px;
            line-height: 1.75;
            letter-spacing: 2.3px;
          }

          .ob-validate,
          .ob-guide,
          .ob-decide,
          .ob-measure {
            padding: 8px;
          }

          .ob-evidence-row {
            grid-template-columns: 12px 1fr 11px;
            gap: 4px;
            font-size: 6.8px;
          }

          .ob-evidence-icon {
            font-size: 11px;
          }

          .ob-evidence-check {
            width: 9px;
            height: 9px;
          }

          .ob-mini-label {
            font-size: 5.5px;
          }

          .ob-action-row {
            margin-top: 5px;
            height: 27px;
            padding: 0 6px;
            border-radius: 6px;
            font-size: 6.8px;
          }

          .ob-action-row svg {
            width: 9px;
            height: 9px;
          }

          .ob-action-meta {
            margin-top: 5px;
            font-size: 5.5px;
          }

          .ob-mini-question {
            font-size: 7.5px;
            margin-bottom: 7px;
          }

          .ob-meter {
            grid-template-columns: 29px 1fr 18px;
            gap: 4px;
            margin-top: 5px;
            font-size: 5.5px;
          }

          .ob-meter-track {
            height: 4px;
          }

          .ob-metric span {
            font-size: 5.5px;
          }

          .ob-metric b {
            font-size: 12px;
            margin-top: 2px;
          }

          .ob-metric em {
            font-size: 6px;
          }

          .ob-measure svg {
            left: 8px;
            bottom: 4px;
            width: calc(100% - 16px);
            height: 31px;
          }

          .ob-bottom {
            width: min(300px, 100%);
            margin-top: 3px;
          }

          .ob-bottom-title {
            font-size: 13px;
          }

          .ob-start {
            height: 43px;
            margin-top: 7px;
            font-size: 11.5px;
          }

          .ob-agree {
            margin-top: 6px;
            font-size: 8px;
          }

          .ob-agree input {
            width: 12px;
            height: 12px;
          }

          .ob-footer {
            margin-top: 5px;
            font-size: 5.5px;
            letter-spacing: 2px;
          }
        }

        /* Very short Android screens: scale the composition down rather
           than allowing anything to extend below the viewport. */
        @media (max-width: 700px) and (max-height: 700px) {
          .ob-page {
            padding-top: 8px;
            padding-bottom: 6px;
          }

          .ob-heading {
            margin-top: 9px;
          }

          .ob-heading h1 {
            font-size: 24px;
          }

          .ob-heading p {
            margin-top: 5px;
            font-size: 8px;
          }

          .ob-stage {
            height: 255px;
            min-height: 255px;
            margin-top: 5px;
          }

          .ob-benefit {
            width: 101px;
            height: 116px;
            padding: 6px;
          }

          .ob-benefit-1,
          .ob-benefit-3 {
            left: 11%;
          }

          .ob-benefit-2,
          .ob-benefit-4 {
            right: 11%;
          }

          .ob-card-visual {
            height: 51px;
          }

          .ob-card-copy {
            padding-top: 5px;
          }

          .ob-benefit h2 {
            font-size: 9.5px;
          }

          .ob-benefit p {
            font-size: 6.5px;
            margin-left: 0;
            margin-top: 3px;
          }

          .ob-card-icon {
            display: none;
          }

          .ob-center {
            width: 116px;
            height: 128px;
          }

          .ob-center-star {
            font-size: 21px;
          }

          .ob-center-brand {
            font-size: 11px;
          }

          .ob-center-divider {
            margin: 6px 0;
          }

          .ob-center-message {
            font-size: 6px;
          }

          .ob-bottom-title {
            font-size: 11px;
          }

          .ob-start {
            height: 38px;
            margin-top: 5px;
            font-size: 10px;
          }

          .ob-agree {
            font-size: 7px;
            margin-top: 4px;
          }

          .ob-footer {
            margin-top: 3px;
          }
        }

        @media (max-width: 360px) {
          .ob-stage {
            width: 320px;
          }

          .ob-benefit {
            width: 96px;
          }

          .ob-benefit-1,
          .ob-benefit-3 {
            left: 9%;
          }

          .ob-benefit-2,
          .ob-benefit-4 {
            right: 9%;
          }

          .ob-center {
            width: 110px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .ob-page * {
            scroll-behavior: auto !important;
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>

      <header className="ob-top">
        <div className="ob-logo">
          <span className="ob-logo-star">✦</span>
          <span>
            Founder<span style={{ color: "#f0b34a" }}>OS</span>
          </span>
        </div>
      </header>

      <section className="ob-heading">
        <div className="ob-eyebrow">YOUR AI CO-FOUNDER</div>
        <h1>
          From chaos to <span>clarity.</span>
        </h1>
        <p>
          Your AI co-founder for the real world. Think, decide, validate and
          execute — all in one place.
        </p>
      </section>

      <main className="ob-stage" aria-label="FounderOS capabilities">
        <div className="ob-ring" aria-hidden="true" />

        {BENEFITS.map((benefit, index) => (
          <BenefitCard
            key={benefit.key}
            benefit={benefit}
            index={index}
          />
        ))}

        <CenterCard />
      </main>

      <section className="ob-bottom">
        <div className="ob-bottom-title">Ready to start building?</div>

        <button
          className="ob-start"
          onClick={start}
          disabled={!agreed || starting}
        >
          {starting ? "Starting…" : "Start with FounderOS"}
          {!starting && <ArrowRight size={15} />}
        </button>

        <label className="ob-agree">
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
      </section>

      <footer className="ob-footer">
        BUILD A BRIGHTER TOMORROW
      </footer>

      {showTerms && (
        <div
          onClick={() => setShowTerms(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.70)",
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
