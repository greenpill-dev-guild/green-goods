# GG-TECH-007: Gardens Conviction Voting Technical Specification

**Document ID:** GG-TECH-007
**Feature Reference:** GG-FEAT-007
**Version:** 1.0
**Status:** Draft
**Last Updated:** January 18, 2026
**Author:** Engineering Team

---

## 1. Overview

### 1.1 Purpose

This technical specification defines the implementation details for integrating Gardens V2 Conviction Voting with Green Goods yield allocation. The system enables Garden members to use conviction voting to determine how vault yield is allocated across multiple Hypercerts, with yield being used to **purchase Hypercert fractions** on behalf of the Garden treasury.

This specification serves as the engineering blueprint for:
- Conviction voting pool configuration and management
- Yield-to-Hypercert allocation logic
- Integration with Gardens V2 CVStrategy contracts
- Action Registry for community-proposed initiatives
- Frontend governance dashboard components
- Indexer schema for conviction state tracking

### 1.2 Scope

**In Scope:**
- Gardens V2 CVStrategy adapter contracts
- HypercertYieldAllocator contract for yield routing
- Action Registry for open proposal submission
- Conviction voting pool creation and configuration
- Member staking and conviction allocation
- Proposal lifecycle management (create, vote, execute)
- Integration with GardenVaultManager (GG-TECH-006)
- Governance dashboard UI components
- Envio indexer handlers for conviction state

**Out of Scope:**
- Vault deposit/withdrawal logic (see GG-TECH-006)
- Hypercert minting and verification (see GG-TECH-005)
- Cross-chain conviction voting (all voting on Arbitrum)
- Quadratic voting (Phase 2 enhancement)
- Streaming proposals via Superfluid (not yet in Gardens V2)
- Dispute arbitration implementation (uses existing Kleros/Safe)

### 1.3 Definitions, Acronyms, and Abbreviations

| Term | Definition |
| :--- | :--- |
| **Conviction** | Time-weighted voting power that accumulates while tokens are allocated |
| **Half-Life** | Time for conviction to reach 50% of maximum potential |
| **Threshold** | Conviction level required for a proposal to pass and execute |
| **CVStrategy** | Gardens V2 Conviction Voting Strategy contract |
| **CVVault** | ERC-4626 vault that tracks depositors as voting power |
| **RegistryCommunity** | Gardens contract managing community membership and tokens |
| **Funding Pool** | Pool type where passed proposals transfer tokens |
| **Signaling Pool** | Pool type for expressing preferences (no token transfer) |
| **Action Registry** | Open registry where anyone can propose Garden actions |
| **Garden Token** | ERC-20 governance token for conviction voting |
| **Hypercert Fraction** | Fungible share of a Hypercert representing impact ownership |

### 1.4 References

| Document | Description |
| :--- | :--- |
| GG-FEAT-007 | Gardens Conviction Voting Feature Specification |
| GG-TECH-006 | Octant Vaults Technical Specification |
| GG-FEAT-005 | Hypercerts Minting Feature Specification |
| GG-PRD-001 | Green Goods v1 Product Requirements Document |
| Gardens V2 Docs | https://docs.gardens.fund |
| Gardens V2 Contracts | https://github.com/1Hive/gardens-v2 |
| CVVault PR #714 | https://github.com/1Hive/gardens-v2/pull/714 |
| Hypercerts Docs | https://hypercerts.org/docs |
| Allo V2 Protocol | https://docs.allo.gitcoin.co |

---

## 2. System Overview

### 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ARBITRUM ONE                                    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    GARDENS V2 INTEGRATION LAYER                      │    │
│  │                                                                      │    │
│  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────────┐   │    │
│  │  │ Registry    │   │  CVStrategy │   │   CVVault (optional)    │   │    │
│  │  │ Community   │──▶│  (Funding   │──▶│   ERC-4626 for yield    │   │    │
│  │  │             │   │   Pool)     │   │   distribution pools    │   │    │
│  │  └──────┬──────┘   └──────┬──────┘   └─────────────────────────┘   │    │
│  │         │                 │                                         │    │
│  │         │ Garden Token    │ Conviction State                        │    │
│  │         ▼                 ▼                                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                               │
│  ┌───────────────────────────┼───────────────────────────────────────────┐  │
│  │                           │     GREEN GOODS ADAPTER LAYER              │  │
│  │                           ▼                                            │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │              HypercertYieldAllocator                             │  │  │
│  │  │  ┌──────────────────────────────────────────────────────────┐   │  │  │
│  │  │  │  - Reads conviction state from CVStrategy                │   │  │  │
│  │  │  │  - Calculates yield allocation per Hypercert             │   │  │  │
│  │  │  │  - Executes Hypercert fraction purchases                 │   │  │  │
│  │  │  │  - Routes purchased fractions to Garden Treasury         │   │  │  │
│  │  │  └──────────────────────────────────────────────────────────┘   │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  │         │                                                              │  │
│  │         │                  ┌─────────────────────────────────────┐    │  │
│  │         │                  │         Action Registry              │    │  │
│  │         │                  │  - Open proposal submission          │    │  │
│  │         │                  │  - Hypercert-linked proposals        │    │  │
│  │         │                  │  - Action priority signaling         │    │  │
│  │         │                  └─────────────────────────────────────┘    │  │
│  │         │                                                              │  │
│  └─────────┼──────────────────────────────────────────────────────────────┘  │
│            │                                                                  │
│            ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         INTEGRATION POINTS                               │ │
│  │                                                                          │ │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────────┐  │ │
│  │  │ GardenVault │    │ Hypercert   │    │     GardenAccount           │  │ │
│  │  │ Manager     │───▶│ Marketplace │───▶│     (ERC-6551 TBA)          │  │ │
│  │  │ (Yield)     │    │ (Purchase)  │    │     Treasury                │  │ │
│  │  └─────────────┘    └─────────────┘    └─────────────────────────────┘  │ │
│  │                                                                          │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │                           ENVIO INDEXER                                   │ │
│  │  - Proposal entities with conviction state                               │ │
│  │  - Member allocation tracking                                            │ │
│  │  - Yield allocation history                                              │ │
│  │  - Hypercert purchase records                                            │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Environment

