// ═══════════════════════════════════════════════
// WORKBENCH STATE
// ═══════════════════════════════════════════════
const TEMPLATES_PATH = '/api/templates';

const BLANK_NOTE_META = {
  label: 'Blank',
  icon: '📋',
  cssClass: 'note-type-scratch',
};

const BUILTIN_NOTE_TYPE_META = {
  general:     { label: 'General',     icon: '📋', cssClass: 'note-type-general'     },
  credentials: { label: 'Credentials', icon: '🔑', cssClass: 'note-type-credentials' },
  'passive-recon': { label: 'Passive Recon', icon: '🛰', cssClass: 'note-type-passive-recon' },
  privesc:     { label: 'Privilege Escalation', icon: '⬆',  cssClass: 'note-type-privesc'     },
  recon:       { label: 'Recon',       icon: '🔭', cssClass: 'note-type-recon'       },
  'network-enumeration': { label: 'Network Enumeration', icon: '🌐', cssClass: 'note-type-network-enumeration' },
  loot:        { label: 'Loot',        icon: '💰', cssClass: 'note-type-loot'        },
  exploit:     { label: 'Exploitation', icon: '💥', cssClass: 'note-type-exploit'     },
};

let NOTE_TYPE_META = {
  scratch: { ...BLANK_NOTE_META },
};

const NOTE_TEMPLATES_FALLBACK = {
  credentials: { title: 'Credentials',         body: `## Credentials\n\n| Username | Password | Hash | Service | Notes |\n|----------|----------|------|---------|-------|\n|          |          |      |         |       |\n\n## Password Spray / Stuffing Notes\n\n\n## Valid Sessions / Tokens\n\n` },
  'passive-recon': { title: 'Passive Recon',   body: `## Passive Recon\n\nUse this note to collect curated passive reconnaissance results from Toolbox.\n\n` },
  privesc:     { title: 'Privilege Escalation', body: `## System Info\n\n| Field     | Value |\n|-----------|-------|\n| OS        |       |\n| Kernel    |       |\n| Hostname  |       |\n| Current User |    |\n| Groups    |       |\n\n## Enumeration\n\n### SUID / SGID Binaries\n\n\n### Sudo Rights\n\n\n### Cron Jobs\n\n\n### Writable Paths / Misconfigs\n\n\n### Interesting Files\n\n\n## Vectors Attempted\n\n| Vector | Result | Notes |\n|--------|--------|-------|\n|        |        |       |\n\n## Escalation Path\n\n\n` },
  recon:       { title: 'Recon',               body: `## Target Overview\n\n| Field   | Value |\n|---------|-------|\n| IP      |       |\n| Domain  |       |\n| OS      |       |\n| In Scope|       |\n\n## Open Ports & Services\n\n| Port | Proto | Service | Version | Notes |\n|------|-------|---------|---------|-------|\n|      |       |         |         |       |\n\n## Web Endpoints\n\n\n## DNS / Hostnames\n\n\n## Users / Groups Discovered\n\n\n## Findings\n\n` },
  'network-enumeration': { title: 'Network Enumeration', body: `## Target Overview\n\n| Field | Value |\n|-------|-------|\n| IP | |\n| Domain | |\n| Hostname | |\n\n## Open Ports & Services\n\n| Port | Proto | Service | Version | Notes |\n|------|-------|---------|---------|-------|\n|      |       |         |         |       |\n\n## Notes\n\n` },
  exploit:     { title: 'Exploitation',             body: `## Vulnerability\n\n| Field       | Value |\n|-------------|-------|\n| Name        |       |\n| CVE         |       |\n| CVSS        |       |\n| Affected    |       |\n| Auth Required|      |\n\n## Payload\n\n\`\`\`bash\n\n\`\`\`\n\n## Steps\n\n1. \n2. \n3. \n\n## Outcome\n\n\n## Cleanup / Artifacts to Remove\n\n` },
  scratch:     { title: '',                    body: '' },
};

let NOTE_TEMPLATES = { ...NOTE_TEMPLATES_FALLBACK };
const NOTE_TEMPLATE_VARIANT_SELECTIONS = {};
let NOTE_TEMPLATE_WARNING_SHOWN = false;
let shouldPromptForSessionOnStartup = false;

function getFallbackTemplates() {
  return Object.fromEntries(Object.entries(NOTE_TEMPLATES_FALLBACK).map(([id, tmpl]) => [id, { ...tmpl }]));
}

function normalizeCssClass(type) {
  return BUILTIN_NOTE_TYPE_META[type]?.cssClass || 'note-type-general';
}


function normalizeGuidanceList(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
}

function normalizeTemplateGuidance(guidance) {
  return {
    objective: String(guidance?.objective || '').trim(),
    checklist: normalizeGuidanceList(guidance?.checklist),
    operator_prompts: normalizeGuidanceList(guidance?.operator_prompts),
    suggested_commands: normalizeGuidanceList(guidance?.suggested_commands),
    evidence_prompts: normalizeGuidanceList(guidance?.evidence_prompts),
  };
}

function mergeTemplateGuidance(baseGuidance, variantGuidance) {
  const base = normalizeTemplateGuidance(baseGuidance);
  const variant = normalizeTemplateGuidance(variantGuidance);
  return {
    objective: variant.objective || base.objective,
    checklist: variant.checklist.length ? variant.checklist : base.checklist,
    operator_prompts: variant.operator_prompts.length ? variant.operator_prompts : base.operator_prompts,
    suggested_commands: variant.suggested_commands.length ? variant.suggested_commands : base.suggested_commands,
    evidence_prompts: variant.evidence_prompts.length ? variant.evidence_prompts : base.evidence_prompts,
  };
}

function normalizeTemplateVariant(variant) {
  if (!variant || typeof variant !== 'object') return null;
  const id = String(variant.id || '').trim();
  if (!id) return null;
  return {
    id,
    label: String(variant.label || id).trim() || id,
    title: String(variant.title || '').trim(),
    body: String(variant.body || ''),
    default_tags: Array.isArray(variant.default_tags) ? [...variant.default_tags] : null,
    guidance: normalizeTemplateGuidance(variant.guidance),
  };
}

function normalizeTemplateDefinition(tmpl, fromFile = false) {
  return {
    title: String(tmpl?.title || '').trim(),
    body: String(tmpl?.body || ''),
    icon: tmpl?.icon,
    label: tmpl?.label,
    required: !!tmpl?.required,
    default_tags: Array.isArray(tmpl?.default_tags) ? [...tmpl.default_tags] : [],
    guidance: normalizeTemplateGuidance(tmpl?.guidance),
    variants: Array.isArray(tmpl?.variants) ? tmpl.variants.map(normalizeTemplateVariant).filter(Boolean) : [],
    fromFile,
  };
}

