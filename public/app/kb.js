// ═══════════════════════════════════════════════
// SIDEBAR CATEGORIES
// ═══════════════════════════════════════════════
let kbCreateView = 'services';
let kbCreateFolder = '';
let kbCreateFolderLabel = '';
let activeCatFolder = '';
let activeKbRootFolder = '';
let serviceCategoryMeta = [];
let rootKbSections = [];
let rootKbCollections = {};
const LAST_KB_VIEW_KEY = 'ops-last-kb-view';

function getActiveKbBrowserView() {
  return activeKbRootFolder ? `kb:${activeKbRootFolder}` : 'services';
}

function storeLastKbView(view) {
  if (view === 'services' || (typeof view === 'string' && view.startsWith('kb:'))) {
    localStorage.setItem(LAST_KB_VIEW_KEY, view);
  }
}

async function restoreLastKbView() {
  const saved = localStorage.getItem(LAST_KB_VIEW_KEY) || 'services';
  if (!saved || saved === 'services' || !saved.startsWith('kb:')) return false;
  const folder = saved.slice(3);
  const section = rootKbSections.find(item => item.folder === folder);
  if (!section) return false;
  await openRootKbSection(encodeURIComponent(folder), encodeURIComponent(section.label), document.getElementById('nav-services'));
  return true;
}

globalThis.restoreLastKbView = restoreLastKbView;

function shouldOpenKbSidebarInSidePanel() {
  const noteArea = document.getElementById('noteEditArea');
  return activeView === 'notes' && !!activeNoteId && !!notes[activeNoteId] && !!noteArea && noteArea.style.display !== 'none';
}

function getKbCollection(view) {
  if (view === 'services') return SERVICES;
  if (view === 'tactics') return TACTICS;
  if (typeof view === 'string' && view.startsWith('kb:')) {
    return rootKbCollections[view.slice(3)] || [];
  }
  return [];
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

function formatServiceCardTitle(name) {
  return String(name || '')
    .replace(/\s*\(port\s+[^)]+\)\s*$/i, '')
    .trim();
}

function stripLeadingEmoji(text) {
  return String(text || '')
    .replace(/^\p{Extended_Pictographic}(?:\uFE0F)?\s*/u, '')
    .trim();
}

function renderKbCardMarkup(item, { cardStyle = 'default' } = {}) {
  const category = esc(item.category || '');
  const name = esc(item.name || '');
  const description = esc(item.description || '');
  const metaInline = [item.port, item.category].filter(Boolean).map(esc).join(' · ');

  if (cardStyle === 'default') {
    return `
      <span class="card-cat">${category}</span>
      <span class="card-icon">${item.icon || ICONS.notes}</span>
      <div class="card-port-name-row">
        <span class="card-name">${name}</span>
        ${metaInline ? `<span class="card-meta-inline">${metaInline}</span>` : ''}
      </div>
      <div class="card-desc">${description}</div>`;
  }

  if (cardStyle === 'service') {
    const serviceMeta = item.port ? `<span class="card-service-port">${esc(item.port)}</span>` : '';
    const servicePreview = description || 'Open the service note to view commands, references, and workflow-specific content.';
    const serviceTitle = esc(stripLeadingEmoji(formatServiceCardTitle(item.name || '')));
    return `
      <div class="card-service-head">
        <span class="note-type-general card-service-type">${item.icon || ICONS.notes} ${serviceTitle || name}</span>
      </div>
      <div class="card-service-footer">
        <div class="card-service-badges">
          <span class="card-service-label">${category || 'service note'}</span>
          ${serviceMeta}
        </div>
      </div>
      <div class="card-service-body">
        <div class="card-desc card-service-desc">${servicePreview}</div>
      </div>
      `;
  }

  const knowledgePreview = description || 'Open the note to view workflow details, commands, and reference material.';
  const knowledgeCategory = category || 'knowledge';
  const knowledgeTitle = esc(stripLeadingEmoji(item.name || ''));
  return `
    <div class="card-knowledge-head">
      <span class="card-knowledge-title">${item.icon || ICONS.notes} ${knowledgeTitle || name}</span>
    </div>
    <div class="card-knowledge-meta">
      <span class="card-knowledge-tag">${esc(knowledgeCategory)}</span>
    </div>
    <div class="card-knowledge-body">
      <div class="card-desc card-knowledge-desc">${knowledgePreview}</div>
    </div>`;
}

function getKbCardStyle(view) {
  if (view === 'services') return 'service';
  if (view === 'tactics' || (typeof view === 'string' && view.startsWith('kb:'))) return 'knowledge';
  return 'default';
}

