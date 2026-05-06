# Signal Pool → Yield Wiring Supplement

**Parent Plan**: `vault-strategy-autoallocate-fix.todo.md`
**Status**: ACTIVE
**Created**: 2026-03-16
**Last Updated**: 2026-05-03 (Tier-5 conviction wiring coordination notes added — see new "Coordination" section before Problem Statement)
**Target**: 2026-05-15 (complete by the second week of May)
**Depends on**: Octant fix Phase 2 (YieldResolver upgrade)

## Current Reassessment — 2026-04-25

This hub is active again because the contract-side prerequisite is still open in source:

- `packages/contracts/src/modules/Gardens.sol` has no `yieldResolver` storage, setter, or auto-wire call after Hypercert signal pool creation.
- `packages/contracts/src/modules/Gardens.sol` `isWiringComplete()` does not check a yield resolver address.
- `packages/contracts/src/resolvers/Yield.sol` keeps `setGardenHypercertPool()` owner-only.
- `packages/contracts/src/resolvers/Yield.sol` still has no trusted `gardensModule` caller, no pool validation error, and incomplete garden TBA fallback for stranded yield paths.

Lane order: contracts first, then shared/admin recovery and verification surfaces, then UI QA. Do not promote `yield-split-ui` until this hub passes.

## Delivery Target — 2026-05-15

Complete this hub by Friday, 2026-05-15. Keep the sequence contract-first:

1. Contracts + storage/upgrade tests.
2. Migration/deploy dry-run + post-deploy verification updates.
3. Shared hooks + admin reconnect/status UX.
4. QA pass 1, QA pass 2, and activation gate.

Scope lock from 2026-04-26:
- Operators may re-wire an already-set hypercert pool, with CVStrategy validation and events.
- Migration/backfill identifies the HypercertSignal pool from `SignalPoolCreated(..., PoolType.HypercertSignal, ...)` events; array index is manual/dry-run fallback only.
- Existing gardens get `gardenTreasuries[garden] = garden` during backfill as belt-and-suspenders.
- `/community` owns the primary reconnect action; other pool/yield surfaces show compact status and route to the same repair flow.
- Shared/admin must not classify pools by array index. Pool type comes from typed contract state or event-derived migration/subgraph data.
- Deployment verification must prove both directions: `gardensModule.yieldResolver() == yieldResolver` and `yieldResolver.gardensModule() == gardensModule`.
- Reset/reinitialization recovery must clear stale yield pool wiring before a garden can be considered repaired.

## Coordination — Tier 5 Conviction Wiring (2026-05-03)

> **Read this before starting the UI lane.** Sibling Tier-5 conviction-voting wiring landed in commit `a8586c26 feat(shared,admin): conviction-voting wiring + GovernancePanel (Tier 5)`. It touches Community → Governance, so there are real adjacency points (none are conflicts; all are reuse opportunities or "don't duplicate" guardrails). No work in this hub's existing scope needs to change — this section just maps the surface area so the UI implementer doesn't trip over freshly-landed neighbors.

### What landed in conviction wiring

