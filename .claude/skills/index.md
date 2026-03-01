# Green Goods Skills Quick Reference

> **For humans**: Scan the table, find your task, use the skill
> **For Claude**: Match task keywords to invoke the appropriate skill

---

## Command Skills (Workflow Orchestration)

Use these canonical commands to start structured workflows:

| Skill | Invoke With | Use For |
|-------|-------------|---------|
| **plan** | `/plan`, "plan this feature", "create implementation plan" | Creating structured implementation plans with specs |
| **debug** | `/debug`, "debug this", "investigate this bug" | Root cause investigation, systematic debugging |
| **review** | `/review`, "review this PR", "code review" | 6-pass systematic code review (report-first by default) |
| **audit** | `/audit`, "audit the codebase", "health check" | Dead code detection, architectural anti-patterns |
| **teams** | `/teams`, "create agent team", "agent team" | Coordinate multiple Claude Code sessions as a team |

### Command Mode Wrappers (Aliases)

| Wrapper Skill | Canonical Route | Use For |
|---------------|-----------------|---------|
| **cross-package-verify** | `/review --mode verify_only --scope cross-package` | Multi-package verification wrapper |
| **autonomous-review** | `/review --mode apply_fixes` | Explicit review-and-fix wrapper |
| **tdd-bugfix** | `/debug --mode tdd_bugfix` | Test-first bugfix wrapper |

---

## Development Skills (Implementation)

Use these when writing code:

| Skill | Invoke With | Use For |
|-------|-------------|---------|
| **testing** | "write tests", "TDD", "unit test", "e2e test" | Vitest unit tests, Playwright E2E, TDD workflow (RED→GREEN→REFACTOR) |
| **react** | "React component", "state management", "hooks", "performance" | State patterns (Zustand, Query), React 19 APIs, composition, re-render optimization |
| **web3** | "wallet", "transaction", "Wagmi", "passkey", "contract call" | Wagmi/Viem, wallet + passkey auth, contract reads/writes, chain ops, tx lifecycle |
| **tanstack-query** | "data fetching", "query", "mutation", "cache" | Server state, queryKeys, mutations, optimistic updates |
| **error-handling-patterns** | "error handling", "try/catch", "error boundary" | Error boundaries, Result types, retry patterns, toast service |
| **data-layer** | "offline", "PWA", "job queue", "sync", "IndexedDB", "storage quota", "schema versioning" | Job queue, service workers, IndexedDB schema, background sync, draft persistence, quota management |
| **i18n** | "translation", "i18n", "locale", "internationalization" | Browser Translation API, runtime translation, RTL support, Intl formatting |
| **xstate** | "state machine", "workflow", "XState", "actor" | Multi-step flows, state machine design, actor model, React integration |
| **vite** | "build config", "bundle", "env vars", "plugins" | Vite 7.x configuration, environment variables, optimization |
| **contracts** | "Solidity", "smart contract", "deploy", "Foundry", "security audit" | Foundry dev, UUPS upgrades, gas optimization, security checklist, deploy.ts |
| **indexer** | "indexer", "event handler", "schema.graphql", "GraphQL" | Envio handlers, entity design, Docker dev workflow |
| **agent** | "bot", "Telegram", "handler", "platform adapter" | Bot handlers, platform adapters, crypto services, rate limiting |
| **deployment** | "deploy", "release", "Railway", "Vercel", "mainnet" | Full pipeline: contracts → indexer → apps, environment promotion, rollback |
| **security** | "security audit", "vulnerability", "access control", "Slither" | Smart contract security, static analysis, Hats Protocol access control, threat modeling |
| **migration** | "migration", "upgrade", "breaking change", "protocol upgrade" | Cross-package migrations, UUPS upgrades, re-indexing, IndexedDB schema changes |
| **docker** | "Docker", "container", "compose", "indexer stack" | Docker Compose patterns, container debugging, volume management, health checks |
| **git-workflow** | "branch", "commit", "merge conflict", "release", "changelog" | Branching strategy, conventional commits, conflict resolution, release workflow |
| **ci-cd** | "CI", "GitHub Actions", "pipeline", "workflow", "status checks" | GitHub Actions workflows, caching, PR status gates, local CI simulation |
| **dependency-management** | "dependency", "lockfile", "bun install", "upgrade package" | Workspace protocol, lockfile conflicts, audit/update, phantom dependencies |

