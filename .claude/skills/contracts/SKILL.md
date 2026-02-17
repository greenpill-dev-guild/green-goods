---
name: contracts
description: Solidity smart contract development with Foundry. Use for contract design, testing, gas optimization, UUPS upgrades, and deployment via deploy.ts.
version: "1.0"
last_updated: "2026-02-08"
last_verified: "2026-02-09"
status: proven
packages: [contracts]
dependencies: [testing]
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

```text
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
| `bun run test` | Run unit tests (skips E2E) |
| `bun test:gas` | Tests with gas report |
| `bun build` | Adaptive build (~2s cached, skips test/script when unchanged) |
| `bun build:fast` | Explicit fast (~2s cached, source contracts only) |
| `bun build:full` | Full compilation including tests (>180s cold) |
| `bun run test:lite` | ~35 fast tests, excludes heavy/account suites |
| `bun lint` | Format & lint with forge fmt + solhint |
| `bun deploy:testnet` | Deploy to Sepolia |

> **Build guidance:** Use `build:full` before deployment. Use `build` (adaptive) for iteration.

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
bun script/deploy.ts core --network sepolia --broadcast

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
bun script/deploy.ts core --network sepolia --broadcast --update-schemas
```

### Pre-Flight Checklist

```bash
# Full production readiness (build → lint → tests → E2E → dry runs on all chains)
bun run verify:contracts

# Or run steps individually:
bun run test        # Tests passing
bun run build:full  # Full build
bun script/deploy.ts core --network sepolia  # Dry run
bun script/deploy.ts core --network sepolia --broadcast  # Deploy
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

## Part 6: Security Checklist

### Reentrancy Prevention

```solidity
// ✅ ALWAYS: Checks-Effects-Interactions pattern
function withdraw(uint256 amount) external {
    // 1. Checks
    if (balances[msg.sender] < amount) revert InsufficientBalance();

    // 2. Effects (update state BEFORE external call)
    balances[msg.sender] -= amount;

    // 3. Interactions (external call last)
    (bool success, ) = msg.sender.call{value: amount}("");
    if (!success) revert TransferFailed();
}

// ✅ ALSO: Use ReentrancyGuard for complex flows
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

function complexFlow() external nonReentrant {
    // Safe from reentrancy
}

// ❌ NEVER: External call before state update
function withdraw(uint256 amount) external {
    (bool success, ) = msg.sender.call{value: amount}("");
    balances[msg.sender] -= amount; // Too late — reentrancy possible
}
```

### Access Control Verification

```solidity
// Green Goods uses Hats Protocol for role-based access
// Always verify hat-based permissions for privileged operations

// ✅ Verify caller has the correct hat
modifier onlyOperator(address garden) {
    if (!hatsModule.isOperator(garden, msg.sender)) {
        revert UnauthorizedCaller(msg.sender);
    }
    _;
}

// ✅ Check authorization in initializers
function initialize(address admin) external initializer {
    if (admin == address(0)) revert ZeroAddress("admin");
    __Ownable_init(admin);
    __UUPSUpgradeable_init();
}

// ❌ NEVER: Unprotected state-changing functions
function setResolver(address newResolver) external {
    resolver = newResolver; // Anyone can call this!
}
```

### Storage Collision Prevention (UUPS)

```bash
# Verify storage layout before upgrading
forge inspect src/GreenGoodsResolver.sol:GreenGoodsResolver storage-layout

# Compare with previous version
forge inspect src/GreenGoodsResolver.sol:GreenGoodsResolver storage-layout --pretty > layout-v2.txt
diff layout-v1.txt layout-v2.txt
```

```solidity
// ✅ ALWAYS: Add new variables at the end, reduce gap
contract GreenGoodsResolverV2 is GreenGoodsResolver {
    // Existing: slots 1-4, gap was 46
    address public newFeature;         // slot 5 (new)
    uint256[45] private __gap;         // 50 - 5 = 45 (reduced by 1)
}

