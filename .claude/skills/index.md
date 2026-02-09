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

## Deprecated Skills

These skills have been merged and redirect to their replacement:

| Skill | Merged Into | Reason |
|-------|-------------|--------|
| ~~offline~~ | **data-layer** | Combined with storage to eliminate IndexedDB overlap |
| ~~storage~~ | **data-layer** | Combined with offline to eliminate IndexedDB overlap |

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
- **triage → /plan or /debug or migration**: Triage report includes severity, type, affected packages, and recommended skill chain. Entry point depends on classification.
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
│
├─► Research/investigate? ────► oracle agent
├─► Complex implementation? ──► cracked-coder agent
├─► Classify/triage issue? ───► triage agent
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

## Skill Chaining Patterns

**New Feature:**
```
/plan → testing (write tests first) → react → tanstack-query
```

**UI Implementation:**
```
/plan (from design specs) → frontend-design → tailwindcss → storybook → react → ui-compliance → i18n
```

**Web3 Feature:**
```
/plan → web3 (wallet/passkey patterns) → contracts (if new) → testing → data-layer (if writes)
```

**Bug Fix:**
```
/debug → error-handling-patterns (if error handling) → testing (regression test)
```

**Contract Change:**
```
contracts → migration (if breaking) → indexer (if events changed) → shared (if types changed) → deployment
```

**Offline Feature:**
```
/plan → data-layer (job queue + schema) → xstate (workflow) → web3 (tx patterns) → testing (mock IndexedDB)
```

**Full Stack Feature:**
```
/plan → contracts → indexer → testing → react → web3 → tanstack-query → data-layer
```

**Security Audit:**
```
security (static analysis + access control) → contracts (fixes) → testing (regression tests) → deployment
```

**Protocol Upgrade:**
```
migration agent (blast radius) → contracts → security (verify) → indexer → deployment → monitoring (verify)
```

**Release:**
```
deployment (contracts → indexer → apps) → monitoring (health check) → /review
```

**Code Quality:**
```
/audit → architecture → performance → /review
```

**Bot Feature:**
```
/plan → agent (handler + adapter) → testing → deployment (Railway)
```

**Component Library:**
```
react (component design) → tailwindcss (theming) → storybook (stories) → ui-compliance (a11y) → frontend-design (polish)
```

**Hotfix:**
```
triage (classify P0/P1) → /debug (root cause) → git-workflow (hotfix branch) → testing (regression) → deployment
```

**Dependency Upgrade:**
```
dependency-management (update + audit) → migration (if breaking) → ci-cd (verify pipeline) → testing (full suite)
```

**Incident Response:**
```
triage (P0 classification) → monitoring (diagnose) → /debug (root cause) → cracked-coder (fix) → deployment (rollback or hotfix)
```

**Docker/Indexer Issue:**
```
docker (container diagnostics) → indexer (event handler check) → monitoring (sync lag) → deployment (if redeploy needed)
```

**Theme/Styling Change:**
```
tailwindcss (token design) → frontend-design (visual direction) → radix-ui (component styling) → storybook (document) → ui-compliance (verify)
```

---

## Quick Reference: Green Goods Conventions

| Convention | Enforced By |
|------------|-------------|
| Hooks in `@green-goods/shared` only | Claude hook (blocks) |
| Single root `.env` only | Claude hook (blocks) |
| TDD for all features | Claude hook (warns) + cracked-coder |
| No hardcoded addresses | Claude hook (warns) |
| i18n for UI strings | Claude hook (reminds) |
| Pre-commit validation | Claude hook (reminds) |
| Deploy via deploy.ts only | deployment skill + Claude hook |
| Writes go through job queue | data-layer skill |
| Use `Address` type, not `string` | web3 skill + architectural rule #5 |
| All components have Storybook stories | storybook skill |
| Use logger service, not console.log | monitoring skill + architectural rule #12 |
| State machines for multi-step flows | xstate skill |
| IndexedDB schema versioning | data-layer skill |
| Track business events in PostHog | monitoring skill (Part 8) |
| New shared components have Storybook stories | Claude hook (warns) + storybook skill |
| Mutations consider PostHog tracking | Claude hook (reminds) |
| Schema changes sync with EventHandlers | Claude hook (reminds) |
| Conventional commits with scope | git-workflow skill |
| CI uses `--frozen-lockfile` | ci-cd skill |
| Lockfile conflicts always regenerated | dependency-management skill |
| Semantic color tokens, not raw colors | tailwindcss skill |
| Docker for indexer on macOS | docker skill |

---

## Skill Maturity

| Status | Count | Meaning |
|--------|-------|---------|
| **proven** | 30 | Battle-tested in production, comprehensive coverage |
| **established** | 3 | Functional, may need expansion for edge cases |
| **deprecated** | 2 | Merged into another skill, redirect only |

**Established skills** (candidates for promotion): `i18n`, `performance`, `ci-cd`

---

## Skill Metadata Standard

All skills follow this frontmatter template:

```yaml
---
name: skill-name
description: Brief description for Claude's skill registry
version: "1.0"
last_updated: "YYYY-MM-DD"     # When content was last changed
last_verified: "YYYY-MM-DD"    # When content was last checked against codebase
status: proven | established | deprecated
packages: [shared, client, admin, contracts, indexer, agent]
dependencies: [other-skill-names]
---
```

**Minimum sections** for every skill:
1. **Activation** — When and how to use the skill
2. **Parts** — Numbered content sections with patterns and examples
3. **Anti-Patterns** — What NOT to do (every skill must have this)
4. **Related Skills** — Cross-references to related skills (bidirectional)

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
| error-handling | | | x | x | x | |
| frontend-design | | | x | x | x | |
| tailwindcss | | | x | x | x | |
| radix-ui | | | x | x | x | |
| ui-compliance | | | x | x | x | |
| storybook | | | x | | | |