#### 2.2.1 Development Environment

| Component | Technology | Version |
| :--- | :--- | :--- |
| Smart Contracts | Solidity | ^0.8.19 |
| Contract Framework | Foundry | Latest |
| Frontend | Vite + React + TypeScript | Vite 5.x, React 18.x |
| State Management | Zustand + XState | 4.x, 5.x |
| GraphQL Client | React Query + graphql-request | 5.x |
| Indexer | Envio | Latest |
| Testing | Foundry (contracts), Vitest + Playwright (frontend) | Latest |

#### 2.2.2 External Dependencies

| Dependency | Network | Address |
| :--- | :--- | :--- |
| Gardens RegistryFactory | Arbitrum One | `0x...` (TBD - deploy as contributor) |
| Allo V2 Registry | Arbitrum One | `0x4AAcca72145e1dF2aeC137E1f3C5E3D75DB8b5f3` |
| HypercertMinter | Arbitrum One | `0x822F17A9A5EeCFd66dBAFf7946a8071C265D1d07` |
| Hats Protocol | Arbitrum One | `0x3bc1A0Ad72417f2d411118085256fC53CBdDd137` |
| GardenVaultManager | Arbitrum One | `0x...` (from GG-TECH-006) |

---

## 3. Detailed Requirements

### 3.1 Functional Requirements

#### 3.1.1 Conviction Voting Core

| ID | Title | Description | Priority | Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- |
| FR-101 | Create Funding Pool | Operators can create conviction voting pools for yield allocation | Critical | Pool created with configurable parameters |
| FR-102 | Stake Governance Tokens | Members can stake Garden tokens to participate in voting | Critical | Tokens staked, voting power registered |
| FR-103 | Allocate Conviction | Members can allocate staked tokens to proposals | Critical | Conviction accumulates over time on supported proposals |
| FR-104 | Remove Conviction | Members can remove support from proposals | High | Conviction removed, tokens available for reallocation |
| FR-105 | View Conviction State | System displays current conviction for all proposals | High | Real-time conviction percentages visible |

#### 3.1.2 Proposal Management

| ID | Title | Description | Priority | Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- |
| FR-110 | Create Hypercert Proposal | Anyone can propose yield allocation to a specific Hypercert | Critical | Proposal created with Hypercert ID, metadata |
| FR-111 | Create Action Proposal | Anyone can propose actions for Garden prioritization | High | Proposal created in Action Registry |
| FR-112 | Execute Passed Proposal | Anyone can trigger execution when threshold reached | Critical | Yield allocated, Hypercert fractions purchased |
| FR-113 | Dispute Proposal | Members can challenge suspicious proposals | Medium | Proposal enters disputed state, arbitration triggered |
| FR-114 | Cancel Proposal | Proposer can cancel their own unexecuted proposal | Low | Proposal cancelled, no yield allocated |

#### 3.1.3 Yield Allocation

| ID | Title | Description | Priority | Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- |
| FR-120 | Conviction-Based Allocation | System allocates yield proportionally to conviction percentages | Critical | allocation = yield × (conviction / Σ convictions) |
| FR-121 | Purchase Hypercert Fractions | System uses allocated yield to buy Hypercert fractions | Critical | Fractions purchased on marketplace, held by Garden |
| FR-122 | Route to Garden Treasury | Purchased fractions deposited to GardenAccount TBA | Critical | Fractions visible in Garden treasury |
| FR-123 | Minimum Allocation Threshold | Skip allocation for proposals below minimum yield amount | Medium | Small allocations batched or skipped |

#### 3.1.4 Action Registry

| ID | Title | Description | Priority | Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- |
| FR-130 | Register Action | Anyone can register an action in the open registry | High | Action registered with metadata, coordinator |
| FR-131 | Link Action to Hypercert | Actions can be linked to existing Hypercerts | High | Action displays linked Hypercert verification status |
| FR-132 | Prioritize Actions | Conviction voting determines action priority ranking | High | Actions ranked by relative conviction |
| FR-133 | Archive Completed Actions | Completed actions archived with outcome metadata | Low | Historical record of Garden activities |

### 3.2 Non-Functional Requirements