function getKbScopeTotal(view) {
  return getKbCollection(view).filter(item => {
    const folderOk = view !== 'services' || !activeCatFolder || (item.folder || '') === activeCatFolder;
    const catOk = activeCat === 'all' || String(item.category || '').toLowerCase() === String(activeCat || '').toLowerCase();
    return folderOk && catOk;
  }).length;
}

function filterContentPanelCards(query = '') {
  const grid = document.getElementById('cpBrowserGrid');
  if (!grid) return;
  const q = String(query || '').toLowerCase().trim();
  grid.querySelectorAll('.card').forEach(card => {
    const haystack = card.dataset.search || card.textContent.toLowerCase();
    card.classList.toggle('hidden', !!q && !haystack.includes(q));
  });
}

function getKbBackendView(view) {
  if (view === 'services') return 'services';
  if (view === 'tactics') return 'tactics';
  return 'knowledge';
}

function getKbFetchConfig(view) {
  if (view === 'services') {
    return { listUrl: '/api/services', detailUrl: id => `/api/service/${encodeURIComponent(id)}`, listKey: 'services' };
  }
  if (view === 'tactics') {
    return { listUrl: '/api/tactics', detailUrl: id => `/api/tactic/${encodeURIComponent(id)}`, listKey: 'tactics' };
  }
  if (typeof view === 'string' && view.startsWith('kb:')) {
    const folder = view.slice(3);
    return {
      listUrl: `/api/kb-section/${encodeURIComponent(folder)}`,
      detailUrl: id => `/api/kb-section/${encodeURIComponent(folder)}/${encodeURIComponent(id)}`,
      listKey: 'items',
    };
  }
  return { listUrl: '', detailUrl: () => '', listKey: 'items' };
}

async function refreshRootKbSections() {
  const r = await fetch('/api/kb-sections');
  const d = await r.json();
  rootKbSections = d.sections || [];
  renderKnowledgeFolderNav();
}

async function ensureRootKbSectionLoaded(folder) {
  if (!folder) return [];
  if (rootKbCollections[folder]) return rootKbCollections[folder];
  const r = await fetch(`/api/kb-section/${encodeURIComponent(folder)}`);
  const d = await r.json();
  if (!r.ok || d.error) throw new Error(d.error || 'Could not load KB section');
  rootKbCollections[folder] = d.items || [];
  return rootKbCollections[folder];
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
    await refreshRootKbSections();
  } else if (view === 'tactics') {
    TACTICS = items;
    const countEl = document.getElementById('tactics-count');
    if (countEl) countEl.textContent = TACTICS.length;
  } else if (typeof view === 'string' && view.startsWith('kb:')) {
    rootKbCollections[view.slice(3)] = items;
  }

  if (view === 'services' || view === 'tactics') renderCards(view);
  if (activeView === view) {
    if (view === 'services') renderKnowledgeFolderNav();
    else buildSidebar(view);
    const input = document.getElementById(view === 'services' ? 'svcSearch' : 'methSearch');
    if (input) filterCards(view, input.value || '');
  }
}

