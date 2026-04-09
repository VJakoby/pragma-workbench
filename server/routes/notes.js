'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const {
  IMAGE_TYPE_TO_EXT,
  sanitizePathSegment,
  buildAttachmentDir,
  buildAttachmentFilename,
  normalizeAttachmentFilename,
  buildAttachmentUrl,
  resolveAttachmentPaths,
  resolveStoredAttachmentPath,
  extractAttachmentRefsFromMarkdown,
  buildAttachmentManifestFromNotes,
  cleanupAttachmentStore,
} = require('../lib/note-attachments');
const {
  loadTemplateMeta,
  resolveNoteType,
  buildSessionExportModel,
  renderTargetNoteFile,
  renderSessionNoteFile,
  renderExportIndex,
  renderTimelineSummary,
  renderConsolidatedSession,
} = require('../lib/session-export');

function registerNotesRoutes(app, { sessionsDir, templatesFile, storage, renderMarkdown }) {
  function expandTemplateBody(template) {
    return {
      ...template,
      body: Array.isArray(template?.body_lines) ? template.body_lines.join('\n') : (template?.body || ''),
    };
  }

  function decodeAttachmentPayload(data) {
    if (!data) return null;
    try {
      return Buffer.from(String(data), 'base64');
    } catch (_) {
      return null;
    }
  }

  function cleanupExportAttachmentShadows(outDir) {
    if (!outDir || !fs.existsSync(outDir)) return;
    fs.readdirSync(outDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== '_attachments')
      .forEach((entry) => {
        const shadowDir = path.join(outDir, entry.name, '_attachments');
        if (!fs.existsSync(shadowDir)) return;
        try { fs.rmSync(shadowDir, { recursive: true, force: true }); } catch (_) {}
      });
  }

  async function renderSummaryPdf({ markdown, outDir, filename }) {
    let puppeteer;
    try {
      puppeteer = require('puppeteer');
    } catch (_) {
      throw new Error('PDF generation requires puppeteer');
    }
    const htmlBody = renderMarkdown(markdown);
    const baseHref = pathToFileURL(`${outDir}${path.sep}`).toString();
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <base href="${baseHref}">
  <style>
    body { font-family: 'Inter', Arial, sans-serif; font-size: 12px; color: #111; line-height: 1.6; padding: 24px; }
    h1,h2,h3,h4 { color: #111; margin: 18px 0 8px; }
    h1 { font-size: 22px; }
    h2 { font-size: 18px; }
    h3 { font-size: 15px; }
    h4 { font-size: 13px; }
    code, pre { font-family: 'JetBrains Mono', monospace; font-size: 11px; }
    pre { background: #f4f4f5; padding: 10px 12px; border-radius: 6px; overflow-x: auto; }
    code { background: #f4f4f5; padding: 2px 4px; border-radius: 4px; }
    blockquote { border-left: 3px solid #e5e7eb; margin: 10px 0; padding: 4px 10px; color: #444; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 14px; }
    th, td { border: 1px solid #e5e7eb; padding: 4px 6px; vertical-align: top; }
    img { max-width: 100%; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
  </style>
</head>
<body>
${htmlBody}
</body>
</html>`;

    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.emulateMediaType('screen');
      await page.pdf({
        path: path.join(outDir, filename),
        format: 'A4',
        printBackground: true,
        margin: { top: '24px', bottom: '24px', left: '24px', right: '24px' },
      });
    } finally {
      await browser.close();
    }
  }

  app.post('/api/markdown/render', (req, res) => {
    try {
      const markdown = String(req.body?.markdown || '');
      res.json({ ok: true, html: renderMarkdown(markdown) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/notes/attachments', express.raw({
    type: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'],
    limit: '15mb',
  }), async (req, res) => {
    try {
      const jsonBody = (!Buffer.isBuffer(req.body) && req.body && typeof req.body === 'object') ? req.body : null;
      const noteId = sanitizePathSegment(req.get('x-pragma-note-id') || jsonBody?.note_id, '');
      const originalName = decodeURIComponent(String(req.get('x-pragma-filename') || jsonBody?.filename || 'image'));
      const mimeType = String(jsonBody?.mime_type || req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      const preserveFilename = String(req.get('x-pragma-preserve-filename') || (jsonBody?.preserve_filename ? '1' : '')).trim() === '1';

      if (!noteId) return res.status(400).json({ error: 'note id required' });
      if (!IMAGE_TYPE_TO_EXT[mimeType]) return res.status(415).json({ error: 'unsupported image type' });

      const filename = preserveFilename ? normalizeAttachmentFilename(originalName) : buildAttachmentFilename(originalName, mimeType);
      const paths = resolveAttachmentPaths(sessionsDir, noteId, filename);
      fs.mkdirSync(paths.dir, { recursive: true });

      if (jsonBody?.encrypted_blob?.encrypted === true) {
        const encryptedBlob = {
          ...jsonBody.encrypted_blob,
          mime_type: mimeType,
          filename,
        };
        await fs.promises.writeFile(paths.encryptedPath, JSON.stringify(encryptedBlob, null, 2), 'utf8');
        if (fs.existsSync(paths.rawPath)) {
          try { fs.unlinkSync(paths.rawPath); } catch (_) {}
        }
      } else {
        const body = req.body;
        if (!Buffer.isBuffer(body) || !body.length) return res.status(400).json({ error: 'image body required' });
        await fs.promises.writeFile(paths.rawPath, body);
        if (fs.existsSync(paths.encryptedPath)) {
          try { fs.unlinkSync(paths.encryptedPath); } catch (_) {}
        }
      }

      res.json({
        ok: true,
        note_id: noteId,
        filename,
        url: buildAttachmentUrl(noteId, filename),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/notes/attachments/:noteId/:filename', (req, res) => {
    try {
      const noteId = sanitizePathSegment(req.params.noteId, '');
      const filename = normalizeAttachmentFilename(decodeURIComponent(String(req.params.filename || '')));
      if (!noteId || !filename) return res.status(400).end();

      const resolved = resolveStoredAttachmentPath(sessionsDir, noteId, filename);
      if (resolved.mode === 'raw' && fs.existsSync(resolved.filePath)) {
        return res.sendFile(path.resolve(resolved.filePath));
      }
      if (resolved.mode === 'encrypted' && fs.existsSync(resolved.filePath)) {
        const payload = JSON.parse(fs.readFileSync(resolved.filePath, 'utf8'));
        return res.json(payload);
      }
      return res.status(404).end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/templates', async (req, res) => {
    try {
      const raw = await fs.promises.readFile(templatesFile, 'utf-8');
      const data = JSON.parse(raw);
      const templates = Array.isArray(data.templates) ? data.templates.map((template) => ({
        ...expandTemplateBody(template),
        variants: Array.isArray(template?.variants) ? template.variants.map(expandTemplateBody) : [],
      })) : [];
      console.log(`[PRAGMA] /api/templates — file: ${templatesFile}, parsed ${templates.length} templates`);
      if (!templates.length) return res.json({ templates: null });
      res.json({ templates });
    } catch (err) {
      console.log(`[PRAGMA] /api/templates — error: ${err.message} (file: ${templatesFile})`);
      res.json({ templates: null });
    }
  });

  app.get('/api/config/templates', async (req, res) => {
    try {
      const content = await fs.promises.readFile(templatesFile, 'utf-8');
      res.json({ ok: true, content });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/config/templates', async (req, res) => {
    try {
      const content = String(req.body?.content || '');
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (err) {
        return res.status(400).json({ error: `Invalid JSON: ${err.message}` });
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return res.status(400).json({ error: 'Root JSON value must be an object.' });
      }
      if (!Array.isArray(parsed.templates)) {
        return res.status(400).json({ error: 'Expected a top-level "templates" array.' });
      }
      const normalized = `${JSON.stringify(parsed, null, 2)}\n`;
      await fs.promises.writeFile(templatesFile, normalized, 'utf-8');
      res.json({ ok: true, templates: parsed.templates.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/notes', (req, res) => {
    try {
      if (fs.existsSync(storage.workbenchEncFile()) && !fs.existsSync(storage.workbenchFile())) {
        return res.json({ encrypted_storage: true });
      }
      res.json(storage.loadNotesFile());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/notes/save', (req, res) => {
    try {
      if (fs.existsSync(storage.workbenchEncFile()) && !fs.existsSync(storage.workbenchFile())) {
        return res.status(423).json({ error: 'Encrypted storage active. Use /api/notes/save-encrypted.' });
      }
      const { sessions = {}, notes = {} } = req.body;
      const attachmentManifest = req.body?.attachment_manifest && typeof req.body.attachment_manifest === 'object'
        ? req.body.attachment_manifest
        : buildAttachmentManifestFromNotes(notes);
      fs.mkdirSync(sessionsDir, { recursive: true });
      storage.rotateBackups(storage.workbenchFile());
      storage.atomicWrite(storage.workbenchFile(), JSON.stringify({ sessions, notes }, null, 2));
      cleanupAttachmentStore(sessionsDir, attachmentManifest);
      if (fs.existsSync(storage.workbenchEncFile())) {
        try { fs.unlinkSync(storage.workbenchEncFile()); } catch (_) {}
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/notes/storage-info', (req, res) => {
    const encExists = fs.existsSync(storage.workbenchEncFile());
    const plainExists = fs.existsSync(storage.workbenchFile());
    res.json({
      encrypted_storage: encExists && !plainExists,
      plain_storage: plainExists,
      notes_dir: sessionsDir,
      sessions_dir: sessionsDir,
    });
  });

  app.get('/api/notes/encrypted', (req, res) => {
    try {
      const result = storage.loadWithFallback(storage.workbenchEncFile());
      if (!result) return res.status(404).json({ error: 'Encrypted notes file not found' });
      const blob = result.data;
      if (blob.encrypted !== true || !blob.salt || !blob.iv || !blob.data) {
        return res.status(422).json({ error: 'Encrypted file has unexpected structure.' });
      }
      if (result.source !== storage.workbenchEncFile()) {
        console.warn(`[PRAGMA] Serving encrypted workbench from backup: ${path.basename(result.source)}`);
      }
      res.json(blob);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/notes/download', (req, res) => {
    try {
      if (!fs.existsSync(storage.workbenchEncFile())) {
        return res.status(404).json({ error: 'No encrypted workbench file found' });
      }
      const filename = path.basename(storage.workbenchEncFile());
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.sendFile(path.resolve(storage.workbenchEncFile()));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/notes/download-backup', (req, res) => {
    try {
      const encActive = fs.existsSync(storage.workbenchEncFile()) && !fs.existsSync(storage.workbenchFile());
      if (encActive) {
        const bak = storage.bakFile(storage.workbenchEncFile(), 1);
        if (!fs.existsSync(bak)) return res.status(404).json({ error: 'No encrypted backup available yet.' });
        const filename = `${path.basename(storage.workbenchEncFile())}.bak1`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        return res.sendFile(path.resolve(bak));
      }

      if (fs.existsSync(storage.workbenchEncFile())) {
        return res.status(403).json({ error: 'Encrypted workbench exists. Cannot serve plaintext backup.' });
      }
      const bak = storage.bakFile(storage.workbenchFile(), 1);
      if (!fs.existsSync(bak)) return res.status(404).json({ error: 'No backup available yet.' });
      const filename = `${path.basename(storage.workbenchFile())}.bak1`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      return res.sendFile(path.resolve(bak));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/notes/save-encrypted', (req, res) => {
    try {
      const { blob, attachment_manifest: attachmentManifest = {} } = req.body || {};
      if (!blob || blob.encrypted !== true || !blob.salt || !blob.iv || !blob.data) {
        return res.status(400).json({ error: 'Invalid encrypted payload' });
      }
      fs.mkdirSync(sessionsDir, { recursive: true });
      storage.rotateBackups(storage.workbenchEncFile());
      storage.atomicWrite(storage.workbenchEncFile(), JSON.stringify(blob, null, 2));
      cleanupAttachmentStore(sessionsDir, attachmentManifest && typeof attachmentManifest === 'object' ? attachmentManifest : {});
      if (fs.existsSync(storage.workbenchFile())) {
        try { fs.unlinkSync(storage.workbenchFile()); } catch (_) {}
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/notes/storage/disable-encrypted', (req, res) => {
    try {
      const { sessions, notes, attachment_manifest: attachmentManifest = {} } = req.body || {};
      if (sessions === undefined || notes === undefined) {
        return res.status(403).json({ error: 'Decrypted payload required to disable encryption.' });
      }
      if (typeof sessions !== 'object' || typeof notes !== 'object') {
        return res.status(400).json({ error: 'Invalid payload structure.' });
      }
      fs.mkdirSync(sessionsDir, { recursive: true });
      storage.rotateBackups(storage.workbenchFile());
      storage.atomicWrite(storage.workbenchFile(), JSON.stringify({ sessions, notes }, null, 2));
      cleanupAttachmentStore(sessionsDir, attachmentManifest && typeof attachmentManifest === 'object' ? attachmentManifest : buildAttachmentManifestFromNotes(notes));
      if (fs.existsSync(storage.workbenchEncFile())) {
        try { fs.unlinkSync(storage.workbenchEncFile()); } catch (_) {}
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/notes/export', async (req, res) => {
    try {
      const { session_id, include_unassigned = true, author = '', generate_pdf = false } = req.body;
      const attachmentPayloads = req.body?.attachment_payloads && typeof req.body.attachment_payloads === 'object'
        ? req.body.attachment_payloads
        : {};
      const source = fs.existsSync(storage.workbenchEncFile())
        ? (req.body?.sessions && req.body?.notes ? { sessions: req.body.sessions, notes: req.body.notes } : null)
        : storage.loadNotesFile();
      if (!source) {
        return res.status(423).json({ error: 'Encrypted storage enabled. Client must provide sessions + notes.' });
      }

      const { sessions, notes } = source;
      const session = sessions[session_id];
      if (!session) return res.status(404).json({ error: 'Session not found' });

      const sessSlug = storage.slugify(session.codename);
      const outDir = path.join(sessionsDir, sessSlug);
      fs.mkdirSync(outDir, { recursive: true });
      cleanupExportAttachmentShadows(outDir);
      const templateMeta = loadTemplateMeta(templatesFile);

      const targets = session.targets || [];
      const sessionNotes = Object.values(notes).filter(n =>
        n.session_id === session_id ||
        (include_unassigned && (!n.session_id || !sessions[n.session_id]))
      );

      const allServices = session.services || [];
      const allPaths = session.paths || [];
      const allLoot = session.loot || [];
      const allEvents = session.events || [];
      if (!sessionNotes.length && !allServices.length && !allPaths.length && !allLoot.length && !allEvents.length) {
        return res.json({ ok: true, path: outDir, files: [], message: 'Nothing to export in this session.' });
      }

      const model = buildSessionExportModel({ session, notes: sessionNotes, storage, templateMeta, author });
      const written = [];
      const writtenSet = new Set();
      const byTarget = {};
      const unassigned = [...model.notes.unassigned];
      const attachmentUrlMapByNoteId = {};

      function writeTracked(relPath, content) {
        fs.writeFileSync(path.join(outDir, relPath), content, 'utf8');
        if (!writtenSet.has(relPath)) {
          writtenSet.add(relPath);
          written.push(relPath);
        }
      }

      function copyNoteAttachments(note, relBase) {
        const refs = extractAttachmentRefsFromMarkdown(note.body || '');
        const urlMap = {};
        const relPrefix = relBase && relBase !== '.' ? path.posix.relative(relBase, '.') : '.';
        const relRoot = relPrefix || '.';
        refs.forEach((ref) => {
          const safeNoteId = sanitizePathSegment(ref.noteId, 'note');
          const relPath = path.posix.join('_attachments', safeNoteId, ref.filename);
          const destDir = path.join(outDir, '_attachments', safeNoteId);
          const destPath = path.join(destDir, ref.filename);
          if (!fs.existsSync(destPath)) {
            let buffer = null;
            const payload = attachmentPayloads?.[ref.noteId]?.[ref.filename];
            if (payload?.data) buffer = decodeAttachmentPayload(payload.data);
            if (!buffer) {
              const stored = resolveStoredAttachmentPath(sessionsDir, ref.noteId, ref.filename);
              if (stored.mode === 'raw' && stored.filePath) buffer = fs.readFileSync(stored.filePath);
            }
            if (!buffer) return;
            fs.mkdirSync(destDir, { recursive: true });
            fs.writeFileSync(destPath, buffer);
          }
          urlMap[ref.url] = `${relRoot}/${relPath}`.replace(/\/{2,}/g, '/');
          if (!writtenSet.has(relPath)) {
            writtenSet.add(relPath);
            written.push(relPath);
          }
        });
        return urlMap;
      }

      sessionNotes.forEach(note => {
        if (note.target_id && targets.find(target => target.id === note.target_id)) {
          if (!byTarget[note.target_id]) byTarget[note.target_id] = [];
          byTarget[note.target_id].push(note);
        }
      });

      targets.forEach(target => {
        const targetNotes = byTarget[target.id] || [];
        const targetServices = (session.services || []).filter(service => service.target_id === target.id);
        const targetPaths = (session.paths || []).filter(entry => entry.target_id === target.id);
        if (!targetNotes.length && !targetServices.length && !targetPaths.length) return;

        const dirName = storage.slugify(target.ip || target.domain || target.label || target.id);
        const targetDir = path.join(outDir, dirName);
        fs.mkdirSync(targetDir, { recursive: true });

        targetServices.sort((a, b) => (parseInt(a.port, 10) || 0) - (parseInt(b.port, 10) || 0));
        targetPaths.sort((a, b) => (a.path < b.path ? -1 : 1));

        targetNotes.sort((a, b) => ((a.updated || a.created || 0) - (b.updated || b.created || 0))).forEach(note => {
          const fname = storage.noteFilename(note);
          const typeMeta = resolveNoteType(note.type, templateMeta);
          const attachmentUrlMap = copyNoteAttachments(note, dirName);
          if (!attachmentUrlMapByNoteId[note.id]) attachmentUrlMapByNoteId[note.id] = copyNoteAttachments(note, '.');
          const body = renderTargetNoteFile({ note, session, target, typeMeta, storage, attachmentUrlMap });
          writeTracked(`${dirName}/${fname}`, body);
        });
      });

      if (unassigned.length) {
        const sessionDir = path.join(outDir, 'session');
        fs.mkdirSync(sessionDir, { recursive: true });
        unassigned.sort((a, b) => ((a.updated || a.created || 0) - (b.updated || b.created || 0))).forEach(note => {
          const fname = storage.noteFilename(note);
          const typeMeta = resolveNoteType(note.type, templateMeta);
          const attachmentUrlMap = copyNoteAttachments(note, 'session');
          if (!attachmentUrlMapByNoteId[note.id]) attachmentUrlMapByNoteId[note.id] = copyNoteAttachments(note, '.');
          const body = renderSessionNoteFile({ note, session, typeMeta, storage, attachmentUrlMap });
          writeTracked(`session/${fname}`, body);
        });
      }

      model.attachmentUrlMapByNoteId = attachmentUrlMapByNoteId;

      writeTracked('README.md', renderExportIndex(model));

      writeTracked('TIMELINE.md', renderTimelineSummary(model));

      const consolidatedName = `${sessSlug}.md`;
      const consolidatedContent = renderConsolidatedSession(model);
      writeTracked(consolidatedName, consolidatedContent);

      let pdfMeta = null;
      let pdfError = null;
      if (generate_pdf) {
        try {
          const pdfName = `${sessSlug}.pdf`;
          await renderSummaryPdf({ markdown: consolidatedContent, outDir, filename: pdfName });
          pdfMeta = { filename: pdfName };
          if (!writtenSet.has(pdfName)) {
            writtenSet.add(pdfName);
            written.push(pdfName);
          }
        } catch (err) {
          pdfError = err?.message || 'PDF generation failed';
        }
      }

      console.log(`[PRAGMA] Exported ${written.length} files → ${outDir}`);
      res.json({
        ok: true,
        path: outDir,
        files: written,
        session: session.codename,
        has_attachments: written.some((file) => file.startsWith('_attachments/')),
        pdf: pdfMeta,
        pdf_error: pdfError,
        download: {
          filename: consolidatedName,
          content: consolidatedContent,
        },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/notes/export-file', (req, res) => {
    try {
      const sessionId = String(req.query?.session_id || '').trim();
      const fileParam = String(req.query?.file || '').trim();
      if (!sessionId || !fileParam) return res.status(400).json({ error: 'session_id and file required' });
      const source = storage.loadNotesFile();
      const session = source?.sessions?.[sessionId];
      if (!session) return res.status(404).json({ error: 'Session not found' });
      const safeName = path.basename(fileParam);
      if (!safeName.toLowerCase().endsWith('.pdf')) {
        return res.status(400).json({ error: 'Only PDF downloads are supported' });
      }
      const sessSlug = storage.slugify(session.codename);
      const outDir = path.join(sessionsDir, sessSlug);
      const filePath = path.join(outDir, safeName);
      if (!filePath.startsWith(outDir)) return res.status(400).json({ error: 'Invalid file path' });
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'PDF not found' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
      return res.sendFile(path.resolve(filePath));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/notes/export-session', (req, res) => {
    try {
      const { session_id } = req.body;
      const source = fs.existsSync(storage.workbenchEncFile())
        ? (req.body?.sessions && req.body?.notes ? { sessions: req.body.sessions, notes: req.body.notes } : null)
        : storage.loadNotesFile();
      if (!source) {
        return res.status(423).json({ error: 'Encrypted storage enabled. Client must provide sessions + notes.' });
      }

      const { sessions, notes } = source;
      const session = sessions[session_id];
      if (!session) return res.status(404).json({ error: 'Session not found' });

      const sessionNotes = Object.values(notes).filter(note => note.session_id === session_id);
      const payload = { pragma_version: 1, exported: Date.now(), session, notes: sessionNotes };

      fs.mkdirSync(sessionsDir, { recursive: true });
      const slug = storage.slugify(session.codename);
      const filePath = path.join(sessionsDir, `${slug}.session`);
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');

      console.log(`[PRAGMA] Session exported: ${filePath}`);
      res.json({ ok: true, path: filePath, notes: sessionNotes.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/notes/debug', (req, res) => {
    const { sessions, notes } = storage.loadNotesFile();
    res.json({
      dirs: { notes: sessionsDir, sessions: sessionsDir },
      files: { workbench: storage.workbenchFile(), encrypted: storage.workbenchEncFile() },
      sessions: Object.values(sessions).map(session => ({
        id: session.id,
        codename: session.codename,
        targets: (session.targets || []).map(target => target.ip + (target.label ? ` (${target.label})` : '')),
        noteCount: Object.values(notes).filter(note => note.session_id === session.id).length,
      })),
      notes: Object.values(notes).map(note => ({
        id: note.id,
        type: note.type,
        title: note.title || '',
        session_id: note.session_id || null,
      })),
    });
  });
}

module.exports = { registerNotesRoutes };
