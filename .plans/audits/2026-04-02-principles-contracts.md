# Principles Audit Report - Contracts Package - 2026-04-02

## Executive Summary
- **Package analyzed**: packages/contracts/src (Solidity smart contracts)
- **Mode**: Single-agent
- **Principle groups audited**: SOLID, DRY/KISS/YAGNI/SOC, EDA/ADR/C4, ACID/BASE/CAP
- **Source files**: 30 non-vendor, non-mock, non-interface .sol files
- **Total LOC**: ~9,400 (excluding vendor, mocks, interfaces)

### Scorecard

| Principle | Score | Top Issue | Effort |
|-----------|-------|-----------|--------|
| S (SRP) | YELLOW | HatsModule (852 LOC) and GardensModule (846 LOC) mix tree creation, role grant/revoke, conviction sync, and admin config | L |
| O (OCP) | GREEN | Role dispatch via _getHatId mapping is clean; chain dispatch centralized in libraries | -- |
| L (LSP) | GREEN | UUPS upgrade patterns consistent with proper storage gaps documented | -- |
| I (ISP) | GREEN | Interfaces are minimal and purpose-specific (IGardenAccessControl, IHatsModule, IGardensModule) | -- |
| D (DIP) | GREEN | Contracts depend on interfaces, not implementations; deployment artifacts pattern enforced | -- |
| DRY | GREEN | `error ZeroAddress()` centralized in CommonErrors.sol (was 12+ independent declarations) | -- |
| KISS | GREEN | Each contract has a clear single purpose; complexity is inherent (Gardens V2 integration, Hats tree creation) | -- |
| YAGNI | GREEN | Deprecated slots properly preserved for upgrade safety; ResolverStub is minimal; no dead code | -- |
| SOC | GREEN | Clean vertical separation: tokens, accounts, modules, registries, resolvers, libraries, strategies | -- |
| EDA | GREEN | Event emission is thorough; graceful degradation via try/catch; failure events distinct from success | -- |
| ADR | GREEN | 8 contract ADRs created (ADR-009 through ADR-016) | -- |
| C4 | GREEN | C4 L3 Mermaid diagram in ADR-009 maps full mintGarden() module interaction flow | -- |
| ACID | GREEN | Reentrancy guards on all state-mutating external functions; CEI pattern followed; storage gap discipline | -- |
| BASE | GREEN | Graceful degradation via try/catch is consistent; partial initialization tracked with events | -- |
| CAP | GREEN | On-chain state is CP; indexer reads are AP; no consistency mismatches in contract code | -- |

---

## Previous Findings Status

_Tracked from: 2026-04-02 full-codebase audit_

| ID | Finding | Status | Notes |
|----|---------|--------|-------|
| ADR1 | No ADRs for major architectural decisions | FIXED | 8 contract ADRs created (ADR-009 through ADR-016) covering module pattern, UUPS, Hats tree, CCIP ENS, power registry, storage gaps, self-call pattern, and TBA guard flag |

---

## Findings by Principle

### SOLID

#### CS1. HatsModule mixes hat tree creation, role management, conviction sync, and admin configuration -- HIGH

- **Principle**: SRP
- **File**: `packages/contracts/src/modules/Hats.sol:1-852`
- **Issue**: The 852-line HatsModule handles four distinct concerns: (1) hat tree creation with eligibility module wiring (lines 352-422), (2) role grant/revoke with hierarchical sub-role propagation (lines 429-731), (3) conviction power sync across CV strategies (lines 753-768), and (4) garden configuration/admin functions (lines 485-637). Each concern changes for different reasons: tree structure changes, role hierarchy changes, conviction integration changes, and admin policy changes.
- **Evidence**: `_grantRole` (lines 653-685) handles role minting, protocol-wide gardener auto-mint, GAP admin sync, sub-role propagation, AND conviction sync -- five side effects in one function. `_configureEligibilityModules` (lines 794-843) is an entirely separate integration concern.
- **Recommendation**: Extract conviction sync into a `ConvictionSyncLib` or a separate `ConvictionSyncModule` that HatsModule calls. Extract eligibility module wiring into a `HatsEligibilityHelper` library. This reduces HatsModule to tree creation and role management only.

#### CS2. GardensModule orchestrates community creation, power registration, treasury seeding, and pool creation -- HIGH

