# Production Readiness Review: `feature/ens-integration`

> **Date**: 2026-02-16 (updated 2026-02-17)
> **Branch**: feature/ens-integration (29 commits, 1,280 files, 172K+ insertions)
> **Method**: 6-agent pair-lane review (chain, middleware, app) with adversarial integration lead
> **Status**: NOT READY FOR PRODUCTION — 3 Blockers, 68 total issues

---

## Overall Verdict

The codebase is **architecturally sound** with well-designed contracts (0 critical security vulnerabilities), comprehensive UX flows (all 8 implemented), and thorough Arbitrum fork coverage (102 tests). However, **three blockers prevent production deployment**:

1. **All module contracts undeployed** on both Sepolia and Arbitrum
2. **Indexer non-functional** for 7/11 contract sources (zero addresses in config.yaml)
3. **Three modules have zero fork test coverage** (OctantModule real vault, CookieJarModule, KarmaGAPModule)

**Critical path**: Deploy contracts → Update indexer config → Fill fork test gaps → Fix shared package P0s → UX polish → Docs update

---

## Issue Summary

| Severity | Count | Primary Sources |
|----------|-------|-----------------|
| **Blocker** | 3 | Deployments, Indexer, Fork tests |
| **Critical** | 3 | HypercertsModule reentrancy, Indexer missing 2 sources, Sepolia parity |
| **High** | 9 | splitYield permissionless, work offline path, bundle limits, docs, agent config |
| **Medium** | 16 | Contract issues (5), UX issues (5), Docs (4), Shared (2) |
| **Low/P1-P2** | 37 | Barrel imports (21), Address types (15), Zustand selectors (9), console.log (39+) |

---

## Blockers (3)

| # | Segment | Issue | Impact |
|---|---------|-------|--------|
| B1 | Deployment | All 7 module contracts undeployed on Sepolia AND Arbitrum — zero addresses in deployment JSONs | No module functionality available on any chain |
| B2 | Indexer | 7/11 contract sources have zero addresses in config.yaml — handlers exist but nothing indexed | Event handlers never fire |
| B3 | Fork Tests | OctantModule, CookieJarModule, KarmaGAPModule have zero fork test coverage | Core modules untested against real protocols |

## Critical (3)

| # | Segment | Issue |
|---|---------|-------|
| C1 | Contracts | HypercertsModule missing ReentrancyGuard — calls external HypercertMinter |
| C2 | Indexer | HypercertMarketplaceAdapter and UnifiedPowerRegistry not in config.yaml at all |
| C3 | Fork Tests | Sepolia has only 29 fork tests vs 102 on Arbitrum — major parity gap |

## High (9)

| # | Segment | Issue |
|---|---------|-------|
| H1 | Contracts | YieldSplitter `splitYield()` is permissionless — timing-based front-running risk with conviction weights |
| H2 | UX | Work submission has no visible JobQueue/offline integration at view level |
| H3 | UX | Bundle `chunkSizeWarningLimit: 2000` (2MB) effectively disables Vite size warnings |
| H4 | Docs | `docs/developer/contracts.md` stale since Nov 2024 with wrong addresses |
| H5 | Docs | CLAUDE.md deployment section lists 14 contracts vs 18+ actual |
| H6 | Agent | Testing skill uses `bun test` instead of `bun run test` in 6+ places |
| H7 | Agent | Triage agent references non-existent skills (`storage`, `offline` → should be `data-layer`) |
| H8 | Agent | Migration agent uses `bun test` instead of `bun run test` |
| H9 | Tests | Admin smoke E2E tests are failing per test-results screenshots |

## Medium (16)

| # | Segment | Issue |
|---|---------|-------|
| M1 | Contracts | HypercertsModule admin setters allow `address(0)` — can disable module |
| M2 | Contracts | GardensModule marks `gardenInitialized` before community/pool creation completes |
| M3 | Contracts | GardenToken ENS ETH forwarding has no refund mechanism for minter |
| M4 | Contracts | OctantModule `supportedAssetCount` manual tracking could desync |
| M5 | Contracts | YieldSplitter redeems ALL shares at once — may hit vault withdrawal limits |
| M6 | UX | Work approval silent failure — catch block logs error but no toast to user |
| M7 | UX | Join garden has no confirmation dialog — single click triggers blockchain tx |
| M8 | UX | Garden creation has no offline check before deployment tx |
| M9 | UX | Assessment creation checks wallet on submit, not on wizard entry |
| M10 | UX | Work approval validation hints informational only, don't prevent action |
| M11 | Docs | 4 missing specs: ENS, Cookie Jar, Yield Splitting, Juicebox |
| M12 | Docs | `.claude/context/contracts.md` stale architecture tree |
| M13 | Tests | Vitest coverage threshold 60% vs documented 70% |
| M14 | Tests | Passkey E2E permanently skipped — only mocked tests run |
| M15 | Shared | `AppContext.Provider` and `WorkProvider` values not memoized (Rule 10) |
| M16 | Shared | 9 `console.log` calls in `modules/auth/session.ts` leak passkey diagnostics in production |

---

## Module Readiness Matrix

