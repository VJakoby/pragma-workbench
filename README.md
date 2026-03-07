# #️ PRAGMA / Workbench

> A local workbench for pentest notes, encrypted sessions, and a target-aware KB — no cloud, no clutter.

---
## 🚩 The Problem

Pentest workflows are fragmented — notes, findings, and knowledge live in different places, breaking focus and increasing cognitive load. Generic note tools lack structure, reporting platforms are too rigid, and cloud solutions add risk.

## ❌ What it is NOT

- **Not a reporting tool** — notes are for operational use, only drafts and not deliverables
- **Not a team platform** — single-operator, local-first by design
- **Not a scanner, exploit framework or automation platform** — it does not touch your targets or automate any scanning or exploitation.
- **Not cloud-dependent** — everything runs locally on your machine, and nothing leaves it


## ✅ What it IS

- **A local web application** — PRAGMA runs entirely on your machine, combining structured note-taking with a searchable knowledge base
- **A workflow workbench** — built to support the natural flow of a penetration test, from initial access to post-exploitation with findings, without breaking focus
- **A knowledge-integrated interface** — Integrated search functionality with ENGRAM (local knowledge base indexer on `http://localhost:3002`) to enable full-text knowledge base lookups from defined online sources directly inside the app

## 🏷️ Features

**Workbenches & Sessions**
- Multiple isolated workbenches — one per engagement, switchable without restart
- Named sessions with multi-target tracking (IP, domain, label) per workbench
- Active target auto-injects into all code blocks at copy time across KB and Tactical Guides
- Export/import sessions as JSON for portability; notes export as structured markdown

**Encryption**
- Full workbench encryption (AES-256-GCM, PBKDF2-SHA-512, 600k iterations) — client-side only
- Server stores ciphertext; password never touches disk, localStorage, or the network

**Notes**
- Typed notes with markdown templates (`Blank`, `Enumeration`, `Credentials`, `Recon`, `PrivEsc`, `Loot`, `Exploit`, …)
- Tags, auto-save, session reassignment, and a Timeline view for chronological activity

**Knowledge Base & Tactical Guides**
- Indexes all `.md` files under `knowledge_base/` and `methodologies/` recursively
- Editable in-UI with live disk write-back and auto re-index on change
- Every code block and inline backtick span is click-to-copy with target IP injected
- Full-text search with weighted relevance scoring, fuzzy matching, and per-result match type (exact / fuzzy / partial)
- Local/remote scope filter and query-term snippet highlighting in results
- Degrades gracefully if ENGRAM is offline, with a one-click reachability check

**Interface**
- Command palette (`⌘K`), keyboard shortcuts for all major actions, dark/light mode
- Quick Log (`Ctrl+L`) for fast port/service capture during enumeration


## 🛠️ Requirements
### [ENGRAM](https://github.com/VJakoby/engram) — Required for search function of indexed sources
- PRAGMA's search functionality for online sources depends on the ENGRAM indexer running as a separate service on the same machine, on port 3002. Without it, the KB online search view will seen as offline.

- This could also be improved by setting them up in the same Docker-compose.yml file in the future.

## 🚀 Quick Usage
Read [DOCKER](./DOCKER.md)

```bash
# Build the image
docker compose up --build

# Access it 
https://localhost:3000
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
