# Cookie Jar Integration into Green Goods Protocol

**Status**: Planning
**Branch**: `feature/cookie-jar-integration` (to be created)
**Depends On**: Octant vault integration (in progress on `feature/octant-defi-vaults`)

---

## Executive Summary

Integrate the Cookie Jar protocol into Green Goods so that **every garden gets a Cookie Jar at creation time**, enabling garden operators to fund a shared pot that gardeners can claim from. The jar is NFT-gated by the garden's **Hats Protocol gardener hat (ERC-1155)**, meaning only verified garden members can withdraw.

### Core Value Proposition

Gardens already have:
- **Vaults** (Octant) — Long-term yield-generating treasury
- **Work approvals** — On-chain verification of conservation work

Cookie Jar adds:
- **Petty cash** — Quick, small disbursements for supplies, travel, immediate needs
- **NFT-gated access** — Only verified gardeners can withdraw
- **Configurable rules** — Cooldowns, fixed amounts, purpose tracking

This creates a complete financial toolkit: vaults for savings, cookie jars for spending.

---

## Architecture Decision: Integration Strategy

### Option A: CookieJarModule (On-Chain Module) — **RECOMMENDED**

**Pattern**: Mirror the OctantModule approach. A new `CookieJarModule.sol` in Green Goods that:
1. Gets called during `_initializeGardenModules()` at garden mint
2. Calls the **existing Cookie Jar Factory** to deploy a jar for the garden
3. Stores the mapping `garden → jarAddress`
4. Provides admin operations (configure, pause)

**Why this approach**:
- Follows the established module callback pattern (Hats, Karma, Octant)
- Cookie Jar Factory already handles jar deployment — no need to reinvent
- Hats Protocol gardener hat (ERC-1155) provides per-garden access gating
- CookieJarModule is a thin registry, not a proxy — users interact with jars directly
- Graceful degradation — gardens work without jars if module isn't set

### Option B: Direct Factory Call from Frontend (Rejected)

Would require the frontend to make a separate transaction after garden creation. Breaks the "garden mint = everything initialized" pattern. Race conditions, UX complexity.

### Option C: Fork Cookie Jar into Green Goods Contracts (Rejected)

Duplicates code, loses upstream improvements, bloats contract size. The Cookie Jar protocol is a separate project and should remain composable.

---

## Architecture Diagram

```
Garden Creation Flow (Extended)
═══════════════════════════════

Admin calls GardenToken.mintGarden(config)
  │
  ├─1─► HatsModule.createGardenHatTree()     ← Roles
  ├─2─► KarmaGAPModule.createProject()       ← Attestations
  ├─3─► OctantModule.onGardenMinted()        ← Yield vaults
  ├─4─► CookieJarModule.onGardenMinted()     ← Cookie jar (NEW)
  │         │
  │         ├── Fetch gardenerHatId from HatsModule.getGardenHats()
  │         │
  │         ├── Call CookieJarFactory.createCookieJar()
  │         │     ├── accessType: ERC1155 (Hats Protocol)
  │         │     ├── nftRequirement.nftContract: Hats Protocol address
  │         │     ├── nftRequirement.tokenId: gardenerHatId
  │         │     ├── nftRequirement.minBalance: 1
  │         │     ├── jarOwner: gardenAccount (TBA)
  │         │     └── supportedCurrency: ETH
  │         │
  │         └── Store: gardenJars[garden] = jarAddress
  │
  └─5─► GardenAccount.initialize(metadata)   ← Metadata


Garden Financial Architecture
═════════════════════════════

┌─────────────────────────────────────────────────┐
│                   Garden TBA                     │
│              (GardenAccount.sol)                  │
│                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────┐│
│  │ Octant Vault │  │ Octant Vault │  │Cookie Jar││
│  │   (WETH)     │  │   (DAI)      │  │  (ETH)   ││
│  │              │  │              │  │          ││
│  │ Long-term    │  │ Long-term    │  │ Petty    ││
│  │ yield →      │  │ yield →      │  │ cash for ││
│  │ donation     │  │ donation     │  │ gardeners││
│  └──────────────┘  └──────────────┘  └──────────┘│
│                                                   │
│  Access: Operators deposit    Access: Hats ERC-1155│
│  Yield: Auto-donated          (gardener hat gated) │
│                                Withdraw: Gardeners,│
│                                Operators, Owners   │
│                                (all wear gardener  │
│                                hat via auto-grant)  │
└───────────────────────────────────────────────────┘
```

---

## NFT Gating Strategy: Hats Protocol (ERC-1155)

### How It Works

Hats Protocol tokens are ERC-1155. Each garden's gardener hat is a unique token ID. Cookie Jar's `AccessType.ERC1155` gates on this hat:

```solidity
AccessConfig({
    allowlist: new address[](0),
    nftRequirement: NftRequirement({
        nftContract: address(hatsProtocol),  // Hats Protocol v2 contract
        tokenId: gardenerHatId,               // This garden's gardener hat ID
        minBalance: 1                         // Must be wearing the hat
    })
})
```

Cookie Jar calls `IERC1155(hatsProtocol).balanceOf(msg.sender, gardenerHatId)` and requires `bal >= 1`.

### Why Gardener Hat Gating Covers All Core Roles

Green Goods' `HatsModule._grantRole()` implements **auto-grant cascading** — when higher roles are granted, the gardener hat is **explicitly minted** to the account:

| Role Granted | Hats Actually Minted | Cookie Jar Access? |
|-------------|---------------------|-------------------|
| **Gardener** | gardener | Yes — directly wears gardener hat |
| **Evaluator** | evaluator | No — not auto-granted gardener hat |
| **Operator** | operator + evaluator + **gardener** | Yes — gardener hat auto-minted |
| **Owner** | owner + operator + evaluator + **gardener** | Yes — cascades through operator |