#### 3.2.1 Performance

| Metric | Requirement | Target |
| :--- | :--- | :--- |
| Conviction Calculation | Gas cost per update | < 100,000 gas |
| Allocation Execution | Gas cost per Hypercert | < 200,000 gas |
| Conviction Query | API response time | < 200ms |
| Dashboard Load | Initial governance dashboard | < 2 seconds |

#### 3.2.2 Scalability

| Metric | Requirement |
| :--- | :--- |
| Concurrent Proposals | Support 100+ active proposals per pool |
| Members per Pool | Support 1,000+ staking members |
| Conviction Updates | Support 10,000+ allocations per day |
| Action Registry | Support 10,000+ registered actions |

#### 3.2.3 Security

| Requirement | Implementation |
| :--- | :--- |
| Sybil Resistance | Passport scoring integration (optional) |
| Flash Loan Protection | Snapshot conviction at allocation time |
| Griefing Protection | Minimum stake requirements |
| Dispute Resolution | Kleros or Safe Arbitrator integration |

### 3.3 Interface Requirements

#### 3.3.1 Smart Contract Interfaces

```solidity
// IHypercertYieldAllocator.sol
interface IHypercertYieldAllocator {
    struct AllocationConfig {
        address cvStrategy;           // Gardens CVStrategy address
        address hypercertMinter;      // Hypercerts contract
        address gardenAccount;        // Destination for purchased fractions
        uint256 minAllocationAmount;  // Minimum yield to allocate
        uint256 allocationCooldown;   // Time between allocations
    }

    struct HypercertAllocation {
        uint256 hypercertId;
        uint256 yieldAmount;
        uint256 fractionsPurchased;
        uint256 timestamp;
    }

    /// @notice Allocate yield based on conviction voting state
    /// @param totalYield Total yield to allocate
    /// @return allocations Array of allocations made
    function allocateYield(
        uint256 totalYield
    ) external returns (HypercertAllocation[] memory allocations);

    /// @notice Get current allocation percentages based on conviction
    /// @return hypercertIds Array of Hypercert IDs
    /// @return percentages Array of allocation percentages (basis points)
    function getAllocationPercentages() external view returns (
        uint256[] memory hypercertIds,
        uint256[] memory percentages
    );

    /// @notice Get conviction state for a specific Hypercert proposal
    function getProposalConviction(
        uint256 proposalId
    ) external view returns (
        uint256 conviction,
        uint256 threshold,
        uint256 stakedTokens,
        uint256 supportersCount
    );
}
```

```solidity
// IActionRegistry.sol
interface IActionRegistry {
    struct Action {
        bytes32 id;
        address proposer;
        address coordinator;
        string title;
        string description;
        string metadataURI;          // IPFS hash with full details
        uint256 hypercertId;         // Optional linked Hypercert
        uint256 estimatedCost;
        ActionStatus status;
        uint256 createdAt;
        uint256 completedAt;
    }

    enum ActionStatus {
        Proposed,
        Active,
        Completed,
        Cancelled
    }

    /// @notice Register a new action in the registry
    function registerAction(
        string calldata title,
        string calldata description,
        string calldata metadataURI,
        address coordinator,
        uint256 hypercertId,
        uint256 estimatedCost
    ) external returns (bytes32 actionId);

    /// @notice Link an existing Hypercert to an action
    function linkHypercert(
        bytes32 actionId,
        uint256 hypercertId
    ) external;

    /// @notice Mark action as completed with outcome
    function completeAction(
        bytes32 actionId,
        string calldata outcomeURI
    ) external;

    /// @notice Get actions sorted by conviction priority
    function getActionsByPriority(
        address cvStrategy,
        uint256 limit
    ) external view returns (Action[] memory);
}
```

```solidity
// IGardenConvictionAdapter.sol
interface IGardenConvictionAdapter {
    /// @notice Create a Hypercert funding proposal in Gardens CVStrategy
    function createHypercertProposal(
        uint256 hypercertId,
        uint256 requestedAmount,
        string calldata metadata
    ) external returns (uint256 proposalId);

    /// @notice Allocate conviction to a proposal
    function allocateConviction(
        uint256 proposalId,
        uint256 amount
    ) external;

    /// @notice Remove conviction from a proposal
    function removeConviction(
        uint256 proposalId,
        uint256 amount
    ) external;

    /// @notice Execute a passed proposal (triggers yield allocation)
    function executeProposal(
        uint256 proposalId
    ) external returns (uint256 yieldAllocated);

    /// @notice Get member's staking and allocation state
    function getMemberState(
        address member
    ) external view returns (
        uint256 stakedBalance,
        uint256 availableToAllocate,
        uint256[] memory allocatedProposals,
        uint256[] memory allocationAmounts
    );
}
```

#### 3.3.2 GraphQL API Interface

