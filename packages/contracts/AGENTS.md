# Green Goods Contracts — Architecture Guide

The contracts package contains Solidity smart contracts for the Green Goods protocol, built with Foundry.

## Commands

- `bun run build`
- `bun run test`
- `bun run lint`
- `bun run test:audit:full`

## Deployment Script Defaults

- Use package scripts for deploys, upgrades, migrations, and verification. Do not hand operators raw
  `forge` commands or ad hoc shell sequences.
- Root `contracts:*:arbitrum` wrappers set `FOUNDRY_KEYSTORE_ACCOUNT=green-goods-deployer`.
- Contract wrappers clear `PINATA_JWT_OP_REF`; media upload credentials must not block contract
  upgrades.
- Arbitrum upgrade/broadcast scripts that need the proxy owner use sender
  `0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6`.
- Signal-pool/yield lane commands, in order:
  - `bun run contracts:upgrade:signal-pool-yield-wiring:simulate:arbitrum`
  - `bun run contracts:upgrade:signal-pool-yield-wiring:arbitrum`
  - `bun run contracts:migrate:vaults:dry:arbitrum`
  - `bun run contracts:migrate:vaults:arbitrum`
  - `bun run contracts:verify:post-deploy:arbitrum`

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
│   └── ENS.sol         # ENS subdomain registration (CCIP)
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

## Design Principles for Solidity

### DRY (Don't Repeat Yourself)

- Shared libraries in `src/lib/` (EAS.sol, StringUtils.sol, TBA.sol)
- Common patterns extracted to base contracts
- Reuse OpenZeppelin implementations

### KISS (Keep It Simple, Stupid)

- Custom errors over complex require strings — cheaper and clearer
- Direct inheritance over complex proxy patterns where possible
- Simple storage layouts to minimize upgrade risks

### YAGNI (You Ain't Gonna Need It)

- Don't add unused function parameters "for future use"
- Don't add governance mechanisms before they're needed
- Don't over-engineer access control beyond requirements

### Single Responsibility (SOLID)

- Each resolver handles one schema type (WorkResolver, WorkApprovalResolver, AssessmentResolver)
- Each module handles one integration (OctantModule, UnlockModule, HatsModule)
- Registries separate from tokens

## Solidity Security Patterns (2026)

### Checks-Effects-Interactions (CEI)

**Always follow this order to prevent reentrancy:**

```solidity
// ✅ Correct: CEI pattern
function withdraw(uint256 amount) external {
    // 1. CHECKS - validate inputs
    if (amount > balances[msg.sender]) revert InsufficientBalance();

    // 2. EFFECTS - update state BEFORE external calls
    balances[msg.sender] -= amount;

    // 3. INTERACTIONS - external calls last
    (bool success, ) = msg.sender.call{value: amount}("");
    if (!success) revert TransferFailed();
}

// ❌ Wrong: Interactions before effects (reentrancy risk)
function withdraw(uint256 amount) external {
    (bool success, ) = msg.sender.call{value: amount}("");  // DANGER
    balances[msg.sender] -= amount;  // Too late!
}
```

### Pull-Over-Push Payments

**Favor "pull" patterns where users withdraw their own funds:**

```solidity
// ✅ Pull pattern - user withdraws
mapping(address => uint256) public pendingWithdrawals;

function claimReward() external {
    uint256 amount = pendingWithdrawals[msg.sender];
    pendingWithdrawals[msg.sender] = 0;
    payable(msg.sender).transfer(amount);
}

// ❌ Push pattern - risky if recipient is malicious contract
function distributeRewards(address[] calldata recipients) external {
    for (uint i = 0; i < recipients.length; i++) {
        payable(recipients[i]).transfer(rewardAmount);  // Can fail/revert
    }
}
```

### Explicit Visibility (MANDATORY)

**Always explicitly label visibility for functions AND state variables:**

```solidity
// ✅ Explicit visibility
uint256 private _totalSupply;
mapping(address => uint256) public balances;

function mint(address to) external onlyOwner { ... }
function _beforeTokenTransfer() internal virtual { ... }

// ❌ Implicit visibility (dangerous)
uint256 totalSupply;  // Defaults to internal
function mint(address to) { ... }  // Defaults to public!
```

### UUPS Over Transparent Proxy

**Prefer UUPS for upgradeable contracts:**
- More gas-efficient (no proxy admin storage)
- Upgrade logic in implementation (cleaner architecture)
- Already used throughout this codebase

### Administrative Safeguards

**Never use single private key for critical roles:**

```solidity
// ✅ Multi-sig + Timelock for admin actions
// - Gnosis Safe (3-of-5 signers minimum)
// - Timelock delay (48h for mainnet, 24h for testnet)
// - Emergency pause with separate guardian

// ❌ Single EOA as owner
// constructor() { owner = msg.sender; }  // DANGER
```

### Gas Management

**Avoid unbounded loops:**

```solidity
// ✅ Bounded iteration
function processItems(uint256 start, uint256 count) external {
    uint256 end = min(start + count, items.length);
    for (uint256 i = start; i < end; i++) { ... }
}

// ❌ Unbounded loop (can hit gas limit)
function processAllItems() external {
    for (uint256 i = 0; i < items.length; i++) { ... }  // DANGER
}
```

**Use uint256 for arithmetic (Solidity 0.8+ has built-in overflow checks):**

```solidity
// ✅ Solidity 0.8+ - no SafeMath needed
uint256 result = a + b;  // Auto-reverts on overflow

// ❌ Unnecessary in 0.8+
using SafeMath for uint256;
uint256 result = a.add(b);
```

