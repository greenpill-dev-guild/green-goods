# Signal Pool → Yield Wiring Supplement

**Parent Plan**: `vault-strategy-autoallocate-fix.todo.md`
**Status**: DRAFT — REVIEWED
**Created**: 2026-03-16
**Last Updated**: 2026-03-16
**Depends on**: Octant fix Phase 2 (YieldResolver upgrade)

## Problem Statement

Once the Octant auto-allocate fix lands and yield starts flowing, `splitYield()` will route 48.65% to `_routeToFractions()`. That function reads `gardenHypercertPools[garden]` (Yield.sol:589) — if the pool isn't wired, **all fractions yield escrows indefinitely**.

Current state of deployed gardens:
- Each garden has its **own 1Hive RegistryCommunity** ✓ (created during mint)
- **No signal pools exist** — pool creation step failed/was skipped during mint
- `gardenHypercertPools[garden]` is `address(0)` for all gardens
- `gardenTreasuries[garden]` is `address(0)` for all gardens (2.7% Juicebox fallback strands)

Two things must happen before yield can route to real conviction data:
1. Operators create signal pools (ActionSignal + HypercertSignal) via existing `createGardenPools()`
2. The hypercert pool address gets wired to YieldResolver via `setGardenHypercertPool()`

Step 1 has UI. Step 2 is `onlyOwner` with no UI and no automation — this is the gap.

### Mint Flow Gap

`GardenToken.mintGarden()` calls modules in order:
1. `octantModule.onGardenMinted()` (line 400) — creates vaults (has `yieldResolver` ref)
2. `gardensModule.onGardenMinted()` (line 410) — creates community + pools (has NO `yieldResolver` ref)
3. `cookieJarModule.onGardenMinted()` (line 425) — creates cookie jars

OctantModule runs BEFORE GardensModule, so it can't wire pools that don't exist yet.
GardensModule creates pools but has no reference to YieldResolver.
Result: nobody calls `setGardenHypercertPool()` during mint — manual step required.

## Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| S1 | Widen `setGardenHypercertPool` access to garden operators + GardensModule (not just owner) | Three-tier access: GardensModule (auto-wire during pool creation), operators (self-service re-wire), owner (emergency override). Follows `setGardenVault` pattern (Yield.sol:377-378) where OctantModule is a trusted caller. |
| S2 | **Modify GardensModule to auto-wire (Path B)** | Add `yieldResolver` storage var + auto-call `setGardenHypercertPool(garden, hypercertPool)` inside `_createSignalPools()` after hypercert pool creation. Covers both mint path (`attemptPoolCreation`) and operator recovery path (`createGardenPools`). One extra proxy upgrade but eliminates the last manual step in garden lifecycle. |
| S3 | Frontend auto-chain as FALLBACK, not primary mechanism | With Path B, auto-wiring happens on-chain. Frontend `useCreateGardenPools` hook still verifies wiring succeeded and offers manual retry if the try/catch swallowed a failure. |
| S4 | Add garden TBA fallback in `_routeToJuicebox` and `_routeToCookieJar` for yield that would otherwise strand | Currently if `jbMultiTerminal == 0` AND `gardenTreasuries[garden] == 0`, yield strands (Yield.sol:767-769). The `_purchaseFraction` function already falls back to `garden` TBA (Yield.sol:739). Apply the same pattern everywhere. Eliminates need for `setGardenTreasury` calls in migration. |
| S5 | Migration script wires pools for any garden that already has pools but no yield wiring | For completeness — if any garden creates pools between now and the upgrade, backfill handles them. |
| S6 | Pool index is NOT reliable after trim — use `hypercertPool` local variable directly | `_createSignalPools` (Gardens.sol:668-674) trims the array if one pool fails. If action pool fails but hypercert succeeds, `pools[0]` = hypercert pool, breaking the index assumption. Auto-wiring uses the local `hypercertPool` variable inside `_createSignalPools`, sidestepping the issue entirely. |
| S7 | Set `gardenTreasuries` to garden TBA for all existing gardens in migration | Belt-and-suspenders alongside S4. Even though S4 adds code fallback, setting the mapping avoids relying solely on code paths for existing gardens. New gardens get the code fallback automatically. |
| S8 | Validate pool address is a CVStrategy when setting | `setGardenHypercertPool` calls `ICVStrategy(pool).proposalCounter()` in a try/catch. If it reverts, reject with `InvalidPool`. Prevents misconfiguration. GardensModule skips this check (it just created the pool). |
| S9 | Operators can re-wire the pool after it's set | Operators can already change split ratios. Pool re-wiring is less dangerous and may be needed if a CVStrategy is compromised or migrated. Owner retains override. |

