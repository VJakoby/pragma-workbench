# PRAGMA — Feature Spec 001
*Export improvements & related content surfacing*

---

## 1. Consolidated Session Export Document

### Problem
The current export produces a folder tree that is technically correct but hard to navigate as a deliverable or reference. Notes are spread across individual `.md` files in target subdirectories. There is no single document that reads coherently from top to bottom.

### Solution
When exporting a session, generate a single consolidated `{session-slug}.md` file at the root of the export folder alongside the existing individual files. This document is the human-readable summary of the entire engagement — readable top to bottom like a pentest report skeleton.

### Behaviour
- Triggered by the **existing export button** (`.md` export in the Sessions modal). No new button.
- Every export regenerates the consolidated document, keeping it in sync.
- Individual files in subdirectories are preserved as-is. The consolidated document is additive.
- Content format is **raw Markdown** throughout.

### File layout after export

```
sessions/
└── {session-slug}/
    ├── {session-slug}.md          ← consolidated single document
    ├── README.md                  ← existing index/TOC
    ├── SUMMARY.md                 ← existing chronological timeline
    ├── {target-ip}/
    │   ├── README.md
    │   └── ...individual notes
    └── session/
        └── ...unassigned notes
```

### Document structure

```
# {Session Name}

Exported: {date}
Duration: {first note to last note}
Targets: {count}

---

## Targets

One section per target.
Each section contains: IP, domain, label, open ports table, web paths table.
Empty tables are omitted.

---

## Notes

Grouped by type. Within each type, sorted by timestamp ascending.
Each note shows: title, timestamp, target (if assigned), then the note body verbatim.

Type order: Recon → Exploit → PrivEsc → Loot → Credentials → General → Blank

Empty type sections are omitted entirely.

---

## Loot Summary

Consolidated table of all loot logged via Quick Log across the session.
Columns: Type, Credential, Host, Context.

Omitted if no loot exists.

---

## Timeline

Chronological list of all notes and status changes, oldest first.
One line per event: timestamp, type, title, target if assigned.

---

## Appendix — Unassigned Notes

Notes not assigned to any target.
Same format as the Notes section above.

Omitted if all notes are assigned or there are no targets in the session.
```

### Rules
- Notes unified across targets in the Notes section (not split per target)
- A note with no target assigned goes to the Appendix
- If the session has no targets at all, all notes go in the Notes section and there is no Appendix
- Empty sections are always omitted — no empty headers

---

## 2. Related Content Surfacing

### Problem
When reading a KB card (service or tactic), there is no connection to session notes or other KB content that is topically related. The KB and notes exist in separate silos.

### Solution
When a KB card is open in the content panel, surface a collapsible "Related" section at the bottom showing notes from your sessions that mention the same topic, and other KB cards that are topically similar.

### Behaviour
- Appears at the bottom of the content panel read view
- Only shown when there is at least one related item
- Clicking a related note opens that note in the Notes view
- Clicking a related KB card opens it in the content panel
- Collapsed by default, expandable with one click
- Not shown in edit mode
- Matching is purely local — no external calls, no server involvement

### Matching logic (v1, no AI)
- A note is considered related if its title or body contains the card's name, port number, or significant words from the card description
- A KB card is considered related if it shares the same category, or has meaningful word overlap in its title or description
- Results capped at 5 per group (notes, KB cards) to avoid noise
- Common short words ignored in matching

### UI
```
─────────────────────────────────
▸ Related

  Notes (2)
    Recon — SMB enumeration
    Credentials — NTLMv2 hash

  KB (3)
    Kerberoasting
    LDAP Enumeration
    Pass the Hash
```

---

## Future Ideas

Not scheduled. Recorded here for context and continuity.

### Local AI integration
Both features above are designed to layer AI on top later without rework:

- **Related content surfacing** — v1 uses text matching. A future version replaces or augments the matching with a local embedding model (e.g. via Ollama). The UI and data structures stay the same, only the matching logic changes.
- **Consolidated export** — once AI is available, a summarisation pass could auto-generate a short executive summary section at the top of the consolidated document.

Other AI ideas to revisit:
- Auto-tagging notes on save based on content
- Suggesting note type when creating a new note
- Surfacing gaps in the timeline ("4 hour break during an active session")
- Post-engagement review chat over session notes

### Export to other formats
The consolidated `.md` document could later be piped through an external converter (Pandoc is the natural choice) to produce DOCX or PDF. This keeps PRAGMA's export clean while giving a path to a polished deliverable. This would be an external step, not built into PRAGMA itself.

### Multi-target consolidated document
Currently the Notes section is unified across all targets. A future option could split the Notes section by target — one section per target with typed subsections beneath. Useful for engagements with many targets.

---

*Last updated: 2026-03-23*
*Status: Spec — not yet implemented*
