let matrixState = {
  toolboxModule: 'passive',
  mode: 'domains',
  currentJobId: null,
  pollTimer: null,
  capabilities: null,
  nmapProfiles: [],
  selectedNmapProfileId: '',
  enumerationTool: 'nmap',
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
  const dot = document.getElementById('matrix-status-dot');
  const versionLabel = document.getElementById('matrixVersionLabel');
  const version = matrixState.capabilities?.version ? `v${matrixState.capabilities.version}` : '';
  if (pill) {
    pill.textContent = label;
    pill.className = `matrix-service-pill ${state || ''}`.trim();
    pill.title = '';
    pill.setAttribute('aria-label', `MATRIX status ${label}`);
  }
  if (versionLabel) {
    versionLabel.textContent = version;
  }
  if (badge) {
    badge.textContent = '';
    badge.className = `nav-item-count matrix-nav-status ${state || ''}`.trim();
    badge.title = version || `MATRIX ${label}`;
    badge.setAttribute('aria-label', version ? `MATRIX ${label} ${version}` : `MATRIX ${label}`);
  }
  if (dot) {
    dot.className = `nav-item-service-dot ${state || ''}`.trim();
    dot.title = version || `MATRIX ${label}`;
    dot.setAttribute('aria-label', version ? `MATRIX ${label} ${version}` : `MATRIX ${label}`);
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
    'nmap-enumeration': 'Active Enumeration',
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
  return document.getElementById(matrixState.toolboxModule === 'enumeration'
    ? 'matrixEnumTargets'
    : 'matrixTargets');
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
  if (tool === 'masscan') return 'Masscan is not wired into MATRIX yet.';
  if (tool === 'ffuf') return 'ffuf is not wired into MATRIX yet.';
  return 'Run an enumeration job.';
}

function matrixJobStatusTone(status) {
  if (status === 'completed') return 'ok';
  if (status === 'failed') return 'bad';
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
    ['Sources Used', Array.isArray(discovery.sourcesUsed) && discovery.sourcesUsed.length ? discovery.sourcesUsed.join(', ') : 'None'],
    ['Returned', String(discovery.returnedCount || 0)],
    ['Total Discovered', String(discovery.totalDiscovered || 0)],
  ];
  const hostList = hostnames.length
    ? hostnames.map(item => `| ${matrixMarkdownCell(item.hostname || '')} | ${matrixMarkdownCell(Array.isArray(item.sources) ? item.sources.join(', ') : 'crtsh')} |`).join('\n')
    : '| None | N/A |';
  return `${header}\n\n${matrixBuildMarkdownTable(rows)}\n\n| Hostname | Source |\n| --- | --- |\n${hostList}`;
}

function matrixReconMarkdown(result) {
  if (result?.kind === 'domain') return matrixBuildDomainMarkdown(result);
  if (result?.kind === 'ip') return matrixBuildIpMarkdown(result);
  if (result?.kind === 'subdomain-discovery') return matrixBuildSubdomainMarkdown(result);
  return '';
}

