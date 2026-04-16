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
4. Set `PDF_EXPORT_ENABLED=true|false`
5. Rebuild only if you changed dependencies, the Dockerfile, or `PDF_EXPORT_ENABLED`
6. Run `docker compose up -d`

| Variable | Default | Description |
|---|---|---|
| `TOOLBOX_ENABLED` | `false` | Enable the optional PRAGMA // Toolbox integration in the UI and proxy routes |
| `TOOLBOX_URL` | App default: `http://127.0.0.1:3003` | Primary URL to the PRAGMA // Toolbox service when enabled |
| `TOOLBOX_URLS` | unset | Optional comma-separated fallback URL list tried in order |
| `ENGRAM_SEARCH_ENABLED` | `true` | Enable the ENGRAM-backed search UI and proxy routes |
| `PRAGMA_UID` | `1000` | Host user ID used to run the container process |
| `PRAGMA_GID` | `1000` | Host group ID used to run the container process |
| `PRAGMA_KB_PATH` | `./knowledge_base` | Host path mounted into `/usr/src/app/knowledge_base` |
| `PRAGMA_SESSIONS_PATH` | `./sessions` | Host path mounted into `/usr/src/app/sessions` |
| `SEARCH_URL` | `http://engram:3002` in the checked-in compose | URL to the ENGRAM indexer |
| `PDF_EXPORT_ENABLED` | `true` | Single PDF switch. When `true`, the app enables PDF export and the Docker build includes Chromium. When `false`, the app disables PDF export and a rebuilt image omits Chromium. |

Inside the container, PRAGMA still uses:

| Variable | Container Path | Description |
|---|---|---|
| `KB_DIR` | `/usr/src/app/knowledge_base` | Knowledge base root inside the runtime |
| `SESSIONS_DIR` | `/usr/src/app/sessions` | Session/workbench storage path inside the runtime |

Example `docker-compose.yml` volume + env setup:

```yaml
services:
  app:
    build:
      context: .
      args:
        INSTALL_CHROMIUM: ${PDF_EXPORT_ENABLED:-true}
    user: "${PRAGMA_UID:-1000}:${PRAGMA_GID:-1000}"
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - ./server:/usr/src/app/server
      - ./public:/usr/src/app/public
      - ./views:/usr/src/app/views
      - ./server.js:/usr/src/app/server.js
      - ./note-templates.json:/usr/src/app/note-templates.json
      - ${PRAGMA_SESSIONS_PATH:-./sessions}:/usr/src/app/sessions
      - ${PRAGMA_KB_PATH:-./knowledge_base}:/usr/src/app/knowledge_base
    environment:
      - KB_DIR=/usr/src/app/knowledge_base
      - SESSIONS_DIR=/usr/src/app/sessions
      - SEARCH_URL=${SEARCH_URL:-http://engram:3002}
      - ENGRAM_SEARCH_ENABLED=${ENGRAM_SEARCH_ENABLED:-true}
      - TOOLBOX_ENABLED=${TOOLBOX_ENABLED:-false}
      - TOOLBOX_URL=${TOOLBOX_URL:-http://host.docker.internal:3003}
      - TOOLBOX_URLS=${TOOLBOX_URLS:-http://host.docker.internal:3003}
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

Example `.env`:

```env
PRAGMA_UID=1000
PRAGMA_GID=1000
PRAGMA_KB_PATH=./knowledge_base
PRAGMA_SESSIONS_PATH=./sessions
PDF_EXPORT_ENABLED=true
TOOLBOX_ENABLED=true
TOOLBOX_URL=http://127.0.0.1:3003
TOOLBOX_URLS=http://matrix:3003,http://host.docker.internal:3003,http://127.0.0.1:3003
ENGRAM_SEARCH_ENABLED=true
SEARCH_URL=http://engram:3002
```

### PDF Export and Chromium

PRAGMA now uses a single user-facing setting:

- `PDF_EXPORT_ENABLED=true` means PDF export is enabled and the Docker build installs Chromium.
- `PDF_EXPORT_ENABLED=false` means PDF export is disabled and a rebuilt image omits Chromium.

This keeps the behavior simple, but there is one important consequence:

- If you change `PDF_EXPORT_ENABLED`, rebuild with `docker compose up -d --build` so the image matches the setting.

The Chromium-free image is materially smaller. In local testing:

- with Chromium: about `941MB`
- without Chromium: about `290MB`

> **ENGRAM note:** The checked-in `docker-compose.yml` only defines the PRAGMA app container. `SEARCH_URL=http://engram:3002` assumes you are running ENGRAM separately on the same Docker network (or that you have added an `engram` service yourself).

