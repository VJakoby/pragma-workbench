/**
 * PRAGMA
 * Copyright (C) 2026 VJakoby
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * PRAGMA is architected by VJakoby + 🤖. This program is distributed in 
 * the hope that it will be useful, but WITHOUT ANY WARRANTY; without even 
 * the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const Fuse = require('fuse.js');

let chokidar;
try { chokidar = require('chokidar'); } catch (_) { }

const PORT     = process.env.PORT || 3000;
const KB_DIR   = process.env.KB_DIR || path.join(__dirname, 'knowledge_base');
const METH_DIR = process.env.METH_DIR || path.join(KB_DIR, 'methodologies');
const PUBLIC_DIR    = path.join(__dirname, 'public');
const DASHBOARD_HTML = path.join(PUBLIC_DIR, 'app.html');

const NOTES_DIR     = path.join(__dirname, 'sessions');
const SESSIONS_DIR  = path.join(__dirname, 'sessions');

// ── Active workbench — defaults to "default", switchable at runtime ──
let activeWorkbenchName = 'pragma';
function workbenchFile()    { return path.join(NOTES_DIR, `${activeWorkbenchName}.workbench`); }
function workbenchEncFile() { return path.join(NOTES_DIR, `${activeWorkbenchName}.workbench.enc`); }

// Keep legacy constants pointing at active workbench for existing code paths
Object.defineProperty(global, 'NOTES_FILE',     { get: workbenchFile,    configurable: true });
Object.defineProperty(global, 'NOTES_ENC_FILE', { get: workbenchEncFile, configurable: true });

// ── Port / slug metadata maps (unchanged) ──
const PORT_MAP = {
  '21': { name: 'FTP', port: '21/tcp', category: 'File Transfer', icon: '📤' },
  '22': { name: 'SSH', port: '22/tcp', category: 'Remote Access', icon: '🔒' },
  '23': { name: 'Telnet', port: '23/tcp', category: 'Remote Access', icon: '📺' },
  '25': { name: 'SMTP', port: '25/tcp', category: 'Mail', icon: '✉️' },
  '53': { name: 'DNS', port: '53/udp+tcp', category: 'Network', icon: '🗺️' },
  '80': { name: 'HTTP', port: '80/tcp', category: 'Web', icon: '🌐' },
  '88': { name: 'Kerberos', port: '88/tcp', category: 'Directory', icon: '🐕' },
  '110': { name: 'POP3', port: '110/tcp', category: 'Mail', icon: '📬' },
  '111': { name: 'RPC', port: '111/tcp', category: 'Network', icon: '🔌' },
  '135': { name: 'MSRPC', port: '135/tcp', category: 'Windows', icon: '🪟' },
  '139': { name: 'NetBIOS', port: '139/tcp', category: 'File Sharing', icon: '🖧' },
  '143': { name: 'IMAP', port: '143/tcp', category: 'Mail', icon: '📥' },
  '161': { name: 'SNMP', port: '161/udp', category: 'Network', icon: '📡' },
  '389': { name: 'LDAP', port: '389/tcp', category: 'Directory', icon: '🗂️' },
  '443': { name: 'HTTPS', port: '443/tcp', category: 'Web', icon: '🔐' },
  '445': { name: 'SMB', port: '445/tcp', category: 'File Sharing', icon: '📂' },
  '636': { name: 'LDAPS', port: '636/tcp', category: 'Directory', icon: '🗂️' },
  '873': { name: 'rsync', port: '873/tcp', category: 'File Transfer', icon: '🔄' },
  '1433': { name: 'MSSQL', port: '1433/tcp', category: 'Database', icon: '🗃️' },
  '1521': { name: 'Oracle DB', port: '1521/tcp', category: 'Database', icon: '🛢️' },
  '2049': { name: 'NFS', port: '2049/tcp', category: 'File Sharing', icon: '📁' },
  '2375': { name: 'Docker', port: '2375/tcp', category: 'Container', icon: '🐳' },
  '3306': { name: 'MySQL', port: '3306/tcp', category: 'Database', icon: '🛢️' },
  '3389': { name: 'RDP', port: '3389/tcp', category: 'Remote Access', icon: '🖥️' },
  '5432': { name: 'PostgreSQL', port: '5432/tcp', category: 'Database', icon: '🐘' },
  '5900': { name: 'VNC', port: '5900/tcp', category: 'Remote Access', icon: '👁️' },
  '5985': { name: 'WinRM', port: '5985/tcp', category: 'Remote Access', icon: '⚡' },
  '6379': { name: 'Redis', port: '6379/tcp', category: 'Database', icon: '⚙️' },
  '8080': { name: 'HTTP-alt', port: '8080/tcp', category: 'Web', icon: '🌐' },
  '8443': { name: 'HTTPS-alt', port: '8443/tcp', category: 'Web', icon: '🔐' },
  '9200': { name: 'Elasticsearch', port: '9200/tcp', category: 'Database', icon: '🔍' },
  '27017': { name: 'MongoDB', port: '27017/tcp', category: 'Database', icon: '🍃' },
};

const SLUG_MAP = {
  'ssh': { name: 'SSH', port: '22/tcp', category: 'Remote Access', icon: '🔒' },
  'ftp': { name: 'FTP', port: '21/tcp', category: 'File Transfer', icon: '📤' },
  'http': { name: 'HTTP', port: '80/tcp', category: 'Web', icon: '🌐' },
  'https': { name: 'HTTPS', port: '443/tcp', category: 'Web', icon: '🔐' },
  'smb': { name: 'SMB', port: '445/tcp', category: 'File Sharing', icon: '📂' },
  'rdp': { name: 'RDP', port: '3389/tcp', category: 'Remote Access', icon: '🖥️' },
  'dns': { name: 'DNS', port: '53/udp', category: 'Network', icon: '🗺️' },
  'ldap': { name: 'LDAP', port: '389/tcp', category: 'Directory', icon: '🗂️' },
  'mysql': { name: 'MySQL', port: '3306/tcp', category: 'Database', icon: '🛢️' },
  'mssql': { name: 'MSSQL', port: '1433/tcp', category: 'Database', icon: '🗃️' },
  'postgres': { name: 'PostgreSQL', port: '5432/tcp', category: 'Database', icon: '🐘' },
  'postgresql': { name: 'PostgreSQL', port: '5432/tcp', category: 'Database', icon: '🐘' },
  'redis': { name: 'Redis', port: '6379/tcp', category: 'Database', icon: '⚙️' },
  'mongodb': { name: 'MongoDB', port: '27017/tcp', category: 'Database', icon: '🍃' },
  'smtp': { name: 'SMTP', port: '25/tcp', category: 'Mail', icon: '✉️' },
  'imap': { name: 'IMAP', port: '143/tcp', category: 'Mail', icon: '📥' },
  'snmp': { name: 'SNMP', port: '161/udp', category: 'Network', icon: '📡' },
  'nfs': { name: 'NFS', port: '2049/tcp', category: 'File Sharing', icon: '📁' },
  'kerberos': { name: 'Kerberos', port: '88/tcp', category: 'Directory', icon: '🐕' },
  'winrm': { name: 'WinRM', port: '5985/tcp', category: 'Remote Access', icon: '⚡' },
  'docker': { name: 'Docker', port: '2375/tcp', category: 'Container', icon: '🐳' },
  'vnc': { name: 'VNC', port: '5900/tcp', category: 'Remote Access', icon: '👁️' },
  'rsync': { name: 'rsync', port: '873/tcp', category: 'File Transfer', icon: '🔄' },
  'linux_privesc': { name: 'Linux PrivEsc', port: 'Local', category: 'Privilege Escalation', icon: '🐧' },
  'windows_privesc': { name: 'Windows PrivEsc', port: 'Local', category: 'Privilege Escalation', icon: '🪟' },
  'sqli': { name: 'SQL Injection', port: 'Web', category: 'Web', icon: '💉' },
  'xss': { name: 'XSS', port: 'Web', category: 'Web', icon: '🖊️' },
  'csrf': { name: 'CSRF', port: 'Web', category: 'Web', icon: '🎭' },
  'ssrf': { name: 'SSRF', port: 'Web', category: 'Web', icon: '🔁' },
  'xxe': { name: 'XXE', port: 'Web', category: 'Web', icon: '📎' },
  'lfi': { name: 'LFI/RFI', port: 'Web', category: 'Web', icon: '📂' },
  'lateral': { name: 'Lateral Movement', port: 'Post-Ex', category: 'Post Exploitation', icon: '↔️' },
  'pivoting': { name: 'Pivoting', port: 'Post-Ex', category: 'Post Exploitation', icon: '🌀' },
};

function slugify(str) {
  return (str || 'export').replace(/[^a-zA-Z0-9_.-]/g, '_').toLowerCase().slice(0, 60);
}

function metaFromFilename(filename) {
  const base = path.basename(filename, '.md').toLowerCase();
  if (/^\d+$/.test(base) && PORT_MAP[base]) return { ...PORT_MAP[base], id: base };
  if (SLUG_MAP[base]) return { ...SLUG_MAP[base], id: base };
  const name = base.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return { id: base, name, port: '—', category: 'Other', icon: '📄' };
}

function extractDescription(content) {
  const lines = content.split('\n');
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('```') || t.startsWith('|')) continue;
    const clean = t.replace(/[*_`\[\]()]/g, '').replace(/\s+/g, ' ').trim();
    if (clean.length > 20) return clean.slice(0, 120) + (clean.length > 120 ? '…' : '');
  }
  return 'No description available.';
}

function noteFilename(note) {
  const slug = (note.title || '')
    .replace(/[^a-zA-Z0-9 _-]/g, '').trim()
    .replace(/\s+/g, '-').toLowerCase().slice(0, 60);
  return slug ? `${slug}.md` : `${note.type}.md`;
}

// ── Service index ──
let serviceIndex = [];
let searchIndex  = null;

function walkMdFiles(dir, rootDir) {
  let results = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return results; }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walkMdFiles(fullPath, rootDir));
    } else if (entry.name.toLowerCase().endsWith('.md')) {
      const rel    = path.relative(rootDir, dir);
      const subdir = rel ? rel.split(path.sep)[0] : '';
      results.push({ filename: entry.name, filepath: fullPath, subdir });
    }
  }
  return results;
}

function buildIndex() {
  if (!fs.existsSync(KB_DIR)) {
    console.warn(`[PRAGMA] knowledge_base/ not found at ${KB_DIR}. Creating empty dir.`);
    fs.mkdirSync(KB_DIR, { recursive: true });
    serviceIndex = []; searchIndex = null; return;
  }
  const entries = walkMdFiles(KB_DIR, KB_DIR);
  serviceIndex = entries.map(({ filename, filepath, subdir }) => {
    const content  = fs.readFileSync(filepath, 'utf8');
    const meta     = metaFromFilename(filename);
    const category = subdir
      ? subdir.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : meta.category;
    return {
      id: meta.id, name: meta.name, port: meta.port, category,
      icon: meta.icon, description: extractDescription(content),
      file: filename, filepath, content, wordCount: content.split(/\s+/).length,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  searchIndex = new Fuse(serviceIndex, {
    includeScore: true, threshold: 0.4, ignoreLocation: true,
    keys: [
      { name: 'name', weight: 3 }, { name: 'port', weight: 2 },
      { name: 'category', weight: 1.5 }, { name: 'description', weight: 1 },
      { name: 'content', weight: 0.5 },
    ],
  });
  console.log(`[PRAGMA] Indexed ${serviceIndex.length} service(s) from ${KB_DIR}`);
}

// ── Methodology index ──
let methodologyIndex = [];

function extractTitle(content, filename) {
  const match = content.match(/^#\s+(.+)$/m);
  if (match) return match[1].trim();
  return path.basename(filename, '.md').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function extractCategory(content, filename) {
  const match = content.match(/<!--\s*category:\s*(.+?)\s*-->/i);
  if (match) return match[1].trim();
  const slug = path.basename(filename, '.md').toLowerCase();
  if (/active.?directory|ad\b|kerberos|ldap/.test(slug)) return 'Active Directory';
  if (/linux|privesc/.test(slug)) return 'Linux';
  if (/windows/.test(slug)) return 'Windows';
  if (/web|http|burp|owasp/.test(slug)) return 'Web';
  if (/network|pivot|tunnel/.test(slug)) return 'Network';
  if (/mobile|android|ios/.test(slug)) return 'Mobile';
  if (/cloud|aws|azure|gcp/.test(slug)) return 'Cloud';
  if (/crypto|cipher/.test(slug)) return 'Cryptography';
  if (/recon|osint/.test(slug)) return 'Recon';
  if (/forensic|dfir/.test(slug)) return 'Forensics';
  return 'General';
}

const METH_ICONS = {
  'Active Directory': '🏰', 'Linux': '🐧', 'Windows': '🪟', 'Web': '🌐',
  'Network': '📡', 'Mobile': '📱', 'Cloud': '☁️', 'Cryptography': '🔑',
  'Recon': '🔭', 'Forensics': '🔬', 'General': '📋',
};

function buildMethodologyIndex() {
  if (!fs.existsSync(METH_DIR)) {
    methodologyIndex = [];
    console.log('[PRAGMA] knowledge_base/methodologies/ not found — skipping.');
    return;
  }
  const files = fs.readdirSync(METH_DIR).filter(f => f.toLowerCase().endsWith('.md'));
  methodologyIndex = files.map(filename => {
    const filepath = path.join(METH_DIR, filename);
    const content  = fs.readFileSync(filepath, 'utf8');
    const id       = path.basename(filename, '.md').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const name     = extractTitle(content, filename);
    const category = extractCategory(content, filename);
    return {
      id, name, category, icon: METH_ICONS[category] || '📋',
      description: extractDescription(content),
      file: filename, filepath, content, wordCount: content.split(/\s+/).length,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
  console.log(`[PRAGMA] Indexed ${methodologyIndex.length} methodology guide(s)`);
}

marked.setOptions({ gfm: true, breaks: false });

const app = express();
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

app.get('/', (req, res) => {
  if (fs.existsSync(DASHBOARD_HTML)) res.sendFile(DASHBOARD_HTML);
  else res.status(404).send('public/app.html not found');
});

app.get('/api/services', (req, res) => {
  res.json({
    total: serviceIndex.length,
    services: serviceIndex.map(({ id, name, port, category, icon, description, file, wordCount }) =>
      ({ id, name, port, category, icon, description, file, wordCount })),
  });
});

app.get('/api/sources', (req, res) => {
  res.json({
    total: serviceIndex.length,
    sources: serviceIndex.map(svc => ({
      id: svc.id, name: svc.name, type: 'local',
      description: svc.description, page_count: 1,
    })),
  });
});

app.get('/api/cache-status', (req, res) => res.json({ sources: [] }));

app.get('/api/preview', (req, res) => {
  const fileParam = req.query.file;
  if (!fileParam) return res.status(400).json({ error: 'Missing ?file= parameter' });
  let resolved;
  if (path.isAbsolute(fileParam)) { resolved = fileParam; }
  else {
    resolved = path.resolve(KB_DIR, path.basename(fileParam));
    if (!resolved.startsWith(KB_DIR)) return res.status(403).json({ error: 'Access denied' });
  }
  if (!fs.existsSync(resolved)) return res.status(404).json({ error: `File not found: ${resolved}` });
  try {
    const content = fs.readFileSync(resolved, 'utf8');
    res.json({ html: marked.parse(content), raw: content });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/search', (req, res) => {
  const { query = '', fuzzyMode = 'normal' } = req.body;
  const q = query.trim();
  const startTime = Date.now();
  if (!q) return res.json({ count: 0, results: [], total_searched: serviceIndex.length, search_time_ms: 0 });
  let results = [];
  if (fuzzyMode === 'off') {
    const ql = q.toLowerCase();
    results = serviceIndex
      .filter(svc => svc.name.toLowerCase().includes(ql) || svc.port.toLowerCase().includes(ql) ||
        svc.category.toLowerCase().includes(ql) || svc.description.toLowerCase().includes(ql) ||
        svc.content.toLowerCase().includes(ql))
      .map(svc => ({ svc, score: 0.1 }));
  } else {
    if (!searchIndex) return res.json({ error: 'Index not ready.' });
    searchIndex.options.threshold = fuzzyMode === 'prefer' ? 0.6 : 0.4;
    results = searchIndex.search(q).map(r => ({ svc: r.item, score: r.score }));
  }
  res.json({
    count: results.length,
    results: results.map(({ svc, score }) => ({
      id: svc.id, title: svc.name, page_name: svc.file,
      source_name: `knowledge_base/${svc.file}`, source_id: svc.id,
      url: `file://${svc.filepath}`, file_path: svc.filepath,
      is_local: true, relevance_score: Math.round((1 - score) * 100),
      match_type: score < 0.05 ? 'exact_title' : score < 0.2 ? 'title_contains' : 'content',
      snippet: { text: svc.description }, category: svc.category, icon: svc.icon, port: svc.port,
    })),
    total_searched: serviceIndex.length,
    search_time_ms: Date.now() - startTime,
  });
});

app.get('/api/service/:id', (req, res) => {
  const svc = serviceIndex.find(s => s.id === req.params.id);
  if (!svc) return res.status(404).json({ error: 'Service not found' });
  res.json({
    id: svc.id, name: svc.name, port: svc.port, category: svc.category,
    icon: svc.icon, description: svc.description, file: svc.file,
    wordCount: svc.wordCount, html: marked.parse(svc.content), raw: svc.content,
  });
});

app.get('/api/methodologies', (req, res) => {
  res.json({
    total: methodologyIndex.length,
    guides: methodologyIndex.map(({ id, name, category, icon, description, file, wordCount }) =>
      ({ id, name, category, icon, description, file, wordCount })),
  });
});

app.get('/api/methodology/:id', (req, res) => {
  const guide = methodologyIndex.find(g => g.id === req.params.id);
  if (!guide) return res.status(404).json({ error: 'Methodology not found' });
  res.json({
    id: guide.id, name: guide.name, category: guide.category, icon: guide.icon,
    description: guide.description, file: guide.file, wordCount: guide.wordCount,
    html: marked.parse(guide.content), raw: guide.content,
  });
});

app.post('/api/kb/save', (req, res) => {
  try {
    const { id, view, content } = req.body;
    if (!id || !view || typeof content !== 'string')
      return res.status(400).json({ error: 'id, view, and content are required' });
    const index = view === 'services' ? serviceIndex : methodologyIndex;
    const entry = index.find(e => e.id === id);
    if (!entry) return res.status(404).json({ error: 'File not found in index' });
    fs.writeFileSync(entry.filepath, content, 'utf8');
    entry.content = content;
    console.log(`[PRAGMA] Saved edit: ${entry.filepath}`);
    res.json({ ok: true, file: entry.file });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Search proxy ──
const SEARCH_URL = process.env.SEARCH_URL || 'http://localhost:3002';

app.post('/api/search-proxy', async (req, res) => {
  const { query = '', fuzzyMode = 'normal' } = req.body;
  if (!query.trim()) return res.json({ results: [], query });
  try {
    let responseData;
    if (typeof fetch !== 'undefined') {
      const r = await fetch(`${SEARCH_URL}/api/search`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, fuzzy: fuzzyMode !== 'off', fuzzy_prefer: fuzzyMode === 'prefer' }),
        signal: AbortSignal.timeout(4000),
      });
      responseData = await r.json();
    } else {
      responseData = await new Promise((resolve, reject) => {
        const http = require('http');
        const url  = new URL(`${SEARCH_URL}/api/search`);
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
        req2.write(body); req2.end();
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
    const r = await fetch(`${SEARCH_URL}/api/search`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test', fuzzy: false }), signal: AbortSignal.timeout(3000),
    });
    res.json({ reachable: true, search_url: SEARCH_URL, sample: await r.json() });
  } catch (err) {
    res.json({ reachable: false, search_url: SEARCH_URL, error: err.message });
  }
});

// Proxy ENGRAM's source list so the client can build source filter chips
app.get('/api/search-sources', async (req, res) => {
  try {
    const r = await fetch(`${SEARCH_URL}/api/sources`, { signal: AbortSignal.timeout(3000) });
    const d = await r.json();
    res.json(d);
  } catch (err) {
    res.json({ sources: [], total: 0, offline: true, error: err.message });
  }
});


// ── Content proxy — delegates local file preview to ENGRAM ──
// ENGRAM knows where its files live (it indexed them). PRAGMA just proxies
// the request to ENGRAM's /api/preview?file=<path>, which validates the path
// against its own index and returns { html, raw, title, page_name }.
// This works regardless of whether PRAGMA and ENGRAM share a filesystem.
app.post('/api/content-proxy', async (req, res) => {
  const { file_path, source_id, source_name } = req.body || {};

  if (!file_path && !source_id && !source_name) {
    return res.status(400).json({ error: 'file_path, source_id, or source_name required' });
  }

  try {
    // Strategy 1: Use ENGRAM's /api/preview with the exact file_path from the search result.
    // ENGRAM validates that the path exists in its index before reading it — safe by design.
    if (file_path) {
      const url = `${SEARCH_URL}/api/preview?file=${encodeURIComponent(file_path)}`;
      const r = await fetchWithTimeout(url);
      if (r.ok) {
        const d = await r.json();
        if (d.html) {
          const html = d.html || (d.raw ? marked.parse(d.raw) : null);
          if (html) return res.json({ ok: true, html, raw: d.raw || '' });
        }
      }
      const errBody = await r.json().catch(() => ({}));
      console.warn(`[PRAGMA] ENGRAM /api/preview returned ${r.status}: ${errBody.error || '?'} for file: ${file_path}`);
    }

    // Strategy 2: No file_path (online result with source_name only) — nothing to proxy.
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
  // Older Node fallback via http module
  return new Promise((resolve, reject) => {
    const http = require('http');
    const u    = new URL(url);
    const body = opts.body || null;
    const req2 = http.request({
      hostname: u.hostname,
      port:     parseInt(u.port) || 3002,
      path:     u.pathname + (u.search || ''),
      method:   opts.method || 'GET',
      timeout:  5000,
      headers:  { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    }, (res2) => {
      let data = '';
      res2.on('data', c => { data += c; });
      res2.on('end', () => resolve({
        ok:     res2.statusCode < 400,
        status: res2.statusCode,
        json:   async () => { try { return JSON.parse(data); } catch { return {}; } },
      }));
    });
    req2.on('error', reject);
    req2.on('timeout', () => { req2.destroy(); reject(new Error('ENGRAM request timed out')); });
    if (body) req2.write(body);
    req2.end();
  });
}

// ── Notes persistence ──
function loadNotesFile() {
  if (!fs.existsSync(NOTES_FILE)) return { sessions: {}, notes: {} };
  try {
    const raw = JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8'));
    if (!raw.sessions && !raw.notes) return { sessions: {}, notes: raw };
    return { sessions: raw.sessions || {}, notes: raw.notes || {} };
  } catch { return { sessions: {}, notes: {} }; }
}

app.get('/api/notes', (req, res) => {
  try {
    // Encrypted only if enc file exists AND no plain file (plain = explicitly decrypted/disabled)
    if (fs.existsSync(NOTES_ENC_FILE) && !fs.existsSync(NOTES_FILE))
      return res.json({ encrypted_storage: true });
    res.json(loadNotesFile());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/notes/save', (req, res) => {
  try {
    if (fs.existsSync(NOTES_ENC_FILE) && !fs.existsSync(NOTES_FILE))
      return res.status(423).json({ error: 'Encrypted storage active. Use /api/notes/save-encrypted.' });
    const { sessions = {}, notes = {} } = req.body;
    fs.mkdirSync(NOTES_DIR, { recursive: true });
    fs.writeFileSync(NOTES_FILE, JSON.stringify({ sessions, notes }, null, 2), 'utf8');
    // Remove stale enc file if plain file now exists — they should never coexist
    if (fs.existsSync(NOTES_ENC_FILE)) { try { fs.unlinkSync(NOTES_ENC_FILE); } catch (_) {} }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/notes/storage-info', (req, res) => {
  const encExists   = fs.existsSync(NOTES_ENC_FILE);
  const plainExists = fs.existsSync(NOTES_FILE);
  res.json({
    encrypted_storage: encExists && !plainExists,
    plain_storage:     plainExists,
    notes_dir:         NOTES_DIR,
    sessions_dir:      SESSIONS_DIR,
  });
});

app.get('/api/notes/encrypted', (req, res) => {
  try {
    if (!fs.existsSync(NOTES_ENC_FILE)) return res.status(404).json({ error: 'Encrypted notes file not found' });
    res.json(JSON.parse(fs.readFileSync(NOTES_ENC_FILE, 'utf8')));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/notes/save-encrypted', (req, res) => {
  try {
    const { blob } = req.body || {};
    if (!blob || blob.encrypted !== true || !blob.salt || !blob.iv || !blob.data)
      return res.status(400).json({ error: 'Invalid encrypted payload' });
    fs.mkdirSync(NOTES_DIR, { recursive: true });
    fs.writeFileSync(NOTES_ENC_FILE, JSON.stringify(blob, null, 2), 'utf8');
    if (fs.existsSync(NOTES_FILE)) { try { fs.unlinkSync(NOTES_FILE); } catch (_) { } }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/notes/storage/disable-encrypted', (req, res) => {
  try {
    // Require the caller to supply the decrypted plaintext payload.
    // This proves they actually hold the password — we won't delete the enc file
    // based on a bare unauthenticated POST (e.g. from a JS console call).
    const { sessions, notes } = req.body || {};
    if (sessions === undefined || notes === undefined)
      return res.status(403).json({ error: 'Decrypted payload required to disable encryption.' });

    // Validate payload is sane before touching disk
    if (typeof sessions !== 'object' || typeof notes !== 'object')
      return res.status(400).json({ error: 'Invalid payload structure.' });

    // Write plaintext file first, then remove enc file — never leave both or neither
    fs.mkdirSync(NOTES_DIR, { recursive: true });
    fs.writeFileSync(NOTES_FILE, JSON.stringify({ sessions, notes }, null, 2), 'utf8');
    if (fs.existsSync(NOTES_ENC_FILE)) { try { fs.unlinkSync(NOTES_ENC_FILE); } catch (_) {} }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Workbench management ──

// GET /api/workbenches — list all workbench names on disk
app.get('/api/workbenches', (req, res) => {
  try {
    fs.mkdirSync(NOTES_DIR, { recursive: true });
    const files = fs.readdirSync(NOTES_DIR);
    const names = new Set();
    names.add('default'); // always include default even if file doesn't exist yet
    files.forEach(f => {
      const m = f.match(/^(.+)\.workbench(\.enc)?$/);
      if (m) names.add(m[1]);
    });
    const sorted = [...names].sort((a, b) => a === 'default' ? -1 : b === 'default' ? 1 : a.localeCompare(b));
    res.json({
      workbenches: sorted,
      encrypted: Object.fromEntries(sorted.map(n => {
        const encFile   = path.join(NOTES_DIR, `${n}.workbench.enc`);
        const plainFile = path.join(NOTES_DIR, `${n}.workbench`);
        return [n, fs.existsSync(encFile) && !fs.existsSync(plainFile)];
      })),
      active: activeWorkbenchName,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/workbench/switch — switch active workbench
app.post('/api/workbench/switch', (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name required' });
    const safe = name.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 64);
    if (!safe) return res.status(400).json({ error: 'Invalid workbench name' });
    activeWorkbenchName = safe;
    const encrypted = fs.existsSync(workbenchEncFile()) && !fs.existsSync(workbenchFile());
    res.json({
      ok: true,
      active: activeWorkbenchName,
      encrypted_storage: encrypted,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/workbench/create — create a new named workbench (empty)
app.post('/api/workbench/create', (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name required' });
    const safe = name.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 64);
    if (!safe) return res.status(400).json({ error: 'Invalid workbench name' });
    const file = path.join(NOTES_DIR, `${safe}.workbench`);
    const enc  = path.join(NOTES_DIR, `${safe}.workbench.enc`);
    if (fs.existsSync(file) || fs.existsSync(enc))
      return res.status(409).json({ error: `Workbench "${safe}" already exists` });
    fs.mkdirSync(NOTES_DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ sessions: {}, notes: {} }, null, 2), 'utf8');
    activeWorkbenchName = safe;
    res.json({ ok: true, active: activeWorkbenchName });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/workbench/delete — delete a workbench (not allowed for active or default)
app.post('/api/workbench/delete', (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    if (name === 'default') return res.status(403).json({ error: 'Cannot delete the default workbench' });
    if (name === activeWorkbenchName) return res.status(409).json({ error: 'Cannot delete the active workbench. Switch first.' });
    const file = path.join(NOTES_DIR, `${name}.workbench`);
    const enc  = path.join(NOTES_DIR, `${name}.workbench.enc`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    if (fs.existsSync(enc))  fs.unlinkSync(enc);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// Writes per-target directory structure:
//   notes/<session-slug>/README.md
//   notes/<session-slug>/<target-ip>/README.md
//   notes/<session-slug>/<target-ip>/<note-title>.md
//   notes/<session-slug>/session/<note-title>.md  ← unassigned notes
app.post('/api/notes/export', (req, res) => {
  try {
    const { session_id, include_unassigned = true } = req.body;
    const source = fs.existsSync(NOTES_ENC_FILE)
      ? (req.body?.sessions && req.body?.notes ? { sessions: req.body.sessions, notes: req.body.notes } : null)
      : loadNotesFile();
    if (!source) return res.status(423).json({ error: 'Encrypted storage enabled. Client must provide sessions + notes.' });

    const { sessions, notes } = source;
    const session = sessions[session_id];
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const sessSlug = slugify(session.codename);
    const outDir   = path.join(NOTES_DIR, sessSlug);
    fs.mkdirSync(outDir, { recursive: true });

    const targets = session.targets || [];
    const sessionNotes = Object.values(notes).filter(n =>
      n.session_id === session_id ||
      (include_unassigned && (!n.session_id || !sessions[n.session_id]))
    );

    const allServices = session.services || [];
    const allPaths    = session.paths    || [];
    if (!sessionNotes.length && !allServices.length && !allPaths.length)
      return res.json({ ok: true, path: outDir, files: [], message: 'Nothing to export in this session.' });

    const written    = [];
    const byTarget   = {};
    const unassigned = [];

    sessionNotes.forEach(n => {
      if (n.target_id && targets.find(t => t.id === n.target_id)) {
        if (!byTarget[n.target_id]) byTarget[n.target_id] = [];
        byTarget[n.target_id].push(n);
      } else {
        unassigned.push(n);
      }
    });

    // ── Per-target directories ──
    targets.forEach(tgt => {
      const tNotes = byTarget[tgt.id] || [];
      const tgtServices = (session.services || []).filter(s => s.target_id === tgt.id);
      const tgtPaths    = (session.paths    || []).filter(p => p.target_id === tgt.id);
      if (!tNotes.length && !tgtServices.length && !tgtPaths.length) return;

      const dirName = slugify(tgt.ip || tgt.domain || tgt.label || tgt.id);
      const tgtDir  = path.join(outDir, dirName);
      fs.mkdirSync(tgtDir, { recursive: true });

      const label = [tgt.ip, tgt.domain, tgt.label].filter(Boolean).join(' · ');
      tgtServices.sort((a, b) => (parseInt(a.port)||0) - (parseInt(b.port)||0));
      tgtPaths.sort((a, b) => a.path < b.path ? -1 : 1);

      // Target README
      const tReadmeParts = [
        `# ${label}`,
        '',
        `**Session:** ${session.codename}`,
        `**Notes:** ${tNotes.length}`,
        `**Exported:** ${new Date().toISOString().replace('T',' ').slice(0,19)}`,
        '',
      ];

      if (tgtServices.length) {
        tReadmeParts.push('## Open Ports', '');
        tReadmeParts.push('| Port | Service | Version | Notes |');
        tReadmeParts.push('|------|---------|---------|-------|');
        tgtServices.forEach(s => {
          const port = s.proto && s.proto !== 'tcp' ? `${s.port}/${s.proto}` : s.port;
          tReadmeParts.push(`| ${port} | ${s.service||''} | ${s.version||''} | ${s.notes||''} |`);
        });
        tReadmeParts.push('');
      }

      if (tgtPaths.length) {
        tReadmeParts.push('## Paths', '');
        tReadmeParts.push('| Status | Path | Notes |');
        tReadmeParts.push('|--------|------|-------|');
        tgtPaths.forEach(p => {
          tReadmeParts.push(`| ${p.status||''} | ${p.path} | ${p.notes||''} |`);
        });
        tReadmeParts.push('');
      }

      tReadmeParts.push('## Notes', '');
      tReadmeParts.push(...tNotes
        .sort((a, b) => (a.created || 0) - (b.created || 0))
        .map(n => `- [${n.title || noteFilename(n).replace('.md','')}](./${noteFilename(n)}) — \`${n.type}\``));

      const tReadme = tReadmeParts.join('\n');
      fs.writeFileSync(path.join(tgtDir, 'README.md'), tReadme, 'utf8');
      written.push(`${dirName}/README.md`);

      // Individual note files
      tNotes.sort((a, b) => (a.created || 0) - (b.created || 0)).forEach(n => {
        const fname  = noteFilename(n);
        const ts     = new Date(n.updated || n.created || 0).toISOString().replace('T',' ').slice(0,19);
        const body   = [
          `# ${n.title || fname.replace('.md','')}`,
          '',
          `> **Type:** \`${n.type}\``,
          `> **Target:** \`${label}\``,
          `> **Session:** ${session.codename}`,
          `> **Created:** ${ts}`,
          '',
          '---',
          '',
          n.body || '',
        ].join('\n');
        fs.writeFileSync(path.join(tgtDir, fname), body, 'utf8');
        written.push(`${dirName}/${fname}`);
      });
    });

    // ── Session-wide / unassigned notes ──
    if (unassigned.length) {
      const sessDir = path.join(outDir, 'session');
      fs.mkdirSync(sessDir, { recursive: true });
      unassigned.sort((a, b) => (a.created || 0) - (b.created || 0)).forEach(n => {
        const fname = noteFilename(n);
        const ts    = new Date(n.updated || n.created || 0).toISOString().replace('T',' ').slice(0,19);
        const body  = [
          `# ${n.title || fname.replace('.md','')}`,
          '',
          `> **Type:** \`${n.type}\``,
          `> **Session:** ${session.codename}`,
          `> **Created:** ${ts}`,
          '',
          '---',
          '',
          n.body || '',
        ].join('\n');
        fs.writeFileSync(path.join(sessDir, fname), body, 'utf8');
        written.push(`session/${fname}`);
      });
    }

    // ── Top-level session README ──
    const index = [
      `# ${session.codename}`,
      '',
      `**Exported:** ${new Date().toISOString().replace('T',' ').slice(0,19)}`,
      `**Total notes:** ${sessionNotes.length}`,
      '',
      '## Targets',
      '',
      ...targets
        .filter(t => byTarget[t.id]?.length)
        .map(t => {
          const dir   = slugify(t.ip || t.domain || t.label || t.id);
          const label = [t.ip, t.domain, t.label].filter(Boolean).join(' · ');
          return `- [${label}](./${dir}/) — ${byTarget[t.id]?.length || 0} notes`;
        }),
      unassigned.length ? `- [Session-wide notes](./session/) — ${unassigned.length} notes` : null,
    ].filter(l => l !== null).join('\n');

    fs.writeFileSync(path.join(outDir, 'README.md'), index, 'utf8');
    written.unshift('README.md');

    // ── SUMMARY.md — chronological timeline of all notes ──
    const TYPE_ICONS = {
      general:     '📋', credentials: '🔑', privesc: '⬆',
      recon:       '🔭', loot:        '💰', exploit: '💥',
      scratch:     '📄',
    };

    const sorted = [...sessionNotes].sort((a, b) => (a.created || 0) - (b.created || 0));

    const byDay = {};
    sorted.forEach(n => {
      const d = new Date(n.created || 0);
      const dayKey = d.toLocaleDateString('en-GB', { weekday:'short', day:'2-digit', month:'short', year:'2-digit' });
      if (!byDay[dayKey]) byDay[dayKey] = [];
      byDay[dayKey].push(n);
    });

    const typeCount = {};
    sorted.forEach(n => { typeCount[n.type] = (typeCount[n.type] || 0) + 1; });

    const summaryLines = [
      `# ${session.codename} — Timeline Summary`,
      '',
      `**Exported:** ${new Date().toISOString().replace('T',' ').slice(0,19)}`,
      `**Total events:** ${sorted.length}`,
      `**Duration:** ${sorted.length > 1
        ? (() => {
            const ms  = (sorted[sorted.length-1].created||0) - (sorted[0].created||0);
            const hrs = Math.floor(ms / 3600000);
            const min = Math.floor((ms % 3600000) / 60000);
            return hrs > 0 ? `${hrs}h ${min}m` : `${min}m`;
          })()
        : '—'}`,
      '',
      '**Activity breakdown:**',
      ...Object.entries(typeCount).map(([type, count]) =>
        `- ${TYPE_ICONS[type] || '📄'} ${type.charAt(0).toUpperCase() + type.slice(1)}: ${count}`
      ),
      '',
      '---',
      '',
    ];

    Object.entries(byDay).forEach(([day, dayNotes]) => {
      summaryLines.push(`## ${day}`);
      summaryLines.push('');
      dayNotes.forEach(n => {
        const time   = new Date(n.created || 0).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
        const icon   = TYPE_ICONS[n.type] || '📄';
        const tgt    = n.target_id ? targets.find(t => t.id === n.target_id) : null;
        const tgtStr = tgt ? ` \`${tgt.ip || tgt.domain || tgt.label}\`` : '';
        const title  = n.title || `(${n.type})`;
        const preview = (n.body || '')
          .split('\n')
          .map(l => l.trim())
          .find(l => l && !l.startsWith('#') && !l.startsWith('---') && l.length > 3);
        const previewStr = preview ? `\n  > ${preview.slice(0, 120)}${preview.length > 120 ? '…' : ''}` : '';

        summaryLines.push(`**${time}** ${icon} **${title}**${tgtStr}${previewStr}`);
        summaryLines.push('');
      });
    });

    fs.writeFileSync(path.join(outDir, 'SUMMARY.md'), summaryLines.join('\n'), 'utf8');
    written.push('SUMMARY.md');

    console.log(`[PRAGMA] Exported ${written.length} files → ${outDir}`);
    res.json({ ok: true, path: outDir, files: written, session: session.codename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/notes/export-session ──
app.post('/api/notes/export-session', (req, res) => {
  try {
    const { session_id } = req.body;
    const source = fs.existsSync(NOTES_ENC_FILE)
      ? (req.body?.sessions && req.body?.notes ? { sessions: req.body.sessions, notes: req.body.notes } : null)
      : loadNotesFile();
    if (!source) return res.status(423).json({ error: 'Encrypted storage enabled. Client must provide sessions + notes.' });

    const { sessions, notes } = source;
    const session = sessions[session_id];
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const sessNotes = Object.values(notes).filter(n => n.session_id === session_id);
    const payload   = { pragma_version: 1, exported: Date.now(), session, notes: sessNotes };

    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    const slug     = slugify(session.codename);
    const filePath = path.join(SESSIONS_DIR, slug + '.session');
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');

    console.log(`[PRAGMA] Session exported: ${filePath}`);
    res.json({ ok: true, path: filePath, notes: sessNotes.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/notes/debug', (req, res) => {
  const { sessions, notes } = loadNotesFile();
  res.json({
    dirs: { notes: NOTES_DIR, sessions: SESSIONS_DIR },
    files: { workbench: NOTES_FILE, encrypted: NOTES_ENC_FILE },
    sessions: Object.values(sessions).map(s => ({
      id: s.id, codename: s.codename,
      targets: (s.targets || []).map(t => t.ip + (t.label ? ` (${t.label})` : '')),
      noteCount: Object.values(notes).filter(n => n.session_id === s.id).length,
    })),
    notes: Object.values(notes).map(n => ({
      id: n.id, type: n.type, title: n.title || '', session_id: n.session_id || null,
    })),
  });
});

// ── File watcher ──
if (chokidar) {
  chokidar.watch(KB_DIR, { ignoreInitial: true }).on('all', (event, filePath) => {
    if (filePath.endsWith('.md')) {
      console.log(`[PRAGMA] ${event}: ${path.basename(filePath)} — rebuilding index…`);
      buildIndex();
    }
  });
  chokidar.watch(METH_DIR, { ignoreInitial: true }).on('all', (event, filePath) => {
    if (filePath.endsWith('.md')) {
      console.log(`[PRAGMA] ${event}: ${path.basename(filePath)} — rebuilding methodology index…`);
      buildMethodologyIndex();
    }
  });
  console.log('[PRAGMA] Watching knowledge_base/ for changes');
}

buildIndex();
buildMethodologyIndex();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  ██████╗ ██████╗  █████╗  ██████╗ ███╗   ███╗ █████╗`);
  console.log(`  ██╔══██╗██╔══██╗██╔══██╗██╔════╝ ████╗ ████║██╔══██╗`);
  console.log(`  ██████╔╝██████╔╝███████║██║  ███╗██╔████╔██║███████║`);
  console.log(`  ██╔═══╝ ██╔══██╗██╔══██║██║   ██║██║╚██╔╝██║██╔══██║`);
  console.log(`  ██║     ██║  ██║██║  ██║╚██████╔╝██║ ╚═╝ ██║██║  ██║`);
  console.log(`  ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝\n`);
  console.log(`  App      → http://localhost:${PORT}/`);
  console.log(`  KB       → ${KB_DIR}  (${serviceIndex.length} services, ${methodologyIndex.length} guides)`);
  console.log(`  sessions/ → ${NOTES_DIR}  (workbench: ${activeWorkbenchName})`);
  console.log(`  sessions/→ ${SESSIONS_DIR}\n`);
});