- `packages/shared/src/utils/conviction/{percent-points,derivation,index}.ts` — pure points↔percent translation + threshold/accrual derivation utilities. Tier-5 conservative defaults (`FALLBACK_POOL_CONFIG` in `useConvictionProposalsForPool`) document the exact contract reads still missing. **If a `useHypercertSignalPoolConfig()`-style hook lands as part of this hub or a follow-up, swap it into the adapter to retire the fallback.**
- `packages/shared/src/hooks/conviction/useConvictionProposalsForPool.ts` — composes registered hypercerts + weights + member power + metadata into the `ConvictionProposal[]` view-model.
- `packages/shared/src/hooks/conviction/useConvictionWeightAllocator.ts` — optimistic state container for the WeightAllocator (400ms debounce, computes signed deltas via `percentMapToSignedDeltas`).
- `packages/admin/src/views/Community/components/GovernancePanel.tsx` — net-new sibling to `GardenCommunityCard`. Mounted inside `CommunityTab` in the same `section === "governance"` block where this hub plans to surface wiring status. Filters `pools` to `PoolType.Hypercert`; renders `WeightAllocator` + `ProposalCardConviction` grid.
- `packages/admin/src/views/Community/components/CommunityTab.tsx:38` — `pools` prop tightened from `unknown` → `GardenSignalPool[]` (audit finding #8). Both the conviction panel and your wiring UI receive the typed pool list.

### Adjacency map for this hub's UI lane

1. **`GovernancePanel` already lives in `CommunityTab`'s governance section.** Your Change 6 (`GardenCommunityCard` wiring status) is upstream of it in the same render tree. Both consume `pools: GardenSignalPool[]`. No prop changes needed on either side; they coexist additively.

2. **Both surfaces use `PoolType.Hypercert` for typed pool identity** — no array-index assumptions on either side. If you change the typed-pool helper signature in `gardens-community.ts` or `useGardenPools`, the conviction adapter (`useConvictionProposalsForPool`) reads the same shape and will need the matching update.

3. **`useGardenSignalPoolWiring(gardenAddress)` is the most useful new hook for me.** Once it lands, I'd like to consume it from `GovernancePanel` to show an inline "yield routing connected" indicator above the `WeightAllocator` so members see "your votes will route yield correctly" before they commit weight. That's a follow-up after this hub merges — not a blocker on your delivery.

4. **`useCreateGardenPools` enhancement (Change 5)** — confirm the function signature stays a `() => void` mutation trigger from the consumer's POV. `CommunityWorkspaceContent` → `CommunityTab` passes it as a prop named `createPools`; renaming or changing arity would break the conviction-adjacent code path.

5. **Avoid duplicate yield-status displays** — your guardrail says "No duplicate repair UX in yield cards or detail cards." `GovernancePanel` does **not** display yield wiring status today, so no duplication. If a future iteration asks for it there, it should reuse `useGardenSignalPoolWiring` and route the repair action to the same `/community` destination per S10.

6. **i18n vocab** — `GovernancePanel` introduced 7 new keys under `cockpit.community.governance.*` in commit `a8586c26`. They've already been through `bun run lint:vocab` (clean). If your i18n additions touch the same `cockpit.community.*` namespace, sort alphabetically against the existing entries to keep the file diff-friendly.

### Things this hub could surface that would let me retire Tier-5 caveats

If easy and aligned with this hub's scope, exposing any of the following as part of state_api/ui would close known gaps in the conviction wiring (no obligation — flagging for opportunistic pickup):

- **Pool config reads** — `decayRate()`, `pointsPerVoter()`, member count for `HypercertSignalPool`. Any one of these lets me retire the corresponding TODO in `derivation.ts` and the `FALLBACK_POOL_CONFIG` in `useConvictionProposalsForPool`.
- **Per-member breakdown** — current `countSupporters` returns `1` if any weight present, `0` otherwise. A `useHypercertSupporters(poolAddress, hypercertId)` returning the distinct-voter count would replace it.
- **Threshold formula** — if the contract math is reverse-engineered for the wiring UI, port it into `deriveThreshold` in `derivation.ts` (the function signature is intentionally stable for a swap).

These are **out of this hub's stated scope** ("Out of scope: redesigning conviction pools") so no expectation. Just flagging.

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
| S2 | **Modify GardensModule to auto-wire (Path B)** | Add `yieldResolver` storage var + a typed `gardenHypercertSignalPools[garden]` mapping, then auto-call `setGardenHypercertPool(garden, hypercertPool)` inside `_createSignalPools()` after hypercert pool creation. Covers both mint path (`attemptPoolCreation`) and operator recovery path (`createGardenPools`). One extra proxy upgrade but eliminates the last manual step in garden lifecycle. |
| S3 | Frontend auto-chain as FALLBACK, not primary mechanism | With Path B, auto-wiring happens on-chain. Frontend `useCreateGardenPools` hook still verifies wiring succeeded and offers manual retry if the try/catch swallowed a failure. |
| S4 | Add garden TBA fallback in `_routeToJuicebox` and `_routeToCookieJar` for yield that would otherwise strand | Currently if `jbMultiTerminal == 0` AND `gardenTreasuries[garden] == 0`, yield strands (Yield.sol:767-769). The `_purchaseFraction` function already falls back to `garden` TBA (Yield.sol:739). Apply the same pattern everywhere. Eliminates need for `setGardenTreasury` calls in migration. |
| S5 | Migration script wires pools for any garden that already has pools but no yield wiring | For completeness — if any garden creates pools between now and the upgrade, backfill handles them. Use `SignalPoolCreated(..., PoolType.HypercertSignal, ...)` events as the primary source; array index is fallback-only for manual review. |
| S6 | Pool index is NOT reliable after trim — use typed state and the `hypercertPool` local variable directly | `_createSignalPools` (Gardens.sol:668-674) trims the array if one pool fails. If action pool fails but hypercert succeeds, `pools[0]` = hypercert pool, breaking the index assumption. Auto-wiring uses the local `hypercertPool` variable inside `_createSignalPools`; shared/admin reads the typed HypercertSignal mapping or event-derived type data instead of guessing by array position. |
| S7 | Set `gardenTreasuries` to garden TBA for all existing gardens in migration | Confirmed 2026-04-26. Belt-and-suspenders alongside S4. Even though S4 adds code fallback, setting the mapping avoids relying solely on code paths for existing gardens. New gardens get the code fallback automatically. |
| S8 | Validate pool address is a CVStrategy when setting | `setGardenHypercertPool` calls `ICVStrategy(pool).proposalCounter()` in a try/catch. If it reverts, reject with `InvalidPool`. Prevents misconfiguration. GardensModule skips this check (it just created the pool). |
| S9 | Operators can re-wire the pool after it's set | Confirmed 2026-04-26. Operators can already change split ratios. Pool re-wiring is less dangerous and may be needed if a CVStrategy is compromised or migrated. Owner retains override. |
| S10 | Primary reconnect UX lives in `/community`; other surfaces show compact status and deep-link there | Keeps the operator repair action in the existing pool-management workspace while still making yield wiring state visible wherever pool/yield health is surfaced. |
| S11 | Manual resolver wiring must match the GardensModule typed HypercertSignal pool when that mapping is set | `proposalCounter()` proves "CVStrategy", not "this garden's HypercertSignal pool". The manual path validates CVStrategy compatibility and, when `gardenHypercertSignalPools[garden]` is non-zero, requires `pool == expectedHypercertPool`. Migration sets the typed mapping before resolver backfill for existing gardens. |
| S12 | Upgrade scripts own cross-wiring, not deployment notes only | `Upgrade.s.sol` / `upgrade.ts` must expose a cross-wire step after YieldResolver and GardensModule upgrades, and `upgradeAll()` or the tx plan must include it before post-deploy verification. |
| S13 | Reset/reinit clears stale resolver wiring | `resetGardenInitialization()` clears local pool state and best-effort clears `yieldResolver.gardenHypercertPools[garden]` plus the typed HypercertSignal mapping, preventing yield from routing to an old pool during recovery. |

## Resolved Questions

| # | Question | Resolution |
|---|----------|------------|
| Q1 | Validate pool address? | Yes — lightweight `proposalCounter()` check. Skipped when caller is GardensModule (just created the pool). |
| Q2 | Allow operator re-wire? | Yes — same access as `setSplitRatio`. |
| Q3 | Multicall or two txs for frontend pool creation? | Path B makes this moot — auto-wiring is on-chain. Frontend only needs retry UI if auto-wire fails. |
| Q4 | How should migration identify the hypercert pool? | Use `SignalPoolCreated` events filtered to `PoolType.HypercertSignal`; only fall back to array review in manual/dry-run mode. |
| Q5 | Should migration set `gardenTreasuries[garden] = garden` for existing gardens? | Yes — keep the mapping backfill even with runtime TBA fallbacks. |
| Q6 | Where should the primary reconnect action live? | `/community`; garden detail/yield surfaces show compact status and route to the same repair flow. |
| Q7 | Is `proposalCounter()` enough validation? | No. It is necessary but not sufficient. Manual writes must also match the typed HypercertSignal pool recorded by GardensModule when available. |
| Q8 | Can shared/admin infer pool type by array index? | No. Shared/admin must read the typed HypercertSignal pool mapping or event/subgraph type data. Array order is display-only fallback, never yield-wiring truth. |

## Contract Changes

### Change 1: GardensModule — Add `yieldResolver` + auto-wire after pool creation

**File**: `packages/contracts/src/modules/Gardens.sol`

**Storage additions** (after line 131, before `__gap`):

```solidity
/// @notice YieldResolver for auto-wiring hypercert pools to yield routing
address public yieldResolver;

/// @notice Typed HypercertSignalPool per garden for validation and UI reads
mapping(address garden => address pool) public gardenHypercertSignalPools;
```

**Update storage gap** (line 134): `14 storage vars` → `16 storage vars`, `uint256[36]` → `uint256[34]`

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
    gardenHypercertSignalPools[garden] = hypercertPool;
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
    function gardensModule() external view returns (address);
}
```

**Update `isWiringComplete`** (line 310-318) — add yieldResolver and reverse-link check:

```solidity
if (yieldResolver == address(0)) return (false, "yieldResolver not set");
try IYieldResolver(yieldResolver).gardensModule() returns (address resolverGardensModule) {
    if (resolverGardensModule != address(this)) return (false, "yieldResolver.gardensModule mismatch");
} catch {
    return (false, "yieldResolver invalid");
}
```

**Typed pool setter for migration/backfill**:

```solidity
function setGardenHypercertSignalPool(address garden, address pool) external onlyOwner {
    if (pool != address(0) && !_isStoredSignalPool(garden, pool)) {
        revert PoolNotRegisteredForGarden(garden, pool);
    }
    emit GardenHypercertSignalPoolUpdated(garden, gardenHypercertSignalPools[garden], pool);
    gardenHypercertSignalPools[garden] = pool;
}
```

Use this only for migration/backfill and emergency correction. Normal new-garden and operator pool-repair flows set the mapping inside `_createSignalPools()`.

**Reset/reinit cleanup**:

`resetGardenInitialization(garden)` must delete `gardenHypercertSignalPools[garden]` and best-effort clear resolver wiring:

```solidity
delete gardenHypercertSignalPools[garden];
if (yieldResolver != address(0)) {
    try IYieldResolver(yieldResolver).setGardenHypercertPool(garden, address(0)) {}
    catch { emit YieldWiringFailed(garden, address(0)); }
}
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

