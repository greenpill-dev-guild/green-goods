# Gardens V2 Interface Compatibility — Agent Teams Implementation Prompt

> **Source of truth**: `.plans/audits/2026-02-16-gardens-v2-interface-compatibility.md`
> **Cross-reference source**: `/Users/afo/Code/greenpill/gardens/` (real Gardens V2 repository)
> **Branch**: `feature/ens-integration`
> **Estimated scope**: ~12 files changed, ~400 LOC new, ~200 LOC deleted

---

## Goal

Fix all confirmed critical and medium interface compatibility issues between Green Goods conviction voting integration and the real Gardens V2 protocol. Every issue was verified against production source code in the sibling repository. Without these fixes, no voter can pass eligibility (C1), pool creation sends wrong enum values (C2), and both `createRegistryCommunity()` (C3) and `createPool()` (C4) call function signatures that don't exist on-chain.

---

## Lane Model

```
Lead (adversarial integrator)
├─ chain-driver         (contracts — C1, C2, C3, C4, M2, M3 fixes + tests)
├─ chain-observer       (contracts — review all interface changes against real source)
├─ middleware-driver    (shared — M1 ABI fix + hook verification)
├─ middleware-observer  (shared — review hook changes, verify ABI alignment)
├─ app-driver           (integration — cross-package build + E2E validation)
└─ app-observer         (integration — verify indexer schema + deployment artifacts)
```

Lane order follows dependency flow:
1. **Chain lane** — all contract fixes (must compile first, produces updated ABIs)
2. **Middleware lane** — shared hook ABI fix (needs updated ABIs from chain)
3. **App lane** — integration validation across all packages

---

## Preflight

```bash
bash .claude/scripts/check-agent-teams-readiness.sh
```

If preflight fails, fall back to subagents with the same lane ownership.

---

## Tasks

### Chain Lane (contracts) — `chain-driver` / `chain-observer`

> **Plan gate**: chain-driver MUST use `plan_mode_required` — contracts are expensive to fix and these changes touch core protocol interfaces.

#### Task 1: Fix `isMember()` in UnifiedPowerRegistry (C1 — Show-Stopper)
`[scope:contracts] [gate:required] [check:full]`

**Problem**: `isMember()` always returns `false` because it passes `address(0)` to `getMemberPowerInStrategy()`, which has no pool mapping.

**File**: `packages/contracts/src/registries/Power.sol:191-193`

**Current code**:
```solidity
function isMember(address _member) external view override returns (bool) {
    return this.getMemberPowerInStrategy(_member, address(0)) > 0;
}
```

**Fix**: Replace `address(0)` with `msg.sender`. The caller is always the CVStrategy (pool contract), which IS a registered pool in the `pool → garden → sources` mapping.
```solidity
function isMember(address _member) external view override returns (bool) {
    return this.getMemberPowerInStrategy(_member, msg.sender) > 0;
}
```

**Verification**: Real `CVAllocationFacet.sol:75` calls `isMember()` as Gate #1 — confirm by reading `/Users/afo/Code/greenpill/gardens/pkg/contracts/src/CVStrategy/facets/CVAllocationFacet.sol`.

**Tests to add** in `test/unit/UnifiedPowerRegistry.t.sol`:
- `test_isMember_usesCallerAsStrategy` — call from registered pool address, expect `true`
- `test_isMember_returnsFalseForNonMember` — call from registered pool for non-member, expect `false`
- `test_isMember_returnsFalseFromUnregisteredPool` — call from random address, expect `false`

---

#### Task 2: Fix `PointSystem` enum mismatch (C2)
`[scope:contracts] [gate:required] [check:full]`

**Problem**: Green Goods is missing `Quadratic` at index 3, making `Custom` = 3 instead of 4. When Green Goods sends `Custom=3` on-chain, real Gardens V2 decodes it as `Quadratic`.

**File**: `packages/contracts/src/interfaces/IGardensV2.sol`

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

**Verification**: Confirm against real enum at `/Users/afo/Code/greenpill/gardens/pkg/contracts/src/CVStrategy/ICVStrategy.sol`.

