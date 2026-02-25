/**
 * PRAGMA
 * -----------
 *  - Auto-discovers services from knowledge_base/
 *  - Provides /api/services  — list all discovered services
 *  - Provides /api/preview   — render a .md file to HTML
 *  - Provides /api/search    — full-text + fuzzy search across all .md files
 *  - Provides /api/sources   — (compat) same as /api/services for old UI
 *
 * Run:
 *   node server.js
 *   npm start
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
const METH_DIR       = path.join(__dirname, 'knowledge_base', 'methodologies');
const PUBLIC_DIR     = path.join(__dirname, 'public');
const DASHBOARD_HTML = path.join(PUBLIC_DIR, 'app.html');

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
    console.warn(`[PRAGMA] knowledge_base/ not found at ${KB_DIR}. Creating empty dir.`);
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

  console.log(`[PRAGMA] Indexed ${serviceIndex.length} service(s) from knowledge_base/`);
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

  const slug = path.basename(filename, '.md').toLowerCase();
  if (/active.?directory|ad\b|kerberos|ldap/.test(slug)) return 'Active Directory';
  if (/linux|privesc/.test(slug))                          return 'Linux';
  if (/windows/.test(slug))                                return 'Windows';
  if (/web|http|burp|owasp/.test(slug))                   return 'Web';
  if (/network|pivot|tunnel/.test(slug))                   return 'Network';
  if (/mobile|android|ios/.test(slug))                     return 'Mobile';
  if (/cloud|aws|azure|gcp/.test(slug))                    return 'Cloud';
  if (/crypto|cipher/.test(slug))                          return 'Cryptography';
  if (/recon|osint/.test(slug))                            return 'Recon';
  if (/forensic|dfir/.test(slug))                          return 'Forensics';
  return 'General';
}

const METH_ICONS = {
  'Active Directory': '\uD83C\uDFF0',
  'Linux':            '\uD83D\uDC27',
  'Windows':          '\uD83E\uDE9F',
  'Web':              '\uD83C\uDF10',
  'Network':          '\uD83D\uDCE1',
  'Mobile':           '\uD83D\uDCF1',
  'Cloud':            '\u2601\uFE0F',
  'Cryptography':     '\uD83D\uDD11',
  'Recon':            '\uD83D\uDD2D',
  'Forensics':        '\uD83D\uDD2C',
  'General':          '\uD83D\uDCCB',
};

function buildMethodologyIndex() {
  if (!fs.existsSync(METH_DIR)) {
    methodologyIndex = [];
    console.log('[PRAGMA] knowledge_base/methodologies/ not found — skipping.');
    return;
  }

  const files = fs.readdirSync(METH_DIR).filter(f => f.endsWith('.md'));

  methodologyIndex = files.map(filename => {
    const filepath = path.join(METH_DIR, filename);
    const content  = fs.readFileSync(filepath, 'utf8');
    const id       = path.basename(filename, '.md').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const name     = extractTitle(content, filename);
    const category = extractCategory(content, filename);

    return {
      id,
      name,
      category,
      icon:        METH_ICONS[category] || '\uD83D\uDCCB',
      description: extractDescription(content),
      file:        filename,
      filepath,
      content,
      wordCount:   content.split(/\s+/).length,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  console.log(`[PRAGMA] Indexed ${methodologyIndex.length} methodology guide(s) from knowledge_base/methodologies/`);
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
 * Serve the app (public/app.html).
 */
