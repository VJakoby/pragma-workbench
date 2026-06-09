// ═══════════════════════════════════════════════
// TARGET
// ═══════════════════════════════════════════════
let activeContextSwitcherTab = 'targets';
let activeContextSwitcherQuery = '';
let activeContextSwitcherIndex = 0;
let activeContextSwitcherItems = [];

function readStoredActiveTargetsBySession() {
  try {
    const raw = localStorage.getItem('ops-active-targets-by-session');
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function writeStoredActiveTargetsBySession(map) {
  localStorage.setItem('ops-active-targets-by-session', JSON.stringify(map || {}));
}

function rememberActiveTargetForSession(sessionId, targetId) {
  if (!sessionId) return;
  const map = readStoredActiveTargetsBySession();
  if (targetId) map[sessionId] = targetId;
  else delete map[sessionId];
  writeStoredActiveTargetsBySession(map);
}

function getRememberedTargetForSession(sessionId) {
  if (!sessionId) return '';
  const map = readStoredActiveTargetsBySession();
  return String(map[sessionId] || '');
}

function clearRememberedTargetForSession(sessionId, targetId = '') {
  if (!sessionId) return;
  const map = readStoredActiveTargetsBySession();
  if (!targetId || map[sessionId] === targetId) {
    delete map[sessionId];
    writeStoredActiveTargetsBySession(map);
  }
}

function initTarget() {
  activeTargetId = localStorage.getItem('ops-active-target') || null;
  updateTargetSelector();
}

function getActiveTarget() {
  if (!activeSessionId || !sessions[activeSessionId]) return null;
  const sess = sessions[activeSessionId];
  const targets = sess.targets || [];
  if (!targets.length) return null;
  return targets.find((t) => t.id === activeTargetId) || targets[0];
}

function getIP()     { const t = getActiveTarget(); return (t && t.ip)     || '<IP>'; }
function getDomain() {
  const t = getActiveTarget();
  const sess = activeSessionId && sessions[activeSessionId];
  return (t && t.domain) || (sess && sess.domain) || '<DOMAIN>';
}
function getAttackerIP() {
  const sess = activeSessionId && sessions[activeSessionId];
  return (sess && sess.attacker_ip) || '<ATTACKER-IP>';
}
function getTargetLabelValue() {
  const t = getActiveTarget();
  return (t && (t.label || t.ip || t.domain)) || '<LABEL>';
}

function updateTargetDots() { updateTargetSelector(); }

function updateTargetSelector() {
  const t = getActiveTarget();
  const selector = document.getElementById('targetSelector');
  const dot = document.getElementById('targetSelDot');
  const lbl = document.getElementById('targetSelLabel');
  const cpyIpBtn = document.getElementById('targetSelectorCopy');
  const cpyDomBtn = document.getElementById('targetSelectorCopyDomain');
  const ipText = document.getElementById('targetCopyIpText');
  const domText = document.getElementById('targetCopyDomainText');
  const sess = activeSessionId && sessions[activeSessionId];
  const status = (sess && sess.status) || 'active';
  if (selector) selector.classList.remove('status-active', 'status-paused', 'status-complete');
  if (selector) selector.classList.add(`status-${status === 'active' ? 'active' : status}`);
  dot.classList.remove('active', 'paused', 'complete');
  const resolvedDomain = (t && t.domain) || (sess && sess.domain) || '';
  if (t) {
    dot.classList.add(status === 'active' ? 'active' : status);
    if (ipText) ipText.textContent = t.ip || '—';
    if (domText) domText.textContent = resolvedDomain || '—';
    lbl.textContent = t.label || t.ip || t.domain || 'target';
    if (cpyIpBtn) cpyIpBtn.disabled = !t.ip;
    if (cpyDomBtn) cpyDomBtn.disabled = !resolvedDomain;
  } else {
    dot.classList.add(status === 'active' ? 'active' : status);
    if (ipText) ipText.textContent = '—';
    if (domText) domText.textContent = resolvedDomain || '—';
    lbl.textContent = activeSessionId ? 'No target' : 'No session';
    if (cpyIpBtn) cpyIpBtn.disabled = true;
    if (cpyDomBtn) cpyDomBtn.disabled = !resolvedDomain;
  }
}

function copyActiveTarget(kind = 'ip') {
  const t = getActiveTarget();
  const sess = activeSessionId && sessions[activeSessionId];
  if (!t && kind !== 'domain') return;
  const text = kind === 'domain' ? ((t && t.domain) || (sess && sess.domain) || '') : (t.ip || '');
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    showToast(`Copied: ${text}`);
  });
}

