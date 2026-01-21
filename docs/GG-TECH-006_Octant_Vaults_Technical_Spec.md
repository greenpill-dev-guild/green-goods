# GG-TECH-006: Octant Vaults Technical Specification

**Document ID:** GG-TECH-006
**Feature Reference:** GG-FEAT-006
**Version:** 1.0
**Status:** Draft
**Last Updated:** January 18, 2026
**Author:** Engineering Team

---

## 1. Overview

### 1.1 Purpose

This technical specification defines the implementation details for the Octant Vault Integration feature, enabling Green Goods Gardens to deposit treasury capital into yield-generating vaults and donate the generated yield to fund verified environmental impact. The document covers both the **Arbitrum-native deployment** (Phase 1, recommended) and the **cross-chain Ethereum integration** (Phase 2) architectures.

This specification serves as the engineering blueprint for:
- Smart contract development and deployment
- Frontend integration with the Admin Dashboard
- Indexer and data layer configuration
- Testing and quality assurance
- DevOps and deployment procedures

### 1.2 Scope

**In Scope:**
- Arbitrum-native YDS vault contracts (GardenVaultManager, YDS strategies)
- Cross-chain vault controller contracts (CrossChainController, VaultController)
- State synchronization between Arbitrum and Ethereum
- Admin Dashboard vault management UI components
- Envio indexer schema and handlers
- Integration with Hats Protocol for authorization
- Integration with ERC-6551 GardenAccounts

**Out of Scope:**
- Conviction Voting integration for yield allocation (see GG-TECH-007)
- Multi-strategy vault rebalancing (Phase 2)
- Custom YDS strategy development (uses Octant-provided strategies)
- Direct user deposits (users interact via Garden Operators)
- Token bridging (only CCIP messages cross chains, not tokens)

### 1.3 Definitions, Acronyms, and Abbreviations

| Term | Definition |
| :--- | :--- |
| **YDS** | Yield Donating Strategy - ERC-4626 vault that donates profit to a configured address |
| **CCIP** | Chainlink Cross-Chain Interoperability Protocol |
| **PPS** | Price Per Share - ratio of vault assets to shares |
| **TBA** | Token Bound Account (ERC-6551) |
| **GardenAccount** | ERC-6551 account bound to Garden NFT, holds treasury |
| **Operator** | Garden role authorized to manage vault operations |
| **Guardian** | Garden role authorized for emergency actions |
| **StateOracle** | Contract caching Ethereum vault state on Arbitrum |
| **DON** | Decentralized Oracle Network (Chainlink) |
| **EIP-4626** | Tokenized Vault Standard |
| **Hats Protocol** | Onchain role management system |

### 1.4 References

| Document | Description |
| :--- | :--- |
| GG-FEAT-006 | Octant Vaults Feature Specification |
| GG-FEAT-007 | Gardens Conviction Voting Feature Specification |
| GG-TECH-007 | Gardens Conviction Voting Technical Specification (yield allocation logic) |
| GG-PRD-001 | Green Goods v1 Product Requirements Document |
| Octant V2 Docs | https://docs.v2.octant.build |
| Chainlink CCIP Docs | https://docs.chain.link/ccip |
| ERC-4626 Spec | https://eips.ethereum.org/EIPS/eip-4626 |
| Hats Protocol Docs | https://docs.hatsprotocol.xyz |
| Aave V3 Docs | https://docs.aave.com |
| Yearn V3 Docs | https://docs.yearn.fi/developers/v3/overview |
| Gardens V2 Docs | https://docs.gardens.fund |
| Hypercerts Docs | https://hypercerts.org/docs |

---

## 2. System Overview

### 2.1 System Architecture

The system supports two deployment modes:

#### 2.1.1 Arbitrum-Native Architecture (Phase 1 - Recommended)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ARBITRUM ONE                                    │
│                                                                              │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                    │
│  │   Admin     │     │  GardenTBA  │     │   Hats      │                    │
│  │  Dashboard  │────▶│  (ERC-6551) │◀───▶│  Protocol   │                    │
│  │  (React)    │     │  Treasury   │     │             │                    │
│  └──────┬──────┘     └──────┬──────┘     └─────────────┘                    │
│         │                   │                                                │
│         │    ┌──────────────▼──────────────┐                                │
│         │    │     GardenVaultManager      │                                │
│         │    │  ┌────────────────────────┐ │                                │
│         │    │  │ Strategy Registry      │ │                                │
│         │    │  │ Position Tracking      │ │                                │
│         │    │  │ Yield Harvesting       │ │                                │
│         │    │  └────────────────────────┘ │                                │
│         │    └──────────────┬──────────────┘                                │
│         │                   │                                                │
│         │    ┌──────────────┴──────────────┐                                │
│         │    │                             │                                │
│         ▼    ▼                             ▼                                │
│  ┌─────────────────┐            ┌─────────────────┐                         │
│  │ AaveV3YDSStrat  │            │ YearnV3YDSStrat │                         │
│  │                 │            │                 │                         │
│  │ ┌─────────────┐ │            │ ┌─────────────┐ │                         │
│  │ │ Aave V3     │ │            │ │ Yearn V3    │ │                         │
│  │ │ Pool        │ │            │ │ Vault       │ │                         │
│  │ └─────────────┘ │            │ └─────────────┘ │                         │
│  └─────────────────┘            └─────────────────┘                         │
│         │                                │                                   │
│         └────────────────┬───────────────┘                                   │
│                          ▼                                                   │
│              ┌─────────────────────┐                                        │
│              │  Donation Address   │                                        │
│              │  (Payment Splitter) │                                        │
│              └─────────────────────┘                                        │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         ENVIO INDEXER                                │    │
│  │  - VaultPosition entities                                           │    │
│  │  - YieldDonation events                                             │    │
│  │  - Strategy metadata                                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 2.1.2 Cross-Chain Architecture (Phase 2)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ARBITRUM ONE                                    │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Admin     │  │  GardenTBA  │  │   State     │  │   Hats      │         │
│  │  Dashboard  │  │  (ERC-6551) │  │   Oracle    │  │  Protocol   │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────────────┘         │
│         │                │                │                                  │
│         └────────────────┼────────────────┘                                  │
│                          ▼                                                   │
│              ┌─────────────────────┐                                        │
│              │ CrossChainController│                                        │
│              │   (CCIPReceiver)    │                                        │
│              └──────────┬──────────┘                                        │
│                         │                                                    │
│              ┌──────────▼──────────┐                                        │
│              │    CCIP Router      │                                        │
│              │    (Chainlink)      │                                        │
│              └──────────┬──────────┘                                        │
└─────────────────────────┼────────────────────────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              │   CHAINLINK CCIP DON  │
              └───────────┬───────────┘
                          │