| Module | Code | Unit Tests | Fork (Sepolia) | Fork (Arbitrum) | Indexer | Hooks | UI | Deploy | Verdict |
|--------|------|------------|----------------|-----------------|---------|-------|-----|--------|---------|
| **Hats** | DONE | DONE | DONE (1 test) | DONE (4 tests) | PARTIAL (zero addr) | DONE | DONE | NOT DEPLOYED | BLOCKED |
| **Octant** | DONE | DONE | MISSING | MISSING (mock only) | DONE (zero addr) | DONE | DONE | NOT DEPLOYED | BLOCKED |
| **Gardens/CV** | DONE | DONE | DONE (12 tests) | DONE (7+9 tests) | DONE (zero addr) | DONE | PARTIAL | NOT DEPLOYED | BLOCKED |
| **Karma** | DONE | DONE (4 files) | MISSING | MISSING | N/A | N/A | N/A | NOT DEPLOYED | BLOCKED |
| **Hypercerts** | DONE | DONE | MISSING | DONE (12 tests) | NOT CONFIGURED | DONE | DONE | NOT DEPLOYED | BLOCKED |
| **Cookie Jar** | DONE | DONE | MISSING | MISSING | PARTIAL (zero addr) | DONE (untested) | PARTIAL | NOT DEPLOYED | BLOCKED |
| **ENS** | DONE | DONE | MISSING | DONE (11 tests) | DONE (zero addr) | DONE | DONE | NOT DEPLOYED | BLOCKED |
| **Juicebox** | DONE | DONE | N/A | PARTIAL (via YieldSplitter) | DONE | DONE | DONE | NOT DEPLOYED | BLOCKED |

## UX Flow Readiness Matrix

| Flow | Status | Offline | Issues | Verdict |
|------|--------|---------|--------|---------|
| **Create Garden** | DONE (admin 3-step wizard) | No offline check | M8 | READY (minor fix) |
| **Create Assessment** | DONE (admin 3-step wizard) | N/A | M9 | READY (minor fix) |
| **Auth** | DONE (passkey + wallet) | N/A | M14, M16 | READY (polish) |
| **Join Garden** | DONE (client) | No | M7 | READY (add confirm dialog) |
| **Work Submission** | DONE (client 4-step wizard) | Draft save only | H2 | NEEDS WORK (offline path) |
| **Work Approval** | DONE (admin review page) | N/A | M6, M10 | READY (error handling) |
| **Hypercert Minting** | DONE (admin 4-step wizard) | No | Low only | READY |
| **Vault Deposits** | DONE (admin vault view) | Disabled offline | Low only | READY |

---

## Fork Test Coverage Matrix

| Module | Unit Tests | Fork (Arbitrum) | Fork (Sepolia) | Fork (Celo) | Status |
|--------|-----------|-----------------|----------------|-------------|--------|
| **GardenToken** | YES | YES (via E2E) | YES (via E2E) | — | GOOD |
| **ActionRegistry** | YES | YES (via E2E) | YES (via E2E) | — | GOOD |
| **GardenAccount** | YES | YES (via E2E) | YES (via E2E) | — | GOOD |
| **HatsModule** | YES (2 files) | YES (4 tests) | YES (1 test) | YES (4 tests) | GOOD (Sepolia thin) |
| **EAS Resolvers** | YES (3 files) | YES (10 tests) | YES (8 tests) | — | GOOD |
| **GardensModule** | YES | YES (7 tests) | YES (5 tests) | — | GOOD |
| **ConvictionVoting** | YES | YES (9 tests) | MISSING | — | GAP |
| **YieldSplitter** | YES | YES (17 tests) | MISSING | — | GAP |
| **AaveStrategy** | YES | YES (3 tests) | MISSING | — | GAP |
| **HypercertMarketplace** | YES (2 files) | YES (12 tests) | MISSING | — | GAP |
| **GreenGoodsENS** | YES (2 files) | YES (11 tests) | MISSING | — | GAP |
| **OctantModule** | YES (3 files) | MISSING (mock only) | MISSING | — | CRITICAL GAP |
| **CookieJarModule** | YES | MISSING | MISSING | — | CRITICAL GAP |
| **KarmaGAPModule** | YES (4 files) | MISSING | MISSING | — | CRITICAL GAP |

---

## Indexer Coverage

### Config.yaml Address Status

| Contract Source | Arbitrum | Celo | Sepolia | Status |
|----------------|---------|------|---------|--------|
| ActionRegistry | LIVE | LIVE | LIVE | OK |
| GardenToken | LIVE | LIVE | LIVE | OK |
| GardenAccount | LIVE | LIVE | LIVE | OK |
| HypercertMinter | LIVE | LIVE | LIVE | OK |
| **HatsModule** | 0x000 | 0x000 | 0x000 | BLOCKED |
| **OctantModule** | 0x000 | 0x000 | 0x000 | BLOCKED |
| **OctantVault** | 0x000 | 0x000 | 0x000 | BLOCKED |
| **GardensModule** | 0x000 | 0x000 | 0x000 | BLOCKED |
| **YieldSplitter** | 0x000 | 0x000 | 0x000 | BLOCKED |
| **CookieJarModule** | 0x000 | 0x000 | 0x000 | BLOCKED |
| **GreenGoodsENS** | 0x000 | 0x000 | 0x000 | BLOCKED |

