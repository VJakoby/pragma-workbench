// ═══════════════════════════════════════════════
// PORT / SERVICE QUICK-LOG
// ═══════════════════════════════════════════════
let _portParsed = [];
let _pathParsed = [];
let _lootParsed = [];
let _activeSvcTab = 'ports';
let _activeLootType = 'cleartext';

const SVC_TAB_ORDER = ['ports', 'paths', 'loot'];

function updateSvcPopoverLayout() {
  const popover = document.getElementById('svcPopover');
  if (!popover) return;
  const importOpen = ['portPastePanel', 'pathPastePanel', 'lootPastePanel'].some(id =>
    document.getElementById(id)?.style.display === 'flex'
  );
  popover.classList.toggle('svc-popover-import-open', importOpen);
  popover.classList.toggle('svc-popover-loot-open', _activeSvcTab === 'loot');
}

function switchSvcTabByArrow(dir) {
  const popover = document.getElementById('svcPopover');
  if (!popover || !popover.classList.contains('open')) return;
  const active = document.activeElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
  const cur = SVC_TAB_ORDER.indexOf(_activeSvcTab);
  if (cur === -1) return;
  const next = (cur + dir + SVC_TAB_ORDER.length) % SVC_TAB_ORDER.length;
  switchSvcTab(SVC_TAB_ORDER[next]);
}

function switchSvcTab(tab) {
  _activeSvcTab = tab;
  document.getElementById('svcTabPorts').classList.toggle('active', tab === 'ports');
  document.getElementById('svcTabPaths').classList.toggle('active', tab === 'paths');
  document.getElementById('svcTabLoot').classList.toggle('active', tab === 'loot');
  document.getElementById('svcPanelPorts').style.display = tab === 'ports' ? 'block' : 'none';
  document.getElementById('svcPanelPaths').style.display = tab === 'paths' ? 'block' : 'none';
  document.getElementById('svcPanelLoot').style.display = tab === 'loot' ? 'block' : 'none';
  if (tab === 'ports') { renderSvcLogTable(); setTimeout(() => document.getElementById('svcQuickInput')?.focus(), 40); }
  if (tab === 'paths') { renderPathTable(); setTimeout(() => document.getElementById('pathQuickInput')?.focus(), 40); }
  if (tab === 'loot') {
    renderLootTable();
    setTimeout(() => {
      const hi = document.getElementById('lootHostInput');
      if (hi && !hi.value) {
        const ip = getIP();
        if (ip !== '<IP>') hi.value = ip;
      }
      document.getElementById('lootCredInput')?.focus();
    }, 40);
  }
  renderSvcClearAction();
  updateSvcPopoverLayout();
}

function updateSvcTabCounts() {
  const ports = getSessionServices().length;
  const paths = getSessionPaths().length;
  const loot = getSessionLoot().length;
  const cp = document.getElementById('svcTabCountPorts');
  const ch = document.getElementById('svcTabCountPaths');
  const cl = document.getElementById('svcTabCountLoot');
  if (cp) cp.textContent = ports || '';
  if (ch) ch.textContent = paths || '';
  if (cl) cl.textContent = loot || '';

  const btn = document.getElementById('svcTopbarCount');
  if (btn) {
    const total = ports + paths + loot;
    btn.textContent = total || '';
    btn.classList.toggle('has-entries', total > 0);
  }
  renderSvcClearAction();
}

function getActiveQuickLogEntries() {
  if (_activeSvcTab === 'paths') return getSessionPaths();
  if (_activeSvcTab === 'loot') return getSessionLoot();
  return getSessionServices();
}

function renderSvcClearAction() {
  const btn = document.getElementById('svcClearBtn');
  if (!btn) return;
  const labels = { ports: 'Clear Ports', paths: 'Clear Paths', loot: 'Clear Loot' };
  const count = getActiveQuickLogEntries().length;
  btn.textContent = count ? `${labels[_activeSvcTab] || 'Clear All'} (${count})` : (labels[_activeSvcTab] || 'Clear All');
  btn.disabled = !activeSessionId || count === 0;
}

async function clearActiveQuickLog() {
  if (!activeSessionId) return;
  const sess = sessions[activeSessionId];
  if (!sess) return;

  const labels = {
    ports: { title: 'Clear Ports', key: 'services', noun: 'port/service entries' },
    paths: { title: 'Clear Paths', key: 'paths', noun: 'path entries' },
    loot: { title: 'Clear Loot', key: 'loot', noun: 'loot entries' },
  };
  const config = labels[_activeSvcTab] || labels.ports;
  const entries = Array.isArray(sess[config.key]) ? sess[config.key] : [];
  if (!entries.length) return;

  try {
    await showConfirmDialog({
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
      title: config.title,
      bigIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
      description: `Remove all ${entries.length} ${config.noun} from this session?`,
      confirmLabel: 'Clear All',
      danger: true,
    });
  } catch {
    return;
  }

  sess[config.key] = [];
  saveNotes();
  renderSvcLogTable();
  renderPathTable();
  renderLootTable();
  updateSvcTabCounts();
  showToast(`✓ Cleared ${config.noun}`);
}

function toggleToolPaste(kind) {
  const panelMap = {
    ports: 'portPastePanel',
    paths: 'pathPastePanel',
    loot: 'lootPastePanel',
  };
  const toggleMap = {
    ports: 'portPasteToggle',
    paths: 'pathPasteToggle',
    loot: 'lootPasteToggle',
  };
  const inputMap = {
    ports: 'portPasteInput',
    paths: 'pathPasteInput',
    loot: 'lootPasteInput',
  };
  const panel = document.getElementById(panelMap[kind]);
  const toggle = document.getElementById(toggleMap[kind]);
  if (!panel || !toggle) return;
  const isOpen = panel.style.display === 'flex';
  panel.style.display = isOpen ? 'none' : 'flex';
  toggle.style.color = isOpen ? '' : 'var(--accent)';
  toggle.style.borderColor = isOpen ? '' : 'var(--accent)';
  if (!isOpen) {
    document.getElementById(inputMap[kind])?.focus();
  } else {
    resetPastePanel(kind);
  }
  updateSvcPopoverLayout();
}

