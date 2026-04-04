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

  const btn = document.getElementById('svcTopbarCount');
  if (btn) {
    const total = ports + paths + loot;
    btn.textContent = total || '';
    btn.classList.toggle('has-entries', total > 0);
  }
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

function getSessionEvidence() {
  if (!activeSessionId || !sessions[activeSessionId]) return [];
  return sessions[activeSessionId].evidence || [];
}

function ensureSessionEvidence() {
  if (!activeSessionId || !sessions[activeSessionId]) return null;
  if (!Array.isArray(sessions[activeSessionId].evidence)) sessions[activeSessionId].evidence = [];
  return sessions[activeSessionId].evidence;
}

function updateEvidenceCount() {
  const entries = getSessionEvidence();
  const btn = document.getElementById('evidenceTopbarCount');
  if (!btn) return;
  btn.textContent = entries.length || '';
  btn.classList.toggle('has-entries', entries.length > 0);
}

function renderEvidenceClearAction() {
  const btn = document.getElementById('evidenceClearBtn');
  if (!btn) return;
  const count = getSessionEvidence().length;
  btn.textContent = count ? `Clear All (${count})` : 'Clear All';
  btn.disabled = !activeSessionId || count === 0;
}

function renderEvidenceTargetOptions(selectedValue = '') {
  const select = document.getElementById('evidenceTargetInput');
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

function getSessionNotesForEvidence() {
  if (!activeSessionId) return [];
  return Object.values(notes)
    .filter((note) => note.session_id === activeSessionId)
    .sort((a, b) => (b.updated || 0) - (a.updated || 0));
}

function renderEvidenceNoteOptions(selectedValue = '') {
  const select = document.getElementById('evidenceNoteInput');
  if (!select) return;
  const noteItems = getSessionNotesForEvidence();
  const options = ['<option value="">Select session note…</option>'];
  noteItems.forEach((note) => {
    options.push(`<option value="${esc(note.id)}"${note.id === selectedValue ? ' selected' : ''}>${esc(note.title || 'Untitled')}</option>`);
  });
  select.innerHTML = options.join('');
}

function evidenceTypeLabel(type) {
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
  return labels[type] || (type ? String(type) : 'Evidence');
}

function buildEvidenceTypeOptionsHtml(selectedType = '') {
  const configured = Array.isArray(window.EVIDENCE_TYPE_OPTIONS) ? window.EVIDENCE_TYPE_OPTIONS : [];
  const options = configured.map(({ value, label }) =>
    `<option value="${esc(value)}"${value === selectedType ? ' selected' : ''}>${esc(label)}</option>`
  );
  if (selectedType && !configured.find((item) => item.value === selectedType)) {
    options.push(`<option value="${esc(selectedType)}" selected>${esc(evidenceTypeLabel(selectedType))}</option>`);
  }
  return options.join('');
}

function evidenceSyncLabel(mode) {
  if (mode === 'none') return 'No sync';
  if (mode === 'note') return 'Note';
  if (mode === 'both') return 'Both';
  return 'Summary';
}

function evidenceUsesNoteSync(mode) {
  return mode === 'note' || mode === 'both';
}

function evidenceTargetDisplay(entry) {
  const target = entry?.target_id ? getSessionTargets().find((item) => item.id === entry.target_id) : null;
  return target ? (target.ip || target.domain || target.label || 'Unnamed') : 'Session-wide';
}

function renderEvidenceProofCell(entry) {
  const lines = [];
  if (entry.impact) lines.push(`<span class="evidence-proof-line"><span class="evidence-proof-key">Impact</span>${esc(entry.impact)}</span>`);
  if (entry.source_command) lines.push(`<span class="evidence-proof-line"><span class="evidence-proof-key">Command</span><code>${esc(entry.source_command)}</code></span>`);
  if (entry.details) lines.push(`<span class="evidence-proof-line"><span class="evidence-proof-key">Details</span>${esc(entry.details)}</span>`);
  return lines.length ? `<div class="evidence-proof-cell">${lines.join('')}</div>` : '<span class="muted">—</span>';
}

function updateEvidenceSyncUi(selectedNoteId = '') {
  const syncEl = document.getElementById('evidenceSyncInput');
  const row = document.getElementById('evidenceNoteRow');
  if (!syncEl || !row) return;
  const syncMode = (syncEl.value || 'export_only').trim();
  const showNote = evidenceUsesNoteSync(syncMode);
  row.style.display = showNote ? 'flex' : 'none';
  renderEvidenceNoteOptions(selectedNoteId);
}

function buildEvidenceMarkerId(entryId) {
  return `pragma:evidence:${entryId}`;
}

function findEvidenceMarkerRange(body, entryId) {
  const text = String(body || '');
  const marker = buildEvidenceMarkerId(entryId);
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

async function jumpToEvidenceSource(entryId) {
  if (!activeSessionId || !sessions[activeSessionId]) return;
  const entry = getSessionEvidence().find((item) => item.id === entryId);
  if (!entry?.note_id || !notes[entry.note_id]) {
    showToast?.('⚠ No source note linked', 'err');
    return;
  }

  const noteId = entry.note_id;
  closeEvidencePopover?.();
  if (typeof switchView === 'function') {
    switchView('notes', document.getElementById('nav-notes'));
  }
  if (typeof openNote === 'function') {
    await openNote(noteId);
  }

  if (typeof noteEditor === 'undefined' || !noteEditor) return;
  const docText = noteEditor.state.doc.toString();
  const range = findEvidenceMarkerRange(docText, entryId);
  if (!range) {
    noteEditor.focus();
    showToast?.('⚠ Evidence marker not found in note', 'err');
    return;
  }

  noteEditor.dispatch({
    selection: { anchor: range.from, head: range.to },
    scrollIntoView: true
  });
  noteEditor.focus();
}

function removeEvidenceBlockFromBody(body, entryId) {
  const marker = buildEvidenceMarkerId(entryId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\n*<!-- ${marker}:start -->[\\s\\S]*?<!-- ${marker}:end -->\\n*`, 'g');
  return String(body || '').replace(pattern, '\n\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

function buildEvidenceMarkdownBlock(entry) {
  const marker = buildEvidenceMarkerId(entry.id);
  const targetText = evidenceTargetDisplay(entry);
  const lines = [
    `<!-- ${marker}:start -->`,
    `### ${evidenceTypeLabel(entry.type)}: ${entry.title}`,
    '',
    `- Target: ${targetText}`,
  ];
  if (entry.impact) lines.push(`- Impact: ${entry.impact}`);
  if (entry.details) lines.push(`- Details: ${entry.details}`);
  if (entry.source_command) {
    lines.push('', '```text', entry.source_command, '```');
  }
  lines.push(`<!-- ${marker}:end -->`);
  return lines.join('\n');
}

function upsertEvidenceBlockInBody(body, entry) {
  const cleanBody = removeEvidenceBlockFromBody(body, entry.id);
  const block = buildEvidenceMarkdownBlock(entry);
  const sectionMatch = cleanBody.match(/^##\s+Evidence\s*$/im);
  if (!sectionMatch || sectionMatch.index == null) {
    const prefix = cleanBody.trimEnd();
    return `${prefix}${prefix ? '\n\n' : ''}## Evidence\n\n${block}\n`;
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

function applyEvidenceNoteSyncChanges(prevEntry, nextEntry) {
  const syncedNotes = [];
  const prevNoteId = prevEntry?.note_id || null;
  const nextNoteId = nextEntry?.note_id || null;

  if (prevEntry?.id && prevNoteId && notes[prevNoteId]) {
    const prevNote = notes[prevNoteId];
    const cleaned = removeEvidenceBlockFromBody(prevNote.body || '', prevEntry.id);
    if (cleaned !== (prevNote.body || '')) {
      prevNote.body = cleaned;
      prevNote.updated = Date.now();
      syncedNotes.push(prevNote);
    }
  }

  if (nextEntry?.id && nextNoteId && notes[nextNoteId] && evidenceUsesNoteSync(nextEntry.sync_mode || 'export_only')) {
    const nextNote = notes[nextNoteId];
    const nextBody = upsertEvidenceBlockInBody(nextNote.body || '', nextEntry);
    if (nextBody !== (nextNote.body || '')) {
      nextNote.body = nextBody;
      nextNote.updated = Date.now();
      if (!syncedNotes.includes(nextNote)) syncedNotes.push(nextNote);
    }
  }

  return syncedNotes;
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

function renderEvidenceList() {
  const listEl = document.getElementById('evidenceList');
  if (!listEl) return;
  renderEvidenceTargetOptions();
  renderEvidenceNoteOptions();
  renderEvidenceClearAction();
  updateEvidenceCount();
  updateEvidenceSyncUi(document.getElementById('evidenceNoteInput')?.value || '');

  if (!activeSessionId || !sessions[activeSessionId]) {
    listEl.innerHTML = `<div class="todo-empty">Open or create a session to keep structured evidence entries.</div>`;
    return;
  }

  const entries = [...getSessionEvidence()].sort((a, b) => (b.created || b.updated || 0) - (a.created || a.updated || 0));
  if (!entries.length) {
    listEl.innerHTML = `<div class="todo-empty">No evidence yet. Flag a command or proof block from a session note to add it here.</div>`;
    return;
  }

  const targets = getSessionTargets();
  const notes = getSessionNotesForEvidence();
  listEl.innerHTML = `
    <div class="evidence-items">${entries.map((entry) => {
      const target = entry.target_id ? targets.find((item) => item.id === entry.target_id) : null;
      const targetLabel = target ? (target.ip || target.domain || target.label || 'Unnamed') : 'Session-wide';
      const syncLabel = evidenceSyncLabel(entry.sync_mode || 'export_only');
      const note = entry.note_id ? notes.find((item) => item.id === entry.note_id) : null;
      const noteLabel = note?.title || (evidenceUsesNoteSync(entry.sync_mode || 'export_only') ? 'Select note' : '—');
      if (isQuickLogEditing('evidence', entry.id)) {
        return `
          <section class="evidence-item evidence-item-editing">
            <div class="evidence-item-head">
              <div class="evidence-item-title-group evidence-item-title-group-editing">
                <label class="evidence-edit-field evidence-edit-field-type">
                  <span class="evidence-edit-label">Type</span>
                  <select class="svc-notes-cell ql-row-input ql-row-select" id="evidenceEditType_${entry.id}" onclick="event.stopPropagation()" onkeydown="handleQuickLogEditKeydown(event,'evidence','${entry.id}')">
                    ${buildEvidenceTypeOptionsHtml(entry.type)}
                  </select>
                </label>
                <label class="evidence-edit-field evidence-edit-field-title">
                  <span class="evidence-edit-label">Title</span>
                  <input class="svc-notes-cell ql-row-input" id="evidenceEditTitle_${entry.id}" type="text" value="${esc(entry.title || '')}" placeholder="title" onclick="event.stopPropagation()" onkeydown="handleQuickLogEditKeydown(event,'evidence','${entry.id}')">
                </label>
              </div>
              <div class="evidence-item-actions">${renderEvidenceRowActions(entry.id)}</div>
            </div>
            <div class="evidence-edit-grid">
              <label class="evidence-edit-field">
                <span class="evidence-edit-label">Target</span>
                <select class="svc-notes-cell ql-row-input ql-row-select" id="evidenceEditTarget_${entry.id}" onclick="event.stopPropagation()" onkeydown="handleQuickLogEditKeydown(event,'evidence','${entry.id}')">
                  <option value="">Session-wide</option>
                  ${targets.map((targetItem) => {
                    const label = esc(targetItem.ip || targetItem.domain || targetItem.label || 'Unnamed');
                    return `<option value="${esc(targetItem.id)}"${targetItem.id === entry.target_id ? ' selected' : ''}>${label}</option>`;
                  }).join('')}
                </select>
              </label>
              <label class="evidence-edit-field">
                <span class="evidence-edit-label">Sync</span>
                <select class="svc-notes-cell ql-row-input ql-row-select" id="evidenceEditSync_${entry.id}" onclick="event.stopPropagation()" onkeydown="handleQuickLogEditKeydown(event,'evidence','${entry.id}')">
                  <option value="export_only"${(entry.sync_mode || 'export_only') === 'export_only' ? ' selected' : ''}>Summary</option>
                  <option value="both"${(entry.sync_mode || 'export_only') === 'both' ? ' selected' : ''}>Both</option>
                  <option value="note"${(entry.sync_mode || 'export_only') === 'note' ? ' selected' : ''}>Note</option>
                  <option value="none"${(entry.sync_mode || 'export_only') === 'none' ? ' selected' : ''}>No export</option>
                </select>
              </label>
              <label class="evidence-edit-field">
                <span class="evidence-edit-label">Note</span>
                <select class="svc-notes-cell ql-row-input ql-row-select" id="evidenceEditNote_${entry.id}" onclick="event.stopPropagation()" onkeydown="handleQuickLogEditKeydown(event,'evidence','${entry.id}')">
                  <option value="">Select note…</option>
                  ${notes.map((item) => `<option value="${esc(item.id)}"${item.id === entry.note_id ? ' selected' : ''}>${esc(item.title || 'Untitled')}</option>`).join('')}
                </select>
              </label>
            </div>
            <div class="evidence-item-body evidence-item-body-editing">
              <label class="evidence-edit-field">
                <span class="evidence-edit-label">Impact</span>
                <input class="svc-notes-cell ql-row-input" id="evidenceEditImpact_${entry.id}" type="text" value="${esc(entry.impact || '')}" placeholder="impact" onclick="event.stopPropagation()" onkeydown="handleQuickLogEditKeydown(event,'evidence','${entry.id}')">
              </label>
              <label class="evidence-edit-field">
                <span class="evidence-edit-label">Details</span>
                <input class="svc-notes-cell ql-row-input" id="evidenceEditDetails_${entry.id}" type="text" value="${esc(entry.details || '')}" placeholder="details" onclick="event.stopPropagation()" onkeydown="handleQuickLogEditKeydown(event,'evidence','${entry.id}')">
              </label>
              <label class="evidence-edit-field">
                <span class="evidence-edit-label">Command</span>
                <input class="svc-notes-cell ql-row-input" id="evidenceEditCommand_${entry.id}" type="text" value="${esc(entry.source_command || '')}" placeholder="source command" onclick="event.stopPropagation()" onkeydown="handleQuickLogEditKeydown(event,'evidence','${entry.id}')">
              </label>
            </div>
          </section>
        `;
      }
      return `
        <section class="evidence-item">
          <div class="evidence-item-head">
            <div class="evidence-item-title-group">
              <span class="loot-type-badge loot-type-other">${esc(evidenceTypeLabel(entry.type))}</span>
              <div class="evidence-item-title-wrap">
                <div class="evidence-item-title">${esc(entry.title || 'Untitled')}</div>
              </div>
            </div>
            <div class="evidence-item-actions">${renderEvidenceRowActions(entry.id)}</div>
          </div>
          <div class="evidence-item-meta">
            <span class="evidence-meta-pill" title="${esc(targetLabel)}">
              <span class="evidence-meta-key">Target</span>
              <span class="evidence-meta-value evidence-target-cell">${esc(targetLabel)}</span>
            </span>
            <span class="evidence-meta-pill">
              <span class="evidence-meta-key">Sync</span>
              <span class="evidence-meta-value">${esc(syncLabel)}</span>
            </span>
            <span class="evidence-meta-pill" title="${esc(noteLabel)}">
              <span class="evidence-meta-key">Note</span>
              <span class="evidence-meta-value">${esc(noteLabel)}</span>
            </span>
          </div>
          <div class="evidence-item-body">
            ${renderEvidenceProofCell(entry)}
          </div>
        </section>
      `;
    }).join('')}</div>
  `;

  if (_editingQuickLog?.kind === 'evidence') focusQuickLogEditInput(`evidenceEditTitle_${_editingQuickLog.id}`);
}

function addEvidenceEntry() {
  if (!activeSessionId) return;
  const entries = ensureSessionEvidence();
  if (!entries) return;
  const type = (document.getElementById('evidenceTypeInput')?.value || 'discovery').trim();
  const titleEl = document.getElementById('evidenceTitleInput');
  const detailsEl = document.getElementById('evidenceDetailsInput');
  const commandEl = document.getElementById('evidenceCommandInput');
  const targetEl = document.getElementById('evidenceTargetInput');
  const syncEl = document.getElementById('evidenceSyncInput');
  const noteEl = document.getElementById('evidenceNoteInput');
  const title = (titleEl?.value || '').trim();
  const details = (detailsEl?.value || '').trim();
  const sourceCommand = (commandEl?.value || '').trim();
  const targetId = (targetEl?.value || '').trim() || null;
  const syncMode = (syncEl?.value || 'export_only').trim();
  const noteId = evidenceUsesNoteSync(syncMode) ? ((noteEl?.value || '').trim() || null) : null;
  if (!title) {
    titleEl?.focus();
    return;
  }
  if (evidenceUsesNoteSync(syncMode) && !noteId) {
    noteEl?.focus();
    return;
  }
  const entry = {
    id: `evidence_${Date.now()}`,
    type,
    title,
    details,
    source_command: sourceCommand,
    target_id: targetId,
    note_id: noteId,
    sync_mode: syncMode,
    created: Date.now(),
    updated: Date.now(),
  };
  entries.push(entry);
  const syncedNotes = applyEvidenceNoteSyncChanges(null, entry);
  if (titleEl) titleEl.value = '';
  if (detailsEl) detailsEl.value = '';
  if (commandEl) commandEl.value = '';
  if (targetEl) targetEl.value = activeTargetId || '';
  if (syncEl) syncEl.value = 'export_only';
  if (noteEl) noteEl.value = '';
  saveNotes();
  syncedNotes.forEach(applySyncedNoteUpdate);
  renderEvidenceList();
  updateEvidenceSyncUi();
  titleEl?.focus();
}

function deleteEvidenceEntry(entryId) {
  if (!activeSessionId) return;
  const entries = ensureSessionEvidence();
  if (!entries) return;
  const entry = entries.find((item) => item.id === entryId);
  if (isQuickLogEditing('evidence', entryId)) clearQuickLogEditing();
  sessions[activeSessionId].evidence = entries.filter((entry) => entry.id !== entryId);
  const syncedNotes = entry ? applyEvidenceNoteSyncChanges(entry, null) : [];
  saveNotes();
  syncedNotes.forEach(applySyncedNoteUpdate);
  renderEvidenceList();
}

function clearEvidenceEntries() {
  if (!activeSessionId) return;
  const entries = ensureSessionEvidence();
  if (!entries?.length) return;
  const syncedNotes = [];
  entries.forEach((entry) => {
    applyEvidenceNoteSyncChanges(entry, null).forEach((note) => {
      if (!syncedNotes.includes(note)) syncedNotes.push(note);
    });
  });
  if (_editingQuickLog?.kind === 'evidence') clearQuickLogEditing();
  sessions[activeSessionId].evidence = [];
  saveNotes();
  syncedNotes.forEach(applySyncedNoteUpdate);
  renderEvidenceList();
}

function commitEvidenceEdit(entryId) {
  if (!activeSessionId) return;
  const entry = (sessions[activeSessionId].evidence || []).find((item) => item.id === entryId);
  if (!entry) return;
  const prevEntry = { ...entry };
  const title = (document.getElementById(`evidenceEditTitle_${entryId}`)?.value || '').trim();
  if (!title) {
    focusQuickLogEditInput(`evidenceEditTitle_${entryId}`);
    return;
  }
  entry.type = (document.getElementById(`evidenceEditType_${entryId}`)?.value || entry.type || 'discovery').trim();
  entry.title = title;
  entry.details = (document.getElementById(`evidenceEditDetails_${entryId}`)?.value || '').trim();
  entry.impact = (document.getElementById(`evidenceEditImpact_${entryId}`)?.value || '').trim();
  entry.source_command = (document.getElementById(`evidenceEditCommand_${entryId}`)?.value || '').trim();
  entry.target_id = (document.getElementById(`evidenceEditTarget_${entryId}`)?.value || '').trim() || null;
  entry.sync_mode = (document.getElementById(`evidenceEditSync_${entryId}`)?.value || 'export_only').trim();
  entry.note_id = evidenceUsesNoteSync(entry.sync_mode) ? ((document.getElementById(`evidenceEditNote_${entryId}`)?.value || '').trim() || null) : null;
  if (evidenceUsesNoteSync(entry.sync_mode) && !entry.note_id) {
    focusQuickLogEditInput(`evidenceEditTitle_${entryId}`);
    return;
  }
  entry.updated = Date.now();
  const syncedNotes = applyEvidenceNoteSyncChanges(prevEntry, entry);
  clearQuickLogEditing();
  saveNotes();
  syncedNotes.forEach(applySyncedNoteUpdate);
  renderEvidenceList();
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
  const entries = Array.isArray(sess[config.key]) ? sess[config.key] : [];
  if (!entries.length) return;

  try {
    await showConfirmDialog({
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
      title: config.title,
      bigIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
      description: `Remove all ${entries.length} ${config.noun} from this session?`,
      confirmLabel: 'Clear All',
      danger: true,
    });
  } catch {
    return;
  }

  sess[config.key] = [];
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
  const existing = new Set(getSessionServices().map(s => `${s.port}/${s.proto}`));
  const fresh = _portParsed.filter(r => !existing.has(`${r.port}/${r.proto}`));
  const dupes = _portParsed.length - fresh.length;
  let html = `<div class="nmap-preview-hdr"><span>${_portParsed.length}</span> port${_portParsed.length !== 1 ? 's' : ''} found`;
  if (dupes) html += ` &nbsp;·&nbsp; <span style="color:var(--muted)">${dupes} already logged</span>`;
  html += '</div><table class="svc-table svc-table-ports" style="margin-bottom:4px"><thead><tr><th>Port</th><th>Service</th><th>Version</th></tr></thead><tbody>';
  html += _portParsed.map(r => {
    const isDupe = existing.has(`${r.port}/${r.proto}`);
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
  if (!activeSessionId || !_portParsed.length) return;
  if (!sessions[activeSessionId].services) sessions[activeSessionId].services = [];
  const existing = new Set(sessions[activeSessionId].services.map(s => `${s.port}/${s.proto}`));
  let added = 0;
  for (const r of _portParsed) {
    if (existing.has(`${r.port}/${r.proto}`)) continue;
    const entry = { id: `svc_${Date.now()}_${added}`, target_id: activeTargetId || null, port: r.port, proto: r.proto, service: r.service, version: r.version, notes: '', added: Date.now() };
    sessions[activeSessionId].services.push(entry);
    added++;
  }
  const syncedNetworkNote = activeTargetId ? syncSessionServicesToNetworkEnumerationNote(activeTargetId, added > 0) : false;
  saveNotes();
  renderSvcLogTable();
  updateSvcTabCounts();
  applySyncedNoteUpdate(syncedNetworkNote);
  showToast(`✓ Added ${added} port${added !== 1 ? 's' : ''}`);
  toggleToolPaste('ports');
}

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
  const existing = new Set(getSessionPaths().map(p => p.path));
  const fresh = _pathParsed.filter(r => !existing.has(r.path));
  const dupes = _pathParsed.length - fresh.length;
  let html = `<div class="nmap-preview-hdr"><span>${_pathParsed.length}</span> path${_pathParsed.length !== 1 ? 's' : ''} found`;
  if (dupes) html += ` &nbsp;·&nbsp; <span style="color:var(--muted)">${dupes} already logged</span>`;
  html += '</div><table class="path-table" style="margin-bottom:4px"><thead><tr><th>Status</th><th>Path</th><th>Size</th></tr></thead><tbody>';
  html += _pathParsed.map(r => {
    const isDupe = existing.has(r.path);
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
  if (!activeSessionId || !_pathParsed.length) return;
  if (!sessions[activeSessionId].paths) sessions[activeSessionId].paths = [];
  const existing = new Set(sessions[activeSessionId].paths.map(p => p.path));
  let added = 0;
  for (const r of _pathParsed) {
    if (existing.has(r.path)) continue;
    sessions[activeSessionId].paths.push({ id: `path_${Date.now()}_${added}`, target_id: activeTargetId || null, path: r.path, status: r.status, size: r.size, notes: r.notes, added: Date.now() });
    added++;
  }
  const syncedNetworkNote = activeTargetId ? syncSessionPathsToNetworkEnumerationNote(activeTargetId, added > 0) : false;
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
  if (!raw || !activeSessionId) { if (input) input.focus(); return; }
  let status = '';
  let path = '';
  let notes = '';
  const m = raw.match(/^(\d{3})\s+(\S+)(?:\s+(.+))?$/);
  if (m) { status = m[1]; path = m[2]; notes = m[3] || ''; }
  else { path = raw.split(/\s+/)[0]; notes = raw.slice(path.length).trim(); }
  if (!path.startsWith('/') && !path.includes('.')) { input.focus(); return; }
  if (!sessions[activeSessionId].paths) sessions[activeSessionId].paths = [];
  const entry = { id: `path_${Date.now()}`, target_id: activeTargetId || null, path, status, size: '', notes, added: Date.now() };
  sessions[activeSessionId].paths.push(entry);
  const syncedNetworkNote = syncSessionPathsToNetworkEnumerationNote(entry.target_id, true);
  input.value = '';
  input.focus();
  saveNotes();
  renderPathTable();
  updateSvcTabCounts();
  applySyncedNoteUpdate(syncedNetworkNote);
}

function deletePathLog(pathId) {
  if (!activeSessionId) return;
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
  if (!activeSessionId) return;
  const p = (sessions[activeSessionId].paths || []).find(path => path.id === pathId);
  if (!p) return;
  p.notes = val;
  const syncedNetworkNote = p.target_id ? syncSessionPathsToNetworkEnumerationNote(p.target_id, false) : false;
  saveNotes();
  applySyncedNoteUpdate(syncedNetworkNote);
}

function commitPathEdit(pathId) {
  if (!activeSessionId) return;
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

function getSessionServices() {
  if (!activeSessionId || !sessions[activeSessionId]) return [];
  return sessions[activeSessionId].services || [];
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

function buildNetworkEnumerationTableRow(row) {
  return `| ${row.port} | ${row.proto} | ${row.service} | ${row.version} | ${row.notes} |`;
}

function replaceNetworkEnumerationTableInBody(body, rows) {
  const lines = String(body || '').split('\n');
  const headerIdx = lines.findIndex(line => /^\|\s*Port\s*\|\s*Proto\s*\|\s*Service\s*\|\s*Version\s*\|\s*Notes\s*\|$/i.test(line.trim()));
  if (headerIdx === -1) return null;
  const separatorIdx = headerIdx + 1;
  if (!lines[separatorIdx] || !/^\|\s*-+/.test(lines[separatorIdx].trim())) return null;

  let tableEnd = separatorIdx + 1;
  while (tableEnd < lines.length && /^\|/.test(lines[tableEnd].trim())) tableEnd++;

  const nextRows = rows.length
    ? rows.map(buildNetworkEnumerationTableRow)
    : ['|      |       |         |         |       |'];

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
  const tmpl = NOTE_TEMPLATES['network-enumeration'];
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

function syncServiceEntryToNetworkEnumerationNote(entry) {
  if (!NOTE_TEMPLATES?.['network-enumeration'] || !entry?.target_id) return false;

  return syncSessionServicesToNetworkEnumerationNote(entry.target_id, true);
}

function syncSessionServicesToNetworkEnumerationNote(targetId, createIfMissing = false) {
  if (!NOTE_TEMPLATES?.['network-enumeration'] || !targetId) return false;

  const rows = getSessionServices()
    .filter(entry => entry?.target_id === targetId)
    .map(parseServiceForNetworkRow)
    .filter(Boolean);

  let note = findTargetNetworkEnumerationNote(targetId);
  if (!note && createIfMissing && rows.length) note = ensureTargetNetworkEnumerationNote(targetId);
  if (!note) return false;

  const target = getSessionTargetById(targetId);
  const withOverview = populateNetworkEnumerationOverview(note.body || '', target);
  const nextBody = replaceNetworkEnumerationTableInBody(withOverview, rows);
  if (!nextBody || nextBody === note.body) return false;

  note.body = nextBody;
  note.updated = Date.now();
  return note;
}

function syncSessionPathsToNetworkEnumerationNote(targetId, createIfMissing = false) {
  if (!NOTE_TEMPLATES?.['network-enumeration'] || !targetId) return false;

  const rows = getSessionPaths()
    .filter(entry => entry?.target_id === targetId)
    .map(parsePathForWebRow)
    .filter(Boolean);

  let note = findTargetNetworkEnumerationNote(targetId);
  if (!note && createIfMissing && rows.length) note = ensureTargetNetworkEnumerationNote(targetId);
  if (!note) return false;

  const target = getSessionTargetById(targetId);
  const withOverview = populateNetworkEnumerationOverview(note.body || '', target);
  const nextBody = replaceWebEndpointsTableInBody(withOverview, rows);
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
  else if (kind === 'evidence') renderEvidenceList();
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
    else if (kind === 'evidence') commitEvidenceEdit(id);
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
          : `commitEvidenceEdit('${id}')`;
    return `
      <div class="ql-row-actions">
        <button class="svc-quick-add-btn ql-row-save-btn" onclick="event.stopPropagation(); ${saveCall}" title="Save row" aria-label="Save row">Save</button>
        <button class="svc-del-btn ql-row-edit-btn" onclick="event.stopPropagation(); cancelQuickLogEdit('${kind}','${id}')" title="Cancel edit" aria-label="Cancel edit">Cancel</button>
        <button class="svc-del-btn" onclick="event.stopPropagation(); ${deleteCall}" title="Remove">✕</button>
      </div>
    `;
  }
  return `
    <div class="ql-row-actions">
      <button class="svc-del-btn ql-row-edit-btn" onclick="event.stopPropagation(); startQuickLogEdit('${kind}','${id}')" title="Edit row" aria-label="Edit row">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>
      </button>
      <button class="svc-del-btn" onclick="event.stopPropagation(); ${deleteCall}" title="Remove">✕</button>
    </div>
  `;
}

function renderEvidenceRowActions(id) {
  if (isQuickLogEditing('evidence', id)) return renderQuickLogRowActions('evidence', id, 'deleteEvidenceEntry');
  return `
    <div class="ql-row-actions">
      <button class="svc-del-btn ql-row-edit-btn" onclick="event.stopPropagation(); jumpToEvidenceSource('${id}')" title="Jump to source" aria-label="Jump to source">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>
      </button>
      <button class="svc-del-btn ql-row-edit-btn" onclick="event.stopPropagation(); startQuickLogEdit('evidence','${id}')" title="Edit row" aria-label="Edit row">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>
      </button>
      <button class="svc-del-btn" onclick="event.stopPropagation(); deleteEvidenceEntry('${id}')" title="Remove">✕</button>
    </div>
  `;
}

function addServiceLog() {
  const input = document.getElementById('svcQuickInput');
  const raw = (input && input.value) ? input.value.trim() : '';
  if (!raw || !activeSessionId) { if (input) input.focus(); return; }
  const parsed = parseSvcInput(raw);
  if (!parsed) return;
  if (!sessions[activeSessionId].services) sessions[activeSessionId].services = [];
  const entry = {
    id: `svc_${Date.now()}`,
    target_id: activeTargetId || null,
    port: parsed.port,
    proto: parsed.proto,
    service: parsed.service,
    version: parsed.version,
    notes: parsed.notes,
    added: Date.now(),
  };
  sessions[activeSessionId].services.push(entry);
  const syncedNetworkNote = syncSessionServicesToNetworkEnumerationNote(entry.target_id, true);
  input.value = '';
  input.focus();
  saveNotes();
  renderSvcLogTable();
  updateSvcTabCounts();
  applySyncedNoteUpdate(syncedNetworkNote);
}

function deleteServiceLog(svcId) {
  if (!activeSessionId) return;
  const svc = (sessions[activeSessionId].services || []).find(s => s.id === svcId);
  if (isQuickLogEditing('service', svcId)) clearQuickLogEditing();
  sessions[activeSessionId].services = (sessions[activeSessionId].services || []).filter(s => s.id !== svcId);
  const syncedNetworkNote = svc?.target_id ? syncSessionServicesToNetworkEnumerationNote(svc.target_id, false) : false;
  saveNotes();
  renderSvcLogTable();
  applySyncedNoteUpdate(syncedNetworkNote);
}

function updateSvcNotes(svcId, val) {
  if (!activeSessionId) return;
  const svc = (sessions[activeSessionId].services || []).find(s => s.id === svcId);
  if (!svc) return;
  svc.notes = val;
  const syncedNetworkNote = svc.target_id ? syncSessionServicesToNetworkEnumerationNote(svc.target_id, false) : false;
  saveNotes();
  applySyncedNoteUpdate(syncedNetworkNote);
}

function commitServiceEdit(svcId) {
  if (!activeSessionId) return;
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
          <td>${esc(s.port)}${s.proto && s.proto !== 'tcp' ? `<span style="color:var(--muted);font-weight:400">/${esc(s.proto)}</span>` : ''}</td>
          <td>${esc(s.service || '—')}</td>
          <td style="color:var(--text2)">${esc(s.version || '')}</td>
          <td>${esc(s.notes || '')}</td>
          <td>${renderQuickLogRowActions('service', s.id, 'deleteServiceLog')}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  if (_editingQuickLog?.kind === 'service') focusQuickLogEditInput(`svcEditPort_${_editingQuickLog.id}`);
}

function setLootType(btn, type) {
  _activeLootType = type;
  document.querySelectorAll('.loot-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function getSessionLoot() {
  if (!activeSessionId || !sessions[activeSessionId]) return [];
  return sessions[activeSessionId].loot || [];
}

function escapeCredentialsCell(value) {
  return String(value || '').replace(/\|/g, '\\|').trim();
}

function parseLootForCredentialsRow(entry) {
  if (!entry || !['cleartext', 'hash'].includes(entry.type) || entry.sync_credentials === false) return null;
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
  const existing = new Set(getSessionLoot().map(l => `${l.type}::${l.credential}::${l.host || ''}`));
  const fresh = _lootParsed.filter(entry => !existing.has(`${type}::${entry.credential}::${host}`));
  const dupes = _lootParsed.length - fresh.length;

  let html = `<div class="nmap-preview-hdr"><span>${_lootParsed.length}</span> entr${_lootParsed.length === 1 ? 'y' : 'ies'} found`;
  if (dupes) html += ` &nbsp;·&nbsp; <span style="color:var(--muted)">${dupes} already logged</span>`;
  html += `</div><table class="svc-table" style="margin-bottom:4px"><thead><tr><th>Type</th><th>Credential</th><th>Detected</th></tr></thead><tbody>`;
  html += _lootParsed.map(entry => {
    const isDupe = existing.has(`${type}::${entry.credential}::${host}`);
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
  if (!activeSessionId || !_lootParsed.length) return;
  if (!sessions[activeSessionId].loot) sessions[activeSessionId].loot = [];

  const host = (document.getElementById('lootHostInput')?.value || '').trim() || (getIP() !== '<IP>' ? getIP() : '');
  const note = (document.getElementById('lootNoteInput')?.value || '').trim();
  const type = _activeLootType;
  const existing = new Set(sessions[activeSessionId].loot.map(l => `${l.type}::${l.credential}::${l.host || ''}`));
  let added = 0;

  _lootParsed.forEach((item, idx) => {
    const key = `${type}::${item.credential}::${host}`;
    if (existing.has(key)) return;
    existing.add(key);
    const entry = {
      id: `loot_${Date.now()}_${idx}`,
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

function buildCredentialsTableRow(row) {
  return `| ${row.username} | ${row.password} | ${row.hash} | ${row.service} | ${row.notes} |`;
}

function replaceCredentialsTableInBody(body, rows) {
  const lines = String(body || '').split('\n');
  const headerIdx = lines.findIndex(line => /^\|\s*Username\s*\|\s*Password\s*\|\s*Hash\s*\|\s*Service\s*\|\s*Notes\s*\|$/i.test(line.trim()));
  if (headerIdx === -1) return null;
  const separatorIdx = headerIdx + 1;
  if (!lines[separatorIdx] || !/^\|\s*-+/.test(lines[separatorIdx].trim())) return null;

  let tableEnd = separatorIdx + 1;
  while (tableEnd < lines.length && /^\|/.test(lines[tableEnd].trim())) tableEnd++;

  const nextRows = rows.length
    ? rows.map(buildCredentialsTableRow)
    : ['|          |          |      |         |       |'];

  lines.splice(separatorIdx + 1, tableEnd - (separatorIdx + 1), ...nextRows);
  return lines.join('\n');
}

function findSessionCredentialsNote() {
  if (!activeSessionId) return null;
  return Object.values(notes).find(note => note.session_id === activeSessionId && note.type === 'credentials') || null;
}

function ensureSessionCredentialsNote() {
  if (!NOTE_TEMPLATES?.credentials || !activeSessionId) return null;
  let note = findSessionCredentialsNote();
  if (note) return note;

  const id = 'note_' + Date.now();
  const tmpl = NOTE_TEMPLATES.credentials;
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

function syncSessionLootToCredentialsNote(createIfMissing = false) {
  if (!NOTE_TEMPLATES?.credentials) return false;

  const rows = getSessionLoot()
    .map(parseLootForCredentialsRow)
    .filter(Boolean);

  let note = findSessionCredentialsNote();
  if (!note && createIfMissing && rows.length) note = ensureSessionCredentialsNote();
  if (!note) return false;

  const nextBody = replaceCredentialsTableInBody(note.body || '', rows);
  if (!nextBody || nextBody === note.body) return false;

  note.body = nextBody;
  note.updated = Date.now();
  return note;
}

function addLootEntryFromData({ type = 'other', credential = '', host = '', note = '', syncToCredentials = false } = {}) {
  if (!activeSessionId) return { entry: null, syncedCredentialsNote: false, duplicate: false };
  const cleanCredential = String(credential || '').trim();
  if (!cleanCredential) return { entry: null, syncedCredentialsNote: false, duplicate: false };
  if (!sessions[activeSessionId].loot) sessions[activeSessionId].loot = [];

  const cleanType = String(type || 'other').trim() || 'other';
  const cleanHost = String(host || '').trim() || (getIP() !== '<IP>' ? getIP() : '');
  const cleanNote = String(note || '').trim();
  const dupeKey = `${cleanType}::${cleanCredential}::${cleanHost}`;
  const existing = new Set(sessions[activeSessionId].loot.map((l) => `${l.type}::${l.credential}::${l.host || ''}`));
  if (existing.has(dupeKey)) return { entry: null, syncedCredentialsNote: false, duplicate: true };

  const entry = {
    id: `loot_${Date.now()}`,
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
  if (!cred || !activeSessionId) { credEl?.focus(); return; }
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
  if (!activeSessionId) return;
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
  if (!activeSessionId) return;
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
  if (!activeSessionId) return;
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

function toggleSvcPopover() {
  if (document.getElementById('svcPopover')?.classList.contains('open')) {
    closeSvcPopover();
    return;
  }
  openUtilityPopover({
    popoverId: 'svcPopover',
    buttonId: 'svcTopbarBtn',
    labelId: 'svcSessionLabel',
    closeOthers: [closeTodoPopover, closeEvidencePopover],
    outsideHandler: _svcOutsideClose,
    onOpen: () => {
      updateSvcPopoverLayout();
      renderSvcLogTable();
      renderPathTable();
      renderLootTable();
      updateSvcTabCounts();
      renderSvcClearAction();
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
    },
  });
}

function closeSvcPopover() {
  closeUtilityPopover('svcPopover', 'svcTopbarBtn', updateSvcPopoverLayout);
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
    closeOthers: [closeSvcPopover, closeEvidencePopover],
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

function toggleEvidencePopover() {
  if (document.getElementById('evidencePopover')?.classList.contains('open')) {
    closeEvidencePopover();
    return;
  }
  openUtilityPopover({
    popoverId: 'evidencePopover',
    buttonId: 'evidenceTopbarBtn',
    labelId: 'evidenceSessionLabel',
    closeOthers: [closeSvcPopover, closeTodoPopover],
    outsideHandler: _evidenceOutsideClose,
    onOpen: () => {
      renderEvidenceList();
    },
  });
}

function closeEvidencePopover() {
  closeUtilityPopover('evidencePopover', 'evidenceTopbarBtn');
}

function _evidenceOutsideClose(e) {
  if (isEventInsideWrap(e, 'evidenceTopbarWrap')) {
    if (document.getElementById('evidencePopover')?.classList.contains('open')) {
      reopenUtilityOutsideListener(_evidenceOutsideClose);
    }
  } else {
    closeEvidencePopover();
  }
}
