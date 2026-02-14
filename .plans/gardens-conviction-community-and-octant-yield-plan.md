# Gardens Conviction Voting Community + Octant Yield Allocation Plan

**GitHub Branch**: `feature/gardens-conviction-voting-nft`
**Status**: Planning
**Dependencies**: `feature/octant-defi-vaults` (OctantModule + vaults)
**Prior Plans**: `.plans/nft-conviction-voting-implementation.md`, `.plans/gardens-nft-conviction-voting-architecture (2).md`
**Target Chain**: Arbitrum One (42161) — testnet: Arbitrum Sepolia (421614)

---

## Decision Log (Locked from Q&A)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Three configurable weight schemes: Linear(1,2,3), Exponential(2,4,16), Power(3,9,81) | Operator choice at mint, covers gradual→steep influence curves |
| 2 | Operator picks weight scheme at garden mint time (immutable) | One NFTPowerRegistry per garden, mirrors Hat tree |
| 3 | Shared protocol GOODS ERC-20 token for RegistryCommunity staking | Auto-deployed once; eliminates per-garden token overhead |
| 4 | Two signal pools per garden: HypercertSignalPool + Garden Focus | Separates hypercert curation from garden governance signaling |
| 5 | Marketplace purchase model for Hypercert fractions | YieldSplitter buys via Hypercerts marketplace |
| 6 | Target chain: Arbitrum (match Octant ERC-4626 vaults) | Single-chain, consistent with OctantModule deployment |
| 7 | Gardens V2 facets already deployed on Arbitrum Sepolia | Use existing RegistryFactory + facet cuts — no redeploy needed |
| 8 | GOODS token minted on deploy (fixed supply to protocol treasury) | Protocol treasury distributes to gardens for staking |
| 9 | Explicit community join required (members call joinCommunity themselves) | No auto-join on hat grant; members must hold GOODS and opt in |
| 10 | Operators only can register hypercerts in signal pools | Tight editorial control; gardeners/community vote only |
| 11 | Eager community creation on garden mint | Higher gas but garden fully functional immediately |
| 12 | Purchased fractions go to garden treasury (Safe) | Simplest model; operators can distribute later via Safe governance |
| 13 | Gardens V2 default CV params (decay=0.9999799, maxRatio=0.2, minThresholdPoints=0.25) | Standard config used by existing 10+ communities on Arb Sepolia |
| 14 | GardensModule airdrops GOODS to initial hat wearers on garden mint | Front-loaded; members receive GOODS as part of mint flow |
| 15 | Pool #2 is Action signaling pool (reads from ActionRegistry) | Members signal priority on registered Actions; conviction determines garden focus |
| 16 | No-hypercerts yield: return to vault (re-compound) | If no hypercerts registered, redeem shares and re-deposit. Yield compounds until targets exist |
| 17 | Action SignalPool is purely informational | Conviction scores on-chain + frontend. No automated triggers. Operators use signals manually |
| 18 | Ship all phases together (0+1+2+3+4) | Complete feature in one implementation. More integration testing but ships full capability |
| 19 | Hybrid yield split: three-way (Cookie Jar + fractions + Juicebox) | Superseded by decision 23. Operator-configurable three-way split. |
| 20 | Split ratio operator-adjustable after mint | Operators can tune the three-way split as priorities shift; default ~33/33/33 |
| 21 | Cookie Jar integration per existing plan (.plans/cookie-jar-integration.md) | CookieJarModule already designed; yield routing adds deposit path from OctantModule |
| 22 | GOODS is a Juicebox v5 treasury-backed token | Payment-minted, redeemable, reserved rate for airdrops. Real economic model. |
| 23 | Three-way yield split: Cookie Jar + Hypercert fractions + Juicebox treasury | Operator-configurable ratios. Juicebox portion grows GOODS treasury backing. |
| 24 | Anyone can pay into Juicebox project (public fundraise) | Open continuous crowdfund. Public pays ETH → receives GOODS. |
| 25 | Juicebox project owned by protocol multisig (Gnosis Safe) | Multi-party control prevents single-point failure. Standard for protocol treasuries. |
| 26 | Bootstrap: seed ETH payment + free mint buffer via JBController.mintTokensOf() | First gardens need GOODS before any payments flow. Seed bootstraps treasury; free mint gives initial staking supply. |
| 27 | $7 minimum yield threshold for splitting | Accumulate across harvests if below $7. Avoids gas-waste on dust amounts. |
| 28 | Cookie Jar accepts ERC-20 (WETH/DAI) not native ETH | Yield assets are already ERC-20 from vault redemption. No unnecessary wrap/unwrap. |

---

## Executive Summary

Two core capabilities are missing from the current integration:

### Core Function 1: Garden Mint → Gardens Community Creation
When a garden NFT is minted in Green Goods, automatically create a full Gardens V2 conviction voting community including:
- A **RegistryCommunity** (Gardens V2 community on Allo Protocol) using the shared GOODS token
- A **HypercertSignalPool** (signal-only conviction pool for curating hypercerts)
- A **Garden Action SignalPool** (NFT/Hats-gated signaling pool where members signal priority on registered Actions)

### Core Function 2: Octant Yield → Three-Way Split
Route yield from OctantModule's YDS vaults through an operator-configurable three-way split:
- **~33% → Cookie Jar** (gardener operational compensation, Hats-gated ERC-20 withdrawals)
- **~33% → Hypercert Fractions** (conviction-weighted purchases via marketplace → garden treasury)
- **~33% → Juicebox Treasury** (grows GOODS token backing via JBMultiTerminal.pay())
- Split ratio adjustable by operator (default ~33/33/33, must sum to 100%)
- $7 minimum yield threshold — accumulates sub-threshold harvests to avoid gas-waste
- Cookie Jar integration per existing `.plans/cookie-jar-integration.md` (CookieJarModule already designed)

---

## Configurable Weight Schemes

The garden operator selects one of three weight schemes at mint time. The choice is immutable (baked into NFTPowerRegistry deployment):

