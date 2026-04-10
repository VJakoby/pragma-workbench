function sanitizeRenderedHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html || '');

  const allowedTags = new Set([
    'A', 'BLOCKQUOTE', 'BR', 'CODE', 'DEL', 'EM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'HR', 'IMG', 'INPUT', 'LI', 'OL', 'P', 'PRE', 'SPAN', 'STRONG', 'TABLE', 'TBODY',
    'TD', 'TH', 'THEAD', 'TR', 'UL',
  ]);
  const allowedAttrs = {
    A: new Set(['href', 'target', 'rel']),
    IMG: new Set(['src', 'alt', 'title', 'style', 'width', 'height']),
    INPUT: new Set(['type', 'checked', 'disabled', 'class']),
    OL: new Set(['start']),
    SPAN: new Set(['class']),
    CODE: new Set(['class']),
    TH: new Set(['style']),
    TD: new Set(['style']),
  };

  const sanitizeUrl = (value, { image = false } = {}) => {
    const next = String(value || '').trim();
    if (!next) return '';
    if (next.startsWith('#') || next.startsWith('/')) return next;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(next)) {
      const lower = next.toLowerCase();
      if (lower.startsWith('http:') || lower.startsWith('https:') || (!image && lower.startsWith('mailto:'))) {
        return next;
      }
      return '';
    }
    return next;
  };

  const walk = (node) => {
    [...node.children].forEach((child) => {
      if (!allowedTags.has(child.tagName)) {
        child.replaceWith(...child.childNodes);
        return;
      }

      [...child.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        const allowed = allowedAttrs[child.tagName];
        if (name.startsWith('on')) {
          child.removeAttribute(attr.name);
          return;
        }
        if (!allowed || !allowed.has(attr.name)) {
          child.removeAttribute(attr.name);
          return;
        }
        if ((name === 'href' || name === 'src')) {
          const sanitized = sanitizeUrl(attr.value, { image: name === 'src' });
          if (sanitized) child.setAttribute(attr.name, sanitized);
          else child.removeAttribute(attr.name);
          return;
        }
        if (
          name === 'style' &&
          !/^max-width:\s*100%(?:;\s*width:\s*\d{1,3}%)*(?:;\s*height:\s*\d{1,3}%)*;?$/i.test(attr.value.trim()) &&
          !/^text-align:\s*(left|right|center);?$/i.test(attr.value.trim())
        ) {
          child.removeAttribute(attr.name);
        }
      });

      if (child.tagName === 'A') {
        child.setAttribute('rel', 'noopener noreferrer');
        if (!child.getAttribute('target')) child.setAttribute('target', '_blank');
      }
      if (child.tagName === 'INPUT') {
        child.setAttribute('disabled', '');
      }

      walk(child);
    });
  };

  walk(template.content);
  return template.innerHTML;
}
