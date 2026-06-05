# PRAGMA Usage

PRAGMA is built around one main idea:
- the note is the primary workspace
- the rest of the UI exists to support the note, not replace it

---

## 1. Normal Workflow

A typical engagement flow is:

1. create or open a session
2. create or select the current target
3. open a working note from a template
4. use KB and service context as reference while writing
5. log structured findings through Quick Log
6. flag proof directly from the note as Evidence
7. generate a summary when the session needs review, export, or handoff

---

## 2. Sessions and Targets

### Sessions

A session is the main operational container.
It holds:
- notes
- targets
- Quick Log data
- Evidence
- session-level state

Use a new session when the engagement itself changes.

### Targets

Targets are the scoped hosts or domains inside a session.
Switching targets matters because several PRAGMA surfaces follow the active target context.

Use targets when you want:
- per-host network enumeration
- per-host service logging
- cleaner separation inside one engagement

---

## 3. Notes as the Source of Truth

The note editor is the main workspace.
Use notes for:
- command history worth keeping
- findings
- attack path reasoning
- dead ends
- confirmed results
- report-ready summaries

Recommended pattern:
- keep one main working note open
- add more notes only when the work really branches
- use templates for repeatable note structure

---

## 4. KB, Services, and Tactics

These are reference surfaces.
Use them when you need:
- a procedure
- a service reminder
- a workflow checklist
- a short tactic reference

Recommended pattern:
- open KB context when needed
- take the actual working notes in the session note
- link back to useful KB entries rather than rewriting the same guidance everywhere

---

## 5. Quick Log

Quick Log is for structured operational data:
- `Ports`
- `Paths`
- `Loot`
- `Evidence` is related, but managed through note flagging rather than as a primary import surface

Use Quick Log when you want structured data without manually formatting tables in notes.

### Ports

Use `Ports` for service discovery results.
Typical use:
- import Nmap output
- add single services manually
- link a port to a KB service if available

Target behavior:
- `Ports` are target-scoped
- when a target is active, you only see ports for that target
- the same port can exist on different targets without colliding

### Paths

Use `Paths` for web discovery and endpoint logging.
Typical use:
- import ffuf / gobuster / dirb-style output
- track HTTP status and context notes

Target behavior:
- `Paths` are target-scoped
- when a target is active, you only see paths for that target

### Loot

Use `Loot` for:
- credentials
- hashes
- tokens
- keys
- other reusable data

Loot supports both scopes:
- target-bound loot
- session-wide loot

Behavior:
- if you add loot while a target is active, it can be tied to that target
- if you add loot without a target context, it stays session-wide
- session-wide loot remains visible across targets

### Quick Log Sync Notes

If you rely on automatic sync, keep the expected templates available:
- `Network Enumeration`
- `Credentials`

Those note types are the structured destination for synced Quick Log content.

---

## 6. Evidence Flow

Evidence is for proof that matters later.
Instead of manually copying proof into a separate table, mark the relevant block directly from the note.

Recommended pattern:
- flag only proof that supports a finding, access path, or result
- keep the evidence title short
- keep the details meaningful enough for later review
- use `Jump to Source` when validating or exporting

Evidence can also feed related loot logging when the flagged block contains credentials or similar material.

---

## 7. Recommended Habits

- Keep the note as the source of truth.
- Use targets consistently if the engagement spans multiple hosts.
- Keep `Ports` and `Paths` scoped cleanly by switching to the right target before importing.
- Use `Loot` for reusable secrets instead of burying them in raw notes.
- Prefer KB links over duplicating the same guidance across notes.
- Generate summaries at meaningful milestones, not only at the very end.

---

## 8. Minimal Practical Example

1. Create a session for the engagement.
2. Add target A and target B.
3. Open a `Network Enumeration` or workflow note.
4. Switch to target A and import Nmap into `Ports`.
5. Switch to target B and import its results separately.
6. Add discovered web paths into `Paths` for the current target.
7. Add credentials or hashes into `Loot`.
8. Flag important command output from the note as Evidence.
9. Use KB service or tactic pages only as supporting context.
10. Generate a summary when the work needs to be reviewed or handed off.

---

## 9. Practical Summary

Short version:
- write in notes first
- use targets deliberately
- use Quick Log for structured findings
- treat KB as reference context
- flag proof as Evidence when it matters
- keep summaries for milestones and handoff points
