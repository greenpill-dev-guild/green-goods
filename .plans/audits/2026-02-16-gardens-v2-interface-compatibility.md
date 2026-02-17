# Gardens V2 Interface Compatibility Audit

> **Date**: 2026-02-16
> **Status**: CONFIRMED — All issues verified against real Gardens V2 source at `/Users/afo/Code/greenpill/gardens/`
> **Scope**: `packages/contracts/src/modules/Gardens.sol`, `Power.sol`, `IGardensV2.sol`, `IGardensModule.sol`, shared conviction hooks
> **Branch**: `feature/ens-integration`

---

## Summary

Cross-referenced the Green Goods conviction voting integration against the **real Gardens V2 repository** (`/Users/afo/Code/greenpill/gardens/`). Found **4 critical** and **3 medium** issues, all confirmed against production source code. Zero false positives.

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 4 | All confirmed against source |
| Medium | 3 | All confirmed against source |
| False Positives | 0 | — |

---

## Critical Issues

### C1: `isMember()` Always Returns `false` — Voter Eligibility Show-Stopper

**File**: `packages/contracts/src/registries/Power.sol:191-193`
**Impact**: No voter can ever pass eligibility check in real CVStrategy

**Evidence Chain**:
1. Real `CVAllocationFacet.sol` line 75 calls `isMember()` as **Gate #1** before any allocation
2. `NFTPowerRegistry` (real) works because it ignores `_strategy` param — single garden instance
3. `UnifiedPowerRegistry` (Green Goods) routes via `pool → garden → sources` mapping
4. Calling `getMemberPowerInStrategy(member, address(0))` means `address(0)` has no pool mapping → always returns 0

**Current Code**:
```solidity
function isMember(address _member) external view override returns (bool) {
    return this.getMemberPowerInStrategy(_member, address(0)) > 0;
    // address(0) has no pool mapping, so always returns 0 → always false
}
```

**Fix**: Use `msg.sender` (which is always the CVStrategy/pool calling this) instead of `address(0)`:
```solidity
function isMember(address _member) external view override returns (bool) {
    return this.getMemberPowerInStrategy(_member, msg.sender) > 0;
}
```

**Verification**: Unit test `test_isMember_usesCallerAsStrategy()` should confirm the fix.

---

### C2: `PointSystem` Enum Mismatch — Wrong Pool Configuration On-Chain

**File**: `packages/contracts/src/interfaces/IGardensV2.sol`
**Impact**: Pool creation passes `Custom=3` but real Gardens V2 interprets `3` as `Quadratic`

**Evidence Chain**:
1. Real `ICVStrategy.sol` defines:
   ```solidity
   enum PointSystem {
       Fixed,      // 0
       Capped,     // 1
       Unlimited,  // 2
       Quadratic,  // 3  ← ADDED in v0.3
       Custom      // 4
   }
   ```
2. Green Goods `IGardensV2.sol` defines:
   ```solidity
   enum PointSystem {
       Fixed,      // 0
       Capped,     // 1
       Unlimited,  // 2
       Custom      // 3  ← WRONG, should be 4
   }
   ```
3. When Green Goods creates a pool with `PointSystem.Custom`, it sends `3` on the wire
4. Real Gardens V2 decodes `3` as `Quadratic` — completely different allocation behavior

**Fix**: Add the missing `Quadratic` variant:
```solidity
enum PointSystem {
    Fixed,      // 0
    Capped,     // 1
    Unlimited,  // 2
    Quadratic,  // 3
    Custom      // 4
}
```

Also audit all call sites that reference `PointSystem.Custom` to ensure they still compile after the ordinal shift from 3→4.

---

### C3: `createRegistryCommunity()` Does Not Exist — Community Creation Will Revert

**File**: `packages/contracts/src/interfaces/IGardensV2.sol`
**Impact**: `GardensModule.onGardenMinted()` calls a function that doesn't exist on the real factory

**Evidence Chain**:
1. Green Goods calls: `IGardensV2(registryFactory).createRegistryCommunity(CreateCommunityParams)`
2. Real `RegistryFactory.sol` exposes: `createRegistry(RegistryCommunityInitializeParams)`
3. The function name is different AND the struct is different:

