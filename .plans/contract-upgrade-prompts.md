# Contract Upgrade Prompts

**Created**: 2026-03-08
**Branch**: `fix/contracts-crosspackage`
**Sequence**: Prompt 1 & 2 (parallel) → Prompt 3 (gate) → Prompt 4 (deploy)

---

## Prompt 1: Octant Vault/Strategy 4-Layer Fix

```
## Task: Implement Octant Vault-Strategy Auto-Allocate Fix

Follow the plan in `.plans/vault-strategy-autoallocate-fix.todo.md` exactly.
It has 8 implementation steps, 20 decisions, and adversarial review findings already documented.

### What to implement (in order):

**Step 1**: Create `packages/contracts/src/strategies/AaveV3ERC4626.sol`
- OZ 5.0.2 ERC4626 base with Aave V3 pool integration
- CRITICAL: `maxDeposit()` MUST query Aave pool state (frozen/paused/supply cap) per Decision 15
- `forceApprove(pool, max)` in constructor per Decision 18

**Step 2**: Update `packages/contracts/src/interfaces/IOctantFactory.sol`
- Add `set_auto_allocate(bool)`, `update_max_debt_for_strategy(address, uint256)`, `set_accountant(address)` to IOctantVault

**Step 3**: Update `VAULT_ROLE_BITMASK` in `packages/contracts/src/modules/Octant.sol`
- Add bits 3 (ACCOUNTANT_MANAGER), 6 (DEBT_MANAGER), 7 (MAX_DEBT_MANAGER)

**Step 4**: Wire auto-allocate in `_createVaultForGardenAsset()` in Octant.sol
- After `add_strategy`: set maxDebt=max, autoAllocate=true, set accountant=yieldResolver

**Step 5a**: Add `IAccountant.report()` to `packages/contracts/src/resolvers/Yield.sol`
- Return `(gain, 0)` — 100% of gain as fees per Decision 11

**Step 5b**: Auto-set donation address in vault creation (Octant.sol)
- `gardenDonationAddresses[garden] = yieldResolver` per Decision 13

**Step 6**: Add `enableAutoAllocate()` backfill function in Octant.sol
- Use `add_role()` NOT `set_role()` per Decision 16
- Skip `revoke_strategy` when old strategy was never attached (activation=0) per Decision 16

**Step 7**: Update `packages/contracts/script/Deploy.s.sol`
- Switch from `AaveV3` to `AaveV3ERC4626` in `_configureArbitrumOctantAssets()`

**Step 8**: Write tests per the Test Strategy section in the plan
- Unit: AaveV3ERC4626.t.sol, updated OctantModule.t.sol, updated YieldResolver.t.sol
- Fork: ArbitrumAaveStrategy.t.sol, ArbitrumOctantVault.t.sol (end-to-end pipeline)
- Adversarial: Aave paused, never-attached strategy backfill, role preservation, no underflow

### Rules
- Use `bun build` / `bun run test` (never raw forge commands)
- Don't delete AaveV3.sol (deprecate, keep for backward compat per Decision 3)
- Aave V3 Pool on Arbitrum: `0x794a61358D6845594F94dc1DB02A252b5b4814aD`
- Run `bun format && bun lint` after all changes
```

---

## Prompt 2: ENS Integration Fixes

```
## Task: Fix ENS Integration Issues from Audit

Two issues from the 2026-02-18 ENS integration review need fixing.

### Fix 1: Indexer config sync missing GreenGoodsENS (H2 from audit)

**File**: `packages/contracts/script/utils/envio-integration.ts`
**Issue**: The `upsertContract` block syncs 10 contracts but omits `GreenGoodsENS`.
The indexer DOES index ENS events (handlers in `packages/indexer/src/handlers/`),
but running the sync script never updates the ENS contract address in config.yaml.

**Fix**: Add `upsertContract("GreenGoodsENS", deployment.greenGoodsENS)` after the
existing contract sync block (~line 250).

### Fix 2: CHAIN_ID_MAP missing mainnet entry (L14 from audit)

**File**: `packages/contracts/script/utils/deployment-addresses.ts`
**Issue**: `loadForChain("mainnet")` would look for `mainnet-latest.json` instead of
`1-latest.json` because the fallback is `chainId.toString()` on the string `"mainnet"`.

**Fix**: Add `mainnet: 1` to `CHAIN_ID_MAP`.

### Fix 3: Verify ENS deploy wiring

Check `packages/contracts/script/deploy/core.ts` ENS auto-populate logic:
- Confirm `_syncEnsReceiverToEnv()` correctly reads from `1-latest.json` (now that CHAIN_ID_MAP has mainnet)
- Confirm Deploy.s.sol creates GreenGoodsENS and ENSReceiver with correct constructor args
- Confirm post-deploy `core.ts` handles cross-chain wiring (l1Receiver ↔ l2Sender)

### Rules
- Read files before editing — verify current code matches audit description
- Run `bun format && bun lint` after changes
- Don't modify contract Solidity — these are TypeScript-only fixes
```

