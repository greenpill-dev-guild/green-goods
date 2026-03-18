# Skills Quick Reference

> **For humans**: Find your task, use the skill. **For Claude**: Match keywords to invoke.

---

## Command Skills (User-Invocable)

| Skill | Invoke With | Use For |
|-------|-------------|---------|
| **audit** | `/audit`, `/audit --loop`, `/audit --team` | Codebase health check, dead code, anti-patterns, iterative fix loop |
| **review** | `/review`, `/review --iterate`, `/review --mode apply_fixes` | 6-pass code review, iterative fix-and-verify, cross-package verification |
| **debug** | `/debug`, `/debug --mode tdd_bugfix` | Root cause investigation, production monitoring, test-first bugfix |
| **meeting-notes** | `/meeting-notes` | Extract GitHub issues from meeting transcripts |

---

## Domain Skills (Auto-Loaded by Context)

| Skill | Keywords | Covers |
|-------|----------|--------|
| **ui** | design, TailwindCSS, Radix, dialog, accessibility, Storybook, i18n, diagram | Design system, theming, primitives, compliance, stories, translation, Mermaid |
| **react** | component, hooks, state, Zustand, TanStack Query, mutation, error boundary, XState, performance | State management, data fetching, error handling, state machines, profiling |
| **web3** | wallet, transaction, Wagmi, passkey, contract call | Wallet/passkey auth, contract reads/writes, chain ops, tx lifecycle |
| **contracts** | Solidity, Foundry, deploy, UUPS, security audit | Contract dev, testing, gas optimization, upgrades, security checklist |
| **indexer** | indexer, event handler, schema.graphql, Docker | Envio handlers, entity design, Docker Compose stack, GraphQL |
| **data-layer** | offline, PWA, job queue, IndexedDB, sync, storage | Job queue, service workers, schema design, background sync, drafts |
| **ops** | deploy, CI, GitHub Actions, git, branch, commit, dependency, format, Biome | Deployment pipeline, CI/CD, git workflow, deps, formatting |
| **agent** | bot, Telegram, handler, platform adapter | Bot handlers, platform adapters, crypto services |
| **testing** | test, TDD, Vitest, Playwright, E2E, coverage | Unit tests, E2E tests, mock strategies, TDD workflow |

### Also Available (Standalone)

| Skill | Use For |
|-------|---------|
| **architecture** | Clean Architecture, DDD, entropy reduction, module boundaries |
| **migration** | Cross-package breaking changes, UUPS upgrades, re-indexing |
| **plan** | Structured implementation plans, task decomposition |
| **agent-teams** | Coordinate multiple Claude Code sessions |

---

## Agents (Multi-Step Automation)

| Agent | Use For |
|-------|---------|
| **oracle** | Deep research requiring 3+ sources |
| **cracked-coder** | Complex implementation with TDD |
| **code-reviewer** | Systematic 6-pass PR review |
| **migration** | Cross-package migration orchestration |
| **triage** | Issue classification and routing |

---

## Decision Tree

```
What do you need?
│
├─► Health check / audit? ──────► /audit (or /audit --loop for fix cycle)
├─► Review code? ───────────────► /review (or /review --iterate)
├─► Debug something? ───────────► /debug
├─► Extract meeting actions? ───► /meeting-notes
│
├─► Working on UI? ─────────────► ui skill (sub-files: tailwind, radix, compliance, storybook, i18n)
├─► React / state / queries? ──► react skill (sub-files: tanstack-query, error-handling, xstate, performance)
├─► Wallet / transactions? ────► web3 skill
├─► Smart contracts? ──────────► contracts skill (sub-file: security)
├─► Indexer / Docker? ──────────► indexer skill (sub-file: docker)
├─► Offline / storage? ────────► data-layer skill
├─► Deploy / CI / git / deps? ─► ops skill (sub-files: deployment, ci-cd, git, deps, biome)
├─► Bot development? ──────────► agent skill
├─► Write tests? ──────────────► testing skill
│
├─► Architecture decision? ────► architecture skill
├─► Breaking change? ──────────► migration skill (or migration agent)
├─► Plan a feature? ───────────► /plan
│
└─► Simple change? ────────────► Direct Claude (no skill needed)
```

---

## Package Context Files

When working deeply in a specific package, load `.claude/context/{package}.md` for detailed patterns.
