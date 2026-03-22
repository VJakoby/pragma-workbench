'use strict';

const fs = require('fs');
const path = require('path');
const Fuse = require('fuse.js');

function createKbIndex({ kbDir, servicesDir, tacticsDir }) {
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

  const TACTICS_ICONS = {
    'Active Directory': '🏰', 'Linux': '🐧', 'Windows': '🪟', 'Web': '🌐',
    'Network': '📡', 'Mobile': '📱', 'Cloud': '☁️', 'Cryptography': '🔑',
    'Recon': '🔭', 'Forensics': '🔬', 'General': '📋',
  };

  let serviceIndex = [];
  let tacticsIndex = [];
  let serviceCategories = [];
  let tacticsCategories = [];
  let searchIndex = null;

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

  function normalizeKbFilename(filename) {
    const base = path.basename(String(filename || '').trim(), '.md');
    const safe = base.replace(/[^a-zA-Z0-9 _.-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80);
    return safe ? `${safe}.md` : null;
  }

  function safeCategoryPath(category) {
    if (!category || category === 'all') return '';
    return String(category).split(/[\\/]+/).map(part => part.replace(/[^a-zA-Z0-9 _.-]/g, '').trim()).filter(Boolean).join(path.sep);
  }

  function normalizeFolderName(name) {
    const safe = String(name || '').replace(/[\\/]+/g, ' ').replace(/[^a-zA-Z0-9 _.-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').toLowerCase().slice(0, 80);
    return safe || null;
  }

  function humanizeCategory(name) {
    return String(name || '').replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim() || 'General';
  }

  function walkMdFiles(dir, rootDir) {
    let results = [];
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return results; }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results = results.concat(walkMdFiles(fullPath, rootDir));
      } else if (entry.name.toLowerCase().endsWith('.md')) {
        const rel = path.relative(rootDir, dir);
        const subdir = rel ? rel.split(path.sep)[0] : '';
        results.push({ filename: entry.name, filepath: fullPath, subdir });
      }
    }
    return results;
  }

  function buildIndex() {
    const entries = [];
    const categoryMap = new Map();

    function addCategory(label, folder = '') {
      if (!label || label === 'All') return;
      const key = String(label).toLowerCase();
      if (!categoryMap.has(key)) categoryMap.set(key, { label, folder });
    }

    if (fs.existsSync(servicesDir)) {
      let serviceRootEntries = [];
      try { serviceRootEntries = fs.readdirSync(servicesDir, { withFileTypes: true }); } catch (_) {}
      for (const entry of serviceRootEntries) {
        if (!entry.isDirectory()) continue;
        addCategory(humanizeCategory(entry.name), normalizeFolderName(entry.name) || entry.name);
      }
      entries.push(...walkMdFiles(servicesDir, servicesDir).map(entry => ({
        ...entry,
        sourceRoot: servicesDir,
        categoryLabel: entry.subdir ? humanizeCategory(entry.subdir) : null,
        folder: entry.subdir || '',
      })));
    }

    if (fs.existsSync(kbDir)) {
      let rootEntries = [];
      try { rootEntries = fs.readdirSync(kbDir, { withFileTypes: true }); } catch (_) {}
      for (const entry of rootEntries) {
        if (entry.name === 'tactics' || entry.name === 'services') continue;
        const fullPath = path.join(kbDir, entry.name);
        if (entry.isDirectory()) {
          addCategory(humanizeCategory(entry.name), normalizeFolderName(entry.name) || entry.name);
          entries.push(...walkMdFiles(fullPath, fullPath).map(fileEntry => ({
            ...fileEntry,
            sourceRoot: fullPath,
            categoryLabel: humanizeCategory(entry.name),
            folder: normalizeFolderName(entry.name) || entry.name,
          })));
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
          entries.push({
            filename: entry.name,
            filepath: fullPath,
            subdir: '',
            sourceRoot: kbDir,
            categoryLabel: 'General',
            folder: '',
          });
        }
      }
    }

    serviceIndex = entries.map(({ filename, filepath, categoryLabel, folder }) => {
      const content = fs.readFileSync(filepath, 'utf8');
      const meta = metaFromFilename(filename);
      const category = categoryLabel || meta.category || 'General';
      addCategory(category, folder || '');
      return {
        id: meta.id, name: meta.name, port: meta.port, category,
        icon: meta.icon, description: extractDescription(content),
        file: filename, filepath, content, wordCount: content.split(/\s+/).length, folder,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
    serviceCategories = Array.from(categoryMap.values()).sort((a, b) => a.label.localeCompare(b.label));

    searchIndex = new Fuse(serviceIndex, {
      includeScore: true, threshold: 0.4, ignoreLocation: true,
      keys: [
        { name: 'name', weight: 3 }, { name: 'port', weight: 2 },
        { name: 'category', weight: 1.5 }, { name: 'description', weight: 1 },
        { name: 'content', weight: 0.5 },
      ],
    });
    console.log(`[PRAGMA] Indexed ${serviceIndex.length} knowledge file(s) from ${kbDir}`);
  }

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

  function buildTacticsIndex() {
    if (!fs.existsSync(tacticsDir)) {
      tacticsIndex = [];
      console.log('[PRAGMA] knowledge_base/tactics/ not found — skipping.');
      return;
    }
    const entries = walkMdFiles(tacticsDir, tacticsDir);
    tacticsIndex = entries.map(({ filename, filepath, subdir }) => {
      const content = fs.readFileSync(filepath, 'utf8');
      const id = path.basename(filename, '.md').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const name = extractTitle(content, filename);
      const category = subdir ? subdir.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : extractCategory(content, filename);
      return {
        id, name, category, icon: TACTICS_ICONS[category] || '📋',
        description: extractDescription(content),
        file: filename, filepath, content, wordCount: content.split(/\s+/).length, folder: subdir || '',
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
    tacticsCategories = [...new Set(tacticsIndex.map(item => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    console.log(`[PRAGMA] Indexed ${tacticsIndex.length} tactic file(s)`);
  }

  return {
    buildIndex,
    buildTacticsIndex,
    getServiceIndex: () => serviceIndex,
    getServiceCategories: () => serviceCategories,
    getTacticsIndex: () => tacticsIndex,
    getTacticsCategories: () => tacticsCategories,
    getSearchIndex: () => searchIndex,
    metaFromFilename,
    normalizeKbFilename,
    safeCategoryPath,
    normalizeFolderName,
  };
}

module.exports = { createKbIndex };