---

## Prompt 3: Cross-Package Validation

```
## Task: Full cross-package validation before contract upgrade deployment

Run the complete validation suite to confirm all contract changes are safe to deploy.
This covers: current branch changes (GardenAccount name validation, CookieJar cap),
Octant vault-strategy fix, ENS integration fixes, and resolver upgrades.

### Step 1: Format and lint
bun format && bun lint

Fix any issues found.

### Step 2: Unit tests
cd packages/contracts && bun run test

All tests must pass. If any fail, investigate and fix.

### Step 3: Fork tests (requires RPC URLs in .env)
cd packages/contracts && bun run test:fork

Critical assertions to verify in output:
- Funds reach Aave: `aToken.balanceOf(strategy) > 0`
- Fee shares reach resolver: `vault.balanceOf(resolver) > 0`
- Full pipeline: deposit → auto-allocate → harvest → splitYield
- Backfill: existing vault migration works

### Step 4: Build
bun build

Must succeed across all packages (contracts → shared → indexer → client/admin).

### Step 5: Upgrade safety check
cd packages/contracts && bun run test -- --match-contract UpgradeSafety

Verify storage layout compatibility for all UUPS upgradeable contracts.

### Step 6: Verify deployment script dry-run
bun script/deploy.ts core --network sepolia

Confirm the dry-run output shows:
- GardenAccount new implementation deploy
- CookieJarModule upgrade
- OctantModule upgrade (new role bitmask, auto-allocate wiring)
- YieldResolver upgrade (IAccountant implementation)
- AaveV3ERC4626 strategy deploy
- Resolver upgrades (if applicable)
- ENS contracts unchanged (already deployed)

### Step 7: Cross-package type check
bun run typecheck  # or tsc --noEmit across packages

### Rules
- Do NOT broadcast. Dry-run only.
- Report pass/fail for each step with specific error details if failing
- If fork tests need RPC URLs, check .env for ARBITRUM_RPC_URL, SEPOLIA_RPC_URL
```

---

## Prompt 4: Contract Upgrade Deployment

```
## Task: Deploy contract upgrades to Sepolia (test) then Arbitrum (production)

Prerequisites: All validation from the cross-package validation prompt must pass first.

### Phase 1: Sepolia Deploy (test network)

bun script/deploy.ts core --network sepolia --broadcast --update-schemas

Post-deploy verification:
1. Run `packages/contracts/script/utils/post-deploy-verify.ts` against Sepolia
2. Verify deployment artifact updated: `packages/contracts/deployments/11155111-latest.json`
3. Run resolver EAS immutable validation: `node packages/contracts/script/validate-resolver-eas.mjs sepolia`
4. Run indexer config sync: update `packages/indexer/config.yaml` with new addresses
5. Test a garden mint on Sepolia testnet to confirm end-to-end flow

### Phase 2: Arbitrum Deploy (production)

Only proceed after Sepolia is verified clean.

bun script/deploy.ts core --network arbitrum --broadcast --update-schemas

Post-deploy verification:
1. Run post-deploy-verify against Arbitrum
2. Verify `packages/contracts/deployments/42161-latest.json` updated
3. Run resolver EAS immutable validation on Arbitrum
4. Run `enableAutoAllocate()` backfill for existing Arbitrum vaults with idle funds
5. Sync indexer config.yaml
6. Verify first deposit auto-deploys to Aave (monitor aToken balances)

### Phase 3: Community Name Remediation (governance)

After Arbitrum deploy, run the Safe TX batch for existing communities:
bun scripts/generate-garden-name-safe-txs.ts --network arbitrum --broadcast

Submit the generated JSON to the council Safe for execution.

### Phase 4: Commit and tag

git add packages/contracts/deployments/
git commit -m "deploy(contracts): upgrade all modules — Octant vault fix, ENS sync, resolver upgrades"
git tag v1.x.0-contracts  # use appropriate version

### Rules
- STOP and ask before broadcasting to Arbitrum
- Never force-push deployment artifacts
- If any post-deploy verification fails, do NOT proceed to next phase
```
