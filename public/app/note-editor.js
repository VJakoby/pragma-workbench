// ═══════════════════════════════════════════════
// NOTE EDITOR
// ═══════════════════════════════════════════════
let notePreviewOpen = localStorage.getItem('pragma-preview-open') === '1';
let previewLayout = localStorage.getItem('pragma-preview-layout') || 'vertical';

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
    const isSide = split.classList.contains('split-side');
    const startPos = isSide ? e.clientX : e.clientY;
    const splitRect = split.getBoundingClientRect();
    const prop = isSide ? '--note-editor-w' : '--note-editor-h';
    const dim = isSide ? splitRect.width : splitRect.height;
    const startPct = parseFloat(getComputedStyle(split).getPropertyValue(prop)) || 50;

    const onMove = ev => {
      const delta = (isSide ? ev.clientX : ev.clientY) - startPos;
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

function cmInitNote(initialDoc) {
  const wrap = document.getElementById('noteBodyWrap');
  if (!wrap || !CM) return;
  if (noteEditor) noteEditor.destroy();

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
