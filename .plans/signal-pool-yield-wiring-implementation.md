# Signal Pool → Yield Wiring: Implementation Prompt

**Plan**: `.plans/signal-pool-yield-wiring.todo.md`
**Parent**: `.plans/vault-strategy-autoallocate-fix.todo.md`

## Stream 1: Contract Changes (Solidity — TDD)

### Context
Read the full plan at `.plans/signal-pool-yield-wiring.todo.md` before starting. This stream implements Changes 1-4 (contract modifications) with strict TDD.

### Task

Implement the following contract changes using test-driven development. Write failing tests FIRST, then implement the production code to make them pass.

#### 1A: GardensModule — Add `yieldResolver` + auto-wire

**File**: `packages/contracts/src/modules/Gardens.sol`

1. Add `address public yieldResolver;` storage variable after `communityCouncilSafe` (line 131)
2. Update `__gap` from `uint256[36]` to `uint256[35]` (line 135) — maintain 50-slot total (15 vars + 35 gap)
3. Add inline interface at top of file (do NOT import from Octant.sol — avoid circular dependency):
   ```solidity
   interface IYieldResolver {
       function setGardenHypercertPool(address garden, address pool) external;
   }
   ```
4. Add setter in Admin Functions section (after `setCommunityCouncilSafe`):
   ```solidity
   function setYieldResolver(address _yieldResolver) external onlyOwner {
       emit ConfigUpdated("yieldResolver", yieldResolver, _yieldResolver);
       yieldResolver = _yieldResolver;
   }
   ```
5. Add event: `event YieldWiringFailed(address indexed garden, address indexed pool);`
6. In `_createSignalPools()`, after the hypercert pool is created and the `SignalPoolCreated` event is emitted (inside the `if (hypercertPool != address(0))` block at ~line 662-665), add:
   ```solidity
   // Auto-wire hypercert pool to YieldResolver for conviction-weighted yield routing
   if (yieldResolver != address(0)) {
       try IYieldResolver(yieldResolver).setGardenHypercertPool(garden, hypercertPool) {}
       catch { emit YieldWiringFailed(garden, hypercertPool); }
   }
   ```
7. Update `isWiringComplete()` (line 310-318) to check yieldResolver:
   ```solidity
   if (yieldResolver == address(0)) return (false, "yieldResolver not set");
   ```

#### 1B: YieldResolver — `gardensModule` ref + access control + TBA fallback

**File**: `packages/contracts/src/resolvers/Yield.sol`

1. Add `address public gardensModule;` storage variable after existing module refs (after `assetYieldThresholds` mapping, before `__gap`)
2. Update `__gap` from `uint256[32]` to `uint256[31]` — maintain 50-slot total (19 vars + 31 gap)
3. Update the storage gap comment (line 188-193) to include `gardensModule` in the var list
4. Add setter:
   ```solidity
   function setGardensModule(address _gardensModule) external onlyOwner {
       gardensModule = _gardensModule;
   }
   ```
5. Add new errors/events:
   ```solidity
   error InvalidPool(address pool);
   event GardenHypercertPoolUpdated(address indexed garden, address indexed pool);
   event GardenTreasuryUpdated(address indexed garden, address indexed treasury);
   event YieldToTreasury(address indexed garden, address indexed asset, uint256 amount, address treasury, string source);
   ```
6. Replace `setGardenHypercertPool` (lines 463-465) with three-tier access:
   ```solidity
   function setGardenHypercertPool(address garden, address pool) external {
       bool isGardensModuleCall = (msg.sender == gardensModule && gardensModule != address(0));
       if (!isGardensModuleCall && msg.sender != owner()) {
           _requireOperatorOrOwner(garden);
       }
       if (pool != address(0) && !isGardensModuleCall) {
           try ICVStrategy(pool).proposalCounter() returns (uint256) {}
           catch { revert InvalidPool(pool); }
       }
       gardenHypercertPools[garden] = pool;
       emit GardenHypercertPoolUpdated(garden, pool);
   }
   ```
7. Replace `setGardenTreasury` (lines 371-373) with operator access:
   ```solidity
   function setGardenTreasury(address garden, address treasury) external {
       if (msg.sender != owner()) {
           _requireOperatorOrOwner(garden);
       }
       if (treasury == address(0)) revert ZeroAddress();
       gardenTreasuries[garden] = treasury;
       emit GardenTreasuryUpdated(garden, treasury);
   }
   ```
8. Apply garden TBA fallback in THREE locations:
   - `_routeToCookieJar` (lines 553-561): Replace strand path with TBA fallback
   - `_routeToJuicebox` no-config path (lines 762-770): Replace strand with TBA fallback
   - `_routeToJuicebox` catch path (lines 789-795): Replace strand with TBA fallback

   Pattern for all three:
   ```solidity
   address treasury = gardenTreasuries[garden];
   if (treasury == address(0)) treasury = garden; // Fallback to garden TBA
   IERC20(asset).safeTransfer(treasury, amount);
   emit YieldToTreasury(garden, asset, amount, treasury, "<source>");
   ```

