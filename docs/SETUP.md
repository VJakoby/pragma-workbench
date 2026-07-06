# Setup Guide

This guide covers the minimum local setup for PRAGMA and explains which paths and integrations are optional.

## Minimum Setup

PRAGMA needs:
- Node.js 20+
- a writable session storage path
- an optional knowledge base path

Bootstrap the local config:

```bash
cp .env.example .env
```

The default values are enough for a normal local run.

## Storage Paths

### `sessions/`

Default: `./sessions`

This is where PRAGMA stores workbench session data. It should exist on persistent local storage.

### `knowledge-base/`

Default: `./knowledge-base`

This path is optional. If it is empty or missing, PRAGMA still runs; the KB areas will simply show empty-state guidance.

Recommended setup:
- If you already maintain a personal knowledge base elsewhere, point `./knowledge-base` to it with a symbolic link
    - `ln -s /path/to/your/knowledge-base knowledge-base`
- This keeps PRAGMA aligned with your existing KB without copying files into the repo

## Run Modes

- For Docker-based setup, use [DOCKER.md](DOCKER.md)
- For direct Node setup, use the steps below

## Direct Node Setup

Install dependencies and start the app:

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Optional Integrations

### ENGRAM

Optional unified search / external search integration.

Relevant env vars:
- `ENGRAM_SEARCH_ENABLED`
- `SEARCH_URL`

If ENGRAM is not running, disable it by setting:

```env
ENGRAM_SEARCH_ENABLED=false
```

### Toolbox

Optional Toolbox integration.

Relevant env vars:
- `TOOLBOX_ENABLED`
- `TOOLBOX_URL`
- `TOOLBOX_URLS`

If Toolbox is not deployed, keep:

```env
TOOLBOX_ENABLED=false
```

## PDF Export

PDF export is optional.

Relevant env var:
- `PDF_EXPORT_ENABLED`

Set it to `false` if you do not want Chromium in the Docker image or do not need PDF export.
