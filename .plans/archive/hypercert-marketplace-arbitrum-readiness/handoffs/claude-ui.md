# UI Lane Handoff

**Actual branch**: `main` per operator instruction to stay on main.
**Planned branch**: `claude/ui/hypercert-marketplace-arbitrum-readiness`
**Status**: completed.
**Date**: 2026-05-10

## Scope Completed

- Extended `MarketplaceApprovalGate` (`packages/admin/src/components/Hypercerts/MarketplaceApprovalGate.tsx`) to consume `getMarketplaceReadiness(chainId)` from `@green-goods/shared` before reading any approval state.
- The gate now covers the full state matrix without duplicating readiness logic in admin/client:
  - **unavailable**: short-circuits to a shared `Alert` (variant `warning`) listing the missing deployment-artifact addresses; `useMarketplaceApprovals` is never invoked, so no read/write helper touches zero-address contracts. Children are not rendered, hiding the listing CTA.
  - **checking**: spinner row with localized "Checking marketplace approvals..." message while the approvals query loads.
  - **needs-approval**: existing two-step approval card (grant exchange + approve transfer manager).
  - **ready**: children render; in the Hypercert detail surface that surfaces the *List for Yield* CTA and active listing summary.
  - **pending**: approval CTA shows "Approving..." with the button disabled while the grant mutation is in flight.
  - **failure**: approval mutation error is surfaced inline, CTA stays available for retry.
- Restructured `MarketplaceSection` inside `packages/admin/src/views/Garden/HypercertDetail.tsx` so the *List for Yield* button now renders inside the gate. When readiness is unavailable or approvals are missing the listing dialog cannot be opened from the admin surface, providing defense-in-depth on top of the shared `assertMarketplaceReady` guard inside `useCreateListing`.
- Removed the duplicate `RiExchangeDollarLine` CTA above the gate; the gate-internal CTA preserves the same icon/leading visual but now lives next to the "Not listed" body line so the operator can scan listing state and action together.
- Added i18n strings to `en`, `es`, and `pt` for the unavailable state (title, description, missing-addresses caption). No new approval/listing strings were required.
- Updated `MarketplaceApprovalGate.stories.tsx` with a new `Unavailable` story (`chainId: 11155111`) plus default `chainId` arg. Existing stories (`NeedsBoth`, `NeedsMinterOnly`, `FullyApproved`, `Loading`) still cover the post-readiness state matrix.
- Did not modify shared marketplace hooks, modules, contracts, deployment artifacts, indexer config, or broadcast scripts. Did not modify the public Hypercert browsing surface; only the admin operator cockpit changed.

## Files Touched

- `packages/admin/src/components/Hypercerts/MarketplaceApprovalGate.tsx`
- `packages/admin/src/components/Hypercerts/MarketplaceApprovalGate.stories.tsx`
- `packages/admin/src/views/Garden/HypercertDetail.tsx`
- `packages/admin/src/__tests__/components/hypercerts/MarketplaceApprovalGate.test.tsx` (new)
- `packages/shared/src/i18n/en.json`
- `packages/shared/src/i18n/es.json`
- `packages/shared/src/i18n/pt.json`

## State Matrix Coverage

| State | Test | Story | Source of truth |
|---|---|---|---|
| unavailable | `state: unavailable > renders an unavailable alert and does NOT render children or approval CTA` | `Unavailable` | `getMarketplaceReadiness(chainId)` |
| unavailable (no approval reads) | `state: unavailable > never calls useMarketplaceApprovals when readiness is unavailable` | n/a | Gate split — `ApprovalGateInner` never mounts |
| checking | `state: checking > renders a loading state when readiness is available but approvals query is loading` | `Loading` | `useMarketplaceApprovals().isLoading` |
| needs-approval | `state: needs-approval > renders the approval CTA and does NOT render children` | `NeedsBoth`, `NeedsMinterOnly` | `useMarketplaceApprovals().isFullyApproved` |
| needs-approval (action) | `state: needs-approval > invokes grantApprovals when the operator confirms the approval CTA` | n/a | `useMarketplaceApprovals().grantApprovals` |
| ready | `state: ready > renders children when readiness is available and both approvals are granted` | `FullyApproved` | `useMarketplaceApprovals().isFullyApproved` |
| pending | `state: pending > renders the approving state with disabled CTA while grantApprovals is in flight` | n/a (mutation-time) | `useMarketplaceApprovals().isGranting` |
| failure | `state: failure > renders the approval mutation error and keeps the CTA available so the operator can retry` | n/a (mutation-time) | `useMarketplaceApprovals().error` |