app.get('/', (req, res) => {
  if (fs.existsSync(DASHBOARD_HTML)) {
    res.sendFile(DASHBOARD_HTML);
  } else {
    res.status(404).send('public/app.html not found — copy app.html to public/app.html');
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
 * GET /api/sources  (backward compat with original search UI)
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
 * GET /api/preview?file=<path>
 * Returns rendered HTML for a markdown file.
 *
 * Accepts two forms:
 *  1. Filename only (e.g. "22.md") → resolved relative to knowledge_base/
 *  2. Absolute path (e.g. "/home/user/pkbi/docs/xss.md") → read directly,
 *     allowed because the request comes from the dashboard's own proxy and
 *     the external search index only exposes files it has already indexed.
 *
 * Security: path traversal from KB_DIR is blocked for relative inputs.
 * Absolute paths outside KB_DIR are permitted (they come from the search index).
 */
app.get('/api/preview', (req, res) => {
  const fileParam = req.query.file;
  if (!fileParam) return res.status(400).json({ error: 'Missing ?file= parameter' });

  let resolved;

  if (path.isAbsolute(fileParam)) {
    // Absolute path — trust it (sourced from external search index)
    resolved = fileParam;
  } else {
    // Relative / basename — restrict to KB_DIR
    resolved = path.resolve(KB_DIR, path.basename(fileParam));
    if (!resolved.startsWith(KB_DIR)) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: `File not found: ${resolved}` });
  }

  try {
    const content = fs.readFileSync(resolved, 'utf8');
    const html    = marked.parse(content);
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
    id:          guide.id,
    name:        guide.name,
    category:    guide.category,
    icon:        guide.icon,
    description: guide.description,
    file:        guide.file,
    wordCount:   guide.wordCount,
    html:        marked.parse(guide.content),
    raw:         guide.content,
  });
});

/**
 * POST /api/kb/save
 * Saves edited markdown back to disk for a service or methodology file.
 * Body: { id, view }  where view = 'services' | 'methodologies'
 * Security: only allows writing to files that exist in the index (no path traversal).
 */
app.post('/api/kb/save', (req, res) => {
  try {
    const { id, view, content } = req.body;
    if (!id || !view || typeof content !== 'string') {
      return res.status(400).json({ error: 'id, view, and content are required' });
    }

    // Resolve from index — never trust a client-supplied path
    const index = view === 'services' ? serviceIndex : methodologyIndex;
    const entry = index.find(e => e.id === id);
    if (!entry) return res.status(404).json({ error: 'File not found in index' });

    fs.writeFileSync(entry.filepath, content, 'utf8');

    // Update in-memory content immediately so next read is fresh
    entry.content = content;

    console.log(`[PRAGMA] Saved edit: ${entry.filepath}`);
    res.json({ ok: true, file: entry.file });
  } catch (err) {
    console.error(`[PRAGMA] Save error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/search-proxy
 * Proxies a query to the external search indexer (runs on SEARCH_URL, default port 3001).
 * Returns top 5 results by relevance score.
 *
 * The external server is the search indexer project — it exposes POST /api/search
 * and accepts { query, fuzzy, fuzzy_prefer }.
 */
const SEARCH_URL = process.env.SEARCH_URL || 'http://localhost:3002';

app.post('/api/search-proxy', async (req, res) => {
  const { query = '', fuzzyMode = 'normal' } = req.body;
  if (!query.trim()) return res.json({ results: [], query });

  try {
    // Node 18+ has native fetch; fall back to http for older versions
    let responseData;

    if (typeof fetch !== 'undefined') {
      const r = await fetch(`${SEARCH_URL}/api/search`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          query,
          fuzzy:        fuzzyMode !== 'off',
          fuzzy_prefer: fuzzyMode === 'prefer',
        }),
        signal: AbortSignal.timeout(4000),
      });
      responseData = await r.json();
    } else {
      // Fallback using built-in http module
      responseData = await new Promise((resolve, reject) => {
        const http    = require('http');
        const url     = new URL(`${SEARCH_URL}/api/search`);
        const body    = JSON.stringify({ query, fuzzy: fuzzyMode !== 'off', fuzzy_prefer: fuzzyMode === 'prefer' });
        const options = {
          hostname: url.hostname,
          port:     url.port || 3001,
          path:     url.pathname,
          method:   'POST',
          headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
          timeout:  4000,
        };
        const req2 = http.request(options, (res2) => {
          let data = '';
          res2.on('data', chunk => { data += chunk; });
          res2.on('end',  ()    => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Bad JSON')); } });
        });
        req2.on('error',   reject);
        req2.on('timeout', () => { req2.destroy(); reject(new Error('Timeout')); });
        req2.write(body);
        req2.end();
      });
    }

    const results = (responseData.results || [])
      .slice(0, 15)
      .map(r => ({
        title:           r.title,
        source_name:     r.source_name,
        url:             r.url,
        relevance_score: r.relevance_score,
        match_type:      r.match_type,
        snippet:         r.snippet,
        is_local:        r.is_local,
        file_path:       r.file_path,
      }));

    res.json({
      results,
      query,
      total:        responseData.total_matches || results.length,
      docs_searched: responseData.docs_searched || responseData.total_searched || null,
      search_time_ms: responseData.search_time_ms || responseData.elapsed_ms || null,
    });
  } catch (err) {
    console.warn(`[PRAGMA] Search proxy error: ${err.message}`);
    res.json({ results: [], query, offline: true, error: err.message });
  }
});

/**
 * GET /api/search-ping
 * Probes the indexer directly and returns status — useful for debugging.
 */
app.get('/api/search-ping', async (req, res) => {
  try {
    let ok = false;
    let body = null;
    if (typeof fetch !== 'undefined') {
      const r = await fetch(`${SEARCH_URL}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test', fuzzy: false }),
        signal: AbortSignal.timeout(3000),
      });
      body = await r.json();
      ok = true;
    } else {
      ok = true; body = { note: 'http fallback active' };
    }
    res.json({ reachable: true, search_url: SEARCH_URL, sample: body });
  } catch (err) {
    res.json({ reachable: false, search_url: SEARCH_URL, error: err.message });
  }
});

