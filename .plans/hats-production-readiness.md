# Hats Protocol V2 - Production Readiness Plan

**Branch**: `feature/hats-protocol-v2`
**Agent**: cracked-coder (TDD workflow)
**Status**: Ready for deployment
**Last Updated**: 2026-02-05

---

## Executive Summary

The Hats Protocol implementation is **~95% complete** with excellent test coverage and graceful error handling. The remaining work is **deployment tasks** (creating hat trees on testnets).

| Area | Status | Blocking? |
|------|--------|-----------|
| Contracts (Arbitrum) | ✅ Ready | No |
| Contracts (Sepolia) | Needs hat tree | **YES** |
| Contracts (Base Sepolia) | Needs hat tree | **YES** |
| Contracts (Celo) | Needs hat tree | **YES** |
| Shared Package | ✅ Complete | No |
| Indexer (handlers) | ✅ Complete | No |
| Indexer (addresses) | Needs config | **YES** |

### Completed Since Initial Review ✅
- [x] Error recovery in `_configureEligibilityModules` (try/catch + events)
- [x] UUPS upgrade tests (3 tests)
- [x] Batch operations tests (3 tests)
- [x] Eligibility recovery tests (4 tests)
- [x] Multi-chain support expanded (4 chains)

---

## Remaining Tasks (Deployment Only)

### Task 1: Create Hat Trees on Testnets
**Complexity**: M | **Type**: Deployment

**Problem**: `HatsLib.sol` has zeros for all non-Arbitrum chains:
```solidity
// Sepolia (11155111) - Primary testnet
uint256 internal constant SEPOLIA_COMMUNITY_HAT = 0;
uint256 internal constant SEPOLIA_GARDENS_HAT = 0;
uint256 internal constant SEPOLIA_PROTOCOL_GARDENERS_HAT = 0;

// Base Sepolia (84532) - Legacy testnet
uint256 internal constant BASE_SEPOLIA_COMMUNITY_HAT = 0;
// ... also zeros

// Celo (42220)
uint256 internal constant CELO_COMMUNITY_HAT = 0;
// ... also zeros
```

**Solution** (for each chain):
```bash
cd packages/contracts

# 1. Ensure HatsModule is deployed
bun script/deploy.ts core --network sepolia --broadcast

# 2. Create hat tree
GARDEN_HATS_MODULE=<deployed-address> \
forge script script/SetupHatsTree.s.sol \
  --chain-id 11155111 --rpc-url $SEPOLIA_RPC --broadcast --account green-goods-deployer

# 3. Update HatsLib.sol with returned hat IDs
```

**Files to Update**:
- `packages/contracts/src/lib/Hats.sol` (lines 42-82)

---

### Task 2: Update Indexer Contract Addresses
**Complexity**: S | **Type**: Configuration

**File**: `packages/indexer/config.yaml`

After HatsModule deployment, update GardenHatsModule addresses:
```yaml
# Currently all 0x0000...
GardenHatsModule:
  - network: arbitrum
    address: "0x..."  # TODO: Add after deployment
  - network: sepolia
    address: "0x..."  # TODO: Add after deployment
  - network: baseSepolia
    address: "0x..."  # TODO: Add after deployment
  - network: celo
    address: "0x..."  # TODO: Add after deployment
```

---

### Task 3 (Optional): Deploy Eligibility Modules
**Complexity**: M | **Type**: Deployment

**Note**: This is OPTIONAL - the system works without eligibility modules due to graceful degradation.

**Modules to Deploy**:
- `AllowlistEligibility` - For Funder role (operator-managed whitelist)
- `ERC20Eligibility` - For Community role (token-gated membership)

**Deploy via Hats Protocol UI or scripts, then update**:
- `packages/contracts/src/lib/Hats.sol` (eligibility module addresses)

---

## Completed Tasks ✅

### ~~Task 1.2: Error Recovery~~ ✅ DONE
Error recovery added to `_configureEligibilityModules()` with try/catch and `EligibilityModuleCreationFailed` events.

### ~~Task 2.1: UUPS Upgrade Tests~~ ✅ DONE
3 tests added:
- `test_upgrade_preservesState()`
- `test_upgrade_revertsForNonOwner()`
- `test_upgrade_emitsCorrectEvents()`

