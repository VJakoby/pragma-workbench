# Project Backlog

## Phase 1: P1 Fixes & Features
These are critical bugs, UI adjustments, or high-priority features that must be resolved first.

- [x] **P1-01: Injection Variable Fallback Formatting**
  - **Problem:** When `LHOST` (Attacker IP) or `<<DOMAIN>>` variables are unassigned or empty, the preview view renders broken placeholders like `LHOST=<<<ATTACKER-IP>>`-IP>` instead of handling the missing data cleanly.
  - **Exploration Target:** Search the codebase for string interpolation, regex replacements, or template rendering logic handling `LHOST`, `ATTACKER-IP`, and variable parsing.
  - **Expected Behavior:** If a template variable is empty or not set, render a clean fallback placeholder string (e.g., `[LHOST NOT SET]`) or completely suppress the artifacting strings.
  - **Resolution:** Modified `injectTargets()` in `public/app/content-panel.js` to detect unset sentinel values (`<IP>`, `<DOMAIN>`, `<LABEL>`, `<ATTACKER-IP>`) before regex replacement. Unset variables now render styled fallback badges (`[IP NOT SET]`, `[DOMAIN NOT SET]`, `[LABEL NOT SET]`, `[ATTACKER NOT SET]`) via `.ip-injected-unset` CSS class in `public/app/styles.css`.

- [x] **P1-02: Command Palette Icon Update**
  - **Problem:** The current visual icon/symbol assigned to the Command Palette component needs to be modernized.
  - **Exploration Target:** Look for the Command Palette component layout or navbar menu files where UI icons are rendered.
  - **Expected Behavior:** Change the active icon or image symbol specifically to a terminal-style `>_` text symbol or equivalent code icon.
  - **Resolution:** Replaced magnifying glass SVG with terminal `>_` prompt SVG (polyline chevron + underline cursor) in `views/partials/topbar.ejs` trigger button, `views/partials/overlays.ejs` input icon, and `public/app.html` static fallback (both trigger and overlay).

- [x] **P1-03: Remove/Improve Hover Visuals**
  - **Problem:** The hover animation on the Engagement Notes list items and the Search Command results feels "spongy" due to awkward border shifts or layout layout-jumps when triggered.
  - **Exploration Target:** Locate the CSS/Tailwind definitions or class variables styling the hover states (`:hover`) on Engagement Notes cards/lists and Search results.
  - **Expected Behavior:** Smooth out or entirely remove the border alterations on hover. Use a clean, non-disruptive background color change or a subtle opacity shift instead of modifying border widths.
  - **Resolution:** Removed `transform:translateY(-1px)`, `border-color` shifts, and heavy `box-shadow` changes from `.note-item:hover`, `.notes-peek-item:hover`, and `.cmd-item:hover` in `public/app/styles.css`. Hover now uses a clean background color change only.

- [ ] **P1-04: Fix 'Find in Document' for KB Side-Card**
  - **Problem:** The text-search feature inside the Knowledge Base (KB) side-card component is entirely broken. Searching for text doesn't highlight or navigate results.
  - **Exploration Target:** Locate the KB side-card component file and look at how the search input handles matching strings.
  - **Expected Behavior:** Inputting a text string should search the active file context, scroll to the match, and dynamically wrap matching characters in a green highlight background within both the editor or the preview panel.

- [x] **P1-05: Fix Header Minimization in Full Preview**
  - **Problem:** Collapsing/minimizing `###` markdown headers fails specifically when viewing the KB card in the full preview pane. Paradoxically, this feature works correctly when the Split View (editor + preview side-by-side) is active.
  - **Exploration Target:** Scan the UI toggle state code and markdown engine settings for the full preview view vs. split-pane view.
  - **Expected Behavior:** Header toggle click listeners should fire uniformly across all layout screens, enabling code-folding/header minimization on `###` structures in full preview mode.
  - **Resolution:** Fixed incorrect `renderContent` call signature in `note-editor.js:434` that passed an object instead of individual parameters. Added defensive try/catch around `wrapCodeBlocks` and `wrapInlineCodes` in `content-panel.js` to ensure `makeCollapsible` is always called. Made `makeCollapsible` idempotent by skipping headings that already have the `kb-heading-toggle` class.

