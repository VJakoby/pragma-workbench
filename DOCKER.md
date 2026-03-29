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
├── note-templates.json           // optional — custom note templates (see README)
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
| `KB_DIR` | App default: `./knowledge_base` | Path to your knowledge base directory inside the app runtime |
| `SEARCH_URL` | App default: `http://localhost:3002` | URL to the ENGRAM indexer |
| `MATRIX_URL` | App default: `http://127.0.0.1:3003` | URL to the MATRIX Toolbox service |
| `SESSIONS_DIR` | App default: `./sessions` | Path where PRAGMA stores the workbench and backups |

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
      - ./note-templates.json:/usr/src/app/note-templates.json:ro # optional, only if you use custom templates
    environment:
      - KB_DIR=/usr/src/app/knowledge_base
      - SESSIONS_DIR=/usr/src/app/sessions
      - SEARCH_URL=http://engram:3002
      - MATRIX_URL=http://host.docker.internal:3003
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

> **ENGRAM note:** The checked-in `docker-compose.yml` only defines the PRAGMA app container. `SEARCH_URL=http://engram:3002` assumes you are running ENGRAM separately on the same Docker network (or that you have added an `engram` service yourself).

> **MATRIX note:** If PRAGMA runs inside Docker and MATRIX runs on the host machine, `MATRIX_URL=http://127.0.0.1:3003` will not work from inside the PRAGMA container. Use `MATRIX_URL=http://host.docker.internal:3003` and add the `host-gateway` mapping shown above.

> **Templates note:** The checked-in `docker-compose.yml` does not currently mount `note-templates.json`. Add that volume only if you want file-based custom templates inside Docker.

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

## Running with MATRIX

To enable the `MATRIX // Toolbox` module from a Dockerized PRAGMA instance, PRAGMA must be able to reach the MATRIX HTTP API from inside the container.

Recommended topology:

- PRAGMA in Docker
- MATRIX running on the host at `http://127.0.0.1:3003`

In that case, set:

```yaml
environment:
  - MATRIX_URL=http://host.docker.internal:3003
extra_hosts:
  - "host.docker.internal:host-gateway"
```

Important:

- inside the PRAGMA container, `127.0.0.1` refers to the PRAGMA container itself, not the host
- if MATRIX is instead running in another container, point `MATRIX_URL` at that container/service name instead