┌─────────────────────────┼────────────────────────────────────────────────────┐
│                         │          ETHEREUM MAINNET                          │
│              ┌──────────▼──────────┐                                        │
│              │    CCIP Router      │                                        │
│              └──────────┬──────────┘                                        │
│                         │                                                    │
│              ┌──────────▼──────────┐                                        │
│              │   VaultController   │                                        │
│              │   (CCIPReceiver)    │                                        │
│              └──────────┬──────────┘                                        │
│                         │                                                    │
│    ┌────────────────────┼────────────────────┐                              │
│    │                    ▼                    │                              │
│    │  ┌─────────────────────────────────┐   │                              │
│    │  │      Octant YDS Vaults          │   │                              │
│    │  │  ┌───────────┐  ┌───────────┐   │   │                              │
│    │  │  │ sDAI YDS  │  │ sUSDS YDS │   │   │                              │
│    │  │  └───────────┘  └───────────┘   │   │                              │
│    │  └─────────────────────────────────┘   │                              │
│    └────────────────────────────────────────┘                              │
│                                                                              │
│              ┌─────────────────────┐                                        │
│              │     HatsMirror      │                                        │
│              └─────────────────────┘                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Environment

#### 2.2.1 Development Environment

| Component | Technology | Version |
| :--- | :--- | :--- |
| Smart Contracts | Solidity | ^0.8.20 |
| Contract Framework | Foundry | Latest |
| Frontend | Vite + React + TypeScript | Vite 5.x, React 18.x |
| State Management | Zustand + XState | 4.x, 5.x |
| GraphQL Client | React Query + graphql-request | 5.x |
| Indexer | Envio | Latest |
| Testing | Foundry (contracts), Vitest + Playwright (frontend) | Latest |

#### 2.2.2 Network Configuration

| Network | Chain ID | RPC | Explorer |
| :--- | :--- | :--- | :--- |
| Arbitrum One | 42161 | https://arb1.arbitrum.io/rpc | https://arbiscan.io |
| Arbitrum Sepolia | 421614 | https://sepolia-rollup.arbitrum.io/rpc | https://sepolia.arbiscan.io |
| Ethereum Mainnet | 1 | https://eth.llamarpc.com | https://etherscan.io |
| Ethereum Sepolia | 11155111 | https://rpc.sepolia.org | https://sepolia.etherscan.io |

#### 2.2.3 External Dependencies

| Dependency | Network | Address |
| :--- | :--- | :--- |
| Aave V3 Pool | Arbitrum One | `0x794a61358D6845594F94dc1DB02A252b5b4814aD` |
| Aave V3 PoolDataProvider | Arbitrum One | `0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654` |
| waUSDC (ERC-4626) | Arbitrum One | `0xDAF2D8AAc9174B1168b9f78075FE64a04bae197B` |
| USDC | Arbitrum One | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| USDC.e (Bridged) | Arbitrum One | `0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8` |
| DAI | Arbitrum One | `0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1` |
| Hats Protocol | Arbitrum One | `0x3bc1A0Ad72417f2d411118085256fC53CBdDd137` |
| CCIP Router | Arbitrum One | `0x141fa059441E0ca23ce184B6A78bafD2A517DdE8` |
| CCIP Router | Ethereum | `0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D` |
| LINK Token | Arbitrum One | `0xf97f4df75117a78c1A5a0DBb814Af92458539FB4` |
| sDAI | Ethereum | `0x83F20F44975D03b1b09E64809B757c47f942BEeA` |
| sUSDS | Ethereum | `0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD` |

---

## 3. Detailed Requirements

### 3.1 Functional Requirements

#### 3.1.1 Vault Position Management

| ID | Title | Description | Priority | Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- |
| FR-001 | View Vault Positions | System shall display all active vault positions for a Garden with shares, value, and yield donated | High | Position data matches onchain state within 1 block |
| FR-002 | Deposit to Vault | Operators shall be able to deposit Garden treasury assets into registered YDS strategies | Critical | Deposit transaction succeeds, shares credited, position updated |
| FR-003 | Withdraw from Vault | Operators shall be able to withdraw assets from vault positions | Critical | Withdrawal transaction succeeds, assets returned to Garden |
| FR-004 | Emergency Withdrawal | Guardians shall be able to trigger immediate full withdrawal | Critical | All positions liquidated, assets returned to Garden |
| FR-005 | Harvest Yield | System shall harvest yield and route to HypercertYieldAllocator for conviction-based Hypercert fraction purchases | High | Yield routed to allocator, Hypercert fractions purchased based on conviction %, event emitted |
| FR-006 | Conviction-Based Allocation | System shall allocate yield to Hypercerts proportionally based on conviction voting percentages from Gardens CVStrategy | High | Yield split matches conviction ratios, fractions purchased for Garden treasury |

#### 3.1.2 Strategy Management

| ID | Title | Description | Priority | Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- |
| FR-010 | List Strategies | System shall display all registered YDS strategies with metadata | High | Strategies show name, asset, APY, TVL, limits |
| FR-011 | Strategy Registration | Admin shall be able to register new YDS strategies | Medium | Strategy appears in registry, callable |
| FR-012 | Strategy Deactivation | Admin shall be able to deactivate strategies | Medium | Strategy no longer accepts deposits |

#### 3.1.3 Authorization

| ID | Title | Description | Priority | Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- |
| FR-020 | Operator Authorization | Only Operator Hat wearers can execute vault operations | Critical | Non-operators cannot call deposit/withdraw |
| FR-021 | Guardian Authorization | Only Guardian Hat wearers can execute emergency withdrawal | Critical | Non-guardians cannot call emergencyWithdraw |
| FR-022 | Garden Registration | Gardens must be registered before vault operations | High | Unregistered gardens cannot interact |

#### 3.1.4 Cross-Chain (Phase 2)

| ID | Title | Description | Priority | Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- |
| FR-030 | CCIP Message Sending | System shall send valid CCIP messages for vault operations | Critical | Messages received on destination chain |
| FR-031 | CCIP Message Receiving | System shall process incoming CCIP confirmations | Critical | State updated correctly on receipt |
| FR-032 | State Synchronization | System shall sync Ethereum vault state to Arbitrum | High | StateOracle updated within 1 hour |

### 3.2 Non-Functional Requirements

#### 3.2.1 Performance

| Metric | Requirement | Target |
| :--- | :--- | :--- |
| Deposit Transaction Gas | Arbitrum-native | < 500,000 gas |
| Deposit Transaction Gas | Cross-chain (CCIP) | < 800,000 gas |
| Position Query Latency | API response time | < 200ms |
| UI Load Time | Initial dashboard load | < 2 seconds |
| State Sync Frequency | Cross-chain updates | Every 1 hour |

#### 3.2.2 Scalability

