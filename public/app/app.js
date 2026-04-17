// Shared runtime state is initialized in state.js.

// ═══════════════════════════════════════════════
// COMMAND PALETTE
// ═══════════════════════════════════════════════
let cmdKbIndex = null;
let cmdKbIndexPromise = null;
let cmdBuildSeq = 0;

function openCmd() {
  const overlay = document.getElementById('cmdOverlay');
  const input = document.getElementById('cmdInput');
  overlay.classList.add('open');
  overlay.classList.remove('cmd-has-query');
  input.value = '';
  cmdSelected = -1;
  buildCmdResults('');
  setTimeout(() => input.focus(), 30);
}

function buildNoteSearchSnippet(note, query) {
  const q = String(query || '').trim().toLowerCase();
  const body = String(note?.body || '').replace(/\s+/g, ' ').trim();
  if (!q) return body.slice(0, 90);
  const idx = body.toLowerCase().indexOf(q);
  if (idx === -1) return body.slice(0, 90);
  const start = Math.max(0, idx - 26);
  const end = Math.min(body.length, idx + q.length + 40);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < body.length ? '…' : '';
  return prefix + body.slice(start, end) + suffix;
}

function highlightCmdMatch(text, query) {
  const source = String(text || '');
  const q = String(query || '').trim();
  if (!q) return esc(source);
  const lower = source.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx === -1) return esc(source);
  const before = esc(source.slice(0, idx));
  const match = esc(source.slice(idx, idx + q.length));
  const after = esc(source.slice(idx + q.length));
  return `${before}<span class="cmd-item-match">${match}</span>${after}`;
}

function getCommandPaletteNoteResults(query) {
  const q = String(query || '').trim().toLowerCase();
  return Object.values(notes)
    .map(note => {
      const title = String(note?.title || '');
      const body = String(note?.body || '');
      const tags = Array.isArray(note?.tags) ? note.tags : [];
      const titleLower = title.toLowerCase();
      const bodyLower = body.toLowerCase();
      const tagHit = tags.find(tag => String(tag || '').toLowerCase().includes(q));
      const titleIdx = q ? titleLower.indexOf(q) : -1;
      const bodyIdx = q ? bodyLower.indexOf(q) : -1;
      const score =
        (titleIdx === 0 ? 120 : titleIdx > -1 ? 90 : 0) +
        (bodyIdx === 0 ? 70 : bodyIdx > -1 ? 55 : 0) +
        (tagHit ? 40 : 0) +
        Math.max(0, 20 - Math.min(titleIdx > -1 ? titleIdx : 20, 20));
      return { note, score, tagHit };
    })
    .filter(entry => q && entry.score > 0)
    .sort((a, b) => (b.score - a.score) || ((b.note.updated || 0) - (a.note.updated || 0)))
    .slice(0, 8);
}

async function ensureCommandPaletteKbIndex() {
  if (Array.isArray(cmdKbIndex)) return cmdKbIndex;
  if (!cmdKbIndexPromise) {
    cmdKbIndexPromise = fetch('/api/kb-palette-index')
      .then(async response => {
        const data = await response.json();
        if (!response.ok || data?.error) {
          throw new Error(data?.error || 'Could not load KB search index');
        }
        cmdKbIndex = Array.isArray(data?.items) ? data.items : [];
        return cmdKbIndex;
      })
      .catch(err => {
        cmdKbIndexPromise = null;
        throw err;
      });
  }
  return cmdKbIndexPromise;
}

function buildCommandPaletteKbSnippet(entry, query) {
  const q = String(query || '').trim().toLowerCase();
  const body = String(entry?.content || '').replace(/\s+/g, ' ').trim();
  if (!body) return '';
  if (!q) return body.slice(0, 110);
  const idx = body.toLowerCase().indexOf(q);
  if (idx === -1) return '';
  const start = Math.max(0, idx - 34);
  const end = Math.min(body.length, idx + q.length + 56);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < body.length ? '…' : '';
  return prefix + body.slice(start, end) + suffix;
}

