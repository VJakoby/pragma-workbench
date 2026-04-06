// ═══════════════════════════════════════════════
// KB EDITOR
// ═══════════════════════════════════════════════
let cpEditSaveTimer = null;
let cpEditSaving = false;
let kbPreviewOpen = localStorage.getItem('pragma-kb-preview-open') === '1';

async function updateKbPreview() {
  const pane = document.getElementById('kbPreviewPane');
  const el = document.getElementById('kbPreviewContent');
  if (!pane || !el || pane.style.display === 'none') return;
  const md = kbEditor ? cmGetValue(kbEditor) : (activeDoc?.raw || '');
  if (window.markdownPreview?.renderInto) {
    await window.markdownPreview.renderInto(el, md, { injectTargets: true });
    return;
  }
  const rendered = marked ? marked.parse(md) : md.replace(/\n/g, '<br>');
  const injected = typeof injectTargets === 'function' ? injectTargets(rendered) : rendered;
  el.innerHTML = injected;
  if (typeof wrapCodeBlocks === 'function') wrapCodeBlocks(el);
  if (typeof wrapInlineCodes === 'function') wrapInlineCodes(el);
  if (typeof makeCollapsible === 'function') makeCollapsible(el);
  el.querySelectorAll('.copy-btn').forEach(b => b.style.display = 'none');
}

function applyKbPreviewState() {
  const split = document.getElementById('kbEditorSplit');
  const handle = document.getElementById('kbPreviewHandle');
  const pane = document.getElementById('kbPreviewPane');
  const btn = document.getElementById('kbPreviewBtn');
  if (!split || !handle || !pane || !btn) return;
  split.classList.toggle('preview-open', kbPreviewOpen);
  handle.style.display = kbPreviewOpen ? '' : 'none';
  pane.style.display = kbPreviewOpen ? 'flex' : 'none';
  btn.classList.toggle('active', kbPreviewOpen);
  btn.title = kbPreviewOpen ? 'Hide preview' : 'Toggle markdown preview';
  if (kbPreviewOpen) {
    const saved = localStorage.getItem('pragma-kb-preview-split');
    if (saved) split.style.setProperty('--kb-editor-h', saved);
    updateKbPreview();
    initKbPreviewDragHandle();
  }
}

function toggleKbPreview() {
  kbPreviewOpen = !kbPreviewOpen;
  localStorage.setItem('pragma-kb-preview-open', kbPreviewOpen ? '1' : '0');
  applyKbPreviewState();
}

function initKbPreviewDragHandle() {
  const handle = document.getElementById('kbPreviewHandle');
  const split = document.getElementById('kbEditorSplit');
  if (!handle || !split || handle._dragInited) return;
  handle._dragInited = true;

  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    handle.classList.add('dragging');
    const startPos = e.clientY;
    const splitRect = split.getBoundingClientRect();
    const dim = splitRect.height;
    const startPct = parseFloat(getComputedStyle(split).getPropertyValue('--kb-editor-h')) || 52;

    const onMove = ev => {
      const delta = ev.clientY - startPos;
      const newPct = Math.min(78, Math.max(22, startPct + (delta / dim) * 100));
      split.style.setProperty('--kb-editor-h', newPct + '%');
      localStorage.setItem('pragma-kb-preview-split', newPct + '%');
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

function scheduleKbAutoSave() {
  clearTimeout(cpEditSaveTimer);
  cpEditSaveTimer = setTimeout(() => { saveEdit({ auto: true }); }, 700);
}

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
  applyKbPreviewState();
  setTimeout(() => kbEditor && kbEditor.focus(), 30);
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

async function saveEdit(opts = {}) {
  if (!activeDoc || !activeDoc.id || !activeDoc.view) return;
  if (cpEditSaving) return;
  const savedView = activeDoc.view;
  const savedId = activeDoc.id;
  const raw = cmGetValue(kbEditor);
  cpEditSaving = true;
  clearTimeout(cpEditSaveTimer);
  setCpEditStatus('', opts.auto ? '...saving' : '⏳ Saving…');
  try {
    const r = await fetch('/api/kb/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: activeDoc.id, view: activeDoc.view, content: raw }),
    });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || 'Save failed');

    activeDoc.raw = raw;
    cpEditDirty   = false;
    setCpEditStatus('saved', '✓ saved');

    if (typeof refreshKbView === 'function') {
      await refreshKbView(savedView);
    }

    try {
      const endpoint = savedView === 'services'
        ? `/api/service/${encodeURIComponent(savedId)}`
        : savedView === 'tactics'
          ? `/api/tactic/${encodeURIComponent(savedId)}`
          : savedView.startsWith('kb:')
            ? `/api/kb-section/${encodeURIComponent(savedView.slice(3))}/${encodeURIComponent(savedId)}`
            : '';
      if (!endpoint) throw new Error('Unknown KB view');
      const r2 = await fetch(endpoint);
      const d2 = await r2.json();
      activeDoc.html = d2.html;
      activeDoc.raw  = d2.raw;
      activeDoc.meta = savedView === 'services'
        ? `${d2.port} · ${d2.category}`
        : `${d2.category} · ${d2.wordCount} words`;
      activeDoc.title = d2.name || activeDoc.title;
      document.getElementById('cpContent').innerHTML = injectTargets(d2.html);
      wrapCodeBlocks(document.getElementById('cpContent'));
      wrapInlineCodes(document.getElementById('cpContent'));
      updateKbPreview();
    } catch (_) {}

    setTimeout(() => { if (!cpEditDirty) setCpEditStatus('', activeDoc.meta || ''); }, 2000);
  } catch (e) {
    setCpEditStatus('unsaved', '✗ ' + e.message);
  } finally {
    cpEditSaving = false;
  }
}

function cmInitKb(initialDoc) {
  const wrap = document.getElementById('cpEditWrap');
  if (!wrap || !CM) return;
  if (kbEditor) kbEditor.destroy();

  kbEditor = new CM.EditorView({
    doc: initialDoc ?? '',
    extensions: [
      CM.basicSetup,
      CM.markdown(),
      ...buildCmTheme(),
      CM.EditorView.updateListener.of(update => {
        if (update.docChanged) {
          if (!cpEditDirty) {
            cpEditDirty = true;
            setCpEditStatus('unsaved', '● unsaved');
          }
          scheduleKbAutoSave();
          updateKbPreview();
        }
      }),
      CM.EditorView.lineWrapping,
      CM.indentUnit.of('  '),
      CM.keymap.of([CM.indentWithTab])
    ],
    parent: wrap,
  });
}
