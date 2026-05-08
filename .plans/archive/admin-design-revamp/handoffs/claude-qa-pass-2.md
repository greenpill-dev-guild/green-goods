# Admin Design Revamp — qa_pass_2 Handoff

**Feature**: `admin-design-revamp`
**Lane**: `qa_pass_2`
**Owner**: `claude` (lane is canonically owned by `codex`; user redirected this pass to claude on `main` for continuity)
**Status**: `pass` — committed cleanup A1–A6 confirmed regression-free; B1–B3 deferral now durable in backlog.
**Branch**: working session on `main` (release/1.1.0 already merged via `8ae54755`; backlog plans + this handoff committed on `main`)
**Depends on**: `qa_pass_1` (provisional pass)

## Verdict

**Pass.** No new regressions from cleanup A1–A6 across full admin and shared test suites; design-token + vocab validators clean; admin production build (Sepolia) clean. The pre-merge action items from qa_pass_1 are resolved as follows:

| Pre-merge action (from qa_pass_1) | Resolution this pass |
|---|---|
| 1. Concurrent agent's `useState` import drift in `GardenWorkspaceContent.tsx` | **Surfaced** in qa_pass_1 handoff, reproduced live, and live-confirmed that re-adding `useState` to the import line resolves the runtime crash on `/garden/members`. **Not committed from this pass** — system denied staging the concurrent agent's WIP under this session, so the fix is left to that agent or a follow-up commit. The QA pass 2 verdict is contingent on the concurrent agent landing the lift cleanly before merge. |
| 2. File backlog plans for B1–B3 | **Done.** Three new backlog plans scaffolded and briefed: `.plans/backlog/conviction-pool-config-onchain/`, `.plans/backlog/conviction-supporter-count-indexer/`, `.plans/backlog/conviction-threshold-formula-port/`. plan-hub validate confirms 23 feature hubs (was 20). |

## Validation evidence

### plan-hub
- `node scripts/harness/plan-hub.mjs validate` → `Validated 23 feature hubs.` ✅

### Tests (regression scan)
- `bun run --filter @green-goods/shared test` → 245 files / 3000 passed / 1 failed / 1 skipped. The single failure is `src/__tests__/components/BottomSheet.test.tsx > BottomSheet > has the shared xl radius for top edge rounding` — the test asserts `rounded-t-xl` but the component uses `glass-floating` since commit `5827ac62 feat(shared): glass-floating workspace chrome for SideSheet and BottomSheet`. Pre-existing, predates cleanup A1–A6 by multiple commits, unrelated to the cleanup surfaces. **Not a regression from cleanup.**
- `bun run --filter @green-goods/admin test` → 46 files / 407 passed / 3 skipped / 0 failed. ✅
- Cleanup-targeted re-run: `cd packages/shared && bun run test -- src/__tests__/hooks/admin-ui/fab-config.test.ts src/__tests__/hooks/admin-ui/header-stats.test.ts src/__tests__/utils/conviction/ src/__tests__/hooks/conviction/useConvictionWeightAllocator.test.tsx` → 5 files / 88 passed / 0 failed. ✅
- `cd packages/admin && bun run test -- src/__tests__/components/Garden/memberRoles.test.ts` → 9 passed / 0 failed. ✅

### Lint
- `bun run --filter @green-goods/shared lint` → 5 warnings, 0 errors. ✅
- `bun run --filter @green-goods/admin lint` → 14 warnings + 1 error, **all in unrelated story files** (`AdminTabRail.stories`, `AdminDialog.stories`, `CanvasIndexerErrorState.stories`, `AccountProfilePanel.stories`, `UserAvatar.stories`, `UserMenu.stories`, `storybookCanvasHarness.tsx`). Pre-existing. None on cleanup-touched surfaces.

### Build
- `VITE_CHAIN_ID=11155111 bun run --filter @green-goods/admin build` → built in 19.72s. Largest chunk warning is informational (8054 kB main bundle). ✅
- `bun run --filter @green-goods/shared build` → "no build needed" (source-only package). ✅

### Type check
- `APP_ENV=production bunx tsc --noEmit -p packages/admin/tsconfig.json` → exit 0. ✅

### Design-system validators
- `bun run check:design-tokens` → all 6 design-token guards pass; runtime tokens, DesignMD radius outputs, admin M3 vars, no raw cubic-bezier/duration/color/radius literals, glass/blur/gradient confined to admin shell CSS, token_version 2.3.0 coupled across skill + ui + registry. ✅
- `bun run lint:vocab` → 0 banned-vocabulary hits. ✅

