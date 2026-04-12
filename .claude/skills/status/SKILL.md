---
name: status
user-invocable: true
description: Morning briefing — architecture state, feature pipeline, production health, user journeys, onchain & indexer state, git pulse, and daily focus recommendations. Not an audit; a lay of the land.
argument-hint: "[--quick|--full] [--focus pipeline|health|journeys|git|onchain]"
version: "1.1.0"
status: active
packages: ["all"]
dependencies: []
last_updated: "2026-04-07"
last_verified: "2026-04-07"
---

# Status Skill

Situational awareness briefing for starting a work session. Aggregates architecture state, feature pipeline progress, production health signals, user journey readiness, onchain & indexer status, git activity, and recommends what to focus on.

**This is NOT an audit.** It does not look for problems to fix. It maps the terrain so you can navigate it.

---

## Activation

Use when:
- Starting a work session and you need a lay of the land
- You want a quick pipeline, health, or git pulse briefing
- You need continuity from the prior session before choosing work

## Invocation

```
/status                    # Standard briefing (all sections)
/status --quick            # Abbreviated — pipeline + health + focus only
/status --full             # Deep briefing with subagent exploration
/status --focus pipeline   # Feature pipeline only
/status --focus health     # Production health only
/status --focus journeys   # User journey readiness only
/status --focus git        # Git activity pulse only
/status --focus onchain    # Onchain & indexer state only
```

---

## Execution Model

- **Read-only**: Never edit files. All output goes to chat.
- **Speed over depth**: Favor fast reads over exhaustive scans. This runs at session start — keep it under 2 minutes for standard, 30 seconds for `--quick`.
- **Parallel gathering**: Sections 1-6 can be gathered in parallel. The Headline, Blockers, Delta, and Daily Focus synthesize the others.
- **For `--full` mode**: Use Explore subagents for deeper architecture and journey mapping. Standard mode uses direct tool calls only.

### Time Budget

| Mode | Target | Section breakdown |
|------|--------|-------------------|
| --quick | 30s | Pipeline read + tsc only |
| standard | 90s | 6 sections, direct tool calls, per-package parallel tests |
| --full | 180s | 3 sections direct + 3 subagent (foreground, parallel) |

If any single check exceeds 60s, report what you have and mark it TIMEOUT. Don't let one slow check block the entire briefing.

---

## Output Structure

The briefing always follows this order:

1. **Headline** — one-sentence state of the product (synthesized after gathering)
2. **Blockers** — anything blocking work, pulled to the top (if any exist)
3. **Last Session** — continuity from `session-state.md` (if it exists)
4. **Delta** — what changed since last `/status` run (if prior data exists)
5. Sections 1-6 (data)
6. Section 7: Daily Focus (synthesis)

---

## Headline

A single sentence at the very top summarizing the product state. Written after all sections are gathered. Should be scannable in under 3 seconds.

### Format

```
> **Client PWA operational, admin cockpit under revamp. 2 features in progress, 5 planned. Contracts deployed on Sepolia.**
```

### Rules

- One sentence, max two. No bullet points.
- Cover: which journeys work, what's active, pipeline momentum, health signal.
- Use plain language — this is for a human glancing at their terminal first thing in the morning.

---

## Blockers Callout

If ANY of the following are true, surface them in a prominent callout block before the sections. Nothing buried = nothing missed.

### Sources

- Lanes with status `blocked` in any feature pack
- Failing health checks (types, lint, tests)
- Broken user journeys (`✗` status)
- Contract deployment gaps blocking a feature
- Uncommitted work on a branch that's diverged significantly
- Indexer out of sync or schema mismatch

### Output

```
> **⚠ Blockers**
> - **admin-ui-revamp/qa_pass_1** lane blocked — depends on ui + state_api
> - **Tests FAIL** — 2 regressions since last run
> - **Indexer** schema out of sync with latest deployment
```

If nothing is blocked, omit this section entirely. Don't say "No blockers" — absence means clear.

---

## Last Session

If `session-state.md` exists in the repo root, read it and surface a continuity summary.

### Gather

1. Check if `session-state.md` exists at repo root
2. If yes, read it and extract: current task, progress, files modified, next steps, blockers

### Output

