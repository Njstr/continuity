import React, { useEffect, useState, useRef, lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Header, NavBar } from "./components/Layout";
import { ChatSidebar } from "./components/ChatSidebar";
import { OfflineBanner } from "./components/OfflineBanner";
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
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const cp = await loadJSON("companyProfile", null);
      const m = await loadJSON("startupMetrics", null);

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
      setConversations(convs);
      setActiveConversationId(activeId);
      setReady(true);
      api.track("session_start");

      try {
        const { conversations: dbConvs } = await api.getConversations();
        const hasRealLocalHistory = convs.some((c) => c.messages?.length > 0);
        if (dbConvs && dbConvs.length > 0) {
          // Merge against whatever's in React state RIGHT NOW, not the
          // `convs` snapshot from the top of this effect — local state
          // may have picked up genuine activity since this async fetch
          // started (e.g. the execution engine's one-time task-reveal
          // message landing in Chat.jsx, or the founder simply typing
          // fast). The debounced upload to the server (see the
          // `conversations` effect below) hasn't necessarily caught up
          // yet by the time this GET resolves, so a blind overwrite here
          // would silently discard real local activity — prefer whichever
          // side has more messages for a given conversation id, and keep
          // any conversation that only exists locally so far.
          setConversations((currentLocal) => {
            const merged = dbConvs.map((serverConv) => {
              const localConv = currentLocal.find((c) => c.id === serverConv.id);
              const localCount = localConv?.messages?.length || 0;
              const serverCount = serverConv?.messages?.length || 0;
              return localCount > serverCount ? localConv : serverConv;
            });
            const localOnly = currentLocal.filter((c) => !dbConvs.find((sc) => sc.id === c.id));
            return [...localOnly, ...merged];
          });
          // Local persistence + the debounced server upload both already
          // happen automatically from the `conversations` effect below
          // whenever state changes — no need to duplicate that here, and
          // doing so with the pre-merge `dbConvs` value would just
          // re-introduce the same overwrite this merge exists to prevent.
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
        {screen === "metrics" && <MetricsHome metrics={metrics || {}} onApplyMetrics={applyExtractedMetrics} />}
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
