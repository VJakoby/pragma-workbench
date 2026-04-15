// ═══════════════════════════════════════════════
// CONTENT PANEL RENDERING
// ═══════════════════════════════════════════════
let contentPanelBackState = null;
let contentPanelCreateState = null;
let contentPanelSearchState = { query: '', matches: [], activeIndex: -1 };

function setContentPanelHeader(icon, title, meta, opts = {}) {
  const iconEl = document.getElementById('cpIcon');
  const titleEl = document.getElementById('cpTitle');
  const metaEl = document.getElementById('cpMeta');
  const showIcon = opts.showIcon !== false;
  if (iconEl) {
    iconEl.innerHTML = showIcon ? icon : '';
    iconEl.style.display = showIcon ? '' : 'none';
  }
  if (titleEl) titleEl.textContent = title || '';
  if (metaEl) metaEl.textContent = meta || '';
}

function setContentPanelAccent(accent) {
  const panel = document.getElementById('contentPanel');
  if (!panel) return;
  panel.style.setProperty('--cp-accent', accent || 'var(--accent)');
}

function setContentPanelBackState(state) {
  contentPanelBackState = state || null;
  const btn = document.getElementById('cpBackBtn');
  if (btn) btn.style.display = contentPanelBackState ? '' : 'none';
}

function clearContentPanelBackState() {
  setContentPanelBackState(null);
}

function setContentPanelCreateState(state) {
  contentPanelCreateState = state || null;
  const btn = document.getElementById('cpCreateBtn');
  if (btn) btn.style.display = contentPanelCreateState ? '' : 'none';
}

function clearContentPanelCreateState() {
  setContentPanelCreateState(null);
}

function getContentPanelSearchRoot() {
  return document.getElementById('cpContentInner') || document.getElementById('cpContent');
}

function clearContentPanelSearchMarks() {
  const root = getContentPanelSearchRoot();
  if (!root) return;
  root.querySelectorAll('mark.cp-search-hit').forEach((mark) => {
    mark.replaceWith(document.createTextNode(mark.textContent || ''));
  });
  root.normalize();
}

function updateContentPanelSearchCount() {
  const countEl = document.getElementById('cpSearchCount');
  const prevBtn = document.getElementById('cpSearchPrevBtn');
  const nextBtn = document.getElementById('cpSearchNextBtn');
  const total = contentPanelSearchState.matches.length;
  const active = total ? contentPanelSearchState.activeIndex + 1 : 0;
  if (countEl) countEl.textContent = total ? `${active} / ${total}` : '0';
  if (prevBtn) prevBtn.disabled = total === 0;
  if (nextBtn) nextBtn.disabled = total === 0;
}

function scrollToActiveContentPanelSearchMatch() {
  contentPanelSearchState.matches.forEach((match, index) => {
    match.classList.toggle('active', index === contentPanelSearchState.activeIndex);
  });
  const active = contentPanelSearchState.matches[contentPanelSearchState.activeIndex];
  if (active) active.scrollIntoView({ block: 'center', behavior: 'smooth' });
  updateContentPanelSearchCount();
}

function collectContentPanelSearchMatches(query) {
  const root = getContentPanelSearchRoot();
  if (!root || !query) return [];
  const lowerNeedle = query.toLocaleLowerCase();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent || parent.closest('script,style')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const textNodes = [];
  let current;
  while ((current = walker.nextNode())) textNodes.push(current);

  const matches = [];
  textNodes.forEach((textNode) => {
    const text = textNode.nodeValue || '';
    const lowerText = text.toLocaleLowerCase();
    let cursor = 0;
    let hit = lowerText.indexOf(lowerNeedle, cursor);
    if (hit === -1) return;

    const parts = [];
    while (hit !== -1) {
      if (hit > cursor) parts.push(document.createTextNode(text.slice(cursor, hit)));
      const mark = document.createElement('mark');
      mark.className = 'cp-search-hit';
      mark.textContent = text.slice(hit, hit + query.length);
      parts.push(mark);
      matches.push(mark);
      cursor = hit + query.length;
      hit = lowerText.indexOf(lowerNeedle, cursor);
    }
    if (cursor < text.length) parts.push(document.createTextNode(text.slice(cursor)));
    textNode.replaceWith(...parts);
  });
  return matches;
}

