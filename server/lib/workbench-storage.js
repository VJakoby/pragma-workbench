'use strict';

const fs = require('fs');
const path = require('path');

function createWorkbenchStorage({ sessionsDir, initialWorkbenchName = 'pragma', backupCount = 5 }) {
  let activeWorkbenchName = initialWorkbenchName;

  function getActiveWorkbenchName() {
    return activeWorkbenchName;
  }

  function setActiveWorkbenchName(name) {
    activeWorkbenchName = name;
  }

  function workbenchFile(name = activeWorkbenchName) {
    return path.join(sessionsDir, `${name}.workbench`);
  }

  function workbenchEncFile(name = activeWorkbenchName) {
    return path.join(sessionsDir, `${name}.workbench.enc`);
  }

  function bakFile(base, n) {
    const dir = path.dirname(base);
    const file = path.basename(base);
    const bakDir = path.join(dir, 'backup');
    if (!fs.existsSync(bakDir)) fs.mkdirSync(bakDir, { recursive: true });
    return path.join(bakDir, `${file}.bak${n}`);
  }

  function rotateBackups(base) {
    for (let i = backupCount; i > 1; i -= 1) {
      const older = bakFile(base, i);
      const newer = bakFile(base, i - 1);
      try {
        if (fs.existsSync(newer)) fs.renameSync(newer, older);
      } catch (_) {}
    }
    try {
      if (fs.existsSync(base)) fs.renameSync(base, bakFile(base, 1));
    } catch (_) {}
  }

  function atomicWrite(filePath, data) {
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, data, 'utf8');
    fs.renameSync(tmp, filePath);
  }

  function loadWithFallback(base) {
    const candidates = [base, ...Array.from({ length: backupCount }, (_, i) => bakFile(base, i + 1))];
    for (const file of candidates) {
      if (!fs.existsSync(file)) continue;
      try {
        const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (file !== base) console.warn(`[PRAGMA] Loaded workbench from backup: ${path.basename(file)}`);
        return { data: raw, source: file };
      } catch (_) {
        console.warn(`[PRAGMA] Skipping corrupt file: ${path.basename(file)}`);
      }
    }
    return null;
  }

  function loadNotesFile() {
    const result = loadWithFallback(workbenchFile());
    if (!result) return { sessions: {}, notes: {} };
    const raw = result.data;
    if (!raw.sessions && !raw.notes) return { sessions: {}, notes: raw };
    return { sessions: raw.sessions || {}, notes: raw.notes || {} };
  }

  function slugify(str) {
    return (str || 'export').replace(/[^a-zA-Z0-9_.-]/g, '_').toLowerCase().slice(0, 60);
  }

  function noteFilename(note) {
    const slug = (note.title || '')
      .replace(/[^a-zA-Z0-9 _-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 60);
    return slug ? `${slug}.md` : `${note.type}.md`;
  }

  return {
    sessionsDir,
    backupCount,
    getActiveWorkbenchName,
    setActiveWorkbenchName,
    workbenchFile,
    workbenchEncFile,
    bakFile,
    rotateBackups,
    atomicWrite,
    loadWithFallback,
    loadNotesFile,
    slugify,
    noteFilename,
  };
}

module.exports = { createWorkbenchStorage };
