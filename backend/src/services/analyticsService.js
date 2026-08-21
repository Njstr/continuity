const fileStore = require("../store/fileStore");
const config = require("../config");

// analyticsService — anonymous, togglable usage tracking.
//
// Disabled entirely via ANALYTICS_ENABLED=false in .env. Events are stored
// per-user (or under "anon" if no user id) as a simple append-only log.
// Swap this for a real analytics provider (PostHog, Amplitude, etc.) by
// replacing track()'s body — callers don't need to change.

const KNOWN_EVENTS = [
  "onboarding_completed", "mission_completed", "mission_skipped",
  "chat_message_sent", "decision_requested", "health_check_run",
  "weekly_review_submitted", "session_start",
];

function track(userId, eventName, props = {}) {
  if (!config.analyticsEnabled) return null;
  const event = {
    event: KNOWN_EVENTS.includes(eventName) ? eventName : "custom:" + eventName,
    props,
    date: new Date().toISOString(),
  };
  return fileStore.append(userId || "anon", "analytics", event, { max: 5000 });
}

function summary(userId) {
  const events = fileStore.get(userId || "anon", "analytics", []);
  const counts = {};
  for (const e of events) counts[e.event] = (counts[e.event] || 0) + 1;
  return { totalEvents: events.length, counts };
}

module.exports = { track, summary, KNOWN_EVENTS };
