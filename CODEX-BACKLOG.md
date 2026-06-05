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
STATUS: DONE

CONTEXT:
Need internal navigation between KB documents.

SCOPE:
markdown renderer

SYNTAX:
[kb:service:x]

---

## P2-02 — Engagement Note Linking
STATUS: DONE

CONTEXT:
Need cross-navigation between operational notes.

SCOPE:
markdown renderer

SYNTAX:
[en:target:x]

---

## P2-03 — Attachment Storage Manager
STATUS: DONE
CONTEXT:
Users need visibility into file usage across documents.

SCOPE:
sidebar storage system

---

## P2-04 — Port → KB Context Linking
STATUS: DONE

CONTEXT:
Service discovery should connect directly to documentation.

SCOPE:
quick log + service view

---

## P2-05 — Session/Target Switcher UI
STATUS: DONE
CONTEXT:
Switching between operational contexts is too slow.

SCOPE:
navbar / workspace system

---

## P2-06 — Engagement Summary Dashboard
CONTEXT:
Operators need a neutral overview of early- and mid-engagement findings when no note is open, without relying on recent activity or subjective prioritization.

SCOPE:
notes empty-state / dashboard UI

EXPECTED BEHAVIOR:
- Show a dashboard only when no note is currently open
- Use summary cards for:
  - `Ports`
  - `Paths`
  - `Loot`
- Each card must show statistics only, such as:
  - total count
  - category breakdowns where available
  - simple coverage/inventory information
- The dashboard must not depend on:
  - recent activity ordering
  - “top” or “most relevant” judgments
  - subjective prioritization logic
- Each card may include one direct action to open the corresponding detailed surface
- The dashboard must disappear as soon as a note is opened

RULES:
- Do not duplicate the full management/detail UI of Quick Log or Notes
- Keep this as a summary/dashboard layer only
- Keep the data session-scoped unless an existing workspace-wide source is already required by the underlying feature
- Avoid introducing ranking or scoring logic

---

## P2-07 — Welcome / Session Selector Modal
STATUS: DONE

CONTEXT:
Improve onboarding and workspace selection.

SCOPE:
app initialization

---

## P2-09 — Direct Quick Log Access in Topbar
STATUS: DONE

CONTEXT:
The current `Log` button adds unnecessary friction because operators must open the Quick Log modal before choosing `Ports`, `Paths`, or `Loot`.

SCOPE:
topbar UI + quick log modal state

EXPECTED BEHAVIOR:
- Replace the single `Log` topbar entry with a compact grouped control for `Ports`, `Paths`, and `Loot`
- Clicking `Ports`, `Paths`, or `Loot` must open the existing Quick Log modal directly on the selected section
- Keep `Todo` and `Evidence` as separate topbar actions
- Preserve the existing Quick Log modal and its current functionality
- The grouped control must remain compact and visually consistent with the existing topbar
- The layout must still work cleanly at smaller topbar widths without feeling cluttered

RULES:
- Do not create separate pages or standalone panels for `Ports`, `Paths`, or `Loot`
- Do not duplicate Quick Log functionality outside the modal
- Keep the change focused on reducing clicks and improving access speed

## P2-10 — Session Wide Domain Tag 
STATUS: DONE

CONTEXT:
Introduce a tag/field for Domain for sessions. At the moment there is a Domain for each target, but this is not suitable for, etc a Active Directory pentest with several hosts with 1 domain.

SCOPE:
workspace system sessions

---

## P2-11 — Context Switcher Quick Add
STATUS: DONE

CONTEXT:
The target/session quick switcher currently only supports filtering and selecting existing entries. Operators should be able to type a new value and create a target or session directly from the switcher without dropping into the heavier management modals.

SCOPE:
context switcher UI

EXPECTED BEHAVIOR:
- Typing in the context switcher should dynamically offer quick-create actions when no exact existing match is selected
- In `Targets` mode:
  - IP-like input should offer `Create target`
  - hostname/domain-like input should offer `Create target`
- In `Sessions` mode:
  - free-form codename input should offer `Create session`
