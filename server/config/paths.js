'use strict';

const path = require('path');

function createPaths(rootDir) {
  const KB_DIR = process.env.KB_DIR || path.join(rootDir, 'knowledge_base');
  const matrixUrls = String(process.env.MATRIX_URLS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const defaultMatrixUrl = process.env.MATRIX_URL || 'http://127.0.0.1:3003';
  const MATRIX_URL = matrixUrls[0] || defaultMatrixUrl;
  return {
    PORT: process.env.PORT || 3000,
    HOST: process.env.HOST || '127.0.0.1',
    MATRIX_ENABLED: String(process.env.MATRIX_ENABLED || 'false').toLowerCase() === 'true',
    KB_DIR,
    SERVICES_DIR: path.join(KB_DIR, 'services'),
    TACTICS_DIR: path.join(KB_DIR, 'tactics'),
    PUBLIC_DIR: path.join(rootDir, 'public'),
    DASHBOARD_HTML: path.join(rootDir, 'public', 'app.html'),
    SESSIONS_DIR: process.env.SESSIONS_DIR || path.join(rootDir, 'sessions'),
    TEMPLATES_FILE: path.join(rootDir, 'note-templates.json'),
    SEARCH_URL: process.env.SEARCH_URL || 'http://localhost:3002',
    MATRIX_URL,
    MATRIX_URLS: matrixUrls.length ? matrixUrls : [defaultMatrixUrl],
  };
}

module.exports = { createPaths };
