# Roadmap

## Explicit Non-Goals

Not every useful feature belongs in PRAGMA.

The project is intentionally centered on operational notes, local workflow support, and structured capture during an engagement. That means some ideas should stay out, even if they sound attractive or "complete" on paper.

### PDF Generation And Formal Report Builders

PRAGMA supports a basic PDF export of the generated session summary. It should still not turn into a full PDF reporting system, and advanced/custom report builders are explicitly out of scope.

That path almost always drags in a second product hidden inside the first one:

- HTML report templating
- print-specific CSS and pagination handling
- layout customization for different report styles
- client-facing formatting demands
- long-term maintenance of reporting themes and rendering logic

That is not the job of this application.

PRAGMA is centered on notes, sessions, and engagement workflow. It is the workspace used during the work, not the polished deliverable layer after it. If content from PRAGMA later contributes to a report, that should happen through export, transformation, or another dedicated reporting workflow, not by turning PRAGMA itself into a report designer.

### Guiding Principle

Features that pull the project toward presentation, deliverable formatting, or report-theme customization should be treated as out of scope unless they clearly support the core identity of the app:

- local-first
- operational
- note-centric
- workflow-focused

The question is not only whether a feature is possible. The question is whether it belongs.

### Cloud Sync And Hosted SaaS

PRAGMA should not move toward a cloud-synced or hosted SaaS model.

The value of the project is tightly connected to being local-first, operator-controlled, and predictable. Adding hosted state, remote sync, accounts, or internet-dependent workspace behavior would cut against that trust model and introduce a different class of operational and security problems.

### Multi-User Collaboration

PRAGMA should not become a collaborative team platform.

Shared editing, concurrent operators, permissions, presence indicators, role management, and real-time collaboration all belong to a different category of product. They introduce complexity that is not aligned with the single-operator workflow the workbench is designed around.

### Generic Project Management Features

PRAGMA should not drift into being a general project-management system.

Small session-bound workflow helpers such as TODOs make sense because they directly support an active engagement. Broader features such as kanban boards, assignees, team notifications, or generic task-management layers would pull the project away from its actual center of gravity.

### Module Boundary

PRAGMA may integrate optional supporting modules, but that does not mean it should become an operator console.

Modules such as [PRAGMA // Toolbox](https://github.com/VJakoby/matrix-toolbox) can make sense when they assist with bounded workflows like passive recon, active enumeration, validation, or result collection. Those capabilities support the workbench without replacing its purpose.

The boundary should stay clear:

- modules may help gather, verify, structure, or summarize engagement data
- modules should not turn PRAGMA into an exploitation platform or attack orchestration layer

The center of gravity must remain the same:

- notes
- sessions
- targets
- local knowledge
- operational workflow during an engagement

Optional modules are acceptable when they reinforce that workflow. They are out of scope when they try to become the workflow themselves.