function getTemplateVariant(type, variantId = null) {
  const tmpl = NOTE_TEMPLATES[type];
  const variants = Array.isArray(tmpl?.variants) ? tmpl.variants : [];
  if (!variants.length) return null;
  const selectedId = String(variantId || NOTE_TEMPLATE_VARIANT_SELECTIONS[type] || variants[0].id);
  return variants.find(variant => variant.id === selectedId) || variants[0];
}

function resolveTemplateForCreation(type, variantId = null) {
  const tmpl = NOTE_TEMPLATES[type] || NOTE_TEMPLATES.scratch;
  const variant = getTemplateVariant(type, variantId);
  return {
    ...tmpl,
    title: variant?.title || tmpl.title || '',
    body: variant?.body || tmpl.body || '',
    default_tags: Array.isArray(variant?.default_tags) ? [...variant.default_tags] : [...(tmpl.default_tags || [])],
    guidance: mergeTemplateGuidance(tmpl?.guidance, variant?.guidance),
    variant_id: variant?.id || null,
    variant_label: variant?.label || null,
  };
}

function setNoteTemplates(templates, { fromFile = false } = {}) {
  NOTE_TYPE_META = { scratch: { ...BLANK_NOTE_META } };
  NOTE_TEMPLATES = { scratch: { ...NOTE_TEMPLATES_FALLBACK.scratch } };

  Object.entries(templates || {}).forEach(([id, tmpl]) => {
    if (!id || id === 'scratch') return;
    NOTE_TEMPLATES[id] = normalizeTemplateDefinition(tmpl, fromFile);
    NOTE_TYPE_META[id] = {
      label: tmpl?.label || BUILTIN_NOTE_TYPE_META[id]?.label || id,
      icon: tmpl?.icon || BUILTIN_NOTE_TYPE_META[id]?.icon || '📄',
      cssClass: normalizeCssClass(id),
    };
    const defaultVariantId = NOTE_TEMPLATES[id].variants?.[0]?.id;
    if (defaultVariantId) NOTE_TEMPLATE_VARIANT_SELECTIONS[id] = defaultVariantId;
    else delete NOTE_TEMPLATE_VARIANT_SELECTIONS[id];
  });
}

function getBlankTemplateButton() {
  return `<button class="new-note-type-btn" data-type="scratch" onclick="newNote('scratch')"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg> Blank</button>`;
}

function getNoteTypeMeta(type) {
  return NOTE_TYPE_META[type] || {
    label: type || 'Note',
    icon: '📄',
    cssClass: 'note-type-general',
  };
}

let workbenchUnlocked        = true;
const ENCRYPTED_CACHE_KEY    = 'ops-notes-v2-encrypted';

function setEncryptedCache(blob) {
  sessionStorage.setItem(ENCRYPTED_CACHE_KEY, JSON.stringify(blob));
  localStorage.removeItem(ENCRYPTED_CACHE_KEY);
}

function clearEncryptedCache() {
  sessionStorage.removeItem(ENCRYPTED_CACHE_KEY);
  localStorage.removeItem(ENCRYPTED_CACHE_KEY);
}

function getEncryptedCache() {
  const current = sessionStorage.getItem(ENCRYPTED_CACHE_KEY);
  if (current) return current;

  const legacy = localStorage.getItem(ENCRYPTED_CACHE_KEY);
  if (legacy) {
    sessionStorage.setItem(ENCRYPTED_CACHE_KEY, legacy);
    localStorage.removeItem(ENCRYPTED_CACHE_KEY);
    return legacy;
  }
  return null;
}

async function loadNoteTemplates() {
  try {
    const r = await fetch(TEMPLATES_PATH);
    const d = await r.json();
    if (!d.templates || !d.templates.length) {
      console.log('[Templates] No templates file or empty — using hardcoded fallback');
      setNoteTemplates(getFallbackTemplates());
      if (!NOTE_TEMPLATE_WARNING_SHOWN) {
        NOTE_TEMPLATE_WARNING_SHOWN = true;
        showToast('⚠ note-templates.json missing or empty — using built-in templates', 'err');
      }
      renderNoteTypeGrid();
      renderNoteFilterBar();
      return;
    }
    const loaded = {};
    for (const t of d.templates) {
      if (!t.id) continue;
      loaded[t.id] = {
        title:        t.title_prefix || '',
        body:         t.body || '',
        icon:         t.icon,
        label:        t.label,
        default_tags: t.default_tags || [],
        guidance:     t.guidance || null,
        variants:     Array.isArray(t.variants) ? t.variants.map((variant) => ({
          id: variant?.id,
          label: variant?.label,
          title: variant?.title_prefix || '',
          body: variant?.body || '',
          default_tags: variant?.default_tags || null,
          guidance: variant?.guidance || null,
        })) : [],
        fromFile:     true,
      };
    }
    setNoteTemplates(loaded, { fromFile: true });
    console.log(`[Templates] Loaded ${Object.keys(loaded).length} templates from file`);
    renderNoteTypeGrid();
    renderNoteFilterBar();
  } catch (e) {
    console.warn('[Templates] Failed to load templates file, using hardcoded fallback:', e.message);
    setNoteTemplates(getFallbackTemplates());
    if (!NOTE_TEMPLATE_WARNING_SHOWN) {
      NOTE_TEMPLATE_WARNING_SHOWN = true;
      showToast('⚠ note-templates.json could not be loaded — using built-in templates', 'err');
    }
    renderNoteTypeGrid();
    renderNoteFilterBar();
  }
}

function renderNoteTypeGrid() {
  const grid = document.getElementById('newNoteTypeGrid');
  if (!grid) return;
  const buttons = [getBlankTemplateButton()];
  Object.entries(NOTE_TEMPLATES)
    .filter(([id]) => id !== 'scratch')
    .forEach(([id, tmpl]) => {
      const meta = getNoteTypeMeta(id);
      const isRequired = !!tmpl.required || id === 'network-enumeration' || id === 'credentials';
      const requiredLabel = isRequired
        ? `<span class="new-note-type-required" title="Required for Quick Log / Loot sync">Required</span>`
        : '';
      const variantsLabel = Array.isArray(tmpl.variants) && tmpl.variants.length
        ? `<span class="new-note-type-meta">${tmpl.variants.length} variant${tmpl.variants.length !== 1 ? 's' : ''}</span>`
        : '';
      buttons.push(`<button class="new-note-type-btn${isRequired ? ' template-required' : ''}${tmpl.fromFile ? ' template-from-file' : ''}" data-type="${id}" onclick="selectNewNoteType(decodeURIComponent('${encodeURIComponent(id)}'))">${meta.icon}<span class="new-note-type-label">${meta.label}</span>${variantsLabel}${requiredLabel}</button>`);
    });
  grid.innerHTML = buttons.join('');
}