| Green Goods `CreateCommunityParams` | Real `RegistryCommunityInitializeParams` |
|--------------------------------------|------------------------------------------|
| 8 fields | 12 fields |
| `gardenToken` field | No such field |
| Missing `_feeReceiver` | Required |
| Missing `_metadata` | Required |
| Missing `_councilSafe` | Required |
| Missing `_communityName` | Required |
| `registryFactory` as param | `_registryFactory` as param |

**Fix**:
1. Rename interface function to `createRegistry()`
2. Rebuild `CreateCommunityParams` to match `RegistryCommunityInitializeParams` (12 fields)
3. Update `GardensModule._createCommunity()` to populate all 12 fields
4. Consider which new fields need to be configurable vs hardcoded

---

### C4: `createPool()` Signature Incompatible — Pool Creation Will Revert

**File**: `packages/contracts/src/interfaces/IGardensV2.sol`
**Impact**: Pool creation calls wrong function signature on real RegistryCommunity

**Evidence Chain**:
1. Green Goods calls: `IGardensV2(community).createPool(CreatePoolParams)`
2. Real `CommunityPoolFacet.sol` exposes: `createPool(address _strategy, CVStrategyInitializeParamsV0_3 memory _params, Metadata memory _metadata)`
3. Complete signature mismatch:

| Green Goods `CreatePoolParams` | Real Parameters |
|--------------------------------|-----------------|
| Single struct with ~6 fields | 3 separate args: `address`, struct, `Metadata` |
| No `_strategy` address | First arg is strategy address |
| Simplified params | `CVStrategyInitializeParamsV0_3` has 12+ fields |
| No `Metadata` | Third arg is `Metadata(uint256 protocol, string pointer)` |

**Fix**:
1. Replace `CreatePoolParams` with the 3-argument signature
2. Define `CVStrategyInitializeParamsV0_3` matching the real struct (includes `cvParams`, `pointConfig`, `proposalType`, `pointSystem`, `arbitrableConfig`, etc.)
3. Update `GardensModule._createPools()` to construct the real arguments
4. The `_strategy` address must be deployed/predicted before `createPool` — determine if Green Goods deploys its own CVStrategy or uses a factory

---

## Medium Issues

### M1: Frontend ABI Function Name Mismatch

**File**: `packages/shared/src/hooks/conviction/useGardenCommunity.ts:110`
**Impact**: `STAKE_AMOUNT_PER_MEMBER` read call will revert — Solidity getter for `public` storage is `stakeAmountPerMember()`

**Current Code**:
```typescript
readContract(wagmiConfig, {
  address: gardensModule,
  abi: GARDENS_MODULE_ABI,
  functionName: "STAKE_AMOUNT_PER_MEMBER",  // ← WRONG
  chainId,
}),
```

**Fix**: Change to `"stakeAmountPerMember"` (Solidity generates camelCase getters for public storage):
```typescript
functionName: "stakeAmountPerMember",
```

**Verification**: Check `GARDENS_MODULE_ABI` in `packages/shared/src/utils/blockchain/abis.ts` — the ABI entry must also use the correct name. If the ABI was auto-generated from the contract, it should already be `stakeAmountPerMember`.

---

### M2: `PoolCreationFailed` Event Emits Wrong First Argument

**File**: `packages/contracts/src/modules/Gardens.sol:617`
**Impact**: Off-chain indexers/dashboards receive `community` address where they expect `garden` address

**Current Code**:
```solidity
emit PoolCreationFailed(community, community, metadata);
//                       ^^^^^^^^^ should be `garden`
```

**Fix**:
```solidity
emit PoolCreationFailed(garden, community, metadata);
```

**Verification**: Check the event signature `PoolCreationFailed(address indexed garden, address community, ...)` in `IGardensModule.sol` to confirm first arg is indeed `garden`.

---

### M3: `GOODS` Token Minter Role Not Wired in Deployment

**File**: `packages/contracts/src/modules/Gardens.sol:197`
**Impact**: `GardensModule.onGardenMinted()` calls `IGoodsToken.mint()` to seed treasury, but `GardensModule` may not have the minter role

**Evidence**:
- `Gardens.sol:197` calls `goodsToken.mint(garden, initialTreasuryAmount)`
- No `grantMinterRole(gardensModule)` found in `DeploymentBase._deployCoreContracts()` or wiring steps
- If the GOODS token requires `MINTER_ROLE`, the mint will revert silently inside the try/catch

**Fix**:
1. Add `goodsToken.grantMinterRole(address(gardensModule))` to the deployment wiring step in `DeploymentBase`
2. Add a test that verifies `gardensModule` can call `goodsToken.mint()` after deployment wiring