### Not Configured in config.yaml (Missing Entirely)
- HypercertMarketplaceAdapter (events: OrderRegistered, OrderDeactivated, FractionPurchased)
- UnifiedPowerRegistry (events: PowerSourceRegistered, ConvictionAllocated)

### Schema: 24 entity types, 40 event handlers — all correctly implemented

---

## Shared Package Quality

| Area | Score | Notes |
|------|-------|-------|
| Hook boundary | 9/10 | 1 violation (`useAddressInput` in admin — acknowledged TODO) |
| Type completeness | 9/10 | 9/9 modules covered; 15 legacy `string` fields need `Address` migration |
| Query key stability | 9/10 | Exemplary pattern; 1 advisory (unserialized `AttestationFilters`) |
| Error handling | 10/10 | No empty catch blocks; consistent logger usage |
| Barrel exports | 7/10 | 21 deep import violations in client, missing exports |
| Console.log hygiene | 5/10 | 39+ calls in production code (auth, service-worker, translation) |
| Zustand selectors | 7/10 | 9 destructure-without-selector violations (Rule 6) |
| Context memoization | 6/10 | AppProvider + WorkProvider unmemoized (relies on React Compiler) |
| **Overall** | **7.5/10** | P0 fixes needed before production |

---

## Agent & Skill Quality

### Agents: 4/5 production-ready
- **cracked-coder** — READY (minor: `forge build` in deployment table)
- **code-reviewer** — READY (6 rules missing from quick-check)
- **oracle** — READY
- **migration** — READY (fix: `bun test` → `bun run test`)
- **triage** — NEEDS UPDATE (references `storage`/`offline` → should be `data-layer`)

### Skills: 5/7 reviewed production-ready
- **testing** — NEEDS UPDATE (`bun test` in 6+ places)
- **web3** — READY (no ENS resolution pattern)
- **contracts, security, review, deployment, react** — READY

### Architectural Rules: All 14 still valid
- Consider: Rule 15 — ENS resolution caching with appropriate staleTime

---

## Deployment Artifacts Status

### Sepolia (11155111)
- **Deployed**: gardenToken, actionRegistry, workResolver, workApprovalResolver, deploymentRegistry, guardian, accountProxy
- **Missing**: assessmentResolver, hatsModule, karmaGAPModule, octantModule, gardensModule, cookieJarModule, yieldSplitter, greenGoodsENS (all zero)
- **Missing schemas**: assessmentSchemaUID, workApprovalSchemaUID (zero — need `--update-schemas`)

### Arbitrum (42161)
- **Deployed**: gardenToken, actionRegistry, workResolver, workApprovalResolver, assessmentResolver, deploymentRegistry
- **Missing**: guardian, accountProxy, hatsModule, karmaGAPModule, octantModule, gardensModule, cookieJarModule, yieldSplitter, greenGoodsENS (all zero)
- **Has external**: hypercertExchange, hypercertMinter, transferManager, strategyHypercertFractionOffer
- **Has rootGarden**: tokenId=1 (active deployment)
- **Missing schemas**: assessmentSchemaUID, workApprovalSchemaUID (zero)

---

## Documentation Gaps

| Topic | Status | Priority |
|-------|--------|----------|
| `docs/developer/contracts.md` | STALE (Nov 2024, wrong addresses) | P0 |
| CLAUDE.md "What Gets Deployed" | STALE (14 vs 18+ contracts) | P0 |
| CLAUDE.md shared package structure | Missing 4 hook directories | P0 |
| `.claude/context/contracts.md` | STALE architecture tree | P1 |
| ENS integration spec | MISSING | P1 |
| Cookie Jar spec | MISSING | P1 |
| Yield Splitting spec | MISSING | P1 |
| Juicebox/GOODS token spec | MISSING | P1 |
| Package READMEs (3/6) | `bun test` → `bun run test` | P2 |
| Architecture diagram | STALE | P2 |

---

## Contract-Level Findings (Per Module)

### OctantModule (`src/modules/Octant.sol`) — PASS
- [Low] Linear scan in `_supportedAssetExists()` — O(n) per check
- [Low] Silent `catch {}` on `registerShares()` — emit failure event
- [Medium] `supportedAssetCount` manual tracking could desync
- Storage gap: 11 vars + 39 gap = 50 (correct)

### GardensModule (`src/modules/Gardens.sol`) — PASS
- [Low] `attemptPoolCreation()` external but only `OnlySelfCall`
- [Low] Hardcoded "Green Goods Community" name
- [Medium] `gardenInitialized` set BEFORE community/pool creation
- Storage gap: 13 vars + 37 gap = 50 (correct)

### HatsModule (`src/modules/Hats.sol`) — PASS
- [Medium] Phantom hat wearers from revocation burn addresses
- [Low] Recursive sub-role grant (best-effort with PartialGrantFailed)
- [Low] O(n^2) duplicate detection bounded by MAX=10
- Storage gap: 15 vars + 35 gap = 50 (correct)

