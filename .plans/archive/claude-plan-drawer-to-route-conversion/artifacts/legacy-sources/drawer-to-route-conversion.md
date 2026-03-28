# Plan: Convert Client Drawers to Route-Based Views

**Status**: Not started
**Created**: 2026-03-08
**Goal**: Standardize all content-heavy drawers to use the full-page route pattern (matching GardenWork), improving animation consistency, deep link support, and native mobile feel.

## Context

The client has two drawer patterns:
1. **Full-page route view** (Work, Assessment) — `<article>` + `<TopNav>` + `page-transition-enter` animation
2. **ModalDrawer bottom sheet** (Treasury, Conviction, Wallet, Filters) — Radix Dialog at 95vh

Content-heavy interactive screens should be route views. Ephemeral panels (filters, notifications) stay as ModalDrawer.

## New Routes

| Current Drawer | New Route | Parent | Status |
|---|---|---|---|
| `EndowmentDrawer` (Treasury) | `/home/:id/treasury` | Garden `:id` child | [ ] |
| `ConvictionDrawer` (Governance) | `/home/:id/governance` | Garden `:id` child | [ ] |
| `WalletDrawer` | `/wallet` | AppShell sibling | [ ] |
| `GardensFilterDrawer` | **Keep as ModalDrawer** | N/A | N/A |

## Reference Pattern

Follow `packages/client/src/views/Home/Garden/Work.tsx`:
- `<article>` wrapper
- `<TopNav onBackClick={handleBack} overlay />`
- `<div className="padded pt-20">` for content
- Data from `useParams()` + `useGardens()` (no prop drilling)
- `useScrollToTop()` on mount
- `useNavigateToTop()` for back navigation (passes `viewTransition: true`)

## Phase 1: Treasury (EndowmentDrawer → route view)

### Step 1: Create Treasury view
- [ ] Create `packages/client/src/views/Home/Garden/Treasury.tsx`
- Export `GardenTreasury` component
- Structure: `<article>` > `<TopNav onBackClick={handleBack} overlay />` > `<div className="padded pt-20">`
- Get gardenId from `useParams().id`, garden from `useGardens()`
- Use `StandardTabs` for treasury / cookie-jar tabs (local `useState`)
- Import existing `TreasuryTabContent` from `@/components/Dialogs/TreasuryTabContent` and `CookieJarTabContent` from `@/components/Dialogs/CookieJarTabContent`
- Replace `enabled: isOpen` with `enabled: true` (route mounting handles lifecycle)
- Back button: `navigateToTop(`/home/${gardenId}`)`

### Step 2: Add route
- [ ] Update `packages/client/src/router.tsx`
- Add `{ path: "treasury", lazy: ... }` as child of garden `:id` route

### Step 3: Update Garden view
- [ ] Update `packages/client/src/views/Home/Garden/index.tsx`
- Remove `isEndowmentOpen` state, `setIsEndowmentOpen` calls, `<EndowmentDrawer>` render
- Remove `EndowmentDrawer` import
- Change `onEndowmentClick` to `() => navigate(`/home/${garden.id}/treasury`)`
- Add `treasury` to the content-hiding guard

### Step 4: Update barrel export
- [ ] Update `packages/client/src/components/Dialogs/index.ts`
- Remove `EndowmentDrawer` export

## Phase 2: Governance (ConvictionDrawer → route view)

### Step 5: Create Governance view
- [ ] Create `packages/client/src/views/Home/Garden/Governance.tsx`
- Export `GardenGovernance` component
- Same `<article>` + `<TopNav>` pattern
- Get gardenId from `useParams().id`, garden from `useGardens()`
- Move conviction logic from `ConvictionDrawer.tsx` (community status, weights, SupportInput, yield allocation)
- Keep sub-components (`SectionSkeleton`, `ConvictionBar`, `SupportInput`) co-located
- Replace `enabled: isOpen` with `enabled: true`
- Back button: `navigateToTop(`/home/${gardenId}`)`

### Step 6: Add route
- [ ] Update `packages/client/src/router.tsx`
- Add `{ path: "governance", lazy: ... }` as child of garden `:id` route

### Step 7: Update Garden view
- [ ] Update `packages/client/src/views/Home/Garden/index.tsx`
- Remove `isGovernanceOpen` state, `setIsGovernanceOpen` calls, `<ConvictionDrawer>` render
- Remove `ConvictionDrawer` import
- Change `onGovernanceClick` to `() => navigate(`/home/${garden.id}/governance`)`

### Step 8: Update barrel export
- [ ] Update `packages/client/src/components/Dialogs/index.ts`
- Remove `ConvictionDrawer` export

## Phase 3: Wallet (WalletDrawer → route view)