function applyContentPanelSearch() {
  clearContentPanelSearchMarks();
  contentPanelSearchState.matches = [];
  contentPanelSearchState.activeIndex = -1;
  const query = (contentPanelSearchState.query || '').trim();
  if (!query) {
    updateContentPanelSearchCount();
    return;
  }
  contentPanelSearchState.matches = collectContentPanelSearchMatches(query);
  contentPanelSearchState.activeIndex = contentPanelSearchState.matches.length ? 0 : -1;
  scrollToActiveContentPanelSearchMatch();
}

function setContentPanelSearchVisible(visible) {
  const bar = document.getElementById('cpSearchBar');
  const input = document.getElementById('cpSearchInput');
  if (bar) bar.style.display = visible ? 'flex' : 'none';
  if (!visible) {
    if (input) input.value = '';
    contentPanelSearchState.query = '';
    contentPanelSearchState.matches = [];
    contentPanelSearchState.activeIndex = -1;
    clearContentPanelSearchMarks();
  }
  updateContentPanelSearchCount();
}

function updateContentPanelSearch() {
  contentPanelSearchState.query = document.getElementById('cpSearchInput')?.value || '';
  applyContentPanelSearch();
}

function stepContentPanelSearch(direction = 1) {
  const total = contentPanelSearchState.matches.length;
  if (!total) return;
  contentPanelSearchState.activeIndex = (contentPanelSearchState.activeIndex + direction + total) % total;
  scrollToActiveContentPanelSearchMatch();
}

function handleContentPanelSearchKey(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    stepContentPanelSearch(event.shiftKey ? -1 : 1);
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    const input = document.getElementById('cpSearchInput');
    if (input?.value) {
      input.value = '';
      updateContentPanelSearch();
    } else {
      input?.blur();
    }
  }
}

function openContentPanelCreate() {
  if (!contentPanelCreateState || typeof openKbCreateModal !== 'function') return;
  openKbCreateModal(contentPanelCreateState.view, {
    folder: contentPanelCreateState.folder || '',
    label: contentPanelCreateState.label || '',
  });
}

function goBackContentPanel() {
  if (!contentPanelBackState) return;
  const state = contentPanelBackState;
  clearContentPanelBackState();
  if (state.type === 'kb-browser' && typeof openKbBrowserInPanel === 'function') {
    openKbBrowserInPanel(state.view, {
      folder: state.folder || '',
      title: state.title || '',
      meta: state.meta || '',
    });
  }
}

function injectTargets(rawHtml) {
  const ip     = esc(getIP());
  const domain = esc(getDomain());
  const label  = esc(getTargetLabelValue());
  const attacker = esc(getAttackerIP());
  const span   = (val, cls = 'ip-injected') => `<span class="${cls}">${val}</span>`;
  const matcherFactory = globalThis.PRAGMA_PLACEHOLDERS?.getPlaceholderMatchers;
  if (typeof matcherFactory !== 'function') return rawHtml;
  const {
    ipPatterns,
    domainPatterns,
    labelPatterns,
    attackerPatterns,
  } = matcherFactory({ htmlEscapedAngles: true });

  let out = rawHtml;
  for (const p of ipPatterns) out = out.replace(p, span(ip, 'ip-injected ip-injected-ip'));
  for (const p of domainPatterns) out = out.replace(p, span(domain, 'ip-injected ip-injected-domain'));
  for (const p of labelPatterns) out = out.replace(p, span(label, 'ip-injected ip-injected-label'));
  for (const p of attackerPatterns) out = out.replace(p, span(attacker, 'ip-injected ip-injected-attacker'));

  return out;
}

function injectTargetsInCodeLine(rawLine) {
  return injectTargets(esc(rawLine));
}

function highlightCodeBlock(codeEl) {
  if (!codeEl || codeEl.dataset.hljsDone === '1') return;
  if (!window.hljs?.highlightElement) return;

  const rawText = codeEl.textContent || '';
  codeEl.textContent = rawText;
  window.hljs.highlightElement(codeEl);
  codeEl.dataset.hljsDone = '1';
}