> **Toolbox note:** The Toolbox module is fully optional. Leave `TOOLBOX_ENABLED=false` to hide it completely. If you enable it and PRAGMA runs inside Docker while PRAGMA // Toolbox runs on the host machine, `TOOLBOX_URL=http://127.0.0.1:3003` will not work from inside the PRAGMA container. Use `TOOLBOX_URL=http://host.docker.internal:3003` and add the `host-gateway` mapping shown above. You can also set `TOOLBOX_URLS=http://matrix:3003,http://host.docker.internal:3003,http://127.0.0.1:3003` so PRAGMA tries container, host-gateway, and local-host paths in order.

> **Compatibility note:** `TOOLBOX_*` is now the preferred config surface. PRAGMA still accepts legacy `MATRIX_*` variables as fallbacks so existing environments do not break immediately.

> **Templates note:** The image already contains the checked-in `note-templates.json` from the repo. Add a bind mount only if you want host-side template edits to appear in the container without rebuilding the image.

> **Source sync note:** The checked-in compose file now bind-mounts `server/`, `public/`, `views/`, `server.js`, and `note-templates.json`. That means `git pull` is reflected the next time you restart the container with `docker compose up -d`. You only need `--build` when dependencies or image-level settings change.

> **Permissions note:** Mapping the container user to `PRAGMA_UID` / `PRAGMA_GID` reduces first-run permission problems, but the host path pointed to by `PRAGMA_SESSIONS_PATH` still needs to be writable by that user.

> **PDF note:** The Docker image always sets `PUPPETEER_SKIP_DOWNLOAD=true`, so Puppeteer never downloads its own browser during `npm ci`. Chromium installation is derived from `PDF_EXPORT_ENABLED` at build time.

---

## Commands

### Build and start (first time, after dependency changes, or after image config changes)

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

### Rebuild after `package.json`, `package-lock.json`, `Dockerfile`, or `PDF_EXPORT_ENABLED` changes

```bash
docker compose down && docker compose up -d --build
```

---

## Running with ENGRAM

To enable full-text search of indexed online sources, run PRAGMA and ENGRAM on a shared Docker network. The default `SEARCH_URL` in the checked-in compose file already points at `http://engram:3002`, but you still need to provide the ENGRAM container separately.

See the [ENGRAM repository](https://github.com/VJakoby/engram) for setup instructions.

## Running with PRAGMA // Toolbox

To enable the `PRAGMA // Toolbox` module from a Dockerized PRAGMA instance, PRAGMA must be able to reach the Toolbox HTTP API from inside the container.

Recommended topology:

- PRAGMA in Docker
- PRAGMA // Toolbox running on the host at `http://127.0.0.1:3003`

In that case, set:

```yaml
environment:
  - TOOLBOX_ENABLED=true
  - TOOLBOX_URL=http://host.docker.internal:3003
extra_hosts:
  - "host.docker.internal:host-gateway"
```

Important:

- inside the PRAGMA container, `127.0.0.1` refers to the PRAGMA container itself, not the host
- if PRAGMA // Toolbox is instead running in another container, point `TOOLBOX_URL` at that container/service name instead