## Resolved Questions

| # | Question | Resolution |
|---|----------|------------|
| Q1 | Validate pool address? | Yes — lightweight `proposalCounter()` check. Skipped when caller is GardensModule (just created the pool). |
| Q2 | Allow operator re-wire? | Yes — same access as `setSplitRatio`. |
| Q3 | Multicall or two txs for frontend pool creation? | Path B makes this moot — auto-wiring is on-chain. Frontend only needs retry UI if auto-wire fails. |

## Contract Changes

### Change 1: GardensModule — Add `yieldResolver` + auto-wire after pool creation

**File**: `packages/contracts/src/modules/Gardens.sol`

**Storage addition** (after line 131, before `__gap`):

```solidity
/// @notice YieldResolver for auto-wiring hypercert pools to yield routing
address public yieldResolver;
```

**Update storage gap** (line 134): `14 storage vars` → `15 storage vars`, `uint256[36]` → `uint256[35]`

**New setter** (in Admin Functions section, after line 424):

```solidity
/// @notice Set YieldResolver address for auto-wiring pools to yield
function setYieldResolver(address _yieldResolver) external onlyOwner {
    emit ConfigUpdated("yieldResolver", yieldResolver, _yieldResolver);
    yieldResolver = _yieldResolver;
}
```

**New event** (in interface or contract):

```solidity
event YieldWiringFailed(address indexed garden, address indexed pool);
```

**Auto-wire in `_createSignalPools`** (after line 664, inside the `if (hypercertPool != address(0))` block):

```solidity
// Pool 2 (index 1): HypercertSignalPool
address hypercertPool =
    _createPool(garden, community, PointSystem.Custom, cvParams, registry, HYPERCERT_SIGNAL_POOL_METADATA);
if (hypercertPool != address(0)) {
    pools[created++] = hypercertPool;
    emit SignalPoolCreated(garden, hypercertPool, PoolType.HypercertSignal, community);

    // Auto-wire hypercert pool to YieldResolver for conviction-weighted yield routing
    if (yieldResolver != address(0)) {
        try IYieldResolver(yieldResolver).setGardenHypercertPool(garden, hypercertPool) {}
        catch { emit YieldWiringFailed(garden, hypercertPool); }
    }
}
```

**New interface import** (at top of file or inline):

```solidity
interface IYieldResolver {
    function setGardenHypercertPool(address garden, address pool) external;
}
```

**Update `isWiringComplete`** (line 310-318) — add yieldResolver check:

```solidity
if (yieldResolver == address(0)) return (false, "yieldResolver not set");
```

### Change 2: YieldResolver — Accept GardensModule as trusted caller + operator access + validation

**File**: `packages/contracts/src/resolvers/Yield.sol`

**Storage addition** (after existing module references, before `__gap`):

```solidity
/// @notice GardensModule address (trusted caller for auto-wiring pools)
address public gardensModule;
```

**Update storage gap comment** (line 188): `18 storage vars` → `19 storage vars`, `uint256[32]` → `uint256[31]`

**New setter**:

```solidity
function setGardensModule(address _gardensModule) external onlyOwner {
    gardensModule = _gardensModule;
}
```

