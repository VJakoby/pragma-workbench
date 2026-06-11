// ═══════════════════════════════════════════════
// PORT / SERVICE QUICK-LOG
// ═══════════════════════════════════════════════
let _portParsed = [];
let _pathParsed = [];
let _lootParsed = [];
let _activeSvcTab = 'ports';
let _activeLootType = 'cleartext';
let _editingTodoId = null;
let _editingQuickLog = null;
let _findingFilterType = '';
let _findingFilterTarget = '';
let _activeSvcTopbarButtonId = 'svcTopbarPortsBtn';

function buildQuickLogOptionMap(options) {
  const list = Array.isArray(options) ? options : [];
  return Object.fromEntries(list.map((item) => [item.value, item.label]));
}

const FINDING_SEVERITY_LABELS = buildQuickLogOptionMap(window.FINDING_SEVERITY_OPTIONS || []);
const FINDING_SEVERITY_VALUES = new Set(Object.keys(FINDING_SEVERITY_LABELS));

function normalizeFindingEntry(entry, index = 0) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const normalized = { ...entry };
  normalized.id = typeof normalized.id === 'string' && normalized.id ? normalized.id : `finding_${Date.now()}_${index}`;
  normalized.type = String(normalized.type || 'discovery').trim() || 'discovery';
  normalized.title = String(normalized.title || '').trim();
  normalized.summary = String(normalized.summary || normalized.details || '').trim();
  normalized.details = normalized.summary;
  normalized.impact = String(normalized.impact || '').trim();
  normalized.recommendation = String(normalized.recommendation || '').trim();
  normalized.source_command = String(normalized.source_command || '').trim();
  normalized.target_id = normalized.target_id ? String(normalized.target_id).trim() : null;
  normalized.source_note_id = normalized.source_note_id ? String(normalized.source_note_id).trim() : (normalized.note_id ? String(normalized.note_id).trim() : null);
  normalized.note_id = normalized.note_id ? String(normalized.note_id).trim() : null;
  normalized.sync_mode = String(normalized.sync_mode || 'export_only').trim() || 'export_only';
  normalized.severity = FINDING_SEVERITY_VALUES.has(String(normalized.severity || '').trim()) ? String(normalized.severity).trim() : 'medium';
  normalized.created = Number(normalized.created) || Date.now();
  normalized.updated = Number(normalized.updated) || normalized.created;
  return normalized;
}

function findingSeverityLabel(value) {
  return FINDING_SEVERITY_LABELS[String(value || '').trim()] || 'Medium';
}


function buildFindingSeverityOptionsHtml(selectedValue = 'medium') {
  const configured = Array.isArray(window.FINDING_SEVERITY_OPTIONS) ? window.FINDING_SEVERITY_OPTIONS : [];
  return configured.map(({ value, label }) => `<option value="${esc(value)}"${value === selectedValue ? ' selected' : ''}>${esc(label)}</option>`).join('');
}


function ensureActiveSession(actionLabel = 'this action') {
  if (!activeSessionId || !sessions[activeSessionId]) {
    showToast(`⚠ Open a session first to ${actionLabel}`, 'err');
    return false;
  }
  return true;
}

const SVC_TAB_ORDER = ['ports', 'paths', 'loot'];
const SVC_TAB_CONFIG = {
  ports: {
    buttonId: 'svcTabPorts',
    panelId: 'svcPanelPorts',
    focusId: 'svcQuickInput',
    onActivate: () => renderSvcLogTable(),
  },
  paths: {
    buttonId: 'svcTabPaths',
    panelId: 'svcPanelPaths',
    focusId: 'pathQuickInput',
    onActivate: () => renderPathTable(),
  },
  loot: {
    buttonId: 'svcTabLoot',
    panelId: 'svcPanelLoot',
    focusId: 'lootCredInput',
    onActivate: () => {
      renderLootTable();
      const hostInput = document.getElementById('lootHostInput');
      if (hostInput && !hostInput.value) {
        const ip = getIP();
        if (ip !== '<IP>') hostInput.value = ip;
      }
    },
  },
};

function updateUtilitySessionLabel(labelId) {
  const label = document.getElementById(labelId);
  if (!label) return;
  const sess = activeSessionId && sessions[activeSessionId];
  if (sess) {
    label.textContent = sess.codename;
    label.style.display = '';
  } else {
    label.textContent = '';
    label.style.display = 'none';
  }
}

function isEventInsideWrap(e, wrapId) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return false;
  const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
  return wrap.contains(e.target) || path.includes(wrap);
}

function reopenUtilityOutsideListener(handler) {
  setTimeout(() => document.addEventListener('click', handler, { once: true }), 0);
}

function openUtilityPopover({
  popoverId,
  buttonId,
  labelId,
  closeOthers = [],
  onOpen = null,
  outsideHandler,
}) {
  const popover = document.getElementById(popoverId);
  const button = document.getElementById(buttonId);
  if (!popover || !button) return false;
  if (popover.classList.contains('open')) return false;

  closeOthers.forEach(closeFn => {
    if (typeof closeFn === 'function') closeFn();
  });
  popover.classList.add('open');
  button.classList.add('open');
  if (labelId) updateUtilitySessionLabel(labelId);
  if (typeof onOpen === 'function') onOpen();
  reopenUtilityOutsideListener(outsideHandler);
  return true;
}

function closeUtilityPopover(popoverId, buttonId, afterClose = null) {
  document.getElementById(popoverId)?.classList.remove('open');
  document.getElementById(buttonId)?.classList.remove('open');
  if (typeof afterClose === 'function') afterClose();
}

function updateSvcPopoverLayout() {
  const popover = document.getElementById('svcPopover');
  if (!popover) return;
  const importOpen = ['portPastePanel', 'pathPastePanel', 'lootPastePanel'].some(id =>
    document.getElementById(id)?.style.display === 'flex'
  );
  popover.classList.toggle('svc-popover-import-open', importOpen);
  popover.classList.toggle('svc-popover-loot-open', _activeSvcTab === 'loot');
}

function getSvcTabConfig(tab) {
  return SVC_TAB_CONFIG[tab] || SVC_TAB_CONFIG.ports;
}

function focusSvcTabInput(tab) {
  const config = getSvcTabConfig(tab);
  setTimeout(() => document.getElementById(config.focusId)?.focus(), 40);
}

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
  Object.entries(SVC_TAB_CONFIG).forEach(([tabKey, config]) => {
    document.getElementById(config.buttonId)?.classList.toggle('active', tabKey === tab);
    const panel = document.getElementById(config.panelId);
    if (panel) panel.style.display = tabKey === tab ? 'block' : 'none';
  });
  const config = getSvcTabConfig(tab);
  config.onActivate?.();
  focusSvcTabInput(tab);
  renderSvcClearAction();
  updateSvcPopoverLayout();
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

  [
    ['svcTopbarCountPorts', ports],
    ['svcTopbarCountPaths', paths],
    ['svcTopbarCountLoot', loot],
  ].forEach(([id, value]) => {
    const badge = document.getElementById(id);
    if (!badge) return;
    badge.textContent = value || '';
    badge.classList.toggle('has-entries', value > 0);
  });
  renderSvcClearAction();
  updateTodoCount();
}

function getSessionTodos() {
  if (!activeSessionId || !sessions[activeSessionId]) return [];
  return sessions[activeSessionId].todos || [];
}

function ensureSessionTodos() {
  if (!activeSessionId || !sessions[activeSessionId]) return null;
  if (!Array.isArray(sessions[activeSessionId].todos)) sessions[activeSessionId].todos = [];
  return sessions[activeSessionId].todos;
}

function syncTodoUi() {
  renderTodoClearAction();
  updateTodoCount();
}

function updateTodoCount() {
  const todos = getSessionTodos();
  const openCount = todos.filter(todo => !todo.done).length;
  const btn = document.getElementById('todoTopbarCount');
  if (!btn) return;
  btn.textContent = openCount || '';
  btn.classList.toggle('has-entries', openCount > 0);
}

function getSessionFindings() {
  if (!activeSessionId || !sessions[activeSessionId]) return [];
  return ensureSessionFindings() || [];
}

function ensureSessionFindings() {
  if (!activeSessionId || !sessions[activeSessionId]) return null;
  const current = Array.isArray(sessions[activeSessionId].findings) ? sessions[activeSessionId].findings : (Array.isArray(sessions[activeSessionId].evidence) ? sessions[activeSessionId].evidence : []);
  const normalized = current.map((entry, index) => normalizeFindingEntry(entry, index)).filter(Boolean);
  sessions[activeSessionId].findings = normalized;
  return normalized;
}

function updateFindingsCount() {
  const entries = getSessionFindings();
  const btn = document.getElementById('findingsTopbarCount');
  if (!btn) return;
  btn.textContent = entries.length || '';
  btn.classList.toggle('has-entries', entries.length > 0);
}

function renderFindingsClearAction() {
  const btn = document.getElementById('findingsClearBtn');
  if (!btn) return;
  const count = getSessionFindings().length;
  btn.textContent = count ? `Clear All (${count})` : 'Clear All';
  btn.disabled = !activeSessionId || count === 0;
}

function renderFindingTargetOptions(selectedValue = '') {
  const select = document.getElementById('findingTargetInput');
  if (!select) return;
  const targets = getSessionTargets();
  const current = selectedValue || activeTargetId || '';
  const options = ['<option value="">Session-wide</option>'];
  targets.forEach((target) => {
    const label = esc(target.ip || target.domain || target.label || 'Unnamed');
    options.push(`<option value="${esc(target.id)}"${target.id === current ? ' selected' : ''}>${label}</option>`);
  });
  select.innerHTML = options.join('');
}

function getSessionNotesForFindings() {
  if (!activeSessionId) return [];
  return Object.values(notes)
    .filter((note) => note.session_id === activeSessionId)
    .sort((a, b) => (b.updated || 0) - (a.updated || 0));
}

function renderFindingNoteOptions(selectedValue = '') {
  const select = document.getElementById('findingNoteInput');
  if (!select) return;
  const noteItems = getSessionNotesForFindings();
  const options = ['<option value="">Select session note…</option>'];
  noteItems.forEach((note) => {
    options.push(`<option value="${esc(note.id)}"${note.id === selectedValue ? ' selected' : ''}>${esc(note.title || 'Untitled')}</option>`);
  });
  select.innerHTML = options.join('');
}

function findingTypeLabel(type) {
  const configured = Array.isArray(window.EVIDENCE_TYPE_OPTIONS) ? window.EVIDENCE_TYPE_OPTIONS : [];
  const configuredHit = configured.find((item) => item.value === type);
  if (configuredHit) return configuredHit.label;
  const labels = {
    finding: 'Finding',
    proof: 'Proof',
    cred: 'Credential',
    artifact: 'Artifact',
    privesc: 'PrivEsc',
    cleanup: 'Cleanup',
    note: 'Note',
  };
  return labels[type] || (type ? String(type) : 'Finding');
}

function buildFindingTypeOptionsHtml(selectedType = '') {
  const configured = Array.isArray(window.EVIDENCE_TYPE_OPTIONS) ? window.EVIDENCE_TYPE_OPTIONS : [];
  const options = configured.map(({ value, label }) =>
    `<option value="${esc(value)}"${value === selectedType ? ' selected' : ''}>${esc(label)}</option>`
  );
  if (selectedType && !configured.find((item) => item.value === selectedType)) {
    options.push(`<option value="${esc(selectedType)}" selected>${esc(findingTypeLabel(selectedType))}</option>`);
  }
  return options.join('');
}

function findingSyncLabel(mode) {
  if (mode === 'none') return 'No sync';
  if (mode === 'note') return 'Note';
  if (mode === 'both') return 'Both';
  return 'Summary';
}

function findingUsesNoteSync(mode) {
  return mode === 'note' || mode === 'both';
}

