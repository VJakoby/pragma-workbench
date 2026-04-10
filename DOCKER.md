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
├── note-templates.json           // checked-in template file; bind-mount if you want host edits without rebuilding
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
    ├── attacks/                  // top-level KB section, separate from Services and Tactics
    │   ├── lfi.md
    │   └── sqli.md
    └── tactics/                  // reserved for the Tactics tab
        ├── active-directory.md
        └── pivoting.md
```

> **Live UI note:** The application is served through `views/app.ejs`. `public/app.html` is kept as a static mirror/reference page, but it is not the main runtime entrypoint when the Node server is used.

> **Knowledge Base:** `knowledge_base/services/` feeds the Services view, `knowledge_base/tactics/` is reserved for the Tactics view, and any other top-level folders under `knowledge_base/` become separate KB sections.

---

## Environment Variables

The checked-in `docker-compose.yml` now supports path and user overrides through environment variables. Put them in a local `.env` file or export them before running `docker compose`.

Recommended startup flow:

1. Copy `.example.env` to `.env`
2. Point `PRAGMA_KB_PATH` at your local knowledge base
3. Adjust `PRAGMA_SESSIONS_PATH` if you want runtime data outside the repo
4. Set `PDF_EXPORT_ENABLED=false` if you want to disable PDF export in this deployment
5. Run `docker compose up -d --build`

| Variable | Default | Description |
|---|---|---|
| `PRAGMA_UID` | `1000` | Host user ID used to run the container process |
| `PRAGMA_GID` | `1000` | Host group ID used to run the container process |
| `PRAGMA_KB_PATH` | `./knowledge_base` | Host path mounted into `/usr/src/app/knowledge_base` |
| `PRAGMA_SESSIONS_PATH` | `./sessions` | Host path mounted into `/usr/src/app/sessions` |
| `SEARCH_URL` | `http://engram:3002` in the checked-in compose | URL to the ENGRAM indexer |
| `PDF_EXPORT_ENABLED` | `true` | Enable or disable Puppeteer/Chromium PDF export for this deployment |

Inside the container, PRAGMA still uses:

| Variable | Container Path | Description |
|---|---|---|
| `KB_DIR` | `/usr/src/app/knowledge_base` | Knowledge base root inside the runtime |
| `SESSIONS_DIR` | `/usr/src/app/sessions` | Session/workbench storage path inside the runtime |

Example `docker-compose.yml` volume + env setup:

```yaml
services:
  app:
    build: .
    user: "${PRAGMA_UID:-1000}:${PRAGMA_GID:-1000}"
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - ${PRAGMA_SESSIONS_PATH:-./sessions}:/usr/src/app/sessions
      - ${PRAGMA_KB_PATH:-./knowledge_base}:/usr/src/app/knowledge_base
      - ./note-templates.json:/usr/src/app/note-templates.json:ro # optional, only if you use custom templates
    environment:
      - KB_DIR=/usr/src/app/knowledge_base
      - SESSIONS_DIR=/usr/src/app/sessions
      - SEARCH_URL=http://engram:3002
```

Example `.env`:

```env
PRAGMA_UID=1000
PRAGMA_GID=1000
PRAGMA_KB_PATH=./knowledge_base
PRAGMA_SESSIONS_PATH=./sessions
PDF_EXPORT_ENABLED=true
```

> **ENGRAM note:** The checked-in `docker-compose.yml` only defines the PRAGMA app container. `SEARCH_URL=http://engram:3002` assumes you are running ENGRAM separately on the same Docker network (or that you have added an `engram` service yourself).

> **Templates note:** The image already contains the checked-in `note-templates.json` from the repo. Add a bind mount only if you want host-side template edits to appear in the container without rebuilding the image.

> **Permissions note:** Mapping the container user to `PRAGMA_UID` / `PRAGMA_GID` reduces first-run permission problems, but the host path pointed to by `PRAGMA_SESSIONS_PATH` still needs to be writable by that user.

> **PDF note:** The Docker image installs system Chromium and sets `PUPPETEER_SKIP_DOWNLOAD=true` so fresh builds do not depend on Puppeteer downloading its own browser. If you do not want PDF export in a given deployment, set `PDF_EXPORT_ENABLED=false`.

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

To enable full-text search of indexed online sources, run PRAGMA and ENGRAM on a shared Docker network. The default `SEARCH_URL` in the checked-in compose file already points at `http://engram:3002`, but you still need to provide the ENGRAM container separately.

See the [ENGRAM repository](https://github.com/VJakoby/engram) for setup instructions.
