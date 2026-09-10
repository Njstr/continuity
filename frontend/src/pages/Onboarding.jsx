import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  GitBranch,
  Rocket,
  Search,
  X,
} from "lucide-react";
import { C, F, globalCss } from "../styles/theme";
import {
  COUNTRIES,
  COUNTRY_TO_CURRENCY,
  TERMS_BODY,
  TERMS_INTRO,
  todayStr,
} from "../constants";

const SLIDES = [
  {
    key: "welcome",
    eyebrow: "WELCOME TO FOUNDEROS",
    title: (
      <>
        Turn ideas into
        <br />
        <span>informed decisions.</span>
      </>
    ),
    description:
      "Make better decisions, build with confidence, and track what matters — all in one place.",
    icon: "spark",
  },
  {
    key: "validate",
    eyebrow: "VALIDATE YOUR IDEAS",
    title: (
      <>
        Find the
        <br />
        <span>real signal.</span>
      </>
    ),
    description:
      "Explore evidence, market signals, and customer pain before you spend time building.",
    icon: "validate",
  },
  {
    key: "decide",
    eyebrow: "MAKE BETTER DECISIONS",
    title: (
      <>
        Think clearly.
        <br />
        <span>Choose confidently.</span>
      </>
    ),
    description:
      "Compare options, understand trade-offs, and turn uncertainty into a clear next step.",
    icon: "decide",
  },
  {
    key: "measure",
    eyebrow: "TRACK WHAT MATTERS",
    title: (
      <>
        See your
        <br />
        <span>progress.</span>
      </>
    ),
    description:
      "Keep an eye on the metrics and outcomes that actually move your goals forward.",
    icon: "measure",
  },
  {
    key: "ready",
    eyebrow: "YOU'RE READY",
    title: (
      <>
        Build a
        <br />
        <span>clearer tomorrow.</span>
      </>
    ),
    description:
      "FounderOS brings the thinking together so you can focus on what to do next.",
    icon: "ready",
  },
];

function SlideVisual({ type }) {
  if (type === "validate") {
    return (
      <div className="ob-slide-visual ob-visual-validate">
        {["Reddit", "Competitors", "Customer pain", "Market signals"].map(
          (item) => (
            <div className="ob-signal-row" key={item}>
              <Search size={15} />
              <span>{item}</span>
              <CheckCircle2 size={15} />
            </div>
          )
        )}
      </div>
    );
  }

  if (type === "decide") {
    return (
      <div className="ob-slide-visual ob-visual-decide">
        <div className="ob-decision-head">
          <span>BUILD FEATURE X?</span>
          <GitBranch size={18} />
        </div>
        <div className="ob-decision-row">
          <span>Evidence</span>
          <div className="ob-progress">
            <i style={{ width: "78%" }} />
          </div>
          <b>78%</b>
        </div>
        <div className="ob-decision-row">
          <span>Risk</span>
          <div className="ob-progress">
            <i style={{ width: "32%" }} />
          </div>
          <b>32%</b>
        </div>
      </div>
    );
  }

  if (type === "measure") {
    return (
      <div className="ob-slide-visual ob-visual-measure">
        <div className="ob-metric-label">MRR</div>
        <div className="ob-metric-value">₹49.9K</div>
        <div className="ob-metric-change">↗ 18%</div>
        <svg viewBox="0 0 260 90" preserveAspectRatio="none">
          <path
            d="M4 76 C28 70 30 73 51 60 S82 68 102 48 S130 57 151 39 S181 45 198 29 S226 34 256 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            d="M4 76 C28 70 30 73 51 60 S82 68 102 48 S130 57 151 39 S181 45 198 29 S226 34 256 8 V90 H4 Z"
            fill="currentColor"
            opacity=".08"
          />
        </svg>
      </div>
    );
  }

  if (type === "ready") {
    return (
      <div className="ob-slide-visual ob-visual-ready">
        <div className="ob-ready-orbit orbit-a" />
        <div className="ob-ready-orbit orbit-b" />
        <div className="ob-ready-center">
          <span>✦</span>
          <strong>
            Founder<span>OS</span>
          </strong>
        </div>
      </div>
    );
  }

  return (
    <div className="ob-slide-visual ob-visual-welcome">
      <div className="ob-welcome-glow" />
      <div className="ob-welcome-star">✦</div>
    </div>
  );
}