- Quick-create entries should render inside the existing switcher result list, not as separate floating controls
- Quick-create entries must support keyboard navigation and `Enter`, just like normal switch targets/sessions entries
- Creating a target should add it to the active session and switch to it immediately
- Creating a session should create it and switch into it immediately

RULES:
- Do not replace the existing management modals
- Do not infer `Create session` from every alphabetic string in `Targets` mode
- Prefer tab-aware behavior:
  - `Targets` tab biases toward target creation
  - `Sessions` tab biases toward session creation
- Avoid offering duplicate create actions when the typed value already matches an existing target/session sufficiently

---

## P2-12 — Recent Search Action Hover States
STATUS: DONE

CONTEXT:
Recent search controls in the search UI do not provide clear hover/pressed feedback, making the actions look non-interactive and visually inconsistent with the rest of the app.

SCOPE:
recent search UI

EXPECTED BEHAVIOR:
- The `Clear all` button must have clear hover and active/pressed visual states
- The per-card remove `X` action must have matching hover and active/pressed visual states
- Interaction styling should match the rest of the app's button language
- Hover/active states must not cause layout shift

---

## P2-13 — Search Index Refresh for New Documents
STATUS: DONE

CONTEXT:
Newly created documents do not appear in search results until the server is restarted, which means the live search/index state falls behind the actual document set.

SCOPE:
search indexing system

EXPECTED BEHAVIOR:
- Newly created documents must become searchable without requiring a server restart
- Search results must reflect current document contents after create/save operations
- Index refresh behavior should stay consistent for both session documents and KB/local documents covered by the existing search system

---
## P2-14 — Empty KB Structure Guidance
STATUS: DONE

CONTEXT:
When no knowledge base content exists, the app only shows a minimal `KB path not configured` message in some main-panel views. It does not clearly explain the expected directory structure, and the guidance is missing from the KB sidebar.

SCOPE:
KB empty-state UI

EXPECTED BEHAVIOR:
- When the knowledge base is empty or unavailable, the empty-state info panel must show a small example KB directory structure
- The structure example must appear in:
  - the main content view for `Services`
  - the main content view for `Tactics`
  - the KB sidebar / sideview area
- The guidance should make clear:
  - `knowledge-base/` is optional and can be mounted via `KB_DIR`
  - `services/` files populate the `Services` tab
  - `tactics/` files populate the `Tactics` tab
  - other top-level folders become separate KB sections
- The example should render in a readable monospace / preformatted layout matching the app style

RULES:
- Do not change KB indexing behavior
- Do not auto-create folders or files
- Keep this as an informational empty-state improvement only
- Reuse the same guidance content in both main-view and sidebar empty states where possible

---

## P2-15 — Quick Log Split Button Badge Spacing
STATUS: DONE

CONTEXT:
When count badges appear on the topbar `Ports | Paths | Loot` control, the label and badge sit too close to the button edges, making the grouped control feel cramped.

SCOPE:
topbar quick-log styling

EXPECTED BEHAVIOR:
- The `Ports`, `Paths`, and `Loot` buttons must have enough horizontal padding when count badges are visible
- Count badges must have clear breathing room from the left and right button edges
- The grouped control must keep its current behavior and overall layout
- The spacing adjustment must work in both dark and light mode

RULES:
- Do not change quick-log behavior
- Do not change badge values or visibility logic
- Keep this as a styling-only adjustment

---

## P2-16 — Quick Log KB Port Badge Styling
STATUS: DONE

CONTEXT:
The clickable KB-linked port buttons in Quick Log work, but their shape does not match the rounded badge/button language used elsewhere in the UI.

SCOPE:
quick log styling

EXPECTED BEHAVIOR:
- KB-linked port buttons in the Quick Log `Ports` table should use a rounder badge-like shape
- Current font sizing and weight may remain unchanged
- Styling should stay consistent in both light and dark mode
- Behavior and linking logic must not change

RULES:
- Styling only
- Do not change matching logic or click behavior

---

## P2-17 — First-Run Setup Simplification
STATUS: DONE

