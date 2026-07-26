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

// ---- Startup metrics (Metrics tab — FounderOS V2) ----
// Every field defaults to 0 and is directly editable. Each field carries an
// `info` block (definition / why it matters / healthy range / how to
// improve / related metrics) that powers the info-icon modal on MetricCard.
export const METRIC_GROUPS = [
  {
    key: "financial",
    label: "Financial",
    fields: [
      { key: "revenue", label: "Revenue", unit: "currency", info: {
        definition: "Total money earned from customers in the current month.",
        why: "The clearest signal of whether people will actually pay for what you're building.",
        healthyRange: "Any consistent upward trend month over month is healthy at any stage.",
        improve: "Talk to more prospects, tighten your pitch, or raise prices if churn stays low.",
        influencedBy: ["Conversion Rate", "Total Customers", "CAC"], influences: ["Runway", "Profit"],
      } },
      { key: "mrr", label: "Monthly Recurring Revenue", unit: "currency", info: {
        definition: "The predictable, recurring portion of revenue you can count on next month.",
        why: "Investors and you both care about MRR more than one-off revenue — it's what compounds.",
        healthyRange: "15-20%+ month-over-month growth is considered strong pre-Series A.",
        improve: "Move one-time customers to subscriptions; reduce churn before chasing new signups.",
        influencedBy: ["Retention", "Churn"], influences: ["Runway", "Valuation"],
      } },
      { key: "expenses", label: "Expenses", unit: "currency", info: {
        definition: "Everything you spend in a month: salaries, tools, hosting, marketing, rent.",
        why: "Expenses minus revenue is your burn — the single number that decides your timeline.",
        healthyRange: "Should scale slower than revenue growth, not faster.",
        improve: "Audit subscriptions quarterly; delay hires until the workload truly demands them.",
        influencedBy: ["Team Size", "Marketing Spend", "Infrastructure Cost"], influences: ["Burn Rate", "Runway"],
      } },
      { key: "burnRate", label: "Burn Rate", unit: "currency", info: {
        definition: "Net cash you lose per month (expenses minus revenue).",
        why: "Directly determines how many months of life your startup has left.",
        healthyRange: "Lower is always safer; what matters most is it's falling as % of revenue over time.",
        improve: "Cut non-essential spend first; raise prices before cutting headcount.",
        influencedBy: ["Revenue", "Expenses"], influences: ["Runway"],
      } },
      { key: "profit", label: "Profit", unit: "currency", info: {
        definition: "Revenue minus expenses. Negative profit means you're burning cash.",
        why: "The bottom-line test of whether the business works economically.",
        healthyRange: "Early-stage startups often run negative on purpose — the question is whether the path to positive is credible.",
        improve: "Grow revenue faster than expenses, not just cut costs.",
        influencedBy: ["Revenue", "Expenses"], influences: ["Valuation", "Founder Satisfaction"],
      } },
      { key: "cashBalance", label: "Cash Balance", unit: "currency", info: {
        definition: "Total cash currently in the bank.",
        why: "Combined with burn rate, this is what tells you how much time you have left.",
        healthyRange: "Enough to cover 12-18 months of burn is a common comfort zone.",
        improve: "Raise before you need to, not when you're desperate; trim burn proactively.",
        influencedBy: ["Equity Raised", "Profit"], influences: ["Runway"],
      } },
      { key: "runway", label: "Runway", unit: "months", info: {
        definition: "How many months you can operate at current burn before running out of cash.",
        why: "The clock every other decision (hiring, spend, fundraising timing) gets set against.",
        healthyRange: "Under 6 months is a red flag; 12-18+ months gives real room to maneuver.",
        improve: "Reduce burn, grow revenue, or raise capital — usually some mix of all three.",
        influencedBy: ["Cash Balance", "Burn Rate"], influences: ["Fundraising timing", "Hiring decisions"],
      } },
    ],
  },
  {
    key: "customers",
    label: "Customers",
    fields: [
      { key: "totalCustomers", label: "Total Customers", unit: "count", info: {
        definition: "Everyone who has ever paid or signed up, depending on your model.",
        why: "The base your revenue and retention numbers are calculated from.",
        healthyRange: "Consistent net growth month over month, even if small.",
        improve: "Fix your highest-drop-off funnel step before adding more top-of-funnel spend.",
        influencedBy: ["Leads", "Conversion Rate"], influences: ["Revenue", "MRR"],
      } },
      { key: "activeCustomers", label: "Active Customers", unit: "count", info: {
        definition: "Customers who are currently using the product, not just ones who once signed up.",
        why: "A large 'total customers' number is meaningless if most have gone quiet.",
        healthyRange: "Should track close to total customers minus expected churn.",
        improve: "Look at why inactive customers stopped engaging — usually onboarding or value gaps.",
        influencedBy: ["Retention", "NPS"], influences: ["Churn", "MRR"],
      } },
      { key: "monthlyNewCustomers", label: "Monthly New Customers", unit: "count", info: {
        definition: "New customers acquired this month.",
        why: "Your growth engine's raw output — the thing everything else compounds on.",
        healthyRange: "Should outpace monthly churned customers for net growth.",
        improve: "Double down on whichever channel currently converts best before testing new ones.",
        influencedBy: ["Leads", "Conversion Rate"], influences: ["Total Customers", "Growth Rate"],
      } },
      { key: "churn", label: "Churn", unit: "percent", info: {
        definition: "The percentage of customers who leave in a given month.",
        why: "High churn quietly erases growth — you can be adding customers and still shrinking.",
        healthyRange: "Under 5% monthly is generally healthy for SaaS; consumer products tolerate more.",
        improve: "Interview churned customers directly; fix the top one or two recurring complaints first.",
        influencedBy: ["NPS", "Active Customers"], influences: ["Retention", "LTV"],
      } },
      { key: "retention", label: "Retention", unit: "percent", info: {
        definition: "The inverse of churn — the percentage of customers who stick around.",
        why: "Retention compounds; a small improvement here often beats an equivalent boost in new signups.",
        healthyRange: "95%+ monthly retention (under 5% churn) is a common healthy benchmark.",
        improve: "Improve onboarding so customers reach their first 'aha' moment faster.",
        influencedBy: ["Churn"], influences: ["LTV", "MRR"],
      } },
      { key: "nps", label: "NPS", unit: "score", info: {
        definition: "Net Promoter Score — how likely customers are to recommend you, from -100 to 100.",
        why: "A leading indicator of both retention and organic word-of-mouth growth.",
        healthyRange: "Above 30 is good, above 50 is excellent for most startup categories.",
        improve: "Ask detractors directly what's missing, then close the single biggest gap.",
        influencedBy: ["Product quality", "Support responsiveness"], influences: ["Retention", "Leads"],
      } },
    ],
  },
  {
    key: "growth",
    label: "Growth",
    fields: [
      { key: "websiteTraffic", label: "Website Traffic (monthly)", unit: "count", info: {
        definition: "Total visitors to your site or landing page per month.",
        why: "The top of your funnel — everything downstream (leads, customers) starts here.",
        healthyRange: "Depends heavily on channel; what matters most is the trend, not the absolute number.",
        improve: "Double down on the one channel already sending qualified traffic before adding more.",
        influencedBy: ["Marketing Spend"], influences: ["Leads"],
      } },
      { key: "conversionRate", label: "Conversion Rate", unit: "percent", info: {
        definition: "The percentage of visitors or leads who become paying customers.",
        why: "A cheap way to grow revenue without spending more on acquisition.",
        healthyRange: "Varies widely by category — 1-5% for cold traffic is common; much higher for warm leads.",
        improve: "Simplify the signup/checkout flow and clarify the value proposition above the fold.",
        influencedBy: ["Website Traffic", "Leads"], influences: ["Monthly New Customers", "CAC"],
      } },
      { key: "leads", label: "Leads (monthly)", unit: "count", info: {
        definition: "Prospects who've shown real interest — signed up, booked a call, requested a demo.",
        why: "The pipeline that determines next month's new customers.",
        healthyRange: "Should be growing at least as fast as your customer acquisition targets require.",
        improve: "Qualify leads earlier so sales time goes to the ones most likely to convert.",
        influencedBy: ["Website Traffic"], influences: ["Monthly New Customers"],
      } },
      { key: "cac", label: "CAC", unit: "currency", info: {
        definition: "Customer Acquisition Cost — total sales & marketing spend divided by new customers.",
        why: "If CAC exceeds what a customer is worth (LTV), growth is actively losing money.",
        healthyRange: "A common target is LTV at least 3x CAC.",
        improve: "Cut underperforming channels; lean into referrals and organic, which are usually cheapest.",
        influencedBy: ["Marketing Spend", "Monthly New Customers"], influences: ["LTV ratio", "Profit"],
      } },
      { key: "ltv", label: "LTV", unit: "currency", info: {
        definition: "Lifetime Value — the total revenue you expect from a customer before they churn.",
        why: "Sets the ceiling on how much you can profitably spend to acquire a customer.",
        healthyRange: "Ideally 3x or more of CAC.",
        improve: "Improve retention and pricing before trying to inflate LTV through upsells alone.",
        influencedBy: ["Retention", "Average Deal Size"], influences: ["CAC ratio", "Valuation"],
      } },
    ],
  },
  {
    key: "product",
    label: "Product",
    fields: [
      { key: "activeFeatures", label: "Active Features", unit: "count", info: {
        definition: "Number of distinct features currently live for users.",
        why: "Useful as a rough gauge of product surface area and scope creep.",
        healthyRange: "Fewer, well-used features usually beat many half-used ones early on.",
        improve: "Cut or hide features with low usage instead of only adding new ones.",
        influencedBy: ["Product Releases"], influences: ["Support Tickets", "NPS"],
      } },
      { key: "releaseFrequency", label: "Release Frequency (per month)", unit: "count", info: {
        definition: "How often you ship updates or new features per month.",
        why: "A proxy for execution speed and how quickly you can respond to feedback.",
        healthyRange: "Weekly-ish releases are common for early-stage software teams.",
        improve: "Ship smaller changes more often rather than large infrequent releases.",
        influencedBy: ["Team Size", "Engineers"], influences: ["Active Features", "NPS"],
      } },
      { key: "bugs", label: "Open Bugs", unit: "count", info: {
        definition: "Known issues currently unresolved.",
        why: "A rising bug count quietly erodes trust and retention if left unaddressed.",
        healthyRange: "Trending flat or down relative to your user base size.",
        improve: "Reserve a fixed % of each sprint for bug fixes instead of only new features.",
        influencedBy: ["Release Frequency"], influences: ["NPS", "Churn"],
      } },
    ],
  },
  {
    key: "team",
    label: "Team",
    fields: [
      { key: "engineers", label: "Engineers", unit: "count", info: {
        definition: "Number of engineers on the team.",
        why: "Directly caps how fast you can ship product.",
        healthyRange: "Right-sized to your actual roadmap, not your ambitions.",
        improve: "Hire only when a specific backlog item is consistently blocked on capacity.",
        influencedBy: ["Cash Balance", "Equity Raised"], influences: ["Release Frequency", "Burn Rate"],
      } },
      { key: "sales", label: "Sales", unit: "count", info: {
        definition: "Number of people focused on sales.",
        why: "Determines how much pipeline you can actually work.",
        healthyRange: "Founder-led sales is normal and often better pre-PMF.",
        improve: "Add a first sales hire only once the founder has a repeatable pitch to hand off.",
        influencedBy: ["Cash Balance"], influences: ["Deals Closed", "Burn Rate"],
      } },
      { key: "marketing", label: "Marketing", unit: "count", info: {
        definition: "Number of people focused on marketing.",
        why: "Affects how much top-of-funnel activity you can sustain.",
        healthyRange: "Often one generalist is enough pre-Series A.",
        improve: "Hire a specialist only once you know which channel is actually working.",
        influencedBy: ["Cash Balance"], influences: ["Website Traffic", "Burn Rate"],
      } },
      { key: "customerSupport", label: "Customer Support", unit: "count", info: {
        definition: "Number of people handling customer support.",
        why: "Response time directly affects retention and NPS.",
        healthyRange: "Scales with active customers and support ticket volume, not headcount ambition.",
        improve: "Invest in self-serve docs/FAQ before adding headcount.",
        influencedBy: ["Support Tickets", "Active Customers"], influences: ["NPS", "Churn"],
      } },
    ],
  },
  {
    key: "fundraising",
    label: "Fundraising & Ops",
    fields: [
      { key: "equityRaised", label: "Equity Raised", unit: "currency", info: {
        definition: "Total outside capital raised to date.",
        why: "Shapes your runway, your cap table, and expectations from investors.",
        healthyRange: "No universal healthy number — what matters is raising enough for the next credible milestone, not more.",
        improve: "Raise for 18-24 months of runway toward a specific, provable milestone.",
        influencedBy: [], influences: ["Cash Balance", "Valuation"],
      } },
      { key: "valuation", label: "Valuation", unit: "currency", info: {
        definition: "The startup's current estimated worth, typically set at your last raise.",
        why: "Determines dilution on future raises and is often (over-)indexed on by founders.",
        healthyRange: "Should be grounded in traction, not narrative alone.",
        improve: "Focus on revenue and retention — valuation follows fundamentals, not the reverse.",
        influencedBy: ["Revenue", "Growth Rate", "MRR"], influences: ["Future dilution"],
      } },
      { key: "growthRate", label: "Growth Rate", unit: "percent", info: {
        definition: "Month-over-month percentage growth, typically measured on revenue or customers.",
        why: "The single number investors scan for first.",
        healthyRange: "10-20% MoM is considered strong for an early-stage startup.",
        improve: "Fix retention before spending more on acquisition — leaky-bucket growth doesn't compound.",
        influencedBy: ["Monthly New Customers", "Retention"], influences: ["Valuation"],
      } },
      { key: "infrastructureCost", label: "Infrastructure Cost", unit: "currency", info: {
        definition: "Monthly hosting, cloud, and AI/API costs to run the product.",
        why: "A silent line item that can quietly become a large share of burn as usage scales.",
        healthyRange: "Should shrink as a % of revenue as you scale, not grow.",
        improve: "Review usage-based line items monthly; cache or downgrade over-provisioned services.",
        influencedBy: ["Active Customers", "Usage volume"], influences: ["Burn Rate", "Gross Margin"],
      } },
      { key: "supportTickets", label: "Support Tickets", unit: "count", info: {
        definition: "Number of support requests opened in a month.",
        why: "A rising trend often signals a product or onboarding gap before churn shows it.",
        healthyRange: "Should grow slower than your active customer count.",
        improve: "Turn the top 3 recurring tickets into product fixes or self-serve docs.",
        influencedBy: ["Bugs", "Active Customers"], influences: ["Customer Support headcount", "NPS"],
      } },
      { key: "dealsClosed", label: "Deals Closed", unit: "count", info: {
        definition: "Number of sales deals closed in a month.",
        why: "The direct output of your sales process.",
        healthyRange: "Trending up alongside sales calls and pipeline size.",
        improve: "Track win rate by stage to find where deals actually stall.",
        influencedBy: ["Sales Calls", "Leads"], influences: ["Revenue"],
      } },
      { key: "founderSatisfaction", label: "Founder Satisfaction", unit: "score", info: {
        definition: "A self-rated 1-10 sense of how sustainable this pace feels right now.",
        why: "Founder burnout is one of the most common, least-tracked startup killers.",
        healthyRange: "Trending flat or up matters more than the absolute number.",
        improve: "Protect one non-negotiable recovery habit, even during intense weeks.",
        influencedBy: ["Runway", "Team Size"], influences: ["Decision quality", "Execution Speed"],
      } },
      { key: "pmfScore", label: "Product Market Fit Score", unit: "score", info: {
        definition: "A self-rated 1-10 sense of how strongly the market is pulling the product forward.",
        why: "Most other metrics improve dramatically once real PMF is reached — it's worth naming honestly.",
        healthyRange: "There's no shortcut here; look for organic pull (referrals, inbound) as the real signal.",
        improve: "Talk to churned and highly-engaged customers separately — the gap between them is usually the answer.",
        influencedBy: ["NPS", "Retention", "Organic growth"], influences: ["Everything downstream"],
      } },
    ],
  },
];

export const ALL_METRIC_FIELDS = METRIC_GROUPS.flatMap((g) => g.fields);
export const METRIC_INFO_BY_KEY = Object.fromEntries(ALL_METRIC_FIELDS.map((f) => [f.key, f.info]));

// Every metric starts at 0 and is directly editable — see FounderOS V2 spec.
export function emptyMetrics() {
  const m = {};
  ALL_METRIC_FIELDS.forEach((f) => (m[f.key] = 0));
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
