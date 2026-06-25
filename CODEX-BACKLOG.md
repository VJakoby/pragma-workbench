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


## P2-20 — Target-Scoped Quick Log Filtering
STATUS: DONE

CONTEXT:
Quick Log data supports target association, but entries are still surfaced too broadly across the session. This causes Ports, Paths, and Loot from one target to appear in contexts where another target is active.

SCOPE:
quick log + session/target context filtering

EXPECTED BEHAVIOR:
- `Ports` must show only entries for the active target when a target is selected
- `Paths` must show only entries for the active target when a target is selected
- `Loot` must support both:
  - target-bound entries
  - session-wide entries
- Session-wide loot must remain visible regardless of active target
- If no target is selected, session data may show across the full session
- Duplicate prevention for imported/logged entries must respect `target_id`

RULES:
- Do not duplicate data per target
- Preserve session-wide storage where appropriate
- Use `target_id` as the source of truth for target-bound entries
- Keep unassigned/session-wide entries visible only where that is logically correct

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
STATUS: DONE

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

## P2-23 — Import And Replace Note Template Configuration
STATUS: DONE

CONTEXT:
The app loads `note-templates.json` during startup, but users cannot replace that configuration from the interface. Operators should be able to import a complete template configuration without manually replacing the file on disk.

SCOPE:
note template loading, validation, persistence, and editor toolbar UI

EXPECTED BEHAVIOR:
- Add an `Import template` action under `Note Templates` in the note editor toolbar
- The action must open a file picker for importing a complete note-template JSON file
- A valid import must replace the active `note-templates.json` configuration as one complete document
- Imported template files must be validated with the same schema and rules used when templates are loaded during application startup
- Validation must confirm the full file is structurally valid before the current configuration is replaced
- Invalid files must be rejected without changing the current `note-templates.json`
- Validation errors must be shown clearly enough for the user to identify and correct the invalid file
- Successfully imported templates must replace the current template choices immediately and remain active after restarting the app
- The Note Templates editor must update immediately to show the imported configuration
- Replacement must be atomic so a failed write cannot leave a partial template file

RULES:
- Keep `note-templates.json` as the single active template source
- Reuse one shared validation path for startup loading and manual imports
- Do not maintain separate or weaker validation logic in the browser
- Do not execute content from imported template files as code
- Do not allow an invalid import to corrupt or remove previously valid templates
- Do not merge individual imported templates with the previous configuration
- Keep this feature limited to replacing and loading note templates; do not add a full template marketplace

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

## B-11 — Quick Log Topbar Count Badge Right Padding
STATUS: DONE


CONTEXT:
The small count badges shown on the `Ports`, `Paths`, and `Loot` topbar buttons feel cramped against the right edge, which makes the pill look visually off-balance.

SCOPE:
public/app/styles.css

EXPECTED BEHAVIOR:
- The `Ports`, `Paths`, and `Loot` count badges must have slightly more right-side padding
- The badges must keep their current overall style, color, and placement
- Left-side spacing and alignment must remain visually consistent with the surrounding topbar controls

RULES:
- Keep the change limited to badge spacing only
- Do not redesign the Quick Log topbar buttons
- Do not alter badge color or typography unless strictly required by the spacing fix

---

## B-12 — Unified Search Result Hover Border Too Weak
STATUS: DONE


CONTEXT:
The hover treatment around unified search / command palette results is too subtle. The border does not stand out enough when scanning and hovering multiple results.

SCOPE:
public/app/styles.css

EXPECTED BEHAVIOR:
- Hovering a unified search result must show a more prominent border/frame
- The result should remain visually consistent with the current command palette design
- The stronger hover border must apply to both hovered and keyboard-selected result rows where appropriate

RULES:
- Keep the change limited to command palette result hover/selected styling
- Do not redesign the command palette layout
- Do not broaden scope into result grouping or search logic

---

## B-13 — Context Switcher Target Creation Should Parse Inline Label
STATUS: DONE


CONTEXT:
When creating a new target from the context switcher, entering both an IP/domain and a label in one string currently loses the label information. Example input such as `1.1.1.1 Websrv01` should create the target with the IP preserved and the trailing text used as the target label.

SCOPE:
public/app/targets.js

EXPECTED BEHAVIOR:
- Creating a target from the context switcher must support a value in the form `<ip-or-domain> <label>`
- The first token should be used as the IP or domain value
- The remaining text after the first space should be stored as the target label
- Existing single-value target creation behavior must remain unchanged

RULES:
- Keep the fix limited to context-switcher target creation parsing
- Do not redesign the context switcher UI
- Do not alter existing target switching behavior outside the create-target path

---

## B-14 — Unified Preview Must Respond To Container Width
STATUS: DONE


CONTEXT:
Unified preview mode already supports an automatic stacked layout, but the trigger does not respond correctly to the actual available width of the unified note surface. When adjacent panels such as the KB sideview reduce the editor area, the preview may stay on the right even though the unified surface has become too narrow.

SCOPE:
public/app/styles.css
public/app/note-editor.js

EXPECTED BEHAVIOR:
- In Unified preview mode, wider layouts may continue using the current side-by-side 50/50 editor and preview arrangement
- When the actual available width of the unified note surface becomes too small, the layout must automatically switch so the preview moves below the editor instead of remaining on the right
- The trigger must respond to container/editor-area width, not only overall browser viewport width
- Opening adjacent panels such as the KB sideview must be able to cause the stacked layout when they reduce the unified surface width enough
- The transition must be responsive and automatic, without requiring a manual toggle
- The stacked layout must still preserve normal editing, preview updates, and scrolling behavior

RULES:
- Keep the fix limited to Unified preview layout behavior and its responsiveness trigger
- Do not redesign the broader note editor toolbar or mode-switching behavior
- Do not change classic split preview mode as part of this task

---

## B-15 — Increase KB Side-View Tab Font Size
STATUS: DONE


CONTEXT:
The tabs shown in the KB side-view content panel are slightly too small, which makes section switching feel less readable than the rest of the side-panel UI.

SCOPE:
public/app/styles.css

EXPECTED BEHAVIOR:
- The KB side-view tabs in `content-panel-tabs` must use a slightly larger font size
- The tabs must remain visually consistent with the existing side-panel design
- Spacing, active state, and overflow behavior must remain intact

RULES:
- Keep the change limited to KB side-view tab typography
- Do not redesign the content panel tab layout
- Do not alter unrelated note editor or topbar tab styles

---

## B-16 — Sidebar Lower Section Must Scroll On Short Heights
STATUS: DONE

CONTEXT:
When the browser window becomes short in height, the lower part of the left sidebar can extend beyond the visible viewport and become unreachable. This makes lower sidebar actions and navigation items impossible to click.

SCOPE:
views/partials/sidebar.ejs
public/app/styles.css

EXPECTED BEHAVIOR:
- The left sidebar must remain usable on shorter window heights
- The portion of the sidebar below the divider above `Engagement` must become vertically scrollable when needed
- The active session block at the top may remain fixed while the lower navigation/content section scrolls independently
- Existing sidebar content, spacing, and interaction behavior must otherwise remain intact

RULES:
- Keep the fix limited to sidebar vertical overflow behavior
- Do not redesign the sidebar structure beyond what is required for the scrollable region
- Do not alter unrelated notes list or content panel scrolling behavior

---

## B-17 — Ports Badge Number Is Squeezed Against Right Edge
STATUS: DONE

CONTEXT:
The number inside the `Ports` badge in the topbar Quick Log group sits too close to the right edge of the badge. This makes the count look visually squeezed compared to the other badge treatments in the interface.

SCOPE:
public/app/styles.css

EXPECTED BEHAVIOR:
- The number inside the `Ports` badge must have enough right-side breathing room
- The badge should look visually balanced rather than pressed against the right edge
- The overall Quick Log topbar style and placement must remain unchanged

RULES:
- Keep the fix limited to the `Ports` badge spacing/padding treatment
- Do not redesign the Quick Log topbar group
- Do not alter unrelated badge colors, counts, or behavior

---

## B-18 — Move Topbar Help Button Beside Theme Switcher
STATUS: DONE
CONTEXT:
The `(?)` help button in the topbar currently sits away from the far-right theme controls. It should be repositioned so it lives at the far right of the topbar, directly beside the Light/Dark mode switcher, which makes the topbar controls feel more intentional and grouped.

SCOPE:
views/partials/topbar.ejs
public/app/styles.css

