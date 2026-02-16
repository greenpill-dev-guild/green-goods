# Octant Vault Integration: Factory Deployment & Split Update

**Status**: BLOCKED (awaiting Octant V2 factory on Arbitrum)
**Created**: 2026-02-15
**Last Updated**: 2026-02-15

## Context

The Octant vault integration in Green Goods is **architecturally complete** but not yet functional on Arbitrum because:
1. The Octant `MultistrategyVaultFactory` only exists on Ethereum mainnet — no Arbitrum deployment exists
2. Without the factory, `OctantModule.onGardenMinted()` silently no-ops (factory address is zero)
3. The yield split defaults (33/33/33) need updating: Juicebox drops from ~33.33% to 2.7%

---

## Part 1: Octant Factory Arbitrum Deployment Script

### Create: `packages/contracts/script/DeployOctantFactory.s.sol`

Lives alongside `DeployJuicebox.s.sol` — a standalone Foundry script that:

1. Deploys a minimal `MultistrategyVault` ERC-4626 implementation (EIP-1167 clone source)
2. Deploys `MultistrategyVaultFactory` matching the `IOctantFactory` interface at `src/interfaces/IOctantFactory.sol`
3. Factory uses OpenZeppelin `Clones.cloneDeterministic()` — same pattern as upstream Octant v2 core
4. Configuration:
   - Name: `"Green Goods Vault Factory"`
   - Governance: deployer (transferred to multisig later)
   - No factory-level protocol fee (Green Goods takes its cut via YieldSplitter, not the factory fee)
5. Logs deployed addresses

**Key design constraint:** The factory MUST satisfy `IOctantFactory.deployNewVault(asset, name, symbol, roleManager, profitMaxUnlockTime)`. The deployed vaults MUST satisfy `IOctantVault` (deposit/withdraw/redeem/addStrategy/balanceOf/strategy/totalAssets/asset/totalSupply/convertToAssets/convertToShares/previewDeposit/previewWithdraw/maxDeposit/maxWithdraw).

**Reference:** The upstream factory is at `golemfoundation/octant-v2-core/src/factories/MultistrategyVaultFactory.sol`. It uses `Clones.cloneDeterministic()` with salt = `keccak256(abi.encode(msg.sender, asset, name, symbol))`. The vault implementation constructor sets `asset = address(this)` to prevent re-init, and `initialize()` checks `asset == address(0)`.

**Usage:**
```bash
cd packages/contracts
FOUNDRY_PROFILE=arbitrum forge script script/DeployOctantFactory.s.sol --broadcast --verify
```

After deployment, set `OCTANT_FACTORY_ADDRESS=<factory>` in root `.env`.

---

## Part 2: Update YieldSplitter Default Split

### Change default constants in `YieldSplitter.sol`

**File:** `packages/contracts/src/yield/YieldSplitter.sol` (lines 95-97)

```
Before:                              After:
  COOKIE_JAR = 3334 (33.34%)    →      COOKIE_JAR = 4865 (48.65%)
  FRACTIONS  = 3333 (33.33%)    →      FRACTIONS  = 4865 (48.65%)
  JUICEBOX   = 3333 (33.33%)    →      JUICEBOX   = 270  (2.70%)
                                       Sum: 4865 + 4865 + 270 = 10000 ✓
```

### Update shared package TypeScript defaults

**File:** `packages/shared/src/types/gardens-community.ts` (lines 95-100)

```typescript
/** Default three-way split: 48.65% Cookie Jar, 48.65% Fractions, 2.7% Juicebox */
export const DEFAULT_SPLIT_CONFIG: SplitConfig = {
  cookieJarBps: 4865,
  fractionsBps: 4865,
  juiceboxBps: 270,
};
```

### Update tests (3 test files)

| Test File | What to Update |
|-----------|---------------|
| `test/unit/YieldSplitter.t.sol` | All hardcoded `3334`/`3333` → `4865`/`4865`/`270`. Key lines: 115-117, 152, 176, 198, 221-226, 449-451, 535-540, 610-662, 696-810 |
| `test/integration/YieldToFractions.t.sol` | Split calculation assertions. Lines: 119, 125, 129, 204, 211 |
| `test/fork/ArbitrumYieldSplitter.t.sol` | Split assertions and comments. Lines: 212-228, 272, 387-388, 452-454, 470-472 |

---

## Files Summary

| File | Change |
|------|--------|
| `packages/contracts/script/DeployOctantFactory.s.sol` | **New** — Arbitrum factory deployment script |
| `packages/contracts/src/yield/YieldSplitter.sol` | Update 3 default BPS constants |
| `packages/shared/src/types/gardens-community.ts` | Update TypeScript default split |
| `packages/contracts/test/unit/YieldSplitter.t.sol` | Update test assertions for new defaults |
| `packages/contracts/test/integration/YieldToFractions.t.sol` | Update test assertions |
| `packages/contracts/test/fork/ArbitrumYieldSplitter.t.sol` | Update test assertions |

---

## Verification

```bash
# 1. Build contracts
cd packages/contracts && bun build

# 2. Unit tests (YieldSplitter)
forge test --match-contract YieldSplitterTest -vvv

# 3. Integration tests
forge test --match-contract YieldToFractionsTest -vvv

# 4. Full test suite (skips E2E)
bun run test

# 5. Shared package
cd ../shared && bun run test
```

---

## Post-Deployment Workflow

1. Run `DeployOctantFactory.s.sol` on Arbitrum → get factory address
2. Set `OCTANT_FACTORY_ADDRESS=<factory>` in root `.env`
3. Deploy Green Goods: `bun deploy:testnet` (or `--network arbitrum --broadcast`)
4. `Deploy.s.sol:_configureOctant()` wires factory → OctantModule → GardenToken
5. Future garden mints auto-create ERC-4626 vaults
