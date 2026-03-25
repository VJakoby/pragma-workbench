// ═══════════════════════════════════════════════
// SHARED APP STATE
// ═══════════════════════════════════════════════
if (typeof globalThis.SERVICES === 'undefined') globalThis.SERVICES = [];
if (typeof globalThis.TACTICS === 'undefined') globalThis.TACTICS = [];
if (typeof globalThis.activeView === 'undefined') globalThis.activeView = 'notes';
if (typeof globalThis.activeDoc === 'undefined') globalThis.activeDoc = null;
if (typeof globalThis.activeCat === 'undefined') globalThis.activeCat = 'all';
if (typeof globalThis.searchScope === 'undefined') globalThis.searchScope = 'all';
if (typeof globalThis.fuzzyMode === 'undefined') globalThis.fuzzyMode = 'normal';
if (typeof globalThis.knownSources === 'undefined') globalThis.knownSources = [];
if (typeof globalThis.disabledSources === 'undefined') {
  globalThis.disabledSources = new Set(JSON.parse(localStorage.getItem('pragma-disabled-sources') || '[]'));
}
if (typeof globalThis.searchDebounce === 'undefined') globalThis.searchDebounce = null;
if (typeof globalThis.cmdSelected === 'undefined') globalThis.cmdSelected = 0;
if (typeof globalThis.cmdItems === 'undefined') globalThis.cmdItems = [];
if (typeof globalThis.notes === 'undefined') globalThis.notes = {};
if (typeof globalThis.sessions === 'undefined') globalThis.sessions = {};
if (typeof globalThis.activeSessionId === 'undefined') globalThis.activeSessionId = null;
if (typeof globalThis.activeTargetId === 'undefined') globalThis.activeTargetId = null;
if (typeof globalThis.activeNoteId === 'undefined') globalThis.activeNoteId = null;
if (typeof globalThis.noteSaveTimer === 'undefined') globalThis.noteSaveTimer = null;
if (typeof globalThis.tlTargetFilter === 'undefined') globalThis.tlTargetFilter = null;
if (typeof globalThis.encryptedStorageEnabled === 'undefined') globalThis.encryptedStorageEnabled = false;
if (typeof globalThis.encryptedStoragePassword === 'undefined') globalThis.encryptedStoragePassword = null;
if (typeof globalThis.encryptedStorageHint === 'undefined') globalThis.encryptedStorageHint = '';

if (typeof globalThis.appSaveState === 'undefined') {
  globalThis.appSaveState = {
    seq: 0,
    phase: 'idle',
    lastSavedAt: 0,
    lastError: null,
    dirty: false,
    pendingReason: null,
    timer: null,
    inFlight: false,
    queuedDuringFlight: false,
    waiters: [],
  };
}

function setNoteSaveIndicator(phase, text) {
  const status = document.getElementById('noteSaveStatus');
  if (!status) return;
  status.textContent = text || (phase === 'saving' ? '...saving' : phase === 'saved' ? 'saved' : 'save failed');
  status.className = phase === 'saved'
    ? 'note-save-status saved'
    : phase === 'error'
      ? 'note-save-status error'
      : 'note-save-status';
}

function beginAppSave(text = '...saving') {
  const seq = ++appSaveState.seq;
  appSaveState.phase = 'saving';
  appSaveState.lastError = null;
  setNoteSaveIndicator('saving', text);
  return seq;
}

function finishAppSaveSuccess(seq, text = 'saved') {
  if (seq !== appSaveState.seq) return;
  appSaveState.phase = 'saved';
  appSaveState.lastSavedAt = Date.now();
  appSaveState.lastError = null;
  setNoteSaveIndicator('saved', text);
}

function finishAppSaveError(seq, error, text = 'save failed') {
  if (seq !== appSaveState.seq) return;
  appSaveState.phase = 'error';
  appSaveState.lastError = error || null;
  setNoteSaveIndicator('error', text);
}

function markAppDirty(reason = 'changes') {
  appSaveState.dirty = true;
  appSaveState.pendingReason = reason;
}

function settleAppSaveWaiters(waiters, result) {
  waiters.forEach(resolve => resolve(result));
}

async function flushAppSave(reason = appSaveState.pendingReason || 'changes') {
  if (appSaveState.timer) {
    clearTimeout(appSaveState.timer);
    appSaveState.timer = null;
  }
  if (appSaveState.inFlight) {
    appSaveState.queuedDuringFlight = true;
    return false;
  }
  if (typeof globalThis.executeAppSave !== 'function') {
    appSaveState.lastError = new Error('Save executor is not available');
    settleAppSaveWaiters(appSaveState.waiters.splice(0), false);
    return false;
  }

  const seq = beginAppSave();
  const batchWaiters = appSaveState.waiters.splice(0);
  appSaveState.inFlight = true;
  appSaveState.dirty = false;
  appSaveState.pendingReason = reason;

  let ok = false;
  try {
    ok = await globalThis.executeAppSave({ seq, reason });
    if (ok) finishAppSaveSuccess(seq);
    else {
      appSaveState.dirty = true;
      finishAppSaveError(seq, appSaveState.lastError || new Error('Save failed'));
    }
  } catch (err) {
    appSaveState.dirty = true;
    finishAppSaveError(seq, err);
    ok = false;
  } finally {
    appSaveState.inFlight = false;
    settleAppSaveWaiters(batchWaiters, ok);
    if (appSaveState.queuedDuringFlight || appSaveState.waiters.length) {
      appSaveState.queuedDuringFlight = false;
      setTimeout(() => flushAppSave(appSaveState.pendingReason || reason), 0);
    }
  }
  return ok;
}

function queueAppSave(opts = {}) {
  const reason = opts.reason || 'changes';
  const immediate = !!opts.immediate;
  const delay = opts.delay == null ? 180 : opts.delay;
  markAppDirty(reason);
  setNoteSaveIndicator('saving', opts.statusText || '...saving');

  return new Promise(resolve => {
    appSaveState.waiters.push(resolve);
    if (appSaveState.inFlight) {
      appSaveState.queuedDuringFlight = true;
      return;
    }
    if (appSaveState.timer) clearTimeout(appSaveState.timer);
    if (immediate || delay <= 0) {
      flushAppSave(reason);
      return;
    }
    appSaveState.timer = setTimeout(() => flushAppSave(reason), delay);
  });
}