**New view interface**:

```solidity
interface IGardensModuleYieldView {
    function gardenHypercertSignalPools(address garden) external view returns (address pool);
}
```

**Updated `setGardenHypercertPool`** (replaces lines 463-465):

```solidity
/// @notice Set the HypercertSignalPool (CVStrategy) address for a garden
/// @dev Three-tier access control:
///      1. GardensModule — auto-wires during pool creation (no validation, pool was just created)
///      2. Garden operators — self-service via admin UI (with CVStrategy + typed pool validation)
///      3. Protocol owner — emergency override (with CVStrategy + typed pool validation)
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

        // Stronger garden/type check when GardensModule has typed pool state.
        // Existing gardens get this mapping during migration before resolver backfill.
        if (gardensModule != address(0)) {
            try IGardensModuleYieldView(gardensModule).gardenHypercertSignalPools(garden) returns (
                address expectedPool
            ) {
                if (expectedPool != address(0) && expectedPool != pool) {
                    revert InvalidGardenPool(garden, pool, expectedPool);
                }
            } catch {
                revert InvalidPool(pool);
            }
        }
    }

    gardenHypercertPools[garden] = pool;
    emit GardenHypercertPoolUpdated(garden, pool);
}
```

**New error**: `error InvalidPool(address pool);`
**New error**: `error InvalidGardenPool(address garden, address pool, address expectedPool);`
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

