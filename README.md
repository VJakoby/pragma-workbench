# PRAGMA

> Engagement note workbench for penetration testers. Track findings, manage sessions, and pull knowledge base context — all from within the same place, locally.

---

## What it is NOT

- **Not a reporting tool** — notes are for operational use, only drafts and not deliverables
- **Not a team platform** — single-operator, local-first by design
- **Not a scanner, exploit framework or automation platform** — it does not touch your targets or automate any scanning
- **Not cloud-dependent** — everything runs on locally on the machine(safest in a VM), nothing leaves it

---

## What it is

PRAGMA is a local web application that combines structured note-taking with a searchable knowledge base(online sources). It is designed to support the natural flow of a penetration testing engagement — from initial recon through to loot — without breaking your concentration.

It pairs with **PKBI/ENGRAM**, a local search indexer(needs to run on localhost:3002) that enables full-text KB lookups from within the interface.

---

## Features

**Sessions**
- Create named engagement sessions (e.g. `OP-BLACKSITE`, `CLIENT-XYZ`)
- Each session tracks its own targets (IP, domain, label)
- Active target IP/domain auto-injects into KB code blocks
- Export sessions as `.session` files for portability between instances
- Import `.session` files to resume work on another machine

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
PRAGMA's search functionality depends on the PKBI/ENGRAM indexer running as a separate service on the same machine, on port 3002. Without it, the KB search view will show as offline — all other features work independently.

> Repo: [PKBI](https://github.com/VJakoby/pkbi)

Start the indexer before launching PRAGMA, then point it at your knowledge_base/ directory as described in its own setup guide.

---

## Getting Started

```bash
# Install dependencies
npm install

# Start the server
npm start

# Open in browser
http://localhost:3000
```

Place your personal methodology markdown files in:
```
knowledge_base/          ← Services (e.g. ftp.md, smb.md)
knowledge_base/methodologies/   ← Tactical guides
```
---

## Session Portability

Export a session from the Sessions modal (`⬇ .session`). The file contains all session metadata, targets, and notes. Import it on any PRAGMA instance to resume.

---
*v1.0*

Created by VJakoby + 🤖
