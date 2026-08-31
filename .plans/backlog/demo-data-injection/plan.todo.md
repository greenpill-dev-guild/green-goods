# Demo Data Injection Seams Plan

**Feature Slug**: `demo-data-injection`
**Stage**: `backlog`
**Status**: `BACKLOG`
**Created**: `2026-08-23T02:07:14.633Z`
**Last Updated**: `2026-08-23T02:07:14.633Z`

Deferred behind the module optimization and test work. Nothing here is claimed by automation while
the hub sits in `backlog`. The seam map in `spec.md` is the reference for every rung below.

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Four rungs, each independently shippable, not one programme | Rung 1 alone closes most of the pain. Bundling them would stall the cheap win behind the expensive one |
| 2 | Rung 1 (indexer seeding) leads | It is the only seam that reaches all three UIs with no product-code branch, and it fixes the actual gap: 18 pools with nothing inside them |
| 3 | Fix the admin IndexedDB dehydration guard before any rung ships | Injected reads that outlive their flag turn a review tool into a source of false confidence. Small fix, large consequence |
| 4 | Rung 3 (MSW browser worker) stays last among the reads | It shadows the real network, so it buys reach at the cost of what a review proves. Take it only if rungs 1 and 2 leave a real gap |
| 5 | No Linear records at hub creation | Agreed 2026-08-22. Revisit when a rung is promoted to `active` |

## Research / Plan Gate

- [x] Record research evidence in `spec.md`
- [x] Identify the existing repo pattern to mirror — `demoAware`, `withSeededQueryClient`, `seed-test-data.ts`
- [x] List human judgment points before implementation
- [x] Define what is out of scope
- [ ] Choose the lightest honest validation commands — per rung, when it is promoted

## The rungs

### Rung 1 — seed the indexer database  ·  `state_api`  ·  highest value per hour

Write commitments, cycles and claim requests into the 18 pools that already exist, so every surface
has something to render.

- Idempotent and re-runnable: `envio dev --restart` and `bun run reset` delete the database.
- Seed with the indexer stopped, or into entities it is not actively writing (see the untested
  assumption in `spec.md`).
- Data should be visibly synthetic on inspection so it is never mistaken for pilot evidence.
- Lives in `scripts/` only if it earns a durable caller per the CLAUDE.md scripts policy; otherwise
  it belongs in this hub.
- Done when one command puts a populated garden on all three surfaces with no code change.

### Rung 2 — extend the read gate to the editorial and console readers  ·  `state_api`

Wrap `getPublicGardenPool`, `getPublicCommitmentImpact` and the four unwrapped console readers in
`demoAware`, and write the fixtures behind them.

- The wrap is one line each. The work is the fixtures: public shapes and operator shapes, neither
  of which exists.
- The demo world models the viewer as a member, never a steward (`demo-world.ts`). A console fixture
  world needs steward standing, which today resolves from on-chain `GardenAccountABI` reads.
- Keep the existing write guards; a new reader must not open a new write path.
- Take this if per-surface toggling without a database is worth the fixture cost. Rung 1 makes it
  optional rather than necessary.

### Rung 3 — an MSW browser worker in dev  ·  `ui` + `state_api`

msw 2.14.6 is already a root dependency, used node-side only in
`packages/shared/src/__mocks__/server/server.ts`. `__mocks__/browser/` is jsdom shims, not a
`setupWorker`.

- One interception point could answer any indexer GraphQL query from fixtures, covering non-pooling
  surfaces too.
- Read Decision 4 before starting: this is the rung that changes what a review proves.
- Must not register in production builds, and must be obvious when active.

### Rung 4 — pooling contract helpers and `seed:pooling`  ·  `contracts`

`tests/fixtures/contract-helpers.ts` has `createGarden`, `joinGarden`, `registerAction`,
`submitWork`, `approveWork` and no pooling equivalent.

- Add the pooling side, then a `seed:pooling` script beside `seed:test`.
- The only rung whose data is true end to end, and the only one that also exercises writes.
- Most faithful, most work. Worth it when we need evidence rather than a picture.
- Do not repurpose `.plans/active/commitment-pooling/backfill-pools.ts`; it is a release-gated
  on-chain operation.

### Prerequisite — the admin dehydration guard

`packages/admin/src/main.tsx` calls `createShouldDehydrateQuery({ excludedGroups: ["queue", "role"] })`
and that helper has no demo awareness. The client guards this inline in `App.tsx` and mirrors it
with `dropPersistedPoolingReads`; admin does not, so fixture pooling reads persist to
`gg-admin-react-query` and can outlive the flag. Close this before any rung ships.

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| A populated garden reads correctly on all three surfaces | `state_api` | Rung 1 | ⏳ |
| Per-surface toggling without a database | `state_api` | Rung 2 | ⏳ |
| Coverage beyond pooling surfaces | `ui` | Rung 3 | ⏳ |
| Data that is true end to end, writes included | `contracts` | Rung 4 | ⏳ |
| No injected read outlives its flag | `state_api` | Prerequisite | ⏳ |

## TDD / Proof Order

- [ ] Identify the behavior boundary for each implementation lane before editing code
- [ ] Write or select the minimal failing test/proof first
- [ ] Run the RED command and record evidence in the lane handoff
- [ ] Implement the smallest change that can satisfy the proof
- [ ] Run the GREEN command and record evidence in the lane handoff
- [ ] Record machine-readable proof with `node scripts/harness/plan-hub.mjs record-tdd`
- [ ] If TDD cannot honestly apply, record `not_applicable` or `proof_limit` with a concrete note in `status.json`

Note for rung 1: a seeding script changes no product behavior. If that holds when it is written,
record the lane `not_applicable` with a concrete note rather than inventing a test.

## Lane Checklists

### UI

- [ ] Rung 3 only: dev-mode worker registration in the client and admin entry points
- [ ] Prove it does not register in a production build
- [ ] Record RED/GREEN proof or a proof-limit note before marking the lane complete
- [ ] Write `handoffs/claude-ui.md`

### State / API

- [ ] Rungs 1 and 2, plus the dehydration prerequisite
- [ ] Keep hooks in shared; readers stay behind `demoAware`, guards stay intact
- [ ] Record RED/GREEN proof or a proof-limit note before marking the lane complete
- [ ] Write `handoffs/codex-state-api.md`

### Contracts

- [ ] Rung 4 only: pooling helpers in `tests/fixtures/contract-helpers.ts` and a `seed:pooling` caller
- [ ] Contracts wrappers only, never raw Forge
- [ ] Mark `n/a` in `status.json` if rung 4 is not taken
- [ ] Write `handoffs/codex-contracts.md`

### QA Pass 1

- [ ] Review the populated surfaces against `eval.md`
- [ ] Confirm nothing injected survives a flag flip or a reload
- [ ] Write `handoffs/claude-qa-pass-1.md`

### QA Pass 2

- [ ] Review regressions and implementation edges
- [ ] Confirm production builds fold every seam away
- [ ] Write `handoffs/codex-qa-pass-2.md`

## Validation

Choose per rung when it is promoted; run `bun run validation:plan -- --intent <intent>` and execute
the plan it renders. The Ship Gate below applies to any rung that touches product code.

- [ ] `bun format && bun lint`
- [ ] `bun run test`
- [ ] `VITE_CHAIN_ID=11155111 bun run build`
