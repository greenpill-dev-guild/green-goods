# TypeScript 7-only upgrade Plan

> **Archived record:** implementation is closed. Operational handoffs, reports, artifacts, and lane files were removed; any such references below describe historical execution, not live work.

**Feature Slug**: `typescript-7-upgrade`
**Stage**: `archive`
**Status**: `ARCHIVED - COMPLETED`
**Created**: `2026-07-14T00:39:12.925Z`
**Last Updated**: `2026-07-14T00:39:12.925Z`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | TS 7 only | Replace the single compiler API test dependency rather than installing TypeScript 6. |
| 2 | Refresh only peer-constrained packages | Avoid unrelated dependency churn. |

## Research / Plan Gate

- [x] Record research evidence in `spec.md`
- [x] Identify the existing repo pattern to mirror
- [x] List human judgment points before implementation
- [x] Define what is out of scope
- [x] Choose the lightest honest validation commands

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| TS 7-only resolution | `state_api` | Update manifests and lockfile | ✅ |
| Compiler config | `state_api` | Remove unsupported `baseUrl` options | ✅ |
| Locale message extraction | `state_api` | Replace TypeScript AST parser | ✅ |
| Docs confidence-band labels | `state_api` | Preserve formatted chart labels with a focused regression test | ✅ |

## TDD / Proof Order

- [x] Identify the behavior boundary for each implementation lane before editing code
- [x] Write or select the minimal failing test/proof first
- [x] Run the RED command and record evidence in the lane handoff
- [x] Implement the smallest change that can satisfy the proof
- [x] Run the GREEN command and record evidence in the lane handoff
- [x] Record machine-readable proof with `node scripts/harness/plan-hub.mjs record-tdd`
- [x] Confirm TDD applies; no `not_applicable` or `proof_limit` claim is needed

## Lane Checklists

### UI (`claude/ui/typescript-7-upgrade`)

- [ ] UI tasks only
- [ ] Add i18n for new user-facing strings
- [ ] Record RED/GREEN proof or a proof-limit note before marking the lane complete
- [ ] Write `handoffs/claude-ui.md`

### State / API (`codex/state-api/typescript-7-upgrade`)

- [x] Compiler, dependency, config, and parser migration
- [x] Keep reusable test parsing dependencies scoped to shared
- [x] Preserve docs confidence-band labels with a focused RED/GREEN regression test
- [x] Record RED/GREEN proof in `handoffs/codex-state-api.md`
- [x] Write `handoffs/codex-state-api.md`

### Contracts (`codex/contracts/typescript-7-upgrade`)

- [ ] Contract logic and tests
- [ ] Respect deployment ordering and upgrade safety
- [ ] Record RED/GREEN proof or a proof-limit note before marking the lane complete
- [ ] Write `handoffs/codex-contracts.md`

### QA Pass 1 (`claude/qa-pass-1/typescript-7-upgrade`)

- [ ] Review UI behavior and user flow
- [ ] Verify acceptance criteria from `eval.md`
- [ ] Write `handoffs/claude-qa-pass-1.md`

### QA Pass 2 (`codex/qa-pass-2/typescript-7-upgrade`)

- [x] Review regressions and implementation edges
- [x] Run targeted validation commands
- [x] Write `handoffs/codex-qa-pass-2.md`

## Validation

- [x] Targeted shared locale coverage test
- [x] Targeted docs confidence-band label test
- [x] Package-local typecheck/build proof
- [x] `node scripts/dev/ci-local.js --quick` (PASS 2026-07-15: "All CI checks passed!". Final state — the uint8arrays override/resolutions removal was investigated, found to rest on a false premise, and **reverted/decoupled from TS7**: `overrides.uint8arrays: ^5.1.0` + `resolutions` are restored to HEAD, the lockfile nests no `uint8arrays@3`, and WalletConnect resolves v5 deterministically on every machine. Only the TypeScript-7 changes remain. See `handoffs/codex-qa-pass-2.md` § Final Resolution.)
- [x] `bun install --frozen-lockfile`
