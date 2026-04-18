# Autonomy Harness Rollout Plan

**Feature Slug**: `autonomy-harness-rollout`
**Stage**: `active`
**Status**: `ACTIVE`
**Created**: `2026-04-18`
**Last Updated**: `2026-04-18`
**Source Research**: `.plans/ideas/autonomous-harness-map-2026-04-18.md`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | The active hub is the live queue; the idea doc remains the research map | Avoids losing the deep-dive context while giving automations a valid plan-hub surface |
| 2 | Existing five plan-hub lanes remain authoritative | Matches the rollout control-surface rule; `D.*` and `T.*` stay loop families, not schema changes |
| 3 | `state_api` owns Tier 0 unblockers and Loop A execution for now | Current work is code-side harness, docs, tests, and cleanup, not design-lane work |
| 4 | `contracts` is `n/a` in this phase | No Solidity or deployment surface is required for the current unblockers |
| 5 | Full legacy views require parity review before deletion | Route-unreachability alone was not enough for `GreenWillPanel.tsx` and is not enough for `Assessment.tsx` |

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Fix `plan-hub` validator / handoff issue | `state_api` | Step 1 | ✅ |
| Backfill minimum handoff data | `state_api` | Step 1 | ✅ |
| Reconcile docs + CI truth for agent surfaces / eval workflow | `state_api` | Step 2 | ✅ |
| Govern or unskip the GreenWill skipped tests | `state_api` | Step 3 | ✅ |
| Clear failing baseline tests or de-brittle them | `state_api` | Step 4 | ✅ |
| Refresh `.plans/clean/` baseline and re-verify the silent-failure mutation bugs | `state_api` | Step 5 | ✅ |
| Adopt the inner-loop testing policy in repo truth | `state_api` | Step 6 | ✅ |
| Define memory policy with `.plans/` as repo truth | `state_api` | Step 7 | ✅ |
| Run first cleanup loop with explicit keep/revert discipline | `state_api` | Step 8 | 🟡 |
| Design specialist rollout stays deferred in this phase | `ui` | Step 9 | ⏸ |

## Current Snapshot

### Tier 0

- Complete: `0.1` through `0.8`

### Loop A

- Completed safe dead-infrastructure deletions:
  - `packages/admin/src/components/Action/index.ts`
  - `packages/admin/src/components/Assessment/index.ts`
  - `packages/admin/src/components/Hypercerts/index.ts`
  - `packages/admin/src/components/TrendIndicator.tsx`
  - `packages/admin/src/components/Vault/assetTotals.ts`
- Restored dormant legacy surface:
  - `packages/admin/src/views/Actions/GreenWillPanel.tsx`
- Paused from deletion pending parity review:
  - `packages/admin/src/views/Garden/Assessment.tsx`
- Completed bounded shared cleanup:
  - removed deprecated `packages/shared/src/utils/query-invalidation.ts`
  - rewired shared invalidation type exports to `packages/shared/src/config/query-keys/schedule.ts`
  - updated `packages/shared/src/MODULES.md` to match the live module layout
- Recorded stale cleanup classifications and open mutation bugs in:
  - `.plans/active/autonomy-harness-rollout/reports/2026-04-18-baseline-refresh.md`
- Codified control-surface policy in repo truth:
  - `.plans/README.md`
  - `.plans/_templates/feature/status.json`
  - `docs/docs/builders/agentic/context-engineering.mdx`

### Loop B

- Closed verified silent-failure mutation loops on:
  - `packages/admin/src/components/Hypercerts/CreateListingDialog.tsx`
  - `packages/shared/src/providers/Work.tsx`
  - `packages/shared/src/providers/JobQueue.tsx`
- Remaining verified silent-failure sites:
  - none
- Closed the client full-suite exit blocker by:
  - aliasing `@ethereum-attestation-service/eas-sdk` to the shared test mock in `packages/client/vitest.config.ts`
  - replacing the mock-heavy `packages/client/src/__tests__/components/Cards.test.tsx` omnibus with behavior-based `ActionCard`, `GardenCard`, and `WorkCard` tests
- Current narrowed harness blocker:
  - `node scripts/ci-local.js --quick` now uses `packages/admin` `bun run test:hub`, clears shared, client, admin, and agent tests, and no longer stalls in the admin legacy suite
  - the current repo-quick failure is unrelated format drift in `.plans/backlog/harness-hardening-wave-1/status.json`
  - `packages/admin` full-suite `bun run test` still hangs after visible suite progress, so the legacy view-heavy surface remains a separate hardening target instead of the inner-loop gate

## Implementation Steps

### Step 1: Control-surface repair

- [x] Fix `scripts/plan-hub.mjs` validator crash
- [x] Backfill handoff data in the existing active hub that was breaking validation
- [x] Re-run `node scripts/plan-hub.mjs validate`

### Step 2: Docs + CI truth pass

- [x] Align agent/eval docs with the current repo surfaces
- [x] Update eval workflow copy / truth surfaces

### Step 3: Test-governance cleanup

