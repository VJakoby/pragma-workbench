'use strict';

const fs = require('fs');
const path = require('path');

function registerKbRoutes(app, deps) {
  const {
    marked,
    renderMarkdown,
    kbIndex,
    kbDir,
    servicesDir,
    tacticsDir,
    buildIndex,
    buildTacticsIndex,
    metaFromFilename,
    normalizeKbFilename,
    safeCategoryPath,
    normalizeFolderName,
    unifiedSearchIndex,
  } = deps;

  function getServiceCategoryRoots() {
    return [kbDir, servicesDir].filter((dir, idx, arr) => dir && arr.indexOf(dir) === idx);
  }

  function isWithinRoot(targetPath, rootPath) {
    const resolvedTarget = path.resolve(targetPath);
    const resolvedRoot = path.resolve(rootPath);
    return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`);
  }

  function canPreviewKbFile(filePath) {
    if (!filePath) return false;
    return isWithinRoot(filePath, kbDir) && path.extname(filePath).toLowerCase() === '.md';
  }

  function getRootKbSection(folder) {
    const sections = kbIndex.getRootKbSections ? kbIndex.getRootKbSections() : [];
    return sections.find(section => (section.folder || '') === String(folder || '')) || null;
  }

  function resolveServiceCategoryDir(folder) {
    const roots = getServiceCategoryRoots();
    const matches = roots
      .map(root => ({ root, dir: path.resolve(root, folder) }))
      .filter(({ root, dir }) => dir.startsWith(path.resolve(root)) && fs.existsSync(dir) && fs.statSync(dir).isDirectory());
    if (matches.length > 1) {
      return { error: 'Category exists in multiple knowledge roots; rename manually to avoid ambiguity.' };
    }
    return matches[0] || null;
  }

  function getServiceWriteRoot(categoryDir) {
    const roots = getServiceCategoryRoots();
    if (!categoryDir) {
      return fs.existsSync(servicesDir) ? servicesDir : kbDir;
    }
    for (const root of roots) {
      const target = path.resolve(root, categoryDir);
      if (target.startsWith(path.resolve(root)) && fs.existsSync(target) && fs.statSync(target).isDirectory()) {
        return root;
      }
    }
    return kbDir;
  }

  app.get('/api/services', (req, res) => {
    const serviceIndex = kbIndex.getServiceIndex();
    const categories = kbIndex.getServiceCategories ? kbIndex.getServiceCategories() : [];
    res.json({
      total: serviceIndex.length,
      categories,
      services: serviceIndex.map(({ id, name, port, category, icon, description, file, wordCount, folder }) =>
        ({ id, name, port, category, icon, description, file, wordCount, folder })),
    });
  });

  app.get('/api/kb-sections', (req, res) => {
    const sections = kbIndex.getRootKbSections ? kbIndex.getRootKbSections() : [];
    res.json({
      total: sections.length,
      sections: sections.map(section => ({
        folder: section.folder,
        label: section.label,
        count: Array.isArray(section.items) ? section.items.length : 0,
      })),
    });
  });

  app.get('/api/kb-palette-index', (req, res) => {
    const serviceIndex = kbIndex.getServiceIndex();
    const tacticsIndex = kbIndex.getTacticsIndex();
    const rootKbSections = kbIndex.getRootKbSections ? kbIndex.getRootKbSections() : [];
    const items = [
      ...serviceIndex.map(entry => ({
        id: entry.id,
        view: 'services',
        type: 'service',
        name: entry.name,
        category: entry.category || '',
        folder: entry.folder || '',
        icon: entry.icon || '',
        description: entry.description || '',
        content: entry.content || '',
      })),
      ...tacticsIndex.map(entry => ({
        id: entry.id,
        view: 'tactics',
        type: 'tactic',
        name: entry.name,
        category: entry.category || '',
        folder: entry.folder || '',
        icon: entry.icon || '',
        description: entry.description || '',
        content: entry.content || '',
      })),
      ...rootKbSections.flatMap(section =>
        (section.items || []).map(entry => ({
          id: entry.id,
          view: `kb:${section.folder}`,
          type: 'knowledge',
          name: entry.name,
          category: entry.category || '',
          folder: section.folder || '',
          icon: entry.icon || '',
          description: entry.description || '',
          content: entry.content || '',
        }))
      ),
    ];
    res.json({ total: items.length, items });
  });

  app.get('/api/unified-search-index', (req, res) => {
    if (!unifiedSearchIndex) {
      return res.status(503).json({ error: 'Unified search index not available' });
    }
    const items = unifiedSearchIndex.getIndexData({ fresh: true });
    res.json({ total: items.length, items });
  });

  app.get('/api/kb-section/:folder', (req, res) => {
    const section = getRootKbSection(req.params.folder);
    if (!section) return res.status(404).json({ error: 'KB section not found' });
    res.json({
      folder: section.folder,
      label: section.label,
      total: section.items.length,
      items: section.items.map(({ id, name, category, icon, description, file, wordCount, folder, subfolder }) => ({
        id, name, category, icon, description, file, wordCount, folder, subfolder,
      })),
    });
  });

  app.get('/api/kb-section/:folder/:id', (req, res) => {
    const section = getRootKbSection(req.params.folder);
    if (!section) return res.status(404).json({ error: 'KB section not found' });
    const item = section.items.find(entry => entry.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'KB document not found' });
    res.json({
      id: item.id,
      name: item.name,
      category: item.category,
      icon: item.icon,
      description: item.description,
      file: item.file,
      wordCount: item.wordCount,
      folder: item.folder,
      subfolder: item.subfolder || '',
      html: renderMarkdown(item.content),
      raw: item.content,
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
      resolved = path.resolve(fileParam);
      if (!canPreviewKbFile(resolved)) return res.status(403).json({ error: 'Access denied' });
    } else {
      // Preserve relative path so subdirectory files still resolve correctly.
      resolved = path.resolve(servicesDir, fileParam);
      if (!canPreviewKbFile(resolved)) return res.status(403).json({ error: 'Access denied' });
    }
    if (!fs.existsSync(resolved)) return res.status(404).json({ error: `File not found: ${resolved}` });
    try {
      const content = fs.readFileSync(resolved, 'utf8');
      res.json({ html: renderMarkdown(content), raw: content });
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
        source_name: `knowledge-base/${svc.file}`,
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
      html: renderMarkdown(svc.content),
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
      html: renderMarkdown(guide.content),
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
      html: renderMarkdown(guide.content),
      raw: guide.content,
    });
  });

  app.post('/api/kb/save', (req, res) => {
    try {
      const serviceIndex = kbIndex.getServiceIndex();
      const tacticsIndex = kbIndex.getTacticsIndex();
      const rootKbSections = kbIndex.getRootKbSections ? kbIndex.getRootKbSections() : [];
      const { id, view, content } = req.body;
      if (!id || !view || typeof content !== 'string') {
        return res.status(400).json({ error: 'id, view, and content are required' });
      }
      const index = view === 'services'
        ? serviceIndex
        : view === 'tactics'
          ? tacticsIndex
          : view.startsWith('kb:')
            ? ((rootKbSections.find(section => `kb:${section.folder}` === view)?.items) || [])
            : [];
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
      const isKnowledge = view === 'knowledge';
      if (!isServices && !isTactics && !isKnowledge) {
        return res.status(400).json({ error: 'view must be services, tactics, or knowledge' });
      }

      const safeFilename = normalizeKbFilename(filename);
      if (!safeFilename) return res.status(400).json({ error: 'A valid filename is required' });

      const categoryDir = safeCategoryPath(category);
      let rootDir = isServices ? getServiceWriteRoot(categoryDir) : isTactics ? tacticsDir : kbDir;
      let targetDir = path.resolve(rootDir, categoryDir || '.');
      if (isKnowledge && categoryDir) {
        const [sectionFolder, ...restParts] = categoryDir.split(path.sep).filter(Boolean);
        const section = getRootKbSection(sectionFolder);
        if (section?.dirpath) {
          rootDir = section.dirpath;
          targetDir = path.resolve(rootDir, restParts.join(path.sep) || '.');
        }
      }
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

      if (isServices || isKnowledge) buildIndex();
      else buildTacticsIndex();

      let id = isServices
        ? metaFromFilename(safeFilename).id
        : path.basename(safeFilename, '.md').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      if (isKnowledge) {
        const safeFolder = (categoryDir || '').split(path.sep)[0] || '';
        const section = getRootKbSection(safeFolder);
        const created = section?.items?.find(item => item.filepath === filePath);
        if (created?.id) id = created.id;
      }

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

      const rootDir = isServices ? null : tacticsDir;
      let srcDir;
      let dstDir;
      let rootResolved;

      if (isServices) {
        const resolved = resolveServiceCategoryDir(safeFolder);
        if (resolved?.error) return res.status(409).json({ error: resolved.error });
        if (!resolved) return res.status(404).json({ error: 'Category folder not found' });
        srcDir = resolved.dir;
        rootResolved = path.resolve(resolved.root);
        dstDir = path.resolve(resolved.root, safeNext);
      } else {
        srcDir = path.resolve(rootDir, safeFolder);
        dstDir = path.resolve(rootDir, safeNext);
        rootResolved = path.resolve(rootDir);
        if (!fs.existsSync(srcDir)) return res.status(404).json({ error: 'Category folder not found' });
        if (!fs.statSync(srcDir).isDirectory()) {
          return res.status(400).json({ error: 'Category path is not a directory' });
        }
      }

      if (!srcDir.startsWith(rootResolved) || !dstDir.startsWith(rootResolved)) {
        return res.status(403).json({ error: 'Invalid category path' });
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
