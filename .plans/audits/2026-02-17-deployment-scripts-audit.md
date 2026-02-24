# Deployment Scripts Audit Report — 2026-02-17

## Scope

Comprehensive audit of contract deployment scripts to verify a **fresh deployment** works on:
- **Sepolia** (11155111) — primary testnet
- **Arbitrum** (42161) — full production deployment with all modules

## Executive Summary

- **Files analyzed**: 18 (TypeScript CLI + Solidity scripts + configs + deployment JSONs)
- **Critical**: 2 | **High**: 4 | **Medium**: 5 | **Low**: 4

The deployment infrastructure is well-architected with proper separation of concerns, CREATE2 idempotency, and safety gates. However, several issues would block or partially fail a **fresh deployment** on Sepolia and Arbitrum.

---

## Critical Findings

### C-1: `ensReceiver` field missing from both deployment JSONs (data gap)

**Location**: `deployments/11155111-latest.json`, `deployments/42161-latest.json`

Both deployment JSONs lack an `ensReceiver` field entirely. The `_saveDeployment()` function in `DeployHelper.sol:262` serializes it, and `DeploymentResult` includes it at line 59, but neither existing JSON has the field. This means:

1. On **Sepolia**: A fresh deploy creates an `ensReceiver` via `_deploySepoliaENS()`, and `_saveDeployment()` writes it. The current JSON was produced by an older deploy that predates ENS integration. **On a fresh deploy this is fine** — the new JSON will include it.

2. On **Arbitrum**: The `_deployAndWireENS()` path for Arbitrum does NOT create an `ensReceiver` (only `greenGoodsENS` L2 sender). The `ensReceiver` field will be `address(0)`. The cross-chain wiring (`_autoWireENSCrossChain` in core.ts) reads `ensReceiver` from **mainnet** deployment JSON, not Arbitrum. **This is architecturally correct but may confuse operators** who see zero in Arbitrum's JSON and assume it's broken.

**Severity**: CRITICAL (data integrity — `ensReceiver` absent causes indexer/frontend config drift)

**Recommendation**: The field is correctly produced by `_saveDeployment()` so a fresh deploy will self-heal. Document that `ensReceiver` is mainnet-only and expected to be `0x0` on L2 deployments.

### C-2: Arbitrum deployment JSON has zero `assessmentSchemaUID` and `workApprovalSchemaUID`

**Location**: `deployments/42161-latest.json:40-44`

```json
"assessmentSchemaUID": "0x000...000",
"workApprovalSchemaUID": "0x000...000",
"workSchemaUID": "0x8b8d53d8d4f258c621319185e86dad094e45a21b8ca7770a44770daae22c5a16"
```

Two of three schema UIDs are zero on Arbitrum. This means the deployment was run **without `--update-schemas`** or schema registration partially failed. The `workSchemaUID` is non-zero, suggesting schemas were registered one at a time rather than atomically.

**Impact**: Frontend queries via `shared/modules/data/eas.ts` use schema UIDs from deployment JSON. Zero UIDs = **no assessment or work approval attestation queries will work on Arbitrum**.

**Severity**: CRITICAL (functional — attestation queries broken on production chain)

**Recommendation**: Run `bun script/deploy.ts core --network arbitrum --broadcast --update-schemas` to register missing schemas without redeploying contracts.

---

## High Findings

### H-1: Arbitrum deployment JSON missing `guardian` address (zero)

**Location**: `deployments/42161-latest.json:8`

```json
"guardian": "0x0000000000000000000000000000000000000000"
```

The Guardian contract is deployed by `deployGuardian()` in step 1 of `_deployCoreContracts()` (DeploymentBase.sol:195). A zero address means either: (a) the deployment predates Guardian, or (b) the CREATE2 address wasn't saved. On a **fresh deploy**, `deployGuardian()` will deploy it, so this self-heals. But the existing Arbitrum deployment has no Guardian protection for GardenAccounts.

**Severity**: HIGH (security — GardenAccount recovery/guard functionality disabled)

**Recommendation**: A fresh deploy fixes this. For the existing deployment, verify whether the Guardian was deployed but not saved (check CREATE2 predicted address with current salt), or if it genuinely needs deployment.

### H-2: Sepolia deployment JSON has zero `assessmentResolver` despite non-zero schema UIDs

**Location**: `deployments/11155111-latest.json:4`

```json
"assessmentResolver": "0x0000000000000000000000000000000000000000"
```

The `assessmentSchemaUID` is non-zero, but the resolver contract is `0x0`. This likely means: (a) schema was registered with a zero resolver address, creating an unresolved schema, or (b) the resolver was deployed but not recorded. The `_deployAssessmentResolver()` in DeploymentBase deploys it as part of the core contracts flow.

**Severity**: HIGH (functional — assessment attestations not validated on Sepolia)

