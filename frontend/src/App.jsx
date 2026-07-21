import React, { useEffect, useState, lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Header, NavBar } from "./components/Layout";
import { OfflineBanner } from "./components/OfflineBanner";
import { TermsGate } from "./pages/TermsGate";
import { Onboarding } from "./pages/Onboarding";
import { Chat } from "./pages/Chat";
import { MetricsHome } from "./pages/MetricsHome";
import { styles } from "./styles/styles";
import { globalCss, C } from "./styles/theme";
import { loadJSON, saveJSON } from "./utils/storage";
import { api } from "./api/client";

// Route-level code splitting for everything below Chats/Metrics.
const History = lazy(() => import("./pages/History").then((m) => ({ default: m.History })));
const More = lazy(() => import("./pages/More").then((m) => ({ default: m.More })));
const Learning = lazy(() => import("./pages/Learning").then((m) => ({ default: m.Learning })));
const Terms = lazy(() => import("./pages/Terms").then((m) => ({ default: m.Terms })));
const FeedbackCenter = lazy(() => import("./pages/FeedbackCenter").then((m) => ({ default: m.FeedbackCenter })));

function ScreenFallback() {
  return (
    <div style={styles.centerCol}>
      <Loader2 className="spin" size={20} color={C.accent} />
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [companyProfile, setCompanyProfileState] = useState(null);
  const [screen, setScreen] = useState("chats");
  const [metrics, setMetricsState] = useState(null);
  const [decisions, setDecisionsState] = useState([]);
  const [feedback, setFeedbackState] = useState([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [activeDecisionId, setActiveDecisionId] = useState(null);
  const [chatlog, setChatlogState] = useState([]);

  useEffect(() => {
    (async () => {
      const cp = await loadJSON("companyProfile", null);
      const m = await loadJSON("startupMetrics", null);
      const d = await loadJSON("decisions", []);
      const localFeedback = await loadJSON("feedback", []);
      const t = await loadJSON("termsAccepted", false);
      const c = await loadJSON("chatlog", []);
      setCompanyProfileState(cp);
      setMetricsState(m);
      setDecisionsState(d);
      setFeedbackState(localFeedback); // instant paint from cache, replaced below once the DB responds
      setTermsAccepted(t);
      setChatlogState(c);
      setReady(true);
      api.track("session_start");

      // Feedback Center is database-backed: the DB is the source of truth,
      // the local cache is just an offline fallback / instant first paint.
      try {
        const { feedback: dbFeedback } = await api.getMyFeedback();
        const normalized = dbFeedback.map((row) => ({ ...row, ts: row.ts || new Date(row.createdAt).getTime() }));
        setFeedbackState(normalized);
        await saveJSON("feedback", normalized);
      } catch {
        // offline or backend unreachable — keep showing the local cache
      }
    })();
  }, []);

  const setCompanyProfile = async (cp) => {
    setCompanyProfileState(cp);
    await saveJSON("companyProfile", cp);
  };
  const setMetrics = async (m) => {
    setMetricsState(m);
    await saveJSON("startupMetrics", m);
  };
  const setDecisions = async (d) => {
    setDecisionsState(d);
    await saveJSON("decisions", d);
  };
  const setChatlog = async (c) => {
    setChatlogState(c);
    await saveJSON("chatlog", c);
  };
  const addFeedback = async (entry) => {
    const updated = [...feedback, { ...entry, ts: Date.now() }];
    setFeedbackState(updated);
    await saveJSON("feedback", updated);
    api.submitFeedback(entry);
  };

  function selectDecision(id) {
    setActiveDecisionId(id);
    setScreen("history");
  }

  function navigate(targetScreen) {
    setActiveDecisionId(null);
    setScreen(targetScreen);
  }

  if (!ready) {
    return (
      <div style={styles.bootWrap}>
        <style>{globalCss}</style>
      </div>
    );
  }

  if (!termsAccepted) {
    return (
      <TermsGate
        onAccept={async () => {
          setTermsAccepted(true);
          await saveJSON("termsAccepted", true);
        }}
      />
    );
  }

  if (!companyProfile) {
    return (
      <Onboarding
        onDone={async (cp, m) => {
          await setCompanyProfile(cp);
          await setMetrics(m);
          api.track("onboarding_completed");
        }}
      />
    );
  }

  return (
    <div style={styles.app}>
      <style>{globalCss}</style>
      <OfflineBanner />
      <Header companyProfile={companyProfile} />
      <div style={styles.body}>
        {screen === "chats" && (
          <Chat profile={companyProfile} metrics={metrics} chatlog={chatlog} setChatlog={setChatlog} onFeedback={addFeedback} />
        )}
        {screen === "metrics" && <MetricsHome metrics={metrics || {}} setMetrics={setMetrics} />}
        <Suspense fallback={<ScreenFallback />}>
          {screen === "history" && (
            <History
              decisions={decisions}
              setDecisions={setDecisions}
              activeDecisionId={activeDecisionId}
              setActiveDecisionId={setActiveDecisionId}
              setScreen={navigate}
            />
          )}
          {screen === "more" && (
            <More
              setScreen={navigate}
              onFeedback={addFeedback}
              companyProfile={companyProfile}
              setCompanyProfile={setCompanyProfile}
              decisions={decisions}
            />
          )}
          {screen === "learning" && <Learning decisions={decisions} setScreen={navigate} />}
          {screen === "terms" && <Terms setScreen={navigate} />}
          {screen === "feedback-center" && <FeedbackCenter feedback={feedback} setScreen={navigate} />}
        </Suspense>
      </div>
      <NavBar screen={screen} setScreen={navigate} />
    </div>
  );
}
