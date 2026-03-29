// ═══════════════════════════════════════════════
// EDITOR THEME + SHARED STATE
// ═══════════════════════════════════════════════
let noteEditor = null;
let kbEditor   = null;
let cpEditDirty = false;

function cmGetValue(editor) {
  return editor ? editor.state.doc.toString() : '';
}

function cmSetValue(editor, value) {
  if (!editor) return;
  editor.dispatch({
    changes: { from: 0, to: editor.state.doc.length, insert: value || '' }
  });
}

const SYNTAX_THEMES = {
  quietlight: (dark) => [
    { tag: CM.tags.heading1, color: dark ? '#c586c0' : '#795e26', fontWeight: '700' },
    { tag: CM.tags.heading2, color: dark ? '#c586c0' : '#795e26', fontWeight: '600' },
    { tag: CM.tags.heading3, color: dark ? '#569cd6' : '#001080', fontWeight: '600' },
    { tag: [CM.tags.heading4, CM.tags.heading5, CM.tags.heading6], color: dark ? '#569cd6' : '#001080' },
    { tag: CM.tags.strong, color: dark ? '#d19a66' : '#795e26', fontWeight: '700' },
    { tag: CM.tags.emphasis, color: dark ? '#4ec9b0' : '#af00db', fontStyle: 'italic' },
    { tag: CM.tags.strikethrough, color: dark ? '#7f848e' : '#999999', textDecoration: 'line-through' },
    { tag: [CM.tags.link, CM.tags.url], color: dark ? '#4fc1ff' : '#0451a5' },
    { tag: CM.tags.monospace, color: dark ? '#ce9178' : '#a31515' },
    { tag: [CM.tags.quote, CM.tags.comment, CM.tags.meta], color: dark ? '#6a9955' : '#008000', fontStyle: 'italic' },
    { tag: CM.tags.punctuation, color: dark ? '#808080' : '#444444' },
    { tag: [CM.tags.atom, CM.tags.processingInstruction, CM.tags.number, CM.tags.bool, CM.tags.null], color: dark ? '#b5cea8' : '#098658' },
    { tag: [CM.tags.keyword, CM.tags.operator], color: dark ? '#569cd6' : '#0000ff' },
    { tag: CM.tags.string, color: dark ? '#ce9178' : '#a31515' },
  ],
  monokai: (dark) => [
    { tag: CM.tags.heading1, color: '#f92672', fontWeight: '700' },
    { tag: CM.tags.heading2, color: '#f92672', fontWeight: '600' },
    { tag: CM.tags.heading3, color: '#fd971f', fontWeight: '600' },
    { tag: [CM.tags.heading4, CM.tags.heading5, CM.tags.heading6], color: '#fd971f' },
    { tag: CM.tags.strong, color: '#fd971f', fontWeight: '700' },
    { tag: CM.tags.emphasis, color: '#a6e22e', fontStyle: 'italic' },
    { tag: CM.tags.strikethrough, color: '#75715e', textDecoration: 'line-through' },
    { tag: [CM.tags.link, CM.tags.url], color: '#66d9e8' },
    { tag: CM.tags.monospace, color: '#ae81ff' },
    { tag: [CM.tags.quote, CM.tags.comment, CM.tags.meta], color: '#75715e', fontStyle: 'italic' },
    { tag: CM.tags.punctuation, color: dark ? '#555566' : '#aaaacc' },
    { tag: [CM.tags.atom, CM.tags.processingInstruction, CM.tags.number, CM.tags.bool, CM.tags.null], color: '#ae81ff' },
    { tag: [CM.tags.keyword, CM.tags.operator], color: '#f92672' },
    { tag: CM.tags.string, color: '#e6db74' },
  ],
  nord: (dark) => [
    { tag: CM.tags.heading1, color: '#bf616a', fontWeight: '700' },
    { tag: CM.tags.heading2, color: '#d08770', fontWeight: '600' },
    { tag: CM.tags.heading3, color: '#ebcb8b', fontWeight: '600' },
    { tag: [CM.tags.heading4, CM.tags.heading5, CM.tags.heading6], color: '#ebcb8b' },
    { tag: CM.tags.strong, color: '#d08770', fontWeight: '700' },
    { tag: CM.tags.emphasis, color: '#a3be8c', fontStyle: 'italic' },
    { tag: CM.tags.strikethrough, color: '#4c566a', textDecoration: 'line-through' },
    { tag: [CM.tags.link, CM.tags.url], color: '#88c0d0' },
    { tag: CM.tags.monospace, color: '#b48ead' },
    { tag: [CM.tags.quote, CM.tags.comment, CM.tags.meta], color: '#616e88', fontStyle: 'italic' },
    { tag: CM.tags.punctuation, color: dark ? '#4c566a' : '#9aa0b0' },
    { tag: [CM.tags.atom, CM.tags.processingInstruction, CM.tags.number, CM.tags.bool, CM.tags.null], color: '#b48ead' },
    { tag: [CM.tags.keyword, CM.tags.operator], color: '#81a1c1' },
    { tag: CM.tags.string, color: '#a3be8c' },
  ],
  solarized: (dark) => [
    { tag: CM.tags.heading1, color: '#dc322f', fontWeight: '700' },
    { tag: CM.tags.heading2, color: '#cb4b16', fontWeight: '600' },
    { tag: CM.tags.heading3, color: '#b58900', fontWeight: '600' },
    { tag: [CM.tags.heading4, CM.tags.heading5, CM.tags.heading6], color: '#b58900' },
    { tag: CM.tags.strong, color: '#cb4b16', fontWeight: '700' },
    { tag: CM.tags.emphasis, color: '#2aa198', fontStyle: 'italic' },
    { tag: CM.tags.strikethrough, color: '#586e75', textDecoration: 'line-through' },
    { tag: [CM.tags.link, CM.tags.url], color: '#268bd2' },
    { tag: CM.tags.monospace, color: '#6c71c4' },
    { tag: [CM.tags.quote, CM.tags.comment, CM.tags.meta], color: '#586e75', fontStyle: 'italic' },
    { tag: CM.tags.punctuation, color: dark ? '#586e75' : '#839496' },
    { tag: [CM.tags.atom, CM.tags.processingInstruction, CM.tags.number, CM.tags.bool, CM.tags.null], color: '#6c71c4' },
    { tag: [CM.tags.keyword, CM.tags.operator], color: '#859900' },
    { tag: CM.tags.string, color: '#2aa198' },
  ],
};

