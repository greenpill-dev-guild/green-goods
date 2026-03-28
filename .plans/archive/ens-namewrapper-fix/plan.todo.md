# ENS NameWrapper Fix — Subdomain Registration on Garden Creation

**GitHub Issue**: N/A (reported via debugging session)
**Branch**: `fix/ens-namewrapper`
**Status**: ACTIVE — code complete, awaiting deployment
**Created**: 2026-03-16
**Last Updated**: 2026-03-16

## Root Cause

ENS subdomain names were not being set during garden creation. The entire ENS registration path is wrapped in graceful degradation (try/catch), so failures were **silent** — gardens created successfully but without ENS names.

**Mainnet**: `greengoods.eth` is wrapped in the ENS NameWrapper (`0xD4416b...`). The NameWrapper owns the node on the raw ENS Registry. The receiver called `setSubnodeOwner` on the raw registry, which reverted because only the NameWrapper (or its approved operators) can modify wrapped nodes. The revert was caught silently.

**Sepolia**: `greengoods.eth` was not registered on the ENS Registry at all (`owner = address(0)`). Same silent failure pattern. The user has since registered it with the deployer address (unwrapped).

### On-Chain Verification (2026-03-16)

All L2 wiring was confirmed correct:
- `ensModule` set on GardenToken: ✅ (both Arbitrum and Sepolia)
- `authorizedCallers[gardenToken]` on GreenGoodsENS: ✅
- `l1Receiver` on GreenGoodsENS: ✅ (points to deployed receivers)
- CCIP fee estimation: ✅ (Arbitrum ~0.000269 ETH, Sepolia 0 via LocalCCIPRouter)

The issue was entirely on the L1 receiver side — ENS record creation failed silently.

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Dual-path `_setENSRecords` (NameWrapper vs raw registry) | Mainnet uses NameWrapper, Sepolia is unwrapped. `NAME_WRAPPER` immutable discriminates at zero cost |
| 2 | `INameWrapper` minimal interface (4 methods) | Full `INameWrapper` inherits `IERC1155` → heavy dependency tree + OZ version conflicts |
| 3 | Receiver implements `onERC1155Received` | NameWrapper mints ERC1155 tokens for wrapped subnodes — receiver must accept them |
| 4 | `type(uint64).max` for expiry, `0` for fuses | Standard pattern for programmatic subdomains. NameWrapper clamps expiry to parent's |
| 5 | Migration script reuses existing CCIP router | Sender's `CCIP_ROUTER` is immutable — new receiver MUST use same router or `onlyRouter` reverts |
| 6 | NameWrapper address in `networks.json` | Same pattern as other per-chain contract addresses. Enables fresh deploys to auto-detect |

## Critical Bugs Caught During Review

| # | Severity | Issue | How Caught |
|---|----------|-------|------------|
| 1 | CRITICAL | Migration script deployed new `LocalCCIPRouter` — sender's immutable `CCIP_ROUTER` would reject the new router | Manual code review of cross-contract invariants |
| 2 | CRITICAL | NameWrapper mints ERC1155 for wrapped subnodes — receiver needs `onERC1155Received()` or `setSubnodeRecord` reverts | **Mainnet fork test** — `test_forkEthereum_nameWrapper_registersGardenSubdomain` |

Both bugs would have caused the **exact same silent failure** as the original issue (try/catch swallows the revert).

## Files Modified

### Core Contract
- `src/interfaces/IENS.sol` — Added `INameWrapper` interface (4 methods: `setSubnodeRecord`, `setSubnodeOwner`, `ownerOf`, `setApprovalForAll`)
- `src/registries/ENSReceiver.sol` — Added `NAME_WRAPPER` immutable, constructor param, dual-path `_setENSRecords`/`_clearENSRecords`, ERC1155 receiver (`onERC1155Received`, `onERC1155BatchReceived`, `supportsInterface`)

### Deployment Infrastructure
- `deployments/networks.json` — Added `nameWrapper` address for mainnet (`0xD4416b...`)
- `script/DeployHelper.sol` — Added `nameWrapper` to `NetworkConfig` struct + JSON loader
- `script/Deploy.s.sol` — Updated `_deployMainnetENS` to pass `nameWrapper` + smart approval (NameWrapper vs raw registry)
- `test/helpers/DeploymentBase.sol` — Pass `address(0)` for nameWrapper in Sepolia deploy

### Migration Scripts (NEW)
- `script/UpgradeENSReceiver.s.sol` — Solidity: `deploySepolia()`, `deployMainnet()`, `updateL1Receiver()`, `migrateRegistrations()`
- `script/upgrade-ens-receiver.ts` — TypeScript CLI wrapper

