'use strict';

const fs = require('fs');
const path = require('path');

const IMAGE_TYPE_TO_EXT = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const IMAGE_EXT_TO_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

const ATTACHMENT_URL_RE = /\/api\/notes\/attachments\/([^/\s)]+)\/([^)\s?#]+)/g;

function sanitizePathSegment(value, fallback = 'item') {
  const cleaned = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
  return cleaned || fallback;
}

function buildAttachmentRoot(sessionsDir) {
  return path.join(sessionsDir, 'attachments');
}

function buildAttachmentDir(sessionsDir, noteId) {
  return path.join(buildAttachmentRoot(sessionsDir), sanitizePathSegment(noteId, 'note'));
}

function buildAttachmentFilename(originalName, mimeType) {
  const parsed = path.parse(String(originalName || 'image'));
  const safeBase = sanitizePathSegment(parsed.name, 'image').slice(0, 60);
  const extFromName = String(parsed.ext || '').toLowerCase();
  const ext = IMAGE_TYPE_TO_EXT[mimeType] || (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(extFromName) ? extFromName : '.png');
  return `${safeBase}_${Date.now()}${ext === '.jpeg' ? '.jpg' : ext}`;
}

function normalizeAttachmentFilename(name) {
  const parsed = path.parse(String(name || 'image'));
  const safeBase = sanitizePathSegment(parsed.name, 'image').slice(0, 60);
  const ext = sanitizePathSegment(parsed.ext || '', '').toLowerCase();
  return `${safeBase}${ext}`;
}

function buildAttachmentUrl(noteId, filename) {
  return `/api/notes/attachments/${encodeURIComponent(noteId)}/${encodeURIComponent(filename)}`;
}

function getAttachmentMimeType(filename, fallback = 'application/octet-stream') {
  return IMAGE_EXT_TO_MIME[String(path.extname(filename || '')).toLowerCase()] || fallback;
}

function resolveAttachmentPaths(sessionsDir, noteId, filename) {
  const dir = buildAttachmentDir(sessionsDir, noteId);
  const safeFilename = normalizeAttachmentFilename(filename);
  const rawPath = path.join(dir, safeFilename);
  const encryptedPath = `${rawPath}.enc`;
  return { dir, filename: safeFilename, rawPath, encryptedPath };
}

function resolveStoredAttachmentPath(sessionsDir, noteId, filename) {
  const paths = resolveAttachmentPaths(sessionsDir, noteId, filename);
  if (fs.existsSync(paths.rawPath)) return { ...paths, mode: 'raw', filePath: paths.rawPath };
  if (fs.existsSync(paths.encryptedPath)) return { ...paths, mode: 'encrypted', filePath: paths.encryptedPath };

  const requestedExt = path.extname(paths.filename);
  if (!requestedExt && fs.existsSync(paths.dir)) {
    const baseName = path.basename(paths.filename, path.extname(paths.filename));
    const matches = fs.readdirSync(paths.dir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => {
        if (name === paths.filename || name === `${paths.filename}.enc`) return true;
        if (name.endsWith('.enc')) {
          return path.basename(name, '.enc').startsWith(`${baseName}.`);
        }
        return name.startsWith(`${baseName}.`);
      });

    if (matches.length === 1) {
      const resolvedName = matches[0];
      const resolvedPath = path.join(paths.dir, resolvedName);
      const isEncrypted = resolvedName.endsWith('.enc');
      const normalizedFilename = isEncrypted ? path.basename(resolvedName, '.enc') : resolvedName;
      return {
        ...paths,
        filename: normalizedFilename,
        rawPath: isEncrypted ? path.join(paths.dir, normalizedFilename) : resolvedPath,
        encryptedPath: isEncrypted ? resolvedPath : `${resolvedPath}.enc`,
        mode: isEncrypted ? 'encrypted' : 'raw',
        filePath: resolvedPath,
      };
    }
  }

  return { ...paths, mode: null, filePath: '' };
}

function extractAttachmentRefsFromMarkdown(markdown) {
  const refs = [];
  const seen = new Set();
  const source = String(markdown || '');
  ATTACHMENT_URL_RE.lastIndex = 0;
  let match;
  while ((match = ATTACHMENT_URL_RE.exec(source))) {
    const noteId = sanitizePathSegment(decodeURIComponent(match[1] || ''), '');
    const filename = normalizeAttachmentFilename(decodeURIComponent(match[2] || ''));
    if (!noteId || !filename) continue;
    const key = `${noteId}:${filename}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({
      noteId,
      filename,
      url: buildAttachmentUrl(noteId, filename),
    });
  }
  return refs;
}

function buildAttachmentManifestFromNotes(notes) {
  const manifest = {};
  Object.values(notes || {}).forEach((note) => {
    const refs = extractAttachmentRefsFromMarkdown(note.body || '');
    if (!refs.length) return;
    refs.forEach((ref) => {
      if (!manifest[ref.noteId]) manifest[ref.noteId] = [];
      if (!manifest[ref.noteId].includes(ref.filename)) manifest[ref.noteId].push(ref.filename);
    });
  });
  return manifest;
}

function cleanupAttachmentStore(sessionsDir, manifest = {}) {
  const root = buildAttachmentRoot(sessionsDir);
  if (!fs.existsSync(root)) return;

  const allowedByDir = new Map();
  Object.entries(manifest || {}).forEach(([noteId, filenames]) => {
    const safeNoteId = sanitizePathSegment(noteId, '');
    if (!safeNoteId) return;
    const expected = new Set(
      (Array.isArray(filenames) ? filenames : [])
        .map((name) => normalizeAttachmentFilename(name))
        .filter(Boolean)
        .flatMap((name) => [name, `${name}.enc`])
    );
    allowedByDir.set(safeNoteId, expected);
  });

  fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .forEach((entry) => {
      const dirName = entry.name;
      const dirPath = path.join(root, dirName);
      const expected = allowedByDir.get(dirName);
      if (!expected) {
        fs.rmSync(dirPath, { recursive: true, force: true });
        return;
      }
      fs.readdirSync(dirPath, { withFileTypes: true }).forEach((fileEntry) => {
        if (!fileEntry.isFile()) return;
        if (!expected.has(fileEntry.name)) {
          try { fs.unlinkSync(path.join(dirPath, fileEntry.name)); } catch (_) {}
        }
      });
      try {
        if (!fs.readdirSync(dirPath).length) fs.rmdirSync(dirPath);
      } catch (_) {}
    });
}

function inspectAttachmentStore(sessionsDir, notes = {}) {
  const manifest = buildAttachmentManifestFromNotes(notes);
  const referenced = [];
  const missing = [];
  Object.entries(manifest).forEach(([noteId, filenames]) => {
    (Array.isArray(filenames) ? filenames : []).forEach((filename) => {
      const resolved = resolveStoredAttachmentPath(sessionsDir, noteId, filename);
      const item = {
        noteId,
        filename: normalizeAttachmentFilename(filename),
        url: buildAttachmentUrl(noteId, filename),
      };
      referenced.push({
        ...item,
        exists: !!resolved.mode && !!resolved.filePath,
        storedPath: resolved.filePath || '',
        mode: resolved.mode || null,
      });
      if (!resolved.mode || !resolved.filePath) missing.push(item);
    });
  });

  const root = buildAttachmentRoot(sessionsDir);
  const orphaned = [];
  if (fs.existsSync(root)) {
    const expected = new Map();
    Object.entries(manifest).forEach(([noteId, filenames]) => {
      const safeNoteId = sanitizePathSegment(noteId, '');
      if (!safeNoteId) return;
      expected.set(safeNoteId, new Set(
        (Array.isArray(filenames) ? filenames : [])
          .map((name) => normalizeAttachmentFilename(name))
          .filter(Boolean)
          .flatMap((name) => [name, `${name}.enc`])
      ));
    });

    fs.readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .forEach((entry) => {
        const dirName = entry.name;
        const dirPath = path.join(root, dirName);
        const allowed = expected.get(dirName) || new Set();
        fs.readdirSync(dirPath, { withFileTypes: true })
          .filter((fileEntry) => fileEntry.isFile())
          .forEach((fileEntry) => {
            if (allowed.has(fileEntry.name)) return;
            orphaned.push({
              noteId: dirName,
              filename: fileEntry.name,
              path: path.join(dirPath, fileEntry.name),
            });
          });
      });
  }

  return {
    manifest,
    referenced,
    missing,
    orphaned,
  };
}

module.exports = {
  IMAGE_TYPE_TO_EXT,
  sanitizePathSegment,
  buildAttachmentDir,
  buildAttachmentFilename,
  normalizeAttachmentFilename,
  buildAttachmentUrl,
  getAttachmentMimeType,
  resolveAttachmentPaths,
  resolveStoredAttachmentPath,
  extractAttachmentRefsFromMarkdown,
  buildAttachmentManifestFromNotes,
  cleanupAttachmentStore,
  inspectAttachmentStore,
};
