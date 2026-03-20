// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════
let SERVICES      = [];
let METHODOLOGIES = [];
let activeView    = 'services';
let activeDoc     = null;
let activeCat     = 'all';
let searchScope   = 'all';
let fuzzyMode     = 'normal';
let knownSources  = [];          // [{id, name}] fetched from ENGRAM via /api/search-sources
let disabledSources = new Set(JSON.parse(localStorage.getItem('pragma-disabled-sources') || '[]'));
let searchDebounce;
let cmdSelected   = 0;
let cmdItems      = [];
let notes         = {};
let sessions      = {};
let activeSessionId = null;
let activeTargetId  = null;
let activeNoteId  = null;
let noteSaveTimer;
let tlTargetFilter = null; // timeline per-target filter

const ACCENT_COLORS = [
  '#7c3aed','#34d399','#a78bfa','#fb923c',
  '#f87171','#fbbf24','#22d3ee','#6ee7b7',
];
const accentFor = i => ACCENT_COLORS[i % ACCENT_COLORS.length];

// ═══════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════
function applyTheme(t) {
  if (t === 'light') {
    document.documentElement.setAttribute('data-theme','light');
    document.getElementById('themeBtn').innerHTML = '<span style="display:flex;align-items:center;gap:5px"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> Dark</span>';
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.remove());
    const m = document.createElement('meta');
    m.name = 'theme-color'; m.content = '#ffffff';
    document.head.appendChild(m);
  } else {
    document.documentElement.removeAttribute('data-theme');
    document.getElementById('themeBtn').innerHTML = '<span style="display:flex;align-items:center;gap:5px"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> Light</span>';
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.remove());
    const m = document.createElement('meta');
    m.name = 'theme-color'; m.content = '#363f49';
    document.head.appendChild(m);
  }
}
function toggleTheme() {
  // Reinit CM editors after theme change so colours update
  setTimeout(() => {
    if (noteEditor) {
      const val = cmGetValue(noteEditor);
      cmInitNote();
      cmSetValue(noteEditor, val);
    }
    if (kbEditor) {
      const val = cmGetValue(kbEditor);
      cmInitKb();
      cmSetValue(kbEditor, val);
    }
  }, 50);
  const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  localStorage.setItem('ops-theme', cur);
  applyTheme(cur);
}
applyTheme(localStorage.getItem('ops-theme') || 'dark');

// ═══════════════════════════════════════════════
// SIDEBAR TOGGLE
// ═══════════════════════════════════════════════
let sidebarVisible = true;

// Sidebar state: 'full' | 'icon' | 'hidden'
let sidebarState = localStorage.getItem('ops-sidebar-state') || 'full';

function applySidebarState(state) {
  const sidebar = document.querySelector('.sidebar');
  const btn = document.getElementById('sidebarToggleBtn');
  if (!sidebar) return;
  sidebar.classList.toggle('sidebar-hidden',    state === 'hidden');
  sidebar.classList.toggle('sidebar-icon-only', state === 'icon');
  btn.classList.toggle('sidebar-collapsed', state !== 'full');
  // Update legacy sidebarVisible for any code that checks it
  sidebarVisible = state !== 'hidden';
  localStorage.setItem('ops-sidebar-state', state);
  sidebarState = state;
}

function toggleSidebar(force) {
  // If called with force=false (legacy hide), go to 'hidden' directly
  if (force === false) { applySidebarState('hidden'); return; }
  if (force === true)  { applySidebarState('full');   return; }
  // Cycle: full → icon → hidden → full
  const next = sidebarState === 'full' ? 'icon' : sidebarState === 'icon' ? 'hidden' : 'full';
  applySidebarState(next);
}