**Updated `setGardenHypercertPool`** (replaces lines 463-465):

```solidity
/// @notice Set the HypercertSignalPool (CVStrategy) address for a garden
/// @dev Three-tier access control:
///      1. GardensModule — auto-wires during pool creation (no validation, pool was just created)
///      2. Garden operators — self-service via admin UI (with CVStrategy validation)
///      3. Protocol owner — emergency override (with CVStrategy validation)
function setGardenHypercertPool(address garden, address pool) external {
    bool isGardensModuleCall = (msg.sender == gardensModule && gardensModule != address(0));

    if (!isGardensModuleCall && msg.sender != owner()) {
        _requireOperatorOrOwner(garden);
    }

    // Validate pool is a CVStrategy (skip for GardensModule — it just created the pool)
    if (pool != address(0) && !isGardensModuleCall) {
        try ICVStrategy(pool).proposalCounter() returns (uint256) {
            // Valid CVStrategy
        } catch {
            revert InvalidPool(pool);
        }
    }

    gardenHypercertPools[garden] = pool;
    emit GardenHypercertPoolUpdated(garden, pool);
}
```

**New error**: `error InvalidPool(address pool);`
**New event**: `event GardenHypercertPoolUpdated(address indexed garden, address indexed pool);`

### Change 3: YieldResolver — Garden TBA fallback in `_routeToJuicebox`

**File**: `packages/contracts/src/resolvers/Yield.sol`

**Juicebox no-config path** (lines 762-770):

```solidity
// BEFORE:
if (address(jbMultiTerminal) == address(0) || juiceboxProjectId == 0) {
    address treasury = gardenTreasuries[garden];
    if (treasury != address(0)) {
        IERC20(asset).safeTransfer(treasury, amount);
    } else {
        emit YieldStranded(garden, asset, amount, "juicebox");
    }
    return;
}

// AFTER:
if (address(jbMultiTerminal) == address(0) || juiceboxProjectId == 0) {
    address treasury = gardenTreasuries[garden];
    if (treasury == address(0)) treasury = garden; // Fallback to garden TBA
    IERC20(asset).safeTransfer(treasury, amount);
    emit YieldToTreasury(garden, asset, amount, treasury, "juicebox");
    return;
}
```

**Juicebox try/catch failure path** (lines 789-795) — same pattern:

```solidity
// AFTER:
address treasury = gardenTreasuries[garden];
if (treasury == address(0)) treasury = garden;
IERC20(asset).safeTransfer(treasury, amount);
emit YieldToTreasury(garden, asset, amount, treasury, "juicebox");
```

**Cookie Jar fallback** (lines 553-561) — same pattern:

```solidity
// AFTER:
address treasury = gardenTreasuries[garden];
if (treasury == address(0)) treasury = garden;
IERC20(asset).safeTransfer(treasury, amount);
emit YieldToTreasury(garden, asset, amount, treasury, "cookieJar");
```

**New event**: `event YieldToTreasury(address indexed garden, address indexed asset, uint256 amount, address treasury, string source);`

### Change 4: YieldResolver — Widen `setGardenTreasury` access

**File**: `packages/contracts/src/resolvers/Yield.sol`

```solidity
// BEFORE (line 371-373):
function setGardenTreasury(address garden, address treasury) external onlyOwner {
    gardenTreasuries[garden] = treasury;
}

// AFTER:
function setGardenTreasury(address garden, address treasury) external {
    if (msg.sender != owner()) {
        _requireOperatorOrOwner(garden);
    }
    if (treasury == address(0)) revert ZeroAddress();
    gardenTreasuries[garden] = treasury;
    emit GardenTreasuryUpdated(garden, treasury);
}
```

**New event**: `event GardenTreasuryUpdated(address indexed garden, address indexed treasury);`

## Frontend Changes

### Change 5: Verify wiring after pool creation — `useCreateGardenPools` enhancement

