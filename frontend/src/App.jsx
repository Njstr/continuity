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

// Exactly three primary tabs (Chats/Metrics/More) — everything else
// (decision history, company profile, settings) lives inline within
// More, not as separate routes. These two remain lazy-loaded secondary
// screens reachable only from within More.
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
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [financialDataUnlocked, setFinancialDataUnlocked] = useState(false);

  useEffect(() => {
    (async () => {
      const cp = await loadJSON("companyProfile", null);
      const m = await loadJSON("startupMetrics", null);
      const t = await loadJSON("termsAccepted", false);
      const fdu = await loadJSON("financialDataUnlocked", false);

      let convs = await loadJSON("conversations", null);
      let activeId = await loadJSON("activeConversationId", null);
      if (!convs || convs.length === 0) {
        const legacy = await loadJSON("chatlog", []);
        convs = [{ ...freshConversation(), messages: legacy || [] }];
      }
      if (!activeId || !convs.find((c) => c.id === activeId)) {
        activeId = [...convs].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0].id;
      }

      setCompanyProfileState(cp);
      setMetricsState(m);
      setTermsAccepted(t);
      setFinancialDataUnlocked(fdu);
      setConversations(convs);
      setActiveConversationId(activeId);
      setReady(true);
      api.track("session_start");

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
  const applyExtractedMetrics = async (partial) => {
    await setMetrics({ ...(metrics || {}), ...partial });
    if (!financialDataUnlocked && Object.keys(partial).length > 0) {
      setFinancialDataUnlocked(true);
      await saveJSON("financialDataUnlocked", true);
    }
  };
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

  function navigate(targetScreen) {
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
            onApplyMetrics={applyExtractedMetrics}
          />
        )}
        {screen === "metrics" && <MetricsHome metrics={metrics || {}} onApplyMetrics={applyExtractedMetrics} unlocked={financialDataUnlocked} />}
        <Suspense fallback={<ScreenFallback />}>
          {screen === "more" && (
            <More setScreen={navigate} onFeedback={addFeedback} companyProfile={companyProfile} setCompanyProfile={setCompanyProfile} />
          )}
          {screen === "learning" && <Learning decisions={[]} setScreen={navigate} />}
          {screen === "terms" && <Terms setScreen={navigate} />}
        </Suspense>
      </div>
      <NavBar screen={screen} setScreen={navigate} />
    </div>
  );
}