**Recommendation**: A fresh deploy will deploy the resolver and update the JSON. Verify the existing schema UID is still valid or needs re-registration.

### H-3: All optional modules are zero on both Sepolia and Arbitrum

**Location**: Both `deployments/*-latest.json`

Both chains show zero addresses for: `hatsModule`, `gardensModule`, `yieldSplitter`, `octantModule`, `octantFactory`, `cookieJarModule`, `karmaGAPModule`, `unifiedPowerRegistry`, `hypercertsModule`, `marketplaceAdapter`.

Per CLAUDE.md this is "normal — it simply means a deployment is needed." However, **Arbitrum is intended as a full production deployment of all modules**. A fresh deploy will deploy all of these. The concern is:

1. **Module wiring order matters** — all 25+ `setX()` calls in `_deployCoreContracts()` assume all modules exist
2. **Octant on Arbitrum** requires `OCTANT_FACTORY_ADDRESS` env var, which must be set **before** core deploy, or deploy OctantFactory first

**Severity**: HIGH (operational — fresh Arbitrum deploy requires specific env var choreography)

**Recommendation**: Document the required Arbitrum deployment sequence:
1. `bun deploy.ts octant-factory --network arbitrum --broadcast` (deploys factory, merges into JSON)
2. Set `OCTANT_FACTORY_ADDRESS=<factory>` in `.env`
3. `bun deploy.ts core --network arbitrum --broadcast --update-schemas`
OR: Use `_configureArbitrumOctantAssets()` defaults which deploy inline AaveV3 strategies (no OctantFactory needed for initial deploy).

### H-4: Sepolia ENS deployment requires deployer to own `greengoods.eth`

**Location**: `DeploymentBase.sol:1052`

```solidity
IENS(ensRegistry).setApprovalForAll(address(ensReceiver), true);
```

On Sepolia, `_deploySepoliaENS()` calls `setApprovalForAll` on the real Sepolia ENS registry. If the deployer doesn't own `greengoods.eth` on Sepolia ENS, this **reverts and halts the entire deployment**. There is no try/catch around this call (unlike most other deployment steps).

**Severity**: HIGH (deployment blocker — hard failure with no fallback)

**Recommendation**: Wrap the Sepolia ENS deployment in a try/catch or add a `SKIP_ENS` env var flag. Alternatively, document that the deployer must own `greengoods.eth` on Sepolia ENS before deploying.

---

## Medium Findings

### M-1: `_generateSchemaString` uses `bun run` FFI but `_uploadActionsToIPFS` uses `npx tsx`

**Location**: `DeployHelper.sol:367-368` vs `Deploy.s.sol:415-418`

```solidity
// DeployHelper.sol — schema generation
inputs[0] = "bun"; inputs[1] = "run"; inputs[2] = "script/utils/generate-schemas.ts";

// Deploy.s.sol — IPFS upload
inputs[0] = "npx"; inputs[1] = "tsx"; inputs[2] = "script/utils/ipfs-uploader.ts";
```

Schema generation uses `bun run` which works fine. IPFS upload uses `npx tsx` because of `@storacha/client` Bun incompatibility. Both are FFI calls from Solidity. If the environment doesn't have `bun` in PATH during `forge script` execution, schema generation fails.

**Severity**: MEDIUM (environment dependency — fails in CI without `bun`)

**Recommendation**: Both should consistently use `npx tsx` for reliability, or validate `bun` availability in the TypeScript CLI before invoking `forge script`.

### M-2: `_configureOctant()` is called only on non-mainnet chains but has no guard for missing `octantModule`

**Location**: `Deploy.s.sol:236-261`

```solidity
function _configureOctant() internal {
    if (address(octantModule) == address(0) || address(gardenToken) == address(0)) {
        return; // Early return if not deployed
    }
    address octantFactoryAddress = _envAddressOrZero("OCTANT_FACTORY_ADDRESS");
    if (octantFactoryAddress == address(0)) {
        return; // Early return if no factory
    }
    ...
}
```

The guard is correct — `_configureOctant()` safely no-ops if `OCTANT_FACTORY_ADDRESS` is unset. However, on Arbitrum where Octant is expected, a missing env var means **Octant silently deploys without asset configuration** (no WETH/DAI strategies). The user gets no warning.

**Severity**: MEDIUM (silent misconfiguration on production chain)

**Recommendation**: Add a console.log warning when on Arbitrum (chainId 42161) and `OCTANT_FACTORY_ADDRESS` is not set.

### M-3: `_ensureHatsTree()` only runs on `_isBroadcasting()` — dry runs can't validate tree

**Location**: `Deploy.s.sol:78-79`

```solidity
if (_isBroadcasting()) {
    _ensureHatsTree();
}
```

