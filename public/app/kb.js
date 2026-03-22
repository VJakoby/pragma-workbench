// ═══════════════════════════════════════════════
// SIDEBAR CATEGORIES
// ═══════════════════════════════════════════════
let kbCreateView = 'services';

function getKbCollection(view) {
  return view === 'services' ? SERVICES : TACTICS;
}

function getKbBackendView(view) {
  return view === 'services' ? 'services' : 'tactics';
}

function getKbFetchConfig(view) {
  return view === 'services'
    ? { listUrl: '/api/services', detailUrl: id => `/api/service/${encodeURIComponent(id)}`, listKey: 'services' }
    : { listUrl: '/api/tactics', detailUrl: id => `/api/tactic/${encodeURIComponent(id)}`, listKey: 'tactics' };
}

async function refreshKbView(view) {
  const cfg = getKbFetchConfig(view);
  const r = await fetch(cfg.listUrl);
  const d = await r.json();
  const items = d[cfg.listKey] || [];

  if (view === 'services') {
    SERVICES = items;
    const countEl = document.getElementById('svc-count');
    if (countEl) countEl.textContent = SERVICES.length;
  } else {
    TACTICS = items;
    const countEl = document.getElementById('tactics-count');
    if (countEl) countEl.textContent = TACTICS.length;
  }

  renderCards(view);
  if (activeView === view) {
    buildSidebar(view);
    const input = document.getElementById(view === 'services' ? 'svcSearch' : 'methSearch');
    if (input) filterCards(view, input.value || '');
  }
}

function openKbCreateModal(view) {
  kbCreateView = view === 'services' ? 'services' : 'tactics';
  const isServices = kbCreateView === 'services';
  const title = isServices ? 'Create Service' : 'Create Tactic';
  const categoryLabel = activeCat && activeCat !== 'all' ? ` in ${activeCat}` : '';

  document.getElementById('kbCreateTitle').textContent = title;
  document.getElementById('kbCreateDesc').textContent = `Create a new ${isServices ? 'service' : 'tactic'} file${categoryLabel}.`;
  document.getElementById('kbCreateIcon').textContent = '+';

  const input = document.getElementById('kbCreateFilename');
  const err = document.getElementById('kbCreateError');
  const btn = document.getElementById('kbCreateSubmit');

  if (err) {
    err.textContent = '';
    err.classList.remove('visible');
  }
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Create';
  }
  if (input) {
    input.value = '';
    input.placeholder = isServices ? 'e.g. smb-enum' : 'e.g. kerberos-notes';
  }

  document.getElementById('kbCreateOverlay').classList.add('open');
  setTimeout(() => input?.focus(), 40);
}

function closeKbCreateModal() {
  document.getElementById('kbCreateOverlay').classList.remove('open');
}

function handleKbCreateKey(event) {
  if (event.key === 'Escape') {
    closeKbCreateModal();
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    submitKbCreate();
  }
}

async function submitKbCreate() {
  const input = document.getElementById('kbCreateFilename');
  const err = document.getElementById('kbCreateError');
  const btn = document.getElementById('kbCreateSubmit');
  const filename = input?.value.trim() || '';

  if (!filename) {
    err.textContent = 'Filename is required.';
    err.classList.add('visible');
    input?.focus();
    return;
  }

  const clientView = kbCreateView === 'services' ? 'services' : 'tactics';
  const backendView = getKbBackendView(clientView);
  const category = activeView === clientView && activeCat !== 'all' ? activeCat : '';

  try {
    if (err) {
      err.textContent = '';
      err.classList.remove('visible');
    }
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Creating…';
    }

    const r = await fetch('/api/kb/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: backendView, filename, category }),
    });
    const d = await r.json();
    if (!r.ok || d.error) throw new Error(d.error || 'Could not create file');

    closeKbCreateModal();
    await refreshKbView(clientView);
    if (activeView !== clientView) {
      switchView(clientView, document.getElementById(`nav-${clientView}`));
    }
    if (d.id) openItem(clientView, d.id);
    showToast('Created');
  } catch (e) {
    err.textContent = e.message;
    err.classList.add('visible');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Create';
    }
  }
}

