/**
 * PKBI Server
 * -----------
 * Express server that:
 *  - Serves the dashboard (dashboard.html)
 *  - Serves the original PKBI search UI (index.html)
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
 *  ├── index.html          (original PKBI UI)
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

const express  = require('express');
const fs       = require('fs');
const path     = require('path');
const { marked } = require('marked');
const Fuse     = require('fuse.js');

// Optional: live-reload knowledge_base without restart
let chokidar;
try { chokidar = require('chokidar'); } catch (_) { /* optional */ }

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────
const PORT           = process.env.PORT || 3000;
const KB_DIR         = path.join(__dirname, 'knowledge_base');
const PUBLIC_DIR     = path.join(__dirname, 'public');
const DASHBOARD_HTML = path.join(PUBLIC_DIR, 'index.html');
const INDEX_HTML     = path.join(PUBLIC_DIR, 'index.html');

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
  '21':   { name: 'FTP',        port: '21/tcp',      category: 'File Transfer',       icon: '📤' },
  '22':   { name: 'SSH',        port: '22/tcp',      category: 'Remote Access',       icon: '🔒' },
  '23':   { name: 'Telnet',     port: '23/tcp',      category: 'Remote Access',       icon: '📺' },
  '25':   { name: 'SMTP',       port: '25/tcp',      category: 'Mail',                icon: '✉️'  },
  '53':   { name: 'DNS',        port: '53/udp+tcp',  category: 'Network',             icon: '🗺️' },
  '80':   { name: 'HTTP',       port: '80/tcp',      category: 'Web',                 icon: '🌐' },
  '88':   { name: 'Kerberos',   port: '88/tcp',      category: 'Directory',           icon: '🐕' },
  '110':  { name: 'POP3',       port: '110/tcp',     category: 'Mail',                icon: '📬' },
  '111':  { name: 'RPC',        port: '111/tcp',     category: 'Network',             icon: '🔌' },
  '135':  { name: 'MSRPC',      port: '135/tcp',     category: 'Windows',             icon: '🪟' },
  '139':  { name: 'NetBIOS',    port: '139/tcp',     category: 'File Sharing',        icon: '🖧'  },
  '143':  { name: 'IMAP',       port: '143/tcp',     category: 'Mail',                icon: '📥' },
  '161':  { name: 'SNMP',       port: '161/udp',     category: 'Network',             icon: '📡' },
  '389':  { name: 'LDAP',       port: '389/tcp',     category: 'Directory',           icon: '🗂️' },
  '443':  { name: 'HTTPS',      port: '443/tcp',     category: 'Web',                 icon: '🔐' },
  '445':  { name: 'SMB',        port: '445/tcp',     category: 'File Sharing',        icon: '📂' },
  '636':  { name: 'LDAPS',      port: '636/tcp',     category: 'Directory',           icon: '🗂️' },
  '873':  { name: 'rsync',      port: '873/tcp',     category: 'File Transfer',       icon: '🔄' },
  '1433': { name: 'MSSQL',      port: '1433/tcp',    category: 'Database',            icon: '🗃️' },
  '1521': { name: 'Oracle DB',  port: '1521/tcp',    category: 'Database',            icon: '🛢️' },
  '2049': { name: 'NFS',        port: '2049/tcp',    category: 'File Sharing',        icon: '📁' },
  '2375': { name: 'Docker',     port: '2375/tcp',    category: 'Container',           icon: '🐳' },
  '3306': { name: 'MySQL',      port: '3306/tcp',    category: 'Database',            icon: '🛢️' },
  '3389': { name: 'RDP',        port: '3389/tcp',    category: 'Remote Access',       icon: '🖥️' },
  '5432': { name: 'PostgreSQL', port: '5432/tcp',    category: 'Database',            icon: '🐘' },
  '5900': { name: 'VNC',        port: '5900/tcp',    category: 'Remote Access',       icon: '👁️' },
  '5985': { name: 'WinRM',      port: '5985/tcp',    category: 'Remote Access',       icon: '⚡' },
  '6379': { name: 'Redis',      port: '6379/tcp',    category: 'Database',            icon: '⚙️' },
  '8080': { name: 'HTTP-alt',   port: '8080/tcp',    category: 'Web',                 icon: '🌐' },
  '8443': { name: 'HTTPS-alt',  port: '8443/tcp',    category: 'Web',                 icon: '🔐' },
  '9200': { name: 'Elasticsearch', port: '9200/tcp', category: 'Database',            icon: '🔍' },
  '27017':{ name: 'MongoDB',    port: '27017/tcp',   category: 'Database',            icon: '🍃' },
};

