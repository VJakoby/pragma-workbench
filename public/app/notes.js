// ═══════════════════════════════════════════════
// NOTES
// ═══════════════════════════════════════════════
let activeNoteFilter = 'all';
let activeNoteScope  = 'session';
let activeTagFilter  = null;
let activeTargetFilter = null;
let activeNoteSearch = '';
let activeNewNoteType = null;
const CONFIG_TEMPLATES_PATH = '/api/config/templates';
const NOTE_SCOPE_COOKIE = 'pragma_note_scope';

function getCookieValue(name) {
  const prefix = `${name}=`;
  return document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length) || '';
}

function setCookieValue(name, value, days = 365) {
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`;
}

function restoreNoteScope() {
  const saved = decodeURIComponent(getCookieValue(NOTE_SCOPE_COOKIE) || '').trim();
  if (['session', 'unassigned', 'all'].includes(saved)) activeNoteScope = saved;
}

function syncNoteScopeButtons() {
  document.querySelectorAll('.note-scope-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.scope === activeNoteScope);
  });
}

restoreNoteScope();

function setNoteEditorMode(mode) {
  const isConfig = mode === 'config';
  const editor = document.getElementById('notesEditor');
  const badge = document.getElementById('noteTypeBadge');
  const title = document.getElementById('noteTitleInput');
  const pin = document.getElementById('notePinBtn');
  const reassign = document.getElementById('noteReassignWrap');
  const target = document.getElementById('noteTargetAssignWrap');
  const previewBtn = document.getElementById('notePreviewBtn');
  const hint = document.querySelector('.note-md-hint');
  const timestamps = document.getElementById('noteTimestamps');
  const createdWrap = document.getElementById('noteCreatedWrap');
  const modifiedWrap = document.getElementById('noteModifiedWrap');
  const tags = document.getElementById('noteTagsRow');
  const backlinks = document.getElementById('noteBacklinks');
  const exportBtn = document.getElementById('noteExportBtn');
  const duplicateBtn = document.getElementById('noteDuplicateBtn');
  const deleteBtn = document.getElementById('noteDeleteBtn');
  const previewPane = document.getElementById('notePreviewPane');
  const previewHandle = document.getElementById('notePreviewHandle');
  const layoutToggle = document.getElementById('previewLayoutToggle');
  const split = document.getElementById('noteEditorSplit');

  if (editor) editor.classList.toggle('config-mode', isConfig);
  if (badge) {
    if (isConfig) {
      badge.textContent = '⚙ Templates';
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
  if (hint) hint.style.display = isConfig ? 'none' : '';
  if (timestamps) timestamps.style.display = '';
  if (createdWrap) createdWrap.style.display = isConfig ? 'none' : '';
  if (modifiedWrap) modifiedWrap.style.display = isConfig ? 'none' : '';
  if (tags) tags.style.display = isConfig ? 'none' : '';
  if (backlinks) backlinks.style.display = isConfig ? 'none' : '';
  if (duplicateBtn) duplicateBtn.style.display = isConfig ? 'none' : '';
  if (deleteBtn) deleteBtn.style.display = isConfig ? 'none' : '';
  if (exportBtn) exportBtn.title = isConfig ? 'Download note-templates.json' : 'Export note as .md';
  if (split) {
    if (isConfig) {
      split.classList.remove('preview-open', 'split-side');
      split.style.removeProperty('--note-editor-w');
      split.style.removeProperty('--note-editor-h');
    } else {
      applyNotePreviewState();
    }
  }
  if (previewPane && isConfig) previewPane.style.display = 'none';
  if (previewHandle && isConfig) previewHandle.style.display = 'none';
  if (layoutToggle && isConfig) layoutToggle.classList.remove('visible');
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
  switchView('notes', navEl || document.getElementById('nav-config-templates'));
  renderNotesList();

  document.getElementById('notesEmpty').style.display = 'none';
  const area = document.getElementById('noteEditArea');
  area.style.display = 'flex';

  const badge = ensureNoteTypeBadge();
  badge.textContent = '⚙ Templates';
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
  activeConfigDoc = null;
  setNoteEditorMode('note');
  document.getElementById('notesEmpty').style.display = 'flex';
  document.getElementById('noteEditArea').style.display = 'none';
  document.getElementById('nav-config-templates')?.classList.remove('active');
  renderNotesList();
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

function setNoteScope(scope, btn) {
  activeNoteScope = scope;
  activeTargetFilter = null;
  setCookieValue(NOTE_SCOPE_COOKIE, scope);
  syncNoteScopeButtons();
  if (btn) btn.classList.add('active');
  updateNoteSearchPlaceholder();
  renderNotesList();
}

function updateNoteSearchPlaceholder() {
  const input = document.getElementById('noteSearchInput');
  if (!input) return;
  const placeholderByScope = {
    session: 'Search current session notes…',
    unassigned: 'Search unassigned notes…',
    all: 'Search all session notes…',
  };
  input.placeholder = placeholderByScope[activeNoteScope] || 'Search notes…';
}

function renderNotesList() {
  syncNoteScopeButtons();
  updateNoteSearchPlaceholder();
  if (typeof notesListViewMode !== 'undefined' && notesListViewMode === 'timeline') {
    renderTimeline();
    document.getElementById('notes-count').textContent = Object.keys(notes).length || '—';
    renderTargetFilterBar();
    return;
  }
  const list = document.getElementById('notesList');
  let items = Object.values(notes).sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (b.updated || 0) - (a.updated || 0);
  });

  if (activeNoteScope === 'session') {
    items = activeSessionId ? items.filter(n => n.session_id === activeSessionId) : items.filter(n => !n.session_id);
  } else if (activeNoteScope === 'unassigned') {
    items = items.filter(n => !n.session_id || !sessions[n.session_id]);
  }

  if (activeNoteFilter !== 'all') items = items.filter(n => n.type === activeNoteFilter);
  if (activeTagFilter) items = items.filter(n => (n.tags || []).includes(activeTagFilter));
  if (activeTargetFilter) items = items.filter(n => n.target_id === activeTargetFilter);
  if (activeNoteSearch) {
    const q = activeNoteSearch.toLowerCase();
    items = items.filter(n =>
      (n.title || '').toLowerCase().includes(q) ||
      (n.body || '').toLowerCase().includes(q)
    );
  }

  if (!items.length) {
    list.innerHTML = `<div style="padding:20px 12px;font-size:11px;color:var(--muted);font-family:'Inter',sans-serif;text-align:center">
      ${activeNoteSearch ? 'No matching notes' : activeNoteFilter === 'all' ? 'No notes yet' : 'No ' + activeNoteFilter + ' notes'}
    </div>`;
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
      <div class="note-item-title">${esc(n.title||'Untitled')}${n.pinned ? '<span class="note-item-pin">' + ICONS.pin + '</span>' : ''}</div>
      <div class="note-item-content">
        <div class="note-item-preview">${esc((n.body||'').slice(0,50).replace(/\n/g,' '))}</div>
      </div>
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
  if (activeConfigDoc === 'templates') {
    downloadText(cmGetValue(noteEditor), 'note-templates.json');
    showToast('✓ Exported note-templates.json');
    return;
  }
  if (!activeNoteId || !notes[activeNoteId]) return;
  const n = notes[activeNoteId];
  const lines = ['---', `title: ${n.title || 'Untitled'}`, `type: ${n.type || 'scratch'}`];
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
  if (typeof window.exitObserverModeForAction === 'function') window.exitObserverModeForAction();
  document.getElementById('newNoteOverlay').classList.add('open');
  resetNewNoteModalState();
}

function closeNewNoteModal() {
  document.getElementById('newNoteOverlay').classList.remove('open');
  resetNewNoteModalState();
}

function closeNewNoteModalIfOutside(e) { if (e.target === document.getElementById('newNoteOverlay')) closeNewNoteModal(); }

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
    createBtn.style.display = 'none';
    createHint.style.display = '';
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
    newNote(type);
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

function resolveNoteLink(rawTitle) {
  const q = rawTitle.trim().toLowerCase();
  let hit = Object.values(notes).find(n => (n.title || '').toLowerCase() === q);
  if (!hit) hit = Object.values(notes).find(n => (n.title || '').toLowerCase().includes(q));
  return hit ? hit.id : null;
}

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
  if (!noteId || !notes[noteId]) return false;
  notes[noteId].title = document.getElementById('noteTitleInput').value;
  notes[noteId].body = cmGetValue(noteEditor);
  notes[noteId].updated = Date.now();
  return true;
}

async function persistActiveNote(opts = {}) {
  const noteId = opts.noteId || activeNoteId;
  if (!syncActiveNoteDraft(noteId)) return false;
  const note = notes[noteId];
  const ok = await saveNotes({
    reason: opts.reason || 'note-edit',
    immediate: !!opts.immediate,
    delay: opts.delay,
  });
  renderNotesList();
  renderSessionSidebar();
  if (!note || notes[noteId] !== note) return ok;
  if (activeNoteId === noteId) renderBacklinks(noteId);
  const moEl = document.getElementById('noteModifiedAt');
  if (moEl && activeNoteId === noteId) moEl.textContent = new Date(note.updated).toLocaleString('en-GB', {
    day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
  if (activeNoteId === noteId) updateNotePreview();
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
  saveNotes();
  renderNotesList();
  renderSessionSidebar();
  const total = Object.keys(notes).length;
  document.getElementById('notes-count').textContent = total || '—';
  document.getElementById('notesEmpty').style.display = 'flex';
  document.getElementById('noteEditArea').style.display = 'none';
}

async function closeCurrentNote() {
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
    const r = await fetch('/api/notes/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, sessions, notes }),
    });
    const d = await r.json();
    if (d.ok) {
      if (d.download?.filename && typeof d.download.content === 'string') {
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
      const count = d.files?.length || 0;
      showToast(`✓ Markdown export complete: ${count} files → sessions/${slugify(sess.codename)}/`);
    } else {
      showToast('Markdown export failed: ' + (d.error || 'unknown error'), 'err');
    }
  } catch (e) {
    showToast('Markdown export failed: ' + e.message, 'err');
  }
}
