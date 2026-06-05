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

## Notice

PRAGMA is a documentation and workflow tool for security testing.

It does not interact with targets directly, but is intended for use in authorized environments only, such as professional engagements, lab setups, and CTF platforms.

You are responsible for ensuring your work complies with applicable laws and rules of engagement.

---

## What It Solves

Pentest work demands focus, but the tools do not support it well. Notes end up in one place, findings in another, methodology references somewhere else entirely. Generic editors have no concept of an engagement. Reporting platforms are built for output, not the process.

My idea for PRAGMA keeps everything in the same view — structured enough to be useful, without breaking the flow.

---

## What It Is

- A local web application
- A markdown editor
- A workflow workbench
- A knowledge-integrated interface

## What It Is Not

- Not a reporting tool
- Not a team platform
- Not an exploit framework
- Not cloud-dependent

---

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

---

## Quick Start

### Docker

```bash
cp .example.env .env
docker compose up -d --build
```

Open `http://localhost:3000`.

### Direct Node.js

```bash
cp .example.env .env
npm install
npm start
```

Open `http://localhost:3000`.

---

## Setup Guides

- [Setup Guide](docs/SETUP.md)
- [Docker Guide](docs/DOCKER.md)
- [Feature Spec 001](docs/SPEC-01.md)

---

## Optional Modules

- ENGRAM — <https://github.com/VJakoby/engram>
- Toolbox — <https://github.com/VJakoby/matrix-toolbox>

These are optional. PRAGMA runs totally fine without them.

---

## Requirements

- Node.js 20+
- Docker / Docker Compose optional

---

## License

AGPL-3.0-or-later
