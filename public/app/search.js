// ═══════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════
function updateSearchNavBadge(status = 'checking') {
  const badge = document.getElementById('search-index-badge');
  const dot = document.getElementById('search-status-dot');
  if (!badge) return;
  const count = Array.isArray(knownSources)
    ? knownSources.reduce((sum, src) => sum + Math.max(0, Number(src.page_count) || 0), 0)
    : 0;
  badge.textContent = count > 0 ? String(count) : '0';
  badge.className = `nav-item-count search-nav-badge ${status}`;
  badge.title = count > 0
    ? `${count} indexed page${count === 1 ? '' : 's'} · ENGRAM ${status}`
    : `No indexed pages loaded · ENGRAM ${status}`;
  if (dot) {
    dot.className = `nav-item-service-dot ${status}`.trim();
    dot.title = count > 0
      ? `${count} indexed page${count === 1 ? '' : 's'} · ENGRAM ${status}`
      : `No indexed pages loaded · ENGRAM ${status}`;
    dot.setAttribute('aria-label', count > 0
      ? `${count} indexed page${count === 1 ? '' : 's'} · ENGRAM ${status}`
      : `No indexed pages loaded · ENGRAM ${status}`);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => updateSearchNavBadge('checking'), { once: true });
} else {
  updateSearchNavBadge('checking');
}

async function checkEngramStatus() {
  const pill = document.getElementById('engramPill');
  const label = document.getElementById('engramPillLabel');
  if (!pill || !label) return;

  pill.className = 'engram-pill checking';
  label.textContent = 'ENGRAM…';
  updateSearchNavBadge('checking');

  try {
    const r = await fetch('/api/search-ping', { signal: AbortSignal.timeout(3000) });
    const d = await r.json();
    if (d.reachable === true) {
      pill.className = 'engram-pill online';
      label.textContent = 'ENGRAM';
      updateSearchNavBadge('online');
    } else {
      pill.className = 'engram-pill offline';
      label.textContent = 'ENGRAM';
      updateSearchNavBadge('offline');
    }
  } catch (e) {
    pill.className = 'engram-pill offline';
    label.textContent = 'ENGRAM';
    updateSearchNavBadge('offline');
  }
}

function onSearch(val) {
  clearTimeout(searchDebounce);
  if (val.trim().length < 2) {
    document.getElementById('resultsList').innerHTML = `<div class="results-offline">
      <div class="results-offline-icon"><svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
      <div class="results-offline-text">Start typing to search</div>
      <div class="results-offline-hint">Searches across indexed knowledge bases and sources</div>
    </div>`;
    document.getElementById('searchStatus').textContent = '';
    return;
  }
  document.getElementById('searchStatus').textContent = 'searching…';
  searchDebounce = setTimeout(() => runSearch(val.trim()), 300);
}

function clearSearch() {
  document.getElementById('searchInput').value = '';
  onSearch('');
  document.getElementById('searchInput').focus();
}

function setScope(s, btn) {
  searchScope = s;
  document.querySelectorAll('#scopeGroup .btn-group-item').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const q = document.getElementById('searchInput').value.trim();
  if (q.length >= 2) runSearch(q);
}

function setFuzzy(f, btn) {
  fuzzyMode = f;
  document.querySelectorAll('#fuzzyGroup .btn-group-item').forEach(b => {
    b.classList.remove('active','fuzzy-active');
  });
  btn.classList.add(f === 'off' ? 'active' : 'fuzzy-active');
  const q = document.getElementById('searchInput').value.trim();
  if (q.length >= 2) runSearch(q);
}

async function loadSearchSources() {
  try {
    const r = await fetch('/api/search-sources');
    const d = await r.json();
    knownSources = (d.sources || []).map(s => ({
      id: s.id,
      name: s.name,
      page_count: Number(s.page_count) || 0,
    }));
    updateSearchNavBadge(document.getElementById('engramPill')?.classList.contains('online') ? 'online'
      : document.getElementById('engramPill')?.classList.contains('offline') ? 'offline'
      : 'checking');
    if (!knownSources.length) return;
    renderSourceChips();
  } catch(e) {
    updateSearchNavBadge(document.getElementById('engramPill')?.classList.contains('online') ? 'online' : 'offline');
  }
}

function renderSourceChips() {
  const row   = document.getElementById('sourceFilterRow');
  const chips = document.getElementById('sourceChips');
  if (!knownSources.length) { row.style.display = 'none'; return; }
  row.style.display = 'flex';
  chips.innerHTML = knownSources.map(s => {
    const active = !disabledSources.has(s.id);
    return `<button class="source-chip${active ? ' active' : ''}"
      onclick="toggleSourceFilter('${encodeURIComponent(s.id)}')"
      title="${active ? 'Disable' : 'Enable'} source: ${esc(s.name)}"
    >${esc(s.name)}</button>`;
  }).join('');
}

function toggleSourceFilter(sourceId) {
  sourceId = decodeURIComponent(sourceId);
  if (disabledSources.has(sourceId)) {
    disabledSources.delete(sourceId);
  } else {
    disabledSources.add(sourceId);
  }
  try { localStorage.setItem('pragma-disabled-sources', JSON.stringify([...disabledSources])); } catch(e) {}
  renderSourceChips();
  const q = document.getElementById('searchInput').value.trim();
  if (q.length >= 2) runSearch(q);
}

let searchHistory = JSON.parse(localStorage.getItem('pragma-search-history') || '[]');

