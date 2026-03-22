const ACCENT_COLORS = [
  '#7c3aed', '#34d399', '#a78bfa', '#fb923c',
  '#f87171', '#fbbf24', '#22d3ee', '#6ee7b7',
];

const accentFor = i => ACCENT_COLORS[i % ACCENT_COLORS.length];

function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    document.getElementById('themeBtn').innerHTML = '<span style="display:flex;align-items:center;gap:5px"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> Dark</span>';
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.remove());
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#ffffff';
    document.head.appendChild(meta);
  } else {
    document.documentElement.removeAttribute('data-theme');
    document.getElementById('themeBtn').innerHTML = '<span style="display:flex;align-items:center;gap:5px"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> Light</span>';
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.remove());
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#363f49';
    document.head.appendChild(meta);
  }
}

function toggleTheme() {
  setTimeout(() => {
    if (noteEditor) {
      const value = cmGetValue(noteEditor);
      cmInitNote();
      cmSetValue(noteEditor, value);
    }
    if (kbEditor) {
      const value = cmGetValue(kbEditor);
      cmInitKb();
      cmSetValue(kbEditor, value);
    }
  }, 50);
  const nextTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  localStorage.setItem('ops-theme', nextTheme);
  applyTheme(nextTheme);
}

applyTheme(localStorage.getItem('ops-theme') || 'dark');

let sidebarVisible = true;
let sidebarState = localStorage.getItem('ops-sidebar-state') || 'full';

function applySidebarState(state) {
  const sidebar = document.querySelector('.sidebar');
  const button = document.getElementById('sidebarToggleBtn');
  if (!sidebar) return;
  sidebar.classList.toggle('sidebar-hidden', state === 'hidden');
  sidebar.classList.toggle('sidebar-icon-only', state === 'icon');
  button.classList.toggle('sidebar-collapsed', state !== 'full');
  sidebarVisible = state !== 'hidden';
  localStorage.setItem('ops-sidebar-state', state);
  sidebarState = state;
}

function toggleSidebar(force) {
  if (force === false) {
    applySidebarState('hidden');
    return;
  }
  if (force === true) {
    applySidebarState('full');
    return;
  }
  const nextState = sidebarState === 'full' ? 'icon' : sidebarState === 'icon' ? 'hidden' : 'full';
  applySidebarState(nextState);
}

(function restoreSidebarState() {
  const saved = localStorage.getItem('ops-sidebar-state');
  if (!saved) {
    const legacy = localStorage.getItem('ops-sidebar-v2');
    sidebarState = legacy === '0' ? 'hidden' : 'full';
  } else {
    sidebarState = saved;
  }
  if (sidebarState !== 'full') requestAnimationFrame(() => applySidebarState(sidebarState));
})();