function updateEncryptedStorageUI() {
  const btn      = document.getElementById('encStorageBtn');
  const dlBtn    = document.getElementById('encDownloadBtn');
  const bakBtn   = document.getElementById('bakDownloadBtn');
  const sidebar  = document.querySelector('.sidebar');
  if (!btn) return;
  const locked = encryptedStorageEnabled && !encryptedStoragePassword;
  const active = encryptedStorageEnabled && !locked;
  btn.classList.toggle('on',     active);
  btn.classList.toggle('locked', locked);
  if (sidebar) sidebar.classList.toggle('enc-active', active);
  document.body.classList.toggle('enc-active-body', active);
  btn.innerHTML = '<span style="display:flex;align-items:center;gap:5px">' + ICONS.lock + ' Encrypted Workbench</span>';
  btn.title = locked ? 'Encrypted Workbench (Locked)' : active ? 'Encrypted Workbench (Enabled)' : 'Encrypted Workbench';
  btn.setAttribute('aria-label', btn.title);
  if (dlBtn) dlBtn.style.display = encryptedStorageEnabled ? '' : 'none';
  if (bakBtn) bakBtn.style.display = encryptedStorageEnabled ? 'none' : '';
}

async function downloadWorkbench() {
  try {
    if (!encryptedStorageEnabled) {
      const a = document.createElement('a');
      a.href = '/api/notes/download';
      a.download = 'pragma.workbench.enc';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    if (!encryptedStoragePassword) {
      showToast('⚠ Workbench is locked — unlock it before downloading an encrypted backup', 'err');
      return;
    }

    let password;
    try {
      password = await showPasswordPrompt({
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
        title: 'Download Encrypted Backup',
        description: 'Re-enter your current workbench password to generate and download an encrypted backup file.',
        label: 'Current Password',
        placeholder: 'Enter current password…',
        submitLabel: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download Backup',
      });
    } catch {
      return;
    }

    if (password !== encryptedStoragePassword) {
      showToast('⚠ Incorrect password — encrypted backup not downloaded', 'err');
      return;
    }

    const payload = {
      notes,
      sessions,
      attachments: typeof collectAttachmentPayloadsForNotes === 'function'
        ? await collectAttachmentPayloadsForNotes(Object.values(notes || {}))
        : {},
    };
    const blob = await encryptPayload(JSON.stringify(payload), password);
    if (encryptedStorageHint) blob.hint = encryptedStorageHint;

    const file = new Blob([JSON.stringify(blob, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pragma.workbench.enc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('✓ Encrypted backup downloaded: pragma.workbench.enc');
  } catch (err) {
    showToast('⚠ Encrypted backup failed: ' + err.message, 'err');
  }
}

async function downloadBackup() {
  try {
    const res = await fetch('/api/notes/download-backup');
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      showToast('⚠ ' + (err.error || 'No backup available'), 'err');
      return;
    }
    const disposition = res.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match ? match[1] : 'pragma.workbench.bak1';
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('✓ Backup downloaded: ' + filename);
  } catch (err) {
    showToast('⚠ Backup download failed: ' + err.message, 'err');
  }
}

async function toggleEncryptedStorage(e) {
  try { e?.stopPropagation?.(); } catch (_) {}

  if (encryptedStorageEnabled && !encryptedStoragePassword) {
    showToast('⚠ Workbench is locked — unlock it first before changing encryption settings');
    return;
  }

  if (!encryptedStorageEnabled) {
    let pw1;
    try {
      pw1 = await showPasswordPrompt({
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`, title: 'Enable Encrypted Workbench',
        description: 'All notes and session data will be encrypted with AES-256-GCM before being written to disk. <strong>If you lose this password, your data cannot be recovered.</strong>',
        label: 'Set Password', placeholder: 'Choose a strong password…',
        confirm: true, submitLabel: ICONS.lock + ' Enable Encryption',
        hint: true,
      });
    } catch { return; }
    encryptedStorageEnabled  = true;
    encryptedStoragePassword = pw1.password;
    encryptedStorageHint     = pw1.hint || '';
    updateEncryptedStorageUI();
    try {
      if (typeof migrateNoteAttachmentsStorage === 'function') {
        await migrateNoteAttachmentsStorage('encrypted');
      }
    } catch (err) {
      encryptedStorageEnabled = false;
      encryptedStoragePassword = null;
      encryptedStorageHint = '';
      updateEncryptedStorageUI();
      showToast('⚠ Attachment encryption failed: ' + (err.message || 'unknown error'), 'err');
      return;
    }
    if (typeof refreshRenderedMarkdownSurfaces === 'function') await refreshRenderedMarkdownSurfaces();
    await saveNotes({ reason: 'enable-encrypted-storage', immediate: true });
  } else {
    let confirmPw;
    try {
      confirmPw = await showPasswordPrompt({
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`,
        title: 'Disable Encrypted Workbench',
        description: 'Enter your current workbench password to disable encryption. Future saves will be stored as <strong>plaintext</strong> on disk.',
        label: 'Current Password',
        placeholder: 'Re-enter current password…',
        submitLabel: 'Disable Encryption',
      });
    } catch { return; }
    if (confirmPw !== encryptedStoragePassword) {
      showToast('⚠ Incorrect password — encryption stays enabled', 'err');
      return;
    }
    try {
      await showConfirmDialog({
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`, title: 'Disable Encrypted Workbench',
        bigIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`,
        description: 'Encryption will be disabled. Your notes will be stored as <strong>plaintext</strong> on disk from the next save onwards.',
        confirmLabel: 'Disable Encryption', danger: true,
      });
    } catch { return; }
    try {
      if (typeof migrateNoteAttachmentsStorage === 'function') {
        await migrateNoteAttachmentsStorage('plaintext');
      }
    } catch (err) {
      showToast('⚠ Attachment decryption failed: ' + (err.message || 'unknown error'), 'err');
      return;
    }
    try {
      await fetch('/api/notes/storage/disable-encrypted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessions,
          notes,
          attachment_manifest: typeof buildAttachmentManifestFromClientNotes === 'function'
            ? buildAttachmentManifestFromClientNotes(notes)
            : {},
        }),
      });
    } catch (_) {}
    encryptedStorageEnabled  = false;
    encryptedStoragePassword = null;
    updateEncryptedStorageUI();
    if (typeof refreshRenderedMarkdownSurfaces === 'function') await refreshRenderedMarkdownSurfaces();
    await saveNotes({ reason: 'disable-encrypted-storage', immediate: true });
  }
}