(function() {
  const saved = localStorage.getItem('ops-sidebar-state');
  // Migrate legacy ops-sidebar-v2 key
  if (!saved) {
    const legacy = localStorage.getItem('ops-sidebar-v2');
    sidebarState = (legacy === '0') ? 'hidden' : 'full';
  } else {
    sidebarState = saved;
  }
  if (sidebarState !== 'full') requestAnimationFrame(() => applySidebarState(sidebarState));
})();

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════
async function init() {
  initTarget();
  initSyntaxThemePicker();
  applyNotePreviewState();
  try {
    await initNotes();
  } catch (err) {
    // Password cancelled or decryption failed — show locked screen, do NOT continue
    // to avoid saveNotes() being called with empty state and overwriting the workbench
    document.body.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                  height:100vh;background:#0f0f13;color:#e2e8f0;font-family:'Inter',sans-serif;gap:16px">
        <div style="display:flex;justify-content:center;color:var(--muted);margin-bottom:8px"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
        <div style="font-size:18px;font-weight:700">Workspace Locked</div>
        <div style="font-size:13px;color:#94a3b8;max-width:320px;text-align:center">
          ${err.message === 'cancelled' ? 'Password entry was cancelled.' : (err.message || 'Could not unlock workspace.')}</div>
        <button onclick="location.reload()"
          style="margin-top:8px;padding:8px 24px;background:#7c3aed;border:none;border-radius:8px;
                 color:#fff;font-size:13px;font-weight:600;cursor:pointer">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg> Try Again
        </button>
      </div>`;
    return;
  }

  // Fetch services
  try {
    const r = await fetch('/api/services');
    const d = await r.json();
    SERVICES = d.services || [];
  } catch(e) { console.warn('services unavailable', e); }

  // Fetch methodologies
  try {
    const r = await fetch('/api/methodologies');
    const d = await r.json();
    METHODOLOGIES = d.guides || [];
  } catch(e) { console.warn('methodologies unavailable', e); }

  // Fetch note templates (falls back to hardcoded if missing)
  await loadNoteTemplates();
  renderNoteTypeGrid();

  document.getElementById('svc-count').textContent  = SERVICES.length;
  document.getElementById('meth-count').textContent = METHODOLOGIES.length;

  renderCards('services');
  renderCards('methodologies');
  buildSidebar('services');
  // Set initial card layout mode after render
  setTimeout(() => window._observeCardGrids && window._observeCardGrids(), 150);
}

// ═══════════════════════════════════════════════
// VIEW SWITCHING
// ═══════════════════════════════════════════════
function switchView(view, navEl) {
  activeView = view;
  document.querySelectorAll('.panel-view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('view-'+view).classList.add('active');
  if (navEl) navEl.classList.add('active');
  else document.getElementById('nav-'+view)?.classList.add('active');

  // Update sidebar categories
  const catSection = document.querySelector('.sidebar-section:has(#cat-hdr)');
  if (view === 'services' || view === 'methodologies') {
    buildSidebar(view);
    if (catSection) catSection.style.display = '';
    document.getElementById('catList').style.display = '';
  } else {
    document.getElementById('catList').innerHTML = '';
    document.getElementById('catList').style.display = 'none';
    if (catSection) catSection.style.display = 'none';
  }

  if (view === 'search') {
    setTimeout(() => document.getElementById('searchInput').focus(), 50);
    checkEngramStatus();
    if (!knownSources.length) loadSearchSources();
  }
}

// ═══════════════════════════════════════════════
// COMMAND PALETTE
// ═══════════════════════════════════════════════
function openCmd() {
  document.getElementById('cmdOverlay').classList.add('open');
  document.getElementById('cmdInput').value = '';
  buildCmdResults('');
  setTimeout(() => document.getElementById('cmdInput').focus(), 30);
}

function closeCmd() {
  document.getElementById('cmdOverlay').classList.remove('open');
  cmdSelected = 0; cmdItems = [];
}

function closeCmdIfOutside(e) {
  if (e.target === document.getElementById('cmdOverlay')) closeCmd();
}

function buildCmdResults(q) {
  const ql    = q.toLowerCase().trim();
  const res   = document.getElementById('cmdResults');
  cmdItems    = [];
  let html    = '';

  // Services
  const svcs = SERVICES.filter(s =>
    !ql || s.name.toLowerCase().includes(ql) || (s.port||'').includes(ql) ||
    (s.category||'').toLowerCase().includes(ql)
  ).slice(0, 6);

  if (svcs.length) {
    html += `<div class="cmd-group-hdr">Services</div>`;
    svcs.forEach(s => {
      cmdItems.push({ type:'service', id:s.id, label:s.name });
      html += `<div class="cmd-item" data-idx="${cmdItems.length-1}" onclick="execCmd(${cmdItems.length-1})">
        <span class="cmd-item-icon">${s.icon||ICONS.notes}</span>
        <div class="cmd-item-main">
          <div class="cmd-item-title">${esc(s.name)}</div>
          <div class="cmd-item-sub">${esc(s.port||'')} · ${esc(s.category||'')}</div>
        </div>
        <span class="cmd-item-tag">service</span>
      </div>`;
    });
  }

  // Methodologies
  const meths = METHODOLOGIES.filter(m =>
    !ql || m.name.toLowerCase().includes(ql) || (m.category||'').toLowerCase().includes(ql)
  ).slice(0, 5);

  if (meths.length) {
    html += `<div class="cmd-group-hdr">Tactical Guides</div>`;
    meths.forEach(m => {
      cmdItems.push({ type:'methodology', id:m.id, label:m.name });
      html += `<div class="cmd-item" data-idx="${cmdItems.length-1}" onclick="execCmd(${cmdItems.length-1})">
        <span class="cmd-item-icon">${m.icon||ICONS.guides}</span>
        <div class="cmd-item-main">
          <div class="cmd-item-title">${esc(m.name)}</div>
          <div class="cmd-item-sub">${esc(m.category||'')}</div>
        </div>
        <span class="cmd-item-tag">guide</span>
      </div>`;
    });
  }

  // Notes
  const noteList = Object.values(notes).filter(n =>
    !ql || n.title.toLowerCase().includes(ql) || n.body.toLowerCase().includes(ql) ||
    (n.tags||[]).some(t => t.toLowerCase().includes(ql))
  ).slice(0, 3);

  if (noteList.length) {
    html += `<div class="cmd-group-hdr">Session Notes</div>`;
    noteList.forEach(n => {
      cmdItems.push({ type:'note', id:n.id, label:n.title });
      html += `<div class="cmd-item" data-idx="${cmdItems.length-1}" onclick="execCmd(${cmdItems.length-1})">
        <span class="cmd-item-icon"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span>
        <div class="cmd-item-main">
          <div class="cmd-item-title">${esc(n.title||'Untitled')}</div>
          <div class="cmd-item-sub">${esc((n.body||'').slice(0,60))}</div>
        </div>
        <span class="cmd-item-tag">note</span>
      </div>`;
    });
  }

  // Search action
  if (ql) {
    cmdItems.push({ type:'search', query:ql, label:`Search "${ql}"` });
    html += `<div class="cmd-group-hdr">Search</div>
    <div class="cmd-item" data-idx="${cmdItems.length-1}" onclick="execCmd(${cmdItems.length-1})">
      <span class="cmd-item-icon"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
      <div class="cmd-item-main">
        <div class="cmd-item-title">Search for "<strong>${esc(ql)}</strong>"</div>
        <div class="cmd-item-sub">Search the full knowledge index</div>
      </div>
    </div>`;
  }

  if (!html) {
    html = `<div style="padding:24px;text-align:center;color:var(--muted);font-size:13px;font-family:'Inter',sans-serif">
      Type to search services, guides and notes…
    </div>`;
  }

  res.innerHTML = html;
  cmdSelected = 0;
  updateCmdSelection();
}

function onCmdInput(val) { buildCmdResults(val); }

function onCmdKey(e) {
  if (e.key === 'Escape') { closeCmd(); return; }
  if (e.key === 'ArrowDown') { e.preventDefault(); cmdSelected = Math.min(cmdSelected+1, cmdItems.length-1); updateCmdSelection(); }
  if (e.key === 'ArrowUp')   { e.preventDefault(); cmdSelected = Math.max(cmdSelected-1, 0); updateCmdSelection(); }
  if (e.key === 'Enter')     { e.preventDefault(); execCmd(cmdSelected); }
}

function updateCmdSelection() {
  document.querySelectorAll('.cmd-item').forEach((el, i) => {
    el.classList.toggle('selected', i === cmdSelected);
  });
}

function execCmd(idx) {
  const item = cmdItems[idx];
  if (!item) return;
  closeCmd();
  if (item.type === 'service') {
    switchView('services', document.getElementById('nav-services'));
    openItem('services', item.id);
  } else if (item.type === 'methodology') {
    switchView('methodologies', document.getElementById('nav-methodologies'));
    openItem('methodologies', item.id);
  } else if (item.type === 'note') {
    switchView('notes', document.getElementById('nav-notes'));
    setTimeout(() => openNote(item.id), 50);
  } else if (item.type === 'tag') {
    switchView('notes', document.getElementById('nav-notes'));
    setTimeout(() => setTagFilter(item.tag), 50);
  } else if (item.type === 'search') {
    switchView('search', document.getElementById('nav-search'));
    document.getElementById('searchInput').value = item.query;
    runSearch(item.query);
  }
}

// ═══════════════════════════════════════════════
// NOTES
// Schema per note:
//   id        — unique key, e.g. "note_1718000000000"
//   type      — "general" | "credentials" | "privesc" | "recon" | "loot" | "exploit"
//   title     — string
//   body      — markdown string
//   target_ip — snapshot of IP at creation time (for future export grouping)
//   target_domain — snapshot of domain at creation time
//   created   — timestamp ms
//   updated   — timestamp ms
//
// Persisted as notes.json via /api/notes/save.
// localStorage is a fallback/cache. Future export will use type + target to
// group notes into per-engagement markdown files.
// ═══════════════════════════════════════════════

// ── Templates path — change this if you move the file ──
const TEMPLATES_PATH = '/api/templates';

const NOTE_TYPE_META = {
  general:     { label: 'General',     icon: '📋', cssClass: 'note-type-general'     },
  credentials: { label: 'Credentials', icon: '🔑', cssClass: 'note-type-credentials' },
  privesc:     { label: 'PrivEsc',     icon: '⬆',  cssClass: 'note-type-privesc'     },
  recon:       { label: 'Recon',       icon: '🔭', cssClass: 'note-type-recon'       },
  loot:        { label: 'Loot',        icon: '💰', cssClass: 'note-type-loot'        },
  exploit:     { label: 'Exploit',     icon: '💥', cssClass: 'note-type-exploit'     },
  scratch:     { label: 'Blank',       icon: '📄', cssClass: 'note-type-scratch'     },
};

// ── Hardcoded fallback — used only if notes-templates.json is missing/empty ──
const NOTE_TEMPLATES_FALLBACK = {
  general:     { title: '',                    body: `## Overview\n\n\n## Notes\n\n\n## References\n\n` },
  credentials: { title: 'Credentials',         body: `## Credentials\n\n| Username | Password | Hash | Service | Notes |\n|----------|----------|------|---------|-------|\n|          |          |      |         |       |\n\n## Password Spray / Stuffing Notes\n\n\n## Valid Sessions / Tokens\n\n` },
  privesc:     { title: 'Privilege Escalation', body: `## System Info\n\n| Field     | Value |\n|-----------|-------|\n| OS        |       |\n| Kernel    |       |\n| Hostname  |       |\n| Current User |    |\n| Groups    |       |\n\n## Enumeration\n\n### SUID / SGID Binaries\n\n\n### Sudo Rights\n\n\n### Cron Jobs\n\n\n### Writable Paths / Misconfigs\n\n\n### Interesting Files\n\n\n## Vectors Attempted\n\n| Vector | Result | Notes |\n|--------|--------|-------|\n|        |        |       |\n\n## Escalation Path\n\n\n` },
  recon:       { title: 'Recon',               body: `## Target Overview\n\n| Field   | Value |\n|---------|-------|\n| IP      |       |\n| Domain  |       |\n| OS      |       |\n| In Scope|       |\n\n## Open Ports & Services\n\n| Port | Proto | Service | Version | Notes |\n|------|-------|---------|---------|-------|\n|      |       |         |         |       |\n\n## Web Endpoints\n\n\n## DNS / Hostnames\n\n\n## Users / Groups Discovered\n\n\n## Findings\n\n` },
  loot:        { title: 'Loot',                body: `## Files & Data\n\n| Path | Description | Hash / Value | Exfil Method |\n|------|-------------|--------------|--------------|\n|      |             |              |              |\n\n## Credentials Found\n\n\n## Flags / Proofs\n\n\`\`\`\n# root.txt / user.txt / proof.txt\n\n\`\`\`\n\n## Notes\n\n` },
  exploit:     { title: 'Exploit',             body: `## Vulnerability\n\n| Field       | Value |\n|-------------|-------|\n| Name        |       |\n| CVE         |       |\n| CVSS        |       |\n| Affected    |       |\n| Auth Required|      |\n\n## Payload\n\n\`\`\`bash\n\n\`\`\`\n\n## Steps\n\n1. \n2. \n3. \n\n## Outcome\n\n\n## Cleanup / Artifacts to Remove\n\n` },
  scratch:     { title: '',                    body: '' },
};

// Live templates — populated from /api/templates on init, falls back to NOTE_TEMPLATES_FALLBACK
let NOTE_TEMPLATES = { ...NOTE_TEMPLATES_FALLBACK };

async function loadNoteTemplates() {
  try {
    const r = await fetch(TEMPLATES_PATH);
    const d = await r.json();
    if (!d.templates || !d.templates.length) {
      console.log('[Templates] No templates file or empty — using hardcoded fallback');
      return;
    }
    const loaded = {};
    for (const t of d.templates) {
      if (!t.id) continue;
      loaded[t.id] = {
        title:        t.title_prefix || '',
        body:         t.body         || '',
        icon:         t.icon,
        label:        t.label,
        default_tags: t.default_tags || [],
        fromFile:     true,
      };
      if (!NOTE_TYPE_META[t.id]) {
        NOTE_TYPE_META[t.id] = { label: t.label || t.id, icon: t.icon || '📄', cssClass: 'note-type-general' };
      }
    }
    loaded.scratch = NOTE_TEMPLATES_FALLBACK.scratch;
    NOTE_TEMPLATES = loaded;
    console.log(`[Templates] Loaded ${Object.keys(loaded).length - 1} templates from file`);
    renderNoteTypeGrid();
    renderNoteFilterBar();
  } catch (e) {
    console.warn('[Templates] Failed to load templates file, using hardcoded fallback:', e.message);
  }
}

function renderNoteTypeGrid() {
  const grid = document.getElementById('newNoteTypeGrid');
  if (!grid) return;

  const builtinIds = new Set(Object.keys(NOTE_TEMPLATES_FALLBACK).filter(id => id !== 'scratch'));

  // NOTE_TEMPLATES is the single source of truth — either fallback or file, never both
  const entries = Object.entries(NOTE_TEMPLATES).filter(([id]) => id !== 'scratch');
  const builtins = entries.filter(([id]) =>  builtinIds.has(id));
  const customs  = entries.filter(([id]) => !builtinIds.has(id));

  const buttons = [`<button class="new-note-type-btn" data-type="scratch" onclick="newNote('scratch')"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg> Blank</button>`];

  for (const [id, tmpl] of builtins) {
    const icon  = tmpl.icon  || NOTE_TYPE_META[id]?.icon  || '📄';
    const label = tmpl.label || NOTE_TYPE_META[id]?.label || id;
    buttons.push(`<button class="new-note-type-btn" data-type="${id}" onclick="newNote('${id}')">${icon} ${label}</button>`);
  }

  if (customs.length) {
    buttons.push(`<div class="new-note-type-heading">Custom</div>`);
    for (const [id, tmpl] of customs) {
      const icon  = tmpl.icon  || '';
      const label = tmpl.label || id;
      buttons.push(`<button class="new-note-type-btn template-from-file" data-type="${id}" onclick="newNote('${id}')">${icon} ${label}</button>`);
    }
  }
  grid.innerHTML = buttons.join('');
}

function renderNoteFilterBar() {
  const bar = document.getElementById('notesTypeFilter');
  if (!bar) return;
  const builtinIds = Object.keys(NOTE_TEMPLATES_FALLBACK).filter(id => id !== 'scratch');
  const customIds  = Object.keys(NOTE_TEMPLATES).filter(id => id !== 'scratch' && !builtinIds.includes(id) && NOTE_TEMPLATES[id].fromFile);

  let html = `<button class="note-type-btn active" data-type="all" onclick="setNoteFilter('all',this)">All</button>`;
  for (const id of builtinIds) {
    const meta = NOTE_TYPE_META[id];
    if (!meta) continue;
    html += `<button class="note-type-btn" data-type="${id}" onclick="setNoteFilter('${id}',this)">${meta.label}</button>`;
  }
  html += `<button class="note-type-btn" data-type="scratch" onclick="setNoteFilter('scratch',this)">Blank</button>`;
  for (const id of customIds) {
    const meta = NOTE_TYPE_META[id];
    if (!meta) continue;
    html += `<button class="note-type-btn note-type-custom" data-type="${id}" onclick="setNoteFilter('${id}',this)">${meta.icon || ''} ${meta.label}</button>`;
  }
  bar.innerHTML = html;
}
let activeNoteFilter = 'all';
let activeNoteScope  = 'session';
let activeTagFilter  = null; // 'session' | 'unassigned' | 'all'
let activeTargetFilter = null; // target id or null
let activeNoteSearch = ''; // body/title full-text search

let encryptedStorageEnabled  = false;
let encryptedStoragePassword = null; // in-memory only; never persisted
let encryptedStorageHint     = '';   // plain-text hint, stored in blob, not secret
let workbenchUnlocked        = true; // set false if encrypted but not yet decrypted

// Tab handling is native in CodeMirror 6

function updateEncryptedStorageUI() {
  const btn      = document.getElementById('encStorageBtn');
  const dlBtn    = document.getElementById('encDownloadBtn');
  const sidebar  = document.querySelector('.sidebar');
  if (!btn) return;
  const locked = encryptedStorageEnabled && !encryptedStoragePassword;
  const active = encryptedStorageEnabled && !locked;
  btn.classList.toggle('on',     active);
  btn.classList.toggle('locked', locked);
  if (sidebar) sidebar.classList.toggle('enc-active', active);
  document.body.classList.toggle('enc-active-body', active);
  if (!encryptedStorageEnabled)  btn.innerHTML = '<span style="display:flex;align-items:center;gap:5px">' + ICONS.lock + ' Encrypted Workbench</span>';
  else if (locked)               btn.innerHTML = '<span style="display:flex;align-items:center;gap:5px">' + ICONS.lock + ' Encrypted Workbench</span>';
  else                           btn.innerHTML = '<span style="display:flex;align-items:center;gap:5px">' + ICONS.lock + ' Encrypted Workbench</span>';
  if (dlBtn) dlBtn.style.display = encryptedStorageEnabled ? '' : 'none';
  // Backup download button is always available once a save has occurred (enc or plain)
  const bakBtn = document.getElementById('bakDownloadBtn');
  if (bakBtn) bakBtn.style.display = '';
}

function downloadWorkbench() {
  const a = document.createElement('a');
  a.href = '/api/notes/download';
  a.download = 'pragma.workbench.enc';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function downloadBackup() {
  try {
    const res = await fetch('/api/notes/download-backup');
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      showToast('⚠ ' + (err.error || 'No backup available'), 'err');
      return;
    }
    const disposition = res.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match ? match[1] : 'pragma.workbench.bak1';
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('✓ Backup downloaded: ' + filename);
  } catch (err) {
    showToast('⚠ Backup download failed: ' + err.message, 'err');
  }
}

async function toggleEncryptedStorage(e) {
  try { e?.stopPropagation?.(); } catch(_) {}

  // If encryption is enabled but no password is in memory, the workbench is locked —
  // disabling encryption here would overwrite the encrypted file with empty state
  if (encryptedStorageEnabled && !encryptedStoragePassword) {
    showToast('⚠ Workspace is locked — unlock it first before changing encryption settings');
    return;
  }

  if (!encryptedStorageEnabled) {
    let pw1;
    try {
      pw1 = await showPasswordPrompt({
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`, title: 'Enable Encrypted Workbench',
        description: 'All notes and session data will be encrypted with AES-256-GCM before being written to disk. <strong>If you lose this password, your data cannot be recovered.</strong>',
        label: 'Set Password', placeholder: 'Choose a strong password…',
        confirm: true, submitLabel: ICONS.lock + ' Enable Encryption',
        hint: true,
      });
    } catch { return; } // cancelled
    encryptedStorageEnabled  = true;
    encryptedStoragePassword = pw1.password;
    encryptedStorageHint     = pw1.hint || '';
    updateEncryptedStorageUI();
    saveNotes();
  } else {
    try {
      await showConfirmDialog({
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`, title: 'Disable Encrypted Workbench',
        bigIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`,
        description: 'Encryption will be disabled. Your notes will be stored as <strong>plaintext</strong> on disk from the next save onwards.',
        confirmLabel: 'Disable Encryption', danger: true,
      });
    } catch { return; } // cancelled
    encryptedStorageEnabled  = false;
    encryptedStoragePassword = null;
    updateEncryptedStorageUI();
    try {
      await fetch('/api/notes/storage/disable-encrypted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessions, notes }),
      });
    } catch(_) {}
    saveNotes();
  }
}

// ═══════════════════════════════════════════════
// WORKBENCH MANAGEMENT
// ═══════════════════════════════════════════════
async function initNotes() {
  try {
    const r = await fetch('/api/notes');
    const d = await r.json();
    if (d && d.encrypted_storage === true) {
      encryptedStorageEnabled = true;
      updateEncryptedStorageUI();
      const encRes = await fetch('/api/notes/encrypted');
      const encObj = await encRes.json();
      let pw;
      try {
        pw = await showPasswordPrompt({
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`, title: 'Workspace Locked',
          description: 'This workspace is encrypted. Enter your password to unlock and load your notes.'
            + (encObj.hint ? `<div style="margin-top:10px;padding:8px 12px;background:var(--bg1);border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:0 4px 4px 0;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text2)">Hint: ${encObj.hint}</div>` : ''),
          label: 'Password', placeholder: 'Enter password…',
          submitLabel: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg> Unlock',
        });
      } catch { throw new Error('cancelled'); }
      // Attempt decryption — if it fails, show a clear error and do NOT fall through to the
      // localStorage branch (which would prompt for the password a second time).
      let plain;
      try {
        plain = await decryptPayload(encObj, pw);
      } catch {
        throw new Error('Incorrect password — decryption failed');
      }
      encryptedStoragePassword = pw;
      encryptedStorageHint     = encObj.hint || '';
      updateEncryptedStorageUI();
      const parsed = JSON.parse(plain);
      notes    = (parsed.notes    !== undefined ? parsed.notes    : parsed) || {};
      sessions = parsed.sessions || {};
      localStorage.setItem('ops-notes-v2-encrypted', JSON.stringify(encObj));
      localStorage.removeItem('ops-notes-v2');
    } else {
      notes    = (d.notes    !== undefined ? d.notes    : d) || {};
      sessions = d.sessions || {};
      localStorage.setItem('ops-notes-v2', JSON.stringify({ notes, sessions }));
      localStorage.removeItem('ops-notes-v2-encrypted');
      encryptedStorageEnabled  = false;
      encryptedStoragePassword = null;
      updateEncryptedStorageUI();
    }
  } catch (outerErr) {
    // Only use localStorage fallback for genuine fetch/network failures,
    // not for password/decryption errors (those should bubble up as-is).
    if (outerErr.message && (outerErr.message.includes('decrypt') || outerErr.message.includes('Password') || outerErr.message.includes('Incorrect') || outerErr.message.includes('cancelled'))) {
      throw outerErr;
    }
    try {
      const encCached = localStorage.getItem('ops-notes-v2-encrypted');
      if (encCached) {
        const encObj = JSON.parse(encCached);
        if (encObj && encObj.encrypted === true) {
          encryptedStorageEnabled = true;
          updateEncryptedStorageUI();
          let pw;
          try {
            pw = await showPasswordPrompt({
              icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`, title: 'Workspace Locked',
              description: 'This workspace is encrypted. Enter your password to unlock.',
              label: 'Password', placeholder: 'Enter password…',
              submitLabel: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg> Unlock',
            });
          } catch { throw new Error('Password required'); }
          let plain;
          try {
            plain = await decryptPayload(encObj, pw);
          } catch {
            throw new Error('Incorrect password — decryption failed');
          }
          encryptedStoragePassword = pw;
          encryptedStorageHint     = encObj.hint || '';
          updateEncryptedStorageUI();
          const parsed = JSON.parse(plain);
          notes    = (parsed.notes !== undefined ? parsed.notes : parsed) || {};
          sessions = parsed.sessions || {};
        }
      }
      if (!encryptedStorageEnabled) {
        const cached = JSON.parse(localStorage.getItem('ops-notes-v2') || '{}');
        notes    = cached.notes    || {};
        sessions = cached.sessions || {};
      }
    } catch (innerErr) {
      if (innerErr.message && (innerErr.message.includes('decrypt') || innerErr.message.includes('Password') || innerErr.message.includes('Incorrect') || innerErr.message.includes('cancelled') || innerErr.message.includes('required'))) {
        throw innerErr;
      }
      notes = {}; sessions = {};
    }
  }
  // Restore last active session
  const savedSid = localStorage.getItem('ops-active-session');
  if (savedSid && sessions[savedSid]) activeSessionId = savedSid;
  else if (Object.keys(sessions).length) activeSessionId = Object.keys(sessions)[0];

  renderSessionSidebar();
  renderNotesList();
  document.getElementById('notes-count').textContent = Object.keys(notes).length || '—';

  // Restore active target for current session
  const sess = activeSessionId && sessions[activeSessionId];
  const targets = (sess && sess.targets) || [];
  const savedTgt = localStorage.getItem('ops-active-target');
  if (savedTgt && targets.find(t => t.id === savedTgt)) {
    activeTargetId = savedTgt;
  } else if (targets.length) {
    activeTargetId = targets[0].id;
    localStorage.setItem('ops-active-target', activeTargetId);
  }
  // Migrate old single-IP sessions: if no targets array but has target_ip, create one target
  if (sess && (!sess.targets || !sess.targets.length) && (sess.target_ip || sess.target_domain)) {
    const id = 'tgt_migrate_' + sess.id;
    sess.targets = [{ id, ip: sess.target_ip || '', domain: sess.target_domain || '', label: 'default' }];
    activeTargetId = id;
    localStorage.setItem('ops-active-target', id);
    saveNotes();
  }
  updateTargetSelector();
  renderSvcLogTable();
  renderPathTable();
  renderLootTable();
  updateSvcTabCounts();
}

function saveNotes() {
  const payload = { notes, sessions };
  if (encryptedStorageEnabled) {
    // ── Encrypted path — never write plaintext ──
    (async () => {
      try {
        if (!encryptedStoragePassword) return; // guard: no password in memory, skip silently
        const blob = await encryptPayload(JSON.stringify(payload), encryptedStoragePassword);
        if (encryptedStorageHint) blob.hint = encryptedStorageHint;
        // Cache encrypted blob in localStorage (no plaintext ever stored)
        localStorage.setItem('ops-notes-v2-encrypted', JSON.stringify(blob));
        localStorage.removeItem('ops-notes-v2'); // ensure no stale plaintext
        await fetch('/api/notes/save-encrypted', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blob }),
        });
      } catch(_) {}
    })();
  } else {
    // ── Plaintext path ──
    localStorage.setItem('ops-notes-v2', JSON.stringify(payload));
    localStorage.removeItem('ops-notes-v2-encrypted'); // ensure no stale enc blob
    fetch('/api/notes/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }
}


// ─── Session management ───
function renderSessionSidebar() {
  const dot    = document.getElementById('sessionDot');
  const name   = document.getElementById('sessionName');
  const target = document.getElementById('sessionTarget');
  const sess   = activeSessionId && sessions[activeSessionId];
  if (sess) {
    const status = sess.status || 'active';
    dot.className = 'session-active-dot ' + (status === 'active' ? 'live' : status);
    name.textContent   = sess.codename;
    const activeTgt = (sess.targets || []).find(t => t.id === activeTargetId) || (sess.targets || [])[0];
    if (activeTgt) {
      target.textContent = [activeTgt.ip, activeTgt.domain].filter(Boolean).join(' · ') || activeTgt.label || 'no target set';
    } else {
      target.textContent = '—';
    }
    target.style.color = '';
    // notes badge
    const badge = document.getElementById('sessionNotesBadge');
    if (badge) {
      const n = Object.values(notes).filter(nt => nt.session_id === activeSessionId).length;
      badge.textContent = n + ' note' + (n !== 1 ? 's' : '');
      badge.style.display = n > 0 ? '' : 'none';
    }
  } else {
    dot.className = 'session-active-dot';
    name.textContent   = 'No session';
    target.textContent = '— click to set';
    target.style.color = '';
    const badge = document.getElementById('sessionNotesBadge');
    if (badge) badge.style.display = 'none';
  }
}

function openSessionModal() {
  document.getElementById('newSessionName').value = '';
  renderSessionList();
  document.getElementById('sessionOverlay').classList.add('open');
  setTimeout(() => document.getElementById('newSessionName').focus(), 60);
}
function closeSessionModal() { document.getElementById('sessionOverlay').classList.remove('open'); }
function closeSessionModalIfOutside(e) { if (e.target === document.getElementById('sessionOverlay')) closeSessionModal(); }

function renderSessionList() {
  const list    = document.getElementById('sessionList');
  const entries = Object.values(sessions).sort((a,b) => (b.created||0) - (a.created||0));
  if (!entries.length) {
    list.innerHTML = '<div class="session-list-hdr" style="padding-top:4px">No sessions yet</div>';
    return;
  }
  const noteCount   = id => Object.values(notes).filter(n => n.session_id === id).length;
  const targetCount = id => (sessions[id]?.targets || []).length;
  const statusLabel = { active: 'Active', paused: 'Paused', complete: 'Complete' };
  list.innerHTML = '<div class="session-list-hdr">Existing sessions</div>' +
    entries.map(s => {
      const status  = s.status || 'active';
      const tCount  = targetCount(s.id);
      const tLabel  = tCount === 0 ? '<span style="color:var(--accent)">no targets</span>' : `${tCount} target${tCount !== 1 ? 's' : ''}`;
      return `
    <div class="session-list-item${s.id === activeSessionId ? ' active-session' : ''}${status === 'complete' ? ' status-complete' : ''}" onclick="switchSession('${s.id}')">
      <div class="session-list-item-name">${esc(s.codename)}</div>
      <div class="session-list-item-meta">${noteCount(s.id)} notes · ${tLabel} · ${new Date(s.created).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'2-digit'})}</div>
      <div class="session-list-item-bottom" onclick="event.stopPropagation()">
        <div class="session-item-actions">
          <div class="session-status-pill ${status}" onclick="toggleStatusDropdown(event,'${s.id}')">
            <span class="status-dot ${status}"></span>${statusLabel[status]}
          </div>
          <button class="session-item-export-btn" onclick="renameSession('${s.id}')" title="Rename session">${ICONS.edit}</button>
          <button class="session-item-export-btn" onclick="exportSessionFile('${s.id}')" title="Export as .session file">${ICONS.download} .session</button>
          <button class="session-item-export-btn" onclick="exportNotesMarkdown('${s.id}')" title="Export notes as markdown files">${ICONS.download} .md</button>
          <button class="session-item-export-btn" onclick="exportTimelineForSession('${s.id}')" title="Export timeline as markdown">${ICONS.download} timeline</button>
          <button class="session-delete-btn" onclick="deleteSession('${s.id}')" title="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
        </div>
      </div>
    </div>`}).join('');
}

function createSession() {
  const name = document.getElementById('newSessionName').value.trim();
  if (!name) { document.getElementById('newSessionName').focus(); return; }
  const id   = 'sess_' + Date.now();
  const sess = {
    id,
    codename: name,
    created:  Date.now(),
    targets:  [],
  };
  sessions[id] = sess;
  tlLog(id, { type: 'session_created', name: sess.codename });
  switchSession(id);
  saveNotes();
  renderSessionList();
  document.getElementById('newSessionName').value = '';
}

let _statusDropdownTarget = null;

function toggleStatusDropdown(e, sessId) {
  e.stopPropagation();
  const dd = document.getElementById('statusDropdown');
  const isOpen = dd.classList.contains('open') && _statusDropdownTarget === sessId;

  // Always close first
  dd.classList.remove('open');
  _statusDropdownTarget = null;

  if (isOpen) return; // toggle off

  // Position relative to the pill
  const pill = e.currentTarget;
  const rect = pill.getBoundingClientRect();
  dd.style.top  = (rect.bottom + 4) + 'px';
  dd.style.left = rect.left + 'px';
  _statusDropdownTarget = sessId;
  dd.classList.add('open');

  // Close on outside click
  setTimeout(() => {
    const handler = (ev) => {
      if (!ev.target.closest('#statusDropdown') && !ev.target.closest('.session-status-pill')) {
        dd.classList.remove('open');
        _statusDropdownTarget = null;
        document.removeEventListener('click', handler);
      }
    };
    document.addEventListener('click', handler);
  }, 0);
}

function applyStatusFromDropdown(status) {
  if (!_statusDropdownTarget) return;
  setSessionStatus(null, _statusDropdownTarget, status);
  document.getElementById('statusDropdown').classList.remove('open');
  _statusDropdownTarget = null;
}

// ── Timeline event logger ──────────────────────────────────────────────────
function tlLog(sessId, event) {
  if (!sessId || !sessions[sessId]) return;
  if (!sessions[sessId].events) sessions[sessId].events = [];
  sessions[sessId].events.push({ ts: Date.now(), ...event });
}

function setSessionStatus(e, sessId, status) {
  if (e) e.stopPropagation();
  if (!sessions[sessId]) return;
  const prev = sessions[sessId].status || 'active';
  sessions[sessId].status = status;
  tlLog(sessId, { type: 'status', from: prev, to: status });
  saveNotes();
  renderSessionList();
  if (sessId === activeSessionId) renderSessionSidebar();
  if (typeof renderTimeline === 'function' && typeof notesListViewMode !== 'undefined' && notesListViewMode === 'timeline') renderTimeline();
}

function switchSession(id) {
  activeSessionId = id;
  localStorage.setItem('ops-active-session', id);
  // Reset scope to session view when switching
  activeNoteScope = 'session';
  activeTargetFilter = null;
  activeNoteSearch = '';
  const searchEl = document.getElementById('noteSearchInput');
  if (searchEl) searchEl.value = '';
  document.querySelectorAll('.note-scope-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.scope === 'session'));
  // Restore last active target for this session
  const sess = sessions[id];
  const targets = (sess && sess.targets) || [];
  const savedTarget = localStorage.getItem('ops-active-target');
  if (savedTarget && targets.find(t => t.id === savedTarget)) {
    activeTargetId = savedTarget;
  } else if (targets.length) {
    activeTargetId = targets[0].id;
    localStorage.setItem('ops-active-target', activeTargetId);
  } else {
    activeTargetId = null;
  }
  renderSessionSidebar();
  renderSessionList();
  renderNotesList();
  updateTargetSelector();
  refreshCodeBlocks();
  updateSvcTabCounts();
}

async function deleteSession(id) {
  const sess  = sessions[id];
  const count = Object.values(notes).filter(n => n.session_id === id).length;
  const msg   = count
    ? `Delete session "${sess?.codename}"?\n\n${count} note${count>1?'s':''} will become unassigned.`
    : `Delete session "${sess?.codename}"?`;
  try { await showConfirmDialog({ icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`, title: 'Delete Session', bigIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`, description: msg, confirmLabel: 'Delete', danger: true }); }
  catch { return; }

  // Unassign notes rather than delete them
  Object.values(notes).forEach(n => {
    if (n.session_id === id) n.session_id = null;
  });

  delete sessions[id];
  if (activeSessionId === id) {
    activeSessionId = Object.keys(sessions)[0] || null;
    if (activeSessionId) localStorage.setItem('ops-active-session', activeSessionId);
    else localStorage.removeItem('ops-active-session');
  }
  saveNotes();
  renderSessionSidebar();
  renderSessionList();
  renderNotesList();
}

let _sessionRenameId = null;
let _sessionRenameResolve = null;
let _sessionRenameReject  = null;

function showSessionRenameModal(sess) {
  return new Promise((resolve, reject) => {
    _sessionRenameResolve = resolve;
    _sessionRenameReject  = reject;
    const input = document.getElementById('sessionRenameInput');
    input.value = sess.codename || '';
    const sri = document.getElementById('sessionRenameIcon'); if (sri) sri.innerHTML = ICONS.edit;
    document.getElementById('sessionRenameOverlay').classList.add('open');
    setTimeout(() => { input.focus(); input.select(); }, 40);
  });
}

function _sessionRenameSave() {
  const val = document.getElementById('sessionRenameInput').value.trim();
  if (!val) {
    const input = document.getElementById('sessionRenameInput');
    input.classList.add('error');
    input.focus();
    setTimeout(() => input.classList.remove('error'), 1200);
    return;
  }
  document.getElementById('sessionRenameOverlay').classList.remove('open');
  if (_sessionRenameResolve) _sessionRenameResolve(val);
  _sessionRenameResolve = _sessionRenameReject = null;
}

function _sessionRenameCancel() {
  document.getElementById('sessionRenameOverlay').classList.remove('open');
  if (_sessionRenameReject) _sessionRenameReject('cancelled');
  _sessionRenameResolve = _sessionRenameReject = null;
}

function _sessionRenameKey(e) {
  if (e.key === 'Enter')  _sessionRenameSave();
  if (e.key === 'Escape') _sessionRenameCancel();
}

async function renameSession(id) {
  const sess = sessions[id];
  if (!sess) return;
  let newName;
  try { newName = await showSessionRenameModal(sess); } catch { return; }
  if (newName === sess.codename) return;
  sess.codename = newName;
  saveNotes();
  renderSessionList();
  renderSessionSidebar();
}

function setNoteFilter(type, btn) {
  activeNoteFilter = type;
  document.querySelectorAll('.note-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderNotesList();
}

function setNoteScope(scope, btn) {
  activeNoteScope = scope;
  activeTargetFilter = null;
  activeNoteSearch = '';
  const si = document.getElementById('noteSearchInput'); if (si) si.value = '';
  document.querySelectorAll('.note-scope-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderNotesList();
}

function renderNotesList() {
  if (typeof notesListViewMode !== 'undefined' && notesListViewMode === 'timeline') {
    renderTimeline();
    document.getElementById('notes-count').textContent = Object.keys(notes).length || '—';
    renderTargetFilterBar();
    return;
  }
  const list = document.getElementById('notesList');
  let items = Object.values(notes).sort((a,b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (b.updated||0) - (a.updated||0);
  });

  // Scope filter
  if (activeNoteScope === 'session') {
    items = activeSessionId
      ? items.filter(n => n.session_id === activeSessionId)
      : items.filter(n => !n.session_id);
  } else if (activeNoteScope === 'unassigned') {
    items = items.filter(n => !n.session_id || !sessions[n.session_id]);
  }

  if (activeNoteFilter !== 'all') items = items.filter(n => n.type === activeNoteFilter);
  if (activeTagFilter) items = items.filter(n => (n.tags||[]).includes(activeTagFilter));
  if (activeTargetFilter) items = items.filter(n => n.target_id === activeTargetFilter);
  if (activeNoteSearch) {
    const q = activeNoteSearch.toLowerCase();
    items = items.filter(n =>
      (n.title||'').toLowerCase().includes(q) ||
      (n.body||'').toLowerCase().includes(q)
    );
  }

  if (!items.length) {
    list.innerHTML = `<div style="padding:20px 12px;font-size:11px;color:var(--muted);
      font-family:'Inter',sans-serif;text-align:center">
      ${activeNoteSearch ? 'No matching notes' : activeNoteFilter === 'all' ? 'No notes yet' : 'No ' + activeNoteFilter + ' notes'}
    </div>`;
    return;
  }

  list.innerHTML = items.map(n => {
    const meta = NOTE_TYPE_META[n.type] || NOTE_TYPE_META.general;
    const sess = n.session_id && sessions[n.session_id];
    const sessLabel = sess && sess.id !== activeSessionId ? `<div class="note-item-session">${esc(sess.codename)}</div>` : '';
    const tgt = n.target_id && activeSessionId && sessions[activeSessionId]
      ? (sessions[activeSessionId].targets||[]).find(t => t.id === n.target_id) : null;
    const tgtLabel = tgt ? `<div class="note-item-target">${ICONS.target} ${esc(tgt.ip||tgt.domain||tgt.label||'target')}</div>` : '';
    const tagsHtml = (n.tags||[]).length
      ? `<div class="note-item-tags">${(n.tags).map(t => `<span class="note-item-tag">#${esc(t)}</span>`).join('')}</div>`
      : '';
    return `<div class="note-item${n.id===activeNoteId?' active':''}" onclick="openNote('${n.id}')" data-id="${n.id}">
      <span class="note-item-type ${meta.cssClass}">${meta.icon} ${meta.label}</span>
      <div class="note-item-title">${esc(n.title||'Untitled')}${n.pinned ? '<span class="note-item-pin">' + ICONS.pin + '</span>' : ''}</div>
      <div class="note-item-preview">${esc((n.body||'').slice(0,50).replace(/\n/g,' '))}</div>
      ${tagsHtml}
      ${sessLabel}
      ${tgtLabel}
      <div class="note-item-date">${formatDate(n.updated)}</div>
    </div>`;
  }).join('');

  document.getElementById('notes-count').textContent = Object.keys(notes).length || '—';
  renderTargetFilterBar();
}

function onNoteSearch(val) {
  activeNoteSearch = val.trim();
  renderNotesList();
}

function exportCurrentNote() {
  if (!activeNoteId || !notes[activeNoteId]) return;
  const n = notes[activeNoteId];
  const lines = [
    '---',
    `title: ${n.title || 'Untitled'}`,
    `type: ${n.type || 'general'}`,
  ];
  if (n.tags && n.tags.length) lines.push(`tags: [${n.tags.join(', ')}]`);
  if (n.created) lines.push(`created: ${new Date(n.created).toISOString()}`);
  if (n.updated) lines.push(`updated: ${new Date(n.updated).toISOString()}`);
  lines.push('---', '', n.body || '');
  const filename = slugify(n.title || 'untitled') + '.md';
  downloadText(lines.join('\n'), filename);
  showToast('✓ Exported ' + filename);
}

function toggleCheckbox(el) {
  if (!activeNoteId || !notes[activeNoteId]) { el.checked = !el.checked; return; }
  const n = notes[activeNoteId];
  const body = n.body || '';
  const lines = body.split('\n');
  // Count which checkbox index this is in the preview
  const allBoxes = el.closest('.note-preview-content, .md-content')
    ? [...(el.closest('.note-preview-content, .md-content') || document).querySelectorAll('.task-checkbox')]
    : [];
  const idx = allBoxes.indexOf(el);
  if (idx === -1) return;
  // Find the idx-th checklist line in the source
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^[ \t]*[-*+] \[[ xX]\]/.test(lines[i])) {
      if (count === idx) {
        lines[i] = el.checked
          ? lines[i].replace(/\[ \]/, '[x]')
          : lines[i].replace(/\[[xX]\]/, '[ ]');
        break;
      }
      count++;
    }
  }
  const newBody = lines.join('\n');
  notes[activeNoteId].body = newBody;
  notes[activeNoteId].updated = Date.now();
  if (noteEditor) cmSetValue(noteEditor, newBody);
  autoSaveNote();
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short' }) + ' ' +
         d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
}

// New note type picker modal
function openNewNoteModal() {
  document.getElementById('newNoteOverlay').classList.add('open');
}
function closeNewNoteModal() {
  document.getElementById('newNoteOverlay').classList.remove('open');
}
function closeNewNoteModalIfOutside(e) {
  if (e.target === document.getElementById('newNoteOverlay')) closeNewNoteModal();
}

function newNote(type = 'general') {
  closeNewNoteModal();
  const tmpl = NOTE_TEMPLATES[type] || NOTE_TEMPLATES.general;
  const id   = 'note_' + Date.now();
  notes[id]  = {
    id,
    session_id:    activeSessionId || null,
    target_id:     activeTargetId || null,
    type,
    title:         tmpl.title || '',
    body:          tmpl.body  || '',
    tags:          tmpl.default_tags ? [...tmpl.default_tags] : [],
    target_ip:     getIP()     !== '<IP>'     ? getIP()     : null,
    target_domain: getDomain() !== '<DOMAIN>' ? getDomain() : null,
    created:       Date.now(),
    updated:       Date.now(),
  };
  saveNotes();
  if (activeSessionId) tlLog(activeSessionId, { type: 'note_created', noteId: id, noteType: type, targetId: activeTargetId || null });
  renderNotesList();
  renderSessionSidebar();
  openNote(id);
  // Focus title if blank, editor body if title pre-filled
  setTimeout(() => {
    if (tmpl.title) {
      document.getElementById('noteTitleInput').select();
    } else {
      document.getElementById('noteTitleInput').focus();
    }
  }, 50);
}

function duplicateCurrentNote() {
  if (!activeNoteId || !notes[activeNoteId]) return;
  const src = notes[activeNoteId];
  const id  = 'note_' + Date.now();
  notes[id] = {
    ...src,
    id,
    title:   src.title ? src.title + ' (copy)' : '',
    tags:    src.tags ? [...src.tags] : [],
    created: Date.now(),
    updated: Date.now(),
  };
  saveNotes();
  if (activeSessionId) tlLog(activeSessionId, { type: 'note_created', noteId: id, noteType: src.type, targetId: src.target_id || null });
  renderNotesList();
  renderSessionSidebar();
  openNote(id);
  showToast('Note duplicated');
}

function openNote(id) {
  activeNoteId = id;
  const n = notes[id];
  if (!n) return;

  document.getElementById('notesEmpty').style.display     = 'none';
  const area = document.getElementById('noteEditArea');
  area.style.display = 'flex';

  // Show type badge in editor header
  const meta = NOTE_TYPE_META[n.type] || NOTE_TYPE_META.general;
  let badge = document.getElementById('noteTypeBadge');
  if (!badge) {
    badge = document.createElement('span');
    badge.id = 'noteTypeBadge';
    badge.className = 'note-item-type';
    document.querySelector('.notes-editor-hdr').prepend(badge);
  }
  badge.textContent = meta.icon + ' ' + meta.label;
  badge.className = 'note-item-type ' + meta.cssClass;

  document.getElementById('noteTitleInput').value = n.title || '';
  // ── Timestamps ──
  const fmtTs = ts => ts ? new Date(ts).toLocaleString('en-GB', {
    day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
  const elCr = document.getElementById('noteCreatedAt');
  const elMo = document.getElementById('noteModifiedAt');
  if (elCr) elCr.textContent = fmtTs(n.created);
  if (elMo) elMo.textContent = fmtTs(n.updated);
  // ── Pin button state ──
  const pinBtn = document.getElementById('notePinBtn');
  if (pinBtn) { pinBtn.classList.toggle('pinned', !!n.pinned); pinBtn.title = n.pinned ? 'Unpin note' : 'Pin note'; }
  cmSetValue(noteEditor, n.body || '');
  renderNoteTags(n);
  updateReassignBtn(n);
  renderBacklinks(id);
  if (typeof updateTargetAssignBtn === 'function') updateTargetAssignBtn(notes[id]);
  document.getElementById('noteSaveStatus').textContent  = 'saved';
  document.getElementById('noteSaveStatus').className    = 'note-save-status saved';

  renderNotesList();
  // Keep timeline highlight in sync when a note is opened from timeline
  if (typeof notesListViewMode !== 'undefined' && notesListViewMode === 'timeline') {
    renderTimeline();
  }

  // Wire up auto-save
  document.getElementById('noteTitleInput').oninput = () => autoSaveNote();
  // noteEditor onChange wired in cmInit

  // Apply preview state and populate
  applyNotePreviewState();
}


// ═══════════════════════════════════════════════════════════
// PIN NOTES
// ═══════════════════════════════════════════════════════════
function togglePinNote() {
  if (!activeNoteId) return;
  notes[activeNoteId].pinned  = !notes[activeNoteId].pinned;
  notes[activeNoteId].updated = Date.now();
  const pinBtn = document.getElementById('notePinBtn');
  if (pinBtn) {
    pinBtn.classList.toggle('pinned', !!notes[activeNoteId].pinned);
    pinBtn.title = notes[activeNoteId].pinned ? 'Unpin note' : 'Pin note';
  }
  saveNotes();
  renderNotesList();
}

// ═══════════════════════════════════════════════════════════
// NOTE LINKING  [[Note Title]]
// ═══════════════════════════════════════════════════════════

// Resolve [[Title]] → note id (exact match first, then partial)
function resolveNoteLink(rawTitle) {
  const q = rawTitle.trim().toLowerCase();
  let hit = Object.values(notes).find(n => (n.title || '').toLowerCase() === q);
  if (!hit) hit = Object.values(notes).find(n => (n.title || '').toLowerCase().includes(q));
  return hit ? hit.id : null;
}

// Find all notes that contain [[...]] links pointing to noteId
function getBacklinks(noteId) {
  return Object.values(notes).filter(n => {
    if (n.id === noteId) return false;
    const body = n.body || '';
    const re = /\[\[([^\]]+)\]\]/g;
    let m;
    while ((m = re.exec(body)) !== null) {
      if (resolveNoteLink(m[1]) === noteId) return true;
    }
    return false;
  });
}

// Render backlinks panel under the editor
function renderBacklinks(noteId) {
  const panel = document.getElementById('noteBacklinks');
  const list  = document.getElementById('noteBacklinksList');
  if (!panel || !list) return;
  const links = getBacklinks(noteId);
  if (!links.length) { panel.style.display = 'none'; return; }
  panel.style.display = '';
  list.innerHTML = links.map(n => {
    const safeTitle = (n.title || 'Untitled').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return '<span class="note-backlink-chip" onclick="openNote(\'' + n.id + '\')" title="' + safeTitle + '">' + safeTitle + '</span>';
  }).join('');
}

function autoSaveNote() {
  if (!activeNoteId) return;
  document.getElementById('noteSaveStatus').textContent = '…saving';
  document.getElementById('noteSaveStatus').className   = 'note-save-status';
  clearTimeout(noteSaveTimer);
  noteSaveTimer = setTimeout(() => {
    notes[activeNoteId].title   = document.getElementById('noteTitleInput').value;
    notes[activeNoteId].body    = cmGetValue(noteEditor);
    // tags are saved directly in addNoteTag/removeNoteTag
    notes[activeNoteId].updated = Date.now();
    saveNotes();
    renderNotesList();
    renderSessionSidebar();
    if (activeNoteId) renderBacklinks(activeNoteId);
    document.getElementById('noteSaveStatus').textContent = 'saved';
    document.getElementById('noteSaveStatus').className   = 'note-save-status saved';
    // Update modified timestamp live
    const moEl = document.getElementById('noteModifiedAt');
    if (moEl) moEl.textContent = new Date(notes[activeNoteId].updated).toLocaleString('en-GB', {
      day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    updateNotePreview();
  }, 600);
}

// ── Note preview ──────────────────────────────────────────
let notePreviewOpen = localStorage.getItem('pragma-preview-open') === '1';

function updateNotePreview() {
  const pane = document.getElementById('notePreviewPane');
  if (!pane || pane.style.display === 'none') return;
  const md = noteEditor ? cmGetValue(noteEditor) : '';
  const el = document.getElementById('notePreviewContent');
  if (!el) return;
  el.innerHTML = marked ? marked.parse(md) : md.replace(/\n/g, '<br>');
  if (typeof wrapCodeBlocks   === 'function') wrapCodeBlocks(el);
  if (typeof wrapInlineCodes  === 'function') wrapInlineCodes(el);
  if (typeof makeCollapsible  === 'function') makeCollapsible(el);
  // preview only needs per-line copy, not the block-level copy button
  el.querySelectorAll('.copy-btn').forEach(b => b.style.display = 'none');
}

function toggleNotePreview() {
  notePreviewOpen = !notePreviewOpen;
  localStorage.setItem('pragma-preview-open', notePreviewOpen ? '1' : '0');
  applyNotePreviewState();
}


// ── Preview layout (vertical / side-by-side) ──
let previewLayout = localStorage.getItem('pragma-preview-layout') || 'vertical';

function setPreviewLayout(layout) {
  previewLayout = layout;
  localStorage.setItem('pragma-preview-layout', layout);
  applyPreviewLayout();
}

function applyPreviewLayout() {
  const split = document.getElementById('noteEditorSplit');
  const vertBtn = document.getElementById('layoutVertBtn');
  const sideBtn = document.getElementById('layoutSideBtn');
  if (!split) return;
  const isSide = previewLayout === 'side';
  split.classList.toggle('split-side', isSide);
  if (vertBtn) vertBtn.classList.toggle('active', !isSide);
  if (sideBtn) sideBtn.classList.toggle('active', isSide);

  // Re-init drag handle since direction changed
  const handle = document.getElementById('notePreviewHandle');
  if (handle) { handle._dragInited = false; initPreviewDragHandle(); }
}

function applyNotePreviewState() {
  const split  = document.getElementById('noteEditorSplit');
  const handle = document.getElementById('notePreviewHandle');
  const pane   = document.getElementById('notePreviewPane');
  const btn    = document.getElementById('notePreviewBtn');
  if (!split || !handle || !pane || !btn) return;

  const open = notePreviewOpen;
  split.classList.toggle('preview-open', open);
  handle.style.display = open ? '' : 'none';
  pane.style.display   = open ? 'flex' : 'none';
  btn.classList.toggle('active', open);
  btn.title = open ? 'Hide preview' : 'Toggle markdown preview';

  // Show/hide layout toggle
  const toggle = document.getElementById('previewLayoutToggle');
  if (toggle) toggle.classList.toggle('visible', open);

  if (open) {
    // Restore saved split position
    const saved = localStorage.getItem('pragma-preview-split');
    if (saved) split.style.setProperty('--note-editor-h', saved);
    applyPreviewLayout();
    updateNotePreview();
    initPreviewDragHandle();
  }
}

function initPreviewDragHandle() {
  const handle = document.getElementById('notePreviewHandle');
  const split  = document.getElementById('noteEditorSplit');
  if (!handle || handle._dragInited) return;
  handle._dragInited = true;

  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    handle.classList.add('dragging');
    const isSide    = split.classList.contains('split-side');
    const startPos  = isSide ? e.clientX : e.clientY;
    const splitRect = split.getBoundingClientRect();
    const prop      = isSide ? '--note-editor-w' : '--note-editor-h';
    const dim       = isSide ? splitRect.width : splitRect.height;
    const startPct  = parseFloat(getComputedStyle(split).getPropertyValue(prop)) || 50;

    const onMove = ev => {
      const delta  = (isSide ? ev.clientX : ev.clientY) - startPos;
      const newPct = Math.min(85, Math.max(15, startPct + (delta / dim) * 100));
      split.style.setProperty(prop, newPct + '%');
      localStorage.setItem('pragma-preview-split', newPct + '%');
    };
    const onUp = () => {
      handle.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

async function deleteCurrentNote() {
  if (!activeNoteId) return;
  try { await showConfirmDialog({ icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`, title: 'Delete Note', bigIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`, description: 'This note will be permanently deleted.', confirmLabel: 'Delete', danger: true }); }
  catch { return; }
  delete notes[activeNoteId];
  activeNoteId = null;
  saveNotes();
  renderNotesList();
  renderSessionSidebar();
  const total = Object.keys(notes).length;
  document.getElementById('notes-count').textContent = total || '—';
  document.getElementById('notesEmpty').style.display     = 'flex';
  document.getElementById('noteEditArea').style.display   = 'none';
}

// ═══════════════════════════════════════════════
// CONTENT PANEL EDIT MODE
// ═══════════════════════════════════════════════
let cpEditDirty = false;

function cpEditTabHandler(e) {
  if (e.key !== 'Tab') return;
  e.preventDefault();
  const ta = e.target;
  const s  = ta.selectionStart, end = ta.selectionEnd;
  ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(end);
  ta.selectionStart = ta.selectionEnd = s + 2;
  setCpEditStatus('unsaved', '● unsaved');
  cpEditDirty = true;
}

function setCpEditStatus(cls, msg) {
  const el = document.getElementById('cpEditStatus');
  el.className = 'cp-edit-status ' + cls;
  el.textContent = msg;
}

async function toggleEditMode() {
  const editBody = document.getElementById('cpEditBody');
  const isEditing = editBody.style.display !== 'none';
  if (isEditing) {
    if (cpEditDirty) {
      try { await showConfirmDialog({ icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`, title: 'Discard Changes', bigIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`, description: 'You have unsaved changes. Discard them?', confirmLabel: 'Discard', danger: true }); }
      catch { return; }
    }
    exitEditMode();
  } else {
    enterEditMode();
  }
}

function enterEditMode() {
  if (!activeDoc || !activeDoc.raw) return;
  document.getElementById('cpReadBody').style.display  = 'none';
  document.getElementById('cpEditBody').style.display  = 'flex';
  document.getElementById('cpEditBtn').classList.add('editing');
  document.getElementById('cpEditBtn').title = 'Exit edit mode';
  cmInitKb();
  cmSetValue(kbEditor, activeDoc.raw);
  cpEditDirty = false;
  setCpEditStatus('', activeDoc.meta || '');
  setTimeout(() => kbEditor && kbEditor.focus(), 30);
  // KB dirty tracking wired in cmInitKb
}

function exitEditMode() {
  document.getElementById('cpReadBody').style.display  = '';
  document.getElementById('cpEditBody').style.display  = 'none';
  document.getElementById('cpEditBtn').classList.remove('editing');
  document.getElementById('cpEditBtn').title = 'Edit file';
  cpEditDirty = false;
}

async function cancelEdit() {
  if (cpEditDirty) {
    try { await showConfirmDialog({ icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`, title: 'Discard Changes', bigIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`, description: 'You have unsaved changes. Discard them?', confirmLabel: 'Discard', danger: true }); }
    catch { return; }
  }
  exitEditMode();
}

async function saveEdit() {
  if (!activeDoc || !activeDoc.id || !activeDoc.view) return;
  const raw = cmGetValue(kbEditor);
  setCpEditStatus('', '⏳ Saving…');
  try {
    const r = await fetch('/api/kb/save', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id: activeDoc.id, view: activeDoc.view, content: raw }),
    });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || 'Save failed');

    // Update activeDoc raw + re-render preview in background
    activeDoc.raw = raw;
    cpEditDirty   = false;
    setCpEditStatus('saved', '✓ saved');

    // Re-render the read view with updated content so it's fresh when you exit
    try {
      const endpoint = activeDoc.view === 'services'
        ? `/api/service/${encodeURIComponent(activeDoc.id)}`
        : `/api/methodology/${encodeURIComponent(activeDoc.id)}`;
      const r2 = await fetch(endpoint);
      const d2 = await r2.json();
      activeDoc.html = d2.html;
      activeDoc.raw  = d2.raw;
      document.getElementById('cpContent').innerHTML = injectTargets(d2.html);
      wrapCodeBlocks(document.getElementById('cpContent'));
      wrapInlineCodes(document.getElementById('cpContent'));
    } catch(_) {}

    setTimeout(() => { if (!cpEditDirty) setCpEditStatus('', activeDoc.meta || ''); }, 2000);
  } catch(e) {
    setCpEditStatus('unsaved', '✗ ' + e.message);
  }
}

// ═══════════════════════════════════════════════
// TAGS
// ═══════════════════════════════════════════════
function getAllTags() {
  const set = new Set();
  Object.values(notes).forEach(n => (n.tags||[]).forEach(t => set.add(t)));
  return [...set].sort();
}

function renderNoteTags(n) {
  const row   = document.getElementById('noteTagsRow');
  const input = document.getElementById('noteTagInput');
  // Remove existing tag pills (keep the input)
  row.querySelectorAll('.note-tag').forEach(el => el.remove());
  (n.tags || []).forEach(tag => {
    const pill = document.createElement('span');
    pill.className = 'note-tag';
    pill.innerHTML = '#' + esc(tag) + '<span class="note-tag-del" onclick="removeNoteTag(\'' + esc(tag) + '\')">×</span>';
    row.insertBefore(pill, input);
  });
}

function noteTagKeydown(e) {
  if (e.key !== 'Enter' && e.key !== ',') return;
  e.preventDefault();
  const raw = e.target.value.trim().replace(/^#/, '').replace(/[,\s]+/g, '-').toLowerCase();
  if (!raw || !activeNoteId) return;
  const n = notes[activeNoteId];
  if (!n.tags) n.tags = [];
  if (!n.tags.includes(raw)) {
    n.tags.push(raw);
    notes[activeNoteId].updated = Date.now();
    saveNotes();
    renderNoteTags(n);
    renderNotesList();
    renderTagFilterSidebar();
  }
  e.target.value = '';
}

function removeNoteTag(tag) {
  if (!activeNoteId) return;
  const n = notes[activeNoteId];
  n.tags = (n.tags||[]).filter(t => t !== tag);
  n.updated = Date.now();
  saveNotes();
  renderNoteTags(n);
  renderNotesList();
  renderTagFilterSidebar();
  if (activeTagFilter === tag) { activeTagFilter = null; renderNotesList(); }
}

function setTagFilter(tag) {
  activeTagFilter = activeTagFilter === tag ? null : tag;
  renderTagFilterSidebar();
  renderNotesList();
}

function renderTagFilterSidebar() {
  const list = document.getElementById('tagFilterList');
  const tags = getAllTags();
  if (!tags.length) { list.innerHTML = '<span style="font-size:13px;color:var(--muted);font-family:JetBrains Mono,monospace">No tags yet</span>'; return; }
  list.innerHTML = tags.map(t =>
    `<span class="tag-filter-chip${activeTagFilter===t?' active':''}" onclick="setTagFilter('${esc(t)}')">#${esc(t)}</span>`
  ).join('');
}


// ═══════════════════════════════════════════════
// CODEMIRROR 6 EDITORS
// ═══════════════════════════════════════════════
let noteEditor = null;
let kbEditor   = null;

function cmGetValue(editor) {
  return editor ? editor.state.doc.toString() : '';
}

function cmSetValue(editor, value) {
  if (!editor) return;
  editor.dispatch({
    changes: { from: 0, to: editor.state.doc.length, insert: value || '' }
  });
}

/* ── Syntax highlight themes ── */
const SYNTAX_THEMES = {
  monokai: (dark) => [
    { tag: CM.tags.heading1,              color: '#f92672', fontWeight: '700' },
    { tag: CM.tags.heading2,              color: '#f92672', fontWeight: '600' },
    { tag: CM.tags.heading3,              color: '#fd971f', fontWeight: '600' },
    { tag: [CM.tags.heading4, CM.tags.heading5, CM.tags.heading6], color: '#fd971f' },
    { tag: CM.tags.strong,                color: '#fd971f', fontWeight: '700' },
    { tag: CM.tags.emphasis,              color: '#a6e22e', fontStyle: 'italic' },
    { tag: CM.tags.strikethrough,         color: '#75715e', textDecoration: 'line-through' },
    { tag: [CM.tags.link, CM.tags.url],   color: '#66d9e8' },
    { tag: CM.tags.monospace,             color: '#ae81ff' },
    { tag: [CM.tags.quote, CM.tags.comment, CM.tags.meta], color: '#75715e', fontStyle: 'italic' },
    { tag: CM.tags.punctuation,           color: dark ? '#555566' : '#aaaacc' },
    { tag: [CM.tags.atom, CM.tags.processingInstruction, CM.tags.number, CM.tags.bool, CM.tags.null], color: '#ae81ff' },
    { tag: [CM.tags.keyword, CM.tags.operator], color: '#f92672' },
    { tag: CM.tags.string,                color: '#e6db74' },
  ],
  nord: (dark) => [
    { tag: CM.tags.heading1,              color: '#bf616a', fontWeight: '700' },
    { tag: CM.tags.heading2,              color: '#d08770', fontWeight: '600' },
    { tag: CM.tags.heading3,              color: '#ebcb8b', fontWeight: '600' },
    { tag: [CM.tags.heading4, CM.tags.heading5, CM.tags.heading6], color: '#ebcb8b' },
    { tag: CM.tags.strong,                color: '#d08770', fontWeight: '700' },
    { tag: CM.tags.emphasis,              color: '#a3be8c', fontStyle: 'italic' },
    { tag: CM.tags.strikethrough,         color: '#4c566a', textDecoration: 'line-through' },
    { tag: [CM.tags.link, CM.tags.url],   color: '#88c0d0' },
    { tag: CM.tags.monospace,             color: '#b48ead' },
    { tag: [CM.tags.quote, CM.tags.comment, CM.tags.meta], color: '#616e88', fontStyle: 'italic' },
    { tag: CM.tags.punctuation,           color: dark ? '#4c566a' : '#9aa0b0' },
    { tag: [CM.tags.atom, CM.tags.processingInstruction, CM.tags.number, CM.tags.bool, CM.tags.null], color: '#b48ead' },
    { tag: [CM.tags.keyword, CM.tags.operator], color: '#81a1c1' },
    { tag: CM.tags.string,                color: '#a3be8c' },
  ],
  solarized: (dark) => [
    { tag: CM.tags.heading1,              color: '#dc322f', fontWeight: '700' },
    { tag: CM.tags.heading2,              color: '#cb4b16', fontWeight: '600' },
    { tag: CM.tags.heading3,              color: '#b58900', fontWeight: '600' },
    { tag: [CM.tags.heading4, CM.tags.heading5, CM.tags.heading6], color: '#b58900' },
    { tag: CM.tags.strong,                color: '#cb4b16', fontWeight: '700' },
    { tag: CM.tags.emphasis,              color: '#2aa198', fontStyle: 'italic' },
    { tag: CM.tags.strikethrough,         color: '#586e75', textDecoration: 'line-through' },
    { tag: [CM.tags.link, CM.tags.url],   color: '#268bd2' },
    { tag: CM.tags.monospace,             color: '#6c71c4' },
    { tag: [CM.tags.quote, CM.tags.comment, CM.tags.meta], color: '#586e75', fontStyle: 'italic' },
    { tag: CM.tags.punctuation,           color: dark ? '#586e75' : '#839496' },
    { tag: [CM.tags.atom, CM.tags.processingInstruction, CM.tags.number, CM.tags.bool, CM.tags.null], color: '#6c71c4' },
    { tag: [CM.tags.keyword, CM.tags.operator], color: '#859900' },
    { tag: CM.tags.string,                color: '#2aa198' },
  ],
};

let activeSyntaxTheme = localStorage.getItem('pragma-syntax-theme') || 'monokai';

function setSyntaxTheme(name) {
  activeSyntaxTheme = name;
  localStorage.setItem('pragma-syntax-theme', name);
  document.querySelectorAll('.syntax-dot').forEach(d =>
    d.classList.toggle('active', d.dataset.theme === name));

  // Capture current content BEFORE destroying editors
  const noteContent = noteEditor ? cmGetValue(noteEditor) : null;
  const kbContent   = kbEditor   ? cmGetValue(kbEditor)   : null;

  // Rebuild with new theme, passing saved content so doc is never empty
  if (typeof cmInitNote === 'function') cmInitNote(noteContent);
  if (typeof cmInitKb   === 'function') cmInitKb(kbContent);
}

function initSyntaxThemePicker() {
  document.querySelectorAll('.syntax-dot').forEach(d =>
    d.classList.toggle('active', d.dataset.theme === activeSyntaxTheme));
}

function cmThemeVars() {
  // Read CSS vars at runtime so theme matches dark/light mode
  const s = getComputedStyle(document.documentElement);
  const bg    = s.getPropertyValue('--bg').trim()    || '#1a1a1f';
  const text  = s.getPropertyValue('--text').trim()  || '#e2e8f0';
  const text2 = s.getPropertyValue('--text2').trim() || '#94a3b8';
  const muted = s.getPropertyValue('--muted').trim() || '#4a5568';
  const bg3   = s.getPropertyValue('--bg3').trim()   || '#26262f';
  return { bg, text, text2, muted, bg3 };
}

function buildCmTheme() {
  if (!window.CM) return [];
  const v    = cmThemeVars();
  const dark = !document.documentElement.classList.contains('light');

  const editorTheme = CM.EditorView.theme({
    '&':                          { background: 'transparent', height: '100%' },
    '.cm-content':                { color: v.text2, caretColor: v.text, padding: '0' },
    '.cm-cursor':                 { borderLeftColor: v.text },
    '.cm-selectionBackground, ::selection': { background: 'rgba(124,58,237,0.25) !important' },
    '.cm-activeLine':             { background: 'rgba(124,58,237,0.06)' },
    '.cm-gutters':                { display: 'none' },
    '.cm-placeholder':            { color: v.muted },
    '.cm-line':                   { padding: '0' },
  }, { dark });

  const highlightStyle = CM.HighlightStyle.define(SYNTAX_THEMES[activeSyntaxTheme]?.(dark) || SYNTAX_THEMES.monokai(dark));

  return [editorTheme, CM.syntaxHighlighting(highlightStyle)];
}

function cmInitNote(initialDoc) {
  const wrap = document.getElementById('noteBodyWrap');
  if (!wrap || !CM) return;
  if (noteEditor) { noteEditor.destroy(); }

  noteEditor = new CM.EditorView({
    doc: initialDoc ?? '',
    extensions: [
      CM.basicSetup,
      CM.markdown(),
      ...buildCmTheme(),
      CM.EditorView.updateListener.of(update => {
        if (update.docChanged && activeNoteId) {
          autoSaveNote();
          updateNotePreview();
        }
      }),
      CM.EditorView.lineWrapping,
      CM.indentUnit.of('  '),
      CM.keymap.of([CM.indentWithTab])
    ],
    parent: wrap,
  });
}

function cmInitKb(initialDoc) {
  const wrap = document.getElementById('cpEditWrap');
  if (!wrap || !CM) return;
  if (kbEditor) { kbEditor.destroy(); }

  kbEditor = new CM.EditorView({
    doc: initialDoc ?? '',
    extensions: [
      CM.basicSetup,
      CM.markdown(),
      ...buildCmTheme(),
      CM.EditorView.updateListener.of(update => {
        if (update.docChanged) {
          if (!cpEditDirty) { cpEditDirty = true; setCpEditStatus('unsaved', '● unsaved'); }
        }
      }),
      CM.EditorView.lineWrapping,
      CM.indentUnit.of('  '),
      CM.keymap.of([CM.indentWithTab])
    ],
    parent: wrap,
  });
}

// Reinit editors on theme toggle to pick up new CSS vars
const _origToggleTheme = typeof toggleTheme === 'function' ? toggleTheme : null;


// ═══════════════════════════════════════════════
// CUSTOM MODAL ENGINE
// Replaces window.prompt / window.confirm
// All functions return Promises for async/await use
// ═══════════════════════════════════════════════
let _pwResolve = null;
let _pwReject  = null;

function pwCancel() {
  _closePwModal();
  if (_pwReject) _pwReject(new Error('cancelled'));
  _pwResolve = null; _pwReject = null;
}

function _closePwModal() {
  const ov = document.getElementById('pwOverlay');
  if (ov) ov.classList.remove('open');
}

// Close on backdrop click
document.addEventListener('click', e => {
  const ov = document.getElementById('pwOverlay');
  if (ov && ov.classList.contains('open') && e.target === ov) pwCancel();
});

// ── showPasswordPrompt(options) → Promise<string>
// options: { title, icon, description, label, placeholder, confirm: bool, confirmLabel }
function showPasswordPrompt(opts = {}) {
  return new Promise((resolve, reject) => {
    _pwResolve = resolve;
    _pwReject  = reject;

    const pwi = document.getElementById('pwIcon'); if(pwi) pwi.innerHTML = opts.icon || '';
    document.getElementById('pwTitle').textContent = opts.title || 'Enter Password';

    const body = document.getElementById('pwBody');
    const confirmField = opts.confirm ? `
      <div class="pw-field">
        <label>Confirm Password</label>
        <div class="pw-input-wrap">
          <input class="pw-input" id="pwInput2" type="password"
            placeholder="Re-enter password…" autocomplete="new-password"
            oninput="_pwCheckStrength()" onkeydown="_pwKey(event)">
          <button class="pw-toggle-vis" type="button" onclick="_pwToggleVis('pwInput2')" tabindex="-1"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
        </div>
      </div>` : '';

    const strengthMeter = opts.confirm ? `
      <div class="pw-strength" id="pwStrength">
        <div class="pw-strength-bar" id="pwBar1"></div>
        <div class="pw-strength-bar" id="pwBar2"></div>
        <div class="pw-strength-bar" id="pwBar3"></div>
        <div class="pw-strength-bar" id="pwBar4"></div>
      </div>` : '';

    const hintField = opts.hint ? `
      <div class="pw-field" style="margin-top:4px">
        <label style="color:var(--muted)">Password Hint <span style="font-weight:400;font-size:10px">(optional — stored in plain text)</span></label>
        <input class="pw-input" id="pwHintInput" type="text"
          placeholder="e.g. favourite phrase, year, symbol…"
          autocomplete="off" style="font-size:12px">
      </div>` : '';

    body.innerHTML = `
      ${opts.description ? `<div class="pw-description">${opts.description}</div>` : ''}
      <div class="pw-field">
        <label>${opts.label || 'Password'}</label>
        <div class="pw-input-wrap">
          <input class="pw-input" id="pwInput1" type="password"
            placeholder="${opts.placeholder || 'Enter password…'}"
            autocomplete="${opts.confirm ? 'new-password' : 'current-password'}"
            oninput="${opts.confirm ? '_pwCheckStrength()' : ''}"
            onkeydown="_pwKey(event)">
          <button class="pw-toggle-vis" type="button" onclick="_pwToggleVis('pwInput1')" tabindex="-1"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
        </div>
        ${strengthMeter}
      </div>
      ${confirmField}
      ${hintField}
      <div class="pw-error-msg" id="pwError"></div>
      <div class="pw-actions">
        <button class="pw-btn secondary" onclick="pwCancel()">Cancel</button>
        <button class="pw-btn primary" id="pwSubmitBtn"
          onclick="_pwSubmit(${opts.confirm ? 'true' : 'false'})">
          ${opts.submitLabel || (opts.confirm ? '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Enable Encryption' : 'Unlock')}
        </button>
      </div>`;

    document.getElementById('pwOverlay').classList.add('open');
    setTimeout(() => document.getElementById('pwInput1')?.focus(), 40);
  });
}

// ── showConfirmDialog(options) → Promise<void>  (resolves on confirm, rejects on cancel)
function showConfirmDialog(opts = {}) {
  return new Promise((resolve, reject) => {
    _pwResolve = resolve;
    _pwReject  = reject;

    const pwi2 = document.getElementById('pwIcon'); if(pwi2){ pwi2.innerHTML = opts.icon || ''; }
    document.getElementById('pwTitle').textContent = opts.title || 'Confirm';

    const body = document.getElementById('pwBody');
    body.innerHTML = `
      <div class="pw-confirm-icon">${opts.bigIcon || opts.icon || ''}</div>
      <div class="pw-description">${opts.description || 'Are you sure?'}</div>
      <div class="pw-actions">
        <button class="pw-btn secondary" onclick="pwCancel()">${opts.cancelLabel || 'Cancel'}</button>
        <button class="pw-btn ${opts.danger ? 'danger' : 'primary'}"
          onclick="_pwConfirmOk()">${opts.confirmLabel || 'Confirm'}</button>
      </div>`;

    document.getElementById('pwOverlay').classList.add('open');
    // Focus the confirm button (safer UX — avoids accidental Enter confirm)
    setTimeout(() => body.querySelector('.pw-btn.primary, .pw-btn.danger')?.focus(), 40);
  });
}

function _pwConfirmOk() {
  _closePwModal();
  if (_pwResolve) _pwResolve(true);
  _pwResolve = null; _pwReject = null;
}

function _pwSubmit(requireConfirm) {
  const v1 = document.getElementById('pwInput1')?.value || '';
  const v2 = document.getElementById('pwInput2')?.value || '';
  const err = document.getElementById('pwError');

  if (!v1) {
    err.textContent = 'Password cannot be empty.';
    err.classList.add('visible');
    document.getElementById('pwInput1').classList.add('error');
    document.getElementById('pwInput1').focus();
    return;
  }

  if (requireConfirm) {
    if (v1 !== v2) {
      err.textContent = 'Passwords do not match.';
      err.classList.add('visible');
      document.getElementById('pwInput2').classList.add('error');
      document.getElementById('pwInput2').focus();
      return;
    }
    if (v1.length < 8) {
      err.textContent = 'Password must be at least 8 characters.';
      err.classList.add('visible');
      document.getElementById('pwInput1').classList.add('error');
      document.getElementById('pwInput1').focus();
      return;
    }
  }

  _closePwModal();
  const pw        = v1;
  const hintEl    = document.getElementById('pwHintInput');
  const hint      = hintEl ? hintEl.value.trim() : null;
  // If the hint field was shown (opts.hint was set), always resolve with an object
  // so the caller reliably gets { password, hint } — even if hint is empty string
  if (_pwResolve) _pwResolve(hintEl !== null ? { password: pw, hint: hint || '' } : pw);
  _pwResolve = null; _pwReject = null;
}

function _pwKey(e) {
  if (e.key === 'Escape') { pwCancel(); return; }
  if (e.key === 'Enter') {
    const confirmMode = !!document.getElementById('pwInput2');
    _pwSubmit(confirmMode);
  }
}

function _pwToggleVis(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

function _pwCheckStrength() {
  const pw = document.getElementById('pwInput1')?.value || '';
  const bars = [
    document.getElementById('pwBar1'),
    document.getElementById('pwBar2'),
    document.getElementById('pwBar3'),
    document.getElementById('pwBar4'),
  ];
  if (!bars[0]) return;

  let score = 0;
  if (pw.length >= 8)                                        score++; // minimum length
  if (pw.length >= 14)                                       score++; // good length
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw))                 score++; // mixed case
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw))         score++; // number + symbol

  // Long passphrases (20+) with any complexity hit perfect directly
  if (pw.length >= 20 && score >= 2) score = 4;

  const cls = score <= 1 ? 'weak' : score === 2 ? 'medium' : score === 3 ? 'strong' : 'perfect';
  bars.forEach((b, i) => {
    b.className = 'pw-strength-bar' + (i < score ? ' ' + cls : '');
  });
}

// ═══════════════════════════════════════════════
// SESSION ENCRYPTION (AES-256-GCM + PBKDF2-SHA-512)
// ═══════════════════════════════════════════════
// Format v2: 600k PBKDF2-SHA-512 iterations, 32-byte salt, AES-256-GCM
// Format v1: 310k PBKDF2-SHA-256, 16-byte salt — read-only legacy support
//
// Note: AES-GCM provides built-in authenticated encryption via the GHASH tag.
// Any tampering with ciphertext, IV, or AAD causes decrypt to throw — no
// separate HMAC is required on top of GCM. The pragma_version field gates
// which key derivation parameters are used on decrypt.

const PBKDF2_ITERATIONS_V2 = 600000; // NIST SP 800-132 (2023) recommendation
const PBKDF2_ITERATIONS_V1 = 310000; // legacy — kept for reading old blobs

async function deriveKey(password, salt, version = 2) {
  const enc    = new TextEncoder();
  const keyMat = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name:       'PBKDF2',
      salt,
      iterations: version >= 2 ? PBKDF2_ITERATIONS_V2 : PBKDF2_ITERATIONS_V1,
      hash:       version >= 2 ? 'SHA-512' : 'SHA-256',  // SHA-512 harder on GPUs
    },
    keyMat,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptPayload(plaintext, password) {
  const salt = crypto.getRandomValues(new Uint8Array(32)); // 32-byte salt (v2)
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const key  = await deriveKey(password, salt, 2);
  const enc  = new TextEncoder();
  const ct   = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  const b64  = arr => btoa(String.fromCharCode(...new Uint8Array(arr)));
  return { pragma_version: 2, encrypted: true, salt: b64(salt), iv: b64(iv), data: b64(ct) };
}

async function decryptPayload(obj, password) {
  const b64d   = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const salt   = b64d(obj.salt);
  const iv     = b64d(obj.iv);
  const ct     = b64d(obj.data);
  // Detect format version — v1 blobs have pragma_version: 1 or missing
  const version = (obj.pragma_version >= 2) ? 2 : 1;
  const key    = await deriveKey(password, salt, version);
  const dec    = new TextDecoder();
  try {
    // GCM auth tag mismatch throws here if password wrong or data tampered
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return dec.decode(plain);
  } catch {
    throw new Error('Wrong password or corrupted data');
  }
}

// ═══════════════════════════════════════════════
async function importSession(event) {
  const file = event.target.files[0];
  if (!file) return;
  const fb = document.getElementById('importFeedback');
  fb.style.display = 'block';
  fb.className = 'import-feedback';
  fb.textContent = '⏳ Importing…';

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      let parsed = JSON.parse(e.target.result);

      // ── Decrypt if needed ──
      if (parsed.encrypted === true) {
        let password;
        try {
          password = await showPasswordPrompt({
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`, title: 'Encrypted Workbench',
            description: 'This .session file is encrypted. Enter the password used when it was exported.',
            label: 'Password', placeholder: 'Enter password…',
            submitLabel: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg> Decrypt & Import',
          });
        } catch { fb.style.display = 'none'; event.target.value = ''; return; }
        try {
          const plain = await decryptPayload(parsed, password);
          parsed = JSON.parse(plain);
        } catch(decErr) {
          fb.className = 'import-feedback err';
          fb.textContent = '✗ ' + decErr.message;
          event.target.value = '';
          return;
        }
      }

      const data = parsed;
      if (!data.session || !data.notes) throw new Error('Invalid .session file');

      // Create new session with new ID to avoid collisions
      const newSessId = 'sess_' + Date.now();
      const importedSess = {
        ...data.session,
        id:      newSessId,
        created: data.session.created || Date.now(),
        imported_from: data.session.codename,
      };

      sessions[newSessId] = importedSess;

      // Re-attach notes with new session ID and new note IDs
      let noteCount = 0;
      data.notes.forEach(n => {
        const newNoteId = 'note_' + Date.now() + '_' + (noteCount++);
        notes[newNoteId] = {
          ...n,
          id:         newNoteId,
          session_id: newSessId,
        };
      });

      saveNotes();
      switchSession(newSessId);
      renderSessionList();

      fb.className = 'import-feedback ok';
      fb.textContent = '✓ Imported "' + importedSess.codename + '" — ' + noteCount + ' note' + (noteCount !== 1 ? 's' : '');
      setTimeout(() => { fb.style.display = 'none'; }, 4000);
    } catch(err) {
      fb.className = 'import-feedback err';
      fb.textContent = '✗ ' + err.message;
    }
    // Reset file input so same file can be re-imported
    event.target.value = '';
  };
  reader.readAsText(file);
}

// ═══════════════════════════════════════════════
// NOTE REASSIGN
// ═══════════════════════════════════════════════
function toggleReassignDropdown() {
  const dd = document.getElementById('noteReassignDropdown');
  if (dd.classList.contains('open')) {
    dd.classList.remove('open');
    return;
  }
  renderReassignDropdown();
  dd.classList.add('open');
  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', closeReassignOnOutside, { once: true });
  }, 0);
}

function closeReassignOnOutside(e) {
  const dd = document.getElementById('noteReassignDropdown');
  if (dd && !dd.contains(e.target)) dd.classList.remove('open');
}

function renderReassignDropdown() {
  const dd   = document.getElementById('noteReassignDropdown');
  const note = activeNoteId && notes[activeNoteId];
  if (!note) return;

  const sessList = Object.values(sessions).sort((a,b) => (b.created||0) - (a.created||0));
  let html = '';

  // Unassign option
  if (note.session_id) {
    html += `<div class="note-reassign-option unassign" onclick="reassignNote(null)">— Unassign</div>`;
  }

  sessList.forEach(s => {
    const isCurrent = s.id === note.session_id;
    html += `<div class="note-reassign-option${isCurrent ? ' current' : ''}" onclick="reassignNote('${s.id}')">
      ${isCurrent ? '✓ ' : ''}${esc(s.codename)}
    </div>`;
  });

  if (!sessList.length) html = '<div class="note-reassign-option unassign">No sessions yet</div>';
  dd.innerHTML = html;
}

function reassignNote(sessionId) {
  if (!activeNoteId) return;
  const note = notes[activeNoteId];
  note.session_id = sessionId || null;
  note.updated    = Date.now();
  saveNotes();
  updateReassignBtn(note);
  document.getElementById('noteReassignDropdown').classList.remove('open');
  renderNotesList();
}

function updateReassignBtn(note) {
  const btn  = document.getElementById('noteReassignBtn');
  if (!btn) return;
  const sess = note.session_id && sessions[note.session_id];
  if (sess) {
    btn.textContent = '⎘ ' + sess.codename;
    btn.classList.add('assigned');
  } else {
    btn.textContent = '⎘ unassigned';
    btn.classList.remove('assigned');
  }
}

function openShortcutsModal() {
  document.getElementById('shortcutsOverlay').classList.add('open');
}
function closeShortcutsModal() {
  document.getElementById('shortcutsOverlay').classList.remove('open');
}

// ═══════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════
// Full shortcut reference:
//   ⌘/Ctrl + K        — Command palette
//   ⌘/Ctrl + N        — New note
//   ⌘/Ctrl + S        — Save current note (force)
//   ⌘/Ctrl + F        — Jump to search view
//   ⌘/Ctrl + 1-5      — Switch views (services/guides/notes/search)
//   ⌘/Ctrl + E        — Edit current KB file (if content panel open)
//   ESC               — Close topmost modal / panel / dropdown

document.addEventListener('keydown', async e => {
  const ctrl = e.metaKey || e.ctrlKey;

  // ── ⌘B — Toggle sidebar ──
  if (ctrl && e.key === 'b') { e.preventDefault(); toggleSidebar(); return; }

  // ── ⌘K — Command palette ──
  if (ctrl && e.key === 'k') {
    e.preventDefault(); openCmd(); return;
  }

  // ── ⌘N — New note ──
  if (ctrl && e.key === 'n') {
    e.preventDefault();
    switchView('notes', document.getElementById('nav-notes'));
    openNewNoteModal();
    return;
  }

  // ── ⌘S — Save current note ──
  if (ctrl && e.key === 's') {
    if (activeNoteId) {
      e.preventDefault();
      autoSaveNote();
      const status = document.getElementById('noteSaveStatus');
      if (status) { status.textContent = '✓ saved'; setTimeout(() => status.textContent = 'saved', 1500); }
    }
    return;
  }

  // ── ⌘F — Search ──
  if (ctrl && e.key === 'f') {
    // Only intercept if not in a text input already
    if (document.activeElement.tagName !== 'TEXTAREA' &&
        document.activeElement.id     !== 'noteBody' &&
        document.activeElement.id     !== 'noteTitleInput') {
      e.preventDefault();
      switchView('search', document.getElementById('nav-search'));
      setTimeout(() => document.getElementById('searchInput')?.focus(), 50);
      return;
    }
  }

  // ── ⌘1-5 — Switch views ──
  if (ctrl && ['1','2','3','4','5'].includes(e.key)) {
    e.preventDefault();
    const viewMap = {
      '1': ['notes',         'nav-notes'],
      '2': ['services',      'nav-services'],
      '3': ['methodologies', 'nav-methodologies'],
      '4': ['search',        'nav-search'],
    };
    const v = viewMap[e.key];
    if (v) switchView(v[0], document.getElementById(v[1]));
    return;
  }

  // ── ⌘E — Toggle edit mode on open KB file ──
  if (ctrl && e.key === 'e') {
    const cp = document.getElementById('contentPanel');
    if (cp && !cp.classList.contains('hidden-panel') && activeDoc?.isLocal) {
      e.preventDefault();
      toggleEditMode();
      return;
    }
  }

  // ── Ctrl+L — Toggle Quick Log popover ──
  if (ctrl && e.key === 'l') {
    e.preventDefault();
    toggleSvcPopover();
    return;
  }

  // ── Arrow Left/Right — cycle Quick Log tabs when popover is open ──
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    const popover = document.getElementById('svcPopover');
    if (popover && popover.classList.contains('open')) {
      const focused = document.activeElement;
      const inInput = focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA');
      if (!inInput) {
        e.preventDefault();
        switchSvcTabByArrow(e.key === 'ArrowRight' ? 1 : -1);
        return;
      }
    }
  }

  // ── Alt+T — Toggle Timeline view (switches to Notes first if needed) ──
  if (e.altKey && e.key === 't') {
    e.preventDefault();
    if (activeView !== 'notes') {
      switchView('notes', document.getElementById('nav-notes'));
      // Small delay to let the view render before toggling timeline
      setTimeout(() => {
        const btn = document.getElementById('notesViewTimelineBtn');
        if (notesListViewMode !== 'timeline') setNotesListView('timeline', btn);
      }, 30);
    } else {
      // Already on notes — toggle between timeline and list
      if (notesListViewMode === 'timeline') {
        setNotesListView('list', document.getElementById('notesViewListBtn'));
      } else {
        setNotesListView('timeline', document.getElementById('notesViewTimelineBtn'));
      }
    }
    return;
  }

  // ── Ctrl+. — Open target selector ──
  if (ctrl && e.key === '.') {
    e.preventDefault();
    openTargetsPanel();
    return;
  }

  // ── ESC — Close topmost modal / overlay / panel / dropdown ──
  if (e.key === 'Escape') {
    // Shortcuts modal
    if (document.getElementById('shortcutsOverlay')?.classList.contains('open')) { closeShortcutsModal(); return; }
    // Reassign dropdown
    const rd = document.getElementById('noteReassignDropdown');
    if (rd?.classList.contains('open')) { rd.classList.remove('open'); return; }
    // Svc quick-log popover
    if (document.getElementById('svcPopover')?.classList.contains('open')) { closeSvcPopover(); return; }
    // Targets panel
    if (document.getElementById('targetsOverlay')?.classList.contains('open')) { closeTargetsPanel(); return; }
    // Session modal
    if (document.getElementById('sessionOverlay')?.classList.contains('open')) { closeSessionModal(); return; }
    // New note modal
    if (document.getElementById('newNoteOverlay')?.classList.contains('open')) { closeNewNoteModal(); return; }
    // Command palette
    if (document.getElementById('cmdOverlay')?.classList.contains('open')) { closeCmd(); return; }
    // KB edit mode
    if (document.getElementById('cpEditBody')?.style.display !== 'none') {
      if (cpEditDirty) {
        try { await showConfirmDialog({ icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`, title: 'Discard Changes', bigIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`, description: 'You have unsaved changes. Discard them?', confirmLabel: 'Discard', danger: true }); }
        catch { return; }
      }
      exitEditMode(); return;
    }
    // Content panel
    if (!document.getElementById('contentPanel')?.classList.contains('hidden-panel')) { closeContent(); return; }
  }
});

// ── Show shortcut hints in tooltips ──
document.addEventListener('DOMContentLoaded', () => {
  const hints = [
    ['nav-services',      '⌘1'],
    ['nav-methodologies', '⌘2'],
    ['nav-notes',         '⌘3'],
    ['nav-search',        '⌘4'],
  ];
  hints.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.title = key;
  });
});

// ═══════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════
function esc(s) {
  return String(s||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ═══════════════════════════════════════════════
// PORT / SERVICE QUICK-LOG
// Stored per session: sessions[id].services = [{id,target_id,port,proto,service,version,notes,added}]
// ═══════════════════════════════════════════════

// ═══════════════════════════════════════════════
// RECON TOOL OUTPUT PARSERS
// ═══════════════════════════════════════════════

let _portParsed = [];  // staging: port results
let _pathParsed = [];  // staging: path results
let _activeSvcTab = 'ports';
let _activeLootType = 'cleartext';

// ── Tab switching ──
const SVC_TAB_ORDER = ['ports', 'paths', 'loot'];

function switchSvcTabByArrow(dir) {
  const popover = document.getElementById('svcPopover');
  if (!popover || !popover.classList.contains('open')) return;
  const active = document.activeElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
  const cur = SVC_TAB_ORDER.indexOf(_activeSvcTab);
  if (cur === -1) return;
  const next = (cur + dir + SVC_TAB_ORDER.length) % SVC_TAB_ORDER.length;
  switchSvcTab(SVC_TAB_ORDER[next]);
}

function switchSvcTab(tab) {
  _activeSvcTab = tab;
  document.getElementById('svcTabPorts').classList.toggle('active', tab === 'ports');
  document.getElementById('svcTabPaths').classList.toggle('active', tab === 'paths');
  document.getElementById('svcTabLoot').classList.toggle('active', tab === 'loot');
  document.getElementById('svcPanelPorts').style.display = tab === 'ports' ? 'block' : 'none';
  document.getElementById('svcPanelPaths').style.display = tab === 'paths' ? 'block' : 'none';
  document.getElementById('svcPanelLoot').style.display = tab === 'loot' ? 'block' : 'none';
  if (tab === 'ports') { renderSvcLogTable(); setTimeout(() => document.getElementById('svcQuickInput')?.focus(), 40); }
  if (tab === 'paths') { renderPathTable();  setTimeout(() => document.getElementById('pathQuickInput')?.focus(), 40); }
  if (tab === 'loot') {
    renderLootTable();
    setTimeout(() => {
      const hi = document.getElementById('lootHostInput');
      if (hi && !hi.value) {
        const ip = getIP();
        if (ip !== '<IP>') hi.value = ip;
      }
      document.getElementById('lootCredInput')?.focus();
    }, 40);
  }
}

function updateSvcTabCounts() {
  const ports = getSessionServices().length;
  const paths = getSessionPaths().length;
  const loot = getSessionLoot().length;
  const cp = document.getElementById('svcTabCountPorts');
  const ch = document.getElementById('svcTabCountPaths');
  const cl = document.getElementById('svcTabCountLoot');
  if (cp) cp.textContent = ports || '';
  if (ch) ch.textContent = paths || '';
  if (cl) cl.textContent = loot || '';
  // topbar button count — total
  const btn = document.getElementById('svcTopbarCount');
  if (btn) {
    const total = ports + paths + loot;
    btn.textContent = total || '';
    btn.classList.toggle('has-entries', total > 0);
  }
}

// ── Toggle import panel ──
function toggleToolPaste(kind) {
  const panel   = document.getElementById(kind === 'ports' ? 'portPastePanel' : 'pathPastePanel');
  const toggle  = document.getElementById(kind === 'ports' ? 'portPasteToggle' : 'pathPasteToggle');
  const isOpen  = panel.style.display === 'flex';
  panel.style.display      = isOpen ? 'none' : 'flex';
  toggle.style.color       = isOpen ? '' : 'var(--accent)';
  toggle.style.borderColor = isOpen ? '' : 'var(--accent)';
  if (!isOpen) {
    document.getElementById(kind === 'ports' ? 'portPasteInput' : 'pathPasteInput').focus();
  } else {
    resetPastePanel(kind);
  }
}

function resetPastePanel(kind) {
  if (kind === 'ports') {
    document.getElementById('portPasteInput').value = '';
    document.getElementById('portParsePreview').style.display = 'none';
    document.getElementById('portCommitBtn').style.display = 'none';
    _portParsed = [];
  } else {
    document.getElementById('pathPasteInput').value = '';
    document.getElementById('pathParsePreview').style.display = 'none';
    document.getElementById('pathCommitBtn').style.display = 'none';
    _pathParsed = [];
  }
}

// ════════════════════════════════
// PORT PARSERS  (nmap / rustscan / masscan)
// ════════════════════════════════
function parsePortOutput(text) {
  const results = [];
  const seen    = new Set();

  for (const raw of text.split('\n')) {
    const line = raw.trim();

    // ── nmap standard: 80/tcp   open  http    Apache httpd 2.4.49
    const nmapLine = line.match(/^(\d+)\/(tcp|udp|sctp)\s+open\s+(\S+)(?:\s+(.+))?$/i);
    if (nmapLine) {
      const port  = nmapLine[1];
      const proto = nmapLine[2].toLowerCase();
      if (seen.has(`${port}/${proto}`)) continue;
      seen.add(`${port}/${proto}`);
      let service = nmapLine[3] || '';
      let version = (nmapLine[4] || '').replace(/\s*\(\([^)]*\)\)/g, '').replace(/\s*\(protocol \d[\d.]*\)/i, '').trim();
      if (service.startsWith('ssl/')) { version = ('SSL ' + version).trim(); service = service.slice(4); }
      results.push({ port, proto, service, version: version.slice(0, 80), notes: '' });
      continue;
    }

    // ── nmap grepable -oG: Ports: 22/open/tcp//ssh//OpenSSH 8.2/
    const grepPorts = line.match(/Ports:\s*(.+)/i);
    if (grepPorts) {
      for (const entry of grepPorts[1].split(',')) {
        const m = entry.trim().match(/^(\d+)\/open\/(tcp|udp|sctp)\/+(\S*)\/+([^/]*)\//i);
        if (!m) continue;
        const key = `${m[1]}/${m[2].toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({ port: m[1], proto: m[2].toLowerCase(), service: m[3] || '', version: m[4].trim().slice(0, 80), notes: '' });
      }
      continue;
    }

    // ── rustscan: Open 192.168.1.1:22
    const rustscan = line.match(/^Open\s+[\d.]+:(\d+)$/i);
    if (rustscan) {
      const port = rustscan[1]; const proto = 'tcp';
      if (seen.has(`${port}/${proto}`)) continue;
      seen.add(`${port}/${proto}`);
      results.push({ port, proto, service: '', version: '', notes: '' });
      continue;
    }

    // ── masscan standard: Discovered open port 22/tcp on 192.168.1.1
    const masscan = line.match(/^Discovered open port\s+(\d+)\/(tcp|udp)\s+on\s+/i);
    if (masscan) {
      const port = masscan[1]; const proto = masscan[2].toLowerCase();
      if (seen.has(`${port}/${proto}`)) continue;
      seen.add(`${port}/${proto}`);
      results.push({ port, proto, service: '', version: '', notes: '' });
      continue;
    }

    // ── masscan list format: open tcp 80 192.168.1.1 ...
    const masscanList = line.match(/^open\s+(tcp|udp)\s+(\d+)\s+[\d.]+/i);
    if (masscanList) {
      const proto = masscanList[1].toLowerCase(); const port = masscanList[2];
      if (seen.has(`${port}/${proto}`)) continue;
      seen.add(`${port}/${proto}`);
      results.push({ port, proto, service: '', version: '', notes: '' });
      continue;
    }
  }

  return results.sort((a, b) => (parseInt(a.port) || 0) - (parseInt(b.port) || 0));
}

function parseAndPreviewPorts() {
  const raw     = document.getElementById('portPasteInput').value;
  const preview = document.getElementById('portParsePreview');
  const commitBtn = document.getElementById('portCommitBtn');
  _portParsed = parsePortOutput(raw);
  preview.style.display = 'block';
  if (!_portParsed.length) {
    preview.innerHTML = '<div class="nmap-preview-none">No open ports found — check format (nmap · rustscan · masscan).</div>';
    commitBtn.style.display = 'none'; return;
  }
  const existing = new Set(getSessionServices().map(s => `${s.port}/${s.proto}`));
  const fresh = _portParsed.filter(r => !existing.has(`${r.port}/${r.proto}`));
  const dupes = _portParsed.length - fresh.length;
  let html = `<div class="nmap-preview-hdr"><span>${_portParsed.length}</span> port${_portParsed.length !== 1 ? 's' : ''} found`;
  if (dupes) html += ` &nbsp;·&nbsp; <span style="color:var(--muted)">${dupes} already logged</span>`;
  html += `</div><table class="svc-table" style="margin-bottom:4px"><thead><tr><th>Port</th><th>Service</th><th>Version</th></tr></thead><tbody>`;
  html += _portParsed.map(r => {
    const isDupe = existing.has(`${r.port}/${r.proto}`);
    return `<tr style="${isDupe ? 'opacity:0.4' : ''}"><td>${esc(r.port)}${r.proto !== 'tcp' ? `<span style="color:var(--muted);font-weight:400">/${esc(r.proto)}</span>` : ''}</td><td>${esc(r.service || '—')}</td><td style="color:var(--text2)">${esc(r.version || '')}</td></tr>`;
  }).join('');
  html += '</tbody></table>';
  preview.innerHTML = html;
  if (fresh.length > 0) { commitBtn.style.display = 'block'; commitBtn.textContent = `＋ Add ${fresh.length} new`; }
  else { commitBtn.style.display = 'none'; preview.innerHTML += '<div class="nmap-preview-none">All ports already logged.</div>'; }
}

function commitPortParse() {
  if (!activeSessionId || !_portParsed.length) return;
  if (!sessions[activeSessionId].services) sessions[activeSessionId].services = [];
  const existing = new Set(sessions[activeSessionId].services.map(s => `${s.port}/${s.proto}`));
  let added = 0;
  for (const r of _portParsed) {
    if (existing.has(`${r.port}/${r.proto}`)) continue;
    sessions[activeSessionId].services.push({ id: 'svc_' + Date.now() + '_' + added, target_id: activeTargetId || null, port: r.port, proto: r.proto, service: r.service, version: r.version, notes: '', added: Date.now() });
    added++;
  }
  saveNotes(); renderSvcLogTable(); updateSvcTabCounts();
  showToast(`✓ Added ${added} port${added !== 1 ? 's' : ''}`);
  toggleToolPaste('ports');
}

// ════════════════════════════════
// PATH PARSERS  (gobuster / ffuf / dirbuster)
// ════════════════════════════════
function parsePathOutput(text) {
  const results = [];
  const seen    = new Set();
  const lines   = text.split('\n');

  // Pre-pass: pair ffuf [Status:]/[Size:] lines with the | URL | line that follows
  // Build a map: lineIndex → {status, size} for URL lines
  const ffufMeta = {};
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].trim().match(/^\[Status:\s*(\d+),\s*Size:\s*(\d+)/i);
    if (m) {
      // Find the next | URL | line within 5 lines
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        if (/^\|\s*URL\s*\|/i.test(lines[j].trim())) {
          ffufMeta[j] = { status: m[1], size: m[2] };
          break;
        }
      }
    }
  }

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx].trim();
    if (!line || line.startsWith('#')) continue;

    // ── gobuster dir: /admin   (Status: 200) [Size: 1234] [--> /redir/]
    const gobuster = line.match(/^(\S+)\s+\(Status:\s*(\d+)\)(?:\s*\[Size:\s*(\d+)\])?(?:\s*\[-->\s*([^\]]+)\])?/i);
    if (gobuster && gobuster[1].startsWith('/')) {
      const path = gobuster[1], status = gobuster[2], size = gobuster[3] || '';
      const redir = gobuster[4] ? `→ ${gobuster[4].trim()}` : '';
      if (seen.has(path)) continue; seen.add(path);
      results.push({ path, status, size, notes: redir }); continue;
    }

    // ── gobuster dns / vhost: Found: sub.domain.com [Status: 200] [Size: 1234]
    const gobusterDns = line.match(/^Found:\s+(\S+)(?:\s+Status:\s*(\d+))?/i);
    if (gobusterDns && !gobusterDns[1].startsWith('/') && gobusterDns[1].includes('.')) {
      const path = gobusterDns[1], status = gobusterDns[2] || '';
      if (seen.has(path)) continue; seen.add(path);
      results.push({ path, status, size: '', notes: '' }); continue;
    }

    // ── ffuf [Status:] line — skip, already handled via ffufMeta
    if (/^\[Status:\s*\d+/i.test(line)) continue;

    // ── ffuf | URL | line — use paired status/size if available
    const ffufUrl = line.match(/^\|\s*URL\s*\|\s*(https?:\/\/[^\s]+)/i);
    if (ffufUrl) {
      try {
        const u = new URL(ffufUrl[1]);
        const path = u.pathname + (u.search || '');
        if (seen.has(path)) continue; seen.add(path);
        const meta = ffufMeta[idx] || {};
        results.push({ path, status: meta.status || '', size: meta.size || '', notes: '' });
      } catch(_) {}
      continue;
    }

    // ── ffuf compact: /path   [Status: 200, Size: 1234, ...]
    const ffufCompact = line.match(/^(\S+)\s+\[Status:\s*(\d+),\s*Size:\s*(\d+)/i);
    if (ffufCompact && ffufCompact[1].startsWith('/')) {
      const path = ffufCompact[1], status = ffufCompact[2], size = ffufCompact[3];
      if (seen.has(path)) continue; seen.add(path);
      results.push({ path, status, size, notes: '' }); continue;
    }

    // ── dirbuster report: File found: /path - 200  |  Dir found: /path/
    const dirbFile = line.match(/^(?:File|Dir) found:\s+(\S+?)(?:\s+-\s+(\d+))?$/i);
    if (dirbFile) {
      const path = dirbFile[1], status = dirbFile[2] || '';
      if (seen.has(path)) continue; seen.add(path);
      results.push({ path, status, size: '', notes: '' }); continue;
    }

    // ── plain path list: /admin/ or /login.php
    const plainPath = line.match(/^(\/\S*)$/);
    if (plainPath) {
      const path = plainPath[1];
      if (seen.has(path)) continue; seen.add(path);
      results.push({ path, status: '', size: '', notes: '' });
    }
  }

  return results;
}