let activeSyntaxTheme = localStorage.getItem('pragma-syntax-theme') || 'monokai';
let activeEditorFontSize = Math.min(22, Math.max(11, parseInt(localStorage.getItem('pragma-editor-font-size') || '14', 10) || 14));
let activeEditorFontFamily = localStorage.getItem('pragma-editor-font-family') || 'mono';
const EDITOR_FONT_FAMILIES = {
  classic: 'monospace',
  mono: "'JetBrains Mono', monospace",
  inter: "'Inter', system-ui, sans-serif",
};

function applyEditorFontFamily(mode = activeEditorFontFamily) {
  activeEditorFontFamily = EDITOR_FONT_FAMILIES[mode] ? mode : 'mono';
  localStorage.setItem('pragma-editor-font-family', activeEditorFontFamily);
  const fontFamily = EDITOR_FONT_FAMILIES[activeEditorFontFamily];
  document.documentElement.style.setProperty('--editor-font-family', fontFamily);
  document.querySelectorAll('.editor-font-choice').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.font === activeEditorFontFamily));
}

function applyEditorFontSize(size = activeEditorFontSize) {
  activeEditorFontSize = Math.min(22, Math.max(11, size));
  localStorage.setItem('pragma-editor-font-size', String(activeEditorFontSize));
  document.documentElement.style.setProperty('--editor-font-size', `${activeEditorFontSize}px`);
  const label = document.getElementById('editorFontSizeLabel');
  if (label) label.textContent = `${activeEditorFontSize}px`;
}

function increaseEditorFont() {
  applyEditorFontSize(activeEditorFontSize + 1);
}

function decreaseEditorFont() {
  applyEditorFontSize(activeEditorFontSize - 1);
}

function resetEditorFont() {
  applyEditorFontSize(14);
}

function setEditorFontFamily(mode) {
  applyEditorFontFamily(mode);
}

