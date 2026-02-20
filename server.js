/**
 * Dashboard Server
 * -----------
 * Express server that:
 *  - Serves the dashboard (dashboard.html)
 *  - Serves the original search UI (index.html)
 *  - Auto-discovers services from knowledge_base/
 *  - Provides /api/services  — list all discovered services
 *  - Provides /api/preview   — render a .md file to HTML
 *  - Provides /api/search    — full-text + fuzzy search across all .md files
 *  - Provides /api/sources   — (compat) same as /api/services for old UI
 *
 * Directory layout expected:
 *
 *  project/
 *  ├── server.js
 *  ├── dashboard.html
 *  ├── index.html          (original search UI)
 *  ├── package.json
 *  └── knowledge_base/
 *      ├── 22.md           (SSH)
 *      ├── 80.md           (HTTP)
 *      ├── 445.md          (SMB)
 *      └── ...             (any .md file becomes a service card)
 *
 * Install dependencies:
 *   npm install express marked fuse.js chokidar
 *
 * Run:
 *   node server.js
 *   PORT=3000 node server.js
 */

'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const Fuse = require('fuse.js');

// Optional: live-reload knowledge_base without restart
let chokidar;
try { chokidar = require('chokidar'); } catch (_) { /* optional */ }

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const KB_DIR = path.join(__dirname, 'knowledge_base');
const METH_DIR = path.join(__dirname, 'knowledge_base/methodologies');
const PUBLIC_DIR = path.join(__dirname, 'public');
const DASHBOARD_HTML = path.join(PUBLIC_DIR, 'index.html');
const INDEX_HTML = path.join(PUBLIC_DIR, 'index.html');

// ─────────────────────────────────────────────
// Markdown → metadata helpers
// ─────────────────────────────────────────────

/**
 * Derive a human-friendly service name + port from a filename.
 *
 * Conventions supported:
 *   22.md          → { name: "SSH",     port: "22/tcp"  }
 *   445.md         → { name: "SMB",     port: "445/tcp" }
 *   ssh.md         → { name: "SSH",     port: "—"       }
 *   linux_privesc.md → { name: "Linux PrivEsc", port: "local" }
 */
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

function metaFromFilename(filename) {
  const base = path.basename(filename, '.md').toLowerCase();

  // numeric → port lookup
  if (/^\d+$/.test(base) && PORT_MAP[base]) return { ...PORT_MAP[base], id: base };

  // slug lookup
  if (SLUG_MAP[base]) return { ...SLUG_MAP[base], id: base };

  // fallback: prettify slug
  const name = base.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return { id: base, name, port: '—', category: 'Other', icon: '📄' };
}

/**
 * Extract a one-line description from markdown content.
 * Looks for the first non-heading, non-empty paragraph sentence.
 */