### Scheme 1: Linear (1, 2, 3)
```
Role             Weight (bps)    Effective Points    Ratio
─────────────────────────────────────────────────────────
Community        100             1 point             1x
Gardener         200             2 points            2x
Operator         300             3 points            3x
```
**Use case**: Flat organizations, DAOs where all roles contribute similarly. Operator voice is only 3x community.

### Scheme 2: Exponential (2, 4, 16)
```
Role             Weight (bps)    Effective Points    Ratio
─────────────────────────────────────────────────────────
Community        200             2 points            1x
Gardener         400             4 points            2x
Operator         1600            16 points           8x
```
**Use case**: Moderate hierarchy. Operators have 8x influence vs community — rewards active participation.

### Scheme 3: Power (3, 9, 81)
```
Role             Weight (bps)    Effective Points    Ratio
─────────────────────────────────────────────────────────
Community        300             3 points            1x
Gardener         900             9 points            3x
Operator         8100            81 points           27x
```
**Use case**: Strong hierarchy. Operators have 27x influence — suited for expert-led gardens where operator conviction is dominant.

### Implementation (Solidity enum + config)
```solidity
enum WeightScheme { Linear, Exponential, Power }

// In GardensModule:
function _getWeights(WeightScheme scheme)
    internal pure returns (uint256 community, uint256 gardener, uint256 operator)
{
    if (scheme == WeightScheme.Linear)      return (100, 200, 300);
    if (scheme == WeightScheme.Exponential) return (200, 400, 1600);
    if (scheme == WeightScheme.Power)       return (300, 900, 8100);
}
```

Power formula: `memberPower = Σ (isWearerOfHat(member, hatId) × weight / 100)` — basis points / 100 = effective points.

---

## GOODS Protocol Token (Juicebox v5)

### Purpose
Gardens V2 RegistryCommunity requires an ERC-20 for member staking. Rather than a simple fixed-supply token, GOODS is a **Juicebox v5 treasury-backed token** — minted when people pay into the Green Goods Juicebox project, redeemable for a share of the project's surplus.

### Why Juicebox
- **Treasury-backed**: GOODS has real economic value (backed by ETH in the project treasury)
- **Continuous fundraise**: Anyone can pay ETH → receive GOODS (public crowdfund)
- **Reserved rate**: A % of minted tokens go to protocol splits (gardener airdrops, operator incentives)
- **Cash out**: Token holders can redeem GOODS for surplus ETH
- **Deployed on Arbitrum + Arb Sepolia**: Same chain as our target
- **Yield flywheel**: Octant yield flowing into Juicebox treasury grows GOODS backing over time

