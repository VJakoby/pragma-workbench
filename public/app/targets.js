// ═══════════════════════════════════════════════
// TARGET
// ═══════════════════════════════════════════════
function initTarget() {
  activeTargetId = localStorage.getItem('ops-active-target') || null;
  updateTargetSelector();
}

function getActiveTarget() {
  if (!activeSessionId || !sessions[activeSessionId]) return null;
  const sess = sessions[activeSessionId];
  const targets = sess.targets || [];
  if (!targets.length) return null;
  return targets.find(t => t.id === activeTargetId) || targets[0];
}

function getIP()     { const t = getActiveTarget(); return (t && t.ip)     || '<IP>'; }
function getDomain() { const t = getActiveTarget(); return (t && t.domain) || '<DOMAIN>'; }
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
  const t      = getActiveTarget();
  const selector = document.getElementById('targetSelector');
  const dot    = document.getElementById('targetSelDot');
  const lbl    = document.getElementById('targetSelLabel');
  const cpyIpBtn = document.getElementById('targetSelectorCopy');
  const cpyDomBtn = document.getElementById('targetSelectorCopyDomain');
  const ipText = document.getElementById('targetCopyIpText');
  const domText = document.getElementById('targetCopyDomainText');
  const sess = activeSessionId && sessions[activeSessionId];
  const status = (sess && sess.status) || 'active';
  if (selector) selector.classList.remove('status-active', 'status-paused', 'status-complete');
  if (selector) selector.classList.add(`status-${status === 'active' ? 'active' : status}`);
  dot.classList.remove('active', 'paused', 'complete');
  if (t) {
    dot.classList.add(status === 'active' ? 'active' : status);
    if (ipText) ipText.textContent = t.ip || '—';
    if (domText) domText.textContent = t.domain || '—';
    lbl.textContent = t.label || t.ip || t.domain || 'target';
    if (cpyIpBtn) cpyIpBtn.disabled = !t.ip;
    if (cpyDomBtn) cpyDomBtn.disabled = !t.domain;
  } else {
    dot.classList.add(status === 'active' ? 'active' : status);
    if (ipText) ipText.textContent = activeSessionId ? '—' : '—';
    if (domText) domText.textContent = '—';
    lbl.textContent = activeSessionId ? 'No target' : 'No session';
    if (cpyIpBtn) cpyIpBtn.disabled = true;
    if (cpyDomBtn) cpyDomBtn.disabled = true;
  }
}

function copyActiveTarget(kind = 'ip') {
  const t = getActiveTarget();
  if (!t) return;
  const text = kind === 'domain' ? (t.domain || '') : (t.ip || '');
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

function openTargetsPanel() {
  const sess = activeSessionId && sessions[activeSessionId];
  document.getElementById('targetsPanelTitle').textContent =
    sess ? `Targets — ${sess.codename}` : 'Targets';
  document.getElementById('newTargetIP').value     = '';
  document.getElementById('newTargetDomain').value = '';
  document.getElementById('newTargetLabel').value  = '';
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

function closeTargetsPanelIfOutside(e) {
  if (e.target === document.getElementById('targetsOverlay')) closeTargetsPanel();
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
  list.innerHTML = targets.map(t => `
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
  const ip     = document.getElementById('newTargetIP').value.trim();
  const domain = document.getElementById('newTargetDomain').value.trim();
  const label  = document.getElementById('newTargetLabel').value.trim();
  if (!ip && !domain) { document.getElementById('newTargetIP').focus(); return; }
  if (!activeSessionId) return;

  const sess = sessions[activeSessionId];
  if (!sess.targets) sess.targets = [];
  const id = 'tgt_' + Date.now();
  sess.targets.push({ id, ip, domain, label });

  if (sess.targets.length === 1) {
    activeTargetId = id;
    localStorage.setItem('ops-active-target', id);
  }

  document.getElementById('newTargetIP').value     = '';
  document.getElementById('newTargetDomain').value = '';
  document.getElementById('newTargetLabel').value  = '';
  saveNotes();
  renderTargetsList();
  updateTargetSelector();
  refreshCodeBlocks();
}

function setActiveTarget(id) {
  activeTargetId = id;
  localStorage.setItem('ops-active-target', id);
  renderTargetsList();
  updateTargetSelector();
  refreshCodeBlocks();
  closeTargetsPanel();
}

function deleteTarget(id) {
  if (!activeSessionId) return;
  const sess = sessions[activeSessionId];
  sess.targets = (sess.targets || []).filter(t => t.id !== id);
  if (activeTargetId === id) {
    activeTargetId = sess.targets[0]?.id || null;
    if (activeTargetId) localStorage.setItem('ops-active-target', activeTargetId);
    else localStorage.removeItem('ops-active-target');
  }
  Object.values(notes).forEach(n => { if (n.target_id === id) n.target_id = null; });
  saveNotes();
  renderTargetsList();
  updateTargetSelector();
  refreshCodeBlocks();
}

let _targetEditResolve = null;
let _targetEditReject  = null;

function showTargetEditModal(t) {
  return new Promise((resolve, reject) => {
    _targetEditResolve = resolve;
    _targetEditReject  = reject;
    document.getElementById('targetEditTitle').textContent = t.label || t.ip || t.domain || 'Edit Target';
    const tei = document.getElementById('targetEditIcon'); if (tei) tei.innerHTML = ICONS.target;
    document.getElementById('targetEditIP').value     = t.ip     || '';
    document.getElementById('targetEditDomain').value = t.domain || '';
    document.getElementById('targetEditLabel').value  = t.label  || '';
    document.getElementById('targetEditOverlay').classList.add('open');
    setTimeout(() => document.getElementById('targetEditIP').focus(), 40);
  });
}

function _targetEditSave() {
  const ip     = document.getElementById('targetEditIP').value.trim();
  const domain = document.getElementById('targetEditDomain').value.trim();
  const label  = document.getElementById('targetEditLabel').value.trim();
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
  const t = (sess.targets || []).find(t => t.id === id);
  if (!t) return;
  let result;
  try { result = await showTargetEditModal(t); } catch { return; }
  t.ip     = result.ip;
  t.domain = result.domain;
  t.label  = result.label;
  saveNotes();
  renderTargetsList();
  updateTargetSelector();
  renderSessionSidebar();
}