**Important**: This is NOT Hats Protocol's tree hierarchy doing implicit checks. It's Green Goods' `_grantSubRole()` in `HatsModule.sol` (line 504-505) explicitly minting the gardener hat when granting Operator or Owner roles.

### Roles WITHOUT Cookie Jar Access

| Role | Has Gardener Hat? | Cookie Jar Access? | Rationale |
|------|-------------------|-------------------|-----------|
| **Evaluator** (standalone) | No | No | Evaluators review work but don't need petty cash |
| **Funder** | No | No | Funders deposit to vaults, not withdraw from jars |
| **Community** | No | No | Token-gated community members aren't active gardeners |

**Design decision**: Only roles that participate in on-the-ground conservation work (gardeners, operators, owners) should access the cookie jar. Evaluators granted standalone (without operator role) are excluded — this is intentional since standalone evaluators are reviewers, not field workers.

### Rejected Alternative: GardenToken (ERC-721) Gating

GardenToken is an ERC-721 where each token ID = one garden. The garden **creator** holds the NFT, not each gardener. `balanceOf(gardener)` would check if they own *any* garden token, not membership in *this* garden. This approach was rejected because it cannot distinguish per-garden membership.

### Fallback: Allowlist Mode

If a garden doesn't have Hats configured (e.g., `gardenHats[garden].configured == false`), fall back to `AccessType.Allowlist` with garden operators manually managing access.

### Future: Dual Gating (Phase 2)

For gardens that want both Hats-based gating AND community token gating:
- Cookie Jar's ERC1155 check handles Hats
- Could add a second jar per garden with ERC20 token balance gating

---

## Smart Contract Changes

### New: CookieJarModule.sol

```
Location: packages/contracts/src/modules/CookieJar.sol
Pattern: Mirrors OctantModule.sol structure
Upgradeability: UUPS (consistent with other modules)
```

**Storage**:
```solidity
// External dependencies
ICookieJarFactory public cookieJarFactory;  // Cookie Jar factory contract
address public gardenToken;                  // Back-reference to GardenToken
address public hatsProtocol;                 // Hats Protocol ERC-1155 contract

// Per-garden state
mapping(address garden => address jar) public gardenJars;

// Default configuration
address public defaultCurrency;              // ETH_ADDRESS or ERC20
uint256 public defaultFixedAmount;           // Default withdrawal amount
uint256 public defaultWithdrawalInterval;    // Default cooldown (e.g., 86400 = 24h)
bool public defaultStrictPurpose;            // Require purpose string
```

**Key Functions**:
```solidity
// Called by GardenToken._initializeGardenModules()
function onGardenMinted(address garden, string calldata gardenName)
    external returns (address jar);

// Admin: update jar configuration
function setDefaultCurrency(address currency) external onlyOwner;
function setDefaultFixedAmount(uint256 amount) external onlyOwner;

// Garden operator: manage jar
function pauseJar(address garden) external onlyGardenOperatorOrOwner;
function unpauseJar(address garden) external onlyGardenOperatorOrOwner;

// Read: get jar for a garden
function getJar(address garden) external view returns (address);
```

**`onGardenMinted` Implementation**:
```solidity
function onGardenMinted(address garden, string calldata gardenName)
    external
    nonReentrant
    returns (address jar)
{
    if (msg.sender != gardenToken) revert UnauthorizedCaller(msg.sender);
    if (gardenJars[garden] != address(0)) revert JarAlreadyExists(garden);
    if (address(cookieJarFactory) == address(0)) revert FactoryNotConfigured();

    // Get gardener hat ID from Hats module for ERC-1155 withdrawal gating.
    // The gardener hat covers all core roles because HatsModule._grantRole()
    // auto-mints the gardener hat when granting Operator or Owner roles.
    // So balanceOf(user, gardenerHatId) == 1 for: gardeners, operators, owners.
    // Standalone evaluators, funders, and community members are excluded by design.
    IHatsModule hatsModule = IGardenToken(gardenToken).hatsModule();
    IHatsModule.GardenHats memory hats = hatsModule.getGardenHats(garden);
    uint256 gardenerHatId = hats.gardenerHatId;
    if (gardenerHatId == 0) revert HatsNotConfigured(garden);

    // Build jar config — ETH currency, 0% fee, multi-token enabled
    CookieJarLib.JarConfig memory jarConfig = CookieJarLib.JarConfig({
        jarOwner: garden,                     // Garden TBA owns the jar
        supportedCurrency: CookieJarLib.ETH_ADDRESS,  // Always ETH
        feeCollector: address(0),             // Set by factory
        accessType: CookieJarLib.AccessType.ERC1155,  // Hats Protocol
        withdrawalOption: CookieJarLib.WithdrawalTypeOptions.Fixed,
        strictPurpose: defaultStrictPurpose,
        emergencyWithdrawalEnabled: false,
        oneTimeWithdrawal: false,
        fixedAmount: defaultFixedAmount,      // 0.01 ETH default
        maxWithdrawal: 0,
        withdrawalInterval: defaultWithdrawalInterval,
        minDeposit: 0,                        // Set by factory
        feePercentageOnDeposit: 0,            // 0% — no protocol fee
        maxWithdrawalPerPeriod: 0,            // Unlimited
        metadata: gardenName,
        multiTokenConfig: CookieJarLib.MultiTokenConfig(
            true,           // enabled — accept any token
            500,            // 5% max slippage
            0.001 ether,    // min swap threshold
            3000            // 0.3% Uniswap pool fee
        )
    });

    CookieJarLib.AccessConfig memory accessConfig = CookieJarLib.AccessConfig({
        allowlist: new address[](0),
        nftRequirement: CookieJarLib.NftRequirement({
            nftContract: hatsProtocol,        // Hats Protocol ERC-1155
            tokenId: gardenerHatId,           // Garden-specific gardener hat
            minBalance: 1                     // Must be wearing the hat
        })
    });

    // Create jar via external factory
    jar = cookieJarFactory.createCookieJar(
        jarConfig,
        accessConfig,
        CookieJarLib.MultiTokenConfig(false, 0, 0, 0)
    );

    gardenJars[garden] = jar;
    emit JarCreated(garden, jar);
    return jar;
}
```