### Tests
- `test/unit/GreenGoodsENSReceiver.t.sol` — Updated all 4 constructor call sites with 8th arg
- `test/fork/EthereumENSReceiver.t.sol` — Updated constructor
- `test/fork/CrossChainENS.t.sol` — Updated constructor
- `test/fork/EthereumENSNameWrapper.t.sol` — **NEW**: 5 fork tests against real mainnet NameWrapper

## Test Results

- **Unit tests**: 36/36 pass (unwrapped path, all existing tests)
- **Full suite**: 1391/1391 pass
- **Mainnet fork tests**: 5/5 pass (NameWrapper path against real ENS contracts)
  - `registersGardenSubdomain` — setSubnodeRecord → NameWrapper ownership → setAddr → ENS resolution ✅
  - `registersGardenerSubdomain` — personal name + reverse mapping + ENS resolution ✅
  - `releasesClearENS` — register → release → addr cleared, slug available ✅
  - `adminRegister` — migration path works through NameWrapper ✅
  - `noApproval_failsGracefully` — without approval, ENS fails silently, internal state still set ✅

## Implementation Steps

### Step 1: Core contract changes ✅
**Files**: `src/interfaces/IENS.sol`, `src/registries/ENSReceiver.sol`
- Added `INameWrapper` interface
- Added `NAME_WRAPPER` immutable + constructor param
- Dual-path `_setENSRecords` / `_clearENSRecords`
- ERC1155 receiver support (required by NameWrapper)
- `supportsInterface` override merging CCIP + ERC1155

### Step 2: Deployment infrastructure ✅
**Files**: `networks.json`, `DeployHelper.sol`, `Deploy.s.sol`, `DeploymentBase.sol`
- NameWrapper address in network config
- Fresh deploys auto-detect wrapped vs unwrapped
- Sepolia deploy passes `address(0)` for unwrapped names

### Step 3: Migration scripts ✅
**Files**: `UpgradeENSReceiver.s.sol`, `upgrade-ens-receiver.ts`
- Sepolia: single-tx migration (reuses existing router, re-wires sender/receiver, migrates root slug)
- Mainnet: deploy receiver + approval, then separate Arbitrum l1Receiver update
- Registration migration via `adminRegister` batch

### Step 4: Test coverage ✅
**Files**: `EthereumENSNameWrapper.t.sol`, updated unit/fork test constructors
- 5 mainnet fork tests validating the NameWrapper path end-to-end
- All existing tests updated for new constructor signature

### Step 5: Deploy to Sepolia ⏳
```bash
# Dry run
bun script/upgrade-ens-receiver.ts deploy-sepolia --network sepolia

# Execute
bun script/upgrade-ens-receiver.ts deploy-sepolia --network sepolia --broadcast
```
- Update `deployments/11155111-latest.json` with new `ensReceiver` address

### Step 6: Deploy to Mainnet ⏳
```bash
# Step 1: Deploy new receiver on Ethereum mainnet
bun script/upgrade-ens-receiver.ts deploy-mainnet --network mainnet --broadcast

# Step 2: Update l1Receiver on Arbitrum
bun script/upgrade-ens-receiver.ts update-l1-receiver --network arbitrum \
  --new-receiver <NEW_RECEIVER_ADDRESS> --broadcast
```
- Update `deployments/1-latest.json` with new `ensReceiver` address
- Deployer must be the wrapped owner of `greengoods.eth` (`0xFBAf...`)

### Step 7: Post-deployment verification ⏳
```bash
# Verify Sepolia — create a garden with slug, check ENS resolution
cast call <new_receiver> "resolve(string)(address)" "community" --rpc-url $SEPOLIA_RPC_URL

# Verify mainnet — check NameWrapper ownership of a registered subnode
cast call 0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401 \
  "ownerOf(uint256)(address)" <subnode_id> --rpc-url $MAINNET_RPC_URL
```

## How Deploy.s.sol Prevents Recurrence

Fresh deployments now handle both scenarios automatically:

1. `NetworkConfig` loads `nameWrapper` from `networks.json` (address(0) if not configured)
2. Constructor passes `nameWrapper` to `GreenGoodsENSReceiver`
3. Approval logic branches: `INameWrapper.setApprovalForAll()` for wrapped, `IENS.setApprovalForAll()` for unwrapped
4. `_setENSRecords` uses the NameWrapper path when `NAME_WRAPPER != address(0)`
5. Receiver implements `IERC1155Receiver` so NameWrapper's ERC1155 minting succeeds

No manual intervention needed on future deploys — the infrastructure detects and handles wrapped names automatically.