function statusClass(code) {
  if (!code) return 'path-status-x';
  const c = parseInt(code);
  if (c >= 200 && c < 300) return 'path-status-2';
  if (c >= 300 && c < 400) return 'path-status-3';
  if (c >= 400 && c < 500) return 'path-status-4';
  return 'path-status-x';
}

function parseAndPreviewPaths() {
  const raw     = document.getElementById('pathPasteInput').value;
  const preview = document.getElementById('pathParsePreview');
  const commitBtn = document.getElementById('pathCommitBtn');
  _pathParsed = parsePathOutput(raw);
  preview.style.display = 'block';
  if (!_pathParsed.length) {
    preview.innerHTML = '<div class="nmap-preview-none">No paths found — check format (gobuster · ffuf · dirbuster).</div>';
    commitBtn.style.display = 'none'; return;
  }
  const existing = new Set(getSessionPaths().map(p => p.path));
  const fresh = _pathParsed.filter(r => !existing.has(r.path));
  const dupes = _pathParsed.length - fresh.length;
  let html = `<div class="nmap-preview-hdr"><span>${_pathParsed.length}</span> path${_pathParsed.length !== 1 ? 's' : ''} found`;
  if (dupes) html += ` &nbsp;·&nbsp; <span style="color:var(--muted)">${dupes} already logged</span>`;
  html += `</div><table class="path-table" style="margin-bottom:4px"><thead><tr><th>Status</th><th>Path</th><th>Size</th></tr></thead><tbody>`;
  html += _pathParsed.map(r => {
    const isDupe = existing.has(r.path);
    return `<tr style="${isDupe ? 'opacity:0.4' : ''}"><td><span class="path-status ${statusClass(r.status)}">${esc(r.status || '—')}</span></td><td style="color:var(--text);word-break:break-all">${esc(r.path)}</td><td style="color:var(--muted)">${esc(r.size)}</td></tr>`;
  }).join('');
  html += '</tbody></table>';
  preview.innerHTML = html;
  if (fresh.length > 0) { commitBtn.style.display = 'block'; commitBtn.textContent = `＋ Add ${fresh.length} new`; }
  else { commitBtn.style.display = 'none'; preview.innerHTML += '<div class="nmap-preview-none">All paths already logged.</div>'; }
}

