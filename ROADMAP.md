# Roadmap

## Future Direction: Local AI Integration

One plausible future direction for PRAGMA is optional integration with a local AI runtime such as Ollama, or another self-hosted model provider running on the operator's machine or local network.

Local AI should be the preferred choice.

PRAGMA is intended for close, local pentest workflow support. That makes it a poor fit for shipping operational context, notes, targets, or knowledge material to cloud-hosted AI services by default.

The important constraint is that this should strengthen the local-first model of the application, not weaken it.

If this is pursued, the design should follow a few hard rules:

- AI features must be optional
- local model providers should be the default and preferred choice
- cloud-hosted AI integrations should be treated as secondary, explicit, and avoidable
- notes, targets, sessions, and knowledge data should stay under operator control
- the core workflow should remain usable with AI fully disabled
- model access should be explicit, bounded, and easy to inspect

The role of a local model in PRAGMA should be assistive rather than authoritative, with the primary focus on the local knowledge base.

A strong future use-case would be a workflow where the operator asks a question in natural language, the local AI consults both the configured model and the operator's local knowledge base, and then suggests what to do next based on the available context and findings.

Good uses would include:

- querying the local knowledge base in natural language
- combining retrieved KB context with model reasoning to suggest likely next steps
- surfacing relevant prior notes, patterns, checklists, or techniques from local material
- helping the operator decide what to verify next based on what is already documented

The wrong direction would be turning PRAGMA into an "AI agent" that acts independently, creates or rewrites notes on its own, modifies important engagement data without review, or hides core logic behind opaque prompting.

### Suggested Integration Shape

If implemented, local AI support should likely be introduced as a thin provider layer with support for:

- Ollama
- OpenAI-compatible local servers
- other self-hosted runtimes with a stable HTTP API

That integration should be narrow and predictable:

- configurable model endpoint per workspace or installation
- explicit feature toggles for each AI-assisted workflow
- prompt and context boundaries defined in code
- retrieval grounded in the local knowledge base rather than free-form generation alone
- clear visibility into which KB entries informed a suggestion
- graceful fallback when no model is configured or available

### Where It Fits

Local AI makes sense when it helps the operator interpret and use information already stored in the knowledge base.

It does not make sense as a replacement for:

- note-taking
- evidence review
- target management
- operator judgment

The best version of this feature would reduce friction in searching local engagement material, connecting relevant internal knowledge, and suggesting sensible follow-up actions while preserving PRAGMA's core identity:

- local-first
- operator-controlled
- transparent
- workflow-focused

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
