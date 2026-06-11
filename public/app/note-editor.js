// ═══════════════════════════════════════════════
// NOTE EDITOR
// ═══════════════════════════════════════════════
let notePreviewOpen = localStorage.getItem('pragma-preview-open') === '1';
let previewLayout = localStorage.getItem('pragma-preview-layout') || 'vertical';
let noteUnifiedPreview = localStorage.getItem('pragma-preview-unified') === '1';
let notePreviewTimer = null;
let noteUnifiedRenderTimer = null;
let noteUnifiedSyncing = false;
let noteUnifiedEditor = null;
let lastNotePreviewMarkdown = null;
const NOTE_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);
const NOTE_IMAGE_URL_RE = /\.(png|jpe?g|gif|webp)(?:[?#].*)?$/i;
const NOTE_ATTACHMENT_URL_RE = /\/api\/notes\/attachments\/([^/\s)]+)\/([^)\s?#]+)/g;
const NOTE_IMAGE_EXT_BY_TYPE = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeAttachmentWarningHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function uint8ToBase64(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  const chunkSize = 0x8000;
  let binary = '';
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

function extractNoteAttachmentRefs(markdown) {
  const refs = [];
  const seen = new Set();
  const source = String(markdown || '');
  NOTE_ATTACHMENT_URL_RE.lastIndex = 0;
  let match;
  while ((match = NOTE_ATTACHMENT_URL_RE.exec(source))) {
    const noteId = decodeURIComponent(match[1] || '').trim();
    const filename = decodeURIComponent(match[2] || '').trim();
    if (!noteId || !filename) continue;
    const url = `/api/notes/attachments/${encodeURIComponent(noteId)}/${encodeURIComponent(filename)}`;
    const key = `${noteId}:${filename}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ noteId, filename, url });
  }
  return refs;
}

async function fetchNoteAttachmentBlobFromUrl(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    let detail = '';
    try {
      const payload = await res.json();
      detail = payload?.error || payload?.detail || '';
    } catch (_) {}
    const suffix = detail ? `: ${detail}` : '';
    throw new Error(`Attachment fetch failed (${res.status}) for ${url}${suffix}`);
  }
  const contentType = String(res.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('application/json')) {
    const payload = await res.json();
    if (!payload?.encrypted) throw new Error('Attachment payload invalid');
    if (!encryptedStoragePassword) throw new Error('Workbench is locked');
    const decrypted = await decryptBinaryPayload(payload, encryptedStoragePassword);
    return new Blob([decrypted.buffer], { type: decrypted.mimeType || 'application/octet-stream' });
  }
  return res.blob();
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read blob'));
    reader.readAsDataURL(blob);
  });
}

async function inlineNoteAttachmentUrlsForExport(markdown) {
  let output = String(markdown || '');
  const refs = extractNoteAttachmentRefs(output);
  for (const ref of refs) {
    const blob = await fetchNoteAttachmentBlobFromUrl(ref.url);
    const dataUrl = await blobToDataUrl(blob);
    output = output.replace(new RegExp(escapeRegExp(ref.url), 'g'), dataUrl);
  }
  return output;
}

async function collectAttachmentPayloadsForNotes(noteList) {
  const payloads = {};
  for (const note of noteList || []) {
    const refs = extractNoteAttachmentRefs(note?.body || '');
    for (const ref of refs) {
      if (!payloads[ref.noteId]) payloads[ref.noteId] = {};
      if (payloads[ref.noteId][ref.filename]) continue;
      let blob;
      try {
        blob = await fetchNoteAttachmentBlobFromUrl(ref.url);
      } catch (err) {
        const title = String(note?.title || note?.id || ref.noteId || 'unknown note');
        throw new Error(`${err.message} (referenced by "${title}")`);
      }
      const buffer = await blob.arrayBuffer();
      payloads[ref.noteId][ref.filename] = {
        mime_type: blob.type || 'application/octet-stream',
        data: uint8ToBase64(buffer),
      };
    }
  }
  return payloads;
}

async function validateNoteAttachmentsForNotes(noteList, opts = {}) {
  const failures = [];
  const seen = new Set();
  const limit = Math.max(1, Number(opts.limit || 12));
  for (const note of noteList || []) {
    const refs = extractNoteAttachmentRefs(note?.body || '');
    for (const ref of refs) {
      const key = `${ref.noteId}:${ref.filename}`;
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        await fetchNoteAttachmentBlobFromUrl(ref.url);
      } catch (err) {
        failures.push({
          ...ref,
          noteId: ref.noteId,
          noteTitle: String(note?.title || note?.id || ref.noteId || 'unknown note'),
          error: String(err?.message || 'Attachment validation failed'),
        });
        if (failures.length >= limit) return failures;
      }
    }
  }
  return failures;
}

function buildAttachmentManifestFromClientNotes(notesMap) {
  const manifest = {};
  Object.values(notesMap || {}).forEach((note) => {
    const refs = extractNoteAttachmentRefs(note.body || '');
    if (!refs.length) return;
    refs.forEach((ref) => {
      if (!manifest[ref.noteId]) manifest[ref.noteId] = [];
      if (!manifest[ref.noteId].includes(ref.filename)) manifest[ref.noteId].push(ref.filename);
    });
  });
  return manifest;
}

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

async function uploadNoteImage(file, opts = {}) {
  const noteId = String(opts.noteId || activeNoteId || '').trim();
  if (!noteId || !notes[noteId]) throw new Error('Open a note first');
  const fallbackExt = NOTE_IMAGE_EXT_BY_TYPE[String(file?.type || '').toLowerCase()] || 'png';
  const fallbackName = `clipboard-image.${fallbackExt}`;
  const filename = String(file?.name || '').trim() || fallbackName;
  const mode = opts.forceMode || ((encryptedStorageEnabled && encryptedStoragePassword) ? 'encrypted' : 'plaintext');
  let res;
  if (mode === 'encrypted') {
    if (!encryptedStoragePassword) throw new Error('Workbench is locked');
    const encryptedBlob = await encryptBinaryPayload(await file.arrayBuffer(), encryptedStoragePassword, file.type, filename);
    res = await fetch('/api/notes/attachments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        note_id: noteId,
        filename,
        mime_type: file.type,
        preserve_filename: !!opts.preserveFilename,
        encrypted_blob: encryptedBlob,
      }),
    });
  } else {
    res = await fetch('/api/notes/attachments', {
      method: 'POST',
      headers: {
        'Content-Type': file.type,
        'X-Pragma-Note-Id': noteId,
        'X-Pragma-Filename': encodeURIComponent(filename),
        'X-Pragma-Preserve-Filename': opts.preserveFilename ? '1' : '',
      },
      body: file,
    });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error || 'Image upload failed');
  return data.url;
}

async function resolveRenderedAttachmentImages(root) {
  if (!root) return;
  const images = [...root.querySelectorAll('img[src^="/api/notes/attachments/"]')];

  const renderAttachmentWarning = (img, message) => {
    if (!img || img.dataset.pragmaAttachmentBroken === '1') return;
    const wrapper = document.createElement('div');
    wrapper.className = 'attachment-warning';
    wrapper.innerHTML = `
      <span class="attachment-warning-icon" aria-hidden="true">${window.ICONS?.warning || '!'}</span>
      <div class="attachment-warning-copy">
        <div class="attachment-warning-title">Attachment unavailable</div>
        <div class="attachment-warning-text">${escapeAttachmentWarningHtml(message || 'Could not load attachment')}</div>
      </div>
    `;
    img.dataset.pragmaAttachmentBroken = '1';
    img.replaceWith(wrapper);
  };

  for (const img of images) {
    const src = img.getAttribute('src') || '';
    if (!src || img.dataset.pragmaResolvedAttachment === src) continue;
    img.addEventListener('error', () => {
      renderAttachmentWarning(img, 'Attachment file is missing or no longer readable.');
    }, { once: true });
    if (!encryptedStorageEnabled) continue;
    if (!encryptedStoragePassword) {
      renderAttachmentWarning(img, 'Workbench is locked. Unlock it to decrypt this attachment.');
      continue;
    }
    try {
      const blob = await fetchNoteAttachmentBlobFromUrl(src);
      const objectUrl = URL.createObjectURL(blob);
      if (img.dataset.pragmaObjectUrl) {
        try { URL.revokeObjectURL(img.dataset.pragmaObjectUrl); } catch (_) {}
      }
      img.dataset.pragmaResolvedAttachment = src;
      img.dataset.pragmaObjectUrl = objectUrl;
      img.src = objectUrl;
    } catch (err) {
      renderAttachmentWarning(img, err?.message || 'Could not decrypt attachment');
    }
  }
}

async function migrateNoteAttachmentsStorage(targetMode) {
  const seen = new Set();
  const refs = [];
  Object.values(notes || {}).forEach((note) => {
    extractNoteAttachmentRefs(note?.body || '').forEach((ref) => {
      const ownerNoteId = String(note?.id || '').trim();
      const key = `${ref.noteId || ownerNoteId}:${ref.filename}`;
      if (seen.has(key)) return;
      seen.add(key);
      refs.push({ ...ref, ownerNoteId });
    });
  });
  for (const ref of refs) {
    const blob = await fetchNoteAttachmentBlobFromUrl(ref.url);
    const file = new File([blob], ref.filename, { type: blob.type || 'application/octet-stream' });
    await uploadNoteImage(file, {
      noteId: ref.noteId || ref.ownerNoteId,
      preserveFilename: true,
      forceMode: targetMode,
    });
  }
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

function invalidateNotePreviewCache() {
  lastNotePreviewMarkdown = null;
}

function scheduleNotePreviewUpdate({ immediate = false } = {}) {
  if (notePreviewTimer) clearTimeout(notePreviewTimer);
  if (immediate) {
    void updateNotePreview();
    return;
  }
  notePreviewTimer = setTimeout(() => {
    notePreviewTimer = null;
    void updateNotePreview();
  }, 100);
}

async function updateNotePreview() {
  if (activeConfigDoc) return;
  const pane = document.getElementById('notePreviewPane');
  if (!pane || pane.style.display === 'none') return;
  const md = noteEditor ? cmGetValue(noteEditor) : '';
  const el = document.getElementById('notePreviewContent');
  if (!el) return;
  if (md === lastNotePreviewMarkdown) return;
  if (window.markdownPreview?.renderInto) {
    const rendered = await window.markdownPreview.renderInto(el, md, { injectTargets: true });
    if (rendered) lastNotePreviewMarkdown = md;
    return;
  }
  const rendered = marked ? marked.parse(md) : md.replace(/\n/g, '<br>');
  el.innerHTML = typeof sanitizeRenderedHtml === 'function' ? sanitizeRenderedHtml(rendered) : rendered;
  if (typeof wrapCodeBlocks === 'function') wrapCodeBlocks(el);
  if (typeof wrapInlineCodes === 'function') wrapInlineCodes(el);
  if (typeof makeCollapsible === 'function') makeCollapsible(el);
  el.querySelectorAll('.copy-btn').forEach(b => b.style.display = 'none');
  lastNotePreviewMarkdown = md;
}

async function refreshRenderedMarkdownSurfaces() {
  try {
    if (typeof updateNotePreview === 'function') await updateNotePreview();
  } catch (_) {}
  try {
    if (typeof updateKbPreview === 'function') await updateKbPreview();
  } catch (_) {}
  try {
    if (typeof renderContent === 'function' && activeDoc) await renderContent(activeDoc.html, activeDoc.icon, activeDoc.title, activeDoc.meta);
  } catch (_) {}
}

function scheduleNoteUnifiedRender() {
  if (noteUnifiedRenderTimer) clearTimeout(noteUnifiedRenderTimer);
  noteUnifiedRenderTimer = setTimeout(() => {
    noteUnifiedRenderTimer = null;
    void renderNoteUnifiedSurface();
  }, 80);
}

async function renderUnifiedWholePreview(el, markdown) {
  if (!el) return;
  const md = String(markdown || '').trim();
  if (!md) {
    el.innerHTML = '<div class="note-unified-empty">Empty note</div>';
    return;
  }
  let rendered = false;
  if (window.markdownPreview?.renderInto) {
    rendered = await window.markdownPreview.renderInto(el, md, { injectTargets: true });
  }
  if (rendered && String(el.innerHTML || '').trim()) return;
  const html = marked ? marked.parse(md) : md.replace(/\n/g, '<br>');
  el.innerHTML = typeof sanitizeRenderedHtml === 'function' ? sanitizeRenderedHtml(html) : html;
  if (typeof wrapCodeBlocks === 'function') wrapCodeBlocks(el);
  if (typeof wrapInlineCodes === 'function') wrapInlineCodes(el);
  if (typeof makeCollapsible === 'function') makeCollapsible(el);
  el.querySelectorAll('.copy-btn').forEach((b) => { b.style.display = 'none'; });
}

function syncUnifiedWholeToEditor(markdown) {
  if (!noteEditor) return;
  noteUnifiedSyncing = true;
  try {
    if (cmGetValue(noteEditor) !== markdown) cmSetValue(noteEditor, markdown);
  } finally {
    noteUnifiedSyncing = false;
  }
}

async function renderNoteUnifiedSurface() {
  const surface = document.getElementById('noteUnifiedSurface');
  const body = document.getElementById('noteUnifiedBody');
  if (!surface || !body || !noteUnifiedPreview || activeConfigDoc || !noteEditor) return;

  const markdown = cmGetValue(noteEditor);
  body.innerHTML = `
    <section class="note-unified-whole">
      <div class="note-unified-whole-col note-unified-whole-editor-col">
        <div class="note-unified-editor-host" id="noteUnifiedWholeEditorHost"></div>
      </div>
      <div class="note-unified-whole-col note-unified-whole-preview-col">
        <div class="md-content note-unified-live-preview note-unified-live-preview-whole" id="noteUnifiedWholePreview"></div>
      </div>
    </section>`;

  const editorHost = document.getElementById('noteUnifiedWholeEditorHost');
  const previewEl = document.getElementById('noteUnifiedWholePreview');
  if (!editorHost || !previewEl) return;

  createUnifiedNoteEditor(editorHost, markdown, (nextMarkdown) => {
    void renderUnifiedWholePreview(previewEl, nextMarkdown);
  });

  await renderUnifiedWholePreview(previewEl, markdown);
  requestAnimationFrame(() => {
    noteUnifiedEditor?.focus();
  });
}

function toggleNotePreview() {
  if (activeConfigDoc) return;
  if (noteUnifiedPreview) {
    noteUnifiedPreview = false;
    localStorage.setItem('pragma-preview-unified', '0');
    notePreviewOpen = true;
    localStorage.setItem('pragma-preview-open', '1');
    applyNotePreviewState();
    return;
  }
  notePreviewOpen = !notePreviewOpen;
  localStorage.setItem('pragma-preview-open', notePreviewOpen ? '1' : '0');
  applyNotePreviewState();
}

function toggleNoteUnifiedPreview() {
  if (activeConfigDoc) return;
  noteUnifiedPreview = !noteUnifiedPreview;
  localStorage.setItem('pragma-preview-unified', noteUnifiedPreview ? '1' : '0');
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
  const unifiedBtn = document.getElementById('noteUnifiedBtn');
  const unifiedSurface = document.getElementById('noteUnifiedSurface');
  if (!split || !handle || !pane || !btn) return;

  if (unifiedBtn) unifiedBtn.classList.toggle('active', noteUnifiedPreview);
  if (noteUnifiedPreview) {
    split.style.display = 'none';
    if (unifiedSurface) unifiedSurface.style.display = 'flex';
    btn.classList.remove('active');
    btn.title = 'Toggle markdown preview';
    renderNoteUnifiedSurface();
    return;
  }

  destroyUnifiedNoteEditor();
  split.style.display = 'flex';
  if (unifiedSurface) unifiedSurface.style.display = 'none';

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
    scheduleNotePreviewUpdate({ immediate: true });
    if (!noteUnifiedPreview) initPreviewDragHandle();
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


function destroyUnifiedNoteEditor() {
  if (noteUnifiedEditor) {
    noteUnifiedEditor.destroy();
    noteUnifiedEditor = null;
  }
}

function buildNoteEditorExtensions({ onDocChange } = {}) {
  return [
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
      if (typeof syncFindingSelectionPrompt === 'function') syncFindingSelectionPrompt(update);
      if (!update.docChanged) return;
      if (activeConfigDoc) {
        autoSaveActiveConfig();
        return;
      }
      if (typeof onDocChange === 'function') {
        onDocChange(update);
        return;
      }
      if (activeNoteId) {
        autoSaveNote();
        if (noteUnifiedPreview) {
          if (!noteUnifiedSyncing) scheduleNoteUnifiedRender();
        } else {
          scheduleNotePreviewUpdate();
        }
      }
    }),
    CM.EditorView.lineWrapping,
    CM.indentUnit.of('  '),
    CM.keymap.of([CM.indentWithTab]),
  ];
}

function createUnifiedNoteEditor(parent, initialDoc, onPreviewSync) {
  if (!parent || !CM) return null;
  destroyUnifiedNoteEditor();
  const extensions = buildNoteEditorExtensions({
    onDocChange() {
      if (!activeNoteId) return;
      autoSaveNote();
      const nextMarkdown = cmGetValue(noteUnifiedEditor);
      noteUnifiedSyncing = true;
      try {
        if (noteEditor && cmGetValue(noteEditor) !== nextMarkdown) cmSetValue(noteEditor, nextMarkdown);
      } finally {
        noteUnifiedSyncing = false;
      }
      if (typeof onPreviewSync === 'function') onPreviewSync(nextMarkdown);
    }
  });
  if (!activeConfigDoc) extensions.splice(1, 0, CM.markdown());
  noteUnifiedEditor = new CM.EditorView({
    doc: initialDoc ?? '',
    extensions,
    parent,
  });
  return noteUnifiedEditor;
}

function cmInitNote(initialDoc) {
  const wrap = document.getElementById('noteBodyWrap');
  if (!wrap || !CM) return;
  if (noteEditor) noteEditor.destroy();

  const extensions = buildNoteEditorExtensions();
  if (!activeConfigDoc) extensions.splice(1, 0, CM.markdown());

  noteEditor = new CM.EditorView({
    doc: initialDoc ?? '',
    extensions,
    parent: wrap,
  });
}
