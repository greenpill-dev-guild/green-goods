# Green Goods Contracts — Architecture Guide

The contracts package contains Solidity smart contracts for the Green Goods protocol, built with Foundry.

## Architecture Overview

```
src/
├── accounts/            # Token-bound accounts
│   ├── Garden.sol      # Garden account (TBA)
│   └── Gardener.sol    # Gardener account
├── registries/          # Protocol registries
│   ├── Action.sol      # Action registry
│   └── ENSRegistrar.sol # ENS integration
├── resolvers/           # EAS schema resolvers
│   ├── Assessment.sol  # Assessment attestations
│   ├── Work.sol        # Work submission attestations
│   └── WorkApproval.sol # Work approval attestations
├── tokens/              # Token contracts
│   └── Garden.sol      # Garden NFT (ERC721)
├── lib/                 # Shared libraries
│   ├── CommunityToken.sol
│   ├── EAS.sol
│   ├── Karma.sol
│   ├── StringUtils.sol
│   └── TBA.sol
├── interfaces/          # Contract interfaces
├── mocks/               # Test mocks
├── Constants.sol        # Protocol constants
├── DeploymentRegistry.sol # Deployment tracking
└── Schemas.sol          # EAS schema definitions
```

## Core Contracts

### GardenToken (ERC721)

NFT representing gardens in the protocol.

**Key features:**
- UUPS upgradeable
- Mints garden NFTs with metadata
- Creates token-bound accounts for each garden

**Location:** `src/tokens/Garden.sol`

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
- **WorkApprovalResolver** — Validates approvals
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

### Using deploy.js (Required)

**Always use the deploy.js wrapper:**

```bash
# Dry run
node script/deploy.js core --network baseSepolia

# Deploy for real
node script/deploy.js core --network baseSepolia --broadcast

# Update schemas only
node script/deploy.js core --network baseSepolia --broadcast --update-schemas
```

**Never use raw forge commands for deployment.**

### Deployment Artifacts

After deployment, artifacts are saved to:
```
deployments/
├── 84532-latest.json   # Base Sepolia
├── 42161-latest.json   # Arbitrum
├── 42220-latest.json   # Celo
└── networks.json       # Network configuration
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
```

### Test Structure

```
test/
├── ActionRegistry.t.sol     # Unit tests
├── DeploymentRegistry.t.sol
├── GardenToken.t.sol.skip   # Skipped tests
├── E2EWorkflow.t.sol.skip   # Integration tests
└── helpers/                  # Test utilities
```

### Test Naming

```solidity
// Pattern: test[ContractName]_[scenario]
function testGardenToken_mintsNewGarden() public {}
function testGardenToken_revertsOnUnauthorizedMint() public {}
```

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
uint256[48] private __gap;  // 50 - used slots
```

### 4. UUPS Upgrade Safety

Before upgrading:
- Verify storage layout unchanged
- Test upgrade on fork
- No storage variable reordering

## Deep Dive Rules

Detailed patterns in `.cursor/rules/`:

- **rules.mdc** — Solidity style, linting, error handling
- **deployment-patterns.mdc** — deploy.js usage, profiles
- **schema-management.mdc** — EAS schema immutability
- **uups-upgrades.mdc** — Storage gaps, upgrade safety
- **testing-conventions.mdc** — Foundry test patterns
- **gas-optimization.mdc** — Gas efficiency patterns
- **production-readiness.mdc** — Deployment checklist

## Reference Documentation

- Contracts README: `/packages/contracts/README.md`
- Deployment checklist: `/docs/DEPLOYMENT_CHECKLIST.md`
- Root guide: `/AGENTS.md`