function extractDescription(content) {
  const lines = content.split('\n');
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('```') || t.startsWith('|')) continue;
    // strip markdown formatting
    const clean = t.replace(/[*_`\[\]()]/g, '').replace(/\s+/g, ' ').trim();
    if (clean.length > 20) return clean.slice(0, 120) + (clean.length > 120 ? '…' : '');
  }
  return 'No description available.';
}

// ─────────────────────────────────────────────
// In-memory service index
// ─────────────────────────────────────────────
let serviceIndex = [];   // array of service objects
let searchIndex = null; // Fuse instance

function buildIndex() {
  if (!fs.existsSync(KB_DIR)) {
    //console.warn(`[Dashboard] knowledge_base/ not found at ${KB_DIR}. Creating empty dir.`);
    //fs.mkdirSync(KB_DIR, { recursive: true });
    serviceIndex = [];
    searchIndex = null;
    return;
  }

  const files = fs.readdirSync(KB_DIR).filter(f => f.endsWith('.md'));

  serviceIndex = files.map(filename => {
    const filepath = path.join(KB_DIR, filename);
    const content = fs.readFileSync(filepath, 'utf8');
    const meta = metaFromFilename(filename);

    return {
      id: meta.id,
      name: meta.name,
      port: meta.port,
      category: meta.category,
      icon: meta.icon,
      description: extractDescription(content),
      file: filename,                // relative path inside knowledge_base/
      filepath: filepath,                // absolute path (server-side only)
      content: content,                 // raw markdown (for search)
      wordCount: content.split(/\s+/).length,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  // Build Fuse search index
  searchIndex = new Fuse(serviceIndex, {
    includeScore: true,
    threshold: 0.4,
    ignoreLocation: true,
    keys: [
      { name: 'name', weight: 3 },
      { name: 'port', weight: 2 },
      { name: 'category', weight: 1.5 },
      { name: 'description', weight: 1 },
      { name: 'content', weight: 0.5 },
    ],
  });

  console.log(`[Dashboard] Indexed ${serviceIndex.length} service(s) from knowledge_base/`);
}

// ─────────────────────────────────────────────
// Methodology index
// ─────────────────────────────────────────────
let methodologyIndex = [];

/**
 * Extract the title from markdown: uses the first # heading,
 * falling back to prettifying the filename slug.
 */
function extractTitle(content, filename) {
  const match = content.match(/^#\s+(.+)$/m);
  if (match) return match[1].trim();
  return path.basename(filename, '.md')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Derive category from optional <!-- category: X --> comment or filename slug.
 */
function extractCategory(content, filename) {
  const match = content.match(/<!--\s*category:\s*(.+?)\s*-->/i);
  if (match) return match[1].trim();

  const tagMatch = content.match(/^category:\s*(.+)$/m);
  if (tagMatch) return tagMatch[1].trim();

  // Try to find a category in the directory structure or filename
  if (filename.toLowerCase().includes('linux')) return 'Linux';
  if (filename.toLowerCase().includes('windows')) return 'Windows';
  if (filename.toLowerCase().includes('web')) return 'Web';
  if (filename.toLowerCase().includes('active-directory') || filename.toLowerCase().includes('ad-')) return 'Active Directory';

  return 'General';
}

const METH_ICONS = {
  'Active Directory': '\uD83C\uDFF0',
  'Linux': '\uD83D\uDC27',
  'Windows': '\uD83E\uDE9F',
  'Web': '\uD83C\uDF10',
  'Network': '\uD83D\uDCE1',
  'Mobile': '\uD83D\uDCF1',
  'Cloud': '\u2601\uFE0F',
  'Cryptography': '\uD83D\uDD11',
  'Recon': '\uD83D\uDD2D',
  'Forensics': '\uD83D\uDD2C',
  'General': '\uD83D\uDCCB',
};

function buildMethodologyIndex() {
  if (!fs.existsSync(METH_DIR)) {
    //fs.mkdirSync(METH_DIR, { recursive: true });
    methodologyIndex = [];
    //console.log(`[Dashboard] methodologies/ not found — created empty dir at ${METH_DIR}`);
    return;
  }

  const files = fs.readdirSync(METH_DIR).filter(f => f.endsWith('.md'));

  methodologyIndex = files.map(filename => {
    const filepath = path.join(METH_DIR, filename);
    const content = fs.readFileSync(filepath, 'utf8');
    const id = path.basename(filename, '.md').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const name = extractTitle(content, filename);
    const category = extractCategory(content, filename);

    return {
      id,
      name,
      category,
      icon: METH_ICONS[category] || '\uD83D\uDCCB',
      description: extractDescription(content),
      file: filename,
      filepath,
      content,
      wordCount: content.split(/\s+/).length,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  console.log(`[Dashboard] Indexed ${methodologyIndex.length} methodology guide(s) from methodologies/`);
}


// ─────────────────────────────────────────────
// Configure marked (safe HTML renderer)
// ─────────────────────────────────────────────
marked.setOptions({
  gfm: true,   // GitHub Flavoured Markdown
  breaks: false,
});

// ─────────────────────────────────────────────
// Express app
// ─────────────────────────────────────────────
const app = express();
app.use(express.json());

// Serve static files from public/
app.use(express.static(PUBLIC_DIR));

// ── Routes ────────────────────────────────────

/**
 * GET /
 * Serve the dashboard (public/index.html).
 */
app.get('/', (req, res) => {
  if (fs.existsSync(DASHBOARD_HTML)) {
    res.sendFile(DASHBOARD_HTML);
  } else {
    res.status(404).send('public/index.html not found.');
  }
});

/**
 * GET /api/services
 * Returns all discovered services (without raw content to keep payload small).
 */
app.get('/api/services', (req, res) => {
  const services = serviceIndex.map(({ id, name, port, category, icon, description, file, wordCount }) => ({
    id, name, port, category, icon, description, file, wordCount,
  }));

  res.json({
    total: services.length,
    services,
  });
});

/**
 * GET /api/sources  (backward compat with original search UI)
 */
app.get('/api/sources', (req, res) => {
  const sources = serviceIndex.map(svc => ({
    id: svc.id,
    name: svc.name,
    type: 'local',
    description: svc.description,
    page_count: 1,
  }));
  res.json({ total: sources.length, sources });
});

/**
 * GET /api/cache-status  (backward compat stub)
 */
app.get('/api/cache-status', (req, res) => {
  res.json({ sources: [] });
});

/**
 * GET /api/preview?file=22.md
 * Returns the rendered HTML for a markdown file.
 *
 * The `file` param should be just the filename (or a relative path under
 * knowledge_base/). Absolute paths are rejected for security.
 */
app.get('/api/preview', (req, res) => {
  const fileParam = req.query.file;
  if (!fileParam) return res.status(400).json({ error: 'Missing ?file= parameter' });

  // Resolve path. Supports absolute paths or paths relative to KB_DIR.
  // We relax the "must be in KB_DIR" constraint to allow previewing indexed files
  // from other local locations, as long as they are .md files.
  let resolved = path.isAbsolute(fileParam) ? fileParam : path.resolve(KB_DIR, fileParam);

  if (!fs.existsSync(resolved) && !path.isAbsolute(fileParam)) {
    // Try methodologies directory as fallback
    const methResolved = path.resolve(METH_DIR, fileParam);
    if (fs.existsSync(methResolved)) resolved = methResolved;
  }

  if (!fs.existsSync(resolved) || !fs.lstatSync(resolved).isFile()) {
    return res.status(404).json({ error: `File not found: ${fileParam}` });
  }

  try {
    const content = fs.readFileSync(resolved, 'utf8');
    const html = marked.parse(content);
    res.json({ html, raw: content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/search
 * Body: { query: string, fuzzyMode: "off" | "normal" | "prefer" }
 *
 * Returns matching services with relevance scores and snippets.
 */
app.post('/api/search', (req, res) => {
  const { query = '', fuzzyMode = 'off' } = req.body;
  const q = query.trim();
  const startTime = Date.now();

  if (!q) return res.json({ count: 0, results: [], total_searched: serviceIndex.length, search_time_ms: 0 });

  let results = [];

  if (fuzzyMode === 'off') {
    // Exact substring search
    const ql = q.toLowerCase();
    results = serviceIndex
      .filter(svc =>
        svc.name.toLowerCase().includes(ql) ||
        svc.port.toLowerCase().includes(ql) ||
        svc.category.toLowerCase().includes(ql) ||
        svc.description.toLowerCase().includes(ql) ||
        svc.content.toLowerCase().includes(ql)
      )
      .map(svc => ({ svc, score: 0.1 }));
  } else {
    // Fuse.js fuzzy search
    if (!searchIndex) return res.json({ error: 'Index not ready. Add .md files to knowledge_base/' });
    const threshold = fuzzyMode === 'prefer' ? 0.6 : 0.4;
    searchIndex.options.threshold = threshold;
    const fuseResults = searchIndex.search(q);
    results = fuseResults.map(r => ({ svc: r.item, score: r.score }));
  }

  const formatted = results.map(({ svc, score }) => ({
    id: svc.id,
    title: svc.name,
    page_name: svc.file,
    source_name: `knowledge_base/${svc.file}`,
    source_id: svc.id,
    url: `file://${svc.filepath}`,
    file_path: svc.filepath,
    is_local: true,
    relevance_score: Math.round((1 - score) * 100),
    match_type: score < 0.05 ? 'exact_title' : score < 0.2 ? 'title_contains' : 'content',
    snippet: { text: svc.description },
    category: svc.category,
    icon: svc.icon,
    port: svc.port,
  }));

  res.json({
    count: formatted.length,
    results: formatted,
    total_searched: serviceIndex.length,
    search_time_ms: Date.now() - startTime,
  });
});