const SLUG_MAP = {
  'ssh':           { name: 'SSH',              port: '22/tcp',   category: 'Remote Access',       icon: '🔒' },
  'ftp':           { name: 'FTP',              port: '21/tcp',   category: 'File Transfer',       icon: '📤' },
  'http':          { name: 'HTTP',             port: '80/tcp',   category: 'Web',                 icon: '🌐' },
  'https':         { name: 'HTTPS',            port: '443/tcp',  category: 'Web',                 icon: '🔐' },
  'smb':           { name: 'SMB',              port: '445/tcp',  category: 'File Sharing',        icon: '📂' },
  'rdp':           { name: 'RDP',              port: '3389/tcp', category: 'Remote Access',       icon: '🖥️' },
  'dns':           { name: 'DNS',              port: '53/udp',   category: 'Network',             icon: '🗺️' },
  'ldap':          { name: 'LDAP',             port: '389/tcp',  category: 'Directory',           icon: '🗂️' },
  'mysql':         { name: 'MySQL',            port: '3306/tcp', category: 'Database',            icon: '🛢️' },
  'mssql':         { name: 'MSSQL',            port: '1433/tcp', category: 'Database',            icon: '🗃️' },
  'postgres':      { name: 'PostgreSQL',       port: '5432/tcp', category: 'Database',            icon: '🐘' },
  'postgresql':    { name: 'PostgreSQL',       port: '5432/tcp', category: 'Database',            icon: '🐘' },
  'redis':         { name: 'Redis',            port: '6379/tcp', category: 'Database',            icon: '⚙️' },
  'mongodb':       { name: 'MongoDB',          port: '27017/tcp',category: 'Database',            icon: '🍃' },
  'smtp':          { name: 'SMTP',             port: '25/tcp',   category: 'Mail',                icon: '✉️'  },
  'imap':          { name: 'IMAP',             port: '143/tcp',  category: 'Mail',                icon: '📥' },
  'snmp':          { name: 'SNMP',             port: '161/udp',  category: 'Network',             icon: '📡' },
  'nfs':           { name: 'NFS',              port: '2049/tcp', category: 'File Sharing',        icon: '📁' },
  'kerberos':      { name: 'Kerberos',         port: '88/tcp',   category: 'Directory',           icon: '🐕' },
  'winrm':         { name: 'WinRM',            port: '5985/tcp', category: 'Remote Access',       icon: '⚡' },
  'docker':        { name: 'Docker',           port: '2375/tcp', category: 'Container',           icon: '🐳' },
  'vnc':           { name: 'VNC',              port: '5900/tcp', category: 'Remote Access',       icon: '👁️' },
  'rsync':         { name: 'rsync',            port: '873/tcp',  category: 'File Transfer',       icon: '🔄' },
  'linux_privesc': { name: 'Linux PrivEsc',    port: 'Local',    category: 'Privilege Escalation',icon: '🐧' },
  'windows_privesc':{ name: 'Windows PrivEsc', port: 'Local',    category: 'Privilege Escalation',icon: '🪟' },
  'sqli':          { name: 'SQL Injection',    port: 'Web',      category: 'Web',                 icon: '💉' },
  'xss':           { name: 'XSS',              port: 'Web',      category: 'Web',                 icon: '🖊️' },
  'csrf':          { name: 'CSRF',             port: 'Web',      category: 'Web',                 icon: '🎭' },
  'ssrf':          { name: 'SSRF',             port: 'Web',      category: 'Web',                 icon: '🔁' },
  'xxe':           { name: 'XXE',              port: 'Web',      category: 'Web',                 icon: '📎' },
  'lfi':           { name: 'LFI/RFI',          port: 'Web',      category: 'Web',                 icon: '📂' },
  'lateral':       { name: 'Lateral Movement', port: 'Post-Ex',  category: 'Post Exploitation',   icon: '↔️'  },
  'pivoting':      { name: 'Pivoting',         port: 'Post-Ex',  category: 'Post Exploitation',   icon: '🌀' },
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
let searchIndex  = null; // Fuse instance

function buildIndex() {
  if (!fs.existsSync(KB_DIR)) {
    console.warn(`[PKBI] knowledge_base/ not found at ${KB_DIR}. Creating empty dir.`);
    fs.mkdirSync(KB_DIR, { recursive: true });
    serviceIndex = [];
    searchIndex  = null;
    return;
  }

  const files = fs.readdirSync(KB_DIR).filter(f => f.endsWith('.md'));

  serviceIndex = files.map(filename => {
    const filepath = path.join(KB_DIR, filename);
    const content  = fs.readFileSync(filepath, 'utf8');
    const meta     = metaFromFilename(filename);

    return {
      id:          meta.id,
      name:        meta.name,
      port:        meta.port,
      category:    meta.category,
      icon:        meta.icon,
      description: extractDescription(content),
      file:        filename,                // relative path inside knowledge_base/
      filepath:    filepath,                // absolute path (server-side only)
      content:     content,                 // raw markdown (for search)
      wordCount:   content.split(/\s+/).length,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  // Build Fuse search index
  searchIndex = new Fuse(serviceIndex, {
    includeScore:    true,
    threshold:       0.4,
    ignoreLocation:  true,
    keys: [
      { name: 'name',        weight: 3 },
      { name: 'port',        weight: 2 },
      { name: 'category',    weight: 1.5 },
      { name: 'description', weight: 1 },
      { name: 'content',     weight: 0.5 },
    ],
  });

  console.log(`[PKBI] Indexed ${serviceIndex.length} service(s) from knowledge_base/`);
}

// ─────────────────────────────────────────────
// Configure marked (safe HTML renderer)
// ─────────────────────────────────────────────
marked.setOptions({
  gfm:     true,   // GitHub Flavoured Markdown
  breaks:  false,
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
    total:    services.length,
    services,
  });
});

/**
 * GET /api/sources  (backward compat with original PKBI UI)
 */
app.get('/api/sources', (req, res) => {
  const sources = serviceIndex.map(svc => ({
    id:          svc.id,
    name:        svc.name,
    type:        'local',
    description: svc.description,
    page_count:  1,
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

  // Security: resolve and ensure path stays inside KB_DIR
  const resolved = path.resolve(KB_DIR, path.basename(fileParam));
  if (!resolved.startsWith(KB_DIR)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: `File not found: ${path.basename(fileParam)}` });
  }

  try {
    const content  = fs.readFileSync(resolved, 'utf8');
    const html     = marked.parse(content);
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
  const { query = '', fuzzyMode = 'normal' } = req.body;
  const q         = query.trim();
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
    id:              svc.id,
    title:           svc.name,
    page_name:       svc.file,
    source_name:     `knowledge_base/${svc.file}`,
    source_id:       svc.id,
    url:             `file://${svc.filepath}`,
    file_path:       svc.filepath,
    is_local:        true,
    relevance_score: Math.round((1 - score) * 100),
    match_type:      score < 0.05 ? 'exact_title' : score < 0.2 ? 'title_contains' : 'content',
    snippet:         { text: svc.description },
    category:        svc.category,
    icon:            svc.icon,
    port:            svc.port,
  }));

  res.json({
    count:           formatted.length,
    results:         formatted,
    total_searched:  serviceIndex.length,
    search_time_ms:  Date.now() - startTime,
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
    id:          svc.id,
    name:        svc.name,
    port:        svc.port,
    category:    svc.category,
    icon:        svc.icon,
    description: svc.description,
    file:        svc.file,
    wordCount:   svc.wordCount,
    html:        marked.parse(svc.content),
    raw:         svc.content,
  });
});

// ─────────────────────────────────────────────
// Live reload (optional, via chokidar)
// ─────────────────────────────────────────────
if (chokidar) {
  chokidar.watch(KB_DIR, { ignoreInitial: true }).on('all', (event, filePath) => {
    if (filePath.endsWith('.md')) {
      console.log(`[PKBI] ${event}: ${path.basename(filePath)} — rebuilding index…`);
      buildIndex();
    }
  });
  console.log('[PKBI] Watching knowledge_base/ for changes (chokidar active)');
}

// ─────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────
buildIndex();

app.listen(PORT, () => {
  console.log(`\n  📖 PKBI running at http://localhost:${PORT}`);
  console.log(`  🗂️  Dashboard  → http://localhost:${PORT}/`);
  console.log(`  📂 public/    → ${PUBLIC_DIR}`);
  console.log(`  📂 knowledge_base/ → ${KB_DIR}`);
  console.log(`  📦 ${serviceIndex.length} service(s) indexed\n`);
});