# Docker Guide

This guide covers the recommended Docker-based setup for PRAGMA.

## Quick Start

```bash
cp .env.example .env
docker compose up -d --build
```

Open `http://localhost:3000`.

## What Docker Mounts

The compose file mounts these local paths into the container:

- `./server`
- `./public`
- `./views`
- `./server.js`
- `./note-templates.json`
- `${PRAGMA_KB_PATH:-./knowledge-base}`
- `${PRAGMA_SESSIONS_PATH:-./sessions}`

That means your checked-out app code, KB, and session data stay on the host.

## Important Environment Variables

### Required for normal local Docker use

- `PRAGMA_UID`
- `PRAGMA_GID`
- `PRAGMA_KB_PATH`
- `PRAGMA_SESSIONS_PATH`

The defaults in `.env.example` are suitable for a normal local install.

### Optional integrations

- `ENGRAM_SEARCH_ENABLED`
- `SEARCH_URL`
- `TOOLBOX_ENABLED`
- `TOOLBOX_URL`
- `TOOLBOX_URLS`

PRAGMA does not require ENGRAM or Toolbox to start.

### Optional PDF export

- `PDF_EXPORT_ENABLED`

If `true`, the Docker build includes Chromium for PDF export.
If you change this setting, rebuild the image:

```bash
docker compose up -d --build
```

## First-Run Notes

- The app is published on `127.0.0.1:3000` only
- Session data persists in the host-side sessions path
- The KB path may be empty; PRAGMA will still start cleanly

## Stopping

```bash
docker compose down
```
