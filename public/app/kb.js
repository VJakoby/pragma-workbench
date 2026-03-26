// ═══════════════════════════════════════════════
// SIDEBAR CATEGORIES
// ═══════════════════════════════════════════════
let kbCreateView = 'services';
let kbCreateFolder = '';
let kbCreateFolderLabel = '';
let activeCatFolder = '';
let serviceCategoryMeta = [];

function shouldOpenKbSidebarInSidePanel() {
  const noteArea = document.getElementById('noteEditArea');
  return activeView === 'notes' && !!activeNoteId && !!notes[activeNoteId] && !!noteArea && noteArea.style.display !== 'none';
}

function getKbCollection(view) {
  return view === 'services' ? SERVICES : TACTICS;
}

function buildKbSearchText(item) {
  return [
    item.name,
    item.description,
    item.port,
    item.category,
    item.folder,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getKbScopeTotal(view) {
  return getKbCollection(view).filter(item => {
    const folderOk = view !== 'services' || !activeCatFolder || (item.folder || '') === activeCatFolder;
    const catOk = activeCat === 'all' || String(item.category || '').toLowerCase() === String(activeCat || '').toLowerCase();
    return folderOk && catOk;
  }).length;
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
    serviceCategoryMeta = d.categories || [];
    const countEl = document.getElementById('svc-count');
    if (countEl) countEl.textContent = SERVICES.length;
    renderKnowledgeFolderNav();
  } else {
    TACTICS = items;
    const countEl = document.getElementById('tactics-count');
    if (countEl) countEl.textContent = TACTICS.length;
  }

  renderCards(view);
  if (activeView === view) {
    if (view === 'services') renderKnowledgeFolderNav();
    else buildSidebar(view);
    const input = document.getElementById(view === 'services' ? 'svcSearch' : 'methSearch');
    if (input) filterCards(view, input.value || '');
  }
}

function renderKnowledgeFolderNav() {
  const list = document.getElementById('kbNavList');
  if (!list) return;
  const folderCats = serviceCategoryMeta.filter(cat => cat.folder);
  const currentFolder = activeView === 'services' ? (activeCatFolder || '') : '';
  const isKnowledgeActive = activeView === 'services';
  const folderIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/><polyline points="14,2 14,7 19,7"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="15" y2="16"/></svg>`;

  list.innerHTML = `
    ${folderCats.map(cat => `
      <div class="nav-item nav-item-kb-folder${isKnowledgeActive && currentFolder === cat.folder ? ' active' : ''}" onclick="openKnowledgeCategory('${esc(cat.label)}', '${esc(cat.folder || '')}', this)" title="${esc(cat.label)}">
        <span class="nav-item-icon">${folderIcon}</span>
        <span class="nav-item-label">${esc(cat.label)}</span>
        <span class="nav-item-count">${SERVICES.filter(item => item.folder === cat.folder).length || '—'}</span>
      </div>`).join('')}
  `;
}

function openSidebarKbView(view, navEl) {
  if (shouldOpenKbSidebarInSidePanel()) {
    openKbBrowserInPanel(view);
    return;
  }
  switchView(view, navEl);
}

function openKbBrowserInPanel(view, { folder = '', title = '', meta = '' } = {}) {
  const panel = document.getElementById('contentPanel');
  const body = document.getElementById('cpContent');
  if (!panel || !body) return;
  if (typeof clearContentPanelBackState === 'function') clearContentPanelBackState();
  if (typeof renderContentPanelTabs === 'function') renderContentPanelTabs(null);

  const items = getKbCollection(view).filter(item => {
    if (view !== 'services' || !folder) return true;
    return (item.folder || '') === folder;
  });

  const label = title || (view === 'services'
    ? (folder ? (serviceCategoryMeta.find(cat => (cat.folder || '') === folder)?.label || 'Knowledge') : 'Services')
    : 'Tactics');
  const countLabel = meta || `${items.length} ${items.length === 1 ? 'document' : 'documents'}`;

  panel.classList.remove('hidden-panel');
  document.getElementById('cpIcon').innerHTML = view === 'services' ? ICONS.notes : ICONS.guides;
  document.getElementById('cpTitle').textContent = label;
  document.getElementById('cpMeta').textContent = countLabel;
  document.getElementById('cpEditBtn').style.display = 'none';
  if (typeof setContentPanelCreateState === 'function') setContentPanelCreateState({ view, folder, label });
  activeDoc = { isBrowser: true, isLocal: true, view, folder, label };

  if (!items.length) {
    body.innerHTML = `<div class="empty-state" style="padding:28px 18px">
      <div class="empty-state-icon">${view === 'services' ? ICONS.notes : ICONS.guides}</div>
      <div class="empty-state-title">No documents found</div>
      <div class="empty-state-hint">${folder ? `No entries in ${esc(label)}` : `No ${view} available`}</div>
    </div>`;
    return;
  }

  body.innerHTML = `<div class="cards-area content-panel-browser" id="cpBrowserGrid"></div>`;
  const grid = document.getElementById('cpBrowserGrid');
  items.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = item.id;
    card.dataset.cat = item.category || '';
    card.dataset.folder = item.folder || '';
    card.dataset.search = buildKbSearchText(item);
    card.style.setProperty('--card-accent', accentFor(idx));
    card.innerHTML = `
      <span class="card-cat">${esc(item.category || '')}</span>
      <span class="card-icon">${item.icon || ICONS.notes}</span>
      <div class="card-port-name-row">
        <span class="card-name">${esc(item.name)}</span>
        ${(item.port || item.category) ? `<span class="card-meta-inline">${[item.port, item.category].filter(Boolean).map(esc).join(' · ')}</span>` : ''}
      </div>
      <div class="card-desc">${esc(item.description || '')}</div>`;
    card.onclick = () => openItem(view, item.id);
    grid.appendChild(card);
  });

  document.getElementById('cpReadBody').scrollTop = 0;
}

function openKnowledgeCategory(cat, folder, navEl) {
  activeCat = 'all';
  activeCatFolder = folder || '';
  if (shouldOpenKbSidebarInSidePanel()) {
    openKbBrowserInPanel('services', {
      folder: activeCatFolder,
      title: cat,
      meta: `${SERVICES.filter(item => (item.folder || '') === activeCatFolder).length} documents`,
    });
    return;
  }
  switchView('services', navEl);
  renderKnowledgeFolderNav();
  const input = document.getElementById('svcSearch');
  filterCards('services', input ? input.value || '' : '');
}

function openKbCreateModal(view, opts = {}) {
  kbCreateView = view === 'services' ? 'services' : 'tactics';
  kbCreateFolder = opts.folder || '';
  kbCreateFolderLabel = opts.label || '';
  const isServices = kbCreateView === 'services';
  const title = isServices ? 'Create Service' : 'Create Tactic';
  const categorySource = kbCreateFolderLabel || (activeCat && activeCat !== 'all' ? activeCat : '');
  const categoryLabel = categorySource ? ` in ${categorySource}` : '';

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
  const category = kbCreateFolder
    ? kbCreateFolder
    : (activeView === clientView && activeCat !== 'all'
      ? (activeCatFolder || activeCat)
      : '');

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
      if (!shouldOpenKbSidebarInSidePanel()) switchView(clientView, document.getElementById(`nav-${clientView}`));
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
  const scopedItems = view === 'services' && activeCatFolder
    ? items.filter(i => (i.folder || '') === activeCatFolder)
    : items;
  const selectedFolderMeta = view === 'services' && activeCatFolder
    ? serviceCategoryMeta.find(c => (c.folder || '') === activeCatFolder)
    : null;
  const selectedFolderLabel = selectedFolderMeta?.label || '';
  const serviceCats = view === 'services' && !activeCatFolder
    ? serviceCategoryMeta.map(c => ({ label: c.label, folder: c.folder || '' }))
    : [];
  const derivedCats = scopedItems
    .map(i => ({ label: i.category, folder: i.folder || '' }))
    .filter(i => i.label)
    .filter(i => !activeCatFolder || String(i.label).toLowerCase() !== String(selectedFolderLabel).toLowerCase());
  const catMap = new Map();
  [...serviceCats, ...derivedCats].forEach(cat => {
    if (!cat?.label) return;
    const key = String(cat.label).toLowerCase();
    if (!catMap.has(key)) catMap.set(key, cat);
  });
  const derivedList = Array.from(catMap.values());
  const cats = derivedList.length ? [{ label: 'all', folder: activeCatFolder || '' }, ...derivedList] : [];
  const list  = document.getElementById('catList');
  document.getElementById('cat-hdr').textContent = 'Categories';
  const currentExists = cats.some(cat => cat.label === activeCat);
  if (!currentExists) {
    activeCat = 'all';
  }

  list.innerHTML = cats.map(cat => `
    <div class="nav-item${cat.label===activeCat?' active':''}" data-cat="${esc(cat.label)}" data-folder="${esc(cat.folder || '')}"
         onclick="setCat('${esc(cat.label)}', this, '${view}', '${esc(cat.folder || '')}')">
      <span class="nav-item-icon">${cat.label==='all'?'◈':'·'}</span>
      <span class="nav-item-label">${cat.label==='all'?'All':esc(cat.label)}</span>
      ${cat.label!=='all'?`<span class="nav-item-count">${scopedItems.filter(i => i.category===cat.label).length}</span>`:''}
    </div>`).join('');
}

function setCat(cat, el, view, folder = '') {
  activeCat = cat;
  activeCatFolder = folder || '';
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
      <div class="empty-state-hint">Add .md files to the ${view==='services'?'knowledge_base/, knowledge_base/services/, or any top-level category folder':'knowledge_base/tactics/'}</div>
    </div>`;
    return;
  }

  items.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id  = item.id;
    card.dataset.cat = item.category || '';
    card.dataset.folder = item.folder || '';
    card.dataset.search = buildKbSearchText(item);
    card.style.setProperty('--card-accent', accentFor(idx));
    card.innerHTML = `
      <span class="card-cat">${esc(item.category || '')}</span>
      <span class="card-icon">${item.icon || ICONS.notes}</span>
      <div class="card-port-name-row">
        <span class="card-name">${esc(item.name)}</span>
        ${(item.port || item.category) ? `<span class="card-meta-inline">${[item.port, item.category].filter(Boolean).map(esc).join(' · ')}</span>` : ''}
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
    const haystack = card.dataset.search || card.textContent.toLowerCase();
    const cat   = card.dataset.cat || '';
    const folder = card.dataset.folder || '';
    const catOk = activeCat === 'all' || String(cat).toLowerCase() === String(activeCat || '').toLowerCase();
    const folderOk = view !== 'services' || !activeCatFolder || folder === activeCatFolder;
    const qOk   = !q || haystack.includes(q);
    const show  = catOk && folderOk && qOk;
    card.classList.toggle('hidden', !show);
    if (show) vis++;
  });

  updateToolbarCount(view, vis, getKbScopeTotal(view));
}

function updateToolbarCount(view, n, total = getKbCollection(view).length) {
  const el    = document.getElementById(view === 'services' ? 'svc-toolbar-count' : 'meth-toolbar-count');
  el.textContent = n === total ? `${n} total` : `${n} / ${total}`;
}