function buildSidebar(view) {
  const items = getKbCollection(view);
  const cats  = ['all', ...new Set(items.map(i => i.category))].filter(Boolean);
  const list  = document.getElementById('catList');
  document.getElementById('cat-hdr').textContent = 'Categories';
  activeCat = 'all';

  list.innerHTML = cats.map(cat => `
    <div class="nav-item${cat==='all'?' active':''}" data-cat="${esc(cat)}"
         onclick="setCat('${esc(cat)}', this, '${view}')">
      <span class="nav-item-icon">${cat==='all'?'◈':'·'}</span>
      <span class="nav-item-label">${cat==='all'?'All':esc(cat)}</span>
      ${cat!=='all'?`<span class="nav-item-count">${items.filter(i=>i.category===cat).length}</span>`:''}
    </div>`).join('');
}

function setCat(cat, el, view) {
  activeCat = cat;
  document.querySelectorAll('#catList .nav-item').forEach(n => n.classList.remove('active'));
  el.classList.add('active');
  filterCards(view, document.getElementById(view==='services'?'svcSearch':'methSearch').value);
}

// ═══════════════════════════════════════════════
// CARDS RENDERING
// ═══════════════════════════════════════════════
function renderCards(view) {
  const items  = getKbCollection(view);
  const gridId = view === 'services' ? 'svcGrid' : 'methGrid';
  const grid   = document.getElementById(gridId);
  grid.innerHTML = '';

  if (items.length === 0) {
    grid.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></div>
      <div class="empty-state-title">No ${view} found</div>
      <div class="empty-state-hint">Add .md files to the ${view==='services'?'knowledge_base/services':'knowledge_base/tactics'}/ folder</div>
    </div>`;
    return;
  }

  items.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id  = item.id;
    card.dataset.cat = item.category || '';
    card.style.setProperty('--card-accent', accentFor(idx));
    card.innerHTML = `
      <span class="card-cat">${esc(item.category || '')}</span>
      <span class="card-icon">${item.icon || ICONS.notes}</span>
      <div class="card-port-name-row">
        ${item.port ? `<span class="card-port">${esc(item.port)}</span>` : ''}
        <span class="card-name">${esc(item.name)}</span>
      </div>
      <div class="card-desc">${esc(item.description || '')}</div>`;
    card.onclick = () => openItem(view, item.id);
    grid.appendChild(card);
  });

  updateToolbarCount(view, items.length);
}

(function() {
  const BREAKPOINT = 1100;

  function applyMode(el) {
    if (!el) return;
    const w = el.getBoundingClientRect().width;
    el.classList.toggle('cards-list-mode', w < BREAKPOINT && w > 0);
  }

  function observeGrids() {
    const grids = document.querySelectorAll('.cards-area');
    if (!grids.length) return;
    const ro = new ResizeObserver(entries => {
      entries.forEach(e => applyMode(e.target));
    });
    grids.forEach(g => { ro.observe(g); applyMode(g); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeGrids);
  } else {
    setTimeout(observeGrids, 100);
  }

  window._observeCardGrids = observeGrids;
})();

function filterCards(view, query) {
  const gridId = view === 'services' ? 'svcGrid' : 'methGrid';
  const q      = query.toLowerCase().trim();
  const cards  = document.querySelectorAll(`#${gridId} .card`);
  let vis      = 0;

  cards.forEach(card => {
    const name  = card.querySelector('.card-name')?.textContent.toLowerCase() || '';
    const desc  = card.querySelector('.card-desc')?.textContent.toLowerCase() || '';
    const port  = card.querySelector('.card-port')?.textContent.toLowerCase() || '';
    const cat   = card.dataset.cat || '';
    const catOk = activeCat === 'all' || cat === activeCat;
    const qOk   = !q || name.includes(q) || desc.includes(q) || port.includes(q) || cat.toLowerCase().includes(q);
    const show  = catOk && qOk;
    card.classList.toggle('hidden', !show);
    if (show) vis++;
  });

  updateToolbarCount(view, vis);
}

function updateToolbarCount(view, n) {
  const total = getKbCollection(view).length;
  const el    = document.getElementById(view === 'services' ? 'svc-toolbar-count' : 'meth-toolbar-count');
  el.textContent = n === total ? `${n} total` : `${n} / ${total}`;
}