#### 1C: DeploymentBase — Cross-wire references

**File**: `packages/contracts/test/helpers/DeploymentBase.sol`

After existing module wiring (look for where `yieldSplitter.setCookieJarModule` is called), add:
```solidity
// Wire GardensModule ↔ YieldResolver for auto pool-to-yield wiring
yieldSplitter.setGardensModule(address(gardensModule));
gardensModule.setYieldResolver(address(yieldSplitter));
```

### Tests to write FIRST (before implementation)

**File**: `packages/contracts/test/unit/YieldSplitter.t.sol` (extend existing)

Access control tests:
- `test_setGardenHypercertPool_gardensModule_succeeds` — GardensModule can set pool
- `test_setGardenHypercertPool_gardensModule_skipsValidation` — No CVStrategy check for GardensModule
- `test_setGardenHypercertPool_operator_succeeds` — Operator sets pool for their garden
- `test_setGardenHypercertPool_operator_validatesPool` — Invalid pool reverts with `InvalidPool`
- `test_setGardenHypercertPool_nonOperator_reverts` — Random address reverts `UnauthorizedCaller`
- `test_setGardenHypercertPool_owner_succeeds` — Owner overrides for any garden
- `test_setGardenHypercertPool_zeroAddress_clearsPool` — Setting 0x0 reverts to escrow mode
- `test_setGardenHypercertPool_emitsEvent` — Emits `GardenHypercertPoolUpdated`
- `test_setGardenTreasury_operator_succeeds` — Operator sets treasury
- `test_setGardenTreasury_zeroAddress_reverts` — Cannot set zero treasury
- `test_setGardensModule_onlyOwner` — Only owner can set

TBA fallback tests:
- `test_routeToJuicebox_fallsBackToGardenTBA` — No JB + no treasury → garden TBA receives
- `test_routeToJuicebox_catchFallsBackToGardenTBA` — JB fails + no treasury → garden TBA
- `test_routeToCookieJar_fallsBackToGardenTBA` — No jar + no treasury → garden TBA
- `test_routeToJuicebox_prefersExplicitTreasury` — Treasury set → uses treasury, not TBA
- `test_yieldNeverStrands` — No strand events when garden TBA is valid ERC-6551

**File**: `packages/contracts/test/unit/GardensModule.t.sol` (extend existing)

- `test_createSignalPools_autoWiresYieldResolver` — After pool creation, `gardenHypercertPools[garden]` is set
- `test_createSignalPools_emitsYieldWiringFailed_onRevert` — If YieldResolver reverts, event emitted, pools still created
- `test_createSignalPools_skipsWire_whenNoYieldResolver` — yieldResolver=0x0 → no revert, no wire
- `test_createGardenPools_operatorPath_alsoAutoWires` — Operator calling createGardenPools() also wires yield
- `test_setYieldResolver_onlyOwner`
- `test_isWiringComplete_checksYieldResolver`

### Validation
After implementation: `cd packages/contracts && bun run test` (unit tests must pass).
Do NOT run `bun test` or raw `forge test`. Use `bun run test`.

---

## Stream 2: Frontend Changes (React/TypeScript)

### Context
Read the full plan at `.plans/signal-pool-yield-wiring.todo.md`, specifically Changes 5-7.

### Task

#### 2A: New hooks

**File**: `packages/shared/src/hooks/conviction/useGardenHypercertPool.ts` (CREATE)

Read hook that queries `yieldResolver.gardenHypercertPools(garden)`. Pattern:
- Use `useReadContract` from wagmi
- Query key: `queryKeys.conviction.gardenHypercertPool(garden, chainId)` (add to queryKeys)
- Returns `{ poolAddress: Address | undefined, isLoading, isError }`
- Get YieldResolver address from deployment artifact (same pattern as other hooks in this directory)
- Add ABI entry for `gardenHypercertPools(address)` returns `(address)` to shared ABIs

**File**: `packages/shared/src/hooks/conviction/useSetGardenHypercertPool.ts` (CREATE)

Mutation hook wrapping `yieldResolver.setGardenHypercertPool(garden, pool)`. Pattern:
- Follow `useCreateGardenPools.ts` as template (same directory)
- `useMutation` from TanStack Query
- On success: invalidate `queryKeys.conviction.gardenHypercertPool(garden, chainId)`
- Error handling: `createMutationErrorHandler` pattern from shared utils
- Add ABI entry for `setGardenHypercertPool(address,address)` to shared ABIs

Export both hooks from shared barrel (`packages/shared/src/index.ts`).

#### 2B: Enhance `useCreateGardenPools`

**File**: `packages/shared/src/hooks/conviction/useCreateGardenPools.ts`