function commitPathParse() {
  if (!activeSessionId || !_pathParsed.length) return;
  if (!sessions[activeSessionId].paths) sessions[activeSessionId].paths = [];
  const existing = new Set(sessions[activeSessionId].paths.map(p => p.path));
  let added = 0;
  for (const r of _pathParsed) {
    if (existing.has(r.path)) continue;
    sessions[activeSessionId].paths.push({ id: 'path_' + Date.now() + '_' + added, target_id: activeTargetId || null, path: r.path, status: r.status, size: r.size, notes: r.notes, added: Date.now() });
    added++;
  }
  saveNotes(); renderPathTable(); updateSvcTabCounts();
  showToast(`✓ Added ${added} path${added !== 1 ? 's' : ''}`);
  toggleToolPaste('paths');
}

// ── Manual single path add ──
function addPathLog() {
  const input = document.getElementById('pathQuickInput');
  const raw   = (input && input.value) ? input.value.trim() : '';
  if (!raw || !activeSessionId) { if (input) input.focus(); return; }
  // Accept: "/path"  or  "200 /path"  or  "200 /path some notes"
  let status = '', path = '', notes = '';
  const m = raw.match(/^(\d{3})\s+(\S+)(?:\s+(.+))?$/);
  if (m) { status = m[1]; path = m[2]; notes = m[3] || ''; }
  else { path = raw.split(/\s+/)[0]; notes = raw.slice(path.length).trim(); }
  if (!path.startsWith('/') && !path.includes('.')) { input.focus(); return; }
  if (!sessions[activeSessionId].paths) sessions[activeSessionId].paths = [];
  sessions[activeSessionId].paths.push({ id: 'path_' + Date.now(), target_id: activeTargetId || null, path, status, size: '', notes, added: Date.now() });
  input.value = ''; input.focus();
  saveNotes(); renderPathTable(); updateSvcTabCounts();
}