**Audit all references**: After the enum shift, every `PointSystem.Custom` reference in Green Goods now correctly resolves to 4. Search for:
- `PointSystem.Custom` in all `.sol` files
- Any hardcoded `3` that was meant to represent Custom
- Test assertions comparing enum values

**Tests to add** in `test/unit/GardensModule.t.sol`:
- `test_PointSystem_enumOrdinals` — verify `uint(PointSystem.Fixed)==0`, `Capped==1`, `Unlimited==2`, `Quadratic==3`, `Custom==4`

---

#### Task 3: Fix `createRegistryCommunity()` interface (C3)
`[scope:contracts] [gate:required] [check:full]`

**Problem**: Green Goods calls `createRegistryCommunity(CreateCommunityParams)` but the real factory exposes `createRegistry(RegistryCommunityInitializeParams)`. Different function name AND different struct (8 fields vs 12).

**Files**:
- `packages/contracts/src/interfaces/IGardensV2.sol` — rename function + rebuild struct
- `packages/contracts/src/modules/Gardens.sol` — update `_createCommunity()` call site

**Verification**: Confirm real signature at `/Users/afo/Code/greenpill/gardens/pkg/contracts/src/RegistryFactory/RegistryFactory.sol`.

**Struct comparison** — update `CreateCommunityParams` to match `RegistryCommunityInitializeParams`:

| Real Field | Type | Green Goods Equivalent | Action |
|------------|------|------------------------|--------|
| `_allo` | `address` | Missing | Add — use Allo protocol address |
| `_gardenToken` | `IERC20` | `gardenToken` (exists) | Keep, adjust type |
| `_minimumStakeAmount` | `uint256` | `stakeAmount` (exists) | Rename |
| `_communityFee` | `uint256` | Missing | Add — default 0 or configurable |
| `_nonce` | `uint256` | Missing | Add |
| `_registryFactory` | `address` | `registryFactory` (exists) | Keep |
| `_feeReceiver` | `address` | Missing | Add — use garden or treasury |
| `_metadata` | `Metadata` | Missing | Add — construct from garden data |
| `_councilSafe` | `address` | Missing | Add — use garden account or zero |
| `_communityName` | `string` | Missing | Add — derive from garden name |
| `_isKickEnabled` | `bool` | Missing | Add — default `false` |
| `_covenantIpfsHash` | `string` | Missing | Add — empty string or configurable |

**Implementation notes**:
- Some new fields can be hardcoded (e.g., `_isKickEnabled = false`, `_covenantIpfsHash = ""`)
- Others must be derived from existing garden data (e.g., `_communityName` from garden metadata)
- `_allo` address must come from deployment config or constructor param
- Consider adding new storage variables to `GardensModule` for fields like `allo`, `defaultCommunityFee`

---

#### Task 4: Fix `createPool()` signature (C4)
`[scope:contracts] [gate:required] [check:full]`

**Problem**: Green Goods calls `createPool(CreatePoolParams)` (single struct) but real `CommunityPoolFacet` exposes `createPool(address _strategy, CVStrategyInitializeParamsV0_3 memory _params, Metadata memory _metadata)` (3 separate args).

**Files**:
- `packages/contracts/src/interfaces/IGardensV2.sol` — replace `CreatePoolParams` with 3-arg signature
- `packages/contracts/src/modules/Gardens.sol` — update `_createPools()` call site

**Verification**: Confirm real signature at `/Users/afo/Code/greenpill/gardens/pkg/contracts/src/RegistryCommunity/facets/CommunityPoolFacet.sol`.

**Key decisions**:
- `_strategy` address: Does Green Goods deploy its own CVStrategy, or is one provided by the factory? Read the real `createPool()` implementation to determine if the strategy is deployed inside or must be pre-deployed.
- `CVStrategyInitializeParamsV0_3`: This is a complex struct (~12 fields including `cvParams`, `pointConfig`, `proposalType`, `pointSystem`, `arbitrableConfig`). Define it in `IGardensV2.sol` matching the real struct exactly.
- `Metadata`: Standard `(uint256 protocol, string pointer)` — construct from garden metadata.