EXPECTED BEHAVIOR:
- The `(?)` help button must move to the far-right side of the topbar
- It must sit directly beside the Light/Dark mode switcher
- Existing help-button behavior must remain unchanged
- Existing theme switcher behavior must remain unchanged
- The surrounding topbar layout should continue to behave correctly across narrower widths

RULES:
- Keep the change limited to topbar control placement and spacing
- Do not redesign unrelated topbar controls
- Do not alter the help modal or theme-switch logic

---

## B-19 — Add Spacing Below Hidden Note Tabs And Use Full Corner Radius
STATUS: DONE
CONTEXT:
The hidden-notes session tab row currently sits directly against the editor surface below it, which makes the layout feel cramped and prevents the tab containers from using the same rounded treatment on all four corners.

SCOPE:
public/app/styles.css
views/partials/main-panel.ejs

EXPECTED BEHAVIOR:
- The hidden-notes session tab row must have a small visual gap above the editor area below it
- A spacing of roughly `5px` between the tab row and editor surface is expected
- The `New` tab container and target-grouped tab containers should use the same current radius on all four corners, not only the top corners
- Existing tab grouping, scrolling, and active-state behavior must remain intact

RULES:
- Keep the change limited to hidden note-tab strip spacing and corner treatment
- Do not redesign the tab grouping logic or note editor structure beyond what is required for this spacing fix
- Do not alter unrelated note editor, sidebar, or topbar layout behavior

---

## B-20 — Some Port Service Links Do Not Resolve To Existing KB Docs
STATUS: DONE
CONTEXT:
Certain services shown in the `Ports` Quick Log view do not link to their matching Knowledge Base documents even though the corresponding markdown file exists and the service is already represented in the KB indexing layer. One example is `RPC`, where `rpc.md` exists but the link resolution still fails.

SCOPE:
public/app/quick-log.js
server/lib/kb-index.js

EXPECTED BEHAVIOR:
- Services shown in the `Ports` view must open the correct KB service document when a matching service document exists
- Existing service mappings and known aliases must be respected consistently
- File-backed service docs such as `rpc.md`, `msrpc.md`, `netbios.md`, `ldaps.md`, `postgresql.md`, and similar known variants should resolve reliably
- Known working service links must remain unchanged

RULES:
- Keep the fix limited to Quick Log port-to-service KB link resolution and supporting KB service slug normalization
- Do not redesign the Quick Log UI
- Do not alter unrelated KB navigation behavior

---

## B-21 — Unified Search Tooltip Should Match Control Label
STATUS: DONE
CONTEXT:
The topbar control is labeled `Unified search`, but its hover tooltip still says `Quick open (Cmd+K)`. This creates inconsistent wording for the same control.

SCOPE:
views/partials/topbar.ejs

EXPECTED BEHAVIOR:
- The unified search trigger tooltip must use wording consistent with the visible control label
- The tooltip should read `Unified search (Cmd+K)`
- Existing shortcut behavior and button layout must remain unchanged

RULES:
- Keep the change limited to unified search trigger wording
- Do not redesign the topbar or search behavior
- Do not alter unrelated tooltips

---

## B-22 — Exclude Hidden/System Folders From Knowledge Base Indexing
STATUS: DONE
CONTEXT:
The current Knowledge Base indexing walks directories recursively and only filters by `.md` extension. Hidden or system folders such as `.git`, `.obsidian`, `.trash`, and similar directories are not explicitly excluded. This means they can still be traversed, and any markdown files inside them could be picked up unintentionally.

SCOPE:
server/lib/kb-index.js
server/lib/unified-search-index.js

EXPECTED BEHAVIOR:
- Knowledge Base indexing must continue to include valid `.md` files in supported KB locations
- Hidden or system folders should be skipped during recursive traversal
- Common directories such as `.git`, `.obsidian`, `.trash`, and other dot-prefixed folders should not be traversed
- Normal visible KB folders and their markdown files must continue to work unchanged

RULES:
- Keep the fix limited to KB traversal/indexing behavior
- Do not redesign KB structure handling
- Do not broaden scope into non-KB filesystem traversal

---

## B-23 — Make Ports Import The Primary Quick Log Action
STATUS: DONE

CONTEXT:
In the `Ports` Quick Log tab, entries are most often added through pasted/imported tool output rather than manual single-line entry. The current button order and styling still presents `+ Add` first, which does not reflect the more common workflow.

SCOPE:
views/partials/topbar-utility-panels.ejs

EXPECTED BEHAVIOR:
- In the `Ports` Quick Log tab, the `Import` button must appear before `+ Add`
- The `Import` button must use the purple primary action styling
- The `+ Add` button must remain available and functional
- The change should apply only to the `Ports` Quick Log tab unless explicitly expanded later

RULES:
- Keep the fix limited to the `Ports` Quick Log button order and visual emphasis
- Do not redesign the broader Quick Log layout
- Do not alter `Paths` or `Loot` button order as part of this task

---

## B-24 — Rename KB Sidebar Subheader To Sections

CONTEXT:
The main sidebar header already says `Knowledge Base`, so the current subheader label `Discovered Sections` feels overly verbose and slightly awkward in context.

SCOPE:
views/partials/sidebar.ejs

EXPECTED BEHAVIOR:
- The KB sidebar subheader should use the simpler label `Sections`
- The change should remain purely textual
- Existing KB sidebar behavior must remain unchanged

RULES:
- Keep the fix limited to the sidebar subheader wording
- Do not redesign the sidebar layout
- Do not alter unrelated KB labels or navigation behavior

---

## B-25 — Clarify Attachment Storage Note Roles And Widen Modal
STATUS: DONE

CONTEXT:
In the attachment storage modal, the owner note and secondary linked notes use different visual treatments, but they are not labeled clearly enough. This makes it harder to understand which note owns the attachment versus which notes only reference it. The modal also feels too narrow when the list grows.

SCOPE:
public/app/notes.js
public/app/styles.css

EXPECTED BEHAVIOR:
- The attachment storage modal must make the note relationship explicit
- The owning note should be labeled clearly, for example with an `Owner` tag before the note title
- Secondary referenced notes should be labeled clearly, for example with a `Link` tag before each note title
- The modal should be wider so attachment cards and linked-note rows have more horizontal space
- Existing attachment open/navigation behavior must remain unchanged

RULES:
- Keep the change limited to attachment storage modal labeling and width/layout styling
- Do not redesign unrelated sidebar storage behavior
- Do not alter attachment tracking or note-linking logic

---

## B-26 — Make Session Creation Modal More Guided And Clearly Segmented
STATUS: DONE

CONTEXT:
The session modal opened from the `Active Session` control currently presents session creation fields and the existing-session list as one continuous surface. It works, but it does not feel especially guided for first use, and the boundary between creating a new engagement and selecting an existing one is too weak.

SCOPE:
views/partials/overlays.ejs
public/app/styles.css
public/app/workbench.js

EXPECTED BEHAVIOR:
- The upper portion of the modal should read clearly as a guided `Create Engagement Session` area
- The creation area should feel more welcoming and intentional, with clearer section heading/copy than the current plain field stack
- The existing sessions list should be visually separated in the lower portion of the modal using a distinct border, panel, divider, or similarly clear grouping treatment
- The modal itself should be slightly wider to give both the form and the session list more breathing room
- Creating a session from this modal should immediately close the modal and leave the new session opened/active
- Existing import/select session behavior must remain unchanged

RULES:
- Keep the change limited to the session modal opened from the sidebar `Active Session` control
- Do not redesign the first-run welcome modal as part of this task
- Do not alter session creation logic beyond what is needed for the guided presentation
- Preserve existing keyboard and click behavior for creating, importing, and switching sessions

---

## B-27 — Move Backup Workbench Into Session Modal Utilities

CONTEXT:
`Backup Workbench` is a useful safety/export action, but it is secondary compared to the active session context and day-to-day navigation. Keeping it in the sidebar gives it too much persistent weight for an action that is used occasionally rather than continuously.

SCOPE:
views/partials/sidebar.ejs
views/partials/overlays.ejs
public/app/styles.css
public/app/workbench.js

EXPECTED BEHAVIOR:
- `Backup Workbench` should no longer appear in the main left sidebar
- The action should instead appear inside the session modal opened from `Active Engagement Session`
- Inside that modal, it should live in the `Existing Sessions` section, below the section heading/copy and above the session list
- The button should use a secondary/utility visual treatment, not a primary create-action treatment
- Existing backup behavior and visibility rules must remain unchanged

RULES:
- Keep the change limited to relocating and styling the `Backup Workbench` control
- Do not redesign encrypted workbench behavior as part of this task
- Do not alter backup generation/download logic unless required for the relocation
- Preserve current enable/disable visibility behavior for encrypted vs non-encrypted modes