function getCommandPaletteKbResults(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q || !Array.isArray(cmdKbIndex) || q.length < 2) return [];
  return cmdKbIndex
    .map(entry => {
      const content = String(entry?.content || '');
      const normalized = content.replace(/\s+/g, ' ').trim();
      const bodyIdx = normalized.toLowerCase().indexOf(q);
      if (bodyIdx === -1) return null;
      const title = String(entry?.name || '');
      const titleIdx = title.toLowerCase().indexOf(q);
      const snippet = buildCommandPaletteKbSnippet(entry, q);
      const score =
        (bodyIdx === 0 ? 90 : 45) +
        (titleIdx === 0 ? 30 : titleIdx > -1 ? 15 : 0) +
        Math.max(0, 30 - Math.min(bodyIdx, 30));
      return { entry, score, snippet };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

function closeCmd() {
  const overlay = document.getElementById('cmdOverlay');
  overlay.classList.remove('open', 'cmd-has-query');
  cmdSelected = 0; cmdItems = [];
}

function closeCmdIfOutside(e) {
  if (e.target === document.getElementById('cmdOverlay')) closeCmd();
}

const TOOLTIP_TARGET_SELECTOR = [
  '.icon-btn[title]',
  '.tb-btn[title]',
  '.note-pin-btn[title]',
  '.note-reassign-btn[title]',
  '.note-target-assign-btn[title]',
  '.editor-font-btn[title]',
  '.editor-font-label[title]',
  '.editor-font-choice[title]',
  '.preview-layout-btn[title]',
  '.sidebar-toggle-btn[title]',
  '.target-selector-copy[title]',
  '.target-selector-main[title]',
  '.svc-topbar-btn[title]',
  '.todo-topbar-btn[title]',
  '.svc-clear-btn[title]',
  '.svc-quick-add-btn[title]',
  '.todo-check-btn[title]',
  '.todo-edit-btn[title]',
  '.ql-row-edit-btn[title]',
  '.todo-del-btn[title]',
  '.session-item-export-btn[title]',
  '.target-item-del[title]',
  '.svc-del-btn[title]',
  '.notes-list-edge-btn[title]',
  '.cmd-trigger[title]',
  '.theme-toggle-btn[title]',
  '.sidebar-info-btn[title]',
  '.nav-item[title]',
  '.session-active[title]',
].join(', ');

let tooltipTarget = null;

function getTooltipEl() {
  return document.getElementById('appTooltip');
}

function getTooltipText(el) {
  if (el?.matches?.('.nav-item, .session-active')) {
    return el.dataset?.nativeTitle
      || el.getAttribute?.('title')
      || el.querySelector?.('.nav-item-label, .session-active-name')?.textContent?.trim()
      || '';
  }
  return el?.dataset?.nativeTitle || el?.getAttribute?.('title') || '';
}

function positionTooltip(target) {
  const tooltip = getTooltipEl();
  if (!tooltip || !target) return;
  const rect = target.getBoundingClientRect();
  const tipRect = tooltip.getBoundingClientRect();
  const margin = 10;
  let left = rect.left + (rect.width / 2) - (tipRect.width / 2);
  left = Math.max(margin, Math.min(window.innerWidth - tipRect.width - margin, left));
  let top = rect.top - tipRect.height - 8;
  if (top < margin) top = rect.bottom + 8;
  tooltip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
}

function hideTooltip(target = tooltipTarget) {
  const tooltip = getTooltipEl();
  if (!tooltip) return;
  if (target?.dataset?.nativeTitle && !target.getAttribute('title')) {
    target.setAttribute('title', target.dataset.nativeTitle);
  }
  tooltip.classList.remove('visible');
  tooltip.setAttribute('aria-hidden', 'true');
  tooltipTarget = null;
}

function showTooltip(target) {
  const tooltip = getTooltipEl();
  const text = getTooltipText(target);
  if (!tooltip || !target || !text) return;
  const isSidebarTarget = target.matches('.nav-item[title], .session-active[title]');
  if (isSidebarTarget) {
    const sidebar = target.closest('.sidebar');
    if (!sidebar?.classList.contains('sidebar-icon-only')) return;
  }
  if (tooltipTarget && tooltipTarget !== target) hideTooltip(tooltipTarget);
  tooltipTarget = target;
  if (!target.dataset.nativeTitle) target.dataset.nativeTitle = text;
  target.removeAttribute('title');
  tooltip.textContent = text;
  tooltip.classList.add('visible');
  tooltip.setAttribute('aria-hidden', 'false');
  positionTooltip(target);
}

document.addEventListener('mouseover', (e) => {
  const target = e.target.closest('.nav-item, .session-active') || e.target.closest(TOOLTIP_TARGET_SELECTOR);
  if (!target || target === tooltipTarget) return;
  showTooltip(target);
});

document.addEventListener('mouseout', (e) => {
  if (!tooltipTarget) return;
  const related = e.relatedTarget;
  if (related && tooltipTarget.contains(related)) return;
  if (tooltipTarget.contains(e.target)) hideTooltip(tooltipTarget);
});

document.addEventListener('focusin', (e) => {
  const target = e.target.closest('.nav-item, .session-active') || e.target.closest(TOOLTIP_TARGET_SELECTOR);
  if (target) showTooltip(target);
});

document.addEventListener('focusout', (e) => {
  if (tooltipTarget && tooltipTarget.contains(e.target)) hideTooltip(tooltipTarget);
});

window.addEventListener('scroll', () => {
  if (tooltipTarget) positionTooltip(tooltipTarget);
}, true);

window.addEventListener('resize', () => {
  if (tooltipTarget) positionTooltip(tooltipTarget);
});

async function buildCmdResults(q) {
  const seq = ++cmdBuildSeq;
  const ql    = String(q || '').toLowerCase().trim();
  const res   = document.getElementById('cmdResults');
  const overlay = document.getElementById('cmdOverlay');
  overlay?.classList.toggle('cmd-has-query', ql.length > 0);
  cmdItems    = [];
  let html    = '';
  const folderDocIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/><polyline points="14,2 14,7 19,7"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="15" y2="16"/></svg>`;
  const noteIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
  const stripLeadingEmoji = (text) => String(text || '').replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, '').trim();

  const pushCmdItem = ({ type, id, label, icon, title, sub, tag, ...rest }) => {
    cmdItems.push({ type, id, label, ...rest });
    return `<div class="cmd-item" data-idx="${cmdItems.length-1}" onclick="execCmd(${cmdItems.length-1})">
      <span class="cmd-item-icon">${icon}</span>
      <div class="cmd-item-main">
        <div class="cmd-item-title">${title}</div>
        <div class="cmd-item-sub">${sub}</div>
      </div>
      ${tag ? `<span class="cmd-item-tag">${tag}</span>` : ''}
    </div>`;
  };

  const renderCmdPlaceholder = ({ icon, title, sub }) => `
    <div class="cmd-item cmd-item-static" aria-hidden="true">
      <span class="cmd-item-icon">${icon}</span>
      <div class="cmd-item-main">
        <div class="cmd-item-title">${title}</div>
        <div class="cmd-item-sub">${sub}</div>
      </div>
    </div>`;

  if (ql.length >= 2) {
    try {
      await ensureCommandPaletteKbIndex();
    } catch (err) {
      console.warn('[PRAGMA] command palette KB index unavailable:', err?.message || err);
    }
    if (seq !== cmdBuildSeq) return;
  }

  const matchesService = (s) =>
    !ql || s.name.toLowerCase().includes(ql) || (s.port || '').includes(ql) ||
    (s.category || '').toLowerCase().includes(ql) || (s.folder || '').toLowerCase().includes(ql);

  // Services grouped by discovered KB folders first
  const folderCats = serviceCategoryMeta.filter(cat => cat.folder);
  const knownFolders = new Set(folderCats.map(cat => cat.folder));

  folderCats.forEach(cat => {
    const matches = SERVICES
      .filter(s => (s.folder || '') === cat.folder && matchesService(s))
      .slice(0, 4);
    html += `<div class="cmd-group-hdr">${esc(cat.label)}</div>`;
    if (matches.length) {
      matches.forEach(s => {
        html += pushCmdItem({
          type: 'service',
          id: s.id,
          label: s.name,
          icon: s.icon || ICONS.notes,
          title: esc(stripLeadingEmoji(s.name)),
          sub: `${esc(s.port || '')}${s.port ? ' · ' : ''}${esc(s.category || cat.label || '')}`,
          tag: 'service',
        });
      });
    } else {
      html += renderCmdPlaceholder({
        icon: folderDocIcon,
        title: 'No matching documents',
        sub: `Folder: ${esc(cat.label)}`,
      });
    }
  });

  const ungroupedServices = SERVICES
    .filter(s => !knownFolders.has(s.folder || '') && matchesService(s))
    .slice(0, 6);

  if (ungroupedServices.length) {
    html += `<div class="cmd-group-hdr">Services</div>`;
    ungroupedServices.forEach(s => {
      html += pushCmdItem({
        type: 'service',
        id: s.id,
        label: s.name,
        icon: s.icon || ICONS.notes,
        title: esc(stripLeadingEmoji(s.name)),
        sub: `${esc(s.port || '')}${s.port ? ' · ' : ''}${esc(s.category || '')}`,
        tag: 'service',
      });
    });
  }

  // Tactics
  const meths = TACTICS.filter(m =>
    !ql || m.name.toLowerCase().includes(ql) || (m.category||'').toLowerCase().includes(ql)
  ).slice(0, 5);

  if (meths.length) {
    html += `<div class="cmd-group-hdr">Tactics</div>`;
    meths.forEach(m => {
      html += pushCmdItem({
        type: 'tactic',
        id: m.id,
        label: m.name,
        icon: m.icon || ICONS.guides,
        title: esc(stripLeadingEmoji(m.name)),
        sub: esc(m.category || ''),
        tag: 'tactic',
      });
    });
  }

  const kbDocHits = getCommandPaletteKbResults(ql)
    .filter(({ entry }) => entry.type === 'knowledge');
  if (kbDocHits.length) {
    html += `<div class="cmd-group-hdr">KB Documents</div>`;
    kbDocHits.forEach(({ entry, snippet }) => {
      const scopeLabel = 'Knowledge';
      const metaParts = [scopeLabel];
      if (entry.category) metaParts.push(esc(entry.category));
      if (entry.folder) metaParts.push(esc(entry.folder));
      if (snippet) metaParts.push(highlightCmdMatch(snippet, ql));
      html += pushCmdItem({
        type: 'kbdoc',
        id: entry.id,
        view: entry.view,
        label: entry.name,
        icon: entry.icon || folderDocIcon,
        title: esc(stripLeadingEmoji(entry.name)),
        sub: metaParts.join(' · '),
        tag: entry.type === 'knowledge' ? 'kb' : entry.type,
      });
    });
  }

  // Notes
  const noteList = ql
    ? getCommandPaletteNoteResults(ql).slice(0, 5)
    : [];

  if (noteList.length) {
    html += `<div class="cmd-group-hdr">Engagement Notes</div>`;
    noteList.forEach(({ note: n, tagHit }) => {
      const sessionName = n.session_id && sessions[n.session_id]?.codename
        ? sessions[n.session_id].codename
        : 'No session';
      const snippet = buildNoteSearchSnippet(n, ql);
      const subParts = [esc(sessionName)];
      if (tagHit) subParts.push(`#${esc(tagHit)}`);
      if (snippet) subParts.push(highlightCmdMatch(snippet, ql));
      html += pushCmdItem({
        type: 'note',
        id: n.id,
        label: n.title,
        icon: noteIcon,
        title: esc(n.title || 'Untitled'),
        sub: subParts.join(' · '),
        tag: 'note',
      });
    });
  }

  // Search action
  if (ql && window.PRAGMA_CONFIG?.engramSearchEnabled) {
    cmdItems.push({ type:'search', query:ql, label:`Search "${ql}"` });
    html += `<div class="cmd-group-hdr">KB Search</div>
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
      Type to search services, tactics, KB sections and notes…
    </div>`;
  }

  res.innerHTML = html;
  cmdSelected = -1;
  updateCmdSelection();
}

