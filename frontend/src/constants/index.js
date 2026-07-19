export const todayStr = () => new Date().toISOString().slice(0, 10);

// ============================================================
// FounderOS — AI Decision Intelligence Platform
// Everything below serves one loop: onboard the company's real
// numbers -> simulate a decision -> predict consequences honestly
// (ranges + reasoning, never fake precision) -> track what actually
// happened -> measure real prediction error -> repeat.
// ============================================================

// ---- Company onboarding ----
export const INDUSTRIES = [
  "SaaS / Software", "Fintech", "Healthtech", "E-commerce & Retail", "Consumer App",
  "AI / Deep Tech", "EdTech", "Marketplace", "Agency / Services", "Hardware", "Other",
];

export const BUSINESS_MODELS = ["SaaS", "Marketplace", "E-commerce", "Agency", "AI Product", "Mobile App", "Services", "Other"];

export const STARTUP_STAGES = ["Idea", "Pre-Revenue", "Revenue", "Growing", "Scaling"];

export const COUNTRIES = [
  "India", "United States", "United Kingdom", "Canada", "Germany", "Singapore",
  "Australia", "United Arab Emirates", "Other",
];

export const CURRENCIES = [
  { code: "INR", symbol: "₹" },
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
  { code: "SGD", symbol: "S$" },
  { code: "AED", symbol: "AED " },
];

// ---- Startup metrics (Part: Current Startup Metrics) ----
// Every field is nullable. null = "Unknown", explicitly — never invented.
export const METRIC_GROUPS = [
  {
    key: "financial",
    label: "Financial",
    fields: [
      { key: "revenue", label: "Revenue", unit: "currency" },
      { key: "mrr", label: "Monthly Recurring Revenue", unit: "currency" },
      { key: "expenses", label: "Expenses", unit: "currency" },
      { key: "burnRate", label: "Burn Rate", unit: "currency" },
      { key: "profit", label: "Profit", unit: "currency" },
      { key: "cashBalance", label: "Cash Balance", unit: "currency" },
      { key: "runway", label: "Runway", unit: "months" },
    ],
  },
  {
    key: "customers",
    label: "Customers",
    fields: [
      { key: "totalCustomers", label: "Total Customers", unit: "count" },
      { key: "activeCustomers", label: "Active Customers", unit: "count" },
      { key: "monthlyNewCustomers", label: "Monthly New Customers", unit: "count" },
      { key: "churn", label: "Churn", unit: "percent" },
      { key: "retention", label: "Retention", unit: "percent" },
      { key: "nps", label: "NPS", unit: "score" },
    ],
  },
  {
    key: "growth",
    label: "Growth",
    fields: [
      { key: "websiteTraffic", label: "Website Traffic (monthly)", unit: "count" },
      { key: "conversionRate", label: "Conversion Rate", unit: "percent" },
      { key: "leads", label: "Leads (monthly)", unit: "count" },
      { key: "cac", label: "CAC", unit: "currency" },
      { key: "ltv", label: "LTV", unit: "currency" },
    ],
  },
  {
    key: "product",
    label: "Product",
    fields: [
      { key: "activeFeatures", label: "Active Features", unit: "count" },
      { key: "releaseFrequency", label: "Release Frequency (per month)", unit: "count" },
      { key: "bugs", label: "Open Bugs", unit: "count" },
    ],
  },
  {
    key: "team",
    label: "Team",
    fields: [
      { key: "engineers", label: "Engineers", unit: "count" },
      { key: "sales", label: "Sales", unit: "count" },
      { key: "marketing", label: "Marketing", unit: "count" },
      { key: "customerSupport", label: "Customer Support", unit: "count" },
    ],
  },
];

export const ALL_METRIC_FIELDS = METRIC_GROUPS.flatMap((g) => g.fields);

export function emptyMetrics() {
  const m = {};
  ALL_METRIC_FIELDS.forEach((f) => (m[f.key] = null));
  return m;
}

