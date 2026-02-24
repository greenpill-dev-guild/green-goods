# Contract Test Coverage Gap Analysis -- 2026-02-19

## Executive Summary

- **23 core source contracts** analyzed (excluding interfaces, mocks, vendor, and lib files)
- **30 unit test files** with ~1,145 test functions
- **15 integration test files** with ~161 test functions
- **~70 fork/E2E test files** with ~350+ test functions
- **3 invariant/fuzz test functions** + **10 fuzz tests** in dedicated files
- **1 CRITICAL BLOCKER**: All tests fail to compile due to broken untracked file

---

## CRITICAL: Test Suite is Broken

**Severity: CRITICAL**

**Finding**: `test/fork/ArbitrumRoleRevocation.t.sol` (untracked file) references `_revokeGardenRole()` which does not exist in `ForkTestBase.sol`. Since Forge compiles all `.sol` files in the test directory regardless of `--match-path`, this single broken file **blocks all test execution**, including unit, integration, and fork tests.

**Evidence**:
```
Error (7576): Undeclared identifier.
  --> test/fork/ArbitrumRoleRevocation.t.sol:77:9
     _revokeGardenRole(testGarden, forkGardener, IHatsModule.GardenRole.Gardener);
```

`bun run test`, `bun run test:lite`, and direct `forge test --match-path 'test/unit/*'` all fail with this error. This means **no CI pipeline can currently validate any contract changes**.

**Fix**: Either add `_revokeGardenRole()` to `ForkTestBase.sol` or remove the broken test file.

---

## Contract-to-Test Coverage Map

### Fully Covered (unit + integration/fork)

| Contract | Unit Tests | Integration/Fork Tests | Total |
|----------|-----------|----------------------|-------|
| `registries/Action.sol` | 37 (ActionRegistry.t.sol) | 7+3 (fork: Arb/Sepolia) | ~47 |
| `resolvers/Assessment.sol` | 26 (AssessmentResolver.t.sol) | 10 (fork: EAS lifecycle) | ~36 |
| `resolvers/Work.sol` | 29 (WorkResolver.t.sol) | 10 (fork: EAS lifecycle) | ~39 |
| `resolvers/WorkApproval.sol` | 38 (WorkApprovalResolver.t.sol) | 10 (fork: EAS lifecycle) | ~48 |
| `modules/Hats.sol` | 23 (HatsModule.t.sol) | 58 (integration) + ~40 (fork: Arb/Sepolia/Celo) | ~121 |
| `modules/CookieJar.sol` | 67 (CookieJarModule.t.sol) | 5+2 (integration/fork) | ~74 |
| `modules/Karma.sol` | 53 (KarmaModule.t.sol) + 27 (KarmaGAPModule.t.sol) | 14 (HatsGAP integration) + 6 (fork) | ~100 |
| `modules/Octant.sol` | 45 (OctantModule.t.sol) | 3+4 (integration/fork) | ~52 |
| `modules/Gardens.sol` | 99 (GardensModule.t.sol) | 8+10+12+8 (fork: GardensModule, ConvictionVoting, gardens/) | ~137 |
| `modules/Hypercerts.sol` | 14 (HypercertsModule.t.sol) | 6 (HypercertsIntegration) + 12 (ArbitrumHypercerts) | ~32 |
| `registries/Deployment.sol` | 19 (DeploymentRegistry.t.sol) | 15 (fork) | ~34 |
| `registries/ENS.sol` | 60 (GreenGoodsENS.t.sol) | 5+11+11 (integration/fork) | ~87 |
| `registries/ENSReceiver.sol` | 36 (GreenGoodsENSReceiver.t.sol) | 4+4 (fork: Ethereum/CrossChain) | ~44 |
| `registries/Power.sol` | 49 (UnifiedPowerRegistry.t.sol) | 5+24 (integration/fork) | ~78 |
| `tokens/Garden.sol` | 46 (GardenToken.t.sol) | 6+7+4 (integration/fork) | ~63 |
| `tokens/Goods.sol` | 31 (GoodsToken.t.sol) | 6+6 (fork) | ~43 |
| `accounts/Garden.sol` | 81 (GardenAccount.t.sol) | 12+4+10+9 (integration/fork) | ~116 |
| `markets/HypercertMarketplaceAdapter.sol` | 44 (HypercertMarketplaceAdapter.t.sol) | 6 (HypercertsIntegration) | ~50 |
| `resolvers/Yield.sol` | 88 (YieldSplitter.t.sol) | 5+6+21 (integration/fork) | ~120 |
| `strategies/AaveV3.sol` | 26 (AaveV3YDSStrategy.t.sol) | 3 (ArbitrumAaveStrategy fork) | ~29 |