function formatFindingTimestamp(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function findingTargetDisplay(entry) {
  const target = entry?.target_id ? getSessionTargets().find((item) => item.id === entry.target_id) : null;
  return target ? (target.ip || target.domain || target.label || 'Unnamed') : 'Session-wide';
}

function renderFindingProofCell(entry) {
  const lines = [];
  if (entry.summary) lines.push(`<span class="evidence-proof-line"><span class="evidence-proof-key">Summary</span>${esc(entry.summary)}</span>`);
  if (entry.impact) lines.push(`<span class="evidence-proof-line"><span class="evidence-proof-key">Impact</span>${esc(entry.impact)}</span>`);
  if (entry.recommendation) lines.push(`<span class="evidence-proof-line"><span class="evidence-proof-key">Recommendation</span>${esc(entry.recommendation)}</span>`);
  if (entry.source_command) lines.push(`<span class="evidence-proof-line"><span class="evidence-proof-key">POC</span><code>${esc(entry.source_command)}</code></span>`);
  return lines.length ? `<div class="evidence-proof-cell">${lines.join('')}</div>` : '<span class="muted">—</span>';
}

function updateFindingSyncUi(selectedNoteId = '') {
  const syncEl = document.getElementById('findingSyncInput');
  const row = document.getElementById('evidenceNoteRow');
  if (!syncEl || !row) return;
  const syncMode = (syncEl.value || 'export_only').trim();
  const showNote = findingUsesNoteSync(syncMode);
  row.style.display = showNote ? 'flex' : 'none';
  renderFindingNoteOptions(selectedNoteId);
}

function buildFindingMarkerId(entryId) {
  return `pragma:evidence:${entryId}`;
}

function getFindingSourceNoteId(entry) {
  return entry?.source_note_id || entry?.note_id || null;
}

function getFindingSourceNote(entry) {
  const noteId = getFindingSourceNoteId(entry);
  return noteId ? notes[noteId] || null : null;
}

function getFindingSyncNote(entry) {
  if (!findingUsesNoteSync(entry?.sync_mode || 'export_only')) return null;
  const noteId = entry?.note_id || null;
  return noteId ? notes[noteId] || null : null;
}

function findingTypeBadgeClass(type) {
  if (type === 'proof') return 'loot-type-token';
  return 'loot-type-other';
}

function getFindingSourceSnippet(entry) {
  const sourceNote = getFindingSourceNote(entry);
  if (!sourceNote) return '';
  const range = findFindingMarkerRange(sourceNote.body || '', entry.id);
  const raw = range
    ? String(sourceNote.body || '').slice(range.from, range.to)
    : String(entry.source_command || entry.summary || entry.details || '');
  const compact = String(raw || '')
    .replace(/<!--\s*pragma:evidence:[\s\S]*?-->/g, '')
    .replace(/```[a-z0-9_-]*\n?/gi, '')
    .replace(/```/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!compact) return '';
  return compact.length > 140 ? `${compact.slice(0, 140).trim()}…` : compact;
}

function findFindingMarkerRange(body, entryId) {
  const text = String(body || '');
  const marker = buildFindingMarkerId(entryId);
  const startToken = `<!-- ${marker}:start -->`;
  const endToken = `<!-- ${marker}:end -->`;
  const startIdx = text.indexOf(startToken);
  if (startIdx === -1) return null;
  const endIdx = text.indexOf(endToken, startIdx + startToken.length);
  if (endIdx === -1) return null;
  let from = startIdx + startToken.length;
  if (text[from] === '\n') from += 1;
  let to = endIdx;
  if (to > from && text[to - 1] === '\n') to -= 1;
  return { from, to };
}

async function jumpToFindingSource(entryId) {
  if (!activeSessionId || !sessions[activeSessionId]) return;
  const entry = getSessionFindings().find((item) => item.id === entryId);
  const noteId = getFindingSourceNoteId(entry);
  if (!noteId || !notes[noteId]) {
    showToast?.('⚠ No source note linked', 'err');
    return;
  }

  closeFindingsPopover?.();
  if (typeof switchView === 'function') {
    switchView('notes', document.getElementById('nav-notes'));
  }
  if (typeof openNote === 'function') {
    await openNote(noteId);
  }

  if (typeof noteEditor === 'undefined' || !noteEditor) return;
  const docText = noteEditor.state.doc.toString();
  let range = findFindingMarkerRange(docText, entryId);
  if (!range) {
    const fallbackText = String(entry?.source_command || entry?.summary || entry?.details || '').trim();
    if (fallbackText) {
      const at = docText.indexOf(fallbackText);
      if (at !== -1) range = { from: at, to: at + fallbackText.length };
    }
  }
  if (!range) {
    noteEditor.focus();
    showToast?.('⚠ Source text not found in note', 'err');
    return;
  }

  noteEditor.dispatch({
    selection: { anchor: range.from, head: range.to },
    scrollIntoView: true
  });
  noteEditor.focus();
}

function removeFindingBlockFromBody(body, entryId) {
  const marker = buildFindingMarkerId(entryId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\n*<!-- ${marker}:start -->[\\s\\S]*?<!-- ${marker}:end -->\\n*`, 'g');
  return String(body || '').replace(pattern, '\n\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

function unwrapFindingBlockInBody(body, entryId) {
  const marker = buildFindingMarkerId(entryId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<!-- ${marker}:start -->\\n?([\\s\\S]*?)\\n?<!-- ${marker}:end -->`, 'g');
  return String(body || '').replace(pattern, '$1').replace(/\n{3,}/g, '\n\n').trimEnd();
}

function updateFindingBlockInBody(body, entry, prevEntry) {
  if (!entry?.id || !entry?.source_command) return body;
  const prevCommand = String(prevEntry?.source_command || '');
  const nextCommand = String(entry.source_command || '');
  if (prevCommand === nextCommand) return body;
  const range = findFindingMarkerRange(body || '', entry.id);
  if (!range) return body;
  const block = String(body || '').slice(range.from, range.to);
  let updatedBlock = block;
  const fenceMatch = block.match(/```([a-z0-9_-]*)\n([\s\S]*?)```/i);
  if (fenceMatch) {
    const lang = fenceMatch[1] || '';
    updatedBlock = block.replace(fenceMatch[0], `\`\`\`${lang}\n${nextCommand}\n\`\`\``);
  } else {
    updatedBlock = nextCommand;
  }
  if (updatedBlock === block) return body;
  return `${String(body || '').slice(0, range.from)}${updatedBlock}${String(body || '').slice(range.to)}`;
}

function buildFindingMarkdownBlock(entry) {
  const marker = buildFindingMarkerId(entry.id);
  const targetText = findingTargetDisplay(entry);
  const lines = [
    `<!-- ${marker}:start -->`,
    `### ${findingTypeLabel(entry.type)}: ${entry.title}`,
    '',
    `- Target: ${targetText}`,
    `- Severity: ${findingSeverityLabel(entry.severity)}`,
  ];
  if (entry.summary) lines.push(`- Summary: ${entry.summary}`);
  if (entry.impact) lines.push(`- Impact: ${entry.impact}`);
  if (entry.recommendation) lines.push(`- Recommendation: ${entry.recommendation}`);
  if (entry.source_command) {
    lines.push('', '```text', entry.source_command, '```');
  }
  lines.push(`<!-- ${marker}:end -->`);
  return lines.join('\n');
}

function upsertFindingBlockInBody(body, entry) {
  const cleanBody = removeFindingBlockFromBody(body, entry.id);
  const block = buildFindingMarkdownBlock(entry);
  const sectionMatch = cleanBody.match(/^##\s+(?:Findings|Evidence)\s*$/im);
  if (!sectionMatch || sectionMatch.index == null) {
    const prefix = cleanBody.trimEnd();
    return `${prefix}${prefix ? '\n\n' : ''}## Findings\n\n${block}\n`;
  }
  const sectionStart = sectionMatch.index;
  const sectionHeader = sectionMatch[0];
  const bodyAfterHeader = sectionStart + sectionHeader.length;
  const rest = cleanBody.slice(bodyAfterHeader);
  const nextSectionRel = rest.search(/\n##\s+/);
  const insertAt = nextSectionRel === -1 ? cleanBody.length : bodyAfterHeader + nextSectionRel;
  const before = cleanBody.slice(0, insertAt).replace(/\s*$/, '');
  const after = cleanBody.slice(insertAt).replace(/^\s*/, '\n\n');
  return `${before}\n\n${block}${after}`.replace(/\n{3,}/g, '\n\n');
}

function applyFindingNoteSyncChanges(prevEntry, nextEntry) {
  const syncedNotes = [];
  const prevSourceNoteId = getFindingSourceNoteId(prevEntry);
  const prevSyncNoteId = findingUsesNoteSync(prevEntry?.sync_mode || 'export_only') ? (prevEntry?.note_id || null) : null;
  const nextSourceNoteId = getFindingSourceNoteId(nextEntry);
  const nextSyncNoteId = findingUsesNoteSync(nextEntry?.sync_mode || 'export_only') ? (nextEntry?.note_id || null) : null;

  const shouldRemoveSourceMarker = !nextEntry || !nextSourceNoteId || nextSourceNoteId !== prevSourceNoteId;
  if (prevEntry?.id && prevSourceNoteId && notes[prevSourceNoteId] && shouldRemoveSourceMarker) {
    const prevNote = notes[prevSourceNoteId];
    const cleaned = unwrapFindingBlockInBody(prevNote.body || '', prevEntry.id);
    if (cleaned !== (prevNote.body || '')) {
      prevNote.body = cleaned;
      prevNote.updated = Date.now();
      syncedNotes.push(prevNote);
    }
  }

  if (prevEntry?.id && prevSyncNoteId && prevSyncNoteId !== prevSourceNoteId && notes[prevSyncNoteId]) {
    const prevSyncNote = notes[prevSyncNoteId];
    const cleaned = removeFindingBlockFromBody(prevSyncNote.body || '', prevEntry.id);
    if (cleaned !== (prevSyncNote.body || '')) {
      prevSyncNote.body = cleaned;
      prevSyncNote.updated = Date.now();
      if (!syncedNotes.includes(prevSyncNote)) syncedNotes.push(prevSyncNote);
    }
  }

  if (nextEntry?.id && nextSourceNoteId && notes[nextSourceNoteId]) {
    const sourceNote = notes[nextSourceNoteId];
    const updated = updateFindingBlockInBody(sourceNote.body || '', nextEntry, prevEntry);
    if (updated !== (sourceNote.body || '')) {
      sourceNote.body = updated;
      sourceNote.updated = Date.now();
      if (!syncedNotes.includes(sourceNote)) syncedNotes.push(sourceNote);
    }
  }

  if (nextEntry?.id && nextSyncNoteId && nextSyncNoteId !== nextSourceNoteId && notes[nextSyncNoteId]) {
    const nextNote = notes[nextSyncNoteId];
    const nextBody = upsertFindingBlockInBody(nextNote.body || '', nextEntry);
    if (nextBody !== (nextNote.body || '')) {
      nextNote.body = nextBody;
      nextNote.updated = Date.now();
      if (!syncedNotes.includes(nextNote)) syncedNotes.push(nextNote);
    }
  }

  return syncedNotes;
}

function setFindingFilterType(value) {
  _findingFilterType = String(value || '').trim();
  renderFindingsList();
}

function setFindingFilterTarget(value) {
  _findingFilterTarget = String(value || '').trim();
  renderFindingsList();
}

function renderTodoClearAction() {
  const btn = document.getElementById('todoClearBtn');
  if (!btn) return;
  const doneCount = getSessionTodos().filter(todo => todo.done).length;
  btn.textContent = doneCount ? `Clear Done (${doneCount})` : 'Clear Done';
  btn.disabled = !activeSessionId || doneCount === 0;
}

function renderTodoList() {
  const listEl = document.getElementById('todoList');
  if (!listEl) return;
  if (!activeSessionId || !sessions[activeSessionId]) {
    listEl.innerHTML = `<div class="todo-empty">Open or create a session to keep TODO items.</div>`;
    syncTodoUi();
    return;
  }

  const todos = getSessionTodos();
  if (!todos.length) {
    listEl.innerHTML = `<div class="todo-empty">No TODO items yet. Add the next step you want to keep visible for this session.</div>`;
    syncTodoUi();
    return;
  }

  listEl.innerHTML = todos.map(todo => `
    <div class="todo-item${todo.done ? ' done' : ''}">
      <button class="todo-check-btn" onclick="event.stopPropagation(); toggleTodoDone('${todo.id}')" title="${todo.done ? 'Mark as open' : 'Mark as done'}" aria-label="${todo.done ? 'Mark as open' : 'Mark as done'}">
        <span class="todo-check-box">${todo.done ? '&#10003;' : ''}</span>
      </button>
      <div class="todo-item-body">
        ${_editingTodoId === todo.id ? `
          <div class="todo-item-edit-wrap">
            <input
              class="todo-item-input"
              id="todoEditInput_${todo.id}"
              type="text"
              value="${esc(todo.text || '')}"
              autocomplete="off"
              spellcheck="false"
              onkeydown="handleTodoEditKeydown(event, '${todo.id}')"
            >
          </div>
        ` : `
          <div class="todo-item-text">${esc(todo.text || '')}</div>
        `}
      </div>
      <div class="todo-item-actions">
        ${_editingTodoId === todo.id ? `
          <button class="svc-quick-add-btn todo-save-btn" onclick="event.stopPropagation(); commitTodoEdit('${todo.id}')" title="Save TODO" aria-label="Save TODO">Save</button>
          <button class="svc-del-btn todo-cancel-btn" onclick="event.stopPropagation(); cancelTodoEdit('${todo.id}')" title="Cancel edit" aria-label="Cancel edit">Cancel</button>
        ` : `
          <button class="svc-del-btn todo-edit-btn" onclick="event.stopPropagation(); startTodoEdit('${todo.id}')" title="Edit TODO" aria-label="Edit TODO">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
        `}
        <button class="svc-del-btn todo-del-btn" onclick="event.stopPropagation(); deleteTodoEntry('${todo.id}')" title="Delete TODO" aria-label="Delete TODO">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a2 2 0 0 1 1 1v2"/></svg>
        </button>
      </div>
    </div>
  `).join('');
  syncTodoUi();

  if (_editingTodoId) {
    const input = document.getElementById(`todoEditInput_${_editingTodoId}`);
    if (input) {
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }, 0);
    }
  }
}

function addTodoEntry() {
  const input = document.getElementById('todoQuickInput');
  const text = input?.value?.trim() || '';
  if (!activeSessionId) {
    showToast('⚠ Open a session first', 'err');
    return;
  }
  if (!text) {
    input?.focus();
    return;
  }
  const todos = ensureSessionTodos();
  if (!todos) return;
  todos.push({
    id: `todo_${Date.now()}`,
    text,
    done: false,
    created: Date.now(),
    completed: null,
  });
  input.value = '';
  saveNotes();
  renderTodoList();
  input.focus();
}

function startTodoEdit(todoId) {
  if (!activeSessionId) return;
  if (!getSessionTodos().some(item => item.id === todoId)) return;
  _editingTodoId = todoId;
  renderTodoList();
}

function cancelTodoEdit(todoId) {
  if (_editingTodoId !== todoId) return;
  _editingTodoId = null;
  renderTodoList();
}

function commitTodoEdit(todoId) {
  if (!activeSessionId) return;
  const todo = getSessionTodos().find(item => item.id === todoId);
  const input = document.getElementById(`todoEditInput_${todoId}`);
  if (!todo || !input) return;

  const nextText = input.value.trim();
  if (!nextText) {
    showToast('⚠ TODO text cannot be empty', 'err');
    input.focus();
    return;
  }

  _editingTodoId = null;
  if (nextText !== todo.text) {
    todo.text = nextText;
    saveNotes();
  }
  renderTodoList();
}

function handleTodoEditKeydown(event, todoId) {
  if (event.key === 'Enter') {
    event.preventDefault();
    commitTodoEdit(todoId);
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    cancelTodoEdit(todoId);
  }
}

function toggleTodoDone(todoId) {
  if (!activeSessionId) return;
  const todo = getSessionTodos().find(item => item.id === todoId);
  if (!todo) return;
  todo.done = !todo.done;
  todo.completed = todo.done ? Date.now() : null;
  saveNotes();
  renderTodoList();
}

function deleteTodoEntry(todoId) {
  if (!activeSessionId) return;
  const todos = ensureSessionTodos();
  if (!todos) return;
  if (_editingTodoId === todoId) _editingTodoId = null;
  sessions[activeSessionId].todos = todos.filter(item => item.id !== todoId);
  saveNotes();
  renderTodoList();
}

function clearCompletedTodos() {
  if (!activeSessionId) return;
  const todos = ensureSessionTodos();
  if (!todos) return;
  const remaining = todos.filter(item => !item.done);
  if (remaining.length === todos.length) return;
  if (_editingTodoId && todos.some(item => item.id === _editingTodoId && item.done)) _editingTodoId = null;
  sessions[activeSessionId].todos = remaining;
  saveNotes();
  renderTodoList();
}

function renderFindingsList() {
  const listEl = document.getElementById('findingsList');
  if (!listEl) return;
  renderFindingTargetOptions();
  renderFindingNoteOptions();
  renderFindingsClearAction();
  updateFindingsCount();
  updateFindingSyncUi(document.getElementById('findingNoteInput')?.value || '');

  if (!activeSessionId || !sessions[activeSessionId]) {
    listEl.innerHTML = `<div class="todo-empty">Open or create a session to keep structured findings entries.</div>`;
    return;
  }

  const allEntries = [...getSessionFindings()].sort((a, b) => (b.created || b.updated || 0) - (a.created || a.updated || 0));
  const targets = getSessionTargets();
  const notes = getSessionNotesForFindings();
  const entries = allEntries.filter((entry) => {
    if (_findingFilterType && entry.type !== _findingFilterType) return false;
    if (_findingFilterTarget) {
      const targetId = entry.target_id || '__session__';
      if (targetId !== _findingFilterTarget) return false;
    }
    return true;
  });
  if (!entries.length) {
    if (!allEntries.length) {
      listEl.innerHTML = `<div class="todo-empty">No findings yet. Select a line or block from a session note and add it here.</div>`;
      return;
    }
    listEl.innerHTML = `
      <div class="evidence-filters">
        <select class="ql-row-input ql-row-select evidence-filter-select" onchange="setFindingFilterType(this.value)">
          <option value="">All types</option>
          ${buildFindingTypeOptionsHtml(_findingFilterType)}
        </select>
        <select class="ql-row-input ql-row-select evidence-filter-select" onchange="setFindingFilterTarget(this.value)">
          <option value="">All targets</option>
          <option value="__session__"${_findingFilterTarget === '__session__' ? ' selected' : ''}>Session-wide</option>
          ${targets.map((target) => {
            const label = esc(target.ip || target.domain || target.label || 'Unnamed');
            return `<option value="${esc(target.id)}"${target.id === _findingFilterTarget ? ' selected' : ''}>${label}</option>`;
          }).join('')}
        </select>
      </div>
      <div class="todo-empty">No findings match the current filters. Try clearing the type or target filter.</div>
    `;
    return;
  }

  listEl.innerHTML = `
    <div class="evidence-filters">
      <select class="ql-row-input ql-row-select evidence-filter-select" onchange="setFindingFilterType(this.value)">
        <option value="">All types</option>
        ${buildFindingTypeOptionsHtml(_findingFilterType)}
      </select>
      <select class="ql-row-input ql-row-select evidence-filter-select" onchange="setFindingFilterTarget(this.value)">
        <option value="">All targets</option>
        <option value="__session__"${_findingFilterTarget === '__session__' ? ' selected' : ''}>Session-wide</option>
        ${targets.map((target) => {
          const label = esc(target.ip || target.domain || target.label || 'Unnamed');
          return `<option value="${esc(target.id)}"${target.id === _findingFilterTarget ? ' selected' : ''}>${label}</option>`;
        }).join('')}
      </select>
      <div class="evidence-filter-count">${entries.length} / ${allEntries.length}</div>
    </div>
    <div class="evidence-items">${entries.map((entry) => {
      const target = entry.target_id ? targets.find((item) => item.id === entry.target_id) : null;
      const targetLabel = target ? (target.ip || target.domain || target.label || 'Unnamed') : 'Session-wide';
      const syncLabel = findingSyncLabel(entry.sync_mode || 'export_only');
      const sourceNote = getFindingSourceNote(entry);
      const sourceNoteLabel = sourceNote?.title || 'Unknown source';
      const sourceSnippet = getFindingSourceSnippet(entry);
      const syncNote = getFindingSyncNote(entry);
      const syncNoteLabel = syncNote?.title || (findingUsesNoteSync(entry.sync_mode || 'export_only') ? 'Select note' : '—');
      const timestampLabel = formatFindingTimestamp(entry.updated || entry.created || 0);
      if (isQuickLogEditing('finding', entry.id)) {
        return `
          <section class="evidence-item evidence-item-editing">
            <div class="evidence-item-head">
              <div class="evidence-item-title-group evidence-item-title-group-editing">
                <label class="evidence-edit-field evidence-edit-field-type">
                  <span class="evidence-edit-label">Type</span>
                  <select class="svc-notes-cell ql-row-input ql-row-select" id="evidenceEditType_${entry.id}" onclick="event.stopPropagation()" onkeydown="handleQuickLogEditKeydown(event,'finding','${entry.id}')">
                    ${buildFindingTypeOptionsHtml(entry.type)}
                  </select>
                </label>
                <label class="evidence-edit-field">
                  <span class="evidence-edit-label">Severity</span>
                  <select class="svc-notes-cell ql-row-input ql-row-select" id="evidenceEditSeverity_${entry.id}" onclick="event.stopPropagation()" onkeydown="handleQuickLogEditKeydown(event,'finding','${entry.id}')">
                    ${buildFindingSeverityOptionsHtml(entry.severity || 'medium')}
                  </select>
                </label>
                <label class="evidence-edit-field evidence-edit-field-title">
                  <span class="evidence-edit-label">Title</span>
                  <input class="svc-notes-cell ql-row-input" id="evidenceEditTitle_${entry.id}" type="text" value="${esc(entry.title || '')}" placeholder="title" onclick="event.stopPropagation()" onkeydown="handleQuickLogEditKeydown(event,'finding','${entry.id}')">
                </label>
              </div>
              <div class="evidence-item-actions">${renderFindingRowActions(entry.id)}</div>
            </div>
            <div class="evidence-edit-grid">
              <label class="evidence-edit-field">
                <span class="evidence-edit-label">Target</span>
                <select class="svc-notes-cell ql-row-input ql-row-select" id="evidenceEditTarget_${entry.id}" onclick="event.stopPropagation()" onkeydown="handleQuickLogEditKeydown(event,'finding','${entry.id}')">
                  <option value="">Session-wide</option>
                  ${targets.map((targetItem) => {
                    const label = esc(targetItem.ip || targetItem.domain || targetItem.label || 'Unnamed');
                    return `<option value="${esc(targetItem.id)}"${targetItem.id === entry.target_id ? ' selected' : ''}>${label}</option>`;
                  }).join('')}
                </select>
              </label>
              <label class="evidence-edit-field">
                <span class="evidence-edit-label">Sync</span>
                <select class="svc-notes-cell ql-row-input ql-row-select" id="evidenceEditSync_${entry.id}" onclick="event.stopPropagation()" onkeydown="handleQuickLogEditKeydown(event,'finding','${entry.id}')">
                  <option value="export_only"${(entry.sync_mode || 'export_only') === 'export_only' ? ' selected' : ''}>Summary</option>
                  <option value="both"${(entry.sync_mode || 'export_only') === 'both' ? ' selected' : ''}>Both</option>
                  <option value="note"${(entry.sync_mode || 'export_only') === 'note' ? ' selected' : ''}>Note</option>
                  <option value="none"${(entry.sync_mode || 'export_only') === 'none' ? ' selected' : ''}>No export</option>
                </select>
              </label>
              <label class="evidence-edit-field">
                <span class="evidence-edit-label">Synced note</span>
                <select class="svc-notes-cell ql-row-input ql-row-select" id="evidenceEditNote_${entry.id}" onclick="event.stopPropagation()" onkeydown="handleQuickLogEditKeydown(event,'finding','${entry.id}')">
                  <option value="">Select note…</option>
                  ${notes.map((item) => `<option value="${esc(item.id)}"${item.id === entry.note_id ? ' selected' : ''}>${esc(item.title || 'Untitled')}</option>`).join('')}
                </select>
              </label>
            </div>
            <div class="evidence-item-body evidence-item-body-editing">
              <label class="evidence-edit-field">
                <span class="evidence-edit-label">Summary</span>
                <input class="svc-notes-cell ql-row-input" id="evidenceEditSummary_${entry.id}" type="text" value="${esc(entry.summary || entry.details || '')}" placeholder="summary" onclick="event.stopPropagation()" onkeydown="handleQuickLogEditKeydown(event,'finding','${entry.id}')">
              </label>
              <label class="evidence-edit-field">
                <span class="evidence-edit-label">Impact</span>
                <input class="svc-notes-cell ql-row-input" id="evidenceEditImpact_${entry.id}" type="text" value="${esc(entry.impact || '')}" placeholder="impact" onclick="event.stopPropagation()" onkeydown="handleQuickLogEditKeydown(event,'finding','${entry.id}')">
              </label>
              <label class="evidence-edit-field">
                <span class="evidence-edit-label">Recommendation</span>
                <input class="svc-notes-cell ql-row-input" id="evidenceEditRecommendation_${entry.id}" type="text" value="${esc(entry.recommendation || '')}" placeholder="recommendation" onclick="event.stopPropagation()" onkeydown="handleQuickLogEditKeydown(event,'finding','${entry.id}')">
              </label>
              <label class="evidence-edit-field">
                <span class="evidence-edit-label">POC</span>
                <input class="svc-notes-cell ql-row-input" id="evidenceEditCommand_${entry.id}" type="text" value="${esc(entry.source_command || '')}" placeholder="source command" onclick="event.stopPropagation()" onkeydown="handleQuickLogEditKeydown(event,'finding','${entry.id}')">
              </label>
            </div>
          </section>
        `;
      }
      return `
        <section class="evidence-item">
            <div class="evidence-item-head">
              <div class="evidence-item-title-group">
              <span class="loot-type-badge ${findingTypeBadgeClass(entry.type)}">${esc(findingTypeLabel(entry.type))}</span>
              <div class="evidence-item-title-wrap">
                <div class="evidence-item-title">${esc(entry.title || 'Untitled')}</div>
                <div class="evidence-item-source" title="${esc(sourceNoteLabel)}">Source: ${esc(sourceNoteLabel)}</div>
                ${sourceSnippet ? `<div class="evidence-item-snippet" title="${esc(sourceSnippet)}">${esc(sourceSnippet)}</div>` : ''}
              </div>
            </div>
            <div class="evidence-item-actions">${renderFindingRowActions(entry.id)}</div>
          </div>
          ${timestampLabel ? `<div class="evidence-item-timestamp">Added ${esc(timestampLabel)}</div>` : ''}
          <div class="evidence-item-meta">
            <span class="evidence-meta-pill evidence-severity-pill ${esc(entry.severity || 'medium')}">
              <span class="evidence-meta-key">Severity</span>
              <span class="evidence-meta-value">${esc(findingSeverityLabel(entry.severity))}</span>
            </span>
            <span class="evidence-meta-pill">
              <span class="evidence-meta-key">Sync</span>
              <span class="evidence-meta-value">${esc(syncLabel)}</span>
            </span>
            <span class="evidence-meta-pill evidence-target-pill" title="${esc(targetLabel)}">
              <span class="evidence-meta-key">Target</span>
              <span class="evidence-meta-value evidence-target-cell">${esc(targetLabel)}</span>
            </span>
            ${findingUsesNoteSync(entry.sync_mode || 'export_only') ? `
            <span class="evidence-meta-pill" title="${esc(syncNoteLabel)}">
              <span class="evidence-meta-key">Synced</span>
              <span class="evidence-meta-value">${esc(syncNoteLabel)}</span>
            </span>
            ` : ''}
          </div>
          <div class="evidence-item-body">
            ${renderFindingProofCell(entry)}
          </div>
        </section>
      `;
    }).join('')}</div>
  `;

  if (_editingQuickLog?.kind === 'finding') focusQuickLogEditInput(`evidenceEditTitle_${_editingQuickLog.id}`);
}

function addFindingEntry() {
  if (!activeSessionId) return;
  const entries = ensureSessionFindings();
  if (!entries) return;
  const type = (document.getElementById('findingTypeInput')?.value || 'discovery').trim();
  const titleEl = document.getElementById('findingTitleInput');
  const detailsEl = document.getElementById('findingDetailsInput');
  const commandEl = document.getElementById('findingCommandInput');
  const targetEl = document.getElementById('findingTargetInput');
  const syncEl = document.getElementById('findingSyncInput');
  const noteEl = document.getElementById('findingNoteInput');
  const title = (titleEl?.value || '').trim();
  const details = (detailsEl?.value || '').trim();
  const sourceCommand = (commandEl?.value || '').trim();
  const targetId = (targetEl?.value || '').trim() || null;
  const syncMode = (syncEl?.value || 'export_only').trim();
  const noteId = findingUsesNoteSync(syncMode) ? ((noteEl?.value || '').trim() || null) : null;
  if (!title) {
    titleEl?.focus();
    return;
  }
  if (findingUsesNoteSync(syncMode) && !noteId) {
    noteEl?.focus();
    return;
  }
  const entry = normalizeFindingEntry({
    id: `finding_${Date.now()}`,
    type,
    title,
    severity: 'medium',
    summary: details,
    details,
    impact: '',
    recommendation: '',
    source_command: sourceCommand,
    target_id: targetId,
    note_id: noteId,
    sync_mode: syncMode,
    created: Date.now(),
    updated: Date.now(),
  });
  entries.push(entry);
  const syncedNotes = applyFindingNoteSyncChanges(null, entry);
  if (titleEl) titleEl.value = '';
  if (detailsEl) detailsEl.value = '';
  if (commandEl) commandEl.value = '';
  if (targetEl) targetEl.value = activeTargetId || '';
  if (syncEl) syncEl.value = 'export_only';
  if (noteEl) noteEl.value = '';
  saveNotes();
  syncedNotes.forEach(applySyncedNoteUpdate);
  renderFindingsList();
  updateFindingSyncUi();
  titleEl?.focus();
}

function deleteFindingEntry(entryId) {
  if (!activeSessionId) return;
  const entries = ensureSessionFindings();
  if (!entries) return;
  const entry = entries.find((item) => item.id === entryId);
  if (isQuickLogEditing('finding', entryId)) clearQuickLogEditing();
  sessions[activeSessionId].findings = entries.filter((entry) => entry.id !== entryId);
  const syncedNotes = entry ? applyFindingNoteSyncChanges(entry, null) : [];
  saveNotes();
  syncedNotes.forEach(applySyncedNoteUpdate);
  renderFindingsList();
  showToast('✓ Finding unflagged');
}

function clearFindingEntries() {
  if (!activeSessionId) return;
  const entries = ensureSessionFindings();
  if (!entries?.length) return;
  const syncedNotes = [];
  entries.forEach((entry) => {
    applyFindingNoteSyncChanges(entry, null).forEach((note) => {
      if (!syncedNotes.includes(note)) syncedNotes.push(note);
    });
  });
  if (_editingQuickLog?.kind === 'finding') clearQuickLogEditing();
  sessions[activeSessionId].findings = [];
  saveNotes();
  syncedNotes.forEach(applySyncedNoteUpdate);
  renderFindingsList();
}

function commitFindingEdit(entryId) {
  if (!activeSessionId) return;
  const entry = (sessions[activeSessionId].findings || []).find((item) => item.id === entryId);
  if (!entry) return;
  const prevEntry = { ...entry };
  const title = (document.getElementById(`evidenceEditTitle_${entryId}`)?.value || '').trim();
  if (!title) {
    focusQuickLogEditInput(`evidenceEditTitle_${entryId}`);
    return;
  }
  entry.type = (document.getElementById(`evidenceEditType_${entryId}`)?.value || entry.type || 'discovery').trim();
  entry.severity = (document.getElementById(`evidenceEditSeverity_${entryId}`)?.value || entry.severity || 'medium').trim();
  entry.title = title;
  entry.summary = (document.getElementById(`evidenceEditSummary_${entryId}`)?.value || '').trim();
  entry.details = entry.summary;
  entry.impact = (document.getElementById(`evidenceEditImpact_${entryId}`)?.value || '').trim();
  entry.recommendation = (document.getElementById(`evidenceEditRecommendation_${entryId}`)?.value || '').trim();
  entry.source_command = (document.getElementById(`evidenceEditCommand_${entryId}`)?.value || '').trim();
  entry.target_id = (document.getElementById(`evidenceEditTarget_${entryId}`)?.value || '').trim() || null;
  entry.sync_mode = (document.getElementById(`evidenceEditSync_${entryId}`)?.value || 'export_only').trim();
  entry.source_note_id = entry.source_note_id || prevEntry.source_note_id || prevEntry.note_id || null;
  entry.note_id = findingUsesNoteSync(entry.sync_mode) ? ((document.getElementById(`evidenceEditNote_${entryId}`)?.value || '').trim() || null) : null;
  if (findingUsesNoteSync(entry.sync_mode) && !entry.note_id) {
    focusQuickLogEditInput(`evidenceEditTitle_${entryId}`);
    return;
  }
  entry.updated = Date.now();
  const syncedNotes = applyFindingNoteSyncChanges(prevEntry, entry);
  clearQuickLogEditing();
  saveNotes();
  syncedNotes.forEach(applySyncedNoteUpdate);
  renderFindingsList();
}

function getActiveQuickLogEntries() {
  if (_activeSvcTab === 'paths') return getSessionPaths();
  if (_activeSvcTab === 'loot') return getSessionLoot();
  return getSessionServices();
}

function renderSvcClearAction() {
  const btn = document.getElementById('svcClearBtn');
  if (!btn) return;
  const labels = { ports: 'Clear Ports', paths: 'Clear Paths', loot: 'Clear Loot' };
  const count = getActiveQuickLogEntries().length;
  btn.textContent = count ? `${labels[_activeSvcTab] || 'Clear All'} (${count})` : (labels[_activeSvcTab] || 'Clear All');
  btn.disabled = !activeSessionId || count === 0;
}

async function clearActiveQuickLog() {
  if (!activeSessionId) return;
  const sess = sessions[activeSessionId];
  if (!sess) return;

  const labels = {
    ports: { title: 'Clear Ports', key: 'services', noun: 'port/service entries' },
    paths: { title: 'Clear Paths', key: 'paths', noun: 'path entries' },
    loot: { title: 'Clear Loot', key: 'loot', noun: 'loot entries' },
  };
  const config = labels[_activeSvcTab] || labels.ports;
  const entries = getActiveQuickLogEntries();
  if (!entries.length) return;

  try {
    await showConfirmDialog({
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
      title: config.title,
      bigIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
      description: `Remove all ${entries.length} visible ${config.noun}?`,
      confirmLabel: 'Clear All',
      danger: true,
    });
  } catch {
    return;
  }

  const removeIds = new Set(entries.map((entry) => entry.id));
  sess[config.key] = (Array.isArray(sess[config.key]) ? sess[config.key] : []).filter((entry) => !removeIds.has(entry?.id));
  const syncedNetworkNotes = config.key === 'services'
    ? [...new Set(entries.map(entry => entry?.target_id).filter(Boolean))]
        .map(targetId => syncSessionServicesToNetworkEnumerationNote(targetId, false))
        .filter(Boolean)
    : [];
  const syncedWebNotes = config.key === 'paths'
    ? [...new Set(entries.map(entry => entry?.target_id).filter(Boolean))]
        .map(targetId => syncSessionPathsToNetworkEnumerationNote(targetId, false))
        .filter(Boolean)
    : [];
  const syncedCredentialsNote = config.key === 'loot' ? syncSessionLootToCredentialsNote(false) : false;
  saveNotes();
  renderSvcLogTable();
  renderPathTable();
  renderLootTable();
  updateSvcTabCounts();
  if (syncedCredentialsNote) {
    renderNotesList();
    renderSessionSidebar();
    if (activeNoteId === syncedCredentialsNote.id && typeof noteEditor !== 'undefined' && noteEditor) {
      cmSetValue(noteEditor, syncedCredentialsNote.body || '');
      const moEl = document.getElementById('noteModifiedAt');
      if (moEl) {
        moEl.textContent = new Date(syncedCredentialsNote.updated).toLocaleString('en-GB', {
          day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
        });
      }
      if (typeof updateNotePreview === 'function') updateNotePreview();
    }
  }
  syncedNetworkNotes.forEach(applySyncedNoteUpdate);
  syncedWebNotes.forEach(applySyncedNoteUpdate);
  showToast(`✓ Cleared ${config.noun}`);
}

function toggleToolPaste(kind) {
  const panelMap = {
    ports: 'portPastePanel',
    paths: 'pathPastePanel',
    loot: 'lootPastePanel',
  };
  const toggleMap = {
    ports: 'portPasteToggle',
    paths: 'pathPasteToggle',
    loot: 'lootPasteToggle',
  };
  const inputMap = {
    ports: 'portPasteInput',
    paths: 'pathPasteInput',
    loot: 'lootPasteInput',
  };
  const panel = document.getElementById(panelMap[kind]);
  const toggle = document.getElementById(toggleMap[kind]);
  if (!panel || !toggle) return;
  const isOpen = panel.style.display === 'flex';
  panel.style.display = isOpen ? 'none' : 'flex';
  toggle.style.color = isOpen ? '' : 'var(--text)';
  toggle.style.borderColor = isOpen ? '' : 'rgba(var(--accent-rgb),0.32)';
  toggle.style.background = isOpen ? '' : 'rgba(var(--accent-rgb),0.08)';
  toggle.style.boxShadow = isOpen ? '' : 'inset 0 0 0 1px rgba(var(--accent-rgb),0.12)';
  if (!isOpen) {
    document.getElementById(inputMap[kind])?.focus();
  } else {
    resetPastePanel(kind);
  }
  updateSvcPopoverLayout();
}

function resetPastePanel(kind) {
  const toggleMap = {
    ports: 'portPasteToggle',
    paths: 'pathPasteToggle',
    loot: 'lootPasteToggle',
  };
  const toggle = document.getElementById(toggleMap[kind]);
  if (toggle) {
    toggle.style.color = '';
    toggle.style.borderColor = '';
    toggle.style.background = '';
    toggle.style.boxShadow = '';
  }
  if (kind === 'ports') {
    document.getElementById('portPasteInput').value = '';
    document.getElementById('portParsePreview').style.display = 'none';
    document.getElementById('portCommitBtn').style.display = 'none';
    _portParsed = [];
  } else {
    if (kind === 'loot') {
      document.getElementById('lootPasteInput').value = '';
      document.getElementById('lootParsePreview').style.display = 'none';
      document.getElementById('lootCommitBtn').style.display = 'none';
      _lootParsed = [];
      return;
    }
    document.getElementById('pathPasteInput').value = '';
    document.getElementById('pathParsePreview').style.display = 'none';
    document.getElementById('pathCommitBtn').style.display = 'none';
    _pathParsed = [];
  }
}

function parsePortOutput(text) {
  const results = [];
  const seen = new Set();

  for (const raw of text.split('\n')) {
    const line = raw.trim();

    const nmapLine = line.match(/^(\d+)\/(tcp|udp|sctp)\s+open\s+(\S+)(?:\s+(.+))?$/i);
    if (nmapLine) {
      const port = nmapLine[1];
      const proto = nmapLine[2].toLowerCase();
      if (seen.has(`${port}/${proto}`)) continue;
      seen.add(`${port}/${proto}`);
      let service = nmapLine[3] || '';
      let version = (nmapLine[4] || '').replace(/\s*\(\([^)]*\)\)/g, '').replace(/\s*\(protocol \d[\d.]*\)/i, '').trim();
      if (service.startsWith('ssl/')) { version = (`SSL ${version}`).trim(); service = service.slice(4); }
      results.push({ port, proto, service, version: version.slice(0, 80), notes: '' });
      continue;
    }

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

    const rustscan = line.match(/^Open\s+[\d.]+:(\d+)$/i);
    if (rustscan) {
      const port = rustscan[1];
      const proto = 'tcp';
      if (seen.has(`${port}/${proto}`)) continue;
      seen.add(`${port}/${proto}`);
      results.push({ port, proto, service: '', version: '', notes: '' });
      continue;
    }

    const masscan = line.match(/^Discovered open port\s+(\d+)\/(tcp|udp)\s+on\s+/i);
    if (masscan) {
      const port = masscan[1];
      const proto = masscan[2].toLowerCase();
      if (seen.has(`${port}/${proto}`)) continue;
      seen.add(`${port}/${proto}`);
      results.push({ port, proto, service: '', version: '', notes: '' });
      continue;
    }

    const masscanList = line.match(/^open\s+(tcp|udp)\s+(\d+)\s+[\d.]+/i);
    if (masscanList) {
      const proto = masscanList[1].toLowerCase();
      const port = masscanList[2];
      if (seen.has(`${port}/${proto}`)) continue;
      seen.add(`${port}/${proto}`);
      results.push({ port, proto, service: '', version: '', notes: '' });
    }
  }

  return results.sort((a, b) => (parseInt(a.port) || 0) - (parseInt(b.port) || 0));
}

