<div align="center">
  <img src="public/Top-bar-logo.png" alt="PRAGMA Logo" width="400">
  
  [![License](https://img.shields.io/github/license/VJakoby/pragma-workbench?style=flat&color=red)](LICENSE)
![dock](https://img.shields.io/badge/environment-local%20%7C%20self--hosted-darkoctober?style=flat)
![Docker](https://img.shields.io/badge/docker-ready-blue)
![](https://img.shields.io/badge/node.js-v20+-green?style=fat&logo=node.js&logoColor=white)
</div>

---

**PRAGMA // Workbench** is a self-hosted, completely local operational workbench designed for pentest engagements and CTFs. 
It blends localized knowledge-base building with active, fast-paced engagement note-taking—keeping your *notes*, *evidence*, *loot*, and *tactics* all in the same place.

## Key Features
* 🏠 **Local & Self-Hosted:** Complete data privacy. Your notes, findings, and intelligence stay on your machine.

* 🎯**Context-Aware Interface:** A focused Markdown editor paired with a dynamic right-side panel that surfaces your KB, tactics, and search results without breaking your flow.

* 🗂️ **Target-Centric Architecture:** Effortlessly organize your workspace around specific sessions and targets.

* 💰 **First-Class Loot Capture:** Built-in workflows designed to capture, log, and organize evidence and loot on the fly.

* 🔒 **Zero-Knowledge Engagement Encryption:** 
Protect sensitive operation notes and attachments with robust, client-side encryption. Your data is encrypted before it ever leaves the browser—ensuring complete privacy for high-stakes engagements.


## Notice

PRAGMA is a documentation and workflow tool for security testing.

It does not interact with targets directly, but is intended for use in authorized environments only, such as professional engagements, lab setups, and CTF platforms.

You are responsible for ensuring your work complies with applicable laws and rules of engagement.

## What It Solves

Pentest work demands focus, but the tools do not support it well. Notes end up in one place, findings in another, methodology references somewhere else entirely. Generic editors have no concept of an engagement. Reporting platforms are built for output, not the process.

My idea for PRAGMA keeps everything in the same view — structured enough to be useful, without breaking the flow.

## What It Is Not

- Not a reporting tool
- Not a team platform
- Not an exploit framework
- Not cloud-dependent

## Tech Stack

- Node.js
- Express
- EJS
- Vanilla JS
- CodeMirror 6
- marked
- Fuse.js
- Web Crypto API
- File-backed storage
- Docker / Docker Compose


## Requirements

- Node.js 20+
- Docker / Docker Compose optional

---

## Quick Start

### Docker (Highly recommended)

```bash
cp .example.env .env

# Point towards your local KB directory
PRAGMA_KB_PATH=/path/to/your/local/kb-dir
# or
# Document it from scratch and start fresh
docker compose up -d --build
...
Open `http://localhost:3000` and start with your engagement/CTF.
```

### Direct Node.js

```bash
cp .example.env .env
npm install
npm start
...
Open http://localhost:3000
```

## Full Setup Guides

- [Setup Guide](docs/SETUP.md)
- [Docker Guide](docs/DOCKER.md)
- [Feature Spec 001](docs/SPEC-01.md)

## Optional Modules

- ENGRAM — <https://github.com/VJakoby/engram>
- Toolbox — <https://github.com/VJakoby/matrix-toolbox>

These are optional. PRAGMA runs totally fine without them.

---

## License

AGPL-3.0-or-later
