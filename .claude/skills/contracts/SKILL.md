---
name: contracts
description: Solidity smart contract development with Foundry. Use for contract design, testing, gas optimization, UUPS upgrades, and deployment via deploy.ts.
---

# Contracts Skill

Foundry-based smart contract development guide for the Green Goods protocol.

---

## Activation

When invoked:
- Check `packages/contracts/` for existing patterns and contract structure.
- Load `.claude/context/contracts.md` for full package-specific patterns.
- Never use direct `forge script` for deployment — always use `deploy.ts`.

## Part 1: Foundry Development

### Project Structure

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

### Commands

| Command | Purpose |
|---------|---------|
| `bun test` | Run unit tests (skips E2E) |
| `bun test:gas` | Tests with gas report |
| `bun build` | Compile contracts |
| `bun lint` | Format & lint with forge fmt + solhint |
| `bun deploy:testnet` | Deploy to Base Sepolia |

### Custom Errors (MANDATORY)

Always use custom errors over `require` strings — lower gas, better debugging:

```solidity
// Define at contract top
error ZeroAddress(string paramName);
error UnauthorizedCaller(address caller);

// Use instead of require
if (addr == address(0)) revert ZeroAddress("tokenAddress");

// NEVER use require with strings
// require(addr != address(0), "Zero address");  // Higher gas
```

### Visibility (MANDATORY)

Explicitly label ALL functions and state variables:

```solidity
uint256 private _totalSupply;
mapping(address => uint256) public balances;
function mint(address to) external onlyOwner { }
function _internal() internal { }
```

### Events with Indexing

Index addresses and IDs for filtering — the indexer depends on this:

```solidity
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

## Part 2: UUPS Upgrade Safety

### Storage Gaps (MANDATORY)

All upgradeable contracts must have storage gaps:

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

### Upgrade Safety Checklist

- [ ] Storage gap present and correctly sized
- [ ] No storage variable reordering
- [ ] No storage variable type changes
- [ ] New variables added at end only
- [ ] Upgrade test passes
- [ ] No breaking changes to public API

## Part 3: Gas Optimization

### Storage Packing

```solidity
// Both fit in 1 slot
uint128 public startTime;
uint128 public endTime;

// NEVER waste 2 slots
// uint256 public startTime;
// uint256 public endTime;
```

### Bounded Loops

```solidity
// Always bound iterations
function process(uint256 start, uint256 count) external {
    uint256 end = min(start + count, items.length);
    for (uint256 i = start; i < end; i++) { }
}

// NEVER unbounded (gas limit risk)
// for (uint256 i = 0; i < items.length; i++) { }
```

### Gas Benchmarks

| Function | Target |
|----------|--------|
| mintGarden | <500k |
| registerAction | <200k |
| Work attest | <150k |
| Work approval | <100k |

## Part 4: Deployment

### MANDATORY: Use deploy.ts

```bash
# ALWAYS
bun deploy:testnet
bun script/deploy.ts core --network baseSepolia --broadcast

# NEVER use direct forge commands
# forge script script/Deploy.s.sol --broadcast --rpc-url $RPC
```

**Why:** deploy.ts loads root `.env`, uses Foundry keystore, auto-updates Envio indexer config, handles verification.

### Schema Management

**NEVER MODIFY `config/schemas.json`** — it defines production EAS schemas. For test schemas, create `schemas.test.json`.

```bash
# Deploy contracts + schemas
bun deploy:testnet

# Update schema name/description only
bun script/deploy.ts core --network baseSepolia --broadcast --update-schemas
```

### Pre-Flight Checklist

```bash
bun test            # Tests passing
bun script/deploy.ts core --network baseSepolia  # Dry run
bun script/deploy.ts core --network baseSepolia --broadcast  # Deploy
```

## Part 5: Testing

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
| Testnet | 80%+ |
| Mainnet | 100% |

## Anti-Patterns

- **Never hardcode schema UIDs** — load from `deployments/{chainId}-latest.json`
- **Never direct forge script** — always use `deploy.ts`
- **Never skip storage gaps** — breaks upgrades
- **Never use require strings** — use custom errors
- **Never implicit visibility** — label everything explicitly

## Related Skills

- `testing` — For TDD workflow applied to Solidity
- `indexer` — When contract events change, indexer schema must update
- `architecture` — For system-level contract design decisions

## Reference Files

- Deploy CLI: `script/deploy.ts`
- Core deployer: `script/deploy/core.ts`
- Schemas: `config/schemas.json` (READ ONLY)
- Deployments: `deployments/{chainId}-latest.json`
- Full context: `.claude/context/contracts.md`