function deletePathLog(pathId) {
  if (!activeSessionId) return;
  sessions[activeSessionId].paths = (sessions[activeSessionId].paths || []).filter(p => p.id !== pathId);
  saveNotes(); renderPathTable(); updateSvcTabCounts();
}

function updatePathNotes(pathId, val) {
  if (!activeSessionId) return;
  const p = (sessions[activeSessionId].paths || []).find(p => p.id === pathId);
  if (p) { p.notes = val; saveNotes(); }
}

function getSessionPaths() {
  if (!activeSessionId || !sessions[activeSessionId]) return [];
  return sessions[activeSessionId].paths || [];
}

function renderPathTable() {
  const el = document.getElementById('pathLogTable');
  if (!el) return;
  updateSvcTabCounts();
  const paths = [...getSessionPaths()].sort((a, b) => (a.path < b.path ? -1 : 1));
  if (!paths.length) {
    el.innerHTML = '<div class="svc-empty">No paths logged — add one above or import tool output</div>'; return;
  }
  el.innerHTML = `<table class="path-table">
    <thead><tr><th>Status</th><th>Path</th><th>Notes</th><th></th></tr></thead>
    <tbody>${paths.map(p => `<tr>
      <td><span class="path-status ${statusClass(p.status)}">${esc(p.status || '—')}</span></td>
      <td style="color:var(--text);word-break:break-all">${esc(p.path)}</td>
      <td><input class="svc-notes-cell" type="text" value="${esc(p.notes || '')}" placeholder="notes…"
        onclick="event.stopPropagation()"
        onchange="updatePathNotes('${p.id}',this.value)" onblur="updatePathNotes('${p.id}',this.value)"></td>
      <td><button class="svc-del-btn" onclick="event.stopPropagation();deletePathLog('${p.id}')" title="Remove">✕</button></td>
    </tr>`).join('')}
    </tbody></table>`;
}

