import { C, F } from "./theme";

// Preserved 1:1 from the original single-file build so the UI/UX doesn't
// shift at all in this refactor — only new keys at the bottom (focusList,
// timeline*) were added for the new Daily Focus / Timeline screens.
export const styles = {
  app: { display: "flex", flexDirection: "column", height: "100vh", background: C.bg, color: C.text, fontFamily: F.body },
  bootWrap: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: C.bg },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: `1px solid ${C.border}` },
  brand: { fontFamily: F.display, fontSize: 15, letterSpacing: 0.3 },
  stageBadge: { fontFamily: F.mono, fontSize: 10, color: C.accent, border: `1px solid ${C.accent}`, padding: "3px 8px", borderRadius: 20, letterSpacing: 0.5 },
  body: { flex: 1, overflowY: "auto" },
  nav: { display: "flex", borderTop: `1px solid ${C.border}`, background: C.surface },
  navBtn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "10px 0 12px", background: "transparent", border: "none", cursor: "pointer" },
  screenPad: { padding: "18px 16px 28px" },
  centerCol: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh" },
  welcomeBlock: { marginBottom: 20 },
  h1: { fontFamily: F.display, fontSize: 26, margin: "4px 0 0", fontWeight: 600 },
  h2: { fontFamily: F.display, fontSize: 21, margin: "6px 0 12px", fontWeight: 600, lineHeight: 1.35 },
  section: { marginBottom: 24 },
  sectionTitle: { fontFamily: F.mono, fontSize: 11, color: C.muted, letterSpacing: 1, marginBottom: 10 },
  stageTrack: { display: "flex", alignItems: "center" },
  stageStep: { display: "flex", alignItems: "center", flex: 1 },
  stageDot: { width: 9, height: 9, borderRadius: "50%", border: "2px solid", flexShrink: 0 },
  stageLine: { height: 2, flex: 1 },
  vitalsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 },
  vitalCard: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 8px" },
  skillList: { display: "flex", flexDirection: "column", gap: 12 },
  skillRow: {},
  skillLabelRow: { display: "flex", justifyContent: "space-between", marginBottom: 4 },
  barTrack: { position: "relative", height: 6, background: C.surface2, borderRadius: 3, overflow: "hidden" },
  barFillMuted: { position: "absolute", top: 0, left: 0, height: "100%", background: C.surface2, border: `1px dashed ${C.border}`, borderRadius: 3 },
  barFill: { position: "absolute", top: 0, left: 0, height: "100%", background: C.accent, borderRadius: 3 },
  tagRow: { display: "flex", flexWrap: "wrap", gap: 6 },
  tag: { fontSize: 11, padding: "4px 9px", borderRadius: 20, border: "1px solid" },
  logList: { display: "flex", flexDirection: "column", gap: 10 },
  logRow: { display: "flex", alignItems: "center", gap: 10 },
  onboardWrap: { display: "flex", flexDirection: "column", height: "100vh", background: C.bg, color: C.text, fontFamily: F.body, padding: "18px 16px" },
  onboardTop: { display: "flex", alignItems: "center", gap: 8, marginBottom: 30 },
  onboardCard: { flex: 1, display: "flex", flexDirection: "column", gap: 12, justifyContent: "center" },
  qLabel: { fontFamily: F.display, fontSize: 22, lineHeight: 1.4, fontWeight: 600, margin: "8px 0 6px" },
  textarea: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, color: C.text, fontSize: 14, fontFamily: F.body, resize: "none", width: "100%" },
  primaryBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: C.accent, color: "#1A1400", border: "none", borderRadius: 10, padding: "12px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  ghostBtn: { background: "transparent", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", fontSize: 13, cursor: "pointer" },
  dots: { display: "flex", justifyContent: "center", gap: 5, marginTop: 20 },
  dot: { width: 5, height: 5, borderRadius: "50%" },
  missionMeta: { display: "flex", gap: 8, marginBottom: 16 },
  metaChip: { fontFamily: F.mono, fontSize: 11, color: C.muted, border: `1px solid ${C.border}`, padding: "3px 8px", borderRadius: 20 },
  missionBlock: { marginBottom: 16 },
  missionLabel: { fontFamily: F.mono, fontSize: 10, color: C.accent2, letterSpacing: 1, marginBottom: 4 },
  missionText: { fontSize: 14, lineHeight: 1.5, color: C.text, margin: 0 },
  missionActions: { display: "flex", gap: 10, marginTop: 10 },
  chipBtn: { fontSize: 12, padding: "6px 10px", borderRadius: 20, border: `1px solid ${C.border}`, background: C.surface, color: C.text, cursor: "pointer" },
  celebrate: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginTop: 10 },
  chatWrap: { display: "flex", flexDirection: "column", height: "100%" },
  chatScroll: { flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 10 },
  bubbleUser: { background: C.accent, color: "#1A1400", padding: "9px 13px", borderRadius: "14px 14px 3px 14px", maxWidth: "80%", fontSize: 14, lineHeight: 1.45 },
  bubbleAssistant: { background: C.surface, border: `1px solid ${C.border}`, padding: "9px 13px", borderRadius: "14px 14px 14px 3px", maxWidth: "82%", fontSize: 14, lineHeight: 1.45 },
  chatInputRow: { display: "flex", gap: 8, padding: 12, borderTop: `1px solid ${C.border}` },
  chatInput: { flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: "10px 14px", color: C.text, fontSize: 14 },
  sendBtn: { background: C.accent, border: "none", borderRadius: "50%", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", color: "#1A1400", cursor: "pointer" },
  feedbackRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 6 },
  feedbackBtn: { background: "transparent", border: "none", cursor: "pointer", padding: 2, display: "flex" },
  commentBox: { display: "flex", flexDirection: "column", gap: 8, marginTop: 8, width: "100%" },
  commentTextarea: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", color: C.text, fontSize: 13, fontFamily: F.body, resize: "vertical", minHeight: 70, width: "100%" },
  commentSendBtn: { alignSelf: "flex-end", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 14px", color: C.text, fontSize: 12, cursor: "pointer" },
  faqList: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 },
  faqItem: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", cursor: "pointer" },
  faqQ: { display: "flex", alignItems: "center", gap: 8, fontSize: 13 },
  faqA: { fontSize: 12.5, color: C.muted, marginTop: 8, lineHeight: 1.5 },
  contactRow: { display: "flex", alignItems: "center", gap: 8, padding: "4px 2px" },
  linkRow: { display: "flex", alignItems: "center", gap: 10, width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", color: C.text, fontSize: 13, cursor: "pointer" },
  backRow: { display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", padding: 0 },
  termsBlock: { display: "flex", flexDirection: "column", gap: 12, marginTop: 8 },
  termsP: { fontSize: 13, lineHeight: 1.6, color: C.text, margin: 0 },
  gateWrap: { display: "flex", flexDirection: "column", height: "100vh", background: C.bg, color: C.text, fontFamily: F.body },
  gateTop: { display: "flex", alignItems: "center", gap: 8, padding: "18px 16px", borderBottom: `1px solid ${C.border}` },
  gateScroll: { flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12 },
  gateFooter: { padding: 16, borderTop: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 12 },
  agreeRow: { display: "flex", alignItems: "center", gap: 10, cursor: "pointer" },
  agreeCheckbox: { width: 17, height: 17, accentColor: C.accent, cursor: "pointer" },
  metricsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  metricLabel: { fontSize: 11, color: C.muted, display: "block", marginBottom: 4 },
  metricInput: { width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: C.text, fontSize: 13, fontFamily: F.mono },
  metricChip: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 10px" },
  metricChipLabel: { fontSize: 10.5, color: C.muted, letterSpacing: 0.3 },
  metricChipVal: { fontFamily: F.mono, fontSize: 15, marginTop: 2 },
  recCard: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginTop: 14 },
  recStep: { display: "flex", gap: 10, alignItems: "flex-start" },
  editRow: { display: "flex", alignItems: "center", gap: 6 },
  editInput: { flex: 1, background: C.surface, border: `1px solid ${C.accent}`, borderRadius: 8, padding: "6px 10px", color: C.text, fontSize: 15, fontFamily: F.body },
  editIconBtn: { background: "transparent", border: "none", cursor: "pointer", padding: 4, display: "flex", flexShrink: 0 },
  metricLabelRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  infoBtn: { background: "transparent", border: "none", cursor: "pointer", padding: 0, display: "flex" },
  infoText: { fontSize: 11.5, color: C.muted, lineHeight: 1.5, marginTop: 6, marginBottom: 0, background: C.surface2, borderRadius: 6, padding: "6px 8px" },
  badgeRow: { display: "flex", flexWrap: "wrap", gap: 8 },
  badgeChip: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 8px", width: 72 },
  healthScoreRow: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12 },
  healthGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  healthChip: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 10px", cursor: "pointer" },
  missionBanner: { display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", background: C.surface, borderBottom: `1px solid ${C.border}`, cursor: "pointer" },

  // ---- New: Daily Focus checklist (Priority 5) ----
  focusItem: { display: "flex", alignItems: "center", gap: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px" },
  focusItemDone: { opacity: 0.55 },
  focusItemLabel: { fontSize: 13, flex: 1 },
  focusItemTag: { fontFamily: F.mono, fontSize: 9.5, color: C.muted, letterSpacing: 0.4 },

  // ---- New: Timeline (Priority 6) ----
  timelineRow: { display: "flex", gap: 10 },
  timelineDotCol: { display: "flex", flexDirection: "column", alignItems: "center", width: 16 },
  timelineDot: { width: 8, height: 8, borderRadius: "50%", background: C.accent, marginTop: 5, flexShrink: 0 },
  timelineLine: { width: 1, flex: 1, background: C.border, marginTop: 2 },
  timelineContent: { paddingBottom: 18, flex: 1 },
  timelineType: { fontFamily: F.mono, fontSize: 9.5, color: C.accent, letterSpacing: 0.5 },
  timelineTitle: { fontSize: 13, marginTop: 2 },
  timelineDate: { fontFamily: F.mono, fontSize: 10, color: C.muted, marginTop: 2 },

  // ---- New: offline / connection banner ----
  offlineBanner: { display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "#3A2A12", color: C.accent, fontSize: 12, justifyContent: "center" },

  // ---- Home header row (company name + profile icon) ----
  homeHeaderRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  homeCompanyBlock: { display: "flex", flexDirection: "column" },
  homeCompanyLabel: { fontFamily: F.mono, fontSize: 10, color: C.muted, letterSpacing: 1 },
  homeCompanyName: { fontFamily: F.display, fontSize: 20, fontWeight: 600, marginTop: 2 },
  avatarBtn: { width: 42, height: 42, borderRadius: "50%", background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", flexShrink: 0 },
  avatarImg: { width: "100%", height: "100%", objectFit: "cover" },
  avatarInitials: { fontFamily: F.display, fontSize: 15, fontWeight: 600, color: C.accent },
  avatarLarge: { width: 84, height: 84, borderRadius: "50%", background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", margin: "0 auto" },
  avatarLargeInitials: { fontFamily: F.display, fontSize: 28, fontWeight: 600, color: C.accent },

  // ---- Motivational quote banner ----
  quoteBanner: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 20, borderLeft: `3px solid ${C.accent}` },
  quoteText: { fontFamily: F.display, fontSize: 15, fontStyle: "italic", lineHeight: 1.4, margin: 0 },

  // ---- Mission progress card ----
  progressCard: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 20 },
  progressTopRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 },
  progressCount: { fontFamily: F.mono, fontSize: 13, color: C.text },
  progressPct: { fontFamily: F.mono, fontSize: 13, color: C.accent },
  progressBarTrack: { height: 10, background: C.surface2, borderRadius: 5, overflow: "hidden" },
  progressBarFill: { height: "100%", background: C.accent, borderRadius: 5, transition: "width 0.3s ease" },

  // ---- Mission list cards (Your Missions / Mission Accomplished) ----
  missionCard: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 10 },
  missionCardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 },
  missionCardTitle: { fontSize: 14.5, fontWeight: 600, lineHeight: 1.35 },
  missionCardDesc: { fontSize: 12.5, color: C.muted, lineHeight: 1.5, margin: "4px 0 10px" },
  missionCardMetaRow: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 },
  difficultyChip: { fontSize: 10.5, fontFamily: F.mono, padding: "3px 8px", borderRadius: 20, border: "1px solid", letterSpacing: 0.3 },
  xpChip: { fontSize: 10.5, fontFamily: F.mono, padding: "3px 8px", borderRadius: 20, border: `1px solid ${C.accent}`, color: C.accent, letterSpacing: 0.3 },
  emptyStateText: { fontSize: 13, color: C.muted, padding: "8px 0" },

  // ---- Mission Mode (execution screen) ----
  timerDisplay: { fontFamily: F.mono, fontSize: 36, textAlign: "center", margin: "14px 0", letterSpacing: 1 },
  checklistItem: { display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${C.border}` },
  checklistLabel: { fontSize: 13.5, flex: 1 },

  // ---- Publish proof ----
  proofOptionRow: { display: "flex", gap: 8, marginBottom: 12 },
  proofOptionBtn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 8px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", color: C.muted },
  proofOptionBtnActive: { borderColor: C.accent, color: C.accent, background: "rgba(227,165,72,0.08)" },
  proofPreviewImg: { width: "100%", borderRadius: 10, border: `1px solid ${C.border}`, marginTop: 10 },

  // ---- Quick actions row on Home ----
  quickActionsRow: { display: "flex", gap: 10, marginBottom: 20 },
  quickActionBtn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 8px", cursor: "pointer", color: C.text },
  quickActionLabel: { fontSize: 11.5, fontFamily: F.mono, letterSpacing: 0.3 },

  // ---- Profile page ----
  profileHeaderBlock: { textAlign: "center", marginBottom: 24 },
  profileName: { fontFamily: F.display, fontSize: 22, fontWeight: 600, marginTop: 12 },
  profileCompany: { fontSize: 13, color: C.muted, marginTop: 2 },
  photoUploadBtn: { fontSize: 11, color: C.accent, background: "transparent", border: "none", cursor: "pointer", marginTop: 8, fontFamily: F.mono },
  statRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 },

  // ---- Courses ----
  courseCard: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 10 },
  courseCardTitle: { fontSize: 14.5, fontWeight: 600 },
  courseCardDesc: { fontSize: 12.5, color: C.muted, lineHeight: 1.5, margin: "4px 0 8px" },
  courseCardMeta: { fontFamily: F.mono, fontSize: 10.5, color: C.accent2, letterSpacing: 0.3 },

  // ---- Simple modal overlay (View Proof) ----
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 },
  modalSheet: { background: C.surface, borderRadius: "16px 16px 0 0", border: `1px solid ${C.border}`, padding: 20, width: "100%", maxWidth: 480, maxHeight: "80vh", overflowY: "auto" },

  // ---- Business Setup wizard ----
  stepBadge: { fontFamily: F.mono, fontSize: 11, color: C.accent, letterSpacing: 1 },
  selectInput: { width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, color: C.text, fontSize: 14, fontFamily: F.body },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 12.5, color: C.muted, display: "block", marginBottom: 6 },
  goalChip: { fontSize: 12.5, padding: "8px 14px", borderRadius: 20, border: `1px solid ${C.border}`, background: C.surface, color: C.muted, cursor: "pointer" },
  goalChipActive: { borderColor: C.accent, color: C.accent, background: "rgba(227,165,72,0.1)" },
  goalGrid: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 },
  integrationRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 8 },
  integrationConnectBtn: { fontSize: 11.5, fontFamily: F.mono, color: C.muted, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 20, padding: "5px 12px", cursor: "not-allowed" },
  wizardProgressRow: { display: "flex", gap: 4, marginBottom: 20 },
  wizardProgressSeg: { flex: 1, height: 3, borderRadius: 2, background: C.border },
  wizardProgressSegActive: { background: C.accent },

  // ---- Computed metric cards (Metrics page) ----
  metricsGridWide: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 },
  metricCard2: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 },
  metricCardLabel: { fontSize: 10.5, color: C.muted, letterSpacing: 0.4, fontFamily: F.mono },
  metricCardValue: { fontFamily: F.mono, fontSize: 19, marginTop: 6 },
  metricCardTrend: { fontSize: 10.5, marginTop: 4, fontFamily: F.mono },
  metricWhyBtn: { fontSize: 10.5, color: C.muted, background: "transparent", border: "none", cursor: "pointer", marginTop: 6, padding: 0, textDecoration: "underline", fontFamily: F.mono },
  metricWhyText: { fontSize: 11.5, color: C.muted, lineHeight: 1.5, marginTop: 8, background: C.surface2, borderRadius: 8, padding: "8px 10px" },

  // ---- Business Impact panel (after Publish Proof) ----
  impactRow: { display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${C.border}` },
  impactLabel: { fontSize: 13, flex: 1 },
  impactValue: { fontFamily: F.mono, fontSize: 13, fontWeight: 600 },
  impactPositive: { color: C.accent2 },
  impactNegative: { color: C.accent },

  // ---- Founder OS Brief (new Home) ----
  briefCard: { background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginBottom: 18 },
  briefQLabel: { fontFamily: F.mono, fontSize: 10, color: C.accent, letterSpacing: 0.6, marginTop: 14 },
  briefQLabelFirst: { fontFamily: F.mono, fontSize: 10, color: C.accent, letterSpacing: 0.6 },
  briefAnswer: { fontSize: 14, lineHeight: 1.5, marginTop: 4, color: C.text },
  briefTrendRow: { display: "flex", alignItems: "center", gap: 6, marginTop: 4 },
  briefRefreshBtn: { display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: C.muted, fontSize: 11, fontFamily: F.mono, cursor: "pointer", marginTop: 14, padding: 0 },

  // ---- Part 14 Dashboard: qualitative OS metrics grid ----
  osGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 },
  osCard: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 },
  osCardLabel: { fontSize: 10, color: C.muted, fontFamily: F.mono, letterSpacing: 0.3 },
  osCardValue: { fontFamily: F.mono, fontSize: 15, marginTop: 5 },
  osBadgeLow: { color: "#E36B48" },
  osBadgeMedium: { color: C.accent },
  osBadgeHigh: { color: C.accent2 },

  // ---- Learning (AI-generated lessons, replaces static Courses) ----
  lessonSection: { marginBottom: 16 },
  lessonHeading: { fontSize: 14, fontWeight: 600, marginBottom: 4 },

  // ---- Simulator ----
  scenarioChip: { fontSize: 12, padding: "8px 12px", borderRadius: 20, border: `1px solid ${C.border}`, background: C.surface, color: C.muted, cursor: "pointer" },
  scenarioChipActive: { borderColor: C.accent, color: C.accent, background: "rgba(227,165,72,0.1)" },

  // ---- Decision Graph chain ----
  chainRow: { display: "flex", flexDirection: "column", gap: 2, marginTop: 10 },
  chainStep: { display: "flex", gap: 8, alignItems: "flex-start", paddingLeft: 4, borderLeft: `2px solid ${C.border}`, paddingBottom: 10 },
  chainStepLabel: { fontFamily: F.mono, fontSize: 9.5, color: C.accent, letterSpacing: 0.4 },
  chainStepText: { fontSize: 12.5, color: C.text, marginTop: 2 },

  // ---- Signal log (manual observation input, Part 4 honest version) ----
  signalInputRow: { display: "flex", gap: 8 },

  // ============================================================
  // FounderOS V2 — Decision Intelligence Platform
  // ============================================================

  // ---- Onboarding: metric groups ----
  metricGroupTitle: { fontFamily: F.mono, fontSize: 11, color: C.accent, letterSpacing: 0.8, marginTop: 18, marginBottom: 10 },
  metricFieldRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 },
  metricFieldInput: { flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 10px", color: C.text, fontSize: 13, fontFamily: F.mono },
  unknownChip: { fontSize: 9.5, fontFamily: F.mono, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 20, padding: "3px 8px", whiteSpace: "nowrap" },

  // ---- Home command center ----
  cmdBigCta: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, background: C.accent, color: "#1A1400", border: "none", borderRadius: 16, padding: "22px 16px", width: "100%", cursor: "pointer", marginBottom: 20 },
  cmdBigCtaLabel: { fontFamily: F.display, fontSize: 17, fontWeight: 600 },
  cmdBigCtaSub: { fontSize: 11.5, opacity: 0.75 },
  healthScoreBig: { textAlign: "center", marginBottom: 6 },
  healthScoreNum: { fontFamily: F.mono, fontSize: 44 },
  lastDecisionCard: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 10, cursor: "pointer" },
  metricSummaryGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 },
  metricSummaryCard: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 8px" },
  metricSummaryLabel: { fontSize: 9.5, color: C.muted, fontFamily: F.mono },
  metricSummaryValue: { fontFamily: F.mono, fontSize: 14, marginTop: 4 },

  // ---- Decision Simulator ----
  categoryChip: { fontSize: 12, padding: "8px 12px", borderRadius: 20, border: `1px solid ${C.border}`, background: C.surface, color: C.muted, cursor: "pointer" },
  categoryChipActive: { borderColor: C.accent, color: C.accent, background: "rgba(227,165,72,0.1)" },
  templateChip: { fontSize: 12.5, padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.text, cursor: "pointer", textAlign: "left" },
  predictionCard: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 10 },
  predictionHeaderRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  predictionMetricName: { fontSize: 13.5, fontWeight: 600 },
  predictionCompareRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 },
  predictionCurrentBlock: { flex: 1 },
  predictionArrow: { color: C.muted },
  predictionRangeBlock: { flex: 1 },
  predictionMiniLabel: { fontSize: 9.5, color: C.muted, fontFamily: F.mono, letterSpacing: 0.3 },
  predictionValue: { fontFamily: F.mono, fontSize: 15, marginTop: 2 },
  scenarioBlock: { marginBottom: 10 },
  scenarioLabel: { fontFamily: F.mono, fontSize: 10, letterSpacing: 0.5, marginBottom: 3 },

  // ---- Decision History ----
  statusChip: { fontSize: 9.5, fontFamily: F.mono, padding: "3px 8px", borderRadius: 20, border: "1px solid", letterSpacing: 0.4, textTransform: "uppercase" },
  decisionCard: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 10 },
  starRow: { display: "flex", gap: 4, marginTop: 4 },
  accuracyRow: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12.5 },

  // ---- More tab (rebuilt content) ----
  moreGrid: { display: "flex", flexDirection: "column", gap: 8 },
};