---

## B-28 — Remove Obsolete Notes List Peek Button

CONTEXT:
The hidden-notes workflow now has session tabs and grouped target tabs for fast note switching. The older edge-mounted `Quick note switcher` / peek button is no longer necessary and adds redundant chrome beside the editor.

SCOPE:
views/partials/main-panel.ejs
public/app/styles.css
public/app/app.js

EXPECTED BEHAVIOR:
- The `notes-list-peek-btn` edge button should be removed
- The remaining `Show notes list` edge button should stay available
- The remaining edge button should be visually centered/positioned cleanly on its own instead of sharing space with a second control
- Existing show/hide notes-list behavior must remain unchanged
- Hidden-notes tab switching behavior must remain unchanged

RULES:
- Keep the change limited to removing the obsolete peek button and re-centering the remaining edge button
- Do not redesign the hidden-notes tab strip as part of this task
- Do not change note switching behavior outside the removed peek control
## B-29 — Center Double-Digit Ports Badge Count

CONTEXT:
The `Ports` count badge in the topbar Quick Log control looks acceptable with single-digit values, but when the count reaches `10` or higher the number appears visually offset inside the pill. This makes the badge feel unbalanced compared to the other count indicators.

SCOPE:
public/app/styles.css

EXPECTED BEHAVIOR:
- The `Ports` topbar count badge should keep its number visually centered for both single-digit and double-digit values
- The badge should preserve its current overall style, color, and placement
- Existing `Paths` and `Loot` badge behavior must remain unchanged unless the same fix is naturally shared by the same styling rule

RULES:
- Keep the change limited to badge centering/alignment styling
- Do not redesign the Quick Log topbar group
- Do not alter badge values, behavior, or visibility logic

---

## B-32 — Rename Evidence Workflow To Findings
STATUS: DONE

CONTEXT:
The current `Evidence` wording suggests raw proof collection, but the feature is increasingly being used as an operator-facing way to track reportable issues. In a pentest or CTF-style engagement workflow, `Findings` is clearer and better aligned with how operators think about issues they may want to summarize or report later.

SCOPE:
findings/evidence UI labels and wording

EXPECTED BEHAVIOR:
- User-facing `Evidence` labels should be renamed to `Findings` where the feature represents issue tracking rather than raw proof storage
- The rename should apply consistently across topbar controls, modal titles, helper text, and related interface wording
- Existing underlying behavior may remain unchanged in the first pass

RULES:
- Keep the first pass focused on naming and wording consistency
- Do not redesign the broader workflow as part of the rename alone
- Do not remove any raw proof capability that may still support the feature internally

---

## B-33 — Add Structured Findings Data Model

CONTEXT:
If the current `Evidence` workflow evolves into `Findings`, the platform needs a more structured finding representation than free-form issue text alone. This should support a pentest/report workflow without replacing normal engagement notes.

SCOPE:
findings data model and persistence

EXPECTED BEHAVIOR:
- Findings should support structured fields such as:
  - `title`
  - `severity`
  - `type`
  - `summary`
  - `poc`
  - `impact`
  - `recommendation`
  - `status`
- Findings should be session-scoped with host association support
- A finding should support at least one primary host, with room for optional expansion to multiple affected hosts later
- Existing engagement notes should remain separate from findings

RULES:
- Keep the model compatible with the existing engagement workflow
- Do not force findings to replace normal notes
- Prefer a model that can support both host-specific and broader session-wide findings over time

---

## B-34 — Generate Engagement Summary And Target Findings Notes
STATUS: DONE

CONTEXT:
Operators may want derived report-oriented notes that stay current as targets, Ports, Paths, Loot, and Findings change. The platform should generate these notes automatically rather than requiring manual maintenance, so the engagement always has an up-to-date high-level summary and target-specific findings view.

SCOPE:
generated markdown notes derived from engagement data

EXPECTED BEHAVIOR:
- The platform should generate and update one session-level engagement summary note per session
- The engagement summary note title should match the exact session name
- The platform should also generate and update one target-level findings note per target that has target-associated findings
- Target findings note titles should follow the pattern `FINDINGS - <LABEL>`
- If a target has no label, the title should fall back to `FINDINGS - <IP>` or another stable target identifier already present in the session
- Generated notes should be derived from structured data and existing quick-log/session data, not treated as the source of truth
- The engagement summary note should include at least these sections:
  - `# <SESSIONNAME>`
  - `## Targets`
  - `## Credentials`
  - `## Findings`
- The `## Targets` section should summarize each target in the session in table form, including at least:
  - IP / host
  - label
  - useful target summary context derived from stored target/quick-log data
- The `## Credentials` section should be populated from session Loot data and kept updated automatically
- The `## Findings` section in the engagement summary should contain all findings across the session, including target-associated and session-wide findings
- Target-scoped Ports and Paths data should feed the generated summary where relevant to target overview, but should not become the primary source of truth
- Each generated target findings note should contain the findings associated with that target only
- Finding content in generated notes should include structured fields such as:
  - title
  - severity
  - type
  - target
  - summary
  - recommendation
  - POC
- Updating targets, Ports, Paths, Loot, or Findings should update the corresponding generated notes automatically

RULES:
- Do not replace primary engagement notes with generated summaries
- Keep generated markdown notes as derived artifacts, not the authoritative source
- Do not force operators to maintain generated notes manually
- Prefer one generated findings note per target rather than one generated note per finding
- Do not duplicate the entire engagement note system inside the generated summaries

---

## B-35 — Link Findings And Generated Notes To Supporting Notes And Proof
STATUS: DONE

CONTEXT:
Generated summary notes and target findings notes become much more useful when findings can still be traced back to the underlying note content, proof commands, loot, and related operator context that supports them.

SCOPE:
findings linkage and supporting-reference workflow

EXPECTED BEHAVIOR:
- A finding should support links or references to supporting material such as:
  - engagement notes
  - commands or proof text
  - loot/credentials where relevant
  - attachments/screenshots where already supported by the platform
- Operators should be able to move from a finding to its supporting context quickly
- Generated engagement summary notes should remain derived output, but should be built from findings that preserve their supporting links and references
- Generated target findings notes should preserve the useful supporting context needed for review and later reporting
- Findings created from note selections should remain linked to the originating note context
- Manually created findings should still support later linkage to note/proof context where available
- Supporting references should improve report-readiness without changing the normal note-taking flow

RULES:
- Keep findings as the structured issue layer, not a duplicate full note system
- Do not require every finding to have every kind of supporting reference
- Preserve existing note and attachment behavior where possible
- Do not make generated notes the source of truth for linkage data

---

## B-36 — Reduce Unified Search Recent Item Height
STATUS: DONE

CONTEXT:
The previous-search cards shown in the unified search are taller than needed and take up too much vertical space compared with the amount of content they contain.

SCOPE:
public/app/styles.css
public/app/app.js

EXPECTED BEHAVIOR:
- Previous-search cards in unified search should use a more compact height
- The cards should remain readable and keep their existing actions usable
- Normal unified search result rows must keep their current height and spacing

RULES:
- Keep the change limited to recent/previous-search card styling
- Do not change unified search behavior or stored search history
- Do not alter the sizing of other search result types

---

## B-37 — Deduplicate Unified Search Recent Entries
STATUS: DONE

CONTEXT:
Unified search can show multiple recent-search cards that represent the same search term, making the recent list repetitive and reducing the variety of useful search history shown.

SCOPE:
public/app/app.js

EXPECTED BEHAVIOR:
- Unified search should show each recent search term only once
- Repeating an existing search should move that term to the most recent position instead of adding another identical card
- Deduplication should handle equivalent terms consistently, including accidental surrounding whitespace
- Existing recent-search selection and removal behavior must remain unchanged

RULES:
- Keep the change limited to unified-search history storage and display
- Do not change normal unified-search result ranking or matching
- Preserve the current maximum number of recent searches

---

## B-38 — Match Create Note Tab Left Border Thickness
STATUS: DONE

CONTEXT:
The left border of the `session-note-tab session-note-tab-create` control appears slightly thinner than the other sides, making the create button frame look uneven.

SCOPE:
public/app/styles.css

EXPECTED BEHAVIOR:
- The create note tab must use the same visible border thickness on its left side as on its top, right, and bottom sides
- The border must remain visually consistent in both light and dark mode
- Existing create-tab sizing, spacing, hover state, and behavior must remain unchanged

RULES:
- Keep the change limited to the create note tab border styling
- Do not redesign the hidden note-tab strip
- Do not alter note creation behavior

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