**File**: `packages/shared/src/hooks/conviction/useCreateGardenPools.ts`

With Path B, auto-wiring happens on-chain in `_createSignalPools`. The hook changes are:

1. After `createGardenPools()` tx confirms, query `yieldResolver.gardenHypercertPools(garden)`
2. If non-zero: show success ("Pools created and yield connected")
3. If zero (auto-wire failed): surface warning and offer manual "Connect to yield" button as fallback
4. Manual fallback calls `yieldResolver.setGardenHypercertPool(garden, hypercertPool)` — operator-callable after Change 2

**File**: `packages/shared/src/hooks/conviction/useSetGardenHypercertPool.ts` (NEW)

Mutation hook for manual/retry wiring. Used by:
- `useCreateGardenPools` (fallback if auto-wire failed)
- Admin UI (manual re-wiring to different CVStrategy)

**File**: `packages/shared/src/hooks/conviction/useGardenHypercertPool.ts` (NEW)

Read hook: `yieldResolver.gardenHypercertPools(garden)` — used for status display.

### Change 6: Pool wiring status in admin Community tab

**File**: `packages/admin/src/components/Garden/GardenCommunityCard.tsx`

Add yield wiring status indicator:
- If pools exist AND `gardenHypercertPools[garden] != 0x0`: Green dot + "Yield connected"
- If pools exist AND `gardenHypercertPools[garden] == 0x0`: Warning badge "Yield not connected" + "Connect to yield" button
- If no pools: Existing "Create Pools" flow (unchanged — will auto-wire via Path B)

### Change 7: Disambiguate Strategies naming

**File**: `packages/admin/src/views/Gardens/Garden/Strategies.tsx`

Rename view title from "Strategies" to "Conviction Strategies" to avoid confusion with Aave vault strategies. Update i18n keys:
- `app.conviction.title` → "Conviction Strategies"
- `app.conviction.description` → mention "signal" or "conviction voting" explicitly

## Migration Script Additions

### Change 8: Add pool wiring + treasury backfill to `migrate-vaults.ts`

**File**: `packages/contracts/script/migrate-vaults.ts`

After existing vault backfill steps, add:

```
Phase 3b: Wire signal pools + treasuries for all gardens

For each garden:
  1. Query gardensModule.getGardenSignalPools(garden)
     - If empty: log "no pools — operator must create via admin UI (auto-wires on creation)"
     - If pools exist:
       a. Identify hypercert pool (use SignalPoolCreated events filtered by PoolType,
          or if both pools present, index 1 is reliable)
       b. Check yieldResolver.gardenHypercertPools(garden)
       c. If zero: call yieldResolver.setGardenHypercertPool(garden, hypercertPool)
       d. If already set: skip (idempotent)

  2. Check yieldResolver.gardenTreasuries(garden)
     - If zero: call yieldResolver.setGardenTreasury(garden, garden)
       (sets garden TBA as treasury — belt-and-suspenders with code fallback)
     - If already set: skip

  3. Verify post-migration:
     - gardenHypercertPools[garden] == expected pool address
     - gardenTreasuries[garden] != address(0)
```

**Note**: Migration runs with owner privileges. After upgrade, new gardens auto-wire (GardensModule),
and operators can self-service re-wire or set treasury (wider access on YieldResolver).

## Deployment Sequence Integration

These changes add GardensModule to the Octant fix upgrade scope:

