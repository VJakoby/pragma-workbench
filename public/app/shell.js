const ACCENT_COLORS = [
  '#7c3aed', '#34d399', '#a78bfa', '#fb923c',
  '#f87171', '#fbbf24', '#22d3ee', '#6ee7b7',
];

const THEME_ORDER = ['dark', 'light'];

const accentFor = i => ACCENT_COLORS[i % ACCENT_COLORS.length];

function refreshThemeToggle(theme) {
  const nextTheme = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length] || 'dark';
  const lightBtn = document.getElementById('themeLightBtn');
  const darkBtn = document.getElementById('themeDarkBtn');
  const toggle = document.getElementById('themeBtn');
  if (!lightBtn || !darkBtn || !toggle) return;
  lightBtn.classList.toggle('active', theme === 'light');
  darkBtn.classList.toggle('active', theme === 'dark');
  lightBtn.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
  darkBtn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  toggle.title = `Current theme: ${theme}. Switch to ${nextTheme}`;
}

function applyTheme(theme) {
  if (theme === 'dim') theme = 'dark';
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.remove());
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#ffffff';
    document.head.appendChild(meta);
  } else {
    document.documentElement.removeAttribute('data-theme');
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.remove());
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#363f49';
    document.head.appendChild(meta);
  }
  refreshThemeToggle(theme);
}

function toggleTheme() {
  const currentTheme = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dim'
    ? 'dark'
    : (document.documentElement.getAttribute('data-theme') || 'dark');
  const currentIndex = THEME_ORDER.indexOf(currentTheme);
  const nextTheme = THEME_ORDER[(currentIndex + 1) % THEME_ORDER.length] || 'dark';
  setTheme(nextTheme);
}

function setTheme(theme) {
  theme = theme === 'light' ? 'light' : 'dark';
  localStorage.setItem('ops-theme', theme);
  applyTheme(theme);
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
}

applyTheme((localStorage.getItem('ops-theme') || 'dark') === 'dim' ? 'dark' : (localStorage.getItem('ops-theme') || 'dark'));

let sidebarVisible = true;
let sidebarState = localStorage.getItem('ops-sidebar-state') || 'full';
let observerModeEnabled = localStorage.getItem('ops-observer-mode') === '1';

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

function applyObserverModeState() {
  document.body.classList.toggle('observer-mode', observerModeEnabled);
  localStorage.setItem('ops-observer-mode', observerModeEnabled ? '1' : '0');
  const btn = document.getElementById('observerModeBtn');
  const nav = document.getElementById('nav-observer-mode');
  if (btn) {
    btn.classList.toggle('active', observerModeEnabled);
    btn.title = observerModeEnabled ? 'Exit observer mode' : 'Enter observer mode';
  }
  if (nav) {
    nav.classList.toggle('active', observerModeEnabled);
    nav.title = observerModeEnabled ? 'Exit observer mode' : 'Observer mode';
  }
  if (observerModeEnabled) {
    const notesNav = document.getElementById('nav-notes');
    if (typeof switchView === 'function') switchView('notes', notesNav);
    if (typeof closeNewNoteModal === 'function') closeNewNoteModal();
    if (typeof closeSessionModal === 'function') closeSessionModal();
    if (typeof closeTargetsPanel === 'function') closeTargetsPanel();
  }
  if (typeof applyNotePreviewState === 'function') applyNotePreviewState();
}

function toggleObserverMode(force) {
  observerModeEnabled = typeof force === 'boolean' ? force : !observerModeEnabled;
  applyObserverModeState();
}

