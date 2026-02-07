# Green Goods Skills Quick Reference

> **For humans**: Scan the table, find your task, use the skill
> **For Claude**: Match task keywords to invoke the appropriate skill

---

## Command Skills (Workflow Orchestration)

Use these to start structured workflows:

| Skill | Invoke With | Use For |
|-------|-------------|---------|
| **plan** | `/plan`, "plan this feature", "create implementation plan" | Creating structured implementation plans with specs |
| **debug** | `/debug`, "debug this", "investigate this bug" | Root cause investigation, systematic debugging |
| **review** | `/review`, "review this PR", "code review" | 6-pass systematic code review, post to GitHub |
| **audit** | `/audit`, "audit the codebase", "health check" | Dead code detection, architectural anti-patterns |

---

## Development Skills (Implementation)

Use these when writing code:

| Skill | Invoke With | Use For |
|-------|-------------|---------|
| **testing** | "write tests", "TDD", "unit test", "e2e test" | Vitest unit tests, Playwright E2E, TDD workflow (RED→GREEN→REFACTOR) |
| **react** | "React component", "state management", "hooks", "performance" | State patterns (Zustand, Query), composition, re-render optimization |
| **tanstack-query** | "data fetching", "query", "mutation", "cache" | Server state, queryKeys, mutations, optimistic updates |
| **error-handling-patterns** | "error handling", "try/catch", "error boundary" | Error boundaries, Result types, retry patterns, toast service |
| **vite** | "build config", "bundle", "env vars", "plugins" | Vite 6.x configuration, environment variables, optimization |

---

## Design Skills (UI/UX)

Use these for frontend work:

| Skill | Invoke With | Use For |
|-------|-------------|---------|
| **frontend-design** | "design UI", "build page", "frontend", "visual design" | Distinctive, production-grade interfaces with bold aesthetic choices |
| **ui-compliance** | "accessibility", "a11y", "responsive", "forms", "WCAG" | Accessibility (WCAG 2.1 AA), forms, responsive design, animation |
| **mermaid-diagrams** | "diagram", "flowchart", "mermaid", "architecture diagram" | Mermaid diagrams for documentation and code reviews |

---

## Architecture Skills (System Design)

Use these for structural decisions:

| Skill | Invoke With | Use For |
|-------|-------------|---------|
| **architecture** | "architecture", "refactor", "clean code", "reduce complexity" | Clean Architecture, DDD patterns, entropy reduction, deletion |

---

## Agents (For Complex Tasks)

Use agents for multi-step tasks that need sustained context:

| Agent | Invoke With | Use For |
|-------|-------------|---------|
| **oracle** | "use oracle", "ask oracle about X" | Deep research requiring 3+ sources, investigation before implementation |
| **cracked-coder** | "use cracked-coder" | Complex implementation with TDD (GATHER→PLAN→TEST→IMPLEMENT→VERIFY) |
| **code-reviewer** | "use code-reviewer" | Systematic 6-pass PR review with GitHub posting |

---

## Decision Tree

```
What do you need?
│
├─► Plan a feature? ──────────► /plan
├─► Debug something? ─────────► /debug
├─► Review code? ─────────────► /review (or code-reviewer agent)
├─► Health check? ────────────► /audit
│
├─► Research/investigate? ────► oracle agent
├─► Complex implementation? ──► cracked-coder agent
│
├─► Write tests? ─────────────► testing skill
├─► React work? ──────────────► react skill
├─► Data fetching? ───────────► tanstack-query skill
├─► Error handling? ──────────► error-handling-patterns skill
├─► Build/config? ────────────► vite skill
│
├─► Build UI/frontend? ────────► frontend-design skill
├─► Accessibility/UI? ────────► ui-compliance skill
├─► Create diagram? ──────────► mermaid-diagrams skill
├─► Architecture decision? ───► architecture skill
│
└─► Simple change? ───────────► Direct Claude (no skill needed)
```

---

## Skill Chaining Patterns

**New Feature:**
```
/plan → testing (write tests first) → react → tanstack-query
```

**UI Implementation:**
```
/plan (from design specs) → frontend-design → react → ui-compliance
```

**Bug Fix:**
```
/debug → error-handling-patterns (if error handling) → testing (regression test)
```

**Code Quality:**
```
/audit → architecture → /review
```

---

## Quick Reference: Green Goods Conventions

| Convention | Enforced By |
|------------|-------------|
| Hooks in `@green-goods/shared` only | Hook (blocks) |
| Single root `.env` only | Hook (blocks) |
| TDD for all features | Hook (warns) + cracked-coder |
| No hardcoded addresses | Hook (warns) |
| i18n for UI strings | Hook (reminds) |
| Pre-commit validation | Hook (reminds) |
