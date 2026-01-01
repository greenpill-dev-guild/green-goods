# Green Goods Contracts — Architecture Guide

The contracts package contains Solidity smart contracts for the Green Goods protocol, built with Foundry.

## Architecture Overview

```
src/
├── accounts/            # Token-bound accounts
│   └── Garden.sol      # Garden account (TBA)
├── modules/             # Integration modules (fan-out pattern)
│   ├── Octant.sol      # Yield vault creation
│   ├── Unlock.sol      # Work badges
│   └── Hats.sol        # Role management
├── registries/          # Protocol registries
│   ├── Action.sol      # Action registry
│   └── Gardener.sol    # ENS subdomains + passkey recovery
├── resolvers/           # EAS schema resolvers
│   ├── GreenGoods.sol  # Central fan-out resolver
│   ├── Assessment.sol  # Assessment attestations
│   ├── Work.sol        # Work submission attestations
│   └── WorkApproval.sol # Work approval attestations
├── tokens/              # Token contracts
│   └── Garden.sol      # Garden NFT (ERC721)
├── lib/                 # Shared libraries
│   ├── EAS.sol
│   ├── Karma.sol
│   ├── StringUtils.sol
│   └── TBA.sol
├── interfaces/          # Contract interfaces
├── mocks/               # Test mocks
├── DeploymentRegistry.sol # Deployment tracking
└── Schemas.sol          # EAS schema definitions
```

## Core Contracts

### GreenGoodsResolver (Central Fan-Out)

Central resolver for protocol integrations. Called by other resolvers after attestation validation.