### Juicebox v5 Deployment
- Juicebox v5 contracts deployed on: Ethereum, Optimism, **Arbitrum One**, Base, + all Sepolia testnets
- Source: [docs.juicebox.money/dev/v5/addresses](https://docs.juicebox.money/dev/v5/addresses/)

### Design
- **Infrastructure**: Juicebox v5 project on Arbitrum (JBController + JBMultiTerminal)
- **Ownership**: Protocol multisig (Gnosis Safe) — multi-party control over ruleset changes
- **Token**: GOODS ERC-20 claimed from Juicebox credits (standard ERC-20 compatible with Gardens V2)
- **Supply**: Dynamic — grows as people pay into the project
- **Minting**: Anyone pays ETH → receives GOODS at configured weight
- **Reserved Rate**: ~20% of minted tokens go to protocol splits:
  - Garden airdrops (for RegistryCommunity staking)
  - Operator incentive pool
  - Protocol development fund
- **Cash Out Tax Rate**: Configurable — determines how much surplus token holders can redeem
- **Weight Decay**: Optional per-cycle weight decrease (early contributors get more per ETH)
- **Bootstrap**: Seed ETH payment into JB project (establishes treasury) + `JBController.mintTokensOf()` free mint buffer for initial garden staking distribution

### Juicebox Ruleset Configuration (Initial)
```
Ruleset {
    weight: 1000 GOODS/ETH          // 1000 tokens per ETH paid
    weightCutPercent: 0              // No decay initially (can add later)
    reservedPercent: 2000            // 20% reserved for splits
    cashOutTaxRate: 5000             // 50% of surplus redeemable
    payoutLimit: 0                   // No automatic payouts (manual via splits)
    duration: 0                      // No time-limited cycles initially
}

Reserved Splits {
    gardenAirdropPool: 50%           // For GardensModule staking distribution
    operatorIncentives: 30%          // Operator rewards
    protocolDev: 20%                 // Protocol development
}
```

### Staking Flow
- Voting power comes exclusively from NFTPowerRegistry (Hats-based), NOT from GOODS balance
- GOODS staking in RegistryCommunity is for Gardens V2 compatibility
- Staking amount: Minimal (e.g., 1 GOODS per member)

### Mint Flow Integration
```
GardenToken.onMint(garden)
    └── GardensModule.onGardenMinted(garden, weightScheme)
         ├── Transfer GOODS from reserved airdrop pool to hat wearers
         ├── Or: hat wearers claim GOODS from Juicebox project directly
         └── Members stake GOODS to join RegistryCommunity
```

### Yield Flywheel
```
Octant Vaults → Yield → YieldSplitter (three-way):
    ├── Cookie Jar portion → gardener compensation
    ├── Fractions portion → buy hypercert fractions (conviction-weighted)
    └── Juicebox portion → pay into JB project treasury
         └── Mints new GOODS (reserved % → airdrops)
         └── Grows treasury backing for all GOODS holders
         └── Virtuous cycle: more yield → more treasury → GOODS worth more
```

---

## Gardens V2 Deployed Addresses

### Arbitrum Sepolia (Chain ID: 421614) — Primary Testnet
| Contract | Address |
|----------|---------|
| RegistryFactory (Proxy) | `0xf42f88c13804147b2fdda13c093ce14219aea395` |
| CVStrategy (Implementation) | `0xed9a35c3a11d258d0d8267c2e64b69929c7ae530` |
| RegistryCommunity (Implementation) | `0xb0a89a25caace1008f9e904ae31bdaae3607b3ca` |
| CollateralVault (Implementation) | `0x5d5a26a0b5b14ca4c8b116db7d04289bbe52d9e0` |
| Allo Protocol (Proxy) | `0x1133eA7Af70876e64665ecD07C0A0476d09465a1` |
| Allo Registry | `0x4AAcca72145e1dF2aeC137E1f3C5E3D75DB8b5f3` |
| SafeArbitrator | `0x49222C53695C77a0F8b78Eb42606B893E98DfE6a` |
| PassportScorer | `0x6ad70508f44aa0e86e7af80ccc4fc1f160c2df46` |
| ProxyOwner | `0x333837ec0D4F3D9b3dF0216996a148B46ce3541b` |
| SafeProxyFactory | `0xC22834581EbC8527d974F8a1c97E1bEA4EF910BC` |

**Active deployments**: 10 communities, 26 strategies (battle-tested)

### Ethereum Sepolia (Chain ID: 11155111) — Secondary Testnet
| Contract | Address |
|----------|---------|
| RegistryFactory (Proxy) | `0x4177f64568e90fd58884579864923aa0345248f0` |
| CVStrategy (Implementation) | `0xdc627c4b80ca90e43cdb217587a206be52e7e9ac` |
| RegistryCommunity (Implementation) | `0xccbac15eb0d8c241d4b6a74e650de089c292d131` |
| SafeArbitrator | `0xfd2afa3f784b3e9c0b2ed7d139ede8a6ea3279c8` |
| ProxyOwner | `0x54c320947549349a22719076832d546a2d21c6ad` |

**Source**: `/Users/afo/Code/greenpill/gardens/pkg/contracts/config/networks.json`

---

## Current State Analysis

### What Exists (Green Goods)

| Component | Status | Location |
|-----------|--------|----------|
| HatsModule with role management | Done | `packages/contracts/src/modules/Hats.sol` |
| HatsModule conviction sync on revoke | Done | `Hats.sol:_syncConvictionPower()` |
| ICVSyncPowerFacet interface | Done | `packages/contracts/src/interfaces/ICVSyncPowerFacet.sol` |
| ConvictionSync integration tests | Done | `packages/contracts/test/integration/ConvictionSync.t.sol` |
| OctantModule (vault creation, harvest) | Done | On `feature/octant-defi-vaults` branch |
| GardenToken (stores module refs) | Done | `packages/contracts/src/tokens/Garden.sol` |
| Shared conviction hooks (11 hooks) | Done | `packages/shared/src/hooks/conviction/` |
| ConvictionDrawer (client UI) | Done | `packages/client/src/components/Dialogs/ConvictionDrawer.tsx` |
| Admin SignalPool + Strategies views | Done | `packages/admin/src/views/Gardens/Garden/` |
| Conviction types + ABIs | Done | `packages/shared/src/types/conviction.ts` |

### What Exists (Gardens Repo)

| Component | Status | Location |
|-----------|--------|----------|
| CVStrategy Diamond (8 facets) | Done | `pkg/contracts/src/CVStrategy/` |
| RegistryCommunity Diamond (7 facets) | Done | `pkg/contracts/src/RegistryCommunity/` |
| ConvictionsUtils (conviction math) | Done | `pkg/contracts/src/CVStrategy/ConvictionsUtils.sol` |
| CVPowerFacet (Custom PointSystem) | Done | `CVStrategy/facets/CVPowerFacet.sol` |
| CVSyncPowerFacet | Done | `CVStrategy/facets/CVSyncPowerFacet.sol` |
| NFTPowerRegistry | Done | `pkg/contracts/src/registries/NFTPowerRegistry.sol` |
| IVotingPowerRegistry | Done | `pkg/contracts/src/interfaces/IVotingPowerRegistry.sol` |
| HypercertSignalPool | Done | `pkg/contracts/src/HypercertSignalPool/HypercertSignalPool.sol` |
| RegistryFactory | Done | `pkg/contracts/src/RegistryFactory.sol` |
| Deployed on Arbitrum Sepolia | Done | 10 communities, 26 strategies |

### What's Missing

| Gap | Description | Priority |
|-----|-------------|----------|
| **GOODS protocol token** | Shared ERC-20 for RegistryCommunity staking | P0 |
| **Garden Mint → Community** | No RegistryCommunity created when garden minted | P0 |
| **Garden Mint → Signal Pools** | No HypercertSignalPool or Action signaling pool deployed on mint | P0 |
| **Configurable Weight Schemes** | NFTPowerRegistry not configured with selectable weight schemes | P0 |
| **GOODS Airdrop** | No mechanism to distribute staking tokens to hat wearers on mint | P0 |
| **YieldSplitter** | No contract to split yield between Cookie Jar + conviction fraction purchases | P0 |
| **GardensModule** | No module in GardenToken to orchestrate Gardens V2 integration | P0 |
| **Hypercert Marketplace Adapter** | No contract/interface to purchase fractions programmatically | P1 |
| **Indexer: community events** | No event handlers for community/pool creation | P1 |
| **Admin: community management** | No UI for managing the Gardens V2 community | P2 |

---

## Architecture

### Core Function 1: Garden Mint → Community Creation

```
GardenToken.onMint(gardenAddress, weightScheme)
    │
    ├── HatsModule.createGardenHatTree(garden)  ← EXISTING
    ├── OctantModule.onGardenMinted(garden)     ← EXISTING (creates vaults)
    │
    └── GardensModule.onGardenMinted(garden, weightScheme)    ← NEW
         │
         ├── 1. Resolve weight scheme → (community, gardener, operator) weights
         │     └── Linear(100,200,300) | Exponential(200,400,1600) | Power(300,900,8100)
         │
         ├── 2. Deploy NFTPowerRegistry
         │     └── Sources: [
         │          { hatsProtocol, HAT, operatorHat,  weight=operatorW  },
         │          { hatsProtocol, HAT, gardenerHat,  weight=gardenerW  },
         │          { hatsProtocol, HAT, communityHat, weight=communityW }
         │        ]
         │
         ├── 3. Airdrop GOODS to initial hat wearers (operator, gardeners, community)
         │     └── Fixed amount per member (e.g., 10 GOODS) for community staking
         │
         ├── 4. Transfer GOODS staking allocation to new community
         │
         ├── 5. Create RegistryCommunity via RegistryFactory
         │     └── Params: goodsToken, registerStakeAmount=1e18, councilSafe=garden
         │     └── cvParams: Gardens defaults (decay=0.9999799, maxRatio=0.2, minThresholdPoints=0.25)
         │
         ├── 6. Create HypercertSignalPool
         │     └── pointSystem: Custom (reads NFTPowerRegistry)
         │     └── votingPowerRegistry: NFTPowerRegistry from step 2
         │     └── Registration: operators only
         │
         ├── 7. Create Garden Action SignalPool
         │     └── Same CVParams + NFTPowerRegistry
         │     └── Members signal priority on Actions from ActionRegistry
         │     └── Registration: operators register Actions by UID
         │
         ├── 8. Register pools in HatsModule
         │     └── setConvictionStrategies(garden, [hypercertPool, actionPool])
         │
         └── 9. Authorize HatsModule as sync caller
               └── cvStrategy.setAuthorizedSyncCaller(hatsModule, true)
```

### Core Function 2: Octant Yield → Hybrid Split (Cookie Jar + Fractions)

```
Yield Generation:
    Depositors → vault.deposit(WETH/DAI) → Aave V3 → yield accrues

Harvest:
    Operator → OctantModule.harvest(garden, asset)
        → strategy.report()
        → yield shares minted to YieldSplitter (donation address)

Split:
    YieldSplitter.splitYield(garden, asset)  ← Permissionless/Keeper
        │
        ├── 1. Redeem yield shares → underlying ERC-20 (WETH/DAI)
        │
        ├── 2. Minimum threshold check ($7 — decision 27):
        │     ├── If below: accumulate in pendingYield, emit YieldAccumulated, return
        │     └── If above: merge with pendingYield, proceed to split
        │
        ├── 3. Read three-way split ratio for garden (operator-adjustable)
        │     └── default: cookieJarBps=3334, fractionsBps=3333, juiceboxBps=3333
        │
        ├── 4. Cookie Jar portion (~33%):
        │     └── ERC-20 approve + deposit into Cookie Jar (WETH/DAI — decision 28)
        │         └── Gardeners/operators withdraw via Hats-gated rules
        │
        ├── 5. Fractions portion (~33%):
        │     ├── Read conviction weights from HypercertSignalPool
        │     ├── If no hypercerts registered: re-deposit into vault (re-compound)
        │     └── For each hypercert with weight > 0:
        │           └── Purchase fraction via marketplace → garden treasury (Safe)
        │
        ├── 6. Juicebox portion (~33%):
        │     └── Swap to ETH if needed → JBMultiTerminal.pay()
        │         └── Mints new GOODS (reserved % → airdrop pool)
        │         └── Grows treasury backing for all GOODS holders
        │
        └── 7. Emit YieldSplit(garden, asset, cookieJarAmt, fractionsAmt, juiceboxAmt)
            Emit YieldAllocated(garden, asset, distributions[])  // for fraction purchases
```

### Yield Split Configuration
```solidity
// In YieldSplitter:
struct SplitConfig {
    uint256 cookieJarBps;   // e.g., 3334 = ~33%
    uint256 fractionsBps;   // e.g., 3333 = ~33%
    uint256 juiceboxBps;    // e.g., 3333 = ~33%
    // Must sum to 10000
}

mapping(address garden => SplitConfig) public gardenSplitConfig;
uint256 public juiceboxProjectId;  // Green Goods JB project
address public jbMultiTerminal;    // Juicebox payment terminal

function setSplitRatio(
    address garden,
    uint256 _cookieJarBps,
    uint256 _fractionsBps,
    uint256 _juiceboxBps
) external onlyGardenOperator {
    require(_cookieJarBps + _fractionsBps + _juiceboxBps == 10000, "Must sum to 10000");
    gardenSplitConfig[garden] = SplitConfig(_cookieJarBps, _fractionsBps, _juiceboxBps);
    emit SplitRatioUpdated(garden, _cookieJarBps, _fractionsBps, _juiceboxBps);
}
```

---

## Requirements Coverage

| # | Requirement | Planned Step | Status |
|---|-------------|--------------|--------|
| 1 | Deploy GOODS protocol token | Phase 0 | ⏳ |
| 2 | On garden mint, create Gardens V2 community | Phase 1, Step 1-2 | ⏳ |
| 3 | Deploy NFTPowerRegistry with configurable weight scheme | Phase 1, Step 3 | ⏳ |
| 4 | Create HypercertSignalPool on mint | Phase 1, Step 4 | ⏳ |
| 5 | Create Garden Action SignalPool (reads ActionRegistry) | Phase 1, Step 5 | ⏳ |
| 6 | Operator selects weight scheme at mint (immutable) | Phase 1, Step 3 | ⏳ |
| 7 | NFT/Hats gating for pool access | Phase 1, Step 3-5 | ⏳ |
| 8 | Register pools in HatsModule for sync | Phase 1, Step 6 | ⏳ |
| 9 | YieldSplitter reads conviction weights | Phase 2, Step 1-2 | ⏳ |
| 10 | Purchase Hypercert fractions with yield via marketplace | Phase 2, Step 3-4 | ⏳ |
| 11 | Integrate with OctantModule as donation address | Phase 2, Step 5 | ⏳ |
| 12 | Indexer: track community/pool creation events | Phase 3, Step 1 | ⏳ |
| 13 | Admin UI: community management + weight scheme display | Phase 4, Step 1 | ⏳ |
| 14 | JB project owned by protocol multisig (Gnosis Safe) | Phase 0, Step 2 | ⏳ |
| 15 | Bootstrap: seed payment + free mint buffer | Phase 0, Step 2 | ⏳ |
| 16 | $7 minimum yield threshold with accumulation | Phase 2, Step 2 | ⏳ |
| 17 | Cookie Jar accepts ERC-20 (WETH/DAI) | Phase 2, Step 2 | ⏳ |

---

## CLAUDE.md Compliance

- [x] Hooks in shared package
- [x] Deployment artifacts for addresses (use deployment JSON, never hardcode)
- [x] Tests parallel to source
- [x] Use `Address` type from shared
- [x] No console.log in production code
- [x] Error handling: module failures MUST NOT revert garden mint
- [x] Use deploy.ts, never direct forge script

---

## Impact Analysis

### Files to Create

| File | Description | Package |
|------|-------------|---------|
| `src/interfaces/IJuicebox.sol` | Interfaces for JBController, JBMultiTerminal, JBTokens | contracts |
| `script/DeployGoodsProject.s.sol` | Deploy/configure Juicebox v5 project for GOODS token | contracts |
| `src/modules/Gardens.sol` | GardensModule - orchestrates community/pool creation on mint | contracts |
| `src/interfaces/IGardensModule.sol` | Interface for GardensModule (includes WeightScheme enum) | contracts |
| `src/interfaces/IRegistryFactory.sol` | Interface for Gardens RegistryFactory | contracts |
| `src/interfaces/IRegistryCommunity.sol` | Interface for Gardens RegistryCommunity (pool creation) | contracts |
| `src/interfaces/INFTPowerRegistry.sol` | Interface for Gardens NFTPowerRegistry | contracts |
| `src/yield/YieldSplitter.sol` | Splits yield: Cookie Jar (50%) + conviction fraction purchases (50%) | contracts |
| `src/yield/IHypercertMarketplace.sol` | Interface for purchasing Hypercert fractions | contracts |
| `src/mocks/MockRegistryFactory.sol` | Mock for testing community creation | contracts |
| `src/mocks/MockRegistryCommunity.sol` | Mock for testing pool creation | contracts |
| `src/mocks/MockHypercertMarketplace.sol` | Mock for testing fraction purchases | contracts |
| `test/unit/GoodsProject.t.sol` | Unit tests for Juicebox project + GOODS ERC-20 | contracts |
| `test/unit/GardensModule.t.sol` | Unit tests for GardensModule + weight schemes | contracts |
| `test/unit/YieldSplitter.t.sol` | Unit tests for yield split + fraction allocation | contracts |
| `test/integration/GardenMintCommunity.t.sol` | Integration: mint → community → pools | contracts |
| `test/integration/YieldToFractions.t.sol` | Integration: harvest → conviction → fractions | contracts |
| `src/hooks/conviction/useGardenCommunity.ts` | Query garden's RegistryCommunity | shared |
| `src/hooks/conviction/useGardenPools.ts` | Query garden's signal pools (hypercert + action) | shared |
| `src/hooks/yield/useAllocateYield.ts` | Trigger yield allocation mutation | shared |
| `src/hooks/yield/useYieldAllocations.ts` | Query yield allocation history | shared |
| `src/types/gardens-community.ts` | Types for community/pool data (WeightScheme, PoolType) | shared |

### Files to Modify

| File | Change |
|------|--------|
| `packages/contracts/src/tokens/Garden.sol` | Add `gardensModule` reference, pass `weightScheme` in mint flow |
| `packages/contracts/src/modules/Hats.sol` | Auto-register pools from GardensModule output |
| `packages/contracts/script/Deploy.s.sol` | Add GoodsToken + GardensModule + YieldSplitter deployment |
| `packages/contracts/script/deploy.ts` | Add deployment config for new contracts |
| `packages/shared/src/utils/blockchain/abis.ts` | Add GOODS_TOKEN_ABI, GARDENS_MODULE_ABI, YIELD_SPLITTER_ABI |
| `packages/shared/src/hooks/query-keys.ts` | Add community + yield allocation query keys |
| `packages/shared/src/types/conviction.ts` | Add WeightScheme enum, community/pool creation types |
| `packages/shared/src/i18n/en.json` | Add community/yield/weight-scheme i18n keys |
| `packages/shared/src/i18n/es.json` | Add community/yield/weight-scheme i18n keys |
| `packages/shared/src/i18n/pt.json` | Add community/yield/weight-scheme i18n keys |
| `packages/indexer/schema.graphql` | Add GardenCommunity, SignalPool, YieldAllocation entities |
| `packages/indexer/config.yaml` | Add GardensModule event source |
| `packages/indexer/src/EventHandlers.ts` | Add community/pool creation handlers |
| `packages/admin/src/views/Gardens/Garden/Detail.tsx` | Add community status + weight scheme display |

---

## Implementation Steps

### Phase 0: GOODS Token via Juicebox v5

#### Step 1: Juicebox Integration Interface
**Files**: `packages/contracts/src/interfaces/IJuicebox.sol` (NEW)
**Details**:
- Minimal interfaces for Juicebox v5 interaction:
  ```solidity
  interface IJBController {
      function launchProjectFor(address owner, ...) external returns (uint256 projectId);
      function mintTokensOf(uint256 projectId, uint256 amount, address beneficiary, ...) external;
  }
  interface IJBMultiTerminal {
      function pay(uint256 projectId, address token, uint256 amount, ...) external returns (uint256);
  }
  interface IJBTokens {
      function tokenOf(uint256 projectId) external view returns (address);
      function claimTokensFor(address holder, uint256 projectId, uint256 count, address beneficiary) external;
  }
  ```

#### Step 2: GoodsProject Setup Script
**Files**: `packages/contracts/script/DeployGoodsProject.s.sol` (NEW)
**Details**:
- Deploy/configure Green Goods Juicebox v5 project on Arbitrum Sepolia
- **Owner**: Protocol multisig (Gnosis Safe) — decision 25
- Set initial ruleset: weight=1000/ETH, reservedPercent=20%, cashOutTaxRate=50%
- Configure reserved splits: 50% airdrop pool, 30% operator incentives, 20% protocol dev
- Deploy GOODS ERC-20 via JBTokens
- **Bootstrap** (decision 26):
  - Seed ETH payment into project (establishes treasury backing)
  - `JBController.mintTokensOf()` free mint buffer for initial garden staking distribution
- Store project ID and GOODS token address in deployment artifacts

#### Step 3: GoodsProject Integration Tests
**Files**: `packages/contracts/test/unit/GoodsProject.t.sol` (NEW)
**Details**:
- Verify JB project creation
- Verify payment → GOODS minting at correct weight
- Verify reserved rate distributes to splits
- Verify GOODS ERC-20 is standard-compliant (transferable, approvable)
- Verify GOODS works with Gardens V2 RegistryCommunity staking

---

### Phase 1: Garden Mint → Community Creation (Contracts)

#### Step 1: GardensModule Interface
**Files**: `packages/contracts/src/interfaces/IGardensModule.sol` (NEW)
**Details**:
- Define `WeightScheme` enum: `{ Linear, Exponential, Power }`
- `onGardenMinted(address garden, WeightScheme scheme) external returns (address community, address[] pools)`
- `getGardenCommunity(address garden) external view returns (address)`
- `getGardenSignalPools(address garden) external view returns (address[])`
- `getGardenWeightScheme(address garden) external view returns (WeightScheme)`
- Events: `CommunityCreated(garden, community, weightScheme)`, `SignalPoolCreated(garden, pool, poolType)`

#### Step 2: External Protocol Interfaces
**Files**: `packages/contracts/src/interfaces/IRegistryFactory.sol`, `IRegistryCommunity.sol`, `INFTPowerRegistry.sol` (NEW)
**Details**:
- Minimal interfaces matching Gardens V2 contracts (Arbitrum Sepolia deployment)
- `IRegistryFactory.createRegistryCommunity(params, strategyTemplate, vaultTemplate)`
- `IRegistryCommunity.createPool(token, params, metadata) returns (poolId, strategy)`
- `INFTPowerRegistry` constructor params for NFTPowerSource configuration

#### Step 3: GardensModule Contract
**Files**: `packages/contracts/src/modules/Gardens.sol` (NEW)
**Details**:
- UUPS upgradeable, Hats-gated (owner/operator only for admin functions)
- Storage:
  ```solidity
  mapping(address garden => address community) public gardenCommunities;
  mapping(address garden => address[]) public gardenSignalPools;
  mapping(address garden => WeightScheme) public gardenWeightSchemes;
  mapping(address garden => address) public gardenPowerRegistries;
  address public registryFactory;       // Gardens V2 RegistryFactory on Arb Sepolia
  address public goodsToken;            // GOODS protocol token
  address public hatsProtocol;          // Hats Protocol address
  address public hatsModule;            // Green Goods HatsModule
  CVParams public defaultCVParams;      // Default conviction parameters
  uint256 public goodsStakePerGarden;   // GOODS allocated per community (e.g., 100e18)
  ```
- `onGardenMinted(address garden, WeightScheme scheme)`:
  1. Get hat IDs from HatsModule (operator, gardener, community hats)
  2. Resolve weights: `_getWeights(scheme)` → (communityW, gardenerW, operatorW)
  3. Deploy NFTPowerRegistry with 3 power sources at resolved weights
  4. Transfer GOODS staking allocation to new community
  5. Create RegistryCommunity via RegistryFactory
  6. Create HypercertSignalPool (Custom PointSystem, NFTPowerRegistry)
  7. Create Garden Focus SignalPool (same config)
  8. Store references + weight scheme in mappings
  9. Register pools in HatsModule: `setConvictionStrategies(garden, pools)`
  10. Authorize HatsModule as sync caller on each pool
  11. Emit events
- All calls wrapped in try/catch — module failure MUST NOT revert garden mint

#### Step 4: GardenToken Integration
**Files**: `packages/contracts/src/tokens/Garden.sol` (MODIFY)
**Details**:
- Add `address public gardensModule;`
- Add `setGardensModule(address _module)` setter (owner only)
- Modify mint to accept `WeightScheme` parameter:
  ```solidity
  if (gardensModule != address(0)) {
      try IGardensModule(gardensModule).onGardenMinted(garden, weightScheme) {} catch {}
  }
  ```

#### Step 5: Cross-Module Wiring
**Files**: `packages/contracts/src/modules/Gardens.sol` + `Hats.sol` (MODIFY)
**Details**:
- After GardensModule creates pools, auto-register them in HatsModule:
  ```solidity
  IHatsModule(hatsModule).setConvictionStrategies(garden, pools);
  ```
- Authorize HatsModule as sync caller on each pool
- This ensures role revocation triggers conviction sync

#### Step 6: Mocks + Unit Tests
**Files**: `packages/contracts/src/mocks/Mock*.sol`, `packages/contracts/test/unit/GardensModule.t.sol` (NEW)
**Details**:
- MockRegistryFactory: returns predictable community address
- MockRegistryCommunity: tracks createPool calls
- Test cases:
  - onGardenMinted creates community + 2 pools for each weight scheme
  - Linear weights: verify (100, 200, 300)
  - Exponential weights: verify (200, 400, 1600)
  - Power weights: verify (300, 900, 8100)
  - Pool creation with Custom PointSystem
  - GOODS token transfer to community
  - Module failure doesn't revert mint
  - getGardenCommunity/getGardenSignalPools return correct data
  - getGardenWeightScheme returns stored scheme
  - Duplicate mint (idempotent or revert)

#### Step 7: Integration Tests
**Files**: `packages/contracts/test/integration/GardenMintCommunity.t.sol` (NEW)
**Details**:
- Full flow: deploy protocol → mint garden → verify community exists
- Test each weight scheme creates correct NFTPowerRegistry configuration
- Verify HypercertSignalPool accepts allocations from hat wearers
- Verify non-hat-wearers cannot allocate
- Verify HatsModule conviction strategies auto-registered
- Verify role revocation triggers sync on both pools

---

### Phase 2: Octant Yield → Conviction-Based Fraction Purchasing (Contracts)

#### Step 1: Hypercert Marketplace Interface
**Files**: `packages/contracts/src/yield/IHypercertMarketplace.sol` (NEW)
**Details**:
- Minimal interface for purchasing fractions:
  ```solidity
  interface IHypercertMarketplace {
      function buyFraction(uint256 hypercertId, uint256 amount, address asset)
          external returns (uint256 fractionId);
  }
  ```
- Alternatively, direct ERC-1155 claim interface if using Hypercerts allow-list pattern

#### Step 2: YieldSplitter Contract
**Files**: `packages/contracts/src/yield/YieldSplitter.sol` (NEW)
**Details**:
- Receives ERC-4626 shares as donation address from OctantModule
- Splits yield between Cookie Jar and conviction-based fraction purchases
- Storage:
  ```solidity
  mapping(address garden => address signalPool) public gardenSignalPools;
  mapping(address garden => address cookieJar) public gardenCookieJars;
  mapping(address garden => address gardenTreasury) public gardenTreasuries;
  mapping(address garden => SplitConfig) public gardenSplitConfig;
  mapping(address garden => mapping(address asset => address vault)) public gardenVaults;
  address public hypercertMarketplace;
  address public cookieJarModule;         // To resolve jar address per garden
  address public jbMultiTerminal;         // Juicebox v5 payment terminal
  uint256 public juiceboxProjectId;       // Green Goods JB project ID
  uint256 public minAllocationAmount;     // dust threshold for fraction purchases
  uint256 public minYieldThreshold;       // $7 minimum — accumulate if below (decision 27)
  mapping(address garden => mapping(address asset => uint256)) public pendingYield; // accumulated sub-threshold yield
  ```
- `setSplitRatio(garden, cookieJarBps, fractionsBps, juiceboxBps)` — operator-adjustable, must sum to 10000
- `splitYield(address garden, address asset)`:
  1. Get vault for garden+asset from OctantModule
  2. Check balance of vault shares held by this contract
  3. Redeem all shares for underlying asset (WETH/DAI)
  4. **Minimum threshold check** ($7 equivalent):
     - If redeemed amount + pendingYield[garden][asset] < minYieldThreshold:
       - Accumulate into pendingYield[garden][asset], emit `YieldAccumulated`, return
     - Else: totalYield = redeemed + pendingYield, clear pendingYield
  5. Read three-way split ratio (default ~33/33/33):
  6. **Cookie Jar portion** (cookieJarBps / 10000):
     - Resolve jar address from CookieJarModule
     - ERC-20 approve + deposit into Cookie Jar (WETH/DAI — decision 28)
     - Emit `YieldToCookieJar(garden, asset, amount, jar)`
  7. **Fractions portion** (fractionsBps / 10000):
     - Read conviction weights from HypercertSignalPool
     - **If no hypercerts registered**: re-deposit back into vault (re-compound)
     - For each hypercert with weight > 0:
       - `allocation = (weight × portionYield) / totalWeight`
       - Skip if allocation < minAllocationAmount
       - Purchase fraction via marketplace → fraction to garden treasury (Safe)
  8. **Juicebox portion** (juiceboxBps / 10000):
     - Swap to ETH if needed (WETH unwrap or DEX swap for DAI)
     - Pay into Green Goods JB project via `JBMultiTerminal.pay()`
     - Mints GOODS (reserved % → airdrop pool)
  9. Emit `YieldSplit(garden, asset, cookieJarAmt, fractionsAmt, juiceboxAmt)`
     Emit `YieldAllocated(garden, asset, distributions[])` for fractions
- Permissionless `splitYield()` — anyone can trigger (or automate via keeper)
- `setSplitRatio(garden, cookieJarBps)` — operator only, 0-10000
- Access control for admin functions (setMarketplace, setMinAllocation)

#### Step 3: OctantModule Integration
**Files**: `packages/contracts/src/modules/Octant.sol` (MODIFY)
**Details**:
- On garden creation, set YieldSplitter as donation address:
  ```solidity
  setDonationAddress(garden, address(yieldSplitter));
  ```
- YieldSplitter resolves Cookie Jar address from CookieJarModule per garden

#### Step 4: Mock Marketplace + Tests
**Files**: Mocks + test files (NEW)
**Details**:
- MockHypercertMarketplace: tracks purchases, returns predictable fraction IDs
- Unit tests:
  - **Split logic**: 33/33/33 default correctly divides yield three ways
  - **Split ratio**: setSplitRatio(5000, 3000, 2000) → 50% jar, 30% fractions, 20% JB
  - **Edge cases**: 0% to jar (all fractions+JB), 100% to jar (no fractions/JB)
  - **Cookie Jar deposit**: verify ERC-20 approve + deposit (WETH/DAI — decision 28)
  - **Juicebox portion**: verify JBMultiTerminal.pay() called with correct project ID
  - **Fraction allocation**: 3 hypercerts at different conviction weights → proportional
  - Verify dust threshold skips small allocations
  - Verify zero-conviction hypercerts get nothing
  - **No hypercerts**: fractions portion re-deposited into vault (re-compound)
  - Verify fractions sent to garden treasury (Safe)
  - **Operator auth**: only operator can change split ratio
  - **Minimum threshold** ($7 — decision 27):
    - Yield below $7 → accumulated in pendingYield, no split triggered
    - Next harvest pushes past $7 → pending merged, full split executes
    - Threshold check uses Chainlink price feed or configured USD value
- Integration tests:
  - Full flow: deposit → harvest → split → verify jar deposit + fractions purchased
  - Multi-asset: WETH + DAI yield split independently
  - No-hypercerts flow: deposit → harvest → split → jar gets 50%, rest re-compounded
  - Cookie Jar withdrawal after yield split: verify gardener can withdraw from jar

#### Step 5: Deployment Integration
**Files**: Deploy scripts (MODIFY)
**Details**:
- Deploy YieldSplitter in deploy.ts
- Set as donation address for garden vaults
- Wire to GardensModule for pool address lookup

---

### Phase 3: Indexer + Shared Package

#### Step 1: Indexer Schema + Handlers
**Files**: `packages/indexer/schema.graphql`, `config.yaml`, `EventHandlers.ts` (MODIFY)
**Details**:
- New entities: `GardenCommunity`, `GardenSignalPool`, `YieldAllocation`
- `GardenCommunity` includes `weightScheme` field (Linear/Exponential/Power)
- Event handlers for: `CommunityCreated`, `SignalPoolCreated`, `YieldAllocated`

#### Step 2: Shared Types + Hooks
**Files**: `packages/shared/src/types/`, `packages/shared/src/hooks/` (NEW + MODIFY)
**Details**:
- Types: `GardenCommunity`, `GardenSignalPool`, `YieldAllocation`, `WeightScheme`
- Hooks:
  - `useGardenCommunity(gardenAddress)` — query community data + weight scheme
  - `useGardenPools(gardenAddress)` — query signal pools
  - `useAllocateYield(gardenAddress, asset)` — mutation to trigger allocation
  - `useYieldAllocations(gardenAddress)` — query allocation history
- Query keys + invalidation helpers

#### Step 3: i18n
**Files**: `packages/shared/src/i18n/*.json` (MODIFY)
**Details**:
- Add keys for community creation, pool status, yield allocation UI
- Add weight scheme labels: "Linear (1-2-3)", "Exponential (2-4-16)", "Power (3-9-81)"

---

### Phase 4: Frontend Integration

#### Step 1: Admin Dashboard
**Files**: `packages/admin/src/views/Gardens/Garden/` (MODIFY + NEW)
**Details**:
- Community status section in garden detail
- Display selected weight scheme with visual explanation
- Pool management (register/deregister hypercerts)
- Yield allocation history
- Trigger manual yield allocation

#### Step 2: Client UI Updates
**Files**: `packages/client/src/` (MODIFY)
**Details**:
- Update ConvictionDrawer to show community status
- Add weight scheme indicator (shows user their role's voting power)
- Add yield allocation visibility (which hypercerts received funding)
- Show user's voting power based on their Hats role + weight scheme

---

## Deployment Sequence

### Arbitrum Sepolia (Primary Testnet)

> Gardens V2 already deployed: RegistryFactory at `0xf42f88c1...`, 10 communities, 26 strategies

1. **Phase 0**: Create Juicebox v5 project → GOODS ERC-20 deployed, treasury established
2. **Phase 1**: Deploy GardensModule (UUPS proxy) → configure with:
   - RegistryFactory: `0xf42f88c13804147b2fdda13c093ce14219aea395`
   - GOODS token address (from JBTokens)
   - Default CV params
   - Juicebox project ID for reserved-rate airdrop distribution
3. Deploy fresh GardenToken → wire all modules (Hats, Octant, Gardens)
4. Mint test garden with each weight scheme → verify community + pools created
5. **Phase 2**: Deploy YieldSplitter
6. Deploy MockHypercertMarketplace (testnet only)
7. Wire YieldSplitter to OctantModule as donation address
8. Full E2E: deposit → harvest → allocate → verify fractions

### Arbitrum One (Mainnet)

1. Verify Gardens V2 contracts deployed on Arbitrum One (or coordinate with 1Hive)
2. Create Juicebox v5 project on Arbitrum One → GOODS token live
3. Deploy GardensModule + YieldSplitter
4. Wire to real Hypercert marketplace
5. Deploy GardenToken with all modules
6. Smoke test with real assets

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Gardens V2 not on Arbitrum mainnet | High | Coordinate with 1Hive; fallback to Optimism where Gardens is active |
| GardensModule mint callback gas limit | Medium | Pre-compute addresses, minimize on-chain work, batch with multicall |
| NFTPowerRegistry immutability after deploy | Low | One registry per garden — correct by design |
| Hypercert marketplace not available on Arbitrum | High | Build adapter for direct ERC-1155 minting/claiming |
| YieldSplitter sandwich attacks | Medium | Use private mempool or slippage protection |
| Storage layout collision (GardenToken upgrade) | Low | Fresh deploy on all networks, no migration needed |
| Community creation gas cost in mint | Medium | Estimate gas, consider lazy community creation pattern |
| Cross-module reentrancy | Medium | NonReentrant guards on all external calls |
| GOODS token distribution bottleneck | Low | Pre-fund GardensModule with large GOODS allocation |

---

## Out of Scope

- Delegation within conviction voting (removed from Phase 1)
- Removing ERC-20 staking requirement from Gardens V2
- Cross-chain conviction aggregation (CCIP)
- Automated keeper for yield allocation (manual/operator-triggered for now)
- Secondary market for Hypercert fractions
- Multi-strategy per vault rebalancing
- Custom per-garden weight schemes beyond the 3 presets

---

## Validation

```bash
# Contracts
cd packages/contracts
forge test --match-path "test/unit/GoodsProject.t.sol"
forge test --match-path "test/unit/GardensModule.t.sol"
forge test --match-path "test/unit/YieldSplitter.t.sol"
forge test --match-path "test/integration/GardenMintCommunity.t.sol"
forge test --match-path "test/integration/YieldToFractions.t.sol"
forge build --sizes  # Verify < 24KB

# Full validation
bun format && bun lint && bun run test && bun build
```

## Key Principles

- **Module failure MUST NOT revert garden mint** — all module calls wrapped in try/catch
- **Permissionless yield allocation** — anyone can trigger, not just operators
- **One NFTPowerRegistry per garden** — immutable after deployment, mirrors Hat tree
- **Weight scheme immutable** — operator chooses at mint, cannot change after
- **Conviction is lazy** — conviction math runs on-chain via ConvictionsUtils.sol, no off-chain computation needed
- **Proportional allocation** — yield distributed strictly proportional to normalized conviction weights
- **GOODS is a Juicebox treasury-backed token** — has real economic value, but voting power comes from Hats/NFTPowerRegistry, not GOODS balance
- **Yield flywheel** — Juicebox portion of yield grows GOODS treasury backing, creating a virtuous economic cycle
- **$7 minimum yield threshold** — accumulate sub-threshold harvests to avoid gas-waste on dust amounts
- **Cookie Jar accepts ERC-20** — WETH/DAI deposited directly, no unnecessary ETH wrap/unwrap
- **Protocol multisig owns JB project** — ruleset changes require multi-party approval via Gnosis Safe