### Change 5a: Stop classifying pools by array index

**Files**:
- `packages/shared/src/types/gardens-community.ts`
- `packages/shared/src/modules/data/gardens.ts`
- `packages/shared/src/hooks/conviction/useGardenPools.ts`

Rules:
- Align shared `PoolType` with Solidity `IGardensModule.PoolType` (`ActionSignal = 0`, `HypercertSignal = 1`) or introduce a separate UI enum that cannot be confused with the contract enum.
- `useGardenPools()` must not infer Hypercert vs Action from `getGardenSignalPools()` array index. If the hook cannot read type data, it returns untyped pool addresses plus the typed `gardenHypercertSignalPools(garden)` value.
- Subgraph mapping must use event/type data where available. `orderBy: poolId` is not sufficient proof of pool type.
- Admin yield wiring status reads `yieldResolver.gardenHypercertPools(garden)` and compares it to `gardensModule.gardenHypercertSignalPools(garden)`.

### Change 5: Verify wiring after pool creation — `useCreateGardenPools` enhancement

**File**: `packages/shared/src/hooks/conviction/useCreateGardenPools.ts`

With Path B, auto-wiring happens on-chain in `_createSignalPools`. The hook changes are:

1. After `createGardenPools()` tx confirms, query `yieldResolver.gardenHypercertPools(garden)`
2. Query `gardensModule.gardenHypercertSignalPools(garden)` as the expected HypercertSignal pool
3. If resolver pool matches expected pool and both are non-zero: show success ("Pools created and yield connected")
4. If the typed HypercertSignal pool exists but resolver pool is zero/mismatched: surface warning and offer manual "Connect to yield" button as fallback
5. If no typed HypercertSignal pool exists: do not guess by array index; surface "Pools need review" and link to `/community`
6. Manual fallback calls `yieldResolver.setGardenHypercertPool(garden, expectedHypercertPool)` — operator-callable after Change 2

