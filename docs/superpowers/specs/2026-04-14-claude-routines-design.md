# Claude Routines for Green Goods — Design Spec

**Date**: 2026-04-14
**Author**: Afo (via brainstorming session)
**Status**: Draft — awaiting user review before plan generation

## Context

Claude Code routines (research preview, announced 2026-04-14) let you configure a prompt + one or more GitHub repositories + connectors that runs on Anthropic-managed cloud infrastructure on a schedule, via API trigger, or in response to GitHub events. Sessions keep running when your laptop is closed.

Green Goods already has a rich automation surface (21 GitHub Actions workflows, `@claude` PR mentions, local scheduled tasks, `/loop`, the user-level `/dream-on` skill). Routines are additive — they earn a place only where they do work the existing surface cannot.

This spec defines the initial routine portfolio, write-back model, branching strategy, and phased rollout.

## Goals

1. Move laptop-closed automations off the local machine onto cloud routines.
2. Run bespoke PR review against Green Goods–specific invariants (CLAUDE.md rules), replacing the lightweight `claude-code-review.yml` action.
3. Run `/dream-on`-style cross-project exploration overnight as a routine, while keeping outputs private.
4. Add weekly data-analyst automation that maintains Dune dashboards and a metrics digest.
5. Preserve workflow invariants: **no merge conflicts with in-flight human branches, no clashes between routines**.

## Non-goals