async function init() {
  initTarget();
  initSyntaxThemePicker();
  applyNotePreviewState();
  try {
    await initNotes();
  } catch (err) {
    document.body.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                  height:100vh;background:#0f0f13;color:#e2e8f0;font-family:'Inter',sans-serif;gap:16px">
        <div style="display:flex;justify-content:center;color:var(--muted);margin-bottom:8px"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
        <div style="font-size:18px;font-weight:700">Workspace Locked</div>
        <div style="font-size:13px;color:#94a3b8;max-width:320px;text-align:center">
          ${err.message === 'cancelled' ? 'Password entry was cancelled.' : (err.message || 'Could not unlock workspace.')}</div>
        <button onclick="location.reload()"
          style="margin-top:8px;padding:8px 24px;background:#7c3aed;border:none;border-radius:8px;
                 color:#fff;font-size:13px;font-weight:600;cursor:pointer">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg> Try Again
        </button>
      </div>`;
    return;
  }

  try {
    const response = await fetch('/api/services');
    const data = await response.json();
    SERVICES = data.services || [];
  } catch (e) {
    console.warn('services unavailable', e);
  }

  try {
    const response = await fetch('/api/tactics');
    const data = await response.json();
    TACTICS = data.tactics || data.guides || [];
  } catch (e) {
    console.warn('tactics unavailable', e);
  }

  await loadNoteTemplates();
  renderNoteTypeGrid();

  document.getElementById('svc-count').textContent = SERVICES.length;
  document.getElementById('tactics-count').textContent = TACTICS.length;

  renderCards('services');
  renderCards('tactics');
  buildSidebar('services');
  setTimeout(() => window._observeCardGrids && window._observeCardGrids(), 150);
}

function switchView(view, navEl) {
  activeView = view;
  document.querySelectorAll('.panel-view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');
  if (navEl) navEl.classList.add('active');
  else document.getElementById(`nav-${view}`)?.classList.add('active');

  const catSection = document.querySelector('.sidebar-section:has(#cat-hdr)');
  if (view === 'services' || view === 'tactics') {
    buildSidebar(view);
    if (catSection) catSection.style.display = '';
    document.getElementById('catList').style.display = '';
  } else {
    document.getElementById('catList').innerHTML = '';
    document.getElementById('catList').style.display = 'none';
    if (catSection) catSection.style.display = 'none';
  }

  if (view === 'search') {
    setTimeout(() => document.getElementById('searchInput').focus(), 50);
    checkEngramStatus();
    if (!knownSources.length) loadSearchSources();
  }
}

function openShortcutsModal() {
  document.getElementById('shortcutsOverlay').classList.add('open');
}

function closeShortcutsModal() {
  document.getElementById('shortcutsOverlay').classList.remove('open');
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

document.addEventListener('keydown', async e => {
  const ctrl = e.metaKey || e.ctrlKey;

  if (ctrl && e.key === 'b') { e.preventDefault(); toggleSidebar(); return; }
  if (ctrl && e.key === 'k') { e.preventDefault(); openCmd(); return; }

  if (ctrl && e.key === 'n') {
    e.preventDefault();
    switchView('notes', document.getElementById('nav-notes'));
    openNewNoteModal();
    return;
  }

  if (ctrl && e.key === 's') {
    if (activeNoteId) {
      e.preventDefault();
      autoSaveNote();
      const status = document.getElementById('noteSaveStatus');
      if (status) {
        status.textContent = '✓ saved';
        setTimeout(() => { status.textContent = 'saved'; }, 1500);
      }
    }
    return;
  }

  if (ctrl && e.key === 'f') {
    if (document.activeElement.tagName !== 'TEXTAREA' &&
        document.activeElement.id !== 'noteBody' &&
        document.activeElement.id !== 'noteTitleInput') {
      e.preventDefault();
      switchView('search', document.getElementById('nav-search'));
      setTimeout(() => document.getElementById('searchInput')?.focus(), 50);
      return;
    }
  }

  if (ctrl && ['1', '2', '3', '4', '5'].includes(e.key)) {
    e.preventDefault();
    const viewMap = {
      '1': ['notes', 'nav-notes'],
      '2': ['services', 'nav-services'],
      '3': ['tactics', 'nav-tactics'],
      '4': ['search', 'nav-search'],
    };
    const viewConfig = viewMap[e.key];
    if (viewConfig) switchView(viewConfig[0], document.getElementById(viewConfig[1]));
    return;
  }

  if (ctrl && e.key === 'e') {
    const contentPanel = document.getElementById('contentPanel');
    if (contentPanel && !contentPanel.classList.contains('hidden-panel') && activeDoc?.isLocal) {
      e.preventDefault();
      toggleEditMode();
      return;
    }
  }

  if (ctrl && e.key === 'l') { e.preventDefault(); toggleSvcPopover(); return; }

  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    const popover = document.getElementById('svcPopover');
    if (popover && popover.classList.contains('open')) {
      const focused = document.activeElement;
      const inInput = focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA');
      if (!inInput) {
        e.preventDefault();
        switchSvcTabByArrow(e.key === 'ArrowRight' ? 1 : -1);
        return;
      }
    }
  }

  if (e.altKey && e.key === 't') {
    e.preventDefault();
    if (activeView !== 'notes') {
      switchView('notes', document.getElementById('nav-notes'));
      setTimeout(() => {
        const btn = document.getElementById('notesViewTimelineBtn');
        if (notesListViewMode !== 'timeline') setNotesListView('timeline', btn);
      }, 30);
    } else if (notesListViewMode === 'timeline') {
      setNotesListView('list', document.getElementById('notesViewListBtn'));
    } else {
      setNotesListView('timeline', document.getElementById('notesViewTimelineBtn'));
    }
    return;
  }

  if (ctrl && e.key === '.') { e.preventDefault(); openTargetsPanel(); return; }

  if (e.key === 'Escape') {
    if (document.getElementById('shortcutsOverlay')?.classList.contains('open')) { closeShortcutsModal(); return; }
    const reassignDropdown = document.getElementById('noteReassignDropdown');
    if (reassignDropdown?.classList.contains('open')) { reassignDropdown.classList.remove('open'); return; }
    if (document.getElementById('svcPopover')?.classList.contains('open')) { closeSvcPopover(); return; }
    if (document.getElementById('targetsOverlay')?.classList.contains('open')) { closeTargetsPanel(); return; }
    if (document.getElementById('sessionOverlay')?.classList.contains('open')) { closeSessionModal(); return; }
    if (document.getElementById('newNoteOverlay')?.classList.contains('open')) { closeNewNoteModal(); return; }
    if (document.getElementById('cmdOverlay')?.classList.contains('open')) { closeCmd(); return; }
    if (document.getElementById('cpEditBody')?.style.display !== 'none') {
      if (cpEditDirty) {
        try {
          await showConfirmDialog({ icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`, title: 'Discard Changes', bigIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`, description: 'You have unsaved changes. Discard them?', confirmLabel: 'Discard', danger: true });
        } catch {
          return;
        }
      }
      exitEditMode();
      return;
    }
    if (!document.getElementById('contentPanel')?.classList.contains('hidden-panel')) { closeContent(); }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const hints = [
    ['nav-services', '⌘1'],
    ['nav-tactics', '⌘2'],
    ['nav-notes', '⌘3'],
    ['nav-search', '⌘4'],
  ];
  hints.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.title = key;
  });
});

init();
cmInitNote();