function parseAndPreviewPorts() {
  const raw = document.getElementById('portPasteInput').value;
  const preview = document.getElementById('portParsePreview');
  const commitBtn = document.getElementById('portCommitBtn');
  _portParsed = parsePortOutput(raw);
  preview.style.display = 'block';
  if (!_portParsed.length) {
    preview.innerHTML = '<div class="nmap-preview-none">No open ports found — check format (nmap · rustscan · masscan).</div>';
    commitBtn.style.display = 'none';
    return;
  }
  const previewTargetId = resolveQuickLogTargetId();
  const existing = new Set(getSessionServices().map(s => buildScopedServiceKey(s.port, s.proto, s.target_id || previewTargetId)));
  const fresh = _portParsed.filter(r => !existing.has(buildScopedServiceKey(r.port, r.proto, previewTargetId)));
  const dupes = _portParsed.length - fresh.length;
  let html = `<div class="nmap-preview-hdr"><span>${_portParsed.length}</span> port${_portParsed.length !== 1 ? 's' : ''} found`;
  if (dupes) html += ` &nbsp;·&nbsp; <span style="color:var(--muted)">${dupes} already logged</span>`;
  html += '</div><table class="svc-table svc-table-ports" style="margin-bottom:4px"><thead><tr><th>Port</th><th>Service</th><th>Version</th></tr></thead><tbody>';
  html += _portParsed.map(r => {
    const isDupe = existing.has(buildScopedServiceKey(r.port, r.proto, previewTargetId));
    return `<tr style="${isDupe ? 'opacity:0.4' : ''}"><td>${esc(r.port)}${r.proto !== 'tcp' ? `<span style="color:var(--muted);font-weight:400">/${esc(r.proto)}</span>` : ''}</td><td>${esc(r.service || '—')}</td><td style="color:var(--text2)">${esc(r.version || '')}</td></tr>`;
  }).join('');
  html += '</tbody></table>';
  preview.innerHTML = html;
  if (fresh.length > 0) {
    commitBtn.style.display = 'block';
    commitBtn.textContent = `＋ Add ${fresh.length} new`;
  } else {
    commitBtn.style.display = 'none';
    preview.innerHTML += '<div class="nmap-preview-none">All ports already logged.</div>';
  }
}