### NOT Covered (no dedicated test file)

| Contract | Lines | Complexity | Severity | Notes |
|----------|-------|-----------|----------|-------|
| **`modules/Unlock.sol`** | ~220 | HIGH | **HIGH** | 0 tests. Zero imports in any test file. 15 public/external functions including `onWorkApproved()`, `createLockForGarden()`, `grantBadgeManually()`, and badge lifecycle management. Full module is completely untested. |
| **`resolvers/ResolverStub.sol`** | ~25 | LOW | LOW | Only used as deployment helper in `DeploymentBase.sol`. Minimal contract (initialize + UUPS upgrade). Tested transitively. |
| **`Schemas.sol`** | ~30 | LOW | LOW | Pure data structures (no logic). Tested transitively via resolver tests. |

---

## Cross-Cutting Coverage Gaps

### 1. Unlock Module -- ZERO Coverage (HIGH)

**File**: `/packages/contracts/src/modules/Unlock.sol`

**Functions with zero test coverage**:
- `initialize()` -- constructor setup
- `onWorkApproved()` -- called when work is approved; grants badge
- `hasLock()` / `getLock()` -- view functions
- `hasValidBadge()` -- checks if worker has valid badge
- `configureLockForGarden()` -- admin: sets lock per garden
- `removeLockForGarden()` -- admin: removes lock mapping
- `setUnlockFactory()` / `setRouter()` -- admin setters
- `setDefaultBadgeDuration()` -- admin: sets default badge TTL
- `createLockForGarden()` -- admin: deploys Unlock lock for garden
- `grantBadgeManually()` -- admin: manually grants a badge
- `_grantBadge()` -- internal: actual badge minting logic

This module handles worker badges (NFT keys via Unlock Protocol). The absence of ANY test means:
- No authorization checks validated
- No badge grant/revoke logic validated
- No integration with Unlock Factory validated
- No edge cases (expired badges, duplicate grants) covered

### 2. Conviction Voting Power Sync -- Partial Coverage (MEDIUM)

**File**: `modules/Hats.sol` (functions `_syncConvictionPower`, `setConvictionStrategies`)

While `setConvictionStrategies` has validation tests (integration/HatsModule.t.sol: `test_grantRole_syncsConvictionPower`), the following scenarios are not covered:
- Gas griefing by malicious strategy (SYNC_POWER_GAS_STIPEND = 100k)
- Behavior when all 10 strategies are configured (MAX_CONVICTION_STRATEGIES)
- Failure of individual strategies in a multi-strategy sync (partial failure)

### 3. Yield Splitter -- Juicebox and Fraction Distribution Paths (MEDIUM)

**File**: `resolvers/Yield.sol`

The YieldSplitter has 88 unit tests, but the following complex internal paths have limited coverage:
- `_routeToJuicebox()` -- Juicebox terminal integration
- `_readConvictionWeights()` -- reading weights from CVStrategy
- `_distributeFractions()` -- distributing hypercert fractions to strategies
- `_purchaseFraction()` -- buying fractions via marketplace adapter
- `_escrowFractions()` -- escrow bookkeeping

### 4. GardenToken ENS Integration -- Edge Cases (MEDIUM)

**File**: `tokens/Garden.sol`

Tests exist for ENS failure queuing and refund claim, but:
- `batchMintGardens` with multiple ENS slugs (documented as problematic in NatSpec) has no test
- ENS refund transfer failure in `claimENSRefund()` (when `msg.sender.call` fails) not tested

### 5. GardenAccount -- Auto-Community-Registration (MEDIUM)

**File**: `accounts/Garden.sol`

The `_autoRegisterInCommunity()` function that registers new gardeners in Gardens V2 communities and auto-stakes is tested in fork tests but:
- `executeAutoStake()` has no unit test for authorization (only callable by garden itself)
- Community membership failure recovery paths not tested

---

## Test Infrastructure Issues

### 1. Broken Test File Blocks CI (CRITICAL)

**File**: `test/fork/ArbitrumRoleRevocation.t.sol` (untracked)