function parseSvcInput(raw) {
  const str = raw.trim();
  if (!str) return null;
  let port = '', proto = 'tcp', service = '', version = '', notes = '';
  const portProtoMatch = str.match(/^(\d+)(?:\/(tcp|udp|sctp))?/i);
  if (!portProtoMatch) { service = str; return { port, proto, service, version, notes }; }
  port  = portProtoMatch[1];
  proto = (portProtoMatch[2] || 'tcp').toLowerCase();
  const tokens = str.slice(portProtoMatch[0].length).trim().split(/\s+/).filter(Boolean);
  if (tokens.length >= 1) service = tokens[0];
  if (tokens.length >= 2) version = tokens[1];
  if (tokens.length >= 3) notes   = tokens.slice(2).join(' ');
  return { port, proto, service, version, notes };
}

function getSessionServices() {
  if (!activeSessionId || !sessions[activeSessionId]) return [];
  return sessions[activeSessionId].services || [];
}

function addServiceLog() {
  const input = document.getElementById('svcQuickInput');
  const raw   = (input && input.value) ? input.value.trim() : '';
  if (!raw || !activeSessionId) { if (input) input.focus(); return; }
  const parsed = parseSvcInput(raw);
  if (!parsed) return;
  if (!sessions[activeSessionId].services) sessions[activeSessionId].services = [];
  sessions[activeSessionId].services.push({
    id:        'svc_' + Date.now(),
    target_id: activeTargetId || null,
    port:      parsed.port,
    proto:     parsed.proto,
    service:   parsed.service,
    version:   parsed.version,
    notes:     parsed.notes,
    added:     Date.now(),
  });
  input.value = '';
  input.focus();
  saveNotes();
  renderSvcLogTable();
}

