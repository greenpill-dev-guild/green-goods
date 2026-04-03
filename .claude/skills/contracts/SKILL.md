---
name: contracts
description: Solidity smart contract development with Foundry. Use for contract design, testing, gas optimization, UUPS upgrades, deployment via deploy.ts, and security auditing.
version: "1.0.0"
status: active
packages: ["contracts"]
dependencies: []
last_updated: "2026-03-18"
last_verified: "2026-02-25"
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
| `bun build` | Adaptive build (changed Solidity targets with shared-file fallback to `src`) |
| `bun build:changed` | Build changed Solidity under `src/test/script` only |
| `bun build:target -- <path...>` | Build explicit Solidity target(s) only |
| `bun build:fast` | Explicit fast mode (`src` only, skips Foundry test/script) |
| `bun build:full` | Full compilation including tests (>180s cold) |
| `bun run test:lite` | ~35 fast tests, excludes heavy/account suites |
| `bun lint` | Format & lint with forge fmt + solhint |
| `bun deploy:testnet` | Deploy to Sepolia |

> **Build guidance:** Use `build`/`build:changed`/`build:target` for iteration. Use `build:full` before deployment.

### Custom Errors (MANDATORY)

Always use custom errors over `require` strings — lower gas, better debugging:

```solidity
error ZeroAddress(string paramName);
error UnauthorizedCaller(address caller);

if (addr == address(0)) revert ZeroAddress("tokenAddress");
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

All upgradeable contracts must have storage gaps. **Gap size formula:** `50 - (number of state variables)`

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

Rules: pack storage variables into single slots, always bound loop iterations, use `unchecked` only where overflow is impossible.

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
# Full production readiness (build -> lint -> tests -> E2E -> dry runs on all chains)
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

### Coverage Targets

| Network | Pass Rate |
|---------|-----------|
| Testnet | 80%+ |
| Mainnet | 100% |

## Part 6: Security Checklist

### Rules

- **Reentrancy**: Follow checks-effects-interactions (CEI) pattern; use `ReentrancyGuardUpgradeable` for complex flows
- **Access control**: Green Goods uses Hats Protocol for role-based access — verify hat-based permissions on all privileged operations
- **Storage collisions (UUPS)**: Run `forge inspect <Contract> storage-layout` before every upgrade; add new variables at end only, reduce gap accordingly
- **Initializer safety**: `_disableInitializers()` in constructor, `initializer` modifier on `initialize()`, protect `_authorizeUpgrade` with `onlyOwner`
- **Frontrunning**: Use deadline parameters on time-sensitive operations, nonces for replay protection
- **Fuzz testing**: Mandatory for mainnet — use `testFuzz_` prefix
- **Invariant testing**: Mandatory for mainnet — use `testInvariant_` prefix

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

## Reference Files

- **[security.md](./security.md)** -- Smart contract security: OWASP vulnerability checklist, access control audit, UUPS upgrade safety, static analysis (Slither, Aderyn), threat modeling, pre-deployment security review
- Deploy CLI: `script/deploy.ts`
- Core deployer: `script/deploy/core.ts`
- Schemas: `config/schemas.json` (READ ONLY)
- Deployments: `deployments/{chainId}-latest.json`
- Full context: `.claude/context/contracts.md`

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
- `security` — For the full security audit toolkit, see [security.md](./security.md). This skill's Security Checklist (Part 6) is a development-time quick check; the security sub-file provides detection depth, static analysis tooling, threat modeling, and pre-deployment review
- `ops` (deployment sub-file) — For deploy.ts workflow and pre-deployment gates
- `migration` — For cross-package changes when contract ABIs change
