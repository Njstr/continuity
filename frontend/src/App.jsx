import React, { useEffect, useState, useRef, lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Header, NavBar } from "./components/Layout";
import { ChatSidebar } from "./components/ChatSidebar";
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

function ScreenFallback() {
  return (
    <div style={styles.centerCol}>
      <Loader2 className="spin" size={20} color={C.accent} />
    </div>
  );
}

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function freshConversation() {
  return { id: uid(), title: null, createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [companyProfile, setCompanyProfileState] = useState(null);
  const [screen, setScreen] = useState("chats");
  const [metrics, setMetricsState] = useState(null);
  const [decisions, setDecisionsState] = useState([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [activeDecisionId, setActiveDecisionId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const cp = await loadJSON("companyProfile", null);
      const m = await loadJSON("startupMetrics", null);
      const d = await loadJSON("decisions", []);
      const t = await loadJSON("termsAccepted", false);

      let convs = await loadJSON("conversations", null);
      let activeId = await loadJSON("activeConversationId", null);
      if (!convs || convs.length === 0) {
        // One-time migration from the old single-thread "chatlog" key.
        const legacy = await loadJSON("chatlog", []);
        convs = [{ ...freshConversation(), messages: legacy || [] }];
      }
      if (!activeId || !convs.find((c) => c.id === activeId)) {
        activeId = [...convs].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0].id;
      }

      setCompanyProfileState(cp);
      setMetricsState(m);
      setDecisionsState(d);
      setTermsAccepted(t);
      setConversations(convs);
      setActiveConversationId(activeId);
      setReady(true);
      api.track("session_start");

      // Chat history is database-backed, same pattern as feedback: the DB
      // is the source of truth once it has anything in it. If it's empty
      // but this device already has real local history (e.g. upgrading
      // from before this feature existed), push local up to seed it
      // instead of silently discarding it.
      try {
        const { conversations: dbConvs } = await api.getConversations();
        const hasRealLocalHistory = convs.some((c) => c.messages?.length > 0);
        if (dbConvs && dbConvs.length > 0) {
          setConversations(dbConvs);
          await saveJSON("conversations", dbConvs);
          const stillActive = dbConvs.find((c) => c.id === activeId);
          if (!stillActive) setActiveConversationId([...dbConvs].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0].id);
        } else if (hasRealLocalHistory) {
          api.putConversations(convs);
        }
      } catch {
        // offline or backend unreachable — keep working off the local copy
      }
    })();
  }, []);

  // Persist conversations/active id after boot, whenever they change —
  // locally instantly, and to the database (debounced) as the durable copy.
  const syncTimerRef = useRef(null);
  useEffect(() => {
    if (!ready) return;
    saveJSON("conversations", conversations);
    clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => api.putConversations(conversations), 600);
    return () => clearTimeout(syncTimerRef.current);
  }, [conversations, ready]);
  useEffect(() => {
    if (ready && activeConversationId) saveJSON("activeConversationId", activeConversationId);
  }, [activeConversationId, ready]);

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
  // Feedback is submit-only: it goes straight to the database (see
  // GET /admin/feedback for how to read it back) and is never loaded into,
  // stored in, or rendered by the frontend — no local cache, no state.
  const addFeedback = async (entry) => {
    api.submitFeedback(entry);
  };

  function updateConversationMessages(id, messages) {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, messages, updatedAt: Date.now() } : c)));
  }
  function setConversationTitle(id, title) {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
  }
  function newChat() {
    const c = freshConversation();
    setConversations((prev) => [c, ...prev]);
    setActiveConversationId(c.id);
    setSidebarOpen(false);
    navigate("chats");
  }
  function selectConversation(id) {
    setActiveConversationId(id);
    setSidebarOpen(false);
    navigate("chats");
  }
  function deleteConversation(id) {
    setConversations((prev) => {
      const remaining = prev.filter((c) => c.id !== id);
      const list = remaining.length ? remaining : [freshConversation()];
      if (id === activeConversationId) setActiveConversationId(list[0].id);
      return list;
    });
  }

  function selectDecision(id) {
    setActiveDecisionId(id);
    setScreen("history");
  }

  function navigate(targetScreen) {
    setActiveDecisionId(null);
    if (targetScreen !== "chats") setSidebarOpen(false);
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

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || conversations[0];

  return (
    <div style={styles.app}>
      <style>{globalCss}</style>
      <OfflineBanner />
      <Header companyProfile={companyProfile} onToggleSidebar={screen === "chats" ? () => setSidebarOpen((o) => !o) : undefined} />
      {screen === "chats" && (
        <ChatSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelect={selectConversation}
          onNewChat={newChat}
          onDelete={deleteConversation}
        />
      )}
      <div style={styles.body}>
        {screen === "chats" && (
          <Chat
            profile={companyProfile}
            metrics={metrics}
            conversation={activeConversation}
            onUpdateMessages={updateConversationMessages}
            onTitleGenerated={setConversationTitle}
            onFeedback={addFeedback}
          />
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
        </Suspense>
      </div>
      <NavBar screen={screen} setScreen={navigate} />
    </div>
  );
}