### ~~Task 2.2: Batch Operations Tests~~ ✅ DONE
3 tests added:
- `test_grantRoles_batchGrantsMultipleRoles()`
- `test_grantRoles_revertsOnArrayMismatch()`
- `test_revokeRoles_batchRevokesMultipleRoles()`

### ~~Task 2.3: Eligibility Recovery Tests~~ ✅ DONE
4 tests added covering graceful degradation when eligibility modules fail.

---

## Critical Files Reference

| File | Purpose | Status |
|------|---------|--------|
| `packages/contracts/src/lib/Hats.sol` | Hat ID constants | ⚠️ Needs testnet values |
| `packages/contracts/src/modules/Hats.sol` | Core HatsModule | ✅ Complete (623 lines) |
| `packages/contracts/test/integration/HatsModule.t.sol` | Unit tests | ✅ Complete (763 lines, 45+ tests) |
| `packages/contracts/test/integration/HatsGAPIntegration.t.sol` | Integration tests | ✅ Complete (501 lines) |
| `packages/indexer/config.yaml` | Contract addresses | ⚠️ Needs deployed addresses |
| `packages/indexer/src/EventHandlers.ts` | Event handlers | ✅ Complete (lines 688-878) |
| `packages/shared/src/hooks/roles/` | Role hooks | ✅ Complete |

---

## Deployment Execution Order

### Mandatory Security Prerequisite (Before Step 1)

- Complete an external security audit covering deployed artifacts and integrations for `HatsModule`, `SetupHatsTree.s.sol` artifacts, `HatsLib.sol` constants, `GardenHatsModule`, `AllowlistEligibility`, and `ERC20Eligibility`.
- Do not proceed to production/mainnet deployment (including Celo `42220`) until all critical/high findings are resolved and audit sign-off is documented.

```text
Step 1: Deploy HatsModule on each testnet
├── Sepolia (11155111) - Primary testnet
├── Base Sepolia (84532) - Legacy testnet
└── Celo (42220) - Production candidate

Step 2: Create Hat Trees
├── Run SetupHatsTree.s.sol on each chain
├── Capture output hat IDs
└── Update HatsLib.sol constants

Step 3: Update Indexer Config
├── Add deployed GardenHatsModule addresses
├── Set correct start blocks
└── Redeploy indexer

Step 4 (Optional): Deploy Eligibility Modules
├── AllowlistEligibility for Funder role
└── ERC20Eligibility for Community role
```

---

## Verification Commands

```bash
# Run all contract tests (45+ tests)
cd packages/contracts && bun test

# Fork test for specific chain (after hat tree creation)
forge test --fork-url $SEPOLIA_RPC --match-contract SepoliaHats
forge test --fork-url $BASE_SEPOLIA_RPC --match-contract BaseSepoliaHats

# Full validation
bun format && bun lint && bun test && bun build
```

---

## Test Coverage Summary

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `HatsModule.t.sol` | 45+ | Initialization, config, roles, batch ops, upgrades, eligibility |
| `HatsGAPIntegration.t.sol` | 15 | Full stack with KarmaGAP sync |
| `GardenMinting.t.sol` | 4+ | Hat tree creation during mint |

---

## Success Criteria

- [x] Error recovery in `_configureEligibilityModules` ✅
- [x] UUPS upgrade tests passing ✅
- [x] Batch operations tests passing ✅
- [x] Eligibility recovery tests passing ✅
- [x] 45+ contract tests passing ✅
- [ ] `SEPOLIA_*_HAT` constants are non-zero
- [ ] `BASE_SEPOLIA_*_HAT` constants are non-zero (optional)
- [ ] `CELO_*_HAT` constants are non-zero
- [ ] External security audit sign-off completed with no unresolved critical/high issues before Celo `42220` deployment
- [ ] Indexer config has deployed addresses
- [ ] `bun format && bun lint && bun test && bun build` passes

---

## Architecture Notes

**Role Hierarchy** (implemented in `_grantRole`):
```text
Owner → Operator → Evaluator
              ├→ Gardener
              └→ Funder

Community (token-gated) — independent role
```
Granting Owner best-effort auto-grants Operator, Evaluator, Gardener, and Funder (via try/catch). Community remains token-gated and independent.

**Graceful Degradation**:
- GAP module failure → Garden still created, event emitted
- Eligibility module failure → Hat created without eligibility, event emitted
- Hats module not configured → GardenToken falls back to native roles

**Hat Revocation**:
Uses transfer to dead address (`0x...dEaD`) instead of burning to preserve hat structure.