---

## Design Skills (UI/UX)

Use these for frontend work:

| Skill | Invoke With | Use For |
|-------|-------------|---------|
| **frontend-design** | "design UI", "build page", "frontend", "visual design" | Distinctive, production-grade interfaces with bold aesthetic choices |
| **tailwindcss** | "TailwindCSS", "@theme", "design tokens", "dark mode", "CSS config" | TailwindCSS v4 configuration, theme system, design tokens, CSS architecture |
| **radix-ui** | "dialog", "select", "accordion", "Radix", "popover" | Radix UI primitives with TailwindCSS v4, accessible interactive components |
| **ui-compliance** | "accessibility", "a11y", "responsive", "forms", "WCAG" | Accessibility (WCAG 2.1 AA), forms, responsive design, animation |
| **storybook** | "story", "Storybook", "component docs", "visual test" | CSF3 stories, visual regression, design system documentation, addon config |
| **mermaid-diagrams** | "diagram", "flowchart", "mermaid", "architecture diagram" | Mermaid diagrams for documentation and code reviews |

---

## Architecture & Operations Skills

Use these for structural decisions and production concerns:

| Skill | Invoke With | Use For |
|-------|-------------|---------|
| **architecture** | "architecture", "refactor", "clean code", "reduce complexity" | Clean Architecture, DDD patterns, entropy reduction, deletion |
| **biome** | "format", "Biome", "import sorting", "formatter" | Biome formatting configuration, import organization, CI integration |
| **performance** | "performance", "bundle size", "profiling", "memory leak" | Bundle analysis, Lighthouse, React Profiler, memory management |
| **monitoring** | "monitoring", "health check", "observability", "logging" | Transaction tracking, SW health, storage quotas, indexer sync lag |

---

## Alias Map

- `offline` -> `data-layer`
- `storage` -> `data-layer`

---

## Agents (For Complex Tasks)

Use agents for multi-step tasks that need sustained context:

| Agent | Invoke With | Use For |
|-------|-------------|---------|
| **oracle** | "use oracle", "ask oracle about X" | Deep research requiring 3+ sources, investigation before implementation |
| **cracked-coder** | "use cracked-coder" | Complex implementation with TDD (GATHER→PLAN→TEST→IMPLEMENT→VERIFY) |
| **code-reviewer** | "use code-reviewer" | Systematic 6-pass PR review with GitHub posting |
| **migration** | "use migration agent" | Cross-package migration orchestration with blast radius tracking |
| **triage** | "triage this", "classify this issue", "what skill for this" | Fast classification, severity/type/package routing to skill chains |

### Agent Handoff Protocol

When agents need to coordinate across a workflow:

```
Triage → Research → Implementation → Review:
1. triage classifies issue → severity, type, packages, skill chain
2. oracle researches (if needed) → summarize key decisions + file references
3. cracked-coder receives summary → implements with TDD
4. code-reviewer receives PR → reviews against original requirements
```

**Context Passing Rules:**
- **triage → canonical command route**: Triage report includes severity, type, affected packages, selected bundle ID, and bundle entrypoint.
- **oracle → cracked-coder**: Pass findings as a concise brief (key decisions, affected files, constraints discovered). Don't pass raw research dumps.
- **cracked-coder → code-reviewer**: PR description should reference the original plan/issue. Reviewer reads the diff + plan, not the implementation conversation.
- **code-reviewer → cracked-coder**: Review feedback becomes new todos. Cracked-coder addresses each comment as a separate task.

**When NOT to Chain Agents:**
- Simple changes (< 50 lines): Use Direct Claude
- Research-only tasks: oracle alone is sufficient
- Review-only tasks: code-reviewer alone is sufficient

---

## Decision Tree

