# Impact Funders Leaderboard + AAVE Strategy Rate Display

**Status**: IMPLEMENTED
**Created**: 2026-03-24
**Last Updated**: 2026-03-24

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Embed in Endowments + Garden Vault tab, no new nav item | Keeps platform impact-first; funders naturally visit Endowments; avoids alienating non-funder roles |
| 2 | "Impact Funders" / "Garden Supporters" framing, no rank numbers | Gratitude-focused, not competitive; avoids financial dominance tone |
| 3 | Client-side aggregation with batched multicall for share→asset conversion | No indexer schema changes needed; VaultDeposit data already indexed; scales fine for <100 funders |
| 4 | New GraphQL query for all protocol deposits (not garden-scoped) | Existing queries are per-garden or per-user; protocol leaderboard needs all deposits |
| 5 | `convertToAssets(shares)` is args-only (no address needed) | Unlike `balanceOf`, it takes a shares amount — can batch all depositors in one multicall per vault |
| 6 | AAVE `getReserveData` via minimal ABI stub | Same pattern as OCTANT_VAULT_ABI — add only the needed function signature |
| 7 | Collapsible default state showing top 3 | Discoverable without dominating the page; expandable for full list |
| 8 | Clamp negative yield deltas to 0 | Same proven pattern from MyTrackedPositionCard — ERC-4626 rounding, not real losses |

## Requirements Coverage

| Requirement | Planned Step | Status |
|-------------|--------------|--------|
| Live AAVE APY per asset | Steps 1-2 | ⏳ |
| Protocol-wide funder yield rankings | Steps 3-5 | ⏳ |
| Per-garden supporter rankings | Steps 6-7 | ⏳ |
| Gardens supported count per funder | Step 4 | ⏳ |
| Yield allocation breakdown (CJ/Fractions/Protocol) | Step 5 | ⏳ |
| ENS name/avatar for funders | Step 5 | ⏳ |
| Non-competitive framing | Steps 5, 7 | ⏳ |
| i18n for all strings | Steps 2, 5, 7 | ⏳ |

## CLAUDE.md Compliance

- [x] All hooks in shared package
- [ ] i18n for UI strings
- [ ] Barrel exports from @green-goods/shared
- [ ] Address type (not string) for Ethereum addresses
- [ ] Error handling with logger (not console.log)
- [ ] Query keys via queryKeys.* helpers
- [ ] No package-specific .env files

## Impact Analysis

### Files to Create
- `packages/shared/src/utils/blockchain/aave.ts` — AAVE ABI stub + ray-to-APY conversion
- `packages/shared/src/hooks/vault/useStrategyRate.ts` — Live AAVE rate hook
- `packages/shared/src/hooks/vault/useBatchConvertToAssets.ts` — Batched share→asset conversion
- `packages/shared/src/hooks/vault/useFunderLeaderboard.ts` — Aggregated funder rankings
- `packages/admin/src/components/Vault/ImpactFunders.tsx` — Protocol-wide leaderboard component
- `packages/admin/src/components/Vault/GardenSupporters.tsx` — Per-garden supporters component
- `packages/admin/src/components/Vault/FunderRow.tsx` — Shared funder row with ENS resolution

### Files to Modify
- `packages/shared/src/utils/blockchain/abis.ts` — Add AAVE_V3_POOL_ABI
- `packages/shared/src/modules/data/vaults.ts` — Add ALL_VAULT_DEPOSITS_QUERY + fetcher
- `packages/shared/src/hooks/query-keys.ts` — Add leaderboard + strategyRate query keys
- `packages/shared/src/hooks/index.ts` — Re-export new hooks
- `packages/shared/src/utils/index.ts` — Re-export AAVE utilities
- `packages/shared/src/index.ts` — Barrel exports for new hooks/types/utils
- `packages/shared/src/types/vaults.ts` — Add FunderLeaderboardEntry, StrategyRate types
- `packages/admin/src/views/Endowments/index.tsx` — Embed ImpactFunders + APY StatCard
- `packages/admin/src/views/Gardens/Garden/Vault.tsx` — Embed GardenSupporters
- `packages/shared/src/i18n/en.ts` (or equivalent) — Add i18n message keys

## Test Strategy

- **Unit tests**: `aave.ts` ray-to-APY conversion (known values), funder aggregation logic (grouping, sorting, clamping)
- **Hook tests**: Skipped — hooks are thin wrappers over wagmi/react-query; tested via integration
- **Integration**: Manual verification on Sepolia with real vault deposits

## Implementation Steps