function renderKnowledgeFolderNav() {
  const list = document.getElementById('kbNavList');
  const subhdr = document.getElementById('kbNavSubhdr');
  if (!list) return;
  const folderCats = serviceCategoryMeta.filter(cat => cat.folder);
  const currentFolder = activeView === 'services' && !activeKbRootFolder ? (activeCatFolder || '') : '';
  const isKnowledgeActive = activeView === 'services' && !activeKbRootFolder;
  const activeKbSection = activeView === 'services' ? activeKbRootFolder : ((activeDoc && typeof activeDoc.view === 'string' && activeDoc.view.startsWith('kb:'))
    ? activeDoc.view.slice(3)
    : '');
  const folderIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/><polyline points="14,2 14,7 19,7"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="15" y2="16"/></svg>`;

  list.innerHTML = `
    ${folderCats.map(cat => `
      <div class="nav-item nav-item-kb-folder${isKnowledgeActive && currentFolder === cat.folder ? ' active' : ''}" onclick="openKnowledgeCategory('${encodeURIComponent(cat.label)}', '${encodeURIComponent(cat.folder || '')}', this)" title="${esc(cat.label)}">
        <span class="nav-item-icon">${folderIcon}</span>
        <span class="nav-item-label">${esc(cat.label)}</span>
        <span class="nav-item-count">${SERVICES.filter(item => item.folder === cat.folder).length || '—'}</span>
      </div>`).join('')}
    ${rootKbSections.map(section => `
      <div class="nav-item nav-item-kb-folder${activeKbSection === section.folder ? ' active' : ''}" onclick="openRootKbSection('${encodeURIComponent(section.folder)}', '${encodeURIComponent(section.label)}', this)" title="${esc(section.label)}">
        <span class="nav-item-icon">${folderIcon}</span>
        <span class="nav-item-label">${esc(section.label)}</span>
        <span class="nav-item-count">${section.count || '—'}</span>
      </div>`).join('')}
  `;
  if (subhdr) subhdr.style.display = (folderCats.length || rootKbSections.length) ? '' : 'none';
}

async function openRootKbSection(folder, label, navEl) {
  folder = decodeURIComponent(folder);
  label = decodeURIComponent(label);
  try {
    await ensureRootKbSectionLoaded(folder);
    if (shouldOpenKbSidebarInSidePanel()) {
      openKbBrowserInPanel(`kb:${folder}`, {
        folder,
        title: label,
        meta: `${(rootKbCollections[folder] || []).length} document${(rootKbCollections[folder] || []).length === 1 ? '' : 's'}`,
      });
      renderKnowledgeFolderNav();
      return;
    }
    activeKbRootFolder = folder;
    activeCat = 'all';
    activeCatFolder = '';
    storeLastKbView(`kb:${folder}`);
    switchView('services', navEl);
    renderKnowledgeFolderNav();
    buildSidebar(`kb:${folder}`);
    renderCards(`kb:${folder}`);
    const input = document.getElementById('svcSearch');
    if (input) filterCards(`kb:${folder}`, input.value || '');
  } catch (e) {
    showToast(e.message || 'Could not open KB section');
  }
}

function openSidebarKbView(view, navEl) {
  if (shouldOpenKbSidebarInSidePanel()) {
    openKbBrowserInPanel(view);
    return;
  }
  if (view === 'services') {
    activeKbRootFolder = '';
    activeCat = 'all';
    activeCatFolder = '';
    storeLastKbView('services');
  }
  switchView(view, navEl);
  if (view === 'services') {
    renderKnowledgeFolderNav();
    buildSidebar('services');
    renderCards('services');
    const input = document.getElementById('svcSearch');
    if (input) filterCards('services', input.value || '');
  }
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
    : view === 'tactics'
      ? 'Tactics'
      : (rootKbSections.find(section => section.folder === folder)?.label || 'Knowledge'));
  const countLabel = meta || `${items.length} ${items.length === 1 ? 'document' : 'documents'}`;

  panel.classList.remove('hidden-panel');
  document.getElementById('cpIcon').innerHTML = view === 'tactics' ? ICONS.guides : ICONS.notes;
  document.getElementById('cpTitle').textContent = label;
  document.getElementById('cpMeta').textContent = countLabel;
  document.getElementById('cpEditBtn').style.display = 'none';
  if (typeof clearLastLocationFields === 'function') {
    clearLastLocationFields('contentPanelKind', 'contentPanelView', 'contentPanelId');
  }
  if (typeof setContentPanelCreateState === 'function') setContentPanelCreateState({ view, folder, label });
  activeDoc = { isBrowser: true, isLocal: true, view, folder, label };

  if (!items.length) {
    body.innerHTML = `<div class="empty-state" style="padding:28px 18px">
      <div class="empty-state-icon">${view === 'tactics' ? ICONS.guides : ICONS.notes}</div>
      <div class="empty-state-title">No documents found</div>
      <div class="empty-state-hint">${folder ? `No entries in ${esc(label)}` : `No ${view} available`}</div>
    </div>`;
    return;
  }

  body.innerHTML = `
    <div class="content-panel-browser-toolbar">
      <div class="local-search content-panel-browser-search">
        <span class="local-search-icon">&#8981;</span>
        <input type="text" id="cpBrowserSearch" placeholder="filter&hellip;" autocomplete="off" oninput="filterContentPanelCards(this.value)">
      </div>
    </div>
    <div class="cards-area content-panel-browser" id="cpBrowserGrid"></div>`;
  const grid = document.getElementById('cpBrowserGrid');
  items.forEach((item, idx) => {
    const card = document.createElement('div');
    const cardStyle = getKbCardStyle(view);
    card.className = `card${cardStyle === 'service' ? ' card-service' : cardStyle === 'knowledge' ? ' card-knowledge' : ''}`;
    card.dataset.id = item.id;
    card.dataset.cat = item.category || '';
    card.dataset.folder = item.folder || '';
    card.dataset.search = buildKbSearchText(item);
    card.style.setProperty('--card-accent', accentFor(idx));
    card.innerHTML = renderKbCardMarkup(item, { cardStyle });
    card.onclick = () => openItem(view, item.id);
    grid.appendChild(card);
  });

  document.getElementById('cpBrowserSearch')?.focus();
  document.getElementById('cpReadBody').scrollTop = 0;
}

function openKnowledgeCategory(cat, folder, navEl) {
  cat = decodeURIComponent(cat);
  folder = decodeURIComponent(folder);
  activeCat = 'all';
  activeCatFolder = folder || '';
  activeKbRootFolder = '';
  storeLastKbView('services');
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
  kbCreateView = view === 'services' ? 'services' : view === 'tactics' ? 'tactics' : view;
  kbCreateFolder = opts.folder || '';
  kbCreateFolderLabel = opts.label || '';
  const isServices = kbCreateView === 'services';
  const isTactics = kbCreateView === 'tactics';
  const title = isServices ? 'Create Service' : isTactics ? 'Create Tactic' : 'Create Document';
  const categorySource = kbCreateFolderLabel || (activeCat && activeCat !== 'all' ? activeCat : '');
  const categoryLabel = categorySource ? ` in ${categorySource}` : '';

  document.getElementById('kbCreateTitle').textContent = title;
  document.getElementById('kbCreateDesc').textContent = `Create a new ${isServices ? 'service' : isTactics ? 'tactic' : 'document'} file${categoryLabel}.`;
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
    input.placeholder = isServices ? 'e.g. smb-enum' : isTactics ? 'e.g. kerberos-notes' : 'e.g. exam-checklist';
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
    if (clientView !== 'services' && clientView !== 'tactics' && typeof refreshRootKbSections === 'function') {
      await refreshRootKbSections();
    }
    if (activeView !== clientView) {
      if (!shouldOpenKbSidebarInSidePanel() && (clientView === 'services' || clientView === 'tactics')) {
        switchView(clientView, document.getElementById(`nav-${clientView}`));
      }
    }
    if (d.id) {
      await openItem(clientView, d.id);
      if (typeof enterEditMode === 'function') enterEditMode();
    }
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
         onclick="setCat('${encodeURIComponent(cat.label)}', this, '${encodeURIComponent(view)}', '${encodeURIComponent(cat.folder || '')}')">
      <span class="nav-item-icon">${cat.label==='all'?'◈':'·'}</span>
      <span class="nav-item-label">${cat.label==='all'?'All':esc(cat.label)}</span>
      ${cat.label!=='all'?`<span class="nav-item-count">${scopedItems.filter(i => i.category===cat.label).length}</span>`:''}
    </div>`).join('');
}