**File**: `packages/shared/src/hooks/conviction/useSetGardenHypercertPool.ts` (NEW)

Mutation hook for manual/retry wiring. Used by:
- `useCreateGardenPools` (fallback if auto-wire failed)
- Admin UI (manual re-wiring to different CVStrategy)

**File**: `packages/shared/src/hooks/conviction/useGardenHypercertPool.ts` (NEW)

Read hook: `yieldResolver.gardenHypercertPools(garden)` — used for status display.

**File**: `packages/shared/src/hooks/conviction/useGardenSignalPoolWiring.ts` (NEW)

Combined read hook for admin/status surfaces. It returns:
- `expectedHypercertPool`: `gardensModule.gardenHypercertSignalPools(garden)`
- `resolverHypercertPool`: `yieldResolver.gardenHypercertPools(garden)`
- `status`: `connected | missing-pool | missing-resolver-wiring | mismatch | unknown`
- `canRetry`: true only when the expected HypercertSignal pool is non-zero and resolver wiring is zero or mismatched

### Change 6: Pool wiring status in admin Community tab

**File**: `packages/admin/src/components/Garden/GardenCommunityCard.tsx`

Primary write affordance: `/community`. Other admin pool/yield surfaces should show compact status and route operators back to this reconnect flow rather than creating duplicate repair UX.

Add yield wiring status indicator:
- If expected HypercertSignal pool exists AND resolver pool matches: Green dot + "Yield connected"
- If expected HypercertSignal pool exists AND resolver pool is zero/mismatched: Warning badge "Yield not connected" + "Connect to yield" button
- If pools exist but typed HypercertSignal pool is missing: Warning badge "Pool type needs review"; no automatic retry with guessed index
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
       a. Identify hypercert pool from SignalPoolCreated events filtered to
          PoolType.HypercertSignal
          (array index is fallback-only for manual/dry-run review)
       b. Check gardensModule.gardenHypercertSignalPools(garden)
       c. If zero or mismatched: call gardensModule.setGardenHypercertSignalPool(garden, hypercertPool)
          (owner-only migration setter; validates the pool is one of the stored signal pools)
       d. Check yieldResolver.gardenHypercertPools(garden)
       e. If zero or mismatched: call yieldResolver.setGardenHypercertPool(garden, hypercertPool)
       f. If already set and matched: skip (idempotent)

  2. Check yieldResolver.gardenTreasuries(garden)
     - If zero: call yieldResolver.setGardenTreasury(garden, garden)
       (sets garden TBA as treasury — belt-and-suspenders with code fallback)
     - If already set: skip

  3. Verify post-migration:
     - gardensModule.gardenHypercertSignalPools[garden] == expected pool address
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
  12. Verify:
      - gardensModule.yieldResolver() == yieldResolver
      - yieldResolver.gardensModule() == gardensModule
      - gardensModule.isWiringComplete() returns (true, "")

