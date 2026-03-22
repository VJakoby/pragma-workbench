// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════
let SERVICES      = [];
let TACTICS       = [];
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

  // Fetch tactics
  try {
    const r = await fetch('/api/tactics');
    const d = await r.json();
    TACTICS = d.tactics || d.guides || [];
  } catch(e) { console.warn('tactics unavailable', e); }

  // Fetch note templates (falls back to hardcoded if missing)
  await loadNoteTemplates();
  renderNoteTypeGrid();

  document.getElementById('svc-count').textContent  = SERVICES.length;
  document.getElementById('tactics-count').textContent = TACTICS.length;

  renderCards('services');
  renderCards('tactics');
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
  if (view === 'services' || view === 'tactics') {
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

  // Tactics
  const meths = TACTICS.filter(m =>
    !ql || m.name.toLowerCase().includes(ql) || (m.category||'').toLowerCase().includes(ql)
  ).slice(0, 5);

  if (meths.length) {
    html += `<div class="cmd-group-hdr">Tactics</div>`;
    meths.forEach(m => {
      cmdItems.push({ type:'tactic', id:m.id, label:m.name });
      html += `<div class="cmd-item" data-idx="${cmdItems.length-1}" onclick="execCmd(${cmdItems.length-1})">
        <span class="cmd-item-icon">${m.icon||ICONS.guides}</span>
        <div class="cmd-item-main">
          <div class="cmd-item-title">${esc(m.name)}</div>
          <div class="cmd-item-sub">${esc(m.category||'')}</div>
        </div>
        <span class="cmd-item-tag">tactic</span>
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
        <div class="cmd-item-sub">Search across indexed knowledge bases and sources</div>
      </div>
    </div>`;
  }

  if (!html) {
    html = `<div style="padding:24px;text-align:center;color:var(--muted);font-size:13px;font-family:'Inter',sans-serif">
      Type to search services, tactics and notes…
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
  } else if (item.type === 'tactic') {
    switchView('tactics', document.getElementById('nav-tactics'));
    openItem('tactics', item.id);
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
      '3': ['tactics', 'nav-tactics'],
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
    ['nav-tactics', '⌘2'],
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