window.toggleObserverMode = toggleObserverMode;
window.isObserverModeEnabled = () => observerModeEnabled;

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
        <div style="font-size:18px;font-weight:700">Workbench Locked</div>
        <div style="font-size:13px;color:#94a3b8;max-width:320px;text-align:center">
          ${err.message === 'cancelled' ? 'Password entry was cancelled.' : (err.message || 'Could not unlock workbench.')}</div>
        <button id="lockedRetryBtn" onclick="location.reload()"
          style="margin-top:8px;padding:8px 24px;background:#7c3aed;border:none;border-radius:8px;
                 color:#fff;font-size:13px;font-weight:600;cursor:pointer">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg> Try Again
        </button>
      </div>`;
    setTimeout(() => document.getElementById('lockedRetryBtn')?.focus(), 40);
    return;
  }

  try {
    const response = await fetch('/api/services');
    const data = await response.json();
    SERVICES = data.services || [];
    if (typeof serviceCategoryMeta !== 'undefined') serviceCategoryMeta = data.categories || [];
    if (typeof refreshRootKbSections === 'function') await refreshRootKbSections();
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
  renderNotesList();
  if (activeNoteId && notes[activeNoteId]) openNote(activeNoteId);

  document.getElementById('svc-count').textContent = SERVICES.length;
  document.getElementById('tactics-count').textContent = TACTICS.length;

  await Promise.allSettled([
    typeof loadSearchSources === 'function' ? loadSearchSources() : Promise.resolve(),
    typeof checkEngramStatus === 'function' ? checkEngramStatus() : Promise.resolve(),
  ]);

  renderCards('services');
  renderCards('tactics');
  renderKnowledgeFolderNav();
  buildSidebar('tactics');
  setTimeout(() => window._observeCardGrids && window._observeCardGrids(), 150);
  applyObserverModeState();
}

function switchView(view, navEl) {
  activeView = view;
  document.querySelectorAll('.panel-view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');
  if (view === 'services' && navEl?.id === 'nav-services' && typeof activeCatFolder !== 'undefined') {
    activeCatFolder = '';
    if (typeof activeKbRootFolder !== 'undefined') activeKbRootFolder = '';
  }
  if (navEl) {
    navEl.classList.add('active');
  } else {
    document.getElementById(`nav-${view}`)?.classList.add('active');
  }
  if (observerModeEnabled) {
    document.getElementById('nav-observer-mode')?.classList.add('active');
  }

  const catSection = document.querySelector('.sidebar-section:has(#cat-hdr)');
  if (view === 'tactics') {
    buildSidebar(view);
    if (catSection) catSection.style.display = '';
    document.getElementById('catList').style.display = '';
  } else if (view === 'services') {
    if (typeof renderKnowledgeFolderNav === 'function') renderKnowledgeFolderNav();
    if (typeof getActiveKbBrowserView === 'function') buildSidebar(getActiveKbBrowserView());
    else buildSidebar(view);
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

function setSidebarInfoOpen(open) {
  const wrap = document.getElementById('sidebarInfo');
  const btn = wrap?.querySelector('.sidebar-info-btn');
  if (!wrap || !btn) return;
  wrap.classList.toggle('open', !!open);
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function toggleSidebarInfo(event) {
  event?.stopPropagation();
  const wrap = document.getElementById('sidebarInfo');
  if (!wrap) return;
  setSidebarInfoOpen(!wrap.classList.contains('open'));
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
  const key = typeof e.key === 'string' ? e.key.toLowerCase() : '';
  const code = e.code || '';

  if (ctrl && key === 'b') { e.preventDefault(); toggleSidebar(); return; }
  if (ctrl && key === 'k') { e.preventDefault(); openCmd(); return; }

  if (ctrl && key === 'n') {
    e.preventDefault();
    switchView('notes', document.getElementById('nav-notes'));
    openNewNoteModal();
    return;
  }

  if (ctrl && key === 's') {
    if (activeConfigDoc) {
      e.preventDefault();
      clearTimeout(noteSaveTimer);
      setNoteSaveIndicator('saving', '...saving');
      await persistTemplatesConfig({ reason: 'config-manual-save' });
    } else if (activeNoteId) {
      e.preventDefault();
      clearTimeout(noteSaveTimer);
      setNoteSaveIndicator('saving', '...saving');
      await persistActiveNote({ reason: 'note-manual-save', immediate: true });
    }
    return;
  }

  if (ctrl && key === 'f') {
    if (document.activeElement.tagName !== 'TEXTAREA' &&
        document.activeElement.id !== 'noteBody' &&
        document.activeElement.id !== 'noteTitleInput') {
      e.preventDefault();
      switchView('search', document.getElementById('nav-search'));
      setTimeout(() => document.getElementById('searchInput')?.focus(), 50);
      return;
    }
  }

  if (ctrl && ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].includes(code)) {
    e.preventDefault();
    const viewMap = {
      Digit1: ['notes', 'nav-notes'],
      Digit2: ['services', null],
      Digit3: ['tactics', 'nav-tactics'],
      Digit4: ['search', 'nav-search'],
    };
    const viewConfig = viewMap[code];
    if (viewConfig) switchView(viewConfig[0], viewConfig[1] ? document.getElementById(viewConfig[1]) : null);
    return;
  }

  if (ctrl && key === 'e') {
    const contentPanel = document.getElementById('contentPanel');
    if (contentPanel && !contentPanel.classList.contains('hidden-panel') && activeDoc?.isLocal && !observerModeEnabled) {
      e.preventDefault();
      toggleEditMode();
      return;
    }
  }

  if (ctrl && key === 'l') { e.preventDefault(); toggleSvcPopover(); return; }
  if (ctrl && key === 'm') { e.preventDefault(); toggleTodoPopover(); return; }

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

  if (e.altKey && key === 't') {
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

  if (ctrl && code === 'Period') { e.preventDefault(); openTargetsPanel(); return; }

  if (e.key === 'Escape') {
    if (document.getElementById('sidebarInfo')?.classList.contains('open')) { setSidebarInfoOpen(false); return; }
    if (document.getElementById('shortcutsOverlay')?.classList.contains('open')) { closeShortcutsModal(); return; }
    const reassignDropdown = document.getElementById('noteReassignDropdown');
    if (reassignDropdown?.classList.contains('open')) { reassignDropdown.classList.remove('open'); return; }
    const targetAssignDropdown = document.getElementById('noteTargetAssignDropdown');
    if (targetAssignDropdown?.classList.contains('open')) { targetAssignDropdown.classList.remove('open'); return; }
    if (document.getElementById('todoPopover')?.classList.contains('open')) { closeTodoPopover(); return; }
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
    if (!document.getElementById('contentPanel')?.classList.contains('hidden-panel')) {
      closeContent();
      return;
    }
    const noteArea = document.getElementById('noteEditArea');
    if (activeView === 'notes' && (activeNoteId || activeConfigDoc) && noteArea && noteArea.style.display !== 'none') {
      await closeCurrentNote();
      return;
    }
  }
});

document.addEventListener('click', e => {
  const wrap = document.getElementById('sidebarInfo');
  if (!wrap?.classList.contains('open')) return;
  if (!e.target.closest('#sidebarInfo')) setSidebarInfoOpen(false);
});

document.addEventListener('DOMContentLoaded', () => {
  const hints = [
    [document.getElementById('nav-notes'), '⌘1'],
    [document.getElementById('nav-services'), '⌘2'],
    [document.getElementById('nav-tactics'), '⌘3'],
    [document.getElementById('nav-search'), '⌘4'],
  ];
  hints.forEach(([el, key]) => {
    if (el) el.title = key;
  });
});

init();
cmInitNote();