### Modified: GardenToken.sol

Add to `_initializeGardenModules()` (3 lines, following Octant pattern):

```solidity
// Cookie Jar setup (graceful degradation)
if (address(cookieJarModule) != address(0)) {
    try cookieJarModule.onGardenMinted(gardenAccount, config.name) returns (address _jar) {
        _jar; // Success handled by module events
    } catch {
        // Failure is non-blocking
    }
}
```

Add storage + setter:
```solidity
ICookieJarModule public cookieJarModule;

function setCookieJarModule(ICookieJarModule _module) external onlyOwner {
    cookieJarModule = _module;
}
```

### New: ICookieJarModule.sol

```solidity
interface ICookieJarModule {
    function onGardenMinted(address garden, string calldata gardenName) external returns (address jar);
    function getJar(address garden) external view returns (address);
    function pauseJar(address garden) external;
    function unpauseJar(address garden) external;
}
```

### Dependencies: Cookie Jar Factory Deployment

The Cookie Jar factory must be deployed on the **same chain** as Green Goods. Current supported chains:

| Chain | Green Goods | Cookie Jar Factory | Status |
|-------|-------------|-------------------|--------|
| Base Sepolia (84532) | Deployed | Deployed (testnet V2) | Ready |
| Arbitrum (42161) | Deployed | Not deployed | **Needs deployment** |
| Celo (42220) | Deployed | Deployed | Ready |
| Sepolia (11155111) | Deployed | Deployed (testnet V2) | Ready |

**Action Required**: Deploy Cookie Jar Factory on Arbitrum mainnet before Green Goods mainnet integration.

---

## Phase 0: Cookie Jar Contracts — Deep Audit, Review & Polish

Before integration, a thorough production audit of the Cookie Jar contracts is required. This is **not** just a "safe to integrate?" check — it's a full security review and polish pass.

### Audit Scope

**Contracts under review** (at `/Users/afo/Code/greenpill/cookie-jar/contracts/src/`):

| File | Lines | Purpose | Priority |
|------|-------|---------|----------|
| `CookieJar.sol` | ~743 | Core jar logic (deposit, withdraw, access control) | **Critical** |
| `CookieJarFactory.sol` | ~201 | Factory for jar deployment | **Critical** |
| `libraries/CookieJarLib.sol` | ~156 | Shared structs, enums, errors, constants | **High** |
| `libraries/Streaming.sol` | ~200 | Superfluid integration | Low (not used) |
| `libraries/UniversalSwapAdapter.sol` | ~300 | Uniswap multi-token swaps | **High** (multi-token enabled) |
| `libraries/SuperfluidConfig.sol` | ~100 | Chain-specific Superfluid hosts | Low (not used) |
| `libraries/AdminLib.sol` | ~50 | Admin helper functions | Medium |

### Audit Checklist

#### 1. Access Control & Authorization
- [ ] `_checkAccess()` — Verify ERC1155 path: `balanceOf(user, tokenId) >= minBalance` is correct for Hats Protocol
- [ ] `_checkAccess()` — Verify ERC721 path: `balanceOf()` and `ownerOf()` try-catch patterns are safe
- [ ] Role hierarchy: `JAR_OWNER` vs `JAR_ALLOWLISTED` — confirm no privilege escalation
- [ ] `onlyJarOwner` modifier — verify cannot be bypassed
- [ ] `grantJarAllowlistRole` / `revokeJarAllowlistRole` — batch operations safe?
- [ ] Factory admin permissions — `onlyOwner` / `onlyAdmin` correctly restricted

#### 2. Reentrancy & State Mutations
- [ ] All external calls (ETH transfers, ERC20 transfers, NFT checks) follow checks-effects-interactions
- [ ] `ReentrancyGuard` applied to `deposit()`, `withdraw()`, `emergencyWithdraw()`, `swapPendingTokens()`
- [ ] No state reads after external calls that could be manipulated
- [ ] `_validateNftContract()` — external calls to untrusted NFT contracts are read-only (safe)

#### 3. Token Handling
- [ ] ETH deposits: `msg.value` correctly tracked, fee deducted before storage
- [ ] ERC20 deposits: `transferFrom()` return value checked (or uses SafeERC20)
- [ ] Withdrawal: amount bounds checked before transfer
- [ ] Fee calculation: no overflow in `amount * feePercentage / PERCENTAGE_BASE`
- [ ] Multi-token: `UniversalSwapAdapter` slippage protection correct
- [ ] Pending token balances: cannot be double-claimed or lost during swap

#### 4. Withdrawal Rules Engine
- [ ] Fixed amount mode: exactly `fixedAmount`, no more, no less
- [ ] Variable amount mode: 0 < amount <= maxWithdrawal
- [ ] Cooldown: `withdrawalInterval` correctly prevents rapid withdrawals
- [ ] One-time withdrawal: `hasWithdrawn[user]` flag cannot be reset
- [ ] Period limit: `maxWithdrawalPerPeriod` rolling window calculation correct
- [ ] Purpose validation: `strictPurpose` rejects empty strings