## B-7 — Legacy KB Directory Auto-Creates With Underscore Name
STATUS: DONE

CONTEXT:
During startup integrity checks, the app can auto-create the configured knowledge-base root if it does not exist yet. In some environments, a legacy `knowledge_base` path is still being used, which causes the app to create an underscore-named directory instead of the intended `knowledge-base` path.

SCOPE:
server/config/paths.js
server/lib/startup-check.js

EXPECTED BEHAVIOR:
- The auto-created KB root directory must resolve to `knowledge-base`, not `knowledge_base`
- Legacy underscore-style KB path configuration should be normalized to the hyphenated directory name before startup creation runs
- Startup directory creation behavior should otherwise remain unchanged

## B-8 — Clarify Quick Log And Findings Modal Guidance Copy
STATUS: DONE


CONTEXT:
The informational guidance text inside the Findings, Ports, Paths, and Loot modal surfaces is currently too narrow or implicit about the intended workflow. Operators should understand that these are supporting convenience features for structured tracking, not required entry points for using the platform.

SCOPE:
modal guidance / helper copy for Findings and Quick Log sections

EXPECTED BEHAVIOR:
- The Findings modal information text should explain that Findings is a supporting feature for structured issue tracking
- The copy should make clear that operators are not required to use Findings, and can still document everything manually in normal notes if preferred
- The Ports, Paths, and Loot modal information text should similarly explain that these are supporting structured helpers, not mandatory workflow steps
- Updated copy should remain concise, practical, and aligned with the existing operator-focused tone

RULES:
- Do not change modal behavior as part of this task
- Do not rename features or alter data flow as part of this task
- Keep this limited to user-facing explanatory text improvements

## B-9 — Restrict Target-Bound Items To Existing Session Targets
STATUS: DONE


CONTEXT:
Operators can currently end up assigning target-bound workflow items such as Ports, Paths, Loot, and Findings against hosts that do not exist as real targets in the active session. That creates inconsistent navigation and summary behavior because generated notes and scoped views assume target-bound data points back to a valid session target.

SCOPE:
target assignment and validation for Ports, Paths, Loot, and Findings

EXPECTED BEHAVIOR:
- Ports, Paths, Loot, and Findings must only be assignable to existing targets in the active session
- Target selection for these target-bound workflows should come from session-target dropdowns or equivalent validated selectors, not free-form non-target host values
- New entries must not create or preserve invalid target bindings to hosts that do not exist in the session target list
- Where a target is removed or invalid legacy target-bound data is encountered, the UI should fall back safely or block the invalid binding visibly rather than silently keeping ghost host references
- Generated summaries, findings notes, and scoped modal views must remain consistent with the validated session target list

RULES:
- Do not auto-create new targets as part of this task
- Do not widen scope into changing session-wide item behavior unless required for target validation
- Keep the fix focused on target validity, selector UX, and preventing ghost/non-existent host bindings

## B-10 — Prevent Long Credential Values From Breaking Loot Table Layout
STATUS: DONE


CONTEXT:
Very long credential or hash values in the Loot table can force the table width so far that the surrounding host, type, and context fields become difficult or impossible to see during live work.

SCOPE:
Loot table layout and long-value rendering

EXPECTED BEHAVIOR:
- Very long credential, token, or hash values must not break the Loot table layout
- The Loot table should continue showing surrounding fields such as type, host, and context even when one value is extremely long
- Long values should remain readable and copyable without requiring the operator to lose the rest of the row context
- The solution should work in both light and dark mode

RULES:
- Keep the fix limited to Loot table presentation and usability for long values
- Do not redesign the broader Quick Log layout as part of this task
- Preserve current copy behavior for credential values if already present

## B-19 — Polish Long Loot Credential Display

CONTEXT:
After stabilizing the Loot table layout, extremely long credential or hash values still look visually awkward when fully wrapped across multiple lines. Operators need a cleaner table presentation without losing copyability or the surrounding row context.

SCOPE:
Loot credential cell display treatment

EXPECTED BEHAVIOR:
- Very long Loot credential values should display in a cleaner abbreviated form inside the table
- The full underlying value must still remain copyable from the existing click-to-copy interaction
- The abbreviated display should preserve enough of the value to be recognizable at a glance
- The surrounding Host and Context columns must remain readable and stable
- The treatment should work in both light and dark mode

RULES:
- Keep the fix limited to Loot credential display treatment
- Do not change stored Loot data
- Do not remove existing copy behavior

## B-36 — Normalize Findings Summary Severity And Target Display
STATUS: DONE


CONTEXT:
The generated findings summary output is functionally correct, but small presentation inconsistencies remain. Severity values currently expose raw internal values, and target display can vary between summary surfaces. A small normalization pass would make the generated findings output easier to scan without changing workflow or data flow.

SCOPE:
public/app/notes.js

EXPECTED BEHAVIOR:
- Generated findings summaries should render severity labels in a normalized human-readable form such as `Critical`, `High`, `Medium`, `Low`, and `Info`
- Generated findings target display should use one consistent operator-readable format across the engagement summary and target findings notes
- Session-wide findings should remain clearly labeled as `Session-wide`
- The change should remain presentation-only and must not alter stored finding data

RULES:
- Keep the change limited to generated findings summary and findings-note formatting
- Do not redesign the broader findings workflow
- Do not change underlying findings storage or sorting as part of this task


## B-37 — Increase Findings List Title Font Size
STATUS: DONE

CONTEXT:
The title text shown for findings entries in the Findings modal reads slightly smaller than ideal, which makes the list feel denser than necessary. A minor font-size increase should improve scanability without changing the layout structure.

SCOPE:
public/app/styles.css

EXPECTED BEHAVIOR:
- Findings entry titles should render at a slightly larger font size than they do today
- The change should preserve the current findings list layout and wrapping behavior
- The updated sizing should remain consistent in both light and dark mode

RULES:
- Keep the change limited to findings list title presentation
- Do not redesign the findings modal layout
- Do not alter unrelated Quick Log or note styling


## B-38 — Default New Browsers To Light Theme
STATUS: TODO

CONTEXT:
When a browser opens the workbench for the first time and no theme preference has been stored yet, the interface currently defaults to dark mode. The preferred first-run behavior is to start in light mode unless the user has already explicitly chosen a theme.

SCOPE:
public/app/shell.js

EXPECTED BEHAVIOR:
- A browser with no stored `ops-theme` preference should load the workbench in light mode by default
- Existing saved theme preferences must continue to override the default
- Theme switching behavior after load must remain unchanged

RULES:
- Keep the change limited to theme initialization/default selection
- Do not redesign the theme toggle UI
- Do not alter saved preference keys or storage behavior


## B-39 — Refresh Injected Note Context After Target Or Session Changes
STATUS: TODO

CONTEXT:
Injected placeholders in note preview surfaces depend on the active target and session context, but those surfaces do not currently refresh when the operator adds, switches, renames, or otherwise changes target/session context while a note remains open. This leaves stale injected values visible until the note is manually reopened or refreshed.

SCOPE:
public/app/note-editor.js
public/app/targets.js
public/app/workbench.js

EXPECTED BEHAVIOR:
- Open note preview surfaces should refresh automatically when active target context changes
- Open note preview surfaces should refresh automatically when target metadata changes in ways that affect injected placeholders
- Open note preview surfaces should refresh automatically when session-level context such as session domain or attacker IP changes
- The change should work for standard preview and unified preview modes

RULES:
- Keep the change limited to live note-context refresh behavior
- Do not redesign placeholder injection rules as part of this task
- Do not force unnecessary full note reopen flows when a targeted preview refresh is sufficient

## B-40 — Align Sidebar And KB Card Hover Treatment
STATUS: TODO

CONTEXT:
Hover feedback across the sidebar and Knowledge Base cards currently uses a lighter or less consistent visual treatment than the unified search results. This makes the UI feel uneven when moving between navigation surfaces.

SCOPE:
public/app/styles.css

EXPECTED BEHAVIOR:
- Sidebar clickable items should use the same general hover language as unified search results
- Knowledge Base cards such as services and tactics should use the same general hover language as unified search results
- Hover feedback should feel more prominent and visually consistent without causing layout shift
- The change should remain consistent in both light and dark mode

RULES:
- Keep the change limited to hover presentation for sidebar items and KB cards
- Do not redesign unrelated controls or card layout structure
- Do not introduce hover-driven movement or layout jank


## B-41 — Increase TODO Modal Width
STATUS: TODO