The listing-dialog mutation state matrix (building / signing / registering / confirming / done / error) is covered by the pre-existing `CreateListingDialog.test.tsx` and the `Steps/MintProgress` Storybook entries referenced from the listing dialog's docs description. The shared `useCreateListing` already calls `assertMarketplaceReady(chainId)` before signing or writing — confirmed in `packages/shared/src/hooks/hypercerts/useCreateListing.ts:63`.

## TDD Proof

### RED

Command:

```bash
cd packages/admin
bun run test src/__tests__/components/hypercerts/MarketplaceApprovalGate.test.tsx
```

Result before implementation: 2 failures, 6 passes (8 total). The failures proved that the original `MarketplaceApprovalGate` did not consult readiness and unconditionally invoked `useMarketplaceApprovals`, even when the active chain's deployment artifact was missing required marketplace addresses.

Specific failing assertions:

- `state: unavailable > renders an unavailable alert and does NOT render children or approval CTA when readiness is unavailable` — expected `getMarketplaceReadiness` to be called with `11155111`, got zero calls.
- `state: unavailable > never calls useMarketplaceApprovals when readiness is unavailable (no unsafe approval reads)` — expected zero calls, got one.

### GREEN

Commands:

```bash
cd packages/admin
bun run test src/__tests__/components/hypercerts/MarketplaceApprovalGate.test.tsx
bun run test src/__tests__/components/hypercerts/
```

Results after implementation:

- `MarketplaceApprovalGate.test.tsx`: 8 tests passed.
- `__tests__/components/hypercerts/`: 7 files, 153 tests passed (no regression in `CreateListingDialog.test.tsx`, `HypercertPreview.test.tsx`, `DistributionConfig.test.tsx`, `MetadataEditor.test.tsx`, `MintProgress.test.tsx`, `AttestationSelector.test.tsx`).

Additional validation:

```bash
cd packages/shared
bun run test src/__tests__/i18n/locale-coverage.test.ts
```

Result: 12 tests passed — every new id (`app.marketplace.unavailable.title`, `app.marketplace.unavailable.description`, `app.marketplace.unavailable.missingFields`) is present in en/es/pt.

```bash
bun run lint:vocab
```

Result: `check-vocab: no banned vocabulary found in 3 i18n file(s).`

```bash
bun run --filter @green-goods/shared check:stories
```

Result: `PASS: Required Storybook contract is satisfied.`

```bash
cd packages/admin && VITE_CHAIN_ID=11155111 bun run build
```

Result: `✓ built in 2m 6s`. Same bundle-size warning as baseline (`index-CUEzCr5l.js > 2000 kB`) — unchanged by this lane.

```bash
node scripts/harness/plan-hub.mjs validate
```

Result: `Validated 20 feature hubs.`

## Browser / Visual Proof

Storybook stories cover the visual states. The `Unavailable` story renders against Sepolia (`chainId: 11155111`), where the deployment artifact intentionally omits `hypercertExchange`, `hypercertMinter`, `transferManager`, and `strategyHypercertFractionOffer`, producing the unavailable alert with the four missing-field caption. `NeedsBoth`, `NeedsMinterOnly`, `FullyApproved`, and `Loading` continue to render the post-readiness approval and ready states. No live Arbitrum browser walkthrough was required because the unavailable state could not have been reproduced in a browser without redeploying to a chain that lacks marketplace artifacts.

## Proof Limits

- The `pending` and `failure` states of the approval mutation are exercised in the React tree via mocked `useMarketplaceApprovals` return values; the underlying `grantApprovals` mutation is not run against a live wallet. The shared lane already proved the mutation invalidation semantics in `useMarketplaceApprovals.test.ts`.
- The `building → signing → registering → confirming → done → error` listing-dialog progression remains covered by the existing `CreateListingDialog.test.tsx` and the shared `useCreateListing` tests; no new dialog tests were added because the UI lane did not change the dialog's own state machine — only the gating before it.
- `bun run check:design-tokens` and `bun run check:design-generated` currently fail on pre-existing client-side drift (`packages/client/vite/social-preview.ts` hex values; `docs/docs/builders/packages/client-pwa-token-audit.generated.md` stale snapshot). Neither file was touched by this lane; flagged here per the instructions to surface unrelated dirty state instead of "fixing" it.

## Remaining Blockers

None for the UI lane. `qa_pass_1` is unblocked; `qa_pass_2` stays blocked until `qa_pass_1` completes.