### KarmaGAPModule (`src/modules/Karma.sol`) — PASS
- [Low] Partial state if MemberOf/Details attestation fails after Project UID saved
- [Low] No ReentrancyGuard (acceptable — no funds held)
- Storage gap: 5 vars + 45 gap = 50 (correct)

### CookieJarModule (`src/modules/CookieJar.sol`) — PASS
- [Low] Storage gap comment slightly misleading (ReentrancyGuard slot)
- [Low] `removeSupportedAsset()` swap-and-pop changes ordering (acceptable)
- Storage gap: safe

### HypercertsModule (`src/modules/Hypercerts.sol`) — NEEDS ATTENTION
- [Medium] No ReentrancyGuard — `mintAndRegister()` calls external minter
- [Medium] `_requireOperator()` doesn't check gardenToken/garden unlike other modules
- [Low] Admin setters allow `address(0)` — can disable module
- [Low] `_gardenHypercerts` grows unboundedly
- Storage gap: 8 vars + 42 gap = 50 (correct)

### GreenGoodsENS L2 Sender (`src/registries/ENS.sol`) — PASS
- [Medium] `claimRefund()` pull-pattern is safe (checks-effects-interactions)
- [Low] `NAME_CHANGE_COOLDOWN = 30 days` hardcoded
- [Low] Non-upgradeable (intentional — immutable CCIP config)

### GreenGoodsENS L1 Receiver (`src/registries/ENSReceiver.sol`) — PASS
- [Low] Graceful skips in `_register()` — critical for CCIP (must not revert)
- [Low] `adminRegister()` skips single-name-per-owner check (intentional)

### GardenToken (`src/tokens/Garden.sol`) — PASS
- [Medium] ENS ETH forwarding has no minter refund mechanism
- [Low] `transferRestriction` defaults to Unrestricted
- Storage gap: 10 vars + 40 gap = 50 (correct)

### GardenAccount (`src/accounts/Garden.sol`) — PASS
- [Critical/Mitigated] TBA execution bypass — properly handled with `_autoStaking` flag
- [Low] `gardenMemberCount` only increments (no decrement on revocation)

### YieldSplitter (`src/resolvers/Yield.sol`) — NEEDS ATTENTION
- [High] `splitYield()` is permissionless — timing-based front-running risk
- [Medium] `_redeemAndAccumulate()` redeems ALL shares — may hit withdrawal limits
- [Medium] `_purchaseFraction()` dangling allowance correctly reset on failure
- [Low] Default split: 48.65/48.65/2.7 (Cookie Jar/Fractions/Juicebox)
- Storage gap: 17 vars + 33 gap = 50 (correct)

### Other Core Contracts — ALL PASS
- ActionRegistry, DeploymentRegistry, UnifiedPowerRegistry, WorkResolver, WorkApprovalResolver, AssessmentResolver, AaveV3 Strategy, Schemas, GoodsToken, ResolverStub

---

## Segment-Specific Action Prompts

### 1. Octant Contracts

```
/teams ship octant-contracts

## Scope
packages/contracts — OctantModule, AaveV3 strategy, vendor/octant/

## Issues to Address
1. [BLOCKER] OctantModule not deployed on Sepolia or Arbitrum — zero address in deployment JSONs
2. [CRITICAL] No fork test against real Octant vault — ArbitrumYieldSplitter uses MockVaultForFork
3. [MEDIUM] `supportedAssetCount` manual tracking could desync from `supportedAssetList.length`
4. [LOW] `harvest()` silent catch on YieldResolver `registerShares()` — emit failure event

## Required Deliverables
- Create `test/fork/ArbitrumOctantVault.t.sol` — fork test against real Aave vault via OctantModule
  - Test: createVault, deposit, withdraw, harvest, emergencyPause on real Arbitrum contracts
- Fix `supportedAssetCount` to derive from actual non-zero entries (or document why manual is safe)
- Add event emission in harvest catch block for observability
- Deploy OctantModule to Sepolia: `bun script/deploy.ts core --network sepolia --broadcast`

## Validation
[scope:contracts] [gate:required] [check:full]
cd packages/contracts && bun run test && bun run test:fork
```

### 2. Garden Conviction Voting Contracts

```
/teams ship conviction-voting

## Scope
packages/contracts — GardensModule, UnifiedPowerRegistry, vendor/gardens/

## Issues to Address
2. [CRITICAL] UnifiedPowerRegistry not in indexer config.yaml
3. [HIGH] No Sepolia fork test for ConvictionVoting (9 tests Arbitrum, 0 Sepolia)
4. [MEDIUM] `onGardenMinted()` marks gardenInitialized=true BEFORE community/pool creation
5. [LOW] Hardcoded "Green Goods Community" name for all communities

## Required Deliverables
- Create `test/fork/SepoliaConvictionVoting.t.sol` — mirror ArbitrumConvictionVoting tests
- Add UnifiedPowerRegistry events to `packages/indexer/config.yaml`:
  PowerSourceRegistered, PowerSourceDeregistered, ConvictionAllocated
- Document the partial initialization recovery flow (resetGardenInitialization)
- Deploy GardensModule to Sepolia and Arbitrum

## Validation
[scope:contracts] [scope:indexer] [gate:required] [check:full]
cd packages/contracts && bun run test && bun run test:fork
```

