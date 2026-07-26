// A tiny, dependency-free admin page for reading feedback — server-rendered
// HTML with vanilla JS, not part of the React app. Kept out of the public
// frontend bundle on purpose: the page shell is public, but it can't show
// any data without the ADMIN_TOKEN, which is entered client-side and never
// baked into this HTML.

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Feedback — Founder Companion</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; padding: 24px 16px 60px;
    background: #0E1116; color: #EDEAE3;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif;
  }
  h1 { font-size: 20px; font-weight: 600; margin: 0 0 4px; }
  .sub { color: #8B93A1; font-size: 13px; margin-bottom: 20px; }
  .tokenRow { display: flex; gap: 8px; margin-bottom: 20px; max-width: 480px; }
  input[type=password], input[type=text] {
    flex: 1; background: #161B22; border: 1px solid #2A3140; border-radius: 8px;
    padding: 10px 12px; color: #EDEAE3; font-size: 14px;
  }
  button {
    background: #E3A548; color: #1A1400; border: none; border-radius: 8px;
    padding: 10px 16px; font-size: 14px; font-weight: 600; cursor: pointer;
  }
  button:disabled { opacity: 0.5; cursor: default; }
  .stat { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: #8B93A1; margin-bottom: 16px; }
  .card {
    background: #161B22; border: 1px solid #2A3140; border-radius: 10px;
    padding: 14px 16px; margin-bottom: 10px;
  }
  .cardTop { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
  .tag {
    font-size: 10.5px; font-family: 'IBM Plex Mono', monospace; letter-spacing: 0.4px;
    text-transform: uppercase; padding: 3px 8px; border-radius: 20px; border: 1px solid #2A3140; color: #8B93A1;
  }
  .rating-up { color: #4FB0A5; border-color: #4FB0A5; }
  .rating-down { color: #E3A548; border-color: #E3A548; }
  .date { font-size: 11px; color: #8B93A1; margin-left: auto; font-family: 'IBM Plex Mono', monospace; }
  .content { font-size: 14px; line-height: 1.5; margin: 0 0 6px; white-space: pre-wrap; word-break: break-word; }
  .comment { font-size: 13px; color: #8B93A1; margin: 0; white-space: pre-wrap; word-break: break-word; }
  .empty, .error { color: #8B93A1; font-size: 13px; padding: 30px 0; text-align: center; }
  .error { color: #E3A548; }
  .userId { font-size: 10px; color: #5A6272; font-family: 'IBM Plex Mono', monospace; }
</style>
</head>
<body>
  <h1>Feedback</h1>
  <div class="sub">Founder Companion — all submitted feedback, newest first</div>

  <div class="tokenRow">
    <input type="password" id="token" placeholder="Admin token" />
    <button id="loadBtn">Load</button>
  </div>

  <div id="stat" class="stat"></div>
  <div id="list"></div>

<script>
  const tokenInput = document.getElementById('token');
  const listEl = document.getElementById('list');
  const statEl = document.getElementById('stat');
  const loadBtn = document.getElementById('loadBtn');

  const saved = sessionStorage.getItem('fc_admin_token');
  const urlToken = new URLSearchParams(location.search).get('token');
  if (urlToken) tokenInput.value = urlToken;
  else if (saved) tokenInput.value = saved;

  async function load() {
    const token = tokenInput.value.trim();
    if (!token) return;
    sessionStorage.setItem('fc_admin_token', token);
    loadBtn.disabled = true;
    loadBtn.textContent = 'Loading…';
    listEl.innerHTML = '';
    statEl.textContent = '';
    try {
      const res = await fetch('/api/feedback?limit=500&token=' + encodeURIComponent(token));
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        listEl.innerHTML = '<div class="error">' + (body.message || ('Error ' + res.status)) + '</div>';
        return;
      }
      const data = await res.json();
      const items = data.feedback || [];
      statEl.textContent = items.length + ' entr' + (items.length === 1 ? 'y' : 'ies');
      if (items.length === 0) {
        listEl.innerHTML = '<div class="empty">No feedback yet.</div>';
        return;
      }
      listEl.innerHTML = items.map(renderCard).join('');
    } catch (e) {
      listEl.innerHTML = '<div class="error">Couldn\\'t reach the server.</div>';
    } finally {
      loadBtn.disabled = false;
      loadBtn.textContent = 'Load';
    }
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderCard(item) {
    const ratingTag = item.rating === 'up'
      ? '<span class="tag rating-up">helpful</span>'
      : item.rating === 'down'
        ? '<span class="tag rating-down">not helpful</span>'
        : '';
    const date = item.createdAt ? new Date(item.createdAt).toLocaleString() : '';
    return '<div class="card">'
      + '<div class="cardTop">'
      + '<span class="tag">' + escapeHtml(item.context) + '</span>'
      + ratingTag
      + '<span class="date">' + escapeHtml(date) + '</span>'
      + '</div>'
      + (item.prompt ? '<p class="comment">Prompt: ' + escapeHtml(item.prompt) + '</p>' : '')
      + (item.content ? '<p class="content">' + escapeHtml(item.content) + '</p>' : '')
      + (item.comment ? '<p class="comment">' + escapeHtml(item.comment) + '</p>' : '')
      + '<div class="userId">' + escapeHtml(item.userId) + '</div>'
      + '</div>';
  }

  loadBtn.addEventListener('click', load);
  tokenInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') load(); });
  if (tokenInput.value) load();
</script>
</body>
</html>`;

function adminFeedbackPage(req, res) {
  res.type("html").send(PAGE);
}

module.exports = adminFeedbackPage;
