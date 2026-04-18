# Skills Quick Reference

> **For humans**: Find your task, use the skill. **For Claude**: Match keywords to invoke.

---

## Command Skills (User-Invocable)

| Skill | Invoke With | Modes | Use For |
|-------|-------------|-------|---------|
| **review** | `/review` | `--mode report_only`, `--mode apply_fixes`, `--mode iterate`, `--mode verify_only` | 6-pass systematic code review with structured findings |
| **audit** | `/audit` | `--mode loop`, `--mode team` | Dead code detection, architectural anti-patterns, and codebase health |
| **principles** | `/principles` | `--mode team`, `--mode execute` | Software engineering principles audit — SOLID, DRY, KISS, YAGNI, SOC, EDA, ADR, C4 |
| **architecture** | `/architecture` | `--mode boundaries`, `--mode dependencies`, `--mode complexity`, `--mode gaps`, `--mode scorecard` | Analyze software architecture — map structure, identify gaps, provide actionable suggestions |
| **status** | `/status` | `--mode quick`, `--mode full`, `--mode focus`, `--mode resume` | Morning briefing — architecture, pipeline, health, journeys, onchain, git pulse, daily focus; `--mode resume` for branch resumption |
| **clean** | `/clean` | `--dry-run`, `--scope pkg`, `--agents 1,3,5` | 8-agent parallel codebase cleanup — dedup, types, dead code, circular deps, type strengthening, defensive code, legacy, AI slop |
| **ship** | `/ship` | `--dry-run`, `--no-commit` | Pre-merge gate: format + lint + test + build + conventional-commit + branch safety; evidence-before-claims |

---

## Domain Skills (Auto-Loaded by Context)

| Skill | Keywords | Sub-files |
|-------|----------|-----------|
| **plan** | plan this, break down feature, phased implementation | teams, brainstorm |
| **debug** | debug this, root cause, investigate bug, unexpected error | monitoring, posthog, health-diagnostics |
| **react** | React component, state management, hooks, TanStack Query, XState | tanstack-query, error-handling, xstate, performance, compiler |
| **ui** | TailwindCSS, Radix, dialog, accessibility, Storybook | tailwindcss, radix-ui, compliance, storybook, storybook-addons, storybook-testing, i18n, mermaid, view-transitions |
| **design** | design direction, spatial UI, adaptive surface, glass, material | ARCHITECTURE, language, prompt-contract, client-prompt-contract, quick-reference, spatial, interaction, materials, generative-ui, ecosystem, regenerative, review-checklist, stack-review |
| **web3** | wallet, transaction, Wagmi, passkey, contract call | — |
| **contracts** | Solidity, smart contract, Foundry, security audit, vulnerability | security |
| **indexer** | indexer, event handler, schema.graphql, Docker, container | docker |
| **data-layer** | offline, PWA, job queue, sync, IndexedDB | service-worker, storage-lifecycle |
| **ops** | deploy, CI, GitHub Actions, git, branch | deployment, ci-cd, git-workflow, dependency-management, biome, vite, migration |
| **testing** | write tests, TDD, unit test, e2e test, Vitest | vitest-patterns |
| **stitch** | build from stitch, stitch prompt, stitch screen, implement screen | — |

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

---

## Decision Tree

```
What do you need?
│
├─► 6-pass systematic code review with structured findings? ──► /review
├─► Dead code detection, architectural anti-patterns, and codebase health? ──► /audit
├─► Software engineering principles audit — SOLID, DRY, KISS, YAGNI, SOC, EDA, ADR, C4? ──► /principles
├─► Analyze software architecture — map structure, identify gaps, provide actionable suggestions? ──► /architecture
├─► Morning briefing — architecture, pipeline, health, journeys, onchain, git pulse, daily focus? ──► /status
├─► Resume a stale branch — what was I doing here? ──► /status --mode resume
├─► Comprehensive codebase cleanup with parallel agents? ──► /clean
├─► Pre-merge gate — am I safe to push/merge? ──► /ship
│
├─► Plan this feature, break it down into steps? ──► plan (passive)
├─► Debug this bug, investigate unexpected error? ──► debug (passive)
├─► React component? ──► react
├─► TailwindCSS? ──► ui
├─► design direction? ──► design
├─► wallet? ──► web3
├─► Solidity? ──► contracts
├─► indexer? ──► indexer
├─► offline? ──► data-layer
├─► deploy? ──► ops
├─► write tests? ──► testing
├─► build from stitch? ──► stitch
│
└─► Simple change? ──► Direct Claude (no skill needed)
```

---

## Aliases

Old names route to their new homes automatically:

| Alias | Routes To |
|-------|-----------|
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
