// ═══════════════════════════════════════════════
// WORKBENCH STATE
// ═══════════════════════════════════════════════
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

const NOTE_TEMPLATES_FALLBACK = {
  general:     { title: '',                    body: `## Overview\n\n\n## Notes\n\n\n## References\n\n` },
  credentials: { title: 'Credentials',         body: `## Credentials\n\n| Username | Password | Hash | Service | Notes |\n|----------|----------|------|---------|-------|\n|          |          |      |         |       |\n\n## Password Spray / Stuffing Notes\n\n\n## Valid Sessions / Tokens\n\n` },
  privesc:     { title: 'Privilege Escalation', body: `## System Info\n\n| Field     | Value |\n|-----------|-------|\n| OS        |       |\n| Kernel    |       |\n| Hostname  |       |\n| Current User |    |\n| Groups    |       |\n\n## Enumeration\n\n### SUID / SGID Binaries\n\n\n### Sudo Rights\n\n\n### Cron Jobs\n\n\n### Writable Paths / Misconfigs\n\n\n### Interesting Files\n\n\n## Vectors Attempted\n\n| Vector | Result | Notes |\n|--------|--------|-------|\n|        |        |       |\n\n## Escalation Path\n\n\n` },
  recon:       { title: 'Recon',               body: `## Target Overview\n\n| Field   | Value |\n|---------|-------|\n| IP      |       |\n| Domain  |       |\n| OS      |       |\n| In Scope|       |\n\n## Open Ports & Services\n\n| Port | Proto | Service | Version | Notes |\n|------|-------|---------|---------|-------|\n|      |       |         |         |       |\n\n## Web Endpoints\n\n\n## DNS / Hostnames\n\n\n## Users / Groups Discovered\n\n\n## Findings\n\n` },
  loot:        { title: 'Loot',                body: `## Files & Data\n\n| Path | Description | Hash / Value | Exfil Method |\n|------|-------------|--------------|--------------|\n|      |             |              |              |\n\n## Credentials Found\n\n\n## Flags / Proofs\n\n\`\`\`\n# root.txt / user.txt / proof.txt\n\n\`\`\`\n\n## Notes\n\n` },
  exploit:     { title: 'Exploit',             body: `## Vulnerability\n\n| Field       | Value |\n|-------------|-------|\n| Name        |       |\n| CVE         |       |\n| CVSS        |       |\n| Affected    |       |\n| Auth Required|      |\n\n## Payload\n\n\`\`\`bash\n\n\`\`\`\n\n## Steps\n\n1. \n2. \n3. \n\n## Outcome\n\n\n## Cleanup / Artifacts to Remove\n\n` },
  scratch:     { title: '',                    body: '' },
};

let NOTE_TEMPLATES = { ...NOTE_TEMPLATES_FALLBACK };

let encryptedStorageEnabled  = false;
let encryptedStoragePassword = null;
let encryptedStorageHint     = '';
let workbenchUnlocked        = true;

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
  btn.innerHTML = '<span style="display:flex;align-items:center;gap:5px">' + ICONS.lock + ' Encrypted Workbench</span>';
  if (dlBtn) dlBtn.style.display = encryptedStorageEnabled ? '' : 'none';
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
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('✓ Backup downloaded: ' + filename);
  } catch (err) {
    showToast('⚠ Backup download failed: ' + err.message, 'err');
  }
}