| Metric | Requirement |
| :--- | :--- |
| Concurrent Gardens | Support 1,000+ Gardens |
| Strategies per Garden | Support 10+ strategies |
| Positions per Garden | Support 50+ positions |
| CCIP Message Throughput | 100+ messages/hour |

#### 3.2.3 Security

| Requirement | Implementation |
| :--- | :--- |
| Role-Based Access Control | Hats Protocol integration |
| Cross-Chain Message Validation | Source chain + sender verification |
| Reentrancy Protection | OpenZeppelin ReentrancyGuard |
| Integer Overflow Protection | Solidity 0.8.x built-in |
| Upgrade Safety | UUPS proxy pattern with timelock |
| Emergency Pause | Pausable modifier on critical functions |

#### 3.2.4 Reliability

| Metric | Target |
| :--- | :--- |
| Contract Uptime | 99.9% (blockchain dependent) |
| CCIP Message Delivery | 99.9% (Chainlink SLA) |
| Indexer Sync Lag | < 10 blocks |
| State Freshness | < 1 hour |

#### 3.2.5 Maintainability

| Requirement | Implementation |
| :--- | :--- |
| Code Coverage | > 90% for smart contracts |
| Documentation | NatSpec for all public functions |
| Upgrade Path | UUPS proxy for contracts |
| Monitoring | Events for all state changes |

### 3.3 Interface Requirements

#### 3.3.1 Smart Contract Interfaces

```solidity
// IGardenVaultManager.sol
interface IGardenVaultManager {
    struct StrategyInfo {
        address strategyAddress;
        address asset;
        string name;
        bool isActive;
        uint256 minDeposit;
        uint256 maxDeposit;
    }

    struct VaultPosition {
        uint256 shares;
        uint256 depositedValue;
        uint256 lastUpdateTimestamp;
        bool exists;
    }

    function deposit(
        address garden,
        bytes32 strategyId,
        uint256 amount
    ) external returns (uint256 shares);

    function withdraw(
        address garden,
        bytes32 strategyId,
        uint256 shares,
        address recipient
    ) external returns (uint256 assets);

    function harvestAndDonate(
        address garden,
        bytes32 strategyId
    ) external returns (uint256 yieldAmount);

    function getPositionValue(
        address garden,
        bytes32 strategyId
    ) external view returns (
        uint256 shares,
        uint256 currentValue,
        uint256 depositedValue
    );

    function getActiveStrategies() external view returns (StrategyInfo[] memory);
}
```

```solidity
// ICrossChainController.sol (Phase 2)
interface ICrossChainController {
    function executeVaultDeposit(
        address garden,
        uint256 amount,
        bytes32 strategyId
    ) external returns (bytes32 messageId);

    function executeVaultWithdraw(
        address garden,
        uint256 shares,
        address recipient
    ) external returns (bytes32 messageId);

    function emergencyWithdraw(
        address garden
    ) external returns (bytes32 messageId);

    function getVaultPosition(
        address garden
    ) external view returns (
        uint256 shares,
        uint256 value,
        uint256 pendingRewards,
        uint256 lastUpdated
    );
}
```

#### 3.3.2 GraphQL API Interface

```graphql
type Query {
  # Get all vault positions for a garden
  gardenVaultPositions(gardenId: String!): [VaultPosition!]!

  # Get specific position
  vaultPosition(gardenId: String!, strategyId: String!): VaultPosition

  # Get available strategies
  ydsStrategies(asset: String, isActive: Boolean): [YDSStrategy!]!

  # Get cross-chain message history (Phase 2)
  crossChainMessages(
    gardenId: String!
    status: MessageStatus
    first: Int
    skip: Int
  ): [CrossChainMessage!]!

  # Get yield donation history
  yieldDonations(
    gardenId: String!
    first: Int
    skip: Int
  ): [YieldDonation!]!
}

type VaultPosition {
  id: ID!
  garden: Garden!
  strategyId: String!
  strategy: YDSStrategy!
  shares: BigInt!
  depositedValue: BigInt!
  currentValue: BigInt!
  totalYieldDonated: BigInt!
  lastUpdateTimestamp: BigInt!
}

type YDSStrategy {
  id: ID!
  address: String!
  name: String!
  asset: String!
  apy: Float
  tvl: BigInt
  minDeposit: BigInt
  maxDeposit: BigInt
  isActive: Boolean!
  donationAddress: String!
}

type YieldDonation {
  id: ID!
  garden: Garden!
  strategy: YDSStrategy!
  amount: BigInt!
  donationAddress: String!
  timestamp: BigInt!
  txHash: String!
}

enum MessageStatus {
  PENDING
  CONFIRMED
  FAILED
}
```

#### 3.3.3 Frontend Component Interface

```typescript
// types/vault.ts
export interface VaultPosition {
  id: string;
  gardenId: string;
  strategyId: string;
  strategyName: string;
  asset: Address;
  shares: bigint;
  depositedValue: bigint;
  currentValue: bigint;
  unrealizedYield: bigint;
  totalYieldDonated: bigint;
  lastUpdated: number;
}

export interface YDSStrategy {
  id: string;
  address: Address;
  name: string;
  asset: Address;
  assetSymbol: string;
  apy: number;
  tvl: bigint;
  minDeposit: bigint;
  maxDeposit: bigint | null;
  isActive: boolean;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface DepositParams {
  gardenId: string;
  strategyId: string;
  amount: bigint;
}

export interface WithdrawParams {
  gardenId: string;
  strategyId: string;
  shares: bigint;
  recipient?: Address;
}

// hooks/useVaultOperations.ts
export interface UseVaultOperations {
  // Read operations
  positions: VaultPosition[];
  strategies: YDSStrategy[];
  isLoading: boolean;
  error: Error | null;

  // Write operations
  deposit: (params: DepositParams) => Promise<TransactionResult>;
  withdraw: (params: WithdrawParams) => Promise<TransactionResult>;
  emergencyWithdraw: () => Promise<TransactionResult>;
  harvestYield: (strategyId: string) => Promise<TransactionResult>;

  // Utilities
  refetch: () => Promise<void>;
  estimateDepositShares: (strategyId: string, amount: bigint) => bigint;
  estimateWithdrawAssets: (strategyId: string, shares: bigint) => bigint;
}
```

---

## 4. System Design

### 4.1 Data Flow Diagrams

#### 4.1.1 Arbitrum-Native Deposit Flow