**This task is coupled with Task 3** — both require rebuilding `IGardensV2.sol`. Implement together.

---

#### Task 5: Fix `PoolCreationFailed` event argument (M2)
`[scope:contracts] [gate:required] [check:quick]`

**Problem**: First argument emits `community` where event signature expects `garden`.

**File**: `packages/contracts/src/modules/Gardens.sol:617`

**Current code**:
```solidity
emit PoolCreationFailed(community, community, metadata);
```

**Fix**:
```solidity
emit PoolCreationFailed(garden, community, metadata);
```

**Verification**: Check event signature in `packages/contracts/src/interfaces/IGardensModule.sol` — first parameter is `address indexed garden`.

**Test**: Add assertion in `test/unit/GardensModule.t.sol` that `PoolCreationFailed` event's first indexed param matches the garden address, not community.

---

#### Task 6: Wire GOODS token minter role in deployment (M3)
`[scope:contracts] [gate:required] [check:quick]`

**Problem**: `GardensModule.onGardenMinted()` calls `goodsToken.mint()` to seed treasury, but `GardensModule` is never granted the minter role during deployment wiring.

**Files**:
- `packages/contracts/script/DeployHelper.sol` — add `goodsToken.grantMinterRole(address(gardensModule))` in wiring step
- `packages/contracts/test/helpers/DeploymentBase.sol` — same wiring in test deployment

**Verification**: Search for existing `grantMinterRole` calls in both files to find the correct insertion point and follow the existing pattern.

**Test**: Add `test_gardensModule_canMintGoodsToken` in `test/unit/GardensModule.t.sol` — verify mint succeeds after proper wiring.

---

#### Task 7: Update all mocks and E2E tests for new interfaces
`[scope:contracts] [gate:required] [check:full]`

**Problem**: After Tasks 2-4, mocks and E2E tests reference old interfaces (old enum, old function names, old struct shapes).

**Files to update**:
- `packages/contracts/src/mocks/CVStrategy.sol` — may need PointSystem update
- `packages/contracts/src/mocks/GardensV2.sol` — must match new `createRegistry()` + 3-arg `createPool()` signatures
- `packages/contracts/test/E2EConvictionVoting.t.sol` — update mock setup, verify all 7 E2E tests pass
- `packages/contracts/test/unit/GardensModule.t.sol` — update mock contracts used in 55+ tests
- `packages/contracts/test/integration/*.t.sol` — any integration tests referencing old interfaces

**Strategy**: Update mocks first, then fix compilation errors in tests, then run full suite.

**Final validation**:
```bash
cd packages/contracts && bun run test           # All unit tests pass
cd packages/contracts && bun run test:e2e:workflow  # E2E conviction flow passes
```

---

### Middleware Lane (shared package) — `middleware-driver` / `middleware-observer`

> **Blocked by**: Chain lane Tasks 1-4 (needs updated ABIs to verify function names)

#### Task 8: Fix `STAKE_AMOUNT_PER_MEMBER` function name (M1)
`[scope:middleware] [gate:required] [check:full]`

**Problem**: Hook calls `"STAKE_AMOUNT_PER_MEMBER"` but Solidity generates `stakeAmountPerMember()` as the getter for `public` storage variables.

**File**: `packages/shared/src/hooks/conviction/useGardenCommunity.ts:110`

**Current code**:
```typescript
readContract(wagmiConfig, {
  address: gardensModule,
  abi: GARDENS_MODULE_ABI,
  functionName: "STAKE_AMOUNT_PER_MEMBER",
  chainId,
}),
```

**Fix**:
```typescript
functionName: "stakeAmountPerMember",
```

**Also verify**: Check `packages/shared/src/utils/blockchain/abis.ts` — the `GARDENS_MODULE_ABI` entry must also use `stakeAmountPerMember`. If the ABI was auto-generated from the compiled contract, it should already be correct and the hook is the only broken reference.

**Test**: If `packages/shared/src/__tests__/hooks/conviction/` has existing tests for `useGardenCommunity`, update them. If not, add a focused test verifying the correct function name is used in the contract read call.

---

