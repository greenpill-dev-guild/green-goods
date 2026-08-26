# Harvest Distribution Completion Plan

**Feature Slug**: `harvest-distribution-ux`
**Stage**: `active`
**Status**: `ACTIVE`
**Linear Issue**: `PRD-763`
**Linear Source**: `source:plans`
**Created**: `2026-08-26T18:29:53.626Z`
**Last Updated**: `2026-08-26T19:06:18Z`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Keep contract harvest and distribution separate | Preserves deployed protocol behavior and Safe transaction semantics. |
| 2 | Present one guided operator workflow | Operators should not need protocol implementation knowledge to finish the task. |
| 3 | Stop after non-canonical Safe submission | The harvest is not confirmed, so a dependent split would be unsafe. |
| 4 | Treat split failure as partial success | Harvested shares remain safe and distribution can be retried without harvesting twice. |
| 5 | Keep PRD-351 in backlog | Presets, client visibility, and governance hardening are unrelated to the incident fix. |
| 6 | Show estimates before and event amounts after | The confirmation is useful without claiming estimates are exact execution results. |

## Research / Plan Gate

- [x] Record research evidence in `spec.md`
- [x] Identify the existing repo pattern to mirror
- [x] List human judgment points before implementation
- [x] Define what is out of scope
- [x] Choose the lightest honest validation commands

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| State-aware operator action and confirmation | `ui` | Step 3 | Implemented; clean-SHA receipt pending |
| Waiting, submitted, partial, retry, and success states | `ui` | Step 3 | Implemented; clean-SHA receipt pending |
| Fresh yield status and destination reads | `state_api` | Step 1 | Implemented; clean-SHA receipt pending |
| Safe two-stage transaction orchestration | `state_api` | Step 2 | Implemented; clean-SHA receipt pending |
| Privacy-safe telemetry and complete invalidation | `state_api` | Step 2 | Implemented; clean-SHA receipt pending |
| No protocol behavior change | `contracts` | N/A | Locked |

## TDD / Proof Order

- [x] Identify the behavior boundary for each implementation lane before editing code
- [x] Write or select the minimal failing test/proof first
- [x] Run the RED command and record evidence in the lane handoff
- [x] Implement the smallest change that can satisfy the proof
- [x] Run the GREEN command and record evidence in the lane handoff
- [x] Record machine-readable proof with `node scripts/harness/plan-hub.mjs record-tdd`
- [ ] If TDD cannot honestly apply, record `not_applicable` or `proof_limit` with a concrete note in `status.json`

## Lane Checklists

### Step 1: Add the yield status boundary

**Files**: shared yield hook, ABI, exports, focused hook tests.

- Read shares, converted assets, pending yield, effective threshold, escrow, split config, and route.
- Derive ready, waiting, empty, and estimated distribution values.
- Write RED first for asset threshold override, share conversion, fallback route, and read errors.

### Step 2: Add the two-stage mutation workflow

**Files**: shared workflow hook, analytics events, finance invalidation, focused mutation tests.

- Harvest only when requested; fresh-read eligibility before split.
- Stop on non-canonical submission and preserve split-only retry after partial failure.
- Parse confirmed `YieldSplit` amounts, refresh all relevant state, and emit safe telemetry.

### Step 3: Wire the admin workflow

**Files**: `PositionCard`, its component test and visual harness, and three locale catalogs.

- Use one stable operator action with an `AdminConfirmDialog` and explicit two-prompt copy.
- Show waiting/submitted/partial/success state inline; retry calls distribution only.
- Keep emergency pause separated and preserve existing deposit/withdraw behavior.

### Step 4: Validate and close evidence

- Render the validation selector and follow its selected checks.
- Run focused shared/admin RED/GREEN tests, package typecheck/build, and repo quick gate.
- Run agentic/design/vocabulary/story checks and authenticated Brave QA for the state matrix.
- Record TDD and validation receipts without claiming production execution.

## Validation

- [x] `bun run validation:plan -- --intent qa`
- [x] Focused shared and admin tests
- [x] Shared typecheck and admin build
- [ ] `node scripts/dev/ci-local.js --quick`
- [x] `bun run agentic:check`
- [x] `bun run lint:vocab`
- [x] `bun run check:design-tokens` (selected through `agentic:check`)
- [x] Shared Storybook quality checks
- [ ] Authenticated Brave keyboard and narrow-viewport proof

Authenticated Brave reached the static state harness and visually verified confirmed and partial-success states. Real-route authenticated proof remains blocked because the local HTTPS certificate cannot be created in the managed environment and the HTTP fallback does not preserve the authenticated origin.
