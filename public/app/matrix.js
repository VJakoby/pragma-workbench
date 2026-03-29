let matrixState = {
  mode: 'domains',
  currentJobId: null,
  pollTimer: null,
  capabilities: null,
};

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
  if (pill) {
    pill.textContent = label;
    pill.className = `matrix-service-pill ${state || ''}`.trim();
  }
  if (badge) {
    badge.textContent = '';
    badge.className = `nav-item-count matrix-nav-status ${state || ''}`.trim();
    badge.title = `MATRIX // Recon ${label}`;
    badge.setAttribute('aria-label', `MATRIX // Recon ${label}`);
  }
}

function matrixStatusChip(label, tone = 'neutral') {
  return `<span class="matrix-chip ${tone}">${escapeHtml(label)}</span>`;
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

function matrixRenderSection(title, tone, content) {
  return `
    <section class="matrix-section matrix-section--${tone}">
      <div class="matrix-section-top">${escapeHtml(title)}</div>
      <div class="matrix-section-body">${content}</div>
    </section>
  `;
}

function matrixRenderDomainResult(result) {
  const dns = result?.dns || {};
  const email = result?.emailSecurity || {};
  const dkim = email?.dkim || {};
  const tls = result?.transportSecurity?.tls || {};
  const cert = tls?.certificate || {};
  const expiryDays = matrixDaysUntil(cert.validTo);
  const dkimFlags = [];
  if (dkim.status) dkimFlags.push(dkim.status);
  if (dkim.wildcardSuspected) dkimFlags.push('wildcard suspected');

  return `
    <section class="matrix-result-card matrix-result-card--domain">
      <div class="matrix-result-head matrix-result-top">
        <div>
          <div class="matrix-result-title">${escapeHtml(result.normalized || result.target || 'Domain')}</div>
          <div class="matrix-result-subtitle">${escapeHtml(result.target || '')}</div>
        </div>
        <div class="matrix-chip-row">
          ${matrixStatusChip(result.valid ? 'valid' : 'invalid', result.valid ? 'ok' : 'bad')}
          ${matrixStatusChip(result.resolved ? 'resolved' : 'unresolved', result.resolved ? 'ok' : 'warn')}
          ${matrixStatusChip(email.acceptsMail === false ? 'no mail' : 'mail', email.acceptsMail === false ? 'warn' : 'neutral')}
        </div>
      </div>

      <div class="matrix-result-body">
      <div class="matrix-section-grid">
        ${matrixRenderSection('Resolution', 'resolution', `
          ${matrixRenderKv('IPv4', Array.isArray(dns.a) && dns.a.length ? dns.a.join(', ') : 'None')}
          ${matrixRenderKv('IPv6', Array.isArray(dns.aaaa) && dns.aaaa.length ? dns.aaaa.join(', ') : 'None')}
          ${matrixRenderKv('CNAME', Array.isArray(dns.cname) && dns.cname.length ? dns.cname.join(', ') : 'None')}
          ${matrixRenderKv('Nameservers', Array.isArray(dns.ns) && dns.ns.length ? dns.ns.join(', ') : 'None')}
          ${matrixRenderKv('MX', Array.isArray(dns.mx) && dns.mx.some(item => item?.isNullMx) ? 'Null MX' : (Array.isArray(dns.mx) && dns.mx.length ? dns.mx.map(item => `${item.exchange || 'unknown'}${Number.isFinite(item.priority) ? ` (${item.priority})` : ''}`).join(', ') : 'None'))}
        `)}

        ${matrixRenderSection('Email Security', 'email', `
          ${matrixRenderKv('SPF', Array.isArray(email.spf) && email.spf.length ? email.spf.join(' | ') : 'None')}
          ${matrixRenderKv('DMARC', Array.isArray(email.dmarc) && email.dmarc.length ? email.dmarc.join(' | ') : 'None')}
          ${matrixRenderKv('DKIM', dkimFlags.length ? dkimFlags.join(', ') : 'Not found')}
          ${matrixRenderKv('Selectors Checked', Array.isArray(dkim.selectorsChecked) ? String(dkim.selectorsChecked.length) : '0')}
        `)}

        ${matrixRenderSection('TLS', 'tls', `
          ${matrixRenderKv('Status', tls.status || 'Unknown')}
          ${matrixRenderKv('Protocol', tls.protocol || 'N/A')}
          ${matrixRenderKv('Issuer', cert?.issuer?.CN || cert?.issuer?.O || 'N/A')}
          ${matrixRenderKv('Subject CN', cert?.subject?.CN || 'N/A')}
          ${matrixRenderKv('Certificate Expiry', cert.validTo || 'N/A')}
          ${matrixRenderKv('Days Remaining', expiryDays == null ? 'N/A' : String(expiryDays))}
        `)}
      </div>

      ${matrixRenderSection('Highlights', 'highlights', `
        <div class="matrix-pill-row">${matrixJoinList(dns.ns || [])}</div>
        <div class="matrix-pill-row">${matrixFormatMx(dns.mx)}</div>
      `)}

      ${Array.isArray(dkim.records) && dkim.records.length ? `
        ${matrixRenderSection('DKIM Records', 'dkim', `<div class="matrix-kv-list">${matrixExtractDkimRows(dkim)}</div>`)}
      ` : ''}

      ${(cert.subjectAltName || tls.cipher?.name) ? `
        ${matrixRenderSection('Certificate Details', 'certificate', `
          <div class="matrix-kv-list">
            ${matrixRenderKv('SAN', cert.subjectAltName || 'N/A')}
            ${matrixRenderKv('Cipher', tls.cipher?.standardName || tls.cipher?.name || 'N/A')}
            ${matrixRenderKv('Valid From', cert.validFrom || 'N/A')}
          </div>
        `)}
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

function matrixRenderJobOverview(job) {
  const counts = job?.result?.counts || {};
  const jobName = job?.input?.name || job?.name || '';
  return `
    <section class="matrix-result-card matrix-result-card--job">
      <div class="matrix-result-head matrix-result-top">
        <div>
          <div class="matrix-result-title">${escapeHtml(jobName || 'MATRIX // Recon')}</div>
          <div class="matrix-result-subtitle">${escapeHtml(job.type || 'matrix-job')} • Job ${escapeHtml(job.id || '')}</div>
        </div>
        <div class="matrix-chip-row">
          ${matrixStatusChip(job.status || 'unknown', job.status === 'completed' ? 'ok' : (job.status === 'failed' ? 'bad' : 'warn'))}
          ${job.completedAt ? matrixStatusChip('complete', 'ok') : ''}
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
          ${Object.keys(counts).length ? Object.entries(counts).map(([key, value]) => matrixRenderKv(key, String(value))).join('') : matrixRenderKv('Targets', String(job.input?.targets?.length || 0))}
        `)}
      </div>
      </div>
    </section>
  `;
}

function matrixRenderRaw(value) {
  return `
    <details class="matrix-raw-details">
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
            <div class="matrix-result-title">Submitting ${escapeHtml(document.getElementById('matrixNaming')?.value.trim() || 'MATRIX // Recon')}</div>
            <div class="matrix-result-subtitle">Waiting for MATRIX to queue the job</div>
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
  if (results.length) {
    html += results.map(item => {
      if (item.kind === 'domain') return matrixRenderDomainResult(item);
      if (item.kind === 'ip') return matrixRenderIpResult(item);
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
  const node = document.getElementById('matrixOutput');
  if (!node) return;
  node.innerHTML = matrixRenderPayload(value);
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
        .map(item => item?.normalized || item?.target || '')
        .map(item => String(item || '').trim())
        .filter(Boolean);
    }
    if (Array.isArray(parsed?.results)) {
      return parsed.results
        .map(item => item?.normalized || item?.target || '')
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
    const textarea = document.getElementById('matrixTargets');
    if (textarea) {
      textarea.value = targets.length ? targets.join('\n') : text;
    }
    matrixSetOutput({
      imported: true,
      filename: file.name,
      detectedTargets: targets.length,
      name: document.getElementById('matrixNaming')?.value.trim() || null,
      mode: matrixState.mode,
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
  setMatrixMode(matrixState.mode);
  document.getElementById('matrixImportFile')?.addEventListener('change', onMatrixFileSelected);
  document.getElementById('matrixTargets')?.addEventListener('keydown', onMatrixTargetsKeydown);
  await Promise.allSettled([
    refreshMatrixStatus(),
    loadMatrixJobs(),
  ]);
}

function onMatrixViewOpen() {
  refreshMatrixStatus();
  loadMatrixJobs();
}

async function refreshMatrixStatus() {
  const meta = document.getElementById('matrixToolbarMeta');
  try {
    const [healthResponse, capabilitiesResponse] = await Promise.all([
      fetch('/api/matrix/health'),
      fetch('/api/matrix/capabilities'),
    ]);
    if (!healthResponse.ok || !capabilitiesResponse.ok) throw new Error('MATRIX proxy unavailable');
    const [health, capabilities] = await Promise.all([
      healthResponse.json(),
      capabilitiesResponse.json(),
    ]);
    if (!health?.ok || capabilities?.service !== 'matrix') throw new Error('MATRIX service unavailable');
    matrixState.capabilities = capabilities;
    matrixSetStatus('online', 'online');
    if (meta) {
      const version = capabilities?.version ? ` v${capabilities.version}` : '';
      meta.textContent = `Online${version ? ` • v${capabilities.version}` : ''}`;
    }
  } catch (error) {
    matrixSetStatus('offline', 'offline');
    if (meta) meta.textContent = 'Offline';
  }
}

function setMatrixMode(mode) {
  matrixState.mode = mode === 'ips' ? 'ips' : 'domains';
  document.getElementById('matrixModeDomains')?.classList.toggle('active', matrixState.mode === 'domains');
  document.getElementById('matrixModeIps')?.classList.toggle('active', matrixState.mode === 'ips');
  const dkimLabel = document.getElementById('matrixDkimLabel');
  const dkimInput = document.getElementById('matrixDkimSelectors');
  const targetsLabel = document.getElementById('matrixTargetsLabel');
  const targets = document.getElementById('matrixTargets');
  if (dkimLabel) dkimLabel.style.display = matrixState.mode === 'domains' ? '' : 'none';
  if (dkimInput) {
    dkimInput.style.display = matrixState.mode === 'domains' ? '' : 'none';
    dkimInput.disabled = matrixState.mode !== 'domains';
  }
  if (targetsLabel) targetsLabel.textContent = matrixState.mode === 'domains' ? 'Domains' : 'IP Addresses';
  if (targets) {
    targets.placeholder = matrixState.mode === 'domains'
      ? 'example.com\nsub.example.com'
      : '8.8.8.8\n1.1.1.1';
  }
}

function clearMatrixForm() {
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
  const path = matrixState.mode === 'ips' ? '/api/matrix/recon/ips' : '/api/matrix/recon/domains';
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

function pollMatrixJob(jobId) {
  clearTimeout(matrixState.pollTimer);
  matrixState.pollTimer = setTimeout(async () => {
    const response = await fetch(`/api/matrix/jobs/${encodeURIComponent(jobId)}`);
    const job = await response.json();
    matrixSetOutput(job);
    if (job.status === 'queued' || job.status === 'running') {
      pollMatrixJob(jobId);
    } else {
      loadMatrixJobs();
    }
  }, 1200);
}

async function loadMatrixJobs() {
  const list = document.getElementById('matrixJobsList');
  if (!list) return;
  const response = await fetch('/api/matrix/jobs?limit=8');
  const data = await response.json();
  if (!response.ok) {
    list.textContent = data.error || 'Could not load MATRIX // Recon jobs.';
    return;
  }
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  if (!jobs.length) {
    list.textContent = 'No MATRIX // Recon jobs yet.';
    return;
  }
  list.innerHTML = jobs.map(job => `
    <button class="matrix-job-item" onclick="openMatrixJob('${job.id}')">
      <span class="matrix-job-item-type">${escapeHtml(job.type)}</span>
      <span class="matrix-job-item-status ${escapeHtml(job.status)}">${escapeHtml(job.status)}</span>
      <span class="matrix-job-item-meta">${escapeHtml(job.name || `${job.targetCount} targets`)}</span>
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
window.setMatrixMode = setMatrixMode;
window.clearMatrixForm = clearMatrixForm;
window.submitMatrixJob = submitMatrixJob;
window.loadMatrixJobs = loadMatrixJobs;
window.openMatrixJob = openMatrixJob;
window.importMatrixTargets = importMatrixTargets;