```
Phase 0: Product-surface alignment (existing — no change)
  1-2. Copy/docs updates

Phase 1: Deploy contract implementations (existing, extended)
  3. Deploy AaveV3ERC4626 strategy template
  4. Deploy new YieldResolver implementation
     ← NOW INCLUDES: Changes 2, 3, 4 (gardensModule ref, TBA fallback, wider access)
  5. Deploy new OctantModule implementation
  6. Deploy new GardensModule implementation (NEW)
     ← INCLUDES: Change 1 (yieldResolver ref + auto-wire in _createSignalPools)

Phase 2: Upgrade proxies (existing, extended)
  7. Upgrade YieldResolver proxy
  8. Upgrade GardensModule proxy (NEW — must happen AFTER YieldResolver so auto-wire target is ready)
  9. Upgrade OctantModule proxy

Phase 2b: Cross-wire new references (NEW)
  10. yieldResolver.setGardensModule(address(gardensModule))
  11. gardensModule.setYieldResolver(address(yieldResolver))
  12. Verify: gardensModule.isWiringComplete() returns (true, "")

Phase 3: Backfill existing vaults (existing)
  13. Run migrate-vaults.ts for vault auto-allocate

Phase 3b: Wire signal pools + treasuries (NEW)
  14. Run migrate-vaults.ts Phase 3b additions
      - For gardens WITH pools: wire hypercert pool + set treasury
      - For gardens WITHOUT pools: log for operator action
  15. Notify operators of gardens needing pool creation
      (they click "Create Pools" in admin → auto-wires on-chain via GardensModule)

Phase 4: Verification (existing, extended)
  16. Run post-deploy-verify.ts (updated)
      ← NOW INCLUDES: gardenHypercertPools, gardenTreasuries, gardensModule wiring checks
  17. Deploy admin/shared app release
      ← NOW INCLUDES: Changes 5, 6, 7 (wiring status, auto-verify, naming)

Phase 5: Activation gate (existing — no change)
  18. Confirm yield pipeline end-to-end
```

## Post-Upgrade: New Garden Mint Flow (Fully Automatic)

After all upgrades deployed and cross-wired:

```
GardenToken.mintGarden()
  │
  ├── Step 1: octantModule.onGardenMinted(garden, name)
  │   └── For each supported asset:
  │       ├── Create MultistrategyVault ✓
  │       ├── Deploy AaveV3ERC4626 strategy ✓ (Octant fix)
  │       ├── Wire auto-allocate + maxDebt + accountant ✓ (Octant fix)
  │       ├── Set donation address = yieldResolver ✓ (Octant fix)
  │       └── Register vault: yieldResolver.setGardenVault() ✓
  │
  ├── Step 2: gardensModule.onGardenMinted(garden, scheme, name, desc)
  │   ├── Create RegistryCommunity (per-garden 1Hive community) ✓
  │   ├── Register power sources in UnifiedPowerRegistry ✓
  │   ├── Seed GOODS treasury ✓
  │   └── attemptPoolCreation():
  │       ├── Create ActionSignalPool (CVStrategy) ✓
  │       ├── Create HypercertSignalPool (CVStrategy) ✓
  │       ├── Auto-wire: yieldResolver.setGardenHypercertPool(garden, pool) ✓ (NEW)
  │       ├── Register pools in PowerRegistry ✓
  │       └── Register pools in HatsModule ✓
  │
  ├── Step 3: cookieJarModule.onGardenMinted(garden)
  │   └── Create per-asset Cookie Jars ✓
  │       (YieldResolver queries CookieJarModule at runtime — no separate wiring needed)
  │
  └── Yield routing ready:
      ├── 48.65% Cookie Jar → CookieJarModule lookup ✓ (fallback: garden TBA)
      ├── 48.65% Fractions → gardenHypercertPools[garden] → conviction-weighted ✓
      └── 2.70% Juicebox → jbMultiTerminal (fallback: garden TBA) ✓
```

**Zero manual steps for new gardens.**

## Storage Layout Impact

### GardensModule (UUPS proxy)
- Before: 14 storage vars + 36 gap = 50 slots
- After: 15 storage vars (+ `yieldResolver`) + 35 gap = 50 slots ✓

### YieldResolver (UUPS proxy)
- Before: 18 storage vars + 32 gap = 50 slots
- After: 19 storage vars (+ `gardensModule`) + 31 gap = 50 slots ✓

Both maintain the 50-slot total. UUPS-safe.

## Test Additions

