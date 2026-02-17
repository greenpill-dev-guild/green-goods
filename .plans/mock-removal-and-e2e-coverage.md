# Mock Removal & E2E Coverage Hardening Plan

**Date:** 2026-02-16
**Branch:** `feature/ens-integration`
**References:** `.plans/audits/2026-02-16-fork-e2e-coverage-audit.md`
**Status:** Ready for implementation

---

## Context

Analysis of mock usage across `packages/contracts/test/` revealed:
- **16 distinct mock contracts** in `src/mocks/`
- **~30 mock usages** across E2E, integration, and fork tests
- **5 CRITICAL/HIGH audit findings** with untested catch branches
- **3 modules** where mocks have drifted from real contract behavior (e.g., `MockUnifiedPowerRegistry` missing `deregisterGarden()`)

The protocol's graceful degradation design (try-catch around all module callbacks) means silent failures are by design — but mocks never revert, so catch branches are untested.

---

## Mock Inventory

### Tier 1: Keep for Fast CI (Fork Tests Already Cover Real Contracts)

| Mock | Replaces | Fork Coverage |
|------|----------|---------------|
| `MockEAS` | Real EAS | `FullProtocolE2E`, `ArbitrumFullProtocolE2E` |
| `MockHats` | Hats Protocol | Fork tests on 3 chains |
| `MockRegistryFactory` | Gardens V2 factory | `ArbitrumGardensModule` |

### Tier 2: Partial Fork Coverage — Need Fork Tests Added