After the `createGardenPools()` transaction confirms (in the `onSuccess` callback):
1. Query `yieldResolver.gardenHypercertPools(garden)` to verify auto-wiring succeeded
2. If non-zero: toast success "Pools created and yield connected"
3. If zero: toast warning "Pools created but yield connection failed — use Community tab to retry"
4. Invalidate both `queryKeys.community.pools` AND `queryKeys.conviction.gardenHypercertPool`

#### 2C: Yield wiring status in GardenCommunityCard

**File**: `packages/admin/src/components/Garden/GardenCommunityCard.tsx`

Add a new prop `yieldPoolAddress: Address | undefined` (from `useGardenHypercertPool` hook, called by parent).

After the pool addresses display section (after the grid with hypercert/action pool addresses), add yield wiring status:

```tsx
{/* Yield wiring status */}
{pools.length > 0 && (
  <div className="mt-2 flex items-center gap-2 text-xs">
    <span
      className={`inline-flex h-2 w-2 flex-shrink-0 rounded-full ${
        yieldPoolAddress ? "bg-success-base" : "bg-warning-base"
      }`}
      aria-hidden="true"
    />
    <span className={yieldPoolAddress ? "text-text-sub" : "text-warning-dark"}>
      {yieldPoolAddress
        ? formatMessage({ id: "app.community.yieldConnected" })
        : formatMessage({ id: "app.community.yieldNotConnected" })}
    </span>
    {!yieldPoolAddress && canManage && (
      <button onClick={onConnectYield} className="font-medium text-primary-base hover:text-primary-darker">
        {formatMessage({ id: "app.community.connectToYield" })}
      </button>
    )}
  </div>
)}
```

Add corresponding props: `onConnectYield: () => void` (parent wires to `useSetGardenHypercertPool` mutation).

#### 2D: Rename Strategies → Conviction Strategies

**File**: `packages/admin/src/views/Gardens/Garden/Strategies.tsx`

No code changes needed beyond i18n key updates.

#### 2E: i18n keys

**File**: `packages/shared/src/i18n/en.json` (and es.json, pt.json)

Add keys:
```json
"app.community.yieldConnected": "Yield routing connected",
"app.community.yieldNotConnected": "Yield routing not connected",
"app.community.connectToYield": "Connect to yield",
"app.conviction.title": "Conviction Strategies",
"app.conviction.description": "Manage conviction voting strategies for {gardenName}. Community members signal which actions and hypercerts matter most."
```

Update the `app.conviction.title` value from "Strategies" to "Conviction Strategies".

### Validation
After implementation: `cd packages/shared && bun run test && bun build`
Then: `cd packages/admin && bun build`

---

## Stream 3: Migration & Verification Scripts

### Context
Read the plan at `.plans/signal-pool-yield-wiring.todo.md`, specifically Change 8.

### Task

#### 3A: Extend migrate-vaults.ts

**File**: `packages/contracts/script/migrate-vaults.ts`

Add a new phase after the existing vault auto-allocate backfill. The function should:

1. For each garden (using existing garden enumeration):
   a. Call `gardensModule.getGardenSignalPools(garden)` (read-only)
   b. If empty array: `console.log(\`[SKIP] ${garden}: no pools — operator must create via admin UI\`)`
   c. If pools exist:
      - Use index 1 for hypercert pool (if length >= 2), or query `SignalPoolCreated` events to identify by `PoolType`
      - Read `yieldResolver.gardenHypercertPools(garden)`
      - If zero: call `yieldResolver.setGardenHypercertPool(garden, hypercertPool)` as owner
      - If non-zero and matches: skip
      - If non-zero and different: warn (don't overwrite)
   d. Read `yieldResolver.gardenTreasuries(garden)`
      - If zero: call `yieldResolver.setGardenTreasury(garden, garden)` (garden TBA as treasury)
      - If non-zero: skip

2. Verification pass: for each garden, read back and assert:
   - `gardenHypercertPools[garden]` matches expected (or logged as skip)
   - `gardenTreasuries[garden]` is non-zero

Get contract addresses from deployment artifact (`deployments/{chainId}-latest.json`):
- `yieldSplitter` key for YieldResolver
- `gardensModule` key for GardensModule

#### 3B: Extend post-deploy-verify.ts

**File**: `packages/contracts/script/utils/post-deploy-verify.ts`

Add verification checks (for ALL gardens, not just root):
- `yieldResolver.gardensModule()` is non-zero and matches deployment
- `gardensModule.yieldResolver()` is non-zero and matches deployment
- For each garden with pools: `yieldResolver.gardenHypercertPools(garden)` is non-zero
- For each garden: `yieldResolver.gardenTreasuries(garden)` is non-zero (or fallback code active)
- `gardensModule.isWiringComplete()` returns `(true, "")`

### Validation
Dry-run the migration script against a local fork: `bun script/migrate-vaults.ts --network sepolia --dry-run`