CONTEXT:
The current setup is functional but not clean for first-time users. The documented bootstrap flow references a missing `.env.example`, mixes required and optional configuration, and does not clearly separate Docker setup from direct Node setup.

SCOPE:
README.md, docs/, .env.example

EXPECTED BEHAVIOR:
- Provide a real `.env.example` for first-run bootstrap
- Keep `README.md` as the root entry point and move detailed setup guidance into `docs/`
- Clearly separate:
  - minimum required setup
  - optional modules
  - Docker workflow
  - direct Node workflow
- Document what storage paths are expected or optional:
  - `knowledge-base/`
  - `sessions/`
- Make ENGRAM and Toolbox clearly optional and non-blocking
- Keep setup local-first and simple without adding a heavy installer

RULES:
- Documentation/bootstrap only
- Do not change unrelated runtime behavior
- Prefer clarity and low-friction setup over automation complexity

---


## P2-19 — Topbar Search and Quick Log Emphasis
STATUS: DONE

CONTEXT:
The topbar utility strip should prioritize direct access to search while keeping the operational utility buttons stable and readable. Quick Log count badges should also communicate that useful entries exist.

SCOPE:
views/partials/topbar.ejs
views/partials/topbar-utility-panels.ejs
public/app/styles.css

EXPECTED BEHAVIOR:
- Move the `Unified search` trigger into the position currently occupied by the utility strip
- Move the `TODO`, `Ports`, `Paths`, `Loot`, and `Evidence` controls into the current search-trigger position
- Keep the utility buttons at their current visual size; they must not compress to absorb narrower widths
- Preserve the existing dynamic width behavior on the `Unified search` trigger so it is the element that shrinks first on narrower windows
- `Ports`, `Paths`, and `Loot` count badges must use a slightly green-tinted emphasis to indicate useful findings are present

RULES:
- Do not change utility button behavior
- Do not change search behavior
- Keep the change limited to topbar layout and visual styling

---



## P2-21 — Setup and Usage Documentation Refinement

CONTEXT:
The current `SETUP.md` and `USAGE.md` are accurate but too terse in the practical areas that matter during first-run setup and day-to-day operator use.

SCOPE:
SETUP.md
USAGE.md

EXPECTED BEHAVIOR:
- `SETUP.md` should explain a practical local-first setup path, not just ecosystem roles
- `SETUP.md` should clearly cover:
  - required vs optional components
  - runtime paths
  - environment/bootstrap expectations
  - first-run validation steps
  - common setup patterns
- `USAGE.md` should explain the intended workflow in more operational terms
- `USAGE.md` should clearly cover:
  - sessions and targets
  - note-centric workflow
  - Quick Log usage
  - target-scoped Ports / Paths / Loot behavior
  - Evidence and summary flow
- Keep the docs concise and practical rather than marketing-style

RULES:
- Documentation only
- Do not change runtime behavior
- Do not broaden scope into README cleanup or environment file changes

---


## P2-22 — Hidden Notes List Session Tab Strip

CONTEXT:
When the notes list is collapsed, operators lose fast visibility and switching access to the notes already open or available within the current session. This creates unnecessary friction compared to the normal split layout.

SCOPE:
notes editor header / notes navigation UI

EXPECTED BEHAVIOR:
- When the notes list sidebar is hidden, show a horizontal note tab strip above the editor area
- The tab strip should reflect notes in the current session only
- Each tab should allow fast open/switch behavior similar to an editor tab row
- The active note must be visually distinct
- Closing the active note from the tab strip context must still behave correctly with the existing note close flow
- When the notes list sidebar is visible again, the tab strip may hide to avoid duplicate navigation chrome
- The tab strip must work in both normal note-edit mode and no-note-selected state where applicable
- The layout should remain usable on narrower widths, including horizontal overflow handling if needed

RULES:
- Do not replace the existing notes list
- Do not turn this into multi-note simultaneous editing
- Keep current note open/close behavior intact
- Keep the scope limited to session note navigation while the notes list is collapsed
- Prefer a lightweight VS Code-style tab row rather than a second full navigation panel

