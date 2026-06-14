# PRAGMA Setup

This guide focuses on the practical setup of PRAGMA itself.
It covers the simple local-first setup, optional components, runtime paths, and first-run validation.

Core setup is straightforward:
- PRAGMA runs on its own
- the normal setup already includes a usable local `knowledge-base/` path
- that KB can start empty and you can build it gradually
- setup becomes meaningfully more complex only when ENGRAM is added as a separate integration

For container details, see `DOCKER.md`.

---

## 1. What Is Required

Required:
- the PRAGMA repo
- a writable session storage path
- Node or Docker, depending on how you run it

Optional:
- a personal `knowledge-base/`
- ENGRAM through `SEARCH_URL`
- PRAGMA Toolbox or other adjacent tooling

PRAGMA works without ENGRAM and without a populated KB.

---

## 2. Recommended Local Layout

A clean local layout is:

```text
operator-workspace/
├── pragma-workbench/
│   └── ...repo...
├── pragma-data/
│   ├── sessions/
│   └── knowledge-base/
└── optional/
    ├── engram/
    └── toolbox/
```

This keeps:
- repo code
- session data
- KB content
- optional supporting tools

separate from each other.

---

## 3. Runtime Paths

The main runtime paths are:
- `SESSIONS_DIR`
- `KB_DIR`
- `SEARCH_URL`

Recommended behavior:
- keep `SESSIONS_DIR` on persistent host storage
- point `KB_DIR` at the KB you actually maintain
- use `SEARCH_URL` only if ENGRAM is running

In the default/basic setup:
- `knowledge-base/` is available from the start
- it is valid for that directory to be empty initially
- ENGRAM is not required to begin building and using your own KB

Recommended PRAGMA data layout:

```text
pragma-data/
├── sessions/
│   ├── pragma.workbench
│   ├── pragma.workbench.enc
│   ├── attachments/
│   └── backup/
└── knowledge-base/
    ├── services/
    ├── tactics/
    └── <other-sections>/
```

---

## 4. Knowledge Base Setup

PRAGMA expects these top-level KB folders:
- `services/` -> `Services`
- `tactics/` -> `Tactics`
- any other top-level folder -> its own KB section

Recommended structure:

```text
knowledge-base/
├── services/
│   ├── smb.md
│   ├── ssh.md
│   └── winrm.md
├── tactics/
│   ├── active-directory.md
│   ├── kerberos.md
│   └── pivoting.md
├── web/
├── windows/
└── attacks/
```

Recommended practice:
- keep KB content curated and reusable
- keep scratch notes in sessions, not in the KB
- prefer shallow top-level folders over deep trees

If your KB lives elsewhere, using a symlink into `./knowledge-base` is a good local setup pattern.

If you do not already have a KB:
- leave `knowledge-base/` in place
- start with empty `services/` and `tactics/`
- add files as your own library grows

That is still a complete and valid setup.

---

## 5. Environment and Bootstrap

Typical first-run flow:

1. create or copy your environment file
2. set session and KB paths if you do not want defaults
3. start PRAGMA with Node or Docker
4. verify the session store and optional KB mount are working

Important values to check:
- `SESSIONS_DIR`
- `KB_DIR`
- `SEARCH_URL`
- Docker-oriented path variables if you run containers

If ENGRAM is not present, leave `SEARCH_URL` unset or point it only when available.

---

## 6. Common Setup Patterns

### Minimal local setup

Use this when you only want PRAGMA itself:
- local session storage
- local KB available from the start, even if empty
- no ENGRAM

This gives you:
- sessions
- notes
- Quick Log
- Evidence
- local KB browsing
- local search

### Preferred daily setup

Use this when PRAGMA is part of your normal workflow:
- persistent `sessions/`
- maintained `knowledge-base/`
- ENGRAM reachable through `SEARCH_URL`

This gives you everything above plus indexed external search.

### Adjacent-tooling setup

Use this only if you also run Toolbox or other side utilities.
PRAGMA does not require them.

---

## 7. First-Run Validation

After startup, validate these points:

1. the app opens and creates/loads a session normally
2. notes save without errors
3. attachments and backup/session files are written to the expected session path
4. KB sections load if `KB_DIR` is configured
5. `KB Search` only expects ENGRAM if `SEARCH_URL` is configured

If something is wrong, check path mapping first before assuming an app issue.

---

## 8. Startup Order

### PRAGMA only
1. start PRAGMA

### PRAGMA + ENGRAM
1. start ENGRAM
2. start PRAGMA
3. verify `KB Search` can reach ENGRAM

### PRAGMA + optional side tooling
1. start the side tooling when needed
2. start ENGRAM if used
3. start PRAGMA

---

## 9. Practical Summary

Short version:
- PRAGMA is the only required component
- the local KB path is part of the normal setup and may start empty
- ENGRAM is optional but useful
- keep repo code and runtime data separate
- keep `sessions/` persistent
- build KB content gradually as your own reusable library