function setCat(cat, el, view, folder = '') {
  cat = decodeURIComponent(cat);
  view = decodeURIComponent(view);
  folder = decodeURIComponent(folder);
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
  const gridId = view === 'tactics' ? 'methGrid' : 'svcGrid';
  const grid   = document.getElementById(gridId);
  grid.innerHTML = '';

  if (items.length === 0) {
    grid.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></div>
      <div class="empty-state-title">No ${view} found</div>
      <div class="results-offline warn" style="margin:12px 0 0;padding:18px 18px;max-width:520px;">
        <div class="results-offline-text">KB path not configured</div>
        <div class="results-offline-hint">Add <code>.md</code> files to the ${view==='tactics'?'knowledge-base/tactics/':view==='services'?'knowledge-base/services/':`knowledge-base/${view.slice(3)}/`} or set <code>PRAGMA_KB_PATH</code> in <code>.env</code> to point to your KB.</div>
      </div>
    </div>`;
    return;
  }

  items.forEach((item, idx) => {
    const card = document.createElement('div');
    const cardStyle = getKbCardStyle(view);
    card.className = `card${cardStyle === 'service' ? ' card-service' : cardStyle === 'knowledge' ? ' card-knowledge' : ''}`;
    card.dataset.id  = item.id;
    card.dataset.cat = item.category || '';
    card.dataset.folder = item.folder || '';
    card.dataset.search = buildKbSearchText(item);
    card.style.setProperty('--card-accent', accentFor(idx));
    card.innerHTML = renderKbCardMarkup(item, { cardStyle });
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
  const gridId = view === 'tactics' ? 'methGrid' : 'svcGrid';
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
  const el    = document.getElementById(view === 'tactics' ? 'meth-toolbar-count' : 'svc-toolbar-count');
  el.textContent = n === total ? `${n} total` : `${n} / ${total}`;
}