async function initNotes() {
  try {
    const r = await fetch('/api/notes');
    const d = await r.json();
    if (d && d.encrypted_storage === true) {
      encryptedStorageEnabled = true;
      updateEncryptedStorageUI();
      const encRes = await fetch('/api/notes/encrypted');
      const encObj = await encRes.json();
      let pw;
      try {
        pw = await showPasswordPrompt({
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`, title: 'Workbench Locked',
          description: 'This workbench is encrypted. Enter your password to unlock and load your notes.'
            + (encObj.hint ? `<div style="margin-top:10px;padding:8px 12px;background:var(--bg1);border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:0 4px 4px 0;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text2)">Hint: ${encObj.hint}</div>` : ''),
          label: 'Password', placeholder: 'Enter password…',
          submitLabel: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg> Unlock',
        });
      } catch { throw new Error('cancelled'); }
      let plain;
      try {
        plain = await decryptPayload(encObj, pw);
      } catch {
        throw new Error('Incorrect password — decryption failed');
      }
      encryptedStoragePassword = pw;
      encryptedStorageHint     = encObj.hint || '';
      updateEncryptedStorageUI();
      const parsed = JSON.parse(plain);
      notes    = (parsed.notes !== undefined ? parsed.notes : parsed) || {};
      sessions = parsed.sessions || {};
      setEncryptedCache(encObj);
      localStorage.removeItem('ops-notes-v2');
    } else {
      notes    = (d.notes !== undefined ? d.notes : d) || {};
      sessions = d.sessions || {};
      localStorage.setItem('ops-notes-v2', JSON.stringify({ notes, sessions }));
      clearEncryptedCache();
      encryptedStorageEnabled  = false;
      encryptedStoragePassword = null;
      updateEncryptedStorageUI();
    }
  } catch (outerErr) {
    if (outerErr.message && (outerErr.message.includes('decrypt') || outerErr.message.includes('Password') || outerErr.message.includes('Incorrect') || outerErr.message.includes('cancelled'))) {
      throw outerErr;
    }
    try {
      const encCached = getEncryptedCache();
      if (encCached) {
        const encObj = JSON.parse(encCached);
        if (encObj && encObj.encrypted === true) {
          encryptedStorageEnabled = true;
          updateEncryptedStorageUI();
          let pw;
          try {
            pw = await showPasswordPrompt({
              icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`, title: 'Workbench Locked',
              description: 'This workbench is encrypted. Enter your password to unlock.',
              label: 'Password', placeholder: 'Enter password…',
              submitLabel: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg> Unlock',
            });
          } catch { throw new Error('Password required'); }
          let plain;
          try {
            plain = await decryptPayload(encObj, pw);
          } catch {
            throw new Error('Incorrect password — decryption failed');
          }
          encryptedStoragePassword = pw;
          encryptedStorageHint     = encObj.hint || '';
          updateEncryptedStorageUI();
          const parsed = JSON.parse(plain);
          notes    = (parsed.notes !== undefined ? parsed.notes : parsed) || {};
          sessions = parsed.sessions || {};
          setEncryptedCache(encObj);
        }
      }
      if (!encryptedStorageEnabled) {
        const cached = JSON.parse(localStorage.getItem('ops-notes-v2') || '{}');
        notes    = cached.notes || {};
        sessions = cached.sessions || {};
      }
    } catch (innerErr) {
      if (innerErr.message && (innerErr.message.includes('decrypt') || innerErr.message.includes('Password') || innerErr.message.includes('Incorrect') || innerErr.message.includes('cancelled') || innerErr.message.includes('required'))) {
        throw innerErr;
      }
      notes = {};
      sessions = {};
    }
  }

  const savedSid = localStorage.getItem('ops-active-session');
  if (savedSid && sessions[savedSid]) {
    activeSessionId = savedSid;
    shouldPromptForSessionOnStartup = false;
  } else {
    activeSessionId = null;
    shouldPromptForSessionOnStartup = true;
  }

  renderSessionSidebar();
  renderNotesList();
  if (typeof updateNotesCountBadges === 'function') updateNotesCountBadges();

  const sess = activeSessionId && sessions[activeSessionId];
  const targets = (sess && sess.targets) || [];
  const savedTgt = localStorage.getItem('ops-active-target');
  if (savedTgt && targets.find(t => t.id === savedTgt)) {
    activeTargetId = savedTgt;
  } else if (targets.length) {
    activeTargetId = targets[0].id;
    localStorage.setItem('ops-active-target', activeTargetId);
  } else {
    activeTargetId = null;
  }
  if (sess && (!sess.targets || !sess.targets.length) && (sess.target_ip || sess.target_domain)) {
    const id = 'tgt_migrate_' + sess.id;
    sess.targets = [{ id, ip: sess.target_ip || '', domain: sess.target_domain || '', label: 'default' }];
    activeTargetId = id;
    localStorage.setItem('ops-active-target', id);
    saveNotes();
  }
  updateTargetSelector();
  renderSvcLogTable();
  renderPathTable();
  renderLootTable();
  updateSvcTabCounts();
  if (typeof updateEvidenceCount === 'function') updateEvidenceCount();
}

async function executeAppSave() {
  const payload = { notes, sessions };
  const attachmentManifest = typeof buildAttachmentManifestFromClientNotes === 'function'
    ? buildAttachmentManifestFromClientNotes(notes)
    : {};
  if (encryptedStorageEnabled) {
    try {
      if (!encryptedStoragePassword) throw new Error('Workbench is locked');
      const blob = await encryptPayload(JSON.stringify(payload), encryptedStoragePassword);
      if (encryptedStorageHint) blob.hint = encryptedStorageHint;
      setEncryptedCache(blob);
      localStorage.removeItem('ops-notes-v2');
      const res = await fetch('/api/notes/save-encrypted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blob, attachment_manifest: attachmentManifest }),
      });
      if (!res.ok) throw new Error('Encrypted save failed');
      return true;
    } catch (err) {
      appSaveState.lastError = err;
      return false;
    }
  }
  try {
    localStorage.setItem('ops-notes-v2', JSON.stringify(payload));
    clearEncryptedCache();
    const res = await fetch('/api/notes/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, attachment_manifest: attachmentManifest }),
    });
    if (!res.ok) throw new Error('Save failed');
    return true;
  } catch (err) {
    appSaveState.lastError = err;
    return false;
  }
}

function saveNotes(opts = {}) {
  return queueAppSave(opts);
}