async function toggleEncryptedStorage(e) {
  try { e?.stopPropagation?.(); } catch (_) {}

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
    } catch { return; }
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
    } catch { return; }
    encryptedStorageEnabled  = false;
    encryptedStoragePassword = null;
    updateEncryptedStorageUI();
    try {
      await fetch('/api/notes/storage/disable-encrypted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessions, notes }),
      });
    } catch (_) {}
    saveNotes();
  }
}

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
      localStorage.setItem('ops-notes-v2-encrypted', JSON.stringify(encObj));
      localStorage.removeItem('ops-notes-v2');
    } else {
      notes    = (d.notes !== undefined ? d.notes : d) || {};
      sessions = d.sessions || {};
      localStorage.setItem('ops-notes-v2', JSON.stringify({ notes, sessions }));
      localStorage.removeItem('ops-notes-v2-encrypted');
      encryptedStorageEnabled  = false;
      encryptedStoragePassword = null;
      updateEncryptedStorageUI();
    }
  } catch (outerErr) {
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
        notes    = cached.notes || {};
        sessions = cached.sessions || {};
      }
    } catch (innerErr) {
      if (innerErr.message && (innerErr.message.includes('decrypt') || innerErr.message.includes('Password') || innerErr.message.includes('Incorrect') || innerErr.message.includes('cancelled') || innerErr.message.includes('required'))) {
        throw innerErr;
      }
      notes = {};
      sessions = {};
    }
  }

  const savedSid = localStorage.getItem('ops-active-session');
  if (savedSid && sessions[savedSid]) activeSessionId = savedSid;
  else if (Object.keys(sessions).length) activeSessionId = Object.keys(sessions)[0];

  renderSessionSidebar();
  renderNotesList();
  document.getElementById('notes-count').textContent = Object.keys(notes).length || '—';

  const sess = activeSessionId && sessions[activeSessionId];
  const targets = (sess && sess.targets) || [];
  const savedTgt = localStorage.getItem('ops-active-target');
  if (savedTgt && targets.find(t => t.id === savedTgt)) {
    activeTargetId = savedTgt;
  } else if (targets.length) {
    activeTargetId = targets[0].id;
    localStorage.setItem('ops-active-target', activeTargetId);
  }
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
    (async () => {
      try {
        if (!encryptedStoragePassword) return;
        const blob = await encryptPayload(JSON.stringify(payload), encryptedStoragePassword);
        if (encryptedStorageHint) blob.hint = encryptedStorageHint;
        localStorage.setItem('ops-notes-v2-encrypted', JSON.stringify(blob));
        localStorage.removeItem('ops-notes-v2');
        await fetch('/api/notes/save-encrypted', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blob }),
        });
      } catch (_) {}
    })();
  } else {
    localStorage.setItem('ops-notes-v2', JSON.stringify(payload));
    localStorage.removeItem('ops-notes-v2-encrypted');
    fetch('/api/notes/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }
}

function renderSessionSidebar() {
  const dot    = document.getElementById('sessionDot');
  const name   = document.getElementById('sessionName');
  const target = document.getElementById('sessionTarget');
  const sess   = activeSessionId && sessions[activeSessionId];
  if (sess) {
    const status = sess.status || 'active';
    dot.className = 'session-active-dot ' + (status === 'active' ? 'live' : status);
    name.textContent = sess.codename;
    const activeTgt = (sess.targets || []).find(t => t.id === activeTargetId) || (sess.targets || [])[0];
    if (activeTgt) target.textContent = [activeTgt.ip, activeTgt.domain].filter(Boolean).join(' · ') || activeTgt.label || 'no target set';
    else target.textContent = '—';
    target.style.color = '';
    const badge = document.getElementById('sessionNotesBadge');
    if (badge) {
      const n = Object.values(notes).filter(nt => nt.session_id === activeSessionId).length;
      badge.textContent = n + ' note' + (n !== 1 ? 's' : '');
      badge.style.display = n > 0 ? '' : 'none';
    }
  } else {
    dot.className = 'session-active-dot';
    name.textContent = 'No session';
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
  const list = document.getElementById('sessionList');
  const entries = Object.values(sessions).sort((a, b) => (b.created || 0) - (a.created || 0));
  if (!entries.length) {
    list.innerHTML = '<div class="session-list-hdr" style="padding-top:4px">No sessions yet</div>';
    return;
  }
  const noteCount   = id => Object.values(notes).filter(n => n.session_id === id).length;
  const targetCount = id => (sessions[id]?.targets || []).length;
  const statusLabel = { active: 'Active', paused: 'Paused', complete: 'Complete' };
  list.innerHTML = '<div class="session-list-hdr">Existing sessions</div>' +
    entries.map(s => {
      const status = s.status || 'active';
      const tCount = targetCount(s.id);
      const tLabel = tCount === 0 ? '<span style="color:var(--accent)">no targets</span>' : `${tCount} target${tCount !== 1 ? 's' : ''}`;
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
    </div>`;
    }).join('');
}

function createSession() {
  const name = document.getElementById('newSessionName').value.trim();
  if (!name) { document.getElementById('newSessionName').focus(); return; }
  const id = 'sess_' + Date.now();
  const sess = { id, codename: name, created: Date.now(), targets: [] };
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
  dd.classList.remove('open');
  _statusDropdownTarget = null;
  if (isOpen) return;
  const pill = e.currentTarget;
  const rect = pill.getBoundingClientRect();
  dd.style.top  = (rect.bottom + 4) + 'px';
  dd.style.left = rect.left + 'px';
  _statusDropdownTarget = sessId;
  dd.classList.add('open');
  setTimeout(() => {
    const handler = ev => {
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
  activeNoteScope = 'session';
  activeTargetFilter = null;
  activeNoteSearch = '';
  const searchEl = document.getElementById('noteSearchInput');
  if (searchEl) searchEl.value = '';
  document.querySelectorAll('.note-scope-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.scope === 'session'));
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
  if (e.key === 'Enter') _sessionRenameSave();
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

async function importSession(event) {
  const file = event.target.files[0];
  if (!file) return;
  const fb = document.getElementById('importFeedback');
  fb.style.display = 'block';
  fb.className = 'import-feedback';
  fb.textContent = '⏳ Importing…';

  const reader = new FileReader();
  reader.onload = async e => {
    try {
      let parsed = JSON.parse(e.target.result);
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
        } catch (decErr) {
          fb.className = 'import-feedback err';
          fb.textContent = '✗ ' + decErr.message;
          event.target.value = '';
          return;
        }
      }

      const data = parsed;
      if (!data.session || !data.notes) throw new Error('Invalid .session file');

      const newSessId = 'sess_' + Date.now();
      const importedSess = {
        ...data.session,
        id: newSessId,
        created: data.session.created || Date.now(),
        imported_from: data.session.codename,
      };

      sessions[newSessId] = importedSess;

      let noteCount = 0;
      data.notes.forEach(n => {
        const newNoteId = 'note_' + Date.now() + '_' + (noteCount++);
        notes[newNoteId] = {
          ...n,
          id: newNoteId,
          session_id: newSessId,
        };
      });

      saveNotes();
      switchSession(newSessId);
      renderSessionList();

      fb.className = 'import-feedback ok';
      fb.textContent = '✓ Imported "' + importedSess.codename + '" — ' + noteCount + ' note' + (noteCount !== 1 ? 's' : '');
      setTimeout(() => { fb.style.display = 'none'; }, 4000);
    } catch (err) {
      fb.className = 'import-feedback err';
      fb.textContent = '✗ ' + err.message;
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}