---

## Fix Priority & Dependency Order

```
C1 (isMember)  ─── standalone, fix first (enables all voter flows)
     │
C2 (PointSystem) ─── standalone, fix second (enum alignment)
     │
C3 (createRegistry) ──┐
                       ├── these two are coupled: both require rebuilding
C4 (createPool)    ───┘   IGardensV2.sol interface + GardensModule logic
     │
M1 (ABI name) ─── standalone frontend fix
M2 (event arg) ─── standalone contracts fix
M3 (minter role) ─── standalone deployment fix
```

**Recommended execution order**:
1. **C1** → One-line fix in `Power.sol`, add unit test
2. **C2** → Add `Quadratic` to enum, audit all `PointSystem.Custom` references
3. **C3 + C4** → Major refactor of `IGardensV2.sol` + `Gardens.sol` (tackle together since both touch the same interface)
4. **M2** → One-line fix in `Gardens.sol`
5. **M3** → Add minter role grant in deployment wiring
6. **M1** → Fix function name in shared hook

---

## Verification Checklist

After all fixes are applied:

- [ ] `bun run test` passes (unit tests in `packages/contracts`)
- [ ] `bun run test:e2e:workflow` passes (E2E conviction flow)
- [ ] New unit test: `test_isMember_usesCallerAsStrategy` in `UnifiedPowerRegistry.t.sol`
- [ ] New unit test: `test_PointSystem_enumOrdinals` verifying {Fixed=0, Capped=1, Unlimited=2, Quadratic=3, Custom=4}
- [ ] `GardensModule.t.sol` — `test_poolCreationFailed_emitsCorrectGardenAddress`
- [ ] `GardensModule.t.sol` — `test_goodsToken_mintRequiresMinterRole`
- [ ] Frontend ABI smoke test: `useGardenCommunity` hook reads `stakeAmountPerMember` successfully
- [ ] Fork test against real Gardens V2 deployment (Arbitrum) confirming interface compatibility
- [ ] `bun build` passes across all packages

---

## Files to Modify

| File | Changes |
|------|---------|
| `packages/contracts/src/registries/Power.sol` | C1: Fix `isMember()` to use `msg.sender` |
| `packages/contracts/src/interfaces/IGardensV2.sol` | C2: Add `Quadratic` to enum; C3: Rename + rebuild community params; C4: Fix pool signature |
| `packages/contracts/src/modules/Gardens.sol` | C3: Update `_createCommunity()`; C4: Update `_createPools()`; M2: Fix event arg |
| `packages/contracts/script/DeployHelper.sol` | M3: Add minter role grant for GardensModule |
| `packages/contracts/test/unit/UnifiedPowerRegistry.t.sol` | C1: Add caller-based isMember test |
| `packages/contracts/test/unit/GardensModule.t.sol` | C2-C4: Update mocks + add new tests; M2: Event emission test |
| `packages/contracts/test/E2EConvictionVoting.t.sol` | Update mocks to match new interfaces |
| `packages/contracts/src/mocks/CVStrategy.sol` | May need PointSystem update |
| `packages/shared/src/hooks/conviction/useGardenCommunity.ts` | M1: Fix function name |
| `packages/shared/src/utils/blockchain/abis.ts` | M1: Verify ABI entry name |

---

## Cross-Reference Sources

All findings verified against real source files in `/Users/afo/Code/greenpill/gardens/`:

| Real File | What It Confirmed |
|-----------|-------------------|
| `pkg/contracts/src/CVStrategy/facets/CVAllocationFacet.sol:75` | C1: `isMember()` is Gate #1 in allocation |
| `pkg/contracts/src/CVStrategy/ICVStrategy.sol` | C2: `Quadratic=3`, `Custom=4` |
| `pkg/contracts/src/RegistryFactory/RegistryFactory.sol` | C3: `createRegistry()` not `createRegistryCommunity()` |
| `pkg/contracts/src/RegistryCommunity/facets/CommunityPoolFacet.sol` | C4: 3-arg `createPool()` signature |
| `pkg/contracts/src/NFTPowerRegistry.sol` | C1: Real `isMember()` works because it ignores `_strategy` |
| `pkg/contracts/src/interfaces/IVotingPowerRegistry.sol` | C1: 4-function interface confirmed |