function renderSessionSidebar() {
  const dot    = document.getElementById('sessionDot');
  const name   = document.getElementById('sessionName');
  const target = document.getElementById('sessionTarget');
  const card   = document.getElementById('sessionActive');
  const sess   = activeSessionId && sessions[activeSessionId];
  if (sess) {
    const activeTarget = typeof getActiveTarget === 'function' ? getActiveTarget() : null;
    const status = sess.status || 'active';
    dot.className = 'session-active-dot ' + (status === 'active' ? 'live' : status);
    name.textContent = sess.codename;
    name.title = sess.codename || '';
    if (card) card.title = sess.codename || 'Sessions';
    const targetLabel = activeTarget ? (activeTarget.label || activeTarget.ip || activeTarget.domain || 'target') : (sess.domain || '— click to set');
    target.textContent = targetLabel;
    target.style.display = '';
    const badge = document.getElementById('sessionNotesBadge');
    if (badge) {
      const n = Object.values(notes).filter(nt => nt.session_id === activeSessionId).length;
      badge.textContent = String(n);
      badge.title = n + ' note' + (n !== 1 ? 's' : '');
      badge.style.display = n > 0 ? '' : 'none';
    }
  } else {
    dot.className = 'session-active-dot';
    name.textContent = 'No session';
    name.title = 'No session';
    if (card) card.title = 'Sessions';
    target.textContent = '— click to set';
    target.style.display = '';
    const badge = document.getElementById('sessionNotesBadge');
    if (badge) {
      badge.style.display = 'none';
      badge.title = '';
    }
  }
}

function openSessionModal() {
  document.getElementById('newSessionName').value = '';
  document.getElementById('newSessionDomain').value = '';
  document.getElementById('newSessionTargetIP').value = '';
  document.getElementById('newSessionTargetDomain').value = '';
  document.getElementById('newSessionTargetLabel').value = '';
  updateSessionDomainField();
  updateSessionAttackerIpField();
  syncSummaryExportPrefsUI();
  renderSessionList();
  document.getElementById('sessionOverlay').classList.add('open');
  setTimeout(() => document.getElementById('newSessionName').focus(), 60);
}

function closeSessionModal() { document.getElementById('sessionOverlay').classList.remove('open'); }

function getSessionFormRefs(source = 'session') {
  return source === 'welcome'
    ? {
        name: document.getElementById('welcomeSessionName'),
        domain: document.getElementById('welcomeSessionDomain'),
        targetIp: document.getElementById('welcomeSessionTargetIP'),
        targetDomain: document.getElementById('welcomeSessionTargetDomain'),
        targetLabel: document.getElementById('welcomeSessionTargetLabel'),
      }
    : {
        name: document.getElementById('newSessionName'),
        domain: document.getElementById('newSessionDomain'),
        targetIp: document.getElementById('newSessionTargetIP'),
        targetDomain: document.getElementById('newSessionTargetDomain'),
        targetLabel: document.getElementById('newSessionTargetLabel'),
      };
}

function clearSessionForm(source = 'session') {
  const refs = getSessionFormRefs(source);
  if (!refs.name) return;
  refs.name.value = '';
  if (refs.domain) refs.domain.value = '';
  refs.targetIp.value = '';
  refs.targetDomain.value = '';
  refs.targetLabel.value = '';
}

function renderWelcomeSessionList() {
  const list = document.getElementById('welcomeSessionList');
  if (!list) return;
  const entries = Object.values(sessions).sort((a, b) => (b.created || 0) - (a.created || 0));
  if (!entries.length) {
    list.innerHTML = `
      <div class="welcome-session-empty">
        <div class="welcome-session-empty-title">No sessions yet</div>
        <div class="welcome-session-empty-copy">Create your first session or import an existing <code>.session</code> file to begin.</div>
      </div>`;
    return;
  }
  const noteCount = (id) => Object.values(notes).filter((n) => n.session_id === id).length;
  const statusLabel = { active: 'Active', paused: 'Paused', complete: 'Complete' };
  list.innerHTML = entries.map((session) => {
    const targets = Array.isArray(session.targets) ? session.targets : [];
    const targetLabel = targets[0]
      ? (targets[0].label || targets[0].ip || targets[0].domain || 'target')
      : 'No targets yet';
    return `
      <button class="welcome-session-card${session.id === activeSessionId ? ' active' : ''}" type="button" onclick="selectWelcomeSession('${session.id}')">
        <div class="welcome-session-card-top">
          <div class="welcome-session-card-title">${esc(session.codename || 'Untitled Session')}</div>
          <div class="session-status-pill ${session.status || 'active'}">
            <span class="status-dot ${session.status || 'active'}"></span>${statusLabel[session.status || 'active'] || 'Active'}
          </div>
        </div>
        <div class="welcome-session-card-meta">${noteCount(session.id)} notes · ${targets.length} target${targets.length !== 1 ? 's' : ''} · ${new Date(session.created || Date.now()).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'2-digit'})}</div>
        <div class="welcome-session-card-target">Session domain: ${esc(session.domain || '—')}</div>
        <div class="welcome-session-card-target">Primary target: ${esc(targetLabel)}</div>
      </button>`;
  }).join('');
}

function openWelcomeSessionModal() {
  renderWelcomeSessionList();
  clearSessionForm('welcome');
  const feedback = document.getElementById('welcomeImportFeedback');
  if (feedback) feedback.style.display = 'none';
  const overlay = document.getElementById('welcomeSessionOverlay');
  const esc = document.getElementById('welcomeSessionEsc');
  if (esc) esc.style.display = activeSessionId ? '' : 'none';
  overlay?.classList.add('open');
  setTimeout(() => document.getElementById('welcomeSessionName')?.focus(), 60);
}

function closeWelcomeSessionModal(force = false) {
  if (!force && !activeSessionId) return;
  document.getElementById('welcomeSessionOverlay')?.classList.remove('open');
}

function shouldOpenWelcomeSessionModalOnStartup() {
  if (!shouldPromptForSessionOnStartup) return false;
  openWelcomeSessionModal();
  return true;
}

function selectWelcomeSession(id) {
  if (!sessions[id]) return;
  switchSession(id);
  closeWelcomeSessionModal(true);
}