```
┌──────────┐  1. Click Deposit  ┌──────────┐
│ Operator │ ─────────────────▶ │   Admin  │
│  (User)  │                    │ Dashboard│
└──────────┘                    └────┬─────┘
                                     │
     2. Check Hat Permission         │
     ────────────────────────────────┼──────────────────┐
                                     │                  │
                                     ▼                  ▼
                                ┌─────────┐       ┌──────────┐
                                │ Hats    │       │ GardenTBA│
                                │Protocol │       │(Treasury)│
                                └─────────┘       └────┬─────┘
                                                       │
     3. Approve + Deposit                              │
     ──────────────────────────────────────────────────┤
                                                       │
                                                       ▼
                               ┌───────────────────────────────┐
                               │      GardenVaultManager       │
                               │  - Validate operator          │
                               │  - Transfer asset from Garden │
                               │  - Approve strategy           │
                               │  - Call strategy.deposit()    │
                               └───────────────┬───────────────┘
                                               │
     4. Deposit to Underlying Protocol         │
     ──────────────────────────────────────────┤
                                               │
                          ┌────────────────────┼────────────────────┐
                          │                    │                    │
                          ▼                    ▼                    ▼
                   ┌────────────┐       ┌────────────┐       ┌────────────┐
                   │ AaveV3YDS  │       │ YearnV3YDS │       │ Other YDS  │
                   │  Strategy  │       │  Strategy  │       │ Strategy   │
                   └──────┬─────┘       └──────┬─────┘       └──────┬─────┘
                          │                    │                    │
                          ▼                    ▼                    ▼
                   ┌────────────┐       ┌────────────┐       ┌────────────┐
                   │  Aave V3   │       │ Yearn V3   │       │   Other    │
                   │   Pool     │       │   Vault    │       │  Protocol  │
                   └────────────┘       └────────────┘       └────────────┘

     5. Return shares, emit event
     ──────────────────────────────────────────────────────────────────────
                                               │
                                               ▼
                               ┌───────────────────────────────┐
                               │         ENVIO INDEXER         │
                               │  - Index DepositExecuted      │
                               │  - Update VaultPosition       │
                               └───────────────────────────────┘
```

#### 4.1.2 Yield Harvest Flow

```
┌──────────┐  1. Trigger Harvest  ┌──────────┐
│ Chainlink│ ──────────────────▶  │ Garden   │
│Automation│  (or Manual/Keeper)  │ Vault    │
└──────────┘                      │ Manager  │
                                  └────┬─────┘
                                       │
     2. Check Position Yield           │
     ──────────────────────────────────┤
                                       │
                                       ▼
              ┌────────────────────────────────────────────┐
              │                YDS Strategy                 │
              │  currentValue = vault.convertToAssets(shares)
              │  if (currentValue > depositedValue)         │
              │      yield = currentValue - depositedValue  │
              └────────────────────────┬───────────────────┘
                                       │
     3. Convert yield to shares        │
     ──────────────────────────────────┤
                                       │
                                       ▼
              ┌────────────────────────────────────────────┐
              │         Redeem Yield Shares                 │
              │  yieldShares = vault.convertToShares(yield) │
              │  assets = vault.redeem(yieldShares, ...)    │
              └────────────────────────┬───────────────────┘
                                       │
     4. Route to Conviction Allocator  │
     ──────────────────────────────────┤
                                       │
                                       ▼
              ┌────────────────────────────────────────────┐
              │       HypercertYieldAllocator              │
              │  (See GG-TECH-007 for conviction logic)    │
              │                                            │
              │  For each Hypercert with conviction:       │
              │    allocation = yield × (conviction / Σ)   │
              │    → Purchase Hypercert fractions          │
              └────────────────────────┬───────────────────┘
                                       │
     5. Purchase Hypercert Fractions   │
     ──────────────────────────────────┤
                                       │
                                       ▼
              ┌────────────────────────────────────────────┐
              │         Hypercert Marketplace              │
              │  - Buy fractions based on conviction %     │
              │  - Fractions held by Garden Treasury       │
              │  - Increases Garden's impact ownership     │
              └────────────────────────────────────────────┘
                                       │
     6. Emit YieldAllocated event      │
     ──────────────────────────────────┘
```

**Note:** Yield is routed to the `HypercertYieldAllocator` contract which uses conviction voting percentages (from Gardens CVStrategy) to determine how yield is split across multiple Hypercerts. The yield is then used to **purchase Hypercert fractions** on the marketplace, with those fractions held by the Garden's treasury (GardenAccount TBA). This creates a direct link between vault yield and verified environmental impact ownership.

#### 4.1.3 Cross-Chain Deposit Flow (Phase 2)

```
┌──────────────────────── ARBITRUM ────────────────────────┐
│                                                           │
│  Operator ──▶ Dashboard ──▶ CrossChainController         │
│                              │                            │
│                              │ 1. Encode CCIP message     │
│                              ▼                            │
│                         CCIP Router                       │
│                              │                            │
└──────────────────────────────┼────────────────────────────┘
                               │
              2. Relay via CCIP DON (10-20 min)
                               │
┌──────────────────────────────┼────────────────────────────┐
│                              │        ETHEREUM            │
│                              ▼                            │
│                         CCIP Router                       │
│                              │                            │
│                              │ 3. Deliver message         │
│                              ▼                            │
│                       VaultController                     │
│                              │                            │
│                              │ 4. Execute deposit         │
│                              ▼                            │
│                      Octant YDS Vault                     │
│                              │                            │
│                              │ 5. Send confirmation       │
│                              ▼                            │
│                         CCIP Router                       │
│                              │                            │
└──────────────────────────────┼────────────────────────────┘
                               │
              6. Relay confirmation (10-20 min)
                               │
┌──────────────────────────────┼────────────────────────────┐
│                              │        ARBITRUM            │
│                              ▼                            │
│                    CrossChainController                   │
│                              │                            │
│                              │ 7. Update StateOracle      │
│                              ▼                            │
│                         StateOracle                       │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### 4.2 Data Model and Database Design

#### 4.2.1 Envio Entity Schema

```graphql
# Core entities
type Garden @entity {
  id: ID!                              # Garden TBA address
  nftTokenId: BigInt!
  operator: String!
  guardian: String
  vaultPositions: [VaultPosition!]! @derivedFrom(field: "garden")
  yieldDonations: [YieldDonation!]! @derivedFrom(field: "garden")
  totalValueLocked: BigInt!
  totalYieldDonated: BigInt!
  createdAt: BigInt!
  updatedAt: BigInt!
}

type VaultPosition @entity {
  id: ID!                              # {gardenId}-{strategyId}
  garden: Garden!
  strategy: YDSStrategy!
  shares: BigInt!
  depositedValue: BigInt!              # Original deposit amount
  currentValue: BigInt!                # Current value (updated on sync)
  totalYieldDonated: BigInt!           # Cumulative yield donated
  deposits: [PositionDeposit!]! @derivedFrom(field: "position")
  withdrawals: [PositionWithdrawal!]! @derivedFrom(field: "position")
  createdAt: BigInt!
  updatedAt: BigInt!
}

