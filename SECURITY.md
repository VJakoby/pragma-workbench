# SECURITY

## Scope

PRAGMA is intended to be a localhost-first engagement note workbench, not a general internet-facing web application.

This document tracks:

- the security assumptions the app is built around
- the risks that have been reviewed and mitigated
- the tests that have already been performed
- the manual checks that should still be run after changes

## Threat Model

Primary assumptions:

- PRAGMA should only be reachable from the host running it unless explicitly overridden
- the main user data sources are trusted enough to use, but may still contain dangerous content accidentally
- imported notes, KB markdown, search previews, and `.session` files must be treated as untrusted input

Out of scope by default:

- broad internet-facing attack scenarios if the app is intentionally kept on localhost
- cryptographic redesign beyond the current encrypted workbench model

## Mitigations Implemented

### 1. Stored XSS in rendered markdown/HTML

Risk:

- KB markdown, note preview markdown, imported content, and rendered previews were inserted into `innerHTML`
- raw HTML inside markdown could execute scripts or event handlers

Mitigation:

- server-side markdown rendering is sanitized before being returned
- client-side note preview rendering is sanitized before insertion into the DOM
- dangerous schemes such as `javascript:` are removed
- event-handler attributes such as `onerror` are stripped
- KB/content preview placeholder injection for `IP`, `TARGET`, `ATTACKER`, etc. was restored after the extra client-side sanitization layer interfered with that workflow-critical feature

Relevant files:

- `server/lib/html-sanitize.js`
- `server/index.js`
- `server/routes/kb.js`
- `public/app/sanitize.js`
- `public/app/note-editor.js`
- `public/app/content-panel.js`
- `public/app/kb-editor.js`

### 2. Arbitrary local file read via `/api/preview`

Risk:

- `/api/preview` previously accepted absolute paths directly
- that allowed attempts to read files outside the knowledge base

Mitigation:

- `/api/preview` is now restricted to `.md` files inside the KB root only
- absolute paths outside the KB root are rejected with `403`

Relevant files:

- `server/routes/kb.js`

### 3. Overly broad default bind address

Risk:

- the server previously bound to `0.0.0.0` by default
- that exposed the app beyond localhost unless external controls blocked it

Mitigation:

- default bind host is now `127.0.0.1`
- broader exposure must be explicit via `HOST=0.0.0.0`

Relevant files:

- `server/config/paths.js`
- `server/index.js`

### 4. Unsafe `.session` import shape

Risk:

- imported `.session` payloads were accepted with minimal structure checking
- malformed or hostile objects could be merged straight into app state

Mitigation:

- `.session` imports are now validated and normalized before state insertion
- imported session, target, note, service, path, loot, todo, and event structures are constrained to expected shapes

Relevant files:

- `public/app/workbench.js`

### 5. Inline handler injection through wrong escaping context

Risk:

- some UI builders interpolated user-controlled strings into inline `onclick` handlers
- HTML escaping is not sufficient for JavaScript string context

Mitigation:

- dynamic arguments passed through inline handlers are now URL-encoded
- handlers decode the values explicitly before use
- one raw content-panel error message insertion was also escaped

Relevant files:

- `public/app/notes.js`
- `public/app/search.js`
- `public/app/content-panel.js`
- `public/app/kb.js`

### 6. Encrypted workbench confidentiality and format consistency

Risk:

- encrypted workbench blobs must remain unreadable without the password if copied off-host
- encrypted save/load must continue to work across format changes
- the encrypted file version marker had drifted from the regular plaintext/session version marker

Mitigation:

- encrypted workbench storage uses AES-256-GCM
- new encrypted blobs use PBKDF2-SHA-512 with `600000` iterations and a 32-byte salt
- encrypted blobs now write `pragma_version: 1` for consistency with regular exported/session files
- encrypted blobs use a separate `crypto_version: 2` field so stronger crypto parameters remain explicit
- decrypt logic remains backward-compatible with older encrypted blobs that used `pragma_version: 2`

Relevant files:

- `public/app/app.js`
- `public/app/workbench.js`
- `server/routes/notes.js`

### 6a. Encrypted attachments are not directly viewable outside PRAGMA

Risk:

