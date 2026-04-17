'use strict';

const fs = require('fs');
const path = require('path');

function probeDirectoryWritable(dir, label, results) {
  const probe = path.join(dir, `.pragma-write-test-${process.pid}-${Date.now()}`);
  try {
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    results.push({ level: 'ok', msg: `${label} writable: ${dir}` });
  } catch (err) {
    results.push({ level: 'error', msg: `${label} is not writable: ${dir} (${err.message})` });
  }
}

function validateTemplatesFile(templatesFile, results) {
  if (!templatesFile) return;
  if (!fs.existsSync(templatesFile)) {
    results.push({ level: 'warn', msg: `Templates file missing: ${templatesFile} — built-in fallback will be used` });
    return;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(templatesFile, 'utf8'));
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.templates)) {
      results.push({ level: 'error', msg: `Templates file invalid: ${path.basename(templatesFile)} must contain a top-level templates array` });
      return;
    }
    results.push({ level: 'ok', msg: `Templates file OK: ${path.basename(templatesFile)} (${raw.templates.length} templates)` });
  } catch (err) {
    results.push({ level: 'error', msg: `Templates file unreadable: ${path.basename(templatesFile)} (${err.message})` });
  }
}

async function probeHttpEndpoint(label, enabled, url) {
  if (!enabled) return { level: 'info', msg: `${label} disabled` };
  if (!url) return { level: 'warn', msg: `${label} enabled but URL missing` };
  if (typeof fetch !== 'function') return { level: 'warn', msg: `${label} reachability not checked: fetch unavailable in runtime` };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2200);
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'manual', signal: controller.signal });
    return { level: 'ok', msg: `${label} reachable: ${url} (${res.status})` };
  } catch (err) {
    const reason = err?.name === 'AbortError' ? 'timeout' : (err.message || 'unreachable');
    return { level: 'warn', msg: `${label} not reachable: ${url} (${reason})` };
  } finally {
    clearTimeout(timeout);
  }
}

async function runStartupIntegrityCheck({
  sessionsDir,
  storage,
  kbDir,
  servicesDir,
  tacticsDir,
  templatesFile,
  matrixEnabled,
  matrixUrl,
  engramSearchEnabled,
  searchUrl,
}) {
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
  if (fs.existsSync(sessionsDir)) probeDirectoryWritable(sessionsDir, 'Sessions directory', results);

  if (kbDir) {
    if (!fs.existsSync(kbDir)) {
      try {
        fs.mkdirSync(kbDir, { recursive: true });
        results.push({ level: 'info', msg: `Created KB directory: ${kbDir}` });
      } catch (e) {
        results.push({ level: 'error', msg: `Could not create KB directory: ${e.message}` });
      }
    }
    if (fs.existsSync(kbDir)) probeDirectoryWritable(kbDir, 'KB directory', results);

    const kbSubdirs = [
      { dir: servicesDir, label: 'services' },
      { dir: tacticsDir, label: 'tactics' },
    ];
    kbSubdirs.forEach(({ dir, label }) => {
      if (!dir) return;
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
          results.push({ level: 'info', msg: `Created KB ${label} directory: ${dir}` });
        } catch (e) {
          results.push({ level: 'warn', msg: `Could not create KB ${label} directory: ${e.message}` });
        }
      }
    });
  }

  validateTemplatesFile(templatesFile, results);

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

  results.push(await probeHttpEndpoint('Toolbox', matrixEnabled, matrixUrl));
  results.push(await probeHttpEndpoint('ENGRAM', engramSearchEnabled, searchUrl));

  return results;
}

module.exports = { runStartupIntegrityCheck };