The Hats tree setup is gated behind broadcast mode. This means a dry run (`--dry-run` or simulation without `--broadcast`) **cannot validate whether the deployer is actually a topHat wearer**. The deployer discovers this only during the real broadcast, potentially wasting gas.

**Severity**: MEDIUM (operational — late failure during expensive broadcast)

**Recommendation**: Add a `--validate-hats` flag that performs a read-only check of the deployer's hat admin status before broadcast.

### M-4: `_deployGardensFromConfig` loops up to 50 but catches ALL errors silently

**Location**: `Deploy.s.sol:350-365`

```solidity
for (uint256 i = 0; i < 50; i++) {
    try vm.parseJson(gardensJson, ...) returns (bytes memory nameBytes) {
        ...
    } catch {
        break; // Silently breaks on ANY error
    }
}
```

The loop uses `try/catch` to detect the end of the array, but this also catches **real errors** like malformed JSON, invalid garden configs, or `mintGarden` reverts. A garden deployment failure is silently swallowed.

**Severity**: MEDIUM (error swallowing — garden deployment failures hidden)

**Recommendation**: Separate the "end of array" detection from garden deployment errors. Use a pre-computed count (like `_getActionsCount`) for gardens too.

### M-5: CCIP chain selector silent skip for Celo

**Location**: `DeploymentBase.sol:1005-1008, 1152-1153`

```solidity
if (ccipRouter == address(0)) return; // Silent skip
// Celo, localhost, unknown chains: no CCIP support
return (address(0), 0);
```

When deploying to Celo, the ENS module is silently skipped with no log output. Operators may not realize ENS is unavailable on Celo.

**Severity**: MEDIUM (UX — operator confusion about missing ENS on Celo)

---

## Low Findings

### L-1: `forceRedeploy` mode flag is parsed but never used

**Location**: `Deploy.s.sol:51-53, 577-594`

```solidity
struct DeploymentMode { bool updateSchemasOnly; bool forceRedeploy; }
```

`forceRedeploy` is parsed from `FORCE_REDEPLOY` env var and set in `core.ts:181`, but the `run()` function never checks `mode.forceRedeploy`. The CREATE2 `_isDeployed()` check is the only skip mechanism, and `forceRedeploy` doesn't override it.

**Severity**: LOW (dead code — misleading flag that does nothing)

### L-2: Verification skip logic has edge case

**Location**: `core.ts:226-246`

```typescript
if (fs.existsSync(deploymentFile) && !options.force) {
    console.log("Skipping verification - contracts already deployed");
    shouldVerify = false;
}
```

If a deployment JSON exists (even with zero addresses), verification is skipped unless `--force` is used. On a fresh deploy where the JSON was created by a prior partial deployment, contracts that **changed addresses** won't get verified.

**Severity**: LOW (operational — new contracts may not get auto-verified)

### L-3: `_findJsonArrayBounds` heuristic fragile for nested JSON

**Location**: `Deploy.s.sol:474-497`

The `_findJsonArrayBounds` function uses a simple last-`]` / nearest-`[` heuristic. The comment acknowledges this only works for flat string arrays. If IPFS uploader output format changes to include nested structures, parsing breaks.

**Severity**: LOW (fragility — IPFS output format coupling)

### L-4: Deployment salt hardcoded with incrementing suffix

**Location**: `DeployHelper.sol:172`

```solidity
string memory saltInput = "greenGoodsCleanDeploy2025:14";
```

The salt uses a hardcoded string with what appears to be a manual version number (`:14`). For a truly fresh deployment, this salt would produce the same CREATE2 addresses as the previous deployment at salt `:14`. If a fresh deployment needs **different addresses**, the `DEPLOYMENT_SALT` env var must be set.

**Severity**: LOW (operational — documented but easy to forget)

---

## Fresh Deployment Walkthrough

### Sepolia Fresh Deploy Sequence

```bash
# Prerequisites:
# 1. Deployer funded on Sepolia
# 2. Deployer MUST own greengoods.eth on Sepolia ENS (or set SKIP_ENS=true)
# 3. Foundry keystore configured: cast wallet import green-goods-deployer

# Step 1: Deploy core stack + register EAS schemas
bun script/deploy.ts core --network sepolia --broadcast --update-schemas

# What happens:
# - DeploymentBase._deployL2Protocol() deploys all 18+ contracts via CREATE2
# - _registerSchemas() registers 3 EAS schemas
# - _deploySepoliaENS() deploys LocalCCIPRouter + GreenGoodsENSReceiver + GreenGoodsENS
# - _ensureHatsTree() mints communityHat to HatsModule (deployer must be topHat wearer)
# - _deploySeedData() mints gardens from config/gardens.json, registers actions from config/actions.json
# - _saveDeployment() writes deployments/11155111-latest.json
# - Envio config.yaml auto-updated

# Step 2 (optional): Deploy Octant factory if needed
bun script/deploy.ts octant-factory --network sepolia --broadcast
```