CONTEXT:
The current TODO modal feels slightly too narrow for the add row and list content, which makes the panel feel more cramped than adjacent utility surfaces.

SCOPE:
public/app/styles.css

EXPECTED BEHAVIOR:
- The TODO modal should render slightly wider on desktop-sized layouts
- The existing responsive/mobile behavior must remain intact
- No other TODO modal layout behavior should change

RULES:
- Keep the change limited to TODO modal width
- Do not redesign the broader TODO workflow or content structure
- Do not alter the existing small-screen responsive override


## B-42 — Clarify File-Based Note Template Configuration UI
STATUS: TODO

CONTEXT:
The current note-template configuration screen uses labels that imply a richer template editor, even though this branch only supports editing and replacing the raw `note-templates.json` file. That can mislead operators into expecting a structured GUI workflow that does not exist here.

SCOPE:
views/partials/sidebar.ejs
views/partials/main-panel.ejs
public/app/notes.js
public/app/styles.css

EXPECTED BEHAVIOR:
- The configuration entry should clearly read as a file-based template configuration surface
- In-view labels should not imply a structured template designer or builder
- The import action should clearly read as replacing the full template file
- The config view should include a short explanation that the operator is editing the raw `note-templates.json` file directly
- No underlying template behavior should change

RULES:
- Keep the change limited to labels, helper text, and presentation for the template config view
- Do not reintroduce or simulate the older structured template editor
- Do not change template parsing, validation, import, or persistence behavior


## B-43 — Replace Inter Editor Font Option With IBM Plex Mono
STATUS: TODO

CONTEXT:
The note editor font switcher currently offers `Inter`, which does not fit the editor as well as a stronger writing-oriented monospace choice. The desired change is to keep the switcher note-editor-only and replace the `Inter` option with `IBM Plex Mono`.

SCOPE:
public/app/editor-theme.js
views/partials/main-panel.ejs
views/partials/head.ejs

EXPECTED BEHAVIOR:
- The note editor font choices should offer `Classic`, `Mono`, and `Plex`
- The previous `Inter` editor option should be removed from the note editor switcher
- Selecting `Plex` should apply `IBM Plex Mono` only to the note editor font setting
- Existing saved editor font preferences that still point to the old `Inter` option should migrate cleanly to `Plex`
- No broader UI font usage should change outside the note editor font setting

RULES:
- Keep the change limited to the note editor font option set and supporting font import/mapping
- Do not change the broader application typography system
- Do not expand the font switcher beyond replacing the existing option


## B-44 — Add Session-Scoped Scope Assets With Text Import
STATUS: TODO

CONTEXT:
Some engagements, especially web pentests, involve many domains, subdomains, hosts, or URLs that belong to the assessment scope but should not automatically become full PRAGMA targets. The current target model is better suited for focused operational contexts with notes, ports, paths, loot, and target-specific workflows. A lighter session-scoped asset list is needed for broader engagement scope tracking.

SCOPE:
session data model
scope asset UI
plain-text import flow
optional target-promotion hook

EXPECTED BEHAVIOR:
- Add a new session-scoped collection for `Scope Assets`
- Scope Assets must be separate from existing PRAGMA targets
- A Scope Asset may represent items such as:
  - domain
  - subdomain
  - host
  - URL
- Users must be able to import Scope Assets from a plain text file where each line represents one asset
- Imported lines must create Scope Assets only; they must not automatically create PRAGMA targets
- Scope Assets must remain attached to the current session only
- The UI must make the distinction clear between:
  - `Scope Assets` as engagement scope records
  - `Targets` as focused PRAGMA operational targets
- The design should leave room for a later optional action to promote a Scope Asset into a real PRAGMA target

DATA / VALIDATION RULES:
- Ignore blank lines during import
- Trim surrounding whitespace from each imported line
- Preserve the original imported value as the visible asset label/value
- Do not require assets to resolve or validate online during import
- Prevent obvious duplicate asset entries within the same session when the normalized line matches an existing asset
- Keep the initial asset model lightweight; do not require notes, ports, or loot fields on Scope Assets

RULES:
- Do not merge Scope Assets into the existing PRAGMA target model
- Do not auto-create notes, ports, paths, loot, or findings for imported Scope Assets
- Do not treat imported web scope entries as active workspace targets by default
- Keep the first implementation focused on session-scoped storage, listing, and plain-text import
- Leave promotion into a full PRAGMA target as a later extension, not part of the initial implementation

END

## B-51 — Generate Session Services Note From Quick Log Ports
STATUS: DONE

CONTEXT:
Operators currently need to create and structure separate investigation notes manually for each discovered service after logging ports in Quick Log. That adds friction once several ports need follow-up. A generated markdown note should provide a ready-made investigation surface by turning the current Quick Log Ports inventory into service subsections automatically, while still staying synchronized when port or service values change later.

SCOPE:
generated note pipeline
Quick Log Ports → markdown synchronization
service investigation note rendering

EXPECTED BEHAVIOR:
- A generated note named `Services` must be created for the active session when relevant Quick Log Ports data exists
- The generated note must start with:
  - `# Services`
- Each logged Quick Log Ports entry should create its own markdown subsection, for example:
  - `## 80 / http`
- The subsection heading content must be derived from the current Quick Log Ports data, using the port number and resolved service name
- The generated note is intended as an investigation workspace, so the operator can write service-specific notes directly beneath each generated subsection
- If a Quick Log Ports entry changes later, the generated service subsection heading must update to match the latest port/service values
- If ports are removed, the generated structure must reflect that removal appropriately
- The feature should follow the same generated-note model already used for other synchronized notes such as credentials/network-enumeration style notes

SYNC / CONTENT RULES:
- The generated structure must be based on session Quick Log Ports data, respecting the app's current scoping rules for ports
- The generated note should preserve operator-written content beneath each service subsection when possible, rather than wiping investigation text on every sync
- Stable section identity should be used so updates map to the correct service block even after reorder or rename
- The generated note should not require the operator to create separate manual notes just to begin documenting service investigation steps

RULES:
- Keep the first implementation focused on generating and synchronizing the `Services` markdown note from Quick Log Ports
- Do not expand this task into KB auto-linking redesign or per-service standalone note creation unless required later
- Do not replace existing manual note creation features; this is an additional generated investigation surface

END

## B-50 — Increase Context Switcher Item Typography
STATUS: DONE

CONTEXT:
The target/session context switcher item text is currently slightly too small, especially the target or session label line and the smaller meta line beneath it. A small typography increase is needed so both lines are easier to scan without changing the structure or behavior of the switcher.

SCOPE:
public/app/styles.css

EXPECTED BEHAVIOR:
- The main context switcher item title/label must render slightly larger
- The context switcher item meta line must also render slightly larger
- Existing layout, truncation, and interaction behavior must remain unchanged

RULES:
- Keep the change limited to context switcher item typography
- Do not redesign spacing, badges, or selection behavior

END

## B-49 — Keep Context Switcher Open When Quick-Creating Targets
STATUS: DONE

CONTEXT:
The Switch target/session modal currently closes immediately after a new target is quick-created from within the target tab. That slows down workflows where the operator wants to add several targets in sequence from the same modal. The modal should stay open for repeated target creation and only close when the operator explicitly dismisses it or selects an existing target/session.

SCOPE:
public/app/targets.js

EXPECTED BEHAVIOR:
- Quick-creating a new target from the context switcher must not close the modal
- After creating a target, the input should reset so another target can be added immediately
- Existing behavior for switching to an existing target or session should remain unchanged
- Existing behavior for quick-creating a new session can remain unchanged

RULES:
- Keep the change limited to the context-switcher quick-create target flow
- Do not redesign the broader context switcher UI or target management panel

END

## B-48 — Keep Backup Workbench Action In Session Modal For All Storage Modes
STATUS: DONE

CONTEXT:
The backup workbench action is currently shown inside the session modal in plaintext mode, but moves back into the sidebar when encrypted storage is active. That creates inconsistent UI placement for the same action depending on storage mode. The backup/export action should remain in the same session-modal location regardless of whether the workbench is encrypted or plaintext.

SCOPE:
views/partials/sidebar.ejs
views/partials/overlays.ejs
public/app/workbench.js

EXPECTED BEHAVIOR:
- The backup workbench action must remain inside the session modal utility area in both plaintext and encrypted modes
- Activating encrypted storage must not reintroduce a separate sidebar backup button
- The session-modal backup button must trigger the appropriate existing download behavior for the active storage mode
- Existing encrypted toggle behavior must remain unchanged

