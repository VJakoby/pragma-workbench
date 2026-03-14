# 🚀 Docker Usage

---

## Project Structure

```
pragma-workbench/
├── public/
│   └── app.html
├── server.js
├── package.json
├── notes-templates.json          // optional — custom note templates (see README)
├── Dockerfile
├── docker-compose.yml
├── sessions/                     // runtime data — created automatically
│   ├── pragma.workbench          // unencrypted workbench
│   └── pragma.workbench.enc      // encrypted workbench (if enabled)
└── knowledge_base/               // optional — mount your own via KB_DIR env var
    ├── services/
    │   ├── ssh.md                // each .md file becomes a card
    │   ├── http.md
    │   └── smb.md
    ├── attacks/                  // subdirectory name becomes the category
    │   ├── lfi.md
    │   └── sqli.md
    ├── tunneling/                // any subdirectory works — fully dynamic
    │   └── ligolo-ng.md
    └── methodologies/            // reserved for Tactical Guides tab
        ├── active-directory.md
        └── pivoting.md
```

> **Knowledge Base:** Every subdirectory under `knowledge_base/` automatically becomes a category in the Services tab — no configuration needed. Only `methodologies/` is reserved for the Tactical Guides tab.

---

## Environment Variables

Set these in your `docker-compose.yml` to customise paths:

| Variable | Default | Description |
|---|---|---|
| `KB_DIR` | `./knowledge_base` | Path to your knowledge base directory |
| `METH_DIR` | `./knowledge_base/methodologies` | Path to your tactical guides directory |
| `SEARCH_URL` | `http://localhost:3002` | ENGRAM indexer URL |

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

### Rebuild after app.html / server.js changes

```bash
docker compose down && docker compose up -d --build
```

---

## Running with ENGRAM

To enable full-text search of indexed online sources, run PRAGMA and ENGRAM on a shared Docker network:

```yaml
services:
  pragma:
    build: .
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      - SEARCH_URL=http://engram:3002
    networks:
      - pragma-net

  engram:
    image: engram:latest
    networks:
      - pragma-net

networks:
  pragma-net:
```

See the [ENGRAM repository](https://github.com/VJakoby/engram) for setup instructions.