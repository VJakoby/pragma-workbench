'use strict';

const fs = require('fs');
const path = require('path');
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

function registerNotesRoutes(app, { sessionsDir, templatesFile, storage }) {
  app.get('/api/templates', async (req, res) => {
    try {
      const raw = await fs.promises.readFile(templatesFile, 'utf-8');
      const data = JSON.parse(raw);
      const templates = Array.isArray(data.templates) ? data.templates.map((template) => ({
        ...template,
        body: Array.isArray(template?.body_lines) ? template.body_lines.join('\n') : (template?.body || ''),
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
      fs.mkdirSync(sessionsDir, { recursive: true });
      storage.rotateBackups(storage.workbenchFile());
      storage.atomicWrite(storage.workbenchFile(), JSON.stringify({ sessions, notes }, null, 2));
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
      const { blob } = req.body || {};
      if (!blob || blob.encrypted !== true || !blob.salt || !blob.iv || !blob.data) {
        return res.status(400).json({ error: 'Invalid encrypted payload' });
      }
      fs.mkdirSync(sessionsDir, { recursive: true });
      storage.rotateBackups(storage.workbenchEncFile());
      storage.atomicWrite(storage.workbenchEncFile(), JSON.stringify(blob, null, 2));
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
      const { sessions, notes } = req.body || {};
      if (sessions === undefined || notes === undefined) {
        return res.status(403).json({ error: 'Decrypted payload required to disable encryption.' });
      }
      if (typeof sessions !== 'object' || typeof notes !== 'object') {
        return res.status(400).json({ error: 'Invalid payload structure.' });
      }
      fs.mkdirSync(sessionsDir, { recursive: true });
      storage.rotateBackups(storage.workbenchFile());
      storage.atomicWrite(storage.workbenchFile(), JSON.stringify({ sessions, notes }, null, 2));
      if (fs.existsSync(storage.workbenchEncFile())) {
        try { fs.unlinkSync(storage.workbenchEncFile()); } catch (_) {}
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/notes/export', (req, res) => {
    try {
      const { session_id, include_unassigned = true } = req.body;
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

      const model = buildSessionExportModel({ session, notes: sessionNotes, storage, templateMeta });
      const written = [];
      const byTarget = {};
      const unassigned = [...model.notes.unassigned];

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

        const label = [target.ip, target.domain, target.label].filter(Boolean).join(' · ');
        targetServices.sort((a, b) => (parseInt(a.port, 10) || 0) - (parseInt(b.port, 10) || 0));
        targetPaths.sort((a, b) => (a.path < b.path ? -1 : 1));

        const targetReadme = [
          `# ${label}`,
          '',
          `**Session:** ${session.codename}`,
          `**Notes:** ${targetNotes.length}`,
          `**Exported:** ${new Date().toISOString().replace('T', ' ').slice(0, 19)}`,
          '',
        ];

        if (targetServices.length) {
          targetReadme.push('## Open Ports', '');
          targetReadme.push('| Port | Service | Version | Notes |');
          targetReadme.push('|------|---------|---------|-------|');
          targetServices.forEach(service => {
            const port = service.proto && service.proto !== 'tcp' ? `${service.port}/${service.proto}` : service.port;
            targetReadme.push(`| ${port} | ${service.service || ''} | ${service.version || ''} | ${service.notes || ''} |`);
          });
          targetReadme.push('');
        }

        if (targetPaths.length) {
          targetReadme.push('## Paths', '');
          targetReadme.push('| Status | Path | Notes |');
          targetReadme.push('|--------|------|-------|');
          targetPaths.forEach(entry => {
            targetReadme.push(`| ${entry.status || ''} | ${entry.path} | ${entry.notes || ''} |`);
          });
          targetReadme.push('');
        }

        targetReadme.push('## Notes', '');
        targetReadme.push(...targetNotes
          .sort((a, b) => ((a.updated || a.created || 0) - (b.updated || b.created || 0)))
          .map(note => {
            const typeMeta = resolveNoteType(note.type, templateMeta);
            return `- [${note.title || storage.noteFilename(note).replace('.md', '')}](./${storage.noteFilename(note)}) — \`${typeMeta.label}\``;
          }));

        fs.writeFileSync(path.join(targetDir, 'README.md'), targetReadme.join('\n'), 'utf8');
        written.push(`${dirName}/README.md`);

        targetNotes.sort((a, b) => ((a.updated || a.created || 0) - (b.updated || b.created || 0))).forEach(note => {
          const fname = storage.noteFilename(note);
          const typeMeta = resolveNoteType(note.type, templateMeta);
          const body = renderTargetNoteFile({ note, session, target, typeMeta, storage });
          fs.writeFileSync(path.join(targetDir, fname), body, 'utf8');
          written.push(`${dirName}/${fname}`);
        });
      });

      if (unassigned.length) {
        const sessionDir = path.join(outDir, 'session');
        fs.mkdirSync(sessionDir, { recursive: true });
        unassigned.sort((a, b) => ((a.updated || a.created || 0) - (b.updated || b.created || 0))).forEach(note => {
          const fname = storage.noteFilename(note);
          const typeMeta = resolveNoteType(note.type, templateMeta);
          const body = renderSessionNoteFile({ note, session, typeMeta, storage });
          fs.writeFileSync(path.join(sessionDir, fname), body, 'utf8');
          written.push(`session/${fname}`);
        });
      }

      fs.writeFileSync(path.join(outDir, 'README.md'), renderExportIndex(model), 'utf8');
      written.unshift('README.md');

      fs.writeFileSync(path.join(outDir, 'SUMMARY.md'), renderTimelineSummary(model), 'utf8');
      written.push('SUMMARY.md');

      const consolidatedName = `${sessSlug}.md`;
      fs.writeFileSync(path.join(outDir, consolidatedName), renderConsolidatedSession(model), 'utf8');
      written.push(consolidatedName);

      console.log(`[PRAGMA] Exported ${written.length} files → ${outDir}`);
      res.json({ ok: true, path: outDir, files: written, session: session.codename });
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
