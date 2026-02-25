# Contracts Package Context

Loaded when working in `packages/contracts/`. Extends CLAUDE.md.

## Quick Reference

| Command | Purpose |
|---------|---------|
| `bun run test` | Run unit tests (skips E2E) |
| `bun run test:gas` | Tests with gas report |
| `bun build` | Adaptive build (changed Solidity targets with shared-file fallback to `src`) |
| `bun build:changed` | Build changed Solidity under `src/test/script` only |
| `bun build:target -- <path...>` | Build explicit Solidity target(s) only |
| `bun build:fast` | Explicit fast mode (`src` only, skips Foundry test/script) |
| `bun build:full` | Full compilation including tests (>180s cold) |
| `bun run test:lite` | ~35 fast tests, excludes heavy/account suites |
| `bun lint` | Format & lint with forge fmt + solhint |
| `bun deploy:testnet` | Deploy to Sepolia |
| `bun upgrade:testnet` | Upgrade existing contracts |

> **Build modes:** Use `build`/`build:changed`/`build:target` for local iteration. Use `build:full` for deployment and CI.

## Architecture

```
packages/contracts/
├── src/
│   ├── accounts/          # Garden token-bound account contracts
│   ├── interfaces/        # Integration + protocol interfaces
│   ├── lib/               # Shared Solidity libs (Karma, Hats, TBA, JsonBuilder)
│   ├── markets/           # Marketplace adapters (e.g., Hypercert)
│   ├── modules/           # Integrations (Hats, Karma, Octant, Gardens, CookieJar, Hypercerts)
│   ├── registries/        # Deployment, action, ENS, power registries
│   ├── resolvers/         # Work, approval, assessment, and yield resolvers
│   ├── strategies/        # Yield and external strategy contracts
│   ├── tokens/            # Garden + goods token contracts
│   └── Schemas.sol        # EAS schema constants + helpers
├── script/                # TypeScript deploy/upgrade orchestration
├── test/                  # Unit, integration, E2E, fork, fuzz, upgrade tests
├── config/                # schemas.json (READ ONLY in normal workflow)
└── deployments/           # chainId-latest artifacts + network config
```

## Critical Patterns

### MANDATORY: Use deploy.ts

**NEVER use direct forge commands for deployment:**

```bash
# ✅ ALWAYS
bun deploy:testnet
bun script/deploy.ts core --network sepolia --broadcast

# ❌ NEVER
forge script script/Deploy.s.sol --broadcast --rpc-url $RPC
```

**Why:**
- Loads root `.env` correctly
- Uses Foundry keystore (not raw private keys)
- Auto-updates Envio indexer config
- Handles verification automatically

### Schema Management — CRITICAL

**⛔ NEVER MODIFY `config/schemas.json`**

This file defines **production EAS schemas** deployed on-chain. Modifying it:
- Creates duplicate schemas with wrong metadata
- Breaks EAS GraphQL queries (assessments, work approvals queried via easscan.org)
- Makes historical attestations unfindable

**For test schemas:** Create `schemas.test.json` instead.

```bash
# Deploy contracts + schemas
bun deploy:testnet

# Update schema name/description only (not fields)
bun script/deploy.ts core --network sepolia --broadcast --update-schemas
```

### UUPS Upgrades (MANDATORY)

**All upgradeable contracts must have storage gaps:**

```solidity
contract GreenGoodsResolver is OwnableUpgradeable, UUPSUpgradeable {
    mapping(bytes32 => bool) private _enabledModules;      // slot 1
    mapping(address => bool) public authorizedCallers;     // slot 2
    OctantModule public octantModule;                       // slot 3
    UnlockModule public unlockModule;                       // slot 4

    uint256[46] private __gap;  // 50 - 4 = 46 slots reserved
}
```

**Gap size formula:** `50 - (number of state variables)`

| Contract | Storage Slots | Gap |
|----------|---------------|-----|
| GardenToken | 2 | 48 |
| GreenGoodsResolver | 4 | 46 |
| OctantModule | 5 | 45 |
| WorkResolver | 1 | 49 |

### Custom Errors (MANDATORY)

```solidity
// ✅ Define at contract top
error ZeroAddress(string paramName);
error UnauthorizedCaller(address caller);

// ✅ Use instead of require
if (addr == address(0)) revert ZeroAddress("tokenAddress");

// ❌ Don't use require with strings (higher gas)
require(addr != address(0), "Zero address");
```

