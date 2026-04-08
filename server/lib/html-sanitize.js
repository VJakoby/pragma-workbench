'use strict';

const sanitizeHtml = require('sanitize-html');

const SANITIZE_OPTIONS = {
  allowedTags: [
    'a', 'blockquote', 'br', 'code', 'del', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'hr', 'img', 'input', 'li', 'ol', 'p', 'pre', 'span', 'strong', 'table', 'tbody',
    'td', 'th', 'thead', 'tr', 'ul',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'style', 'width', 'height'],
    input: ['type', 'checked', 'disabled', 'class'],
    ol: ['start'],
    span: ['class'],
    code: ['class'],
    th: ['style'],
    td: ['style'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  allowedSchemesByTag: {
    img: ['http', 'https'],
  },
  allowedStyles: {
    img: {
      'max-width': [/^100%$/],
    },
    th: {
      'text-align': [/^left$/, /^right$/, /^center$/],
    },
    td: {
      'text-align': [/^left$/, /^right$/, /^center$/],
    },
  },
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
  },
};

function sanitizeRenderedHtml(html) {
  return sanitizeHtml(String(html || ''), SANITIZE_OPTIONS);
}

module.exports = { sanitizeRenderedHtml };