**Key features:**
- UUPS upgradeable
- Module enable/disable via owner
- Try/catch isolation (one module failure doesn't block others)
- Events for observability (success/failure per module)

**Location:** `src/resolvers/GreenGoods.sol`

**Architecture:**
```solidity
// Resolvers call this after validation
function onWorkApproved(address garden, string name, bytes32 workUID, address worker) {
    // Each module isolated with try/catch
    if (isModuleEnabled(MODULE_OCTANT)) {
        try octantModule.onWorkApproved(garden, name) { ... } catch { ... }
    }
    if (isModuleEnabled(MODULE_UNLOCK)) {
        try unlockModule.onWorkApproved(garden, worker, workUID) { ... } catch { ... }
    }
}
```

### Integration Modules

**OctantModule** — Creates yield vaults for gardens
- Called on first approved work
- One vault per garden (lazy creation)
- Uses Octant's Multi-Strategy system

**UnlockModule** — Grants work badges
- NFT keys as verifiable credentials
- Per-garden badge configuration
- Supports permanent or time-limited badges

**HatsModule** — Role management (planned)
- DAO-style permissions
- Garden-specific role trees

**Location:** `src/modules/`

### GardenToken (ERC721)

NFT representing gardens in the protocol.

**Key features:**
- UUPS upgradeable
- Mints garden NFTs with metadata
- Creates token-bound accounts for each garden

**Location:** `src/tokens/Garden.sol`

### GardenerRegistry

Manages greengoods.eth subdomain registration with passkey recovery.

**Key features:**
- ENS subdomain management
- WebAuthn credential storage for recovery
- Mainnet-only (ENS coordination)

**Location:** `src/registries/Gardener.sol`

### ActionRegistry

Registry for garden actions (planting, cleanup, etc.).

**Key features:**
- Action registration with metadata
- Time-bounded actions
- Capital requirements

**Location:** `src/registries/Action.sol`

### EAS Resolvers

Process attestations for the Ethereum Attestation Service:

- **WorkResolver** — Validates work submissions
- **WorkApprovalResolver** — Validates approvals, calls GreenGoodsResolver
- **AssessmentResolver** — Validates assessments

**Location:** `src/resolvers/`

### DeploymentRegistry

Tracks contract deployments across networks.

**Key features:**
- Allowlist for deployers
- Address registry
- Ownership management

**Location:** `src/DeploymentRegistry.sol`

## Deployment

### Using deploy.ts (Required)

**Always use the TypeScript deployment CLI:**

```bash
# Dry run
bun script/deploy.ts core --network baseSepolia

# Deploy for real
bun script/deploy.ts core --network baseSepolia --broadcast

# Update schemas only
bun script/deploy.ts core --network baseSepolia --broadcast --update-schemas

# Or use npm scripts
bun deploy:testnet     # Base Sepolia
bun deploy:mainnet     # Production
```

**Never use raw forge commands for deployment.**

**Why deploy.ts is required:**
- Loads root `.env` correctly
- Uses Foundry keystore for secure key management
- Handles schema deployment and verification
- Auto-updates Envio indexer configuration

### Deployment Artifacts

After deployment, artifacts are saved to:
```
deployments/
├── 84532-latest.json   # Base Sepolia
├── 42161-latest.json   # Arbitrum
├── 42220-latest.json   # Celo
└── networks.json       # Network configuration
```

**Artifact structure:**
```json
{
  "gardenToken": "0x...",
  "gardenAccountImpl": "0x...",
  "actionRegistry": "0x...",
  "deploymentRegistry": "0x...",
  "workResolver": "0x...",
  "workApprovalResolver": "0x...",
  "assessmentResolver": "0x...",
  "schemas": {
    "workSchemaUID": "0x...",
    "workApprovalSchemaUID": "0x...",
    "assessmentSchemaUID": "0x..."
  }
}
```

## Testing

### Running Tests

```bash
# Run all tests
bun test

# Run specific test
forge test --match-test testGardenToken

# Gas report
forge test --gas-report

# Coverage
forge coverage
```

### Test Structure

```
test/
├── unit/                    # Unit tests per contract
│   ├── ActionRegistry.t.sol
│   ├── GardenToken.t.sol
│   ├── WorkResolver.t.sol
│   └── ...
├── integration/             # Multi-contract flows
│   ├── GardenAccessControl.t.sol
│   ├── GreenGoodsResolver.t.sol
│   └── HatsModule.t.sol
├── schema/                  # Schema validation
│   └── KarmaGAPSchemaValidation.t.sol
├── helpers/                 # Test utilities
├── E2EWorkflow.t.sol        # End-to-end workflow
├── FuzzTests.t.sol          # Fuzz testing
└── UpgradeSafety.t.sol      # Upgrade safety checks
```

### Test Naming

```solidity
// Pattern: test[ContractName]_[scenario]
function testGardenToken_mintsNewGarden() public {}
function testGardenToken_revertsOnUnauthorizedMint() public {}

// Categories: test_, testRevert_, testFuzz_, testIntegration_, testUpgrade_
```

### Coverage Targets

- **Testnet:** 80% pass rate acceptable
- **Mainnet:** 100% tests must pass
- **Critical paths:** Storage gaps, access control, attestation validation

## Critical Rules

### 1. Schema Immutability

**NEVER modify `config/schemas.json`** — This creates duplicate schemas on-chain.

For testing, create `schemas.test.json` instead.

### 2. Custom Errors

**Always use custom errors** instead of require strings:

```solidity
// ✅ Correct
error ZeroAddress(string paramName);
if (addr == address(0)) revert ZeroAddress("tokenAddress");

// ❌ Wrong
require(addr != address(0), "Zero address");
```

### 3. Storage Gaps

**All upgradeable contracts must have storage gaps:**

```solidity
// Calculate: 50 total - used slots = gap
uint256[46] private __gap;  // GreenGoodsResolver: 50 - 4 = 46
```

### 4. UUPS Upgrade Safety

Before upgrading:
- Verify storage layout unchanged
- Test upgrade on fork
- No storage variable reordering

### 5. Module Isolation

**Modules use try/catch** — One failure doesn't block attestations:

```solidity
try octantModule.onWorkApproved(garden, name) returns (address vault) {
    emit ModuleExecutionSuccess(MODULE_OCTANT, garden, workUID);
} catch {
    emit ModuleExecutionFailed(MODULE_OCTANT, garden, workUID);
}
```

## Deep Dive Rules

Detailed patterns in `.cursor/rules/`:

- **rules.mdc** — Solidity style, linting, testing, gas optimization
- **deployment-patterns.mdc** — deploy.ts usage, CLI structure
- **schema-management.mdc** — EAS schema immutability
- **uups-upgrades.mdc** — Storage gaps, upgrade safety

## Reference Documentation

- Contracts README: `/packages/contracts/README.md`
- Deployment guide: `/docs/developer/contracts-handbook.md`
- Root agent guide: `/AGENTS.md`