function onCmdInput(val) { buildCmdResults(val); }

function onCmdKey(e) {
  if (e.key === 'Escape') { closeCmd(); return; }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (!cmdItems.length) return;
    cmdSelected = Math.min(cmdSelected + 1, cmdItems.length - 1);
    if (cmdSelected < 0) cmdSelected = 0;
    updateCmdSelection();
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (!cmdItems.length) return;
    if (cmdSelected < 0) cmdSelected = 0;
    else cmdSelected = Math.max(cmdSelected - 1, 0);
    updateCmdSelection();
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    if (!cmdItems.length) return;
    execCmd(cmdSelected >= 0 ? cmdSelected : 0);
  }
}

function updateCmdSelection() {
  document.querySelectorAll('.cmd-item[data-idx]').forEach((el, i) => {
    el.classList.toggle('selected', i === cmdSelected);
  });
}

document.addEventListener('mouseover', (e) => {
  const item = e.target.closest('#cmdResults .cmd-item[data-idx]');
  if (!item) return;
  const idx = Number(item.dataset.idx);
  if (!Number.isFinite(idx) || idx === cmdSelected) return;
  cmdSelected = idx;
  updateCmdSelection();
});

function shouldOpenCmdItemInSidePanel() {
  const noteArea = document.getElementById('noteEditArea');
  return activeView === 'notes' && !!activeNoteId && !!notes[activeNoteId] && !!noteArea && noteArea.style.display !== 'none';
}

