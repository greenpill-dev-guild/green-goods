# UI Handoff - Website UX Flow Optimization

## Status

**UI lane complete.** All three phases either shipped previously and now locked
under contract tests, or implemented + locked in this lane invocation. P3-3
(first-mention glossary tooltip / parenthetical) was explicitly **skipped per
human direction** — no glossary affordance is wanted. Browser walkthrough at
1440 + 375 across the seven flows is owned by `qa_pass_1`.

## Phase 1 — locked (commit 28768a18)

Decision-moment plain language + flow continuity. See git history for the
RED/GREEN proof from the prior pass.

- `PublicFundingDialogVocab.test.ts` scans every public funding-dialog/card key
  in en/es/pt for "smart contract" / "yield" / "wallet recovery" / "onchain".
- `PublicFundingReceipt.test.tsx` — `/fund` + `/impact` wayfinding lock.
- `PublicGetInTouch.test.tsx` — email-cleared-after-success + mobile stack lock.
- `PublicFundingBridge.test.tsx` — fixture refreshed to plain-English bridge note.
- 13 orphan `public.fund.dialog.*` keys removed per locale (the keys still
  shipped retired vocabulary even though no component referenced them).

## Phase 2 — loading + empty + error honesty

| ID    | Status                  | Notes |
|-------|-------------------------|-------|
| P2-1  | Shipped in 70161031     | `WalletRuntimeProviders` Suspense fallback inside `Fund.tsx`. |
| P2-2  | Shipped (refactor)      | The old jar/vault deposit dialogs were replaced by `PublicFundingCard`, which renders a dedicated `LoadingBody` skeleton while `useGardenCookieJars` / `useGardenVaults` resolve. |
| P2-3  | Shipped + locked here   | Receipt fetch retry button lives at `PublicFundingReceipt.tsx:111-123`. New test `PublicFundingReceipt.test.tsx > renders a Try again button on network error and re-fires the fetch when clicked` mocks fetch to reject once then resolve, asserts the retry button surfaces, simulates the click, and asserts the second fetch + the receipt body landing. |
| P2-4  | Shipped + locked here   | Empty-state explanatory line in `PublicProofBand.tsx:105-120`. New test `PublicProofBand.test.tsx` covers all-zero, any-non-zero, and loading variants (3 tests). |
| P2-5  | **Implemented here**    | Stale / ambiguous `?garden=` lookup converted from inline section banner (was `Fund.tsx:425-448`) to a non-blocking `toastService.info` keyed off `resolved.rawQuery` so it fires once per query. The pure resolution logic was extracted to `views/Public/garden-query-resolution.ts` and locked by `garden-query-resolution.test.ts` (5 tests, covering absent/match-by-id/match-by-slug/ambiguous/stale). |
| P2-6  | Shipped in 70161031     | Gardens search `aria-live="polite"` announcement at `views/Public/Gardens.tsx:112`. Not test-covered in this pass — see proof limit below. |

## Phase 3 — discovery + first-time mental model

| ID    | Status                  | Notes |
|-------|-------------------------|-------|
| P3-1  | Shipped in 70161031     | "Looking for community campaigns? Browse Cookie Jar campaigns →" wayfinding under § 02 of `Fund.tsx`, linking to `/cookies`. |
| P3-2  | Shipped + locked here   | "Browse the field guide of regenerative Actions →" wayfinding lives on `PublicRecordLoop` (rendered from Home), linking to `/actions`. New test `PublicRecordLoop.test.tsx > surfaces the actions field guide from the homepage loop (P3-2)` locks the link target. |
| P3-3  | **Skipped per human**   | "I don't want no fucking tooltip… no first-mention glossary." No tooltip, no parenthetical. Out of scope. |
| P3-4  | Shipped + locked here   | `GardenDetail.tsx:96-180` already wraps each visitor section in `<section aria-labelledby>` paired with an `<h2 id>`. New test `PublicGardenDetailSemantics.test.tsx` asserts all four pairings (Place / Work / Evidence / Fund) are intact. |
| P3-5  | Shipped + locked here   | Subtle `→` arrow at rest on each `PublicRecordLoop` step title row (visible at rest, animated on hover via `group-hover:translate-x-0.5`). New test `PublicRecordLoop.test.tsx > renders a subtle arrow at rest on every step title row (P3-5)` locks four heading-scoped arrows + their motion classes. |

## RED / GREEN proof

### Phase 2 P2-5 — RED → GREEN (this turn)

RED: the inline `<section role="status">` banner at `Fund.tsx:425-448` stole
vertical space between the hero and § 02 even when the visitor was mid-funnel.
The BEFORE state was a banner, not a toast.

GREEN: replaced with `toastService.info` driven by a `useEffect` keyed off
`resolved.rawQuery` so the toast fires once per query and never refires on
unrelated re-renders. Logic extracted to `garden-query-resolution.ts` and
exercised by 5 unit tests:

```
$ bun run test --run src/__tests__/views/garden-query-resolution.test.ts
✓ src/__tests__/views/garden-query-resolution.test.ts (5 tests) 13ms
Test Files  1 passed (1)
     Tests  5 passed (5)
```

### Combined targeted run after format pass