```graphql
type Query {
  # Get all active proposals in a conviction pool
  proposals(
    poolId: String!
    status: ProposalStatus
    orderBy: ProposalOrderBy
    first: Int
    skip: Int
  ): [Proposal!]!

  # Get specific proposal details
  proposal(proposalId: String!): Proposal

  # Get member's conviction allocations
  memberAllocations(member: String!, poolId: String!): [Allocation!]!

  # Get pool state and parameters
  convictionPool(poolId: String!): ConvictionPool

  # Get actions from registry
  actions(
    status: ActionStatus
    orderBy: ActionOrderBy
    first: Int
    skip: Int
  ): [Action!]!

  # Get yield allocation history
  yieldAllocations(
    gardenId: String!
    first: Int
    skip: Int
  ): [YieldAllocation!]!
}

type Proposal {
  id: ID!
  proposer: String!
  hypercertId: String
  title: String!
  description: String!
  metadataURI: String!
  requestedAmount: BigInt!
  conviction: BigInt!
  convictionLast: BigInt!
  threshold: BigInt!
  stakedTokens: BigInt!
  supportersCount: Int!
  status: ProposalStatus!
  createdAt: BigInt!
  executedAt: BigInt
  pool: ConvictionPool!
  allocations: [Allocation!]! @derivedFrom(field: "proposal")
}

type Allocation {
  id: ID!
  member: String!
  proposal: Proposal!
  amount: BigInt!
  conviction: BigInt!
  allocatedAt: BigInt!
  lastUpdated: BigInt!
}

type ConvictionPool {
  id: ID!
  garden: Garden!
  name: String!
  token: String!
  totalStaked: BigInt!
  totalConviction: BigInt!
  proposalCount: Int!
  activeProposals: Int!
  parameters: ConvictionParameters!
  proposals: [Proposal!]! @derivedFrom(field: "pool")
}

type ConvictionParameters {
  id: ID!
  convictionGrowth: BigInt!      # Half-life in seconds
  minConviction: BigInt!          # Minimum % for any proposal
  spendingLimit: BigInt!          # Max % of pool per proposal
  fixedMinThreshold: BigInt!      # Override for small pools
}

type Action {
  id: ID!
  proposer: String!
  coordinator: String!
  title: String!
  description: String!
  metadataURI: String!
  hypercertId: String
  hypercert: Hypercert
  estimatedCost: BigInt
  conviction: BigInt              # From linked CVStrategy proposal
  status: ActionStatus!
  createdAt: BigInt!
  completedAt: BigInt
}

type YieldAllocation {
  id: ID!
  garden: Garden!
  proposal: Proposal!
  hypercertId: String!
  yieldAmount: BigInt!
  fractionsPurchased: BigInt!
  pricePerFraction: BigInt!
  timestamp: BigInt!
  txHash: String!
}

enum ProposalStatus {
  Active
  Passed
  Executed
  Cancelled
  Disputed
}

enum ActionStatus {
  Proposed
  Active
  Completed
  Cancelled
}

enum ProposalOrderBy {
  conviction
  createdAt
  requestedAmount
  supportersCount
}

enum ActionOrderBy {
  conviction
  createdAt
  estimatedCost
}
```

#### 3.3.3 Frontend Component Interface

```typescript
// types/conviction.ts
export interface Proposal {
  id: string;
  proposer: Address;
  hypercertId: string | null;
  title: string;
  description: string;
  metadataURI: string;
  requestedAmount: bigint;
  conviction: bigint;
  threshold: bigint;
  convictionPercentage: number;  // conviction / threshold as %
  stakedTokens: bigint;
  supportersCount: number;
  status: ProposalStatus;
  estimatedTimeToPass: number | null;  // seconds, null if not enough support
  createdAt: number;
  executedAt: number | null;
}

export interface MemberAllocation {
  proposalId: string;
  proposal: Proposal;
  amount: bigint;
  conviction: bigint;
  allocatedAt: number;
}

export interface MemberState {
  stakedBalance: bigint;
  availableToAllocate: bigint;
  allocations: MemberAllocation[];
  totalAllocated: bigint;
}

export interface ConvictionPool {
  id: string;
  gardenId: string;
  name: string;
  token: Address;
  tokenSymbol: string;
  totalStaked: bigint;
  activeProposals: number;
  parameters: ConvictionParameters;
}

export interface ConvictionParameters {
  convictionGrowth: number;      // Half-life in days
  minConviction: number;         // Percentage (0-100)
  spendingLimit: number;         // Percentage (0-100)
  fixedMinThreshold: number;     // Percentage (0-100)
}

export interface Action {
  id: string;
  proposer: Address;
  coordinator: Address;
  title: string;
  description: string;
  hypercertId: string | null;
  estimatedCost: bigint | null;
  conviction: bigint | null;     // From linked proposal
  convictionRank: number | null; // 1 = highest priority
  status: ActionStatus;
}

// hooks/useConvictionVoting.ts
export interface UseConvictionVoting {
  // Read state
  pool: ConvictionPool | null;
  proposals: Proposal[];
  memberState: MemberState | null;
  isLoading: boolean;
  error: Error | null;

  // Write operations
  createProposal: (params: CreateProposalParams) => Promise<TransactionResult>;
  allocateConviction: (proposalId: string, amount: bigint) => Promise<TransactionResult>;
  removeConviction: (proposalId: string, amount: bigint) => Promise<TransactionResult>;
  executeProposal: (proposalId: string) => Promise<TransactionResult>;

  // Utilities
  refetch: () => Promise<void>;
  estimateTimeToPass: (proposalId: string, additionalSupport: bigint) => number | null;
  calculateConvictionGrowth: (amount: bigint, days: number) => bigint;
}

// hooks/useActionRegistry.ts
export interface UseActionRegistry {
  actions: Action[];
  actionsByPriority: Action[];
  isLoading: boolean;

  registerAction: (params: RegisterActionParams) => Promise<TransactionResult>;
  linkHypercert: (actionId: string, hypercertId: string) => Promise<TransactionResult>;
  completeAction: (actionId: string, outcomeURI: string) => Promise<TransactionResult>;
}
```