function commitPortParse() {
  if (!_portParsed.length) return;
  if (!ensureActiveSession('add ports')) return;
  if (!sessions[activeSessionId].services) sessions[activeSessionId].services = [];
  const targetId = resolveQuickLogTargetId();
  const existing = new Set(getAllSessionServices().map(s => buildScopedServiceKey(s.port, s.proto, s.target_id)));
  let added = 0;
  for (const r of _portParsed) {
    const key = buildScopedServiceKey(r.port, r.proto, targetId);
    if (existing.has(key)) continue;
    existing.add(key);
    const entry = { id: `svc_${Date.now()}_${added}`, target_id: targetId, port: r.port, proto: r.proto, service: r.service, version: r.version, notes: '', added: Date.now() };
    sessions[activeSessionId].services.push(entry);
    added++;
  }
  const syncedNetworkNote = targetId ? syncSessionServicesToNetworkEnumerationNote(targetId, added > 0) : false;
  saveNotes();
  renderSvcLogTable();
  updateSvcTabCounts();
  applySyncedNoteUpdate(syncedNetworkNote);
  showToast(`✓ Added ${added} port${added !== 1 ? 's' : ''}`);
  toggleToolPaste('ports');
}

function resolveMatrixPreviewTargetId(previewTarget) {
  if (activeTargetId) return activeTargetId;
  const targets = typeof getSessionTargets === 'function' ? getSessionTargets() : [];
  const candidates = [previewTarget?.target, previewTarget?.displayTarget]
    .map(value => String(value || '').trim().toLowerCase())
    .filter(Boolean);
  if (candidates.length) {
    const match = targets.find((target) => {
      const values = [target?.ip, target?.domain, target?.label]
        .map(value => String(value || '').trim().toLowerCase())
        .filter(Boolean);
      return values.some(value => candidates.includes(value));
    });
    if (match?.id) return match.id;
  }
  if (targets.length === 1) return targets[0].id;
  return null;
}

function insertQuickLogPortsFromMatrixPreview(previewTarget) {
  if (!activeSessionId || !previewTarget || !Array.isArray(previewTarget.ports) || !previewTarget.ports.length) {
    showToast('⚠ No parsed ports to insert', 'err');
    return false;
  }
  const targetId = resolveMatrixPreviewTargetId(previewTarget);
  if (!targetId) {
    showToast('⚠ Select a target first for port insertion', 'err');
    return false;
  }
  if (!sessions[activeSessionId].services) sessions[activeSessionId].services = [];
  const existing = new Set(
    sessions[activeSessionId].services
      .filter(entry => (entry?.target_id || null) === targetId)
      .map(entry => `${entry.port}/${entry.proto || 'tcp'}`)
  );

  let added = 0;
  previewTarget.ports.forEach((row) => {
    const port = String(row?.port || '').trim();
    const proto = String(row?.protocol || row?.proto || 'tcp').trim().toLowerCase() || 'tcp';
    if (!port || existing.has(`${port}/${proto}`)) return;
    sessions[activeSessionId].services.push({
      id: `svc_${Date.now()}_${added}`,
      target_id: targetId,
      port,
      proto,
      service: String(row?.service || '').trim(),
      version: String(row?.version || '').trim(),
      notes: String(row?.notes || '').trim(),
      added: Date.now(),
    });
    existing.add(`${port}/${proto}`);
    added += 1;
  });

  const syncedNetworkNote = syncSessionServicesToNetworkEnumerationNote(targetId, added > 0);
  saveNotes();
  renderSvcLogTable();
  updateSvcTabCounts();
  applySyncedNoteUpdate(syncedNetworkNote);
  if (added > 0) {
    showToast(`✓ Added ${added} port${added !== 1 ? 's' : ''}`);
    return true;
  }
  showToast('⚠ All parsed ports already logged', 'err');
  return false;
}

window.insertQuickLogPortsFromMatrixPreview = insertQuickLogPortsFromMatrixPreview;

