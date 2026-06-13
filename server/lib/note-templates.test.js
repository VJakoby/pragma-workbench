'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  loadTemplateFile,
  parseTemplateDocument,
  writeTemplateFileAtomic,
} = require('./note-templates');

async function withTemplateFile(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pragma-note-templates-'));
  const templatesFile = path.join(dir, 'note-templates.json');
  try {
    return await run({ dir, templatesFile });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('validates supported template and variant fields', () => {
  const parsed = parseTemplateDocument(JSON.stringify({
    templates: [{
      id: 'custom',
      label: 'Custom',
      default_tags: ['custom'],
      body_lines: ['## Notes'],
      variants: [{
        id: 'short',
        label: 'Short',
        body: '## Short',
      }],
    }],
  }), 'custom.json');

  assert.equal(parsed.ok, true);
});

test('rejects malformed templates and duplicate ids within a file', () => {
  const missingBody = parseTemplateDocument(JSON.stringify({
    templates: [{ id: 'missing-body' }],
  }), 'missing-body.json');
  const duplicate = parseTemplateDocument(JSON.stringify({
    templates: [
      { id: 'duplicate', body: 'one' },
      { id: 'duplicate', body: 'two' },
    ],
  }), 'duplicate.json');
  const numericId = parseTemplateDocument(JSON.stringify({
    templates: [{ id: 123, body: 'invalid id' }],
  }), 'numeric-id.json');

  assert.equal(missingBody.ok, false);
  assert.match(missingBody.errors.join('; '), /must define body or body_lines/);
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.errors.join('; '), /duplicates "duplicate"/);
  assert.equal(numericId.ok, false);
  assert.match(numericId.errors.join('; '), /id must be a non-empty string/);
});

test('atomically replaces and reloads the active template file', async () => {
  await withTemplateFile(async ({ templatesFile }) => {
    fs.writeFileSync(templatesFile, JSON.stringify({
      templates: [{ id: 'before', body: 'before' }],
    }));
    const replacement = {
      templates: [
        { id: 'oscp', body_lines: ['## OSCP'] },
        { id: 'credentials', body: 'replacement credentials' },
      ],
    };

    const normalized = await writeTemplateFileAtomic(templatesFile, replacement);
    const loaded = loadTemplateFile(templatesFile);

    assert.equal(loaded.ok, true);
    assert.deepEqual(loaded.templates.map((template) => template.id), ['oscp', 'credentials']);
    assert.equal(loaded.content, normalized);
    assert.deepEqual(fs.readdirSync(path.dirname(templatesFile)), ['note-templates.json']);
  });
});

test('invalid content can be rejected before the active file is changed', async () => {
  await withTemplateFile(({ templatesFile }) => {
    const original = JSON.stringify({
      templates: [{ id: 'original', body: 'original' }],
    });
    fs.writeFileSync(templatesFile, original);

    const parsed = parseTemplateDocument(JSON.stringify({
      templates: [{ id: 'invalid' }],
    }), 'invalid.json');

    assert.equal(parsed.ok, false);
    assert.equal(fs.readFileSync(templatesFile, 'utf8'), original);
  });
});