---

## 4. System Design

### 4.1 Data Flow Diagrams

#### 4.1.1 Conviction Voting and Yield Allocation Flow

```
┌──────────────┐  1. Stake Tokens   ┌──────────────┐
│   Garden     │ ─────────────────▶ │  Registry    │
│   Member     │                    │  Community   │
└──────────────┘                    └──────┬───────┘
       │                                   │
       │ 2. Create Proposal                │ Register Member
       ▼                                   ▼
┌──────────────┐                   ┌──────────────┐
│   Action     │                   │  CVStrategy  │
│   Registry   │◀─────────────────▶│   (Pool)     │
└──────────────┘  Link Action       └──────┬───────┘
                  to Proposal              │
                                           │
       ┌───────────────────────────────────┤
       │                                   │
       │ 3. Allocate Conviction            │ 4. Conviction
       │    to Hypercert Proposal          │    Accumulates
       ▼                                   ▼
┌──────────────┐                   ┌──────────────┐
│   Proposal   │                   │  Conviction  │
│  (Hypercert  │◀──────────────────│    State     │
│   #1234)     │   Time-weighted   └──────────────┘
└──────┬───────┘   accumulation
       │
       │ 5. Threshold Reached
       ▼
┌──────────────────────────────────────────────────────────────┐
│                    YIELD ALLOCATION TRIGGER                   │
│  (Called by Keeper, Automation, or Manual execution)         │
└──────────────────────────────────────────────────────────────┘
       │
       │ 6. Read Conviction Percentages
       ▼
┌──────────────────────────────────────────────────────────────┐
│                  HypercertYieldAllocator                      │
│                                                               │
│  Total Yield: 1000 USDC                                      │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Hypercert #1234: 45% conviction → 450 USDC allocation   │ │
│  │ Hypercert #5678: 30% conviction → 300 USDC allocation   │ │
│  │ Hypercert #9012: 25% conviction → 250 USDC allocation   │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
       │
       │ 7. Purchase Hypercert Fractions
       ▼
┌──────────────────────────────────────────────────────────────┐
│                  Hypercert Marketplace                        │
│                                                               │
│  For each allocation:                                        │
│  - Find available fractions for sale                         │
│  - Execute purchase at market price                          │
│  - Transfer fractions to Garden Treasury                     │
└──────────────────────────────────────────────────────────────┘
       │
       │ 8. Deposit to Garden Treasury
       ▼
┌──────────────────────────────────────────────────────────────┐
│                  GardenAccount (ERC-6551 TBA)                │
│                                                               │
│  Holdings:                                                   │
│  - 50 fractions of Hypercert #1234                          │
│  - 30 fractions of Hypercert #5678                          │
│  - 25 fractions of Hypercert #9012                          │
│                                                               │
│  → Garden now owns verified impact!                          │
└──────────────────────────────────────────────────────────────┘
       │
       │ 9. Emit Events
       ▼
┌──────────────────────────────────────────────────────────────┐
│                      ENVIO INDEXER                            │
│  - YieldAllocated event                                      │
│  - HypercertFractionsPurchased event                         │
│  - Update proposal status to Executed                        │
└──────────────────────────────────────────────────────────────┘
```

#### 4.1.2 Action Registry and Signaling Flow

```
┌──────────────┐  1. Register Action  ┌──────────────┐
│   Anyone     │ ──────────────────▶  │   Action     │
│  (Proposer)  │                      │   Registry   │
└──────────────┘                      └──────┬───────┘
                                             │
       ┌─────────────────────────────────────┤
       │                                     │
       │ 2. Create Signaling                 │ Store Action
       │    Proposal in CVStrategy           │ Metadata
       ▼                                     ▼
┌──────────────┐                     ┌──────────────┐
│  CVStrategy  │                     │   Action     │
│  (Signaling  │◀────────────────────│   #abc123    │
│   Pool)      │   Link Proposal      │              │
└──────┬───────┘   to Action          │ - Title      │
       │                              │ - Coordinator│
       │ 3. Members Allocate          │ - Hypercert  │
       │    Conviction                │ - Cost Est.  │
       ▼                              └──────────────┘
┌──────────────┐
│  Conviction  │
│   State      │
│              │
│ Action A: 45%│
│ Action B: 30%│
│ Action C: 25%│
└──────┬───────┘
       │
       │ 4. Priority Ranking
       │    (No execution, just signal)
       ▼
┌──────────────────────────────────────────────────────────────┐
│                  GARDEN OPERATOR DASHBOARD                    │
│                                                               │
│  Action Priority (based on conviction):                      │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ 1. 🌱 Expand Garden Plots      (45% conviction)         │ │
│  │ 2. 🔧 Improve Compost System   (30% conviction)         │ │
│  │ 3. 📚 Host Community Workshop  (25% conviction)         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  → Operator uses this to guide resource allocation           │
└──────────────────────────────────────────────────────────────┘
       │
       │ 5. When Action Completed
       ▼
┌──────────────┐  6. Link Hypercert  ┌──────────────┐
│   Operator   │ ──────────────────▶ │   Action     │
│  (Verifier)  │                     │   Registry   │
└──────────────┘                     └──────┬───────┘
                                            │
       ┌────────────────────────────────────┤
       │                                    │
       │ 7. Action now eligible             │ Update Status
       │    for Funding Pool               │ to Completed
       ▼                                    ▼
┌──────────────┐                    ┌──────────────┐
│   Funding    │                    │ Hypercert    │
│   Pool       │◀───────────────────│ #xyz789      │
│  (Model A)   │  Create Proposal   │ (Verified)   │
└──────────────┘  for Retrospective └──────────────┘
                  Funding
```

