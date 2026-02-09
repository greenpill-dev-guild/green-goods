# Contracts Package Context

Loaded when working in `packages/contracts/`. Extends CLAUDE.md.

## Quick Reference

| Command | Purpose |
|---------|---------|
| `bun test` | Run unit tests (skips E2E) |
| `bun test:gas` | Tests with gas report |
| `bun build` | Compile contracts |
| `bun lint` | Format & lint with forge fmt + solhint |
| `bun deploy:testnet` | Deploy to Base Sepolia |
| `bun upgrade:testnet` | Upgrade existing contracts |

## Architecture

```
packages/contracts/
├── src/               # Solidity source
│   ├── GardenToken.sol       # ERC721 for gardens
│   ├── GardenAccount.sol     # Garden TBA
│   ├── GreenGoodsResolver.sol  # Central resolver
│   ├── registries/           # Action, Gardener, Deployment
│   ├── resolvers/            # Work, WorkApproval, Assessment
│   └── modules/              # Octant, Unlock, Hats
├── script/            # Deployment (TypeScript + Solidity)
├── test/              # Foundry tests
├── config/            # schemas.json (READ ONLY)
└── deployments/       # Output artifacts
```

## Critical Patterns

### MANDATORY: Use deploy.ts

**NEVER use direct forge commands for deployment:**

```bash
# ✅ ALWAYS
bun deploy:testnet
bun script/deploy.ts core --network baseSepolia --broadcast

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
- Breaks indexer queries
- Makes historical attestations unfindable

**For test schemas:** Create `schemas.test.json` instead.

```bash
# Deploy contracts + schemas
bun deploy:testnet

# Update schema name/description only (not fields)
bun script/deploy.ts core --network baseSepolia --broadcast --update-schemas
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
import deployment from '../deployments/84532-latest.json';
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
bun test

# Dry run
bun script/deploy.ts core --network baseSepolia

# Deploy
bun script/deploy.ts core --network baseSepolia --broadcast
```

## Reference Files

- Deploy CLI: `script/deploy.ts`
- Core deployer: `script/deploy/core.ts`
- Schemas: `config/schemas.json` (READ ONLY)
- Deployments: `deployments/{chainId}-latest.json`
