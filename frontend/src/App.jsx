import React, { useEffect, useState, lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Header, NavBar } from "./components/Layout";
import { OfflineBanner } from "./components/OfflineBanner";
import { TermsGate } from "./pages/TermsGate";
import { Onboarding } from "./pages/Onboarding";
import { Dashboard } from "./pages/Dashboard";
import { styles } from "./styles/styles";
import { globalCss, C } from "./styles/theme";
import { loadJSON, saveJSON } from "./utils/storage";
import { api } from "./api/client";

// Route-level code splitting: the screens below Dashboard aren't needed
// for first paint, so they're only fetched when a user actually navigates
// to them — keeps the initial bundle (and time-to-interactive) smaller.
const Mission = lazy(() => import("./pages/Mission").then((m) => ({ default: m.Mission })));
const Decide = lazy(() => import("./pages/Decide").then((m) => ({ default: m.Decide })));
const Chat = lazy(() => import("./pages/Chat").then((m) => ({ default: m.Chat })));
const More = lazy(() => import("./pages/More").then((m) => ({ default: m.More })));
const WeeklyReview = lazy(() => import("./pages/WeeklyReview").then((m) => ({ default: m.WeeklyReview })));
const Timeline = lazy(() => import("./pages/Timeline").then((m) => ({ default: m.Timeline })));
const Terms = lazy(() => import("./pages/Terms").then((m) => ({ default: m.Terms })));

function ScreenFallback() {
  return (
    <div style={styles.centerCol}>
      <Loader2 className="spin" size={20} color={C.accent} />
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [profile, setProfileState] = useState(null);
  const [screen, setScreen] = useState("dashboard");
  const [missions, setMissionsState] = useState([]);
  const [chatlog, setChatlogState] = useState([]);
  const [feedback, setFeedbackState] = useState([]);
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await loadJSON("profile", null);
      const m = await loadJSON("missions", []);
      const c = await loadJSON("chatlog", []);
      const f = await loadJSON("feedback", []);
      const t = await loadJSON("termsAccepted", false);
      setProfileState(p);
      setMissionsState(m);
      setChatlogState(c);
      setFeedbackState(f);
      setTermsAccepted(t);
      setReady(true);
      api.track("session_start");
    })();
  }, []);

  const setProfile = async (p) => {
    setProfileState(p);
    await saveJSON("profile", p);
  };
  const setMissions = async (m) => {
    setMissionsState(m);
    await saveJSON("missions", m);
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

  if (!profile) {
    return (
      <Onboarding
        onDone={async (p) => {
          await setProfile(p);
          api.track("onboarding_completed");
        }}
      />
    );
  }

  return (
    <div style={styles.app}>
      <style>{globalCss}</style>
      <OfflineBanner />
      <Header profile={profile} />
      <div style={styles.body}>
        {screen === "dashboard" && <Dashboard profile={profile} missions={missions} setProfile={setProfile} />}
        <Suspense fallback={<ScreenFallback />}>
          {screen === "mission" && (
            <Mission profile={profile} setProfile={setProfile} missions={missions} setMissions={setMissions} onFeedback={addFeedback} />
          )}
          {screen === "decide" && <Decide profile={profile} />}
          {screen === "chat" && (
            <Chat profile={profile} missions={missions} chatlog={chatlog} setChatlog={setChatlog} onFeedback={addFeedback} setScreen={setScreen} />
          )}
          {screen === "more" && <More setScreen={setScreen} onFeedback={addFeedback} profile={profile} missions={missions} />}
          {screen === "weekly" && <WeeklyReview profile={profile} missions={missions} setScreen={setScreen} />}
          {screen === "timeline" && <Timeline setScreen={setScreen} />}
          {screen === "terms" && <Terms setScreen={setScreen} />}
        </Suspense>
      </div>
      <NavBar screen={screen} setScreen={setScreen} />
    </div>
  );
}