type YDSStrategy @entity {
  id: ID!                              # Strategy contract address
  address: String!
  name: String!
  asset: String!                       # Underlying asset address
  assetSymbol: String!
  assetDecimals: Int!
  apy: BigDecimal                      # Current APY (updated periodically)
  tvl: BigInt!                         # Total value locked
  minDeposit: BigInt!
  maxDeposit: BigInt                   # null = unlimited
  donationAddress: String!
  isActive: Boolean!
  riskLevel: String!                   # "low", "medium", "high"
  positions: [VaultPosition!]! @derivedFrom(field: "strategy")
  createdAt: BigInt!
  updatedAt: BigInt!
}

type PositionDeposit @entity {
  id: ID!                              # Transaction hash
  position: VaultPosition!
  amount: BigInt!
  shares: BigInt!
  timestamp: BigInt!
  txHash: String!
  blockNumber: BigInt!
}

type PositionWithdrawal @entity {
  id: ID!                              # Transaction hash
  position: VaultPosition!
  shares: BigInt!
  assets: BigInt!
  recipient: String!
  timestamp: BigInt!
  txHash: String!
  blockNumber: BigInt!
}

type YieldDonation @entity {
  id: ID!                              # Transaction hash
  garden: Garden!
  strategy: YDSStrategy!
  amount: BigInt!
  donationAddress: String!
  timestamp: BigInt!
  txHash: String!
  blockNumber: BigInt!
}

# Cross-chain entities (Phase 2)
type CrossChainMessage @entity {
  id: ID!                              # CCIP messageId
  garden: Garden!
  operation: String!                   # "DEPOSIT", "WITHDRAW", "EMERGENCY"
  sourceChain: Int!
  destChain: Int!
  amount: BigInt
  shares: BigInt
  strategyId: String
  status: String!                      # "PENDING", "CONFIRMED", "FAILED"
  txHashSource: String!
  txHashDest: String
  sentAt: BigInt!
  confirmedAt: BigInt
  error: String
}

type StateSync @entity {
  id: ID!                              # {gardenId}-{blockNumber}
  garden: Garden!
  shares: BigInt!
  value: BigInt!
  timestamp: BigInt!
  blockNumber: BigInt!
}
```

#### 4.2.2 Entity Relationships

```
┌───────────────┐       1:N        ┌─────────────────┐
│    Garden     │──────────────────│  VaultPosition  │
└───────────────┘                  └────────┬────────┘
       │                                    │
       │ 1:N                           N:1  │
       │                                    │
       ▼                                    ▼
┌───────────────┐                  ┌─────────────────┐
│ YieldDonation │                  │   YDSStrategy   │
└───────────────┘                  └─────────────────┘
       │
       │ N:1
       │
       ▼
┌───────────────┐       1:N        ┌─────────────────┐
│  YDSStrategy  │──────────────────│ PositionDeposit │
└───────────────┘                  └─────────────────┘
                                           │
                        VaultPosition      │
                              │            │
                              ▼            │
                       ┌──────────────┐    │
                       │ Position     │◀───┘
                       │ Withdrawal   │
                       └──────────────┘
```

### 4.3 Component Design

#### 4.3.1 Smart Contract Components

##### GardenVaultManager.sol

**Responsibilities:**
- Manage strategy registry (add, activate, deactivate)
- Track Garden vault positions
- Execute deposits and withdrawals
- Harvest and donate yield
- Validate Hats-based authorization

**Key Functions:**
```solidity
function deposit(address garden, bytes32 strategyId, uint256 amount) external
function withdraw(address garden, bytes32 strategyId, uint256 shares, address recipient) external
function harvestAndDonate(address garden, bytes32 strategyId) external
function registerStrategy(bytes32 strategyId, address strategy, ...) external
function registerGarden(address garden, uint256 operatorHatId, address donationAddress) external
```

**Dependencies:**
- IHats (Hats Protocol)
- IERC4626 (Strategy interface)
- IERC20 (Asset interface)
- SafeERC20 (OpenZeppelin)

##### AaveV3YDSStrategy.sol

**Responsibilities:**
- Wrap Aave V3 lending as YDS strategy
- Deploy funds to Aave V3 Pool
- Track deposited principal
- Report yield for donation

**Key Functions:**
```solidity
function deposit(uint256 assets, address receiver) external returns (uint256 shares)
function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares)
function totalAssets() external view returns (uint256)
function convertToAssets(uint256 shares) external view returns (uint256)
```

**Dependencies:**
- IPool (Aave V3)
- IAToken (Aave V3)
- ERC4626 (OpenZeppelin)

##### CrossChainController.sol (Phase 2)

**Responsibilities:**
- Encode and send CCIP messages
- Receive and process CCIP confirmations
- Update StateOracle on confirmation
- Track pending operations

**Key Functions:**
```solidity
function executeVaultDeposit(address garden, uint256 amount, bytes32 strategyId) external
function executeVaultWithdraw(address garden, uint256 shares, address recipient) external
function emergencyWithdraw(address garden) external
function _ccipReceive(Client.Any2EVMMessage memory message) internal
```

**Dependencies:**
- CCIPReceiver (Chainlink)
- IRouterClient (Chainlink)
- IHats (Hats Protocol)
- IStateOracle

#### 4.3.2 Frontend Components

##### VaultDashboard

**Location:** `packages/client/src/features/treasury/VaultDashboard.tsx`

**Responsibilities:**
- Display list of vault positions
- Show strategy options
- Render position cards with key metrics
- Handle deposit/withdraw actions

**Props:**
```typescript
interface VaultDashboardProps {
  gardenId: string;
}
```

**State:**
```typescript
interface VaultDashboardState {
  positions: VaultPosition[];
  strategies: YDSStrategy[];
  selectedPosition: VaultPosition | null;
  depositModalOpen: boolean;
  withdrawModalOpen: boolean;
}
```

##### DepositModal

**Location:** `packages/client/src/features/treasury/DepositModal.tsx`

**Responsibilities:**
- Strategy selection
- Amount input with max button
- Preview deposit (shares estimate, fees)
- Execute deposit transaction

**Form Schema:**
```typescript
const depositSchema = z.object({
  strategyId: z.string().min(1),
  amount: z.string().refine(val => BigInt(val) > 0n),
});
```

##### PositionCard

**Location:** `packages/client/src/features/treasury/PositionCard.tsx`

**Responsibilities:**
- Display position metrics
- Show unrealized yield
- Provide withdraw and harvest actions
- Display sync status

**Props:**
```typescript
interface PositionCardProps {
  position: VaultPosition;
  strategy: YDSStrategy;
  onWithdraw: () => void;
  onHarvest: () => void;
}
```

#### 4.3.3 Indexer Components

##### Envio Event Handlers

**File:** `packages/indexer/src/handlers/GardenVaultManager.ts`

```typescript
// Handle deposit events
GardenVaultManager.DepositExecuted.handler(async ({ event, context }) => {
  const { garden, strategyId, amount, shares } = event.params;

  // Update or create position
  const positionId = `${garden}-${strategyId}`;
  let position = await context.VaultPosition.get(positionId);

  if (!position) {
    position = {
      id: positionId,
      garden_id: garden,
      strategy_id: strategyId,
      shares: 0n,
      depositedValue: 0n,
      currentValue: 0n,
      totalYieldDonated: 0n,
      createdAt: event.block.timestamp,
      updatedAt: event.block.timestamp,
    };
  }

  position.shares += shares;
  position.depositedValue += amount;
  position.currentValue += amount; // Will be updated on sync
  position.updatedAt = event.block.timestamp;

  await context.VaultPosition.set(position);

  // Create deposit record
  await context.PositionDeposit.set({
    id: event.transaction.hash,
    position_id: positionId,
    amount,
    shares,
    timestamp: event.block.timestamp,
    txHash: event.transaction.hash,
    blockNumber: event.block.number,
  });

  // Update garden TVL
  const garden = await context.Garden.get(garden);
  if (garden) {
    garden.totalValueLocked += amount;
    garden.updatedAt = event.block.timestamp;
    await context.Garden.set(garden);
  }
});