function matrixCopyMarkdownAction(result) {
  const markdown = matrixReconMarkdown(result);
  if (!markdown) return '';
  return `
    <div class="matrix-export-row">
      <div class="matrix-export-copy">Copy a compact markdown summary for manual note insertion.</div>
      <button class="tb-btn matrix-copy-btn matrix-markdown-btn" type="button" onclick="copyMatrixText(this)" data-copy="${matrixEscapeAttribute(markdown)}">Copy Note Markdown</button>
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
          ${matrixStatusChip('crt.sh', 'neutral')}
        </div>
      </div>

      <div class="matrix-result-body">
      ${matrixCopyMarkdownAction(result)}
      <div class="matrix-section-grid">
        ${matrixRenderSection('Discovery', 'resolution', `
          ${matrixRenderKv('Root Domain', result.rootDomain || result.normalized || 'N/A')}
          ${matrixRenderKv('Mode', discovery.passive ? 'Passive' : 'N/A')}
          ${matrixRenderKv('Sources Used', Array.isArray(discovery.sourcesUsed) && discovery.sourcesUsed.length ? discovery.sourcesUsed.join(', ') : 'None')}
          ${matrixRenderKv('Returned', String(discovery.returnedCount || 0))}
          ${matrixRenderKv('Total Discovered', String(discovery.totalDiscovered || 0))}
          ${matrixRenderKv('Truncated', discovery.truncated ? 'Yes' : 'No')}
        `)}

        ${matrixRenderSection('Source Detail', 'source', `
          ${matrixRenderKv('Primary Source', 'crt.sh')}
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
                  <div class="matrix-subdomain-meta">${escapeHtml(Array.isArray(item.sources) ? item.sources.join(', ') : 'crtsh')}</div>
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
  const fallbackTitle = job?.type === 'nmap-enumeration'
    ? 'MATRIX // Active Enumeration'
    : 'MATRIX // Passive Recon';
  const targetCount = Array.isArray(job?.input?.targets) && job.input.targets.length
    ? job.input.targets.length
    : (Object.prototype.hasOwnProperty.call(counts, 'Targets') ? counts.Targets : 0);
  const overviewSubtitle = job?.type === 'nmap-enumeration'
    ? (job?.input?.profileLabel || 'Nmap Scan')
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
          ${job?.type === 'nmap-enumeration'
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

function matrixRenderEnumerationResult(job, resultEnvelope) {
  const result = resultEnvelope || {};
  const command = result.command || {};
  const execution = result.execution || {};
  const output = result.output || {};
  const isRunning = job?.status === 'queued' || job?.status === 'running';
  const statusTone = job?.status === 'completed' ? 'ok' : (job?.status === 'failed' ? 'bad' : 'warn');
  const commandLabel = command.rendered || (isRunning ? 'Execution in progress' : 'Command unavailable');
  const targetsLabel = Array.isArray(result.targets) && result.targets.length
    ? result.targets.join(', ')
    : (Array.isArray(job?.input?.targets) && job.input.targets.length ? job.input.targets.join(', ') : 'N/A');

  return `
    <section class="matrix-result-card matrix-result-card--generic">
      <div class="matrix-result-head matrix-result-top">
        <div>
          <div class="matrix-result-title">${escapeHtml(result.profile?.label || job?.input?.profileLabel || 'Nmap')}</div>
        </div>
        <div class="matrix-chip-row">
          ${matrixStatusChip(job?.status || 'unknown', statusTone)}
          ${!isRunning && execution.exitCode != null ? matrixStatusChip(execution.exitCode === 0 ? 'success' : `exit ${execution.exitCode}`, execution.exitCode === 0 ? 'ok' : 'warn') : ''}
          ${execution.timedOut ? matrixStatusChip('timed out', 'bad') : ''}
        </div>
      </div>
      <div class="matrix-result-body">
        <div class="matrix-section-grid">
          ${matrixRenderSection('Command', 'resolution', `
            ${matrixRenderKv('Profile', result.profile?.label || job?.input?.profileLabel || 'N/A')}
            ${matrixRenderKv('Targets', targetsLabel)}
            ${matrixRenderKv('Command', command.rendered || (isRunning ? 'Waiting for Nmap to complete' : 'N/A'))}
          `)}
          ${matrixRenderSection('Execution', 'counts', `
            ${matrixRenderKv('Status', job?.status || 'unknown')}
            ${matrixRenderKv('Exit Code', isRunning ? 'Pending' : (execution.exitCode == null ? 'N/A' : String(execution.exitCode)))}
            ${matrixRenderKv('Signal', isRunning ? 'Pending' : (execution.signal || 'None'))}
            ${matrixRenderKv('Timed Out', execution.timedOut ? 'Yes' : (isRunning ? 'Pending' : 'No'))}
          `)}
        </div>
        ${output.stdout ? `
          <section class="matrix-section matrix-section--neutral matrix-section-status--neutral">
            <div class="matrix-section-top">NMAP OUTPUT</div>
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
                ? (document.getElementById('matrixEnumNaming')?.value.trim() || 'MATRIX // Active Enumeration')
                : (document.getElementById('matrixNaming')?.value.trim() || 'MATRIX // Passive Recon')
            )}</div>
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
  if ((base?.type || summary?.type) === 'nmap-enumeration' || resultEnvelope?.command?.rendered) {
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
        ? (document.getElementById('matrixEnumNaming')?.value.trim() || null)
        : (document.getElementById('matrixNaming')?.value.trim() || null),
      mode: matrixState.toolboxModule === 'enumeration' ? 'nmap-enumeration' : matrixState.mode,
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
  setMatrixToolboxModule(matrixState.toolboxModule);
  setMatrixMode(matrixState.mode);
  document.getElementById('matrixImportFile')?.addEventListener('change', onMatrixFileSelected);
  document.getElementById('matrixTargets')?.addEventListener('keydown', onMatrixTargetsKeydown);
  document.getElementById('matrixEnumTargets')?.addEventListener('keydown', onMatrixTargetsKeydown);
  setMatrixEnumerationTool(matrixState.enumerationTool);
  await Promise.allSettled([
    refreshMatrixStatus(),
    loadMatrixJobs(),
    loadMatrixNmapProfiles(),
  ]);
}

function onMatrixViewOpen() {
  refreshMatrixStatus();
  loadMatrixJobs();
}

function setMatrixEnumerationTool(toolName) {
  const allowed = ['nmap', 'masscan', 'ffuf'];
  matrixState.enumerationTool = allowed.includes(toolName) ? toolName : 'nmap';
  const select = document.getElementById('matrixEnumToolSelect');
  if (select) select.value = matrixState.enumerationTool;
  document.getElementById('matrixEnumToolNmap')?.toggleAttribute('hidden', matrixState.enumerationTool !== 'nmap');
  document.getElementById('matrixEnumToolMasscan')?.toggleAttribute('hidden', matrixState.enumerationTool !== 'masscan');
  document.getElementById('matrixEnumToolFfuf')?.toggleAttribute('hidden', matrixState.enumerationTool !== 'ffuf');
  if (matrixState.toolboxModule === 'enumeration') {
    const output = matrixActiveOutputNode();
    if (output) output.textContent = matrixEnumerationDefaultOutputMessage();
  }
}

function setMatrixToolboxModule(moduleName) {
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
  if (toolbarModuleLabel) toolbarModuleLabel.textContent = '// Toolbox';

  const output = matrixActiveOutputNode();
  if (output) {
    output.textContent = matrixDefaultOutputMessage();
  }

  if (matrixState.toolboxModule === 'enumeration') {
    setMatrixEnumerationTool(matrixState.enumerationTool);
    if (matrixActiveEnumerationTool() === 'nmap') loadMatrixNmapProfiles();
  }

  loadMatrixJobs();
}

async function refreshMatrixStatus() {
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
    matrixSetEnumCapability(capabilities?.runtime?.nmap?.available
      ? `Nmap available${capabilities.runtime.nmap.version ? ` • ${capabilities.runtime.nmap.version}` : ''}`
      : `Nmap unavailable${capabilities?.runtime?.nmap?.detail ? ` • ${capabilities.runtime.nmap.detail}` : ''}`);
    matrixSetStatus('online', 'online');
  } catch (error) {
    matrixState.capabilities = null;
    matrixSetEnumCapability('MATRIX unavailable');
    matrixSetStatus('offline', 'offline');
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
    if (matrixActiveEnumerationTool() !== 'nmap') return;
    const naming = document.getElementById('matrixEnumNaming');
    const targets = document.getElementById('matrixEnumTargets');
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

function matrixHasUnsavedNmapProfileChanges() {
  if (!matrixState.selectedNmapProfileId) return false;
  const profile = matrixState.nmapProfiles.find(item => item.id === matrixState.selectedNmapProfileId);
  if (!profile) return false;
  const draft = matrixCurrentNmapProfileDraft();
  return draft.label !== (profile.label || '')
    || draft.description !== (profile.description || '')
    || draft.commandTemplate !== (profile.commandTemplate || '');
}

function selectMatrixNmapProfile(profileId) {
  matrixState.selectedNmapProfileId = profileId || '';
  const profile = matrixState.nmapProfiles.find(item => item.id === matrixState.selectedNmapProfileId) || null;
  matrixSyncProfileEditor(profile);
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

function newMatrixNmapProfile() {
  matrixState.selectedNmapProfileId = '';
  const select = document.getElementById('matrixNmapProfileSelect');
  if (select) select.value = '';
  matrixSyncProfileEditor(null);
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

async function runMatrixEnumeration() {
  if (matrixActiveEnumerationTool() !== 'nmap') {
    matrixSetOutput({ error: `${matrixActiveEnumerationTool()} is not wired into MATRIX yet.` });
    return;
  }
  if (!matrixState.capabilities?.runtime?.nmap?.available) {
    matrixSetOutput({
      error: 'Nmap runtime unavailable',
      detail: matrixState.capabilities?.runtime?.nmap?.detail || 'Install nmap in MATRIX before running enumeration jobs.',
    });
    return;
  }

  const targets = document.getElementById('matrixEnumTargets')?.value || '';
  const name = document.getElementById('matrixEnumNaming')?.value.trim() || '';
  const profileId = matrixState.selectedNmapProfileId || document.getElementById('matrixNmapProfileSelect')?.value || '';
  if (!profileId) {
    matrixSetOutput({ error: 'Select a saved Nmap profile before running enumeration.' });
    return;
  }
  if (matrixHasUnsavedNmapProfileChanges()) {
    matrixSetOutput({ error: 'Profile has unsaved changes. Save first or discard.' });
    return;
  }
  const body = { text: targets, profileId };
  if (name) body.name = name;

  matrixSetOutput({ submitting: true, path: '/api/matrix/enumeration/nmap/run', body });

  const response = await fetch('/api/matrix/enumeration/nmap/run', {
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
  const list = matrixActiveJobsListNode();
  if (!list) return;
  const type = matrixState.toolboxModule === 'enumeration'
    ? 'nmap-enumeration'
    : '';
  const suffix = type ? `?limit=16&type=${encodeURIComponent(type)}` : '?limit=32';
  const response = await fetch(`/api/matrix/jobs${suffix}`);
  const data = await response.json();
  if (!response.ok) {
    list.textContent = data.error || 'Could not load MATRIX Toolbox jobs.';
    return;
  }
  const jobs = (Array.isArray(data.jobs) ? data.jobs : []).filter(job => (
    matrixState.toolboxModule === 'enumeration'
      ? job?.type === 'nmap-enumeration'
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
window.runMatrixEnumeration = runMatrixEnumeration;
window.loadMatrixJobs = loadMatrixJobs;
window.openMatrixJob = openMatrixJob;
window.importMatrixTargets = importMatrixTargets;
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