// ❌ NEVER: Reorder, rename, or change types of existing variables
// ❌ NEVER: Insert new variables between existing ones
// ❌ NEVER: Change uint256 to uint128 (changes slot packing)
```

### Initializer Safety

```solidity
// ✅ ALWAYS: Disable initializers in constructor for UUPS
/// @custom:oz-upgrades-unsafe-allow constructor
constructor() {
    _disableInitializers();
}

// ✅ ALWAYS: Use initializer modifier
function initialize(address admin) external initializer {
    __Ownable_init(admin);
    __UUPSUpgradeable_init();
}

// ✅ ALWAYS: Protect upgrade authorization
function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
```

### Frontrunning Mitigation

```solidity
// ✅ Use commit-reveal for sensitive operations
// ✅ Use deadline parameters for time-sensitive transactions
function submitWork(
    bytes32 actionUID,
    bytes calldata data,
    uint256 deadline
) external {
    if (block.timestamp > deadline) revert DeadlineExpired();
    // ... process work
}

// ✅ Use nonces for replay protection
mapping(address => uint256) public nonces;
```

### Invariant Testing (MANDATORY for mainnet)

```solidity
// Define invariants that must always hold
function invariant_totalSupplyMatchesBalances() public view {
    uint256 sum;
    for (uint256 i = 0; i < holders.length; i++) {
        sum += balances[holders[i]];
    }
    assert(sum == totalSupply);
}

// Test with forge
// forge test --match-test invariant_ -vvv
```

### Pre-Audit Checklist

- [ ] **Reentrancy**: All external calls follow checks-effects-interactions
- [ ] **Access control**: Every state-changing function has authorization
- [ ] **Input validation**: All parameters validated (zero address, bounds, overflow)
- [ ] **Storage layout**: `forge inspect` confirms no collisions after upgrade
- [ ] **Initializer safety**: `_disableInitializers()` in constructor, `initializer` modifier
- [ ] **Event emission**: All state changes emit events (indexer depends on this)
- [ ] **Integer safety**: Solidity 0.8+ handles overflow, but check unchecked blocks
- [ ] **Bounded loops**: No unbounded iterations (gas limit risk)
- [ ] **Module isolation**: External module calls wrapped in try/catch
- [ ] **Schema immutability**: `config/schemas.json` not modified
- [ ] **Upgrade authorization**: `_authorizeUpgrade` protected by onlyOwner
- [ ] **Frontrunning**: Deadline parameters on time-sensitive operations

## Anti-Patterns

- **Never hardcode schema UIDs** — load from `deployments/{chainId}-latest.json`
- **Never direct forge script** — always use `deploy.ts`
- **Never skip storage gaps** — breaks upgrades
- **Never use require strings** — use custom errors
- **Never implicit visibility** — label everything explicitly
- **Never make external calls before state updates** — reentrancy risk
- **Never leave state-changing functions unprotected** — access control required
- **Never modify storage variable order in upgrades** — slot collision

## Related Skills

- `testing` — For TDD workflow applied to Solidity
- `indexer` — When contract events change, indexer schema must update
- `architecture` — For system-level contract design decisions
- `security` — Provides the full audit toolkit (Slither, Aderyn, threat modeling). This skill's Security Checklist (Part 6) is a development-time quick check; `security` provides detection and review depth. Overlap on UUPS/reentrancy/access control — this skill shows correct implementation, `security` shows detection and audit
- `deployment` — For deploy.ts workflow and pre-deployment gates
- `migration` — For cross-package changes when contract ABIs change

## Reference Files

- Deploy CLI: `script/deploy.ts`
- Core deployer: `script/deploy/core.ts`
- Schemas: `config/schemas.json` (READ ONLY)
- Deployments: `deployments/{chainId}-latest.json`
- Full context: `.claude/context/contracts.md`
