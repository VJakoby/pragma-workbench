# PRAGMA Architecture

## 1. Core System Model

This is a SSR monolith with 4 main subsystems:

### Backend (server/)
- Express routes
- API logic
- session handling
- search indexing backend

### Frontend App (public/)
- Vanilla JS application layer
- UI state management
- injection logic
- client-side search

### Views (views/)
- EJS templates
- static UI rendering layer
- no business logic allowed

### Knowledge Base (knowledge_base/)
- Markdown-based documentation system
- indexed by backend search engine
- must remain content-only (no logic)

---

## 2. Critical System Rules

### Injection System
- Must NEVER modify code blocks
- Must NEVER inject inside string literals
- Must only operate on template-safe tokens

### Search System
- Must index BOTH:
  - KB files
  - session notes
- Must never mutate content during indexing

### Rendering System
- Preview ≠ Editor pipeline differences must be minimized
- Full preview must behave identically to split preview

---

## 3. Data Flow Rules

- All KB content flows:
  filesystem → indexer → search API → UI
- All injection flows:
  template variables → sanitizer → renderer → UI
- Never bypass sanitization layer

---

## 4. Anti-Patterns (DO NOT DO)

- Do not inject values inside markdown code blocks
- Do not modify raw KB files during rendering
- Do not mix search indexing with UI rendering logic
- Do not duplicate injection pipelines

---

## 5. Boundary Rule

If a change affects more than one subsystem:
- stop
- reduce scope
- prefer minimal patch over architectural change
