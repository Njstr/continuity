// retry() wraps an async function with a bounded number of retries and
// exponential backoff. Only retries errors explicitly marked retryable
// (rate limits, 5xx) — never retries validation/programmer errors.

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retry(fn, { attempts = 2, baseDelayMs = 500 } = {}) {
  let lastErr;
  for (let i = 0; i <= attempts; i++) {
    try {
      return await fn(i);
    } catch (err) {
      lastErr = err;
      const isLastTry = i === attempts;
      const shouldRetry = err.retryable !== false && (err.retryable || err.code === "ETIMEDOUT" || err.name === "AbortError");
      if (isLastTry || !shouldRetry) throw err;
      const delay = baseDelayMs * Math.pow(2, i) + Math.random() * 200;
      await sleep(delay);
    }
  }
  throw lastErr;
}

// withTimeout() races a promise-returning function against an AbortController
// timeout, so a hung upstream call can never hang a request forever.
async function withTimeout(fn, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } catch (err) {
    if (err.name === "AbortError") {
      const timeoutErr = new Error(`Request timed out after ${ms}ms`);
      timeoutErr.code = "TIMEOUT";
      timeoutErr.retryable = true;
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { retry, withTimeout, sleep };