- attachment screenshots and images must not be stored as directly viewable plaintext files when encrypted workbench mode is enabled
- the security claim around attachments should be precise and verifiable

Important claim language:

- do **not** claim attachment decryption is "impossible" outside the app
- the defensible claim is:
  `Encrypted attachments are not directly viewable outside PRAGMA without the decryption password, assuming the cryptography implementation is correct and the password is strong.`

Current design:

- in plaintext mode, note attachments are stored as normal image bytes on disk
- in encrypted mode, the browser encrypts attachment bytes first, then stores encrypted JSON payloads on disk as `*.enc`
- the server does not decrypt those attachments before returning them
- the browser decrypts them client-side when the workbench is unlocked

Relevant files:

- `server/routes/notes.js`
- `server/lib/note-attachments.js`
- `public/app/app.js`
- `public/app/note-editor.js`

Relevant implementation points:

- `public/app/app.js:799`
  `bytesToBase64()` chunked base64 conversion used by encrypted payload paths
- `public/app/app.js:814`
  `encryptBinaryPayload()` for encrypted attachment payload creation
- `public/app/app.js:853`
  `decryptBinaryPayload()` for client-side attachment decryption
- `public/app/note-editor.js:21`
  `uint8ToBase64()` used while preparing attachment payloads for export
- `public/app/note-editor.js:51`
  `fetchNoteAttachmentBlobFromUrl()` fetches attachment data and decrypts encrypted payloads client-side
- `public/app/note-editor.js:203`
  encrypted image upload path
- `server/routes/notes.js:148`
  `POST /api/notes/attachments`
- `server/routes/notes.js:196`
  `GET /api/notes/attachments/:noteId/:filename`
- `server/routes/notes.js:366`
  `POST /api/notes/save-encrypted`
- `server/routes/notes.js:385`
  `POST /api/notes/storage/disable-encrypted`

Security-focused API surface for encrypted/decrypted mode:

- `POST /api/notes/attachments`
  Used for note image upload.
  In plaintext mode it stores raw image bytes.
  In encrypted mode it stores an encrypted JSON payload (`encrypted_blob`) plus metadata.

- `GET /api/notes/attachments/:noteId/:filename`
  Used when PRAGMA renders note attachments.
  Returns raw file bytes in plaintext mode.
  Returns encrypted JSON payload in encrypted mode.

- `POST /api/notes/save-encrypted`
  Writes the encrypted workbench blob to disk and removes plaintext workbench state.

- `POST /api/notes/storage/disable-encrypted`
  Writes decrypted workbench state back to plaintext storage and removes encrypted workbench state.

Encrypted workbench decrypt/load API surface:

- `GET /api/notes/encrypted`
  Returns the encrypted workbench blob from disk so the browser can decrypt it locally.

- `POST /api/notes/save-encrypted`
  Accepts the encrypted workbench blob produced client-side and stores it on disk.

- `POST /api/notes/storage/disable-encrypted`
  Accepts decrypted `sessions` and `notes` from the browser when encrypted mode is being disabled, then restores plaintext storage on disk.

- `GET /api/notes/storage-info`
  Reports whether plaintext or encrypted workbench storage is currently active.

- `GET /api/notes/attachments/:noteId/:filename`
  Relevant during unlocked encrypted mode because encrypted attachments are returned as encrypted JSON payloads and then decrypted client-side for rendering.

Verification checklist for attachment confidentiality:

1. Enable encrypted workbench mode.
2. Paste or drag in a screenshot/image into a note.
3. Inspect the stored file under `sessions/attachments/<noteId>/`.
4. Confirm the stored attachment is `*.enc` and not directly viewable as an image file.
5. Open browser devtools Network tab.
6. Load the note preview containing the image.
7. Confirm `GET /api/notes/attachments/:noteId/:filename` returns encrypted JSON for encrypted attachments, not raw PNG/JPG bytes.
8. Confirm the decryption password is not sent to the server in any request.
9. Lock the workbench or reload without unlocking it and confirm the same encrypted attachment is not rendered until unlock.
10. Export behavior should be tested separately, because plaintext export is a deliberate workflow that may inline or copy attachments in usable form.

### 7. Missing baseline browser hardening headers

Risk:

