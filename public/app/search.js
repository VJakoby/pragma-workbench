// ═══════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════
function onSearch(val) {
  clearTimeout(searchDebounce);
  if (val.trim().length < 2) {
    document.getElementById('resultsList').innerHTML = `<div class="results-offline">
      <div class="results-offline-icon"><svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
      <div class="results-offline-text">Start typing to search</div>
      <div class="results-offline-hint">Searches the full indexed knowledge base</div>
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
    if (!d.sources || !d.sources.length) return;
    knownSources = d.sources.map(s => ({ id: s.id, name: s.name }));
    renderSourceChips();
  } catch(e) {
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
      onclick="toggleSourceFilter('${esc(s.id)}')"
      title="${active ? 'Disable' : 'Enable'} source: ${esc(s.name)}"
    >${esc(s.name)}</button>`;
  }).join('');
}

function toggleSourceFilter(sourceId) {
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

function renderResults(query, results, offline, docsSearched, timeMs) {
  const list = document.getElementById('resultsList');
  const stat = document.getElementById('searchStatus');
  const meta = document.getElementById('searchMeta');

  if (meta) meta.textContent = '';
  if (offline) {
    stat.textContent = '⚠ offline';
    list.innerHTML = `<div class="results-offline error">
      <div class="results-offline-icon">⚠</div>
      <div class="results-offline-text">Search indexer not reachable</div>
      <div class="results-offline-hint">Check console · <a href="/api/search-ping" target="_blank" style="color:var(--accent)">ping indexer</a></div>
    </div>`;
    return;
  }

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

    return `<div class="result-card${isLocal?' local-result':''}"
         data-local="${isLocal?'1':'0'}"
         data-filepath="${esc(r.file_path||'')}"
         data-title="${esc(r.title||'')}"
         data-url="${esc(href)}"
         data-query="${esc(query)}"
         data-sourcename="${esc(r.source_name||'')}"
         onclick="handleResultClick(this)">
      <div class="result-title">${esc(r.title||r.page_name||'Untitled')}</div>
      <div class="search-meta-row">
        ${score !== '' ? `<span class="result-score"><span class="result-score-label">score</span>${score}</span>` : ''}
        ${r.match_type ? `<span class="result-badge match">${esc(r.match_type)}</span>` : ''}
        ${isLocal ? `<span class="result-badge local">local</span>` : `<span class="result-badge online">online</span>`}
      </div>
      <div class="result-meta">
        <span class="result-source">${esc(r.source_name||'')}</span>
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