// Handle yield donation events
GardenVaultManager.YieldDonated.handler(async ({ event, context }) => {
  const { garden, strategyId, yieldAmount, donationAddress } = event.params;

  // Create donation record
  await context.YieldDonation.set({
    id: event.transaction.hash,
    garden_id: garden,
    strategy_id: strategyId,
    amount: yieldAmount,
    donationAddress,
    timestamp: event.block.timestamp,
    txHash: event.transaction.hash,
    blockNumber: event.block.number,
  });

  // Update position
  const positionId = `${garden}-${strategyId}`;
  const position = await context.VaultPosition.get(positionId);
  if (position) {
    position.totalYieldDonated += yieldAmount;
    position.updatedAt = event.block.timestamp;
    await context.VaultPosition.set(position);
  }

  // Update garden total donated
  const gardenEntity = await context.Garden.get(garden);
  if (gardenEntity) {
    gardenEntity.totalYieldDonated += yieldAmount;
    gardenEntity.updatedAt = event.block.timestamp;
    await context.Garden.set(gardenEntity);
  }
});
```

---

## 5. Implementation Plan

### 5.1 Technology Stack

| Layer | Technology | Justification |
| :--- | :--- | :--- |
| **Smart Contracts** | Solidity 0.8.20+ | Latest features, built-in overflow protection |
| **Contract Framework** | Foundry | Fast compilation, powerful testing, fuzzing |
| **Frontend** | Vite + React 18 + TypeScript | Fast HMR, type safety, existing codebase |
| **State Management** | Zustand | Lightweight, TypeScript-first |
| **Async State** | XState | Complex transaction state machines |
| **GraphQL Client** | React Query + graphql-request | Powerful caching, TypeScript-first, minimal bundle |
| **Indexer** | Envio | TypeScript handlers, fast sync |
| **Wallet** | wagmi + viem | Modern React hooks, TypeScript |
| **AA/Passkeys** | Pimlico | ERC-4337 bundler, passkey support |
| **Cross-Chain** | Chainlink CCIP | Industry standard, battle-tested |

### 5.2 Development Environment

#### 5.2.1 Local Development Setup

```bash
# Clone repository
git clone https://github.com/greenpill-dev-guild/green-goods
cd green-goods

# Install dependencies
pnpm install

# Setup environment
cp .env.example .env.local

# Start local Anvil fork
pnpm run chain:fork:arbitrum

# Deploy contracts locally
pnpm run deploy:local

# Start indexer
pnpm run indexer:dev

# Start frontend
pnpm run dev
```

#### 5.2.2 Environment Variables

```bash
# Network Configuration
VITE_ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
VITE_ETHEREUM_RPC_URL=https://eth.llamarpc.com

# Contract Addresses (deployed)
VITE_GARDEN_VAULT_MANAGER=0x...
VITE_CROSS_CHAIN_CONTROLLER=0x...

# External Services
VITE_PIMLICO_API_KEY=...
VITE_ENVIO_API_URL=https://indexer.green-goods.xyz/graphql

