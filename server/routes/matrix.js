'use strict';

function registerMatrixRoutes(app, { matrixUrl }) {
  async function fetchWithTimeout(url, opts = {}, timeoutMs = 8000) {
    if (typeof fetch !== 'undefined') {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, { ...opts, signal: controller.signal });
        clearTimeout(timer);
        const text = await response.text();
        return {
          ok: response.ok,
          status: response.status,
          json: async () => { try { return JSON.parse(text); } catch { return {}; } },
        };
      } catch (error) {
        clearTimeout(timer);
        throw error;
      }
    }

    return new Promise((resolve, reject) => {
      const http = require('http');
      const target = new URL(url);
      const body = opts.body || null;
      const request = http.request({
        hostname: target.hostname,
        port: Number.parseInt(target.port, 10) || 80,
        path: `${target.pathname}${target.search || ''}`,
        method: opts.method || 'GET',
        timeout: timeoutMs,
        headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      }, (response) => {
        let data = '';
        response.on('data', chunk => { data += chunk; });
        response.on('end', () => resolve({
          ok: response.statusCode < 400,
          status: response.statusCode,
          json: async () => { try { return JSON.parse(data); } catch { return {}; } },
        }));
      });
      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('MATRIX request timed out'));
      });
      if (body) request.write(body);
      request.end();
    });
  }

  async function proxyJson(res, path, opts = {}, timeoutMs = 8000) {
    try {
      const response = await fetchWithTimeout(`${matrixUrl}${path}`, opts, timeoutMs);
      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status || 502).json({
          error: data.error || 'MATRIX request failed',
          detail: data.detail || null,
        });
      }
      return res.json(data);
    } catch (error) {
      console.warn(`[PRAGMA] MATRIX proxy error: ${error.message}`);
      return res.status(502).json({ error: 'MATRIX unreachable', detail: error.message });
    }
  }

  app.get('/api/matrix/health', async (req, res) => {
    void req;
    return proxyJson(res, '/healthz', {}, 4000);
  });

  app.get('/api/matrix/capabilities', async (req, res) => {
    return proxyJson(res, '/api/capabilities', {}, 5000);
  });

  app.get('/api/matrix/schema', async (req, res) => {
    return proxyJson(res, '/api/schema', {}, 5000);
  });

  app.get('/api/matrix/jobs', async (req, res) => {
    const query = new URLSearchParams();
    ['type', 'status', 'limit'].forEach(key => {
      if (typeof req.query[key] === 'string' && req.query[key].trim()) query.set(key, req.query[key].trim());
    });
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return proxyJson(res, `/api/jobs${suffix}`);
  });

  app.get('/api/matrix/jobs/:id', async (req, res) => {
    return proxyJson(res, `/api/jobs/${encodeURIComponent(req.params.id)}`);
  });

  app.get('/api/matrix/jobs/:id/summary', async (req, res) => {
    return proxyJson(res, `/api/jobs/${encodeURIComponent(req.params.id)}/summary`);
  });

  app.get('/api/matrix/jobs/:id/result', async (req, res) => {
    return proxyJson(res, `/api/jobs/${encodeURIComponent(req.params.id)}/result`);
  });

  app.post('/api/matrix/recon/domains', async (req, res) => {
    return proxyJson(res, '/api/recon/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {}),
    });
  });

  app.post('/api/matrix/recon/ips', async (req, res) => {
    return proxyJson(res, '/api/recon/ips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {}),
    });
  });

  app.post('/api/matrix/recon/subdomains', async (req, res) => {
    return proxyJson(res, '/api/recon/subdomains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {}),
    }, 12000);
  });

  app.get('/api/matrix/enumeration/nmap/profiles', async (req, res) => {
    return proxyJson(res, '/api/enumeration/nmap/profiles', {}, 5000);
  });

  app.post('/api/matrix/enumeration/nmap/profiles', async (req, res) => {
    return proxyJson(res, '/api/enumeration/nmap/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {}),
    }, 8000);
  });

  app.put('/api/matrix/enumeration/nmap/profiles/:id', async (req, res) => {
    return proxyJson(res, `/api/enumeration/nmap/profiles/${encodeURIComponent(req.params.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {}),
    }, 8000);
  });

  app.delete('/api/matrix/enumeration/nmap/profiles/:id', async (req, res) => {
    return proxyJson(res, `/api/enumeration/nmap/profiles/${encodeURIComponent(req.params.id)}`, {
      method: 'DELETE',
    }, 8000);
  });

  app.post('/api/matrix/enumeration/nmap/run', async (req, res) => {
    return proxyJson(res, '/api/enumeration/nmap/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {}),
    }, 15000);
  });
}

module.exports = { registerMatrixRoutes };