### 3. Karma Contracts & Schemas

```
/teams ship karma-integration

## Scope
packages/contracts — KarmaGAPModule, lib/Karma.sol, lib/JsonBuilder.sol

## Issues to Address
2. [CRITICAL] No fork test against real Karma GAP contract
3. [LOW] createProject() partial state if MemberOf/Details attestation fails

## Required Deliverables
- Create `test/fork/SepoliaKarmaGAP.t.sol` — fork test against real GAP contract on Sepolia
  - Test: createProject, addMilestone, addImpact with real attestation UIDs
- Deploy KarmaGAPModule to Sepolia first, then Arbitrum
- Verify schema UIDs match between deployment JSON and GAP contract

## Validation
[scope:contracts] [gate:required] [check:full]
cd packages/contracts && bun run test && bun run test:fork
```

### 4. Hypercerts Contracts

```
/teams ship hypercerts-module

## Scope
packages/contracts — HypercertsModule, HypercertMarketplaceAdapter, registries/Power.sol

## Issues to Address
1. [CRITICAL] HypercertsModule missing ReentrancyGuard on mintAndRegister()
2. [CRITICAL] HypercertMarketplaceAdapter not in indexer config.yaml
3. [MEDIUM] Admin setters (setHypercertMinter, setMarketplaceAdapter) allow address(0)
4. [LOW] _gardenHypercerts mapping grows unboundedly — no removal mechanism
5. [LOW] _requireOperator() doesn't check gardenToken/garden unlike other modules

## Required Deliverables
- Add `ReentrancyGuardUpgradeable` to HypercertsModule (update storage gap: 8+1 guard+41 gap = 50)
- Add zero-address validation to all admin setters: `if (addr == address(0)) revert ZeroAddress();`
- Add HypercertMarketplaceAdapter events to indexer config.yaml
- Create Sepolia fork test for Hypercerts (currently Arbitrum-only: 12 tests)
- Verify HypercertMinter address consistency across chains (0x822F...0d07)

## Validation
[scope:contracts] [scope:indexer] [gate:required] [check:full]
cd packages/contracts && bun run test && bun run test:fork
```

### 5. Hats Contracts

```
/teams ship hats-module

## Scope
packages/contracts — HatsModule, lib/Hats.sol

## Issues to Address
2. [HIGH] SepoliaHats fork test has only 1 test vs 4 on Arbitrum
3. [MEDIUM] Phantom hat wearers from revocation burn addresses (inherent to Hats design)
4. [LOW] SYNC_POWER_GAS_STIPEND=100_000 may be too low for complex strategies
5. [LOW] O(n^2) duplicate detection in setConvictionStrategies (bounded by MAX=10)

## Required Deliverables
- Expand SepoliaHats.t.sol to parity with ArbitrumHats (4 tests minimum)
- Deploy HatsModule to Sepolia and Arbitrum
- Document phantom hat wearer behavior and cleanup strategy
- Add HatsModule events to indexer config.yaml with deployed addresses

## Validation
[scope:contracts] [gate:required] [check:full]
cd packages/contracts && bun run test && bun run test:fork
```

### 6. Cookie Jar Contracts

```
/teams ship cookie-jar-module

## Scope
packages/contracts — CookieJarModule

## Issues to Address
2. [CRITICAL] Zero fork test coverage — only unit tests exist
3. [LOW] Storage gap comment slightly misleading (ReentrancyGuard slot counting)

## Required Deliverables
- Create `test/fork/ArbitrumCookieJar.t.sol` — fork test with:
  - Real CookieJarFactory deployment
  - Jar creation with ERC1155 Hats-gated access
  - Asset deposit and Hats-gated withdrawal
  - Yield routing integration (48.65% cookie jar split from YieldSplitter)
- Create `test/fork/SepoliaCookieJar.t.sol` if deploying to Sepolia
- Fix storage gap comment accuracy
- Deploy CookieJarModule to Sepolia and Arbitrum

## Validation
[scope:contracts] [gate:required] [check:full]
cd packages/contracts && bun run test && bun run test:fork
```

### 7. Juicebox Contracts

```
/teams ship juicebox-integration

## Scope
packages/contracts — YieldSplitter (Juicebox integration), interfaces/IJuicebox.sol, mocks/Juicebox.sol

## Issues to Address
1. Ensure if no Juicebox yield properly sent to safe and Green Goods mock token used for Garden communities
3. [LOW] JB integration tested indirectly via ArbitrumYieldSplitter — no dedicated fork test

## Required Deliverables
- Verify JB Terminal/Multi-Terminal addresses are correct in ArbitrumYieldSplitter fork test
- Document the 48.65/48.65/2.7 split rationale and configurability
- If JB is deployer-managed: add JB deployment to deploy.ts pipeline

## Validation
[scope:contracts] [gate:advisory] [check:quick]
cd packages/contracts && bun run test:fork
```

### 8. ENS Contracts

