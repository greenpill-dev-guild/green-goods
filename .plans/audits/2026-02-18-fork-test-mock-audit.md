# Fork Test Mock Audit — 2026-02-18

## Objective

Eliminate unnecessary mocks in fork and E2E tests. Fork tests exist to validate contracts against real on-chain state — when they mock out the protocols they should be exercising, they become expensive unit tests that provide false confidence.

## Completed (This Session)

### Finding 1: `ArbitrumOctantVault.t.sol` — FIXED
- **Was**: `MockGardenAccessControl` for garden, bypassing real GardenAccount authorization chain
- **Now**: Extends `ForkTestBase`, uses `_deployFullStackOnFork()`, real GardenAccount + HatsModule
- **Tests**: 4 (vault lifecycle, auto-creation, unauthorized harvest revert, YieldResolver wiring)

### Finding 2: `ArbitrumGardensModule.t.sol` — FIXED
- **Was**: `MockHatsModuleForFork` (all role checks return false, `createGardenHatTree()` returns 1)
- **Now**: Extends `ForkTestBase`, uses real HatsModule + Hats Protocol, `_configureRealGardensV2()`
- **Tests**: 7 (initialization, Hats queries, weight schemes, state storage, unauthorized revert, real role grants, constants)

### Finding 4: `ArbitrumGardensNegativePaths.t.sol` — FIXED
- **Was**: `MockHatsModuleForNegative` (same pattern as F2)
- **Now**: Extends `ForkTestBase`, tests real revert conditions with real GardensModule + HatsModule

### Finding 5: `CookieJarForkTestBase.sol` — FIXED
- **Was**: `TestHatsProtocol` (plain ERC1155), `TestHatsModule`, `MockVaultForCookieJarFork`
- **Now**: Extends `ForkTestBase`, real Hats Protocol via `_setupHatsTreeOnFork()`, real HatsModule role grants
- **Dependents updated**: `SepoliaCookieJar.t.sol`, `ArbitrumCookieJar.t.sol`

### Finding 6: `E2EWorkflow.t.sol` — FIXED
- **Was**: `MockEAS` with `setAttestationByUID()` injection, `MockHats`, bypassed entire resolver chain
- **Now**: Extends `ForkTestBase`, Sepolia fork, real EAS attestations through resolver callbacks
- **Kept**: `RevertingKarmaGAPModule` (valid fault injection mock for graceful degradation testing)

---

## Remaining (2 Files)

### Finding A: `test/fork/SepoliaGardensModule.t.sol` — HIGH

**Current state**: Extends `Test`, defines 2 inline mocks:
- `MockGOODSForSepoliaFork` (line 17) — simple ERC20 mock
- `MockHatsModuleForSepoliaFork` (line 29) — all `is*Of()` return false, `createGardenHatTree()` returns 1

**Why it's wrong**: Forks Sepolia to access real Hats Protocol at `0x3bc1...` but immediately replaces HatsModule with a mock. The mock doesn't create real hats, returns hardcoded hat IDs, and all role checks return false. This is the Sepolia counterpart of the already-fixed `ArbitrumGardensModule.t.sol`.

**Fix**: Mirror the `ArbitrumGardensModule.t.sol` rewrite:
1. Change `contract SepoliaGardensModuleForkTest is Test` to `is ForkTestBase`
2. Remove `MockGOODSForSepoliaFork` and `MockHatsModuleForSepoliaFork` definitions
3. Use `_deployFullStackOnFork()` for full production stack
4. Use `_configureRealGardensV2()` for Gardens V2 addresses
5. Use `gardensModule`, `hatsModule` from DeploymentBase (already deployed)
6. Use `_mintTestGarden()` which triggers real `onGardenMinted()` callback
7. Use `_grantGardenRole()` for real role verification via Hats Protocol
8. Replace `_tryFork()` with `_tryChainFork("sepolia")`

**Reference**: `test/fork/ArbitrumGardensModule.t.sol` (already migrated — exact same pattern)

**Tests to preserve** (adapt to real contracts):
- `test_forkDeploy_initializesWithRealHatsProtocol` — verify wiring
- `test_forkDeploy_hatsProtocolIsQueryable` — real Hats queries
- `test_forkDeploy_weightSchemesResolveCorrectly` — weight schemes via real mint
- `test_forkDeploy_onGardenMintedStoresState` — state via real pipeline
- `test_forkDeploy_onGardenMintedRevertsForUnauthorized` — real revert
- `test_forkDeploy_onGardenMintedRevertsForDoubleInit` — real revert
- `test_forkDeploy_gracefulDegradationWithoutFactories` — may need rethinking since ForkTestBase sets real factories
- `test_forkDeploy_adminSettersWorkOnFork` — admin setters
- `test_forkDeploy_constantsAreCorrect` — constants validation

---

