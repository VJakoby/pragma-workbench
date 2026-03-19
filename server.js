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
const { createPaths } = require('./server/config/paths');
const { createKbIndex } = require('./server/lib/kb-index');
const { createWorkbenchStorage } = require('./server/lib/workbench-storage');
const { registerKbRoutes } = require('./server/routes/kb');
const { registerNotesRoutes } = require('./server/routes/notes');
const { registerSearchProxyRoutes } = require('./server/routes/search-proxy');
const { registerWorkbenchRoutes } = require('./server/routes/workbenches');

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
} = createPaths(__dirname);

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

// Prevent browser caching of the main HTML so updates are always picked up
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

// ── File watcher ──
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

// ── Startup integrity check ─────────────────────────────────────────────────
function startupIntegrityCheck() {
  const results = [];
  const notesFile = storage.workbenchFile();
  const notesEncFile = storage.workbenchEncFile();

  // Clean up any stale .tmp files left by a previous crash mid-write
  const tmpFiles = [`${notesFile}.tmp`, `${notesEncFile}.tmp`];
  for (const tmp of tmpFiles) {
    if (fs.existsSync(tmp)) {
      try {
        fs.unlinkSync(tmp);
        results.push({ level: 'warn', msg: `Removed stale temp file: ${path.basename(tmp)}` });
      } catch (e) {
        results.push({ level: 'warn', msg: `Could not remove stale temp file: ${path.basename(tmp)} — ${e.message}` });
      }
    }
  }

  // Ensure sessions dir exists
  if (!fs.existsSync(SESSIONS_DIR)) {
    try {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true });
      results.push({ level: 'info', msg: `Created sessions directory: ${SESSIONS_DIR}` });
    } catch (e) {
      results.push({ level: 'error', msg: `Could not create sessions directory: ${e.message}` });
    }
  }

  // Determine active storage type and check workbench state
  const encExists = fs.existsSync(notesEncFile);
  const plainExists = fs.existsSync(notesFile);

  if (!encExists && !plainExists) {
    results.push({ level: 'info', msg: `No workbench file found — fresh start, will be created on first save` });
  } else if (encExists && plainExists) {
    results.push({ level: 'warn', msg: `Both plain and encrypted workbench files exist — plain file takes precedence` });
  } else if (encExists) {
    // Validate enc file is parseable and has correct structure
    try {
      const blob = JSON.parse(fs.readFileSync(notesEncFile, 'utf8'));
      if (blob.encrypted !== true || !blob.salt || !blob.iv || !blob.data) {
        results.push({ level: 'warn', msg: `Encrypted workbench exists but has unexpected structure — may fail to decrypt` });
      } else {
        results.push({ level: 'ok', msg: `Encrypted workbench OK: ${path.basename(notesEncFile)}` });
      }
    } catch (e) {
      results.push({ level: 'error', msg: `Encrypted workbench is corrupt (${e.message}) — will attempt fallback on load` });
    }
  } else if (plainExists) {
    // Validate plain file is parseable
    try {
      const raw = JSON.parse(fs.readFileSync(notesFile, 'utf8'));
      const sessionCount = Object.keys(raw.sessions || {}).length;
      const noteCount    = Object.keys(raw.notes    || {}).length;
      results.push({ level: 'ok', msg: `Workbench OK: ${path.basename(notesFile)} (${sessionCount} sessions, ${noteCount} notes)` });
    } catch (e) {
      results.push({ level: 'error', msg: `Workbench file is corrupt (${e.message}) — will attempt fallback on load` });
    }
  }

  // Count available backups
  const bakFiles = Array.from({ length: storage.backupCount }, (_, i) => storage.bakFile(notesFile, i + 1))
    .filter(f => fs.existsSync(f));
  const bakEncFiles = Array.from({ length: storage.backupCount }, (_, i) => storage.bakFile(notesEncFile, i + 1))
    .filter(f => fs.existsSync(f));
  const totalBaks = bakFiles.length + bakEncFiles.length;
  if (totalBaks > 0) {
    results.push({ level: 'info', msg: `Rolling backups available: ${totalBaks} file(s)` });
  }

  return results;
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

  // Run integrity check and print results
  const checks = startupIntegrityCheck();
  const icons  = { ok: '  ✓', info: '  ℹ', warn: '  ⚠', error: '  ✖' };
  checks.forEach(({ level, msg }) => console.log(`${icons[level] || '  ?'} [${level.toUpperCase()}] ${msg}`));
  if (checks.some(r => r.level === 'error')) {
    console.log('\n  ⚠ One or more errors detected above — check workbench files before use.');
  } else if (checks.every(r => r.level === 'ok' || r.level === 'info')) {
    console.log('  ✓ All checks passed.');
  }
  console.log('');
});