function deleteServiceLog(svcId) {
  if (!activeSessionId) return;
  sessions[activeSessionId].services = (sessions[activeSessionId].services || []).filter(s => s.id !== svcId);
  saveNotes();
  renderSvcLogTable();
}

function updateSvcNotes(svcId, val) {
  if (!activeSessionId) return;
  const svc = (sessions[activeSessionId].services || []).find(s => s.id === svcId);
  if (svc) { svc.notes = val; saveNotes(); }
}

function renderSvcLogTable() {
  const tableEl = document.getElementById('svcLogTable');
  if (!tableEl) return;

  const svcs   = getSessionServices();
  const sorted = [...svcs].sort((a, b) => (parseInt(a.port) || 0) - (parseInt(b.port) || 0));

  updateSvcTabCounts();

  if (!sorted.length) {
    tableEl.innerHTML = '<div class="svc-empty">No services logged — add one above</div>';
    return;
  }

  tableEl.innerHTML = `
    <table class="svc-table">
      <thead><tr><th>Port</th><th>Service</th><th>Version</th><th>Notes</th><th></th></tr></thead>
      <tbody>${sorted.map(s => `
        <tr>
          <td>${esc(s.port)}${s.proto && s.proto !== 'tcp' ? '<span style="color:var(--muted);font-weight:400">/' + esc(s.proto) + '</span>' : ''}</td>
          <td>${esc(s.service || '—')}</td>
          <td style="color:var(--text2)">${esc(s.version || '')}</td>
          <td><input class="svc-notes-cell" type="text" value="${esc(s.notes || '')}" placeholder="notes…"
            onclick="event.stopPropagation()"
            onchange="updateSvcNotes('${s.id}',this.value)" onblur="updateSvcNotes('${s.id}',this.value)"></td>
          <td><button class="svc-del-btn" onclick="event.stopPropagation();deleteServiceLog('${s.id}')" title="Remove">✕</button></td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

// ═══════════════════════════════════════════════
// LOOT LOG
// Stored per session: sessions[id].loot = [{id,type,credential,host,note,added}]
// Types: cleartext | hash | token | key | other
// ═══════════════════════════════════════════════
function setLootType(btn, type) {
  _activeLootType = type;
  document.querySelectorAll('.loot-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function getSessionLoot() {
  if (!activeSessionId || !sessions[activeSessionId]) return [];
  return sessions[activeSessionId].loot || [];
}

function addLootEntry() {
  const credEl = document.getElementById('lootCredInput');
  const hostEl = document.getElementById('lootHostInput');
  const noteEl = document.getElementById('lootNoteInput');
  const cred = credEl?.value.trim();
  const host = hostEl?.value.trim();
  const note = noteEl?.value.trim();
  if (!cred || !activeSessionId) { credEl?.focus(); return; }
  if (!sessions[activeSessionId].loot) sessions[activeSessionId].loot = [];

  const autoHost = host || (getIP() !== '<IP>' ? getIP() : '');

  sessions[activeSessionId].loot.push({
    id: 'loot_' + Date.now(),
    type: _activeLootType,
    credential: cred,
    host: autoHost,
    note,
    added: Date.now(),
  });

  credEl.value = '';
  noteEl.value = '';
  credEl.focus();
  saveNotes();
  renderLootTable();
  updateSvcTabCounts();
}

function deleteLootEntry(lootId) {
  if (!activeSessionId) return;
  sessions[activeSessionId].loot = (sessions[activeSessionId].loot || []).filter(l => l.id !== lootId);
  saveNotes();
  renderLootTable();
  updateSvcTabCounts();
}

function updateLootNote(lootId, val) {
  if (!activeSessionId) return;
  const entry = (sessions[activeSessionId].loot || []).find(l => l.id === lootId);
  if (entry) { entry.note = val; saveNotes(); }
}

const LOOT_TYPE_CSS = {
  cleartext: 'loot-type-cleartext',
  hash: 'loot-type-hash',
  token: 'loot-type-token',
  key: 'loot-type-key',
  other: 'loot-type-other',
};

function renderLootTable() {
  const el = document.getElementById('lootLogTable');
  if (!el) return;
  updateSvcTabCounts();
  const entries = [...getSessionLoot()].sort((a, b) => (a.added || 0) - (b.added || 0));
  if (!entries.length) {
    el.innerHTML = '<div class="svc-empty">No loot logged yet — add credentials, hashes or tokens above</div>';
    return;
  }
  el.innerHTML = `
    <table class="svc-table">
      <thead><tr><th>Type</th><th>Credential</th><th>Host</th><th>Context</th><th></th></tr></thead>
      <tbody>${entries.map(l => {
        const typeCss = LOOT_TYPE_CSS[l.type] || 'loot-type-other';
        return `<tr>
          <td><span class="loot-type-badge ${typeCss}">${esc(l.type)}</span></td>
          <td class="loot-cred-cell" onclick="copyLootCred('${l.id}')" title="Click to copy">${esc(l.credential)}</td>
          <td style="color:var(--text2);white-space:nowrap">${esc(l.host || '—')}</td>
          <td style="min-width:160px;width:35%"><input class="svc-notes-cell" type="text" value="${esc(l.note || '')}" placeholder="context…"
            onclick="event.stopPropagation()"
            onchange="updateLootNote('${l.id}',this.value)"
            onblur="updateLootNote('${l.id}',this.value)"></td>
          <td><button class="svc-del-btn" onclick="event.stopPropagation();deleteLootEntry('${l.id}')" title="Remove">✕</button></td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>`;
}

function copyLootCred(lootId) {
  const entry = (sessions[activeSessionId]?.loot || []).find(l => l.id === lootId);
  if (!entry) return;
  navigator.clipboard.writeText(entry.credential).then(() => {
    showToast('✓ Copied: ' + entry.credential.slice(0, 40) + (entry.credential.length > 40 ? '…' : ''));
  });
}

function buildLootMarkdown(sessionId) {
  const loot = sessions[sessionId]?.loot || [];
  if (!loot.length) return null;

  const byHost = {};
  loot.forEach(l => {
    const host = l.host || 'Unknown';
    if (!byHost[host]) byHost[host] = [];
    byHost[host].push(l);
  });

  let md = '# Loot\n\n';
  md += `*Exported: ${new Date().toLocaleString('en-GB')}*\n\n`;

  for (const [host, entries] of Object.entries(byHost)) {
    md += `## ${host}\n\n`;
    md += '| Type | Credential | Context |\n';
    md += '|------|------------|----------|\n';
    entries.forEach(l => {
      const cred = l.credential.replace(/\|/g, '\\|');
      const note = (l.note || '').replace(/\|/g, '\\|');
      md += `| ${l.type} | \`${cred}\` | ${note} |\n`;
    });
    md += '\n';
  }
  return md;
}

function toggleSvcPopover() {
  const popover = document.getElementById('svcPopover');
  const btn     = document.getElementById('svcTopbarBtn');
  const isOpen  = popover.classList.contains('open');
  if (isOpen) {
    closeSvcPopover();
  } else {
    popover.classList.add('open');
    btn.classList.add('open');
    // Show which session this log belongs to
    const sessLabel = document.getElementById('svcSessionLabel');
    if (sessLabel) {
      const sess = activeSessionId && sessions[activeSessionId];
      if (sess) {
        sessLabel.textContent = sess.codename;
        sessLabel.style.display = '';
      } else {
        sessLabel.textContent = '';
        sessLabel.style.display = 'none';
      }
    }
    renderSvcLogTable();
    renderPathTable();
    renderLootTable();
    updateSvcTabCounts();
    setTimeout(() => {
      const hi = document.getElementById('lootHostInput');
      if (hi && !hi.value) {
        const ip = getIP();
        if (ip !== '<IP>') hi.value = ip;
      }
      const inputId = _activeSvcTab === 'ports'
        ? 'svcQuickInput'
        : _activeSvcTab === 'loot'
          ? 'lootCredInput'
          : 'pathQuickInput';
      document.getElementById(inputId)?.focus();
    }, 40);
    // Close on outside click
    setTimeout(() => document.addEventListener('click', _svcOutsideClose, { once: true }), 0);
  }
}

function closeSvcPopover() {
  document.getElementById('svcPopover')?.classList.remove('open');
  document.getElementById('svcTopbarBtn')?.classList.remove('open');
}

function _svcOutsideClose(e) {
  const wrap = document.getElementById('svcTopbarWrap');
  if (!wrap) return;
  if (wrap.contains(e.target)) {
    // Click was inside the popover — keep it open, re-register
    if (document.getElementById('svcPopover')?.classList.contains('open')) {
      setTimeout(() => document.addEventListener('click', _svcOutsideClose, { once: true }), 0);
    }
  } else {
    closeSvcPopover();
  }
}

// ═══════════════════════════════════════════════
// TIMELINE VIEW
// ═══════════════════════════════════════════════
let notesListViewMode = 'list';

function setNotesListView(mode, btn) {
  notesListViewMode = mode;
  document.querySelectorAll('.notes-view-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const listEl     = document.getElementById('notesList');
  const timelineEl = document.getElementById('timelineList');
  const filterBar  = document.getElementById('notesTypeFilter');
  const scopeBar   = document.querySelector('.notes-scope-bar');
  const tgtBar     = document.getElementById('targetFilterBar');
  const tlToolbar  = document.getElementById('timelineToolbar');

  if (mode === 'timeline') {
    listEl.style.display     = 'none';
    timelineEl.style.display = 'block';
    if (filterBar) filterBar.style.display = 'none';
    if (scopeBar)  scopeBar.style.display  = 'none';
    if (tgtBar)    tgtBar.style.display    = 'none';
    if (tlToolbar) tlToolbar.style.display = 'flex';
    renderTimeline();
  } else {
    listEl.style.display     = '';
    timelineEl.style.display = 'none';
    if (filterBar) filterBar.style.display = '';
    if (scopeBar)  scopeBar.style.display  = '';
    if (tlToolbar) tlToolbar.style.display = 'none';
    renderNotesList();
  }
}

function setTlTargetFilter(val) {
  tlTargetFilter = val || null;
  renderTimeline();
}

function renderTimeline() {
  const el = document.getElementById('timelineList');
  if (!el) return;

  const sess    = activeSessionId ? sessions[activeSessionId] : null;
  const targets = sess ? (sess.targets || []) : [];

  // ── Populate target filter dropdown ──
  const sel = document.getElementById('tlTargetSelect');
  if (sel) {
    const cur = sel.value;
    sel.innerHTML = '<option value="">All targets</option>' +
      targets.map(t => {
        const label = t.ip || t.domain || t.label || 'target';
        return `<option value="${t.id}"${t.id === tlTargetFilter ? ' selected' : ''}>${esc(label)}</option>`;
      }).join('');
    if (!targets.find(t => t.id === tlTargetFilter)) tlTargetFilter = null;
  }

  // ── Collect note events ──
  const allNotes = Object.values(notes);
  let noteItems = activeSessionId
    ? allNotes.filter(n => n.session_id === activeSessionId || n.session_id == null)
    : allNotes;
  if (!noteItems.length && activeSessionId) noteItems = allNotes;

  // ── Collect session events (status changes, session created) ──
  const sessEvents = sess ? (sess.events || []) : [];

  // ── Merge into unified event list ──
  let unified = [
    ...noteItems.map(n => ({ ts: n.created || 0, kind: 'note', data: n })),
    ...sessEvents.map(e => ({ ts: e.ts, kind: 'event', data: e })),
  ].sort((a, b) => a.ts - b.ts);

  // ── Apply per-target filter ──
  if (tlTargetFilter) {
    unified = unified.filter(item => {
      if (item.kind === 'note') return item.data.target_id === tlTargetFilter;
      return true; // always show status/session events
    });
  }

  if (!unified.length) {
    el.innerHTML = `<div style="padding:20px 12px;font-size:12px;color:var(--muted);font-family:Inter,sans-serif;text-align:center;line-height:1.6">
      No events yet.<br><span style="font-size:11px;opacity:0.7">Create notes or change target status to populate the timeline.</span>
    </div>`;
    return;
  }

  // ── Group by day, inserting idle gap markers ──
  const IDLE_MS = 2 * 60 * 60 * 1000; // 2 hours
  const groups  = {}; // dayKey -> [{item|gap}]

  unified.forEach((item, i) => {
    const dayKey = new Date(item.ts).toLocaleDateString('en-GB', { weekday:'short', day:'2-digit', month:'short', year:'2-digit' });
    if (!groups[dayKey]) groups[dayKey] = [];

    // Check idle gap vs previous item on same day
    const prev = groups[dayKey].slice().reverse().find(x => x.type !== 'gap');
    if (prev && (item.ts - prev.ts) > IDLE_MS) {
      const hrs = Math.round((item.ts - prev.ts) / 3600000);
      groups[dayKey].push({ type: 'gap', hrs });
    }
    groups[dayKey].push({ type: 'item', item });
  });

  // ── Render ──
  const statusLabel = s => ({ active: 'Active', paused: 'Paused', complete: 'Complete' }[s] || s);
  const statusClass = s => ({ active: 'tl-status-active', paused: 'tl-status-paused', complete: 'tl-status-complete' }[s] || '');

  let html = '';
  Object.entries(groups).forEach(([dayLabel, entries]) => {
    html += `<div class="timeline-day-group"><div class="timeline-day-label">${esc(dayLabel)}</div>`;

    entries.forEach(entry => {
      if (entry.type === 'gap') {
        html += `<div class="tl-idle-gap"><span class="tl-idle-label">— ${entry.hrs}h break —</span></div>`;
        return;
      }

      const { item } = entry;
      const time = new Date(item.ts).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });

      if (item.kind === 'note') {
        const n       = item.data;
        const meta    = NOTE_TYPE_META[n.type] || NOTE_TYPE_META.general;
        const preview = (n.body || '').replace(/^#+\s*/gm,'').replace(/\n/g,' ').trim().slice(0,60);
        const tgt     = n.target_id ? targets.find(t => t.id === n.target_id) : null;
        const tgtBadge = tgt
          ? `<span class="note-item-target" style="margin-top:2px"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> ${esc(tgt.ip||tgt.domain||tgt.label||'target')}</span>`
          : '';
        html += `<div class="timeline-entry${n.id === activeNoteId ? ' tl-active' : ''}" onclick="openNote('${n.id}')">
          <span class="tl-time">${esc(time)}</span>
          <div class="tl-body">
            <span class="tl-type-badge ${meta.cssClass}">${meta.icon} ${meta.label}</span>
            ${tgtBadge}
            <div class="tl-title">${esc(n.title || 'Untitled')}</div>
            ${preview ? `<div class="tl-preview">${esc(preview)}</div>` : ''}
          </div>
        </div>`;
      } else {
        // System event
        const ev = item.data;
        if (ev.type === 'status') {
          html += `<div class="tl-event tl-event-status">
            <span class="tl-time">${esc(time)}</span>
            <span class="tl-event-label">
              Status changed
              <span class="tl-status-badge ${statusClass(ev.from)}">${statusLabel(ev.from)}</span>
              <span class="tl-status-arrow">→</span>
              <span class="tl-status-badge ${statusClass(ev.to)}">${statusLabel(ev.to)}</span>
            </span>
          </div>`;
        } else if (ev.type === 'session_created') {
          html += `<div class="tl-event tl-event-session">
            <span class="tl-time">${esc(time)}</span>
            <span class="tl-event-label">Session <strong>${esc(ev.name || '')}</strong> created</span>
          </div>`;
        } else if (ev.type === 'note_created') {
          // note_created events are already shown as note items — skip
        }
      }
    });

    html += '</div>';
  });

  el.innerHTML = html;
}

function exportTimelineForSession(sessionId) {
  exportTimeline(sessionId);
}

function exportTimeline(overrideSessionId) {
  const sessId = overrideSessionId || activeSessionId;
  const sess   = sessId ? sessions[sessId] : null;
  if (!sess) { showToast('No active session', 'err'); return; }

  const targets  = sess.targets || [];
  const tgtLabel = t => t ? (t.ip || t.domain || t.label || 'target') : null;

  const allNotes   = Object.values(notes).filter(n => n.session_id === sessId || n.session_id == null);
  const sessEvents = sess.events || [];

  let unified = [
    ...allNotes.map(n => ({ ts: n.created || 0, kind: 'note', data: n })),
    ...sessEvents.map(e => ({ ts: e.ts, kind: 'event', data: e })),
  ].sort((a, b) => a.ts - b.ts);

  if (tlTargetFilter) {
    unified = unified.filter(item =>
      item.kind === 'event' || item.data.target_id === tlTargetFilter
    );
  }

  const fmtDate = ts => new Date(ts).toLocaleDateString('en-GB', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
  const fmtTime = ts => new Date(ts).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
  const IDLE_MS = 2 * 60 * 60 * 1000;

  let md = `# Timeline — ${sess.codename}\n`;
  if (sess.target_ip)     md += `**Target IP:** ${sess.target_ip}  \n`;
  if (sess.target_domain) md += `**Domain:** ${sess.target_domain}  \n`;
  md += `**Exported:** ${new Date().toLocaleString('en-GB')}  \n\n---\n\n`;

  let currentDay = '';
  let prevTs     = null;

  unified.forEach(item => {
    const day = fmtDate(item.ts);
    if (day !== currentDay) {
      currentDay = day;
      md += `## ${day}\n\n`;
      prevTs = null;
    }

    if (prevTs && (item.ts - prevTs) > IDLE_MS) {
      const hrs = Math.round((item.ts - prevTs) / 3600000);
      md += `> ⏸ ${hrs}h break\n\n`;
    }

    const time = fmtTime(item.ts);

    if (item.kind === 'note') {
      const n    = item.data;
      const meta = NOTE_TYPE_META[n.type] || NOTE_TYPE_META.general;
      const tgt  = n.target_id ? targets.find(t => t.id === n.target_id) : null;
      md += `### ${time} — ${meta.icon} ${n.title || 'Untitled'}\n`;
      md += `**Type:** ${meta.label}`;
      if (tgt) md += `  |  **Target:** ${tgtLabel(tgt)}`;
      md += `  \n\n`;
      if (n.body && n.body.trim()) md += n.body.trim() + '\n\n';
    } else {
      const ev = item.data;
      if (ev.type === 'status') {
        md += `- \`${time}\` Status: **${ev.from}** → **${ev.to}**\n\n`;
      } else if (ev.type === 'session_created') {
        md += `- \`${time}\` Session created: **${ev.name}**\n\n`;
      }
    }

    prevTs = item.ts;
  });

  const blob = new Blob([md], { type: 'text/markdown' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `timeline-${(sess.codename || 'session').replace(/\s+/g,'-').toLowerCase()}.md`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✓ Timeline exported');
}


// ═══════════════════════════════════════════════
// NOTE TARGET ASSIGNMENT
// ═══════════════════════════════════════════════

function getSessionTargets() {
  if (!activeSessionId || !sessions[activeSessionId]) return [];
  return sessions[activeSessionId].targets || [];
}

function toggleTargetAssignDropdown() {
  const dd  = document.getElementById('noteTargetAssignDropdown');
  if (!dd) return;
  const isOpen = dd.classList.contains('open');
  document.getElementById('noteReassignDropdown')?.classList.remove('open');
  if (isOpen) { dd.classList.remove('open'); return; }
  renderTargetAssignDropdown();
  dd.classList.add('open');
  setTimeout(() => document.addEventListener('click', _tgtAssignOutside, { once: true }), 0);
}

function _tgtAssignOutside(e) {
  const wrap = document.querySelector('.note-target-assign-wrap');
  if (!wrap) return;
  if (wrap.contains(e.target)) {
    if (document.getElementById('noteTargetAssignDropdown')?.classList.contains('open')) {
      setTimeout(() => document.addEventListener('click', _tgtAssignOutside, { once: true }), 0);
    }
  } else {
    document.getElementById('noteTargetAssignDropdown')?.classList.remove('open');
  }
}

function renderTargetAssignDropdown() {
  const dd   = document.getElementById('noteTargetAssignDropdown');
  const note = activeNoteId && notes[activeNoteId];
  if (!dd || !note) return;
  const targets = getSessionTargets();
  let html = '';
  if (note.target_id) {
    html += '<div class="note-target-assign-option unassign" onclick="assignNoteTarget(null)">✕ Remove target</div>';
  }
  if (!targets.length) {
    html += '<div class="note-target-assign-option unassign">No targets in session</div>';
  } else {
    targets.forEach(t => {
      const label = t.ip || t.domain || t.label || 'Unnamed';
      const sub   = t.label && t.ip ? ` <span style="color:var(--muted);font-weight:400">${esc(t.label)}</span>` : '';
      const cur   = t.id === note.target_id;
      html += `<div class="note-target-assign-option${cur ? ' current' : ''}" onclick="assignNoteTarget('${t.id}')">${cur ? '✓ ' : '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> '}${esc(label)}${sub}</div>`;
    });
  }
  dd.innerHTML = html;
}

function assignNoteTarget(targetId) {
  if (!activeNoteId) return;
  const note = notes[activeNoteId];
  note.target_id = targetId || null;
  note.updated   = Date.now();
  saveNotes();
  updateTargetAssignBtn(note);
  document.getElementById('noteTargetAssignDropdown')?.classList.remove('open');
  renderNotesList();
  renderTargetFilterBar();
}

function updateTargetAssignBtn(note) {
  const btn = document.getElementById('noteTargetAssignBtn');
  if (!btn || !note) return;
  const tgt = note.target_id ? getSessionTargets().find(t => t.id === note.target_id) : null;
  if (tgt) {
    btn.innerHTML = '<span style="display:flex;align-items:center;gap:5px">' + ICONS.target + ' ' + esc(tgt.ip || tgt.domain || tgt.label || 'target') + '</span>';
    btn.classList.add('has-target');
  } else {
    btn.innerHTML = '<span style="display:flex;align-items:center;gap:5px">' + ICONS.target + ' target</span>';
    btn.classList.remove('has-target');
  }
}

// ── Target filter bar ──
function renderTargetFilterBar() {
  const bar = document.getElementById('targetFilterBar');
  if (!bar) return;
  const targets = getSessionTargets();
  if (!targets.length || activeNoteScope !== 'session') {
    bar.style.display = 'none';
    return;
  }
  const notesWithTargets = Object.values(notes).filter(n => n.session_id === activeSessionId && n.target_id);
  if (!notesWithTargets.length) {
    bar.style.display = 'none';
    return;
  }
  const usedIds = new Set(notesWithTargets.map(n => n.target_id));
  const chips = targets
    .filter(t => usedIds.has(t.id))
    .map(t => {
      const label  = t.ip || t.domain || t.label || 'target';
      const active = t.id === activeTargetFilter;
      return `<span class="target-filter-chip${active ? ' active' : ''}" onclick="setTargetFilter('${t.id}')">${esc(label)}</span>`;
    }).join('');
  bar.innerHTML = chips;
  bar.style.display = chips ? 'flex' : 'none';
}

function setTargetFilter(targetId) {
  activeTargetFilter = activeTargetFilter === targetId ? null : targetId;
  renderTargetFilterBar();
  renderNotesList();
}

// ═══════════════════════════════════════════════
// SESSION + NOTES EXPORT
// ═══════════════════════════════════════════════

async function exportSessionFile(sessionId) {
  const sess = sessions[sessionId];
  if (!sess) return;
  const sessNotes = Object.values(notes).filter(n => n.session_id === sessionId);
  const payload   = { pragma_version: 1, exported: Date.now(), session: sess, notes: sessNotes };

  if (encryptedStorageEnabled && encryptedStoragePassword) {
    // Encrypt the session file with the same workspace password
    try {
      const blob     = await encryptPayload(JSON.stringify(payload), encryptedStoragePassword);
      const filename = slugify(sess.codename) + '.session.enc';
      downloadJSON(blob, filename);
    } catch (e) {
      alert('Encryption failed: ' + e.message);
    }
  } else {
    const filename = slugify(sess.codename) + '.session';
    downloadJSON(payload, filename);
  }

  // Also tell server to save a copy in sessions/
  try {
    await fetch('/api/notes/export-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, sessions, notes }),
    });
  } catch (_) {}
}

async function exportNotesMarkdown(sessionId) {
  const sess = sessions[sessionId];
  if (!sess) return;

  try {
    const r = await fetch('/api/notes/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, sessions, notes }),
    });
    const d = await r.json();
    if (d.ok) {
      const count = d.files?.length || 0;
      showToast(`✓ Exported ${count} files → sessions/${slugify(sess.codename)}/`);
    } else {
      showToast('Export failed: ' + (d.error || 'unknown error'), 'err');
    }
  } catch (e) {
    showToast('Export failed: ' + e.message, 'err');
  }
}

function slugify(str) {
  return (str || 'session').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase().slice(0, 60);
}

function showToast(msg, type = 'ok') {
  const existing = document.getElementById('pragmaToast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.id = 'pragmaToast';
  t.textContent = msg;
  t.style.cssText = `
    position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
    background:${type === 'err' ? 'var(--red)' : 'var(--accent)'};
    color:#fff; font-family:'JetBrains Mono',monospace; font-size:12px; font-weight:700;
    padding:9px 18px; border-radius:8px; z-index:9999;
    box-shadow:0 4px 20px rgba(0,0,0,0.4);
    animation:toastIn 0.15s ease;
    white-space:nowrap; max-width:90vw; overflow:hidden; text-overflow:ellipsis;
  `;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 3000);
}

function downloadJSON(obj, filename) {
  downloadText(JSON.stringify(obj, null, 2), filename, 'application/json');
}

function downloadText(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

init();
cmInitNote();

// ═══════════════════════════════════════════════
// RESIZABLE PANELS
// ═══════════════════════════════════════════════
(function() {
  const NOTES_MIN  = 120, NOTES_MAX  = 520, NOTES_DEFAULT  = 320;
  const PANEL_MIN  = 120, PANEL_MAX  = 1500, PANEL_DEFAULT  = 680;

  // Restore saved widths
  const savedNotesW = parseInt(localStorage.getItem('ops-notes-w2'))  || NOTES_DEFAULT;
  const savedPanelW = parseInt(localStorage.getItem('ops-panel-w3'))  || PANEL_DEFAULT;

  const notesList    = document.querySelector('.notes-list');
  const contentPanel = document.getElementById('contentPanel');

  notesList.style.width    = savedNotesW + 'px';
  contentPanel.style.width = savedPanelW + 'px';

  function makeDraggable(handle, getEl, getStartW, onDrag, storageKey) {
    handle.addEventListener('mousedown', function(e) {
      e.preventDefault();
      const startX = e.clientX;
      const startW = getStartW();
      handle.classList.add('dragging');
      document.body.classList.add('is-resizing');

      function onMove(e) {
        const delta = onDrag(e.clientX - startX);
        const newW  = Math.min(Math.max(startW + delta, getEl().minW), getEl().maxW);
        getEl().el.style.width = newW + 'px';
        localStorage.setItem(storageKey, newW);
      }

      function onUp() {
        handle.classList.remove('dragging');
        document.body.classList.remove('is-resizing');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    });
  }

  // Notes list — dragging right edge expands list to the right
  const notesHandle = document.getElementById('notesListHandle');
  if (notesHandle) {
    makeDraggable(
      notesHandle,
      () => ({ el: notesList, minW: NOTES_MIN, maxW: NOTES_MAX }),
      () => notesList.offsetWidth,
      delta => delta,
      'ops-notes-w2'
    );
    notesHandle.addEventListener('dblclick', () => {
      notesList.style.width = NOTES_DEFAULT + 'px';
      localStorage.setItem('ops-notes-w2', NOTES_DEFAULT);
    });
  }

  // Content panel — dragging left edge: drag left = wider, drag right = narrower
  const panelHandle = document.getElementById('contentPanelHandle');
  if (panelHandle) {
    makeDraggable(
      panelHandle,
      () => ({ el: contentPanel, minW: PANEL_MIN, maxW: PANEL_MAX }),
      () => contentPanel.offsetWidth,
      delta => -delta,
      'ops-panel-w3'
    );
    panelHandle.addEventListener('dblclick', () => {
      contentPanel.style.width = PANEL_DEFAULT + 'px';
      localStorage.setItem('ops-panel-w3', PANEL_DEFAULT);
    });
  }
})();
