'use strict';

const fs = require('fs');

function sanitizeWorkbenchName(name) {
  if (!name || typeof name !== 'string') return '';
  return name.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 64);
}

function registerWorkbenchRoutes(app, { sessionsDir, storage }) {
  app.get('/api/workbenches', (req, res) => {
    try {
      fs.mkdirSync(sessionsDir, { recursive: true });
      const files = fs.readdirSync(sessionsDir);
      const names = new Set(['default']);
      files.forEach(file => {
        const match = file.match(/^(.+)\.workbench(\.enc)?$/);
        if (match) names.add(match[1]);
      });
      const sorted = [...names].sort((a, b) => (a === 'default' ? -1 : b === 'default' ? 1 : a.localeCompare(b)));
      res.json({
        workbenches: sorted,
        encrypted: Object.fromEntries(sorted.map(name => {
          const encFile = storage.workbenchEncFile(name);
          const plainFile = storage.workbenchFile(name);
          return [name, fs.existsSync(encFile) && !fs.existsSync(plainFile)];
        })),
        active: storage.getActiveWorkbenchName(),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/workbench/switch', (req, res) => {
    try {
      const safe = sanitizeWorkbenchName(req.body?.name);
      if (!safe) return res.status(400).json({ error: 'Invalid workbench name' });
      storage.setActiveWorkbenchName(safe);
      const encrypted = fs.existsSync(storage.workbenchEncFile()) && !fs.existsSync(storage.workbenchFile());
      res.json({
        ok: true,
        active: storage.getActiveWorkbenchName(),
        encrypted_storage: encrypted,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/workbench/create', (req, res) => {
    try {
      const safe = sanitizeWorkbenchName(req.body?.name);
      if (!safe) return res.status(400).json({ error: 'Invalid workbench name' });
      const file = storage.workbenchFile(safe);
      const enc = storage.workbenchEncFile(safe);
      if (fs.existsSync(file) || fs.existsSync(enc)) {
        return res.status(409).json({ error: `Workbench "${safe}" already exists` });
      }
      fs.mkdirSync(sessionsDir, { recursive: true });
      fs.writeFileSync(file, JSON.stringify({ sessions: {}, notes: {} }, null, 2), 'utf8');
      storage.setActiveWorkbenchName(safe);
      res.json({ ok: true, active: storage.getActiveWorkbenchName() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/workbench/delete', (req, res) => {
    try {
      const name = req.body?.name;
      if (!name) return res.status(400).json({ error: 'name required' });
      if (name === 'default') return res.status(403).json({ error: 'Cannot delete the default workbench' });
      if (name === storage.getActiveWorkbenchName()) {
        return res.status(409).json({ error: 'Cannot delete the active workbench. Switch first.' });
      }
      const file = storage.workbenchFile(name);
      const enc = storage.workbenchEncFile(name);
      if (fs.existsSync(file)) fs.unlinkSync(file);
      if (fs.existsSync(enc)) fs.unlinkSync(enc);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = { registerWorkbenchRoutes };
