// ═══════════════════════════════════════════════
// CONTENT PANEL RENDERING
// ═══════════════════════════════════════════════
function injectTargets(rawHtml) {
  const ip     = esc(getIP());
  const domain = esc(getDomain());
  const span   = (val) => `<span class="ip-injected">${val}</span>`;

  const ipPatterns = [
    /&lt;IP&gt;/g,  /&lt;ip&gt;/g,  /&lt;TARGET_IP&gt;/g,
    /&lt;target_ip&gt;/g,  /&lt;TARGET&gt;/g,  /&lt;RHOST&gt;/g,
    /&lt;rhost&gt;/g,  /&lt;HOST&gt;/g,  /&lt;host&gt;/g,
    /\bTARGET_IP\b/g,  /\bRHOST\b/g,  /\bTARGET\b/g,
    /\$IP\b/g,  /\$RHOST\b/g,  /\$TARGET\b/g,  /\$TARGET_IP\b/g,
    /\$HOST\b/g,
    /\{IP\}/g,  /\{ip\}/g,  /\{RHOST\}/g,  /\{rhost\}/g,  /\{TARGET\}/g,
    /\{\{ip\}\}/g,  /\{\{IP\}\}/g,  /\{\{target\}\}/g,  /\{\{rhost\}\}/g,
    /\{HOST\}/g,  /\{host\}/g,  /\{\{host\}\}/g,  /\{\{HOST\}\}/g,
    /\bTARGET_IP_ADDRESS\b/g,  /&lt;MACHINE_IP&gt;/g,  /\bMACHINE_IP\b/g,
    /\b10\.10\.10\.X\b/g,  /\b10\.10\.X\.X\b/g,
  ];

  const domainPatterns = [
    /&lt;DOMAIN&gt;/g,  /&lt;domain&gt;/g,  /&lt;TARGET_DOMAIN&gt;/g,
    /&lt;FQDN&gt;/g,  /&lt;fqdn&gt;/g,  /&lt;DC&gt;/g,  /&lt;dc&gt;/g,
    /\bTARGET_DOMAIN\b/g,  /\bDOMAIN\b(?=[\s"'\`>])/g,
    /\$DOMAIN\b/g,  /\$FQDN\b/g,  /\$DC\b/g,
    /\{DOMAIN\}/g,  /\{domain\}/g,  /\{FQDN\}/g,  /\{\{domain\}\}/g,
    /&lt;WORKGROUP&gt;/g,  /\bWORKGROUP\b(?=[\s"'\`>])/g,
  ];

  let out = rawHtml;
  for (const p of ipPatterns) out = out.replace(p, span(ip));
  for (const p of domainPatterns) out = out.replace(p, span(domain));

  out = out.replace(/(<code[^>]*>)([\s\S]*?)(<\/code>)/g, (_, open, inner, close) => {
    const replaced = inner.replace(/\bIP\b/g, span(ip))
                          .replace(/\bHOST\b/g, span(ip));
    return open + replaced + close;
  });

  return out;
}

function injectTargetsInCodeLine(rawLine) {
  let out = injectTargets(esc(rawLine));
  const ip = esc(getIP());
  const span = (val) => `<span class="ip-injected">${val}</span>`;
  out = out.replace(/\bIP\b/g, span(ip))
           .replace(/\bHOST\b/g, span(ip));
  return out;
}

function wrapCodeBlocks(container) {
  container.querySelectorAll('pre').forEach(pre => {
    if (pre.parentElement.classList.contains('code-block-wrap')) return;

    const wrap = document.createElement('div');
    wrap.className = 'code-block-wrap';
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);

    const codeEl = pre.querySelector('code') || pre;
    const rawText = codeEl.textContent || '';
    const lines = rawText.replace(/\n$/, '').split('\n');

    codeEl.innerHTML = lines.map((line) => {
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

async function openItem(view, id) {
  document.querySelectorAll('.card').forEach(c => c.classList.remove('active-card'));
  const card = document.querySelector(`.card[data-id="${id}"]`);
  if (card) card.classList.add('active-card');

  const panel = document.getElementById('contentPanel');
  panel.classList.remove('hidden-panel');
  document.getElementById('cpTitle').textContent = 'Loading…';
  document.getElementById('cpContent').innerHTML = `<p style="color:var(--muted);text-align:center;padding:60px 0">Loading…</p>`;

  const endpoint = getKbFetchConfig(view).detailUrl(id);
  try {
    const r = await fetch(endpoint);
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    const meta = view === 'services'
      ? `${d.port} · ${d.category}`
      : `${d.category} · ${d.wordCount} words`;
    activeDoc = { html: d.html, raw: d.raw, icon: d.icon || ICONS.notes, title: d.name, meta, id, view, isLocal: true };
    renderContent(d.html, d.icon || ICONS.notes, d.name, meta);
    document.getElementById('cpEditBtn').style.display = '';
  } catch (e) {
    document.getElementById('cpContent').innerHTML = `<p style="color:var(--red)">Error: ${e.message}</p>`;
  }
}

async function openPreviewByPath(title, filePath, query = '', sourceId = '', sourceName = '') {
  const panel = document.getElementById('contentPanel');
  panel.classList.remove('hidden-panel');
  document.getElementById('cpTitle').textContent = title;
  document.getElementById('cpContent').innerHTML = `<p style="color:var(--muted);text-align:center;padding:60px 0">Loading…</p>`;

  try {
    let d = null;

    if (filePath) {
      try {
        const r = await fetch('/api/content-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_path: filePath }),
        });
        const j = await r.json();
        if (j.ok && j.html) d = j;
        else console.warn('[PRAGMA] content-proxy:', j.error || j.detail || 'no content');
      } catch (e) {
        console.warn('[PRAGMA] content-proxy fetch failed:', e.message);
      }
    }

    if (!d) throw new Error('Content unavailable — ENGRAM could not serve this file');

    const meta = filePath.split('/').pop() || sourceName || '';
    activeDoc = { html: d.html, icon: '🔍', title, meta, isLocal: false };
    renderContent(d.html, ICONS.search, title, meta, query);
    document.getElementById('cpEditBtn').style.display = 'none';
  } catch (e) {
    document.getElementById('cpContent').innerHTML = `
      <div style="padding:40px 24px;color:var(--red);font-family:'Inter',sans-serif">
        <div style="font-size:22px;margin-bottom:8px">⚠</div>
        <div style="font-size:14px;font-weight:600;margin-bottom:6px">${e.message}</div>
        <div style="font-size:12px;color:var(--muted);font-family:'JetBrains Mono',monospace;word-break:break-all">${esc(filePath || '')}</div>
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
  document.getElementById('cpIcon').innerHTML = icon;
  document.getElementById('cpTitle').textContent = title;
  document.getElementById('cpMeta').textContent = meta || '';
  const el = document.getElementById('cpContent');

  if (query) {
    el.innerHTML = `
      <div class="source-preview-frame">
        <div class="source-preview-label">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Source content${meta ? ' — <span>' + esc(meta) + '</span>' : ''}
        </div>
        <div class="source-preview-body md-content" id="cpContentInner"></div>
      </div>`;
    const inner = document.getElementById('cpContentInner');
    inner.innerHTML = injectTargets(html);
    wrapCodeBlocks(inner);
    wrapInlineCodes(inner);
    makeCollapsible(inner);
  } else {
    el.innerHTML = injectTargets(html);
    wrapCodeBlocks(el);
    wrapInlineCodes(el);
    makeCollapsible(el);
  }

  el.parentElement.scrollTop = 0;
}

function closeContent() {
  document.getElementById('contentPanel').classList.add('hidden-panel');
  document.querySelectorAll('.card').forEach(c => c.classList.remove('active-card'));
  activeDoc = null;
  exitEditMode();
  document.getElementById('cpEditBtn').style.display = 'none';
}