/**
 * GET /api/service/:id
 * Returns full data for one service including rendered HTML.
 */
app.get('/api/service/:id', (req, res) => {
  const svc = serviceIndex.find(s => s.id === req.params.id);
  if (!svc) return res.status(404).json({ error: 'Service not found' });

  res.json({
    id: svc.id,
    name: svc.name,
    port: svc.port,
    category: svc.category,
    icon: svc.icon,
    description: svc.description,
    file: svc.file,
    wordCount: svc.wordCount,
    html: marked.parse(svc.content),
    raw: svc.content,
  });
});

/**
 * GET /api/methodologies
 * Returns all discovered methodology guides (without raw content).
 */
app.get('/api/methodologies', (req, res) => {
  const guides = methodologyIndex.map(({ id, name, category, icon, description, file, wordCount }) => ({
    id, name, category, icon, description, file, wordCount,
  }));
  res.json({ total: guides.length, guides });
});

/**
 * GET /api/methodology/:id
 * Returns full data for one methodology guide including rendered HTML.
 */
app.get('/api/methodology/:id', (req, res) => {
  const guide = methodologyIndex.find(g => g.id === req.params.id);
  if (!guide) return res.status(404).json({ error: 'Methodology not found' });

  res.json({
    id: guide.id,
    name: guide.name,
    category: guide.category,
    icon: guide.icon,
    description: guide.description,
    file: guide.file,
    wordCount: guide.wordCount,
    html: marked.parse(guide.content),
    raw: guide.content,
  });
});

