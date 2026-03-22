# 🚀 Docker Usage


## Project Structure

```
pragma-workbench/
├── public/
│   ├── app.html                  // static mirror/reference page
│   └── app/
│       ├── app.js
│       ├── content-panel.js
│       ├── editor-theme.js
│       ├── kb-editor.js
│       ├── kb.js
│       ├── note-editor.js
│       ├── notes.js
│       ├── quick-log.js
│       ├── search.js
│       ├── shell.js
│       ├── targets.js
│       ├── timeline.js
│       └── workbench.js
├── server/
│   ├── index.js
│   ├── config/
│   ├── lib/
│   └── routes/
├── views/
│   ├── app.ejs                  // live server-rendered app entrypoint
│   └── partials/
├── server.js
├── package.json
├── notes-templates.json          // optional — custom note templates (see README)
├── Dockerfile
├── docker-compose.yml
├── sessions/                     // runtime data — created automatically
│   ├── pragma.workbench          // unencrypted workbench
│   ├── pragma.workbench.enc      // encrypted workbench (if enabled)
│   └── backup/                   // rolling backups — last 5 versions kept automatically
└── knowledge_base/               // optional — mount your own via KB_DIR env var
    ├── services/                 // each .md file becomes a card in the Services tab
    │   ├── ssh.md
    │   ├── http.md
    │   └── smb.md
    ├── attacks/                  // subdirectory name becomes the category
    │   ├── lfi.md
    │   └── sqli.md
    └── tactics/                  // reserved for the Tactics tab
        ├── active-directory.md
        └── pivoting.md
```

> **Live UI note:** The application is served through `views/app.ejs`. `public/app.html` is kept as a static mirror/reference page, but it is not the main runtime entrypoint when the Node server is used.

> **Knowledge Base:** Every subdirectory under `knowledge_base/` automatically becomes a category in the Services tab. Only `tactics/` is reserved for the Tactics tab.

---

## Environment Variables

Set these in your `docker-compose.yml` to customise paths:

| Variable | Default | Description |
|---|---|---|
| `KB_DIR` | `./knowledge_base` | Path to your knowledge base directory |
| `SEARCH_URL` | `http://engram:3002` | Default URL to ENGRAM indexer |

Example `docker-compose.yml` volume + env setup:

```yaml
services:
  pragma:
    build: .
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - ./sessions:/usr/src/app/sessions
      - ./knowledge_base:/usr/src/app/knowledge_base:ro
      - ./notes-templates.json:/usr/src/app/notes-templates.json:ro
    environment:
      - KB_DIR=/usr/src/app/knowledge_base
      - SEARCH_URL=http://engram:3002
```

---

## Commands

### Build and start (first time or after code changes)

```bash
docker compose up -d --build
```

### Start existing container

```bash
docker compose up -d
```

Access at **http://localhost:3000**

### Stop

```bash
docker compose down
```

### View logs

```bash
docker logs -f pragma-workbench
```

### Rebuild after frontend or backend changes

```bash
docker compose down && docker compose up -d --build
```

---

## Running with ENGRAM

To enable full-text search of indexed online sources, run PRAGMA and ENGRAM on a shared Docker network:

See the [ENGRAM repository](https://github.com/VJakoby/engram) for setup instructions.
