# Skills Quick Reference

> **For humans**: Find your task, use the skill. **For Claude**: Match keywords to invoke.

---

## Command Skills (User-Invocable)

| Skill | Invoke With | Modes | Use For |
|-------|-------------|-------|---------|
| **plan** | `/plan` | `--mode check`, `--mode execute`, `--mode cleanup`, `--mode teams` | Create structured implementation plans with specs, coordinate agent teams |
| **debug** | `/debug` | `--mode incident_hotfix`, `--mode tdd_bugfix` | Root cause investigation and systematic debugging |
| **review** | `/review` | `--mode report_only`, `--mode apply_fixes`, `--mode iterate`, `--mode verify_only` | 6-pass systematic code review with structured findings |
| **audit** | `/audit` | `--mode loop`, `--mode team` | Dead code detection, architectural anti-patterns, and codebase health |
| **principles** | `/principles` | `--mode team`, `--mode execute` | Software engineering principles audit — SOLID, DRY, KISS, YAGNI, SOC, EDA, ADR, C4 |
| **architecture** | `/architecture` | `--mode boundaries`, `--mode dependencies`, `--mode complexity`, `--mode gaps`, `--mode scorecard` | Analyze software architecture — map structure, identify gaps, provide actionable suggestions |
| **status** | `/status` | `--mode quick`, `--mode full`, `--mode focus` | Morning briefing — architecture, pipeline, health, journeys, onchain, git pulse, daily focus |

---

## Domain Skills (Auto-Loaded by Context)

| Skill | Keywords | Sub-files |
|-------|----------|-----------|
| **react** | React component, state management, hooks, TanStack Query, XState | tanstack-query, error-handling, xstate, performance, compiler |
| **ui** | TailwindCSS, Radix, dialog, accessibility, Storybook | tailwindcss, radix-ui, compliance, storybook, storybook-addons, storybook-testing, i18n, mermaid |
| **design** | design direction, spatial UI, adaptive surface, glass, material | spatial, interaction, materials, implementation, ecosystem, references |
| **web3** | wallet, transaction, Wagmi, passkey, contract call | — |
| **contracts** | Solidity, smart contract, Foundry, security audit, vulnerability | security |
| **indexer** | indexer, event handler, schema.graphql, Docker, container | docker |
| **data-layer** | offline, PWA, job queue, sync, IndexedDB | service-worker, storage-lifecycle |
| **ops** | deploy, CI, GitHub Actions, git, branch | deployment, ci-cd, git-workflow, dependency-management, biome, vite, migration |
| **testing** | write tests, TDD, unit test, e2e test, Vitest | vitest-patterns |
| **bot** | bot, Telegram, handler, platform adapter | — |

---

## User-Level Skills (Available Across All Projects)

| Skill | Use For |
|-------|---------|
| **meeting-notes** | Extract GitHub issues from meeting transcripts |
| **drive** | Find, sort, and read meeting notes from Google Drive |
| **dream-on** | Overnight autonomous cross-project exploration |

---

## Agents (Multi-Step Automation)

| Agent | Use For |
|-------|---------|
| **oracle** | Deep research requiring 3+ sources |
| **cracked-coder** | Complex implementation with TDD |
| **code-reviewer** | Systematic 6-pass PR review |
| **triage** | Issue classification and routing |

---

## Decision Tree

```
What do you need?
│
├─► Create structured implementation plans with specs, coordinate agent teams? ──► /plan
├─► Root cause investigation and systematic debugging? ──► /debug
├─► 6-pass systematic code review with structured findings? ──► /review
├─► Dead code detection, architectural anti-patterns, and codebase health? ──► /audit
├─► Software engineering principles audit — SOLID, DRY, KISS, YAGNI, SOC, EDA, ADR, C4? ──► /principles
├─► Analyze software architecture — map structure, identify gaps, provide actionable suggestions? ──► /architecture
├─► Morning briefing — architecture, pipeline, health, journeys, onchain, git pulse, daily focus? ──► /status
│
├─► React component? ──► react
├─► TailwindCSS? ──► ui
├─► design direction? ──► design
├─► wallet? ──► web3
├─► Solidity? ──► contracts
├─► indexer? ──► indexer
├─► offline? ──► data-layer
├─► deploy? ──► ops
├─► write tests? ──► testing
├─► bot? ──► bot
│
└─► Simple change? ──► Direct Claude (no skill needed)
```

---

## Aliases

Old names route to their new homes automatically:

| Alias | Routes To |
|-------|-----------|
| `agent` | bot |
| `security` | contracts |
| `offline` | data-layer |
| `storage` | data-layer |
| `monitoring` | debug |
| `tdd-bugfix` | debug |
| `docker` | indexer |
| `biome` | ops |
| `format` | ops |
| `migration` | ops |
| `vite` | ops |
| `agent-teams` | plan |
| `teams` | plan |
| `error-handling` | react |
| `performance` | react |
| `tanstack-query` | react |
| `xstate` | react |
| `autonomous-review` | review |
| `cross-package-verify` | review |
| `a11y` | ui |
| `i18n` | ui |
| `mermaid` | ui |
| `radix-ui` | ui |
| `storybook` | ui |
| `tailwindcss` | ui |

### Command Mode Shortcuts

| Shortcut | Routes To |
|----------|-----------|
| `/teams` | `/plan --mode teams` |
| `autonomous review` | `/review --mode apply_fixes` |
| `cross-package-verify-mode` | `/review --mode verify_only --scope cross-package` |
| `tdd bugfix` | `/debug --mode tdd_bugfix` |

---

## Package Context Files

When working deeply in a specific package, load `.claude/context/{package}.md` for detailed patterns.