### Step 9: Create Wallet view
- [ ] Create `packages/client/src/views/Wallet/index.tsx`
- Same `<article>` + `<TopNav>` pattern (no `overlay` since no banner image)
- Use `StandardTabs` for cookie-jar / send / pools tabs
- Back button: `navigateToTop("/home")`

### Step 10: Move sub-components
- [ ] Move `views/Home/WalletDrawer/CookieJarTab.tsx` → `views/Wallet/CookieJarTab.tsx`
- [ ] Move `views/Home/WalletDrawer/ComingSoonStub.tsx` → `views/Wallet/ComingSoonStub.tsx`

### Step 11: Add route
- [ ] Update `packages/client/src/router.tsx`
- Add `{ path: "wallet", lazy: ... }` as sibling to `profile` under AppShell children

### Step 12: Update Home view
- [ ] Update `packages/client/src/views/Home/index.tsx`
- Remove `isWalletDrawerOpen` state
- Remove `<WalletDrawer>` render and import
- Change wallet icon click to `navigate("/wallet")`

## Phase 4: Content-Hiding Guard Improvement

### Step 13: Simplify guard
- [ ] Update `packages/client/src/views/Home/Garden/index.tsx` line ~306
- Replace enumerated path checks with:
  ```tsx
  const isChildRouteActive = pathname !== `/home/${gardenIdParam}`;
  ```

## Phase 5: Tests

### Step 14: Update existing tests
- [ ] Update `__tests__/views/HomeGarden.test.tsx` — remove drawer mocks
- [ ] Update `__tests__/views/Home.test.tsx` — remove WalletDrawer mock
- [ ] Update `WalletDrawer/CookieJarTab.test.tsx` — update import path

### Step 15: Add new tests
- [ ] Create `__tests__/views/GardenTreasury.test.tsx` — smoke test with route params
- [ ] Create `__tests__/views/GardenGovernance.test.tsx` — smoke test with route params
- [ ] Create `__tests__/views/Wallet.test.tsx` — smoke test with tabs

## Phase 6: Cleanup

### Step 16: Delete replaced files
- [ ] Delete `packages/client/src/components/Dialogs/ConvictionDrawer.tsx`
- [ ] Delete `packages/client/src/components/Dialogs/TreasuryDrawer.tsx` (after confirming no imports)
- [ ] Delete `packages/client/src/views/Home/WalletDrawer/index.tsx` (after move)
- [ ] Delete `packages/client/src/views/Home/WalletDrawer/ComingSoonStub.tsx` (after move)
- [ ] Delete `packages/client/src/views/Home/WalletDrawer/CookieJarTab.tsx` (after move)

### Step 17: Keep (do NOT delete)
- `ModalDrawer.tsx` — still used by `GardensFilterDrawer` and `TopNav` notifications
- `ModalDrawer.stories.tsx` — still valid
- `WalletDrawer/Icon.tsx` — still used from `Home/index.tsx`

### Step 18: Validate
- [ ] Run `bun format && bun lint && bun run test && bun build`

## Key Considerations

### State flow
Props like `gardenAddress`/`gardenName` become `useParams()` + `useGardens()` — proven pattern from `GardenWork`.

### `enabled: isOpen` hooks
Replace with `enabled: true` or remove — route mounting/unmounting handles the lifecycle naturally.

### No deep links to break
Drawers had no URLs. This only *adds* deep link capability.

### View transitions
Already handled — `useNavigateToTop()` passes `viewTransition: true` and `view-transitions.css` handles the slide animation via the View Transitions API.

### Tabs in new views
Use `StandardTabs` from `@/components/Navigation` with local `useState` for `activeTab`.

### TreasuryTabContent has `isOpen` prop
This prop gates `useEffect` resets and `enabled` flags. In the route view, set to `true`. The reset `useEffect` should run on mount via `[]` dependency instead.

### Duplicate code in TreasuryDrawer.tsx
`TreasuryDrawer.tsx` has inline versions of `MyDepositRow`, `CookieJarCard`, `CookieJarTabContent` that differ from the separate files (`Dialogs/MyDepositRow.tsx`, etc.). The separate files are the canonical, more recently refactored versions. Use those.

## Critical Files

- `packages/client/src/router.tsx` — add 3 new route definitions
- `packages/client/src/views/Home/Garden/index.tsx` — remove drawer state/renders, add navigation
- `packages/client/src/views/Home/Garden/Work.tsx` — reference pattern to follow
- `packages/client/src/views/Home/index.tsx` — remove WalletDrawer state/render
- `packages/client/src/components/Dialogs/TreasuryTabContent.tsx` — reusable sub-component for Treasury view
- `packages/client/src/components/Dialogs/index.ts` — barrel export cleanup