References `_revokeGardenRole()` which does not exist in `ForkTestBase.sol`. All Forge compilation fails.

### 2. `bun run test` Compilation Error (HIGH)

The `test` script (`forge test --no-match-contract 'E2E'`) fails with:
```
Stack too deep. Try compiling with `--via-ir`
```

This indicates the `foundry.toml` `compilation_restrictions` configuration with selective `via_ir=true` is not being applied correctly when compiling test files. The `test:lite` script exists as a workaround but also fails due to the broken fork test file.

### 3. Empty Fork Test Stubs (LOW)

The CookieJar fork tests (`SepoliaCookieJar.t.sol`, `ArbitrumCookieJar.t.sol`) extend `CookieJarForkTestBase` which has 2 test functions, so they are not actually empty -- they inherit tests. However, the pattern means zero chain-specific assertions.

---

## Test Quality Assessment by Category

### Unit Tests: GOOD (30 files, ~1,145 tests)

Strong per-function coverage with:
- Happy path + revert cases for all public functions
- Event emission validation
- Access control enforcement
- UUPS upgrade safety tests
- Input validation edge cases

### Integration Tests: GOOD (15 files, ~161 tests)

Strong end-to-end module interaction coverage:
- HatsModule configuration lifecycle (58 tests)
- Garden access control delegation (12 tests)
- Conviction sync (24 tests)
- Module wiring validation (8 tests)

### Fork Tests: GOOD (but broken by untracked file)

Extensive real-chain validation across Arbitrum, Sepolia, Celo, and Ethereum:
- EAS attestation lifecycle
- Hats Protocol role management
- ENS registration via CCIP
- Garden creation end-to-end
- Negative path testing

### Fuzz Tests: ADEQUATE (10 tests, 3 invariants)

Coverage of:
- Action timing validation
- Capital combinations
- Split ratio validation
- Role hierarchy invariants

### Schema Validation: GOOD (8 tests)

Karma GAP JSON schema structure tests.

---

## Recommendations by Priority

### Priority 1 -- Fix Test Infrastructure (CRITICAL)

1. **Fix or remove `test/fork/ArbitrumRoleRevocation.t.sol`** -- add `_revokeGardenRole()` helper to ForkTestBase or remove the untracked file
2. **Fix `bun run test` compilation** -- the stack-too-deep error in the default test command needs investigation; selective `via_ir` in `compilation_restrictions` may not apply to test file compilation paths

### Priority 2 -- Add Unlock Module Tests (HIGH)

Create `test/unit/UnlockModule.t.sol` covering:
- `initialize()` setup
- `onWorkApproved()` with mock lock (happy + failure paths)
- `createLockForGarden()` with mock factory
- `grantBadgeManually()` authorization and badge minting
- `hasValidBadge()` for expired/valid badges
- `configureLockForGarden()` / `removeLockForGarden()` admin operations
- Access control on all admin functions
- Edge case: duplicate badge grant

### Priority 3 -- Fill Critical Path Gaps (MEDIUM)

1. **Batch mint with multiple ENS slugs** -- validate the documented limitation
2. **Conviction sync gas griefing** -- test that a malicious strategy hitting gas limit does not block other strategies
3. **Juicebox yield routing** -- mock JBMultiTerminal and test `_routeToJuicebox()`
4. **GardenAccount.executeAutoStake()** -- unit test for authorization check

### Priority 4 -- Increase Fuzz Coverage (LOW)

The fuzz suite has 10 tests for ~23 contracts. Consider adding:
- Domain mask validation fuzzing on ActionRegistry
- ENS slug validation fuzzing (boundary chars)
- Yield split ratio boundary fuzzing
- Power source weight calculation fuzzing

---

## Metrics Summary

| Metric | Value | Grade |
|--------|-------|-------|
| Contracts with 0 tests | 1 (Unlock) + 2 trivial (ResolverStub, Schemas) | FAIR |
| Contracts with unit tests | 20/23 (87%) | GOOD |
| Total test functions | ~1,656 | HIGH |
| Unit test density | ~49 tests/contract average | GOOD |
| Integration coverage | 15 integration suites | GOOD |
| Fork test coverage | ~70 fork tests across 4 chains | GOOD |
| Fuzz/invariant coverage | 13 functions | LOW |
| Test suite health | **BROKEN** (compilation error) | CRITICAL |
| CI-readiness | **BLOCKED** | CRITICAL |
