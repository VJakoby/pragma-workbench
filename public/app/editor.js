// ═══════════════════════════════════════════════
// EDITOR STATE
// ═══════════════════════════════════════════════
let noteEditor = null;
let kbEditor   = null;
let cpEditDirty = false;

function cmGetValue(editor) {
  return editor ? editor.state.doc.toString() : '';
}

function cmSetValue(editor, value) {
  if (!editor) return;
  editor.dispatch({
    changes: { from: 0, to: editor.state.doc.length, insert: value || '' }
  });
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
  if (typeof wrapCodeBlocks === 'function') wrapCodeBlocks(el);
  if (typeof wrapInlineCodes === 'function') wrapInlineCodes(el);
  if (typeof makeCollapsible === 'function') makeCollapsible(el);
  el.querySelectorAll('.copy-btn').forEach(b => b.style.display = 'none');
}

function toggleNotePreview() {
  notePreviewOpen = !notePreviewOpen;
  localStorage.setItem('pragma-preview-open', notePreviewOpen ? '1' : '0');
  applyNotePreviewState();
}

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

  const handle = document.getElementById('notePreviewHandle');
  if (handle) {
    handle._dragInited = false;
    initPreviewDragHandle();
  }
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

  const toggle = document.getElementById('previewLayoutToggle');
  if (toggle) toggle.classList.toggle('visible', open);

  if (open) {
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
  if (!handle || !split || handle._dragInited) return;
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

// ═══════════════════════════════════════════════
// CONTENT PANEL EDIT MODE
// ═══════════════════════════════════════════════
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

    activeDoc.raw = raw;
    cpEditDirty   = false;
    setCpEditStatus('saved', '✓ saved');

    try {
      const endpoint = activeDoc.view === 'services'
        ? `/api/service/${encodeURIComponent(activeDoc.id)}`
        : `/api/tactic/${encodeURIComponent(activeDoc.id)}`;
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
// CODEMIRROR 6 EDITORS
// ═══════════════════════════════════════════════
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

  const noteContent = noteEditor ? cmGetValue(noteEditor) : null;
  const kbContent   = kbEditor   ? cmGetValue(kbEditor)   : null;

  if (typeof cmInitNote === 'function') cmInitNote(noteContent);
  if (typeof cmInitKb   === 'function') cmInitKb(kbContent);
}

function initSyntaxThemePicker() {
  document.querySelectorAll('.syntax-dot').forEach(d =>
    d.classList.toggle('active', d.dataset.theme === activeSyntaxTheme));
}

function cmThemeVars() {
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