#### 5. Edge Cases & DoS Vectors
- [ ] What happens if NFT contract reverts on `balanceOf()`? (currently caught by try-catch → NotAuthorized)
- [ ] What happens if NFT contract returns unexpected values?
- [ ] Can jar be griefed by depositing dust amounts?
- [ ] Can `cookieJars[]` array in factory grow unbounded? (DOS on `getAllJars()`)
- [ ] Factory `createCookieJar()` — can same jar be created twice?

#### 6. Upgrade Safety
- [ ] CookieJar is NOT upgradeable (deployed by factory as plain contract) — confirmed
- [ ] CookieJarFactory is NOT upgradeable (uses immutables) — confirmed
- [ ] No storage collision risks (no proxy pattern)

#### 7. Gas Optimization Review
- [ ] JarInfo struct packing: `address (20) + uint64 (8) + bool (1)` = 29 bytes, fits single slot ✅
- [ ] NftRequirement struct: `address (20) + uint256 (32) + uint256 (32)` = 3 slots
- [ ] MultiTokenConfig struct packing efficiency
- [ ] Batch allowlist operations gas profile

### NFT Gating Frontend — Polish Assessment

**Components to review & polish** (at `/Users/afo/Code/greenpill/cookie-jar/client/`):

| Component | Status | Action Needed |
|-----------|--------|---------------|
| `NFTGateInput.tsx` | 85% | Review input sanitization, test with Hats ERC-1155 |
| `NFTSelector.tsx` | 85% | Verify ERC-1155 selection flow |
| `NFTErrorBoundary.tsx` | 90% | Good — graceful degradation |
| `ProtocolSelector.tsx` | 70% | Remove unused protocols (POAP, Unlock) for Green Goods context |
| `useNFTValidation.ts` | 90% | Test with Hats Protocol contract |
| `useEnhancedNFTValidation.ts` | 85% | ERC165 detection — verify Hats supports it |
| `useNFTBalanceProof.ts` | 85% | Test ERC-1155 balance proof with hat IDs |
| `useHypercerts.ts` | **10%** | **MOCK ONLY** — Replace with real SDK or remove |
| `useHats.ts` | 60% | Polish — Green Goods has its own Hats integration |
| `usePOAPs.ts` | 90% | Not needed for Green Goods — leave as-is |
| `useUnlock.ts` | 90% | Not needed for Green Goods — leave as-is |

### Polish Deliverables

1. **Fix generic error messages** in `_checkAccess()` — distinguish `NFTContractCallFailed` from `InsufficientNFTBalance`
2. **Add ERC165 `supportsInterface()` check** in contract before calling ERC-1155 `balanceOf`
3. **Test Hats Protocol ERC-1155 compatibility** — deploy test jar gated by a Hats hat ID, verify withdraw works
4. **Remove/replace Hypercerts mock** — either real SDK or remove entirely
5. **Document supported chains** — matrix of factory + Uniswap router availability
6. **Gas report** — forge test with gas snapshots for key operations

### Audit Verdict Summary

| Area | Current Status | After Polish |
|------|---------------|--------------|
| Core deposit/withdraw | ✅ Production-ready | ✅ |
| Allowlist access | ✅ Production-ready | ✅ |
| ERC721 gating | ✅ Working | ✅ + better errors |
| ERC1155 gating (Hats) | ✅ Working | ✅ + ERC165 check + tested with Hats |
| Multi-token swaps | ⚠️ Needs review | ✅ After slippage audit |
| Factory | ✅ Production-ready | ✅ |
| Frontend NFT UI | 75% | 90% after polish |

---

## Cookie Jar Frontend: NFT Gating Polish Assessment

### What's Production-Ready NOW

| Component | Status | Used By Green Goods? |
|-----------|--------|---------------------|
| Allowlist UI | ✅ Ready | Fallback mode |
| Generic ERC721 selection | ✅ Ready | Not directly (we use ERC1155) |
| Generic ERC1155 selection | ✅ Ready | **Yes — for Hats Protocol** |
| `useNFTValidation` hook | ✅ Ready | Yes |
| `useNFTBalanceProof` hook | ✅ Ready | Yes |
| `useEnhancedNFTValidation` (ERC165) | ✅ Ready | Yes |
| POAP integration | ✅ Ready | Not needed |
| Unlock Protocol integration | ✅ Ready | Not needed |

### What Needs Polish

| Component | Status | Action for Green Goods |
|-----------|--------|----------------------|
| Hypercerts integration | Mock only | **Not needed** — skip |
| Hats Protocol hook (`useHats.ts`) | 60% complete | **Needed** — but Green Goods has its own Hats integration |
| NFT gating creation wizard | 85% complete | Adapt for garden-specific flow |
| Balance proof staleness | Hardcoded 5 blocks | Acceptable default |

### What Green Goods Should Build (Not Import from Cookie Jar)

Since Green Goods already has comprehensive Hats Protocol integration, the frontend should:

1. **Use Green Goods' own Hats hooks** for checking gardener status
2. **Import Cookie Jar's `useCookieJarConfig` and `useJarTransactions`** for jar interactions
3. **Build garden-specific jar UI** in `@green-goods/shared` following existing patterns
4. **NOT import** Cookie Jar's protocol selector UI (POAP, Unlock, etc.) — irrelevant for this use case

---

## Indexer Changes

### New Entities in schema.graphql

