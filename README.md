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

## 📸 Screenshots
<p align="left">
  <a href="./screenshots/pragma-session-notes.png" target="_blank"><img src="./screenshots/pragma-session-notes.png" width="24%"></a>
  <a href="./screenshots/pragma-sessions.png" target="_blank"><img src="./screenshots/pragma-sessions.png" width="24%"></a>
  <a href="./screenshots/pragma-kb.png" target="_blank"><img src="./screenshots/pragma-kb.png" width="24%"></a>
  <a href="./screenshots/pragma-encrypted-workbench.png" target="_blank"><img src="./screenshots/pragma-encrypted-workbench.png" width="24%"></a>
</p>

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

---

## 🎯 Target Injection Reference

When a session has an active target set, PRAGMA automatically replaces placeholder variables in KB documents and Tactical Guides with the target's IP and domain — highlighted in yellow on render, and injected at copy time in code blocks.

Write your KB docs using any of the supported placeholder styles below.

### IP / Host → Active Target IP

| Style | Supported placeholders |
|---|---|
| Angle brackets | `<IP>` `<ip>` `<TARGET>` `<TARGET_IP>` `<target_ip>` `<RHOST>` `<rhost>` `<HOST>` `<host>` `<MACHINE_IP>` |
| Shell variables | `$IP` `$RHOST` `$TARGET` `$TARGET_IP` `$HOST` |
| Curly braces | `{IP}` `{ip}` `{RHOST}` `{rhost}` `{TARGET}` `{HOST}` `{host}` |
| Double curly | `{{ip}}` `{{IP}}` `{{target}}` `{{rhost}}` `{{host}}` `{{HOST}}` |
| Bare words | `TARGET_IP` `TARGET_IP_ADDRESS` `RHOST` `TARGET` `MACHINE_IP` |
| HTB-style literals | `10.10.10.X` `10.10.X.X` |
| Backtick-scoped only | \`IP\` \`HOST\` — injected **only inside inline code**, not in plain prose |

### Domain / FQDN → Active Target Domain

| Style | Supported placeholders |
|---|---|
| Angle brackets | `<DOMAIN>` `<domain>` `<TARGET_DOMAIN>` `<FQDN>` `<fqdn>` `<DC>` `<dc>` `<WORKGROUP>` |
| Shell variables | `$DOMAIN` `$FQDN` `$DC` |
| Curly braces | `{DOMAIN}` `{domain}` `{FQDN}` |
| Double curly | `{{domain}}` |
| Bare words | `TARGET_DOMAIN` `DOMAIN` `WORKGROUP` |

> **Note on bare `IP` and `HOST`:** These are common English words, so global replacement would cause false positives in prose. PRAGMA only injects them when wrapped in backticks — e.g. `` `nmap -sV IP` `` or `` `curl HOST/api` `` — leaving sentences like *"Enter the target IP"* untouched.

---

## 🛠️ Requirements

- Node.js 20+
- **Optional:** 
    - docker & docker-compose
    - [ENGRAM](https://github.com/VJakoby/engram) — Required for search of indexed online sources.

See [DOCKER.md](./DOCKER.md) for the full project directory structure, volume mounts, and how to run both PRAGMA and ENGRAM together over a shared Docker network.

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