### Visibility (MANDATORY)

**Explicitly label ALL functions and state variables:**

```solidity
// ✅ Explicit
uint256 private _totalSupply;
mapping(address => uint256) public balances;
function mint(address to) external onlyOwner { }
function _internal() internal { }

// ❌ Implicit (dangerous defaults)
uint256 totalSupply;  // internal by default
function mint() { }   // public by default!
```

### Events with Indexing

```solidity
// ✅ Index addresses and IDs for filtering
event WorkSubmitted(uint256 indexed actionUID, address indexed gardener, string ipfsHash);
event ModuleExecutionSuccess(bytes32 indexed moduleId, address indexed garden, bytes32 indexed uid);
```

### Module Isolation

Non-blocking module calls prevent cascade failures:

```solidity
try octantModule.onWorkApproved(garden, name) returns (address vault) {
    emit ModuleExecutionSuccess(MODULE_OCTANT, garden, workUID);
} catch {
    emit ModuleExecutionFailed(MODULE_OCTANT, garden, workUID);
}
```

### Gas Optimization

```solidity
// ✅ Storage packing — both fit in 1 slot
uint128 public startTime;
uint128 public endTime;

// ❌ Wastes 2 slots
uint256 public startTime;
uint256 public endTime;

// ✅ Bounded loops
function process(uint256 start, uint256 count) external {
    uint256 end = min(start + count, items.length);
    for (uint256 i = start; i < end; i++) { }
}

// ❌ Unbounded (gas limit risk)
for (uint256 i = 0; i < items.length; i++) { }
```

### Gas Benchmarks

| Function | Target |
|----------|--------|
| mintGarden | <500k |
| registerAction | <200k |
| Work attest | <150k |
| Work approval | <100k |

## Testing

### Naming Convention

```solidity
// Pattern: test[Contract]_[scenario]
function testGardenToken_mintsNewGarden() public {}
function testGardenToken_revertsOnUnauthorized() public {}

// Prefixes
test_           // Happy path
testRevert_     // Failure cases
testFuzz_       // Fuzz tests (random inputs)
testInvariant_  // Invariant tests
testE2E_        // Multi-contract flows
```

### Fuzz Testing (MANDATORY for mainnet)

```solidity
function testFuzz_mintGarden(address to, string calldata uri) public {
    vm.assume(to != address(0));
    vm.assume(bytes(uri).length > 0 && bytes(uri).length < 1000);

    uint256 tokenId = gardenToken.mintGarden(to, uri);
    assertEq(gardenToken.ownerOf(tokenId), to);
}
```

### Coverage Targets

| Network | Pass Rate |
|---------|-----------|
| Testnet | ≥80% |
| Mainnet | 100% |

## Anti-Patterns

### Never Hardcode Schema UIDs

```typescript
// ❌ Never hardcode UIDs
const WORK_SCHEMA_UID = '0x123...';

// ✅ Load from deployment
import deployment from '../deployments/11155111-latest.json';
const WORK_SCHEMA_UID = deployment.schemas.workSchemaUID;
```

### Never Direct forge script

```bash
# ❌ Bypasses environment loading
forge script script/Deploy.s.sol --broadcast

# ✅ Proper deployment
bun deploy:testnet
```

### Never Skip Storage Gap

```solidity
// ❌ No gap — breaks upgrades
contract MyModule is UUPSUpgradeable {
    uint256 public value;
    // Missing __gap!
}

// ✅ With gap
contract MyModule is UUPSUpgradeable {
    uint256 public value;
    uint256[49] private __gap;  // 50 - 1 = 49
}
```

## Upgrade Safety Checklist

Before upgrading:
- [ ] Storage gap present and correctly sized
- [ ] No storage variable reordering
- [ ] No storage variable type changes
- [ ] New variables added at end only
- [ ] Upgrade test passes
- [ ] No breaking changes to public API

## Deployment Pre-Flight

```bash
# Tests passing
bun run test

# Full build
bun run build:full

# Dry run
bun script/deploy.ts core --network sepolia

# Deploy
bun script/deploy.ts core --network sepolia --broadcast
```

## Reference Files

- Deploy CLI: `script/deploy.ts`
- Core deployer: `script/deploy/core.ts`
- Schemas: `config/schemas.json` (READ ONLY)
- Deployments: `deployments/{chainId}-latest.json`