```graphql
type GardenCookieJar {
  id: ID!                          # chainId-garden
  garden: String!                  # Garden TBA address
  jarAddress: String!              # Cookie Jar contract address
  currency: String!                # ETH or ERC20 address
  fixedAmount: BigInt!             # Withdrawal amount
  withdrawalInterval: Int!         # Cooldown seconds
  balance: BigInt!                 # Current jar balance
  totalDeposited: BigInt!          # Lifetime deposits
  totalWithdrawn: BigInt!          # Lifetime withdrawals
  withdrawalCount: Int!            # Total withdrawals
  depositorCount: Int!             # Unique depositors
  paused: Boolean!
  createdAt: Int!
}

type CookieJarWithdrawal {
  id: ID!                          # chainId-jarAddress-txHash-logIndex
  garden: String!
  jarAddress: String!
  gardener: String!                # Who withdrew
  amount: BigInt!
  purpose: String                  # Reason for withdrawal
  txHash: String!
  timestamp: Int!
}

type CookieJarDeposit {
  id: ID!                          # chainId-jarAddress-txHash-logIndex
  garden: String!
  jarAddress: String!
  depositor: String!               # Who deposited
  amount: BigInt!
  fee: BigInt!                     # Fee deducted
  txHash: String!
  timestamp: Int!
}
```

### Event Handlers

```typescript
// CookieJarModule events
CookieJarModule.JarCreated.handler(async ({ event, context }) => {
  // Create GardenCookieJar entity
});

// CookieJar instance events (dynamic source registration)
CookieJar.Deposit.handler(async ({ event, context }) => {
  // Create CookieJarDeposit, update GardenCookieJar.balance
});

CookieJar.Withdrawal.handler(async ({ event, context }) => {
  // Create CookieJarWithdrawal, update GardenCookieJar.balance
});
```

### Indexer Config (config.yaml)

Register CookieJarModule as a new contract source, similar to OctantModule.

---

## Shared Package Changes

### New Types (`packages/shared/src/types/cookieJar.ts`)

```typescript
export interface GardenCookieJar {
  garden: Address;
  jarAddress: Address;
  currency: Address;
  fixedAmount: bigint;
  withdrawalInterval: number;
  balance: bigint;
  totalDeposited: bigint;
  totalWithdrawn: bigint;
  withdrawalCount: number;
  paused: boolean;
  createdAt: number;
}

export interface CookieJarWithdrawal {
  garden: Address;
  jarAddress: Address;
  gardener: Address;
  amount: bigint;
  purpose: string;
  txHash: string;
  timestamp: number;
}
```

### New Hooks (`packages/shared/src/hooks/cookieJar/`)

```
useGardenCookieJar.ts     — Fetch jar config for a garden (from indexer)
useCookieJarDeposit.ts    — Deposit to jar (operator action)
useCookieJarWithdraw.ts   — Withdraw from jar (gardener action)
useCookieJarBalance.ts    — Real-time balance polling
useCookieJarHistory.ts    — Withdrawal/deposit history
```

### ABI Addition (`packages/shared/src/utils/blockchain/abis.ts`)

Import Cookie Jar ABI from the cookie-jar package or include as static JSON.

---

## UI/UX Design

### Naming Convention: "Endowment" & "Payouts"

The treasury is split into two complementary financial instruments:

| Name | Mechanism | Analogy |
|------|-----------|---------|
| **Endowment** | Octant yield vaults (WETH/DAI) | Savings account — long-term, yield-generating |
| **Payouts** | Cookie Jar (ETH) | Petty cash — quick disbursements for immediate needs |

---

### Client App: Treasury Drawer (Gardener/Public View)

The existing `TreasuryDrawer` component uses `ModalDrawer` which **already has built-in tab support** (`tabs`, `activeTab`, `onTabChange` props). Currently it renders vault content without tabs. The redesign adds two tabs:

```
┌─────────────────────────────────────────┐
│  Treasury                          [✕]  │
│  {gardenName}                           │
├─────────────────────────────────────────┤
│  [ Endowment ]    [ Payouts ]           │  ← ModalDrawer tabs
├─────────────────────────────────────────┤
│                                         │
│  (tab content renders here)             │
│                                         │
└─────────────────────────────────────────┘
```

#### "Endowment" Tab (existing vault content, refactored)

Current `TreasuryDrawer` content moves here unchanged:
- Vault overview (WETH/DAI balances, depositor count, donation address)
- My deposits (share balances, withdraw shares)
- Deposit form (asset selector, amount input, deposit button)

**Who can interact**:
- **Anyone** can deposit to vaults (public)
- **Depositors** can withdraw their own shares

#### "Payouts" Tab (new Cookie Jar content)