- [x] Govern or unskip the GreenWill skipped-test surfaces
- [x] Restore the GreenWill contract surface needed by shared hooks/tests

### Step 4: Baseline test cleanup

- [x] Fix `springConfig.test.ts`
- [x] Fix `CanvasLayout.test.tsx`
- [x] Fix `workspace-state.test.tsx`
- [x] Fix `fund.test.tsx`

### Step 5: Refresh the cleanup / bug baseline

- [x] Compare existing `.plans/clean/` findings against the current branch tip
- [x] Re-verify the three silent-failure mutation bugs called out by the research map
- [x] Record any closed / stale findings back into the live hub

### Step 6: Codify the inner-loop testing policy

- [x] Update the active hub and adjacent repo-truth docs so targeted `bun run test -- <file>` or `bun run test` is the fast iterative gate
- [x] Keep coverage as scheduled / pre-merge evidence rather than the per-change default

### Step 7: Memory policy

- [x] Record that `.plans/` is repo truth
- [x] Keep any `.claude/agent-memory` usage environment-local until freshness / ownership rules exist

### Step 8: Resume Loop A with the stricter deletion rule

- [ ] Continue dead-infrastructure cleanup on bounded surfaces
- [ ] Require route + parity review before deleting any unrouted full view

### Step 9: Defer design specialist rollout

- [ ] Choose one pilot surface only after Tier 0 / Loop A reaches a stable checkpoint
- [ ] Decide whether Chromatic / D.6 remains blocked or gets a dedicated small plan

## Lane Checklists

### UI (`claude/ui/autonomy-harness-rollout`) — blocked

- [ ] Choose the first pilot surface (`/hub` or a single Hub subview recommended by the research map)
- [ ] Keep D.1-D.6 specialist rollout out of scope until the checkpoint above exists
- [ ] Review full-view parity before any UI-facing cleanup removal

### State / API (`codex/state-api/autonomy-harness-rollout`) — in progress

- [x] Control-surface and docs truth repaired
- [x] Baseline test failures cleared
- [x] Safe dead-infrastructure cleanup started
- [x] Refresh the cleanup / mutation-bug baseline
- [x] Write the memory-policy note and inner-loop policy note

### Contracts (`codex/contracts/autonomy-harness-rollout`) — n/a for current phase

- [x] No active Solidity scope required
- [ ] Re-open only if a later bug / cleanup loop touches contract artifacts directly

### QA Pass 1 (`claude/qa-pass-1/autonomy-harness-rollout`) — blocked

- [ ] Start after the state lane stabilizes the remaining Tier 0 partials
- [ ] Review parity for any dormant / unrouted admin view before deletion
- [ ] Confirm the active hub status matches repo reality

### QA Pass 2 (`codex/qa-pass-2/autonomy-harness-rollout`) — blocked

- [ ] Start only after `qa_pass_1`
- [ ] Re-run targeted validations and confirm blocker list is still tight
- [ ] Close the loop on any remaining false-positive test or env-gated validation claims

## Latest Evidence

- [x] `node scripts/plan-hub.mjs validate`
- [x] `bash scripts/check-test-quality.sh`
- [x] targeted `bun run test -- <file>` across the repaired shared / admin / client baselines
- [x] `bunx tsc --noEmit -p packages/admin/tsconfig.json` after restoring `GreenWillPanel.tsx`
- [x] `bun run test -- src/__tests__/components/hypercerts/CreateListingDialog.test.tsx`
- [x] `bunx tsc --noEmit -p packages/admin/tsconfig.json` after fixing `CreateListingDialog.tsx`
- [x] `bun run test -- src/__tests__/providers/WorkProvider.test.tsx`
- [x] `bun run typecheck` in `packages/shared` after fixing `Work.tsx`
- [x] `bun run test -- src/__tests__/providers/JobQueueProvider.test.tsx`
- [x] `bun run typecheck` in `packages/shared` after fixing `JobQueue.tsx`
- [x] `bun run typecheck` in `packages/shared` after removing `utils/query-invalidation.ts`
- [x] `bun run test -- src/__tests__/components/ActionCard.test.tsx src/__tests__/components/GardenCard.test.tsx src/__tests__/components/WorkCard.test.tsx` in `packages/client`
- [x] `bun run test` in `packages/client` now exits cleanly (`45` files, `293` tests)
- [x] policy codified in `.plans/README.md`, template status notes, and context-engineering docs
- [x] `bun run test:hub` in `packages/admin` exits cleanly (`8` files, `54` tests)
- [x] `node scripts/ci-local.js --quick` now clears lint, typecheck, shared tests, client tests, admin hub tests, and agent tests; the remaining failure is the pre-existing format drift in `.plans/backlog/harness-hardening-wave-1/status.json`
- [ ] `packages/admin` full-suite `bun run test` still hangs after visible suite progress in the legacy suite, and isolated repro runs still leave the child Vitest node idle in `uv__io_poll` with open `KQUEUE` handles
- [ ] `bun run build` on `packages/admin` remains env-gated by `varlock` / 1Password secrets and is a known blocker, not a claimed pass