```
/teams ship ens-integration

## Scope
packages/contracts — registries/ENS.sol (L2Sender), registries/ENSReceiver.sol (L1Receiver)

## Issues to Address
2. [HIGH] No Sepolia fork test (11 tests on Arbitrum only)
3. [MEDIUM] GardenToken ETH forwarding to ENS has no minter refund mechanism
4. [LOW] NAME_CHANGE_COOLDOWN=30 days hardcoded — not configurable without upgrade
5. [LOW] L2Sender is non-upgradeable (intentional, uses immutable CCIP config)

## Required Deliverables
- Create `test/fork/SepoliaENS.t.sol` — fork test for Sepolia ENS registration
- Document the cross-chain CCIP message flow (L2 Arbitrum -> L1 Mainnet)
- Consider: add ETH refund mechanism for failed ENS registrations to GardenToken
- Deploy GreenGoodsENS L2Sender to Sepolia and Arbitrum
- Deploy GreenGoodsENSReceiver to Mainnet

## Validation
[scope:contracts] [gate:required] [check:full]
cd packages/contracts && bun run test && bun run test:fork
```

### 9. Green Goods Core Contracts & Schemas

```
/teams ship core-contracts

## Scope
packages/contracts — GardenToken, GardenAccount, ActionRegistry, DeploymentRegistry, Resolvers, Schemas

## Issues to Address
4. [MEDIUM] YieldSplitter splitYield() is permissionless — document timing risk
5. [MEDIUM] YieldSplitter _redeemAndAccumulate() redeems ALL shares — may hit withdrawal limits

## Required Deliverables
- Deploy missing core contracts: assessmentResolver (Sepolia), guardian+accountProxy (Arbitrum)
- Register EAS schemas: `bun script/deploy.ts core --network sepolia --broadcast --update-schemas`
- Register EAS schemas on Arbitrum similarly
- Document permissionless splitYield design decision and mitigations
- Add withdrawal limit handling in _redeemAndAccumulate (check maxWithdraw first)

## Validation
[scope:contracts] [gate:required] [check:full]
bun run verify:contracts
```

### 10. Create Garden UI/UX

```
/teams ship create-garden-ux

## Scope
packages/admin — CreateGarden views and components

## Issues to Address
1. [MEDIUM] No offline check before deployment transaction
2. [LOW] Lazy validation (shows on "next" click, not inline)

## Required Deliverables
- Add `useOffline()` check before garden creation tx — show clear message if offline
- Consider: inline validation on blur for required fields
- Add confirmation dialog before deployment tx (shows gas estimate + summary)

## Validation
[scope:client] [gate:advisory] [check:quick]
cd packages/admin && bun run test && bun build
```

### 11. Create Assessment UI/UX

```
/teams ship assessment-ux

## Scope
packages/admin — CreateAssessment views and step components

## Issues to Address
1. [MEDIUM] Wallet provider detection happens on submit, not wizard entry
2. [LOW] resetWorkflow() called silently on mount

## Required Deliverables
- Move wallet detection to wizard entry (Step 1 mount) — show connect prompt early
- Add wallet status indicator in wizard header
- Preserve workflow error state across navigation (don't reset on mount unless explicit)

## Validation
[scope:client] [gate:advisory] [check:quick]
cd packages/admin && bun run test && bun build
```

### 12. Auth UI/UX

```
/teams ship auth-ux

## Scope
packages/client — Login views, RequireAuth, passkey flow
packages/admin — Login views, RequireAuth

## Issues to Address
1. [MEDIUM] Admin login has no fallback guidance when no wallet extension installed
2. [MEDIUM] Passkey E2E tests permanently skipped — real Pimlico flow untested
3. [MEDIUM] 9 console.log in modules/auth/session.ts leak passkey diagnostics in production
4. [LOW] Client login Splash component couples loading and login states

## Required Deliverables
- Add wallet extension detection in admin login — show install guidance for MetaMask/Rabby
- Replace console.log in auth/session.ts with logger.debug() behind debug flag
- Fix or document passkey E2E test strategy
- Consider: separate Splash loading from login UI into distinct components

## Validation
[scope:client] [scope:admin] [gate:advisory] [check:quick]
cd packages/client && bun run test && cd ../admin && bun run test
```

### 13. Join Garden UI/UX

```
/teams ship join-garden-ux

## Scope
packages/client — Garden view, useJoinGarden hook

## Issues to Address
1. [MEDIUM] No confirmation dialog — single click triggers blockchain tx
2. [LOW] No role explanation — user joins as gardener without context

## Required Deliverables
- Add ConfirmDialog before join transaction showing:
  - Garden name and description
  - Role explanation ("You'll join as a Gardener, able to submit work")
  - Gas estimate
- Add brief role description below join button when not yet a member

## Validation
[scope:client] [gate:advisory] [check:quick]
cd packages/client && bun run test && bun build
```

### 14. Work Submission UI/UX

