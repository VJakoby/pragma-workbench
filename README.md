# 🧭 PRAGMA

> Engagement note workbench for penetration testers. Track findings, manage sessions, and pull knowledge base context — all from within the same place, locally.

---

## What it is NOT

- **Not a reporting tool** — notes are for operational use, only drafts and not deliverables
- **Not a team platform** — single-operator, local-first by design
- **Not a scanner, exploit framework or automation platform** — it does not touch your targets or automate any scanning
- **Not cloud-dependent** — everything runs on locally on the machine(safest in a VM), nothing leaves it

---

## What it IS

- **A local web application** — PRAGMA runs entirely on your machine, combining structured note-taking with a searchable knowledge base

- **A workflow workbench** — built to support the natural flow of a penetration test, from initial access to post-exploitation with findings, without breaking focus

- **A knowledge-integrated interface** — pairs with PKBI/ENGRAM (local indexer on localhost:3002) to enable full-text knowledge base lookups from defined online sources directly inside the app

---

## Features

**Sessions**

- Create named engagement sessions (e.g. `OP-BLACKSITE`, `CLIENT-XYZ`)
- Each session tracks its own targets (IP, domain, label)
- Active target IP/domain auto-injects into KB code blocks
- Export sessions as `.session` files (JSON) for portability between instances
- Import `.session` files to resume work on another machine

**Encrypted Session (optional, per-session)**

- Enabled via the 🔒 **Encrypted Session** button in the sidebar. 
- When active, all workspace data (notes + sessions) is encrypted **client-side** using AES-256-GCM before being written to disk — the server stores only the ciphertext and never sees the plaintext
- The encryption key is derived from your password using PBKDF2 (310,000 iterations, SHA-256)
- Your password exists **in memory only** for the duration of the session — it is never written to disk, localStorage, or sent to the server
- On reload, you are prompted for your password to decrypt and load the workspace
- `.session` export files can optionally be encrypted with a separate password for secure portability — the server is not involved in this process

**Session Notes**
- Six structured note types with pre-filled markdown templates: `General`, `Credentials`, `Recon`, `PrivEsc`, `Loot`, `Exploit`
- Free-form tags with sidebar filter and command palette search
- Auto-save with manual `⌘S` override
- Reassign notes between sessions at any time
- Export notes to markdown files (`notes/<session>/`)

**Knowledge Base**
- Local KB files served from `knowledge_base/` (services) and `knowledge_base/methodologies/` (tactical guides)
- Edit KB files directly in the UI — changes write back to disk
- File watcher auto-reindexes on change
- Code blocks with per-line copy — IP placeholders replaced on copy

**Search**
- Full-text search via PKBI/ENGRAM indexer (port 3001)
- Relevance scoring, fuzzy matching, local/online scope filter
- Search results open inline in the content panel

**Interface**
- Command palette (`⌘K`) for quick navigation across everything
- Keyboard shortcuts for all major actions
- Resizable panels, dark/light mode
- Drag-and-drop resizable notes list and content panel

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Single-file HTML/CSS/JS (`app.html`) |
| Backend | Node.js + Express (`server.js`) |
| Search | PKBI/ENGRAM (separate service, port 3001) |
| Storage | `notes.json` (flat file), `knowledge_base/` (markdown files) |

## Requirements
### PKBI/ENGRAM — required for search
> [PKBI/ENGRAM](https://github.com/VJakoby/pkbi)
- PRAGMA's search functionality for online sources depends on the PKBI/ENGRAM indexer running as a separate service on the same machine, on port 3002. Without it, the KB online search view will seen as offline.

- This could also be improved by setting them up in the same Docker-compose.yml file in the future.

## Usage
### Quickest way.

- Place YOUR personal methodology markdown files in the following directory structure example: 
```
knowledge_base/      ← Knowledge-base base directory
├── services/        ← Services (e.g. ftp.md, 22.md, smb.md)
├── attacks/         ← Attacks (e.g. lfi.md, sqli.md, ssrf.md)
└── methodologies/   ← Tactical guides (e.g, active-directory.md, linux-priv-esc.md)
```

```bash
#  Build the image and access https://localhost:3000
docker compose up --build
```

### Manually with NPM
```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open in browser
http://localhost:3000
```

---
*v1.0*

Created by VJakoby + 🤖