```
> **Continuing from last session** (saved 2026-04-06T23:15:00Z)
> Task: Admin UI Phase 1a — Wave 3 surface migration
> Left off: GardenStatsGrid and StatCard redesigned, CanvasLayout wired
> Next: TrendIndicator component, garden view empty states
```

If no `session-state.md` exists, omit this section. Don't mention its absence.

---

## Delta (Change Since Last Status)

Track what moved between status runs. This turns the briefing from a snapshot into a momentum tracker.

### Gather

After all sections are gathered, compare current values against the previous run's data. The previous run's data comes from:
1. The most recent `/status` output in conversation history (same session)
2. Or absence — if this is the first run, skip this section

### Output

```
> **Since last status** (2h ago)
> - Tests: 47 → 52 (+5)
> - Shared exports: 85 → 88 (+3)
> - Branches: -2 merged, +1 new
> - Features: admin-ui-revamp/ui moved todo → in-progress
> - Health: all checks still passing
```

### Rules

- Only show lines where something changed. Don't repeat stable values.
- If this is the first `/status` in the session, omit this section entirely.
- Use `→` arrows for transitions, `+N`/`-N` for numeric changes.

---

## Freshness Indicators

All dates in the briefing should use relative age labels instead of (or alongside) absolute dates. This makes staleness immediately visible.

### Age Labels

| Age | Label | Urgency |
|-----|-------|---------|
| Today | `today` | Current |
| 1 day | `yesterday` | Current |
| 2-6 days | `Nd ago` | Normal |
| 7-13 days | `~Nw ago` | Attention |
| 14+ days | `Nd ago ⚠ stale` | Stale — flag it |

### Application

Use these everywhere dates appear:
- Feature pipeline `Updated:` field → `Updated: today` or `Updated: 12d ago ⚠ stale`
- Git pulse timestamps
- Session state saved date
- Build staleness
- Deployment age

---

## Section 1: Architecture Snapshot