function renderSessionList() {
  const list = document.getElementById('sessionList');
  const entries = Object.values(sessions).sort((a, b) => (b.created || 0) - (a.created || 0));
  if (!entries.length) {
    list.innerHTML = '<div class="session-list-hdr" style="padding-top:4px">No sessions yet</div>';
    return;
  }
  const noteCount   = id => Object.values(notes).filter(n => n.session_id === id).length;
  const targetCount = id => (sessions[id]?.targets || []).length;
  const statusLabel = { active: 'Active', paused: 'Paused', complete: 'Complete' };
  list.innerHTML = '<div class="session-list-hdr">Existing sessions</div>' +
    entries.map(s => {
      const status = s.status || 'active';
      const tCount = targetCount(s.id);
      const tLabel = tCount === 0 ? '<span style="color:var(--accent)">no targets</span>' : `${tCount} target${tCount !== 1 ? 's' : ''}`;
      const sessionDomain = s.domain ? ` · domain ${esc(s.domain)}` : '';
      const attacker = s.attacker_ip ? ` · attacker ${esc(s.attacker_ip)}` : '';
      return `
    <div class="session-list-item${s.id === activeSessionId ? ' active-session' : ''}${status === 'complete' ? ' status-complete' : ''}" onclick="switchSession('${s.id}')">
      <div class="session-list-item-top">
        <div class="session-status-pill ${status}" onclick="toggleStatusDropdown(event,'${s.id}')">
          <span class="status-dot ${status}"></span>${statusLabel[status]}
        </div>
        <div class="session-list-item-name">${esc(s.codename)}</div>
      </div>
      <div class="session-list-item-meta">${noteCount(s.id)} notes · ${tLabel}${sessionDomain}${attacker} · ${new Date(s.created).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'2-digit'})}</div>
      <div class="session-list-item-bottom" onclick="event.stopPropagation()">
        <div class="session-item-actions">
          <button class="session-item-export-btn" onclick="renameSession('${s.id}')" title="Rename session">${ICONS.edit}</button>
          <button class="session-item-export-btn session-delete-btn" onclick="deleteSession('${s.id}')" title="Delete session" aria-label="Delete session"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a2 2 0 0 1 1 1v2"/></svg></button>
          <button class="session-item-export-btn" onclick="exportSessionFile('${s.id}')" title="Export session data for import into another PRAGMA workbench">${ICONS.download} Session</button>
          <button class="session-item-export-btn" onclick="exportNotesMarkdown('${s.id}')" title="Generate a markdown summary from session notes and logs">${ICONS.download} Generate Summary</button>
        </div>
      </div>
    </div>`;
    }).join('');
}

function createSession(source = 'session') {
  const refs = getSessionFormRefs(source);
  const name = refs.name?.value.trim() || '';
  const sessionDomain = refs.domain?.value.trim() || '';
  const targetIp = refs.targetIp?.value.trim() || '';
  const targetDomain = refs.targetDomain?.value.trim() || '';
  const targetLabel = refs.targetLabel?.value.trim() || '';
  if (!name) { refs.name?.focus(); return; }
  const id = 'sess_' + Date.now();
  const targets = [];
  if (targetIp || targetDomain || targetLabel) {
    targets.push({
      id: 'tgt_' + Date.now(),
      ip: targetIp,
      domain: targetDomain,
      label: targetLabel,
    });
  }
  const sess = { id, codename: name, created: Date.now(), domain: sessionDomain, targets, attacker_ip: '', todos: [], evidence: [] };
  sessions[id] = sess;
  tlLog(id, { type: 'session_created', name: sess.codename });
  if (targets.length) {
    activeTargetId = targets[0].id;
    localStorage.setItem('ops-active-target', activeTargetId);
    if (typeof rememberActiveTargetForSession === 'function') rememberActiveTargetForSession(id, activeTargetId);
  }
  switchSession(id);
  saveNotes();
  renderSessionList();
  renderWelcomeSessionList();
  updateSessionDomainField();
  updateSessionAttackerIpField();
  clearSessionForm(source);
  if (source === 'welcome') closeWelcomeSessionModal(true);
}

function updateSessionDomainField() {
  const wrap = document.getElementById('sessionDomainFieldWrap');
  const input = document.getElementById('sessionDomainInput');
  const sess = activeSessionId && sessions[activeSessionId];
  if (!wrap || !input) return;
  if (!sess) {
    wrap.style.display = 'none';
    input.value = '';
    return;
  }
  wrap.style.display = '';
  input.value = sess.domain || '';
}

function updateSessionAttackerIpField() {
  const wrap = document.getElementById('attackerIpFieldWrap');
  const input = document.getElementById('sessionAttackerIpInput');
  const sess = activeSessionId && sessions[activeSessionId];
  if (!wrap || !input) return;
  if (!sess) {
    wrap.style.display = 'none';
    input.value = '';
    return;
  }
  wrap.style.display = '';
  input.value = sess.attacker_ip || '';
}

function syncSummaryExportPrefsUI() {
  const authorInput = document.getElementById('summaryAuthorInput');
  const pdfInput = document.getElementById('summaryPdfDefault');
  const pdfWrap = document.getElementById('summaryExportCheck');
  const pdfBadge = document.getElementById('summaryExportBadge');
  const pdfHint = document.getElementById('summaryExportHint');
  const pdfExportEnabled = window.PRAGMA_CONFIG?.pdfExportEnabled !== false;
  if (authorInput) {
    authorInput.value = localStorage.getItem('pragma-summary-author') || '';
    authorInput.oninput = () => {
      localStorage.setItem('pragma-summary-author', authorInput.value);
    };
  }
  if (pdfBadge) {
    pdfBadge.textContent = pdfExportEnabled ? 'Enabled' : 'Disabled';
    pdfBadge.classList.toggle('enabled', pdfExportEnabled);
    pdfBadge.classList.toggle('disabled', !pdfExportEnabled);
  }
  if (pdfWrap) {
    pdfWrap.classList.toggle('is-disabled', !pdfExportEnabled);
  }
  if (pdfHint && !pdfExportEnabled) {
    pdfHint.textContent = 'Used for summary exports. PDF export is disabled for this deployment.';
  }
  if (pdfInput) {
    if (!pdfExportEnabled) {
      pdfInput.checked = false;
      pdfInput.disabled = true;
      localStorage.setItem('pragma-summary-pdf', '0');
    } else {
      pdfInput.disabled = false;
      pdfInput.checked = localStorage.getItem('pragma-summary-pdf') === '1';
      pdfInput.onchange = () => {
        localStorage.setItem('pragma-summary-pdf', pdfInput.checked ? '1' : '0');
      };
    }
  }
}

function saveActiveSessionDomain() {
  const sess = activeSessionId && sessions[activeSessionId];
  const input = document.getElementById('sessionDomainInput');
  if (!sess || !input) return;
  const next = input.value.trim();
  if ((sess.domain || '') === next) return;
  sess.domain = next;
  saveNotes();
  renderSessionList();
  renderWelcomeSessionList();
  renderSessionSidebar();
  updateTargetSelector();
  refreshCodeBlocks();
  showToast(next ? `✓ Session domain set: ${next}` : '✓ Session domain cleared');
}

function saveActiveSessionAttackerIp() {
  const sess = activeSessionId && sessions[activeSessionId];
  const input = document.getElementById('sessionAttackerIpInput');
  if (!sess || !input) return;
  const next = input.value.trim();
  if ((sess.attacker_ip || '') === next) return;
  sess.attacker_ip = next;
  saveNotes();
  renderSessionList();
  renderSessionSidebar();
  refreshCodeBlocks();
  showToast(next ? `✓ Attacker IP set: ${next}` : '✓ Attacker IP cleared');
}

