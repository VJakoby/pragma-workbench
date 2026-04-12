let matrixState = {
  toolboxModule: 'passive',
  mode: 'domains',
  currentJobId: null,
  pollTimer: null,
  capabilities: null,
  online: false,
  nmapProfiles: [],
  selectedNmapProfileId: '',
  masscanProfiles: [],
  selectedMasscanProfileId: '',
  httpxProfiles: [],
  selectedHttpxProfileId: '',
  enumerationTool: 'nmap',
  currentJobStatus: null,
};

const MATRIX_POLL_INTERVALS = {
  queued: 2000,
  running: 2500,
  idle: 5000,
};

function matrixEnumerationJobTypeForTool(tool) {
  if (tool === 'masscan') return 'masscan-enumeration';
  if (tool === 'httpx') return 'httpx-enumeration';
  return 'nmap-enumeration';
}

function applyMatrixAvailabilityUi() {
  const view = document.getElementById('view-matrix');
  const matrixView = view?.querySelector('.matrix-view');
  const offlineState = document.getElementById('matrixOfflineState');
  const isOnline = !!matrixState.online;
  view?.classList.toggle('matrix-offline', !isOnline);
  matrixView?.classList.toggle('matrix-offline', !isOnline);
  if (offlineState) offlineState.hidden = isOnline;
  const passiveBtn = document.getElementById('matrixModulePassive');
  const enumBtn = document.getElementById('matrixModuleEnumeration');
  if (passiveBtn) passiveBtn.disabled = !isOnline;
  if (enumBtn) enumBtn.disabled = !isOnline;
  if (!isOnline && matrixState.toolboxModule === 'enumeration') {
    matrixState.toolboxModule = 'passive';
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function matrixSetStatus(label, state) {
  const pill = document.getElementById('matrixServicePill');
  const badge = document.getElementById('matrix-status-badge');
  const dot = document.getElementById('matrix-status-dot');
  const versionLabel = document.getElementById('matrixVersionLabel');
  const version = matrixState.capabilities?.version ? `v${matrixState.capabilities.version}` : '';
  if (pill) {
    pill.textContent = label;
    pill.className = `matrix-service-pill ${state || ''}`.trim();
    pill.title = '';
    pill.setAttribute('aria-label', `Toolbox status ${label}`);
  }
  if (versionLabel) {
    versionLabel.textContent = version;
  }
  if (badge) {
    badge.textContent = '';
    badge.className = `nav-item-count matrix-nav-status ${state || ''}`.trim();
    badge.title = version || `Toolbox ${label}`;
    badge.setAttribute('aria-label', version ? `Toolbox ${label} ${version}` : `Toolbox ${label}`);
  }
  if (dot) {
    dot.className = `nav-item-service-dot ${state || ''}`.trim();
    dot.title = version || `Toolbox ${label}`;
    dot.setAttribute('aria-label', version ? `Toolbox ${label} ${version}` : `Toolbox ${label}`);
  }
}

function matrixStatusChip(label, tone = 'neutral') {
  return `<span class="matrix-chip ${tone}">${escapeHtml(label)}</span>`;
}

function matrixSectionTone(status) {
  if (status === 'ok') return 'ok';
  if (status === 'warning') return 'warning';
  if (status === 'error') return 'error';
  return 'neutral';
}

function matrixChipTone(status) {
  if (status === 'ok') return 'ok';
  if (status === 'warning') return 'warn';
  if (status === 'error') return 'bad';
  return 'neutral';
}

function matrixCombineAssessments(items) {
  const list = items.filter(Boolean);
  if (list.some(item => item.status === 'error')) return { status: 'error' };
  if (list.some(item => item.status === 'warning')) return { status: 'warning' };
  if (list.some(item => item.status === 'ok')) return { status: 'ok' };
  return { status: 'neutral' };
}

function matrixJoinList(values) {
  if (!Array.isArray(values) || !values.length) return '<span class="matrix-muted">None</span>';
  return values.map(value => `<span class="matrix-pill">${escapeHtml(value)}</span>`).join('');
}

function matrixFormatDate(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return date.toLocaleString();
}

function matrixFormatJobType(type) {
  const mapping = {
    'domain-recon': 'Passive Domain Recon',
    'ip-recon': 'Passive IP Recon',
    'subdomain-passive-recon': 'Passive Subdomain Recon',
    'nmap-enumeration': 'Nmap',
    'masscan-enumeration': 'Masscan',
    'httpx-enumeration': 'httpx',
  };
  return mapping[type] || type || 'matrix-job';
}

function matrixCurrentModuleLabel() {
  return matrixState.toolboxModule === 'enumeration'
    ? 'Active Enumeration'
    : 'Passive Recon';
}

function matrixDefaultOutputMessage() {
  return matrixState.toolboxModule === 'enumeration'
    ? matrixEnumerationDefaultOutputMessage()
    : 'Run a recon job.';
}

function matrixActiveTargetsNode() {
  if (matrixState.toolboxModule !== 'enumeration') {
    return document.getElementById('matrixTargets');
  }
  if (matrixActiveEnumerationTool() === 'masscan') return document.getElementById('matrixEnumTargetsMasscan');
  if (matrixActiveEnumerationTool() === 'httpx') return document.getElementById('matrixEnumTargetsHttpx');
  return document.getElementById('matrixEnumTargets');
}

function matrixSetEnumCapability(text) {
  const node = document.getElementById('matrixEnumCapability');
  if (node) node.textContent = text;
}

function matrixActiveEnumerationTool() {
  return matrixState.enumerationTool || 'nmap';
}

function matrixEnumerationDefaultOutputMessage() {
  const tool = matrixActiveEnumerationTool();
  if (tool === 'masscan') return 'Run a Masscan enumeration job.';
  if (tool === 'httpx') return 'Run an httpx enumeration job.';
  return 'Run an enumeration job.';
}

async function cancelMatrixJob() {
  if (!matrixState.currentJobId) return;
  const button = document.getElementById('matrixStopButton');
  if (button) button.disabled = true;
  const response = await fetch(`/api/matrix/jobs/${encodeURIComponent(matrixState.currentJobId)}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const data = await response.json();
  if (!response.ok) {
    matrixSetOutput(data);
    return;
  }
  matrixSetOutput(data.job || data);
  loadMatrixJobs();
}

async function insertMatrixQuickLogPorts(button) {
  const raw = button?.dataset?.preview || '';
  if (!raw) return;
  try {
    const preview = JSON.parse(raw);
    if (typeof window.insertQuickLogPortsFromMatrixPreview !== 'function') {
      matrixSetOutput({ error: 'Quick Log port insertion unavailable in this build.' });
      return;
    }
    const inserted = window.insertQuickLogPortsFromMatrixPreview(preview);
    if (inserted) {
      const original = button.textContent;
      button.textContent = 'Inserted';
      setTimeout(() => { button.textContent = original; }, 1200);
    }
  } catch (error) {
    matrixSetOutput({ error: 'Could not insert parsed ports', detail: error.message });
  }
}

function matrixActiveEnumerationNamingValue() {
  if (matrixActiveEnumerationTool() === 'masscan') {
    return document.getElementById('matrixEnumNamingMasscan')?.value.trim() || '';
  }
  if (matrixActiveEnumerationTool() === 'httpx') {
    return document.getElementById('matrixEnumNamingHttpx')?.value.trim() || '';
  }
  return document.getElementById('matrixEnumNaming')?.value.trim() || '';
}

function matrixJobStatusTone(status) {
  if (status === 'completed') return 'ok';
  if (status === 'failed') return 'bad';
  if (status === 'cancelled') return 'warn';
  if (status === 'running' || status === 'queued') return 'warn';
  return 'neutral';
}

function matrixDaysUntil(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

function matrixFormatMx(mxList) {
  if (!Array.isArray(mxList) || !mxList.length) return '<span class="matrix-muted">None</span>';
  return mxList.map(item => {
    if (item?.isNullMx) return '<span class="matrix-pill">Null MX</span>';
    const exchange = item?.exchange || 'unknown';
    const priority = Number.isFinite(item?.priority) ? ` (prio ${item.priority})` : '';
    return `<span class="matrix-pill">${escapeHtml(exchange + priority)}</span>`;
  }).join('');
}

function matrixExtractDkimRows(dkim) {
  if (!dkim || !Array.isArray(dkim.records) || !dkim.records.length) return '';
  return dkim.records.map(record => {
    const first = Array.isArray(record.records) ? record.records[0] : null;
    const flags = [];
    if (first?.keyRevoked) flags.push('revoked');
    if (first?.keyPresent && !first?.keyRevoked) flags.push('key present');
    const detail = flags.length ? ` (${flags.join(', ')})` : '';
    return `<div class="matrix-kv"><span>${escapeHtml(record.selector || 'selector')}</span><strong>${escapeHtml(record.host || '')}${escapeHtml(detail)}</strong></div>`;
  }).join('');
}

function matrixExtractEntityName(entity) {
  const card = Array.isArray(entity?.vcardArray?.[1]) ? entity.vcardArray[1] : [];
  const fn = card.find(item => item?.[0] === 'fn');
  return fn?.[3] || entity?.handle || null;
}

function matrixExtractEntityEmail(entity) {
  const card = Array.isArray(entity?.vcardArray?.[1]) ? entity.vcardArray[1] : [];
  const email = card.find(item => item?.[0] === 'email');
  return email?.[3] || null;
}

function matrixExtractEvents(events) {
  const out = {};
  if (!Array.isArray(events)) return out;
  for (const event of events) {
    if (!event?.eventAction || !event?.eventDate) continue;
    out[event.eventAction] = event.eventDate;
  }
  return out;
}

function matrixRenderKv(label, value) {
  return `<div class="matrix-kv"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || 'N/A')}</strong></div>`;
}

function matrixEscapeAttribute(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function matrixMarkdownCell(value) {
  return String(value ?? 'N/A')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>');
}

function matrixMarkdownList(values, empty = 'None') {
  if (!Array.isArray(values) || !values.length) return empty;
  return values.join(', ');
}

function matrixFormatSubdomainSources(sources, fallback = 'None') {
  if (!Array.isArray(sources) || !sources.length) return fallback;
  return sources.join(', ');
}

function matrixMarkdownMx(mxList) {
  if (!Array.isArray(mxList) || !mxList.length) return 'None';
  if (mxList.some(item => item?.isNullMx)) return 'Null MX';
  return mxList.map(item => `${item.exchange || 'unknown'}${Number.isFinite(item.priority) ? ` (${item.priority})` : ''}`).join(', ');
}

function matrixMarkdownAssessmentNotes(notes) {
  const filtered = notes.filter(Boolean);
  if (!filtered.length) return '';
  return `\n\n**Notes:** ${filtered.join(' • ')}`;
}

function matrixBuildMarkdownTable(rows) {
  const body = rows.map(([label, value]) => `| ${matrixMarkdownCell(label)} | ${matrixMarkdownCell(value)} |`).join('\n');
  return ['| Field | Value |', '| --- | --- |', body].join('\n');
}

function matrixBuildDomainMarkdown(result) {
  const assessment = result?.assessment || {};
  const dns = result?.dns || {};
  const email = result?.emailSecurity || {};
  const dkim = email?.dkim || {};
  const tls = result?.transportSecurity?.tls || {};
  const cert = tls?.certificate || {};
  const dkimFlags = [];
  if (dkim.status) dkimFlags.push(dkim.status);
  if (dkim.wildcardSuspected) dkimFlags.push('wildcard suspected');
  if (Array.isArray(dkim.records) && dkim.records.some(record => Array.isArray(record.records) && record.records.some(item => item?.keyRevoked))) {
    dkimFlags.push('revoked key observed');
  }

  const notes = [];
  if (assessment.dmarc?.status === 'warning' && Array.isArray(email.dmarc) && email.dmarc.some(entry => /\bp=none\b/i.test(entry))) {
    notes.push('DMARC is present but set to p=none');
  } else if (assessment.dmarc?.reason) {
    notes.push(assessment.dmarc.reason);
  }
  if (assessment.tls?.status === 'error' || assessment.tls?.status === 'warning') notes.push(assessment.tls?.reason || assessment.tls?.summary);
  if (Array.isArray(dns.mx) && dns.mx.some(item => item?.isNullMx)) notes.push('Null MX configured');
  if (dkim.wildcardSuspected) notes.push('DKIM wildcard suspected');
  if (assessment.spf?.status === 'warning' || assessment.spf?.status === 'error') notes.push(assessment.spf?.reason || assessment.spf?.summary);

  const rows = [
    ['Target', result.normalized || result.target || 'N/A'],
    ['IPv4', matrixMarkdownList(dns.a)],
    ['IPv6', matrixMarkdownList(dns.aaaa)],
    ['Nameservers', matrixMarkdownList(dns.ns)],
    ['MX', matrixMarkdownMx(dns.mx)],
    ['SPF', Array.isArray(email.spf) && email.spf.length ? email.spf.join(' | ') : 'None'],
    ['DMARC', Array.isArray(email.dmarc) && email.dmarc.length ? email.dmarc.join(' | ') : 'None'],
    ['DKIM', dkimFlags.length ? dkimFlags.join(', ') : 'Not found'],
    ['TLS Status', tls.status || assessment.tls?.summary || 'Unknown'],
    ['Valid From', cert.validFrom || 'N/A'],
    ['Valid To', cert.validTo || 'N/A'],
    ['Issuer', cert?.issuer?.CN || cert?.issuer?.O || 'N/A'],
  ];

  return `## ${result.normalized || result.target || 'Domain Recon'}\n\n${matrixBuildMarkdownTable(rows)}${matrixMarkdownAssessmentNotes(notes)}`;
}

function matrixBuildIpMarkdown(result) {
  const rdap = result?.rdap || {};
  const summary = rdap?.summary || {};
  const registrant = Array.isArray(summary.entities) ? summary.entities.find(entity => Array.isArray(entity.roles) && entity.roles.includes('registrant')) : null;
  const abuse = Array.isArray(rdap.document?.entities)
    ? rdap.document.entities.find(entity => Array.isArray(entity.roles) && entity.roles.includes('abuse'))
    : null;
  const sourceLabel = (() => {
    if (!rdap.source) return rdap.status || 'N/A';
    try {
      return new URL(rdap.source).hostname;
    } catch (_) {
      return rdap.source;
    }
  })();
  const rows = [
    ['Target IP', result.normalized || result.target || 'N/A'],
    ['Classification', result.public ? `Public IPv${result.version || ''}` : `${result.scope || 'Non-public'} IPv${result.version || ''}`],
    ['Owner / Org', matrixExtractEntityName(registrant) || summary.name || summary.handle || 'N/A'],
    ['Network Range / CIDR', summary.startAddress && summary.endAddress ? `${summary.startAddress} - ${summary.endAddress}` : 'N/A'],
    ['RIR / RDAP Source', sourceLabel],
    ['Abuse Contact', matrixExtractEntityEmail(abuse) || 'N/A'],
    ['WHOIS Fallback', result?.whois?.status || 'N/A'],
  ];
  return `## ${result.normalized || result.target || 'IP Recon'}\n\n${matrixBuildMarkdownTable(rows)}`;
}

function matrixBuildSubdomainMarkdown(result) {
  const discovery = result?.discovery || {};
  const hostnames = Array.isArray(discovery.hostnames) ? discovery.hostnames : [];
  const header = `## ${result.rootDomain || result.normalized || result.target || 'Passive Subdomain Recon'}`;
  const rows = [
    ['Root Domain', result.rootDomain || result.normalized || result.target || 'N/A'],
    ['Sources Used', matrixFormatSubdomainSources(discovery.sourcesUsed)],
    ['Returned', String(discovery.returnedCount || 0)],
    ['Total Discovered', String(discovery.totalDiscovered || 0)],
  ];
  const hostList = hostnames.length
    ? hostnames.map(item => `| ${matrixMarkdownCell(item.hostname || '')} | ${matrixMarkdownCell(matrixFormatSubdomainSources(item.sources))} |`).join('\n')
    : '| None | N/A |';
  return `${header}\n\n${matrixBuildMarkdownTable(rows)}\n\n| Hostname | Sources |\n| --- | --- |\n${hostList}`;
}

function matrixReconMarkdown(result) {
  if (result?.kind === 'domain') return matrixBuildDomainMarkdown(result);
  if (result?.kind === 'ip') return matrixBuildIpMarkdown(result);
  if (result?.kind === 'subdomain-discovery') return matrixBuildSubdomainMarkdown(result);
  return '';
}

function findSessionPassiveReconNote() {
  if (!activeSessionId) return null;
  return Object.values(notes).find(note => note.session_id === activeSessionId && note.type === 'passive-recon') || null;
}

function ensureSessionPassiveReconNote() {
  if (!NOTE_TEMPLATES?.['passive-recon'] || !activeSessionId) return null;
  let note = findSessionPassiveReconNote();
  if (note) return note;

  const id = 'note_' + Date.now();
  const tmpl = NOTE_TEMPLATES['passive-recon'];
  note = {
    id,
    session_id: activeSessionId,
    target_id: activeTargetId || null,
    type: 'passive-recon',
    title: tmpl.title || 'Passive Recon',
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

function appendMatrixMarkdownToPassiveReconNote(markdown, targetLabel = '') {
  if (!activeSessionId) {
    showToast('Open a session before saving Toolbox results to notes.', 'err');
    return false;
  }
  if (!markdown) return false;
  const note = ensureSessionPassiveReconNote();
  if (!note) {
    showToast('Passive Recon note template is unavailable.', 'err');
    return false;
  }
  const timestamp = new Date().toLocaleString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const heading = [`### Toolbox Import`, targetLabel ? `- ${targetLabel}` : '', `(${timestamp})`].join(' ').replace(/\s+/g, ' ').trim();
  const block = `${heading}\n\n${String(markdown).trim()}`;
  const body = String(note.body || '').trimEnd();
  note.body = body ? `${body}\n\n---\n\n${block}\n` : `${block}\n`;
  note.updated = Date.now();
  renderNotesList();
  renderSessionSidebar();
  saveNotes();
  showToast(`✓ Added Toolbox result to ${note.title || 'Passive Recon'}`);
  return note;
}

function appendMatrixResultToPassiveReconNote(button) {
  const markdown = button?.dataset?.markdown || '';
  const targetLabel = button?.dataset?.target || '';
  appendMatrixMarkdownToPassiveReconNote(markdown, targetLabel);
}

function matrixCopyMarkdownAction(result) {
  const markdown = matrixReconMarkdown(result);
  if (!markdown) return '';
  const noteAction = activeSessionId
    ? `<button class="tb-btn matrix-copy-btn matrix-markdown-btn" type="button" onclick="appendMatrixResultToPassiveReconNote(this)" data-markdown="${matrixEscapeAttribute(markdown)}" data-target="${matrixEscapeAttribute(result.normalized || result.rootDomain || result.target || '')}">Append to Passive Recon Note</button>`
    : `<div class="matrix-muted">Open a session to save this result into notes.</div>`;
  return `
    <div class="matrix-export-row">
      <div class="matrix-export-copy">Copy a compact markdown summary or append it into a dedicated session note.</div>
      <button class="tb-btn matrix-copy-btn matrix-markdown-btn" type="button" onclick="copyMatrixText(this)" data-copy="${matrixEscapeAttribute(markdown)}">Copy Note Markdown</button>
      ${noteAction}
    </div>
  `;
}

function matrixRenderSection(title, tone, content, assessment = null) {
  const statusClass = `matrix-section-status--${matrixSectionTone(assessment?.status)}`;
  const note = assessment?.reason
    ? `<div class="matrix-assessment-note">${escapeHtml(assessment.reason)}</div>`
    : '';
  return `
    <section class="matrix-section matrix-section--${tone} ${statusClass}">
      <div class="matrix-section-top">${escapeHtml(title)}</div>
      <div class="matrix-section-body">${note}${content}</div>
    </section>
  `;
}

function matrixRenderDomainResult(result) {
  const assessment = result?.assessment || {};
  const dns = result?.dns || {};
  const email = result?.emailSecurity || {};
  const dkim = email?.dkim || {};
  const tls = result?.transportSecurity?.tls || {};
  const cert = tls?.certificate || {};
  const expiryDays = matrixDaysUntil(cert.validTo);
  const dkimFlags = [];
  if (dkim.status) dkimFlags.push(dkim.status);
  if (dkim.wildcardSuspected) dkimFlags.push('wildcard suspected');
  const overall = matrixCombineAssessments([assessment.resolution, assessment.email, assessment.tls]);

  return `
    <section class="matrix-result-card matrix-result-card--domain matrix-result-status--${matrixSectionTone(overall.status)}">
      <div class="matrix-result-head matrix-result-top">
        <div>
          <div class="matrix-result-title">${escapeHtml(result.normalized || result.target || 'Domain')}</div>
          <div class="matrix-result-subtitle">${escapeHtml(result.target || '')}</div>
        </div>
        <div class="matrix-chip-row">
          ${matrixStatusChip(result.valid ? 'valid' : 'invalid', result.valid ? 'ok' : 'bad')}
          ${matrixStatusChip(result.resolved ? 'resolved' : 'unresolved', result.resolved ? 'ok' : 'warn')}
          ${matrixStatusChip('SPF', matrixChipTone(assessment.spf?.status))}
          ${matrixStatusChip('DMARC', matrixChipTone(assessment.dmarc?.status))}
          ${matrixStatusChip('DKIM', matrixChipTone(assessment.dkim?.status))}
          ${matrixStatusChip('TLS', matrixChipTone(assessment.tls?.status))}
        </div>
      </div>

      <div class="matrix-result-body">
      ${matrixCopyMarkdownAction(result)}
      <div class="matrix-section-grid">
        ${matrixRenderSection('Resolution', 'resolution', `
          ${matrixRenderKv('IPv4', Array.isArray(dns.a) && dns.a.length ? dns.a.join(', ') : 'None')}
          ${matrixRenderKv('IPv6', Array.isArray(dns.aaaa) && dns.aaaa.length ? dns.aaaa.join(', ') : 'None')}
          ${matrixRenderKv('CNAME', Array.isArray(dns.cname) && dns.cname.length ? dns.cname.join(', ') : 'None')}
          ${matrixRenderKv('Nameservers', Array.isArray(dns.ns) && dns.ns.length ? dns.ns.join(', ') : 'None')}
          ${matrixRenderKv('MX', Array.isArray(dns.mx) && dns.mx.some(item => item?.isNullMx) ? 'Null MX' : (Array.isArray(dns.mx) && dns.mx.length ? dns.mx.map(item => `${item.exchange || 'unknown'}${Number.isFinite(item.priority) ? ` (${item.priority})` : ''}`).join(', ') : 'None'))}
        `, assessment.resolution)}

        ${matrixRenderSection('Email Security', 'email', `
          ${matrixRenderKv('Mail Posture', assessment.mail?.summary || 'N/A')}
          ${matrixRenderKv('SPF Status', assessment.spf?.summary || 'N/A')}
          ${matrixRenderKv('SPF', Array.isArray(email.spf) && email.spf.length ? email.spf.join(' | ') : 'None')}
          ${matrixRenderKv('DMARC Status', assessment.dmarc?.summary || 'N/A')}
          ${matrixRenderKv('DMARC', Array.isArray(email.dmarc) && email.dmarc.length ? email.dmarc.join(' | ') : 'None')}
          ${matrixRenderKv('DKIM Status', assessment.dkim?.summary || 'N/A')}
          ${matrixRenderKv('DKIM', dkimFlags.length ? dkimFlags.join(', ') : 'Not found')}
          ${matrixRenderKv('Selectors Checked', Array.isArray(dkim.selectorsChecked) ? String(dkim.selectorsChecked.length) : '0')}
        `, assessment.email)}

        ${matrixRenderSection('TLS', 'tls', `
          ${matrixRenderKv('Assessment', assessment.tls?.summary || 'N/A')}
          ${matrixRenderKv('Status', tls.status || 'Unknown')}
          ${matrixRenderKv('Protocol', tls.protocol || 'N/A')}
          ${matrixRenderKv('Issuer', cert?.issuer?.CN || cert?.issuer?.O || 'N/A')}
          ${matrixRenderKv('Subject CN', cert?.subject?.CN || 'N/A')}
          ${matrixRenderKv('Certificate Expiry', cert.validTo || 'N/A')}
          ${matrixRenderKv('Days Remaining', expiryDays == null ? 'N/A' : String(expiryDays))}
        `, assessment.tls)}
      </div>

      ${matrixRenderSection('Highlights', 'highlights', `
        <div class="matrix-pill-row">${matrixJoinList(dns.ns || [])}</div>
        <div class="matrix-pill-row">${matrixFormatMx(dns.mx)}</div>
      `, overall)}

      ${Array.isArray(dkim.records) && dkim.records.length ? `
        ${matrixRenderSection('DKIM Records', 'dkim', `<div class="matrix-kv-list">${matrixExtractDkimRows(dkim)}</div>`, assessment.dkim)}
      ` : ''}

      ${(cert.subjectAltName || tls.cipher?.name || cert.validFrom || cert.validTo) ? `
        ${matrixRenderSection('Certificate Details', 'certificate', `
          <div class="matrix-kv-list">
            ${matrixRenderKv('SAN', cert.subjectAltName || 'N/A')}
            ${matrixRenderKv('Cipher', tls.cipher?.standardName || tls.cipher?.name || 'N/A')}
            ${matrixRenderKv('Valid From', cert.validFrom || 'N/A')}
            ${matrixRenderKv('Valid To', cert.validTo || 'N/A')}
          </div>
        `, assessment.tls)}
      ` : ''}
      </div>
    </section>
  `;
}

function matrixRenderIpResult(result) {
  const rdap = result?.rdap || {};
  const summary = rdap?.summary || {};
  const registrant = Array.isArray(summary.entities) ? summary.entities.find(entity => Array.isArray(entity.roles) && entity.roles.includes('registrant')) : null;
  const abuse = Array.isArray(rdap.document?.entities)
    ? rdap.document.entities.find(entity => Array.isArray(entity.roles) && entity.roles.includes('abuse'))
    : null;
  const events = matrixExtractEvents(summary.events || rdap.document?.events);

  return `
    <section class="matrix-result-card matrix-result-card--ip">
      <div class="matrix-result-head matrix-result-top">
        <div>
          <div class="matrix-result-title">${escapeHtml(result.normalized || result.target || 'IP')}</div>
          <div class="matrix-result-subtitle">${escapeHtml(summary.name || summary.handle || rdap.status || '')}</div>
        </div>
        <div class="matrix-chip-row">
          ${matrixStatusChip(result.public ? 'public' : (result.scope || 'private'), result.public ? 'ok' : 'warn')}
          ${matrixStatusChip(`IPv${escapeHtml(result.version || '')}`, 'neutral')}
          ${matrixStatusChip(rdap.status || 'rdap', rdap.status === 'ok' ? 'ok' : 'warn')}
        </div>
      </div>

      <div class="matrix-result-body">
      ${matrixCopyMarkdownAction(result)}
      <div class="matrix-section-grid">
        ${matrixRenderSection('Allocation', 'allocation', `
          ${matrixRenderKv('Network', summary.name || 'N/A')}
          ${matrixRenderKv('Handle', summary.handle || 'N/A')}
          ${matrixRenderKv('Type', summary.type || 'N/A')}
          ${matrixRenderKv('Range', summary.startAddress && summary.endAddress ? `${summary.startAddress} - ${summary.endAddress}` : 'N/A')}
          ${matrixRenderKv('Status', Array.isArray(summary.status) ? summary.status.join(', ') : 'N/A')}
        `)}

        ${matrixRenderSection('Ownership', 'ownership', `
          ${matrixRenderKv('Registrant', matrixExtractEntityName(registrant) || 'N/A')}
          ${matrixRenderKv('Abuse Contact', matrixExtractEntityEmail(abuse) || 'N/A')}
          ${matrixRenderKv('Registration', events.registration || 'N/A')}
          ${matrixRenderKv('Last Changed', events['last changed'] || 'N/A')}
        `)}
      </div>

      ${matrixRenderSection('RDAP Source', 'source', `
        <div class="matrix-kv-list">
          ${matrixRenderKv('Lookup URL', rdap.source || 'N/A')}
          ${matrixRenderKv('Parent Handle', summary.parentHandle || 'N/A')}
        </div>
      `)}
      </div>
    </section>
  `;
}

function matrixRenderSubdomainResult(result) {
  const discovery = result?.discovery || {};
  const hostnames = Array.isArray(discovery.hostnames) ? discovery.hostnames : [];
  const sourceSummary = matrixFormatSubdomainSources(discovery.sourcesUsed);
  const tone = result.error ? 'error' : (hostnames.length ? 'ok' : 'warning');
  const hostnameLines = hostnames.map(item => item.hostname || '').filter(Boolean).join('\n');

  return `
    <section class="matrix-result-card matrix-result-card--domain matrix-result-status--${tone}">
      <div class="matrix-result-head matrix-result-top">
        <div>
          <div class="matrix-result-title">${escapeHtml(result.rootDomain || result.normalized || result.target || 'Root Domain')}</div>
          <div class="matrix-result-subtitle">Passive subdomain discovery</div>
        </div>
        <div class="matrix-chip-row">
          ${matrixStatusChip(result.valid ? 'valid' : 'invalid', result.valid ? 'ok' : 'bad')}
          ${matrixStatusChip(`${discovery.returnedCount || 0} found`, hostnames.length ? 'ok' : 'warn')}
          ${Array.isArray(discovery.sourcesUsed) && discovery.sourcesUsed.length
            ? discovery.sourcesUsed.map(source => matrixStatusChip(source, 'neutral')).join('')
            : matrixStatusChip('no source', 'neutral')}
        </div>
      </div>

      <div class="matrix-result-body">
      ${matrixCopyMarkdownAction(result)}
      <div class="matrix-section-grid">
        ${matrixRenderSection('Discovery', 'resolution', `
          ${matrixRenderKv('Root Domain', result.rootDomain || result.normalized || 'N/A')}
          ${matrixRenderKv('Mode', discovery.passive ? 'Passive' : 'N/A')}
          ${matrixRenderKv('Sources Used', sourceSummary)}
          ${matrixRenderKv('Returned', String(discovery.returnedCount || 0))}
          ${matrixRenderKv('Total Discovered', String(discovery.totalDiscovered || 0))}
          ${matrixRenderKv('Truncated', discovery.truncated ? 'Yes' : 'No')}
        `)}

        ${matrixRenderSection('Source Detail', 'source', `
          ${matrixRenderKv('Lookup Sources', sourceSummary)}
          ${matrixRenderKv('Source Count', String(Array.isArray(discovery.sourcesUsed) ? discovery.sourcesUsed.length : 0))}
          ${matrixRenderKv('Passive Only', 'Yes')}
          ${matrixRenderKv('Touches Target', 'No')}
        `)}
      </div>

      ${matrixRenderSection('Discovered Hostnames', 'highlights', `
        ${hostnames.length ? `
          <div class="matrix-copy-toolbar">
            <div class="matrix-copy-meta">${escapeHtml(`${hostnames.length} hostnames`)}</div>
            <button class="tb-btn matrix-copy-btn" type="button" onclick="copyMatrixText(this)" data-copy="${matrixEscapeAttribute(hostnameLines)}">Copy All</button>
          </div>
          <textarea class="matrix-copy-block" readonly spellcheck="false">${escapeHtml(hostnameLines)}</textarea>
          <div class="matrix-subdomain-list">
            ${hostnames.map(item => `
              <div class="matrix-subdomain-item">
                <div class="matrix-subdomain-host-wrap">
                  <div class="matrix-subdomain-host">${escapeHtml(item.hostname || '')}</div>
                  <div class="matrix-subdomain-meta">${escapeHtml(matrixFormatSubdomainSources(item.sources))}</div>
                </div>
                <button class="tb-btn matrix-copy-btn" type="button" onclick="copyMatrixText(this)" data-copy="${matrixEscapeAttribute(item.hostname || '')}">Copy</button>
              </div>
            `).join('')}
          </div>
        ` : `<div class="matrix-empty-state">${escapeHtml(result.error || 'No passive subdomains discovered')}</div>`}
      `)}
      </div>
    </section>
  `;
}

function matrixRenderJobOverview(job) {
  const counts = job?.result?.counts || {};
  const jobName = job?.input?.name || job?.name || '';
  const fallbackTitle = job?.type === 'nmap-enumeration' || job?.type === 'masscan-enumeration' || job?.type === 'httpx-enumeration'
    ? 'Active Enumeration'
    : 'Passive Recon';
  const targetCount = Array.isArray(job?.input?.targets) && job.input.targets.length
    ? job.input.targets.length
    : (Object.prototype.hasOwnProperty.call(counts, 'Targets') ? counts.Targets : 0);
  const overviewSubtitle = job?.type === 'nmap-enumeration' || job?.type === 'masscan-enumeration' || job?.type === 'httpx-enumeration'
    ? (job?.input?.profileLabel || (job?.type === 'masscan-enumeration' ? 'Masscan Scan' : job?.type === 'httpx-enumeration' ? 'httpx Scan' : 'Nmap Scan'))
    : `${matrixFormatJobType(job.type)} • Job ${job.id || ''}`;
  return `
    <section class="matrix-result-card matrix-result-card--job">
      <div class="matrix-result-head matrix-result-top">
          <div>
            <div class="matrix-result-title">${escapeHtml(jobName || fallbackTitle)}</div>
          <div class="matrix-result-subtitle">${escapeHtml(overviewSubtitle)}</div>
        </div>
        <div class="matrix-chip-row">
          ${matrixStatusChip(job.status || 'unknown', job.status === 'completed' ? 'ok' : (job.status === 'failed' ? 'bad' : 'warn'))}
        </div>
      </div>
      <div class="matrix-result-body">
      <div class="matrix-section-grid">
        ${matrixRenderSection('Timing', 'timing', `
          ${matrixRenderKv('Created', matrixFormatDate(job.createdAt))}
          ${matrixRenderKv('Started', matrixFormatDate(job.startedAt))}
          ${matrixRenderKv('Completed', matrixFormatDate(job.completedAt))}
        `)}
        ${matrixRenderSection('Counts', 'counts', `
          ${job?.type === 'nmap-enumeration' || job?.type === 'masscan-enumeration' || job?.type === 'httpx-enumeration'
            ? matrixRenderKv('Targets', String(targetCount))
            : (Object.keys(counts).length
              ? Object.entries(counts).map(([key, value]) => matrixRenderKv(key, String(value))).join('')
              : matrixRenderKv('Targets', String(targetCount)))}
        `)}
      </div>
      </div>
    </section>
  `;
}

function matrixHttpxStatusTone(statusCode) {
  if (!Number.isFinite(statusCode)) return 'neutral';
  if (statusCode >= 200 && statusCode < 300) return 'ok';
  if (statusCode >= 300 && statusCode < 400) return 'info';
  if (statusCode >= 400 && statusCode < 500) return 'warn';
  if (statusCode >= 500) return 'bad';
  return 'neutral';
}

function matrixHttpxTopCounts(items, extractor, limit = 6) {
  const counts = new Map();
  items.forEach((item) => {
    const values = extractor(item)
      .map(value => String(value || '').trim())
      .filter(Boolean);
    values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

function matrixHttpxLiveUrls(results) {
  return results
    .map(item => item?.url || item?.input || '')
    .filter(Boolean);
}

function matrixResolveNmapQuickLogTarget(parsed, host) {
  const targets = Array.isArray(parsed?.quickLogPreview?.targets) ? parsed.quickLogPreview.targets : [];
  return targets.find((item) => (
    (item?.target && host?.target && item.target === host.target)
    || (item?.displayTarget && host?.displayTarget && item.displayTarget === host.displayTarget)
  )) || null;
}

function matrixRenderNmapParsedResult(parsed) {
  const hosts = Array.isArray(parsed?.hosts) ? parsed.hosts : [];
  if (!hosts.length) return '';

  return `
    <section class="matrix-section matrix-section--highlights matrix-section-status--neutral">
      <div class="matrix-section-top">PARSED PORTS</div>
      <div class="matrix-section-body">
        <div class="matrix-section-grid matrix-section-grid--compact">
          ${matrixRenderSection('Coverage', 'counts', `
            ${matrixRenderKv('Hosts', String(parsed?.summary?.hostCount ?? parsed?.stats?.totalHosts ?? hosts.length))}
            ${matrixRenderKv('Up', String(parsed?.summary?.upCount ?? parsed?.stats?.upHosts ?? hosts.filter((host) => host?.status === 'up').length))}
            ${matrixRenderKv('Ports', String(parsed?.summary?.portCount ?? parsed?.stats?.totalPorts ?? hosts.reduce((count, host) => count + ((host?.ports || []).length), 0)))}
            ${matrixRenderKv('Open', String(parsed?.summary?.openPortCount ?? parsed?.stats?.openPorts ?? hosts.reduce((count, host) => count + ((host?.ports || []).filter((port) => port?.state === 'open').length), 0)))}
          `)}
        </div>
        <div class="matrix-nmap-host-list">
          ${hosts.map((host) => {
            const openPorts = (Array.isArray(host?.ports) ? host.ports : []).filter((port) => port?.state === 'open');
            const previewTarget = matrixResolveNmapQuickLogTarget(parsed, host);
            const copyPayload = openPorts.map((port) => {
              const version = [port?.product, port?.version, port?.extrainfo].filter(Boolean).join(' ');
              return `${port?.port || ''}/${port?.protocol || 'tcp'} ${port?.service || ''}${version ? ` ${version}` : ''}`.trim();
            }).join('\n');
            return `
              <div class="matrix-nmap-host-card">
                <div class="matrix-copy-toolbar matrix-copy-toolbar--tight">
                  <div>
                    <div class="matrix-nmap-host-title">${escapeHtml(host?.displayTarget || host?.target || host?.ip || 'Host')}</div>
                    <div class="matrix-nmap-host-meta">${escapeHtml(host?.ip || host?.target || 'N/A')} • ${escapeHtml(host?.status || 'unknown')} • ${escapeHtml(String(host?.openPortsCount ?? openPorts.length))} open</div>
                  </div>
                  <div class="matrix-inline-row">
                    <button class="tb-btn matrix-copy-btn" type="button" onclick="copyMatrixText(this)" data-copy="${matrixEscapeAttribute(copyPayload)}">Copy Ports</button>
                    ${previewTarget && openPorts.length ? `<button class="tb-btn matrix-copy-btn" type="button" onclick="insertMatrixQuickLogPorts(this)" data-preview="${matrixEscapeAttribute(JSON.stringify(previewTarget))}">Insert Ports</button>` : ''}
                  </div>
                </div>
                ${host?.os?.name ? `<div class="matrix-assessment-note">${escapeHtml(host.os.name)}${host.os.accuracy != null ? ` (${escapeHtml(String(host.os.accuracy))}% )` : ''}</div>`.replace('% )','%)') : ''}
                <div class="matrix-httpx-table-wrap matrix-nmap-table-wrap">
                  <table class="matrix-httpx-table matrix-nmap-table">
                    <thead>
                      <tr>
                        <th>Port</th>
                        <th>State</th>
                        <th>Service</th>
                        <th>Version</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${openPorts.length ? openPorts.map((port) => `
                        <tr>
                          <td>${escapeHtml(`${port?.port || '—'}/${port?.protocol || 'tcp'}`)}</td>
                          <td>${escapeHtml(port?.state || '—')}</td>
                          <td>${escapeHtml(port?.service || '—')}</td>
                          <td>${escapeHtml([port?.product, port?.version, port?.extrainfo].filter(Boolean).join(' ') || '—')}</td>
                          <td>${escapeHtml(port?.note || '—')}</td>
                        </tr>
                      `).join('') : `
                        <tr>
                          <td colspan="5">No open ports parsed.</td>
                        </tr>
                      `}
                    </tbody>
                  </table>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </section>
  `;
}

function matrixRenderHttpxParsedResult(parsed) {
  const httpxResults = Array.isArray(parsed?.results) ? parsed.results : [];
  if (!httpxResults.length) return '';

  const totalResults = parsed?.stats?.totalResults ?? httpxResults.length;
  const liveHosts = parsed?.stats?.liveHosts ?? httpxResults.filter(item => item?.url || item?.input).length;
  const httpsCount = httpxResults.filter(item => /^https:\/\//i.test(item?.url || item?.input || '')).length;
  const redirects = httpxResults.filter(item => item?.location || item?.redirectLocation).length;
  const titles = httpxResults.filter(item => item?.title).length;
  const ips = new Set(httpxResults.map(item => item?.ip).filter(Boolean));
  const status2xx = httpxResults.filter(item => Number.isFinite(item?.statusCode) && item.statusCode >= 200 && item.statusCode < 300).length;
  const status3xx = httpxResults.filter(item => Number.isFinite(item?.statusCode) && item.statusCode >= 300 && item.statusCode < 400).length;
  const status4xx = httpxResults.filter(item => Number.isFinite(item?.statusCode) && item.statusCode >= 400 && item.statusCode < 500).length;
  const status5xx = httpxResults.filter(item => Number.isFinite(item?.statusCode) && item.statusCode >= 500).length;
  const tlsDetected = httpxResults.filter(item => item?.tls || item?.scheme === 'https' || /^https:\/\//i.test(item?.url || item?.input || '')).length;
  const serverCounts = matrixHttpxTopCounts(httpxResults, item => [item?.webserver]);
  const techCounts = matrixHttpxTopCounts(httpxResults, item => Array.isArray(item?.technologies) ? item.technologies : []);
  const liveUrls = matrixHttpxLiveUrls(httpxResults);

  return `
    <section class="matrix-section matrix-section--highlights matrix-section-status--neutral">
      <div class="matrix-section-top">WEB SUMMARY</div>
      <div class="matrix-section-body">
        <div class="matrix-section-grid matrix-section-grid--compact">
          ${matrixRenderSection('Coverage', 'counts', `
            ${matrixRenderKv('Returned', String(totalResults))}
            ${matrixRenderKv('Live Hosts', String(liveHosts))}
            ${matrixRenderKv('HTTPS', String(httpsCount))}
            ${matrixRenderKv('Unique IPs', String(ips.size))}
          `)}
          ${matrixRenderSection('Signals', 'source', `
            ${matrixRenderKv('Titles', String(titles))}
            ${matrixRenderKv('Redirects', String(redirects))}
            ${matrixRenderKv('TLS Seen', String(tlsDetected))}
            ${matrixRenderKv('Webservers', String(serverCounts.length))}
          `)}
          ${matrixRenderSection('Status Mix', 'timing', `
            ${matrixRenderKv('2xx', String(status2xx))}
            ${matrixRenderKv('3xx', String(status3xx))}
            ${matrixRenderKv('4xx', String(status4xx))}
            ${matrixRenderKv('5xx', String(status5xx))}
          `)}
        </div>
        <div class="matrix-httpx-summaries">
          <div class="matrix-httpx-summary-block">
            <div class="matrix-copy-toolbar">
              <div class="matrix-copy-meta">Top Webservers</div>
            </div>
            <div class="matrix-pill-row">
              ${serverCounts.length
                ? serverCounts.map(([name, count]) => `<span class="matrix-pill">${escapeHtml(`${name} (${count})`)}</span>`).join('')
                : '<span class="matrix-muted">No server headers captured</span>'}
            </div>
          </div>
          <div class="matrix-httpx-summary-block">
            <div class="matrix-copy-toolbar">
              <div class="matrix-copy-meta">Top Technologies</div>
            </div>
            <div class="matrix-pill-row">
              ${techCounts.length
                ? techCounts.map(([name, count]) => `<span class="matrix-pill">${escapeHtml(`${name} (${count})`)}</span>`).join('')
                : '<span class="matrix-muted">No technology fingerprints captured</span>'}
            </div>
          </div>
        </div>
      </div>
    </section>
    <section class="matrix-section matrix-section--highlights matrix-section-status--neutral">
      <div class="matrix-section-top">LIVE URLS</div>
      <div class="matrix-section-body">
        <div class="matrix-copy-toolbar">
          <div class="matrix-copy-meta">${escapeHtml(`${liveUrls.length} URLs`)}</div>
          <button class="tb-btn matrix-copy-btn" type="button" onclick="copyMatrixText(this)" data-copy="${matrixEscapeAttribute(liveUrls.join('\n'))}">Copy URLs</button>
        </div>
        <textarea class="matrix-copy-block matrix-copy-block--compact" readonly spellcheck="false">${escapeHtml(liveUrls.join('\n'))}</textarea>
      </div>
    </section>
    <section class="matrix-section matrix-section--highlights matrix-section-status--neutral">
      <div class="matrix-section-top">PARSED RESULTS</div>
      <div class="matrix-section-body">
        <div class="matrix-httpx-table-wrap">
          <table class="matrix-httpx-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>URL</th>
                <th>Title</th>
                <th>Server</th>
                <th>Tech</th>
                <th>IP</th>
                <th>RT</th>
                <th>Redirect</th>
                <th>TLS</th>
              </tr>
            </thead>
            <tbody>
              ${httpxResults.map(item => {
                const statusCode = Number.isFinite(item?.statusCode) ? item.statusCode : null;
                const statusTone = matrixHttpxStatusTone(statusCode);
                const redirect = item?.location || item?.redirectLocation || '';
                const tlsSummary = item?.tls?.subjectCN
                  || item?.tls?.subject_cn
                  || item?.tls?.subject
                  || item?.scheme
                  || '';
                return `
                  <tr>
                    <td><span class="matrix-httpx-status ${statusTone}">${escapeHtml(statusCode ?? '—')}</span></td>
                    <td title="${escapeHtml(item?.url || item?.input || '')}">${escapeHtml(item?.url || item?.input || '—')}</td>
                    <td title="${escapeHtml(item?.title || '')}">${escapeHtml(item?.title || '—')}</td>
                    <td>${escapeHtml(item?.webserver || '—')}</td>
                    <td title="${escapeHtml(Array.isArray(item?.technologies) ? item.technologies.join(', ') : '')}">${escapeHtml(Array.isArray(item?.technologies) && item.technologies.length ? item.technologies.join(', ') : '—')}</td>
                    <td>${escapeHtml(item?.ip || '—')}</td>
                    <td>${escapeHtml(item?.responseTime || item?.response_time || '—')}</td>
                    <td title="${escapeHtml(redirect || '')}">${escapeHtml(redirect || '—')}</td>
                    <td title="${escapeHtml(tlsSummary || '')}">${escapeHtml(tlsSummary || '—')}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

function matrixRenderEnumerationResult(job, resultEnvelope) {
  const result = resultEnvelope || {};
  const command = result.command || {};
  const execution = result.execution || {};
  const output = result.output || {};
  const parsed = result.parsed || {};
  const httpxResults = Array.isArray(parsed.results) ? parsed.results : [];
  const isRunning = job?.status === 'queued' || job?.status === 'running';
  const statusTone = job?.status === 'completed' ? 'ok' : (job?.status === 'failed' ? 'bad' : 'warn');
  const targetsLabel = Array.isArray(result.targets) && result.targets.length
    ? result.targets.join(', ')
    : (Array.isArray(job?.input?.targets) && job.input.targets.length ? job.input.targets.join(', ') : 'N/A');
  const toolLabel = job?.type === 'masscan-enumeration'
    ? 'Masscan'
    : job?.type === 'httpx-enumeration'
      ? 'httpx'
      : 'Nmap';

  return `
    <section class="matrix-result-card matrix-result-card--generic">
      <div class="matrix-result-head matrix-result-top">
        <div>
          <div class="matrix-result-title">${escapeHtml(result.profile?.label || job?.input?.profileLabel || toolLabel)}</div>
        </div>
        <div class="matrix-chip-row">
          ${matrixStatusChip(job?.status || 'unknown', statusTone)}
          ${!isRunning && execution.exitCode != null ? matrixStatusChip(execution.exitCode === 0 ? 'success' : `exit ${execution.exitCode}`, execution.exitCode === 0 ? 'ok' : 'warn') : ''}
          ${execution.timedOut ? matrixStatusChip('timed out', 'bad') : ''}
        </div>
      </div>
      <div class="matrix-result-body">
        ${toolLabel === 'Nmap' && Array.isArray(parsed?.hosts) && parsed.hosts.length ? matrixRenderNmapParsedResult(parsed) : ''}
        <div class="matrix-section-grid">
          ${matrixRenderSection('Command', 'resolution', `
            ${matrixRenderKv('Profile', result.profile?.label || job?.input?.profileLabel || toolLabel)}
            ${matrixRenderKv('Targets', targetsLabel)}
            ${matrixRenderKv('Command', command.rendered || (isRunning ? `Waiting for ${toolLabel} to complete` : 'N/A'))}
          `)}
          ${matrixRenderSection('Execution', 'counts', `
            ${matrixRenderKv('Status', job?.status || 'unknown')}
            ${matrixRenderKv('Exit Code', isRunning ? 'Pending' : (execution.exitCode == null ? 'N/A' : String(execution.exitCode)))}
            ${matrixRenderKv('Signal', isRunning ? 'Pending' : (execution.signal || 'None'))}
            ${matrixRenderKv('Timed Out', execution.timedOut ? 'Yes' : (isRunning ? 'Pending' : 'No'))}
          `)}
        </div>
        ${output.stdout ? `
          ${toolLabel === 'httpx' && httpxResults.length ? matrixRenderHttpxParsedResult(parsed) : ''}
          <section class="matrix-section matrix-section--neutral matrix-section-status--neutral">
            <div class="matrix-section-top">${escapeHtml(toolLabel.toUpperCase())} OUTPUT</div>
            <div class="matrix-section-body">
              <div class="matrix-copy-toolbar">
                <div class="matrix-copy-meta">Raw CLI output for Quick Log parsing</div>
                <button class="tb-btn matrix-copy-btn" type="button" onclick="copyMatrixText(this)" data-copy="${matrixEscapeAttribute(output.stdout)}">Copy Output</button>
              </div>
              <pre class="matrix-raw-pre">${escapeHtml(output.stdout)}</pre>
            </div>
          </section>
        ` : ''}
        ${output.stderr ? `
          <section class="matrix-section matrix-section--warning matrix-section-status--warning">
            <div class="matrix-section-top">STDERR</div>
            <div class="matrix-section-body">
              <div class="matrix-copy-toolbar">
                <div class="matrix-copy-meta">Captured standard error</div>
                <button class="tb-btn matrix-copy-btn" type="button" onclick="copyMatrixText(this)" data-copy="${matrixEscapeAttribute(output.stderr)}">Copy STDERR</button>
              </div>
              <pre class="matrix-raw-pre">${escapeHtml(output.stderr)}</pre>
            </div>
          </section>
        ` : ''}
      </div>
    </section>
  `;
}

function matrixRenderRaw(value) {
  const openByDefault = matrixState.toolboxModule === 'enumeration'
    && ['submitting', 'queued', 'running'].includes(value?.status || (value?.submitting ? 'submitting' : ''));
  return `
    <details class="matrix-raw-details"${openByDefault ? ' open' : ''}>
      <summary>Raw JSON</summary>
      <pre class="matrix-raw-pre">${escapeHtml(JSON.stringify(value, null, 2))}</pre>
    </details>
  `;
}

function matrixRenderPayload(value) {
  if (typeof value === 'string') {
    return `<div class="matrix-empty-state">${escapeHtml(value)}</div>`;
  }

  const summary = value?.summary || null;
  const base = value?.result && value?.status ? value : (summary || value);
  const resultEnvelope = value?.result && value?.result?.results ? value.result : (value?.result?.result ? value.result.result : value?.result || null);
  const results = Array.isArray(resultEnvelope?.results) ? resultEnvelope.results : [];

  if (value?.submitting) {
    return `
      <section class="matrix-result-card matrix-result-card--submit">
        <div class="matrix-result-head matrix-result-top">
          <div>
            <div class="matrix-result-title">Submitting ${escapeHtml(
              matrixState.toolboxModule === 'enumeration'
                ? (matrixActiveEnumerationNamingValue() || 'Active Enumeration')
                : (document.getElementById('matrixNaming')?.value.trim() || 'Passive Recon')
            )}</div>
            <div class="matrix-result-subtitle">Waiting for Toolbox to queue the job</div>
          </div>
          <div class="matrix-chip-row">${matrixStatusChip('submitting', 'warn')}</div>
        </div>
        <div class="matrix-result-body"></div>
      </section>
      ${matrixRenderRaw(value)}
    `;
  }

  if (!base || (!base.status && !results.length)) {
    return matrixRenderRaw(value);
  }

  let html = matrixRenderJobOverview({ ...base, result: resultEnvelope });
  if ((base?.type || summary?.type) === 'nmap-enumeration' || (base?.type || summary?.type) === 'masscan-enumeration' || (base?.type || summary?.type) === 'httpx-enumeration' || resultEnvelope?.command?.rendered) {
    html += matrixRenderEnumerationResult(base, resultEnvelope);
  }
  if (results.length) {
    html += results.map(item => {
      if (item.kind === 'domain') return matrixRenderDomainResult(item);
      if (item.kind === 'ip') return matrixRenderIpResult(item);
      if (item.kind === 'subdomain-discovery') return matrixRenderSubdomainResult(item);
      return `
        <section class="matrix-result-card matrix-result-card--generic">
          <div class="matrix-result-head matrix-result-top">
            <div>
              <div class="matrix-result-title">${escapeHtml(item.normalized || item.target || item.kind || 'Result')}</div>
            </div>
          </div>
          <div class="matrix-result-body">${matrixRenderRaw(item)}</div>
        </section>
      `;
    }).join('');
  }
  if (base?.error || value?.error) {
    html += `
      <section class="matrix-result-card matrix-result-card--error">
        <div class="matrix-result-head matrix-result-top">
          <div><div class="matrix-result-title">Error</div></div>
        </div>
        <div class="matrix-result-body"><div class="matrix-empty-state">${escapeHtml(base.error || value.error)}</div></div>
      </section>
    `;
  }
  html += matrixRenderRaw(value);
  return html;
}

function matrixSetOutput(value) {
  const node = document.getElementById(matrixState.toolboxModule === 'enumeration'
    ? 'matrixOutputEnumeration'
    : 'matrixOutputPassive');
  if (!node) return;
  const rawDetailsWasOpen = node.querySelector('.matrix-raw-details[open]') !== null;
  const summary = value?.summary || null;
  const base = value?.result && value?.status ? value : (summary || value);
  const stopButton = document.getElementById('matrixStopButton');
  const cancellable = matrixState.toolboxModule === 'enumeration' && !!base?.id && (base?.status === 'queued' || base?.status === 'running');
  matrixState.currentJobId = base?.id || null;
  matrixState.currentJobStatus = base?.status || null;
  if (stopButton) stopButton.disabled = !cancellable;
  node.innerHTML = matrixRenderPayload(value);
  const rawDetails = node.querySelector('.matrix-raw-details');
  if (rawDetails && rawDetailsWasOpen) {
    rawDetails.open = true;
  }
}

function matrixActiveJobsListNode() {
  return document.getElementById(matrixState.toolboxModule === 'enumeration'
    ? 'matrixJobsListEnumeration'
    : 'matrixJobsListPassive');
}

function matrixActiveOutputNode() {
  return document.getElementById(matrixState.toolboxModule === 'enumeration'
    ? 'matrixOutputEnumeration'
    : 'matrixOutputPassive');
}

function matrixParseImportedTargets(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map(item => typeof item === 'string' ? item.trim() : '').filter(Boolean);
    }
    if (Array.isArray(parsed?.targets)) {
      return parsed.targets.map(item => String(item || '').trim()).filter(Boolean);
    }
    if (Array.isArray(parsed?.result?.results)) {
      return parsed.result.results
        .flatMap(item => item?.kind === 'subdomain-discovery'
          ? (Array.isArray(item?.discovery?.hostnames) ? item.discovery.hostnames.map(host => host?.hostname || '') : [])
          : [item?.normalized || item?.target || ''])
        .map(item => String(item || '').trim())
        .filter(Boolean);
    }
    if (Array.isArray(parsed?.results)) {
      return parsed.results
        .flatMap(item => item?.kind === 'subdomain-discovery'
          ? (Array.isArray(item?.discovery?.hostnames) ? item.discovery.hostnames.map(host => host?.hostname || '') : [])
          : [item?.normalized || item?.target || ''])
        .map(item => String(item || '').trim())
        .filter(Boolean);
    }
  } catch (_) {}

  return trimmed
    .split(/[\n,;\t\r ]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function importMatrixTargets() {
  document.getElementById('matrixImportFile')?.click();
}

async function onMatrixFileSelected(event) {
  const input = event?.target;
  const file = input?.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const targets = matrixParseImportedTargets(text);
    const textarea = matrixActiveTargetsNode();
    if (textarea) {
      textarea.value = targets.length ? targets.join('\n') : text;
    }
    matrixSetOutput({
      imported: true,
      filename: file.name,
      detectedTargets: targets.length,
      name: matrixState.toolboxModule === 'enumeration'
        ? (matrixActiveEnumerationNamingValue() || null)
        : (document.getElementById('matrixNaming')?.value.trim() || null),
      mode: matrixState.toolboxModule === 'enumeration'
        ? `${matrixActiveEnumerationTool()}-enumeration`
        : matrixState.mode,
    });
  } catch (error) {
    matrixSetOutput({ error: 'Could not read import file', detail: error.message });
  } finally {
    if (input) input.value = '';
  }
}

function onMatrixTargetsKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.stopPropagation();
  }
}

async function initMatrix() {
  applyMatrixAvailabilityUi();
  setMatrixToolboxModule(matrixState.toolboxModule);
  setMatrixMode(matrixState.mode);
  document.getElementById('matrixImportFile')?.addEventListener('change', onMatrixFileSelected);
  document.getElementById('matrixTargets')?.addEventListener('keydown', onMatrixTargetsKeydown);
  document.getElementById('matrixEnumTargets')?.addEventListener('keydown', onMatrixTargetsKeydown);
  document.getElementById('matrixEnumTargetsMasscan')?.addEventListener('keydown', onMatrixTargetsKeydown);
  document.getElementById('matrixEnumTargetsHttpx')?.addEventListener('keydown', onMatrixTargetsKeydown);
  setMatrixEnumerationTool(matrixState.enumerationTool);
  await Promise.allSettled([
    refreshMatrixStatus(),
    loadMatrixJobs(),
    loadMatrixNmapProfiles(),
    loadMatrixMasscanProfiles(),
    loadMatrixHttpxProfiles(),
  ]);
}

function onMatrixViewOpen() {
  applyMatrixAvailabilityUi();
  refreshMatrixStatus();
  loadMatrixJobs();
}

function setMatrixEnumerationTool(toolName) {
  const allowed = ['nmap', 'masscan', 'httpx'];
  matrixState.enumerationTool = allowed.includes(toolName) ? toolName : 'nmap';
  const select = document.getElementById('matrixEnumToolSelect');
  if (select) select.value = matrixState.enumerationTool;
  document.getElementById('matrixEnumToolNmap')?.toggleAttribute('hidden', matrixState.enumerationTool !== 'nmap');
  document.getElementById('matrixEnumToolMasscan')?.toggleAttribute('hidden', matrixState.enumerationTool !== 'masscan');
  document.getElementById('matrixEnumToolHttpx')?.toggleAttribute('hidden', matrixState.enumerationTool !== 'httpx');
  if (matrixState.toolboxModule === 'enumeration') {
    const output = matrixActiveOutputNode();
    if (output) output.textContent = matrixEnumerationDefaultOutputMessage();
    loadMatrixJobs();
  }
  if (matrixState.enumerationTool === 'nmap') {
    loadMatrixNmapProfiles().catch(() => {});
  } else if (matrixState.enumerationTool === 'masscan') {
    loadMatrixMasscanProfiles().catch(() => {});
  } else if (matrixState.enumerationTool === 'httpx') {
    loadMatrixHttpxProfiles().catch(() => {});
  }
}

function setMatrixToolboxModule(moduleName) {
  if (!matrixState.online && moduleName === 'enumeration') {
    moduleName = 'passive';
  }
  matrixState.toolboxModule = moduleName === 'enumeration' ? 'enumeration' : 'passive';
  document.getElementById('matrixModulePassive')?.classList.toggle('active', matrixState.toolboxModule === 'passive');
  document.getElementById('matrixModuleEnumeration')?.classList.toggle('active', matrixState.toolboxModule === 'enumeration');
  document.getElementById('matrixPanelPassive')?.toggleAttribute('hidden', matrixState.toolboxModule !== 'passive');
  document.getElementById('matrixPanelEnumeration')?.toggleAttribute('hidden', matrixState.toolboxModule !== 'enumeration');
  document.getElementById('matrixJobsCardPassive')?.toggleAttribute('hidden', matrixState.toolboxModule !== 'passive');
  document.getElementById('matrixOutputCardPassive')?.toggleAttribute('hidden', matrixState.toolboxModule !== 'passive');
  document.getElementById('matrixJobsCardEnumeration')?.toggleAttribute('hidden', matrixState.toolboxModule !== 'enumeration');
  document.getElementById('matrixOutputCardEnumeration')?.toggleAttribute('hidden', matrixState.toolboxModule !== 'enumeration');

  const toolbarModuleLabel = document.getElementById('matrixToolbarModuleLabel');
  if (toolbarModuleLabel) toolbarModuleLabel.textContent = 'TOOLBOX';

  const output = matrixActiveOutputNode();
  if (output) {
    output.textContent = matrixDefaultOutputMessage();
  }
  const stopButton = document.getElementById('matrixStopButton');
  if (stopButton && matrixState.toolboxModule !== 'enumeration') stopButton.disabled = true;

  if (matrixState.toolboxModule === 'enumeration') {
    setMatrixEnumerationTool(matrixState.enumerationTool);
    if (matrixActiveEnumerationTool() === 'nmap') loadMatrixNmapProfiles();
    if (matrixActiveEnumerationTool() === 'masscan') loadMatrixMasscanProfiles();
    if (matrixActiveEnumerationTool() === 'httpx') loadMatrixHttpxProfiles();
  }

  loadMatrixJobs();
}

async function refreshMatrixStatus() {
  try {
    const [healthResponse, capabilitiesResponse] = await Promise.all([
      fetch('/api/matrix/health'),
      fetch('/api/matrix/capabilities'),
    ]);
    if (!healthResponse.ok || !capabilitiesResponse.ok) throw new Error('Toolbox proxy unavailable');
    const [health, capabilities] = await Promise.all([
      healthResponse.json(),
      capabilitiesResponse.json(),
    ]);
    if (!health?.ok || capabilities?.service !== 'matrix') throw new Error('Toolbox service unavailable');
    matrixState.capabilities = capabilities;
    matrixState.online = true;
    matrixSetEnumCapability(capabilities?.runtime?.nmap?.available
      ? `Nmap available${capabilities.runtime.nmap.version ? ` • ${capabilities.runtime.nmap.version}` : ''}`
      : `Nmap unavailable${capabilities?.runtime?.nmap?.detail ? ` • ${capabilities.runtime.nmap.detail}` : ''}`);
    const masscanNode = document.getElementById('matrixMasscanCapability');
    if (masscanNode) {
      masscanNode.textContent = capabilities?.runtime?.masscan?.available
        ? `Masscan available${capabilities.runtime.masscan.version ? ` • ${capabilities.runtime.masscan.version}` : ''}`
        : `Masscan unavailable${capabilities?.runtime?.masscan?.detail ? ` • ${capabilities.runtime.masscan.detail}` : ''}`;
    }
    const httpxNode = document.getElementById('matrixHttpxCapability');
    if (httpxNode) {
      httpxNode.textContent = capabilities?.runtime?.httpx?.available
        ? `httpx available${capabilities.runtime.httpx.version ? ` • ${capabilities.runtime.httpx.version}` : ''}`
        : `httpx unavailable${capabilities?.runtime?.httpx?.detail ? ` • ${capabilities.runtime.httpx.detail}` : ''}`;
    }
    matrixSetStatus('online', 'online');
    applyMatrixAvailabilityUi();
  } catch (error) {
    matrixState.capabilities = null;
    matrixState.online = false;
    matrixSetEnumCapability('Toolbox unavailable');
    const masscanNode = document.getElementById('matrixMasscanCapability');
    if (masscanNode) masscanNode.textContent = 'Toolbox unavailable';
    const httpxNode = document.getElementById('matrixHttpxCapability');
    if (httpxNode) httpxNode.textContent = 'Toolbox unavailable';
    matrixSetStatus('offline', 'offline');
    applyMatrixAvailabilityUi();
    setMatrixToolboxModule('passive');
  }
}

function setMatrixMode(mode) {
  matrixState.mode = mode === 'ips' || mode === 'subdomains' ? mode : 'domains';
  document.getElementById('matrixModeDomains')?.classList.toggle('active', matrixState.mode === 'domains');
  document.getElementById('matrixModeIps')?.classList.toggle('active', matrixState.mode === 'ips');
  document.getElementById('matrixModeSubdomains')?.classList.toggle('active', matrixState.mode === 'subdomains');
  const dkimLabel = document.getElementById('matrixDkimLabel');
  const dkimInput = document.getElementById('matrixDkimSelectors');
  const targetsLabel = document.getElementById('matrixTargetsLabel');
  const targets = document.getElementById('matrixTargets');
  if (dkimLabel) dkimLabel.style.display = matrixState.mode === 'domains' ? '' : 'none';
  if (dkimInput) {
    dkimInput.style.display = matrixState.mode === 'domains' ? '' : 'none';
    dkimInput.disabled = matrixState.mode !== 'domains';
  }
  if (targetsLabel) {
    targetsLabel.textContent = matrixState.mode === 'domains'
      ? 'Domains'
      : (matrixState.mode === 'ips' ? 'IP Addresses' : 'Root Domains');
  }
  if (targets) {
    targets.placeholder = matrixState.mode === 'domains'
      ? 'example.com\nsub.example.com'
      : (matrixState.mode === 'ips'
        ? '8.8.8.8\n1.1.1.1'
        : 'example.com\nacme.com');
  }
}

function clearMatrixForm() {
  if (matrixState.toolboxModule === 'enumeration') {
    const isNmap = matrixActiveEnumerationTool() === 'nmap';
    const isMasscan = matrixActiveEnumerationTool() === 'masscan';
    const isHttpx = matrixActiveEnumerationTool() === 'httpx';
    if (!isNmap && !isMasscan && !isHttpx) return;
    const naming = document.getElementById(isNmap ? 'matrixEnumNaming' : isMasscan ? 'matrixEnumNamingMasscan' : 'matrixEnumNamingHttpx');
    const targets = document.getElementById(isNmap ? 'matrixEnumTargets' : isMasscan ? 'matrixEnumTargetsMasscan' : 'matrixEnumTargetsHttpx');
    if (naming) naming.value = '';
    if (targets) targets.value = '';
    return;
  }
  const naming = document.getElementById('matrixNaming');
  const targets = document.getElementById('matrixTargets');
  const selectors = document.getElementById('matrixDkimSelectors');
  if (naming) naming.value = '';
  if (targets) targets.value = '';
  if (selectors) selectors.value = '';
}

async function submitMatrixJob() {
  const targets = document.getElementById('matrixTargets').value;
  const dkimSelectors = document.getElementById('matrixDkimSelectors').value;
  const name = document.getElementById('matrixNaming')?.value.trim() || '';
  const path = matrixState.mode === 'ips'
    ? '/api/matrix/recon/ips'
    : (matrixState.mode === 'subdomains' ? '/api/matrix/recon/subdomains' : '/api/matrix/recon/domains');
  const body = { text: targets };
  if (name) body.name = name;
  if (matrixState.mode === 'domains' && dkimSelectors.trim()) body.dkimSelectors = dkimSelectors;

  matrixSetOutput({ submitting: true, path, body });

  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    matrixSetOutput(data);
    return;
  }

  matrixState.currentJobId = data.id;
  matrixSetOutput(data);
  loadMatrixJobs();
  pollMatrixJob(data.id);
}

function matrixSyncProfileEditor(profile) {
  const label = document.getElementById('matrixNmapProfileLabel');
  const description = document.getElementById('matrixNmapProfileDescription');
  const commandTemplate = document.getElementById('matrixNmapCommandTemplate');
  if (label) label.value = profile?.label || '';
  if (description) description.value = profile?.description || '';
  if (commandTemplate) commandTemplate.value = profile?.commandTemplate || '';
}

function matrixCurrentNmapProfileDraft() {
  return {
    label: document.getElementById('matrixNmapProfileLabel')?.value.trim() || '',
    description: document.getElementById('matrixNmapProfileDescription')?.value.trim() || '',
    commandTemplate: document.getElementById('matrixNmapCommandTemplate')?.value.trim() || '',
  };
}

function matrixSyncMasscanProfileEditor(profile) {
  const label = document.getElementById('matrixMasscanProfileLabel');
  const description = document.getElementById('matrixMasscanProfileDescription');
  const commandTemplate = document.getElementById('matrixMasscanCommandTemplate');
  if (label) label.value = profile?.label || '';
  if (description) description.value = profile?.description || '';
  if (commandTemplate) commandTemplate.value = profile?.commandTemplate || '';
}

function matrixCurrentMasscanProfileDraft() {
  return {
    label: document.getElementById('matrixMasscanProfileLabel')?.value.trim() || '',
    description: document.getElementById('matrixMasscanProfileDescription')?.value.trim() || '',
    commandTemplate: document.getElementById('matrixMasscanCommandTemplate')?.value.trim() || '',
  };
}

function matrixSyncHttpxProfileEditor(profile) {
  const label = document.getElementById('matrixHttpxProfileLabel');
  const description = document.getElementById('matrixHttpxProfileDescription');
  const commandTemplate = document.getElementById('matrixHttpxCommandTemplate');
  if (label) label.value = profile?.label || '';
  if (description) description.value = profile?.description || '';
  if (commandTemplate) commandTemplate.value = profile?.commandTemplate || '';
}

function matrixCurrentHttpxProfileDraft() {
  return {
    label: document.getElementById('matrixHttpxProfileLabel')?.value.trim() || '',
    description: document.getElementById('matrixHttpxProfileDescription')?.value.trim() || '',
    commandTemplate: document.getElementById('matrixHttpxCommandTemplate')?.value.trim() || '',
  };
}

function matrixHasUnsavedNmapProfileChanges() {
  if (!matrixState.selectedNmapProfileId) return false;
  const profile = matrixState.nmapProfiles.find(item => item.id === matrixState.selectedNmapProfileId);
  if (!profile) return false;
  const draft = matrixCurrentNmapProfileDraft();
  return draft.label !== (profile.label || '')
    || draft.description !== (profile.description || '')
    || draft.commandTemplate !== (profile.commandTemplate || '');
}

function matrixHasUnsavedMasscanProfileChanges() {
  if (!matrixState.selectedMasscanProfileId) return false;
  const profile = matrixState.masscanProfiles.find(item => item.id === matrixState.selectedMasscanProfileId);
  if (!profile) return false;
  const draft = matrixCurrentMasscanProfileDraft();
  return draft.label !== (profile.label || '')
    || draft.description !== (profile.description || '')
    || draft.commandTemplate !== (profile.commandTemplate || '');
}

function matrixHasUnsavedHttpxProfileChanges() {
  if (!matrixState.selectedHttpxProfileId) return false;
  const profile = matrixState.httpxProfiles.find(item => item.id === matrixState.selectedHttpxProfileId);
  if (!profile) return false;
  const draft = matrixCurrentHttpxProfileDraft();
  return draft.label !== (profile.label || '')
    || draft.description !== (profile.description || '')
    || draft.commandTemplate !== (profile.commandTemplate || '');
}

function selectMatrixNmapProfile(profileId) {
  matrixState.selectedNmapProfileId = profileId || '';
  const profile = matrixState.nmapProfiles.find(item => item.id === matrixState.selectedNmapProfileId) || null;
  matrixSyncProfileEditor(profile);
}

function selectMatrixMasscanProfile(profileId) {
  matrixState.selectedMasscanProfileId = profileId || '';
  const profile = matrixState.masscanProfiles.find(item => item.id === matrixState.selectedMasscanProfileId) || null;
  matrixSyncMasscanProfileEditor(profile);
}

function selectMatrixHttpxProfile(profileId) {
  matrixState.selectedHttpxProfileId = profileId || '';
  const profile = matrixState.httpxProfiles.find(item => item.id === matrixState.selectedHttpxProfileId) || null;
  matrixSyncHttpxProfileEditor(profile);
}

async function loadMatrixNmapProfiles() {
  const select = document.getElementById('matrixNmapProfileSelect');
  if (!select) return;

  try {
    const response = await fetch('/api/matrix/enumeration/nmap/profiles');
    const data = await response.json();
    if (!response.ok) {
      select.innerHTML = '<option value="">Profiles unavailable</option>';
      matrixState.nmapProfiles = [];
      return;
    }

    const profiles = Array.isArray(data.profiles) ? data.profiles : [];
    matrixState.nmapProfiles = profiles;
    const selected = profiles.find(item => item.id === matrixState.selectedNmapProfileId)
      ? matrixState.selectedNmapProfileId
      : (profiles[0]?.id || '');
    matrixState.selectedNmapProfileId = selected;

    select.innerHTML = [
      '<option value="">New profile</option>',
      ...profiles.map(profile => `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.label)}</option>`),
    ].join('');
    select.value = selected;
    matrixSyncProfileEditor(profiles.find(item => item.id === selected) || null);
  } catch (_) {
    select.innerHTML = '<option value="">Profiles unavailable</option>';
    matrixState.nmapProfiles = [];
  }
}

async function loadMatrixMasscanProfiles() {
  const select = document.getElementById('matrixMasscanProfileSelect');
  if (!select) return;

  try {
    const response = await fetch('/api/matrix/enumeration/masscan/profiles');
    const data = await response.json();
    if (!response.ok) {
      select.innerHTML = '<option value="">Profiles unavailable</option>';
      matrixState.masscanProfiles = [];
      return;
    }

    const profiles = Array.isArray(data.profiles) ? data.profiles : [];
    matrixState.masscanProfiles = profiles;
    const selected = profiles.find(item => item.id === matrixState.selectedMasscanProfileId)
      ? matrixState.selectedMasscanProfileId
      : (profiles[0]?.id || '');
    matrixState.selectedMasscanProfileId = selected;

    select.innerHTML = [
      '<option value="">New profile</option>',
      ...profiles.map(profile => `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.label)}</option>`),
    ].join('');
    select.value = selected;
    matrixSyncMasscanProfileEditor(profiles.find(item => item.id === selected) || null);
  } catch (_) {
    select.innerHTML = '<option value="">Profiles unavailable</option>';
    matrixState.masscanProfiles = [];
  }
}

async function loadMatrixHttpxProfiles() {
  const select = document.getElementById('matrixHttpxProfileSelect');
  if (!select) return;

  try {
    const response = await fetch('/api/matrix/enumeration/httpx/profiles');
    const data = await response.json();
    if (!response.ok) {
      select.innerHTML = '<option value="">Profiles unavailable</option>';
      matrixState.httpxProfiles = [];
      return;
    }

    const profiles = Array.isArray(data.profiles) ? data.profiles : [];
    matrixState.httpxProfiles = profiles;
    const selected = profiles.find(item => item.id === matrixState.selectedHttpxProfileId)
      ? matrixState.selectedHttpxProfileId
      : (profiles[0]?.id || '');
    matrixState.selectedHttpxProfileId = selected;

    select.innerHTML = [
      '<option value="">New profile</option>',
      ...profiles.map(profile => `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.label)}</option>`),
    ].join('');
    select.value = selected;
    matrixSyncHttpxProfileEditor(profiles.find(item => item.id === selected) || null);
  } catch (_) {
    select.innerHTML = '<option value="">Profiles unavailable</option>';
    matrixState.httpxProfiles = [];
  }
}

function newMatrixNmapProfile() {
  matrixState.selectedNmapProfileId = '';
  const select = document.getElementById('matrixNmapProfileSelect');
  if (select) select.value = '';
  matrixSyncProfileEditor(null);
}

function newMatrixMasscanProfile() {
  matrixState.selectedMasscanProfileId = '';
  const select = document.getElementById('matrixMasscanProfileSelect');
  if (select) select.value = '';
  matrixSyncMasscanProfileEditor(null);
}

function newMatrixHttpxProfile() {
  matrixState.selectedHttpxProfileId = '';
  const select = document.getElementById('matrixHttpxProfileSelect');
  if (select) select.value = '';
  matrixSyncHttpxProfileEditor(null);
}

async function saveMatrixNmapProfile() {
  const { label, description, commandTemplate } = matrixCurrentNmapProfileDraft();
  const body = { label, description, commandTemplate, enabled: true };
  const isUpdate = Boolean(matrixState.selectedNmapProfileId);
  const path = isUpdate
    ? `/api/matrix/enumeration/nmap/profiles/${encodeURIComponent(matrixState.selectedNmapProfileId)}`
    : '/api/matrix/enumeration/nmap/profiles';

  const response = await fetch(path, {
    method: isUpdate ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    matrixSetOutput(data);
    return;
  }

  matrixState.selectedNmapProfileId = data.id;
  await loadMatrixNmapProfiles();
  matrixSetOutput({ profile: data, saved: true });
}

async function saveMatrixMasscanProfile() {
  const { label, description, commandTemplate } = matrixCurrentMasscanProfileDraft();
  const body = { label, description, commandTemplate, enabled: true };
  const isUpdate = Boolean(matrixState.selectedMasscanProfileId);
  const path = isUpdate
    ? `/api/matrix/enumeration/masscan/profiles/${encodeURIComponent(matrixState.selectedMasscanProfileId)}`
    : '/api/matrix/enumeration/masscan/profiles';

  const response = await fetch(path, {
    method: isUpdate ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    matrixSetOutput(data);
    return;
  }

  matrixState.selectedMasscanProfileId = data.id;
  await loadMatrixMasscanProfiles();
  matrixSetOutput({ profile: data, saved: true });
}

async function saveMatrixHttpxProfile() {
  const { label, description, commandTemplate } = matrixCurrentHttpxProfileDraft();
  const body = { label, description, commandTemplate, enabled: true };
  const isUpdate = Boolean(matrixState.selectedHttpxProfileId);
  const path = isUpdate
    ? `/api/matrix/enumeration/httpx/profiles/${encodeURIComponent(matrixState.selectedHttpxProfileId)}`
    : '/api/matrix/enumeration/httpx/profiles';

  const response = await fetch(path, {
    method: isUpdate ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    matrixSetOutput(data);
    return;
  }

  matrixState.selectedHttpxProfileId = data.id;
  await loadMatrixHttpxProfiles();
  matrixSetOutput({ profile: data, saved: true });
}

async function deleteMatrixNmapProfile() {
  if (!matrixState.selectedNmapProfileId) {
    matrixSetOutput({ error: 'Select a profile to delete' });
    return;
  }

  const response = await fetch(`/api/matrix/enumeration/nmap/profiles/${encodeURIComponent(matrixState.selectedNmapProfileId)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const data = await response.json();
    matrixSetOutput(data);
    return;
  }

  matrixState.selectedNmapProfileId = '';
  await loadMatrixNmapProfiles();
  matrixSetOutput('Profile deleted.');
}

async function deleteMatrixMasscanProfile() {
  if (!matrixState.selectedMasscanProfileId) {
    matrixSetOutput({ error: 'Select a profile to delete' });
    return;
  }

  const response = await fetch(`/api/matrix/enumeration/masscan/profiles/${encodeURIComponent(matrixState.selectedMasscanProfileId)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const data = await response.json();
    matrixSetOutput(data);
    return;
  }

  matrixState.selectedMasscanProfileId = '';
  await loadMatrixMasscanProfiles();
  matrixSetOutput('Profile deleted.');
}

async function deleteMatrixHttpxProfile() {
  if (!matrixState.selectedHttpxProfileId) {
    matrixSetOutput({ error: 'Select a profile to delete' });
    return;
  }

  const response = await fetch(`/api/matrix/enumeration/httpx/profiles/${encodeURIComponent(matrixState.selectedHttpxProfileId)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const data = await response.json();
    matrixSetOutput(data);
    return;
  }

  matrixState.selectedHttpxProfileId = '';
  await loadMatrixHttpxProfiles();
  matrixSetOutput('Profile deleted.');
}

async function runMatrixEnumeration() {
  const tool = matrixActiveEnumerationTool();
  const runtime = tool === 'masscan'
    ? matrixState.capabilities?.runtime?.masscan
    : tool === 'httpx'
      ? matrixState.capabilities?.runtime?.httpx
      : matrixState.capabilities?.runtime?.nmap;
  if (!runtime?.available) {
    matrixSetOutput({
      error: `${tool === 'masscan' ? 'Masscan' : tool === 'httpx' ? 'httpx' : 'Nmap'} runtime unavailable`,
      detail: runtime?.detail || `Install ${tool} in Toolbox before running enumeration jobs.`,
    });
    return;
  }

  const isNmap = tool === 'nmap';
  const isMasscan = tool === 'masscan';
  const targets = document.getElementById(isNmap ? 'matrixEnumTargets' : isMasscan ? 'matrixEnumTargetsMasscan' : 'matrixEnumTargetsHttpx')?.value || '';
  const name = document.getElementById(isNmap ? 'matrixEnumNaming' : isMasscan ? 'matrixEnumNamingMasscan' : 'matrixEnumNamingHttpx')?.value.trim() || '';
  const profileId = isNmap
    ? (matrixState.selectedNmapProfileId || document.getElementById('matrixNmapProfileSelect')?.value || '')
    : isMasscan
      ? (matrixState.selectedMasscanProfileId || document.getElementById('matrixMasscanProfileSelect')?.value || '')
      : (matrixState.selectedHttpxProfileId || document.getElementById('matrixHttpxProfileSelect')?.value || '');
  if (!profileId) {
    matrixSetOutput({ error: `Select a saved ${isNmap ? 'Nmap' : isMasscan ? 'Masscan' : 'httpx'} profile before running enumeration.` });
    return;
  }
  if (
    (isNmap && matrixHasUnsavedNmapProfileChanges()) ||
    (isMasscan && matrixHasUnsavedMasscanProfileChanges()) ||
    (!isNmap && !isMasscan && matrixHasUnsavedHttpxProfileChanges())
  ) {
    matrixSetOutput({ error: 'Profile has unsaved changes. Save first or discard.' });
    return;
  }
  const body = { text: targets, profileId };
  if (name) body.name = name;

  const path = isNmap
    ? '/api/matrix/enumeration/nmap/run'
    : isMasscan
      ? '/api/matrix/enumeration/masscan/run'
      : '/api/matrix/enumeration/httpx/run';
  matrixSetOutput({ submitting: true, path, body });

  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    matrixSetOutput(data);
    return;
  }

  matrixState.currentJobId = data.id;
  matrixSetOutput(data);
  loadMatrixJobs();
  pollMatrixJob(data.id);
}

function pollMatrixJob(jobId, delay = MATRIX_POLL_INTERVALS.queued) {
  clearTimeout(matrixState.pollTimer);
  matrixState.pollTimer = setTimeout(async () => {
    const response = await fetch(`/api/matrix/jobs/${encodeURIComponent(jobId)}`);
    const job = await response.json();
    matrixSetOutput(job);
    if (job.status === 'queued' || job.status === 'running') {
      const nextDelay = job.status === 'running'
        ? MATRIX_POLL_INTERVALS.running
        : MATRIX_POLL_INTERVALS.queued;
      pollMatrixJob(jobId, nextDelay);
    } else {
      loadMatrixJobs();
    }
  }, delay);
}

async function loadMatrixJobs() {
  const list = matrixActiveJobsListNode();
  if (!list) return;
  const response = await fetch('/api/matrix/jobs?limit=32');
  const data = await response.json();
  if (!response.ok) {
    list.textContent = data.error || 'Could not load Toolbox jobs.';
    return;
  }
  const jobs = (Array.isArray(data.jobs) ? data.jobs : []).filter(job => (
    matrixState.toolboxModule === 'enumeration'
      ? job?.type === 'nmap-enumeration' || job?.type === 'masscan-enumeration' || job?.type === 'httpx-enumeration'
      : job?.type === 'domain-recon' || job?.type === 'ip-recon' || job?.type === 'subdomain-passive-recon'
  )).slice(0, 8);
  if (!jobs.length) {
    list.textContent = matrixState.toolboxModule === 'enumeration'
      ? 'No enumeration jobs yet.'
      : 'No recon jobs yet.';
    return;
  }
  list.innerHTML = jobs.map(job => `
    <button class="matrix-job-item" onclick="openMatrixJob('${job.id}')">
      <span class="matrix-job-item-main">
        <span class="matrix-job-item-type">${escapeHtml(job.name || `${job.targetCount} targets`)}</span>
        <span class="matrix-job-item-meta">${escapeHtml(matrixFormatJobType(job.type))}</span>
      </span>
      <span class="matrix-job-item-status-pill ${matrixJobStatusTone(job.status)}">${escapeHtml(job.status)}</span>
      <span class="matrix-job-item-status-line ${escapeHtml(job.status)}">${escapeHtml(job.status === 'completed'
        ? 'Job completed'
        : job.status === 'failed'
          ? 'Job failed'
          : job.status === 'cancelled'
            ? 'Job cancelled'
            : job.status === 'running'
              ? 'Job running'
              : 'Job queued')}</span>
    </button>
  `).join('');
}

async function openMatrixJob(jobId) {
  matrixState.currentJobId = jobId;
  const [summaryRes, resultRes] = await Promise.all([
    fetch(`/api/matrix/jobs/${encodeURIComponent(jobId)}/summary`),
    fetch(`/api/matrix/jobs/${encodeURIComponent(jobId)}/result`),
  ]);
  const summary = await summaryRes.json();
  const result = await resultRes.json();
  matrixSetOutput({ summary, result });
}

window.initMatrix = initMatrix;
window.onMatrixViewOpen = onMatrixViewOpen;
window.refreshMatrixStatus = refreshMatrixStatus;
window.setMatrixToolboxModule = setMatrixToolboxModule;
window.setMatrixEnumerationTool = setMatrixEnumerationTool;
window.setMatrixMode = setMatrixMode;
window.clearMatrixForm = clearMatrixForm;
window.submitMatrixJob = submitMatrixJob;
window.loadMatrixNmapProfiles = loadMatrixNmapProfiles;
window.selectMatrixNmapProfile = selectMatrixNmapProfile;
window.newMatrixNmapProfile = newMatrixNmapProfile;
window.saveMatrixNmapProfile = saveMatrixNmapProfile;
window.deleteMatrixNmapProfile = deleteMatrixNmapProfile;
window.loadMatrixMasscanProfiles = loadMatrixMasscanProfiles;
window.selectMatrixMasscanProfile = selectMatrixMasscanProfile;
window.newMatrixMasscanProfile = newMatrixMasscanProfile;
window.saveMatrixMasscanProfile = saveMatrixMasscanProfile;
window.deleteMatrixMasscanProfile = deleteMatrixMasscanProfile;
window.loadMatrixHttpxProfiles = loadMatrixHttpxProfiles;
window.selectMatrixHttpxProfile = selectMatrixHttpxProfile;
window.newMatrixHttpxProfile = newMatrixHttpxProfile;
window.saveMatrixHttpxProfile = saveMatrixHttpxProfile;
window.deleteMatrixHttpxProfile = deleteMatrixHttpxProfile;
window.runMatrixEnumeration = runMatrixEnumeration;
window.loadMatrixJobs = loadMatrixJobs;
window.openMatrixJob = openMatrixJob;
window.importMatrixTargets = importMatrixTargets;
window.cancelMatrixJob = cancelMatrixJob;
window.insertMatrixQuickLogPorts = insertMatrixQuickLogPorts;
window.appendMatrixResultToPassiveReconNote = appendMatrixResultToPassiveReconNote;
window.copyMatrixText = async function copyMatrixText(button) {
  const value = button?.dataset?.copy || '';
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    const original = button.textContent;
    button.textContent = 'Copied';
    setTimeout(() => {
      button.textContent = original;
    }, 1200);
  } catch (_) {
    button.textContent = 'Copy failed';
    setTimeout(() => {
      button.textContent = 'Copy';
    }, 1200);
  }
};
