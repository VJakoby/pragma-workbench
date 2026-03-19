'use strict';

const path = require('path');

function createPaths(rootDir) {
  const KB_DIR = process.env.KB_DIR || path.join(rootDir, 'knowledge_base');
  return {
    PORT: process.env.PORT || 3000,
    KB_DIR,
    SERVICES_DIR: path.join(KB_DIR, 'services'),
    TACTICS_DIR: path.join(KB_DIR, 'tactics'),
    PUBLIC_DIR: path.join(rootDir, 'public'),
    DASHBOARD_HTML: path.join(rootDir, 'public', 'app.html'),
    SESSIONS_DIR: process.env.SESSIONS_DIR || path.join(rootDir, 'sessions'),
    TEMPLATES_FILE: path.join(rootDir, 'notes-templates.json'),
    SEARCH_URL: process.env.SEARCH_URL || 'http://localhost:3002',
  };
}

module.exports = { createPaths };