function wrapCodeBlocks(container) {
  container.querySelectorAll('pre').forEach(pre => {
    let wrap = pre.parentElement;
    if (!wrap?.classList?.contains('code-block-wrap')) {
      wrap = document.createElement('div');
      wrap.className = 'code-block-wrap';
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(pre);
    }

    const codeEl = pre.querySelector('code') || pre;
    const rawText = codeEl.textContent || '';
    const hasLanguageClass = [...(codeEl.classList || [])].some((cls) => cls.startsWith('language-'));

    let copyBtn = wrap.querySelector('.code-block-copy-btn');
    if (hasLanguageClass) {
      codeEl.textContent = rawText;
      delete codeEl.dataset.hljsDone;
      highlightCodeBlock(codeEl);
      codeEl.innerHTML = injectTargets(codeEl.innerHTML);

      if (!copyBtn) {
        copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'code-block-copy-btn';
        copyBtn.textContent = 'Copy';
        wrap.appendChild(copyBtn);

        copyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(rawText.trimEnd()).then(() => {
            wrap.classList.add('flash');
            copyBtn.textContent = 'Copied';
            showToast('✓ Copied to clipboard');
            setTimeout(() => {
              wrap.classList.remove('flash');
              copyBtn.textContent = 'Copy';
            }, 1200);
          });
        });
      }
      return;
    }

    if (copyBtn) copyBtn.remove();

    codeEl.innerHTML = rawText.replace(/\n$/, '').split('\n').map((line) => {
      if (!line.trim()) return '<span class="code-line-blank">&nbsp;</span>';
      const injected = injectTargetsInCodeLine(line);
      return '<span class="code-line">' +
             injected +
             '<span class="code-line-copy">\u2398 copy</span>' +
             '</span>';
    }).join('');

    codeEl.querySelectorAll('.code-line').forEach(lineEl => {
      lineEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const nodes = [...lineEl.childNodes].filter(n => !n.classList?.contains('code-line-copy'));
        const plain = nodes.map(n => n.textContent).join('').trimEnd();
        navigator.clipboard.writeText(plain).then(() => {
          lineEl.classList.add('flash');
          const hint = lineEl.querySelector('.code-line-copy');
          if (hint) hint.textContent = '✓ copied';
          showToast('✓ Copied to clipboard');
          setTimeout(() => {
            lineEl.classList.remove('flash');
            if (hint) hint.textContent = '\u2398 copy';
          }, 1200);
        });
      });
    });
  });
}

function wrapInlineCodes(container) {
  container.querySelectorAll('code:not(pre code)').forEach(el => {
    if (el.dataset.inlineWrapped) return;
    el.dataset.inlineWrapped = '1';

    el.innerHTML = injectTargets(el.innerHTML);
    el.style.cursor = 'pointer';
    el.title = 'Click to copy';

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const text = el.innerText.trim();
      navigator.clipboard.writeText(text).then(() => {
        el.classList.add('inline-code-copied');
        el.title = '✓ copied';
        showToast('✓ Copied to clipboard');
        setTimeout(() => {
          el.classList.remove('inline-code-copied');
          el.title = 'Click to copy';
        }, 1200);
      });
    });
  });
}

function refreshCodeBlocks() {
  const el = document.getElementById('cpContent');
  if (!el || !activeDoc) return;
  renderContent(activeDoc.html, activeDoc.icon, activeDoc.title, activeDoc.meta);
}

window.addEventListener('pragma-hljs-ready', () => {
  ['cpContent', 'notePreviewContent', 'kbPreviewContent', 'newNotePreviewContent'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) wrapCodeBlocks(el);
  });
});

function renderContentPanelTabs(doc = activeDoc) {
  const tabs = document.getElementById('cpQuickTabs');
  if (!tabs) return;

  if (!doc?.isLocal || doc?.isBrowser || !doc.view || !doc.id) {
    tabs.style.display = 'none';
    tabs.innerHTML = '';
    setContentPanelSearchVisible(false);
    return;
  }

  const docFolder = doc.folder || '';
  const siblings = getKbCollection(doc.view)
    .filter(item => (item.folder || '') === docFolder)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }));

  if (siblings.length <= 1) {
    tabs.style.display = 'none';
    tabs.innerHTML = '';
    return;
  }

  tabs.innerHTML = `<div class="content-panel-tabs-inner">${siblings.map(item => `
    <button class="content-panel-tab${item.id === doc.id ? ' active' : ''}"
      onclick="openItem('${encodeURIComponent(doc.view)}', '${encodeURIComponent(item.id)}')"
      title="${esc(item.name || '')}">
      ${esc(item.name || 'Untitled')}
    </button>`).join('')}</div>`;
  tabs.style.display = 'flex';
}