### Step 1: AAVE ABI + Rate Conversion Utilities
**Files**: `packages/shared/src/utils/blockchain/aave.ts`, `packages/shared/src/utils/blockchain/abis.ts`, `packages/shared/src/utils/index.ts`
**Details**:
- Create `aave.ts` with:
  - `AAVE_V3_POOL_ABI` — Minimal ABI with just `getReserveData(address asset)` → returns tuple including `currentLiquidityRate` (uint128 at index 2)
  - `RAY = 10n ** 27n` constant
  - `rayToApy(liquidityRate: bigint): number` — Converts ray rate to annual percentage. Formula: `(1 + rate / 10^27) ^ 31536000 - 1`. Use floating point for the exponentiation since BigInt can't do fractional powers. Return as percentage (e.g., 2.1 for 2.1%).
  - `formatApy(apy: number): string` — Formats to 2 decimal places with "%" suffix
- Re-export from `utils/index.ts`

**Verification**: Unit test the ray conversion with known AAVE rate values.

### Step 2: `useStrategyRate` Hook + Query Keys
**Files**: `packages/shared/src/hooks/vault/useStrategyRate.ts`, `packages/shared/src/hooks/query-keys.ts`, `packages/shared/src/hooks/index.ts`, `packages/shared/src/index.ts`
**Details**:
- Create `useStrategyRate(assetAddress?: Address)`:
  - Uses `useReadContract` to call `getReserveData(assetAddress)` on `AAVE_V3_POOL[chainId]`
  - Extracts `currentLiquidityRate` from result tuple
  - Calls `rayToApy()` to convert
  - Returns `{ apy: number | undefined, liquidityRate: bigint | undefined, isLoading, isError }`
  - `staleTime: STALE_TIME_SLOW` (rates change slowly)
  - Disabled when no pool address for chain or no asset address
- Add to `queryKeys.vaults`:
  - `strategyRate: (assetAddress: string, chainId: number) => ["greengoods", "vaults", "strategyRate", assetAddress, chainId] as const`
- Export from hooks/index.ts and shared/index.ts

**Verification**: `bun run test` passes; hook renders without error in dev (manual).

### Step 3: Protocol-Wide Deposits Query
**Files**: `packages/shared/src/modules/data/vaults.ts`, `packages/shared/src/hooks/vault/useAllVaultDeposits.ts`, `packages/shared/src/hooks/query-keys.ts`
**Details**:
- Add `ALL_VAULT_DEPOSITS_QUERY` to `vaults.ts`:
  ```graphql
  query AllVaultDeposits($chainId: Int!) {
    VaultDeposit(
      where: { chainId: { _eq: $chainId } }
      order_by: { totalDeposited: desc }
    ) {
      id chainId garden asset vaultAddress depositor shares totalDeposited totalWithdrawn
    }
  }
  ```
- Add `getAllVaultDeposits(chainId)` fetcher function using same `mapVaultDeposit` mapper
- Create `useAllVaultDeposits` hook:
  - Uses `useQuery` with `queryFn: () => getAllVaultDeposits(chainId)`
  - Query key: `queryKeys.vaults.allDeposits(chainId)`
  - `staleTime: STALE_TIME_MEDIUM`
  - Returns `{ deposits: VaultDeposit[], ...useQuery }`
- Add `allDeposits` to `queryKeys.vaults`

**Verification**: Hook returns all deposits across all gardens when called.

### Step 4: `useBatchConvertToAssets` Hook
**Files**: `packages/shared/src/hooks/vault/useBatchConvertToAssets.ts`
**Details**:
- Create `useBatchConvertToAssets(entries: Array<{ vaultAddress: Address; shares: bigint }>)`:
  - Builds a `useReadContracts` call with one `convertToAssets(shares)` per entry
  - Returns `Map<string, bigint>` keyed by `${vaultAddress}:${shares}` → currentAssetValue
  - Deduplicates identical vault+shares pairs
  - Follows exact same pattern as `useVaultPreview` (uses `OCTANT_VAULT_ABI`)
  - Only enabled when entries array is non-empty

**Verification**: Returns correct asset values for known vault+shares inputs.

### Step 5: `useFunderLeaderboard` Hook + Types + ImpactFunders Component
**Files**: `packages/shared/src/types/vaults.ts`, `packages/shared/src/hooks/vault/useFunderLeaderboard.ts`, `packages/shared/src/hooks/index.ts`, `packages/shared/src/index.ts`, `packages/admin/src/components/Vault/ImpactFunders.tsx`, `packages/admin/src/components/Vault/FunderRow.tsx`

**Types** (in `vaults.ts`):
```typescript
export interface FunderLeaderboardEntry {
  address: Address;
  totalYieldGenerated: bigint;
  totalNetDeposited: bigint;
  totalCurrentValue: bigint;
  gardenCount: number;
  gardenAddresses: Address[];
  positions: Array<{
    garden: Address;
    asset: Address;
    vaultAddress: Address;
    shares: bigint;
    netDeposited: bigint;
    currentValue: bigint;
    yieldGenerated: bigint;
  }>;
}
```