function copyActiveTargetIP() {
  copyActiveTarget('ip');
}

function copyActiveTargetDomain() {
  copyActiveTarget('domain');
}

function editActiveTargetQuick() {
  if (!activeSessionId || !sessions[activeSessionId]) return;
  const t = getActiveTarget();
  if (t) {
    renameTarget(t.id);
    return;
  }
  openTargetsPanel();
  setTimeout(() => document.getElementById('newTargetIP')?.focus(), 60);
}


function normalizeContextSwitcherValue(value) {
  return String(value || '').trim();
}

function normalizeContextSwitcherMatch(value) {
  return normalizeContextSwitcherValue(value).toLowerCase();
}

function isContextSwitcherIpValue(value) {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value);
}

function parseContextSwitcherTargetInput(value) {
  const next = normalizeContextSwitcherValue(value);
  const [primaryValue = '', ...labelParts] = next.split(/\s+/);
  return {
    raw: next,
    targetValue: primaryValue.trim(),
    targetLabel: labelParts.join(' ').trim(),
  };
}

function isContextSwitcherTargetLikeValue(value) {
  const { targetValue } = parseContextSwitcherTargetInput(value);
  if (!targetValue) return false;
  if (isContextSwitcherIpValue(targetValue)) return true;
  return /^[a-z0-9._-]+$/i.test(targetValue) && /[a-z]/i.test(targetValue);
}

function contextSwitcherTargetExists(value) {
  const { targetValue, targetLabel } = parseContextSwitcherTargetInput(value);
  const needles = [targetValue, targetLabel]
    .map((part) => normalizeContextSwitcherMatch(part))
    .filter(Boolean);
  if (!needles.length) return false;
  const sess = activeSessionId && sessions[activeSessionId];
  const targets = (sess && sess.targets) || [];
  return targets.some((target) => [target.ip, target.domain, target.label].some((part) => needles.includes(normalizeContextSwitcherMatch(part))));
}

function contextSwitcherSessionExists(value) {
  const needle = normalizeContextSwitcherMatch(value);
  return Object.values(sessions).some((session) => normalizeContextSwitcherMatch(session.codename) === needle);
}

function getContextSwitcherQuickCreateItems() {
  const value = normalizeContextSwitcherValue(activeContextSwitcherQuery);
  if (!value) return [];
  if (activeContextSwitcherTab === 'targets') {
    if (!activeSessionId || !isContextSwitcherTargetLikeValue(value) || contextSwitcherTargetExists(value)) return [];
    return [{
      kind: 'create-target',
      id: 'create-target:' + value,
      title: 'Create target',
      meta: value,
      active: false,
      status: 'create',
      value,
    }];
  }
  if (contextSwitcherSessionExists(value)) return [];
  return [{
    kind: 'create-session',
    id: 'create-session:' + value,
    title: 'Create session',
    meta: value,
    active: false,
    status: 'create',
    value,
  }];
}

function refreshTargetScopedQuickLogUi() {
  if (typeof renderSvcLogTable === 'function') renderSvcLogTable();
  if (typeof renderPathTable === 'function') renderPathTable();
  if (typeof renderLootTable === 'function') renderLootTable();
  if (typeof updateSvcTabCounts === 'function') updateSvcTabCounts();
}

function createTargetFromContextSwitcher(value) {
  const next = normalizeContextSwitcherValue(value);
  if (!next || !activeSessionId) return false;
  const sess = sessions[activeSessionId];
  if (!sess) return false;
  if (!sess.targets) sess.targets = [];
  const { targetValue, targetLabel } = parseContextSwitcherTargetInput(next);
  if (!targetValue) return false;
  const id = 'tgt_' + Date.now();
  const isIp = isContextSwitcherIpValue(targetValue);
  sess.targets.push({
    id,
    ip: isIp ? targetValue : '',
    domain: isIp ? '' : targetValue,
    label: targetLabel,
  });
  activeTargetId = id;
  localStorage.setItem('ops-active-target', id);
  rememberActiveTargetForSession(activeSessionId, id);
  saveNotes();
  renderTargetsList();
  updateTargetSelector();
  refreshCodeBlocks();
  refreshTargetScopedQuickLogUi();
  showToast('✓ Target created: ' + next);
  return true;
}

