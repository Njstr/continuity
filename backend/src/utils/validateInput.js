// Small, dependency-free validation helpers. The 1mb express.json() limit
// already blocks huge payloads outright; these add sane per-field caps so
// a single oversized field can't blow up prompt size / AI cost.

function isNonEmptyString(val, { max = 4000 } = {}) {
  return typeof val === "string" && val.trim().length > 0 && val.length <= max;
}

function isValidEmail(val) {
  return typeof val === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) && val.length <= 254;
}

function capString(val, max = 4000) {
  return typeof val === "string" ? val.slice(0, max) : val;
}

module.exports = { isNonEmptyString, isValidEmail, capString };
