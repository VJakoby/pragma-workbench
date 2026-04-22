# Potential Issues

### Attachment encryption: `Maximum call stack size exceeded`

If this appears while enabling encrypted workbench mode or saving encrypted attachments, the failure is usually caused by browser-side base64 conversion of large image buffers, not by Node or Docker stack size.

The relevant client-side conversion points are:

- [public/app/app.js](/public/app/app.js#L830)  
  `bytesToBase64()` used by `encryptPayload()` / `encryptBinaryPayload()`
- [public/app/note-editor.js](/public/app/app.js#L32)  
  `uint8ToBase64()` used when preparing attachment payloads for export

Current implementation uses chunked conversion with:

```js
const chunkSize = 0x8000;
```

If you ever need to tune this manually, reduce that value rather than trying to increase runtime stack size. For example:

```js
const chunkSize = 0x4000;
```

Smaller chunks are safer for very large attachments. Larger chunks may be a little faster, but they are more likely to trigger stack overflows in the browser.
- Full-text search across note titles and bodies, with type/tag/target/scope filters
- Tags, pin, auto-save, duplicate, and per-note `.md` export
- Drag-and-drop and clipboard image support in notes; pasted or dropped screenshots are stored as note attachments and inserted as standard markdown images
- Session summary export supports a consolidated markdown file and an optional PDF summary output
  The Docker image uses system Chromium for PDF export through Puppeteer rather than downloading a bundled browser during install.
- Session reassignment, target assignment, and Timeline view for chronological activity
- Checklist support (`- [ ]` / `- [x]`) in preview with live sync-back to source
- Tool output parser — paste raw output from `nmap`, `masscan`, `gobuster` and similar tools directly into notes with structured formatting
- In-app editing of `note-templates.json` through the Configuration section, using the same editor/autosave flow as notes