### 4.2 Data Model and Database Design

#### 4.2.1 Envio Entity Schema

```graphql
# Conviction Voting Entities
type ConvictionPool @entity {
  id: ID!                              # CVStrategy address
  garden: Garden!
  name: String!
  token: String!                       # Governance token address
  tokenSymbol: String!
  tokenDecimals: Int!
  poolType: String!                    # "funding" or "signaling"
  totalStaked: BigInt!
  totalConviction: BigInt!
  proposalCount: Int!
  activeProposals: Int!
  executedProposals: Int!

  # Parameters
  convictionGrowth: BigInt!            # Half-life in seconds
  minConviction: BigInt!
  spendingLimit: BigInt!
  fixedMinThreshold: BigInt!

  # Relations
  proposals: [Proposal!]! @derivedFrom(field: "pool")
  members: [PoolMember!]! @derivedFrom(field: "pool")

  createdAt: BigInt!
  updatedAt: BigInt!
}

type Proposal @entity {
  id: ID!                              # Proposal ID from CVStrategy
  pool: ConvictionPool!
  proposer: String!

  # Proposal details
  title: String!
  description: String!
  metadataURI: String!
  requestedAmount: BigInt!
  beneficiary: String!

  # Hypercert link (for funding proposals)
  hypercertId: String
  hypercert: Hypercert

  # Action link (for signaling proposals)
  actionId: String
  action: Action

  # Conviction state
  conviction: BigInt!
  convictionLast: BigInt!
  threshold: BigInt!
  stakedTokens: BigInt!
  supportersCount: Int!

  # Status
  status: String!                      # Active, Passed, Executed, Cancelled, Disputed

  # Execution details
  executedAt: BigInt
  yieldAllocated: BigInt
  fractionsPurchased: BigInt

  # Relations
  allocations: [Allocation!]! @derivedFrom(field: "proposal")

  createdAt: BigInt!
  updatedAt: BigInt!
}

type Allocation @entity {
  id: ID!                              # {member}-{proposal}
  member: PoolMember!
  proposal: Proposal!
  amount: BigInt!
  conviction: BigInt!
  allocatedAt: BigInt!
  lastUpdated: BigInt!
}

type PoolMember @entity {
  id: ID!                              # {pool}-{member}
  pool: ConvictionPool!
  member: String!
  stakedBalance: BigInt!
  totalAllocated: BigInt!
  availableToAllocate: BigInt!
  allocations: [Allocation!]! @derivedFrom(field: "member")
  joinedAt: BigInt!
  lastActiveAt: BigInt!
}

# Action Registry Entities
type Action @entity {
  id: ID!                              # Action ID (bytes32)
  proposer: String!
  coordinator: String!
  title: String!
  description: String!
  metadataURI: String!

  # Optional Hypercert link
  hypercertId: String
  hypercert: Hypercert

  estimatedCost: BigInt

  # Linked CVStrategy proposal for conviction
  signalingProposalId: String
  signalingProposal: Proposal
  conviction: BigInt                   # Cached from proposal

  # Status
  status: String!                      # Proposed, Active, Completed, Cancelled
  outcomeURI: String                   # Set when completed

  createdAt: BigInt!
  completedAt: BigInt
  updatedAt: BigInt!
}

# Yield Allocation Tracking
type YieldAllocation @entity {
  id: ID!                              # Transaction hash
  garden: Garden!
  pool: ConvictionPool!

  totalYield: BigInt!

  # Individual allocations
  allocations: [HypercertAllocation!]! @derivedFrom(field: "yieldAllocation")

  timestamp: BigInt!
  txHash: String!
  blockNumber: BigInt!
}

type HypercertAllocation @entity {
  id: ID!                              # {yieldAllocation}-{hypercertId}
  yieldAllocation: YieldAllocation!
  proposal: Proposal!
  hypercertId: String!
  hypercert: Hypercert!

  yieldAmount: BigInt!
  convictionPercentage: BigInt!        # Basis points
  fractionsPurchased: BigInt!
  pricePerFraction: BigInt!

  # Destination
  gardenAccount: String!               # GardenAccount TBA that received fractions
}

# Cross-reference to existing entities
type Garden @entity {
  id: ID!
  # ... existing fields from GG-TECH-006
  convictionPools: [ConvictionPool!]! @derivedFrom(field: "garden")
  yieldAllocations: [YieldAllocation!]! @derivedFrom(field: "garden")
}

type Hypercert @entity {
  id: ID!                              # Hypercert token ID
  # ... fields from GG-TECH-005
  fundingProposals: [Proposal!]! @derivedFrom(field: "hypercert")
  linkedActions: [Action!]! @derivedFrom(field: "hypercert")
  allocations: [HypercertAllocation!]! @derivedFrom(field: "hypercert")
}
```

