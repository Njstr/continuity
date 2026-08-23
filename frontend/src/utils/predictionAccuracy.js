// predictionAccuracy — when a founder reports what actually happened after
// implementing a decision, THIS is what computes how accurate the AI's
// prediction was. Deliberately plain arithmetic, not another AI call —
// the whole point of measuring accuracy is that the measurement itself
// has to be trustworthy, not another guess.

export function computeAccuracy(predictions, actualMetrics) {
  return (predictions || [])
    .filter((p) => p.metricKey && actualMetrics && actualMetrics[p.metricKey] !== null && actualMetrics[p.metricKey] !== undefined && actualMetrics[p.metricKey] !== "")
    .map((p) => {
      const actual = Number(actualMetrics[p.metricKey]);
      const low = p.predictedLow === null || p.predictedLow === undefined ? null : Number(p.predictedLow);
      const high = p.predictedHigh === null || p.predictedHigh === undefined ? null : Number(p.predictedHigh);
      const mid = low !== null && high !== null ? (low + high) / 2 : low ?? high;

      let errorPct = null;
      let withinRange = null;
      if (mid !== null && !Number.isNaN(mid)) {
        const base = Math.abs(actual) > 0 ? Math.abs(actual) : Math.abs(mid) > 0 ? Math.abs(mid) : 1;
        errorPct = (Math.abs(actual - mid) / base) * 100;
      }
      if (low !== null && high !== null) {
        withinRange = actual >= Math.min(low, high) && actual <= Math.max(low, high);
      }

      return { metric: p.metric, metricKey: p.metricKey, predictedLow: low, predictedHigh: high, predictedMid: mid, actual, errorPct, withinRange };
    });
}

export function averageError(accuracyResults) {
  const valid = (accuracyResults || []).filter((a) => a.errorPct !== null && Number.isFinite(a.errorPct));
  if (!valid.length) return null;
  return valid.reduce((sum, a) => sum + a.errorPct, 0) / valid.length;
}

export function formatErrorPct(e) {
  if (e === null || e === undefined || !Number.isFinite(e)) return "—";
  return e.toFixed(1) + "%";
}

// ============================================================
// Simulation Accuracy — the user-facing framing.
// Accuracy (%) = 100 - Error (%), floored at 0 so a wildly-off prediction
// never displays as a negative percentage.
// ============================================================

export const ACCURACY_EXPLANATION =
  "Simulation Accuracy measures how closely the predicted outcome matched the actual result. Higher accuracy indicates the AI model produced more reliable forecasts for this simulation.";

export function toAccuracy(errorPct) {
  if (errorPct === null || errorPct === undefined || !Number.isFinite(errorPct)) return null;
  return Math.max(0, 100 - errorPct);
}

export function formatAccuracyPct(errorPct) {
  const acc = toAccuracy(errorPct);
  if (acc === null) return "—";
  return acc.toFixed(1) + "%";
}

export function averageAccuracy(accuracyResults) {
  return toAccuracy(averageError(accuracyResults));
}

// 🟢 95–100 Excellent · 🔵 90–94 Very Good · 🟡 80–89 Good · 🟠 70–79 Fair · 🔴 <70 Poor
export function accuracyLabel(errorPct) {
  const acc = toAccuracy(errorPct);
  if (acc === null) return { accuracy: null, label: "Unknown", emoji: "⚪", color: "#8B93A1" };
  if (acc >= 95) return { accuracy: acc, label: "Excellent", emoji: "🟢", color: "#4FB0A5" };
  if (acc >= 90) return { accuracy: acc, label: "Very Good", emoji: "🔵", color: "#4A90D9" };
  if (acc >= 80) return { accuracy: acc, label: "Good", emoji: "🟡", color: "#E3C548" };
  if (acc >= 70) return { accuracy: acc, label: "Fair", emoji: "🟠", color: "#E3A548" };
  return { accuracy: acc, label: "Poor", emoji: "🔴", color: "#E36B48" };
}

// Compares recent accuracy readings against earlier ones to say whether
// this founder's simulations are trending Improving / Stable / Declining.
// Input: array of errorPct values in chronological order (oldest first).
export function computeAccuracyTrend(chronologicalErrorList) {
  const accuracies = (chronologicalErrorList || [])
    .filter((e) => e !== null && e !== undefined && Number.isFinite(e))
    .map((e) => toAccuracy(e));

  if (accuracies.length < 2) {
    return { trend: "Not enough data", emoji: "➖", color: "#8B93A1" };
  }

  const recentCount = Math.max(1, Math.min(3, Math.floor(accuracies.length / 2)));
  const recent = accuracies.slice(-recentCount);
  const prior = accuracies.slice(0, accuracies.length - recentCount);
  if (prior.length === 0) {
    return { trend: "Not enough data", emoji: "➖", color: "#8B93A1" };
  }

  const avg = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const diff = avg(recent) - avg(prior);

  if (diff > 2) return { trend: "Improving", emoji: "📈", color: "#4FB0A5" };
  if (diff < -2) return { trend: "Declining", emoji: "📉", color: "#E36B48" };
  return { trend: "Stable", emoji: "➖", color: "#E3A548" };
}