'use strict';

const fs = require('fs');
const path = require('path');

function registerKbRoutes(app, deps) {
  const {
    marked,
    kbIndex,
    servicesDir,
    tacticsDir,
    buildIndex,
    buildTacticsIndex,
    metaFromFilename,
    normalizeKbFilename,
    safeCategoryPath,
    normalizeFolderName,
  } = deps;

  app.get('/api/services', (req, res) => {
    const serviceIndex = kbIndex.getServiceIndex();
    res.json({
      total: serviceIndex.length,
      services: serviceIndex.map(({ id, name, port, category, icon, description, file, wordCount, folder }) =>
        ({ id, name, port, category, icon, description, file, wordCount, folder })),
    });
  });

  app.get('/api/sources', (req, res) => {
    const serviceIndex = kbIndex.getServiceIndex();
    res.json({
      total: serviceIndex.length,
      sources: serviceIndex.map(svc => ({
        id: svc.id,
        name: svc.name,
        type: 'local',
        description: svc.description,
        page_count: 1,
      })),
    });
  });

  app.get('/api/cache-status', (req, res) => res.json({ sources: [] }));

  app.get('/api/preview', (req, res) => {
    const fileParam = req.query.file;
    if (!fileParam) return res.status(400).json({ error: 'Missing ?file= parameter' });
    let resolved;
    if (path.isAbsolute(fileParam)) {
      resolved = fileParam;
    } else {
      // Preserve relative path so subdirectory files still resolve correctly.
      resolved = path.resolve(servicesDir, fileParam);
      if (!resolved.startsWith(servicesDir)) return res.status(403).json({ error: 'Access denied' });
    }
    if (!fs.existsSync(resolved)) return res.status(404).json({ error: `File not found: ${resolved}` });
    try {
      const content = fs.readFileSync(resolved, 'utf8');
      res.json({ html: marked.parse(content), raw: content });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/search', (req, res) => {
    const serviceIndex = kbIndex.getServiceIndex();
    const searchIndex = kbIndex.getSearchIndex();
    const { query = '', fuzzyMode = 'normal' } = req.body;
    const q = query.trim();
    const startTime = Date.now();

    if (!q) {
      return res.json({ count: 0, results: [], total_searched: serviceIndex.length, search_time_ms: 0 });
    }

    let results = [];
    if (fuzzyMode === 'off') {
      const ql = q.toLowerCase();
      results = serviceIndex
        .filter(svc => (
          svc.name.toLowerCase().includes(ql) ||
          svc.port.toLowerCase().includes(ql) ||
          svc.category.toLowerCase().includes(ql) ||
          svc.description.toLowerCase().includes(ql) ||
          svc.content.toLowerCase().includes(ql)
        ))
        .map(svc => ({ svc, score: 0.1 }));
    } else {
      if (!searchIndex) return res.json({ error: 'Index not ready.' });
      searchIndex.options.threshold = fuzzyMode === 'prefer' ? 0.6 : 0.4;
      results = searchIndex.search(q).map(r => ({ svc: r.item, score: r.score }));
    }

    res.json({
      count: results.length,
      results: results.map(({ svc, score }) => ({
        id: svc.id,
        title: svc.name,
        page_name: svc.file,
        source_name: `knowledge_base/${svc.file}`,
        source_id: svc.id,
        url: `file://${svc.filepath}`,
        file_path: svc.filepath,
        is_local: true,
        relevance_score: Math.round((1 - score) * 100),
        match_type: score < 0.05 ? 'exact_title' : score < 0.2 ? 'title_contains' : 'content',
        snippet: { text: svc.description },
        category: svc.category,
        icon: svc.icon,
        port: svc.port,
      })),
      total_searched: serviceIndex.length,
      search_time_ms: Date.now() - startTime,
    });
  });

  app.get('/api/service/:id', (req, res) => {
    const serviceIndex = kbIndex.getServiceIndex();
    const svc = serviceIndex.find(s => s.id === req.params.id);
    if (!svc) return res.status(404).json({ error: 'Service not found' });
    res.json({
      id: svc.id,
      name: svc.name,
      port: svc.port,
      category: svc.category,
      icon: svc.icon,
      description: svc.description,
      file: svc.file,
      wordCount: svc.wordCount,
      html: marked.parse(svc.content),
      raw: svc.content,
    });
  });

  app.get('/api/tactics', (req, res) => {
    const tacticsIndex = kbIndex.getTacticsIndex();
    res.json({
      total: tacticsIndex.length,
      tactics: tacticsIndex.map(({ id, name, category, icon, description, file, wordCount, folder }) =>
        ({ id, name, category, icon, description, file, wordCount, folder })),
    });
  });

  app.get('/api/methodologies', (req, res) => {
    const tacticsIndex = kbIndex.getTacticsIndex();
    res.json({
      total: tacticsIndex.length,
      guides: tacticsIndex.map(({ id, name, category, icon, description, file, wordCount, folder }) =>
        ({ id, name, category, icon, description, file, wordCount, folder })),
    });
  });

  app.get('/api/tactic/:id', (req, res) => {
    const tacticsIndex = kbIndex.getTacticsIndex();
    const guide = tacticsIndex.find(g => g.id === req.params.id);
    if (!guide) return res.status(404).json({ error: 'Tactic not found' });
    res.json({
      id: guide.id,
      name: guide.name,
      category: guide.category,
      icon: guide.icon,
      description: guide.description,
      file: guide.file,
      wordCount: guide.wordCount,
      html: marked.parse(guide.content),
      raw: guide.content,
    });
  });

  app.get('/api/methodology/:id', (req, res) => {
    const tacticsIndex = kbIndex.getTacticsIndex();
    const guide = tacticsIndex.find(g => g.id === req.params.id);
    if (!guide) return res.status(404).json({ error: 'Tactic not found' });
    res.json({
      id: guide.id,
      name: guide.name,
      category: guide.category,
      icon: guide.icon,
      description: guide.description,
      file: guide.file,
      wordCount: guide.wordCount,
      html: marked.parse(guide.content),
      raw: guide.content,
    });
  });

  app.post('/api/kb/save', (req, res) => {
    try {
      const serviceIndex = kbIndex.getServiceIndex();
      const tacticsIndex = kbIndex.getTacticsIndex();
      const { id, view, content } = req.body;
      if (!id || !view || typeof content !== 'string') {
        return res.status(400).json({ error: 'id, view, and content are required' });
      }
      const index = view === 'services' ? serviceIndex : tacticsIndex;
      const entry = index.find(e => e.id === id);
      if (!entry) return res.status(404).json({ error: 'File not found in index' });
      fs.writeFileSync(entry.filepath, content, 'utf8');
      entry.content = content;
      console.log(`[PRAGMA] Saved edit: ${entry.filepath}`);
      res.json({ ok: true, file: entry.file });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/kb/create', (req, res) => {
    try {
      const { view, filename, category } = req.body || {};
      const isServices = view === 'services';
      const isTactics = view === 'tactics';
      if (!isServices && !isTactics) {
        return res.status(400).json({ error: 'view must be services or tactics' });
      }

      const safeFilename = normalizeKbFilename(filename);
      if (!safeFilename) return res.status(400).json({ error: 'A valid filename is required' });

      const rootDir = isServices ? servicesDir : tacticsDir;
      const categoryDir = safeCategoryPath(category);
      const targetDir = path.resolve(rootDir, categoryDir || '.');
      const rootResolved = path.resolve(rootDir);
      if (!targetDir.startsWith(rootResolved)) {
        return res.status(403).json({ error: 'Invalid category path' });
      }

      fs.mkdirSync(targetDir, { recursive: true });

      const filePath = path.join(targetDir, safeFilename);
      if (fs.existsSync(filePath)) return res.status(409).json({ error: 'File already exists' });

      const title = path.basename(safeFilename, '.md')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      const initialContent = `# ${title}\n\n## Overview\n\n`;
      fs.writeFileSync(filePath, initialContent, 'utf8');

      if (isServices) buildIndex();
      else buildTacticsIndex();

      const id = isServices
        ? metaFromFilename(safeFilename).id
        : path.basename(safeFilename, '.md').toLowerCase().replace(/[^a-z0-9]+/g, '-');

      const relativeBase = path.relative(rootDir, filePath);
      console.log(`[PRAGMA] Created KB file: ${filePath}`);
      res.json({ ok: true, file: relativeBase, id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/category/rename', (req, res) => {
    try {
      const { view, folder, nextName } = req.body || {};
      const isServices = view === 'services';
      const isTactics = view === 'tactics';
      if (!isServices && !isTactics) {
        return res.status(400).json({ error: 'view must be services or tactics' });
      }

      const safeFolder = safeCategoryPath(folder);
      if (!safeFolder) return res.status(400).json({ error: 'A folder-backed category is required' });
      if (safeFolder.includes(path.sep)) {
        return res.status(400).json({ error: 'Only top-level categories can be renamed' });
      }

      const safeNext = normalizeFolderName(nextName);
      if (!safeNext) return res.status(400).json({ error: 'A valid category name is required' });
      if (safeNext === safeFolder) return res.json({ ok: true, folder: safeFolder });

      const rootDir = isServices ? servicesDir : tacticsDir;
      const srcDir = path.resolve(rootDir, safeFolder);
      const dstDir = path.resolve(rootDir, safeNext);
      const rootResolved = path.resolve(rootDir);
      if (!srcDir.startsWith(rootResolved) || !dstDir.startsWith(rootResolved)) {
        return res.status(403).json({ error: 'Invalid category path' });
      }
      if (!fs.existsSync(srcDir)) return res.status(404).json({ error: 'Category folder not found' });
      if (!fs.statSync(srcDir).isDirectory()) {
        return res.status(400).json({ error: 'Category path is not a directory' });
      }
      if (fs.existsSync(dstDir)) {
        return res.status(409).json({ error: 'A category with that name already exists' });
      }

      fs.renameSync(srcDir, dstDir);
      if (isServices) buildIndex();
      else buildTacticsIndex();

      console.log(`[PRAGMA] Renamed category: ${srcDir} -> ${dstDir}`);
      res.json({ ok: true, folder: safeNext });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = { registerKbRoutes };