**Hook** `useFunderLeaderboard(scope?: { gardenAddress?: Address })`:
- If `gardenAddress` provided → uses `useVaultDeposits(gardenAddress)`
- If no garden (protocol-wide) → uses `useAllVaultDeposits()`
- Groups deposits by depositor address
- Calls `useBatchConvertToAssets` for all unique vault+shares combinations
- For each depositor:
  - Sums currentValue across all their positions
  - Sums netDeposited across all positions
  - yield = clamp(currentValue - netDeposited, 0)
  - Counts unique gardens
- Sorts by `totalYieldGenerated` descending
- Returns `{ funders: FunderLeaderboardEntry[], isLoading, totalProtocolYield: bigint }`

**ImpactFunders Component** (`ImpactFunders.tsx`):
- Collapsible Card with "Impact Funders" header + explanatory subtitle
- Default state: collapsed, showing top 3 entries
- Expanded state: all funders with scroll
- Each entry uses `FunderRow` component
- Bottom: contextual explainer for non-funder roles

**FunderRow Component** (`FunderRow.tsx`):
- Uses `useEnsName(address)` for display name, falls back to truncated address
- Shows: avatar placeholder, name, yield generated (green, with + prefix), gardens count (leaf icon)
- Yield bar: proportional width relative to top funder's yield
- No explicit rank numbers — position implies rank

**i18n keys needed**:
- `app.funders.impactFundersTitle`
- `app.funders.impactFundersSubtitle`
- `app.funders.gardensSupported` (with count)
- `app.funders.yieldGenerated`
- `app.funders.viewAll`
- `app.funders.collapse`
- `app.funders.contextExplainer`
- `app.funders.noFunders`

**Verification**: `bun build` succeeds; component renders in Endowments view with real data (manual).

### Step 6: Embed ImpactFunders in Endowments + APY StatCards
**Files**: `packages/admin/src/views/Endowments/index.tsx`
**Details**:
- Import `ImpactFunders` component
- Place between the Protocol Yield Breakdown section and the My Tracked Positions section
- Import `useStrategyRate` for each tracked asset (WETH, DAI)
- Add APY display to the stat cards row:
  - New StatCard showing "WETH APY: X.XX%" and "DAI APY: X.XX%" (or a combined card)
  - Uses `colorScheme="success"` with leaf icon
- Conditionally render — only show when there are deposits and rates are loaded

**Verification**: Endowments view shows APY stats and Impact Funders section; `bun build` succeeds.

### Step 7: GardenSupporters in Garden Vault Tab
**Files**: `packages/admin/src/components/Vault/GardenSupporters.tsx`, `packages/admin/src/views/Gardens/Garden/Vault.tsx`
**Details**:
- Create `GardenSupporters` component:
  - Takes `gardenAddress: Address` prop
  - Uses `useFunderLeaderboard({ gardenAddress })` for garden-scoped data
  - Similar layout to ImpactFunders but titled "Garden Supporters"
  - Shows supporters for just this garden, with per-asset yield breakdown
  - No collapse by default (garden scope is smaller)
- Embed in `Vault.tsx`:
  - Place between the vault PositionCards grid and the Contract Details section
  - Only render when vaults have depositors

**i18n keys needed**:
- `app.funders.gardenSupportersTitle`
- `app.funders.gardenSupportersSubtitle`

**Verification**: Garden Vault view shows supporters list; `bun build` succeeds.

### Step 8: Barrel Exports + Final Wiring
**Files**: `packages/shared/src/index.ts`, `packages/shared/src/hooks/index.ts`, `packages/shared/src/utils/index.ts`, `packages/shared/src/types/index.ts`
**Details**:
- Ensure all new hooks are exported: `useStrategyRate`, `useAllVaultDeposits`, `useBatchConvertToAssets`, `useFunderLeaderboard`
- Ensure all new types are exported: `FunderLeaderboardEntry`, `StrategyRate`
- Ensure all new utils are exported: `rayToApy`, `formatApy`, `RAY`, `AAVE_V3_POOL_ABI`
- Run full validation: `bun format && bun lint && bun run test && bun build`

**Verification**: Full workspace builds; no lint errors; all tests pass.

## Validation

- [ ] TypeScript passes (`bun build` across workspace)
- [ ] Tests pass (`bun run test`)
- [ ] Lint passes (`bun lint`)
- [ ] Format passes (`bun format`)
- [ ] AAVE APY displays correctly on Sepolia
- [ ] Impact Funders section appears in Endowments
- [ ] Garden Supporters section appears in Vault tab
- [ ] ENS names resolve for known addresses
- [ ] Negative yield clamped to 0
- [ ] Collapsible behavior works (expand/collapse)
- [ ] Mobile responsive layout