### 4.3 Component Design

#### 4.3.1 Smart Contract Components

##### HypercertYieldAllocator.sol

**Responsibilities:**
- Read conviction state from Gardens CVStrategy
- Calculate yield allocation percentages
- Execute Hypercert fraction purchases
- Route fractions to Garden treasury

**Key Functions:**
```solidity
function allocateYield(uint256 totalYield) external returns (HypercertAllocation[] memory)
function getAllocationPercentages() external view returns (uint256[] memory, uint256[] memory)
function setMinAllocationAmount(uint256 amount) external
function setHypercertMarketplace(address marketplace) external
```

**Dependencies:**
- ICVStrategy (Gardens V2)
- IHypercertMinter
- IHypercertMarketplace
- IGardenAccount (ERC-6551)

##### ActionRegistry.sol

**Responsibilities:**
- Store action proposals
- Link actions to Hypercerts
- Track action lifecycle
- Provide priority ranking

**Key Functions:**
```solidity
function registerAction(string title, string description, ...) external returns (bytes32)
function linkHypercert(bytes32 actionId, uint256 hypercertId) external
function completeAction(bytes32 actionId, string outcomeURI) external
function getActionsByPriority(address cvStrategy, uint256 limit) external view returns (Action[] memory)
```

##### GardenConvictionAdapter.sol

**Responsibilities:**
- Adapter between Green Goods and Gardens V2
- Create Hypercert-linked proposals
- Manage member staking
- Execute proposals

**Key Functions:**
```solidity
function createHypercertProposal(uint256 hypercertId, uint256 amount, string metadata) external
function allocateConviction(uint256 proposalId, uint256 amount) external
function removeConviction(uint256 proposalId, uint256 amount) external
function executeProposal(uint256 proposalId) external
```

#### 4.3.2 Frontend Components

##### GovernanceDashboard

**Location:** `packages/client/src/features/governance/GovernanceDashboard.tsx`

**Responsibilities:**
- Display conviction voting pools
- Show active proposals
- Render member staking state
- Navigate to proposal details

##### ProposalCard

**Location:** `packages/client/src/features/governance/ProposalCard.tsx`

**Responsibilities:**
- Display proposal summary
- Show conviction progress bar with threshold
- Show time estimate to pass
- Provide allocate/remove conviction actions

##### ConvictionAllocator

**Location:** `packages/client/src/features/governance/ConvictionAllocator.tsx`

**Responsibilities:**
- Token allocation input
- Preview conviction contribution
- Execute allocation transaction
- Show updated proposal state

##### ActionRegistryView

**Location:** `packages/client/src/features/governance/ActionRegistryView.tsx`

**Responsibilities:**
- List registered actions
- Display priority ranking
- Action registration form
- Link actions to Hypercerts

---

## 5. Implementation Plan

### 5.1 Technology Stack

| Layer | Technology | Justification |
| :--- | :--- | :--- |
| **Smart Contracts** | Solidity 0.8.19+ | Gardens V2 compatibility |
| **Contract Framework** | Foundry | Testing, fuzzing, fork tests |
| **Frontend** | Vite + React 18 + TypeScript | Existing codebase |
| **State Management** | Zustand | Lightweight, TypeScript-first |
| **GraphQL Client** | React Query + graphql-request | Caching, TypeScript |
| **Indexer** | Envio | Fast sync, TypeScript handlers |
| **Wallet** | wagmi + viem | Modern hooks |

### 5.2 Milestones and Timeline

| Milestone | Duration | Deliverables |
| :--- | :--- | :--- |
| **M1: Gardens Integration** | 2 weeks | GardenConvictionAdapter, integration tests with Gardens V2 |
| **M2: Yield Allocator** | 2 weeks | HypercertYieldAllocator, marketplace integration |
| **M3: Action Registry** | 1 week | ActionRegistry contract, indexer handlers |
| **M4: Frontend Dashboard** | 2 weeks | Governance dashboard, proposal cards, allocation UI |
| **M5: Testing + Integration** | 1 week | E2E tests, integration with GG-TECH-006 |
| **M6: Testnet Deployment** | 1 week | Arbitrum Sepolia, QA |

**Total: 9 weeks**

### 5.3 Dependencies