# Chainlink CCIP (Phase 2)
CCIP_ROUTER_ARBITRUM=0x141fa059441E0ca23ce184B6A78bafD2A517DdE8
CCIP_ROUTER_ETHEREUM=0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D
```

### 5.3 Milestones and Timeline

| Milestone | Duration | Deliverables |
| :--- | :--- | :--- |
| **M1: Contract Development** | 2 weeks | GardenVaultManager, AaveV3YDSStrategy, tests |
| **M2: Indexer + API** | 1 week | Envio schema, handlers, GraphQL API |
| **M3: Frontend Integration** | 2 weeks | Dashboard components, deposit/withdraw flows |
| **M4: Testing + Audit Prep** | 1 week | Integration tests, documentation, audit package |
| **M5: Testnet Deployment** | 1 week | Arbitrum Sepolia deployment, QA |
| **M6: Mainnet Launch** | 1 week | Arbitrum One deployment, monitoring |
| **M7: Cross-Chain (Phase 2)** | 3 weeks | CCIP integration, Ethereum deployment |

**Total: 11 weeks** (8 weeks Phase 1, 3 weeks Phase 2)

### 5.4 Assumptions and Dependencies

#### Assumptions

1. Aave V3 and Yearn V3 remain deployed and operational on Arbitrum
2. ERC-4626 wrappers for Aave aTokens continue to function correctly
3. Hats Protocol contracts are deployed and operational
4. GardenAccount (ERC-6551) implementation is complete
5. Chainlink CCIP lane between Arbitrum and Ethereum remains active

#### Dependencies

| Dependency | Owner | Risk Level | Mitigation |
| :--- | :--- | :--- | :--- |
| Aave V3 Arbitrum | Aave DAO | Low | Multiple protocol options |
| Hats Protocol | Hats Team | Low | Fallback to simple access control |
| Chainlink CCIP | Chainlink | Low | Industry standard, SLA guarantees |
| Envio Indexer | Envio Team | Medium | Self-hosted backup option |
| Pimlico Bundler | Pimlico Team | Medium | Alternative bundler (Stackup, Biconomy) |

---

## 6. Testing and Quality Assurance

### 6.1 Testing Strategy

#### 6.1.1 Unit Testing (Smart Contracts)

**Framework:** Foundry Test

**Coverage Target:** > 95%

**Test Categories:**
- Function correctness tests
- Access control tests
- Edge case tests
- Fuzz tests for numeric operations

**Example Tests:**
```solidity
// test/GardenVaultManager.t.sol
contract GardenVaultManagerTest is Test {
    function testDeposit_Success() public {
        // Arrange
        vm.startPrank(operator);
        usdc.approve(address(vaultManager), 1000e6);

        // Act
        uint256 shares = vaultManager.deposit(garden, strategyId, 1000e6);

        // Assert
        assertGt(shares, 0);
        (uint256 posShares,,) = vaultManager.getPositionValue(garden, strategyId);
        assertEq(posShares, shares);
    }

    function testDeposit_RevertIfNotOperator() public {
        vm.prank(randomUser);
        vm.expectRevert(GardenVaultManager.NotAuthorized.selector);
        vaultManager.deposit(garden, strategyId, 1000e6);
    }

    function testFuzz_Deposit(uint256 amount) public {
        amount = bound(amount, minDeposit, maxDeposit);
        // ...
    }
}
```

#### 6.1.2 Integration Testing

**Framework:** Foundry Fork Tests + Vitest

**Test Scenarios:**
1. Full deposit flow with real Aave V3
2. Yield accrual and harvest
3. Multi-step withdrawal
4. Cross-chain message round-trip (Phase 2)

**Example:**
```solidity
// test/integration/AaveIntegration.t.sol
contract AaveIntegrationTest is Test {
    function setUp() public {
        // Fork Arbitrum mainnet
        vm.createSelectFork(vm.envString("ARBITRUM_RPC_URL"));
        // Deploy contracts
        // ...
    }

    function testFullDepositWithdrawCycle() public {
        // 1. Deposit USDC
        vaultManager.deposit(garden, aaveUsdcStrategy, 10000e6);

        // 2. Advance time to accrue yield
        vm.warp(block.timestamp + 30 days);

        // 3. Harvest yield
        uint256 yield = vaultManager.harvestAndDonate(garden, aaveUsdcStrategy);
        assertGt(yield, 0);

        // 4. Withdraw principal
        (uint256 shares,,) = vaultManager.getPositionValue(garden, aaveUsdcStrategy);
        vaultManager.withdraw(garden, aaveUsdcStrategy, shares, garden);

        // 5. Verify position closed
        (shares,,) = vaultManager.getPositionValue(garden, aaveUsdcStrategy);
        assertEq(shares, 0);
    }
}
```

#### 6.1.3 Frontend Testing

**Framework:** Vitest + React Testing Library + Playwright (E2E)

**Test Categories:**
- Component unit tests (Vitest + React Testing Library)
- Hook integration tests (Vitest)
- E2E tests (Playwright)

**Example Unit Test:**
```typescript
// src/features/treasury/__tests__/PositionCard.test.tsx
describe('PositionCard', () => {
  it('displays position value correctly', () => {
    const position = mockPosition({ currentValue: 1000000000n }); // 1000 USDC

    render(<PositionCard position={position} strategy={mockStrategy()} />);

    expect(screen.getByText('$1,000.00')).toBeInTheDocument();
  });

  it('shows unrealized yield when positive', () => {
    const position = mockPosition({
      depositedValue: 1000000000n,
      currentValue: 1050000000n, // 5% yield
    });

    render(<PositionCard position={position} strategy={mockStrategy()} />);

    expect(screen.getByText('+$50.00')).toBeInTheDocument();
    expect(screen.getByText('+5.00%')).toBeInTheDocument();
  });
});
```

**Example E2E Test (Playwright):**
```typescript
// e2e/vault-deposit.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Vault Deposit Flow', () => {
  test('operator can deposit to Aave USDC strategy', async ({ page }) => {
    // Navigate to treasury dashboard
    await page.goto('/garden/0x123.../treasury');

    // Open deposit modal
    await page.getByRole('button', { name: 'Deposit' }).click();

    // Select strategy
    await page.getByRole('combobox', { name: 'Strategy' }).click();
    await page.getByRole('option', { name: 'Aave V3 USDC' }).click();

    // Enter amount
    await page.getByLabel('Amount').fill('1000');

    // Preview should show estimated shares
    await expect(page.getByText(/~[\d,.]+ shares/)).toBeVisible();

    // Confirm deposit
    await page.getByRole('button', { name: 'Confirm Deposit' }).click();

    // Wait for transaction confirmation
    await expect(page.getByText('Deposit successful')).toBeVisible({ timeout: 30000 });

    // Verify position appears in dashboard
    await expect(page.getByTestId('position-card-aave-usdc')).toBeVisible();
    await expect(page.getByTestId('position-value')).toContainText('$1,000');
  });

  test('non-operator cannot access deposit', async ({ page }) => {
    // Connect as non-operator wallet
    await page.goto('/garden/0x123.../treasury');

    // Deposit button should be disabled
    await expect(page.getByRole('button', { name: 'Deposit' })).toBeDisabled();

    // Tooltip explains why
    await page.getByRole('button', { name: 'Deposit' }).hover();
    await expect(page.getByText('Only operators can deposit')).toBeVisible();
  });
});
```

### 6.2 Test Cases and Scenarios

#### 6.2.1 Happy Path Test Cases

| ID | Scenario | Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| TC-001 | Deposit USDC to Aave strategy | 1. Select Aave USDC strategy<br>2. Enter 1000 USDC<br>3. Confirm deposit | Shares credited, position visible |
| TC-002 | View position value | 1. Navigate to Treasury<br>2. View position card | Shows shares, value, yield |
| TC-003 | Harvest yield | 1. Wait for yield accrual<br>2. Click Harvest | Yield sent to donation address |
| TC-004 | Partial withdrawal | 1. Select position<br>2. Enter 50% shares<br>3. Confirm | Assets returned, position reduced |
| TC-005 | Full withdrawal | 1. Select position<br>2. Click Withdraw All | Position closed, all assets returned |

#### 6.2.2 Edge Case Test Cases

| ID | Scenario | Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| TC-010 | Deposit below minimum | Attempt deposit of 0.01 USDC | Error: "Below minimum deposit" |
| TC-011 | Deposit above maximum | Attempt deposit above limit | Error: "Exceeds maximum deposit" |
| TC-012 | Withdraw more than position | Attempt withdraw > shares | Error: "Insufficient balance" |
| TC-013 | Non-operator deposit | Non-operator attempts deposit | Transaction reverts |
| TC-014 | Harvest with no yield | Harvest immediately after deposit | Returns 0, no error |
| TC-015 | Strategy deactivated | Deposit to deactivated strategy | Error: "Strategy not active" |

#### 6.2.3 Security Test Cases

| ID | Scenario | Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| TC-020 | Reentrancy attack | Malicious token callback | Transaction reverts |
| TC-021 | Unauthorized emergency withdraw | Non-guardian calls emergency | Transaction reverts |
| TC-022 | Invalid CCIP source | Message from wrong chain | Transaction reverts |
| TC-023 | Invalid CCIP sender | Message from wrong address | Transaction reverts |

### 6.3 Quality Metrics

| Metric | Target | Measurement Method |
| :--- | :--- | :--- |
| Contract Test Coverage | > 95% | `forge coverage` |
| Frontend Unit Test Coverage | > 80% | Vitest coverage report |
| E2E Test Coverage | Critical paths 100% | Playwright test suite |
| Mutation Testing Score | > 80% | `gambit` for Solidity |
| Gas Optimization | < 500k gas/deposit | Foundry gas reports |
| Slither Findings | 0 High/Medium | `slither` analysis |
| Documentation Coverage | 100% public functions | NatSpec check |

---

## 7. Deployment and Maintenance

### 7.1 Deployment Strategy

#### 7.1.1 Contract Deployment Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy Contracts

on:
  push:
    branches: [main]
    paths:
      - 'packages/contracts/**'

jobs:
  deploy-testnet:
    runs-on: ubuntu-latest
    environment: testnet
    steps:
      - uses: actions/checkout@v4

      - name: Install Foundry
        uses: foundry-rs/foundry-toolchain@v1

      - name: Run Tests
        run: forge test -vvv

      - name: Deploy to Arbitrum Sepolia
        run: |
          forge script script/Deploy.s.sol:Deploy \
            --rpc-url $ARBITRUM_SEPOLIA_RPC \
            --private-key $DEPLOYER_KEY \
            --broadcast \
            --verify

      - name: Update Contract Addresses
        run: node scripts/update-addresses.js

  deploy-mainnet:
    runs-on: ubuntu-latest
    environment: mainnet
    needs: deploy-testnet
    if: github.event_name == 'workflow_dispatch'
    steps:
      # Similar to testnet with mainnet config
```

