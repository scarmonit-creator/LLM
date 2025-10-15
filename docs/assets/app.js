const state = {
  projects: [],
  filtered: [],
  deploying: new Set(),
};

const els = {
  search: document.getElementById('search'),
  list: document.getElementById('list'),
  count: document.getElementById('count'),
  refresh: document.getElementById('refresh'),
};

async function loadProjects() {
  // Projects.json is copied into docs/ by the GitHub Action
  const res = await fetch('./Projects.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load Projects.json: ${res.status}`);
  const data = await res.json();
  // Normalize list: accept array or {projects:[...]}
  state.projects = Array.isArray(data) ? data : (Array.isArray(data.projects) ? data.projects : []);
  state.filtered = state.projects;
  render();
}

function render() {
  els.count.textContent = state.filtered.length;
  els.list.innerHTML = '';
  for (const p of state.filtered) {
    const card = document.createElement('div');
    card.className = 'card';

    const title = p.name || p.title || p.repo || 'Untitled';
    const desc = p.description || '';
    const repo = p.url || p.repo || p.github || '';
    const tags = Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || '');

    card.innerHTML = `
      <h3>${escapeHtml(title)}</h3>
      <div class="meta">
        ${repo ? `<a href="${repo}" target="_blank" rel="noopener">Repository</a>` : ''}
        ${tags ? `<span>Tags: ${escapeHtml(tags)}</span>` : ''}
      </div>
      ${desc ? `<div class="desc">${escapeHtml(desc)}</div>` : ''}
      <div class="actions">
        <button data-action="deploy" ${!repo ? 'disabled' : ''}>Deploy</button>
        <button class="secondary" data-action="details">Details</button>
      </div>
      <div class="status" data-status></div>
    `;

    const statusEl = card.querySelector('[data-status]');
    card.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => handleAction(btn.dataset.action, { project: p, statusEl }));
    });

    els.list.appendChild(card);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

els.search.addEventListener('input', () => {
  const q = els.search.value.toLowerCase().trim();
  if (!q) {
    state.filtered = state.projects;
  } else {
    state.filtered = state.projects.filter(p => {
      const hay = [
        p.name, p.title, p.description, p.repo, p.url, p.github,
        Array.isArray(p.tags) ? p.tags.join(' ') : p.tags
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }
  render();
});

els.refresh.addEventListener('click', async () => {
  try {
    els.refresh.disabled = true;
    await loadProjects();
  } finally {
    els.refresh.disabled = false;
  }
});

async function handleAction(action, { project, statusEl }) {
  if (action === 'details') {
    alert(JSON.stringify(project, null, 2));
    return;
  }
  if (action === 'deploy') {
    const repoUrl = project.url || project.repo || project.github;
    if (!repoUrl) return;
    statusEl.textContent = 'Starting deployment...';

    try {
      // POST to your backend API. This path should be served by your server-dashboard integration.
      // If the API lives elsewhere, set up a reverse proxy or CORS to expose it here.
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl, project }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Deploy failed: ${res.status} ${text}`);
      }
      const out = await res.json().catch(() => ({}));
      statusEl.textContent = out.message || 'Deployment started. Check logs.';
    } catch (e) {
      statusEl.textContent = e.message;
    }
  }
}

loadProjects().catch(err => {
  els.list.innerHTML = `<div class="card"><div class="desc">Error: ${err.message}</div></div>`;
});