let _statusDropdownTarget = null;

function toggleStatusDropdown(e, sessId) {
  e.stopPropagation();
  const dd = document.getElementById('statusDropdown');
  const isOpen = dd.classList.contains('open') && _statusDropdownTarget === sessId;
  dd.classList.remove('open');
  _statusDropdownTarget = null;
  if (isOpen) return;
  const pill = e.currentTarget;
  const rect = pill.getBoundingClientRect();
  dd.style.top  = (rect.bottom + 4) + 'px';
  dd.style.left = rect.left + 'px';
  _statusDropdownTarget = sessId;
  dd.classList.add('open');
  setTimeout(() => {
    const handler = ev => {
      if (!ev.target.closest('#statusDropdown') && !ev.target.closest('.session-status-pill')) {
        dd.classList.remove('open');
        _statusDropdownTarget = null;
        document.removeEventListener('click', handler);
      }
    };
    document.addEventListener('click', handler);
  }, 0);
}

function applyStatusFromDropdown(status) {
  if (!_statusDropdownTarget) return;
  setSessionStatus(null, _statusDropdownTarget, status);
  document.getElementById('statusDropdown').classList.remove('open');
  _statusDropdownTarget = null;
}

function tlLog(sessId, event) {
  if (!sessId || !sessions[sessId]) return;
  if (!sessions[sessId].events) sessions[sessId].events = [];
  sessions[sessId].events.push({ ts: Date.now(), ...event });
}

function setSessionStatus(e, sessId, status) {
  if (e) e.stopPropagation();
  if (!sessions[sessId]) return;
  const prev = sessions[sessId].status || 'active';
  sessions[sessId].status = status;
  tlLog(sessId, { type: 'status', from: prev, to: status });
  saveNotes();
  renderSessionList();
  if (sessId === activeSessionId) renderSessionSidebar();
  if (typeof renderTimeline === 'function' && typeof notesListViewMode !== 'undefined' && notesListViewMode === 'timeline') renderTimeline();
}