function addToSearchHistory(query) {
  if (!query || query.length < 2) return;
  searchHistory = [query, ...searchHistory.filter(q => q !== query)].slice(0, 30);
  try { localStorage.setItem('pragma-search-history', JSON.stringify(searchHistory)); } catch(e) {}
}

async function runSearch(query) {
  addToSearchHistory(query);
  try {
    const r = await fetch('/api/search-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, fuzzyMode })
    });
    const d = await r.json();
    if (d.offline) {
      console.warn('[Search] Proxy returned offline. Server error:', d.error || 'unknown');
    }
    let results = d.results || [];

    if (searchScope === 'local')  results = results.filter(r => r.is_local);
    if (searchScope === 'online') results = results.filter(r => !r.is_local);

    if (disabledSources.size > 0) results = results.filter(r => !disabledSources.has(r.source_id));

    renderResults(query, results, d.offline || false, d.docs_searched, d.search_time_ms);
  } catch(e) {
    console.error('[Search] Fetch failed:', e.message);
    renderResults(query, [], true, null, null);
  }
}

function highlightSnippet(text, query) {
  if (!query || !text) return esc(text);
  const escaped = esc(text);
  const terms = query.trim().split(/\s+/).filter(t => t.length > 2)
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!terms.length) return escaped;
  const re = new RegExp('(' + terms.join('|') + ')', 'gi');
  return escaped.replace(re, '<mark>$1</mark>');
}

function localPathFromResult(result) {
  if (result.file_path) return result.file_path;
  if (typeof result.url === 'string' && result.url.startsWith('file://')) {
    return result.url.replace(/^file:\/\//, '');
  }
  return '';
}

function renderResults(query, results, offline, docsSearched, timeMs) {
  const list = document.getElementById('resultsList');
  const stat = document.getElementById('searchStatus');
  const meta = document.getElementById('searchMeta');

  if (meta) meta.textContent = '';
  if (offline) {
    const pill = document.getElementById('engramPill');
    const label = document.getElementById('engramPillLabel');
    if (pill && label) {
      pill.className = 'engram-pill offline';
      label.textContent = 'ENGRAM';
    }
    updateSearchNavBadge('offline');
    stat.textContent = '⚠ offline';
    list.innerHTML = `<div class="results-offline error">
      <div class="results-offline-icon">⚠</div>
      <div class="results-offline-text">Search indexer not reachable</div>
      <div class="results-offline-hint">Check console · <a href="/api/search-ping" target="_blank" style="color:var(--accent)">ping indexer</a></div>
    </div>`;
    return;
  }

  const pill = document.getElementById('engramPill');
  const label = document.getElementById('engramPillLabel');
  if (pill && label) {
    pill.className = 'engram-pill online';
    label.textContent = 'ENGRAM';
  }
  updateSearchNavBadge('online');
  stat.textContent = `${results.length} result${results.length !== 1 ? 's' : ''}`;
  if (meta) {
    meta.textContent = (docsSearched != null && timeMs != null)
      ? `${docsSearched} pages · ${Math.round(timeMs)}ms`
      : (docsSearched != null ? `${docsSearched} pages searched` : '');
  }

  if (!results.length) {
    list.innerHTML = `<div class="results-offline">
      <div class="results-offline-icon">∅</div>
      <div class="results-offline-text">No results for "${esc(query)}"</div>
      <div class="results-offline-hint">Try different keywords or enable Max fuzzy</div>
    </div>`;
    return;
  }

  list.innerHTML = results.map(r => {
    const scoreRaw = typeof r.relevance_score === 'number' ? Math.round(r.relevance_score) : (r.relevance_score || '');
    const score    = scoreRaw !== '' ? String(scoreRaw) : '';
    const snippet  = r.snippet ? (typeof r.snippet === 'object' ? r.snippet.text : r.snippet) : '';
    const trimmed  = snippet ? snippet.replace(/[ \t]+/g,' ').trim().slice(0, 400) : '';
    const isLocal = r.is_local;
    const href    = isLocal ? '#' : (r.url || '#');
    const filePath = isLocal ? localPathFromResult(r) : '';

    return `<div class="result-card ${isLocal ? 'local-result' : 'online-result'}"
         data-local="${isLocal?'1':'0'}"
         data-filepath="${esc(filePath)}"
         data-title="${esc(r.title||'')}"
         data-url="${esc(href)}"
         data-query="${esc(query)}"
         data-sourcename="${esc(r.source_name||'')}"
         onclick="handleResultClick(this)">
      <div class="result-card-head">
        <div class="result-title">${esc(r.title||r.page_name||'Untitled')}</div>
      </div>
      <div class="search-meta-row">
        ${score !== '' ? `<span class="result-score"><span class="result-score-label">score</span>${score}</span>` : ''}
        ${r.match_type ? `<span class="result-badge match">${esc(r.match_type)}</span>` : ''}
      </div>
      <div class="result-meta">
        <span class="result-source">
          <span class="result-source-label">source</span>
          <span class="result-source-name">${esc(r.source_name||'')}</span>
        </span>
        <span class="result-kind ${isLocal ? 'local' : 'online'}"><span class="result-kind-dot"></span>${isLocal ? 'local' : 'online'}</span>
      </div>
      ${trimmed ? `<div class="result-snippet">${highlightSnippet(trimmed, query)}</div>` : ''}
    </div>`;
  }).join('');
}

function handleResultClick(el) {
  if (el.dataset.local === '1') {
    openPreviewByPath(el.dataset.title, el.dataset.filepath, el.dataset.query || '', el.dataset.sourceid || '', el.dataset.sourcename || '');
  } else {
    window.open(el.dataset.url, '_blank', 'noopener');
  }
}