// ─────────────────────────────────────────────
// Notes + Sessions
// notes.json structure:
//   { sessions: { <id>: { id, codename, target_ip, target_domain, created } },
//     notes:    { <id>: { id, session_id, type, title, body, ... } } }
// ─────────────────────────────────────────────
const NOTES_DIR       = path.join(__dirname, 'notes');
const NOTES_FILE      = path.join(NOTES_DIR, 'notes.json');
const NOTES_ENC_FILE  = path.join(NOTES_DIR, 'notes.json.encrypted');
const SESSIONS_DIR    = path.join(__dirname, 'session');

function loadNotesFile() {
  if (!fs.existsSync(NOTES_FILE)) return { sessions: {}, notes: {} };
  try {
    const raw = JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8'));
    // Back-compat: if old format (flat notes object), migrate
    if (!raw.sessions && !raw.notes) return { sessions: {}, notes: raw };
    return { sessions: raw.sessions || {}, notes: raw.notes || {} };
  } catch { return { sessions: {}, notes: {} }; }
}

app.get('/api/notes', (req, res) => {
  try {
    // If encrypted storage exists, client must unlock/decrypt locally.
    if (fs.existsSync(NOTES_ENC_FILE)) return res.json({ encrypted_storage: true });
    res.json(loadNotesFile());
  }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/notes/save', (req, res) => {
  try {
    if (fs.existsSync(NOTES_ENC_FILE)) {
      return res.status(423).json({ error: 'Encrypted storage enabled. Use /api/notes/save-encrypted.' });
    }
    const { sessions = {}, notes = {} } = req.body;
    fs.mkdirSync(NOTES_DIR, { recursive: true });
    fs.writeFileSync(NOTES_FILE, JSON.stringify({ sessions, notes }, null, 2), 'utf8');
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/notes/storage-info', (req, res) => {
  res.json({
    encrypted_storage: fs.existsSync(NOTES_ENC_FILE),
    plain_storage:     fs.existsSync(NOTES_FILE),
    encrypted_file:    path.basename(NOTES_ENC_FILE),
    plain_file:        path.basename(NOTES_FILE),
  });
});

app.get('/api/notes/encrypted', (req, res) => {
  try {
    if (!fs.existsSync(NOTES_ENC_FILE)) return res.status(404).json({ error: 'Encrypted notes file not found' });
    const raw = fs.readFileSync(NOTES_ENC_FILE, 'utf8');
    const obj = JSON.parse(raw);
    res.json(obj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notes/save-encrypted', (req, res) => {
  try {
    const { blob } = req.body || {};
    if (!blob || blob.encrypted !== true || !blob.salt || !blob.iv || !blob.data) {
      return res.status(400).json({ error: 'Invalid encrypted payload' });
    }
    fs.mkdirSync(NOTES_DIR, { recursive: true });
    fs.writeFileSync(NOTES_ENC_FILE, JSON.stringify(blob, null, 2), 'utf8');
    // Ensure plaintext is not left behind once encrypted storage is active.
    if (fs.existsSync(NOTES_FILE)) {
      try { fs.unlinkSync(NOTES_FILE); } catch (_) {}
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notes/storage/disable-encrypted', (req, res) => {
  try {
    if (fs.existsSync(NOTES_ENC_FILE)) {
      try { fs.unlinkSync(NOTES_ENC_FILE); } catch (_) {}
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/notes/export
 * Body: { session_id: string }
 * Exports all notes for a session to notes/<codename>/<type>-<slug>.md
 */
app.post('/api/notes/export', (req, res) => {
  try {
    const { session_id, include_unassigned = false } = req.body;
    const source = fs.existsSync(NOTES_ENC_FILE)
      ? (req.body && req.body.sessions && req.body.notes ? { sessions: req.body.sessions, notes: req.body.notes } : null)
      : loadNotesFile();
    if (!source) return res.status(423).json({ error: 'Encrypted storage enabled. Client must provide sessions + notes for export.' });
    const { sessions, notes } = source;

    const session = sessions[session_id];
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Sanitise codename for use as directory name
    const slug = session.codename.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const outDir = path.join(NOTES_DIR, slug);
    fs.mkdirSync(outDir, { recursive: true });

    const sessionNotes = Object.values(notes).filter(n =>
      n.session_id === session_id ||
      (include_unassigned && (!n.session_id || !sessions[n.session_id]))
    );
    if (!sessionNotes.length) return res.json({ ok: true, path: outDir, files: [], message: 'No notes in this session.' });

    const written = [];

    // Write session index file
    const indexLines = [
      `# ${session.codename}`,
      ``,
      `**Target IP:** ${(session.targets && session.targets.map(t => (t.label ? t.label+': ' : '') + t.ip).join(', ')) || session.target_ip || '—'}  `,
      `**Domain:** ${(session.targets && session.targets.map(t => t.domain).filter(Boolean).join(', ')) || session.target_domain || '—'}  `,
      `**Created:** ${new Date(session.created).toISOString().slice(0,10)}  `,
      `**Exported:** ${new Date().toISOString().replace('T',' ').slice(0,19)}`,
      ``,
      `---`,
      ``,
      `## Notes (${sessionNotes.length})`,
      ``,
    ];
    sessionNotes
      .sort((a,b) => (a.updated||0) - (b.updated||0))
      .forEach(n => {
        const fname = noteFilename(n);
        indexLines.push(`- [${n.title || fname.replace('.md','')}](./${fname}) — *${n.type}*`);
      });

    const indexPath = path.join(outDir, 'README.md');
    fs.writeFileSync(indexPath, indexLines.join('\n'), 'utf8');
    written.push('README.md');

    // Write each note as its own .md file
    sessionNotes.forEach(n => {
      const fname   = noteFilename(n);
      const header  = [
        `# ${n.title || noteFilename(n).replace('.md','')}`,
        ``,
        `> **Type:** ${n.type}  `,
        `> **Session:** ${session.codename}  `,
        `> **Target:** ${n.target_ip || (session.targets && session.targets[0] && session.targets[0].ip) || session.target_ip || '—'}  `,
        `> **Updated:** ${new Date(n.updated||n.created).toISOString().replace('T',' ').slice(0,19)}`,
        ``,
        `---`,
        ``,
      ].join('\n');
      fs.writeFileSync(path.join(outDir, fname), header + (n.body || ''), 'utf8');
      written.push(fname);
    });

    res.json({ ok: true, path: outDir, files: written, session: session.codename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/**
 * POST /api/notes/export-session
 * Writes a .session file to notes/<codename>.session containing
 * full session metadata + all its notes as portable JSON.
 */
app.post('/api/notes/export-session', (req, res) => {
  try {
    const { session_id } = req.body;
    const source = fs.existsSync(NOTES_ENC_FILE)
      ? (req.body && req.body.sessions && req.body.notes ? { sessions: req.body.sessions, notes: req.body.notes } : null)
      : loadNotesFile();
    if (!source) return res.status(423).json({ error: 'Encrypted storage enabled. Client must provide sessions + notes for export.' });
    const { sessions, notes } = source;

    const session = sessions[session_id];
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const sessNotes = Object.values(notes).filter(n => n.session_id === session_id);

    const payload = {
      pragma_version: 1,
      exported:       Date.now(),
      session:        session,
      notes:          sessNotes,
    };

    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    const slug     = session.codename.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const filePath = path.join(SESSIONS_DIR, slug + '.session');
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');

    console.log(`[PRAGMA] Exported session: ${filePath}`);
    res.json({ ok: true, path: filePath, notes: sessNotes.length });
  } catch (err) {
    console.error(`[PRAGMA] Session export error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/notes/debug
 * Returns a summary of what's in notes.json — session IDs, note IDs and their session_id.
 * Useful for diagnosing export mismatches.
 */
app.get('/api/notes/debug', (req, res) => {
  const { sessions, notes } = loadNotesFile();
  res.json({
    sessions: Object.values(sessions).map(s => ({
      id: s.id, codename: s.codename,
      targets: (s.targets||[]).map(t => t.ip + (t.label ? ' ('+t.label+')' : '')),
      noteCount: Object.values(notes).filter(n => n.session_id === s.id).length,
    })),
    notes: Object.values(notes).map(n => ({
      id: n.id, type: n.type, title: n.title||'', session_id: n.session_id||null,
    })),
  });
});

function noteFilename(note) {
  const titleSlug = (note.title || '')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim().replace(/\s+/g, '-').toLowerCase()
    .slice(0, 60);
  return titleSlug ? `${titleSlug}.md` : `${note.type}.md`;
}

if (chokidar) {
  chokidar.watch(KB_DIR, { ignoreInitial: true }).on('all', (event, filePath) => {
    if (filePath.endsWith('.md')) {
      console.log(`[PRAGMA] ${event}: ${path.basename(filePath)} — rebuilding service index…`);
      buildIndex();
    }
  });
  chokidar.watch(METH_DIR, { ignoreInitial: true }).on('all', (event, filePath) => {
    if (filePath.endsWith('.md')) {
      console.log(`[PRAGMA] ${event}: ${path.basename(filePath)} — rebuilding methodology index…`);
      buildMethodologyIndex();
    }
  });
  console.log('[PRAGMA] Watching knowledge_base/ (incl. methodologies/) for changes (chokidar active)');
}

// ─────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────
buildIndex();
buildMethodologyIndex();

app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  📖 PRAGMA running at http://localhost:${PORT}`);
  console.log(`  🗂️  PRAGMA          → http://localhost:${PORT}/`);
  console.log(`  📂 public/          → ${PUBLIC_DIR}`);
  console.log(`  📂 knowledge_base/  → ${KB_DIR}  (${serviceIndex.length} services)`);
  console.log(`  📂 methodologies/   → ${METH_DIR}  (${methodologyIndex.length} guides)\n`);
});
