'use strict';

const fs = require('fs');
const path = require('path');

function validateStringArray(value, field, errors) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    errors.push(`${field} must be an array of strings`);
  }
}

function validateBody(value, field, errors) {
  if (value.body !== undefined && typeof value.body !== 'string') {
    errors.push(`${field}.body must be a string`);
  }
  validateStringArray(value.body_lines, `${field}.body_lines`, errors);
  if (value.body === undefined && value.body_lines === undefined) {
    errors.push(`${field} must define body or body_lines`);
  }
}

function validateTemplateDocument(document, sourceName = 'template file') {
  const errors = [];
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return { ok: false, errors: ['Root JSON value must be an object'] };
  }
  if (!Array.isArray(document.templates)) {
    return { ok: false, errors: ['Expected a top-level "templates" array'] };
  }

  const templateIds = new Set();
  document.templates.forEach((template, templateIndex) => {
    const field = `templates[${templateIndex}]`;
    if (!template || typeof template !== 'object' || Array.isArray(template)) {
      errors.push(`${field} must be an object`);
      return;
    }

    const id = typeof template.id === 'string' ? template.id.trim() : '';
    if (!id) errors.push(`${field}.id must be a non-empty string`);
    else if (templateIds.has(id)) errors.push(`${field}.id duplicates "${id}" in ${sourceName}`);
    else templateIds.add(id);

    if (template.label !== undefined && typeof template.label !== 'string') {
      errors.push(`${field}.label must be a string`);
    }
    if (template.icon !== undefined && typeof template.icon !== 'string') {
      errors.push(`${field}.icon must be a string`);
    }
    if (template.title_prefix !== undefined && typeof template.title_prefix !== 'string') {
      errors.push(`${field}.title_prefix must be a string`);
    }
    if (template.required !== undefined && typeof template.required !== 'boolean') {
      errors.push(`${field}.required must be a boolean`);
    }
    validateStringArray(template.default_tags, `${field}.default_tags`, errors);
    validateBody(template, field, errors);

    if (template.variants !== undefined) {
      if (!Array.isArray(template.variants)) {
        errors.push(`${field}.variants must be an array`);
      } else {
        const variantIds = new Set();
        template.variants.forEach((variant, variantIndex) => {
          const variantField = `${field}.variants[${variantIndex}]`;
          if (!variant || typeof variant !== 'object' || Array.isArray(variant)) {
            errors.push(`${variantField} must be an object`);
            return;
          }
          const variantId = typeof variant.id === 'string' ? variant.id.trim() : '';
          if (!variantId) errors.push(`${variantField}.id must be a non-empty string`);
          else if (variantIds.has(variantId)) errors.push(`${variantField}.id duplicates "${variantId}"`);
          else variantIds.add(variantId);

          if (variant.label !== undefined && typeof variant.label !== 'string') {
            errors.push(`${variantField}.label must be a string`);
          }
          if (variant.title_prefix !== undefined && typeof variant.title_prefix !== 'string') {
            errors.push(`${variantField}.title_prefix must be a string`);
          }
          validateStringArray(variant.default_tags, `${variantField}.default_tags`, errors);
          validateBody(variant, variantField, errors);
        });
      }
    }
  });

  return { ok: errors.length === 0, errors };
}

function parseTemplateDocument(content, sourceName = 'template file') {
  let document;
  try {
    document = JSON.parse(String(content || ''));
  } catch (err) {
    return { ok: false, errors: [`Invalid JSON: ${err.message}`] };
  }
  const validation = validateTemplateDocument(document, sourceName);
  return { ...validation, document };
}

function loadTemplateFile(templatesFile) {
  let content;
  try {
    content = fs.readFileSync(templatesFile, 'utf8');
  } catch (err) {
    return { ok: false, errors: [`${path.basename(templatesFile)}: ${err.message}`] };
  }
  const parsed = parseTemplateDocument(content, path.basename(templatesFile));
  if (!parsed.ok) {
    return {
      ok: false,
      errors: parsed.errors.map((error) => `${path.basename(templatesFile)}: ${error}`),
    };
  }
  return { ok: true, document: parsed.document, templates: parsed.document.templates, content };
}

async function writeTemplateFileAtomic(templatesFile, document) {
  const normalized = `${JSON.stringify(document, null, 2)}\n`;
  const tempFile = `${templatesFile}.tmp-${process.pid}-${Date.now()}`;
  await fs.promises.writeFile(tempFile, normalized, 'utf8');
  try {
    await fs.promises.rename(tempFile, templatesFile);
  } catch (err) {
    try { await fs.promises.unlink(tempFile); } catch (_) {}
    throw err;
  }
  return normalized;
}

module.exports = {
  validateTemplateDocument,
  parseTemplateDocument,
  loadTemplateFile,
  writeTemplateFileAtomic,
};