---

## P2-24 — Target-Grouped Hidden Note Tabs
STATUS: DONE

CONTEXT:
The hidden-notes session tab strip now exposes note switching and note creation, but it does not show which notes belong to which target within the current session. This makes multi-target engagements harder to scan once several notes are open in the same session.

SCOPE:
notes editor header / hidden-notes tab strip grouping

EXPECTED BEHAVIOR:
- When the notes list sidebar is hidden, session note tabs should be visually grouped by target association
- Each target group should show a small shared label such as the target IP, domain, label, or `Unassigned` when no target is attached
- Target groups should use a subtle shared frame or background treatment so it is clear that multiple tabs belong to the same target
- Existing note switching, active-tab state, close behavior, and horizontal scrolling must remain intact
- The tab-strip create control should remain available and should not be merged into any target group

RULES:
- Use the existing note `target_id` relationship as the grouping source of truth
- Do not add per-tab target labels
- Do not redesign the broader notes editor layout
- Keep the grouping treatment lightweight and readable on narrower widths

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
STATUS: DONE

CONTEXT:
UI lag occurs during intensive editing sessions.

SCOPE:
browser editor runtime

---

## P3-04 — Unified Live Preview Editor
CONTEXT:
The current markdown workflow relies on a split editor/preview layout. It works, but it creates visual separation and friction when writing, reviewing formatting, and navigating rendered content. A unified editing surface may improve flow, but it must not regress markdown behavior, autosave, or internal linking.

SCOPE:
markdown editor system

GOAL:
Prototype an experimental unified markdown editing mode where raw markdown and rendered understanding coexist in a single surface, while preserving the current split-preview editor as a safe fallback.

EXPECTED BEHAVIOR:
- Add an experimental unified editor mode for notes and KB documents
- The unified mode must reuse the existing server-backed markdown render pipeline
- Raw markdown must remain the source of truth and stay directly editable
- The user should be able to read and write in one surface without depending on a separate preview pane
- Existing markdown-related features must continue to work:
  - headings
  - tables
  - checklists
  - code blocks
  - internal KB links
  - engagement links
  - collapsible headings
  - attachment images
- Autosave behavior must remain unchanged
- Users must be able to leave unified mode and return to the current split editor without losing content or state
- The current split-preview mode must remain available during the experiment

NON-GOALS:
- Do not replace the markdown engine as part of this task
- Do not build a full WYSIWYG rich-text editor
- Do not remove the current note editor or KB editor flows
- Do not change the saved document format away from markdown

IMPLEMENTATION RULES:
- Reuse `/api/markdown/render` for rendering
- Keep markdown as the source of truth
- Prefer a mode toggle or experimental flag over a hard replacement
- Minimize DOM-editing complexity in the first pass
- Preserve current keyboard editing behavior in CodeMirror where possible
- Maintain feature parity before optimizing aesthetics

SUCCESS CRITERIA:
- Users can write in unified mode without visible workflow breakage
- Rendered understanding stays in sync during editing
- No regressions in autosave, preview correctness, or note switching
- Internal links and task checkboxes still behave correctly
- Large notes remain usable enough for real sessions

RISKS TO WATCH:
- cursor/focus behavior when mixing editing and rendered interpretation
- scroll sync and viewport jumpiness
- performance on large notes
- accidental divergence between unified mode and split-preview mode
- interaction conflicts for checkboxes, links, and collapsible headers

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

## B-6 — Quick Note Switcher Unassigned Scope Closes Flyout

CONTEXT:
In the collapsed quick note switcher, selecting the `Unassigned` scope can immediately close the flyout, which breaks fast note navigation.

SCOPE:
public/app/notes.js

EXPECTED BEHAVIOR:
- Selecting `Current Session`, `Unassigned`, or `All Sessions` inside the quick note switcher must keep the flyout open
- Scope changes inside the quick switcher must refresh the list without dismissing the flyout
- Normal outside-click and intentional mouse-leave close behavior must remain intact

---

END