```
What do you need?
│
├─► Plan a feature? ──────────► /plan
├─► Debug something? ─────────► /debug
├─► Review code? ─────────────► /review (or code-reviewer agent)
├─► Health check? ────────────► /audit
├─► Verify whole repo? ───────► /review --mode verify_only --scope cross-package
├─► Coordinate agent team? ──► /teams (build, review, investigate)
│
├─► Research/investigate? ────► oracle agent
├─► Complex implementation? ──► cracked-coder agent
├─► Classify/triage issue? ───► triage agent
├─► Bugfix with TDD loop? ────► /debug --mode tdd_bugfix
├─► Review and auto-fix? ─────► /review --mode apply_fixes
│
├─► Write tests? ─────────────► testing skill
├─► React work? ──────────────► react skill
├─► Wallet/transaction? ──────► web3 skill
├─► Data fetching? ───────────► tanstack-query skill
├─► Error handling? ──────────► error-handling-patterns skill
├─► Offline/sync/storage? ────► data-layer skill
├─► Translation/i18n? ────────► i18n skill
├─► State machine/workflow? ──► xstate skill
├─► Build/config? ────────────► vite skill
│
├─► Working on contracts? ────► contracts skill
├─► Security review? ─────────► security skill
├─► Working on indexer? ──────► indexer skill
├─► Working on bot? ──────────► agent skill
├─► Deploying anything? ──────► deployment skill
├─► Upgrading/migrating? ─────► migration skill (or migration agent)
├─► Docker/container issue? ──► docker skill
│
├─► Build UI/frontend? ───────► frontend-design skill
├─► TailwindCSS/theming? ─────► tailwindcss skill
├─► Dialog/Select/Popover? ───► radix-ui skill
├─► Component stories? ───────► storybook skill
├─► Accessibility/UI? ────────► ui-compliance skill
├─► Create diagram? ──────────► mermaid-diagrams skill
├─► Architecture decision? ───► architecture skill
│
├─► Formatting/imports? ──────► biome skill
├─► Performance issue? ───────► performance skill
├─► Production monitoring? ───► monitoring skill
│
├─► Branch/merge/commit? ─────► git-workflow skill
├─► CI pipeline/actions? ─────► ci-cd skill
├─► Dependency/lockfile? ─────► dependency-management skill
│
├─► Need package context? ────► Load .claude/context/{package}.md
│
└─► Simple change? ───────────► Direct Claude (no skill needed)
```

---

## Package Context Files

When working deeply in a specific package, load the corresponding context file for detailed patterns, anti-patterns, and reference files:

| Package | Context File | Content |
|---------|--------------|---------|
| `packages/shared/**` | `.claude/context/shared.md` | Hook patterns, provider hierarchy, module structure |
| `packages/client/**` | `.claude/context/client.md` | PWA patterns, offline flows, service worker |
| `packages/admin/**` | `.claude/context/admin.md` | Dashboard patterns, operator flows |
| `packages/contracts/**` | `.claude/context/contracts.md` | Foundry patterns, Hats Protocol, deploy.ts |
| `packages/indexer/**` | `.claude/context/indexer.md` | Envio handlers, entity design, Docker |
| `packages/agent/**` | `.claude/context/agent.md` | Bot handlers, platform adapters |

**When to load context**: Load the context file when starting sustained work in a package (>3 files). For quick edits, skills alone provide enough guidance.

---

## Routing Guide

Use these categories to route implementation work:

| Bundle ID | Entry Point | Use When |
|-----------|-------------|----------|
| `frontend-change` | `/plan` | User-facing client/admin/shared UI changes |
| `shared-domain-change` | `/plan` | Shared hooks/providers/store/module behavior |
| `contracts-change` | `/plan` | Solidity/UUPS/deploy/security-impacting changes |
| `indexer-change` | `/plan` | Envio schema/handler or indexer deployment changes |
| `agent-change` | `/plan` | Bot handler/platform adapter changes |
| `cross-package-change` | `/review --mode verify_only --scope cross-package` | Multi-package verification and coordination |
| `incident-hotfix` | `/debug --mode incident_hotfix` | P0/P1 incident response and hotfix routing |

Routing guidance:
1. Triage identifies affected packages and selects entry point skill.
2. Escalate to cross-package verification when blast radius spans multiple package boundaries.

---

## Quick Reference: Green Goods Conventions

