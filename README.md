<table>
  <tr>
    <td valign="middle">
      <img src="public/Top-bar-logo.png" alt="PRAGMA Logo" width="500">
    </td>
  </tr>
</table>

**PRAGMA** is an operational workbench app built for pentest engagements and CTF — integrating local + online KB with active engagement note taking, running completely local.

At its core: it is a focused Markdown editor organized around sessions and targets, with a right-side context panel that surfaces your KB, tactics, and search results without pulling you out of the flow. Evidence and loot capture is first-class, not bolted on.

---

## ⚠️ Notice

PRAGMA is a documentation and workflow tool for security testing.

It does not interact with targets directly, but is intended for use in authorized environments only, such as professional engagements, lab setups, and CTF platforms.

You are responsible for ensuring your work complies with applicable laws and rules of engagement.

---

## 🚩 The problem it solves

Pentest work demands focus, but the tools don't support it. Notes end up in one place, findings in another, methodology references somewhere else entirely. Generic editors have no concept of an engagement. Reporting platforms are built for output, not the process.

PRAGMA keeps everything in the same view — structured enough to be useful, local enough to be trusted.

---

## ❌ What it is NOT

- Not a reporting tool
- Not a team platform
- Not an exploit framework
- Not cloud-dependent

---

## ✅ What it IS

- A local web application
- A workflow workbench
- A knowledge-integrated interface

---

## 👤 Who This Is For

Built for operators who want a focused local-first workflow tool.

---

## 🎯 Focus Model

- Engagement notes are primary workspace
- KB and tactics support the workflow
- Stay in operational flow

---

## 🧱 Tech Stack

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

---

## 🏷️ Features

Sessions, Notes, Quick Log, Evidence, Loot, TODO, KB, Encryption, Templates, Search, Targets
* 📝Note Templates
  * Supports structured markdown templates with variants.
* 🔐 Security
  * Local-first, encrypted workbench storage, localhost-bound.
* 🎯 Target Injection
  * Automatic placeholder injection for active targets in notes and KB.

## Optional Modules

ENGRAM — https://github.com/VJakoby/engram  
Toolbox — https://github.com/VJakoby/matrix-toolbox  

---

## 🛠️ Requirements

Node.js 20+, optional Docker

---

## 🚀 Quick Start

```
cp .env.example .env
docker compose up -d --build
http://localhost:3000
```
---

## License & Notices

AGPL-3.0-or-later
"""