Phase 2c: Upgrade script guardrails (NEW)
  - `Upgrade.s.sol` exposes a cross-wire function that runs after both proxy upgrades.
  - `upgrade.ts` exposes a matching command or tx-plan step.
  - `upgradeAll()` either calls the cross-wire function after `upgradeYieldResolver()` and
    `upgradeGardensModule()` or prints a failing warning that the operator must run the
    cross-wire command before verification.

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
      ← NOW INCLUDES: bidirectional module references, typed HypercertSignal pool mapping,
        resolver gardenHypercertPools, gardenTreasuries, and explicit no-pool operator action list
  17. Deploy admin/shared app release
      ← NOW INCLUDES: Changes 5a, 5, 6, 7 (typed pool reads, wiring status, auto-verify, naming)

Phase 5: Activation gate (existing — no change)
  18. Confirm yield pipeline end-to-end
  19. Do not close the hub with unacknowledged gardens in the no-pool operator action list
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
- After: 16 storage vars (+ `yieldResolver`, + `gardenHypercertSignalPools`) + 34 gap = 50 slots ✓

### YieldResolver (UUPS proxy)
- Before: 18 storage vars + 32 gap = 50 slots
- After: 19 storage vars (+ `gardensModule`) + 31 gap = 50 slots ✓

Both maintain the 50-slot total. UUPS-safe.

## Test Additions

### Unit tests (YieldResolver)
- `setGardenHypercertPool` — GardensModule can set pool (no CVStrategy validation)
- `setGardenHypercertPool` — operator can set pool for their garden (with CVStrategy validation)
- `setGardenHypercertPool` — operator/manual path reverts when pool differs from `gardensModule.gardenHypercertSignalPools(garden)`
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
- `_createSignalPools` — records `gardenHypercertSignalPools[garden]` using the local `hypercertPool` variable, not array index
- `_createSignalPools` — emits `YieldWiringFailed` when auto-wire reverts (yield wiring failure doesn't break pool creation)
- `_createSignalPools` — skips auto-wire when `yieldResolver` is address(0) (testnet compatibility)
- `createGardenPools` — operator recovery path also auto-wires
- `setYieldResolver` — only owner can set
- `setGardenHypercertSignalPool` — owner can backfill only a pool stored for that garden
- `resetGardenInitialization` — clears typed HypercertSignal mapping and best-effort clears resolver mapping
- `isWiringComplete` — returns false when yieldResolver not set
- `isWiringComplete` — returns false when `yieldResolver.gardensModule()` is missing or mismatched

### Shared/admin tests
- `useGardenPools` — does not label Hypercert vs Action by trimmed array index
- `useGardenSignalPoolWiring` — reports `connected`, `missing-resolver-wiring`, `mismatch`, and `missing-pool`
- `useCreateGardenPools` — verifies resolver wiring against typed HypercertSignal mapping before showing success
- `GardenCommunityCard` — shows retry only when expected HypercertSignal pool is known
- `GardenYieldCard` or compact status surface — deep-links to `/community` when wiring is missing/mismatched

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
- `packages/contracts/script/Upgrade.s.sol` — Cross-wire YieldResolver ↔ GardensModule after proxy upgrades
- `packages/contracts/script/upgrade.ts` — Expose cross-wire command / tx-plan step
- `packages/shared/src/hooks/conviction/useCreateGardenPools.ts` — Change 5 (verify wiring, retry fallback)
- `packages/shared/src/hooks/conviction/useGardenPools.ts` — Change 5a (stop classifying pools by index)
- `packages/shared/src/modules/data/gardens.ts` — Change 5a (event/type-derived pool mapping only)
- `packages/shared/src/types/gardens-community.ts` — Align PoolType with Solidity or split UI enum from contract enum
- `packages/admin/src/components/Garden/GardenCommunityCard.tsx` — Change 6 (yield wiring status badge)
- `packages/admin/src/components/Garden/GardenYieldCard.tsx` — Compact wiring status/deep-link when yield fractions are not connected
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
- `packages/shared/src/hooks/conviction/useGardenSignalPoolWiring.ts` — Combined expected/resolver wiring status hook

### Files Unchanged
- `packages/contracts/src/modules/Octant.sol` — No changes beyond parent plan
- `packages/contracts/src/tokens/Garden.sol` — No changes (GardensModule handles wiring internally)
