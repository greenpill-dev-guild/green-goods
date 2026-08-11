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
| `bun upgrade:sepolia` | Upgrade existing contracts on Sepolia (named targets + gates: see § Upgrade CLI below) |

> **Build modes:** Use `build`/`build:changed`/`build:target` for local iteration. Use `build:full` for deployment and CI.
> **Operator defaults:** Use root/package scripts for deploys and upgrades. Arbitrum `contracts:*`
> wrappers set `FOUNDRY_KEYSTORE_ACCOUNT=green-goods-deployer`, and upgrade scripts that need the
> current proxy owner use sender `0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6`.
> Contract wrappers clear `PINATA_JWT_OP_REF` so media upload credentials do not block contract
> upgrades. For signal-pool/yield wiring, run the named scripts in order:
> `bun run contracts:upgrade:signal-pool-yield-wiring:simulate:arbitrum`,
> `bun run contracts:upgrade:signal-pool-yield-wiring:arbitrum`,
> `bun run contracts:migrate:vaults:dry:arbitrum`,
> `bun run contracts:migrate:vaults:arbitrum`,
> `bun run contracts:verify:post-deploy:arbitrum`.

## Contents
- [Architecture](#architecture)
- [Critical Patterns](#critical-patterns)
- [Testing](#testing)
- [Anti-Patterns](#anti-patterns)
- [Upgrade Safety Checklist](#upgrade-safety-checklist)
- [Deployment Pre-Flight](#deployment-pre-flight)
- [Reference Files](#reference-files)

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

### Stateful and Financial Change Matrix (MANDATORY when triggered)

Before implementing or approving a financial state machine, mutable dependency, retry or grace
window, cross-chain acknowledgment, asynchronous projection, or upgradeable storage change, write an
explicit matrix. Use the axes that can change the result:

`action × lifecycle state × actor/role overlap × payment rail × pause/pool state × time boundary × dependency generation`

For every material row, record the expected effect or revert, accounting/reservation cleanup,
immutable history that must survive, external calls, and the test or other proof. Include terminal
states, cancellation, retry, expiry, duplicate delivery, self-dealing/dual-role actors, and the
boundary immediately before and after a grace window when those axes apply. Stateless or purely
mechanical changes do not need a ritual matrix.

### Dependency Identity and Rotation

- Validate a dependency before storing it: nonzero/code checks, reciprocal configuration, chain or
  domain identity, and the exact interface facts the consumer relies on.
- Treat identity as more than an address. A route includes its peer, selector/domain, generation,
  and any grace promise made to in-flight work.
- Define the rotation policy before adding a setter. If live state cannot migrate safely, block
  rotation while that state exists or freeze the dependency until deployment/reinitialization.
- Test consecutive rotations and acknowledgments or retries from every still-valid generation; a
  single previous-peer slot is insufficient when overlapping grace windows are permitted.

### Accounting Completeness

- Keep denomination or rail identity explicit when aggregating principal, reservations, repayments,
  or outstanding balances. Do not add unlike units into one scalar total.
- Test overlapping roles, including contributor=funder, beneficiary=source, owner=operator, and
  caller=recipient where the model permits them.
- On every terminal transition, clear active reverse indexes and reservations without erasing the
  immutable historical record needed for audit or replay protection.

### Validation Tooling Is Critical Code

Deployment, upgrade, migration, storage-layout, size, release, and validation scripts can approve or
mutate protected state. Cover unknown arguments, malformed inputs, path confinement, idempotency,
atomic update behavior, partial failures, and accurate error summaries. Validate before writing
baselines or artifacts; stage updates and publish them only after all checks pass.

### Contract Size — EIP-170 (MANDATORY)

Deployed bytecode is capped at 24,576 bytes on Arbitrum and every Ethereum-equivalent chain.
**Foundry tests do NOT enforce this** — a green suite says nothing about deployability. The
gate is `bun run check:sizes` (contracts package; CI runs it in the Lint And Build job): it
builds the production profile and fails any deployable over the limit, warning above 90%.

- `CommitmentPoolingModule` behavior lives in **deployed external libraries**
  (`src/lib/CommitmentPooling/`, DELEGATECALLed; each has its own 24,576-byte budget). The module
  side is a six-link shell chain in `src/modules/CommitmentPooling/` (Storage → Base → Admin →
  Lifecycle → Operations → Extensions). New pooling selectors MUST land their bodies in a library, with
  only a thin shell in the chain — the binding pattern rules (Env snapshot, storage-ref
  threading, counter shells, raw-forwarded struct views, "no struct-of-mappings handles") are
  in `.plans/active/commitment-pooling/contract-spec.md` §6.1 "Deployed-library architecture".
- `OctantModule` sits at **90 bytes of margin** (production profile). Any edit to it will
  trip the WARN band; plan a library extraction before growing it.
- Measurement gotcha: `forge build <path> --skip test --skip script` can silently skip
  emitting the named concrete target's artifact. Size measurements must build with no path
  argument (the gate does this correctly).

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

// Categories
testContract_scenario
testFuzz_Contract_property
testIntegration_Contract_scenario
testUpgrade_Contract_scenario
testE2E_Contract_scenario
invariant_Contract_property
```

Describe expected reverts in the scenario (`revertsWhen...`); do not create a separate
`testRevert_` category.

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
- [ ] Every ERC-7201 namespace slot and ordered member layout is protected by a committed baseline
- [ ] No storage variable reordering
- [ ] No storage variable type changes
- [ ] New variables added at end only
- [ ] Upgrade test passes
- [ ] No breaking changes to public API

## Deployment Pre-Flight

Use phase-aware artifact checks. Before broadcast, zero or missing addresses for a new module are
**pending broadcast** unless the deploy, initialization, artifact persistence, or dependent config
update path is missing. After broadcast, required zero/missing deployment addresses, schema UIDs, or
indexer addresses are blockers until fixed and re-verified.

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

## Deploy CLI — subcommands, networks, gates

`bun script/deploy.ts <subcommand> --network <net> [--broadcast]`. Beyond the `core` deploy documented above:

| Subcommand | Purpose |
|---|---|
| `core` | Deploy core contracts (default) |
| `garden <config>` | Deploy a garden from a config JSON |
| `hats-tree` | Create/configure the Hats Protocol tree |
| `status [network]` | Print on-chain deployment status |

Flags: `--broadcast` (send txs), `--update-schemas` (EAS schema metadata only), `--dry-run` (simulate vs live RPC), `--pure-simulation` (compile/preflight, no RPC), `--force` (skip cache).

Accepted `--network`: `localhost` (31337), `sepolia` (11155111), `arbitrum` (42161, prod), `celo` (42220, prod), `mainnet` (1, ENS only). Per-chain RPC via `{CHAIN}_RPC_URL` (e.g. `SEPOLIA_RPC_URL`); artifacts at `deployments/{chainId}-latest.json`.

Production-readiness gate (pre-broadcast, all chains): `bun run verify:contracts` (build → lint → tests → E2E → dry runs) or `bun run verify:contracts:fast` (skips E2E + dry runs). Fork tests: `bun run test:fork` (also `test:fork:protocol`, `test:fork:*:ci` shards) runs under `FOUNDRY_PROFILE=fork`, sources root `.env`, and requires the target chain's `{CHAIN}_RPC_URL`.

## Upgrade CLI — upgrade.ts (UUPS)

`bun script/upgrade.ts <target> --network <net>` is the only upgrade path — never `deploy.ts --force` as an upgrade or rollback command, never raw `forge script`.

Sequence: `--dry-run` (preflight) → `--tx-plan --sender <address>` (persisted, reviewable transaction plan) → `--broadcast` only after the plan, authorization, and release gate are approved.

Named targets: `action-registry`, `garden-token`, `yield-resolver`, `gardens-module`, `signal-pool-yield-wiring`, `yield-gardens-wiring`, `octant-module`, `karma-gap-module`, `work-resolver`, `work-approval-resolver`, `assessment-resolver`, `deployment-registry`, `greenwill`, `all`. **`all` intentionally excludes the funds-adjacent `greenwill` target** — upgrade GreenWill only as its explicit target with its own reviewed tx-plan (root wrappers: `contracts:upgrade:greenwill:dry:arbitrum` / `contracts:upgrade:greenwill:arbitrum`).

Arbitrum and Celo broadcasts enforce the **Sepolia deployment gate**; do not pass `--override-sepolia-gate` without release-owner approval. The reviewer-led manual path for a verified garden-proxy rollback is `Upgrade.s.sol`'s `upgradeGardenProxy` with the known previous implementation — it is not a reason to run raw Foundry commands. Release sequencing: `docs/docs/builders/deployments/releasing.mdx`.

## Access Control (Hats Protocol)

Access is gated via Hats, checked with `IHats.isWearerOfHat` (see `registries/Power`, `registries/GreenWill`, `registries/ENS`).

- **Per-garden hats** — from `HatsModule.getGardenHatIds(garden)` (`src/modules/Hats.sol`): `admin`, `operator`, `gardener`, `community`.
- **Protocol-level hats** — `communityHatId` / `gardensHatId` / `protocolGardenersHatId`; `ENS` registry gates protocol ops on `protocolHatId` (reverts `NotProtocolMember`).
- Garden TBA (`src/accounts/Garden.sol`) config setters use `onlyOperator`; `mintGarden` (`src/tokens/Garden.sol`) uses `onlyAuthorizedMinter`, not a hat.
- **UUPS `_authorizeUpgrade` is `onlyOwner`** (proxy owner `0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6`) across all upgradeable contracts — **not** hat-gated.

## Reference Files

- Deploy CLI: `script/deploy.ts`
- Core deployer: `script/deploy/core.ts`
- Schemas: `config/schemas.json` (READ ONLY)
- Deployments: `deployments/{chainId}-latest.json`

## Documentation References (on-demand)

Read these docs pages when you need deployment context or protocol details:

- Deployment runbook (3-chain CLI commands): `docs/docs/builders/operations.mdx`
- System architecture and contract relationships: `docs/docs/builders/architecture.mdx`
- Cross-protocol entity matrix: `docs/docs/builders/integrations/entity-matrix.mdx`
- EAS integration reference: `docs/docs/builders/integrations/eas.mdx`