function createSessionFromContextSwitcher(value) {
  const next = normalizeContextSwitcherValue(value);
  if (!next) return false;
  const id = 'sess_' + Date.now();
  const sess = { id, codename: next, created: Date.now(), domain: '', targets: [], attacker_ip: '', todos: [], evidence: [] };
  sessions[id] = sess;
  tlLog(id, { type: 'session_created', name: sess.codename });
  switchSession(id);
  saveNotes();
  renderSessionList();
  if (typeof renderWelcomeSessionList === 'function') renderWelcomeSessionList();
  if (typeof updateSessionDomainField === 'function') updateSessionDomainField();
  if (typeof updateSessionAttackerIpField === 'function') updateSessionAttackerIpField();
  showToast('✓ Session created: ' + next);
  return true;
}

function getContextSwitcherTargetItems() {
  const sess = activeSessionId && sessions[activeSessionId];
  const targets = (sess && sess.targets) || [];
  const q = activeContextSwitcherQuery.trim().toLowerCase();
  return targets
    .map((target) => {
      const title = target.label || target.ip || target.domain || 'target';
      const metaParts = [target.ip, target.domain].filter(Boolean);
      return {
        kind: 'target',
        id: target.id,
        title,
        meta: metaParts.join(' · '),
        active: target.id === getActiveTarget()?.id,
        search: [title, target.ip, target.domain, target.label].filter(Boolean).join(' ').toLowerCase(),
      };
    })
    .filter((item) => !q || item.search.includes(q));
}

function getContextSwitcherSessionItems() {
  const q = activeContextSwitcherQuery.trim().toLowerCase();
  return Object.values(sessions)
    .sort((a, b) => (b.created || 0) - (a.created || 0))
    .map((session) => {
      const targetCount = (session.targets || []).length;
      const noteCount = Object.values(notes).filter((note) => note.session_id === session.id).length;
      const meta = `${targetCount} target${targetCount === 1 ? '' : 's'} · ${noteCount} note${noteCount === 1 ? '' : 's'}`;
      return {
        kind: 'session',
        id: session.id,
        title: session.codename || 'Untitled session',
        meta,
        status: session.status || 'active',
        active: session.id === activeSessionId,
        search: `${session.codename || ''} ${meta}`.toLowerCase(),
      };
    })
    .filter((item) => !q || item.search.includes(q));
}

function getContextSwitcherItems() {
  const baseItems = activeContextSwitcherTab === 'sessions'
    ? getContextSwitcherSessionItems()
    : getContextSwitcherTargetItems();
  return [...getContextSwitcherQuickCreateItems(), ...baseItems];
}

function syncContextSwitcherTabButtons() {
  document.querySelectorAll('.context-switcher-tab').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === activeContextSwitcherTab);
  });
}

function primeContextSwitcherSelection() {
  const items = getContextSwitcherItems();
  const preferredIndex = items.findIndex((item) => item.active);
  activeContextSwitcherIndex = preferredIndex >= 0 ? preferredIndex : 0;
}