export function Onboarding({ onDone }) {
  const [slide, setSlide] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [starting, setStarting] = useState(false);

  const current = SLIDES[slide];
  const last = slide === SLIDES.length - 1;

  useEffect(() => {
    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
    };
  }, []);

  function next() {
    if (!last) {
      setSlide((value) => value + 1);
    }
  }

  async function start() {
    if (!agreed || starting) return;

    setStarting(true);

    // Onboarding intentionally collects no founder/company information.
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
          overflow: hidden;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: center;
          background:
            radial-gradient(circle at 50% 30%, rgba(110,72,230,.11), transparent 30%),
            ${C.bg};
          color: ${C.text};
          font-family: ${F.body};
          padding: 22px 20px 16px;
        }

        .ob-shell {
          width: min(520px, 100%);
          height: 100%;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }

        .ob-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex: 0 0 auto;
        }

        .ob-logo {
          display: flex;
          align-items: center;
          gap: 7px;
          font-family: ${F.display};
          font-size: 19px;
          font-weight: 650;
          letter-spacing: -.4px;
        }

        .ob-logo-star {
          color: #f0b34a;
          font-size: 20px;
          filter: drop-shadow(0 0 9px rgba(240,179,74,.35));
        }

        .ob-skip {
          border: 0;
          background: transparent;
          color: ${C.muted};
          font-size: 11px;
          cursor: pointer;
        }

        .ob-main {
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          padding: 12px 0;
        }

        .ob-eyebrow {
          color: #f0b34a;
          font-family: ${F.mono};
          font-size: 8px;
          letter-spacing: 2.5px;
          margin-bottom: 15px;
        }

        .ob-slide {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .ob-phone {
          width: min(310px, 72vw);
          aspect-ratio: .56;
          max-height: 49vh;
          border: 1px solid rgba(126,105,218,.38);
          border-radius: 27px;
          background:
            radial-gradient(circle at 50% 28%, rgba(111,71,230,.10), transparent 30%),
            linear-gradient(145deg, rgba(18,19,36,.98), rgba(9,11,22,.98));
          box-shadow:
            0 24px 70px rgba(0,0,0,.38),
            0 0 45px rgba(104,71,230,.08);
          padding: 12px;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .ob-phone-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #77768d;
          font-size: 8px;
          flex: 0 0 auto;
        }

        .ob-phone-content {
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
          text-align: left;
          padding: 12px 9px 8px;
        }

        .ob-slide-visual {
          width: 100%;
          height: 126px;
          flex: 0 0 126px;
          border: 1px solid rgba(126,105,218,.22);
          border-radius: 15px;
          background: rgba(8,10,21,.62);
          overflow: hidden;
          position: relative;
        }

        .ob-visual-welcome {
          display: grid;
          place-items: center;
          background:
            radial-gradient(circle at 50% 50%, rgba(126,78,255,.20), transparent 44%),
            rgba(8,10,21,.62);
        }

        .ob-welcome-glow {
          position: absolute;
          width: 90px;
          height: 90px;
          border-radius: 50%;
          background: rgba(126,78,255,.18);
          filter: blur(24px);
        }

        .ob-welcome-star {
          position: relative;
          color: #f0b34a;
          font-size: 44px;
          filter: drop-shadow(0 0 13px rgba(240,179,74,.35));
        }

        .ob-visual-validate {
          padding: 12px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .ob-signal-row {
          display: grid;
          grid-template-columns: 20px 1fr 18px;
          gap: 7px;
          align-items: center;
          min-height: 25%;
          border-bottom: 1px solid rgba(126,105,218,.09);
          color: #c8c4d9;
          font-size: 9px;
        }

        .ob-signal-row svg:first-child {
          color: #a99aff;
        }

        .ob-signal-row svg:last-child {
          color: #36ca87;
        }

        .ob-visual-decide {
          padding: 16px 14px;
        }

        .ob-decision-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #d7d3e7;
          font-size: 10px;
          font-family: ${F.mono};
          margin-bottom: 17px;
        }

        .ob-decision-head svg {
          color: #a99aff;
        }

        .ob-decision-row {
          display: grid;
          grid-template-columns: 50px 1fr 28px;
          align-items: center;
          gap: 7px;
          margin-top: 11px;
          color: #85839e;
          font-size: 8px;
        }

        .ob-decision-row b {
          color: #d0cbdf;
          text-align: right;
          font-weight: 500;
        }

        .ob-progress {
          height: 7px;
          border-radius: 999px;
          overflow: hidden;
          background: rgba(116,108,156,.22);
        }

        .ob-progress i {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: #42c98b;
        }

        .ob-decision-row:last-child .ob-progress i {
          background: #f0b34a;
        }

        .ob-visual-measure {
          padding: 14px;
          color: #43c98b;
        }

        .ob-metric-label {
          color: #85839e;
          font-family: ${F.mono};
          font-size: 8px;
        }

        .ob-metric-value {
          color: #eeeaf7;
          font-size: 24px;
          font-weight: 600;
          margin-top: 2px;
        }

        .ob-metric-change {
          color: #43c98b;
          font-size: 9px;
          margin-top: 2px;
        }

        .ob-visual-measure svg {
          position: absolute;
          left: 9px;
          right: 9px;
          bottom: 5px;
          width: calc(100% - 18px);
          height: 53px;
        }

        .ob-visual-ready {
          display: grid;
          place-items: center;
          background:
            radial-gradient(circle, rgba(126,78,255,.16), transparent 48%),
            rgba(8,10,21,.62);
        }

        .ob-ready-orbit {
          position: absolute;
          border: 1px solid rgba(126,78,255,.24);
          border-radius: 50%;
        }

        .orbit-a {
          width: 68%;
          aspect-ratio: 1;
        }

        .orbit-b {
          width: 43%;
          aspect-ratio: 1;
          border-color: rgba(240,179,74,.20);
        }

        .ob-ready-center {
          position: relative;
          z-index: 1;
          width: 100px;
          height: 100px;
          border-radius: 18px;
          border: 1px solid rgba(126,78,255,.55);
          background: rgba(17,17,37,.94);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 7px;
          box-shadow: 0 0 30px rgba(126,78,255,.12);
        }

        .ob-ready-center > span {
          color: #f0b34a;
          font-size: 20px;
        }

        .ob-ready-center strong {
          font-family: ${F.display};
          font-size: 15px;
        }

        .ob-ready-center strong span {
          color: #f0b34a;
        }

        .ob-slide-title {
          margin: 22px 0 0;
          font-family: ${F.display};
          font-size: clamp(25px, 7vw, 34px);
          line-height: 1.02;
          letter-spacing: -1px;
        }

        .ob-slide-title span {
          color: #a88cff;
        }

        .ob-slide-description {
          max-width: 360px;
          margin: 10px auto 0;
          color: ${C.muted};
          font-size: 11px;
          line-height: 1.5;
        }

        .ob-controls {
          width: min(310px, 72vw);
          flex: 0 0 auto;
        }

        .ob-dots {
          display: flex;
          justify-content: center;
          gap: 7px;
          margin: 13px 0 11px;
        }

        .ob-dot {
          width: 7px;
          height: 7px;
          padding: 0;
          border: 0;
          border-radius: 50%;
          background: #2b2940;
          cursor: pointer;
        }

        .ob-dot.active {
          width: 8px;
          height: 8px;
          background: #9c7bff;
          box-shadow: 0 0 10px rgba(156,123,255,.4);
        }

        .ob-next {
          width: 100%;
          height: 44px;
          border: 0;
          border-radius: 12px;
          background: linear-gradient(100deg, #7448ff, #5134df);
          color: white;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          font-family: ${F.display};
          font-size: 12px;
          font-weight: 650;
          box-shadow: 0 12px 30px rgba(108,68,240,.20);
          cursor: pointer;
        }

        .ob-next:disabled {
          opacity: .48;
          cursor: not-allowed;
        }

        .ob-agree {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 9px;
          color: ${C.muted};
          font-size: 8.5px;
        }

        .ob-agree input {
          width: 13px;
          height: 13px;
          margin: 0;
          accent-color: #7448ff;
        }

        .ob-agree a {
          color: #f0b34a;
          text-decoration: underline;
        }

        .ob-footer {
          flex: 0 0 auto;
          margin-top: 10px;
          text-align: center;
          color: ${C.muted};
          opacity: .48;
          font-family: ${F.mono};
          font-size: 6px;
          letter-spacing: 2.5px;
        }

        @media (max-height: 700px) {
          .ob-page {
            padding-top: 12px;
            padding-bottom: 9px;
          }

          .ob-main {
            padding: 6px 0;
          }

          .ob-eyebrow {
            margin-bottom: 8px;
          }

          .ob-phone {
            width: min(270px, 65vw);
            max-height: 43vh;
          }

          .ob-slide-visual {
            height: 105px;
            flex-basis: 105px;
          }

          .ob-slide-title {
            margin-top: 14px;
            font-size: 24px;
          }

          .ob-slide-description {
            margin-top: 6px;
            font-size: 9px;
          }

          .ob-dots {
            margin: 8px 0 7px;
          }

          .ob-next {
            height: 38px;
            width: 100%;
          }

          .ob-agree {
            margin-top: 5px;
          }
        }

        @media (max-width: 380px) {
          .ob-page {
            padding-left: 14px;
            padding-right: 14px;
          }

          .ob-phone {
            width: min(280px, 78vw);
          }

          .ob-phone-content {
            padding-left: 6px;
            padding-right: 6px;
          }

          .ob-slide-title {
            font-size: 24px;
          }

          .ob-slide-description {
            font-size: 10px;
          }

          .ob-controls {
            width: min(280px, 78vw);
          }
        }
      `}</style>

      <div className="ob-shell">
        <header className="ob-top">
          <div className="ob-logo">
            <span className="ob-logo-star">✦</span>
            <span>
              Founder<span style={{ color: "#f0b34a" }}>OS</span>
            </span>
          </div>

          <button
            className="ob-skip"
            type="button"
            onClick={() => setSlide(SLIDES.length - 1)}
          >
            Skip
          </button>
        </header>

        <main className="ob-main">
          <section className="ob-slide" key={current.key}>
            <div className="ob-eyebrow">{current.eyebrow}</div>

            <div className="ob-phone">

              <div className="ob-phone-content">
                <SlideVisual type={current.icon} />

                <h1 className="ob-slide-title">{current.title}</h1>

                <p className="ob-slide-description">
                  {current.description}
                </p>
              </div>
            </div>
          </section>
        </main>

        <section className="ob-controls">
          <div className="ob-dots" aria-label="Onboarding progress">
            {SLIDES.map((item, index) => (
              <button
                key={item.key}
                type="button"
                className={`ob-dot ${index === slide ? "active" : ""}`}
                aria-label={`Go to slide ${index + 1}`}
                onClick={() => setSlide(index)}
              />
            ))}
          </div>

          {!last ? (
            <button className="ob-next" type="button" onClick={next}>
              Next
              <ArrowRight size={15} />
            </button>
          ) : (
            <>
              <button
                className="ob-next"
                type="button"
                onClick={start}
                disabled={!agreed || starting}
              >
                {starting ? "Starting…" : "Get Started"}
                {!starting && <Rocket size={15} />}
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
            </>
          )}
        </section>

        <footer className="ob-footer">
          IDEAS DESERVE A CLEARER TOMORROW.
        </footer>
      </div>

      {showTerms && (
        <div
          onClick={() => setShowTerms(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.72)",
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
              overflow: "auto",
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

            <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.6 }}>
              <p>{TERMS_INTRO}</p>
              <p>{TERMS_BODY}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