- even for a localhost-first app, missing baseline response headers makes it easier for browser behavior to drift in unsafe directions
- clickjacking, MIME sniffing, and referrer leakage should be constrained by default

Mitigation:

- the app now sets `X-Content-Type-Options: nosniff`
- the app now sets `Referrer-Policy: no-referrer`
- the app now sets `X-Frame-Options: DENY`
- app-shell responses are also served with no-store cache headers

Relevant files:

- `server/index.js`

## Directly Verified

The following checks were run directly during review:

### Sanitizer behavior

Tested with sample rendered HTML containing:

- `<script>alert(1)</script>`
- `<img src=x onerror=alert(1)>`
- `<a href="javascript:alert(1)">bad</a>`
- `<a href="https://example.com">ok</a>`

Observed result:

- `<script>` removed
- `onerror` removed
- `javascript:` link neutralized
- normal `https` link preserved

### Note preview XSS

Verified in the browser:

- note preview XSS test was performed with raw script/event-handler content
- no XSS execution occurred
- previewed malicious content did not execute in the note preview

### Host binding

Verified:

- default host resolves to `127.0.0.1`

### Response headers

Verified:

- app responses include `X-Content-Type-Options: nosniff`
- app responses include `Referrer-Policy: no-referrer`
- app responses include `X-Frame-Options: DENY`

### KB preview route access control

Verified:

- valid KB markdown file preview still works
- `/api/preview?file=/etc/passwd` returns `403 Access denied`

### Malformed `.session` import rejection

Verified:

- malformed `.session` structures are rejected without adding sessions or notes
- invalid JSON during `.session` import now shows the normalized message:
  `Could not load .session file. File is malformed.`

Examples verified:

- root value is an array
- object missing `notes`
- object with invalid `session` type
- invalid JSON containing raw `<script>` markup

### Tag-path safety check

Verified:

- tags containing quote characters render as plain text
- attempted XSS-like tag content was displayed as text/code and did not execute
- the defensive URL-encoding change for inline handler arguments remains in place

### Encrypted workbench flow

Verified:

- encrypted workbench save/load roundtrip succeeds
- wrong password fails cleanly
- encrypted attachments are returned as encrypted JSON payloads by the server and decrypted client-side for rendering
- fetched encrypted blob from `/api/notes/encrypted` decrypts successfully with the correct password
- the on-disk encrypted workbench file contains ciphertext plus encryption metadata only
- new encrypted blobs now write:
  - `pragma_version: 1`
  - `crypto_version: 2`
- older encrypted blobs using `pragma_version: 2` remain decryptable

Security position for intended use:

- for PRAGMA's localhost-first model, the encrypted workbench flow is considered strong enough
- if a `.workbench.enc` file is copied to another machine, practical recovery should still depend on knowing the correct password
- the more realistic residual risks are weak passwords or an already-unlocked workstation, not the encryption algorithm itself

### Syntax validation

Checked with `node --check`:

- `server/index.js`
- `server/routes/kb.js`
- `server/routes/notes.js`
- `server/routes/search-proxy.js`
- `server/routes/workbenches.js`
- `public/app/note-editor.js`
- `public/app/content-panel.js`
- `public/app/kb-editor.js`
- `public/app/workbench.js`
- `public/app/quick-log.js`
- `public/app/sanitize.js`
- `public/app/notes.js`
- `public/app/search.js`
- `public/app/kb.js`
- `public/app/targets.js`
- `public/app/timeline.js`

## Recommended Ongoing Review Areas

Future security reviews should continue to focus on:

- any new `innerHTML` insertion paths
- markdown rendering changes
- file preview/open/save routes
- session import/export behavior
- search/content proxy assumptions
- accidental exposure beyond localhost

## Current Position

The app is now hardened against the most relevant risks for its intended localhost-first model:

- stored XSS in rendered markdown/previews
- arbitrary KB preview file access outside the KB root
- unsafe default network exposure
- loose `.session` import acceptance
- inline handler injection from user-controlled strings
- missing baseline browser hardening headers
- encrypted workbench confidentiality for copied `.workbench.enc` files, assuming a strong password

This does not mean the app is universally hardened for hostile internet deployment. It means the most relevant risks for the intended usage model have been identified and addressed to a reasonable level.