- [ ] **P1-06: Direct Engagement Note Creation from Services/Ports**
  - **Problem:** There is currently friction when documenting an active port/service. There needs to be a rapid trigger to spin up notes.
  - **Exploration Target:** Locate the UI rendering ports/services lists (e.g., NMAP parser or target asset view).
  - **Expected Behavior:** Implement a direct function button (e.g., next to "53/domain") that immediately initializes a fresh Engagement Note tied to that exact target port context, or injects a rule to auto-generate the note layout directly when an NMAP log is successfully imported.

- [ ] **P1-07: 'Convert Port to TODO' Fast Trigger**
  - **Problem:** Need an efficient way to track actionable items directly from discovery logs.
  - **Exploration Target:** Quick Log view and Ports summary component files.
  - **Expected Behavior:** Introduce a clickable action item/button next to discovered ports that immediately translates that item into a structured "TODO item" inside the Quick Log/Ports tracker layout.

- [x] **P1-08: Code block Preview Contrast Adjustment**
  - **Problem:** Code block formatting within the Markdown preview is difficult to distinguish.
  - **Exploration Target:** CSS style definitions or Markdown renderer component overrides for `<code>` or `<pre>` elements.
  - **Expected Behavior:** Update style configurations to render inline code snippets or code blocks with an explicit red or blue subtle background tint to make them visually pop against standard text.
  - **Resolution:** Updated `.code-block-wrap pre` styles in `public/app/styles.css` to add subtle blue background tint (`rgba(96,165,250,0.08)` dark / `rgba(37,99,235,0.06)` light) and matching blue borders for improved visual distinction from surrounding markdown text.

- [x] **P1-09: Resolve Duplicate Emojis**
  - **Problem:** Document headers are displaying duplicate emojis. This is highly likely caused by a mix of emojis hard-coded into the files clashing with dynamic values appended by your rendering logic.
  - **Exploration Target:** Look over the document generation scripts and header renderer templates.
  - **Expected Behavior:** Sanitize the text input before rendering to prevent identical consecutive emojis, or strip the hardcoded components if dynamic matching is running.
  - **Resolution:** Modified `extractTitle()` in `server/lib/kb-index.js` to strip leading emojis from extracted H1 headings using Unicode regex pattern. KB cards now render `${icon} ${cleanName}` without duplicates (e.g., `🔐 HTTPS Configuration` instead of `🔐 🔐 HTTPS Configuration`). Icon metadata in PORT_MAP/SLUG_MAP/TACTICS_ICONS preserved for use in engagement note creation.

- [ ] **P1-10: Local Indexing & KB Deep-Search**
  - **Description:** The master Search Command window parses strings inside active Engagement Notes, but completely skips text hidden deeper inside local KB files.
  - **Expected Behavior:** Implement a lightweight background system indexer that triggers file-system reads upon code changes, allowing the search controller to look inside both note folders and KB files for global keyword hits.

---

## Phase 2: P2 Secondary Features & Improvements
These are secondary enhancements, integrations, and new functional additions.

- [ ] **P2-01: Support Internal KB Cross-Linking**
  - **Description:** Implement custom syntax parsing within the app to dynamically resolve internal document cross-links inside the Knowledge Base.
  - **Expected Syntax:** Typing `[kb:service:network-enum]` or `[kb:tactic:ad-document]` should be intercepted by the markdown renderer and converted into a clickable internal link that opens that specific local file pathway.