### Format check
- `bun run format:check` → 6 pre-existing errors in plan-hub-touched `status.json` files (`.plans/active/client-pwa-audit/`, `.plans/active/css-maintainability-polish/`, `.plans/active/docs-freshness-routine/`, `.plans/archive/client-pwa-gardener-audit/`, `.plans/archive/signal-pool-yield-wiring/`, `.plans/backlog/yield-split-ui/`) — biome wants inline arrays where plan-hub writes multi-line. Not introduced by this pass. My three new backlog `status.json` files were auto-formatted clean (`bunx @biomejs/biome format --write .plans/backlog/conviction-*/status.json`).

## Plan completeness audit

### Completed lanes (verified in this pass)

- `tier_0_audit` → `completed` (commit `c228fa12`)
- `tier_1_tokens` → `completed` (commit `c228fa12`)
- `tier_2_atoms` → `completed` (commit `bfa0d28b`)
- `tier_3_organisms` → `completed` (commit `822499d1`)
- `tier_4_screens` → `completed` (commit `48d09470`)
- `tier_5_wiring` → `completed` (commits `1b054239` + `a8586c26`)
- `ui` → `completed` (proof-limit, build evidence on plan.todo.md)
- `state_api` → `completed` (proof-limit; targeted vitest landed in cleanup A1–A3)
- `contracts` → `n/a` (no contract lane)
- `cleanup` → `mostly_landed`, ready to flip to `completed` (A1–A6 landed, B1–B3 deferral now durable in backlog, C1 deferred per scope)
- `qa_pass_1` → `in_progress` (provisional pass), ready to flip to `completed`
- `qa_pass_2` → flips to `completed` after this handoff lands

### Open follow-ups (not blocking the admin-design-revamp plan close-out)

- **Concurrent-agent WIP in `GardenWorkspaceContent.tsx` + `GardenDetailHelpers.tsx`** — coherent state-lift refactor (lifts `domainModalOpen` from local component into `useGardenWorkspaceController` and simplifies `<GardenDomainSummaryRow>` to one prop) but missing one line: `import { useMemo, useState } from "react";` in `GardenWorkspaceContent.tsx`. Without that line, `/garden/members` crashes at runtime. The committed code at HEAD (i.e. the cleanup commits) is correct; only the working-tree drift is broken. The concurrent agent must land the lift as a coherent commit. Resolution path: (a) the concurrent agent commits the import + the lift + the `GardenDomainSummaryRow` simplification together; or (b) the concurrent agent reverts the lift to HEAD and re-attempts in a separate plan.
- **A4 test-coverage P3** (from qa_pass_1): `fab-config.test.ts` pins deprecated `buildXFabConfig` builders that have no view consumers; the runtime FAB uses `buildXViewActions`. Recommend either deleting the deprecated builders + tests or extending tests to cover the runtime path. Not release-blocking.
- **C1 client-homepage failures** (21 cases anchored at commit `0b4a67e8`): out of scope for `admin-design-revamp` — file `/audit-then-ship --lens=review --no-ship` against `0b4a67e8` per `eval.md`.
- **Pre-existing `BottomSheet.test.tsx` failure**: tracked here for awareness — should be filed against commit `5827ac62 feat(shared): glass-floating workspace chrome for SideSheet and BottomSheet`. Owner of that PR should update the test assertion from `rounded-t-xl` to whatever the new floating-glass class is, or the test should drop the radius assertion if `glass-floating` already implies it.

## Files committed in this pass

- `.plans/backlog/conviction-pool-config-onchain/` (scaffolded + brief)
- `.plans/backlog/conviction-supporter-count-indexer/` (scaffolded + brief)
- `.plans/backlog/conviction-threshold-formula-port/` (scaffolded + brief)
- `.plans/active/admin-design-revamp/handoffs/claude-qa-pass-2.md` (this file)
- `.plans/active/admin-design-revamp/status.json` (lane status flips)

## Lane status updates this pass

- `cleanup` → `completed` (A1–A6 landed + B1–B3 backlog plans now filed; C1 deferred per scope)
- `qa_pass_1` → `completed` (verdict in `handoffs/claude-qa-pass-1.md`; pre-merge actions either resolved or surfaced for the concurrent agent)
- `qa_pass_2` → `completed` (verdict in this handoff)
- `overall_status` → `closing` (only the concurrent-agent drift remains, and that's outside the cleanup scope)