RULES:
- Keep the change limited to backup button placement and mode-aware button wiring
- Do not redesign the broader session modal or encrypted storage workflow

END

## B-47 — Add Visual Separators Between Generated Target Findings
STATUS: DONE

CONTEXT:
Generated target findings notes currently render findings back-to-back, which makes the document harder to scan once several findings exist for the same target. A lightweight markdown separator is needed between each finding section without changing the actual finding content structure.

SCOPE:
public/app/notes.js

EXPECTED BEHAVIOR:
- In generated target findings notes, each finding after the first must be preceded by a blank line and a markdown horizontal rule using `---`
- The first finding in the note must not gain a leading separator
- Existing section content, parser markers, and finding sync behavior must remain unchanged

RULES:
- Keep the change limited to generated target findings note formatting
- Do not change findings data, parsing logic, or other generated note formats

END

## B-46 — Fix Findings Sync and Encrypted Unified Search Indexing
STATUS: DONE

CONTEXT:
Recent review findings identified three correctness issues in the new findings and encrypted-workbench flows. Generated target findings notes now render markdown fields in a format that no longer matches the parser used to sync edits back into session findings. The generated findings sync also relies on section order instead of stable finding identity, which risks applying edits to the wrong finding after reorder or deletion. Separately, unified search watches encrypted workbench files but does not enumerate encrypted-only workbench names, so local notes can disappear from search when plaintext workbench files are absent.

SCOPE:
public/app/notes.js
server/lib/unified-search-index.js

EXPECTED BEHAVIOR:
- Generated target findings note parsing must match the current markdown field format written by the note generator
- Syncing generated target findings note edits back into session findings must use stable finding identity instead of section index position
- Unified search must index local notes from encrypted-only workbench files the same way it indexes plaintext workbench files
- Existing findings note editing flow and existing unified search behavior for plaintext workbenches must continue to work

RULES:
- Keep the change limited to generated findings parsing/sync behavior and unified search workbench discovery
- Do not redesign the findings markdown format beyond what is required for reliable parsing and sync
- Do not broaden the task into unrelated findings UI changes or general search refactors

END

## B-45 — Fix Mixed Attachment Storage During Encrypted Workbench Migration
STATUS: DONE

CONTEXT:
The workbench can currently end up in a mixed state where the main `.workbench` file is plaintext while one or more referenced note attachments still exist only as encrypted `.enc` payloads. When the operator later enables `Encrypted Workbench`, attachment migration can fail with `Wrong password or corrupted data`, even though the main workbench flow should remain usable.

SCOPE:
public/app/note-editor.js
public/app/workbench.js
server/lib/note-attachments.js
server/routes/notes.js

EXPECTED BEHAVIOR:
- Enabling `Encrypted Workbench` must not fail simply because referenced attachments are already stored as encrypted blobs from an earlier state
- The attachment migration flow must handle mixed attachment state safely when moving into encrypted mode
- Plaintext workbench saves must not continue preserving encrypted attachment siblings for the same referenced files
- Encrypted workbench saves must not continue preserving plaintext attachment siblings for the same referenced files
- Existing attachment URLs and note markdown references must remain unchanged
- Existing successful attachment upload, render, and export behavior must continue to work

RULES:
- Keep the change limited to attachment storage normalization and encrypted-workbench migration behavior
- Do not redesign the broader encrypted workbench UX beyond what is required to recover from the mixed attachment state
- Do not alter note body attachment URL format
- Do not broaden the task into unrelated note editor or sidebar changes

END


## B-52 — Session Modal Toggles For Generated Helper Notes
STATUS: DONE

CONTEXT:
The app now generates helper notes such as the target-scoped `Services` note from Quick Log Ports and the session summary note. Those generated notes are useful for many engagements, but they should remain optional because some operators prefer to manage those notes manually. The toggle belongs in the session management modal so the operator can control generated-note behavior at the engagement level rather than as a global app preference.

SCOPE:
session management modal UI
session settings persistence
generated services note sync
generated session summary sync

EXPECTED BEHAVIOR:
- The session management modal must include a small `Generated helper notes` section
- That section must include checkboxes for:
  - auto-create/update the generated `Services` notes from Quick Log Ports
  - auto-create/update the generated session summary note
- The section must include a brief explanatory helper text clarifying that these notes are optional helper notes generated from engagement data
- The toggle state must persist with the current session
- Existing sessions that do not yet define these settings must default to the current behavior, meaning generated helper notes remain enabled
- When a toggle is disabled, the corresponding generated-note sync path must stop auto-creating and auto-updating that note type for the session
- When a toggle is re-enabled, the corresponding generated-note sync path must resume normally from current session data

RULES:
- Keep the setting session-scoped rather than global
- Keep the UI inside the existing session management modal
- Keep the helper text brief and operationally clear
- Do not redesign unrelated parts of the session modal
- Do not broaden the task into a general settings framework
- Do not change the underlying generated-note formats beyond what is needed to gate their sync behavior

END


## B-53 — Consolidate Active Directory Tactic Documents Into ad.md
STATUS: TODO

CONTEXT:
The Active Directory tactic material is currently split across `ad.md`, `ad-lateral-movement.md`, and `ad-tactical-guide.md`. The content overlaps in scope and forces the operator to jump between multiple related documents for one AD workflow. The goal is to consolidate those notes into a single, stronger `ad.md` tactical workflow while preserving the practical commands, notes, and markdown structure already captured across the three files.

SCOPE:
knowledge-base/tactics/active-directory/ad.md
source material from:
- knowledge-base/tactics/active-directory/ad-lateral-movement.md
- knowledge-base/tactics/active-directory/ad-tactical-guide.md

EXPECTED BEHAVIOR:
- `ad.md` must become the consolidated Active Directory workflow / tactic document
- The merged `ad.md` must preserve the useful commands, notes, and markdown content from all three source files
- The merged structure should remove obvious duplication where the same tactic appears multiple times, while still keeping the operational detail intact
- The merged structure should read as one coherent AD workflow, covering enumeration, access, movement, escalation, persistence, and cracking references where applicable
- Existing source files must remain unchanged during this task so the merged result can be reviewed safely before any manual cleanup
- Internal links or file references inside the merged `ad.md` should be corrected if they point to outdated or mismatched filenames

RULES:
- Keep the task limited to consolidating the AD tactic content into `ad.md`
- Do not delete, rename, or move the old source files in this task
- Preserve markdown formatting and practical operator notes wherever possible
- Prefer structural consolidation over prose rewriting
- Do not broaden the task into a larger KB taxonomy or navigation redesign
## B-54 — Show Tactic Subcategory Badges In Unified Search Results
STATUS: DONE

CONTEXT:
Unified search results currently show only the broad result type, such as note, tactic, or service. For tactic documents this hides useful context, because the operator cannot immediately see whether a result belongs to a subcategory such as Windows, Linux, or Active Directory. The search results should expose that subcategory directly and visually separate it from the existing type badge.

SCOPE:
public/app/search.js
public/app/styles.css
server/lib/unified-search-index.js (only if result metadata needs to be exposed)

EXPECTED BEHAVIOR:
- Unified search results must continue to show the primary result type badge
- Tactic results must also show their tactic subcategory when that metadata is available
- The tactic subcategory should be rendered as a blue badge
- The tactic subcategory badge should appear beneath the current right-side type badge area rather than replacing it
- Existing type badges should use clearer distinct colors so note, tactic, and service results are easier to differentiate visually
- Non-tactic results must not gain fake or empty subcategory badges
- Existing search ranking, navigation, and click behavior must remain unchanged

RULES:
- Keep the task limited to unified search result metadata display and badge styling
- Prefer reusing existing indexed metadata if already available before expanding server payload shape
- Do not redesign the broader unified search layout beyond the badge presentation required for this task
- Do not change search scoring, filtering, or indexing behavior unless strictly needed to surface existing tactic subcategory metadata

END

## B-55 — Share Editor Theme Controls With KB Editor
STATUS: DONE

CONTEXT:
The note editor already exposes syntax theme and editor font controls, and those preferences are stored as shared editor settings. The KB editor uses the same underlying theme system internally, but the controls are not exposed in the KB edit toolbar. This creates an inconsistent experience because the KB editor follows the shared settings without giving the operator the same direct access to them while editing KB content.

SCOPE:
views/partials/content-panel.ejs
views/partials/main-panel.ejs
public/app/editor-theme.js
public/app/kb-editor.js

