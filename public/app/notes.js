// ═══════════════════════════════════════════════
// NOTES
// ═══════════════════════════════════════════════
let activeNoteFilter = 'all';
let activeNoteScope  = 'session';
let activeTagFilter  = null;
let activeTargetFilter = null;
let activeNoteSearch = '';
let notesPeekSearch = '';
let notesPeekOpen = false;
let notesPeekCloseTimer = null;
let notesPeekHoldOpenUntil = 0;
let notesPeekIgnoreDocumentCloseUntil = 0;
let activeNewNoteType = null;
let _evidenceFlagResolver = null;
let _evidenceSelectionPromptTimer = null;
let _evidenceSelectionPromptState = null;
let attachmentStorageSidebarTimer = null;
let attachmentStorageSidebarSeq = 0;
let attachmentStorageSidebarStateKey = '';
let attachmentStorageSidebarLoaded = false;
let attachmentStoragePayload = null;
const CONFIG_TEMPLATES_PATH = '/api/config/templates';
const EVIDENCE_TYPE_OPTIONS = [
  { value: 'enumeration', label: 'Enumeration' },
  { value: 'initial_access', label: 'Initial Access' },
  { value: 'execution', label: 'Execution' },
  { value: 'persistence', label: 'Persistence' },
  { value: 'privilege_escalation', label: 'Privilege Escalation' },
  { value: 'credential_access', label: 'Credential Access' },
  { value: 'discovery', label: 'Discovery' },
  { value: 'lateral_movement', label: 'Lateral Movement' },
  { value: 'pivoting', label: 'Pivoting' },
  { value: 'collection', label: 'Collection' },
  { value: 'exfiltration', label: 'Exfiltration' },
  { value: 'cleanup', label: 'Cleanup' },
  { value: 'proof', label: 'Proof' },
];
window.EVIDENCE_TYPE_OPTIONS = EVIDENCE_TYPE_OPTIONS;

