// ═══════════════════════════════════════════════
// TIMELINE VIEW
// ═══════════════════════════════════════════════
let notesListViewMode = 'list';

function setNotesListView(mode, btn) {
  notesListViewMode = mode;
  document.querySelectorAll('.notes-view-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const listEl = document.getElementById('notesList');
  const timelineEl = document.getElementById('timelineList');
  const filterBar = document.getElementById('notesTypeFilter');
  const scopeBar = document.querySelector('.notes-scope-bar');
  const tgtBar = document.getElementById('targetFilterBar');
  const tlToolbar = document.getElementById('timelineToolbar');

  if (mode === 'timeline') {
    listEl.style.display = 'none';
    timelineEl.style.display = 'block';
    if (filterBar) filterBar.style.display = 'none';
    if (scopeBar) scopeBar.style.display = 'none';
    if (tgtBar) tgtBar.style.display = 'none';
    if (tlToolbar) tlToolbar.style.display = 'flex';
    renderTimeline();
  } else {
    listEl.style.display = '';
    timelineEl.style.display = 'none';
    if (filterBar) filterBar.style.display = '';
    if (scopeBar) scopeBar.style.display = '';
    if (tlToolbar) tlToolbar.style.display = 'none';
    renderNotesList();
  }
}

function setTlTargetFilter(val) {
  tlTargetFilter = val || null;
  renderTimeline();
}

function renderTimeline() {
  const el = document.getElementById('timelineList');
  if (!el) return;

  const sess = activeSessionId ? sessions[activeSessionId] : null;
  const targets = sess ? (sess.targets || []) : [];

  const sel = document.getElementById('tlTargetSelect');
  if (sel) {
    sel.innerHTML = '<option value="">All targets</option>' +
      targets.map(t => {
        const label = t.ip || t.domain || t.label || 'target';
        return `<option value="${t.id}"${t.id === tlTargetFilter ? ' selected' : ''}>${esc(label)}</option>`;
      }).join('');
    if (!targets.find(t => t.id === tlTargetFilter)) tlTargetFilter = null;
  }

  const allNotes = Object.values(notes);
  let noteItems = activeSessionId
    ? allNotes.filter(n => n.session_id === activeSessionId || n.session_id == null)
    : allNotes;
  if (!noteItems.length && activeSessionId) noteItems = allNotes;

  const sessEvents = sess ? (sess.events || []) : [];

  let unified = [
    ...noteItems.map(n => ({ ts: n.created || 0, kind: 'note', data: n })),
    ...sessEvents.map(e => ({ ts: e.ts, kind: 'event', data: e })),
  ].sort((a, b) => a.ts - b.ts);

  if (tlTargetFilter) {
    unified = unified.filter(item => {
      if (item.kind === 'note') return item.data.target_id === tlTargetFilter;
      return true;
    });
  }

  if (!unified.length) {
    el.innerHTML = `<div style="padding:20px 12px;font-size:12px;color:var(--muted);font-family:Inter,sans-serif;text-align:center;line-height:1.6">
      No events yet.<br><span style="font-size:11px;opacity:0.7">Create notes or change target status to populate the timeline.</span>
    </div>`;
    return;
  }

  const idleMs = 2 * 60 * 60 * 1000;
  const groups = {};

  unified.forEach(item => {
    const dayKey = new Date(item.ts).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: '2-digit' });
    if (!groups[dayKey]) groups[dayKey] = [];

    const prev = groups[dayKey].slice().reverse().find(x => x.type !== 'gap');
    if (prev && (item.ts - prev.ts) > idleMs) {
      const hrs = Math.round((item.ts - prev.ts) / 3600000);
      groups[dayKey].push({ type: 'gap', hrs });
    }
    groups[dayKey].push({ type: 'item', item });
  });

  const statusLabel = s => ({ active: 'Active', paused: 'Paused', complete: 'Complete' }[s] || s);
  const tlStatusClass = s => ({ active: 'tl-status-active', paused: 'tl-status-paused', complete: 'tl-status-complete' }[s] || '');

  let html = '';
  Object.entries(groups).forEach(([dayLabel, entries]) => {
    html += `<div class="timeline-day-group"><div class="timeline-day-label">${esc(dayLabel)}</div>`;

    entries.forEach(entry => {
      if (entry.type === 'gap') {
        html += `<div class="tl-idle-gap"><span class="tl-idle-label">— ${entry.hrs}h break —</span></div>`;
        return;
      }

      const { item } = entry;
      const time = new Date(item.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

      if (item.kind === 'note') {
        const n = item.data;
        const meta = getNoteTypeMeta(n.type);
        const preview = (n.body || '').replace(/^#+\s*/gm, '').replace(/\n/g, ' ').trim().slice(0, 60);
        const tgt = n.target_id ? targets.find(t => t.id === n.target_id) : null;
        const tgtBadge = tgt
          ? `<span class="note-item-target"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> ${esc(tgt.ip || tgt.domain || tgt.label || 'target')}</span>`
          : '';
        html += `<div class="timeline-entry${n.id === activeNoteId ? ' tl-active' : ''}" onclick="openNote('${n.id}')">
          <span class="tl-time">${esc(time)}</span>
          <div class="tl-body">
            <div class="tl-badge-row">
              <span class="tl-type-badge ${meta.cssClass}">${meta.icon} ${meta.label}</span>
              ${tgtBadge}
            </div>
            <div class="tl-title">${esc(n.title || 'Untitled')}</div>
            ${preview ? `<div class="tl-preview">${esc(preview)}</div>` : ''}
          </div>
        </div>`;
      } else {
        const ev = item.data;
        if (ev.type === 'status') {
          html += `<div class="tl-event tl-event-status">
            <span class="tl-time">${esc(time)}</span>
            <span class="tl-event-label">
              Status changed
              <span class="tl-status-badge ${tlStatusClass(ev.from)}">${statusLabel(ev.from)}</span>
              <span class="tl-status-arrow">→</span>
              <span class="tl-status-badge ${tlStatusClass(ev.to)}">${statusLabel(ev.to)}</span>
            </span>
          </div>`;
        } else if (ev.type === 'session_created') {
          html += `<div class="tl-event tl-event-session">
            <span class="tl-time">${esc(time)}</span>
            <span class="tl-event-label">Session <strong>${esc(ev.name || '')}</strong> created</span>
          </div>`;
        }
      }
    });

    html += '</div>';
  });

  el.innerHTML = html;
}

function slugify(str) {
  return (str || 'session').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase().slice(0, 60);
}

function showToast(msg, type = 'ok') {
  const existing = document.getElementById('pragmaToast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.id = 'pragmaToast';
  t.textContent = msg;
  t.style.cssText = `
    position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
    background:${type === 'err' ? 'var(--red)' : 'var(--accent)'};
    color:#fff; font-family:'JetBrains Mono',monospace; font-size:13px; font-weight:700;
    padding:9px 18px; border-radius:8px; z-index:9999;
    box-shadow:0 4px 20px rgba(0,0,0,0.4);
    animation:toastIn 0.15s ease;
    white-space:nowrap; max-width:90vw; overflow:hidden; text-overflow:ellipsis;
  `;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity 0.3s';
    setTimeout(() => t.remove(), 300);
  }, 4000);
}

function downloadJSON(obj, filename) {
  downloadText(JSON.stringify(obj, null, 2), filename, 'application/json');
}

function downloadText(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