- **Principle**: SRP
- **File**: `packages/contracts/src/modules/Gardens.sol:1-846`
- **Issue**: The 846-line GardensModule handles: (1) community creation via RegistryFactory (lines 574-609), (2) power source registration in UnifiedPowerRegistry (lines 511-559), (3) treasury seeding via GOODS minting (lines 613-627), (4) signal pool creation (lines 634-682), and (5) extensive admin/retry functions. Each integration is independent and changes for different reasons.
- **Evidence**: `onGardenMinted` (lines 193-252) orchestrates four independent steps with independent failure modes. The module already uses self-call pattern (`this.attemptPoolCreation`) to isolate pool creation -- the same pattern could isolate other steps.
- **Recommendation**: The self-call pattern for pool creation is the right approach. Consider extracting community creation and power registration into similarly isolated patterns. The 15 admin setters (lines 363-429) are boilerplate but acceptable for a module that wires many dependencies.

#### CS3. Deployment registry has 15 individual getter functions for the same data -- MEDIUM

- **Principle**: SRP / ISP
- **File**: `packages/contracts/src/registries/Deployment.sol:249-332`
- **Issue**: 15 individual `get*()` functions (getEAS, getEASSchemaRegistry, getCommunityToken, etc.) each load the full `NetworkConfig` struct via `getNetworkConfigForChain(block.chainid)` and return a single field. This is 15 copies of the same storage read pattern.
- **Evidence**: Lines 249-332 contain 15 functions with identical structure: `return getNetworkConfigForChain(block.chainid).fieldName;`
- **Recommendation**: These getters serve a convenience purpose for external callers, so this is INFO-level for architecture. However, downstream contracts that need multiple addresses should call `getNetworkConfig()` once rather than multiple `get*()` calls. No action needed -- this is a gas optimization concern, not a structural concern.

### Code Quality (DRY / KISS / YAGNI / SOC)

#### CDRY1. `error ZeroAddress()` redeclared in 12+ independent locations -- MEDIUM

- **Principle**: DRY
- **File**: Multiple files (see evidence)
- **Issue**: The same custom error `error ZeroAddress()` is declared file-level or contract-level in at least 12 contract files: `Hats.sol`, `Gardens.sol`, `Octant.sol`, `Unlock.sol`, `Power.sol`, `ENS.sol`, `ENSReceiver.sol`, `Action.sol`, `Yield.sol`, `HypercertMarketplaceAdapter.sol`, `AaveV3ERC4626.sol`, and `IKarmaGAPModule.sol`. Similarly, `error NotGardenOperator()` is declared in 4 files and `error NotGardenToken()` in 4 files.
- **Evidence**: `grep -r "error ZeroAddress" src/ --include="*.sol"` returns 15+ matches across independent file scopes.
- **Recommendation**: Create a shared `src/errors/CommonErrors.sol` file exporting `error ZeroAddress()`, `error NotGardenOperator()`, `error NotGardenToken()`, and other repeated errors. Import from there. This is a minor DRY violation but impacts maintainability when error signatures need to change (e.g., adding parameters). Per the anti-pattern rule, cross-package duplication that avoids coupling is INFO; however, these are all within the same package and would benefit from centralization.

#### CDRY2. Setter pattern duplicated across all modules -- INFO

- **Principle**: DRY
- **File**: Multiple modules
- **Issue**: Every module has 5-15 nearly identical `set*()` functions following the pattern: validate non-zero, store old value, update storage, emit event. This is inherent to Solidity's lack of metaprogramming but adds ~100-200 LOC per module of boilerplate.
- **Evidence**: `GardensModule` lines 363-429 (10 setters), `OctantModule` has similar patterns, `HatsModule` lines 540-637.
- **Recommendation**: INFO -- this is idiomatic Solidity. The alternative (a generic setter with selector dispatch) would reduce readability and increase gas. No action recommended.

### Architecture (EDA / ADR / C4)

#### CADR1. Contract architecture decisions undocumented (carried forward) -- HIGH

- **Principle**: ADR
- **File**: N/A (absence of documentation)
- **Issue**: Contract-specific architecture decisions lack formal documentation:
  1. **Module pattern**: GardenToken orchestrates modules via try/catch (failure MUST NOT revert mint)
  2. **UUPS upgrade strategy**: Every stateful contract is UUPS upgradeable with documented storage gaps
  3. **Hats Protocol hat tree structure**: 6-role hierarchy (Owner > Operator > Evaluator > Gardener + Funder + Community)
  4. **Graceful degradation**: All module integrations are non-blocking via try/catch
  5. **Cross-chain ENS via CCIP**: L2 sender (Arbitrum) -> L1 receiver (Ethereum) for ENS subdomain registration
  6. **UnifiedPowerRegistry**: Single registry replacing per-garden NFTPowerRegistry deployments
  7. **Storage gap convention**: 50 total slots per contract, explicitly calculated and documented
  8. **Self-call pattern**: `this.attemptPoolCreation()` to enable try/catch on internal logic