```
┌─────────────────────────────────────────┐
│  [ Endowment ]    [• Payouts ]          │
├─────────────────────────────────────────┤
│                                         │
│  Cookie Jar Balance                     │
│  ┌─────────────────────────────────┐    │
│  │  🍪  0.42 ETH                   │    │
│  │  24 withdrawals · 8 depositors  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ── Your Status ──────────────────────  │
│                                         │
│  [IF gardener/operator]:                │
│  ┌─────────────────────────────────┐    │
│  │  ✅ Eligible to withdraw        │    │
│  │  Amount: 0.01 ETH (fixed)       │    │
│  │  Next available: Now             │    │
│  │  ┌─────────────────────────┐    │    │
│  │  │ Purpose (optional)      │    │    │
│  │  └─────────────────────────┘    │    │
│  │  [ Withdraw 0.01 ETH ]         │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [IF on cooldown]:                      │
│  ┌─────────────────────────────────┐    │
│  │  ⏳ Cooldown active              │    │
│  │  Next withdrawal in: 18h 42m    │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [IF not a member]:                     │
│  ┌─────────────────────────────────┐    │
│  │  🔒 Members only                │    │
│  │  Join this garden to withdraw   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ── Deposit ──────────────────────────  │
│  ┌─────────────────────────────────┐    │
│  │  Amount: [________] [Max]       │    │
│  │  Balance: 1.23 ETH              │    │
│  │  [ Deposit ]                    │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ── Recent Activity ──────────────────  │
│  ┌─────────────────────────────────┐    │
│  │  ↗ 0x1a2b withdrew 0.01 ETH    │    │
│  │    "Bus fare to garden site"    │    │
│  │    2h ago                        │    │
│  │  ↙ 0x3c4d deposited 0.5 ETH    │    │
│  │    1d ago                        │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**Who can interact**:
- **Anyone** can deposit ETH (or other tokens if multi-token enabled)
- **Gardeners, Operators, Owners** can withdraw (all wear gardener hat via auto-grant cascade)
- **Standalone Evaluators, Funders, Community** cannot withdraw (no gardener hat)
- **Non-members** see balance + deposit form, but withdraw is locked

#### Visibility Rules

| User Role | Endowment Tab | Payouts Tab | Has Gardener Hat? |
|-----------|---------------|-------------|-------------------|
| Anonymous (no wallet) | View balances only | View balance only | N/A |
| Connected (non-member) | View + Deposit | View + Deposit | No |
| Community member | View + Deposit | View + Deposit | No |
| Standalone Evaluator | View + Deposit + Withdraw own shares | View + Deposit | No |
| Gardener | View + Deposit + Withdraw own shares | View + Deposit + **Withdraw** | Yes (direct) |
| Operator | View + Deposit + Withdraw own shares | View + Deposit + **Withdraw** | Yes (auto-granted) |
| Owner | View + Deposit + Withdraw own shares | View + Deposit + **Withdraw** | Yes (auto-granted) |

#### Treasury Button (TopNav)

The existing treasury button in `TopNav` currently shows when `gardenVaults.length > 0`. Update condition:

```typescript
// Show treasury button if garden has vaults OR a cookie jar
showTreasuryButton={gardenVaults.length > 0 || Boolean(gardenCookieJar)}
```

Default tab when opening:
- If user has vault deposits → open on "Endowment"
- If user is a gardener with no vault deposits → open on "Payouts"
- Otherwise → "Endowment"

---

### Admin Dashboard: Funding Management

The admin dashboard has two levels of treasury management:

#### 1. Garden Detail View (`/gardens/:id`) — Summary Card

Replace the current "Treasury" card with a "Funding" card that shows both instruments:

```
┌──────────────────────────────────────────────┐
│  Funding                     [Manage →]      │
│  {gardenName}'s financial instruments        │
│                                              │
│  ┌──────────────┐  ┌──────────────────┐      │
│  │ Endowment    │  │ Payouts          │      │
│  │ $2,450 TVL   │  │ 0.42 ETH balance │      │
│  │ 3 harvests   │  │ 24 withdrawals   │      │
│  │ 5 depositors │  │ 8 depositors     │      │
│  └──────────────┘  └──────────────────┘      │
│                                              │
│  ⚠️ Set donation address for yield routing   │
└──────────────────────────────────────────────┘
```

The "Manage" link goes to `/gardens/:id/funding` (renamed from `/gardens/:id/vault`).

#### 2. Funding Management Page (`/gardens/:id/funding`)

This page replaces the current vault-only page. Add tabs at the top:

```
┌──────────────────────────────────────────────────────────────┐
│  ← Back to garden                                            │
│  Funding · {gardenName}                                      │
│  Manage your garden's financial instruments                   │
├──────────────────────────────────────────────────────────────┤
│  [ Endowment ]    [• Payouts ]                               │
├──────────────────────────────────────────────────────────────┤
```

##### Endowment Tab (existing vault content)

Current `GardenVaultView` content, unchanged:
- Stats cards (TVL, Harvests, Depositors)
- Donation address configuration
- Per-vault position cards (WETH, DAI)
- Event history
- Deposit/withdraw modals

##### Payouts Tab (new Cookie Jar management)

```
┌──────────────────────────────────────────────────────────────┐
│  [ Endowment ]    [• Payouts ]                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────┐          │
│  │ Balance    │  │ Withdrawals │  │ Depositors   │          │
│  │ 0.42 ETH  │  │ 24 total    │  │ 8 unique     │          │
│  └────────────┘  └─────────────┘  └──────────────┘          │
│                                                              │
│  ── Configuration ────────────────────────────────           │
│  ┌──────────────────────────────────────────────┐            │
│  │  Currency: ETH                               │            │
│  │  Withdrawal Amount: 0.01 ETH (fixed)         │            │
│  │  Cooldown: 24 hours                          │            │
│  │  Purpose Required: No                        │            │
│  │  Access: Hats Protocol (Gardener hat)        │            │
│  │  Multi-token Deposits: Enabled               │            │
│  │  Status: Active ● [Pause]                    │            │
│  └──────────────────────────────────────────────┘            │
│                                                              │
│  ── Deposit to Jar ──────────────────────────────            │
│  ┌──────────────────────────────────────────────┐            │
│  │  Amount: [________] ETH  [Max]               │            │
│  │  Wallet: 2.5 ETH                             │            │
│  │  [ Deposit ]                                 │            │
│  └──────────────────────────────────────────────┘            │
│                                                              │
│  ── Pending Multi-Token Deposits ────────────────            │
│  ┌──────────────────────────────────────────────┐            │
│  │  50 USDC pending swap → ETH                  │            │
│  │  [ Swap to ETH ]                             │            │
│  └──────────────────────────────────────────────┘            │
│                                                              │
│  ── Recent Activity ─────────────────────────────            │
│  (Same event history pattern as vault events)                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Operator-only actions**:
- Deposit ETH to the jar
- Trigger multi-token swaps (swap pending USDC/DAI → ETH)
- Pause/unpause the jar
- View full withdrawal history with purposes

**Owner-only actions**:
- Emergency withdraw (if enabled)

