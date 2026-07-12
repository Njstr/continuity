// Local-first storage. All founder data (profile, missions, decisions,
// metrics, chat log, etc.) lives here — only AI *generation* calls go to
// the backend. This is what keeps the app usable offline for everything
// except asking the AI for something new.

export async function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem("fc:" + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export async function saveJSON(key, value) {
  try {
    localStorage.setItem("fc:" + key, JSON.stringify(value));
  } catch (e) {
    console.error("storage error", e);
  }
}
