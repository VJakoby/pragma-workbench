let matrixState = {
  mode: 'domains',
  currentJobId: null,
  pollTimer: null,
  capabilities: null,
};

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
    badge.title = `Matrix // Recon ${label}`;
    badge.setAttribute('aria-label', `Matrix // Recon ${label}`);
  }
}

function matrixSetOutput(value) {
  const node = document.getElementById('matrixOutput');
  if (!node) return;
  node.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

async function initMatrix() {
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
    const [health, capabilities] = await Promise.all([
      fetch('/api/matrix/health').then(r => r.json()),
      fetch('/api/matrix/capabilities').then(r => r.json()),
    ]);
    matrixState.capabilities = capabilities;
    matrixSetStatus('online', 'online');
    if (meta) {
      const version = capabilities?.version ? ` v${capabilities.version}` : '';
      meta.textContent = `Matrix // Recon${version} via PRAGMA proxy`;
    }
  } catch (error) {
    matrixSetStatus('offline', 'offline');
    if (meta) meta.textContent = 'Matrix // Recon unreachable from PRAGMA';
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
  if (targets) targets.placeholder = matrixState.mode === 'domains'
    ? 'example.com\nsub.example.com'
    : '8.8.8.8\n1.1.1.1';
}

function clearMatrixForm() {
  document.getElementById('matrixTargets').value = '';
  document.getElementById('matrixDkimSelectors').value = '';
}

async function submitMatrixJob() {
  const targets = document.getElementById('matrixTargets').value;
  const dkimSelectors = document.getElementById('matrixDkimSelectors').value;
  const path = matrixState.mode === 'ips' ? '/api/matrix/recon/ips' : '/api/matrix/recon/domains';
  const body = { text: targets };
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
    list.textContent = data.error || 'Could not load Matrix // Recon jobs.';
    return;
  }
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  if (!jobs.length) {
    list.textContent = 'No Matrix // Recon jobs yet.';
    return;
  }
  list.innerHTML = jobs.map(job => `
    <button class="matrix-job-item" onclick="openMatrixJob('${job.id}')">
      <span class="matrix-job-item-type">${job.type}</span>
      <span class="matrix-job-item-status ${job.status}">${job.status}</span>
      <span class="matrix-job-item-meta">${job.targetCount} targets</span>
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
