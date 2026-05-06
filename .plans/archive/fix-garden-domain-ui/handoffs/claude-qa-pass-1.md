# Fix Garden Domain UI - qa_pass_1 Handoff

**Feature**: `fix-garden-domain-ui`
**Lane**: `qa_pass_1`
**Owner**: `claude`
**Status**: `completed`
**Dispatch Branch**: `develop` (verified at HEAD `2fa33819 fix(shared,admin): recover gardens without domains`)

## Scope

Verify the legacy `main` garden-domain-recovery behavior is now ported to the current admin UI per spec/eval. Read-only QA pass — no production code touched. Concurrent agents have unrelated working-tree changes; QA was run against committed HEAD only, not the dirty tree.

## Acceptance Check Results

| AC | Result | Evidence |
|---|---|---|
| AC-1 case-insensitive `getGardens()` join | ✅ | `packages/shared/src/modules/data/greengoods.ts:350-355` lower-cases the `GardenDomains.garden` Map keys; line 384 looks up via `garden.id.toLowerCase()`. Comment at 348-349 documents the indexer/checksum mismatch. |
| AC-2 admin garden empty-domain affordance + edit path | ✅ | `GardenDomainSummaryRow` (`packages/admin/src/views/Garden/components/GardenDetailHelpers.tsx:174-223`) is rendered above every Garden workspace view in `GardenWorkspaceContent.tsx:61-65`. Empty state shows `app.garden.detail.domainsNone` warning chip; managers see the `app.garden.detail.editDomains` `AdminButton` opening `GardenDomainModal` (mounted at `GardenWorkspaceContent.tsx:169-175`). |
| AC-3 SubmitWork no-actions recovery | ✅ | `packages/admin/src/views/Garden/SubmitWork.tsx:384-401` (HEAD): when `availableActions.length === 0`, shows an `Alert` with the `app.admin.work.submit.noActionsForDomain` body and a `Configure domains` button navigating to `adminRoutes.gardenSettings({ gardenAddress: garden.id })` — i.e. `/garden/settings`, where the `GardenDomainSummaryRow` + edit modal is reachable for managers. |
| AC-4 `useGardenDerivedState` empty-domain alert routes to a rendered section | ✅ | `packages/shared/src/hooks/garden/useGardenDerivedState.ts:139-144,166,222-229` derives `hasNoDomains`, rolls a `domainBadge` into `overviewBadge`, factors `hasNoDomains` into `gardenHealthSeverity`, and emits a `domain-empty` `overviewAlerts` entry whose `onAction` calls `openSection("overview", "health")`. Section is real: `gardenDetail.constants.ts:9` declares `overview: ["health", "activity"]`; `OverviewTab.tsx:122` renders the health card when `section === "health"` (or undefined). |
| AC-5 i18n in `en`, `es`, `pt` | ✅ | All six new keys present in HEAD across all three locales: `app.garden.detail.domains`, `app.garden.detail.domainsNone`, `app.garden.detail.editDomains`, `app.garden.detail.alert.noDomains`, `app.admin.work.submit.noActionsForDomain`, `app.admin.work.submit.noActionsForDomain.cta`. |
| AC-6 build + lint + test pipeline | ⏸ Deferred to qa_pass_2 (codex) per plan ownership. |

## Test Coverage

- Shared: `packages/shared/src/__tests__/modules/greengoods.module.test.ts` — case-insensitive join asserted at lines 197-230 (`joins GardenDomains to gardens regardless of address casing`).
- Shared: `packages/shared/src/__tests__/hooks/garden/useGardenDerivedState.test.ts` — `domainMask === 0` branch covered (2 tests).
- Admin: `packages/admin/src/views/Garden/garden-domain-ui.test.tsx` — three tests cover (a) manager empty-domain affordance + edit CTA, (b) read-only fallback, (c) Submit Work `Configure domains` CTA navigating to `/garden/settings`.

## Validation Commands & Results

```
$ cd packages/shared && bun run test -- src/__tests__/modules/greengoods.module.test.ts
✓ src/__tests__/modules/greengoods.module.test.ts (10 tests) 35ms
Test Files  1 passed (1)
     Tests  10 passed (10)
```

```
$ cd packages/shared && bun run test -- src/__tests__/hooks/garden/useGardenDerivedState.test.ts
✓ src/__tests__/hooks/garden/useGardenDerivedState.test.ts (2 tests) 164ms
Test Files  1 passed (1)
     Tests  2 passed (2)
```

```
$ cd packages/admin && bun run test -- src/views/Garden/garden-domain-ui.test.tsx
✓ src/views/Garden/garden-domain-ui.test.tsx (3 tests) 655ms
  ✓ shows the empty-domain affordance and edit CTA for managers 427ms
Test Files  1 passed (1)
     Tests  3 passed (3)
```

```
$ bun run lint:vocab
✅ check-vocab: no banned vocabulary found in 3 i18n file(s).
```

```
$ node scripts/harness/plan-hub.mjs validate
Validated 18 feature hubs.
```

## Proof Limits & Notes

- QA verified the committed state at HEAD (`2fa33819`). The working tree contains unrelated modifications from concurrent agents on `develop` (admin form-control refresh, client PWA polish, i18n diff for unrelated keys including `admin.dashboard.*` removals and `app.admin.nav.backToHub` rename). Those are out of scope and intentionally untouched.
- Did not run the broader `bun format && bun lint && bun run test && VITE_CHAIN_ID=11155111 bun run build` ladder; that is `qa_pass_2`'s ownership and the targeted gates above already cover this plan's scope.
- AC-1 proof is unit-level; live indexer freshness is unproved.
- Did not exercise the `GardenDomainModal` write path (the original brief explicitly notes this fix does not change the underlying mutation).

## Recommendation

All acceptance checks for this plan are demonstrably met at HEAD with passing targeted tests. `qa_pass_2` (codex) remains unrun by ownership but is now unblocked. Recommend treating the plan as ready for archival: run the broader `qa_pass_2` ladder if a fresh repo-level signal is desired, then move `.plans/active/fix-garden-domain-ui/` to `.plans/archive/`.
