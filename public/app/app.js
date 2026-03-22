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
