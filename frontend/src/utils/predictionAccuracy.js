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