EXPECTED BEHAVIOR:
- The KB editor toolbar must expose the same syntax theme picker as the main note editor
- The KB editor toolbar must expose the same editor font family controls as the main note editor
- The KB editor toolbar must expose the same editor font size controls as the main note editor
- Theme and font settings must remain shared globally between the note editor and KB editor
- Changing theme or font from either editor must immediately reflect in the other editor controls and editor surface
- Entering KB edit mode must show the currently active shared theme and font state without requiring manual refresh
- Existing KB preview, save, and edit behavior must remain unchanged

RULES:
- Keep the task limited to exposing the existing shared editor theme system inside the KB editor UI
- Do not introduce separate KB-only theme preferences or new storage keys
- Do not redesign the broader KB editor layout beyond what is needed to place the shared controls cleanly
- Reuse the existing editor control styling and interaction model where possible

END

## B-56 — Exclude Generated Helper Notes From Summary Export And Normalize Findings Export
STATUS: DONE

CONTEXT:
The generated helper notes used inside the workspace, such as target findings notes and target services notes, are currently useful for operational navigation and live editing. However, the markdown session summary export still includes those generated notes under the generic Notes section. This causes duplicated content, heading mismatches, and structurally awkward output such as exported findings appearing as nested helper-note titles instead of a clean Findings section built from canonical session data.

SCOPE:
server/lib/session-export.js
public/app/notes.js (read-only reference for generated note kinds and current helper-note structure)

EXPECTED BEHAVIOR:
- Generated helper notes must not be included in the exported summary Notes section
- The exported Findings section must be built only from canonical session findings data
- Exported findings must render in a clean export-specific structure:
  - `## Findings`
  - `### <Finding Title>`
  - finding metadata lines
  - `#### POC` when proof content exists
- Exported findings must not include helper-note wrapper headings such as `FINDINGS - <target>`
- Exported findings must not duplicate target metadata already implied by helper-note titles
- Manual user-authored notes must continue to export normally
- Internal generated notes inside the live platform must remain unchanged and continue working as operational helper documents
- Existing generated summary/session note syncing must remain unchanged
- Existing target findings note syncing must remain unchanged
- Existing services helper-note syncing must remain unchanged

RULES:
- Keep the task limited to summary export behavior only
- Do not change internal generated note formats unless strictly required for export correctness
- Prefer filtering generated helper notes at export-model selection time rather than patching rendered markdown afterward
- Export formatting may diverge from internal helper-note formatting where necessary
- Do not alter live note preview, note tabs, findings modal behavior, or generated note rebuild logic

END

## B-57 — Move Quick Log Group Before Unified Search In Top Bar
STATUS: TODO

CONTEXT:
The top bar currently places the unified search field before the shared operational utility buttons such as TODO, Ports, Paths, Loot, and Findings. This makes the search field occupy a more primary slot than the quick operational actions that are used continuously during an engagement. The layout should instead reflect the engagement workflow more clearly by placing the operational actions before the search field while preserving the existing responsive behavior.

SCOPE:
views/partials/topbar.ejs
views/partials/topbar-utility-panels.ejs
public/app/styles.css

EXPECTED BEHAVIOR:
- The shared utility group containing TODO, Ports, Paths, Loot, and Findings must appear before the unified search field in the top bar
- The unified search field must move to the previous utility-group position
- Existing search behavior, keyboard shortcut behavior, and result rendering must remain unchanged
- Existing utility button behavior and popovers must remain unchanged
- The search field must remain the flexible-width element that shrinks first on smaller widths
- The utility buttons must remain fixed-size and visually stable
- Existing right-side utility actions such as help and theme controls must remain in place

RULES:
- Keep the task limited to top-bar layout ordering and any minimal styling adjustments required by the move
- Do not redesign button styling, search functionality, or utility behavior
- Preserve current responsive sizing behavior where the search field yields width before the fixed utility buttons

END

## B-58 — Add Optional Bottom-Bar Layout Mode For The Main Top Bar
STATUS: DONE

CONTEXT:
The main navigation bar currently exists only as a top bar. Some operators may prefer the same control layout anchored at the bottom of the viewport, especially for mouse-heavy workflows or screen setups where bottom-edge navigation feels faster and more comfortable. The feature should reuse the exact same bar content and ordering, but allow the platform to switch between top-bar mode and bottom-bar mode without changing functionality.

SCOPE:
views/partials/topbar.ejs
public/app/styles.css
public/app/app.js
public/app/shell.js
views/partials/topbar-utility-panels.ejs

EXPECTED BEHAVIOR:
- A new layout toggle control must appear near the existing light/dark theme toggle
- The new control must switch the main top bar between:
  - standard top-bar mode
  - bottom-bar mode using the same content and ordering
- The selected layout mode must persist across reloads using local storage
- Top-bar mode must remain the default
- Bottom-bar mode must reposition the bar to the bottom edge of the viewport without changing the bar's internal control order
- All existing top-bar controls must continue working identically in both modes:
  - target/session selector
  - quick-log utility buttons
  - unified search trigger
  - help button
  - light/dark theme toggle
- Utility popovers and floating panels anchored to the bar must reposition correctly in bottom-bar mode
- Elements currently positioned using top-bar offsets must adapt correctly when the bar is at the bottom
- The main content area and panel sizing must remain usable in both modes without overlap or inaccessible controls
- Keyboard shortcuts and unified search behavior must remain unchanged

DEPENDENT SURFACES TO VERIFY:
- TODO popover
- Ports/Paths/Loot popovers
- Findings popover
- Any fixed-position overlays or panels that currently assume a top-origin anchor based on `var(--topbar-h)`
- Main content and side-panel height/offset calculations
- Responsive behavior on smaller widths and heights

RULES:
- Reuse the existing bar markup and internal button ordering rather than creating a separate duplicated bottom-bar component
- Implement this as a layout mode, not as a second independent navigation surface
- Keep top-bar mode as the default and preserve current behavior when the new mode is not enabled
- Do not redesign the visual styling of the bar beyond what is required to support top vs bottom anchoring
- Prefer a single root/body class such as `bottom-bar-mode` to drive CSS and anchored UI changes
- Update anchored popovers and offset calculations systematically rather than patching individual elements ad hoc

END


## B-59 — Create KB Documents In The Active Selected Section
STATUS: DONE

CONTEXT:
When the operator is browsing a specific knowledge-base section from the sidebar, pressing `Create` should create the new markdown file inside that currently selected section. Right now the create flow can fall back to the default `services` destination instead of respecting the active sidebar selection, which makes section-scoped authoring unreliable and confusing.

SCOPE:
views/partials/main-panel.ejs
public/app/kb.js
server/routes/kb.js

EXPECTED BEHAVIOR:
- If the operator has selected a service-folder category in the KB sidebar, pressing `Create` must create the file inside that folder
- If the operator has selected a root knowledge-base section such as `oscp-exam`, pressing `Create` must create the file inside that section instead of /services
- The create modal copy must still reflect the correct target location
- After creation, the new document must open from the same section it was created in
- Existing create behavior for plain `Services` and `Tactics` views must remain unchanged

RULES:
- Do not redesign the KB create modal
- Do not change unrelated KB browsing or editing behavior
- Preserve current service and tactic creation semantics when no scoped folder/section is selected

END


## B-60 — Prevent Double-Digit Ordered List Markers From Clipping In The Note Editor
STATUS: DONE

CONTEXT:
In the note editor, ordered lists render acceptably for single-digit items, but once the list reaches `10` or higher the left edge of the marker can appear slightly clipped. This suggests the editor content gutter is too tight on the left side for wider list markers.

SCOPE:
CODEX-BACKLOG.md
public/app/styles.css

EXPECTED BEHAVIOR:
- Ordered list markers such as `10.` and above must render fully in the note editor
- The left gutter should have enough space that future wider markers are not clipped
- The change should remain visually subtle and not redesign the editor layout

RULES:
- Keep the fix limited to note editor spacing
- Do not alter preview markdown list styling
- Do not redesign unrelated CodeMirror or KB editor spacing

END


## B-61 — Strengthen Target Ownership Clarity In Hidden Note Tab Groups
STATUS: DONE

CONTEXT:
The hidden-notes tab strip already groups session notes by target, but when many notes are open the current grouping still reads too much like one long continuous row. The target label and green border help, yet ownership is still too subtle once several hosts and helper notes are visible at the same time.

SCOPE:
CODEX-BACKLOG.md
public/app/notes.js
public/app/styles.css

EXPECTED BEHAVIOR:
- Each target note group must read as a clearer visual cluster rather than only a bordered row
- The group header must be more prominent than it is today
- The group header should expose:
  - a primary target identifier
  - an optional secondary label when available
  - a compact count of notes in that target group
