# 🧭 PRAGMA

> A local workbench for pentest flow, notes, and knowledge — no cloud, no clutter.

---
## The Problem

Pentest workflows are fragmented — notes, findings, and knowledge live in different places, breaking focus and increasing cognitive load. Generic note tools lack structure, reporting platforms are too rigid, and cloud solutions add risk.

## What it is NOT

- **Not a reporting tool** — notes are for operational use, only drafts and not deliverables
- **Not a team platform** — single-operator, local-first by design
- **Not a scanner, exploit framework or automation platform** — it does not touch your targets or automate any scanning or exploitation.
- **Not cloud-dependent** — everything runs locally on your machine, and nothing leaves it

---

## What it IS

- **A local web application** — PRAGMA runs entirely on your machine, combining structured note-taking with a searchable knowledge base

- **A workflow workbench** — built to support the natural flow of a penetration test, from initial access to post-exploitation with findings, without breaking focus

- **A knowledge-integrated interface** — pairs with ENGRAM (local knowledge base indexer on `http://localhost:3002`) to enable full-text knowledge base lookups from defined online sources directly inside the app

---

## Features

**Sessions**

- Create named engagement sessions (e.g. `OP-BLACKSITE`, `CLIENT-XYZ`)
- Each session tracks its own targets (IP, domain, label)
- Active target IP/domain auto-injects into KB code blocks
- Export sessions as `.session` files (JSON) for portability between instances
- Import `.session` files to resume work on another machine

**Encrypted Session (optional, per-session)**

- Toggle via 🔒 **Encrypted Session** in the sidebar 
- Workspace data (notes + sessions) is encrypted client-side with AES-256-GCM before disk write — the server stores ciphertext only
- Key derived from your password using PBKDF2 (SHA-256, 310k iterations)
- Password is held in memory only for the session — never written to disk, localStorage, or sent to the server
- Reload requires password to decrypt the workspace
- `.session` exports can be encrypted with a separate password for secure portability (server not involved)

**Session Notes**
- Six structured note types with pre-filled markdown templates: `General`, `Credentials`, `Recon`, `PrivEsc`, `Loot`, `Exploit`
- Free-form tags with sidebar filter and command palette search
- Auto-save with manual `⌘S` override
- Reassign notes between sessions at any time
- Export notes to markdown files (`notes/<session>/`)

**Knowledge Base**
- Recursively indexes all Markdown files under `knowledge_base/` (even in sub-directories)
- Files are served locally and can be edited directly in the UI — changes write back to disk
- File watcher triggers automatic re-indexing on modification
- Code blocks support per-line copy with IP placeholders replaced on copy

**Search**
- Full-text search via PKBI/ENGRAM indexer (port 3002)
- Relevance scoring, fuzzy matching, local/online scope filter
- Search results open inline in the content panel

**Interface**
- Command palette (`⌘K`) for quick navigation across everything
- Keyboard shortcuts for all major actions
- Resizable panels, dark/light mode
- Drag-and-drop resizable notes list and content panel


## 🛠️ Requirements
### [ENGRAM](https://github.com/VJakoby/engram) — Required for search function of indexed sources
- PRAGMA's search functionality for online sources depends on the ENGRAM indexer running as a separate service on the same machine, on port 3002. Without it, the KB online search view will seen as offline.

- This could also be improved by setting them up in the same Docker-compose.yml file in the future.

## 🚀 Quick Usage
Read [DOCKER](./DOCKER.md)

```bash
# Build the image
docker compose up --build

# Access it on  https://localhost:3000
```

### 1. Manually with NPM
```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open in browser
http://localhost:3000
```

---
Created by VJakoby + 🤖 | Licensed under MIT | [View AI & Architectural Disclosure](./AI-DISCLOSURE.md)
