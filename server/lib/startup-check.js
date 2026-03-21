'use strict';

const fs = require('fs');
const path = require('path');

function runStartupIntegrityCheck({ sessionsDir, storage }) {
  const results = [];
  const notesFile = storage.workbenchFile();
  const notesEncFile = storage.workbenchEncFile();

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

  if (!fs.existsSync(sessionsDir)) {
    try {
      fs.mkdirSync(sessionsDir, { recursive: true });
      results.push({ level: 'info', msg: `Created sessions directory: ${sessionsDir}` });
    } catch (e) {
      results.push({ level: 'error', msg: `Could not create sessions directory: ${e.message}` });
    }
  }

  const encExists = fs.existsSync(notesEncFile);
  const plainExists = fs.existsSync(notesFile);

  if (!encExists && !plainExists) {
    results.push({ level: 'info', msg: 'No workbench file found — fresh start, will be created on first save' });
  } else if (encExists && plainExists) {
    results.push({ level: 'warn', msg: 'Both plain and encrypted workbench files exist — plain file takes precedence' });
  } else if (encExists) {
    try {
      const blob = JSON.parse(fs.readFileSync(notesEncFile, 'utf8'));
      if (blob.encrypted !== true || !blob.salt || !blob.iv || !blob.data) {
        results.push({ level: 'warn', msg: 'Encrypted workbench exists but has unexpected structure — may fail to decrypt' });
      } else {
        results.push({ level: 'ok', msg: `Encrypted workbench OK: ${path.basename(notesEncFile)}` });
      }
    } catch (e) {
      results.push({ level: 'error', msg: `Encrypted workbench is corrupt (${e.message}) — will attempt fallback on load` });
    }
  } else if (plainExists) {
    try {
      const raw = JSON.parse(fs.readFileSync(notesFile, 'utf8'));
      const sessionCount = Object.keys(raw.sessions || {}).length;
      const noteCount = Object.keys(raw.notes || {}).length;
      results.push({ level: 'ok', msg: `Workbench OK: ${path.basename(notesFile)} (${sessionCount} sessions, ${noteCount} notes)` });
    } catch (e) {
      results.push({ level: 'error', msg: `Workbench file is corrupt (${e.message}) — will attempt fallback on load` });
    }
  }

  const bakFiles = Array.from({ length: storage.backupCount }, (_, i) => storage.bakFile(notesFile, i + 1))
    .filter(file => fs.existsSync(file));
  const bakEncFiles = Array.from({ length: storage.backupCount }, (_, i) => storage.bakFile(notesEncFile, i + 1))
    .filter(file => fs.existsSync(file));
  const totalBaks = bakFiles.length + bakEncFiles.length;
  if (totalBaks > 0) {
    results.push({ level: 'info', msg: `Rolling backups available: ${totalBaks} file(s)` });
  }

  return results;
}

module.exports = { runStartupIntegrityCheck };