function parsePathOutput(text) {
  const results = [];
  const seen = new Set();
  const lines = text.split('\n');
  const ffufMeta = {};

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].trim().match(/^\[Status:\s*(\d+),\s*Size:\s*(\d+)/i);
    if (m) {
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

    const gobuster = line.match(/^(\S+)\s+\(Status:\s*(\d+)\)(?:\s*\[Size:\s*(\d+)\])?(?:\s*\[-->\s*([^\]]+)\])?/i);
    if (gobuster && gobuster[1].startsWith('/')) {
      const path = gobuster[1];
      const status = gobuster[2];
      const size = gobuster[3] || '';
      const redir = gobuster[4] ? `→ ${gobuster[4].trim()}` : '';
      if (seen.has(path)) continue;
      seen.add(path);
      results.push({ path, status, size, notes: redir });
      continue;
    }

    const gobusterDns = line.match(/^Found:\s+(\S+)(?:\s+Status:\s*(\d+))?/i);
    if (gobusterDns && !gobusterDns[1].startsWith('/') && gobusterDns[1].includes('.')) {
      const path = gobusterDns[1];
      const status = gobusterDns[2] || '';
      if (seen.has(path)) continue;
      seen.add(path);
      results.push({ path, status, size: '', notes: '' });
      continue;
    }

    if (/^\[Status:\s*\d+/i.test(line)) continue;

    const ffufUrl = line.match(/^\|\s*URL\s*\|\s*(https?:\/\/[^\s]+)/i);
    if (ffufUrl) {
      try {
        const u = new URL(ffufUrl[1]);
        const path = u.pathname + (u.search || '');
        if (seen.has(path)) continue;
        seen.add(path);
        const meta = ffufMeta[idx] || {};
        results.push({ path, status: meta.status || '', size: meta.size || '', notes: '' });
      } catch (_) {}
      continue;
    }

    const ffufCompact = line.match(/^(\S+)\s+\[Status:\s*(\d+),\s*Size:\s*(\d+)/i);
    if (ffufCompact && ffufCompact[1].startsWith('/')) {
      const path = ffufCompact[1];
      const status = ffufCompact[2];
      const size = ffufCompact[3];
      if (seen.has(path)) continue;
      seen.add(path);
      results.push({ path, status, size, notes: '' });
      continue;
    }

    const dirbFile = line.match(/^(?:File|Dir) found:\s+(\S+?)(?:\s+-\s+(\d+))?$/i);
    if (dirbFile) {
      const path = dirbFile[1];
      const status = dirbFile[2] || '';
      if (seen.has(path)) continue;
      seen.add(path);
      results.push({ path, status, size: '', notes: '' });
      continue;
    }

    const plainPath = line.match(/^(\/\S*)$/);
    if (plainPath) {
      const path = plainPath[1];
      if (seen.has(path)) continue;
      seen.add(path);
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
  const raw = document.getElementById('pathPasteInput').value;
  const preview = document.getElementById('pathParsePreview');
  const commitBtn = document.getElementById('pathCommitBtn');
  _pathParsed = parsePathOutput(raw);
  preview.style.display = 'block';
  if (!_pathParsed.length) {
    preview.innerHTML = '<div class="nmap-preview-none">No paths found — check format (gobuster · ffuf · dirbuster).</div>';
    commitBtn.style.display = 'none';
    return;
  }
  const previewTargetId = resolveQuickLogTargetId();
  const existing = new Set(getSessionPaths().map(p => buildScopedPathKey(p.path, p.target_id || previewTargetId)));
  const fresh = _pathParsed.filter(r => !existing.has(buildScopedPathKey(r.path, previewTargetId)));
  const dupes = _pathParsed.length - fresh.length;
  let html = `<div class="nmap-preview-hdr"><span>${_pathParsed.length}</span> path${_pathParsed.length !== 1 ? 's' : ''} found`;
  if (dupes) html += ` &nbsp;·&nbsp; <span style="color:var(--muted)">${dupes} already logged</span>`;
  html += '</div><table class="path-table" style="margin-bottom:4px"><thead><tr><th>Status</th><th>Path</th><th>Size</th></tr></thead><tbody>';
  html += _pathParsed.map(r => {
    const isDupe = existing.has(buildScopedPathKey(r.path, previewTargetId));
    return `<tr style="${isDupe ? 'opacity:0.4' : ''}"><td><span class="path-status ${statusClass(r.status)}">${esc(r.status || '—')}</span></td><td style="color:var(--text);word-break:break-all">${esc(r.path)}</td><td style="color:var(--muted)">${esc(r.size)}</td></tr>`;
  }).join('');
  html += '</tbody></table>';
  preview.innerHTML = html;
  if (fresh.length > 0) {
    commitBtn.style.display = 'block';
    commitBtn.textContent = `＋ Add ${fresh.length} new`;
  } else {
    commitBtn.style.display = 'none';
    preview.innerHTML += '<div class="nmap-preview-none">All paths already logged.</div>';
  }
}

function commitPathParse() {
  if (!_pathParsed.length) return;
  if (!ensureActiveSession('add paths')) return;
  if (!sessions[activeSessionId].paths) sessions[activeSessionId].paths = [];
  const targetId = resolveQuickLogTargetId();
  const existing = new Set(getAllSessionPaths().map(p => buildScopedPathKey(p.path, p.target_id)));
  let added = 0;
  for (const r of _pathParsed) {
    const key = buildScopedPathKey(r.path, targetId);
    if (existing.has(key)) continue;
    existing.add(key);
    sessions[activeSessionId].paths.push({ id: `path_${Date.now()}_${added}`, target_id: targetId, path: r.path, status: r.status, size: r.size, notes: r.notes, added: Date.now() });
    added++;
  }
  const syncedNetworkNote = targetId ? syncSessionPathsToNetworkEnumerationNote(targetId, added > 0) : false;
  saveNotes();
  renderPathTable();
  updateSvcTabCounts();
  applySyncedNoteUpdate(syncedNetworkNote);
  showToast(`✓ Added ${added} path${added !== 1 ? 's' : ''}`);
  toggleToolPaste('paths');
}

function addPathLog() {
  const input = document.getElementById('pathQuickInput');
  const raw = (input && input.value) ? input.value.trim() : '';
  if (!raw) { if (input) input.focus(); return; }
  if (!ensureActiveSession('add a path')) { if (input) input.focus(); return; }
  let status = '';
  let path = '';
  let notes = '';
  const m = raw.match(/^(\d{3})\s+(\S+)(?:\s+(.+))?$/);
  if (m) { status = m[1]; path = m[2]; notes = m[3] || ''; }
  else { path = raw.split(/\s+/)[0]; notes = raw.slice(path.length).trim(); }
  if (!path.startsWith('/') && !path.includes('.')) { input.focus(); return; }
  if (!sessions[activeSessionId].paths) sessions[activeSessionId].paths = [];
  const targetId = resolveQuickLogTargetId();
  const entry = { id: `path_${Date.now()}`, target_id: targetId, path, status, size: '', notes, added: Date.now() };
  sessions[activeSessionId].paths.push(entry);
  const syncedNetworkNote = targetId ? syncSessionPathsToNetworkEnumerationNote(targetId, true) : false;
  input.value = '';
  input.focus();
  saveNotes();
  renderPathTable();
  updateSvcTabCounts();
  applySyncedNoteUpdate(syncedNetworkNote);
}

function deletePathLog(pathId) {
  if (!ensureActiveSession('remove a path')) return;
  const path = (sessions[activeSessionId].paths || []).find(p => p.id === pathId);
  if (isQuickLogEditing('path', pathId)) clearQuickLogEditing();
  sessions[activeSessionId].paths = (sessions[activeSessionId].paths || []).filter(p => p.id !== pathId);
  const syncedNetworkNote = path?.target_id ? syncSessionPathsToNetworkEnumerationNote(path.target_id, false) : false;
  saveNotes();
  renderPathTable();
  updateSvcTabCounts();
  applySyncedNoteUpdate(syncedNetworkNote);
}

function updatePathNotes(pathId, val) {
  if (!ensureActiveSession('update a path')) return;
  const p = (sessions[activeSessionId].paths || []).find(path => path.id === pathId);
  if (!p) return;
  p.notes = val;
  const syncedNetworkNote = p.target_id ? syncSessionPathsToNetworkEnumerationNote(p.target_id, false) : false;
  saveNotes();
  applySyncedNoteUpdate(syncedNetworkNote);
}

function commitPathEdit(pathId) {
  if (!ensureActiveSession('edit a path')) return;
  const p = (sessions[activeSessionId].paths || []).find(path => path.id === pathId);
  if (!p) return;
  const status = (document.getElementById(`pathEditStatus_${pathId}`)?.value || '').trim();
  const path = (document.getElementById(`pathEditPath_${pathId}`)?.value || '').trim();
  const notes = (document.getElementById(`pathEditNotes_${pathId}`)?.value || '').trim();
  if (!path) {
    showToast('⚠ Path cannot be empty', 'err');
    focusQuickLogEditInput(`pathEditPath_${pathId}`);
    return;
  }
  p.status = status;
  p.path = path;
  p.notes = notes;
  clearQuickLogEditing();
  const syncedNetworkNote = p.target_id ? syncSessionPathsToNetworkEnumerationNote(p.target_id, false) : false;
  saveNotes();
  renderPathTable();
  applySyncedNoteUpdate(syncedNetworkNote);
}

function getQuickLogScopeTargetId() {
  return resolveQuickLogTargetId();
}

function getAllSessionServices() {
  if (!activeSessionId || !sessions[activeSessionId]) return [];
  return sessions[activeSessionId].services || [];
}

function getAllSessionPaths() {
  if (!activeSessionId || !sessions[activeSessionId]) return [];
  return sessions[activeSessionId].paths || [];
}

function getAllSessionLoot() {
  if (!activeSessionId || !sessions[activeSessionId]) return [];
  return sessions[activeSessionId].loot || [];
}

function buildScopedServiceKey(port, proto = 'tcp', targetId = null) {
  return `${targetId || ''}::${String(port || '').trim()}/${String(proto || 'tcp').trim().toLowerCase() || 'tcp'}`;
}

function buildScopedPathKey(path, targetId = null) {
  return `${targetId || ''}::${String(path || '').trim()}`;
}

function buildScopedLootKey(type, credential, host = '', targetId = null) {
  return `${targetId || ''}::${String(type || '').trim()}::${String(credential || '').trim()}::${String(host || '').trim()}`;
}

function getSessionPaths(options = {}) {
  const entries = getAllSessionPaths();
  if (options.scoped === false) return entries;
  const targetId = getQuickLogScopeTargetId();
  if (!targetId) return entries;
  return entries.filter((entry) => (entry?.target_id || null) === targetId);
}

function renderPathTable() {
  const el = document.getElementById('pathLogTable');
  if (!el) return;
  updateSvcTabCounts();
  const paths = [...getSessionPaths()].sort((a, b) => (a.path < b.path ? -1 : 1));
  if (!paths.length) {
    el.innerHTML = '<div class="svc-empty">No paths logged — add one above or import tool output</div>';
    return;
  }
  el.innerHTML = `<table class="path-table">
    <thead><tr><th>Status</th><th>Path</th><th>Notes</th><th></th></tr></thead>
    <tbody>${paths.map(p => isQuickLogEditing('path', p.id) ? `<tr>
      <td><input class="svc-notes-cell ql-row-input" id="pathEditStatus_${p.id}" type="text" value="${esc(p.status || '')}" placeholder="200"
        onclick="event.stopPropagation()" onkeydown="handleQuickLogEditKeydown(event,'path','${p.id}')"></td>
      <td><input class="svc-notes-cell ql-row-input" id="pathEditPath_${p.id}" type="text" value="${esc(p.path || '')}" placeholder="/admin"
        onclick="event.stopPropagation()" onkeydown="handleQuickLogEditKeydown(event,'path','${p.id}')"></td>
      <td><input class="svc-notes-cell ql-row-input" id="pathEditNotes_${p.id}" type="text" value="${esc(p.notes || '')}" placeholder="notes…"
        onclick="event.stopPropagation()" onkeydown="handleQuickLogEditKeydown(event,'path','${p.id}')"></td>
      <td>${renderQuickLogRowActions('path', p.id, 'deletePathLog')}</td>
    </tr>` : `<tr>
      <td><span class="path-status ${statusClass(p.status)}">${esc(p.status || '—')}</span></td>
      <td style="color:var(--text);word-break:break-all">${esc(p.path)}</td>
      <td>${esc(p.notes || '')}</td>
      <td>${renderQuickLogRowActions('path', p.id, 'deletePathLog')}</td>
    </tr>`).join('')}
    </tbody></table>`;
  if (_editingQuickLog?.kind === 'path') focusQuickLogEditInput(`pathEditPath_${_editingQuickLog.id}`);
}

function parseSvcInput(raw) {
  const str = raw.trim();
  if (!str) return null;
  let port = '';
  let proto = 'tcp';
  let service = '';
  let version = '';
  let notes = '';
  const portProtoMatch = str.match(/^(\d+)(?:\/(tcp|udp|sctp))?/i);
  if (!portProtoMatch) { service = str; return { port, proto, service, version, notes }; }
  port = portProtoMatch[1];
  proto = (portProtoMatch[2] || 'tcp').toLowerCase();
  const tokens = str.slice(portProtoMatch[0].length).trim().split(/\s+/).filter(Boolean);
  if (tokens.length >= 1) service = tokens[0];
  if (tokens.length >= 2) version = tokens[1];
  if (tokens.length >= 3) notes = tokens.slice(2).join(' ');
  return { port, proto, service, version, notes };
}

function getSessionServices(options = {}) {
  const entries = getAllSessionServices();
  if (options.scoped === false) return entries;
  const targetId = getQuickLogScopeTargetId();
  if (!targetId) return entries;
  return entries.filter((entry) => (entry?.target_id || null) === targetId);
}

function escapeMarkdownTableCell(value) {
  return String(value || '').replace(/\|/g, '\\|').trim();
}

function parseServiceForNetworkRow(entry) {
  if (!entry) return null;
  if (!String(entry.port || '').trim()) return null;
  return {
    port: escapeMarkdownTableCell(entry.port),
    proto: escapeMarkdownTableCell(entry.proto || 'tcp'),
    service: escapeMarkdownTableCell(entry.service),
    version: escapeMarkdownTableCell(entry.version),
    notes: escapeMarkdownTableCell(entry.notes),
  };
}

function buildNetworkEnumerationTableRow(row, mode = 'full') {
  if (mode === 'minimal') {
    const svc = [row.service, row.version].filter(Boolean).join(' ').trim();
    return `| ${row.port} | ${svc} | ${row.notes} |`;
  }
  return `| ${row.port} | ${row.proto} | ${row.service} | ${row.version} | ${row.notes} |`;
}

function ensureNetworkEnumerationSection(lines) {
  const insertBeforeIdx = lines.findIndex(line => /^##\s+Web$/i.test(line.trim()) || /^##\s+Notes$/i.test(line.trim()));
  const section = [
    '## Open Ports & Services',
    '',
    '| Port | Proto | Service | Version | Notes |',
    '|------|-------|---------|---------|-------|',
    '|      |       |         |         |       |',
    '',
  ];
  const at = insertBeforeIdx === -1 ? lines.length : insertBeforeIdx;
  lines.splice(at, 0, ...section);
  return lines;
}

function replaceNetworkEnumerationTableInBody(body, rows) {
  let lines = String(body || '').split('\n');
  let headerIdx = lines.findIndex(line => /^\|\s*Port\s*\|\s*Proto\s*\|\s*Service\s*\|\s*Version\s*\|\s*Notes\s*\|$/i.test(line.trim()));
  let mode = 'full';

  if (headerIdx === -1) {
    headerIdx = lines.findIndex(line => /^\|\s*Port\s*\|\s*Service\s*\|\s*Notes\s*\|$/i.test(line.trim()));
    if (headerIdx !== -1) mode = 'minimal';
  }

  if (headerIdx === -1) {
    lines = ensureNetworkEnumerationSection(lines);
    headerIdx = lines.findIndex(line => /^\|\s*Port\s*\|\s*Proto\s*\|\s*Service\s*\|\s*Version\s*\|\s*Notes\s*\|$/i.test(line.trim()));
    mode = 'full';
  }

  if (headerIdx === -1) return null;
  const separatorIdx = headerIdx + 1;
  if (!lines[separatorIdx] || !/^\|\s*-+/.test(lines[separatorIdx].trim())) return null;

  let tableEnd = separatorIdx + 1;
  while (tableEnd < lines.length && /^\|/.test(lines[tableEnd].trim())) tableEnd++;

  const nextRows = rows.length
    ? rows.map(row => buildNetworkEnumerationTableRow(row, mode))
    : (mode === 'minimal' ? ['|      |         |       |'] : ['|      |       |         |         |       |']);

  lines.splice(separatorIdx + 1, tableEnd - (separatorIdx + 1), ...nextRows);
  return lines.join('\n');
}

function parsePathForWebRow(entry) {
  if (!entry) return null;
  if (!String(entry.path || '').trim()) return null;
  return {
    path: escapeMarkdownTableCell(entry.path),
    status: escapeMarkdownTableCell(entry.status),
    size: escapeMarkdownTableCell(entry.size),
    notes: escapeMarkdownTableCell(entry.notes),
  };
}

function buildWebEndpointTableRow(row) {
  return `| ${row.path} | ${row.status} | ${row.size} | ${row.notes} |`;
}

function replaceWebEndpointsTableInBody(body, rows) {
  const source = String(body || '');
  const lines = source.split('\n');
  let headerIdx = lines.findIndex(line => /^##\s+Web$/i.test(line.trim()));

  if (headerIdx === -1) {
    const insertBeforeIdx = lines.findIndex(line => /^##\s+Notes$/i.test(line.trim()));
    const section = [
      '## Web',
      '',
      '| Path | Status | Size | Notes |',
      '|------|--------|------|-------|',
      '|      |        |      |       |',
      '',
    ];
    const at = insertBeforeIdx === -1 ? lines.length : insertBeforeIdx;
    lines.splice(at, 0, ...section);
    headerIdx = at;
  }

  const tableHeaderIdx = lines.findIndex((line, idx) => idx > headerIdx && /^\|\s*Path\s*\|\s*Status\s*\|\s*Size\s*\|\s*Notes\s*\|$/i.test(line.trim()));
  if (tableHeaderIdx === -1) return null;
  const separatorIdx = tableHeaderIdx + 1;
  if (!lines[separatorIdx] || !/^\|\s*-+/.test(lines[separatorIdx].trim())) return null;

  let tableEnd = separatorIdx + 1;
  while (tableEnd < lines.length && /^\|/.test(lines[tableEnd].trim())) tableEnd++;

  const nextRows = rows.length
    ? rows.map(buildWebEndpointTableRow)
    : ['|      |        |      |       |'];

  lines.splice(separatorIdx + 1, tableEnd - (separatorIdx + 1), ...nextRows);
  return lines.join('\n');
}

function getSessionTargetById(targetId) {
  if (!activeSessionId || !targetId || !sessions[activeSessionId]) return null;
  const targets = sessions[activeSessionId].targets || [];
  return targets.find(target => target.id === targetId) || null;
}

function populateNetworkEnumerationOverview(body, target = null) {
  const resolvedTarget = target || getActiveTarget() || null;
  const ip = resolvedTarget?.ip || '';
  const domain = resolvedTarget?.domain || '';
  const hostname = resolvedTarget ? (resolvedTarget.label || resolvedTarget.ip || resolvedTarget.domain || '') : '';
  const replacements = {
    IP: ip,
    Domain: domain,
    Hostname: hostname,
  };

  return String(body || '')
    .split('\n')
    .map((line) => {
      const match = line.match(/^\|\s*(IP|Domain|Hostname)\s*\|\s*(.*?)\s*\|$/i);
      if (!match) return line;
      const field = match[1];
      const current = String(match[2] || '').trim();
      const next = replacements[field] || '';
      if (current || !next) return line;
      return `| ${field} | ${next} |`;
    })
    .join('\n');
}

function resolveQuickLogTargetId() {
  return activeTargetId || getActiveTarget()?.id || null;
}

function findTargetNetworkEnumerationNote(targetId) {
  if (!activeSessionId || !targetId) return null;
  return Object.values(notes).find(note =>
    note.session_id === activeSessionId &&
    note.type === 'network-enumeration' &&
    note.target_id === targetId
  ) || null;
}

function ensureTargetNetworkEnumerationNote(targetId) {
  if (!NOTE_TEMPLATES?.['network-enumeration'] || !activeSessionId || !targetId) return null;
  const target = getSessionTargetById(targetId);
  if (!target) return null;

  let note = findTargetNetworkEnumerationNote(targetId);
  if (note) return note;

  const id = 'note_' + Date.now();
  const tmpl = typeof resolveTemplateForCreation === 'function'
    ? resolveTemplateForCreation('network-enumeration')
    : NOTE_TEMPLATES['network-enumeration'];
  note = {
    id,
    session_id: activeSessionId,
    target_id: targetId,
    type: 'network-enumeration',
    title: tmpl.title || '',
    body: populateNetworkEnumerationOverview(
      typeof buildNoteBodyFromTemplate === 'function' ? buildNoteBodyFromTemplate(tmpl) : (tmpl.body || ''),
      target
    ),
    tags: tmpl.default_tags ? [...tmpl.default_tags] : [],
    target_ip: target.ip || null,
    target_domain: target.domain || null,
    created: Date.now(),
    updated: Date.now(),
  };
  notes[id] = note;
  return note;
}

function buildNetworkEnumerationBody(target) {
  const tmpl = typeof resolveTemplateForCreation === 'function'
    ? resolveTemplateForCreation('network-enumeration')
    : NOTE_TEMPLATES['network-enumeration'];
  const base = typeof buildNoteBodyFromTemplate === 'function'
    ? buildNoteBodyFromTemplate(tmpl)
    : (tmpl?.body || '');
  return populateNetworkEnumerationOverview(base, target);
}

function syncServiceEntryToNetworkEnumerationNote(entry) {
  if (!NOTE_TEMPLATES?.['network-enumeration'] || !entry?.target_id) return false;

  return syncSessionServicesToNetworkEnumerationNote(entry.target_id, true);
}

function syncSessionServicesToNetworkEnumerationNote(targetId, createIfMissing = false) {
  if (!NOTE_TEMPLATES?.['network-enumeration'] || !targetId) return false;

  const rows = getAllSessionServices()
    .filter(entry => entry?.target_id === targetId)
    .map(parseServiceForNetworkRow)
    .filter(Boolean);

  let note = findTargetNetworkEnumerationNote(targetId);
  if (!note && createIfMissing && rows.length) note = ensureTargetNetworkEnumerationNote(targetId);
  if (!note) return false;

  const target = getSessionTargetById(targetId);
  const withOverview = populateNetworkEnumerationOverview(note.body || '', target);
  let nextBody = replaceNetworkEnumerationTableInBody(withOverview, rows);
  if (!nextBody) {
    const fallbackBody = buildNetworkEnumerationBody(target);
    nextBody = replaceNetworkEnumerationTableInBody(fallbackBody, rows);
  }
  if (!nextBody || nextBody === note.body) return false;

  note.body = nextBody;
  note.updated = Date.now();
  return note;
}

function syncSessionPathsToNetworkEnumerationNote(targetId, createIfMissing = false) {
  if (!NOTE_TEMPLATES?.['network-enumeration'] || !targetId) return false;

  const rows = getAllSessionPaths()
    .filter(entry => entry?.target_id === targetId)
    .map(parsePathForWebRow)
    .filter(Boolean);

  let note = findTargetNetworkEnumerationNote(targetId);
  if (!note && createIfMissing && rows.length) note = ensureTargetNetworkEnumerationNote(targetId);
  if (!note) return false;

  const target = getSessionTargetById(targetId);
  const withOverview = populateNetworkEnumerationOverview(note.body || '', target);
  let nextBody = replaceWebEndpointsTableInBody(withOverview, rows);
  if (!nextBody) {
    const fallbackBody = buildNetworkEnumerationBody(target);
    nextBody = replaceWebEndpointsTableInBody(fallbackBody, rows);
  }
  if (!nextBody || nextBody === note.body) return false;

  note.body = nextBody;
  note.updated = Date.now();
  return note;
}

function applySyncedNoteUpdate(note) {
  if (!note) return;
  renderNotesList();
  renderSessionSidebar();
  if (activeNoteId === note.id && typeof noteEditor !== 'undefined' && noteEditor) {
    cmSetValue(noteEditor, note.body || '');
    const moEl = document.getElementById('noteModifiedAt');
    if (moEl) {
      moEl.textContent = new Date(note.updated).toLocaleString('en-GB', {
        day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
      });
    }
    if (typeof updateNotePreview === 'function') updateNotePreview();
  }
}

function isQuickLogEditing(kind, id) {
  return _editingQuickLog?.kind === kind && _editingQuickLog?.id === id;
}

function clearQuickLogEditing() {
  _editingQuickLog = null;
}

function rerenderQuickLogKind(kind) {
  if (kind === 'service') renderSvcLogTable();
  else if (kind === 'path') renderPathTable();
  else if (kind === 'loot') renderLootTable();
  else if (kind === 'finding') renderFindingsList();
}

function startQuickLogEdit(kind, id) {
  _editingQuickLog = { kind, id };
  rerenderQuickLogKind(kind);
}

function cancelQuickLogEdit(kind, id) {
  if (!isQuickLogEditing(kind, id)) return;
  clearQuickLogEditing();
  rerenderQuickLogKind(kind);
}

function focusQuickLogEditInput(id) {
  const input = document.getElementById(id);
  if (!input) return;
  setTimeout(() => {
    input.focus();
    if (typeof input.setSelectionRange === 'function') {
      const pos = input.value.length;
      input.setSelectionRange(pos, pos);
    }
  }, 0);
}

function handleQuickLogEditKeydown(event, kind, id) {
  if (event.key === 'Enter') {
    event.preventDefault();
    if (kind === 'service') commitServiceEdit(id);
    else if (kind === 'path') commitPathEdit(id);
    else if (kind === 'loot') commitLootEdit(id);
    else if (kind === 'finding') commitFindingEdit(id);
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    cancelQuickLogEdit(kind, id);
  }
}

function renderQuickLogRowActions(kind, id, deleteFnName) {
  const deleteCall = `${deleteFnName}('${id}')`;
  if (isQuickLogEditing(kind, id)) {
    const saveCall = kind === 'service'
      ? `commitServiceEdit('${id}')`
      : kind === 'path'
        ? `commitPathEdit('${id}')`
        : kind === 'loot'
          ? `commitLootEdit('${id}')`
          : `commitFindingEdit('${id}')`;
    return `
      <div class="ql-row-actions">
        <button class="svc-quick-add-btn ql-row-save-btn" onclick="event.stopPropagation(); ${saveCall}" title="Save row" aria-label="Save row">Save</button>
        <button class="svc-del-btn ql-row-edit-btn" onclick="event.stopPropagation(); cancelQuickLogEdit('${kind}','${id}')" title="Cancel edit" aria-label="Cancel edit">Cancel</button>
        <button class="svc-del-btn" onclick="event.stopPropagation(); ${deleteCall}" title="Remove">✕</button>
      </div>
    `;
  }
  
  const noteButton = kind === 'service' ? `
    <button class="svc-del-btn ql-row-edit-btn" onclick="event.stopPropagation(); createNoteForService('${id}')" title="Create note for this service" aria-label="Create note for this service">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
    </button>
  ` : '';
  
  return `
    <div class="ql-row-actions">
      ${noteButton}
      <button class="svc-del-btn ql-row-edit-btn" onclick="event.stopPropagation(); startQuickLogEdit('${kind}','${id}')" title="Edit row" aria-label="Edit row">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>
      </button>
      <button class="svc-del-btn" onclick="event.stopPropagation(); ${deleteCall}" title="Remove">✕</button>
    </div>
  `;
}

function renderFindingRowActions(id) {
  if (isQuickLogEditing('finding', id)) return renderQuickLogRowActions('finding', id, 'deleteFindingEntry');
  return `
    <div class="ql-row-actions">
      <button class="svc-del-btn ql-row-edit-btn" onclick="event.stopPropagation(); jumpToFindingSource('${id}')" title="Jump to source" aria-label="Jump to source">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>
      </button>
      <button class="svc-del-btn ql-row-edit-btn" onclick="event.stopPropagation(); startQuickLogEdit('finding','${id}')" title="Edit row" aria-label="Edit row">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>
      </button>
      <button class="svc-del-btn ql-row-edit-btn ql-row-unflag-btn" onclick="event.stopPropagation(); deleteFindingEntry('${id}')" title="Unflag finding and keep the note content" aria-label="Unflag finding and keep the note content">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v18"/><path d="m5 4 12 3-4 5 4 5-12-3"/><path d="m18 6-9 12"/></svg>
      </button>
    </div>
  `;
}

function addServiceLog() {
  const input = document.getElementById('svcQuickInput');
  const raw = (input && input.value) ? input.value.trim() : '';
  if (!raw) { if (input) input.focus(); return; }
  if (!ensureActiveSession('add a service')) { if (input) input.focus(); return; }
  const parsed = parseSvcInput(raw);
  if (!parsed) return;
  if (!sessions[activeSessionId].services) sessions[activeSessionId].services = [];
  const targetId = resolveQuickLogTargetId();
  const entry = {
    id: `svc_${Date.now()}`,
    target_id: targetId,
    port: parsed.port,
    proto: parsed.proto,
    service: parsed.service,
    version: parsed.version,
    notes: parsed.notes,
    added: Date.now(),
  };
  sessions[activeSessionId].services.push(entry);
  const syncedNetworkNote = targetId ? syncSessionServicesToNetworkEnumerationNote(targetId, true) : false;
  input.value = '';
  input.focus();
  saveNotes();
  renderSvcLogTable();
  updateSvcTabCounts();
  applySyncedNoteUpdate(syncedNetworkNote);
}

function deleteServiceLog(svcId) {
  if (!ensureActiveSession('remove a service')) return;
  const svc = (sessions[activeSessionId].services || []).find(s => s.id === svcId);
  if (isQuickLogEditing('service', svcId)) clearQuickLogEditing();
  sessions[activeSessionId].services = (sessions[activeSessionId].services || []).filter(s => s.id !== svcId);
  const syncedNetworkNote = svc?.target_id ? syncSessionServicesToNetworkEnumerationNote(svc.target_id, false) : false;
  saveNotes();
  renderSvcLogTable();
  applySyncedNoteUpdate(syncedNetworkNote);
}

function updateSvcNotes(svcId, val) {
  if (!ensureActiveSession('update a service')) return;
  const svc = (sessions[activeSessionId].services || []).find(s => s.id === svcId);
  if (!svc) return;
  svc.notes = val;
  const syncedNetworkNote = svc.target_id ? syncSessionServicesToNetworkEnumerationNote(svc.target_id, false) : false;
  saveNotes();
  applySyncedNoteUpdate(syncedNetworkNote);
}

function commitServiceEdit(svcId) {
  if (!ensureActiveSession('edit a service')) return;
  const svc = (sessions[activeSessionId].services || []).find(s => s.id === svcId);
  if (!svc) return;
  const port = (document.getElementById(`svcEditPort_${svcId}`)?.value || '').trim();
  const proto = (document.getElementById(`svcEditProto_${svcId}`)?.value || '').trim().toLowerCase() || 'tcp';
  const service = (document.getElementById(`svcEditService_${svcId}`)?.value || '').trim();
  const version = (document.getElementById(`svcEditVersion_${svcId}`)?.value || '').trim();
  const notes = (document.getElementById(`svcEditNotes_${svcId}`)?.value || '').trim();
  if (!port) {
    showToast('⚠ Port cannot be empty', 'err');
    focusQuickLogEditInput(`svcEditPort_${svcId}`);
    return;
  }
  svc.port = port;
  svc.proto = proto;
  svc.service = service;
  svc.version = version;
  svc.notes = notes;
  clearQuickLogEditing();
  const syncedNetworkNote = svc.target_id ? syncSessionServicesToNetworkEnumerationNote(svc.target_id, false) : false;
  saveNotes();
  renderSvcLogTable();
  applySyncedNoteUpdate(syncedNetworkNote);
}

function createNoteForService(svcId) {
  if (!activeSessionId) {
    showToast('No active session', 'err');
    return;
  }

  const svcs = getAllSessionServices();
  const svc = svcs.find(s => s.id === svcId);
  if (!svc) {
    showToast('Service not found', 'err');
    return;
  }

  const target = svc.target_id ? getSessionTargetById(svc.target_id) : null;
  const targetIp = target?.ip || getIP();
  const targetDomain = target?.domain || getDomain();

  const tmpl = typeof resolveTemplateForCreation === 'function'
    ? resolveTemplateForCreation('recon')
    : NOTE_TEMPLATES['recon'] || NOTE_TEMPLATES['scratch'];

  const id = 'note_' + Date.now();
  const portProto = `${svc.port}${svc.proto ? '/' + svc.proto : ''}`;
  const serviceLabel = svc.service || 'Unknown Service';
  const title = `${portProto} ${serviceLabel} - ${targetIp !== '<IP>' ? targetIp : 'No Target'}`;

  const existingNote = Object.values(notes).find(n => 
    n.title === title && n.session_id === activeSessionId
  );
  if (existingNote) {
    showToast('The engagement note already exists', 'warn');
    return;
  }

  const contextHeader = [
    '## Service Context',
    `- **Port**: ${portProto}`,
    `- **Service**: ${serviceLabel}`,
    svc.version ? `- **Version**: ${svc.version}` : null,
    `- **Target**: ${targetIp !== '<IP>' ? targetIp : 'N/A'}${targetDomain && targetDomain !== '<DOMAIN>' ? ' (' + targetDomain + ')' : ''}`,
    '',
    '---',
    '',
    '',
  ].filter(item => item !== null && item !== undefined).join('\n');

  const body = contextHeader + '## Enumeration\n\n\n## Exploitation\n';

  const note = {
    id,
    session_id: activeSessionId,
    target_id: svc.target_id || null,
    type: 'recon',
    template_variant: tmpl.variant_id || null,
    title,
    body,
    tags: tmpl.default_tags ? [...tmpl.default_tags, 'service-enumeration'] : ['service-enumeration'],
    target_ip: targetIp !== '<IP>' ? targetIp : null,
    target_domain: targetDomain !== '<DOMAIN>' ? targetDomain : null,
    created: Date.now(),
    updated: Date.now(),
  };

  notes[id] = note;
  saveNotes();

  if (activeSessionId) {
    tlLog(activeSessionId, {
      type: 'note_created',
      noteId: id,
      noteType: 'recon',
      targetId: svc.target_id || null,
      context: `Created from service ${portProto} ${serviceLabel}`
    });
  }

  renderNotesList();
  renderSessionSidebar();
  switchView('notes', document.getElementById('nav-notes'));
  openNote(id);

  showToast(`Created note: ${title}`, 'ok');
}

function renderSvcLogTable() {
  const tableEl = document.getElementById('svcLogTable');
  if (!tableEl) return;

  const svcs = getSessionServices();
  const sorted = [...svcs].sort((a, b) => (parseInt(a.port) || 0) - (parseInt(b.port) || 0));

  updateSvcTabCounts();

  if (!sorted.length) {
    tableEl.innerHTML = '<div class="svc-empty">No services logged — add one above</div>';
    return;
  }

  tableEl.innerHTML = `
    <table class="svc-table svc-table-ports">
      <thead><tr><th>Port</th><th>Service</th><th>Version</th><th>Notes</th><th></th></tr></thead>
      <tbody>${sorted.map(s => isQuickLogEditing('service', s.id) ? `
        <tr>
          <td>
            <div class="ql-port-edit-wrap">
              <input class="svc-notes-cell ql-row-input ql-port-input" id="svcEditPort_${s.id}" type="text" value="${esc(s.port || '')}" placeholder="445"
                onclick="event.stopPropagation()" onkeydown="handleQuickLogEditKeydown(event,'service','${s.id}')">
              <input class="svc-notes-cell ql-row-input ql-proto-input" id="svcEditProto_${s.id}" type="text" value="${esc(s.proto || 'tcp')}" placeholder="tcp"
                onclick="event.stopPropagation()" onkeydown="handleQuickLogEditKeydown(event,'service','${s.id}')">
            </div>
          </td>
          <td><input class="svc-notes-cell ql-row-input" id="svcEditService_${s.id}" type="text" value="${esc(s.service || '')}" placeholder="service"
            onclick="event.stopPropagation()" onkeydown="handleQuickLogEditKeydown(event,'service','${s.id}')"></td>
          <td><input class="svc-notes-cell ql-row-input" id="svcEditVersion_${s.id}" type="text" value="${esc(s.version || '')}" placeholder="version"
            onclick="event.stopPropagation()" onkeydown="handleQuickLogEditKeydown(event,'service','${s.id}')"></td>
          <td><input class="svc-notes-cell ql-row-input" id="svcEditNotes_${s.id}" type="text" value="${esc(s.notes || '')}" placeholder="notes…"
            onclick="event.stopPropagation()" onkeydown="handleQuickLogEditKeydown(event,'service','${s.id}')"></td>
          <td>${renderQuickLogRowActions('service', s.id, 'deleteServiceLog')}</td>
        </tr>` : `
        <tr>
          <td>${renderQuickLogKbServiceLink(s) || (esc(s.port) + (s.proto && s.proto !== 'tcp' ? `<span style="color:var(--muted);font-weight:500;font-size:11px">/${esc(s.proto)}</span>` : ''))}</td>
          <td>${esc(s.service || '—')}</td>
          <td style="color:var(--text2)">${esc(s.version || '')}</td>
          <td>${esc(s.notes || '')}</td>
          <td>${renderQuickLogRowActions('service', s.id, 'deleteServiceLog')}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  if (_editingQuickLog?.kind === 'service') focusQuickLogEditInput(`svcEditPort_${_editingQuickLog.id}`);
}

function normalizeKbServiceLookupValue(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeKbServiceFileStem(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\.md$/i, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getQuickLogServiceLookupAliases(entry) {
  const aliases = new Set();
  const serviceValue = normalizeKbServiceLookupValue(entry?.service || '');
  const serviceSlug = normalizeKbServiceFileStem(serviceValue);
  if (serviceSlug) aliases.add(serviceSlug);

  const portValue = String(entry?.port || '').trim();
  if (portValue === '111') {
    aliases.add('rpc');
    aliases.add('rpcbind');
  }
  if (portValue === '135') aliases.add('msrpc');
  if (portValue === '139') aliases.add('netbios');
  if (portValue === '636') aliases.add('ldaps');
  if (portValue === '5432') aliases.add('postgresql');
  if (portValue === '1521') {
    aliases.add('oracle_db');
    aliases.add('oracledb');
  }

  if (serviceValue.includes('rpc')) aliases.add('rpc');
  if (serviceValue.includes('msrpc') || serviceValue.includes('microsoft rpc')) aliases.add('msrpc');
  if (serviceValue.includes('netbios')) aliases.add('netbios');
  if (serviceValue.includes('ldaps')) aliases.add('ldaps');
  if (serviceValue.includes('postgres')) aliases.add('postgresql');
  if (serviceValue.includes('oracle')) {
    aliases.add('oracle_db');
    aliases.add('oracledb');
  }

  return Array.from(aliases);
}

function findKbServiceForQuickLogEntry(entry) {
  if (!entry || typeof getKbCollection !== 'function') return null;
  const items = getKbCollection('services') || [];
  if (!items.length) return null;

  const portValue = String(entry.port || '').trim();
  const serviceValue = normalizeKbServiceLookupValue(entry.service || '');
  const lookupAliases = getQuickLogServiceLookupAliases(entry);

  let hit = null;
  if (portValue) {
    hit = items.find((item) => String(item.id || '').trim() === portValue)
      || items.find((item) => String(item.port || '').split('/')[0].trim() === portValue);
  }
  if (!hit && lookupAliases.length) {
    hit = items.find((item) => lookupAliases.includes(String(item.id || '').trim().toLowerCase()))
      || items.find((item) => lookupAliases.includes(normalizeKbServiceFileStem(item.file || '')))
      || items.find((item) => normalizeKbServiceLookupValue(item.name || '') === serviceValue);
  }
  return hit || null;
}

function openQuickLogKbService(id) {
  if (!id) return;
  closeSvcPopover();
  if (typeof openItem === 'function') openItem('services', id);
}

function renderQuickLogKbServiceLink(entry) {
  const kbItem = findKbServiceForQuickLogEntry(entry);
  if (!kbItem) return '';
  const portValue = esc(String(entry?.port || ''));
  const protoValue = entry?.proto && entry.proto !== 'tcp'
    ? '<span style="color:var(--muted);font-weight:500;font-size:11px">/' + esc(String(entry.proto || '')) + '</span>'
    : '';
  return '<button class="ql-kb-port-btn" type="button" onclick="openQuickLogKbService(\'' + esc(String(kbItem.id || '')) + '\')" title="Open matching KB service">' + portValue + protoValue + '</button>';
}

function setLootType(btn, type) {
  _activeLootType = type;
  document.querySelectorAll('.loot-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function getSessionLoot(options = {}) {
  const entries = getAllSessionLoot();
  if (options.scoped === false) return entries;
  const targetId = getQuickLogScopeTargetId();
  if (!targetId) return entries;
  const includeSessionWide = options.includeSessionWide !== false;
  return entries.filter((entry) => {
    const entryTargetId = entry?.target_id || null;
    if (!entryTargetId) return includeSessionWide;
    return entryTargetId === targetId;
  });
}

function escapeCredentialsCell(value) {
  return String(value || '').replace(/\|/g, '\\|').trim();
}

function lootEntryShouldSyncToCredentials(entry) {
  return !!entry
    && ['cleartext', 'hash'].includes(String(entry.type || '').trim())
    && entry.sync_credentials !== false;
}

function parseLootForCredentialsRow(entry) {
  if (!lootEntryShouldSyncToCredentials(entry)) return null;
  const credential = String(entry.credential || '').trim();
  const host = String(entry.host || '').trim();
  const note = String(entry.note || '').trim();
  let username = '';
  let password = '';
  let hash = '';

  if (entry.type === 'cleartext') {
    const idx = credential.indexOf(':');
    if (idx > 0) {
      username = credential.slice(0, idx).trim();
      password = credential.slice(idx + 1).trim();
    } else {
      password = credential;
    }
  } else if (entry.type === 'hash') {
    const idx = credential.indexOf(':');
    if (idx > 0) {
      username = credential.slice(0, idx).trim();
      hash = credential.slice(idx + 1).trim();
    } else {
      hash = credential;
    }
  }

  return {
    username: escapeCredentialsCell(username),
    password: escapeCredentialsCell(password),
    hash: escapeCredentialsCell(hash),
    service: escapeCredentialsCell(host),
    notes: escapeCredentialsCell(note),
  };
}

function parseLootImport(text) {
  return String(text || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !line.startsWith('#'))
    .map(line => ({
      credential: line,
      hasSecret: line.includes(':') && line.indexOf(':') > 0 && line.slice(line.indexOf(':') + 1).trim().length > 0,
    }));
}

function parseAndPreviewLoot() {
  const raw = document.getElementById('lootPasteInput')?.value || '';
  const preview = document.getElementById('lootParsePreview');
  const commitBtn = document.getElementById('lootCommitBtn');
  if (!preview || !commitBtn) return;

  _lootParsed = parseLootImport(raw);
  preview.style.display = 'block';
  if (!_lootParsed.length) {
    preview.innerHTML = '<div class="nmap-preview-none">No usernames or credentials found.</div>';
    commitBtn.style.display = 'none';
    return;
  }

  const host = (document.getElementById('lootHostInput')?.value || '').trim() || (getIP() !== '<IP>' ? getIP() : '');
  const type = _activeLootType;
  const targetId = resolveQuickLogTargetId();
  const existing = new Set(getSessionLoot().map(l => buildScopedLootKey(l.type, l.credential, l.host || '', l.target_id || targetId)));
  const fresh = _lootParsed.filter(entry => !existing.has(buildScopedLootKey(type, entry.credential, host, targetId)));
  const dupes = _lootParsed.length - fresh.length;

  let html = `<div class="nmap-preview-hdr"><span>${_lootParsed.length}</span> entr${_lootParsed.length === 1 ? 'y' : 'ies'} found`;
  if (dupes) html += ` &nbsp;·&nbsp; <span style="color:var(--muted)">${dupes} already logged</span>`;
  html += `</div><table class="svc-table" style="margin-bottom:4px"><thead><tr><th>Type</th><th>Credential</th><th>Detected</th></tr></thead><tbody>`;
  html += _lootParsed.map(entry => {
    const isDupe = existing.has(buildScopedLootKey(type, entry.credential, host, targetId));
    return `<tr style="${isDupe ? 'opacity:0.4' : ''}"><td>${esc(type)}</td><td>${esc(entry.credential)}</td><td style="color:var(--text2)">${entry.hasSecret ? 'username:secret' : 'username only'}</td></tr>`;
  }).join('');
  html += '</tbody></table>';
  preview.innerHTML = html;

  if (fresh.length > 0) {
    commitBtn.style.display = 'block';
    commitBtn.textContent = `＋ Add ${fresh.length} new`;
  } else {
    commitBtn.style.display = 'none';
    preview.innerHTML += '<div class="nmap-preview-none">All entries already logged.</div>';
  }
}

function commitLootParse() {
  if (!_lootParsed.length) return;
  if (!ensureActiveSession('add loot')) return;
  if (!sessions[activeSessionId].loot) sessions[activeSessionId].loot = [];

  const host = (document.getElementById('lootHostInput')?.value || '').trim() || (getIP() !== '<IP>' ? getIP() : '');
  const note = (document.getElementById('lootNoteInput')?.value || '').trim();
  const type = _activeLootType;
  const targetId = resolveQuickLogTargetId();
  const existing = new Set(getAllSessionLoot().map(l => buildScopedLootKey(l.type, l.credential, l.host || '', l.target_id)));
  let added = 0;

  _lootParsed.forEach((item, idx) => {
    const key = buildScopedLootKey(type, item.credential, host, targetId);
    if (existing.has(key)) return;
    existing.add(key);
    const entry = {
      id: `loot_${Date.now()}_${idx}`,
      target_id: targetId,
      type,
      credential: item.credential,
      host,
      note,
      added: Date.now(),
    };
    sessions[activeSessionId].loot.push(entry);
    added++;
  });

  const syncedCredentialsNote = syncSessionLootToCredentialsNote(added > 0);

  saveNotes();
  renderLootTable();
  updateSvcTabCounts();
  if (syncedCredentialsNote) {
    renderNotesList();
    renderSessionSidebar();
    if (activeNoteId === syncedCredentialsNote.id && typeof noteEditor !== 'undefined' && noteEditor) {
      cmSetValue(noteEditor, syncedCredentialsNote.body || '');
      const moEl = document.getElementById('noteModifiedAt');
      if (moEl) {
        moEl.textContent = new Date(syncedCredentialsNote.updated).toLocaleString('en-GB', {
          day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
        });
      }
      if (typeof updateNotePreview === 'function') updateNotePreview();
    }
  }
  toggleToolPaste('loot');
  showToast(added ? `✓ Added ${added} loot entr${added === 1 ? 'y' : 'ies'}` : 'No new loot entries');
}

function buildCredentialsTableRow(row, mode = 'default') {
  if (mode === 'web') {
    return `| ${row.username} | ${row.password} | ${row.service} |  | ${row.notes} |`;
  }
  return `| ${row.username} | ${row.password} | ${row.hash} | ${row.service} | ${row.notes} |`;
}

function ensureCredentialsSection(lines) {
  const insertBeforeIdx = lines.findIndex(line => /^##\s+Password\s+Spray/i.test(line.trim()) || /^##\s+Sessions/i.test(line.trim()) || /^##\s+Notes$/i.test(line.trim()));
  const section = [
    '## Credentials',
    '',
    '| Username | Password | Hash | Service | Notes |',
    '|----------|----------|------|---------|-------|',
    '|          |          |      |         |       |',
    '',
  ];
  const at = insertBeforeIdx === -1 ? lines.length : insertBeforeIdx;
  lines.splice(at, 0, ...section);
  return lines;
}

function replaceCredentialsTableInBody(body, rows) {
  let lines = String(body || '').split('\n');
  let headerIdx = lines.findIndex(line => /^\|\s*Username\s*\|\s*Password\s*\|\s*Hash\s*\|\s*Service\s*\|\s*Notes\s*\|$/i.test(line.trim()));
  let mode = 'default';
  if (headerIdx === -1) {
    headerIdx = lines.findIndex(line => /^\|\s*Username\s*\|\s*Password\s*\|\s*URL\s*\/\s*Path\s*\|\s*Role\s*\|\s*Notes\s*\|$/i.test(line.trim()));
    if (headerIdx !== -1) mode = 'web';
  }
  if (headerIdx === -1) {
    lines = ensureCredentialsSection(lines);
    headerIdx = lines.findIndex(line => /^\|\s*Username\s*\|\s*Password\s*\|\s*Hash\s*\|\s*Service\s*\|\s*Notes\s*\|$/i.test(line.trim()));
    mode = 'default';
  }
  if (headerIdx === -1) return null;
  const separatorIdx = headerIdx + 1;
  if (!lines[separatorIdx] || !/^\|\s*-+/.test(lines[separatorIdx].trim())) return null;

  let tableEnd = separatorIdx + 1;
  while (tableEnd < lines.length && /^\|/.test(lines[tableEnd].trim())) tableEnd++;

  const nextRows = rows.length
    ? rows.map(row => buildCredentialsTableRow(row, mode))
    : (mode === 'web' ? ['|          |          |            |      |       |'] : ['|          |          |      |         |       |']);

  lines.splice(separatorIdx + 1, tableEnd - (separatorIdx + 1), ...nextRows);
  return lines.join('\n');
}

function findSessionCredentialsNote() {
  if (!activeSessionId) return null;
  return Object.values(notes).find(note => note.session_id === activeSessionId && note.type === 'credentials') || null;
}

function sessionHasCredentialSyncLootEntries() {
  return getAllSessionLoot().some(lootEntryShouldSyncToCredentials);
}

function ensureSessionCredentialsNote() {
  if (!NOTE_TEMPLATES?.credentials || !activeSessionId) return null;
  let note = findSessionCredentialsNote();
  if (note) return note;

  const id = 'note_' + Date.now();
  const tmpl = typeof resolveTemplateForCreation === 'function'
    ? resolveTemplateForCreation('credentials')
    : NOTE_TEMPLATES.credentials;
  note = {
    id,
    session_id: activeSessionId,
    target_id: activeTargetId || null,
    type: 'credentials',
    title: tmpl.title || '',
    body: typeof buildNoteBodyFromTemplate === 'function' ? buildNoteBodyFromTemplate(tmpl) : (tmpl.body || ''),
    tags: tmpl.default_tags ? [...tmpl.default_tags] : [],
    target_ip: getIP() !== '<IP>' ? getIP() : null,
    target_domain: getDomain() !== '<DOMAIN>' ? getDomain() : null,
    created: Date.now(),
    updated: Date.now(),
  };
  notes[id] = note;
  return note;
}

function buildCredentialsBody() {
  const tmpl = typeof resolveTemplateForCreation === 'function'
    ? resolveTemplateForCreation('credentials')
    : NOTE_TEMPLATES.credentials;
  return typeof buildNoteBodyFromTemplate === 'function'
    ? buildNoteBodyFromTemplate(tmpl)
    : (tmpl?.body || '');
}

function syncSessionLootToCredentialsNote(createIfMissing = false) {
  if (!NOTE_TEMPLATES?.credentials) return false;

  const rows = getAllSessionLoot()
    .map(parseLootForCredentialsRow)
    .filter(Boolean);
  const shouldEnsureNote = !!createIfMissing || rows.length > 0 || sessionHasCredentialSyncLootEntries();

  let note = findSessionCredentialsNote();
  if (!note && shouldEnsureNote) note = ensureSessionCredentialsNote();
  if (!note) return false;

  let nextBody = replaceCredentialsTableInBody(note.body || '', rows);
  if (!nextBody) {
    const fallbackBody = buildCredentialsBody();
    nextBody = replaceCredentialsTableInBody(fallbackBody, rows);
  }
  if (!nextBody || nextBody === note.body) return false;

  note.body = nextBody;
  note.updated = Date.now();
  return note;
}

function addLootEntryFromData({ type = 'other', credential = '', host = '', note = '', syncToCredentials = false, targetId = resolveQuickLogTargetId() } = {}) {
  if (!ensureActiveSession('add loot')) return { entry: null, syncedCredentialsNote: false, duplicate: false };
  const cleanCredential = String(credential || '').trim();
  if (!cleanCredential) return { entry: null, syncedCredentialsNote: false, duplicate: false };
  if (!sessions[activeSessionId].loot) sessions[activeSessionId].loot = [];

  const cleanType = String(type || 'other').trim() || 'other';
  const cleanHost = String(host || '').trim() || (getIP() !== '<IP>' ? getIP() : '');
  const cleanNote = String(note || '').trim();
  const cleanTargetId = String(targetId || '').trim() || null;
  const dupeKey = buildScopedLootKey(cleanType, cleanCredential, cleanHost, cleanTargetId);
  const existing = new Set(getAllSessionLoot().map((l) => buildScopedLootKey(l.type, l.credential, l.host || '', l.target_id)));
  if (existing.has(dupeKey)) return { entry: null, syncedCredentialsNote: false, duplicate: true };

  const entry = {
    id: `loot_${Date.now()}`,
    target_id: cleanTargetId,
    type: cleanType,
    credential: cleanCredential,
    host: cleanHost,
    note: cleanNote,
    sync_credentials: !!syncToCredentials && ['cleartext', 'hash'].includes(cleanType),
    added: Date.now(),
  };
  sessions[activeSessionId].loot.push(entry);
  const syncedCredentialsNote = syncSessionLootToCredentialsNote(!!syncToCredentials && ['cleartext', 'hash'].includes(cleanType));
  return { entry, syncedCredentialsNote, duplicate: false };
}

function addLootEntry() {
  const credEl = document.getElementById('lootCredInput');
  const hostEl = document.getElementById('lootHostInput');
  const noteEl = document.getElementById('lootNoteInput');
  const cred = credEl?.value.trim();
  const host = hostEl?.value.trim();
  const note = noteEl?.value.trim();
  if (!cred) { credEl?.focus(); return; }
  if (!ensureActiveSession('add loot')) { credEl?.focus(); return; }
  const { entry, syncedCredentialsNote } = addLootEntryFromData({
    type: _activeLootType,
    credential: cred,
    host,
    note,
    syncToCredentials: true,
  });
  if (!entry) {
    credEl?.focus();
    return;
  }

  credEl.value = '';
  noteEl.value = '';
  credEl.focus();
  saveNotes();
  renderLootTable();
  updateSvcTabCounts();
  if (syncedCredentialsNote) {
    renderNotesList();
    renderSessionSidebar();
    if (activeNoteId === syncedCredentialsNote.id && typeof noteEditor !== 'undefined' && noteEditor) {
      cmSetValue(noteEditor, syncedCredentialsNote.body || '');
      const moEl = document.getElementById('noteModifiedAt');
      if (moEl) {
        moEl.textContent = new Date(syncedCredentialsNote.updated).toLocaleString('en-GB', {
          day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
        });
      }
      if (typeof updateNotePreview === 'function') updateNotePreview();
    }
  }
}

function deleteLootEntry(lootId) {
  if (!ensureActiveSession('remove loot')) return;
  if (isQuickLogEditing('loot', lootId)) clearQuickLogEditing();
  sessions[activeSessionId].loot = (sessions[activeSessionId].loot || []).filter(l => l.id !== lootId);
  const syncedCredentialsNote = syncSessionLootToCredentialsNote(false);
  saveNotes();
  renderLootTable();
  updateSvcTabCounts();
  if (syncedCredentialsNote) {
    renderNotesList();
    renderSessionSidebar();
    if (activeNoteId === syncedCredentialsNote.id && typeof noteEditor !== 'undefined' && noteEditor) {
      cmSetValue(noteEditor, syncedCredentialsNote.body || '');
      const moEl = document.getElementById('noteModifiedAt');
      if (moEl) {
        moEl.textContent = new Date(syncedCredentialsNote.updated).toLocaleString('en-GB', {
          day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
        });
      }
      if (typeof updateNotePreview === 'function') updateNotePreview();
    }
  }
}

function updateLootNote(lootId, val) {
  if (!ensureActiveSession('update loot')) return;
  const entry = (sessions[activeSessionId].loot || []).find(l => l.id === lootId);
  if (!entry) return;
  entry.note = val;
  const syncedCredentialsNote = syncSessionLootToCredentialsNote(false);
  saveNotes();
  if (syncedCredentialsNote) {
    renderNotesList();
    renderSessionSidebar();
    if (activeNoteId === syncedCredentialsNote.id && typeof noteEditor !== 'undefined' && noteEditor) {
      cmSetValue(noteEditor, syncedCredentialsNote.body || '');
      const moEl = document.getElementById('noteModifiedAt');
      if (moEl) {
        moEl.textContent = new Date(syncedCredentialsNote.updated).toLocaleString('en-GB', {
          day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
        });
      }
      if (typeof updateNotePreview === 'function') updateNotePreview();
    }
  }
}

function commitLootEdit(lootId) {
  if (!ensureActiveSession('edit loot')) return;
  const entry = (sessions[activeSessionId].loot || []).find(l => l.id === lootId);
  if (!entry) return;
  const type = (document.getElementById(`lootEditType_${lootId}`)?.value || '').trim();
  const credential = (document.getElementById(`lootEditCredential_${lootId}`)?.value || '').trim();
  const host = (document.getElementById(`lootEditHost_${lootId}`)?.value || '').trim();
  const note = (document.getElementById(`lootEditNote_${lootId}`)?.value || '').trim();
  if (!credential) {
    showToast('⚠ Credential cannot be empty', 'err');
    focusQuickLogEditInput(`lootEditCredential_${lootId}`);
    return;
  }
  entry.type = ['cleartext', 'hash', 'token', 'key', 'other'].includes(type) ? type : 'other';
  entry.credential = credential;
  entry.host = host;
  entry.note = note;
  clearQuickLogEditing();
  const syncedCredentialsNote = syncSessionLootToCredentialsNote(false);
  saveNotes();
  renderLootTable();
  updateSvcTabCounts();
  applySyncedNoteUpdate(syncedCredentialsNote);
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
        return isQuickLogEditing('loot', l.id) ? `<tr>
          <td>
            <select class="svc-notes-cell ql-row-input ql-row-select" id="lootEditType_${l.id}" onclick="event.stopPropagation()" onkeydown="handleQuickLogEditKeydown(event,'loot','${l.id}')">
              ${['cleartext', 'hash', 'token', 'key', 'other'].map(type => `<option value="${type}" ${l.type === type ? 'selected' : ''}>${type}</option>`).join('')}
            </select>
          </td>
          <td><input class="svc-notes-cell ql-row-input" id="lootEditCredential_${l.id}" type="text" value="${esc(l.credential || '')}" placeholder="credential"
            onclick="event.stopPropagation()" onkeydown="handleQuickLogEditKeydown(event,'loot','${l.id}')"></td>
          <td><input class="svc-notes-cell ql-row-input" id="lootEditHost_${l.id}" type="text" value="${esc(l.host || '')}" placeholder="host"
            onclick="event.stopPropagation()" onkeydown="handleQuickLogEditKeydown(event,'loot','${l.id}')"></td>
          <td><input class="svc-notes-cell ql-row-input" id="lootEditNote_${l.id}" type="text" value="${esc(l.note || '')}" placeholder="context…"
            onclick="event.stopPropagation()" onkeydown="handleQuickLogEditKeydown(event,'loot','${l.id}')"></td>
          <td>${renderQuickLogRowActions('loot', l.id, 'deleteLootEntry')}</td>
        </tr>` : `<tr>
          <td><span class="loot-type-badge ${typeCss}">${esc(l.type)}</span></td>
          <td class="loot-cred-cell" onclick="copyLootCred('${l.id}')" title="Click to copy">${esc(l.credential)}</td>
          <td style="color:var(--text2);white-space:nowrap">${esc(l.host || '—')}</td>
          <td style="min-width:160px;width:35%">${esc(l.note || '')}</td>
          <td>${renderQuickLogRowActions('loot', l.id, 'deleteLootEntry')}</td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>`;
  if (_editingQuickLog?.kind === 'loot') focusQuickLogEditInput(`lootEditCredential_${_editingQuickLog.id}`);
}

function copyLootCred(lootId) {
  const entry = (sessions[activeSessionId]?.loot || []).find(l => l.id === lootId);
  if (!entry) return;
  navigator.clipboard.writeText(entry.credential).then(() => {
    showToast(`✓ Copied: ${entry.credential.slice(0, 40)}${entry.credential.length > 40 ? '…' : ''}`);
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

function setActiveSvcTopbarButton(buttonId) {
  ['svcTopbarPortsBtn', 'svcTopbarPathsBtn', 'svcTopbarLootBtn'].forEach((id) => {
    document.getElementById(id)?.classList.toggle('open', id === buttonId);
  });
  _activeSvcTopbarButtonId = buttonId || 'svcTopbarPortsBtn';
}

function openSvcPopover(tab = 'ports', buttonId = 'svcTopbarPortsBtn') {
  _activeSvcTab = SVC_TAB_CONFIG[tab] ? tab : 'ports';
  setActiveSvcTopbarButton(buttonId);
  if (document.getElementById('svcPopover')?.classList.contains('open')) {
    updateUtilitySessionLabel('svcSessionLabel');
    switchSvcTab(_activeSvcTab);
    return;
  }
  openUtilityPopover({
    popoverId: 'svcPopover',
    buttonId,
    labelId: 'svcSessionLabel',
    closeOthers: [closeTodoPopover, closeFindingsPopover],
    outsideHandler: _svcOutsideClose,
    onOpen: () => {
      updateSvcPopoverLayout();
      renderSvcLogTable();
      renderPathTable();
      renderLootTable();
      updateSvcTabCounts();
      renderSvcClearAction();
      switchSvcTab(_activeSvcTab);
    },
  });
}

function toggleSvcPopover(tab = 'ports', buttonId = 'svcTopbarPortsBtn') {
  const popover = document.getElementById('svcPopover');
  const nextTab = SVC_TAB_CONFIG[tab] ? tab : 'ports';
  if (popover?.classList.contains('open')) {
    if (_activeSvcTab === nextTab && _activeSvcTopbarButtonId === buttonId) {
      closeSvcPopover();
      return;
    }
    openSvcPopover(nextTab, buttonId);
    return;
  }
  openSvcPopover(nextTab, buttonId);
}

function closeSvcPopover() {
  document.getElementById('svcPopover')?.classList.remove('open');
  ['svcTopbarPortsBtn', 'svcTopbarPathsBtn', 'svcTopbarLootBtn'].forEach((id) => {
    document.getElementById(id)?.classList.remove('open');
  });
  updateSvcPopoverLayout();
}

function _svcOutsideClose(e) {
  if (isEventInsideWrap(e, 'svcTopbarWrap')) {
    if (document.getElementById('svcPopover')?.classList.contains('open')) {
      reopenUtilityOutsideListener(_svcOutsideClose);
    }
  } else {
    closeSvcPopover();
  }
}

function toggleTodoPopover() {
  if (document.getElementById('todoPopover')?.classList.contains('open')) {
    closeTodoPopover();
    return;
  }
  openUtilityPopover({
    popoverId: 'todoPopover',
    buttonId: 'todoTopbarBtn',
    labelId: 'todoSessionLabel',
    closeOthers: [closeSvcPopover, closeFindingsPopover],
    outsideHandler: _todoOutsideClose,
    onOpen: () => {
      renderTodoList();
      setTimeout(() => document.getElementById('todoQuickInput')?.focus(), 40);
    },
  });
}

function closeTodoPopover() {
  closeUtilityPopover('todoPopover', 'todoTopbarBtn');
}

function _todoOutsideClose(e) {
  if (isEventInsideWrap(e, 'todoTopbarWrap')) {
    if (document.getElementById('todoPopover')?.classList.contains('open')) {
      reopenUtilityOutsideListener(_todoOutsideClose);
    }
  } else {
    closeTodoPopover();
  }
}

function toggleFindingsPopover() {
  if (document.getElementById('findingsPopover')?.classList.contains('open')) {
    closeFindingsPopover();
    return;
  }
  openUtilityPopover({
    popoverId: 'findingsPopover',
    buttonId: 'findingsTopbarBtn',
    labelId: 'findingsSessionLabel',
    closeOthers: [closeSvcPopover, closeTodoPopover],
    outsideHandler: _findingsOutsideClose,
    onOpen: () => {
      renderFindingsList();
    },
  });
}

function closeFindingsPopover() {
  closeUtilityPopover('findingsPopover', 'findingsTopbarBtn');
}

function _findingsOutsideClose(e) {
  if (isEventInsideWrap(e, 'findingsTopbarWrap')) {
    if (document.getElementById('findingsPopover')?.classList.contains('open')) {
      reopenUtilityOutsideListener(_findingsOutsideClose);
    }
  } else {
    closeFindingsPopover();
  }
}