#### 7.1.2 Deployment Checklist

**Pre-Deployment:**
- [ ] All tests passing
- [ ] Slither analysis clean
- [ ] Gas costs within budget
- [ ] External audit complete (for mainnet)
- [ ] Multisig wallets configured
- [ ] Emergency contacts established

**Deployment Order (Arbitrum-Native):**
1. Deploy GardenVaultManager
2. Deploy AaveV3YDSStrategy
3. Deploy YearnV3YDSStrategy (if ready)
4. Register strategies in GardenVaultManager
5. Configure donation addresses
6. Transfer ownership to multisig

**Deployment Order (Cross-Chain - Phase 2):**
1. Deploy StateOracle (Arbitrum)
2. Deploy CrossChainController (Arbitrum)
3. Deploy HatsMirror (Ethereum)
4. Deploy VaultController (Ethereum)
5. Configure CCIP lanes
6. Register strategies
7. Transfer ownership to multisig

#### 7.1.3 Rollback Plan

1. **Contract Issue Detected:**
   - Pause affected contracts via Pausable
   - Assess damage and user impact
   - Deploy patched contracts
   - Migrate state if necessary
   - Resume operations

2. **Frontend Issue Detected:**
   - Revert to previous deployment via Vercel
   - Investigate and fix
   - Deploy hotfix

3. **Indexer Issue Detected:**
   - Roll back to previous known-good state
   - Reindex from checkpoint
   - Deploy fix

### 7.2 Maintenance and Support

#### 7.2.1 Monitoring

**Contract Monitoring:**
- OpenZeppelin Defender for transaction monitoring
- Tenderly alerts for failed transactions
- Custom Grafana dashboards for TVL, yield, operations

**Frontend Monitoring:**
- Sentry for error tracking
- Vercel Analytics for performance
- Custom metrics for transaction success rates

**Indexer Monitoring:**
- Envio dashboard for sync status
- Alerts for sync lag > 100 blocks

#### 7.2.2 Operational Procedures

**Daily:**
- Check indexer sync status
- Review failed transactions
- Monitor TVL and yield metrics

**Weekly:**
- Review gas costs and optimize if needed
- Check for new Aave/Yearn upgrades
- Update APY data in UI

**Monthly:**
- Security review of new dependencies
- Performance optimization review
- Documentation updates

#### 7.2.3 Incident Response

| Severity | Response Time | Escalation |
| :--- | :--- | :--- |
| Critical (funds at risk) | < 15 minutes | Immediate multisig action |
| High (feature broken) | < 1 hour | Engineering lead |
| Medium (degraded performance) | < 4 hours | On-call engineer |
| Low (minor bug) | < 24 hours | Regular sprint |

---

## 8. Risk Management

### 8.1 Risk Analysis

| Risk | Likelihood | Impact | Score |
| :--- | :--- | :--- | :--- |
| Smart contract vulnerability | Low | Critical | High |
| Aave V3 protocol exploit | Low | Critical | High |
| CCIP message stuck (Phase 2) | Low | High | Medium |
| Yield fluctuation | High | Low | Medium |
| Arbitrum sequencer downtime | Low | Medium | Low |
| Indexer desync | Medium | Low | Low |
| Key compromise | Low | Critical | High |

### 8.2 Mitigation Strategies

| Risk | Mitigation |
| :--- | :--- |
| Smart contract vulnerability | External audit, formal verification, bug bounty |
| Aave V3 protocol exploit | Diversify across strategies, implement emergency withdraw |
| CCIP message stuck | Manual execution fallback, monitoring alerts |
| Yield fluctuation | Set user expectations, show historical ranges |
| Arbitrum sequencer downtime | Graceful degradation, cached state display |
| Indexer desync | Multiple data sources, fallback to direct RPC |
| Key compromise | Multisig, timelocks, Guardian role separation |

---

## 9. Appendices

### 9.1 Glossary

| Term | Definition |
| :--- | :--- |
| **Conviction Voting** | Time-weighted voting mechanism where support accumulates over time |
| **Dragon Vault** | Octant V2 vault with Safe integration for institutional treasuries |
| **Funding Vault** | ERC-4626 vault that deploys capital into DeFi yield strategies |
| **Half-Life** | Time for conviction to reach 50% of maximum potential |
| **Payment Splitter** | Contract that distributes funds to multiple recipients |
| **Threshold** | Conviction level required for a proposal to pass |

### 9.2 Supporting Documentation

**Architecture Decision Records:**
- ADR-001: Arbitrum-Native vs Cross-Chain Architecture
- ADR-002: Aave V3 vs Compound V3 for Base Strategy
- ADR-003: ERC-4626 Wrapper Selection

**API Documentation:**
- GraphQL Schema: `/packages/indexer/schema.graphql`
- Contract ABIs: `/packages/contracts/out/`

**Design Files:**
- Figma: [Vault Dashboard Designs]
- Sequence Diagrams: `/docs/diagrams/`

---

## Changelog

| Version | Date | Author | Changes |
| :--- | :--- | :--- | :--- |
| 1.0 | Jan 18, 2026 | Engineering | Initial specification |

---

*End of Technical Specification*