function getLeadingNoteH1(body) {
  const match = String(body || '').match(/^\s*#\s+(.+?)\s*(?:\n|$)/);
  return match ? match[1].trim() : '';
}

function replaceLeadingNoteH1(body, title) {
  const source = String(body || '');
  const nextTitle = String(title || '').trim();
  if (!nextTitle) return source;
  if (/^\s*#\s+.+?(?:\n|$)/.test(source)) {
    return source.replace(/^\s*#\s+.+?(?=\n|$)/, `# ${nextTitle}`);
  }
  return `# ${nextTitle}\n\n${source.trimStart()}`.trimEnd() + '\n';
}

function syncNoteTitleAndHeading(note, nextTitle, nextBody) {
  const prevTitle = String(note?.title || '').trim();
  const prevBody = String(note?.body || '');
  let title = String(nextTitle || '').trim();
  let body = String(nextBody || '');

  const prevH1 = getLeadingNoteH1(prevBody);
  let currentH1 = getLeadingNoteH1(body);
  const titleChanged = title !== prevTitle;
  const h1Changed = currentH1 !== prevH1;
  const wasSynced = !prevTitle || !prevH1 || prevTitle === prevH1;

  if (!body.trim()) {
    if (title) body = `# ${title}\n\n`;
    return { title, body };
  }

  if (titleChanged && wasSynced && currentH1 && !h1Changed) {
    body = replaceLeadingNoteH1(body, title);
    currentH1 = getLeadingNoteH1(body);
  } else if (h1Changed && currentH1 && wasSynced && !titleChanged) {
    title = currentH1;
  } else if (!title && currentH1) {
    title = currentH1;
  } else if (title && !currentH1 && wasSynced) {
    body = replaceLeadingNoteH1(body, title);
  }

  return { title, body };
}

function setNoteEditorMode(mode) {
  const isConfig = mode === 'config';
  const editor = document.getElementById('notesEditor');
  const badge = document.getElementById('noteTypeBadge');
  const title = document.getElementById('noteTitleInput');
  const pin = document.getElementById('notePinBtn');
  const reassign = document.getElementById('noteReassignWrap');
  const target = document.getElementById('noteTargetAssignWrap');
  const previewBtn = document.getElementById('notePreviewBtn');
  const unifiedBtn = document.getElementById('noteUnifiedBtn');
  const evidenceBtn = document.getElementById('noteFlagEvidenceBtn');
  const hint = document.querySelector('.note-md-hint');
  const timestamps = document.getElementById('noteTimestamps');
  const createdWrap = document.getElementById('noteCreatedWrap');
  const modifiedWrap = document.getElementById('noteModifiedWrap');
  const tags = document.getElementById('noteTagsRow');
  const backlinks = document.getElementById('noteBacklinks');
  const exportBtn = document.getElementById('noteExportBtn');
  const attachmentCleanupBtn = document.getElementById('noteAttachmentCleanupBtn');
  const duplicateBtn = document.getElementById('noteDuplicateBtn');
  const deleteBtn = document.getElementById('noteDeleteBtn');
  const previewPane = document.getElementById('notePreviewPane');
  const previewHandle = document.getElementById('notePreviewHandle');
  const layoutToggle = document.getElementById('previewLayoutToggle');
  const split = document.getElementById('noteEditorSplit');
  const unifiedSurface = document.getElementById('noteUnifiedSurface');

  if (editor) editor.classList.toggle('config-mode', isConfig);
  if (badge) {
    if (isConfig) {
      badge.textContent = '⚙ Note Templates';
      badge.className = 'note-item-type note-type-config';
    }
  }
  if (title) {
    title.readOnly = isConfig;
    title.placeholder = isConfig ? '' : 'Note title…';
  }
  if (pin) pin.style.display = isConfig ? 'none' : '';
  if (reassign) reassign.style.display = isConfig ? 'none' : '';
  if (target) target.style.display = isConfig ? 'none' : '';
  if (previewBtn) previewBtn.style.display = isConfig ? 'none' : '';
  if (unifiedBtn) unifiedBtn.style.display = isConfig ? 'none' : '';
  if (evidenceBtn) evidenceBtn.style.display = isConfig ? 'none' : '';
  if (hint) hint.style.display = isConfig ? 'none' : '';
  if (timestamps) timestamps.style.display = '';
  if (createdWrap) createdWrap.style.display = isConfig ? 'none' : '';
  if (modifiedWrap) modifiedWrap.style.display = isConfig ? 'none' : '';
  if (tags) tags.style.display = isConfig ? 'none' : '';
  if (backlinks) backlinks.style.display = isConfig ? 'none' : '';
  if (duplicateBtn) duplicateBtn.style.display = isConfig ? 'none' : '';
  if (deleteBtn) deleteBtn.style.display = isConfig ? 'none' : '';
  if (attachmentCleanupBtn) attachmentCleanupBtn.style.display = isConfig ? '' : 'none';
  if (exportBtn) exportBtn.title = isConfig ? 'Download note-templates.json' : 'Export note as .md';
  if (split) {
    if (isConfig) {
      split.classList.remove('preview-open', 'split-side', 'preview-unified');
      split.style.removeProperty('--note-editor-w');
      split.style.removeProperty('--note-editor-h');
    } else {
      applyNotePreviewState();
    }
  }
  if (unifiedSurface && isConfig) unifiedSurface.style.display = 'none';
  if (previewPane && isConfig) previewPane.style.display = 'none';
  if (previewHandle && isConfig) previewHandle.style.display = 'none';
  if (layoutToggle && isConfig) layoutToggle.classList.remove('visible');
  if (isConfig) hideEvidenceSelectionPrompt();
}

function ensureNoteTypeBadge() {
  let badge = document.getElementById('noteTypeBadge');
  if (!badge) {
    badge = document.createElement('span');
    badge.id = 'noteTypeBadge';
    badge.className = 'note-item-type';
    document.querySelector('.notes-editor-hdr').prepend(badge);
  }
  return badge;
}

async function fetchTemplatesConfigDoc() {
  const r = await fetch(CONFIG_TEMPLATES_PATH);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Failed to load note-templates.json');
  return String(d.content || '');
}

async function persistTemplatesConfig(opts = {}) {
  if (activeConfigDoc !== 'templates') return false;
  const content = cmGetValue(noteEditor);
  const seq = beginAppSave(opts.statusText || '...saving');
  try {
    const res = await fetch(CONFIG_TEMPLATES_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Save failed');
    await loadNoteTemplates();
    finishAppSaveSuccess(seq, 'saved');
    return true;
  } catch (err) {
    finishAppSaveError(seq, err, 'invalid json');
    if (opts.toast !== false) showToast(`⚠ ${err.message}`, 'err');
    return false;
  }
}

function autoSaveTemplatesConfig() {
  if (activeConfigDoc !== 'templates') return;
  setNoteSaveIndicator('saving', '...saving');
  clearTimeout(noteSaveTimer);
  noteSaveTimer = setTimeout(() => { persistTemplatesConfig({ reason: 'config-autosave', toast: false }); }, 600);
}

function autoSaveActiveConfig() {
  if (activeConfigDoc === 'templates') autoSaveTemplatesConfig();
}

async function openTemplatesConfig(navEl) {
  if (activeNoteId && notes[activeNoteId]) {
    const noteId = activeNoteId;
    clearTimeout(noteSaveTimer);
    await persistActiveNote({ reason: 'note-switch', immediate: true, noteId });
  }
  activeNoteId = null;
  activeConfigDoc = 'templates';
  if (typeof persistLastLocation === 'function') persistLastLocation({ view: 'notes', noteId: null, configDoc: 'templates' });
  switchView('notes', navEl || document.getElementById('nav-config-templates'));
  renderNotesList();

  document.getElementById('notesEmpty').style.display = 'none';
  const area = document.getElementById('noteEditArea');
  area.style.display = 'flex';

  const badge = ensureNoteTypeBadge();
  badge.textContent = '⚙ Note Templates';
  badge.className = 'note-item-type note-type-config';

  const title = document.getElementById('noteTitleInput');
  title.value = 'note-templates.json';
  title.oninput = null;
  setNoteEditorMode('config');
  setNoteSaveIndicator('saving', 'loading…');

  try {
    const content = await fetchTemplatesConfigDoc();
    cmInitNote(content);
    setNoteSaveIndicator('saved', 'saved');
  } catch (err) {
    cmInitNote('');
    setNoteSaveIndicator('error', 'load failed');
    showToast(`⚠ ${err.message}`, 'err');
  }
}

function closeConfigEditor() {
  clearTimeout(noteSaveTimer);
  hideEvidenceSelectionPrompt();
  activeConfigDoc = null;
  if (typeof clearLastLocationFields === 'function') clearLastLocationFields('configDoc');
  setNoteEditorMode('note');
  document.getElementById('notesEmpty').style.display = 'flex';
  document.getElementById('noteEditArea').style.display = 'none';
  document.getElementById('nav-config-templates')?.classList.remove('active');
  renderNotesList();
}

function formatAttachmentStorageBytes(bytes) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value >= 10240 ? 0 : 1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function buildAttachmentStorageSidebarStateKey() {
  return Object.keys(notes || {})
    .sort()
    .map((id) => {
      const note = notes[id] || {};
      const body = String(note.body || '');
      const attachmentCount = (body.match(/\/api\/notes\/attachments\//g) || []).length;
      return `${id}:${note.updated || 0}:${attachmentCount}`;
    })
    .join('|');
}

function buildAttachmentStorageSummaryText(summary = {}) {
  const tracked = Number(summary.tracked_count || 0);
  const orphaned = Number(summary.orphaned_count || 0);
  const missing = Number(summary.missing_count || 0);
  const sizeLabel = formatAttachmentStorageBytes(summary.total_bytes || 0);
  if (!tracked) {
    if (orphaned) return `${orphaned} orphaned file${orphaned === 1 ? "" : "s"} · ${sizeLabel} total`;
    return 'No attachment usage yet';
  }
  const parts = [`${tracked} file${tracked === 1 ? "" : "s"}`, sizeLabel + ' total'];
  if (orphaned) parts.push(`${orphaned} orphaned`);
  if (missing) parts.push(`${missing} missing`);
  return parts.join(' · ');
}

function buildAttachmentStorageModalSummaryText(summary = {}) {
  const tracked = Number(summary.tracked_count || 0);
  const refs = Number(summary.referenced_note_count || 0);
  const orphaned = Number(summary.orphaned_count || 0);
  const missing = Number(summary.missing_count || 0);
  const sizeLabel = formatAttachmentStorageBytes(summary.total_bytes || 0);
  const parts = [`${tracked} tracked file${tracked === 1 ? "" : "s"}`, `${refs} note link${refs === 1 ? "" : "s"}`, sizeLabel + ' total'];
  if (orphaned) parts.push(`${orphaned} orphaned`);
  if (missing) parts.push(`${missing} missing`);
  return 'Workbench-wide attachment usage: ' + parts.join(' · ');
}

function closeAttachmentStorageModal() {
  document.getElementById('attachmentStorageOverlay')?.classList.remove('open');
}

function openAttachmentStorageModal() {
  document.getElementById('attachmentStorageOverlay')?.classList.add('open');
  if (!attachmentStoragePayload) scheduleAttachmentStorageSidebarRefresh(true);
}

function openAttachmentStorageNote(noteId) {
  closeAttachmentStorageModal();
  if (noteId) openNote(noteId);
}

function renderAttachmentStorageModal(payload) {
  const summaryEl = document.getElementById('attachmentStorageModalSummary');
  const listEl = document.getElementById('attachmentStorageModalList');
  if (!summaryEl || !listEl) return;

  const summary = payload?.summary || {};
  const items = Array.isArray(payload?.attachments) ? payload.attachments : [];
  summaryEl.textContent = buildAttachmentStorageModalSummaryText(summary);

  if (!items.length) {
    listEl.innerHTML = '<div class="attachment-storage-empty modal-empty">Attach images in notes to track them across the workbench.</div>';
    return;
  }

  listEl.innerHTML = items.map((item) => {
    const refsLabel = `${item.reference_count || 0} linked note${Number(item.reference_count || 0) === 1 ? "" : "s"}`;
    const statusLabel = item.orphaned ? 'orphaned' : item.missing ? 'missing' : (item.mode === 'encrypted' ? 'encrypted' : item.mode === 'raw' ? 'stored' : 'unresolved');
    const ownerButton = item.owner_note_id
      ? `<button type="button" class="attachment-storage-owner-link" onclick="openAttachmentStorageNote('${item.owner_note_id}')">${esc(item.owner_note_title || "Owner Note")}</button>`
      : '';
    const ownerSession = item.owner_session_name
      ? `<span class="attachment-storage-owner-session">${esc(item.owner_session_name)}</span>`
      : '';
    const ownerContext = ownerButton
      ? `<div class="attachment-storage-owner-row">${ownerButton}</div>`
      : '';
    const sessionBadge = ownerSession
      ? `<div class="attachment-storage-session-row">${ownerSession}</div>`
      : '';
    const noteRefs = (Array.isArray(item.references) ? item.references : []).filter((ref) => ref.id !== item.owner_note_id);
    const refsHtml = noteRefs.slice(0, 5).map((ref) =>
      `<button type="button" class="attachment-storage-note-link" onclick="openAttachmentStorageNote('${ref.id}')" title="${esc(ref.title || "Untitled")}">${esc(ref.title || "Untitled")}</button>`
    ).join('');
    const extraCount = Math.max(0, noteRefs.length - 5);
    const moreHtml = extraCount ? `<span class="attachment-storage-pill">+${extraCount} more</span>` : '';
    return `<div class="attachment-storage-item modal-item${item.orphaned ? " orphaned" : item.missing ? " missing" : ""}">
      <div class="attachment-storage-head modal-head">
        <div class="attachment-storage-head-main">
          ${sessionBadge}
          <div class="attachment-storage-name modal-name" title="${esc(item.filename || "")}">${esc(item.filename || "attachment")}</div>
        </div>
        <div class="attachment-storage-size modal-size">${formatAttachmentStorageBytes(item.size_bytes || 0)}</div>
      </div>
      <div class="attachment-storage-meta modal-meta">
        <span class="attachment-storage-pill${item.orphaned ? " status-orphaned" : item.missing ? " status-missing" : ""}">${statusLabel}</span>
        <span class="attachment-storage-pill">${refsLabel}</span>
      </div>
      ${ownerContext}
      <div class="attachment-storage-notes modal-notes">${refsHtml || '<span class="attachment-storage-pill">No linked notes</span>'}${moreHtml}</div>
    </div>`;
  }).join('');
}

function renderAttachmentStorageSidebar(payload) {
  const summaryEl = document.getElementById('attachmentStorageSummary');
  const countEl = document.getElementById('attachmentStorageCount');
  const modalSummaryEl = document.getElementById('attachmentStorageModalSummary');
  const modalListEl = document.getElementById('attachmentStorageModalList');
  if (!summaryEl || !countEl) return;

  attachmentStoragePayload = payload || null;
  const summary = payload?.summary || {};
  const tracked = Number(summary.tracked_count || 0);
  summaryEl.textContent = buildAttachmentStorageSummaryText(summary);
  countEl.textContent = tracked || '—';
  renderAttachmentStorageModal(payload);

  if (!tracked && modalSummaryEl && modalListEl) {
    modalSummaryEl.textContent = buildAttachmentStorageModalSummaryText(summary);
  }
}

async function refreshAttachmentStorageSidebar(force = false, precomputedKey = '') {
  const summaryEl = document.getElementById('attachmentStorageSummary');
  const countEl = document.getElementById('attachmentStorageCount');
  const modalSummaryEl = document.getElementById('attachmentStorageModalSummary');
  const modalListEl = document.getElementById('attachmentStorageModalList');
  if (!summaryEl || !countEl) return;

  const stateKey = precomputedKey || buildAttachmentStorageSidebarStateKey();
  if (!force && attachmentStorageSidebarLoaded && stateKey === attachmentStorageSidebarStateKey) return;
  attachmentStorageSidebarStateKey = stateKey;
  const seq = ++attachmentStorageSidebarSeq;
  summaryEl.textContent = 'Loading…';
  countEl.textContent = '—';
  if (modalSummaryEl) modalSummaryEl.textContent = 'Loading attachment usage…';
  if (modalListEl && !attachmentStorageSidebarLoaded) modalListEl.innerHTML = '<div class="attachment-storage-empty modal-empty">Loading attachment usage…</div>';

  try {
    const res = await fetch('/api/notes/attachments/usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions, notes }),
    });
    const data = await res.json().catch(() => ({}));
    if (seq !== attachmentStorageSidebarSeq) return;
    if (!res.ok || data.ok !== true) throw new Error(data.error || 'Failed to load attachment usage');
    attachmentStorageSidebarLoaded = true;
    renderAttachmentStorageSidebar(data);
  } catch (err) {
    if (seq !== attachmentStorageSidebarSeq) return;
    attachmentStorageSidebarLoaded = false;
    attachmentStoragePayload = null;
    summaryEl.textContent = 'Attachment usage unavailable';
    countEl.textContent = '—';
    if (modalSummaryEl) modalSummaryEl.textContent = 'Attachment usage unavailable';
    if (modalListEl) modalListEl.innerHTML = `<div class="attachment-storage-empty modal-empty">${esc(err.message || "Attachment usage unavailable")}</div>`;
  }
}

function scheduleAttachmentStorageSidebarRefresh(force = false) {
  const nextKey = buildAttachmentStorageSidebarStateKey();
  if (!force && attachmentStorageSidebarLoaded && nextKey === attachmentStorageSidebarStateKey) return;
  clearTimeout(attachmentStorageSidebarTimer);
  attachmentStorageSidebarTimer = setTimeout(() => {
    refreshAttachmentStorageSidebar(force, nextKey);
  }, force ? 0 : 80);
}

function renderNoteFilterBar() {
  const bar = document.getElementById('notesTypeFilter');
  if (!bar) return;

  let html = `<button class="note-type-btn active" data-type="all" onclick="setNoteFilter('all',this)">All</button>`;
  Object.keys(NOTE_TEMPLATES)
    .filter(id => id !== 'scratch')
    .forEach((id) => {
      const meta = getNoteTypeMeta(id);
      html += `<button class="note-type-btn${NOTE_TEMPLATES[id]?.fromFile ? ' note-type-custom' : ''}" data-type="${id}" onclick="setNoteFilter('${id}',this)">${meta.label}</button>`;
    });
  html += `<button class="note-type-btn" data-type="scratch" onclick="setNoteFilter('scratch',this)">Blank</button>`;
  bar.innerHTML = html;
}

function setNoteFilter(type, btn) {
  activeNoteFilter = type;
  document.querySelectorAll('.note-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderNotesList();
}

function syncAllNoteScopeButtons() {
  document.querySelectorAll('.note-scope-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.scope === activeNoteScope);
  });
}

function setNoteScope(scope, btn) {
  activeNoteScope = scope;
  activeTargetFilter = null;
  syncAllNoteScopeButtons();
  if (btn) btn.classList.add('active');
  updateNoteSearchPlaceholder();
  renderNotesList();
}

function updateNoteSearchPlaceholder() {
  const input = document.getElementById('noteSearchInput');
  if (!input) return;
  const placeholderByScope = {
    session: 'Search current engagement notes…',
    unassigned: 'Search unassigned notes…',
    all: 'Search all engagement notes…',
  };
  input.placeholder = placeholderByScope[activeNoteScope] || 'Search notes…';
}

function updateNotesCountBadges() {
  const totalEl = document.getElementById('notes-count');
  const sessionEl = document.getElementById('notes-count-session');
  if (totalEl) totalEl.textContent = Object.keys(notes).length || '—';
  if (!sessionEl) return;
  if (!activeSessionId || !sessions[activeSessionId]) {
    sessionEl.style.display = 'none';
    sessionEl.textContent = '';
    return;
  }
  const sessionCount = Object.values(notes).filter(n => n.session_id === activeSessionId).length;
  sessionEl.textContent = sessionCount;
  sessionEl.style.display = sessionCount ? '' : 'none';
}

function renderNotesList() {
  updateNoteSearchPlaceholder();
  updateNotesCountBadges();
  if (typeof notesListViewMode !== 'undefined' && notesListViewMode === 'timeline') {
    renderTimeline();
    updateNotesCountBadges();
    renderTargetFilterBar();
    renderNotesPeekList();
    return;
  }
  const list = document.getElementById('notesList');
  const items = getVisibleNotes({ scope: activeNoteScope, search: activeNoteSearch });

  if (!items.length) {
    list.innerHTML = `<div style="padding:20px 12px;font-size:11px;color:var(--muted);font-family:'Inter',sans-serif;text-align:center">
      ${activeNoteSearch ? 'No matching notes' : activeNoteFilter === 'all' ? 'No notes yet' : 'No ' + activeNoteFilter + ' notes'}
    </div>`;
    renderNotesPeekList();
    scheduleAttachmentStorageSidebarRefresh();
    return;
  }

  list.innerHTML = items.map(n => {
    const meta = getNoteTypeMeta(n.type);
    const sess = n.session_id && sessions[n.session_id];
    const sessLabel = sess && sess.id !== activeSessionId ? `<span class="note-item-session">${esc(sess.codename)}</span>` : '';
    const tgt = n.target_id && activeSessionId && sessions[activeSessionId]
      ? (sessions[activeSessionId].targets || []).find(t => t.id === n.target_id) : null;
    const tgtLabel = tgt ? `<span class="note-item-target">${ICONS.target} ${esc(tgt.ip || tgt.domain || tgt.label || 'target')}</span>` : '';
    const tagsHtml = (n.tags || []).length
      ? n.tags.map(t => `<span class="note-item-tag">#${esc(t)}</span>`).join('')
      : '';
    return `<div class="note-item ${meta.cssClass}${n.id===activeNoteId?' active':''}" onclick="openNote('${n.id}')" data-id="${n.id}">
      <div class="note-item-head">
        <span class="note-item-type-icon" title="${esc(meta.label)}">${meta.icon}</span>
        <span class="note-item-date">${formatDate(n.updated)}</span>
      </div>
      <div class="note-item-meta-row">
        ${tgtLabel}
        ${tagsHtml}
        ${sessLabel}
      </div>
      <div class="note-item-title">${n.pinned ? '<span class="note-item-pin">' + ICONS.pin + '</span>' : ''}${esc(n.title||'Untitled')}</div>
      <div class="note-item-content">
        <div class="note-item-preview">${esc((n.body||'').slice(0,50).replace(/\n/g,' '))}</div>
      </div>
    </div>`;
  }).join('');

  updateNotesCountBadges();
  renderTargetFilterBar();
  renderNotesPeekList();
  scheduleAttachmentStorageSidebarRefresh();
}

function getVisibleNotes(opts = {}) {
  const scope = opts.scope || activeNoteScope;
  const search = String(opts.search || '').trim().toLowerCase();
  let items = Object.values(notes).sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (b.updated || 0) - (a.updated || 0);
  });

  if (scope === 'session') {
    items = activeSessionId ? items.filter(n => n.session_id === activeSessionId) : items.filter(n => !n.session_id);
  } else if (scope === 'unassigned') {
    items = items.filter(n => !n.session_id || !sessions[n.session_id]);
  }

  if (activeNoteFilter !== 'all') items = items.filter(n => n.type === activeNoteFilter);
  if (activeTagFilter) items = items.filter(n => (n.tags || []).includes(activeTagFilter));
  if (activeTargetFilter) items = items.filter(n => n.target_id === activeTargetFilter);
  if (search) {
    items = items.filter(n =>
      (n.title || '').toLowerCase().includes(search) ||
      (n.body || '').toLowerCase().includes(search)
    );
  }

  return items;
}

function renderNotesPeekList() {
  const list = document.getElementById('notesPeekList');
  if (!list) return;
  syncNotesPeekScopeButtons();
  const items = getVisibleNotes({ scope: activeNoteScope, search: notesPeekSearch });
  if (!items.length) {
    list.innerHTML = `<div class="notes-peek-empty">${notesPeekSearch ? 'No matching notes' : 'No current notes'}</div>`;
    return;
  }

  list.innerHTML = items.map((n) => {
    const preview = esc((n.body || '').replace(/\n/g, ' ').trim().slice(0, 82));
    const meta = getNoteTypeMeta(n.type);
    const sess = n.session_id && sessions[n.session_id];
    const showSessionBadge = activeNoteScope === 'all' || activeNoteScope === 'unassigned';
    const sessionBadge = showSessionBadge && sess
      ? `<span class="notes-peek-item-session">${esc(sess.codename)}</span>`
      : showSessionBadge && !sess
        ? '<span class="notes-peek-item-session">Unassigned</span>'
        : '';
    return `<button class="notes-peek-item ${meta.cssClass || ''}${n.id === activeNoteId ? ' active' : ''}" type="button" onclick="openNoteFromPeek('${n.id}')">
      <div class="notes-peek-item-head">
        <span class="notes-peek-item-title">${n.pinned ? '<span class="note-item-pin">' + ICONS.pin + '</span>' : ''}${esc(n.title || 'Untitled')}</span>
        <span class="notes-peek-item-date">${formatDate(n.updated)}</span>
      </div>
      ${sessionBadge ? `<div class="notes-peek-item-meta">${sessionBadge}</div>` : ''}
      <div class="notes-peek-item-preview">${preview || '&nbsp;'}</div>
    </button>`;
  }).join('');
}

function openNotesPeek() {
  if (!notesListHidden) return;
  clearTimeout(notesPeekCloseTimer);
  notesPeekOpen = true;
  document.querySelector('.notes-layout')?.classList.add('notes-peek-open');
  renderNotesPeekList();
  setTimeout(() => document.getElementById('notesPeekSearchInput')?.focus(), 20);
}

function closeNotesPeek() {
  clearTimeout(notesPeekCloseTimer);
  notesPeekOpen = false;
  document.querySelector('.notes-layout')?.classList.remove('notes-peek-open');
  notesPeekSearch = '';
  const input = document.getElementById('notesPeekSearchInput');
  if (input) input.value = '';
}

function toggleNotesPeek(event) {
  event?.stopPropagation();
  if (!notesListHidden) return;
  if (notesPeekOpen) closeNotesPeek();
  else openNotesPeek();
}

function scheduleNotesPeekClose() {
  clearTimeout(notesPeekCloseTimer);
  const attemptClose = () => {
    if (!notesPeekOpen) return;
    const holdRemaining = notesPeekHoldOpenUntil - Date.now();
    if (holdRemaining > 0) {
      notesPeekCloseTimer = setTimeout(attemptClose, holdRemaining + 10);
      return;
    }
    const flyout = document.getElementById('notesPeekFlyout');
    const peekBtn = document.getElementById('notesListPeekBtn');
    if (flyout?.matches(':hover') || peekBtn?.matches(':hover')) return;
    closeNotesPeek();
  };
  notesPeekCloseTimer = setTimeout(attemptClose, 120);
}

function syncNotesPeekScopeButtons() {
  syncAllNoteScopeButtons();
}

function setNotesPeekScope(scope, button) {
  notesPeekHoldOpenUntil = Date.now() + 800;
  notesPeekIgnoreDocumentCloseUntil = Date.now() + 800;
  clearTimeout(notesPeekCloseTimer);
  activeNoteScope = scope;
  activeTargetFilter = null;
  syncNotesPeekScopeButtons();
  updateNoteSearchPlaceholder();
  renderNotesList();
  requestAnimationFrame(() => {
    document.querySelector('.notes-layout')?.classList.add('notes-peek-open');
    notesPeekOpen = true;
    document.getElementById('notesPeekSearchInput')?.focus({ preventScroll: true });
  });
  if (button) button.blur();
}

function onNotesPeekSearch(value) {
  notesPeekSearch = String(value || '').trim();
  renderNotesPeekList();
}

function openNoteFromPeek(id) {
  closeNotesPeek();
  openNote(id);
}

document.addEventListener('click', (event) => {
  if (!notesPeekOpen) return;
  if (Date.now() < notesPeekIgnoreDocumentCloseUntil) return;
  if (event.target.closest('#notesPeekFlyout') || event.target.closest('#notesListPeekBtn')) return;
  closeNotesPeek();
});

document.addEventListener('DOMContentLoaded', () => {
  scheduleAttachmentStorageSidebarRefresh(true);
  const peekBtn = document.getElementById('notesListPeekBtn');
  const peekFlyout = document.getElementById('notesPeekFlyout');
  if (peekBtn) {
    peekBtn.addEventListener('mouseenter', () => {
      if (!notesListHidden) return;
      openNotesPeek();
    });
    peekBtn.addEventListener('mouseleave', () => {
      if (!notesPeekOpen) return;
      scheduleNotesPeekClose();
    });
  }
  if (peekFlyout) {
    peekFlyout.addEventListener('mouseenter', () => clearTimeout(notesPeekCloseTimer));
    peekFlyout.addEventListener('mouseleave', () => {
      if (!notesPeekOpen) return;
      scheduleNotesPeekClose();
    });
  }
});

function onNoteSearch(val) {
  activeNoteSearch = val.trim();
  renderNotesList();
}

async function exportCurrentNote() {
  if (activeConfigDoc === 'templates') {
    downloadText(cmGetValue(noteEditor), 'note-templates.json');
    showToast('✓ Exported note-templates.json');
    return;
  }
  if (!activeNoteId || !notes[activeNoteId]) return;
  const n = notes[activeNoteId];
  let body = stripEvidenceMarkersForExport(n.body || '');
  if (typeof inlineNoteAttachmentUrlsForExport === 'function') {
    try {
      body = await inlineNoteAttachmentUrlsForExport(body);
    } catch (err) {
      showToast(`⚠ ${err.message || 'Image export failed'}`, 'err');
      return;
    }
  }
  const lines = ['---', `title: ${n.title || 'Untitled'}`, `type: ${n.type || 'scratch'}`];
  if (n.tags && n.tags.length) lines.push(`tags: [${n.tags.join(', ')}]`);
  if (n.created) lines.push(`created: ${new Date(n.created).toISOString()}`);
  if (n.updated) lines.push(`updated: ${new Date(n.updated).toISOString()}`);
  lines.push('---', '', body);
  const filename = slugify(n.title || 'untitled') + '.md';
  downloadText(lines.join('\n'), filename);
  showToast('✓ Exported ' + filename);
}

function toggleCheckbox(el) {
  if (!activeNoteId || !notes[activeNoteId]) { el.checked = !el.checked; return; }
  const n = notes[activeNoteId];
  const body = n.body || '';
  const lines = body.split('\n');
  const allBoxes = el.closest('.note-preview-content, .md-content')
    ? [...(el.closest('.note-preview-content, .md-content') || document).querySelectorAll('.task-checkbox')]
    : [];
  const idx = allBoxes.indexOf(el);
  if (idx === -1) return;
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^[ \t]*[-*+] \[[ xX]\]/.test(lines[i])) {
      if (count === idx) {
        lines[i] = el.checked ? lines[i].replace(/\[ \]/, '[x]') : lines[i].replace(/\[[xX]\]/, '[ ]');
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

function resetNewNoteModalState() {
  activeNewNoteType = null;
  document.querySelectorAll('#newNoteTypeGrid .new-note-type-btn').forEach(btn => btn.classList.remove('active'));
  const variantWrap = document.getElementById('newNoteVariantWrap');
  const variantBar = document.getElementById('newNoteVariantBar');
  const previewWrap = document.getElementById('newNotePreviewWrap');
  const previewContent = document.getElementById('newNotePreviewContent');
  const createBtn = document.getElementById('newNoteCreateBtn');
  const createHint = document.getElementById('newNoteCreateHint');
  if (variantWrap) variantWrap.style.display = 'none';
  if (variantBar) variantBar.innerHTML = '';
  if (previewWrap) previewWrap.style.display = 'none';
  if (previewContent) previewContent.innerHTML = '';
  if (createBtn) createBtn.style.display = 'none';
  if (createHint) createHint.style.display = '';
}

function openNewNoteModal() {
  document.getElementById('newNoteOverlay').classList.add('open');
  resetNewNoteModalState();
}

function closeNewNoteModal() {
  document.getElementById('newNoteOverlay').classList.remove('open');
  resetNewNoteModalState();
}

async function renderNewNotePreview(type) {
  const wrap = document.getElementById('newNotePreviewWrap');
  const content = document.getElementById('newNotePreviewContent');
  if (!wrap || !content || !type) return;

  const tmpl = resolveTemplateForCreation(type, NOTE_TEMPLATE_VARIANT_SELECTIONS[type] || null);
  const md = buildNoteBodyFromTemplate(tmpl);
  if (window.markdownPreview?.renderInto) {
    await window.markdownPreview.renderInto(content, md);
  } else {
    const rendered = typeof marked !== 'undefined' && marked ? marked.parse(md) : md.replace(/\n/g, '<br>');
    content.innerHTML = typeof sanitizeRenderedHtml === 'function' ? sanitizeRenderedHtml(rendered) : rendered;
  }
  wrap.style.display = '';
}

function renderNewNoteVariantPicker(type) {
  const variantWrap = document.getElementById('newNoteVariantWrap');
  const variantBar = document.getElementById('newNoteVariantBar');
  const createBtn = document.getElementById('newNoteCreateBtn');
  const createHint = document.getElementById('newNoteCreateHint');
  const tmpl = NOTE_TEMPLATES[type];
  const variants = Array.isArray(tmpl?.variants) ? tmpl.variants : [];

  if (!variantWrap || !variantBar || !createBtn || !createHint) return;
  if (!variants.length) {
    variantWrap.style.display = 'none';
    variantBar.innerHTML = '';
    createBtn.style.display = 'block';
    createHint.style.display = '';
    renderNewNotePreview(type);
    return;
  }

  variantWrap.style.display = '';
  createBtn.style.display = '';
  createHint.style.display = 'none';
  const selectedId = NOTE_TEMPLATE_VARIANT_SELECTIONS[type] || variants[0].id;
  variantBar.innerHTML = variants.map((variant) =>
    `<button class="btn-group-item${variant.id === selectedId ? ' active' : ''}" onclick="setNewNoteVariant(decodeURIComponent('${encodeURIComponent(type)}'),decodeURIComponent('${encodeURIComponent(variant.id)}'))">${esc(variant.label)}</button>`
  ).join('');
  renderNewNotePreview(type);
}

function selectNewNoteType(type) {
  activeNewNoteType = type;
  document.querySelectorAll('#newNoteTypeGrid .new-note-type-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.type === type));
  const variants = Array.isArray(NOTE_TEMPLATES[type]?.variants) ? NOTE_TEMPLATES[type].variants : [];
  if (!variants.length) {
    renderNewNotePreview(type);
    const createBtn = document.getElementById('newNoteCreateBtn');
    const createHint = document.getElementById('newNoteCreateHint');
    if (createBtn) createBtn.style.display = 'block';
    if (createHint) createHint.style.display = '';
    return;
  }
  if (!NOTE_TEMPLATE_VARIANT_SELECTIONS[type]) NOTE_TEMPLATE_VARIANT_SELECTIONS[type] = variants[0].id;
  renderNewNoteVariantPicker(type);
}

function setNewNoteVariant(type, variantId) {
  NOTE_TEMPLATE_VARIANT_SELECTIONS[type] = variantId;
  if (activeNewNoteType === type) {
    renderNewNoteVariantPicker(type);
    renderNewNotePreview(type);
  }
}

function createSelectedNewNote() {
  if (!activeNewNoteType) return;
  newNote(activeNewNoteType, NOTE_TEMPLATE_VARIANT_SELECTIONS[activeNewNoteType] || null);
}

function buildNoteBodyFromTemplate(tmpl) {
  const body = tmpl?.body || '';
  const title = (tmpl?.title || '').trim();
  if (!title) return body;
  if (/^\s*#\s+/.test(body)) return body;
  return `# ${title}\n\n${body}`;
}

function newNote(type = 'scratch', variantId = null) {
  closeNewNoteModal();
  const tmpl = resolveTemplateForCreation(type, variantId);
  const id = 'note_' + Date.now();
  notes[id] = {
    id,
    session_id: activeSessionId || null,
    target_id: activeTargetId || null,
    type,
    template_variant: tmpl.variant_id || null,
    title: tmpl.title || '',
    body: buildNoteBodyFromTemplate(tmpl),
    tags: tmpl.default_tags ? [...tmpl.default_tags] : [],
    target_ip: getIP() !== '<IP>' ? getIP() : null,
    target_domain: getDomain() !== '<DOMAIN>' ? getDomain() : null,
    created: Date.now(),
    updated: Date.now(),
  };
  saveNotes();
  if (activeSessionId) tlLog(activeSessionId, { type: 'note_created', noteId: id, noteType: type, targetId: activeTargetId || null });
  renderNotesList();
  renderSessionSidebar();
  openNote(id);
  setTimeout(() => {
    if (tmpl.title) document.getElementById('noteTitleInput').select();
    else document.getElementById('noteTitleInput').focus();
  }, 50);
}

function duplicateCurrentNote() {
  if (!activeNoteId || !notes[activeNoteId]) return;
  const src = notes[activeNoteId];
  const id = 'note_' + Date.now();
  notes[id] = {
    ...src,
    id,
    title: src.title ? src.title + ' (copy)' : '',
    tags: src.tags ? [...src.tags] : [],
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

async function openNote(id) {
  hideEvidenceSelectionPrompt();
  if (activeNoteId && activeNoteId !== id && notes[activeNoteId]) {
    clearTimeout(noteSaveTimer);
    await persistActiveNote({ reason: 'note-switch', immediate: true, noteId: activeNoteId });
  }
  const wasConfig = !!activeConfigDoc;
  if (wasConfig) {
    activeConfigDoc = null;
    setNoteEditorMode('note');
  }
  const n = notes[id];
  if (!n) return;
  activeNoteId = id;
  if (typeof persistLastLocation === 'function') persistLastLocation({ view: 'notes', noteId: id, configDoc: null });

  document.getElementById('notesEmpty').style.display = 'none';
  const area = document.getElementById('noteEditArea');
  area.style.display = 'flex';

  const meta = getNoteTypeMeta(n.type);
  const badge = ensureNoteTypeBadge();
  badge.textContent = meta.icon + ' ' + meta.label;
  badge.className = 'note-item-type ' + meta.cssClass;
  setNoteEditorMode('note');

  document.getElementById('noteTitleInput').value = n.title || '';
  const fmtTs = ts => ts ? new Date(ts).toLocaleString('en-GB', {
    day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
  const elCr = document.getElementById('noteCreatedAt');
  const elMo = document.getElementById('noteModifiedAt');
  if (elCr) elCr.textContent = fmtTs(n.created);
  if (elMo) elMo.textContent = fmtTs(n.updated);
  const pinBtn = document.getElementById('notePinBtn');
  if (pinBtn) { pinBtn.classList.toggle('pinned', !!n.pinned); pinBtn.title = n.pinned ? 'Unpin note' : 'Pin note'; }
  if (wasConfig) cmInitNote(n.body || '');
  else cmSetValue(noteEditor, n.body || '');
  renderNoteTags(n);
  updateReassignBtn(n);
  renderBacklinks(id);
  if (typeof updateTargetAssignBtn === 'function') updateTargetAssignBtn(notes[id]);
  setNoteSaveIndicator('saved', 'saved');

  renderNotesList();
  if (typeof notesListViewMode !== 'undefined' && notesListViewMode === 'timeline') renderTimeline();
  document.getElementById('noteTitleInput').oninput = () => autoSaveNote();
  applyNotePreviewState();
}


function togglePinNote() {
  if (!activeNoteId || !notes[activeNoteId]) return;
  notes[activeNoteId].pinned = !notes[activeNoteId].pinned;
  notes[activeNoteId].updated = Date.now();
  const pinBtn = document.getElementById('notePinBtn');
  if (pinBtn) {
    pinBtn.classList.toggle('pinned', !!notes[activeNoteId].pinned);
    pinBtn.title = notes[activeNoteId].pinned ? 'Unpin note' : 'Pin note';
  }
  saveNotes();
  renderNotesList();
}

function getNotesInSession(sessionId) {
  return Object.values(notes).filter((note) => (note?.session_id || null) === (sessionId || null));
}

function getTargetCandidates(target) {
  return [
    String(target?.ip || '').trim(),
    String(target?.domain || '').trim(),
    String(target?.label || '').trim(),
  ].filter(Boolean);
}

function resolveTargetInSession(rawTarget, sessionId = null) {
  const q = String(rawTarget || '').trim().toLowerCase();
  if (!q || !sessionId || !sessions[sessionId]) return null;
  const targets = sessions[sessionId].targets || [];
  let exactHit = null;
  let partialHit = null;
  targets.forEach((target) => {
    const candidates = getTargetCandidates(target).map((value) => value.toLowerCase());
    if (!exactHit && candidates.includes(q)) {
      exactHit = target;
      return;
    }
    const partial = candidates.find((value) => value.includes(q));
    if (!partial) return;
    if (!partialHit || partial.length > partialHit.length) partialHit = { target, length: partial.length };
  });
  return exactHit || partialHit?.target || null;
}

function resolveNoteLink(rawTitle, sessionId = null, { targetId } = {}) {
  const source = String(rawTitle || '').trim();
  const q = source.split('|')[0].trim().toLowerCase();
  if (!q) return null;
  let scopedNotes = getNotesInSession(sessionId);
  if (targetId !== undefined) scopedNotes = scopedNotes.filter((note) => (note.target_id || null) === (targetId || null));
  let hit = scopedNotes.find(n => (n.title || '').toLowerCase() === q);
  if (!hit) hit = scopedNotes.find(n => (n.title || '').toLowerCase().includes(q));
  return hit ? hit.id : null;
}

function resolveEngagementNoteLinkInSession(rawTarget, rawTitle, sessionId = null) {
  const target = resolveTargetInSession(rawTarget, sessionId);
  if (!target) return null;
  return resolveNoteLink(rawTitle, sessionId, { targetId: target.id });
}

function resolveEngagementNoteLink(rawTarget, rawTitle, sessionId = null) {
  const currentSessionId = sessionId || (activeNoteId && notes[activeNoteId]
    ? (notes[activeNoteId].session_id || null)
    : activeSessionId || null);
  return resolveEngagementNoteLinkInSession(rawTarget, rawTitle, currentSessionId);
}

window.resolveEngagementNoteLink = resolveEngagementNoteLink;

function getBacklinks(noteId) {
  const targetNote = notes[noteId];
  const targetSessionId = targetNote ? (targetNote.session_id || null) : null;
  return Object.values(notes).filter(n => {
    if (n.id === noteId) return false;
    if ((n.session_id || null) !== targetSessionId) return false;
    const body = n.body || '';
    const engagementRe = new RegExp(String.raw`\[en:([^:\]\n]+):([^\]\n]+)\](?!\()`, 'gi');
    let match;
    while ((match = engagementRe.exec(body)) !== null) {
      if (resolveEngagementNoteLinkInSession(match[1], match[2], n.session_id || null) === noteId) return true;
    }
    return false;
  });
}

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

function syncActiveNoteDraft(noteId = activeNoteId) {
  if (!noteId || !notes[noteId]) return { ok: false, changed: false };
  const note = notes[noteId];
  const prevTitle = note.title || '';
  const prevBody = note.body || '';
  const titleInput = document.getElementById('noteTitleInput');
  const synced = syncNoteTitleAndHeading(note, titleInput?.value || '', cmGetValue(noteEditor));
  const changed = synced.title !== prevTitle || synced.body !== prevBody;
  note.title = synced.title;
  note.body = synced.body;
  if (titleInput && titleInput.value !== synced.title) titleInput.value = synced.title;
  if (noteEditor && cmGetValue(noteEditor) !== synced.body) cmSetValue(noteEditor, synced.body);
  if (changed) note.updated = Date.now();
  return { ok: true, changed };
}

function stripInlineEvidenceMarkers(text) {
  return String(text || '')
    .replace(/<!--\s*pragma:evidence:[^>]+:(?:start|end)\s*-->/g, '')
    .trim();
}

function getActiveEvidenceEditor() {
  if (typeof noteUnifiedPreview !== 'undefined' && noteUnifiedPreview && typeof noteUnifiedEditor !== 'undefined' && noteUnifiedEditor) {
    return noteUnifiedEditor;
  }
  return noteEditor || null;
}

function stripEvidenceMarkersForExport(text) {
  return String(text || '')
    .replace(/<!--\s*pragma:evidence:[^>]+:(?:start|end)\s*-->\n?/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

function getNoteEvidenceBlockSelection({ requireSelection = false } = {}) {
  const editor = getActiveEvidenceEditor();
  if (!editor) return null;
  const main = editor.state.selection?.main;
  if (!main) return null;
  if (requireSelection && main.empty) return null;
  const doc = editor.state.doc;
  let blockFrom = main.from;
  let blockTo = main.to;

  if (main.empty) {
    const line = doc.lineAt(main.from);
    blockFrom = line.from;
    blockTo = line.to;
  } else if (blockTo > blockFrom && doc.sliceString(blockTo - 1, blockTo) === '\n') {
    blockTo -= 1;
  }

  return {
    from: blockFrom,
    to: blockTo,
    text: doc.sliceString(blockFrom, blockTo),
  };
}

function getEvidenceLeadLine(text) {
  const lines = stripInlineEvidenceMarkers(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^```/.test(line));
  return lines[0] || '';
}

function deriveEvidenceTitle(text, fallback = 'Evidence') {
  const lead = getEvidenceLeadLine(text)
    .replace(/^#+\s+/, '')
    .replace(/^>\s+/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/`/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .trim();
  const title = lead || fallback || 'Evidence';
  return title.length > 72 ? `${title.slice(0, 72).trim()}…` : title;
}

function deriveEvidenceType(text) {
  const lower = String(text || '').toLowerCase();
  if (/(cleanup|remove|revert|deleted|remove uploaded|clear history|rm\s+-rf)/.test(lower)) return 'cleanup';
  if (/(password|hash|ntlm|credential|token|apikey|api key|secret|kerberoast|asrep|sam dump|lsass|mimikatz)/.test(lower)) return 'credential_access';
  if (/(seimpersonate|system shell|root shell|local admin|privilege escalation|privesc|sudo -l|printspoofer|juicypotato|godpotato)/.test(lower)) return 'privilege_escalation';
  if (/(chisel|ligolo|pivot|socks|rportfwd|portfwd|ssh -d|ssh -l|ssh -r|proxychains|meterpreter route|autoroute|sshuttle|socat tcp-listen)/.test(lower)) return 'pivoting';
  if (/(psexec|wmiexec|smbexec|winrm|evil-winrm|ssh |xfreerdp|rdesktop|mssqlclient|runas|atexec|dcomexec)/.test(lower)) return 'lateral_movement';
  if (/(persistence|autorun|scheduled task|schtasks|run key|registry run|startup|service create)/.test(lower)) return 'persistence';
  if (/(download|collect|dump|copy .*loot|tar |zip |scp |rsync |secretsdump|sam|ntds|browser data)/.test(lower)) return 'collection';
  if (/(exfil|upload .*attacker|curl .*http|wget .*http|nc .* >|ftp |sftp )/.test(lower)) return 'exfiltration';
  if (/(shell|powershell|cmd\.exe|bash -c|sh -c|python -c|invoke-expression|iex |rundll32|mshta|certutil|regsvr32)/.test(lower)) return 'execution';
  if (/(login|foothold|reverse shell|webshell|sqlmap|exploit|initial access|auth bypass|rce|cve-|metasploit|nc -e|bash -i|powershell -enc|xp_cmdshell)/.test(lower)) return 'initial_access';
  if (/(nmap|rustscan|masscan|gobuster|ffuf|dirsearch|nikto|feroxbuster|enum4linux|ldapsearch|snmpwalk|rpcclient|smbclient|crackmapexec .*--shares|crackmapexec smb|netexec smb|whatweb|showmount|dig |host |nslookup )/.test(lower)) return 'enumeration';
  if (/```|`[^`]+`|^\s*(?:\$|#)\s+\S/m.test(String(text || ''))) return 'proof';
  return 'discovery';
}

function deriveEvidenceCommand(text) {
  const block = String(text || '');
  const fenced = block.match(/```[a-z0-9_-]*\n([\s\S]*?)```/i);
  if (fenced && fenced[1].trim()) return fenced[1].trim().slice(0, 500);
  const inline = block.match(/`([^`\n]+)`/);
  if (inline && inline[1].trim()) return inline[1].trim().slice(0, 500);
  const cleanLines = stripInlineEvidenceMarkers(block)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !/^```/.test(line));
  if (cleanLines.length === 1) {
    const single = cleanLines[0];
    if (/^(?:[$#]\s*)?[A-Za-z0-9_./:-]+$/.test(single)) {
      return single.replace(/^(?:[$#]\s*)/, '').slice(0, 500);
    }
  }
  const lead = getEvidenceLeadLine(block);
  if (/^(?:[$#]\s*)?[A-Za-z0-9_./:-]+(?:\s+.+)?$/.test(lead) && lead.split(/\s+/).length > 1) {
    return lead.slice(0, 500);
  }
  return '';
}

function deriveEvidenceDetails(text, sourceCommand) {
  const clean = stripInlineEvidenceMarkers(text).replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (sourceCommand && clean === sourceCommand) return '';
  return clean.length > 280 ? `${clean.slice(0, 280).trim()}…` : clean;
}

function extractEvidenceBlocksFromBody(body) {
  const text = String(body || '');
  const blocks = new Map();
  const re = /<!--\s*pragma:evidence:([^:\s]+):start\s*-->\n?([\s\S]*?)\n?<!--\s*pragma:evidence:\1:end\s*-->/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    blocks.set(match[1], match[2] || '');
  }
  return blocks;
}

function syncEvidenceEntriesFromNote(noteId) {
  if (!noteId || !notes[noteId] || !activeSessionId || !sessions[activeSessionId]) return false;
  const entries = sessions[activeSessionId].evidence || [];
  if (!entries.length) return false;
  const blocks = extractEvidenceBlocksFromBody(notes[noteId].body || '');
  let changed = false;

  entries.forEach((entry) => {
    const sourceNoteId = entry?.source_note_id || entry?.note_id || null;
    if (sourceNoteId !== noteId) return;
    const block = blocks.get(entry.id);
    if (block == null) return;
    const nextCommand = deriveEvidenceCommand(block);
    const nextDetails = deriveEvidenceDetails(block, nextCommand);
    let entryChanged = false;
    if (nextCommand && (entry.source_command || '') !== nextCommand) {
      entry.source_command = nextCommand;
      entryChanged = true;
    }
    if (!entry.details && nextDetails) {
      entry.details = nextDetails;
      entryChanged = true;
    }
    if (entryChanged) {
      entry.updated = Date.now();
      changed = true;
    }
  });

  return changed;
}

function deriveLootType(text) {
  const lower = String(text || '').toLowerCase();
  if (/(bearer\s+[a-z0-9._-]+|token|jwt|apikey|api key|sessionid|cookie)/.test(lower)) return 'token';
  if (/(-----begin .*private key-----|ssh-rsa|ssh-ed25519|\.ppk\b|private key)/.test(lower)) return 'key';
  if (/(ntlm|hash|aad3b435b51404eeaad3b435b51404ee|[a-f0-9]{32}:[a-f0-9]{32}|[a-f0-9]{32})/.test(lower)) return 'hash';
  if (/[^\s:]+:[^\s]+/.test(String(text || ''))) return 'cleartext';
  return 'other';
}

function deriveLootValue(text, sourceCommand = '') {
  const clean = stripInlineEvidenceMarkers(text).trim();
  if (!clean) return sourceCommand || '';
  return clean.length > 600 ? clean.slice(0, 600).trim() : clean;
}

function detectEvidenceTargetId(text) {
  if (!activeSessionId || !sessions[activeSessionId]) return null;
  const haystack = String(text || '').toLowerCase();
  if (!haystack) return null;
  const targets = getSessionTargets();
  let bestMatch = null;
  targets.forEach((target) => {
    const candidates = [
      String(target.ip || '').trim(),
      String(target.domain || '').trim(),
      String(target.label || '').trim(),
    ].filter(Boolean);
    candidates.forEach((candidate) => {
      const needle = candidate.toLowerCase();
      if (!needle || !haystack.includes(needle)) return;
      if (!bestMatch || needle.length > bestMatch.length) bestMatch = { id: target.id, length: needle.length };
    });
  });
  return bestMatch?.id || null;
}

function shouldSuggestLoot(text, derivedType = '') {
  const lower = String(text || '').toLowerCase();
  if (derivedType && ['cleartext', 'hash', 'token', 'key'].includes(derivedType)) return true;
  if (/(local\.txt|proof\.txt|flag\{|user:pass|username|password|ntlm|bearer |jwt|api[_ -]?key|secret|private key|ssh-rsa|ssh-ed25519)/.test(lower)) return true;
  return false;
}

function deriveEvidenceTitleHint(text, type = 'discovery') {
  const clean = stripInlineEvidenceMarkers(String(text || ''));
  const lower = clean.toLowerCase();
  if (/evil-winrm|winrm/.test(lower)) return 'WinRM access confirmed';
  if (/psexec|wmiexec|smbexec|dcomexec|atexec/.test(lower)) return 'Lateral movement path confirmed';
  if (/seimpersonate|printspoofer|juicypotato|godpotato|sudo -l/.test(lower)) return 'Privilege escalation path identified';
  if (/kerberoast|asrep|secretsdump|mimikatz|lsass/.test(lower)) return 'Credential access confirmed';
  if (/chisel|ligolo|proxychains|sshuttle|portfwd|autoroute/.test(lower)) return 'Pivoting path established';
  if (/nmap|rustscan|masscan/.test(lower)) return 'Port enumeration result';
  if (/gobuster|ffuf|feroxbuster|dirsearch/.test(lower)) return 'Web enumeration result';
  if (/local\.txt/.test(lower)) return 'local.txt recovered';
  if (/proof\.txt/.test(lower)) return 'proof.txt recovered';
  const label = (EVIDENCE_TYPE_OPTIONS.find((item) => item.value === type)?.label || 'Evidence').trim();
  const derived = deriveEvidenceTitle(clean, label);
  return derived || label;
}

function getEvidenceFlagDefaultLootHost() {
  const ip = typeof getIP === 'function' ? getIP() : '';
  if (ip && ip !== '<IP>') return ip;
  const domain = typeof getDomain === 'function' ? getDomain() : '';
  if (domain && domain !== '<DOMAIN>') return domain;
  return '';
}

function getCurrentEvidenceSelectionSignature() {
  const main = getActiveEvidenceEditor()?.state?.selection?.main;
  if (!main || main.empty) return '';
  return `${main.from}:${main.to}`;
}

function clearEvidenceSelectionPromptTimer() {
  if (_evidenceSelectionPromptTimer) {
    clearTimeout(_evidenceSelectionPromptTimer);
    _evidenceSelectionPromptTimer = null;
  }
}

function hideEvidenceSelectionPrompt() {
  clearEvidenceSelectionPromptTimer();
  _evidenceSelectionPromptState = null;
  const prompt = document.getElementById('evidenceSelectionPrompt');
  prompt?.classList.remove('open');
}

function isEvidenceBlockAlreadyFlagged(block) {
  const editor = getActiveEvidenceEditor();
  if (!block || !editor) return false;
  const doc = editor.state.doc;
  const beforeLine = block.from > 0 ? doc.lineAt(Math.max(0, block.from - 1)).text : '';
  const afterLine = block.to < doc.length ? doc.lineAt(Math.min(doc.length, block.to + 1)).text : '';
  return /pragma:evidence:/.test(block.text) || /pragma:evidence:.*:start/.test(beforeLine) || /pragma:evidence:.*:end/.test(afterLine);
}

function positionEvidenceSelectionPrompt(prompt) {
  const editor = getActiveEvidenceEditor();
  if (!prompt || !editor || !_evidenceSelectionPromptState?.block) return;
  const coords = editor.coordsAtPos(_evidenceSelectionPromptState.block.to) || editor.dom.getBoundingClientRect();
  const margin = 12;
  const promptRect = prompt.getBoundingClientRect();
  let left = coords.left;
  let top = coords.bottom + 8;
  left = Math.max(margin, Math.min(window.innerWidth - promptRect.width - margin, left));
  if (top + promptRect.height > window.innerHeight - margin) {
    top = Math.max(margin, coords.top - promptRect.height - 8);
  }
  prompt.style.left = `${Math.round(left)}px`;
  prompt.style.top = `${Math.round(top)}px`;
}

function showEvidenceSelectionPrompt(block) {
  const prompt = document.getElementById('evidenceSelectionPrompt');
  if (!prompt || !getActiveEvidenceEditor() || !block || !block.text.trim()) return;
  _evidenceSelectionPromptState = {
    block,
    signature: getCurrentEvidenceSelectionSignature(),
  };
  prompt.classList.add('open');
  requestAnimationFrame(() => positionEvidenceSelectionPrompt(prompt));
}

function syncEvidenceSelectionPrompt(update) {
  if (activeConfigDoc || !activeNoteId || !notes[activeNoteId] || !activeSessionId || !sessions[activeSessionId]) {
    hideEvidenceSelectionPrompt();
    return;
  }
  if (update.docChanged) {
    hideEvidenceSelectionPrompt();
    return;
  }
  if (!update.selectionSet) return;

  const main = update.state.selection?.main;
  if (!main || main.empty || !update.view?.hasFocus) {
    hideEvidenceSelectionPrompt();
    return;
  }

  const block = getNoteEvidenceBlockSelection({ requireSelection: true });
  if (!block || !block.text.trim() || isEvidenceBlockAlreadyFlagged(block)) {
    hideEvidenceSelectionPrompt();
    return;
  }

  clearEvidenceSelectionPromptTimer();
  const signature = getCurrentEvidenceSelectionSignature();
  _evidenceSelectionPromptState = { block, signature };
  _evidenceSelectionPromptTimer = setTimeout(() => {
    if (!_evidenceSelectionPromptState || _evidenceSelectionPromptState.signature !== getCurrentEvidenceSelectionSignature()) return;
    showEvidenceSelectionPrompt(block);
  }, 750);
}

window.addEventListener('resize', () => {
  const prompt = document.getElementById('evidenceSelectionPrompt');
  if (prompt?.classList.contains('open')) positionEvidenceSelectionPrompt(prompt);
});

window.addEventListener('scroll', () => {
  const prompt = document.getElementById('evidenceSelectionPrompt');
  if (prompt?.classList.contains('open')) positionEvidenceSelectionPrompt(prompt);
}, true);

function flagPromptedSelectionAsEvidence() {
  if (!_evidenceSelectionPromptState?.block) return;
  flagSelectionAsEvidence({ blockOverride: _evidenceSelectionPromptState.block });
}

function syncEvidenceFlagLootUi() {
  const enabledEl = document.getElementById('evidenceFlagAlsoLoot');
  const fieldsEl = document.getElementById('evidenceFlagLootFields');
  const typeEl = document.getElementById('evidenceFlagLootType');
  const syncWrapEl = document.getElementById('evidenceFlagLootSyncWrap');
  const syncEl = document.getElementById('evidenceFlagLootSyncCredentials');
  const enabled = !!enabledEl?.checked;
  if (fieldsEl) fieldsEl.style.display = enabled ? 'block' : 'none';
  if (!syncWrapEl || !syncEl) return;
  const syncRelevant = enabled && ['cleartext', 'hash'].includes((typeEl?.value || '').trim());
  syncWrapEl.style.display = syncRelevant ? 'block' : 'none';
  syncEl.disabled = !syncRelevant;
  if (!syncRelevant) syncEl.checked = false;
}

function openEvidenceFlagDialog({ title = '', type = 'discovery', details = '', command = '', loot = null } = {}) {
  return new Promise((resolve) => {
    _evidenceFlagResolver = resolve;
    const overlay = document.getElementById('evidenceFlagOverlay');
    const titleEl = document.getElementById('evidenceFlagTitle');
    const typeEl = document.getElementById('evidenceFlagType');
    const detailsEl = document.getElementById('evidenceFlagDetails');
    const commandEl = document.getElementById('evidenceFlagCommand');
    const alsoLootEl = document.getElementById('evidenceFlagAlsoLoot');
    const lootTypeEl = document.getElementById('evidenceFlagLootType');
    const lootValueEl = document.getElementById('evidenceFlagLootValue');
    const lootHostEl = document.getElementById('evidenceFlagLootHost');
    const lootNoteEl = document.getElementById('evidenceFlagLootNote');
    const lootSyncEl = document.getElementById('evidenceFlagLootSyncCredentials');
    if (titleEl) {
      const suggestedTitle = deriveEvidenceTitleHint(command || details, type);
      titleEl.value = title;
      titleEl.placeholder = `${suggestedTitle}…`;
      titleEl.dataset.defaultTitle = suggestedTitle;
    }
    if (typeEl) typeEl.value = type;
    if (detailsEl) detailsEl.value = details;
    if (commandEl) commandEl.value = command;
    if (alsoLootEl) alsoLootEl.checked = !!loot?.enabled;
    if (lootTypeEl) lootTypeEl.value = loot?.type || 'other';
    if (lootValueEl) lootValueEl.value = loot?.value || '';
    if (lootHostEl) lootHostEl.value = loot?.host || '';
    if (lootNoteEl) lootNoteEl.value = loot?.note || '';
    if (lootSyncEl) lootSyncEl.checked = !!loot?.sync_to_credentials;
    syncEvidenceFlagLootUi();
    overlay?.classList.add('open');
    setTimeout(() => {
      titleEl?.focus();
      titleEl?.select();
    }, 40);
  });
}

function finishEvidenceFlagDialog(result) {
  const overlay = document.getElementById('evidenceFlagOverlay');
  overlay?.classList.remove('open');
  const resolver = _evidenceFlagResolver;
  _evidenceFlagResolver = null;
  if (typeof resolver === 'function') resolver(result);
}

function cancelEvidenceFlagDialog() {
  finishEvidenceFlagDialog(null);
}

function confirmEvidenceFlagDialog() {
  const titleEl = document.getElementById('evidenceFlagTitle');
  const title = (titleEl?.value || '').trim() || (titleEl?.dataset.defaultTitle || '').trim();
  const type = (document.getElementById('evidenceFlagType')?.value || 'discovery').trim();
  const details = (document.getElementById('evidenceFlagDetails')?.value || '').trim();
  const source_command = (document.getElementById('evidenceFlagCommand')?.value || '').trim();
  if (!title) {
    titleEl?.focus();
    return;
  }
  let loot = null;
  if (document.getElementById('evidenceFlagAlsoLoot')?.checked) {
    const lootType = (document.getElementById('evidenceFlagLootType')?.value || 'other').trim();
    const lootValue = (document.getElementById('evidenceFlagLootValue')?.value || '').trim();
    const lootHost = (document.getElementById('evidenceFlagLootHost')?.value || '').trim();
    const lootNote = (document.getElementById('evidenceFlagLootNote')?.value || '').trim();
    const syncToCredentials = !!document.getElementById('evidenceFlagLootSyncCredentials')?.checked;
    if (!lootValue) {
      document.getElementById('evidenceFlagLootValue')?.focus();
      return;
    }
    loot = {
      enabled: true,
      type: lootType,
      value: lootValue,
      host: lootHost,
      note: lootNote,
      sync_to_credentials: syncToCredentials,
    };
  }
  finishEvidenceFlagDialog({ title, type, details, source_command, loot });
}

function handleEvidenceFlagKey(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    cancelEvidenceFlagDialog();
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault();
    confirmEvidenceFlagDialog();
  }
}

async function flagSelectionAsEvidence({ blockOverride = null } = {}) {
  if (activeConfigDoc) return;
  const activeEditor = getActiveEvidenceEditor();
  if (!activeNoteId || !notes[activeNoteId] || !activeEditor) return;
  if (!activeSessionId || !sessions[activeSessionId]) {
    showToast('⚠ Open a session first', 'err');
    return;
  }
  if (typeof ensureSessionEvidence !== 'function') return;
  hideEvidenceSelectionPrompt();

  const block = blockOverride || getNoteEvidenceBlockSelection();
  if (!block || !block.text.trim()) {
    showToast('⚠ Select a line or block to flag as evidence', 'err');
    return;
  }
  if (isEvidenceBlockAlreadyFlagged(block)) {
    showToast('⚠ This block is already flagged as evidence', 'err');
    return;
  }

  const entries = ensureSessionEvidence();
  if (!entries) return;

  const entryId = `evidence_${Date.now()}`;
  const marker = typeof buildEvidenceMarkerId === 'function' ? buildEvidenceMarkerId(entryId) : `pragma:evidence:${entryId}`;
  const sourceCommand = deriveEvidenceCommand(block.text);
  const defaultLootType = deriveLootType(block.text);
  const suggestedType = deriveEvidenceType(block.text);
  const confirmed = await openEvidenceFlagDialog({
    title: '',
    type: suggestedType,
    details: deriveEvidenceDetails(block.text, sourceCommand),
    command: sourceCommand || stripInlineEvidenceMarkers(block.text),
    loot: {
      enabled: shouldSuggestLoot(block.text, defaultLootType),
      type: defaultLootType,
      value: deriveLootValue(block.text, sourceCommand),
      host: getEvidenceFlagDefaultLootHost(),
      note: '',
      sync_to_credentials: ['cleartext', 'hash'].includes(defaultLootType),
    },
  });
  if (!confirmed) return;
  const entry = {
    id: entryId,
    type: confirmed.type,
    title: confirmed.title,
    details: confirmed.details,
    source_command: confirmed.source_command,
    target_id: detectEvidenceTargetId(block.text) || notes[activeNoteId].target_id || activeTargetId || null,
    source_note_id: activeNoteId,
    note_id: activeNoteId,
    sync_mode: 'export_only',
    created: Date.now(),
    updated: Date.now(),
  };

  const wrapped = `<!-- ${marker}:start -->\n${block.text}\n<!-- ${marker}:end -->`;
  activeEditor.dispatch({
    changes: { from: block.from, to: block.to, insert: wrapped },
    selection: { anchor: block.from + `<!-- ${marker}:start -->\n`.length, head: block.from + `<!-- ${marker}:start -->\n`.length + block.text.length },
    scrollIntoView: true,
    userEvent: 'input'
  });

  entries.push(entry);
  let syncedLootCredentialsNote = null;
  let lootDuplicate = false;
  if (confirmed.loot?.enabled && typeof addLootEntryFromData === 'function') {
    const lootResult = addLootEntryFromData({
      type: confirmed.loot.type,
      credential: confirmed.loot.value,
      host: confirmed.loot.host,
      note: confirmed.loot.note,
      syncToCredentials: !!confirmed.loot.sync_to_credentials,
    });
    syncedLootCredentialsNote = lootResult?.syncedCredentialsNote || null;
    lootDuplicate = !!lootResult?.duplicate;
  }
  clearTimeout(noteSaveTimer);
  syncActiveNoteDraft(activeNoteId);
  await saveNotes({ reason: 'note-evidence-flag', immediate: true });
  renderNotesList();
  renderSessionSidebar();
  if (typeof renderLootTable === 'function') renderLootTable();
  if (typeof updateSvcTabCounts === 'function') updateSvcTabCounts();
  if (syncedLootCredentialsNote && typeof applySyncedNoteUpdate === 'function') applySyncedNoteUpdate(syncedLootCredentialsNote);
  if (typeof renderEvidenceList === 'function') renderEvidenceList();
  if (typeof updateEvidenceCount === 'function') updateEvidenceCount();
  const modifiedEl = document.getElementById('noteModifiedAt');
  if (modifiedEl) {
    modifiedEl.textContent = new Date(notes[activeNoteId].updated).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }
  setNoteSaveIndicator('saved', 'saved');
  if (lootDuplicate) showToast('ℹ Loot already logged');
  showToast(`✓ Flagged as ${typeof evidenceTypeLabel === 'function' ? evidenceTypeLabel(entry.type) : 'Evidence'}`);
}

async function persistActiveNote(opts = {}) {
  const noteId = opts.noteId || activeNoteId;
  const syncResult = syncActiveNoteDraft(noteId);
  if (!syncResult.ok) return false;
  const evidenceChanged = syncEvidenceEntriesFromNote(noteId);
  const note = notes[noteId];
  if (!syncResult.changed && !evidenceChanged) {
    if (activeNoteId === noteId) setNoteSaveIndicator('saved', 'saved');
    return true;
  }
  const ok = await saveNotes({
    reason: opts.reason || 'note-edit',
    immediate: !!opts.immediate,
    delay: opts.delay,
  });
  renderNotesList();
  renderSessionSidebar();
  if (evidenceChanged) {
    if (typeof renderEvidenceList === 'function') renderEvidenceList();
    if (typeof updateEvidenceCount === 'function') updateEvidenceCount();
  }
  if (!note || notes[noteId] !== note) return ok;
  if (activeNoteId === noteId) renderBacklinks(noteId);
  const moEl = document.getElementById('noteModifiedAt');
  if (moEl && activeNoteId === noteId) moEl.textContent = new Date(note.updated).toLocaleString('en-GB', {
    day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
  if (activeNoteId === noteId && typeof invalidateNotePreviewCache === 'function') {
    invalidateNotePreviewCache();
  }
  return ok;
}

function autoSaveNote() {
  if (!activeNoteId) return;
  setNoteSaveIndicator('saving', '...saving');
  clearTimeout(noteSaveTimer);
  noteSaveTimer = setTimeout(() => { persistActiveNote({ reason: 'note-autosave' }); }, 600);
}

async function deleteCurrentNote() {
  if (!activeNoteId) return;
  try { await showConfirmDialog({ icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`, title: 'Delete Note', bigIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`, description: 'This note will be permanently deleted.', confirmLabel: 'Delete', danger: true }); }
  catch { return; }
  delete notes[activeNoteId];
  activeNoteId = null;
  if (typeof clearLastLocationFields === 'function') clearLastLocationFields('noteId');
  await saveNotes({ reason: 'note-delete', immediate: true });
  renderNotesList();
  renderSessionSidebar();
  const total = Object.keys(notes).length;
  document.getElementById('notes-count').textContent = total || '—';
  document.getElementById('notesEmpty').style.display = 'flex';
  document.getElementById('noteEditArea').style.display = 'none';
}

async function closeCurrentNote() {
  hideEvidenceSelectionPrompt();
  if (activeConfigDoc) {
    clearTimeout(noteSaveTimer);
    const ok = await persistTemplatesConfig({ reason: 'config-close' });
    if (!ok) return;
    closeConfigEditor();
    return;
  }
  if (!activeNoteId) return;
  const closingNoteId = activeNoteId;
  clearTimeout(noteSaveTimer);
  await persistActiveNote({ reason: 'note-close', immediate: true, noteId: closingNoteId });
  if (activeNoteId !== closingNoteId) return;
  activeNoteId = null;
  if (typeof clearLastLocationFields === 'function') clearLastLocationFields('noteId');
  document.getElementById('notesEmpty').style.display = 'flex';
  document.getElementById('noteEditArea').style.display = 'none';
  document.getElementById('noteReassignDropdown')?.classList.remove('open');
  document.getElementById('noteTargetAssignDropdown')?.classList.remove('open');
  renderNotesList();
  if (typeof notesListViewMode !== 'undefined' && notesListViewMode === 'timeline') renderTimeline();
}

function getAllTags() {
  const set = new Set();
  Object.values(notes).forEach(n => (n.tags || []).forEach(t => set.add(t)));
  return [...set].sort();
}

function renderNoteTags(n) {
  const row = document.getElementById('noteTagsRow');
  const input = document.getElementById('noteTagInput');
  row.querySelectorAll('.note-tag').forEach(el => el.remove());
  (n.tags || []).forEach(tag => {
    const pill = document.createElement('span');
    pill.className = 'note-tag';
    pill.innerHTML = '#' + esc(tag) + '<span class="note-tag-del" onclick="removeNoteTag(\'' + encodeURIComponent(tag) + '\')">×</span>';
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
  tag = decodeURIComponent(tag);
  if (!activeNoteId) return;
  const n = notes[activeNoteId];
  n.tags = (n.tags || []).filter(t => t !== tag);
  n.updated = Date.now();
  saveNotes();
  renderNoteTags(n);
  renderNotesList();
  renderTagFilterSidebar();
  if (activeTagFilter === tag) { activeTagFilter = null; renderNotesList(); }
}

function setTagFilter(tag) {
  tag = decodeURIComponent(tag);
  activeTagFilter = activeTagFilter === tag ? null : tag;
  renderTagFilterSidebar();
  renderNotesList();
}

function renderTagFilterSidebar() {
  const list = document.getElementById('tagFilterList');
  const tags = getAllTags();
  if (!tags.length) { list.innerHTML = '<span style="font-size:13px;color:var(--muted);font-family:JetBrains Mono,monospace">No tags yet</span>'; return; }
  list.innerHTML = tags.map(t =>
    `<span class="tag-filter-chip${activeTagFilter===t?' active':''}" onclick="setTagFilter('${encodeURIComponent(t)}')">#${esc(t)}</span>`
  ).join('');
}

function toggleReassignDropdown() {
  const dd = document.getElementById('noteReassignDropdown');
  if (dd.classList.contains('open')) {
    dd.classList.remove('open');
    return;
  }
  renderReassignDropdown();
  dd.classList.add('open');
  setTimeout(() => { document.addEventListener('click', closeReassignOnOutside, { once: true }); }, 0);
}

function closeReassignOnOutside(e) {
  const dd = document.getElementById('noteReassignDropdown');
  if (dd && !dd.contains(e.target)) dd.classList.remove('open');
}

function renderReassignDropdown() {
  const dd = document.getElementById('noteReassignDropdown');
  const note = activeNoteId && notes[activeNoteId];
  if (!note) return;

  const sessList = Object.values(sessions).sort((a, b) => (b.created || 0) - (a.created || 0));
  let html = '';
  if (note.session_id) html += `<div class="note-reassign-option unassign" onclick="reassignNote(null)">— Unassign</div>`;

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
  note.updated = Date.now();
  saveNotes();
  updateReassignBtn(note);
  document.getElementById('noteReassignDropdown').classList.remove('open');
  renderNotesList();
}

function updateReassignBtn(note) {
  const btn = document.getElementById('noteReassignBtn');
  if (!btn) return;
  const sessionIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 3 7.5 12 12l9-4.5L12 3z"/><path d="M3 12l9 4.5 9-4.5"/><path d="M3 16.5 12 21l9-4.5"/></svg>';
  const sess = note.session_id && sessions[note.session_id];
  if (sess) {
    btn.innerHTML = sessionIcon + ' ' + esc(sess.codename);
    btn.classList.add('assigned');
  } else {
    btn.innerHTML = sessionIcon + ' unassigned';
    btn.classList.remove('assigned');
  }
}

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
  if (note.target_id) html += '<div class="note-target-assign-option unassign" onclick="assignNoteTarget(null)">✕ Remove target</div>';
  if (!targets.length) {
    html += '<div class="note-target-assign-option unassign">No targets in session</div>';
  } else {
    targets.forEach(t => {
      const label = t.ip || t.domain || t.label || 'Unnamed';
      const sub = t.label && t.ip ? ` <span style="color:var(--muted);font-weight:400">${esc(t.label)}</span>` : '';
      const cur = t.id === note.target_id;
      html += `<div class="note-target-assign-option${cur ? ' current' : ''}" onclick="assignNoteTarget('${t.id}')">${cur ? '✓ ' : '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> '}${esc(label)}${sub}</div>`;
    });
  }
  dd.innerHTML = html;
}

function assignNoteTarget(targetId) {
  if (!activeNoteId) return;
  const note = notes[activeNoteId];
  note.target_id = targetId || null;
  note.updated = Date.now();
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
      const label = t.ip || t.domain || t.label || 'target';
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

async function exportSessionFile(sessionId) {
  const sess = sessions[sessionId];
  if (!sess) return;
  const sessNotes = Object.values(notes).filter(n => n.session_id === sessionId);
  const payload = { pragma_version: 1, exported: Date.now(), session: sess, notes: sessNotes };

  if (encryptedStorageEnabled && encryptedStoragePassword) {
    try {
      const blob = await encryptPayload(JSON.stringify(payload), encryptedStoragePassword);
      const filename = slugify(sess.codename) + '.session.enc';
      downloadJSON(blob, filename);
    } catch (e) {
      alert('Encryption failed: ' + e.message);
    }
  } else {
    const filename = slugify(sess.codename) + '.session';
    downloadJSON(payload, filename);
  }

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
    const author = (localStorage.getItem('pragma-summary-author') || '').trim();
    const generatePdf = localStorage.getItem('pragma-summary-pdf') === '1';
    const sessionNotes = Object.values(notes).filter(n =>
      n.session_id === sessionId ||
      (!n.session_id || !sessions[n.session_id])
    );
    const brokenAttachments = typeof validateNoteAttachmentsForNotes === 'function'
      ? await validateNoteAttachmentsForNotes(sessionNotes, { limit: 8 })
      : [];
    if (brokenAttachments.length) {
      const summary = brokenAttachments
        .slice(0, 3)
        .map((item) => `"${item.noteTitle}"`)
        .join(', ');
      const extra = brokenAttachments.length > 3 ? ` (+${brokenAttachments.length - 3} more)` : '';
      throw new Error(`Broken attachment references found in ${summary}${extra}. Remove or restore them before export.`);
    }
    const exportWarnings = [];
    const services = Array.isArray(sess.services) ? sess.services : [];
    const paths = Array.isArray(sess.paths) ? sess.paths : [];
    const loot = Array.isArray(sess.loot) ? sess.loot : [];
    const hasNetworkEnumerationNote = sessionNotes.some((note) => String(note?.type || '').trim() === 'network-enumeration');
    const hasCredentialsNote = sessionNotes.some((note) => String(note?.type || '').trim() === 'credentials');
    if ((services.length || paths.length) && !hasNetworkEnumerationNote) {
      exportWarnings.push('Network Enumeration note is missing. Quick Log data will still export, but the canonical note is not present.');
    }
    if (loot.some((entry) => ['cleartext', 'hash'].includes(String(entry?.type || '').trim())) && !hasCredentialsNote) {
      exportWarnings.push('Credentials note is missing. Loot will export, but there is no canonical credentials document in the session.');
    }
    if (exportWarnings.length) {
      await showConfirmDialog({
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        title: 'Export Preflight Warnings',
        bigIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        description: `Export can continue, but there are issues to review first.<br><br>${exportWarnings.map((line) => `• ${line}`).join('<br><br>')}`,
        confirmLabel: 'Export Anyway',
      });
    }
    const attachmentPayloads = typeof collectAttachmentPayloadsForNotes === 'function'
      ? await collectAttachmentPayloadsForNotes(sessionNotes)
      : {};
    const r = await fetch('/api/notes/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        sessions,
        notes,
        attachment_payloads: attachmentPayloads,
        author,
        generate_pdf: generatePdf,
      }),
    });
    const d = await r.json();
    if (d.ok) {
      if (!generatePdf && d.download?.filename && typeof d.download.content === 'string') {
        const blob = new Blob([d.download.content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = d.download.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      if (generatePdf && d.pdf?.filename) {
        const a = document.createElement('a');
        a.href = `/api/notes/export-file?session_id=${encodeURIComponent(sessionId)}&file=${encodeURIComponent(d.pdf.filename)}`;
        a.download = d.pdf.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      const count = d.files?.length || 0;
      const pdfSuffix = d.pdf?.filename ? `PDF: ${d.pdf.filename}` : '';
      const bundleSuffix = d.has_attachments ? ' (bundle includes attachments)' : '';
      const baseMsg = `✓ Markdown export complete: ${count} files → sessions/${slugify(sess.codename)}/`;
      const msg = `${baseMsg}${bundleSuffix}${pdfSuffix ? ` ${pdfSuffix}` : ''}`;
      showToast(msg.trim());
      if (d.pdf_error) showToast(`⚠ PDF generation failed: ${d.pdf_error}`, 'err');
    } else {
      showToast('Markdown export failed: ' + (d.error || 'unknown error'), 'err');
    }
  } catch (e) {
    if (String(e?.message || '').toLowerCase().includes('cancelled')) return;
    showToast('Markdown export failed: ' + e.message, 'err');
  }
}

async function cleanupOrphanedAttachments() {
  try {
    const res = await fetch('/api/notes/attachments/cleanup-orphans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions, notes }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok !== true) throw new Error(data.error || 'Attachment cleanup failed');
    const removed = Number(data.removed_count || 0);
    const missing = Number(data.missing_count || 0);
    const refs = Number(data.referenced_count || 0);
    scheduleAttachmentStorageSidebarRefresh(true);
    showToast(`✓ Attachment cleanup complete: removed ${removed} orphaned file(s), ${refs} referenced, ${missing} missing reference(s)`);
  } catch (err) {
    showToast(`⚠ ${err.message || 'Attachment cleanup failed'}`, 'err');
  }
}
