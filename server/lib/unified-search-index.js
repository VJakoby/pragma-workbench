'use strict';

const fs = require('fs');
const path = require('path');
const Fuse = require('fuse.js');

function createUnifiedSearchIndex({ kbDir, servicesDir, tacticsDir, sessionsDir, storage }) {
  let unifiedIndex = null;
  let indexData = [];
  let rebuildTimer = null;
  const REBUILD_DEBOUNCE_MS = 500;

  function extractTitle(content) {
    const match = content.match(/^#\s+(.+)$/m);
    if (match) {
      return match[1].trim().replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]+\s*/gu, '');
    }
    return '';
  }

  function extractDescription(content) {
    const lines = content.split('\n');
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith('#') || t.startsWith('```') || t.startsWith('|')) continue;
      const clean = t.replace(/[*_`\[\]()]/g, '').replace(/\s+/g, ' ').trim();
      if (clean.length > 20) return clean.slice(0, 120) + (clean.length > 120 ? '…' : '');
    }
    return '';
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

  function normalizeFolderName(name) {
    const safe = String(name || '').replace(/[\\/]+/g, ' ').replace(/[^a-zA-Z0-9 _.-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').toLowerCase().slice(0, 80);
    return safe || null;
  }

  function buildKbEntries() {
    const entries = [];

    if (fs.existsSync(servicesDir)) {
      const files = walkMdFiles(servicesDir, servicesDir);
      for (const { filename, filepath, subdir } of files) {
        try {
          const content = fs.readFileSync(filepath, 'utf8');
          const title = extractTitle(content) || path.basename(filename, '.md');
          const description = extractDescription(content);
          const base = path.basename(filename, '.md').toLowerCase();
          entries.push({
            id: `kb-service-${base}`,
            type: 'kb-service',
            title,
            description,
            content,
            metadata: {
              folder: subdir || '',
              category: subdir ? subdir.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Services',
            },
          });
        } catch (err) {
          console.warn(`[UnifiedSearch] Failed to read service file ${filepath}:`, err.message);
        }
      }
    }

    if (fs.existsSync(tacticsDir)) {
      const files = walkMdFiles(tacticsDir, tacticsDir);
      for (const { filename, filepath, subdir } of files) {
        try {
          const content = fs.readFileSync(filepath, 'utf8');
          const title = extractTitle(content) || path.basename(filename, '.md');
          const description = extractDescription(content);
          const base = path.basename(filename, '.md').toLowerCase();
          entries.push({
            id: `kb-tactic-${base}`,
            type: 'kb-tactic',
            title,
            description,
            content,
            metadata: {
              folder: subdir || '',
              category: subdir ? subdir.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Tactics',
            },
          });
        } catch (err) {
          console.warn(`[UnifiedSearch] Failed to read tactic file ${filepath}:`, err.message);
        }
      }
    }

    if (fs.existsSync(kbDir)) {
      let rootEntries;
      try { rootEntries = fs.readdirSync(kbDir, { withFileTypes: true }); } catch (_) { rootEntries = []; }
      for (const entry of rootEntries) {
        if (!entry.isDirectory()) continue;
        if (entry.name === 'services' || entry.name === 'tactics') continue;
        const folder = normalizeFolderName(entry.name) || entry.name;
        const sectionRoot = path.join(kbDir, entry.name);
        const files = walkMdFiles(sectionRoot, sectionRoot);
        for (const { filename, filepath, subdir } of files) {
          try {
            const content = fs.readFileSync(filepath, 'utf8');
            const title = extractTitle(content) || path.basename(filename, '.md');
            const description = extractDescription(content);
            const base = path.basename(filename, '.md').toLowerCase();
            entries.push({
              id: `kb-section-${folder}-${base}`,
              type: 'kb-section',
              title,
              description,
              content,
              metadata: {
                folder,
                category: folder.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
              },
            });
          } catch (err) {
            console.warn(`[UnifiedSearch] Failed to read KB section file ${filepath}:`, err.message);
          }
        }
      }
    }

    return entries;
  }

  function buildNoteEntries() {
    const entries = [];
    try {
      const workbenches = storage.listWorkbenches();
      for (const wb of workbenches) {
        try {
          const notes = storage.loadNotes(wb.name);
          for (const note of Object.values(notes)) {
            if (!note || !note.id) continue;
            const title = note.title || 'Untitled';
            const body = note.body || '';
            const description = body.slice(0, 120).replace(/\n/g, ' ').trim();
            entries.push({
              id: `note-${note.id}`,
              type: 'note',
              title,
              description,
              content: body,
              metadata: {
                noteId: note.id,
                noteType: note.type || 'general',
                tags: note.tags || [],
                session: note.session_id || '',
              },
            });
          }
        } catch (err) {
          console.warn(`[UnifiedSearch] Failed to load notes from workbench ${wb.name}:`, err.message);
        }
      }
    } catch (err) {
      console.warn('[UnifiedSearch] Failed to list workbenches:', err.message);
    }
    return entries;
  }

  function rebuildIndex() {
    console.log('[UnifiedSearch] Rebuilding index...');
    const startTime = Date.now();
    
    const kbEntries = buildKbEntries();
    const noteEntries = buildNoteEntries();
    indexData = [...kbEntries, ...noteEntries];

    unifiedIndex = new Fuse(indexData, {
      includeScore: true,
      threshold: 0.4,
      ignoreLocation: true,
      keys: [
        { name: 'title', weight: 3 },
        { name: 'metadata.tags', weight: 2 },
        { name: 'metadata.category', weight: 2 },
        { name: 'description', weight: 1.5 },
        { name: 'content', weight: 0.5 },
      ],
    });

    const elapsed = Date.now() - startTime;
    console.log(`[UnifiedSearch] Index rebuilt: ${indexData.length} entries in ${elapsed}ms`);
  }

  function scheduleRebuild() {
    if (rebuildTimer) clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => {
      rebuildIndex();
    }, REBUILD_DEBOUNCE_MS);
  }

  function startWatching() {
    let chokidar;
    try { chokidar = require('chokidar'); } catch (_) {
      console.warn('[UnifiedSearch] chokidar not available, file watching disabled');
      return;
    }

    const watchPaths = [];
    if (fs.existsSync(kbDir)) watchPaths.push(path.join(kbDir, '**/*.md'));
    if (fs.existsSync(sessionsDir)) watchPaths.push(path.join(sessionsDir, '**/*.json'));

    if (watchPaths.length === 0) {
      console.warn('[UnifiedSearch] No paths to watch');
      return;
    }

    const watcher = chokidar.watch(watchPaths, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100,
      },
    });

    watcher.on('add', (filepath) => {
      console.log(`[UnifiedSearch] File added: ${filepath}`);
      scheduleRebuild();
    });

    watcher.on('change', (filepath) => {
      console.log(`[UnifiedSearch] File changed: ${filepath}`);
      scheduleRebuild();
    });

    watcher.on('unlink', (filepath) => {
      console.log(`[UnifiedSearch] File removed: ${filepath}`);
      scheduleRebuild();
    });

    watcher.on('error', (err) => {
      console.error('[UnifiedSearch] Watcher error:', err);
    });

    console.log(`[UnifiedSearch] Watching ${watchPaths.length} path(s) for changes`);
  }

  function search(query, options = {}) {
    if (!unifiedIndex) {
      rebuildIndex();
    }
    if (!query || query.trim().length === 0) {
      return [];
    }
    const results = unifiedIndex.search(query, {
      limit: options.limit || 50,
    });
    return results.map(r => ({
      item: r.item,
      score: r.score,
    }));
  }

  function getIndexData() {
    if (!unifiedIndex) {
      rebuildIndex();
    }
    return indexData;
  }

  rebuildIndex();
  startWatching();

  return {
    search,
    getIndexData,
    rebuildIndex,
  };
}

module.exports = { createUnifiedSearchIndex };