```
/teams ship work-submission-ux

## Scope
packages/client — Garden/Work views, useWork, WorkProvider
packages/shared — work hooks, job queue

## Issues to Address
1. [HIGH] No visible JobQueue integration at view level — uploadWork() appears synchronous
2. [MEDIUM] Raw setTimeout in navigation effect (Rule 1 violation)
3. [LOW] useEffect dependency on setGardenAddress function identity

## Required Deliverables
- Verify and document offline work submission path:
  - Does useWork/WorkProvider internally queue via JobKind.WORK_SUBMISSION?
  - If not: add job queue integration for offline-safe submission
  - Add explicit offline feedback at view level (queue indicator, sync status)
- Replace setTimeout with useTimeout() from @green-goods/shared
- Stabilize setGardenAddress in useEffect dependencies

## Validation
[scope:client] [scope:middleware] [gate:required] [check:full]
cd packages/client && bun run test && cd ../shared && bun run test
```

### 15. Work Approval UI/UX

```
/teams ship work-approval-ux

## Scope
packages/admin — WorkDetail view

## Issues to Address
1. [MEDIUM] Silent failure — catch block logs error but shows no toast
2. [MEDIUM] Validation hints informational only, don't prevent action
3. [LOW] Large useCallback dependency array

## Required Deliverables
- Add toast.error() in handleApprovalSubmit catch block
- Add parseContractError for contract-specific failure messages
- Consider: disable approve button when validation hints are active

## Validation
[scope:admin] [gate:advisory] [check:quick]
cd packages/admin && bun run test && bun build
```

### 16. Hypercert Minting UI/UX

```
/teams ship hypercert-minting-ux

## Scope
packages/admin — HypercertWizard, MintingDialog, step components

## Issues to Address
1. [LOW] Raw addEventListener("beforeunload") — should use useWindowEvent (Rule 2)
2. [LOW] 650+ line component — could extract logic into custom hooks

## Required Deliverables
- Replace raw beforeunload listener with useWindowEvent from @green-goods/shared
- Consider: extract allowlist computation and contributor weight logic into separate hooks

## Validation
[scope:admin] [gate:advisory] [check:quick]
cd packages/admin && bun run test && bun build
```

### 17. Vault Deposits UI/UX

```
/teams ship vault-deposits-ux

## Scope
packages/admin — Vault view, DepositModal, WithdrawModal
packages/shared — vault hooks

## Issues to Address
1. [LOW] No currency symbol/denomination shown alongside TVL
2. [LOW] Amount validation deferred to modals

## Required Deliverables
- Add token symbol display next to TVL and balance amounts
- Verify DepositModal has: min/max validation, insufficient balance check, gas estimation
- Verify WithdrawModal has: available balance display, partial withdrawal support

## Validation
[scope:admin] [gate:advisory] [check:quick]
cd packages/admin && bun run test && bun build
```

### 18. Documentation & Agent Config Updates

```
/teams ship docs-and-agent-fixes

## Scope
docs/, CLAUDE.md, .claude/agents/, .claude/skills/, .claude/context/, package READMEs

## Issues to Address (Priority Order)
1. [P0] Rewrite docs/developer/contracts.md — stale since Nov 2024, wrong addresses
2. [P0] Update CLAUDE.md "What Gets Deployed" — 14 listed vs 18+ actual
3. [P0] Update CLAUDE.md shared package structure — missing conviction/, ens/, marketplace/, cookie-jar/
4. [P1] Create 4 missing specs: ENS, Cookie Jar, Yield Splitting, Juicebox
5. [P1] Fix .claude/context/contracts.md stale architecture tree
6. [HIGH] Fix testing skill: replace all `bun test` -> `bun run test`
7. [HIGH] Fix triage agent: `storage`/`offline` -> `data-layer`
8. [HIGH] Fix migration agent: `bun test` -> `bun run test`
9. [HIGH] Fix code-reviewer quick-check: add Rules 4,5,8,9,11,14
10. [MEDIUM] Fix contracts README: remove `forge test` examples, fix referenced docs
11. [MEDIUM] Fix shared README: `bun test` -> `bun run test`, add new hook directories
12. [MEDIUM] Fix indexer README: add new entity types
13. [MEDIUM] Fix cracked-coder: remove `forge build` from deployment table
14. [LOW] Fix vitest coverage threshold: 60% -> 70% to match CLAUDE.md

## Validation
[scope:docs] [gate:advisory] [check:quick]
No code changes — documentation and config only
```

### 19. Indexer Config Update (Post-Deployment)

```
/teams ship indexer-config

## Scope
packages/indexer — config.yaml, envio-integration.ts

## Issues to Address
2. [CRITICAL] HypercertMarketplaceAdapter not in config.yaml at all
3. [CRITICAL] UnifiedPowerRegistry not in config.yaml at all
4. [LOW] ENS text record fields on Gardener entity never populated by handlers

## Required Deliverables
- After contract deployment: run envio-integration.ts to populate config.yaml
- Add HypercertMarketplaceAdapter section to config.yaml with events
- Add UnifiedPowerRegistry section to config.yaml with events
- Document that Gardener ENS fields are client-side resolved (not indexed)
- Rebuild indexer: cd packages/indexer && bun build

## Validation
[scope:indexer] [gate:required] [check:full]
cd packages/indexer && bun build && bun run test
```

### 20. Shared Package Rule Compliance

