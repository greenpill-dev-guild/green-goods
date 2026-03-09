# Plan F: High-Value Enhancement Stories

**GitHub Issues**: #393, #430, #433, #388
**Branch**: `fix/contracts-crosspackage` (current branch, no new branch)
**Status**: IMPLEMENTED
**Created**: 2026-03-07
**Last Updated**: 2026-03-08
**Completed**: 2026-03-08
**Phase**: 4 (after bugs and polish stabilize)
**Depends on**: Plans A-E (DONE)

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Only 4 highest-value stories in this phase | Ship stability first, then features |
| 2 | All stories on current branch (no per-story branches) | User requested no new branch |
| 3 | `getGardenAssessments(undefined)` already fetches all — reuse it | No new EAS query needed |
| 4 | New `useAllAssessments` hook wraps existing data fn | Keeps single-garden hook unchanged, adds chain-level key |
| 5 | Garden creation gating via `useDeploymentRegistry().canDeploy` | On-chain source of truth, already exported from shared |
| 6 | Identity story (#393) is UX-only — warnings + guidance copy | No passkey backup infra in scope |
| 7 | Endowment story (#433) focuses on connect prompt + vault health | AAVE strategy display deferred (needs indexer data) |
| 8 | Reuse existing Assessment.tsx table pattern for all-gardens view | Consistent UX, less new code |
| 9 | Add garden name column to cross-garden assessment table | Differentiator from per-garden view |
| 10 | Filter by garden uses dropdown of known gardens from `useGardens()` | No extra query needed |

---

## Requirements Coverage

| Requirement | Planned Step | Status |
|-------------|--------------|--------|
| #430: Sidebar entry for Assessments | Step 1 | ✅ |
| #430: Cross-garden assessments list | Step 2 | ✅ |
| #430: Filtering (garden, date, status) | Step 2 | ✅ |
| #430: Sorting | Step 2 | ✅ |
| #430: Link to assessment detail | Step 2 | ✅ |
| #430: Route in admin router | Step 3 | ✅ |
| #388: Disabled Create Garden + explanation | Step 4 | ✅ |
| #388: Explain which role is needed | Step 4 | ✅ |
| #388: Guidance on requesting the role | Step 4 | ✅ |
| #433: Connect Wallet prompt on deposit | Step 5 | ✅ |
| #433: Vault health status display | Step 5 | ✅ |
| #433: Reliable vault state reads | Step 5 | ✅ |
| #393: Warning before passkey-stranding | Step 6 | ✅ |
| #393: Guide toward wallet-based recovery | Step 6 | ✅ |
| i18n keys for all new UI strings | Steps 1-6 | ✅ |

## CLAUDE.md Compliance
- [x] Hooks in shared package (`useAllAssessments` in shared)
- [ ] i18n for UI strings (all new strings get keys)
- [x] Barrel imports from `@green-goods/shared`
- [x] Deployment artifacts for addresses (uses `useDeploymentRegistry`)
- [x] No package-specific .env files
- [x] Error handling via logger, not console.log

## Impact Analysis

### Files to Modify
- `packages/admin/src/components/Layout/Sidebar.tsx` — add Assessments nav entry
- `packages/admin/src/router.tsx` — add `/assessments` route
- `packages/admin/src/views/Gardens/index.tsx` — gate Create Garden on `canDeploy`
- `packages/admin/src/components/Vault/DepositModal.tsx` — add connect wallet prompt
- `packages/client/src/components/Dialogs/TreasuryDrawer.tsx` — add connect wallet prompt
- `packages/shared/src/i18n/en.json` — new i18n keys
- `packages/shared/src/index.ts` — export new hook

### Files to Create
- `packages/shared/src/hooks/assessment/useAllAssessments.ts` — cross-garden assessments hook
- `packages/admin/src/views/Assessments/index.tsx` — all-gardens assessments view

## Test Strategy
- **Unit tests**: Not required for view-layer components (per project convention)
- **Manual verification**: Each step has specific visual checks
- **Build verification**: `bun format && bun lint && bun run test && bun build`

---

## Implementation Steps

### Step 1: Add Assessments sidebar entry + `useAllAssessments` hook
**Files**: `Sidebar.tsx`, `useAllAssessments.ts`, `shared/index.ts`, `en.json`, `query-keys.ts`
**Details**:
1. Add `RiFileList3Line` icon import and "Assessments" nav item below Gardens in `Sidebar.tsx` (roles: all three)
2. Create `useAllAssessments.ts` hook that calls `getGardenAssessments(undefined, chainId)` — fetches ALL assessments chain-wide
3. Add `assessments.byChain` query key to `query-keys.ts`
4. Export `useAllAssessments` from shared barrel
5. Add `app.sidebar.assessments` i18n key to `en.json`
**Verify**: Sidebar shows "Assessments" entry with icon. Build passes.

### Step 2: Create all-gardens Assessments view
**Files**: `packages/admin/src/views/Assessments/index.tsx`, `en.json`
**Details**:
1. Create `Assessments/index.tsx` with PageHeader, ListToolbar, and assessment table
2. Use `useAllAssessments()` for data, `useGardens()` for garden name resolution
3. Table columns: Garden Name, Title, Type, Date Range, Capitals, Tags, View (EAS link)
4. Add filtering: garden dropdown (from `useGardens`), free-text search on title
5. Add sorting: by date (default), by title, by garden name
6. Empty state with `RiFileList3Line` icon
7. Loading skeleton state
8. Error state with Alert component
9. Add all new i18n keys
**Verify**: View renders with mock/real data. Filters and sorting work.

### Step 3: Wire Assessments route in admin router
**Files**: `packages/admin/src/router.tsx`
**Details**:
1. Add `/assessments` as a public read-only route (same level as `/gardens`, `/actions`)
2. Lazy-load `@/views/Assessments`
**Verify**: Navigate to `/assessments` in browser, view loads correctly.

### Step 4: Gate Create Garden on deployer permissions (#388)
**Files**: `packages/admin/src/views/Gardens/index.tsx`, `en.json`
**Details**:
1. Import `useDeploymentRegistry` from `@green-goods/shared`
2. When `canDeploy` is false and not loading: disable Create Garden button, show tooltip explaining requirement
3. When loading: show button in loading state
4. Add an Alert (variant "info") below the toolbar when `!canDeploy` explaining:
   - "You need deployer permissions to create a garden"
   - "Contact a protocol operator to be added to the deployment allowlist"
5. Keep button visible but styled as disabled (opacity-60, cursor-not-allowed, no link)
6. Add i18n keys for all new strings
**Verify**: Disconnected user sees disabled button with explanation. Deployer sees normal button.

### Step 5: Endowment deposit reliability improvements (#433)
**Files**: `DepositModal.tsx`, `TreasuryDrawer.tsx`, `en.json`
**Details**:
1. **DepositModal.tsx** (admin): Add "Connect Wallet" prompt when `!primaryAddress` — show `ConnectButton` instead of deposit form
2. **TreasuryDrawer.tsx** (client): Add "Connect Wallet" prompt when `!primaryAddress` in deposit section — show message + guidance
3. **DepositModal.tsx**: Add vault health info section showing: total assets, deposit limit, shutdown status from `healthCheck` preview
4. Add explicit vault state error when vault is shutdown (distinct from "not accepting deposits")
5. Add i18n keys for new strings
**Verify**: Without wallet: see connect prompt. With wallet: see enhanced vault info. Shutdown vault shows clear error.

### Step 6: Identity persistence warnings (#393)
**Files**: `en.json`, `TreasuryDrawer.tsx` or client auth components
**Details**:
1. Add info Alert in client settings/profile area explaining passkey storage limitations:
   - "Your passkey is stored locally on this device"
   - "Clearing browser data will permanently lose access to this account"
   - "For persistent access, use wallet-based login"
2. Add a "Recovery" section in profile/settings explaining the two auth methods and their tradeoffs
3. This is copy/UX only — no new auth infrastructure
4. Add i18n keys
**Verify**: Passkey users see clear warnings. Wallet users see no warnings.

---

## Deferred Stories (next sprint)

| # | Title | Why Deferred |
|---|-------|-------------|
| #389 | Update garden domains after creation | Needs domain management contract work |
| #390 | Choose available actions per garden | Low priority per issue notes |
| #391 | Upload garden files/metadata | Infrastructure work |
| #392 | "Other" option for services | Small UX enhancement |
| #394 | Work submissions show action/category | Depends on indexer data |
| #419 | Yield growth visibility | Needs vault history data from indexer |
| #420 | Dune dashboard | External tooling, not code |

## Validation

```bash
bun format && bun lint && bun run test && bun build
```