| Mock | Replaces | Gap |
|------|----------|-----|
| `MockUnifiedPowerRegistry` | Real `UnifiedPowerRegistry` | Real weight computation (Hats → role weights → schemes) never tested E2E |
| `MockCVStrategy` | Real Allo `CVStrategy` | `allocateSupport → calculateConviction` flow untested with real strategy |
| `MockOctantFactory/Vault` | Yearn V3 vault | Harvest failure cascade untested (audit CRITICAL #1) |
| `MockGardenAccessControl` | Real `GardenAccount` | Can be replaced in `YieldFlowE2E` with real TBA |

### Tier 3: No Fork Coverage — Need New Fork Tests

| Mock | Replaces | Action |
|------|----------|--------|
| `MockCookieJarFactory` | Real CookieJar factory | Fork test if deployed on Arbitrum; else document as mock-only |
| `MockJBMultiTerminalForYield` | Juicebox `JBMultiTerminal` | Add to `ArbitrumYieldSplitter` fork test |
| `MockHypercertMarketplace` | Real Hypercert marketplace | Add fork test through `YieldResolver` |
| `MockGAP` | Karma GAP protocol | Add fork test against real GAP attestation |

### Tier 4: Permanent Fixtures (Legitimate Test Infrastructure)

| Mock | Why Keep |
|------|----------|
| `MockERC20` | Community tokens need open `mint()` for test setup |
| `RevertingStrategy`, `RevertingOctantFactory/Vault` | Fault-injection — test error paths by design |
| `ReentrantStrategy` | Security testing — reentrancy simulation |
| `MockNonERC20` | Edge case — non-compliant token behavior |
| All `Mock*ForWiring` (inline in integration tests) | Isolate callback wiring |

---

## Implementation Items

### Item 1: Add AssessmentResolver to E2EWorkflow [P0 — Quick Win]

**File:** `test/E2EWorkflow.t.sol`
**What:** Add Phase 5 that submits an assessment attestation via `MockEAS`, verifying `AssessmentResolver` callback fires. Currently the mock E2E covers Work + WorkApproval but skips Assessment entirely.
**Audit ref:** Assessment only tested in fork E2E — adding mock coverage closes fast-CI gap.

**Acceptance criteria:**
- [ ] New test phase in `testCompleteProtocolWorkflow` or standalone test
- [ ] Assessment attestation created via `MockEAS`
- [ ] `AssessmentResolver` processes the attestation correctly
- [ ] Karma GAP milestone creation triggered (if `karmaGAPModule` is wired)
- [ ] Tests pass: `cd packages/contracts && bun run test`

---

### Item 2: Real UnifiedPowerRegistry + CVStrategy Fork Test [P2]

**New file:** `test/fork/ArbitrumConvictionVoting.t.sol`
**What:** Fork `E2EConvictionVoting` logic onto Arbitrum fork using:
- Real `UnifiedPowerRegistry` (deploy via `DeploymentBase`, wire to real Hats tree)
- Real Gardens V2 `CVStrategy` (via real `RegistryFactory` on Arbitrum)
- Exercise: `registerHypercert → allocateSupport → warp → calculateConviction`

**Audit ref:** `MockUnifiedPowerRegistry` build blocker fix shows mock drift risk.

**Acceptance criteria:**
- [ ] Fork test uses real `UnifiedPowerRegistry` with Hats-derived power
- [ ] Real `CVStrategy` from Allo used for signal pool
- [ ] Conviction accumulation verified with `vm.warp()`
- [ ] Tests pass: `cd packages/contracts && bun run test:fork`

---

### Item 3: Octant Harvest Failure Cascade Tests [P0 — Audit CRITICAL #1]

**File:** `test/unit/OctantModule.t.sol` (new test cases)
**What:** Fault-injection tests using `RevertingOctantVault` (already exists in mocks):

**Tests to add:**
- `test_harvest_vaultReportFails_fallsBackToStrategy()` — `process_report()` reverts, verify `strategy.report()` is called as fallback
- `test_harvest_allReportsFail_emitsEvent()` — both paths fail, verify `HarvestReportFailed` event
- `test_harvest_registerSharesFails_sharesLost()` — `registerShares()` reverts, verify shares not tracked

**Audit ref:** Lines 232-246 in `Octant.sol` — "Highest-risk gap in the entire test suite"

**Acceptance criteria:**
- [ ] Three new test functions exercising the harvest fallback chain
- [ ] Uses existing `RevertingOctantVault` / `RevertingStrategy` mocks or extends them
- [ ] Event emissions verified with `vm.expectEmit()`
- [ ] Tests pass: `cd packages/contracts && bun run test`

---

### Item 4: Yield Routing Fallback Tests [P0 — Audit CRITICAL #2]

**Files:** `test/unit/YieldSplitter.t.sol` (new test cases) + optionally `test/fork/ArbitrumYieldSplitter.t.sol`
**What:** Test the money-flow fallback paths in `Yield.sol`:

**Unit tests to add:**
- `test_purchaseFraction_buyFractionReverts_fundsEscrowed()` — `buyFraction()` reverts, verify funds escrowed + `YieldAccumulated` emitted
- `test_routeToJuicebox_payReverts_fallbackToTreasury()` — `pay()` reverts, verify fallback + `YieldStranded` emitted
- `test_withdrawEscrowedFractions_afterEscrow_recoversCorrectly()` — admin recovery after escrow

**Audit ref:** Lines 683, 715 in `Yield.sol` — "Real money could be stuck in escrow"

**Acceptance criteria:**
- [ ] Three new test functions for fallback paths
- [ ] Reverting mocks for `buyFraction()` and `pay()`
- [ ] Event emissions verified
- [ ] Escrow balance assertions
- [ ] Tests pass: `cd packages/contracts && bun run test`

---

### Item 5: GardenAccount Auto-Stake + ENS Failure Tests [P1 — Audit HIGH #3, #4]

**Files:** `test/unit/GardenAccount.t.sol`, `test/unit/GardenToken.t.sol`
**What:**

**GardenAccount (line 382):**
- `test_joinGarden_stakeFails_gardenerStillGranted()` — mock that reverts on `stakeAndRegisterMember()`, verify gardener role still granted

**GardenToken (line 376):**
- `test_mintGarden_ensRegistrationFails_gardenStillCreated()` — mock ENS module that reverts, verify garden still mints successfully

**Audit ref:** Lines 382 (`GardenAccount.sol`) and 376 (`GardenToken.sol`) — silent failure paths

**Acceptance criteria:**
- [ ] Two new test functions (one per file)
- [ ] Reverting mocks for `stakeAndRegisterMember()` and `registerGarden()`
- [ ] Garden/gardener creation verified despite module failure
- [ ] Consider adding `ENSRegistrationFailed` event in catch block (optional enhancement)
- [ ] Tests pass: `cd packages/contracts && bun run test`

---

### Item 6: Gardens Reset + Pool Registration Catch Paths [P1 — Audit HIGH #5]

**File:** `test/unit/GardensModule.t.sol` (new test cases)
**What:**

**Tests to add:**
- `test_resetGardenInitialization_powerRegistryFails_handlesGracefully()` — `deregisterGarden()` reverts, verify reset still completes
- `test_registerPoolsInPowerRegistry_singlePoolFails_emitsEvent()` — `registerPool()` reverts for one pool, verify `PoolRegistrationFailed` emitted and other pools still registered

**Audit ref:** Lines 398, 632 in `Gardens.sol`

**Acceptance criteria:**
- [ ] Two new test functions
- [ ] Power registry mock that reverts on specific calls
- [ ] Event emissions verified
- [ ] Tests pass: `cd packages/contracts && bun run test`

---

### Item 7: YieldResolver → Real External Contracts Fork Test [P2]

**File:** `test/fork/ArbitrumYieldSplitter.t.sol` (extend existing)
**What:** Wire `YieldResolver.splitYield()` through real on-chain contracts:
- Real Juicebox `JBMultiTerminal.pay()` on Arbitrum
- Real `HypercertExchange.executeTakerBid()` on Arbitrum (if deployed)
- Verify actual token transfers, not mock recordings

**Removes need for:** `MockJBMultiTerminalForYield` and `MockHypercertMarketplace` in fork context

**Acceptance criteria:**
- [ ] Fork test exercises real `pay()` against Juicebox on Arbitrum
- [ ] Real token transfer assertions (balance checks)
- [ ] Tests pass: `cd packages/contracts && bun run test:fork`

---

## Priority Matrix

| Priority | Item | Type | Risk Closed | Effort |
|----------|------|------|-------------|--------|
| **P0** | #1 AssessmentResolver in E2EWorkflow | Quick win | Fast-CI gap | Low |
| **P0** | #3 Octant harvest cascade | Fault-injection | CRITICAL (audit) | Medium |
| **P0** | #4 Yield routing fallbacks | Fault-injection + fork | CRITICAL (audit) | Medium |
| **P1** | #5 Auto-stake + ENS failure | Fault-injection | HIGH (audit) | Low |
| **P1** | #6 Gardens reset/pool reg | Fault-injection | HIGH (audit) | Low |
| **P2** | #2 Real conviction voting fork | Fork test | Mock drift risk | High |
| **P2** | #7 Real external contracts fork | Fork test | Integration confidence | High |

---

## Validation

After all items are implemented:

```bash
# Unit + integration tests (items 1, 3, 4, 5, 6)
cd packages/contracts && bun run test

# Fork tests (items 2, 7)
cd packages/contracts && bun run test:fork

# Full verification
bun run verify:contracts
```