function switchSession(id) {
  if (!sessions[id]) return;
  shouldPromptForSessionOnStartup = false;
  activeSessionId = id;
  localStorage.setItem('ops-active-session', id);
  activeNoteScope = 'session';
  activeTargetFilter = null;
  activeNoteSearch = '';
  const searchEl = document.getElementById('noteSearchInput');
  if (searchEl) searchEl.value = '';
  document.querySelectorAll('.note-scope-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.scope === 'session'));
  const sess = sessions[id];
  const targets = (sess && sess.targets) || [];
  const rememberedTarget = typeof getRememberedTargetForSession === 'function' ? getRememberedTargetForSession(id) : '';
  const savedTarget = localStorage.getItem('ops-active-target');
  if (rememberedTarget && targets.find((t) => t.id === rememberedTarget)) {
    activeTargetId = rememberedTarget;
    localStorage.setItem('ops-active-target', activeTargetId);
  } else if (savedTarget && targets.find((t) => t.id === savedTarget)) {
    activeTargetId = savedTarget;
    if (typeof rememberActiveTargetForSession === 'function') rememberActiveTargetForSession(id, activeTargetId);
  } else if (targets.length) {
    activeTargetId = targets[0].id;
    localStorage.setItem('ops-active-target', activeTargetId);
    if (typeof rememberActiveTargetForSession === 'function') rememberActiveTargetForSession(id, activeTargetId);
  } else {
    activeTargetId = null;
    if (typeof clearRememberedTargetForSession === 'function') clearRememberedTargetForSession(id);
  }
  renderSessionSidebar();
  updateSessionDomainField();
  updateSessionAttackerIpField();
  renderSessionList();
  renderNotesList();
  updateTargetSelector();
  refreshCodeBlocks();
  updateSvcTabCounts();
  renderTodoList();
  if (typeof renderEvidenceList === 'function') renderEvidenceList();
  if (typeof updateEvidenceCount === 'function') updateEvidenceCount();
  closeWelcomeSessionModal(true);
}

async function deleteSession(id) {
  const sess  = sessions[id];
  const count = Object.values(notes).filter(n => n.session_id === id).length;
  const msg   = count
    ? `Delete session "${sess?.codename}"?\n\n${count} note${count>1?'s':''} will become unassigned.`
    : `Delete session "${sess?.codename}"?`;
  try { await showConfirmDialog({ icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`, title: 'Delete Session', bigIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`, description: msg, confirmLabel: 'Delete', danger: true }); }
  catch { return; }

  Object.values(notes).forEach(n => {
    if (n.session_id === id) n.session_id = null;
  });

  delete sessions[id];
  if (typeof clearRememberedTargetForSession === 'function') clearRememberedTargetForSession(id);
  if (activeSessionId === id) {
    activeSessionId = Object.keys(sessions)[0] || null;
    if (activeSessionId) localStorage.setItem('ops-active-session', activeSessionId);
    else localStorage.removeItem('ops-active-session');
  }
  saveNotes();
  renderSessionSidebar();
  updateSessionDomainField();
  updateSessionAttackerIpField();
  renderSessionList();
  renderNotesList();
  renderTodoList();
  if (typeof renderEvidenceList === 'function') renderEvidenceList();
  if (typeof updateEvidenceCount === 'function') updateEvidenceCount();
}

let _sessionRenameId = null;
let _sessionRenameResolve = null;
let _sessionRenameReject  = null;

function showSessionRenameModal(sess) {
  return new Promise((resolve, reject) => {
    _sessionRenameResolve = resolve;
    _sessionRenameReject  = reject;
    const input = document.getElementById('sessionRenameInput');
    input.value = sess.codename || '';
    const sri = document.getElementById('sessionRenameIcon'); if (sri) sri.innerHTML = ICONS.edit;
    document.getElementById('sessionRenameOverlay').classList.add('open');
    setTimeout(() => { input.focus(); input.select(); }, 40);
  });
}

function _sessionRenameSave() {
  const val = document.getElementById('sessionRenameInput').value.trim();
  if (!val) {
    const input = document.getElementById('sessionRenameInput');
    input.classList.add('error');
    input.focus();
    setTimeout(() => input.classList.remove('error'), 1200);
    return;
  }
  document.getElementById('sessionRenameOverlay').classList.remove('open');
  if (_sessionRenameResolve) _sessionRenameResolve(val);
  _sessionRenameResolve = _sessionRenameReject = null;
}

function _sessionRenameCancel() {
  document.getElementById('sessionRenameOverlay').classList.remove('open');
  if (_sessionRenameReject) _sessionRenameReject('cancelled');
  _sessionRenameResolve = _sessionRenameReject = null;
}

function _sessionRenameKey(e) {
  if (e.key === 'Enter') _sessionRenameSave();
  if (e.key === 'Escape') _sessionRenameCancel();
}

async function renameSession(id) {
  const sess = sessions[id];
  if (!sess) return;
  let newName;
  try { newName = await showSessionRenameModal(sess); } catch { return; }
  if (newName === sess.codename) return;
  sess.codename = newName;
  saveNotes();
  renderSessionList();
  renderSessionSidebar();
}

async function importSession(event) {
  const file = event.target.files[0];
  if (!file) return;
  const source = event.target.dataset.source || 'session';
  const fb = document.getElementById(event.target.dataset.feedbackId || 'importFeedback');
  fb.style.display = 'block';
  fb.className = 'import-feedback';
  fb.textContent = '⏳ Importing…';

  const reader = new FileReader();
  reader.onload = async e => {
    try {
      let parsed;
      try {
        parsed = JSON.parse(e.target.result);
      } catch (_) {
        throw new Error('Could not load .session file. File is malformed.');
      }
      if (parsed.encrypted === true) {
        let password;
        try {
          password = await showPasswordPrompt({
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`, title: 'Encrypted Workbench',
            description: 'This .session file is encrypted. Enter the password used when it was exported.',
            label: 'Password', placeholder: 'Enter password…',
            submitLabel: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg> Decrypt & Import',
          });
        } catch { fb.style.display = 'none'; event.target.value = ''; return; }
        try {
          const plain = await decryptPayload(parsed, password);
          parsed = JSON.parse(plain);
        } catch (decErr) {
          fb.className = 'import-feedback err';
          fb.textContent = '✗ ' + decErr.message;
          event.target.value = '';
          return;
        }
      }

      const data = parsed;
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Could not load .session file. File is malformed.');
      if (!data.session || !Array.isArray(data.notes)) throw new Error('Could not load .session file. File is malformed.');

      const sanitizeImportedSession = (session) => {
        if (!session || typeof session !== 'object' || Array.isArray(session)) throw new Error('Could not load .session file. File is malformed.');
        const cleanTargets = Array.isArray(session.targets) ? session.targets
          .filter(target => target && typeof target === 'object' && !Array.isArray(target))
          .map((target, index) => ({
            id: typeof target.id === 'string' && target.id ? target.id : `target_${Date.now()}_${index}`,
            ip: String(target.ip || ''),
            domain: String(target.domain || ''),
            label: String(target.label || ''),
          })) : [];
        const cloneList = (list, fields) => {
          if (!Array.isArray(list)) return [];
          return list
            .filter(entry => entry && typeof entry === 'object' && !Array.isArray(entry))
            .map(entry => {
              const out = {};
              fields.forEach(([key, fallback = '']) => {
                if (key === 'added' || key === 'created' || key === 'updated' || key === 'completed') {
                  out[key] = Number(entry[key]) || null;
                } else {
                  out[key] = String(entry[key] ?? fallback);
                }
              });
              return out;
            });
        };

        return {
          codename: String(session.codename || 'Imported Session'),
          created: Number(session.created) || Date.now(),
          domain: String(session.domain || ''),
          attacker_ip: String(session.attacker_ip || ''),
          status: ['active', 'paused', 'complete'].includes(session.status) ? session.status : 'active',
          imported_from: String(session.codename || ''),
          targets: cleanTargets,
          services: cloneList(session.services, [['id'], ['target_id'], ['port'], ['proto', 'tcp'], ['service'], ['version'], ['notes'], ['added']]),
          paths: cloneList(session.paths, [['id'], ['target_id'], ['path'], ['status'], ['size'], ['notes'], ['added']]),
          loot: cloneList(session.loot, [['id'], ['type'], ['credential'], ['host'], ['note'], ['added']]),
          evidence: cloneList(session.evidence, [['id'], ['target_id'], ['note_id'], ['type'], ['title'], ['details'], ['impact'], ['source_command'], ['sync_mode', 'export_only'], ['created'], ['updated']]),
          todos: Array.isArray(session.todos) ? session.todos
            .filter(todo => todo && typeof todo === 'object' && !Array.isArray(todo))
            .map((todo, index) => ({
              id: typeof todo.id === 'string' && todo.id ? todo.id : `todo_${Date.now()}_${index}`,
              text: String(todo.text || ''),
              done: Boolean(todo.done),
              created: Number(todo.created) || Date.now(),
              completed: todo.done ? (Number(todo.completed) || Date.now()) : null,
            }))
            .filter(todo => todo.text.trim()) : [],
          events: Array.isArray(session.events) ? session.events
            .filter(entry => entry && typeof entry === 'object' && !Array.isArray(entry))
            .map(entry => ({ ...entry, ts: Number(entry.ts) || Date.now() })) : [],
        };
      };

      const sanitizeImportedNote = (note, index, sessionId) => {
        if (!note || typeof note !== 'object' || Array.isArray(note)) return null;
        return {
          id: `note_${Date.now()}_${index}`,
          session_id: sessionId,
          target_id: typeof note.target_id === 'string' ? note.target_id : null,
          type: String(note.type || 'general'),
          title: String(note.title || 'Imported Note'),
          body: String(note.body || ''),
          tags: Array.isArray(note.tags) ? note.tags.map(tag => String(tag)).filter(Boolean) : [],
          created: Number(note.created) || Date.now(),
          updated: Number(note.updated) || Date.now(),
          target_ip: note.target_ip ? String(note.target_ip) : null,
          target_domain: note.target_domain ? String(note.target_domain) : null,
        };
      };

      const newSessId = 'sess_' + Date.now();
      const importedSess = { ...sanitizeImportedSession(data.session), id: newSessId };

      sessions[newSessId] = importedSess;

      let noteCount = 0;
      data.notes.forEach((n, index) => {
        const nextNote = sanitizeImportedNote(n, index, newSessId);
        if (!nextNote) return;
        notes[nextNote.id] = nextNote;
        noteCount++;
      });

      saveNotes();
      switchSession(newSessId);
      renderSessionList();
      renderWelcomeSessionList();

      fb.className = 'import-feedback ok';
      fb.textContent = '✓ Imported "' + importedSess.codename + '" — ' + noteCount + ' note' + (noteCount !== 1 ? 's' : '');
      if (source === 'welcome') closeWelcomeSessionModal(true);
      setTimeout(() => { fb.style.display = 'none'; }, 4000);
    } catch (err) {
      fb.className = 'import-feedback err';
      fb.textContent = '✗ ' + err.message;
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}