async function openItem(view, id) {
  view = decodeURIComponent(view);
  id = decodeURIComponent(id);
  const wasEditing = typeof isKbEditModeOpen === 'function' && isKbEditModeOpen();
  if (wasEditing && cpEditDirty && typeof saveEdit === 'function') {
    await saveEdit({ auto: true });
    if (cpEditDirty) {
      showToast('Could not switch document while the current edit has unsaved changes');
      return;
    }
  }
  const itemMeta = getKbCollection(view).find(item => item.id === id) || null;
  const hadBrowserState = activeDoc?.isBrowser && activeDoc?.view === view;
  const backState = hadBrowserState
    ? {
        type: 'kb-browser',
        view: activeDoc.view,
        folder: activeDoc.folder || '',
        title: document.getElementById('cpTitle')?.textContent || '',
        meta: document.getElementById('cpMeta')?.textContent || '',
        label: activeDoc.label || '',
      }
    : null;
  document.querySelectorAll('.card').forEach(c => c.classList.remove('active-card'));
  const card = document.querySelector(`.card[data-id="${id}"]`);
  if (card) card.classList.add('active-card');

  const panel = document.getElementById('contentPanel');
  panel.classList.remove('hidden-panel');
  setContentPanelAccent(card?.style.getPropertyValue('--card-accent') || 'var(--accent)');
  setContentPanelHeader('', 'Loading…', '', { showIcon: false });
  setContentPanelSearchVisible(true);
  document.getElementById('cpContent').innerHTML = `<p style="color:var(--muted);text-align:center;padding:60px 0">Loading…</p>`;

  const endpoint = getKbFetchConfig(view).detailUrl(id);
  try {
    const r = await fetch(endpoint);
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    const meta = view === 'services'
      ? `${d.port} · ${d.category}`
      : `${d.category} · ${d.wordCount} words`;
    activeDoc = {
      html: d.html,
      raw: d.raw,
      icon: d.icon || ICONS.notes,
      title: d.name,
      meta,
      id,
      view,
      isLocal: true,
      folder: itemMeta?.folder || '',
      category: itemMeta?.category || d.category || '',
    };
    setContentPanelBackState(backState);
    setContentPanelCreateState(backState ? { view: backState.view, folder: backState.folder || '', label: backState.label || backState.title || '' } : null);
    renderContentPanelTabs(activeDoc);
    if (wasEditing && typeof syncKbEditorToActiveDoc === 'function') {
      syncKbEditorToActiveDoc();
    } else {
      renderContent(d.html, d.icon || ICONS.notes, d.name, meta);
    }
    document.getElementById('cpEditBtn').style.display = '';
  } catch (e) {
    document.getElementById('cpContent').innerHTML = `<p style="color:var(--red)">Error: ${esc(e.message || 'Unknown error')}</p>`;
  }
}