function renderContextSwitcherList() {
  const list = document.getElementById('contextSwitcherList');
  const title = document.getElementById('contextSwitcherTitle');
  const helper = document.getElementById('contextSwitcherHelper');
  const helperExample = document.getElementById('contextSwitcherHelperExample');
  const manageBtn = document.getElementById('contextSwitcherManageBtn');
  if (!list) return;

  syncContextSwitcherTabButtons();
  activeContextSwitcherItems = getContextSwitcherItems();
  if (activeContextSwitcherIndex >= activeContextSwitcherItems.length) {
    activeContextSwitcherIndex = activeContextSwitcherItems.length ? activeContextSwitcherItems.length - 1 : 0;
  }

  if (title) title.textContent = activeContextSwitcherTab === 'sessions' ? 'Switch Session' : 'Switch Target';
  if (helper) {
    helper.textContent = activeContextSwitcherTab === 'sessions'
      ? 'Type to filter sessions. Enter switches session and restores its last active target. New names offer quick session creation.'
      : 'Type to filter targets. Enter switches target and refreshes injected context. IP or host-like input offers quick target creation.';
  }
  if (helperExample) {
    helperExample.innerHTML = activeContextSwitcherTab === 'sessions'
      ? 'Quick create: type a new session name and press <code>Enter</code>'
      : 'Quick create: type <code>X.X.X.X</code> or <code>X.X.X.X labelname</code> and press <code>Enter</code>';
  }
  if (manageBtn) manageBtn.textContent = activeContextSwitcherTab === 'sessions' ? 'Manage Sessions' : 'Manage Targets';

  if (!activeContextSwitcherItems.length) {
    const empty = activeContextSwitcherTab === 'sessions'
      ? 'No sessions match the current filter.'
      : activeSessionId
        ? 'No targets match the current filter.'
        : 'Select or create a session before switching targets.';
    list.innerHTML = `<div class="context-switcher-empty">${empty}</div>`;
    return;
  }

  list.innerHTML = activeContextSwitcherItems.map((item, index) => {
    const statusDot = item.kind === 'session'
      ? `<span class="context-switcher-status-dot ${esc(item.status || 'active')}"></span>`
      : item.kind === 'create-target' || item.kind === 'create-session'
        ? '<span class="context-switcher-create-dot">+</span>'
        : `<span class="context-switcher-target-dot${item.active ? ' active' : ''}"></span>`;
    const badge = item.kind === 'create-target' || item.kind === 'create-session'
      ? '<span class="context-switcher-item-badge context-switcher-item-badge-create">Create</span>'
      : item.active ? '<span class="context-switcher-item-badge">Current</span>' : '';
    return `<button type="button" class="context-switcher-item${item.active ? ' active' : ''}${index === activeContextSwitcherIndex ? ' selected' : ''}${item.kind === 'create-target' || item.kind === 'create-session' ? ' context-switcher-item-create' : ''}" data-index="${index}" onclick="selectContextSwitcherIndex(${index})" onmousemove="setContextSwitcherIndex(${index})">
      <span class="context-switcher-item-indicator">${statusDot}</span>
      <span class="context-switcher-item-body">
        <span class="context-switcher-item-title">${esc(item.title || '')}</span>
        <span class="context-switcher-item-meta">${esc(item.meta || '')}</span>
      </span>
      ${badge}
    </button>`;
  }).join('');
  scrollContextSwitcherSelectionIntoView();
}

function setContextSwitcherIndex(index) {
  if (!activeContextSwitcherItems.length) return;
  const bounded = Math.max(0, Math.min(index, activeContextSwitcherItems.length - 1));
  if (bounded === activeContextSwitcherIndex) return;
  activeContextSwitcherIndex = bounded;
  renderContextSwitcherList();
}

function scrollContextSwitcherSelectionIntoView() {
  const selected = document.querySelector('.context-switcher-item.selected');
  selected?.scrollIntoView({ block: 'nearest' });
}

function activateContextSwitcherSelection() {
  const item = activeContextSwitcherItems[activeContextSwitcherIndex];
  if (!item) return;
  if (item.kind === 'create-session') {
    if (createSessionFromContextSwitcher(item.value)) closeContextSwitcher();
    return;
  }
  if (item.kind === 'create-target') {
    if (createTargetFromContextSwitcher(item.value)) closeContextSwitcher();
    return;
  }
  if (item.kind === 'session') {
    switchSession(item.id);
  } else {
    setActiveTarget(item.id, { closeOverlay: true });
  }
  closeContextSwitcher();
}

function onContextSwitcherInput(value) {
  activeContextSwitcherQuery = String(value || '');
  activeContextSwitcherIndex = 0;
  renderContextSwitcherList();
}