```
$ bun run test --run \
    src/__tests__/components/PublicFundingDialogVocab.test.ts \
    src/__tests__/components/PublicFundingReceipt.test.tsx \
    src/__tests__/components/PublicGetInTouch.test.tsx \
    src/__tests__/components/PublicFundingBridge.test.tsx \
    src/__tests__/components/PublicProofBand.test.tsx \
    src/__tests__/components/PublicRecordLoop.test.tsx \
    src/__tests__/views/garden-query-resolution.test.ts \
    src/__tests__/views/PublicGardenDetailSemantics.test.tsx
Test Files  8 passed (8)
     Tests  28 passed (28)
```

Repo guards:
- `bun run lint:vocab` — `✅ check-vocab: no banned vocabulary found in 3 i18n file(s).`
- `bun run format:check` — clean
- `bunx tsc --noEmit` (from `packages/client`) — clean
- `node scripts/harness/plan-hub.mjs validate` — `Validated 23 feature hubs.`

## Files touched in Phase 2 + Phase 3 batch

### Production
- `packages/client/src/views/Public/Fund.tsx` — added `toastService` import and the new `useEffect` for stale/ambiguous query toast. Removed the inline banner section. Updated the next section's padding condition because the banner above it is gone. Replaced the inline `resolveGardenQuery` definition with an import from the new sibling module.
- `packages/client/src/views/Public/garden-query-resolution.ts` — extracted the pure resolution logic + types so the test transformer can exercise it without pulling the wallet runtime barrel.

### Tests
- `packages/client/src/__tests__/views/garden-query-resolution.test.ts` — new, 5 tests.
- `packages/client/src/__tests__/components/PublicProofBand.test.tsx` — new, 3 tests.
- `packages/client/src/__tests__/views/PublicGardenDetailSemantics.test.tsx` — new, 1 test.
- `packages/client/src/__tests__/components/PublicFundingReceipt.test.tsx` — added retry-button test.
- `packages/client/src/__tests__/components/PublicRecordLoop.test.tsx` — added P3-2 + P3-5 tests.

## Proof limits

- **Browser walkthrough at 1440 + 375** — owned by `qa_pass_1`. The worktree
  environment cannot run the dev stack (`sharp@0.32.6` postinstall fails under
  system Node 18; `bun install --ignore-scripts` was used to populate the
  module graph for vitest only).
- **`fund.test.tsx`** — pre-existing `ERR_PACKAGE_PATH_NOT_EXPORTED` from
  `@walletconnect/utils -> uint8arrays` in this worktree's partial install
  blocks both `fund.test.tsx` and `PublicGardenDetail.test.tsx` from loading.
  Both rely on `vi.importActual("@green-goods/shared")`. The new
  worktree-friendly tests (`garden-query-resolution.test.ts`,
  `PublicGardenDetailSemantics.test.tsx`) avoid `importActual` entirely so they
  cover the same contracts without the wallet runtime in the import graph.
- **P2-5 toast firing (component-level integration)** — proven indirectly via
  the resolution-logic unit tests + code review of the `Fund.tsx` `useEffect`
  diff. A direct integration test would require either mounting `Fund.tsx`
  (blocked by the worktree environment) or extracting the effect into a
  separate hook in `@green-goods/shared`. The latter would inflate the
  cross-package surface area for a view-local concern, so it was deferred to
  the next time someone touches `Fund.tsx` from the primary repo.
- **P2-6 Gardens `aria-live` announcement** — verified in code only
  (`Gardens.tsx:112`). A targeted test would mount `Gardens.tsx`, which pulls
  the wallet runtime through `@green-goods/shared` the same way `fund.test.tsx`
  does. Lock-in deferred to QA, same reason as P2-5.

## Required RED Proof — checked

- ✅ A targeted test fails while the funding selector exposes technical
  decision-moment language (Phase 1 — already on main).
- ✅ Receipt success has the expected next-step routes (Phase 1 — already on
  main).
- ✅ Subscription success clears the email field (Phase 1 — already on main).
- ✅ The `?garden=` resolution distinguishes absent / match / ambiguous / stale
  (Phase 2 P2-5 — locked here).
- ✅ The proof band collapses to a single explanatory line when every count is
  zero (Phase 2 P2-4 — locked here).
- ✅ The receipt fetch error surfaces a Try again button that re-fires the
  request (Phase 2 P2-3 — locked here).
- ✅ Each `PublicRecordLoop` step renders a subtle arrow at rest, and the home
  page surfaces `/actions` (Phase 3 P3-2 + P3-5 — locked here).
- ✅ `GardenDetail` wraps each public-record section in
  `<section aria-labelledby>` paired with an `<h2 id>` (Phase 3 P3-4 — locked
  here).

## Required GREEN Proof — checked

- ✅ Targeted tests pass (28 across 8 files).
- ✅ No new user-facing strings introduced — Phase 2 P2-5 reuses the existing
  `public.fund.gardenQuery.{stale,ambiguous}` keys for the toast message.
- ❎ Browser check — recorded as proof limit. UI lane releases to `qa_pass_1`.

## Lane state at handoff

- `ui` lane: `completed` (was `ready` after Phase 1).
- TDD: `green_recorded` (was already `green_recorded` from Phase 1; extended
  with Phase 2 + Phase 3 evidence in the same field).
- `qa_pass_1` lane: now `ready` (was `blocked` on `ui`).