## Adversarial Testing

### Fuzz Testing (Foundry)

**Use random inputs to find edge cases:**

```solidity
function testFuzz_mintGarden(address to, string calldata uri) public {
    vm.assume(to != address(0));
    vm.assume(bytes(uri).length > 0);

    uint256 tokenId = gardenToken.mintGarden(to, uri);
    assertEq(gardenToken.ownerOf(tokenId), to);
}
```

### Invariant Testing

**Define conditions that must NEVER change:**

```solidity
// invariants/GardenToken.t.sol
function invariant_totalSupplyMatchesBalance() public {
    uint256 totalBalance = 0;
    for (uint i = 0; i < holders.length; i++) {
        totalBalance += gardenToken.balanceOf(holders[i]);
    }
    assertEq(gardenToken.totalSupply(), totalBalance);
}
```

### Static Analysis (CI/CD)

**Integrate Slither in CI pipeline:**

```yaml
# .github/workflows/security.yml
- name: Run Slither
  uses: crytic/slither-action@v0.3.0
  with:
    target: 'packages/contracts/'
    fail-on: medium
```

### Open/Closed (SOLID)

- GreenGoodsResolver fan-out pattern: add modules without modifying core
- Module enable/disable without redeployment
- New resolvers can be added without changing existing ones

### Interface Segregation (SOLID)

- Minimal interfaces per contract
- IResolver doesn't force unused methods
- Clean separation of admin vs user functions

### Optimize for Deletion

- Modules use try/catch isolation — one failure doesn't break others
- Each module can be disabled independently
- Storage gaps enable clean upgrades

---

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

**HatsModule** — Role management
- Hats Protocol RBAC with 6-role garden trees (Owner, Operator, Evaluator, Gardener, Funder, Community)
- Garden-specific role trees created during minting

**Location:** `src/modules/`

### GardenToken (ERC721)

NFT representing gardens in the protocol.

**Key features:**
- UUPS upgradeable
- Mints garden NFTs with metadata
- Creates token-bound accounts for each garden

**Location:** `src/tokens/Garden.sol`

### GreenGoodsENS

Manages greengoods.eth subdomain registration via Chainlink CCIP (L2 to L1).

**Key features:**
- ENS subdomain registration for gardens and users
- CCIP cross-chain messaging (L2 sender to L1 receiver)
- Sponsored claims for passkey users

**Location:** `src/registries/ENS.sol`

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
bun script/deploy.ts core --network sepolia

# Deploy for real
bun script/deploy.ts core --network sepolia --broadcast

# Update schemas only
bun script/deploy.ts core --network sepolia --broadcast --update-schemas

# Or use npm scripts
bun deploy:testnet     # Sepolia
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
├── 11155111-latest.json # Sepolia
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

## Deployment Readiness

### Pre-Flight Checks

```bash
bun run test                                              # >= 80% pass (testnet), 100% (mainnet)
bun build                                                 # Clean compilation, no errors
bun script/deploy.ts core --network sepolia               # Dry run (omit --broadcast)
```

### Phase-Aware Artifact Review

For new contract work, deployment artifacts move through phases:

- **Pending broadcast**: missing or zero addresses can be expected before transactions are sent.
  Do not turn this into a P0 by itself.
- **Deployment path blocker**: block before broadcast only if the repo lacks a safe command or
  script to deploy, initialize, persist artifacts, and update dependent config such as indexer
  addresses.
- **Post-broadcast blocker**: after a claimed or authorized broadcast, required zero/missing
  addresses, schema UIDs, or generated config are blockers until the artifact/config is fixed
  and re-verified.

### Gas Benchmarks

| Operation | Target |
|---|---|
| mintGarden | < 500,000 gas |
| registerAction | < 200,000 gas |
| Work submission | < 150,000 gas |
| Work approval | < 100,000 gas |

### Pre-Broadcast Red Flags (Block Broadcast)

- Test pass rate < 80% (testnet) or < 100% (mainnet)
- Compiler errors or warnings
- Missing deploy command or unsafe dry-run for the target module
- Bad required network config, manager defaults, or deployer wallet inputs
- No artifact persistence path for newly deployed addresses/schema UIDs
- No dependent config update path when shared, client, admin, or indexer reads need the address
- Deployer wallet unfunded

### Post-Broadcast Red Flags (Block Go-Live)

- Required deployed address remains zero or missing in `deployments/{chainId}-latest.json`
- Required schema UID remains zero or missing in deployment artifacts
- Indexer config still points at a zero or stale address for newly deployed indexed contracts
- Generated ABI/config artifacts were not refreshed after deployment metadata changed

### Mainnet Additional Requirements (All Blocking)

- External security audit completed — no unresolved critical/high findings
- Multisig ownership configured (Gnosis Safe, 3-of-5 minimum)
- Timelock delay: 48h mainnet, 24h testnet
- Minimum 2 weeks testnet operation before mainnet
- Rollback procedures documented and tested

---

## Testing

### Running Tests

```bash
# Run all tests (never use raw forge commands)
bun run test

# Run specific test
bun run test -- --match-test testGardenToken

# Fork tests (needs RPC URLs)
bun run test:fork

# E2E workflow
bun run test:e2e:workflow
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

Detailed patterns in `.claude/rules/`:

- **contracts.md** — Solidity style, bun scripts, testing, gas optimization

## Reference Documentation

- Contracts README: `/packages/contracts/README.md`
- Docs site: [docs.greengoods.app](https://docs.greengoods.app)
- Root agent guide: `/AGENTS.md`