- Automating develop → main promotion (that stays human-gated).
- Replacing `claude.yml` (the `@claude` on-demand mention workflow — still valuable, keep it).
- Cross-project PR synchronization (docs' "library port" pattern) — maybe later, not now.
- Building custom MCP connectors (PostHog, Dune) — use env vars + REST for v1.

## Constraints

- **Budget**: Max plan = 15 routine runs/day.
- **Privacy**: dream-on output may contain pre-public ideation; must not land in issues or PRs.
- **Solo dev**: tolerance for PR-queue noise is low; every PR must earn its keep.
- **Pilot live on Arbitrum**: production watch cannot flood issues on transient indexer blips.
- **Research preview**: API shape may change; routines must be rebuildable from spec.

## Architecture

```
┌──────────────────────────────┐         ┌──────────────────────────────┐
│ human work                   │         │ routine work                 │
│ feature/*, bug/*, chore/*    │         │ claude/<routine>/*           │
│          ↓ PR                │         │          ↓ PR                │
│        [main]  ←──── FF ─────┼── GHA ──┤      [develop]               │
│                              │  sync   │                              │
└──────────────────────────────┘         └──────────────────────────────┘
                                                    ↑
                                                    │ manual batch PR
                                                    │ (develop → main)
                                                    │ by human
```

**Principles:**

- Human flow unchanged: `feature/* → main`.
- Routine PRs target `develop`. Never main.
- `develop` stays ≥ `main` via a GitHub Action that fast-forwards on every push to main.
- Promotion (`develop → main`) is manual, on user's cadence.
- Branch namespace: `claude/<routine>/<topic>`, alongside existing `codex/*` and `cursor/*`.

**Output gradient (the routine write-back model):**

| Output form | When used | Routines |
|---|---|---|
| Session-only (private, nothing written) | Dream-like exploration with privacy sensitivity | `gg-dream-on` |
| Inline PR comments only | Code review on existing human PRs | `gg-pr-review` |
| GitHub Issue (labeled, deduped) | Judgment calls, anomalies, findings needing human triage | `gg-morning-watch`, `gg-data-analyst` (anomalies) |
| PR to `develop` (path-isolated) | Mechanical transformations and persistent artifacts | `gg-data-analyst` (weekly digest) |
| External API write (off-repo) | Systems of record outside git | `gg-data-analyst` (Dune queries) |

**The rule**: Judgment → Issue. Transformation → PR. Exploration → Session. External system → API. PR review → inline comments.

## The four routines

### 1. `gg-pr-review`

**Purpose**: bespoke PR review against Green Goods CLAUDE.md invariants. Replaces `claude-code-review.yml` after a parallel-run validation period.

| Field | Value |
|---|---|
| Trigger | GitHub: `pull_request.opened`, `pull_request.ready_for_review` |
| Filters | `base=main`, `is_draft=false`, `author != claude/*`, `from_fork=false` |
| Repos | `green-goods` |
| Environment | Default cloud env, trusted network access |
| Connectors | None required |
| Output | Inline PR comments only. One summary comment at end. Zero branches, zero issues, zero file writes. |
| Budget | 1–5 runs/day, PR-volume dependent |

**Prompt checklist** (project-specific, beyond generic review):

- Hook boundary: hooks live in `@green-goods/shared`; flag any React hook defined outside it.
- Indexer boundary: no EAS attestations, Gardens V2 community/pools, marketplace, ENS lifecycle, cookie jars, or Hypercert display metadata indexed.
- `Address` type (not `string`) for Ethereum addresses in TypeScript.
- No raw `forge` commands in scripts; use `bun build` / `bun run test`.
- No hardcoded contract addresses; import from `deployments/{chainId}-latest.json`.
- Barrel imports only: `import { x } from "@green-goods/shared"` — flag deep paths.
- Contract changes require Foundry test coverage; flag contract diffs without test diffs.
- `bun test` vs `bun run test`: flag usage of raw `bun test`.

**Cost controls:**

- If PR touches >50 files, post one summary comment noting "large PR; focused review skipped" and stop.
- Skip PRs labeled `skip-review` or `wip`.

### 2. `gg-morning-watch`

**Purpose**: daily operational health signal. *Is something on fire?*

| Field | Value |
|---|---|
| Trigger | Schedule, Mon–Fri 07:30 local |
| Repos | `green-goods` |
| Environment | Custom env with read-only RPC access |
| Env vars | `ARBITRUM_RPC_URL`, `ENVIO_INDEXER_URL` |
| Connectors | GitHub (built-in); optional: Slack for ping |
| Network access | Trusted (+ Arbitrum RPC domain if custom) |
| Output | GitHub Issues labeled `routine:watch:<category>`, deduped against open issues of same category |
| Budget | 1/day (5/week) |

**Checks:**

1. Envio indexer reachable + last-indexed-block within 50 blocks of Arbitrum head (~10 min at Arbitrum's 250ms block time; tune after observation).
2. Pilot-garden activity digest (13 Season One gardens): actions logged in last 24h.
3. CI pulse: red main-branch workflow runs in last 24h, failing scheduled workflows.
4. On-chain sanity: vault balances stable, yield-split state consistent, no anomalous withdrawals.

**Dedupe logic**: before opening an issue with label `routine:watch:<category>`, check for existing open issue with same label. If found, append a dated comment instead of opening a new issue.

### 3. `gg-dream-on`

**Purpose**: overnight cross-project exploration. *What haven't I thought about?*

| Field | Value |
|---|---|
| Trigger | Schedule, daily 03:00 local |
| Repos | `green-goods` (primary), `greenpill-website`, `coop`, `wefa` |
| Environment | Custom env (no package install; read-only) |
| Env vars | None required by default |
| Connectors | Google Drive (cross-project meeting notes); optional: Gmail |
| Network access | Trusted |
| Output | **Session-only.** No issues, no PRs, no file writes. Session sits in claude.ai history; user reads manually. |
| Budget | 1/day |

**Prompt notes:**

- Inline the dream-on instructions in the routine prompt (user-level `/dream-on` skill stays untouched).
- Explicit: "do not `bun install` in any repo; treat all four repos as read-only reference material."
- Final message = morning brief formatted as markdown (NREM deep analysis → REM ideation → insight summary).
- No write actions under any circumstance; if user wants an insight acted on, they open the session manually and continue the conversation.

**Resource guardrail**: 4 repos × ~100MB each well under 30GB disk. 16GB RAM sufficient without installs.

### 4. `gg-data-analyst`

**Purpose**: weekly metrics + Dune maintenance. *How are we growing?*

| Field | Value |
|---|---|
| Trigger | Schedule, Sundays 22:00 local |
| Repos | `green-goods` (for `indexer/schema.graphql` + contract ABIs context) |
| Environment | Custom env with API access |
| Env vars | `DUNE_API_KEY`, `POSTHOG_API_KEY`, `POSTHOG_HOST`, `ENVIO_INDEXER_URL`, `ARBITRUM_RPC_URL` |
| Connectors | Optional: Slack for digest-ready ping |
| Network access | Full (needs Dune + PostHog + Envio + Arbitrum) |
| Output | Three channels (see below) |
| Budget | 1/week |

**Write-back channels:**

1. **Dune API** (primary): update queries tagged `[routine]`, create new queries for newly-deployed contracts, fix slow queries flagged by Dune API execution metadata. Never touches user-owned queries.
2. **PR to `develop`** at `docs/metrics/YYYY-WW.md` (e.g., `docs/metrics/2026-15.md`): weekly digest with growth numbers, PostHog funnels, on-chain trend deltas, and Dune query-change log.
3. **Issue** with label `routine:metrics:anomaly` (deduped): only when something is genuinely off — yield-split drift, action volume drops >40% WoW, etc.

**Prompt guardrails:**

- Read-only against PostHog (scope API key accordingly).
- Dune queries owned by user — routine only edits those tagged `[routine]`.
- Low-confidence query changes go into digest as proposals, not as API writes.

**Flags to validate during rollout:**

- Dune API write access may require paid Dune plan. Confirm before Phase 5.
- No official PostHog MCP connector known; using env-var + REST.

## Branching + `develop` hygiene

**One-off reset** (user executes manually — destructive):

```bash
# Cherry-pick from develop first if the 2 orphan commits matter:
#   83dc8760 Release/1.1 (#403)
#   34251c45 Feature/ens integration (#338)
# Otherwise:
git checkout develop
git reset --hard origin/main
git push --force-with-lease origin develop
```

**Sync GitHub Action** — `.github/workflows/sync-develop.yml`:

```yaml
name: Sync develop with main
on:
  push:
    branches: [main]
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: develop
          fetch-depth: 0
          token: ${{ secrets.SYNC_DEVELOP_PAT }}
      - name: Fast-forward develop to main
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          git fetch origin main
          if git merge --ff-only origin/main; then
            git push origin develop
          else
            gh issue create \
              --title "develop sync: FF failed, manual resolution needed" \
              --label "routine:sync-develop:blocked" \
              --body "Routine PRs on develop now conflict with main. Resolve manually."
          fi
```

Requires a `SYNC_DEVELOP_PAT` secret with repo write access. Free to run — doesn't count against routine budget.

**Promotion** (manual): user opens `develop → main` PR on their own cadence (weekly or ad-hoc). Reviews the batch, merges, sync GHA catches develop up.

## `claude-code-review.yml` retirement

Not day-1. Phased migration:

- Week 0: ship `gg-pr-review`. Leave `claude-code-review.yml` running in parallel.
- Week 1: compare outputs on 3–5 PRs. Routine should meet or exceed the action (richer prompt, full repo context, CLAUDE.md rules).
- Week 2: delete `.github/workflows/claude-code-review.yml`. Keep `claude.yml` (on-demand `@claude` mentions).

## Rollout phases

| Phase | Work | Gate to next phase |
|---|---|---|
| 0 | Reset develop; add `sync-develop.yml` GHA + `SYNC_DEVELOP_PAT`. Create cloud environment with env vars. | GHA fast-forwards develop on a test push to main. |
| 1 | Ship `gg-pr-review`. Parallel with existing `claude-code-review.yml`. | Routine fires on 3+ PRs, output quality ≥ action. |
| 2 | Delete `claude-code-review.yml`. | No regression on next 3 PRs. |
| 3 | Ship `gg-morning-watch`. | Dedupe logic holds across 1 week; no duplicate-category issues. |
| 4 | Ship `gg-dream-on`. | 3 successful nightly runs; resource limits not hit. |
| 5 | Ship `gg-data-analyst`. | Dune API write path works; digest PR merges cleanly; no overwrite of user-owned queries. |

Each phase is a distinct PR / routine config commit. Easy to pause, easy to roll back.

## Daily budget

| Routine | Cadence | Runs/day typical |
|---|---|---|
| `gg-pr-review` | event | 1–5 |
| `gg-morning-watch` | weekdays 07:30 | 1 (Mon–Fri) |
| `gg-dream-on` | daily 03:00 | 1 |
| `gg-data-analyst` | Sundays 22:00 | 1 (Sunday only) |
| **Total (typical)** | | **3–7/day**, ≤ 8 Sundays |

Headroom on a 15-run cap: ~8–10 slots/day for manual `Run now`, API triggers, and surge PR days.

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Research-preview API changes break routines | Keep each routine's prompt + config as a committed markdown file under `routines/` in repo; easy to rebuild. |
| Webhook hourly caps drop a PR review event | Manual `Run now` as fallback; PR review isn't time-critical. |
| Lockfile conflict with in-flight `feature/*` | Routine PRs target `develop`, not `main`. Conflict only surfaces at promotion-time, resolved manually. |
| Data-analyst overwrites user-owned Dune queries | Routine only edits queries tagged `[routine]`; tag convention enforced in prompt. |
| Two routines fire simultaneously | Staggered schedules: 03:00 dream → 07:30 watch → 22:00 data-analyst. PR-review event-driven on a different artifact surface. |
| Routine triggers itself (loop) | `gg-pr-review` filter `author != claude/*` excludes routine-opened PRs. |
| Dream-on 4-repo clone hits resource cap | Prompt instructs read-only; no `bun install` in any repo. |
| Env-var secret leak | Dedicated cloud environment; scope keys read-only where supported (PostHog especially); rotate quarterly. |
| Morning-watch issue flood on transient blip | Dedupe by `routine:watch:<category>` label; append comments instead of new issues. |
| `develop` drifts from `main` | sync-develop GHA fast-forwards on every main push; opens a labeled issue if FF fails. |

## Repository file layout

```
.github/workflows/
  sync-develop.yml              (new — Phase 0)
  claude-code-review.yml        (deleted — Phase 2)
  claude.yml                    (kept)
routines/                       (new — committed for rebuildability)
  gg-pr-review.md
  gg-morning-watch.md
  gg-dream-on.md
  gg-data-analyst.md
docs/metrics/
  YYYY-WW.md                    (created weekly by gg-data-analyst)
docs/superpowers/specs/
  2026-04-14-claude-routines-design.md   (this file)
```

## Open questions (for plan-writing phase)

1. Dune API tier — confirm paid access before Phase 5.
2. `SYNC_DEVELOP_PAT` — fine-grained PAT vs. GitHub App? Fine-grained simpler, but expires.
3. Whether the 2 orphan commits on `develop` (`Release/1.1 (#403)`, `Feature/ens integration (#338)`) should be preserved or discarded at reset-time.
4. Slack connector: useful for watch/data-analyst pings, or is issue-notification enough?
5. Exact env-var keys user has vs. needs to generate: Dune API key (new?), PostHog API key (from existing PostHog instance), Arbitrum RPC (probably already in root `.env`).

These do not block spec approval — they resolve during plan generation.

## Success criteria

- All four routines operational within 4 weeks of rollout start.
- Zero routine-vs-human merge conflicts observed in first 4 weeks.
- PR-review routine catches ≥ 1 CLAUDE.md violation that slipped past human review in its first month.
- At least 1 weekly metrics digest merged to `main` via develop.
- At least 3 dream-on sessions yield an insight user acts on (creates an issue or `.plans/` entry from).
- `claude-code-review.yml` successfully retired without regression.