#### Task 9: Fix misleading comment in `useCreateGardenPools`
`[scope:middleware] [gate:advisory] [check:quick]`

**File**: `packages/shared/src/hooks/conviction/useCreateGardenPools.ts:18`

**Problem**: Comment says "In v14, pools are no longer created during mint" but pools ARE auto-created during mint via `GardensModule.onGardenMinted()`. This misleads future developers.

**Fix**: Update comment to accurately describe current behavior — pools are auto-created during mint; this hook handles manual pool creation for cases where auto-creation failed (recovery flow).

---

#### Task 10: Verify shared types align with updated contracts
`[scope:middleware] [gate:advisory] [check:quick]`

**Files to check**:
- `packages/shared/src/types/gardens-community.ts` — verify `WeightScheme`, `PoolType` enums match updated Solidity
- `packages/shared/src/modules/data/gardens.ts` — verify GraphQL queries reference correct field names
- `packages/shared/src/utils/blockchain/abis.ts` — verify ABI entries match post-fix contract interfaces

No changes expected unless the chain lane modified enum values or function signatures that propagate to TypeScript types.

---

### App Lane (integration validation) — `app-driver` / `app-observer`

> **Blocked by**: Chain lane + Middleware lane completion

#### Task 11: Cross-package build validation
`[scope:integration] [gate:required] [check:full]`

Run full build pipeline to verify no cross-package breakage:

```bash
# 1. Contracts build (produces updated ABIs)
cd packages/contracts && bun build

# 2. Shared package type-check
cd packages/shared && bunx tsc --noEmit

# 3. Full workspace build
bun build

# 4. Full workspace lint
bun format && bun lint

# 5. Full workspace tests
bun run test
```

Report any failures to lead with file + line + error.

---

#### Task 12: Verify deployment artifacts consistency
`[scope:integration] [gate:advisory] [check:quick]`

Check that deployment JSONs are consistent after contract changes:

- `packages/contracts/deployments/42161-latest.json` — Arbitrum
- `packages/contracts/deployments/11155111-latest.json` — Sepolia
- `packages/contracts/deployments/42220-latest.json` — Celo

Verify:
- `gardensModule` and `unifiedPowerRegistry` fields exist (even if zero address — that just means not yet deployed)
- No stale references to removed structs/functions in deployment scripts
- `packages/contracts/script/Deploy.s.sol` and `script/DeployHelper.sol` compile with updated interfaces

---

#### Task 13: Verify indexer schema compatibility
`[scope:indexer] [gate:advisory] [check:quick]`

Check that the indexer handles the updated event signature:
- `packages/indexer/schema.graphql` — does it reference `PoolCreationFailed`? If so, verify field order matches the fixed event (M2)
- `packages/indexer/src/EventHandlers.ts` — any handler for `PoolCreationFailed` must destructure `garden` as first arg, not `community`
- `packages/indexer/config.yaml` — verify GardensModule ABI reference is up to date

---

## Integration Validation

After all lanes complete, lead runs integration checks:

1. **Contract tests**: `cd packages/contracts && bun run test` (all unit tests pass)
2. **E2E tests**: `cd packages/contracts && bun run test:e2e:workflow` (conviction flow passes)
3. **Full build**: `bun build` (root — respects dependency order)
4. **Lint**: `bun format && bun lint`
5. **All tests**: `bun run test` (all packages)
6. **Type check**: `cd packages/shared && bunx tsc --noEmit`
7. **Enum audit**: Grep for any hardcoded `3` or `PointSystem.Custom` references that may have shifted
8. **Interface audit**: Verify `IGardensV2.sol` function signatures match real Gardens V2 exactly
9. **ABI audit**: Verify `GARDENS_MODULE_ABI` in shared matches compiled contract output
10. **Architectural rules**: Check Rules 4, 5, 12, 14 from `.claude/rules/architectural-rules.md`

---

## Key Architecture Decisions (Non-Negotiable)

These decisions are **final** — do not re-litigate during implementation:

1. **`msg.sender` for isMember()** — The caller is always CVStrategy (the pool). This is the correct routing key for `UnifiedPowerRegistry`'s `pool → garden → sources` mapping. Do NOT use a new parameter or storage variable.