function onContextSwitcherKey(event) {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (!activeContextSwitcherItems.length) return;
    activeContextSwitcherIndex = (activeContextSwitcherIndex + 1) % activeContextSwitcherItems.length;
    renderContextSwitcherList();
    return;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (!activeContextSwitcherItems.length) return;
    activeContextSwitcherIndex = (activeContextSwitcherIndex - 1 + activeContextSwitcherItems.length) % activeContextSwitcherItems.length;
    renderContextSwitcherList();
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    activateContextSwitcherSelection();
    return;
  }
  if (event.key === 'Tab') {
    event.preventDefault();
    setContextSwitcherTab(activeContextSwitcherTab === 'targets' ? 'sessions' : 'targets');
  }
}

function setContextSwitcherTab(tab) {
  activeContextSwitcherTab = tab === 'sessions' ? 'sessions' : 'targets';
  activeContextSwitcherQuery = '';
  const input = document.getElementById('contextSwitcherInput');
  if (input) input.value = '';
  primeContextSwitcherSelection();
  renderContextSwitcherList();
  input?.focus();
}

function openContextSwitcher() {
  activeContextSwitcherTab = 'targets';
  activeContextSwitcherQuery = '';
  const input = document.getElementById('contextSwitcherInput');
  const overlay = document.getElementById('contextSwitcherOverlay');
  if (input) input.value = '';
  primeContextSwitcherSelection();
  renderContextSwitcherList();
  overlay?.classList.add('open');
  setTimeout(() => input?.focus(), 40);
}

function closeContextSwitcher() {
  document.getElementById('contextSwitcherOverlay')?.classList.remove('open');
}

function openContextSwitcherManage() {
  closeContextSwitcher();
  if (activeContextSwitcherTab === 'sessions') openSessionModal();
  else openTargetsPanel();
}

function selectContextSwitcherIndex(index) {
  setContextSwitcherIndex(index);
  activateContextSwitcherSelection();
}

function openTargetsPanel() {
  const sess = activeSessionId && sessions[activeSessionId];
  document.getElementById('targetsPanelTitle').textContent = sess ? `Targets — ${sess.codename}` : 'Targets';
  document.getElementById('newTargetIP').value = '';
  document.getElementById('newTargetDomain').value = '';
  document.getElementById('newTargetLabel').value = '';
  renderTargetsList();
  renderSvcLogTable();
  renderPathTable();
  renderLootTable();
  updateSvcTabCounts();
  document.getElementById('targetsOverlay').classList.add('open');
  setTimeout(() => document.getElementById('newTargetIP').focus(), 50);
}

function closeTargetsPanel() {
  document.getElementById('targetsOverlay').classList.remove('open');
}

function renderTargetsList() {
  const list = document.getElementById('targetsList');
  const sess = activeSessionId && sessions[activeSessionId];
  const targets = (sess && sess.targets) || [];
  if (!targets.length) {
    list.innerHTML = '<div class="targets-empty">No targets yet — add one above</div>';
    return;
  }
  const curId = getActiveTarget()?.id;
  list.innerHTML = targets.map((t) => `
    <div class="target-item${t.id === curId ? ' active-target' : ''}" onclick="setActiveTarget('${t.id}')">
      <div class="target-item-dot"></div>
      <div class="target-item-ip">${esc(t.ip || '—')}</div>
      <div class="target-item-domain">${esc(t.domain || '')}</div>
      ${t.label ? `<span class="target-item-label">${esc(t.label)}</span>` : ''}
      <div class="target-item-actions">
        <button class="target-item-del" onclick="event.stopPropagation();renameTarget('${t.id}')" title="Rename label">${ICONS.edit}</button>
        <button class="target-item-del" onclick="event.stopPropagation();deleteTarget('${t.id}')" title="Remove">✕</button>
      </div>
    </div>`).join('');
}

function addTarget() {
  const ip = document.getElementById('newTargetIP').value.trim();
  const domain = document.getElementById('newTargetDomain').value.trim();
  const label = document.getElementById('newTargetLabel').value.trim();
  if (!ip && !domain) { document.getElementById('newTargetIP').focus(); return; }
  if (!activeSessionId) return;

  const sess = sessions[activeSessionId];
  if (!sess.targets) sess.targets = [];
  const id = 'tgt_' + Date.now();
  sess.targets.push({ id, ip, domain, label });

  if (sess.targets.length === 1) {
    activeTargetId = id;
    localStorage.setItem('ops-active-target', id);
    rememberActiveTargetForSession(activeSessionId, id);
  }

  document.getElementById('newTargetIP').value = '';
  document.getElementById('newTargetDomain').value = '';
  document.getElementById('newTargetLabel').value = '';
  saveNotes();
  renderTargetsList();
  updateTargetSelector();
  refreshCodeBlocks();
  refreshTargetScopedQuickLogUi();
}

