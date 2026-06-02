# Project Backlog (Codex-Optimized v2)

## GLOBAL RULES
- Do not refactor unrelated code
- Only modify explicitly required files
- Keep diffs minimal
- Do not merge tasks
- Preserve existing architecture

---

# P1 — CRITICAL FIXES

## P1-01 — Injection Variable Fallback Formatting
STATUS: DONE

CONTEXT:
Template system renders broken placeholders when variables like LHOST or DOMAIN are missing, causing malformed UI output.

PROBLEM:
Unset template variables render corrupted strings in preview (e.g. broken interpolation artifacts).

SCOPE:
public/app/content-panel.js
public/app/styles.css

EXPECTED BEHAVIOR:
Unset variables must render safe fallback UI labels instead of broken interpolation.

---

## P1-02 — Command Palette Icon Update
STATUS: DONE

CONTEXT:
UI iconography for command palette is outdated and inconsistent with terminal-style UX.

SCOPE:
views/, public/app.html

EXPECTED BEHAVIOR:
Replace icon with terminal-style `>_` indicator.

---

## P1-03 — Hover Visual Jank
STATUS: DONE

CONTEXT:
Hover effects on UI elements cause layout shift and “spongy” feel due to border/transform changes.

SCOPE:
public/app/styles.css

EXPECTED BEHAVIOR:
Hover must not trigger layout shift; only visual styling changes allowed.

---

## P1-04 — KB Find-in-Document Broken
STATUS: DONE

CONTEXT:
Search system fails in KB side-card due to inconsistent handling between editor and preview modes.

SCOPE:
CodeMirror integration, content-panel.js

EXPECTED BEHAVIOR:
Search must work identically in read mode and edit mode, including navigation and highlighting.

---

## P1-05 — Header Collapse Broken (Full Preview Only)
STATUS: DONE

CONTEXT:
Markdown header collapsing works in split view but not full preview due to rendering pipeline mismatch.

SCOPE:
note-editor.js, content-panel.js

EXPECTED BEHAVIOR:
Header collapse must behave consistently across all rendering modes.

---

## P1-06 — Create Engagement Note from Service Row
STATUS: DONE

CONTEXT:
Operators need faster workflow to create notes directly from service discovery results.

SCOPE:
public/app/quick-log.js

EXPECTED BEHAVIOR:
Each service row must allow direct creation of linked engagement notes with correct context.

---

## P1-08 — Code Block Contrast Issue
STATUS: DONE

CONTEXT:
Code blocks are visually indistinct from normal markdown text.

SCOPE:
public/app/styles.css

EXPECTED BEHAVIOR:
Code blocks must have clear visual separation (background + border contrast).

---

## P1-09 — Duplicate Emoji Rendering
STATUS: DONE

CONTEXT:
Emoji duplication occurs due to conflict between static icons and dynamic rendering logic.

SCOPE:
server/lib/kb-index.js

EXPECTED BEHAVIOR:
Each KB title must render exactly one emoji.

---

## P1-10 — Unified KB + Session Search Index
STATUS: DONE

CONTEXT:
Search system does not index KB files and session data consistently.

SCOPE:
server/lib/unified-search-index.js, server/routes/kb.js

EXPECTED BEHAVIOR:
Search must include both KB files and session notes in a unified index.

---

# P2 — FEATURES

## P2-01 — KB Cross-Linking Syntax
CONTEXT:
Need internal navigation between KB documents.

SCOPE:
markdown renderer

SYNTAX:
[kb:service:x]

---

## P2-02 — Engagement Note Linking
CONTEXT:
Need cross-navigation between operational notes.

SCOPE:
markdown renderer

SYNTAX:
[en:target:x]

---

## P2-03 — Attachment Storage Manager
CONTEXT:
Users need visibility into file usage across documents.

SCOPE:
sidebar storage system

---

## P2-04 — Port → KB Context Linking
CONTEXT:
Service discovery should connect directly to documentation.

SCOPE:
quick log + service view

---

## P2-05 — Session/Target Switcher UI
CONTEXT:
Switching between operational contexts is too slow.

SCOPE:
navbar / workspace system

---

## P2-06 — Port Summary Dashboard
CONTEXT:
Need overview of discovered infrastructure assets.

SCOPE:
dashboard UI

---

## P2-07 — Welcome / Session Selector Modal
CONTEXT:
Improve onboarding and workspace selection.

SCOPE:
app initialization

---

## P2-08 — Markdown Engine Migration
CONTEXT:
Current markdown engine lacks extensibility for advanced syntax.

SCOPE:
renderer system

TARGET:
remark OR markdown-it

---

# P3 — EXPERIMENTAL

## P3-01 — Interactive Documentation Templates
CONTEXT:
Templates should provide operational guidance during use.

SCOPE:
KB template engine

---

## P3-02 — Operational Context Branch Sync
CONTEXT:
Experimental branch must align with main architecture.

SCOPE:
git branch: operational-context

---

## P3-03 — Editor Performance Profiling
CONTEXT:
UI lag occurs during intensive editing sessions.

SCOPE:
browser editor runtime

---

## P3-04 — Unified Live Preview Editor
CONTEXT:
Need real-time markdown rendering in a single view.

SCOPE:
markdown editor system

---

## P3-05 — Interactive Checkboxes in KB Sidebar
CONTEXT:
Checkboxes are not interactive in sidebar preview mode.

SCOPE:
sidebar renderer

---

## P3-06 — Port → TODO Conversion
CONTEXT:
Need faster conversion of discovered ports into actionable tasks.

SCOPE:
quick log + ports system

---

# BUGS

## B-1 — KB Document Open Failure
STATUS: DONE

CONTEXT:
Search returns valid entries but fails to open them.

---

## B-2 — Target Injection Duplication (x4)
STATUS: DONE

CONTEXT:
IP injection logic runs multiple times per rendering cycle.

---

## B-3 — Full Preview Header Collapse Broken
STATUS: POTENTIALL FIXED

CONTEXT:
Rendering pipeline differs between full preview and split view.

---

## B-4 — Missing Emojis in Service Titles
STATUS: DONE

CONTEXT:
Service view rendering does not apply emoji layer consistently.

---

## B-5 — Unsafe Injection Inside Code Blocks
STATUS: POTENTIALL FIXED

CONTEXT:
The injection system is incorrectly matching non-placeholder strings such as CLI flags and code literals, causing duplicate and corrupted injections.

PROBLEM:
Strings like `dc-ip` and `-dc-ip` are being interpreted as injectable targets, resulting in multiple injection passes and malformed output.

EXPECTED BEHAVIOR:

### HARD RULE — NO EXCEPTIONS
Injection MUST ONLY occur on explicitly defined placeholders:

- `<DC>`
- `<TARGET>`
- `<IP>`
- `<DOMAIN>`

### ABSOLUTE EXCLUSION ZONES (never inject):
- Any code block (``` ... ```)
- Inline code (`...`)
- CLI flags or arguments (e.g. `-dc-ip`, `--target`)
- Any lowercase identifier or hyphenated token
- Any string not wrapped in `< >`

---

### CORE RULE
If it is NOT inside `< >`, it is NOT a variable.

No exceptions.
No pattern guessing.
No keyword matching.

---

END