### Unit tests (YieldResolver)
- `setGardenHypercertPool` — GardensModule can set pool (no CVStrategy validation)
- `setGardenHypercertPool` — operator can set pool for their garden (with CVStrategy validation)
- `setGardenHypercertPool` — non-operator reverts with `UnauthorizedCaller`
- `setGardenHypercertPool` — owner can set for any garden (override)
- `setGardenHypercertPool` — invalid pool address (non-CVStrategy) reverts with `InvalidPool`
- `setGardenHypercertPool` — zero address allowed (clears pool, reverts to escrow mode)
- `setGardenTreasury` — operator can set treasury for their garden
- `setGardenTreasury` — zero address reverts with `ZeroAddress`
- `_routeToJuicebox` — falls back to garden TBA when no treasury and no Juicebox
- `_routeToJuicebox` — falls back to garden TBA when Juicebox payment fails and no treasury
- `_routeToCookieJar` — falls back to garden TBA when no cookie jar and no treasury
- `setGardensModule` — only owner can set

### Unit tests (GardensModule)
- `_createSignalPools` — auto-wires hypercert pool to YieldResolver when `yieldResolver` is set
- `_createSignalPools` — emits `YieldWiringFailed` when auto-wire reverts (yield wiring failure doesn't break pool creation)
- `_createSignalPools` — skips auto-wire when `yieldResolver` is address(0) (testnet compatibility)
- `createGardenPools` — operator recovery path also auto-wires
- `setYieldResolver` — only owner can set
- `isWiringComplete` — returns false when yieldResolver not set

### Fork tests
- Full pipeline: deposit → harvest → splitYield with pool auto-wired → conviction-weighted distribution (not escrow)
- Full pipeline: deposit → harvest → splitYield with NO pool → escrow (existing behavior preserved)
- Juicebox fallback: no JB configured → 2.7% goes to garden TBA (not stranded)
- Cookie Jar fallback: no jar configured → 48.65% goes to garden TBA (not stranded)
- Garden mint e2e: mint → vaults created → pools created → yield wired → all automatic

## Files Summary

### Files to Modify
- `packages/contracts/src/modules/Gardens.sol` — Change 1 (yieldResolver storage + auto-wire in _createSignalPools)
- `packages/contracts/src/resolvers/Yield.sol` — Changes 2, 3, 4 (gardensModule ref, TBA fallback, wider access)
- `packages/shared/src/hooks/conviction/useCreateGardenPools.ts` — Change 5 (verify wiring, retry fallback)
- `packages/admin/src/components/Garden/GardenCommunityCard.tsx` — Change 6 (yield wiring status badge)
- `packages/admin/src/views/Gardens/Garden/Strategies.tsx` — Change 7 (rename to Conviction Strategies)
- `packages/contracts/script/migrate-vaults.ts` — Change 8 (pool + treasury backfill)
- `packages/contracts/script/utils/post-deploy-verify.ts` — Add pool + treasury + wiring verification
- `packages/contracts/test/helpers/DeploymentBase.sol` — Wire gardensModule ↔ yieldResolver
- `packages/shared/src/i18n/en.json` — Updated i18n keys
- `packages/shared/src/i18n/es.json` — Same
- `packages/shared/src/i18n/pt.json` — Same
- `packages/contracts/test/unit/YieldSplitter.t.sol` — New access control + fallback tests
- `packages/contracts/test/unit/GardensModule.t.sol` — Auto-wire tests

### Files to Create
- `packages/shared/src/hooks/conviction/useSetGardenHypercertPool.ts` — Mutation hook (manual retry/re-wire)
- `packages/shared/src/hooks/conviction/useGardenHypercertPool.ts` — Read hook (wiring status)

### Files Unchanged
- `packages/contracts/src/modules/Octant.sol` — No changes beyond parent plan
- `packages/contracts/src/tokens/Garden.sol` — No changes (GardensModule handles wiring internally)