| Dependency | Owner | Risk Level | Mitigation |
| :--- | :--- | :--- | :--- |
| Gardens V2 on Arbitrum | 1Hive | Medium | Deploy as contributor, fork if needed |
| CVVault PR #714 | 1Hive | Medium | Contribute to merge, or fork |
| Hypercert Marketplace | Hypercerts Team | Medium | Direct integration, or build simple OTC |
| GG-TECH-006 Complete | Green Goods | Low | Parallel development |

---

## 6. Testing and Quality Assurance

### 6.1 Testing Strategy

#### 6.1.1 Unit Testing (Smart Contracts)

**Framework:** Foundry Test

**Coverage Target:** > 90%

**Example Tests:**
```solidity
// test/HypercertYieldAllocator.t.sol
contract HypercertYieldAllocatorTest is Test {
    function testAllocateYield_ProportionalToConviction() public {
        // Setup: 3 proposals with 45%, 30%, 25% conviction
        // Act: Allocate 1000 USDC yield
        // Assert: 450, 300, 250 allocated respectively
    }

    function testAllocateYield_SkipsBelowMinimum() public {
        // Setup: Proposal with 1% conviction, minAllocation = 10 USDC
        // Act: Allocate 100 USDC yield
        // Assert: 1 USDC skipped, redistributed to others
    }

    function testAllocateYield_PurchasesFractions() public {
        // Setup: Mock marketplace with fractions available
        // Act: Allocate yield
        // Assert: Fractions purchased, transferred to Garden
    }
}
```

#### 6.1.2 Integration Testing

**Framework:** Foundry Fork Tests

**Test Scenarios:**
1. Full conviction voting cycle with real Gardens V2
2. Yield allocation with real Hypercert purchases
3. Action Registry lifecycle

#### 6.1.3 Frontend Testing

**Framework:** Vitest + React Testing Library + Playwright

**E2E Test Example:**
```typescript
// e2e/conviction-voting.spec.ts
test.describe('Conviction Voting', () => {
  test('member can allocate conviction to proposal', async ({ page }) => {
    await page.goto('/garden/0x.../governance');

    // Find proposal
    await page.getByText('Urban Garden Maintenance').click();

    // Allocate conviction
    await page.getByRole('button', { name: 'Allocate Conviction' }).click();
    await page.getByLabel('Amount').fill('100');
    await page.getByRole('button', { name: 'Confirm' }).click();

    // Verify updated state
    await expect(page.getByText('Your allocation: 100 GG')).toBeVisible();
  });
});
```

### 6.2 Quality Metrics

| Metric | Target | Measurement |
| :--- | :--- | :--- |
| Contract Test Coverage | > 90% | `forge coverage` |
| Frontend Unit Coverage | > 80% | Vitest |
| E2E Coverage | Critical paths 100% | Playwright |
| Gas Optimization | < 200k gas/allocation | Foundry gas reports |

---

## 7. Deployment and Maintenance

### 7.1 Deployment Strategy

**Deployment Order:**
1. Deploy ActionRegistry
2. Deploy GardenConvictionAdapter
3. Deploy HypercertYieldAllocator
4. Configure integration with GardenVaultManager
5. Create initial conviction pool for Garden
6. Transfer ownership to multisig

### 7.2 Monitoring

- Track conviction state changes
- Monitor yield allocations
- Alert on failed proposal executions
- Dashboard for governance activity

---

## 8. Risk Management

### 8.1 Risk Analysis

| Risk | Likelihood | Impact | Score |
| :--- | :--- | :--- | :--- |
| Gardens V2 not deployed on Arbitrum | Medium | High | High |
| Conviction gaming (flash loans) | Low | Medium | Low |
| Hypercert marketplace illiquidity | Medium | Medium | Medium |
| Proposal spam | Medium | Low | Low |

### 8.2 Mitigation Strategies

| Risk | Mitigation |
| :--- | :--- |
| Gardens V2 not on Arbitrum | Deploy as contributor, or fork contracts |
| Conviction gaming | Snapshot at allocation, minimum stake period |
| Marketplace illiquidity | Fallback to direct fraction minting, OTC |
| Proposal spam | Minimum stake to propose, curation |

---

## 9. Appendices

### 9.1 Conviction Voting Math

**Conviction Growth Formula:**
```
conviction(t) = amount × (1 - e^(-t/τ))

Where:
- amount = tokens allocated
- t = time since allocation
- τ = time constant (derived from half-life)
- τ = half_life / ln(2)
```

**Threshold Calculation:**
```
threshold = (spendingLimit × totalEffectiveSupply) /
            (1 - requestedAmount / effectiveFunding)^2

Where:
- spendingLimit = max % of pool per proposal
- totalEffectiveSupply = total staked tokens
- requestedAmount = yield requested
- effectiveFunding = available pool balance
```

### 9.2 Gardens V2 Contract Addresses

| Contract | Network | Address |
| :--- | :--- | :--- |
| RegistryFactory | Arbitrum One | TBD (deploy as contributor) |
| CVStrategyTemplate | Arbitrum One | TBD |
| CVVaultTemplate | Arbitrum One | TBD |

---

## Changelog

| Version | Date | Author | Changes |
| :--- | :--- | :--- | :--- |
| 1.0 | Jan 18, 2026 | Engineering | Initial specification |

---

*End of Technical Specification*