function setSyntaxTheme(name) {
  activeSyntaxTheme = name;
  localStorage.setItem('pragma-syntax-theme', name);
  document.querySelectorAll('.syntax-dot').forEach(d =>
    d.classList.toggle('active', d.dataset.theme === name));

  const noteContent = noteEditor ? cmGetValue(noteEditor) : null;
  const kbContent   = kbEditor ? cmGetValue(kbEditor) : null;

  if (typeof cmInitNote === 'function') cmInitNote(noteContent);
  if (typeof cmInitKb === 'function') cmInitKb(kbContent);
}

function initSyntaxThemePicker() {
  document.querySelectorAll('.syntax-dot').forEach(d =>
    d.classList.toggle('active', d.dataset.theme === activeSyntaxTheme));
  applyEditorFontFamily(activeEditorFontFamily);
  applyEditorFontSize(activeEditorFontSize);
}

function cmThemeVars() {
  const s = getComputedStyle(document.documentElement);
  const bg    = s.getPropertyValue('--bg').trim() || '#1a1a1f';
  const text  = s.getPropertyValue('--text').trim() || '#e2e8f0';
  const text2 = s.getPropertyValue('--text2').trim() || '#94a3b8';
  const muted = s.getPropertyValue('--muted').trim() || '#4a5568';
  const bg3   = s.getPropertyValue('--bg3').trim() || '#26262f';
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
  if (theme === 'light') {
    return {
      bg: '#ffffff',
      text: '#333333',
      text2: '#333333',
      muted: '#6a737d',
      bg3: '#f3f3f3',
      selection: 'rgba(37, 99, 235, 0.56)',
      selectionOutline: 'rgba(37, 99, 235, 0.78)',
      activeLine: '#f5f5f5',
    };
  }
  return {
    bg,
    text,
    text2,
    muted,
    bg3,
    selection: 'rgba(124,58,237,0.48)',
    selectionOutline: 'rgba(196,181,253,0.58)',
    activeLine: 'rgba(124,58,237,0.06)',
  };
}

function buildCmTheme() {
  if (!window.CM) return [];
  const v = cmThemeVars();
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
  const dark = theme !== 'light';

  const editorTheme = CM.EditorView.theme({
    '&': { background: 'transparent', height: '100%' },
    '.cm-scroller': { fontSize: 'var(--editor-font-size, 13px)', fontFamily: 'var(--editor-font-family, "JetBrains Mono", monospace)' },
    '.cm-content': { color: v.text2, caretColor: v.text, padding: '0', fontWeight: '500' },
    '.cm-cursor': { borderLeftColor: v.text },
    '.cm-selectionBackground, ::selection': { background: `${v.selection} !important` },
    '.cm-content::selection, .cm-content *::selection': { background: `${v.selection} !important` },
    '.cm-line::selection, .cm-line > span::selection': { background: `${v.selection} !important` },
    '.cm-selectionLayer .cm-selectionBackground': {
      background: `${v.selection} !important`,
      boxShadow: `inset 0 0 0 2px ${v.selectionOutline}`,
      borderRadius: '2px',
    },
    '&.cm-focused .cm-selectionBackground': {
      background: `${v.selection} !important`,
      boxShadow: `inset 0 0 0 2px ${v.selectionOutline}`,
    },
    '.cm-activeLine': { background: v.activeLine },
    '.cm-gutters': {
      background: 'transparent',
      color: v.muted,
      borderRight: `1px solid ${v.bg3}`,
      paddingRight: '4px',
      marginRight: '8px',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      minWidth: '2em',
      padding: '0 4px 0 0',
      textAlign: 'right',
      fontVariantNumeric: 'tabular-nums',
    },
    '.cm-activeLineGutter': {
      color: v.text,
      background: 'transparent',
    },
    '.cm-placeholder': { color: v.muted },
    '.cm-line': { padding: '0' },
  }, { dark });

  const highlightStyle = CM.HighlightStyle.define(
    SYNTAX_THEMES[activeSyntaxTheme]?.(dark) || SYNTAX_THEMES.quietlight(dark)
  );

  return [editorTheme, CM.syntaxHighlighting(highlightStyle)];
}
