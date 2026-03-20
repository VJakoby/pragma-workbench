'use strict';

function registerSearchProxyRoutes(app, { searchUrl }) {
  async function fetchWithTimeout(url, opts = {}) {
    if (typeof fetch !== 'undefined') {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const r = await fetch(url, { ...opts, signal: controller.signal });
        clearTimeout(timer);
        const text = await r.text();
        return {
          ok: r.ok,
          status: r.status,
          json: async () => { try { return JSON.parse(text); } catch { return {}; } },
        };
      } catch (e) {
        clearTimeout(timer);
        throw e;
      }
    }

    return new Promise((resolve, reject) => {
      const http = require('http');
      const u = new URL(url);
      const body = opts.body || null;
      const req2 = http.request({
        hostname: u.hostname,
        port: parseInt(u.port, 10) || 3002,
        path: u.pathname + (u.search || ''),
        method: opts.method || 'GET',
        timeout: 5000,
        headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      }, (res2) => {
        let data = '';
        res2.on('data', c => { data += c; });
        res2.on('end', () => resolve({
          ok: res2.statusCode < 400,
          status: res2.statusCode,
          json: async () => { try { return JSON.parse(data); } catch { return {}; } },
        }));
      });
      req2.on('error', reject);
      req2.on('timeout', () => { req2.destroy(); reject(new Error('ENGRAM request timed out')); });
      if (body) req2.write(body);
      req2.end();
    });
  }

  app.post('/api/search-proxy', async (req, res) => {
    const { query = '', fuzzyMode = 'normal' } = req.body;
    if (!query.trim()) return res.json({ results: [], query });
    try {
      let responseData;
      if (typeof fetch !== 'undefined') {
        const r = await fetch(`${searchUrl}/api/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, fuzzy: fuzzyMode !== 'off', fuzzy_prefer: fuzzyMode === 'prefer' }),
          signal: AbortSignal.timeout(4000),
        });
        responseData = await r.json();
      } else {
        responseData = await new Promise((resolve, reject) => {
          const http = require('http');
          const url = new URL(`${searchUrl}/api/search`);
          const body = JSON.stringify({ query, fuzzy: fuzzyMode !== 'off', fuzzy_prefer: fuzzyMode === 'prefer' });
          const opts = {
            hostname: url.hostname, port: url.port || 3002, path: url.pathname,
            method: 'POST', timeout: 4000,
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
          };
          const req2 = http.request(opts, (res2) => {
            let data = '';
            res2.on('data', chunk => { data += chunk; });
            res2.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Bad JSON')); } });
          });
          req2.on('error', reject);
          req2.on('timeout', () => { req2.destroy(); reject(new Error('Timeout')); });
          req2.write(body);
          req2.end();
        });
      }
      const results = (responseData.results || []).slice(0, 15).map(r => ({
        title: r.title, source_name: r.source_name, url: r.url,
        relevance_score: r.relevance_score, match_type: r.match_type,
        snippet: r.snippet, is_local: r.is_local, file_path: r.file_path,
        source_id: r.source_id || r.id || null,
      }));
      res.json({
        results, query,
        total: responseData.total_matches || results.length,
        docs_searched: responseData.docs_searched || responseData.total_searched || null,
        search_time_ms: responseData.search_time_ms || responseData.elapsed_ms || null,
      });
    } catch (err) {
      console.warn(`[PRAGMA] Search proxy error: ${err.message}`);
      res.json({ results: [], query, offline: true, error: err.message });
    }
  });

  app.get('/api/search-ping', async (req, res) => {
    try {
      const r = await fetch(`${searchUrl}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test', fuzzy: false }),
        signal: AbortSignal.timeout(3000),
      });
      res.json({ reachable: true, search_url: searchUrl, sample: await r.json() });
    } catch (err) {
      res.json({ reachable: false, search_url: searchUrl, error: err.message });
    }
  });

  app.get('/api/search-sources', async (req, res) => {
    try {
      const r = await fetchWithTimeout(`${searchUrl}/api/sources`);
      const d = await r.json();
      if (!r.ok) return res.status(r.status || 502).json({ error: d.error || 'ENGRAM sources failed' });
      res.json({ sources: d.sources || [], total: d.total || (d.sources || []).length });
    } catch (err) {
      console.warn(`[PRAGMA] search-sources error: ${err.message}`);
      res.status(502).json({ error: 'ENGRAM unreachable', detail: err.message });
    }
  });

  app.post('/api/content-proxy', async (req, res) => {
    const { file_path, source_name } = req.body || {};
    if (!file_path && !source_name)
      return res.status(400).json({ error: 'file_path or source_name required' });

    try {
      if (file_path) {
        const previewUrl = `${searchUrl}/api/preview?file=${encodeURIComponent(file_path)}`;
        const r = await fetchWithTimeout(previewUrl);
        const d = await r.json();
        if (r.ok && (d.html || d.raw)) {
          return res.json({ html: d.html || null, raw: d.raw || null, via: 'engram-preview' });
        }
        const errBody = d || {};
        console.warn(`[PRAGMA] ENGRAM /api/preview returned ${r.status}: ${errBody.error || '?'} for file: ${file_path}`);
      }

      res.status(404).json({
        error: 'Content not available',
        detail: file_path
          ? 'ENGRAM could not serve this file — it may not be in the index or has moved'
          : 'No file_path provided (online results open in browser)',
      });
    } catch (err) {
      console.warn(`[PRAGMA] content-proxy error: ${err.message}`);
      res.status(502).json({ error: 'ENGRAM unreachable', detail: err.message });
    }
  });
}

module.exports = { registerSearchProxyRoutes };
