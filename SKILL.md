# OpenCode AI Skill Guidelines

## 1. Project Context & Scale
- **Scale:** This is a mature codebase containing well over 10,000 lines of code originally drafted utilizing GitHub Codex.
- **Architecture:** The codebase is structured as a single-repository Server-Side Rendered (SSR) Monolith with a clean logical separation of concerns.
- **Folder Mapping & Core Stack:**
  - **Main Entry:** `server.js` at the root initializes the application runtime.
  - **Backend Layer:** Node.js & Express logic live strictly inside the `server/` directory (handling `routes/`, `config/`, and `lib/`).
  - **Frontend Layout Layer:** UI layouts live inside the `views/` directory using EJS templates (e.g., `views/app.ejs`).
  - **Frontend Client Layer:** Static assets, core Vanilla JavaScript application logic, and the UI bundle live inside the `public/` directory (e.g., `public/app/`, `public/app.html`).
  - **Data Registries:** Local target data lives inside `sessions/`, and documentation logs sit inside `knowledge_base/`. 
- **Legacy Preservation:** Prioritize matching the exact coding style, naming conventions (e.g., camelCase vs snake_case), and architectural patterns already established in the existing files. Do not rewrite working legacy code unless explicitly instructed.

## 2. Model Allocation Strategy
You are operating under an OpenCode Go subscription gateway. Optimize your internal processing by aligning tasks to these model profiles:
- **Planning & Architecture:** Use high-reasoning capabilities (`qwen3.7-max` or `glm-5.1`) to parse this guide and analyze file relationships before writing code.
- **Complex Code Editing:** Use strict logical capabilities (`deepseek-v4-pro` or `kimi-k2.6`) when performing multi-file refactors or debugging core logic.
- **Repetitive / Test Automation Tasks:** Use `deepseek-v4-flash` for high-volume operations, simple boilerplate generation, or looping terminal test commands.

## 3. Workflow & Backlog Automation
- **Task Isolation:** Focus on exactly ONE task from `BACKLOG.md` at a time. Do not attempt to fix or refactor multiple items simultaneously.
- **The Planning & Exploration Constraint:** Always begin a new task by investigating the codebase. You must autonomously run internal searches or file scans to locate the precise code responsible for the issue described. Do not guess locations. 
- **The Blueprint:** Before entering **Build Mode**, present a concise, 3-bullet-point architectural blueprint detailing the exact files and line numbers you discovered during your exploration, what is wrong with them, and how you intend to modify them. Wait for user confirmation.
- **Automated Bookkeeping:** Upon successful execution of a code change—and after confirming that the local build/test suite passes—you have full permission to modify files to update the backlog. Open `BACKLOG.md` and explicitly flip the target task's checkbox from incomplete `- [ ]` to complete `- [x]`.

## 4. Operational Guardrails
- **Terminal Execution:** You are encouraged to request permission to run terminal test or build commands (e.g., `npm run test` or `pytest`) to verify your work. If a command fails, you have a maximum of 2 autonomous attempts to patch the bug before you must halt and ask the user for guidance.
- **Dependency Control:** Do not install, upgrade, or add new third-party packages or npm/pip dependencies without explicit, written confirmation from the user. Utilize native or pre-existing project modules first.

## 5. Git Automation & Commit Standards
- **Branch Restriction:** You have permission to execute Git commits, but you must stay strictly within the current active branch. **Never** run `git checkout`, `git switch`, or attempt to create new branches. 
- **Pre-Commit Verification:** Before creating a commit, you must ensure that all relevant project tests pass. Do not commit broken or unverified code.
- **Commit Execution:** Once a task from `BACKLOG.md` is complete and verified, execute a local commit for the modified files.
- **Commit Message Convention:** Follow strict Conventional Commits formatting. Include the backlog task ID in the message body or scope.
  - *Format Example:* `fix(core): resolve JWT token expiry crash`
  - *Message Body Example:* `Closes task FIX-01 from BACKLOG.md`
