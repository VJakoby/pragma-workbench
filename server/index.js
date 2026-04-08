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
const { createPaths } = require('./config/paths');
const { sanitizeRenderedHtml } = require('./lib/html-sanitize');
const { createKbIndex } = require('./lib/kb-index');
const { runStartupIntegrityCheck } = require('./lib/startup-check');
const { createWorkbenchStorage } = require('./lib/workbench-storage');
const { registerKbRoutes } = require('./routes/kb');
const { registerNotesRoutes } = require('./routes/notes');
const { registerSearchProxyRoutes } = require('./routes/search-proxy');
const { registerWorkbenchRoutes } = require('./routes/workbenches');

let chokidar;
try { chokidar = require('chokidar'); } catch (_) { }

const {
  PORT,
  KB_DIR,
  SERVICES_DIR,
  TACTICS_DIR,
  PUBLIC_DIR,
  SESSIONS_DIR,
  TEMPLATES_FILE,
  SEARCH_URL,
  HOST,
} = createPaths(path.resolve(__dirname, '..'));

const kbIndex = createKbIndex({ kbDir: KB_DIR, servicesDir: SERVICES_DIR, tacticsDir: TACTICS_DIR });
const buildIndex = kbIndex.buildIndex;
const buildTacticsIndex = kbIndex.buildTacticsIndex;
const metaFromFilename = kbIndex.metaFromFilename;
const normalizeKbFilename = kbIndex.normalizeKbFilename;
const safeCategoryPath = kbIndex.safeCategoryPath;
const normalizeFolderName = kbIndex.normalizeFolderName;
const storage = createWorkbenchStorage({ sessionsDir: SESSIONS_DIR, initialWorkbenchName: 'pragma' });

marked.setOptions({ gfm: true, breaks: false });
function preprocessImageResizeMarkdown(markdown) {
  return String(markdown || '').replace(/!\[([^\]]*)\]\(([^)]+)\)(?:\{([^}]+)\})?/g, (_, alt, url, attrs) => {
    const widthMatch = String(attrs || '').match(/\bwidth\s*=\s*(\d{1,4}(?:%)?)(?=\s|$)/i);
    const heightMatch = String(attrs || '').match(/\bheight\s*=\s*(\d{1,4}(?:%)?)(?=\s|$)/i);
    const cleanAlt = String(alt || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const cleanUrl = String(url || '').trim().replace(/"/g, '&quot;');
    const widthValue = widthMatch ? widthMatch[1] : '';
    const heightValue = heightMatch ? heightMatch[1] : '';
    const widthAttr = widthValue && !widthValue.endsWith('%') ? ` width="${widthValue}"` : '';
    const heightAttr = heightValue && !heightValue.endsWith('%') ? ` height="${heightValue}"` : '';
    const styleParts = ['max-width:100%'];
    if (widthValue.endsWith('%')) {
      styleParts.push(`width:${widthValue}`);
      styleParts.push('height:auto');
    } else if (heightValue.endsWith('%')) {
      styleParts.push(`height:${heightValue}`);
      styleParts.push('width:auto');
    }
    return `<img alt="${cleanAlt}" src="${cleanUrl}"${widthAttr}${heightAttr} style="${styleParts.join(';')}">`;
  });
}
const renderMarkdown = (markdown) => sanitizeRenderedHtml(marked.parse(preprocessImageResizeMarkdown(markdown)));

const app = express();
app.set('views', path.join(__dirname, '..', 'views'));
app.set('view engine', 'ejs');
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});
app.use(express.static(PUBLIC_DIR, { etag: false, lastModified: false }));

app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

app.get('/', (req, res) => {
  res.render('app');
});

app.get('/app.html', (req, res) => {
  res.render('app');
});

registerKbRoutes(app, {
  marked,
  renderMarkdown,
  kbIndex,
  kbDir: KB_DIR,
  servicesDir: SERVICES_DIR,
  tacticsDir: TACTICS_DIR,
  buildIndex,
  buildTacticsIndex,
  metaFromFilename,
  normalizeKbFilename,
  safeCategoryPath,
  normalizeFolderName,
});

registerSearchProxyRoutes(app, { searchUrl: SEARCH_URL });
registerWorkbenchRoutes(app, { sessionsDir: SESSIONS_DIR, storage });
registerNotesRoutes(app, { sessionsDir: SESSIONS_DIR, templatesFile: TEMPLATES_FILE, storage, renderMarkdown });

if (chokidar) {
  chokidar.watch(KB_DIR, { ignoreInitial: true }).on('all', (event, filePath) => {
    console.log(`[PRAGMA] ${event}: ${path.basename(filePath)} — rebuilding KB indexes…`);
    if (event === 'addDir' || event === 'unlinkDir' || event === 'add' || event === 'change' || event === 'unlink') {
      buildIndex();
      buildTacticsIndex();
    }
  });
  console.log('[PRAGMA] Watching KB directory for changes');
}

buildIndex();
buildTacticsIndex();

app.listen(PORT, HOST, () => {
  const serviceIndex = kbIndex.getServiceIndex();
  const tacticsIndex = kbIndex.getTacticsIndex();
  let kbSubdirs = [];
  try {
    kbSubdirs = fs.readdirSync(KB_DIR, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch (_) {}

  console.log(`\n  ██████╗ ██████╗  █████╗  ██████╗ ███╗   ███╗ █████╗`);
  console.log(`  ██╔══██╗██╔══██╗██╔══██╗██╔════╝ ████╗ ████║██╔══██╗`);
  console.log(`  ██████╔╝██████╔╝███████║██║  ███╗██╔████╔██║███████║`);
  console.log(`  ██╔═══╝ ██╔══██╗██╔══██║██║   ██║██║╚██╔╝██║██╔══██║`);
  console.log(`  ██║     ██║  ██║██║  ██║╚██████╔╝██║ ╚═╝ ██║██║  ██║`);
  console.log(`  ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝\n`);
  console.log(`  App      → http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/`);
  console.log(`  KB       → ${KB_DIR}  (${serviceIndex.length} knowledge files, ${tacticsIndex.length} tactics)`);
  console.log(`  Workbench → ${SESSIONS_DIR}  (active: ${storage.getActiveWorkbenchName()})\n`);
  if (kbSubdirs.length) {
    console.log('  ============= KB Subdirectories =============');
    kbSubdirs.forEach(dir => console.log(`  ${dir} → ${path.join(KB_DIR, dir)}`));
    console.log('');
  }

  const checks = runStartupIntegrityCheck({ sessionsDir: SESSIONS_DIR, storage });
  const icons = { ok: '  ✓', info: '  ℹ', warn: '  ⚠', error: '  ✖' };
  checks.forEach(({ level, msg }) => console.log(`${icons[level] || '  ?'} [${level.toUpperCase()}] ${msg}`));
  if (checks.some(result => result.level === 'error')) {
    console.log('\n  ⚠ One or more errors detected above — check workbench files before use.');
  } else if (checks.every(result => result.level === 'ok' || result.level === 'info')) {
    console.log('  ✓ All checks passed.');
  }
  console.log('');
});