function resetPastePanel(kind) {
  if (kind === 'ports') {
    document.getElementById('portPasteInput').value = '';
    document.getElementById('portParsePreview').style.display = 'none';
    document.getElementById('portCommitBtn').style.display = 'none';
    _portParsed = [];
  } else {
    if (kind === 'loot') {
      document.getElementById('lootPasteInput').value = '';
      document.getElementById('lootParsePreview').style.display = 'none';
      document.getElementById('lootCommitBtn').style.display = 'none';
      _lootParsed = [];
      return;
    }
    document.getElementById('pathPasteInput').value = '';
    document.getElementById('pathParsePreview').style.display = 'none';
    document.getElementById('pathCommitBtn').style.display = 'none';
    _pathParsed = [];
  }
}

function parsePortOutput(text) {
  const results = [];
  const seen = new Set();

  for (const raw of text.split('\n')) {
    const line = raw.trim();

    const nmapLine = line.match(/^(\d+)\/(tcp|udp|sctp)\s+open\s+(\S+)(?:\s+(.+))?$/i);
    if (nmapLine) {
      const port = nmapLine[1];
      const proto = nmapLine[2].toLowerCase();
      if (seen.has(`${port}/${proto}`)) continue;
      seen.add(`${port}/${proto}`);
      let service = nmapLine[3] || '';
      let version = (nmapLine[4] || '').replace(/\s*\(\([^)]*\)\)/g, '').replace(/\s*\(protocol \d[\d.]*\)/i, '').trim();
      if (service.startsWith('ssl/')) { version = (`SSL ${version}`).trim(); service = service.slice(4); }
      results.push({ port, proto, service, version: version.slice(0, 80), notes: '' });
      continue;
    }

    const grepPorts = line.match(/Ports:\s*(.+)/i);
    if (grepPorts) {
      for (const entry of grepPorts[1].split(',')) {
        const m = entry.trim().match(/^(\d+)\/open\/(tcp|udp|sctp)\/+(\S*)\/+([^/]*)\//i);
        if (!m) continue;
        const key = `${m[1]}/${m[2].toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({ port: m[1], proto: m[2].toLowerCase(), service: m[3] || '', version: m[4].trim().slice(0, 80), notes: '' });
      }
      continue;
    }

    const rustscan = line.match(/^Open\s+[\d.]+:(\d+)$/i);
    if (rustscan) {
      const port = rustscan[1];
      const proto = 'tcp';
      if (seen.has(`${port}/${proto}`)) continue;
      seen.add(`${port}/${proto}`);
      results.push({ port, proto, service: '', version: '', notes: '' });
      continue;
    }

    const masscan = line.match(/^Discovered open port\s+(\d+)\/(tcp|udp)\s+on\s+/i);
    if (masscan) {
      const port = masscan[1];
      const proto = masscan[2].toLowerCase();
      if (seen.has(`${port}/${proto}`)) continue;
      seen.add(`${port}/${proto}`);
      results.push({ port, proto, service: '', version: '', notes: '' });
      continue;
    }

    const masscanList = line.match(/^open\s+(tcp|udp)\s+(\d+)\s+[\d.]+/i);
    if (masscanList) {
      const proto = masscanList[1].toLowerCase();
      const port = masscanList[2];
      if (seen.has(`${port}/${proto}`)) continue;
      seen.add(`${port}/${proto}`);
      results.push({ port, proto, service: '', version: '', notes: '' });
    }
  }

  return results.sort((a, b) => (parseInt(a.port) || 0) - (parseInt(b.port) || 0));
}

function parseAndPreviewPorts() {
  const raw = document.getElementById('portPasteInput').value;
  const preview = document.getElementById('portParsePreview');
  const commitBtn = document.getElementById('portCommitBtn');
  _portParsed = parsePortOutput(raw);
  preview.style.display = 'block';
  if (!_portParsed.length) {
    preview.innerHTML = '<div class="nmap-preview-none">No open ports found — check format (nmap · rustscan · masscan).</div>';
    commitBtn.style.display = 'none';
    return;
  }
  const existing = new Set(getSessionServices().map(s => `${s.port}/${s.proto}`));
  const fresh = _portParsed.filter(r => !existing.has(`${r.port}/${r.proto}`));
  const dupes = _portParsed.length - fresh.length;
  let html = `<div class="nmap-preview-hdr"><span>${_portParsed.length}</span> port${_portParsed.length !== 1 ? 's' : ''} found`;
  if (dupes) html += ` &nbsp;·&nbsp; <span style="color:var(--muted)">${dupes} already logged</span>`;
  html += '</div><table class="svc-table" style="margin-bottom:4px"><thead><tr><th>Port</th><th>Service</th><th>Version</th></tr></thead><tbody>';
  html += _portParsed.map(r => {
    const isDupe = existing.has(`${r.port}/${r.proto}`);
    return `<tr style="${isDupe ? 'opacity:0.4' : ''}"><td>${esc(r.port)}${r.proto !== 'tcp' ? `<span style="color:var(--muted);font-weight:400">/${esc(r.proto)}</span>` : ''}</td><td>${esc(r.service || '—')}</td><td style="color:var(--text2)">${esc(r.version || '')}</td></tr>`;
  }).join('');
  html += '</tbody></table>';
  preview.innerHTML = html;
  if (fresh.length > 0) {
    commitBtn.style.display = 'block';
    commitBtn.textContent = `＋ Add ${fresh.length} new`;
  } else {
    commitBtn.style.display = 'none';
    preview.innerHTML += '<div class="nmap-preview-none">All ports already logged.</div>';
  }
}

function commitPortParse() {
  if (!activeSessionId || !_portParsed.length) return;
  if (!sessions[activeSessionId].services) sessions[activeSessionId].services = [];
  const existing = new Set(sessions[activeSessionId].services.map(s => `${s.port}/${s.proto}`));
  let added = 0;
  let syncedNetworkNote = null;
  for (const r of _portParsed) {
    if (existing.has(`${r.port}/${r.proto}`)) continue;
    const entry = { id: `svc_${Date.now()}_${added}`, target_id: activeTargetId || null, port: r.port, proto: r.proto, service: r.service, version: r.version, notes: '', added: Date.now() };
    sessions[activeSessionId].services.push(entry);
    const note = syncServiceEntryToNetworkEnumerationNote(entry);
    if (note) syncedNetworkNote = note;
    added++;
  }
  saveNotes();
  renderSvcLogTable();
  updateSvcTabCounts();
  applySyncedNoteUpdate(syncedNetworkNote);
  showToast(`✓ Added ${added} port${added !== 1 ? 's' : ''}`);
  toggleToolPaste('ports');
}

function parsePathOutput(text) {
  const results = [];
  const seen = new Set();
  const lines = text.split('\n');
  const ffufMeta = {};

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].trim().match(/^\[Status:\s*(\d+),\s*Size:\s*(\d+)/i);
    if (m) {
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        if (/^\|\s*URL\s*\|/i.test(lines[j].trim())) {
          ffufMeta[j] = { status: m[1], size: m[2] };
          break;
        }
      }
    }
  }

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx].trim();
    if (!line || line.startsWith('#')) continue;

    const gobuster = line.match(/^(\S+)\s+\(Status:\s*(\d+)\)(?:\s*\[Size:\s*(\d+)\])?(?:\s*\[-->\s*([^\]]+)\])?/i);
    if (gobuster && gobuster[1].startsWith('/')) {
      const path = gobuster[1];
      const status = gobuster[2];
      const size = gobuster[3] || '';
      const redir = gobuster[4] ? `→ ${gobuster[4].trim()}` : '';
      if (seen.has(path)) continue;
      seen.add(path);
      results.push({ path, status, size, notes: redir });
      continue;
    }

    const gobusterDns = line.match(/^Found:\s+(\S+)(?:\s+Status:\s*(\d+))?/i);
    if (gobusterDns && !gobusterDns[1].startsWith('/') && gobusterDns[1].includes('.')) {
      const path = gobusterDns[1];
      const status = gobusterDns[2] || '';
      if (seen.has(path)) continue;
      seen.add(path);
      results.push({ path, status, size: '', notes: '' });
      continue;
    }

    if (/^\[Status:\s*\d+/i.test(line)) continue;

    const ffufUrl = line.match(/^\|\s*URL\s*\|\s*(https?:\/\/[^\s]+)/i);
    if (ffufUrl) {
      try {
        const u = new URL(ffufUrl[1]);
        const path = u.pathname + (u.search || '');
        if (seen.has(path)) continue;
        seen.add(path);
        const meta = ffufMeta[idx] || {};
        results.push({ path, status: meta.status || '', size: meta.size || '', notes: '' });
      } catch (_) {}
      continue;
    }

    const ffufCompact = line.match(/^(\S+)\s+\[Status:\s*(\d+),\s*Size:\s*(\d+)/i);
    if (ffufCompact && ffufCompact[1].startsWith('/')) {
      const path = ffufCompact[1];
      const status = ffufCompact[2];
      const size = ffufCompact[3];
      if (seen.has(path)) continue;
      seen.add(path);
      results.push({ path, status, size, notes: '' });
      continue;
    }

    const dirbFile = line.match(/^(?:File|Dir) found:\s+(\S+?)(?:\s+-\s+(\d+))?$/i);
    if (dirbFile) {
      const path = dirbFile[1];
      const status = dirbFile[2] || '';
      if (seen.has(path)) continue;
      seen.add(path);
      results.push({ path, status, size: '', notes: '' });
      continue;
    }

    const plainPath = line.match(/^(\/\S*)$/);
    if (plainPath) {
      const path = plainPath[1];
      if (seen.has(path)) continue;
      seen.add(path);
      results.push({ path, status: '', size: '', notes: '' });
    }
  }

  return results;
}

function statusClass(code) {
  if (!code) return 'path-status-x';
  const c = parseInt(code);
  if (c >= 200 && c < 300) return 'path-status-2';
  if (c >= 300 && c < 400) return 'path-status-3';
  if (c >= 400 && c < 500) return 'path-status-4';
  return 'path-status-x';
}

function parseAndPreviewPaths() {
  const raw = document.getElementById('pathPasteInput').value;
  const preview = document.getElementById('pathParsePreview');
  const commitBtn = document.getElementById('pathCommitBtn');
  _pathParsed = parsePathOutput(raw);
  preview.style.display = 'block';
  if (!_pathParsed.length) {
    preview.innerHTML = '<div class="nmap-preview-none">No paths found — check format (gobuster · ffuf · dirbuster).</div>';
    commitBtn.style.display = 'none';
    return;
  }
  const existing = new Set(getSessionPaths().map(p => p.path));
  const fresh = _pathParsed.filter(r => !existing.has(r.path));
  const dupes = _pathParsed.length - fresh.length;
  let html = `<div class="nmap-preview-hdr"><span>${_pathParsed.length}</span> path${_pathParsed.length !== 1 ? 's' : ''} found`;
  if (dupes) html += ` &nbsp;·&nbsp; <span style="color:var(--muted)">${dupes} already logged</span>`;
  html += '</div><table class="path-table" style="margin-bottom:4px"><thead><tr><th>Status</th><th>Path</th><th>Size</th></tr></thead><tbody>';
  html += _pathParsed.map(r => {
    const isDupe = existing.has(r.path);
    return `<tr style="${isDupe ? 'opacity:0.4' : ''}"><td><span class="path-status ${statusClass(r.status)}">${esc(r.status || '—')}</span></td><td style="color:var(--text);word-break:break-all">${esc(r.path)}</td><td style="color:var(--muted)">${esc(r.size)}</td></tr>`;
  }).join('');
  html += '</tbody></table>';
  preview.innerHTML = html;
  if (fresh.length > 0) {
    commitBtn.style.display = 'block';
    commitBtn.textContent = `＋ Add ${fresh.length} new`;
  } else {
    commitBtn.style.display = 'none';
    preview.innerHTML += '<div class="nmap-preview-none">All paths already logged.</div>';
  }
}

function commitPathParse() {
  if (!activeSessionId || !_pathParsed.length) return;
  if (!sessions[activeSessionId].paths) sessions[activeSessionId].paths = [];
  const existing = new Set(sessions[activeSessionId].paths.map(p => p.path));
  let added = 0;
  for (const r of _pathParsed) {
    if (existing.has(r.path)) continue;
    sessions[activeSessionId].paths.push({ id: `path_${Date.now()}_${added}`, target_id: activeTargetId || null, path: r.path, status: r.status, size: r.size, notes: r.notes, added: Date.now() });
    added++;
  }
  saveNotes();
  renderPathTable();
  updateSvcTabCounts();
  showToast(`✓ Added ${added} path${added !== 1 ? 's' : ''}`);
  toggleToolPaste('paths');
}

function addPathLog() {
  const input = document.getElementById('pathQuickInput');
  const raw = (input && input.value) ? input.value.trim() : '';
  if (!raw || !activeSessionId) { if (input) input.focus(); return; }
  let status = '';
  let path = '';
  let notes = '';
  const m = raw.match(/^(\d{3})\s+(\S+)(?:\s+(.+))?$/);
  if (m) { status = m[1]; path = m[2]; notes = m[3] || ''; }
  else { path = raw.split(/\s+/)[0]; notes = raw.slice(path.length).trim(); }
  if (!path.startsWith('/') && !path.includes('.')) { input.focus(); return; }
  if (!sessions[activeSessionId].paths) sessions[activeSessionId].paths = [];
  sessions[activeSessionId].paths.push({ id: `path_${Date.now()}`, target_id: activeTargetId || null, path, status, size: '', notes, added: Date.now() });
  input.value = '';
  input.focus();
  saveNotes();
  renderPathTable();
  updateSvcTabCounts();
}

function deletePathLog(pathId) {
  if (!activeSessionId) return;
  sessions[activeSessionId].paths = (sessions[activeSessionId].paths || []).filter(p => p.id !== pathId);
  saveNotes();
  renderPathTable();
  updateSvcTabCounts();
}

function updatePathNotes(pathId, val) {
  if (!activeSessionId) return;
  const p = (sessions[activeSessionId].paths || []).find(path => path.id === pathId);
  if (p) { p.notes = val; saveNotes(); }
}

function getSessionPaths() {
  if (!activeSessionId || !sessions[activeSessionId]) return [];
  return sessions[activeSessionId].paths || [];
}

function renderPathTable() {
  const el = document.getElementById('pathLogTable');
  if (!el) return;
  updateSvcTabCounts();
  const paths = [...getSessionPaths()].sort((a, b) => (a.path < b.path ? -1 : 1));
  if (!paths.length) {
    el.innerHTML = '<div class="svc-empty">No paths logged — add one above or import tool output</div>';
    return;
  }
  el.innerHTML = `<table class="path-table">
    <thead><tr><th>Status</th><th>Path</th><th>Notes</th><th></th></tr></thead>
    <tbody>${paths.map(p => `<tr>
      <td><span class="path-status ${statusClass(p.status)}">${esc(p.status || '—')}</span></td>
      <td style="color:var(--text);word-break:break-all">${esc(p.path)}</td>
      <td><input class="svc-notes-cell" type="text" value="${esc(p.notes || '')}" placeholder="notes…"
        onclick="event.stopPropagation()"
        onchange="updatePathNotes('${p.id}',this.value)" onblur="updatePathNotes('${p.id}',this.value)"></td>
      <td><button class="svc-del-btn" onclick="event.stopPropagation();deletePathLog('${p.id}')" title="Remove">✕</button></td>
    </tr>`).join('')}
    </tbody></table>`;
}

function parseSvcInput(raw) {
  const str = raw.trim();
  if (!str) return null;
  let port = '';
  let proto = 'tcp';
  let service = '';
  let version = '';
  let notes = '';
  const portProtoMatch = str.match(/^(\d+)(?:\/(tcp|udp|sctp))?/i);
  if (!portProtoMatch) { service = str; return { port, proto, service, version, notes }; }
  port = portProtoMatch[1];
  proto = (portProtoMatch[2] || 'tcp').toLowerCase();
  const tokens = str.slice(portProtoMatch[0].length).trim().split(/\s+/).filter(Boolean);
  if (tokens.length >= 1) service = tokens[0];
  if (tokens.length >= 2) version = tokens[1];
  if (tokens.length >= 3) notes = tokens.slice(2).join(' ');
  return { port, proto, service, version, notes };
}

function getSessionServices() {
  if (!activeSessionId || !sessions[activeSessionId]) return [];
  return sessions[activeSessionId].services || [];
}

function escapeMarkdownTableCell(value) {
  return String(value || '').replace(/\|/g, '\\|').trim();
}

function parseServiceForNetworkRow(entry) {
  if (!entry) return null;
  if (!String(entry.port || '').trim()) return null;
  return {
    port: escapeMarkdownTableCell(entry.port),
    proto: escapeMarkdownTableCell(entry.proto || 'tcp'),
    service: escapeMarkdownTableCell(entry.service),
    version: escapeMarkdownTableCell(entry.version),
    notes: escapeMarkdownTableCell(entry.notes),
  };
}

function buildNetworkEnumerationTableRow(row) {
  return `| ${row.port} | ${row.proto} | ${row.service} | ${row.version} | ${row.notes} |`;
}

function getSessionTargetById(targetId) {
  if (!activeSessionId || !targetId || !sessions[activeSessionId]) return null;
  const targets = sessions[activeSessionId].targets || [];
  return targets.find(target => target.id === targetId) || null;
}

function populateNetworkEnumerationOverview(body, target = null) {
  const resolvedTarget = target || getActiveTarget() || null;
  const ip = resolvedTarget?.ip || '';
  const domain = resolvedTarget?.domain || '';
  const hostname = resolvedTarget ? (resolvedTarget.label || resolvedTarget.ip || resolvedTarget.domain || '') : '';
  const replacements = {
    IP: ip,
    Domain: domain,
    Hostname: hostname,
  };

  return String(body || '')
    .split('\n')
    .map((line) => {
      const match = line.match(/^\|\s*(IP|Domain|Hostname)\s*\|\s*(.*?)\s*\|$/i);
      if (!match) return line;
      const field = match[1];
      const current = String(match[2] || '').trim();
      const next = replacements[field] || '';
      if (current || !next) return line;
      return `| ${field} | ${next} |`;
    })
    .join('\n');
}

function upsertNetworkEnumerationRowIntoBody(body, row) {
  const lines = String(body || '').split('\n');
  const headerIdx = lines.findIndex(line => /^\|\s*Port\s*\|\s*Proto\s*\|\s*Service\s*\|\s*Version\s*\|\s*Notes\s*\|$/i.test(line.trim()));
  if (headerIdx === -1) return null;
  const separatorIdx = headerIdx + 1;
  if (!lines[separatorIdx] || !/^\|\s*-+/.test(lines[separatorIdx].trim())) return null;

  let insertAt = separatorIdx + 1;
  while (insertAt < lines.length && /^\|/.test(lines[insertAt].trim())) insertAt++;

  const newRow = buildNetworkEnumerationTableRow(row);
  const existingRows = lines.slice(separatorIdx + 1, insertAt).map(line => line.trim());
  if (existingRows.includes(newRow.trim())) return body;

  const placeholderIdx = lines.slice(separatorIdx + 1, insertAt).findIndex(line =>
    /^\|\s*\|\s*\|\s*\|\s*\|\s*\|$/.test(line.replace(/\s/g, ''))
  );
  if (placeholderIdx !== -1) {
    lines[separatorIdx + 1 + placeholderIdx] = newRow;
  } else {
    lines.splice(insertAt, 0, newRow);
  }
  return lines.join('\n');
}

function findTargetNetworkEnumerationNote(targetId) {
  if (!activeSessionId || !targetId) return null;
  return Object.values(notes).find(note =>
    note.session_id === activeSessionId &&
    note.type === 'network-enumeration' &&
    note.target_id === targetId
  ) || null;
}

function ensureTargetNetworkEnumerationNote(targetId) {
  if (!NOTE_TEMPLATES?.['network-enumeration'] || !activeSessionId || !targetId) return null;
  const target = getSessionTargetById(targetId);
  if (!target) return null;

  let note = findTargetNetworkEnumerationNote(targetId);
  if (note) return note;

  const id = 'note_' + Date.now();
  const tmpl = NOTE_TEMPLATES['network-enumeration'];
  note = {
    id,
    session_id: activeSessionId,
    target_id: targetId,
    type: 'network-enumeration',
    title: tmpl.title || '',
    body: populateNetworkEnumerationOverview(
      typeof buildNoteBodyFromTemplate === 'function' ? buildNoteBodyFromTemplate(tmpl) : (tmpl.body || ''),
      target
    ),
    tags: tmpl.default_tags ? [...tmpl.default_tags] : [],
    target_ip: target.ip || null,
    target_domain: target.domain || null,
    created: Date.now(),
    updated: Date.now(),
  };
  notes[id] = note;
  return note;
}

function syncServiceEntryToNetworkEnumerationNote(entry) {
  if (!NOTE_TEMPLATES?.['network-enumeration'] || !entry?.target_id) return false;

  const note = ensureTargetNetworkEnumerationNote(entry.target_id);
  if (!note) return false;

  const row = parseServiceForNetworkRow(entry);
  if (!row) return false;

  const nextBody = upsertNetworkEnumerationRowIntoBody(note.body || '', row);
  if (!nextBody || nextBody === note.body) return false;

  note.body = nextBody;
  note.updated = Date.now();
  return note;
}

function applySyncedNoteUpdate(note) {
  if (!note) return;
  renderNotesList();
  renderSessionSidebar();
  if (activeNoteId === note.id && typeof noteEditor !== 'undefined' && noteEditor) {
    cmSetValue(noteEditor, note.body || '');
    const moEl = document.getElementById('noteModifiedAt');
    if (moEl) {
      moEl.textContent = new Date(note.updated).toLocaleString('en-GB', {
        day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
      });
    }
    if (typeof updateNotePreview === 'function') updateNotePreview();
  }
}

function addServiceLog() {
  const input = document.getElementById('svcQuickInput');
  const raw = (input && input.value) ? input.value.trim() : '';
  if (!raw || !activeSessionId) { if (input) input.focus(); return; }
  const parsed = parseSvcInput(raw);
  if (!parsed) return;
  if (!sessions[activeSessionId].services) sessions[activeSessionId].services = [];
  const entry = {
    id: `svc_${Date.now()}`,
    target_id: activeTargetId || null,
    port: parsed.port,
    proto: parsed.proto,
    service: parsed.service,
    version: parsed.version,
    notes: parsed.notes,
    added: Date.now(),
  };
  sessions[activeSessionId].services.push(entry);
  const syncedNetworkNote = syncServiceEntryToNetworkEnumerationNote(entry);
  input.value = '';
  input.focus();
  saveNotes();
  renderSvcLogTable();
  updateSvcTabCounts();
  applySyncedNoteUpdate(syncedNetworkNote);
}

function deleteServiceLog(svcId) {
  if (!activeSessionId) return;
  sessions[activeSessionId].services = (sessions[activeSessionId].services || []).filter(s => s.id !== svcId);
  saveNotes();
  renderSvcLogTable();
}

function updateSvcNotes(svcId, val) {
  if (!activeSessionId) return;
  const svc = (sessions[activeSessionId].services || []).find(s => s.id === svcId);
  if (svc) { svc.notes = val; saveNotes(); }
}

function renderSvcLogTable() {
  const tableEl = document.getElementById('svcLogTable');
  if (!tableEl) return;

  const svcs = getSessionServices();
  const sorted = [...svcs].sort((a, b) => (parseInt(a.port) || 0) - (parseInt(b.port) || 0));

  updateSvcTabCounts();

  if (!sorted.length) {
    tableEl.innerHTML = '<div class="svc-empty">No services logged — add one above</div>';
    return;
  }

  tableEl.innerHTML = `
    <table class="svc-table">
      <thead><tr><th>Port</th><th>Service</th><th>Version</th><th>Notes</th><th></th></tr></thead>
      <tbody>${sorted.map(s => `
        <tr>
          <td>${esc(s.port)}${s.proto && s.proto !== 'tcp' ? `<span style="color:var(--muted);font-weight:400">/${esc(s.proto)}</span>` : ''}</td>
          <td>${esc(s.service || '—')}</td>
          <td style="color:var(--text2)">${esc(s.version || '')}</td>
          <td><input class="svc-notes-cell" type="text" value="${esc(s.notes || '')}" placeholder="notes…"
            onclick="event.stopPropagation()"
            onchange="updateSvcNotes('${s.id}',this.value)" onblur="updateSvcNotes('${s.id}',this.value)"></td>
          <td><button class="svc-del-btn" onclick="event.stopPropagation();deleteServiceLog('${s.id}')" title="Remove">✕</button></td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

function setLootType(btn, type) {
  _activeLootType = type;
  document.querySelectorAll('.loot-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function getSessionLoot() {
  if (!activeSessionId || !sessions[activeSessionId]) return [];
  return sessions[activeSessionId].loot || [];
}

function escapeCredentialsCell(value) {
  return String(value || '').replace(/\|/g, '\\|').trim();
}

function parseLootForCredentialsRow(entry) {
  if (!entry || !['cleartext', 'hash'].includes(entry.type)) return null;
  const credential = String(entry.credential || '').trim();
  const host = String(entry.host || '').trim();
  const note = String(entry.note || '').trim();
  let username = '';
  let password = '';
  let hash = '';

  if (entry.type === 'cleartext') {
    const idx = credential.indexOf(':');
    if (idx > 0) {
      username = credential.slice(0, idx).trim();
      password = credential.slice(idx + 1).trim();
    } else {
      password = credential;
    }
  } else if (entry.type === 'hash') {
    const idx = credential.indexOf(':');
    if (idx > 0) {
      username = credential.slice(0, idx).trim();
      hash = credential.slice(idx + 1).trim();
    } else {
      hash = credential;
    }
  }

  return {
    username: escapeCredentialsCell(username),
    password: escapeCredentialsCell(password),
    hash: escapeCredentialsCell(hash),
    service: escapeCredentialsCell(host),
    notes: escapeCredentialsCell(note),
  };
}

function parseLootImport(text) {
  return String(text || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !line.startsWith('#'))
    .map(line => ({
      credential: line,
      hasSecret: line.includes(':') && line.indexOf(':') > 0 && line.slice(line.indexOf(':') + 1).trim().length > 0,
    }));
}

function parseAndPreviewLoot() {
  const raw = document.getElementById('lootPasteInput')?.value || '';
  const preview = document.getElementById('lootParsePreview');
  const commitBtn = document.getElementById('lootCommitBtn');
  if (!preview || !commitBtn) return;

  _lootParsed = parseLootImport(raw);
  preview.style.display = 'block';
  if (!_lootParsed.length) {
    preview.innerHTML = '<div class="nmap-preview-none">No usernames or credentials found.</div>';
    commitBtn.style.display = 'none';
    return;
  }

  const host = (document.getElementById('lootHostInput')?.value || '').trim() || (getIP() !== '<IP>' ? getIP() : '');
  const type = _activeLootType;
  const existing = new Set(getSessionLoot().map(l => `${l.type}::${l.credential}::${l.host || ''}`));
  const fresh = _lootParsed.filter(entry => !existing.has(`${type}::${entry.credential}::${host}`));
  const dupes = _lootParsed.length - fresh.length;

  let html = `<div class="nmap-preview-hdr"><span>${_lootParsed.length}</span> entr${_lootParsed.length === 1 ? 'y' : 'ies'} found`;
  if (dupes) html += ` &nbsp;·&nbsp; <span style="color:var(--muted)">${dupes} already logged</span>`;
  html += `</div><table class="svc-table" style="margin-bottom:4px"><thead><tr><th>Type</th><th>Credential</th><th>Detected</th></tr></thead><tbody>`;
  html += _lootParsed.map(entry => {
    const isDupe = existing.has(`${type}::${entry.credential}::${host}`);
    return `<tr style="${isDupe ? 'opacity:0.4' : ''}"><td>${esc(type)}</td><td>${esc(entry.credential)}</td><td style="color:var(--text2)">${entry.hasSecret ? 'username:secret' : 'username only'}</td></tr>`;
  }).join('');
  html += '</tbody></table>';
  preview.innerHTML = html;

  if (fresh.length > 0) {
    commitBtn.style.display = 'block';
    commitBtn.textContent = `＋ Add ${fresh.length} new`;
  } else {
    commitBtn.style.display = 'none';
    preview.innerHTML += '<div class="nmap-preview-none">All entries already logged.</div>';
  }
}

function commitLootParse() {
  if (!activeSessionId || !_lootParsed.length) return;
  if (!sessions[activeSessionId].loot) sessions[activeSessionId].loot = [];

  const host = (document.getElementById('lootHostInput')?.value || '').trim() || (getIP() !== '<IP>' ? getIP() : '');
  const note = (document.getElementById('lootNoteInput')?.value || '').trim();
  const type = _activeLootType;
  const existing = new Set(sessions[activeSessionId].loot.map(l => `${l.type}::${l.credential}::${l.host || ''}`));
  let added = 0;
  let syncedCredentials = false;

  _lootParsed.forEach((item, idx) => {
    const key = `${type}::${item.credential}::${host}`;
    if (existing.has(key)) return;
    existing.add(key);
    const entry = {
      id: `loot_${Date.now()}_${idx}`,
      type,
      credential: item.credential,
      host,
      note,
      added: Date.now(),
    };
    sessions[activeSessionId].loot.push(entry);
    if (syncLootEntryToCredentialsNote(entry)) syncedCredentials = true;
    added++;
  });

  saveNotes();
  renderLootTable();
  updateSvcTabCounts();
  if (syncedCredentials) {
    renderNotesList();
    renderSessionSidebar();
  }
  toggleToolPaste('loot');
  showToast(added ? `✓ Added ${added} loot entr${added === 1 ? 'y' : 'ies'}` : 'No new loot entries');
}

function buildCredentialsTableRow(row) {
  return `| ${row.username} | ${row.password} | ${row.hash} | ${row.service} | ${row.notes} |`;
}

function upsertCredentialsRowIntoBody(body, row) {
  const lines = String(body || '').split('\n');
  const headerIdx = lines.findIndex(line => /^\|\s*Username\s*\|\s*Password\s*\|\s*Hash\s*\|\s*Service\s*\|\s*Notes\s*\|$/i.test(line.trim()));
  if (headerIdx === -1) return null;
  const separatorIdx = headerIdx + 1;
  if (!lines[separatorIdx] || !/^\|\s*-+/.test(lines[separatorIdx].trim())) return null;

  let insertAt = separatorIdx + 1;
  while (insertAt < lines.length && /^\|/.test(lines[insertAt].trim())) insertAt++;

  const newRow = buildCredentialsTableRow(row);
  const existingRows = lines.slice(separatorIdx + 1, insertAt).map(line => line.trim());
  if (existingRows.includes(newRow.trim())) return body;

  const placeholderIdx = lines.slice(separatorIdx + 1, insertAt).findIndex(line =>
    /^\|\s*\|\s*\|\s*\|\s*\|\s*\|$/.test(line.replace(/\s/g, ''))
  );
  if (placeholderIdx !== -1) {
    lines[separatorIdx + 1 + placeholderIdx] = newRow;
  } else {
    lines.splice(insertAt, 0, newRow);
  }
  return lines.join('\n');
}

function findSessionCredentialsNote() {
  if (!activeSessionId) return null;
  return Object.values(notes).find(note => note.session_id === activeSessionId && note.type === 'credentials') || null;
}

function ensureSessionCredentialsNote() {
  if (!NOTE_TEMPLATES?.credentials || !activeSessionId) return null;
  let note = findSessionCredentialsNote();
  if (note) return note;

  const id = 'note_' + Date.now();
  const tmpl = NOTE_TEMPLATES.credentials;
  note = {
    id,
    session_id: activeSessionId,
    target_id: activeTargetId || null,
    type: 'credentials',
    title: tmpl.title || '',
    body: typeof buildNoteBodyFromTemplate === 'function' ? buildNoteBodyFromTemplate(tmpl) : (tmpl.body || ''),
    tags: tmpl.default_tags ? [...tmpl.default_tags] : [],
    target_ip: getIP() !== '<IP>' ? getIP() : null,
    target_domain: getDomain() !== '<DOMAIN>' ? getDomain() : null,
    created: Date.now(),
    updated: Date.now(),
  };
  notes[id] = note;
  return note;
}

function syncLootEntryToCredentialsNote(entry) {
  if (!entry || !['cleartext', 'hash'].includes(entry.type)) return false;
  if (!NOTE_TEMPLATES?.credentials) return false;

  const note = ensureSessionCredentialsNote();
  if (!note) return false;

  const row = parseLootForCredentialsRow(entry);
  if (!row) return false;

  const nextBody = upsertCredentialsRowIntoBody(note.body || '', row);
  if (!nextBody || nextBody === note.body) return false;

  note.body = nextBody;
  note.updated = Date.now();
  return note;
}

function addLootEntry() {
  const credEl = document.getElementById('lootCredInput');
  const hostEl = document.getElementById('lootHostInput');
  const noteEl = document.getElementById('lootNoteInput');
  const cred = credEl?.value.trim();
  const host = hostEl?.value.trim();
  const note = noteEl?.value.trim();
  if (!cred || !activeSessionId) { credEl?.focus(); return; }
  if (!sessions[activeSessionId].loot) sessions[activeSessionId].loot = [];

  const autoHost = host || (getIP() !== '<IP>' ? getIP() : '');

  const entry = {
    id: `loot_${Date.now()}`,
    type: _activeLootType,
    credential: cred,
    host: autoHost,
    note,
    added: Date.now(),
  };
  sessions[activeSessionId].loot.push(entry);
  const syncedCredentialsNote = syncLootEntryToCredentialsNote(entry);

  credEl.value = '';
  noteEl.value = '';
  credEl.focus();
  saveNotes();
  renderLootTable();
  updateSvcTabCounts();
  if (syncedCredentialsNote) {
    renderNotesList();
    renderSessionSidebar();
    if (activeNoteId === syncedCredentialsNote.id && typeof noteEditor !== 'undefined' && noteEditor) {
      cmSetValue(noteEditor, syncedCredentialsNote.body || '');
      const moEl = document.getElementById('noteModifiedAt');
      if (moEl) {
        moEl.textContent = new Date(syncedCredentialsNote.updated).toLocaleString('en-GB', {
          day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
        });
      }
      if (typeof updateNotePreview === 'function') updateNotePreview();
    }
  }
}

function deleteLootEntry(lootId) {
  if (!activeSessionId) return;
  sessions[activeSessionId].loot = (sessions[activeSessionId].loot || []).filter(l => l.id !== lootId);
  saveNotes();
  renderLootTable();
  updateSvcTabCounts();
}

function updateLootNote(lootId, val) {
  if (!activeSessionId) return;
  const entry = (sessions[activeSessionId].loot || []).find(l => l.id === lootId);
  if (entry) { entry.note = val; saveNotes(); }
}

const LOOT_TYPE_CSS = {
  cleartext: 'loot-type-cleartext',
  hash: 'loot-type-hash',
  token: 'loot-type-token',
  key: 'loot-type-key',
  other: 'loot-type-other',
};

function renderLootTable() {
  const el = document.getElementById('lootLogTable');
  if (!el) return;
  updateSvcTabCounts();
  const entries = [...getSessionLoot()].sort((a, b) => (a.added || 0) - (b.added || 0));
  if (!entries.length) {
    el.innerHTML = '<div class="svc-empty">No loot logged yet — add credentials, hashes or tokens above</div>';
    return;
  }
  el.innerHTML = `
    <table class="svc-table">
      <thead><tr><th>Type</th><th>Credential</th><th>Host</th><th>Context</th><th></th></tr></thead>
      <tbody>${entries.map(l => {
        const typeCss = LOOT_TYPE_CSS[l.type] || 'loot-type-other';
        return `<tr>
          <td><span class="loot-type-badge ${typeCss}">${esc(l.type)}</span></td>
          <td class="loot-cred-cell" onclick="copyLootCred('${l.id}')" title="Click to copy">${esc(l.credential)}</td>
          <td style="color:var(--text2);white-space:nowrap">${esc(l.host || '—')}</td>
          <td style="min-width:160px;width:35%"><input class="svc-notes-cell" type="text" value="${esc(l.note || '')}" placeholder="context…"
            onclick="event.stopPropagation()"
            onchange="updateLootNote('${l.id}',this.value)"
            onblur="updateLootNote('${l.id}',this.value)"></td>
          <td><button class="svc-del-btn" onclick="event.stopPropagation();deleteLootEntry('${l.id}')" title="Remove">✕</button></td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>`;
}

function copyLootCred(lootId) {
  const entry = (sessions[activeSessionId]?.loot || []).find(l => l.id === lootId);
  if (!entry) return;
  navigator.clipboard.writeText(entry.credential).then(() => {
    showToast(`✓ Copied: ${entry.credential.slice(0, 40)}${entry.credential.length > 40 ? '…' : ''}`);
  });
}

function buildLootMarkdown(sessionId) {
  const loot = sessions[sessionId]?.loot || [];
  if (!loot.length) return null;

  const byHost = {};
  loot.forEach(l => {
    const host = l.host || 'Unknown';
    if (!byHost[host]) byHost[host] = [];
    byHost[host].push(l);
  });

  let md = '# Loot\n\n';
  md += `*Exported: ${new Date().toLocaleString('en-GB')}*\n\n`;

  for (const [host, entries] of Object.entries(byHost)) {
    md += `## ${host}\n\n`;
    md += '| Type | Credential | Context |\n';
    md += '|------|------------|----------|\n';
    entries.forEach(l => {
      const cred = l.credential.replace(/\|/g, '\\|');
      const note = (l.note || '').replace(/\|/g, '\\|');
      md += `| ${l.type} | \`${cred}\` | ${note} |\n`;
    });
    md += '\n';
  }
  return md;
}

function toggleSvcPopover() {
  const popover = document.getElementById('svcPopover');
  const btn = document.getElementById('svcTopbarBtn');
  const isOpen = popover.classList.contains('open');
  if (isOpen) {
    closeSvcPopover();
  } else {
    popover.classList.add('open');
    btn.classList.add('open');
    updateSvcPopoverLayout();
    const sessLabel = document.getElementById('svcSessionLabel');
    if (sessLabel) {
      const sess = activeSessionId && sessions[activeSessionId];
      if (sess) {
        sessLabel.textContent = sess.codename;
        sessLabel.style.display = '';
      } else {
        sessLabel.textContent = '';
        sessLabel.style.display = 'none';
      }
    }
    renderSvcLogTable();
    renderPathTable();
    renderLootTable();
    updateSvcTabCounts();
    renderSvcClearAction();
    setTimeout(() => {
      const hi = document.getElementById('lootHostInput');
      if (hi && !hi.value) {
        const ip = getIP();
        if (ip !== '<IP>') hi.value = ip;
      }
      const inputId = _activeSvcTab === 'ports'
        ? 'svcQuickInput'
        : _activeSvcTab === 'loot'
          ? 'lootCredInput'
          : 'pathQuickInput';
      document.getElementById(inputId)?.focus();
    }, 40);
    setTimeout(() => document.addEventListener('click', _svcOutsideClose, { once: true }), 0);
  }
}

function closeSvcPopover() {
  document.getElementById('svcPopover')?.classList.remove('open');
  document.getElementById('svcTopbarBtn')?.classList.remove('open');
  updateSvcPopoverLayout();
}

function _svcOutsideClose(e) {
  const wrap = document.getElementById('svcTopbarWrap');
  if (!wrap) return;
  if (wrap.contains(e.target)) {
    if (document.getElementById('svcPopover')?.classList.contains('open')) {
      setTimeout(() => document.addEventListener('click', _svcOutsideClose, { once: true }), 0);
    }
  } else {
    closeSvcPopover();
  }
}