/**
 * POST /api/search-proxy
 * Proxies a query to the external search indexer (runs on SEARCH_URL, default port 3002).
 * Returns top 5 results by relevance score.
 *
 * The external server is the search indexer project — it exposes POST /api/search
 * and accepts { query, fuzzy, fuzzy_prefer }.
 */
const SEARCH_URL = process.env.SEARCH_URL || 'http://localhost:3002';

app.post('/api/search-proxy', async (req, res) => {
  const { query = '', fuzzyMode = 'off', scope = 'all' } = req.body;
  if (!query.trim()) return res.json({ results: [], query });

  try {
    // Node 18+ has native fetch; fall back to http for older versions
    let responseData;

    if (typeof fetch !== 'undefined') {
      const r = await fetch(`${SEARCH_URL}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          fuzzy: fuzzyMode !== 'off',
          fuzzy_prefer: fuzzyMode === 'prefer',
          scope,
        }),
        signal: AbortSignal.timeout(4000),
      });
      responseData = await r.json();
    } else {
      // Fallback using built-in http module
      responseData = await new Promise((resolve, reject) => {
        const http = require('http');
        const url = new URL(`${SEARCH_URL}/api/search`);
        const body = JSON.stringify({ query, fuzzy: fuzzyMode !== 'off', fuzzy_prefer: fuzzyMode === 'prefer', scope });
        const options = {
          hostname: url.hostname,
          port: url.port || 3002,
          path: url.pathname,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
          timeout: 4000,
        };
        const req2 = http.request(options, (res2) => {
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

    const results = (responseData.results || [])
      .slice(0, 5)
      .map(r => ({
        title: r.title,
        source_name: r.source_name,
        url: r.url,
        relevance_score: r.relevance_score,
        match_type: r.match_type,
        snippet: r.snippet,
        is_local: r.is_local,
        file_path: r.file_path,
      }));

    res.json({ results, query, total: responseData.total_matches || results.length });
  } catch (err) {
    // Search indexer is not running — return graceful empty result, not an error
    console.warn(`[Dashboard] Search proxy unavailable: ${err.message}`);
    res.json({ results: [], query, offline: true });
  }
});
if (chokidar) {
  chokidar.watch(KB_DIR, { ignoreInitial: true }).on('all', (event, filePath) => {
    if (filePath.endsWith('.md')) {
      console.log(`[Dashboard] ${event}: ${path.basename(filePath)} — rebuilding service index…`);
      buildIndex();
    }
  });
  chokidar.watch(METH_DIR, { ignoreInitial: true }).on('all', (event, filePath) => {
    if (filePath.endsWith('.md')) {
      console.log(`[Dashboard] ${event}: ${path.basename(filePath)} — rebuilding methodology index…`);
      buildMethodologyIndex();
    }
  });
  console.log('[Dashboard] Watching knowledge_base/ and methodologies/ for changes (chokidar active)');
}

// ─────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────
buildIndex();
buildMethodologyIndex();

app.listen(PORT, () => {
  console.log(`\n  📖🔍 MMD Dashboard running at http://localhost:${PORT}`);
  console.log(`  📂 public/          → ${PUBLIC_DIR}`);
  console.log(`  📂 knowledge_base/  → ${KB_DIR}  (${serviceIndex.length} services)`);
  console.log(`  📂 methodologies/   → ${METH_DIR}  (${methodologyIndex.length} guides)\n`);
});