#### 3. Global Treasury View (`/treasury`)

The existing `/treasury` route shows cross-garden vault overview. Extend with Cookie Jar data:

- Add "Total Jar Balance" alongside "Total TVL"
- Add "Total Withdrawals" metric
- Per-garden row shows both vault TVL and jar balance

#### 4. Garden Creation Wizard

Add optional Cookie Jar configuration step after the current wizard steps:

```
Step 1: Details → Step 2: Team → Step 3: Cookie Jar (NEW) → Step 4: Review → Submit
```

**Cookie Jar Step**:
```
┌──────────────────────────────────────────────┐
│  Cookie Jar (Optional)                       │
│  Set up a shared fund for garden expenses    │
│                                              │
│  [✓] Enable Cookie Jar                       │
│                                              │
│  Withdrawal Amount                           │
│  [ 0.01 ] ETH                                │
│  How much gardeners can withdraw each time   │
│                                              │
│  Cooldown Period                             │
│  [ 24 ] hours                                │
│  Minimum time between withdrawals            │
│                                              │
│  [ ] Require purpose for withdrawals         │
│  Gardeners must explain what the funds are   │
│  for when withdrawing                        │
│                                              │
│  Initial Deposit (optional)                  │
│  [ 0.1 ] ETH                                │
│  Fund the jar at creation                    │
│                                              │
└──────────────────────────────────────────────┘
```

---

### Admin Router Changes

```typescript
// Rename: /gardens/:id/vault → /gardens/:id/funding
{
  path: "gardens/:id/funding",
  lazy: async () => ({
    Component: (await import("@/views/Gardens/Garden/Funding")).default,
  }),
},
// Keep old route as redirect for bookmarks
{
  path: "gardens/:id/vault",
  loader: ({ params }) => redirect(`/gardens/${params.id}/funding`),
},
```

---

## Implementation Phases

### Phase 0: Cookie Jar Audit & Polish (Week 1)

| Step | Description | Repo |
|------|-------------|------|
| 0.1 | Deep security audit of CookieJar.sol (access control, reentrancy, token handling) | cookie-jar |
| 0.2 | Audit UniversalSwapAdapter.sol (slippage, Uniswap integration) | cookie-jar |
| 0.3 | Audit CookieJarFactory.sol (creation flow, config validation) | cookie-jar |
| 0.4 | Test ERC-1155 gating with Hats Protocol on testnet | cookie-jar |
| 0.5 | Fix generic error messages in `_checkAccess()` | cookie-jar |
| 0.6 | Add ERC165 `supportsInterface()` check before ERC-1155 calls | cookie-jar |
| 0.7 | Gas report: `forge test --gas-report` for key operations | cookie-jar |
| 0.8 | Document audit findings in `.plans/audits/cookie-jar-audit.md` | green-goods |

### Phase 1: Smart Contracts — CookieJarModule (Week 2)

| Step | Description | Files |
|------|-------------|-------|
| 1.1 | Create `ICookieJarModule.sol` interface | `src/interfaces/ICookieJarModule.sol` |
| 1.2 | Create `ICookieJarFactory.sol` interface (external) | `src/interfaces/ICookieJarFactory.sol` |
| 1.3 | Create `CookieJarModule.sol` | `src/modules/CookieJar.sol` |
| 1.4 | Add `cookieJarModule` storage + setter to `GardenToken.sol` | `src/tokens/Garden.sol` |
| 1.5 | Add Cookie Jar call to `_initializeGardenModules` | `src/tokens/Garden.sol` |
| 1.6 | Unit tests for CookieJarModule | `test/unit/CookieJarModule.t.sol` |
| 1.7 | Integration test: mint garden → jar created → withdraw | `test/integration/CookieJarIntegration.t.sol` |
| 1.8 | Update `deploy.ts` for CookieJarModule | `script/deploy.ts` |

### Phase 2: Indexer (Week 2-3)

| Step | Description | Files |
|------|-------------|-------|
| 2.1 | Add `GardenCookieJar`, `CookieJarWithdrawal`, `CookieJarDeposit` entities | `schema.graphql` |
| 2.2 | Register CookieJarModule + dynamic CookieJar sources in config | `config.yaml` |
| 2.3 | Write event handlers (JarCreated, Deposit, Withdrawal) | `src/EventHandlers.ts` |
| 2.4 | Update indexer tests | `test/test.ts` |

### Phase 3: Shared Package (Week 3)

| Step | Description | Files |
|------|-------------|-------|
| 3.1 | Add Cookie Jar types (`GardenCookieJar`, `CookieJarWithdrawal`, etc.) | `types/cookieJar.ts`, `types/index.ts` |
| 3.2 | Add Cookie Jar + CookieJarModule ABIs | `utils/blockchain/abis.ts` |
| 3.3 | Add Cookie Jar contract config + address resolution | `utils/blockchain/contracts.ts` |
| 3.4 | Create hooks: `useGardenCookieJar`, `useCookieJarDeposit`, `useCookieJarWithdraw`, `useCookieJarBalance`, `useCookieJarHistory` | `hooks/cookieJar/*.ts` |
| 3.5 | Add query keys + invalidation patterns | `hooks/query-keys.ts` |
| 3.6 | Add i18n strings (Endowment, Payouts, withdrawal status, etc.) | `i18n/en.json`, `es.json`, `pt.json` |
| 3.7 | Hook tests | `__tests__/hooks/cookieJar/*.test.ts` |
| 3.8 | Export all new types/hooks from barrel | `index.ts` |

### Phase 4: Client UI — Treasury Drawer Tabs (Week 3-4)