- [ ] **P2-02: Support Cross-Linking for Engagement Notes**
  - **Description:** Implement custom syntax parsing for linking specific target notes within the active operational session context.
  - **Expected Syntax:** Passing `[en:target:note-header]` inside an entry should render as a live clickable link that navigates directly to the Engagement Note titled "Priv-Esc" matching the active target context.

- [ ] **P2-03: Port Summary Dashboard Context Linking**
  - **Description:** Connect imported log data cleanly to your documentation vault.
  - **Expected Behavior:** When an operator parses raw NMAP results into the Quick Log screen, clicking a listed active asset line (like `22/ssh`) must instantly open the matching KB markdown profile in the sidecard pane, mapping directly to `knowledge-base/services/<service-name/port.md>`.

- [ ] **P2-04: Target/Session Context Swapping Interface**
  - **Description:** The process for jumping between different infrastructure targets or global engagement sessions is clunky and requires too many actions.
  - **Expected Behavior:** Create a clean, streamlined navbar switcher or workspace menu layer to pivot seamlessly between global sessions and independent local targets with minimal clicks.

- [ ] **P2-05: Port Summary Dashboard Component**
  - **Description:** Provide at-a-glance visibility over the structural footprint of a target box.
  - **Expected Behavior:** Add a dedicated, highly scannable Port Summary box/grid component into an open layout space on the primary user dashboard, dynamically mapping all discovered assets (e.g. from parsed NMAP inputs).

- [ ] **P2-06: Welcome & Session Selector Modal**
  - **Description:** The entry screen needs a guided modal on initialization to handle workspace routing.
  - **Expected Behavior:** Build a user onboarding modal popup on page boot titled *"Welcome to PRAGMA"*. Provide distinct dashboard navigation routes: create a fresh engagement directory, or select and mount an existing history log from an asset dropdown menu.

- [ ] **P2-07: Markdown Engine Migration (Remark / Markdown-it)**
  - **Description:** The current standard markdown rendering package lacks flexibility and drops layout parameters.
  - **Expected Behavior:** Strip out the legacy package and replace it with a modern setup using either `remark` or `markdown-it` to support a richer set of extended markdown syntax attributes.

---

## Phase 3: P3 Experiments & Complex Refactors
These are long-term performance items, layout experiments, and branch updates.

- [ ] **P3-01: Interactive Documentation Templates**
  - **Description:** Standard template structures are static. They need interactive context or built-in operational clues.
  - **Expected Behavior:** Inject helpful hint logs, pre-populated bash commands, or syntax helper strings directly into empty templates to assist operators during technical discovery.

- [ ] **P3-02: Finalize Operational Context Architecture**
  - **Description:** Bring code parity to the stale experiment branch.
  - **Expected Behavior:** Review the architectural state of the open `operational-context` git branch, update its features to match core workspace standards, and finalize integration preparation.

- [ ] **P3-03: Performance Profiling for Browser Code-Editor**
  - **Description:** Operators notice distinct UI stuttering and input lag when interacting with the text editing component inside a browser window.
  - **Expected Behavior:** Profile event listeners, change detection intervals, and rendering cycles to pinpoint why the web-based code manager drops input frames during execution.

- [ ] **P3-04: Unified Live-Preview Editor Mode**
  - **Description:** Merge the isolated Markdown editing pane and rendering pane into a single interactive WYSIWYG live editor.
  - **Expected Behavior:** Introduce a toggle button labeled "Live-Preview" that switches the panel from a split view to an interactive document layer where markdown formatting displays instantly inline during data entry.

- [ ] **P3-05: Clickable Checkboxes in KB Side-Views**
  - **Description:** Markdown checkboxes (e.g., `- [ ]`) inside the preview render layer are only interactive within Engagement Notes. They are completely static and locked when viewed within the KB sidebar panel.
  - **Expected Behavior:** Extend the interactive toggle handler logic to the KB sidebar views so checking/unchecking a checkbox updates the underlying markdown payload.
