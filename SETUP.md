# PRAGMA Ecosystem Setup

This document explains the setup around:

- `PRAGMA` — the main workbench
- `ENGRAM` — optional indexed search backend
- `PRAGMA // Toolbox` — optional adjacent toolbox

Use this as the short ecosystem/setup guide. It focuses on runtime layout, KB structure, and integration points. For container details, see [DOCKER.md](./DOCKER.md).

---

## 1. What Each Piece Is

### PRAGMA

PRAGMA is the core application.

It owns:
- sessions
- notes
- KB browsing
- TODO / Log / Loot / Evidence
- local workflow state

PRAGMA works on its own.

### ENGRAM

ENGRAM is optional.

It adds indexed external source search to PRAGMA's `KB Search` view through `SEARCH_URL`.

If ENGRAM is not running:
- PRAGMA still works
- local KB search still works
- only the external indexed search surface is unavailable

### PRAGMA // Toolbox

PRAGMA // Toolbox is optional.

It is not a dependency of PRAGMA. Treat it as adjacent tooling rather than part of the PRAGMA runtime.

---

## 2. Recommended Setup

The preferred setup is:

- ENGRAM running and reachable through `SEARCH_URL`
- persistent host storage for `sessions/`
- a curated host-backed `knowledge-base/`

Practical path advice:

- keep the repo and runtime data in separate folders
- keep `sessions/` on persistent storage
- point `knowledge-base/` to the KB tree you actually maintain, not a temporary scratch folder

---

## 3. Required vs Optional

### Minimum

`PRAGMA`

Gives you:
- notes
- sessions
- local KB
- local search
- TODO / Log / Evidence

### Preferred

`PRAGMA + ENGRAM`

Gives you:
- everything above
- indexed external search inside `KB Search`

### Optional broader ecosystem

`PRAGMA + ENGRAM + PRAGMA // Toolbox`

Use this only if you want PRAGMA // Toolbox as separate supporting tooling.

---

## 4. Recommended File Structure

Preferred workspace layout:

```text
operator-workspace/
├── pragma-workbench/
│   └── ...repo...
├── pragma-data/
│   ├── sessions/
│   └── knowledge-base/
└── optional/
    ├── engram/
    └── matrix-toolbox/
```

Preferred PRAGMA runtime layout:

```text
pragma-data/
├── sessions/
│   ├── pragma.workbench
│   ├── pragma.workbench.enc
│   ├── attachments/
│   └── backup/
└── knowledge-base/
    ├── services/            # Directory must exist
    ├── tactics/             # Directory must exist
    └── <other-sections>/    # Can be whatever
```

This keeps:
- repo code
- runtime state
- optional external tools

cleanly separated.

---

## 5. Recommended KB Structure

PRAGMA expects:

- `knowledge-base/services/` -> `Services`
- `knowledge-base/tactics/` -> `Tactics`
- other top-level folders -> separate KB sections

Recommended shape:

```text
knowledge-base/
├── services/
│   ├── smb.md
│   ├── ssh.md
│   └── winrm.md
├── tactics/
│   ├── active-directory.md
│   ├── pivoting.md
│   └── kerberos.md
├── attacks/
├── web/
└── windows/
```

Preferred KB style:

- one topic per markdown file
- shallow, meaningful top-level sections
- curated content, not scratch notes dumped into the KB

Less ideal:

- very deep folder trees
- huge mixed-topic markdown files
- mixing scratchpad content with reusable KB content

---

## 6. Important Paths and Config

Main PRAGMA runtime paths:

- `KB_DIR`
- `SESSIONS_DIR`

Most important integration setting:

- `SEARCH_URL` -> ENGRAM endpoint

Common examples:

- local ENGRAM: `http://localhost:3002`
- Docker/shared network: `http://engram:3002`

In Docker-oriented setups, you will most often care about:

- `PRAGMA_UID`
- `PRAGMA_GID`
- `PRAGMA_KB_PATH`
- `PRAGMA_SESSIONS_PATH`
- `SEARCH_URL`

---

## 7. Suggested Startup Order

### PRAGMA only

1. Start PRAGMA

### PRAGMA + ENGRAM

1. Start ENGRAM
2. Start PRAGMA
3. Confirm `ENGRAM` is reachable in `KB Search`

### PRAGMA + ENGRAM + PRAGMA // Toolbox

1. Start supporting tooling as needed
2. Start ENGRAM
3. Start PRAGMA

---

## 8. Summary

Short version:

- `PRAGMA` is the required core
- `ENGRAM` is the preferred optional search backend
- `PRAGMA // Toolbox` is optional supporting tooling

Best practical setup:

- persistent `sessions/`
- curated `knowledge-base/`
- ENGRAM wired through `SEARCH_URL`

If ENGRAM is absent:

- PRAGMA still runs normally
- local KB search still works
- only indexed external search is unavailable