async function commandPaletteItemExists(item) {
  if (!item) return false;
  if (item.type === 'note') return !!notes[item.id];
  if (item.type === 'service' || item.type === 'tactic') {
    const view = item.type === 'service' ? 'services' : 'tactics';
    if (getKbCollection(view).some((entry) => entry.id === item.id)) return true;
    try {
      const res = await fetch(getKbFetchConfig(view).detailUrl(item.id), { cache: 'no-store' });
      return res.ok;
    } catch (_) {
      return false;
    }
  }
  if (item.type === 'kbdoc') {
    const view = item.view || 'services';
    if (getKbCollection(view).some((entry) => entry.id === item.id)) return true;
    try {
      const res = await fetch(getKbFetchConfig(view).detailUrl(item.id), { cache: 'no-store' });
      return res.ok;
    } catch (_) {
      return false;
    }
  }
  return true;
}

async function execCmd(idx) {
  const item = cmdItems[idx];
  if (!item) return;
  closeCmd();
  if (!(await commandPaletteItemExists(item))) {
    showToast(`⚠ This ${item.type === 'note' ? 'note' : 'KB entry'} no longer exists. Refresh the search and try again.`, 'err');
    return;
  }
  if (item.type === 'service') {
    if (!shouldOpenCmdItemInSidePanel()) switchView('services');
    await openItem('services', item.id);
  } else if (item.type === 'kbdoc') {
    if (!shouldOpenCmdItemInSidePanel()) switchView('services', document.getElementById('nav-services'));
    await openItem(item.view || 'services', item.id);
  } else if (item.type === 'tactic') {
    if (!shouldOpenCmdItemInSidePanel()) switchView('tactics', document.getElementById('nav-tactics'));
    await openItem('tactics', item.id);
  } else if (item.type === 'note') {
    switchView('notes', document.getElementById('nav-notes'));
    setTimeout(() => {
      if (!notes[item.id]) {
        showToast('⚠ This note no longer exists. Refresh the search and try again.', 'err');
        return;
      }
      openNote(item.id);
    }, 50);
  } else if (item.type === 'tag') {
    switchView('notes', document.getElementById('nav-notes'));
    setTimeout(() => setTagFilter(item.tag), 50);
  } else if (item.type === 'search') {
    if (!window.PRAGMA_CONFIG?.engramSearchEnabled) return;
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

    const requirementsInfo = opts.confirm ? `
      <div class="pw-info">
        <div class="pw-info-label">Requirements</div>
        <div class="pw-info-text">
          Minimum length: <strong>8 characters</strong>. Stronger at <strong>14+</strong>. Best score uses <strong>mixed case</strong> and <strong>a number + symbol</strong>. Long passphrases of <strong>20+</strong> also score highly.
        </div>
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
        ${requirementsInfo}
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
        <button class="pw-btn ${opts.danger ? 'danger' : 'primary'}" id="pwConfirmBtn"
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

document.addEventListener('keydown', e => {
  const overlay = document.getElementById('pwOverlay');
  if (!overlay?.classList.contains('open')) return;
  const confirmBtn = document.getElementById('pwConfirmBtn');
  const active = document.activeElement;
  const inPasswordFlow = !!document.getElementById('pwInput1');

  if (e.key === 'Enter' && confirmBtn && !inPasswordFlow && active !== confirmBtn) {
    e.preventDefault();
    _pwConfirmOk();
  }
});

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
// Crypto format v2: 600k PBKDF2-SHA-512 iterations, 32-byte salt, AES-256-GCM
// Crypto format v1: 310k PBKDF2-SHA-256, 16-byte salt — read-only legacy support
//
// Note: AES-GCM provides built-in authenticated encryption via the GHASH tag.
// Any tampering with ciphertext, IV, or AAD causes decrypt to throw — no
// separate HMAC is required on top of GCM. pragma_version tracks the overall
// workbench payload version; crypto_version tracks which KDF parameters to use
// for encrypted blobs.

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
  return {
    pragma_version: 1,
    crypto_version: 2,
    encrypted: true,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(ct),
  };
}

function bytesToBase64(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  const chunkSize = 0x8000;
  let binary = '';
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(String(value || '')), c => c.charCodeAt(0));
}

async function encryptBinaryPayload(buffer, password, mimeType = 'application/octet-stream', filename = '') {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const key  = await deriveKey(password, salt, 2);
  const source = buffer instanceof ArrayBuffer ? buffer : new Uint8Array(buffer).buffer;
  const ct   = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, source);
  return {
    pragma_version: 1,
    crypto_version: 2,
    encrypted: true,
    kind: 'attachment',
    mime_type: String(mimeType || 'application/octet-stream'),
    filename: String(filename || ''),
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(ct),
  };
}

async function decryptPayload(obj, password) {
  const salt   = base64ToBytes(obj.salt);
  const iv     = base64ToBytes(obj.iv);
  const ct     = base64ToBytes(obj.data);
  // Support both legacy blobs keyed by pragma_version and newer blobs that
  // separate workbench version from crypto_version.
  const version = obj.crypto_version >= 2
    ? 2
    : (obj.pragma_version >= 2 || salt.length >= 32 ? 2 : 1);
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

async function decryptBinaryPayload(obj, password) {
  const salt = base64ToBytes(obj.salt);
  const iv   = base64ToBytes(obj.iv);
  const ct   = base64ToBytes(obj.data);
  const version = obj.crypto_version >= 2
    ? 2
    : (obj.pragma_version >= 2 || salt.length >= 32 ? 2 : 1);
  const key = await deriveKey(password, salt, version);
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return {
      buffer: plain,
      mimeType: String(obj.mime_type || 'application/octet-stream'),
      filename: String(obj.filename || ''),
    };
  } catch {
    throw new Error('Wrong password or corrupted data');
  }
}

// ═══════════════════════════════════════════════
// RESIZABLE PANELS
// ═══════════════════════════════════════════════
let notesListHidden = localStorage.getItem('ops-notes-list-hidden') === '1';

function applyNotesListVisibility() {
  const layout = document.querySelector('.notes-layout');
  const editorBtn = document.getElementById('notesListToggleBtnEditor');
  const listBtn = document.getElementById('notesListToggleBtn');
  const reopenBtn = document.getElementById('notesListReopenBtn');
  const peekBtn = document.getElementById('notesListPeekBtn');
  if (layout) layout.classList.toggle('notes-list-hidden', notesListHidden);
  if (editorBtn) {
    editorBtn.title = notesListHidden ? 'Show notes list' : 'Hide notes list';
    editorBtn.innerHTML = notesListHidden
      ? '<span style="display:flex;align-items:center;gap:5px"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="9" y1="4" x2="9" y2="20"/><polyline points="13,9 16,12 13,15"/></svg> Show List</span>'
      : '<span style="display:flex;align-items:center;gap:5px"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="9" y1="4" x2="9" y2="20"/><polyline points="15,9 12,12 15,15"/></svg> Hide List</span>';
  }
  if (listBtn) listBtn.title = notesListHidden ? 'Show notes list' : 'Hide notes list';
  if (reopenBtn) reopenBtn.title = notesListHidden ? 'Show notes list' : 'Hide notes list';
  if (peekBtn) peekBtn.title = 'Quick note switcher';
  if (!notesListHidden && typeof closeNotesPeek === 'function') closeNotesPeek();
  localStorage.setItem('ops-notes-list-hidden', notesListHidden ? '1' : '0');
}

function toggleNotesList() {
  notesListHidden = !notesListHidden;
  applyNotesListVisibility();
}

function applyNotesListDensity(el) {
  if (!el) return;
  const width = el.getBoundingClientRect().width;
  const nextCompact = width > 0 && width < 270;
  if (el.classList.contains('notes-list-compact') === nextCompact) return false;
  el.classList.toggle('notes-list-compact', nextCompact);
  return true;
}

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
  applyNotesListDensity(notesList);
  applyNotesListVisibility();

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
      applyNotesListDensity(notesList);
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

  if (notesList && typeof ResizeObserver !== 'undefined') {
    let notesDensityFrame = 0;
    const ro = new ResizeObserver(() => {
      if (notesDensityFrame) return;
      notesDensityFrame = requestAnimationFrame(() => {
        notesDensityFrame = 0;
        applyNotesListDensity(notesList);
      });
    });
    ro.observe(notesList);
  }
})();