**Potential blockers on Sepolia**:
1. Deployer doesn't own `greengoods.eth` on Sepolia ENS → hard revert at `setApprovalForAll`
2. Deployer is not topHat wearer of Hats tree 2022 → `mintHat` reverts
3. IPFS upload fails without `VITE_STORACHA_KEY` → set `SKIP_IPFS_UPLOAD=true`
4. `bun` not in forge FFI PATH → `_generateSchemaString` fails

### Arbitrum Fresh Deploy Sequence (Full Modules)

```bash
# Prerequisites:
# 1. Sepolia deployed first (release gate enforced)
# 2. Deployer funded on Arbitrum
# 3. Set env vars: OCTANT_FACTORY_ADDRESS (if OctantFactory already deployed)

# Step 1 (optional but recommended): Deploy OctantFactory first
bun script/deploy.ts octant-factory --network arbitrum --broadcast
# This writes factory address to 42161-latest.json automatically

# Step 2: Deploy full stack
bun script/deploy.ts core --network arbitrum --broadcast --update-schemas --override-sepolia-gate
# OR if Sepolia is fully deployed:
bun script/deploy.ts core --network arbitrum --broadcast --update-schemas

# What happens:
# - Same as Sepolia but with Arbitrum-specific addresses
# - _configureArbitrumOctantAssets() deploys AaveV3 strategies for WETH + DAI
# - _deployAndWireENS() deploys GreenGoodsENS L2 sender (no receiver on Arbitrum)
# - _ensureHatsTree() uses Arbitrum tree 92 constants
# - 25+ module wiring calls complete the protocol graph
# - CCIP L1 receiver wired later after mainnet deploy

# Step 3: Verify all modules deployed
jq '.hatsModule, .gardensModule, .octantModule, .yieldSplitter' deployments/42161-latest.json
```

**Potential blockers on Arbitrum**:
1. **Release gate**: Sepolia must have non-zero `gardenToken`, `actionRegistry`, `workResolver` → use `--override-sepolia-gate` if Sepolia deployment JSON is stale
2. Deployer is not topHat wearer of Hats tree 92 → `mintHat` reverts
3. CCIP router misconfigured → ENS silently skips (acceptable)
4. Missing `OCTANT_FACTORY_ADDRESS` → Octant module deploys but has no asset configuration (silent)

---

## Module Availability Matrix

| Module | Sepolia | Arbitrum | Celo | Notes |
|--------|---------|----------|------|-------|
| Core (GardenToken, ActionRegistry, Resolvers) | YES | YES | YES | Always deployed |
| HatsModule | YES | YES | YES | Requires topHat wearer as deployer |
| OctantModule | YES (mock) | YES (AaveV3) | YES (env) | Arbitrum has defaults, others need env vars |
| GardensModule | YES | YES | YES | Always deployed |
| CookieJarModule | YES (real) | YES (real) | NO (mock) | Real factory on Sepolia/Arbitrum only |
| YieldSplitter | YES | YES | YES | Always deployed |
| HypercertsModule | YES | YES | YES | Initialized empty, wired post-deploy |
| MarketplaceAdapter | YES | YES | YES | Initialized empty, wired post-deploy |
| GreenGoodsENS | YES (full) | YES (L2 only) | NO | Sepolia: sender+receiver. Arb: sender only. Celo: no CCIP |
| ENSReceiver | YES (same chain) | NO | NO | Only mainnet (cross-chain) or Sepolia (local router) |
| UnifiedPowerRegistry | YES | YES | YES | Always deployed |
| KarmaGAPModule | YES | YES | YES | Always deployed |

---

## Recommendations

### Must-Fix Before Fresh Deploy

1. **Register missing Arbitrum EAS schemas**: `bun script/deploy.ts core --network arbitrum --broadcast --update-schemas` (schema-only mode if contracts exist)
2. **Document ENS ownership requirement**: Deployer must own `greengoods.eth` on Sepolia ENS, or deployment hard-fails
3. **Document Hats tree ownership**: Deployer must be topHat wearer on each chain
4. **Set `SKIP_IPFS_UPLOAD=true`** if IPFS credentials unavailable (or ensure `VITE_STORACHA_KEY` is set)

### Should-Fix (Quality)

5. Add console.log warnings for silent Octant skip on Arbitrum
6. Add console.log for ENS CCIP skip on Celo
7. Remove or implement `forceRedeploy` flag (currently dead code)
8. Pre-count gardens array to avoid error swallowing in loop
9. Consider adding a `--validate-only` flag that checks Hats tree admin status before broadcast

### Nice-to-Have

10. Add `ensReceiver` field documentation (mainnet-only, zero on L2s is expected)
11. Unify FFI runners (`bun run` vs `npx tsx`) for consistency
12. Add deployment salt rotation documentation to prevent accidental address collision