Quick structural overview — not a deep analysis (that's `/architecture`).

### Gather

1. Read `packages/*/package.json` — extract name, version, key dependency versions
2. Count shared modules: `ls packages/shared/src/modules/`
3. Count client views: `ls packages/client/src/views/`
4. Count admin views: `ls packages/admin/src/views/`
5. Count contract source dirs: `ls packages/contracts/src/`
6. Check `@green-goods/shared` barrel: count exports in `packages/shared/src/index.ts`

### Output

```
## Architecture Snapshot

| Package | Version | Key Deps |
|---------|---------|----------|
| @green-goods/shared | x.x.x | viem, wagmi, tanstack-query, zustand |
| @green-goods/client | x.x.x | react, vite, pwa |
| @green-goods/admin | x.x.x | react, vite |
| @green-goods/contracts | x.x.x | forge-std, solady |
| @green-goods/indexer | x.x.x | envio |
| @green-goods/agent | x.x.x | telegraf |
| @green-goods/ops | x.x.x | — |

Shared modules: N  |  Client views: N  |  Admin views: N
Contract source dirs: N  |  Shared barrel exports: ~N
```

---

## Section 2: Feature Pipeline

The heart of the briefing. Read all active plans and present where everything stands.

### Gather

1. Read every `.plans/active/*/status.json` that exists
2. For plans without `status.json`, read the `spec.md` or `brief.md` header to infer stage
3. Check `.plans/backlog/` for planned-but-not-started features
4. Read lane-level status from each `status.json`

### Classification

Group features by lifecycle stage:

| Stage | Criteria |
|-------|----------|
| **Shipped** | All lanes `done`, merged to main |
| **In Progress** | At least one lane `in_progress` or `done` with others remaining |
| **Ready** | All lanes `todo` or `ready`, no blockers |
| **Planned** | In `.plans/active/` but lanes not started |
| **Blocked** | Has explicit blockers or unresolved dependencies |
| **Dormant** | No activity, `updated_at` > 14 days old |
| **Backlog** | In `.plans/backlog/`, not yet prioritized |

### Output

```
## Feature Pipeline

### In Progress
- **admin-ui-revamp** — Admin cockpit redesign + two-app architecture
  Lanes: ui → | state_api → | contracts n/a | qa1 ✗ | qa2 ✗
  Updated: 11d ago ⚠ stale

### Ready
- **yield-split-ui** — Yield split configuration interface
  Lanes: ui → | state →
  Updated: yesterday

### Backlog
- 3 features queued

Total: N features (N shipped, N in progress, N ready, N planned, N backlog)
```

Use lane indicators: `✓` done, `◐` in progress, `→` ready/todo, `✗` blocked, `—` n/a

### Reconciliation

If `status.json` `updated_at` is older than 7 days:
1. Check `git log --oneline --since='7 days ago' -- packages/` for recent commits on that feature's branch
2. If commits exist that match the feature scope, note the discrepancy: "status.json says todo, but N commits landed since — likely in-progress"
3. Cross-reference `session-state.md` — it often has the real current phase

---

## Section 3: Production Health

Quick signals — not a full audit (that's `/audit`).

### Gather

1. Typecheck per-package (no root tsconfig exists). Run all three in parallel:
   - `bunx tsc -p packages/shared/tsconfig.json --noEmit 2>&1 | tail -5`
   - `bunx tsc -p packages/client/tsconfig.json --noEmit 2>&1 | tail -5`
   - `bunx tsc -p packages/admin/tsconfig.json --noEmit 2>&1 | tail -5`
2. Run `bun lint 2>&1 | tail -10` — pass/fail + warning count
3. Tests: Run per-package in parallel, NOT `bun run test` at root. Each with timeout 60s — if a package hangs, report TIMEOUT, don't wait:
   - `cd packages/shared && bun run test 2>&1 | tail -5`
   - `cd packages/client && bun run test 2>&1 | tail -5`
   - `cd packages/admin && bun run test 2>&1 | tail -5`
   - `cd packages/ops && bun run test 2>&1 | tail -5`
   - `cd packages/indexer && bun run test 2>&1 | tail -5`
4. Check last successful build: `git log --oneline --grep='build' -5` or check if `dist/` dirs exist
5. Check environment: Use the **Read** tool (not Bash) to read `.env`, or **Grep** tool to search for `VITE_CHAIN_ID`. NEVER use `cat .env` or `grep .env` via Bash — hooks block direct `.env` access via shell commands.

### Output

```
## Production Health

| Check | Status | Detail |
|-------|--------|--------|
| Types | PASS | 0 errors |
| Lint | PASS | 2 warnings |
| Tests | PASS | 47/47 |
| Build | STALE | Last build: 2 days ago |

Environment: chain 11155111 (sepolia) | VITE_CHAIN_ID set
```

Statuses: `PASS`, `WARN` (non-blocking issues), `FAIL` (blocking), `STALE` (not recently verified), `UNKNOWN`

---

## Section 4: User Journey Map

Which product flows are wired and operational vs stubbed or incomplete. Green Goods has two frontends (client PWA for gardeners, admin cockpit for operators) and an onchain pipeline.

### Gather

Read specific probe files to determine flow completeness. Check for real implementations vs stubs/mocks/TODOs.

### Probe Files

Each journey has sentinel files and indicators. Read the probe file(s) (~first 100-150 lines) and grep for the ● indicator. If found → ●. If file exists but indicator absent → ◐. If file missing → ○.

| Journey | Probe File(s) | ● Operational if |
|---------|--------------|------------------|
| Document Work | `packages/client/src/views/Garden/index.tsx`, `packages/shared/src/modules/job-queue/index.ts` | `jobQueue.getJobs()` called, media capture wired |
| Review & Assess | `packages/admin/src/views/Gardens/Garden/WorkDetail/ReviewForm.tsx` | `useWorkApproval()` mutation, IPFS upload chain present |
| Garden Management | `packages/admin/src/views/Gardens/CreateGarden.tsx` | `useCreateGardenWorkflow()`, draft persistence |
| Funding & Treasury | `packages/admin/src/views/Treasury/Vault.tsx`, `packages/admin/src/views/Endowments/index.tsx` | `useGardenVaults()` + DepositModal real |
| Public Impact | `packages/client/src/views/Public/Fund.tsx`, `packages/client/src/views/Public/Impact.tsx` | Real handlers (not log-only), deposit flow wired |
| Auth & Identity | `packages/shared/src/modules/auth/authMachine.ts` | XState machine with both passkey + wallet states |
| Offline & Sync | `packages/client/public/sw-custom.js`, `packages/shared/src/modules/job-queue/index.ts` | SW sync tag registered, queue auto-flush on reconnect |

In standard mode, use Grep to check for the indicator patterns across all probe files in a single pass. In `--full` mode, the journey subagent reads each file in depth.

### Output

```
## User Journeys

| Journey | Surface | Status | Notes |
|---------|---------|--------|-------|
| Document Work | Client | ● Operational | Offline queue + media capture |
| Review & Assess | Admin | ◐ Partial | Assessment views exist, attestation WIP |
| Garden Management | Admin | ● Operational | Create, configure, manage members |
| Funding & Treasury | Admin | ○ Mock | Vault views stubbed |
| Public Impact | Client | ◐ Partial | Gallery wired, deposit dialog new |
| Auth & Identity | Shared | ● Operational | Wallet + role-based access |
| Offline & Sync | Client | ◐ Partial | SW registered, queue functional, sync WIP |
```

Indicators: `●` operational, `◐` partial/WIP, `○` mock/stubbed, `✗` broken/missing

---

## Section 5: Git Activity Pulse

Recent activity context to understand momentum and open work.

### Gather

1. `git log --oneline -20` — recent commits
2. `git branch -a --sort=-committerdate | head -15` — active branches
3. `git status` — uncommitted work
4. `git stash list` — stashed work
5. `git log --since='7 days ago' --format='%an' | sort | uniq -c | sort -rn` — contributor activity

### Output

```
## Git Pulse

Last 7 days: N commits across N branches
Active branches: feature/xxx, fix/yyy, ...
Uncommitted changes: N files modified, N untracked

Recent commits:
  266a226 fix(client,shared): review fixes — dialog a11y, i18n, semantic colors
  a3ac211 feat(client): Phase 3 public platform — deposit dialog, hypercert gallery
  ...
```

---

## Section 6: Onchain & Indexer

The onchain pipeline is the product's backbone. This section surfaces whether contracts are deployed, the indexer is tracking, and schemas are registered.

### Gather

1. **Deployment artifacts**: Read `packages/contracts/deployments/` — list `{chainId}-latest.json` files, check which modules have non-zero addresses
2. **Contract modules**: `ls packages/contracts/src/modules/` — count deployed vs total
3. **Indexer schema**: Read `packages/indexer/schema.graphql` header — entity count, last-modified date
4. **Indexer config**: Read `packages/indexer/config.yaml` or equivalent — which contracts/events are indexed
5. **EAS schemas**: Check if schema UIDs are present in deployment artifacts
6. **Chain target**: Read `VITE_CHAIN_ID` from `.env` — confirm target chain matches deployments

### Output

```
## Onchain & Indexer

| Metric | Value |
|--------|-------|
| Target chain | 11155111 (Sepolia) |
| Deployment artifact | deployments/11155111-latest.json |
| Modules deployed | N / N |
| Zero-address modules | list (optional, not yet deployed) |
| Indexer entities | N |
| EAS schemas registered | N |

### Deployment Status
| Module | Address | Status |
|--------|---------|--------|
| GreenGoods | 0x... | ● Deployed |
| YieldSplit | 0x000...000 | ○ Not deployed |
| ... | ... | ... |

### Indexer
- Config: N contracts watched, N events indexed
- Schema: N entities defined
- Last schema change: [freshness label]
```

Indicators: `●` deployed/active, `○` not deployed/zero address

---

## Section 7: Daily Focus

Synthesize sections 1-6 into actionable recommendations for the work session.

### Logic

1. **Blocked features** → Unblock first (highest leverage)
2. **In-progress features with ready lanes** → Continue momentum
3. **Failing health checks** → Fix before new work
4. **Stale deployments or schema mismatches** → Align onchain state
5. **Stale builds** → Rebuild to establish baseline
6. **Broken user journeys** → Fix critical paths
7. **Dormant features** → Decide: continue, defer, or archive
8. **Ready features** → Pick one to start if nothing else is pressing

### Output

```
## Daily Focus

### Priority
1. **[Action]** — [reason, context]
2. **[Action]** — [reason, context]
3. **[Action]** — [reason, context]

### Consider
- [Lower-priority suggestion]
- [Lower-priority suggestion]

### Parking Lot
- [Dormant items that need a decision but aren't urgent]
```

Keep to 3 priority items max. Be specific about what to do, not vague.

---

## Mode Variants

### `--quick`

Run only:
- Headline (always)
- Blockers callout (if any)
- Last Session (if `session-state.md` exists)
- Section 2 (Feature Pipeline) — abbreviated, no lane detail
- Section 3 (Production Health) — typecheck only, skip full test run
- Section 7 (Daily Focus) — based on available data

Target: under 30 seconds.

### `--full`

**Key difference from standard**: Sections 1, 4, and 6 are gathered BY subagents (not direct tool calls). All other sections use direct tool calls. Never do both for the same section.

- Standard mode: direct tool calls for all 6 sections, using probe files and Grep.
- Full mode: direct tool calls for sections 2, 3, 5 + subagents for 1, 4, 6.

Subagents (**all three MUST be foreground**, not background — the briefing cannot be output until all results are available. Launch all 3 in parallel but wait for all before synthesizing):
- **Explore** subagent: map shared module export surface in detail (Section 1)
- **Explore** subagent: check user journey wiring depth — read probe files, check implementation, not just file presence (Section 4)
- **Explore** subagent: onchain deployment completeness check (Section 6)

Additionally:
- Include dependency version audit (outdated packages)
- Include a "What's Changed Since Last Status" diff if a previous status output is found

### `--focus [section]`

Run only the named section:
- `pipeline` → Section 2
- `health` → Section 3
- `journeys` → Section 4
- `git` → Section 5
- `onchain` → Section 6

---

## Output Format

Always output as chat markdown. The briefing should be scannable — use tables, indicators, and short sentences. No prose paragraphs.

### Header

```
# Green Goods Status — [date]

> **[Headline — one sentence product state summary]**
```

Immediately followed by Blockers callout (if any), Last Session (if exists), Delta (if not first run), then sections 1-7.

### Footer

```
---
_Briefing generated [timestamp]. For deeper analysis: `/architecture`, `/audit`, `/review`._
```

---

## Anti-Patterns

| Don't | Why |
|-------|-----|
| List every file or export | This is a briefing, not an inventory |
| Flag issues to fix | This is not an audit — observe, don't prescribe fixes |
| Run full test suite in `--quick` mode | Speed matters at session start |
| Make architectural judgments | Describe the state, don't evaluate it |
| Edit any files | Read-only, always |
| Recommend refactoring | That's `/architecture` territory |
| Spend more than 2 minutes | If gathering takes too long, report what you have |
| Run contract builds or deployments | Read artifacts, don't create them |

---

## Execution Checklist

When `/status` is invoked:

1. Parse arguments for mode (`--quick`, `--full`, `--focus`)
2. **Check for `session-state.md`** at repo root — read if present
3. **Gather in parallel** (sections 1-6 as independent data collection)
   - For standard mode: direct tool calls (Read, Bash, Glob, Grep)
   - For `--full` mode: spawn Explore subagents for sections 1, 4, and 6
4. **Synthesize post-gather elements** from gathered data:
   - Write the **Headline** (one sentence)
   - Extract **Blockers** from all sections (blocked lanes, failing checks, broken journeys)
   - Compute **Delta** if prior `/status` data exists in conversation
   - Compose **Section 7: Daily Focus**
5. **Format** the briefing in output order: Headline → Blockers → Last Session → Delta → Sections 1-6 → Daily Focus
6. **Use freshness labels** for all dates (today / yesterday / Nd ago / Nd ago ⚠ stale)
7. **Output** the complete briefing — do NOT output any section before all data is gathered

### Parallel Batch Rules

- Never mix Bash calls that might be blocked by hooks with other calls in the same parallel batch. `.env` reads, secret-adjacent files, and `source` commands should be in their own batch using Read/Grep tools instead of Bash.
- If a batch fails, the remaining calls in that batch are cancelled. Keep independent critical paths in separate batches.
- Group by independence: git commands in one batch, health checks in another, file reads in another.

---

## Related Skills

- `/architecture` — Deep structural analysis (when status reveals architecture questions)
- `/audit` — Problem-finding mode (when status reveals health issues)
- `/review` — Code review (when status shows changes ready for review)
- `/plan` — Feature planning (when status shows ready features to start)
- `/debug` — Investigation (when status shows broken journeys)
