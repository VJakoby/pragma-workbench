// ═══════════════════════════════════════════════
// NOTE EDITOR
// ═══════════════════════════════════════════════
let notePreviewOpen = localStorage.getItem('pragma-preview-open') === '1';
let previewLayout = localStorage.getItem('pragma-preview-layout') || 'vertical';
const NOTE_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);
const NOTE_IMAGE_URL_RE = /\.(png|jpe?g|gif|webp)(?:[?#].*)?$/i;
const NOTE_IMAGE_EXT_BY_TYPE = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function setNoteImageDropTarget(active) {
  noteEditor?.dom?.classList.toggle('cm-image-drop-target', !!active);
}

function getDroppedImageFile(dataTransfer) {
  if (!dataTransfer?.files?.length) return null;
  return [...dataTransfer.files].find((file) => NOTE_IMAGE_TYPES.has(String(file.type || '').toLowerCase())) || null;
}

function getClipboardImageFile(clipboardData) {
  if (!clipboardData?.items?.length) return null;
  for (const item of clipboardData.items) {
    if (item.kind !== 'file') continue;
    const type = String(item.type || '').toLowerCase();
    if (!NOTE_IMAGE_TYPES.has(type)) continue;
    const file = item.getAsFile?.();
    if (file) return file;
  }
  return null;
}

function getDroppedImageUrl(dataTransfer) {
  const raw = dataTransfer?.getData('text/uri-list') || dataTransfer?.getData('text/plain') || '';
  if (!raw) return '';
  const first = String(raw)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('#'));
  if (!first) return '';
  return NOTE_IMAGE_URL_RE.test(first) ? first : '';
}

function hasImageDropPayload(dataTransfer) {
  return !!(getDroppedImageFile(dataTransfer) || getDroppedImageUrl(dataTransfer));
}

function buildNoteImageMarkdown(url, sourceName = 'image') {
  const alt = String(sourceName || 'image')
    .split(/[/?#]/)
    .pop()
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim() || 'image';
  return `![${alt}](${url})`;
}

function insertImageMarkdownAt(view, markdown, pos) {
  const doc = view.state.doc;
  const at = typeof pos === 'number' ? pos : view.state.selection.main.from;
  let insert = markdown;
  const before = at > 0 ? doc.sliceString(at - 1, at) : '';
  const after = at < doc.length ? doc.sliceString(at, at + 1) : '';
  if (before && before !== '\n') insert = `\n${insert}`;
  if (after && after !== '\n') insert = `${insert}\n`;
  view.dispatch({
    changes: { from: at, to: at, insert },
    selection: { anchor: at + insert.length },
    scrollIntoView: true,
    userEvent: 'input',
  });
  view.focus();
}

async function uploadNoteImage(file) {
  if (!activeNoteId || !notes[activeNoteId]) throw new Error('Open a note first');
  const fallbackExt = NOTE_IMAGE_EXT_BY_TYPE[String(file?.type || '').toLowerCase()] || 'png';
  const fallbackName = `clipboard-image.${fallbackExt}`;
  const filename = String(file?.name || '').trim() || fallbackName;
  const res = await fetch('/api/notes/attachments', {
    method: 'POST',
    headers: {
      'Content-Type': file.type,
      'X-Pragma-Note-Id': activeNoteId,
      'X-Pragma-Filename': encodeURIComponent(filename),
    },
    body: file,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error || 'Image upload failed');
  return data.url;
}

async function handleNoteImageDrop(event, view) {
  if (activeConfigDoc) return false;
  const imageFile = getDroppedImageFile(event.dataTransfer);
  const imageUrl = imageFile ? '' : getDroppedImageUrl(event.dataTransfer);
  if (!imageFile && !imageUrl) return false;

  event.preventDefault();
  event.stopPropagation();
  setNoteImageDropTarget(false);

  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.from;
  try {
    if (imageFile) {
      const uploadedUrl = await uploadNoteImage(imageFile);
      insertImageMarkdownAt(view, buildNoteImageMarkdown(uploadedUrl, imageFile.name), pos);
      showToast?.('✓ Image attached');
    } else if (imageUrl) {
      insertImageMarkdownAt(view, buildNoteImageMarkdown(imageUrl, imageUrl), pos);
      showToast?.('✓ Image link inserted');
    }
    return true;
  } catch (err) {
    showToast?.(`⚠ ${err.message || 'Image drop failed'}`, 'err');
    return true;
  }
}

async function handleNoteImagePaste(event, view) {
  if (activeConfigDoc) return false;
  const imageFile = getClipboardImageFile(event.clipboardData);
  if (!imageFile) return false;

  event.preventDefault();
  event.stopPropagation();

  const pos = view.state.selection.main.from;
  try {
    const uploadedUrl = await uploadNoteImage(imageFile);
    insertImageMarkdownAt(view, buildNoteImageMarkdown(uploadedUrl, imageFile.name || 'clipboard-image'), pos);
    showToast?.('✓ Screenshot attached');
    return true;
  } catch (err) {
    showToast?.(`⚠ ${err.message || 'Image paste failed'}`, 'err');
    return true;
  }
}

function continueOrderedListFallback(view) {
  const { state } = view;
  const main = state.selection.main;
  if (!main || !main.empty) return false;
  const pos = main.from;
  const line = state.doc.lineAt(pos);
  if (pos !== line.to) return false;

  const match = line.text.match(/^(\s*)(\d+)\.\s+(.*)$/);
  if (!match) return false;

  const [, indent, numberText, content] = match;
  if (!content.trim()) return false;

  const nextNumber = Number(numberText) + 1;
  const insert = `${state.lineBreak}${indent}${nextNumber}. `;
  view.dispatch({
    changes: { from: pos, to: pos, insert },
    selection: { anchor: pos + insert.length },
    scrollIntoView: true,
    userEvent: 'input'
  });
  return true;
}

async function updateNotePreview() {
  if (activeConfigDoc) return;
  const pane = document.getElementById('notePreviewPane');
  if (!pane || pane.style.display === 'none') return;
  const md = noteEditor ? cmGetValue(noteEditor) : '';
  const el = document.getElementById('notePreviewContent');
  if (!el) return;
  if (window.markdownPreview?.renderInto) {
    await window.markdownPreview.renderInto(el, md, { injectTargets: true });
    return;
  }
  const rendered = marked ? marked.parse(md) : md.replace(/\n/g, '<br>');
  el.innerHTML = typeof sanitizeRenderedHtml === 'function' ? sanitizeRenderedHtml(rendered) : rendered;
  if (typeof wrapCodeBlocks === 'function') wrapCodeBlocks(el);
  if (typeof wrapInlineCodes === 'function') wrapInlineCodes(el);
  if (typeof makeCollapsible === 'function') makeCollapsible(el);
  el.querySelectorAll('.copy-btn').forEach(b => b.style.display = 'none');
}

function toggleNotePreview() {
  if (activeConfigDoc) return;
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
  } else {
    split.classList.remove('split-side');
    split.style.removeProperty('--note-editor-w');
    handle.classList.remove('dragging');
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

  const extensions = [
    CM.basicSetup,
    ...buildCmTheme(),
    CM.EditorView.domEventHandlers({
      keydown(event, view) {
        if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return false;
        if (!continueOrderedListFallback(view)) return false;
        event.preventDefault();
        return true;
      },
      dragover(event) {
        if (!hasImageDropPayload(event.dataTransfer)) return false;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        setNoteImageDropTarget(true);
        return true;
      },
      dragleave() {
        setNoteImageDropTarget(false);
        return false;
      },
      drop(event, view) {
        if (!hasImageDropPayload(event.dataTransfer)) return false;
        void handleNoteImageDrop(event, view);
        return true;
      },
      paste(event, view) {
        if (!getClipboardImageFile(event.clipboardData)) return false;
        void handleNoteImagePaste(event, view);
        return true;
      }
    }),
    CM.EditorView.updateListener.of(update => {
      if (typeof syncEvidenceSelectionPrompt === 'function') syncEvidenceSelectionPrompt(update);
      if (!update.docChanged) return;
      if (activeConfigDoc) {
        autoSaveActiveConfig();
        return;
      }
      if (activeNoteId) {
        autoSaveNote();
        updateNotePreview();
      }
    }),
    CM.EditorView.lineWrapping,
    CM.indentUnit.of('  '),
    CM.keymap.of([CM.indentWithTab]),
  ];

  if (!activeConfigDoc) extensions.splice(1, 0, CM.markdown());

  noteEditor = new CM.EditorView({
    doc: initialDoc ?? '',
    extensions,
    parent: wrap,
  });
}
