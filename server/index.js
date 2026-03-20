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
  DASHBOARD_HTML,
  SESSIONS_DIR,
  TEMPLATES_FILE,
  SEARCH_URL,
} = createPaths(path.resolve(__dirname, '..'));

const kbIndex = createKbIndex({ servicesDir: SERVICES_DIR, tacticsDir: TACTICS_DIR });
const buildIndex = kbIndex.buildIndex;
const buildTacticsIndex = kbIndex.buildTacticsIndex;
const metaFromFilename = kbIndex.metaFromFilename;
const normalizeKbFilename = kbIndex.normalizeKbFilename;
const safeCategoryPath = kbIndex.safeCategoryPath;
const normalizeFolderName = kbIndex.normalizeFolderName;
const storage = createWorkbenchStorage({ sessionsDir: SESSIONS_DIR, initialWorkbenchName: 'pragma' });

marked.setOptions({ gfm: true, breaks: false });

const app = express();
app.use(express.json());
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
  if (fs.existsSync(DASHBOARD_HTML)) res.sendFile(DASHBOARD_HTML);
  else res.status(404).send('public/app.html not found');
});

registerKbRoutes(app, {
  marked,
  kbIndex,
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
registerNotesRoutes(app, { sessionsDir: SESSIONS_DIR, templatesFile: TEMPLATES_FILE, storage });

if (chokidar) {
  chokidar.watch(SERVICES_DIR, { ignoreInitial: true }).on('all', (event, filePath) => {
    if (filePath.endsWith('.md')) {
      console.log(`[PRAGMA] ${event}: ${path.basename(filePath)} — rebuilding index…`);
      buildIndex();
    }
  });
  chokidar.watch(TACTICS_DIR, { ignoreInitial: true }).on('all', (event, filePath) => {
    if (filePath.endsWith('.md')) {
      console.log(`[PRAGMA] ${event}: ${path.basename(filePath)} — rebuilding tactics index…`);
      buildTacticsIndex();
    }
  });
  console.log('[PRAGMA] Watching services/ and tactics/ for changes');
}

buildIndex();
buildTacticsIndex();

app.listen(PORT, '0.0.0.0', () => {
  const serviceIndex = kbIndex.getServiceIndex();
  const tacticsIndex = kbIndex.getTacticsIndex();
  console.log(`\n  ██████╗ ██████╗  █████╗  ██████╗ ███╗   ███╗ █████╗`);
  console.log(`  ██╔══██╗██╔══██╗██╔══██╗██╔════╝ ████╗ ████║██╔══██╗`);
  console.log(`  ██████╔╝██████╔╝███████║██║  ███╗██╔████╔██║███████║`);
  console.log(`  ██╔═══╝ ██╔══██╗██╔══██║██║   ██║██║╚██╔╝██║██╔══██║`);
  console.log(`  ██║     ██║  ██║██║  ██║╚██████╔╝██║ ╚═╝ ██║██║  ██║`);
  console.log(`  ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝\n`);
  console.log(`  App      → http://localhost:${PORT}/`);
  console.log(`  KB       → ${KB_DIR}  (${serviceIndex.length} services, ${tacticsIndex.length} tactics)`);
  console.log(`  Services → ${SERVICES_DIR}`);
  console.log(`  Tactics  → ${TACTICS_DIR}`);
  console.log(`  Workbench → ${SESSIONS_DIR}  (active: ${storage.getActiveWorkbenchName()})\n`);

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