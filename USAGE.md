# PRAGMA Usage

PRAGMA is built around one assumption: the note is the primary workspace.
The rest of the interface exists to support that note flow, not replace it.

## Typical Workflow

1. Open or create an engagement session.
2. Set the current target IP, domain, and label.
3. Create an Engagement Note from a template that matches the task.
4. Use Services, Tactics, and KB sections as side context while writing.
5. Import ports, paths, and loot through Quick Log as findings appear.
6. Flag commands or proof directly from the editor as Evidence.
7. Generate a summary when the session needs to be exported or handed off.

## Core Surfaces

### Engagement Notes

This is the main working area.
Use notes to document commands, findings, hypotheses, dead ends, and confirmed paths.

Recommended pattern:

- keep one primary note open while working
- use templates for repeatable workflows
- use additional notes only when the engagement genuinely branches

### Services, Tactics, and KB

These are reference surfaces.
Open them when you need a procedure, checklist, or reminder, then return to the note.

Recommended pattern:

- treat KB content as guidance, not as the main place you write
- link useful KB entries inside templates or notes with `[[kb:...]]`
- keep service and tactic content practical and short enough to scan quickly

### Quick Log

Quick Log is for structured inserts that should stay synchronized with the engagement:

- `Ports`
- `Paths`
- `Loot`

Use it when you want repeatable, structured logging without manually reformatting note content.

Recommended pattern:

- import Nmap or similar output into `Ports`
- import web discovery into `Paths`
- log credentials, hashes, and tokens in `Loot`

### Evidence

Evidence is for proof that matters later.
Instead of copying commands into a separate table by hand, mark the relevant block directly from the note editor and convert it into Evidence.

Recommended pattern:

- flag only material that supports a finding, access path, or result
- keep the title short and the details meaningful
- use Jump to Source when reviewing or exporting

## Recommended Habits

- Keep Engagement Notes as the source of truth.
- Keep one Network Enumeration note per target when using Quick Log sync.
- Keep the required `Credentials` and `Network Enumeration` templates if you rely on automatic sync behavior.
- Prefer internal KB links over rewriting the same reminders across templates.
- Use tags for lightweight grouping, not as a replacement for note structure.
- Generate summaries near meaningful milestones, not only at the very end.

## Minimal Example

1. Create a session for the engagement.
2. Set the target IP and domain.
3. Create an `AD Workflow` or `Network Enumeration` note.
4. Run Nmap, import the result into Quick Log `Ports`, and let PRAGMA update the corresponding note.
5. Add discovered credentials or hashes to `Loot`.
6. Flag important proof from the editor as Evidence.
7. Open Services or Tactics when you need guidance, then continue writing in the note.
8. Generate a session summary when the work needs to be reviewed or exported.

## What PRAGMA Is Not

PRAGMA is not trying to be:

- a scanner platform
- a ticketing system
- a generic note app
- a full reporting suite

It is an operational workspace for live engagement notes, structured capture, and KB-assisted execution.