2. **Enum must match exactly** — `PointSystem` enum ordinals are ABI-encoded as raw integers. Any mismatch means on-chain data is decoded differently. Mirror the real enum exactly, including `Quadratic` at index 3.

3. **Match real signatures, don't abstract** — `createRegistry()` and `createPool()` must use the **exact** function names and parameter types from real Gardens V2. Do not create wrapper functions or adapter patterns that obscure the real interface.

4. **Non-blocking try/catch preserved** — `GardensModule.onGardenMinted()` wraps all module callbacks in try/catch. Garden mint must never revert. This pattern is correct and must be preserved through all interface changes.

5. **Mocks are test-only** — `MockCVStrategy`, `MockRegistryFactory` etc. are for unit/E2E tests only. They should be updated to match new interfaces but don't need to implement full Gardens V2 logic (e.g., exponential decay conviction formula).

6. **One deployment script** — All deployment wiring changes (M3: minter role) go in `DeployHelper.sol`, not a new script.

---

## Reference Files

Read these files before starting implementation:

| File | Purpose |
|------|---------|
| `.plans/audits/2026-02-16-gardens-v2-interface-compatibility.md` | **Complete audit** — all issues, evidence chains, fix descriptions |
| `packages/contracts/src/registries/Power.sol` | UnifiedPowerRegistry — C1 fix location |
| `packages/contracts/src/interfaces/IGardensV2.sol` | C2, C3, C4 — enum + interface fixes |
| `packages/contracts/src/modules/Gardens.sol` | C3, C4, M2 — call site updates + event fix |
| `packages/contracts/src/interfaces/IGardensModule.sol` | Event signatures, WeightScheme enum |
| `packages/contracts/script/DeployHelper.sol` | M3 — deployment wiring for minter role |
| `packages/contracts/test/helpers/DeploymentBase.sol` | Test deployment — must mirror wiring |
| `packages/contracts/test/unit/UnifiedPowerRegistry.t.sol` | C1 tests to add |
| `packages/contracts/test/unit/GardensModule.t.sol` | C2-C4, M2 tests to update |
| `packages/contracts/test/E2EConvictionVoting.t.sol` | E2E tests — must pass after all fixes |
| `packages/contracts/src/mocks/GardensV2.sol` | Mock factory — must match new interfaces |
| `packages/contracts/src/mocks/CVStrategy.sol` | Mock strategy — may need enum update |
| `packages/shared/src/hooks/conviction/useGardenCommunity.ts` | M1 — ABI function name fix |
| `packages/shared/src/utils/blockchain/abis.ts` | Verify ABI entries match |
| `CLAUDE.md` | Project architecture, patterns, anti-patterns |
| `.claude/rules/architectural-rules.md` | 14 rules to enforce |

### Real Gardens V2 Reference Files (read-only, for interface verification)

| File | What to verify |
|------|----------------|
| `/Users/afo/Code/greenpill/gardens/pkg/contracts/src/CVStrategy/facets/CVAllocationFacet.sol` | C1: `isMember()` is Gate #1 at line 75 |
| `/Users/afo/Code/greenpill/gardens/pkg/contracts/src/CVStrategy/ICVStrategy.sol` | C2: `PointSystem` enum with `Quadratic=3, Custom=4` |
| `/Users/afo/Code/greenpill/gardens/pkg/contracts/src/RegistryFactory/RegistryFactory.sol` | C3: `createRegistry()` function + `RegistryCommunityInitializeParams` struct |
| `/Users/afo/Code/greenpill/gardens/pkg/contracts/src/RegistryCommunity/facets/CommunityPoolFacet.sol` | C4: 3-arg `createPool()` signature |
| `/Users/afo/Code/greenpill/gardens/pkg/contracts/src/NFTPowerRegistry.sol` | C1: How real `isMember()` works (ignores `_strategy`) |
| `/Users/afo/Code/greenpill/gardens/pkg/contracts/src/interfaces/IVotingPowerRegistry.sol` | C1: 4-function interface spec |