| Step | Description | Files |
|------|-------------|-------|
| 4.1 | Refactor `TreasuryDrawer` to use `ModalDrawer` tab props | `client/src/components/Dialogs/TreasuryDrawer.tsx` |
| 4.2 | Extract current vault content into `EndowmentTabContent` component | `client/src/components/Treasury/EndowmentTab.tsx` |
| 4.3 | Create `PayoutsTabContent` component (balance, status, withdraw, deposit, activity) | `client/src/components/Treasury/PayoutsTab.tsx` |
| 4.4 | Add cookie jar state to `Garden/index.tsx` (fetch jar, check eligibility) | `client/src/views/Home/Garden/index.tsx` |
| 4.5 | Update TopNav treasury button to show when jar OR vaults exist | `client/src/components/Navigation/TopNav.tsx` |
| 4.6 | Add cooldown countdown timer component | `shared/src/components/CookieJar/CooldownTimer.tsx` |

### Phase 5: Admin UI — Funding Management (Week 4)

| Step | Description | Files |
|------|-------------|-------|
| 5.1 | Rename `Vault.tsx` → `Funding.tsx`, add tab structure (Endowment/Payouts) | `admin/src/views/Gardens/Garden/Funding.tsx` |
| 5.2 | Create `PayoutsManagement` component (config, deposit, swap, history) | `admin/src/components/CookieJar/PayoutsManagement.tsx` |
| 5.3 | Update garden detail summary card (show both instruments) | `admin/src/views/Gardens/Garden/Detail.tsx` |
| 5.4 | Update router: `/gardens/:id/vault` → `/gardens/:id/funding` + redirect | `admin/src/router.tsx` |
| 5.5 | Add Cookie Jar step to garden creation wizard | `admin/src/views/Gardens/CreateGarden.tsx` |
| 5.6 | Update global treasury view with jar data | `admin/src/views/Treasury/index.tsx` |

### Phase 6: Deployment & E2E Testing (Week 4-5)

| Step | Description |
|------|-------------|
| 6.1 | Deploy Cookie Jar Factory on Arbitrum (if not already deployed) |
| 6.2 | Deploy CookieJarModule on Base Sepolia testnet |
| 6.3 | E2E test: create garden → verify jar created → operator deposits → gardener withdraws |
| 6.4 | E2E test: multi-token deposit → swap → withdraw ETH |
| 6.5 | E2E test: cooldown enforcement, non-member rejection |
| 6.6 | Deploy to staging environment |
| 6.7 | Production deployment |

---

## CLAUDE.md Compliance Checklist

- [x] Hooks in `@green-goods/shared` — All Cookie Jar hooks in shared package
- [x] Types in `@green-goods/shared` — CookieJar types exported from shared
- [x] Deployment artifacts — CookieJarModule address in deployment JSON
- [x] No hardcoded addresses — Import from deployment artifacts
- [x] Barrel imports — Export from `@green-goods/shared` root
- [x] i18n — All user-facing strings translated
- [x] Logger — No console.log in production code
- [x] Error handling — Use createMutationErrorHandler pattern
- [x] Query keys — Use queryKeys factory from query-keys.ts
- [x] Graceful degradation — try/catch in _initializeGardenModules
- [x] UUPS upgradeability — CookieJarModule uses UUPSUpgradeable
- [x] Single .env — No package-specific env files

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Cookie Jar Factory not deployed on target chain | High | Deploy factory first; CookieJarModule degrades gracefully if factory is zero address |
| Hats Protocol hatId changes format | Medium | Store hatId at jar creation time; don't re-resolve |
| Cookie Jar contract size exceeds 24KB | Low | Already optimized; we use factory-deployed instances |
| Jar depleted before gardeners can withdraw | Medium | UI shows balance prominently; operators get low-balance alerts |
| Cross-protocol Solidity version mismatch | Medium | Green Goods uses 0.8.25, Cookie Jar uses 0.8.24 — compatible |
| Gas cost of jar creation at garden mint | Low | ~200K gas for factory.createCookieJar — acceptable |

---

## Resolved Design Decisions

1. **Default currency**: **ETH** — Community tokens have no financial value; ETH is universal
2. **Default withdrawal amount**: **0.01 ETH** — Configurable at garden creation
3. **Fee configuration**: **0% fee** — Green Goods jars charge no Cookie Jar protocol fee
4. **Streaming**: **No** — Superfluid streaming disabled; no clear use case for gardens
5. **Multi-token deposits**: **Yes** — Enable multi-token support so anyone can deposit any token, auto-swapped to ETH via Uniswap Universal Router. This lowers the barrier for contributions.

### Multi-Token Config for Garden Jars

Since multi-token deposits are enabled, `CookieJarModule.onGardenMinted()` will set:
```solidity
multiTokenConfig: CookieJarLib.MultiTokenConfig({
    enabled: true,
    maxSlippagePercent: 500,    // 5% max slippage
    minSwapAmount: 0.001 ether, // Min swap threshold
    defaultFee: 3000            // 0.3% Uniswap pool fee
})
```

This means operators or anyone can deposit USDC, DAI, WETH, etc. into the jar and it gets swapped to ETH. Gardeners always withdraw ETH. The swap is triggered manually by the jar owner (garden TBA) via `swapPendingTokens()`.

**Chain requirement**: Uniswap Universal Router must be deployed on the target chain. Currently supported: Base, Optimism, Arbitrum, Ethereum, and their testnets. Celo does **not** have Uniswap — multi-token deposits would be disabled there (fallback to ETH-only).

---

## Validation Plan

```bash
# After each phase
bun format && bun lint && bun run test && bun build

# Contract-specific
cd packages/contracts && forge test -vvv

# Shared-specific
cd packages/shared && bun run test

# Full E2E (after Phase 6)
# Manual: Create garden on testnet → verify jar created → deposit → withdraw
```