- Spacing between separate target groups must be more distinct than spacing between tabs inside a group
- Generated/helper notes should remain functional but be visually more secondary than operator-authored notes
- The existing `New` tab create control must remain outside the target groups
- Tab switching and close behavior must remain unchanged

RULES:
- Do not redesign the underlying hidden-notes workflow
- Do not change note ordering logic
- Do not alter note opening, closing, or creation behavior beyond this presentation improvement
- Keep the change limited to grouped hidden note tabs

END


## B-62 — Align Hidden Notes New Button Height With Grouped Tab Clusters
STATUS: DONE

CONTEXT:
After strengthening the grouped hidden note tabs, the standalone `New` tab-style create control still uses the older shorter vertical footprint. That makes the empty space above it feel awkward beside the taller grouped target clusters and breaks the visual baseline of the row.

SCOPE:
CODEX-BACKLOG.md
public/app/notes.js
public/app/styles.css

EXPECTED BEHAVIOR:
- The standalone `New` control in the hidden-notes tab strip must visually align in overall height with the grouped target tab clusters
- The awkward empty space above the `New` control should be removed
- The `New` control must remain outside the target groups and keep the same behavior
- The tab button itself should remain visually consistent with the rest of the row

RULES:
- Do not change note creation behavior
- Do not merge the `New` control into any target group
- Keep the change limited to the hidden-notes tab strip presentation

END


## B-63 — Show Target Labels In Regular Notes List Filter Chips
STATUS: DONE

CONTEXT:
In the regular notes list, the target filter chips currently show only the target IP or primary identifier. When several hosts are similar, that hides the operator-defined target label and makes the filter bar less useful than the grouped hidden tabs, which already expose both values.

SCOPE:
CODEX-BACKLOG.md
public/app/notes.js

EXPECTED BEHAVIOR:
- The regular notes list target filter chips must show the target label alongside the primary IP/domain when a label exists
- The chip should still fall back cleanly when only one identifier exists
- Filter behavior must remain unchanged

RULES:
- Keep the change limited to the regular notes list target filter chips
- Do not redesign the chip styling as part of this task
- Do not alter note filtering logic beyond the displayed label text

END


## B-64 — Improve Hidden Note Tab Quick Access And Group Readability
STATUS: DONE

CONTEXT:
The hidden note tab strip is now grouped more clearly by target, but there are still several quick-access weaknesses once a session grows: the currently active target group is not emphasized enough, pinned notes still do not stand out strongly, long target labels can get dense, and generated/helper tabs can add noise when operators only want the primary authored notes in view.

SCOPE:
CODEX-BACKLOG.md
public/app/notes.js
public/app/styles.css

EXPECTED BEHAVIOR:
- The currently active target group must be visually emphasized over the other target groups
- Pinned notes must be easier to distinguish at a glance in the hidden tab strip
- Long target labels must truncate more safely while still exposing full text on hover
- Existing tab open, close, and create behavior must remain unchanged

RULES:
- Keep the change limited to the hidden grouped note tabs
- Do not redesign the broader notes workflow
- Do not alter note ordering logic

END


## B-65 — Invert Hidden Tab Title Emphasis Between Authored And Generated Notes
STATUS: DONE

CONTEXT:
In the hidden note tab strip, autogenerated/helper notes are intentionally styled as secondary, but the current title emphasis can feel backwards in practice. Operator-authored notes should carry the stronger title emphasis, while autogenerated notes should recede slightly without becoming hard to read.

SCOPE:
CODEX-BACKLOG.md
public/app/styles.css

EXPECTED BEHAVIOR:
- Manually authored note tabs must use the stronger default title emphasis
- Generated/helper note tabs must use a lighter title emphasis than authored notes
- Active tabs must remain readable regardless of whether they are authored or generated
- No tab layout or grouping behavior should change

RULES:
- Keep the change limited to hidden note tab title emphasis
- Do not redesign tab colors or grouping structure as part of this task
- Preserve generated-note secondary treatment overall

END


## B-66 — Normalize Authored Hidden Tab Title Weight
STATUS: DONE

CONTEXT:
After inverting the hidden tab title emphasis so helper/generated notes recede, the authored note titles in the hidden tab strip now feel slightly too bold. The intended hierarchy is for authored notes to remain the primary tabs, but with a normal default title weight rather than a heavy one.

SCOPE:
CODEX-BACKLOG.md
public/app/styles.css

EXPECTED BEHAVIOR:
- Authored hidden note tab titles must use a normal default font weight
- Generated/helper tabs must remain slightly lighter than authored tabs
- No tab layout, grouping, or behavior should change

RULES:
- Keep the change limited to the hidden tab title weight
- Do not redesign colors or grouping as part of this task
- Preserve the authored-vs-helper visual hierarchy established in the previous task

END


## B-67 — Fix KB Editor Find-In-Document Match Navigation Counter
STATUS: DONE

CONTEXT:
When a KB note is open in the right-side content panel and the operator uses `Find in document`, matches are highlighted correctly and the total count is accurate. However, using the previous/next controls does not update the `current / total` indicator, which makes navigation appear broken even when the query itself is valid.

SCOPE:
CODEX-BACKLOG.md
public/app/content-panel.js
public/app/kb-editor.js

EXPECTED BEHAVIOR:
- In KB edit mode, `Find in document` must display the correct current match index and total match count
- Using previous/next controls must update the current match index
- Enter and Shift+Enter behavior in the find field must remain consistent with previous/next navigation
- Existing highlight behavior must remain unchanged

RULES:
- Keep the change limited to KB editor search state and content-panel search count/navigation
- Do not redesign the search UI
- Do not alter note/content-panel search behavior outside the KB editor-specific bug

END

## B-68 — Refresh KB Reader Header Immediately After Edit Exit
STATUS: DONE

CONTEXT:
When a Knowledge Base note is edited and saved, the read-mode title and metadata do not always reflect the latest saved content immediately after leaving edit mode. This makes the live editing flow feel stale even though the underlying file has been updated.

SCOPE:
public/app/kb-editor.js
public/app/kb.js

EXPECTED BEHAVIOR:
- After a KB note save completes, the active KB document state must reflect the latest saved title, metadata, and rendered content
- Exiting KB edit mode while a save is still in progress must wait for that save to finish before returning to read mode
- The KB reader header and content must update immediately after edit mode is exited, without requiring the operator to reopen the document
- Existing autosave behavior must remain intact

RULES:
- Keep the change limited to KB editor save/exit synchronization
- Do not redesign the KB editor UI
- Do not alter unrelated note editor behavior

## B-69 — Add Preview-Only Markdown Zoom Controls

CONTEXT:
Rendered markdown can feel too small or too large depending on monitor size, browser scaling, and layout mode. Operators need a way to zoom the preview surface itself without changing the editor font size or relying on full browser zoom.

SCOPE:
public/app/note-editor.js
public/app/content-panel.js
public/app/kb-editor.js
public/app/styles.css

EXPECTED BEHAVIOR:
- Rendered markdown preview surfaces must support a preview-only zoom level
- The zoom must affect preview/read surfaces only, not the raw editor text size
- The operator should be able to zoom while hovering a preview surface, for example with a modifier plus mouse wheel
- The zoom level should apply consistently to:
  - normal note preview
  - unified note preview
  - KB/content-panel markdown preview
- A sensible reset/default level must exist
- The zoom level should persist locally for the operator

RULES:
- Do not replace browser-native zoom
- Do not change editor font sizing behavior
- Keep the change limited to markdown preview/read rendering scale and its controls

## B-70 — Add KB Document Delete Action In Content Panel
STATUS: DONE

CONTEXT:
Knowledge Base documents created from inside the app can currently be created and edited, but not deleted through the same interface. Operators must be able to remove KB documents directly from the content panel using the same confirmation style already used elsewhere in the app.

SCOPE:
CODEX-BACKLOG.md
server/routes/kb.js
views/partials/content-panel.ejs
public/app/content-panel.js
public/app/styles.css

EXPECTED BEHAVIOR:
- When a KB document is open in the content panel, a delete button must appear beside the existing edit action
- Pressing delete must open a destructive confirmation dialog consistent with existing delete confirmations in the app
- Confirming delete must remove the underlying KB markdown file
- After delete, KB lists/cards/tabs must refresh immediately so the removed document no longer appears
- If the document was opened from a KB browser/list state, the UI should return to that state after deletion instead of leaving stale content visible

RULES:
- Keep the change limited to KB document deletion flow
- Do not change normal note deletion behavior
- Do not redesign the content panel header beyond adding the delete action
