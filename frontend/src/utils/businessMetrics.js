// businessMetrics — every number on the Metrics page is derived here from
// the startup's `businessState`, never typed in by hand. Every formula is
// intentionally simple and deterministic (not AI-guessed) so the "Why?"
// explainer can show real, verifiable math instead of a plausible-sounding
// but unverifiable narrative.
//
// When real integrations (Stripe, Analytics, etc.) exist, they'd feed
// businessState's raw fields directly — nothing here would need to change.

function n(v) {
  const num = Number(v);
  return Number.isFinite(num) ? num : 0;
}

export function computeMetrics(state, previous) {
  const s = state || {};
  const revenue = n(s.monthlyRevenue);
  const expenses = n(s.monthlyExpenses);
  const marketing = n(s.marketingSpend);
  const hosting = n(s.hostingCost);
  const aiCost = n(s.aiCost);
  const cash = n(s.cash);
  const customers = n(s.customers);
  const avgPrice = n(s.avgProductPrice);
  const isSubscription = (s.salesType || "Subscription") === "Subscription";

  const cogs = hosting + aiCost;
  const grossProfit = revenue - cogs;
  const grossMargin = revenue > 0 ? grossProfit / revenue : 0;

  const totalOutflow = expenses + marketing + hosting + aiCost;
  const netProfit = revenue - expenses - marketing - aiCost - hosting;
  const netBurn = Math.max(0, totalOutflow - revenue);
  const runwayMonths = netBurn > 0 ? cash / netBurn : null; // null = profitable / no burn

  const mrr = isSubscription ? revenue : 0;
  const arr = mrr * 12;

  const prevCustomers = previous ? n(previous.customers) : null;
  const newCustomers = prevCustomers !== null ? Math.max(0, customers - prevCustomers) : null;
  const cac = newCustomers && newCustomers > 0 ? marketing / newCustomers : marketing > 0 && customers > 0 ? marketing / customers : 0;

  const assumedLifetimeMonths = isSubscription ? 12 : 1;
  const ltv = avgPrice * assumedLifetimeMonths * grossMargin;

  let churnRate = null;
  let retentionRate = null;
  if (previous && prevCustomers) {
    const lost = Math.max(0, prevCustomers - customers + (newCustomers || 0));
    churnRate = prevCustomers > 0 ? lost / prevCustomers : null;
    retentionRate = churnRate !== null ? 1 - churnRate : null;
  }

  return {
    revenue, expenses, cash, customers,
    mrr, arr, grossProfit, grossMargin, cogs,
    netProfit, burnRate: totalOutflow, netBurn, runwayMonths,
    cac, ltv, churnRate, retentionRate,
    cashIn: revenue, cashOut: totalOutflow,
    revenueTrend: previous ? revenue - n(previous.monthlyRevenue) : null,
    customersTrend: previous ? customers - prevCustomers : null,
  };
}

export function formatCurrency(n2) {
  if (n2 === null || n2 === undefined || Number.isNaN(n2)) return "—";
  const sign = n2 < 0 ? "-" : "";
  return sign + "₹" + Math.abs(Math.round(n2)).toLocaleString("en-IN");
}

export function formatPct(n2) {
  if (n2 === null || n2 === undefined || Number.isNaN(n2)) return "—";
  return (n2 * 100).toFixed(1) + "%";
}

export function formatMonths(n2) {
  if (n2 === null || n2 === undefined) return "Profitable";
  if (!Number.isFinite(n2)) return "—";
  return n2.toFixed(1) + " mo";
}

// Deterministic, formula-based explanations — real math, not a guess.
export function explainMetric(key, m, state) {
  const s = state || {};
  switch (key) {
    case "revenue":
      return `Your current monthly revenue, as entered or updated from completed missions: ${formatCurrency(m.revenue)}.`;
    case "mrr":
      return s.salesType === "One-time"
        ? "Your sales model is one-time purchases, not subscriptions, so there's no recurring revenue to count here yet."
        : `Monthly Recurring Revenue = your monthly revenue, since your model is subscription-based: ${formatCurrency(m.mrr)}.`;
    case "arr":
      return `ARR = MRR × 12 = ${formatCurrency(m.mrr)} × 12 = ${formatCurrency(m.arr)}.`;
    case "grossProfit":
      return `Gross Profit = Revenue − Hosting − AI Costs = ${formatCurrency(m.revenue)} − ${formatCurrency(n(s.hostingCost))} − ${formatCurrency(n(s.aiCost))} = ${formatCurrency(m.grossProfit)}.`;
    case "netProfit":
      return `Net Profit = Revenue − Expenses − Marketing − AI Costs − Hosting = ${formatCurrency(m.revenue)} − ${formatCurrency(n(s.monthlyExpenses))} − ${formatCurrency(n(s.marketingSpend))} − ${formatCurrency(n(s.aiCost))} − ${formatCurrency(n(s.hostingCost))} = ${formatCurrency(m.netProfit)}.`;
    case "burnRate":
      return `Burn Rate = Expenses + Marketing + Hosting + AI Costs = ${formatCurrency(m.burnRate)} total monthly outflow.`;
    case "runway":
      return m.runwayMonths === null
        ? "Your revenue currently covers your expenses, so there's no burn eating into your cash — runway isn't a limiting factor right now."
        : `Runway = Cash ÷ Net Burn = ${formatCurrency(n(s.cash))} ÷ ${formatCurrency(m.netBurn)} = ${formatMonths(m.runwayMonths)}.`;
    case "cac":
      return `CAC = Marketing Spend ÷ Customers Acquired = ${formatCurrency(n(s.marketingSpend))} ÷ ${m.customersTrend && m.customersTrend > 0 ? m.customersTrend : m.customers} = ${formatCurrency(m.cac)}. Gets more accurate as you log more history.`;
    case "ltv":
      return `LTV ≈ Avg Price × Est. Lifetime × Gross Margin = ${formatCurrency(n(s.avgProductPrice))} × ${s.salesType === "One-time" ? 1 : 12} mo × ${formatPct(m.grossMargin)} = ${formatCurrency(m.ltv)}.`;
    case "churn":
      return m.churnRate === null
        ? "Not enough history yet — churn compares your customer count against a previous snapshot. Check back after your business state updates again."
        : `Churn = Customers Lost ÷ Previous Total = ${formatPct(m.churnRate)} this period.`;
    case "retention":
      return m.retentionRate === null
        ? "Not enough history yet — retention needs at least two snapshots of your customer count to compare."
        : `Retention = 1 − Churn = ${formatPct(m.retentionRate)} this period.`;
    case "cashflow":
      return `Money in (revenue) vs money out (total expenses): ${formatCurrency(m.cashIn)} in, ${formatCurrency(m.cashOut)} out — net ${formatCurrency(m.cashIn - m.cashOut)}/mo.`;
    default:
      return "";
  }
}