```
/teams ship shared-package-compliance

## Scope
packages/shared, packages/client, packages/admin

## P0 Issues (Production Risk)
1. 9 console.log in modules/auth/session.ts:153-172 — passkey diagnostics leak in prod
   FIX: Replace with logger.debug() behind debug flag
2. AppContext.Provider value (providers/App.tsx:180-192) — inline object, no useMemo
   FIX: Wrap in useMemo or verify React Compiler is enabled via build output
3. WorkProvider context values (providers/Work.tsx:288-316) — same issue
   FIX: Wrap selectionValue, formValue, legacyValue in useMemo

## P1 Issues (Rule Violations)
4. 21 deep import violations in client (Rule 11) across 12 files
   FIX: Add missing exports to shared/src/index.ts:
   - useQueueFlush, useQueueStats, formatTimeSpent, normalizeTimeSpentMinutes
   - imageCompressor, GARDEN_ACCOUNT_ROLE_ABI
   Then update all 21 imports to use @green-goods/shared barrel
5. 15 address fields typed as string (Rule 5) in:
   - types/eas-responses.ts (5 fields)
   - types/domain.ts (3 fields)
   - types/indexer-responses.ts (1 field)
   - types/job-queue.ts (6 fields)
   FIX: Change all to Address type from @green-goods/shared
6. 9 Zustand selector violations (Rule 6) across admin/client/shared
   FIX: Replace useStore() destructures with useStore(s => s.field) selectors
7. useAddressInput hook in admin/CreateGardenSteps/TeamStep.tsx
   FIX: Move to packages/shared/src/hooks/utils/useAddressInput.ts

## P2 Issues (Improvements)
8. ServiceWorkerManager.register() event listeners never removed (Rule 2)
9. 30+ console.warn/error in service-worker.ts, browser-translator.ts -> use logger
10. AttestationFilters in query key not serialized (Rule 7)

## Validation
[scope:middleware] [scope:client] [scope:admin] [gate:required] [check:full]
bun format && bun lint && cd packages/shared && bun run test && cd ../client && bun run test
```

---

## Recommended Execution Order

1. **Deploy contracts** (Prompts 1-9) — unblocks everything
   - Sepolia first: `bun script/deploy.ts core --network sepolia --broadcast --update-schemas`
   - Then Arbitrum: `bun script/deploy.ts core --network arbitrum --broadcast --update-schemas`
2. **Update indexer** (Prompt 19) — needs real addresses from step 1
3. **Fix shared package P0s** (Prompt 20) — console.log leaks, context memoization
4. **Fix UX flows** (Prompts 10-17) — medium-priority improvements
5. **Update docs/agents** (Prompt 18) — drift cleanup

---

## Pre-Release Checklist

- [ ] Deploy all modules to Sepolia + register schemas
- [ ] Deploy all modules to Arbitrum + register schemas
- [ ] Update config.yaml with deployed addresses (run envio-integration.ts)
- [ ] Add HypercertMarketplaceAdapter + UnifiedPowerRegistry to indexer
- [ ] Write fork tests: OctantModule (real vault), CookieJarModule, KarmaGAPModule
- [ ] Expand Sepolia fork test parity (ConvictionVoting, YieldSplitter, Hypercerts, ENS)
- [ ] Add ReentrancyGuard to HypercertsModule
- [ ] Add zero-address validation to HypercertsModule admin setters
- [ ] Fix console.log leaks in auth/session.ts
- [ ] Fix context value memoization in AppProvider + WorkProvider
- [ ] Fix 21 deep import violations in client
- [ ] Fix 15 Address type violations
- [ ] Fix 9 Zustand selector violations
- [ ] Fix `bun test` -> `bun run test` in testing skill, migration agent, READMEs
- [ ] Fix triage agent skill references (`storage`/`offline` -> `data-layer`)
- [ ] Update docs/developer/contracts.md
- [ ] Update CLAUDE.md deployment and shared package sections
- [ ] Fix vitest coverage threshold 60% -> 70%
- [ ] Verify bundle sizes against budgets (<150KB main, <400KB total)
- [ ] Add toast.error() to work approval catch block
- [ ] Add ConfirmDialog to join garden flow
- [ ] Run full validation: `bun format && bun lint && bun run test && bun build`

---

## Review Methodology

This review was conducted by a 6-agent pair-lane team:

| Lane | Driver | Observer | Scope |
|------|--------|----------|-------|
| Chain | chain-driver | chain-observer | contracts (8 modules + core) + indexer (24 entities) |
| Middleware | middleware-driver | middleware-observer | shared package (90+ hooks) + documentation (68+ files) |
| App | app-driver | app-observer | client + admin (8 UX flows) + agent/skill quality |

Each finding was cross-validated across lanes. The adversarial lead challenged weak findings, required file/line evidence, and synthesized into 20 actionable prompts.

**Key metrics:**
- 1,280 files analyzed across 172K+ lines of changes
- 68 issues identified (3 blocker, 3 critical, 9 high, 16 medium, 37 low)
- 20 segment-specific action prompts generated
- 102 fork tests on Arbitrum, 29 on Sepolia, 4 on Celo mapped
- 24 indexer entities, 40 event handlers audited
