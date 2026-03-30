  // Minimal markdown renderer for note preview (no external deps)
  window.marked = {
    _opts: { breaks: false, gfm: true },
    setOptions(o) { Object.assign(this._opts, o); },

    parse(src) {
      const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      src = src.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      // Stash fenced code blocks
      const stash = [];
      src = src.replace(/```(\w*)\n?([\s\S]*?)```/g, (_,lang,code) => {
        const html = `<pre><code class="language-${esc(lang)}">${esc(code.replace(/^\n+/,'').replace(/\n+$/, ''))}</code></pre>`;
        stash.push(html); return `\x00STASH${stash.length-1}\x00`;
      });

      // Stash indented code blocks (4 spaces or 1 tab)
      //src = src.replace(/((?:^(?:    |\t)[^\n]+\n?)+)/gm, m => {
      //  const code = m.replace(/^(?:    |\t)/gm, '').replace(/\n$/, '');
      //  const html = `<pre><code>${esc(code)}</code></pre>`;
      //  stash.push(html); return `\x00STASH${stash.length-1}\x00`;
      //});

      // Inline code
      src = src.replace(/`([^`\n]+)`/g, (_,c) => `<code>${esc(c)}</code>`);

      // Headings
      src = src.replace(/^#{6} (.+)$/gm, '<h6>$1</h6>');
      src = src.replace(/^#{5} (.+)$/gm, '<h5>$1</h5>');
      src = src.replace(/^#{4} (.+)$/gm, '<h4>$1</h4>');
      src = src.replace(/^### (.+)$/gm,  '<h3>$1</h3>');
      src = src.replace(/^## (.+)$/gm,   '<h2>$1</h2>');
      src = src.replace(/^# (.+)$/gm,    '<h1>$1</h1>');

      // Bold, italic, strikethrough
      src = src.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
      src = src.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      src = src.replace(/\*(.+?)\*/g, '<em>$1</em>');
      src = src.replace(/~~(.+?)~~/g, '<del>$1</del>');

      // Links & images
      src = src.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" style="max-width:100%">');
      src = src.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

      // HR & blockquote
      src = src.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '<hr>');
      src = src.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

      // GFM tables
      src = src.replace(/((?:^\|.*\|\n)+)/gm, (block) => {
        const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) return block;
        const splitRow = (line) => line.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        const header = splitRow(lines[0]);
        const separator = splitRow(lines[1]);
        if (!header.length || header.length !== separator.length) return block;
        if (!separator.every(cell => /^:?-{3,}:?$/.test(cell))) return block;

        const alignFor = (cell) => {
          if (/^:-+:$/.test(cell)) return 'center';
          if (/^-+:$/.test(cell)) return 'right';
          if (/^:-+$/.test(cell)) return 'left';
          return '';
        };

        const aligns = separator.map(alignFor);
        const th = header.map((cell, i) => `<th${aligns[i] ? ` style="text-align:${aligns[i]}"` : ''}>${cell}</th>`).join('');
        const bodyRows = lines.slice(2).map((line) => {
          const cols = splitRow(line);
          if (cols.length !== header.length) return '';
          return `<tr>${cols.map((cell, i) => `<td${aligns[i] ? ` style="text-align:${aligns[i]}"` : ''}>${cell}</td>`).join('')}</tr>`;
        }).filter(Boolean).join('');

        return `<table><thead><tr>${th}</tr></thead><tbody>${bodyRows}</tbody></table>`;
      });

      // Checklists — before unordered list processing
      src = src.replace(/((?:^[ \t]*[-*+] \[[ xX]\] .+\n?)+)/gm, m => {
        const items = m.trim().split('\n').map(l => {
          const checked = /^[ \t]*[-*+] \[[xX]\]/.test(l);
          const text = l.replace(/^[ \t]*[-*+] \[[ xX]\] /, '');
          return `<li class="task-item"><input type="checkbox" class="task-checkbox" ${checked ? 'checked' : ''} onclick="toggleCheckbox(this)"><span>${text}</span></li>`;
        }).join('');
        return `<ul class="task-list">${items}</ul>`;
      });

      // ── Nested list builder ──
      const getIndent = l => { const m = l.match(/^(\s*)/); return m ? m[1].length : 0; };
      const parseBullet = (line) => {
        const ordered = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
        if (ordered) return { indent: ordered[1].length, ordered: true, start: parseInt(ordered[2], 10), text: ordered[3] };
        const unordered = line.match(/^(\s*)[-*+]\s+(.*)$/);
        if (unordered) return { indent: unordered[1].length, ordered: false, start: null, text: unordered[2] };
        return null;
      };
      function buildList(lines, startIndex = 0, baseIndent = null) {
        const first = parseBullet(lines[startIndex] || '');
        if (!first) return { html: '', nextIndex: startIndex };
        const ordered = first.ordered;
        const tag = ordered ? 'ol' : 'ul';
        const indent = baseIndent ?? first.indent;
        let html = ordered && first.start > 1 ? `<${tag} start="${first.start}">` : `<${tag}>`;
        let i = startIndex;

        while (i < lines.length) {
          const item = parseBullet(lines[i]);
          if (!item || item.indent < indent || item.ordered !== ordered) break;
          if (item.indent > indent) {
            const nested = buildList(lines, i, item.indent);
            html += nested.html;
            i = nested.nextIndex;
            continue;
          }

          let extra = '';
          i++;
          while (i < lines.length) {
            const nextLine = lines[i];
            const nextItem = parseBullet(nextLine);
            const nextIndent = getIndent(nextLine);
            if (nextItem && nextIndent === indent) break;
            if (nextItem && nextIndent > indent) {
              const nested = buildList(lines, i, nextIndent);
              extra += nested.html;
              i = nested.nextIndex;
              continue;
            }
            if (nextIndent > indent) {
              extra += '<br>' + nextLine.trim();
              i++;
              continue;
            }
            break;
          }
          html += `<li>${item.text}${extra}</li>`;
        }

        return { html: html + `</${tag}>`, nextIndex: i };
      }

      // Unordered lists (including indented nested)
      src = src.replace(/((?:^[ \t]*[-*+] .+(?:\n|$)(?:(?:^[ \t]+.*(?:\n|$))|(?:^\s*$\n?))*)+)/gm, m => {
        const lines = m.trimEnd().split('\n').filter(l => l.trim());
        return buildList(lines).html;
      });

      // Ordered lists (including indented nested)
      src = src.replace(/((?:^\s*\d+\. .+(?:\n|$)(?:(?:^[ \t]+.*(?:\n|$))|(?:^\s*$\n?))*)+)/gm, m => {
        const lines = m.trimEnd().split('\n').filter(l => l.trim());
        return buildList(lines).html;
      });

      // Paragraphs
      src = src.replace(/\x00STASH(\d+)\x00\n(?!\n)/g, '\x00STASH$1\x00\n\n');
      src = src.replace(/<\/(h[1-6])>\n(?!\n)/g, '</$1>\n\n');
      src = src.replace(/<hr>\n(?!\n)/g, '<hr>\n\n');
      src = src.replace(/<\/blockquote>\n(?!\n)/g, '</blockquote>\n\n');

      src = src.split(/\n{2,}/).map(block => {
        block = block.trim();
        if (!block) return '';
        if (/^\x00STASH/.test(block)) return block;
        if (/^<(h[1-6]|ul|ol|hr|blockquote|pre|table)/.test(block)) return block;
        return `<p>${block.replace(/\n/g,' ')}</p>`;
      }).join('\n');

      src = src.replace(/\x00STASH(\d+)\x00/g, (_,i) => stash[+i]);
      return src;
    }
  };
  // ── SVG Icon library (Lucide-style, 16x16 viewBox) ──
  window.ICONS = {
    notes:      '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>',
    services:   '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>',
    guides:     '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    search:     '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    lock:       '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    download:   '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    pin:        '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z"/></svg>',
    trash:      '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>',
    eye:        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    duplicate:  '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    target:     '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    edit:       '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    link:       '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    clock:      '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>',
    clipboard:  '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
    plus:       '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    close:      '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    warning:    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    empty:      '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>',
    searchBig:  '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  };
  // Helper to get an icon as HTML string
  window.icon = (name, cls='') => {
    const svg = ICONS[name];
    if (!svg) return '';
    if (!cls) return svg;
    return svg.replace('<svg ', `<svg class="${cls}" `);
  };
