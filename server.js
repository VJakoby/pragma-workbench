'use strict';

const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  let raw = '';
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return;
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const key = match[1];
    if (Object.prototype.hasOwnProperty.call(process.env, key)) continue;

    let value = match[2] || '';
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, '.env'));

require('./server/index.js');