| Convention | Enforced By |
|------------|-------------|
| Hooks in `@green-goods/shared` only | Hook (blocks) |
| Single root `.env` only | Hook (blocks) |
| Use `bun run test` not `bun test` | Hook (blocks) |
| No force push to main/master | Hook (blocks) |
| Confirm production deploys | Hook (warns) |
| Deploy via deploy.ts only | deployment skill |
| TDD for all features | cracked-coder agent |
| Use `Address` type, not `string` | `.claude/rules/typescript.md` |
| Use logger, not console.log | `.claude/rules/typescript.md` |
| Barrel imports only | `.claude/rules/typescript.md` |
| Timer/listener cleanup in hooks | `.claude/rules/react-patterns.md` |
| Writes go through job queue | data-layer skill |
| Conventional commits with scope | git-workflow skill |

---

## Skill Metadata Standard

All skills use official Claude Code YAML frontmatter:

```yaml
---
name: skill-name
description: Brief description for Claude's skill discovery
# Optional official fields:
# argument-hint: "[args]"           # Shown in autocomplete after /name
# disable-model-invocation: true    # Only user can invoke (for side-effect skills)
# context: fork                     # Run in isolated subagent context
---
```

**Minimum sections** for every skill:
1. **Activation** — When and how to use the skill
2. **Parts** — Numbered content sections with patterns and examples
3. **Anti-Patterns** — What NOT to do
4. **Related Skills** — Cross-references to related skills

---

## Architectural Taxonomy

Skills organized by architectural tier (foundation → specialization):

### Tier 1 — Foundation
Cross-cutting concerns that affect all packages:

`architecture` · `testing` · `biome` · `git-workflow` · `ci-cd` · `dependency-management` · `performance` · `monitoring`

### Tier 2 — Domain
Package-specific implementation patterns:

`react` · `tanstack-query` · `web3` · `data-layer` · `i18n` · `xstate` · `vite` · `contracts` · `indexer` · `agent` · `security` · `migration` · `error-handling-patterns` · `docker`

### Tier 3 — Design
UI/UX patterns and documentation:

`frontend-design` · `tailwindcss` · `radix-ui` · `ui-compliance` · `storybook` · `mermaid-diagrams`

### Tier 4 — Orchestration
Workflow coordination (command skills + agents):

`plan` · `debug` · `review` · `audit` · `deployment`

---

## Coverage Matrix

Which skills apply to which packages:

| Skill | contracts | indexer | shared | client | admin | agent |
|-------|:---------:|:-------:|:------:|:------:|:-----:|:-----:|
| architecture | x | | x | x | x | |
| testing | x | | x | x | x | |
| biome | | x | x | x | x | x |
| react | | | x | x | x | |
| tanstack-query | | | x | x | x | |
| web3 | | | x | x | x | |
| data-layer | | | x | x | | |
| i18n | | | x | x | x | |
| xstate | | | x | x | | |
| vite | | | | x | x | |
| contracts | x | | | | | |
| indexer | | x | | | | |
| agent | | | | | | x |
| security | x | | | | | |
| migration | x | x | x | x | x | |
| docker | | x | | | | |
| deployment | x | x | | x | x | |
| monitoring | | x | x | x | x | x |
| performance | | | x | x | x | |
| error-handling-patterns | | | x | x | x | |
| frontend-design | | | x | x | x | |
| tailwindcss | | | x | x | x | |
| radix-ui | | | x | x | x | |
| ui-compliance | | | x | x | x | |
| storybook | | | x | | | |

## Documentation Sources

The `docs/` directory contains agent-readable specification pages. When skills need domain context beyond code patterns, reference these docs:

| Topic | Path | Use For |
|-------|------|---------|
| System architecture | `docs/docs/developers/architecture.mdx` | Data flow diagrams, component relationships |
| Domain glossary | `docs/docs/glossary.md` | Term definitions for domain vocabulary |
| Entity matrix | `docs/docs/developers/reference/entity-matrix.mdx` | Cross-protocol entity mapping |
| EAS queries | `docs/docs/evaluator/query-eas.mdx` | Attestation query templates |
| Envio queries | `docs/docs/evaluator/query-indexer.mdx` | GraphQL query templates |
| Error lookup | `docs/docs/gardener/common-errors.mdx` | User-facing error-to-fix mapping |
| Impact model | `docs/docs/concepts/impact-model.mdx` | CIDS framework, action domains |
| Deployment ops | `docs/docs/developers/operations.mdx` | Multi-chain deployment runbook |
| Strategy | `docs/docs/concepts/strategy-and-goals.mdx` | Feature scope, success metrics |