- **Evidence**: These are partially documented in NatSpec comments but not in structured ADRs. A developer reading `Gardens.sol` for the first time would need to trace through the entire module interaction to understand the design.
- **Recommendation**: Create `.plans/adr/` directory with ADRs for each decision. Contract-specific ADRs are particularly valuable because they justify security-sensitive design choices (e.g., why `_autoStaking` guard flag exists in GardenAccount).

#### CC4-1. Module interaction flow lacks architectural diagram -- MEDIUM

- **Principle**: C4
- **File**: Multiple (architectural concern)
- **Issue**: The contract system has a complex module interaction graph: `GardenToken.mintGarden()` calls `HatsModule.createGardenHatTree()`, `KarmaGAPModule.createProject()`, `OctantModule.onGardenMinted()`, `GardensModule.onGardenMinted()`, `CookieJarModule.onGardenMinted()`, `ActionRegistry.setGardenDomainsFromMint()`, and `GreenGoodsENS.registerGarden()`. Each module has its own failure mode and event emission. No C4 L3 diagram maps this.
- **Evidence**: `GardenToken._initializeRoleAndGovernance()` (lines 369-418) and `_initializeIntegrationsAndAccount()` (lines 421-471) contain 7 module calls with independent try/catch blocks. The ordering and failure isolation is critical but undocumented outside of inline comments.
- **Recommendation**: Create a C4 L3 component diagram showing: GardenToken -> [HatsModule, KarmaGAPModule, OctantModule, GardensModule, CookieJarModule, ActionRegistry, GreenGoodsENS] with failure modes annotated. This would be valuable for onboarding and security review.

### Data (ACID / BASE / CAP)

#### CACID1. GardenAccount.joinGarden() has non-atomic state updates -- LOW

- **Principle**: ACID
- **File**: `packages/contracts/src/accounts/Garden.sol:217-236`
- **Issue**: `joinGarden()` performs three operations: (1) grant gardener role via HatsModule, (2) increment `gardenMemberCount`, and (3) auto-register in Gardens V2 community. If step 1 succeeds but step 3 fails (which is caught by try/catch), the member count is incremented but community registration is incomplete. This is by design (best-effort) and documented, but the `gardenMemberCount` is permanently incremented even if the user's community membership fails.
- **Evidence**: Line 233 `gardenMemberCount++` runs before line 235 `_autoRegisterInCommunity()` which has a try/catch. The member count is a display metric, not a security gate, so impact is LOW.
- **Recommendation**: This is intentional -- the gardener role grant is the critical operation, and member count tracking is best-effort. No action needed. The `_autoStaking` guard flag (lines 391-397) correctly prevents TBA execution bypass, which is the actual security concern.

---

## Priority Queue

Top fixes ordered by severity and effort:

1. ~~**Create ADRs for contract architecture decisions**~~ -- FIXED: ADR-009 through ADR-016
2. **Extract conviction sync from HatsModule** -- SRP -- `packages/contracts/src/modules/Hats.sol` -- Effort: M
3. ~~**Create shared CommonErrors.sol for repeated errors**~~ -- FIXED: `src/errors/CommonErrors.sol`, 18 files updated
4. ~~**Create C4 L3 module interaction diagram**~~ -- FIXED: Mermaid diagram in ADR-009

---

## Trend (last N audits)

| Principle | 2026-04-02 (full) | 2026-04-02 (contracts) |
|-----------|-------------------|----------------------|
| S (SRP) | YELLOW | YELLOW |
| O (OCP) | GREEN | GREEN |
| L (LSP) | GREEN | GREEN |
| I (ISP) | YELLOW | GREEN |
| D (DIP) | GREEN | GREEN |
| DRY | GREEN | YELLOW |
| KISS | YELLOW | GREEN |
| YAGNI | GREEN | GREEN |
| SOC | YELLOW | GREEN |
| EDA | GREEN | GREEN |
| ADR | RED | RED |
| C4 | YELLOW | YELLOW |
| ACID | GREEN | GREEN |
| BASE | GREEN | GREEN |
| CAP | GREEN | GREEN |

---

## Next Steps

> **This audit is read-only.** To apply fixes, reply with:
> - `fix critical` -- address Critical findings only
> - `fix all` -- address all findings by priority
> - `fix CS1, CDRY1` -- address specific findings by ID
