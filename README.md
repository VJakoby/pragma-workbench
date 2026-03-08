# #️ PRAGMA // Workbench

> A local workbench for pentest notes, encrypted sessions, and a target-aware KB — no cloud, no clutter.

---
## 🚩 My Problem

Pentest workflows are fragmented — notes, findings, and knowledge live in different places, breaking focus and increasing cognitive load. Generic note tools lack structure, reporting platforms are too rigid, and cloud solutions add risk.

## ❌ What it is NOT

- **Not a reporting tool** — notes are for operational use, only drafts and not deliverables
- **Not a team platform** — single-operator, local-first by design
- **Not a scanner, exploit framework or automation platform** — it does not touch your targets or automate any scanning or exploitation
- **Not cloud-dependent** — everything runs locally on your machine, and nothing leaves it


## ✅ What it IS

- **A local web application** — PRAGMA runs entirely on your machine, combining structured note-taking with a searchable knowledge base
- **A workflow workbench** — built to support the natural flow of a penetration test, from initial access to post-exploitation with findings, without breaking focus
- **A knowledge-integrated interface** — integrated search functionality with ENGRAM (local knowledge base indexer on `http://localhost:3002` or `http://engram:3002` in docker-network) to enable full-text knowledge base lookups from defined online sources directly inside the app

## 🏷️ Features

**Sessions & Targets**
- Named sessions with multi-target tracking (IP, domain, label)
- Active target auto-injects into all code blocks at copy time across KB and Tactical Guides
- Session status tracking (Active / Paused / Complete) with timeline view
- Export/import sessions as JSON for portability; notes export as structured markdown

**Encryption**
- Full workbench encryption (AES-256-GCM, PBKDF2-SHA-512, 600k iterations) — client-side only
- Server stores ciphertext; password never touches disk, localStorage, or the network
- Workbench file is portable — moving to another machine is a file copy

**Notes**
- Typed notes with markdown templates (`Blank`, `Enumeration`, `Credentials`, `Recon`, `PrivEsc`, `Loot`, `Exploit`, …)
- Tags, auto-save, session reassignment, and a Timeline view for chronological activity
- Tool output parser — paste raw output from `nmap`, `masscan`, `gobuster` and similar tools directly into notes with structured formatting

**Knowledge Base & Tactical Guides**
- Indexes all `.md` files under `knowledge_base/` and `methodologies/` recursively
- Editable in-UI with live disk write-back and auto re-index on change
- Every code block and inline backtick span is click-to-copy with target IP injected
- Full-text search with weighted relevance scoring, fuzzy matching, and per-result match type (exact / fuzzy / partial)
- Local/remote scope filter, source filter, and query-term snippet highlighting in results
- Degrades gracefully if ENGRAM is offline, with a one-click reachability check

**Interface**
- Command palette (`⌘K`), keyboard shortcuts for all major actions, dark/light mode
- Quick Log (`Ctrl+L`) for fast port/service capture during enumeration


## 🛠️ Requirements

- Node.js 20+
- **Optional:** 
    - docker & docker-compose
    - [ENGRAM](https://github.com/VJakoby/engram) — Required for search of indexed online sources.

When running both services in Docker, they communicate over a shared internal network. See [DOCKER.md](./DOCKER.md) for setup.

## 🚀 Quick Start

See [DOCKER.md](./DOCKER.md) for full Docker instructions.

```bash
# Build and start
docker compose up -d --build

# Access at
http://localhost:3000
```

### Running manually with Node.js
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