function setActiveTarget(id, opts = {}) {
  activeTargetId = id;
  localStorage.setItem('ops-active-target', id);
  rememberActiveTargetForSession(activeSessionId, id);
  renderTargetsList();
  updateTargetSelector();
  refreshCodeBlocks();
  refreshTargetScopedQuickLogUi();
  if (opts.closeOverlay !== false) closeTargetsPanel();
}

function deleteTarget(id) {
  if (!activeSessionId) return;
  const sess = sessions[activeSessionId];
  sess.targets = (sess.targets || []).filter((t) => t.id !== id);
  clearRememberedTargetForSession(activeSessionId, id);
  if (activeTargetId === id) {
    activeTargetId = sess.targets[0]?.id || null;
    if (activeTargetId) {
      localStorage.setItem('ops-active-target', activeTargetId);
      rememberActiveTargetForSession(activeSessionId, activeTargetId);
    } else {
      localStorage.removeItem('ops-active-target');
    }
  }
  Object.values(notes).forEach((n) => { if (n.target_id === id) n.target_id = null; });
  saveNotes();
  renderTargetsList();
  updateTargetSelector();
  refreshCodeBlocks();
  refreshTargetScopedQuickLogUi();
}

let _targetEditResolve = null;
let _targetEditReject = null;

function showTargetEditModal(t) {
  return new Promise((resolve, reject) => {
    _targetEditResolve = resolve;
    _targetEditReject = reject;
    document.getElementById('targetEditTitle').textContent = t.label || t.ip || t.domain || 'Edit Target';
    const tei = document.getElementById('targetEditIcon'); if (tei) tei.innerHTML = ICONS.target;
    document.getElementById('targetEditIP').value = t.ip || '';
    document.getElementById('targetEditDomain').value = t.domain || '';
    document.getElementById('targetEditLabel').value = t.label || '';
    document.getElementById('targetEditOverlay').classList.add('open');
    setTimeout(() => document.getElementById('targetEditIP').focus(), 40);
  });
}

function _targetEditSave() {
  const ip = document.getElementById('targetEditIP').value.trim();
  const domain = document.getElementById('targetEditDomain').value.trim();
  const label = document.getElementById('targetEditLabel').value.trim();
  if (!ip && !domain) {
    document.getElementById('targetEditIP').classList.add('error');
    document.getElementById('targetEditIP').focus();
    setTimeout(() => document.getElementById('targetEditIP').classList.remove('error'), 1200);
    return;
  }
  document.getElementById('targetEditOverlay').classList.remove('open');
  if (_targetEditResolve) _targetEditResolve({ ip, domain, label });
  _targetEditResolve = _targetEditReject = null;
}

function _targetEditCancel() {
  document.getElementById('targetEditOverlay').classList.remove('open');
  if (_targetEditReject) _targetEditReject('cancelled');
  _targetEditResolve = _targetEditReject = null;
}

function _targetEditKey(e) {
  if (e.key === 'Enter') _targetEditSave();
  if (e.key === 'Escape') _targetEditCancel();
}

async function renameTarget(id) {
  if (!activeSessionId) return;
  const sess = sessions[activeSessionId];
  const t = (sess.targets || []).find((target) => target.id === id);
  if (!t) return;
  let result;
  try { result = await showTargetEditModal(t); } catch { return; }
  t.ip = result.ip;
  t.domain = result.domain;
  t.label = result.label;
  saveNotes();
  renderTargetsList();
  updateTargetSelector();
  if (typeof renderSessionNoteTabs === 'function') renderSessionNoteTabs();
  renderSessionSidebar();
  if (document.getElementById('contextSwitcherOverlay')?.classList.contains('open')) renderContextSwitcherList();
}