async function openPreviewByPath(title, filePath, query = '', sourceId = '', sourceName = '') {
  clearContentPanelBackState();
  clearContentPanelCreateState();
  renderContentPanelTabs(null);
  setContentPanelSearchVisible(false);
  const panel = document.getElementById('contentPanel');
  panel.classList.remove('hidden-panel');
  setContentPanelAccent('var(--accent)');
  setContentPanelHeader(ICONS.search, title, '', { showIcon: true });
  document.getElementById('cpContent').innerHTML = `<p style="color:var(--muted);text-align:center;padding:60px 0">Loading…</p>`;
  const normalizedPath = typeof filePath === 'string' && filePath.startsWith('file://')
    ? filePath.replace(/^file:\/\//, '')
    : filePath;

  try {
    let d = null;

    if (normalizedPath) {
      try {
        const r = await fetch('/api/content-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_path: normalizedPath }),
        });
        const j = await r.json();
        if (r.ok && (j.html || j.raw)) d = j;
        else console.warn('[PRAGMA] content-proxy:', j.error || j.detail || 'no content');
      } catch (e) {
        console.warn('[PRAGMA] content-proxy fetch failed:', e.message);
      }
    }

    if (!d) throw new Error('Content unavailable — ENGRAM could not serve this file');

    const meta = (normalizedPath || '').split('/').pop() || sourceName || '';
    activeDoc = { html: d.html, icon: '🔍', title, meta, isLocal: false };
    renderContentPanelTabs(activeDoc);
    renderContent(d.html, ICONS.search, title, meta, query);
    document.getElementById('cpEditBtn').style.display = 'none';
  } catch (e) {
    document.getElementById('cpContent').innerHTML = `
      <div style="padding:40px 24px;color:var(--red);font-family:'Inter',sans-serif">
        <div style="font-size:22px;margin-bottom:8px">⚠</div>
        <div style="font-size:14px;font-weight:600;margin-bottom:6px">${e.message}</div>
        <div style="font-size:12px;color:var(--muted);font-family:'JetBrains Mono',monospace;word-break:break-all">${esc(normalizedPath || '')}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:10px">
          Make sure ENGRAM has indexed this file (<code>npm run index</code>) and is reachable at
          <code style="color:var(--accent)">${window.location.origin}/api/search-ping</code>
        </div>
      </div>`;
  }
}

function makeCollapsible(container) {
  const levels = ['H2', 'H3', 'H4', 'H5', 'H6'];
  const headings = [...container.querySelectorAll('h2,h3,h4,h5,h6')];
  if (!headings.length) return;

  headings.forEach(heading => {
    const level = parseInt(heading.tagName[1]);
    const siblings = [];
    let node = heading.nextSibling;
    while (node) {
      const tag = node.tagName;
      if (tag && levels.includes(tag) && parseInt(tag[1]) <= level) break;
      siblings.push(node);
      node = node.nextSibling;
    }
    if (!siblings.length) return;

    const body = document.createElement('div');
    body.className = 'kb-section-body';
    heading.parentNode.insertBefore(body, siblings[0]);
    siblings.forEach(s => body.appendChild(s));

    const section = document.createElement('div');
    section.className = 'kb-section';
    heading.parentNode.insertBefore(section, heading);
    section.appendChild(heading);
    section.appendChild(body);

    heading.classList.add('kb-heading-toggle');
    heading.addEventListener('click', () => section.classList.toggle('collapsed'));
  });
}

function renderContent(html, icon, title, meta, query = '') {
  const isLocalKbDoc = !query && !!activeDoc?.isLocal && !activeDoc?.isBrowser;
  setContentPanelHeader(icon, title, meta || '', { showIcon: !isLocalKbDoc });
  const el = document.getElementById('cpContent');
  const renderedHtml = html;

  if (query) {
    el.innerHTML = `
      <div class="source-preview-frame">
        <div class="source-preview-label">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Source content${meta ? ' — <span>' + esc(meta) + '</span>' : ''}
        </div>
        <div class="source-preview-body md-content" id="cpContentInner"></div>
      </div>`;
    const inner = document.getElementById('cpContentInner');
    inner.innerHTML = renderedHtml;
    wrapCodeBlocks(inner);
    wrapInlineCodes(inner);
    makeCollapsible(inner);
  } else {
    el.innerHTML = renderedHtml;
    wrapCodeBlocks(el);
    wrapInlineCodes(el);
    makeCollapsible(el);
  }

  el.parentElement.scrollTop = 0;
  if (isLocalKbDoc) {
    setContentPanelSearchVisible(true);
    applyContentPanelSearch();
  } else {
    setContentPanelSearchVisible(false);
  }
}

function closeContent() {
  document.getElementById('contentPanel').classList.add('hidden-panel');
  document.querySelectorAll('.card').forEach(c => c.classList.remove('active-card'));
  activeDoc = null;
  renderContentPanelTabs(null);
  clearContentPanelBackState();
  clearContentPanelCreateState();
  setContentPanelSearchVisible(false);
  exitEditMode();
  document.getElementById('cpEditBtn').style.display = 'none';
}