// ---- Decision Simulator ----
export const DECISION_CATEGORIES = [
  { key: "hiring", label: "Hiring", templates: ["Hire Engineer", "Hire Salesperson", "Hire Designer"] },
  { key: "marketing", label: "Marketing", templates: ["Increase Ad Spend", "SEO Campaign", "Influencer Campaign"] },
  { key: "product", label: "Product", templates: ["Launch Feature", "Rewrite Backend", "Fix Bugs"] },
  { key: "pricing", label: "Pricing", templates: ["Increase Price", "Reduce Price", "Annual Plan"] },
  { key: "fundraising", label: "Fundraising", templates: ["Raise Capital", "Bootstrap", "Loan"] },
  { key: "growth", label: "Growth", templates: ["Referral Program", "New Market", "Partnerships"] },
];

export const DECISION_STATUSES = ["planned", "implemented", "cancelled", "completed"];

export const FOLLOWUP_OPTIONS = [
  { key: "2w", label: "In 2 weeks", days: 14 },
  { key: "1m", label: "In 1 month", days: 30 },
  { key: "custom", label: "Custom date", days: null },
];

export const FEEDBACK_DIFFERENCE_REASONS = [
  "Market conditions changed",
  "Hiring took longer",
  "Campaign performed poorly",
  "Product launch delayed",
  "Customer demand exceeded expectations",
];

export const CONFIDENCE_COLOR = { low: "#E36B48", medium: "#E3A548", high: "#4FB0A5" };

export const TERMS_INTRO = "FounderOS is an educational and decision-support tool, not a substitute for professional advice.";
export const TERMS_BODY = [
  "FounderOS predicts the plausible consequences of a business decision using an AI model reasoning over the numbers and context you provide. Every prediction is a forecast, shown as a range with stated confidence — never a guarantee, and never based on a calibrated statistical model of your specific business.",
  "Metrics you mark as Unknown are never invented or estimated on your behalf. Predictions involving an unknown baseline are explicitly marked uncertain rather than guessed.",
  "This does not constitute legal, financial, tax, accounting, investment, or other professional advice, and no advisor-client or fiduciary relationship is created by using this app. You are solely responsible for evaluating any prediction before acting on it, and for the outcomes of decisions made about your business.",
  "To the fullest extent permitted by law, the makers of this app disclaim all liability for any loss, damage, or business outcome — direct or indirect — arising from reliance on predictions, accuracy assessments, or any other content generated within the app.",
  "This is a prototype. Features, data handling, and behavior may change without notice, and no warranty of accuracy, availability, or fitness for a particular purpose is made.",
];

export const FAQS = [
  {
    q: "Are the predicted numbers guaranteed?",
    a: "No. Every prediction is a forecast built by an AI model reasoning from your numbers and the decision you described — it can be wrong, and it's shown as a range with stated confidence for exactly that reason. Use it to think through a decision, not as a promise of the outcome.",
  },
  {
    q: "Why does FounderOS show ranges instead of one exact number?",
    a: "A single precise-looking number would be pretending to a level of certainty that doesn't exist. A range plus the reasoning behind it is the honest version of the same forecast.",
  },
  {
    q: "What does 'Unknown' mean on a metric?",
    a: "It means you haven't entered that number yet. FounderOS never invents a value for you — predictions involving an Unknown baseline are marked uncertain rather than guessed.",
  },
  {
    q: "Does FounderOS get smarter over time?",
    a: "Your own decision history (what you simulated, what you implemented, what actually happened) is fed back in as context for future predictions on your account — so it does improve with your own data. It is not a statistically trained model, and we won't claim more precision than that.",
  },
  {
    q: "Where does my data go?",
    a: "Your company profile, metrics, and decision history stay on this device. AI requests go to your own backend server, which calls your chosen AI provider using a key that never touches this app's frontend code.",
  },
];