### Finding B: `test/fork/ArbitrumYieldSplitter.t.sol` — MEDIUM

**Current state**: Extends `Test`, defines 2 inline mocks:
- `MockVaultForFork` (line 28) — 1:1 share/asset ratio, no real Aave strategy
- `MockHatsModuleForYieldFork` (line 77) — simple operator/owner mapping

**Why it's wrong**: Forks Arbitrum to get real WETH, but uses a mock vault (no yield accrual, no strategy) and mock access control. The real yield pipeline is: deposit WETH -> Aave V3 strategy -> aWETH accrues -> harvest -> vault rebalances. The mock just does `transfer()`.

**Partial mitigation**: Some tests focus on `splitYield()` BPS math where the mock vault is somewhat defensible. The Juicebox integration tests (line 107+) do use real Juicebox contracts on fork.

**Fix**: Mirror the `ArbitrumOctantVault.t.sol` rewrite:
1. Change `contract ArbitrumYieldResolverForkTest is Test` to `is ForkTestBase`
2. Remove `MockVaultForFork` and `MockHatsModuleForYieldFork` definitions
3. Use `_deployFullStackOnFork()` for full production stack
4. Use `_setupGardenWithRolesAndAction()` for garden + real roles
5. For vault: deploy real `MultistrategyVaultFactory` + `AaveV3` strategy (same as ArbitrumExtendedE2E)
6. Use real `yieldSplitter` from DeploymentBase
7. Replace `_tryFork()` with `_tryChainFork("arbitrum")`
8. For the split BPS math tests: can keep mock vault pattern scoped to that specific test (as CookieJarForkTestBase does with `MockVaultForYieldTest`), but at least use real HatsModule for access control

**Reference**:
- `test/fork/ArbitrumOctantVault.t.sol` (already migrated — vault + Aave pattern)
- `test/fork/e2e/ArbitrumExtendedE2E.t.sol:46-64` (`_setupOctantVaultWithAave` helper)

**Tests to preserve** (adapt to real contracts):
- `test_forkDeploy_initializesWithRealWETH` — verify WETH on fork
- `test_forkLifecycle_depositAndRedeem` — real vault deposit/redeem
- `test_forkLifecycle_splitYieldDistribution` — BPS split logic (may keep scoped mock vault)
- `test_forkLifecycle_splitYieldWithCustomConfig` — custom split percentages
- `test_forkLifecycle_belowThresholdSkipsSplit` — threshold check
- `test_forkLifecycle_operatorOnlyHarvest` — real access control via HatsModule
- `test_forkLifecycle_juiceboxProjectCreation` — real Juicebox on fork (already correct)
- `test_forkLifecycle_juiceboxPayment` — real Juicebox payment (already correct)

---

## Confirmed Acceptable Patterns (No Changes Needed)

| Pattern | Files | Justification |
|---------|-------|---------------|
| `MockRevertingModule` (fault injection) | SepoliaGardenToken, ArbitrumGardenToken | Tests graceful degradation of module callbacks — intentional failure simulation |
| `MockVaultForYieldTest` (scoped in CookieJarForkTestBase) | CookieJarForkTestBase | Tests BPS split math only — full Aave vault tested in ArbitrumExtendedE2E |
| `MockCVStrategy` in ArbitrumExtendedE2E | ArbitrumExtendedE2E | Conviction voting strategy stub for pool setup — no real CV strategy deployed |
| `RevertingKarmaGAPModule` in E2EWorkflow | E2EWorkflow.t.sol | Fault injection for AssessmentResolver try-catch branch |
| Standalone protocol tests extending `Test` | 18 specialty fork tests (Hats, ENS, Aave, KarmaGAP, Hypercerts) | Test individual external protocols in isolation — don't need full Green Goods deployment |
| All 4 `fork/e2e/*` tests | FullProtocolE2E, ArbitrumExtended, SepoliaExtended, ArbitrumFullProtocol | All correctly extend ForkTestBase with real contracts |

---

## Scorecard

| Metric | Before Session | After Session | After Plan Complete |
|--------|---------------|--------------|---------------------|
| Fork tests with unnecessary mocks | 7 files | 2 files | 0 files |
| E2E tests with mock EAS | 1 file | 0 | 0 |
| Fork tests extending ForkTestBase properly | ~25 | ~30 | ~32 |
| Inline mock HatsModule definitions in fork/ | 5 copies | 2 copies | 0 copies |

## Constraints

- NEVER use `forge build` or `forge test` directly — use `bun` scripts per Rule 14
- All fork tests use graceful skip: `if (!_tryChainFork("...")) { emit log("SKIPPED..."); return; }`
- Keep `test_fork` or `testFork` prefix for fork tests
- Clean imports — no unused mock imports after migration
- Validate compilation: `cd packages/contracts && bun build:test`
