# GG-TECH-005: Hypercerts Minting Technical Specification

**Spec ID:** GG-TECH-005
**Feature ID:** GG-FEAT-005
**Version:** 2.0
**Status:** Draft
**Last Updated:** January 18, 2026
**Author:** Engineering Team

---

## 1. Overview

### 1.1 Purpose

This technical specification provides the engineering blueprint for implementing the Hypercerts Minting feature (GG-FEAT-005). It defines the system architecture, data models, sequence diagrams, and implementation details required for an engineer or AI agent to build the feature from scratch.

### 1.2 Scope

**In Scope:**
- Admin Dashboard UI components for Hypercert creation wizard (Vite + React)
- Direct contract interactions from the client (no backend API)
- Integration with Hypercerts smart contracts on Arbitrum
- Integration with EAS attestations via Green Goods Envio Indexer
- IPFS metadata and allowlist storage via Storracha (client-side)
- Gas sponsorship via Pimlico (ERC-4337)
- Local draft persistence via IndexedDB

**Out of Scope:**
- Secondary market trading (Phase 2)
- ATProtocol dual-write (v1.5)
- Cross-chain bridging (Phase 3)
- Conviction Voting integration (GG-FEAT-008)

### 1.3 Definitions, Acronyms, and Abbreviations

| Term | Definition |
|------|------------|
| EAS | Ethereum Attestation Service - protocol for creating, verifying attestations |
| ERC-1155 | Ethereum token standard for multi-token contracts |
| ERC-6551 | Token-bound accounts standard (used by GardenAccount) |
| Hypercert | Impact certificate as ERC-1155 token with bundled attestations |
| Allowlist | Merkle tree of addresses and units for claimable distribution |
| UserOp | ERC-4337 User Operation for account abstraction |
| CID | Content Identifier for IPFS-stored data |
| Envio | Blockchain indexer for querying on-chain data |
| Storracha | IPFS/Filecoin storage layer (w3up) |
| Pimlico | ERC-4337 bundler and paymaster service |
| GardenAccount | ERC-6551 token-bound account owned by GardenToken |
| ActionRegistry | Contract defining allowable work activities |

### 1.4 References

| Document | Link |
|----------|------|
| Feature Spec | GG-FEAT-005_Hypercerts_Minting_Spec.md |
| Green Goods PRD | Green_Goods_v1_PRD_FINAL_v2.md |
| Green Goods Architecture | docs/developer/architecture.md |
| Hypercerts Token Standard | https://hypercerts.org/docs/developer/token-standard |
| Hypercerts Metadata | https://hypercerts.org/docs/developer/metadata |
| HypercertMinter Contract | 0x822F17A9A5EeCFd66dBAFf7946a8071C265D1d07 |
| EAS Documentation | https://docs.attest.org |
| Green Goods GitHub | https://github.com/greenpill-dev-guild/green-goods |

---

## 2. System Overview

### 2.1 System Architecture

**Key Architectural Principle:** Green Goods uses a **serverless architecture** with no backend API. The Admin Dashboard communicates directly with the blockchain via the Envio indexer (for reads) and smart contracts (for writes). All orchestration happens client-side.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ADMIN DASHBOARD (Vite + React)                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │ Wizard UI       │  │ IndexedDB       │  │ Reown AppKit    │              │
│  │ Components      │  │ Draft Store     │  │ (Wallet)        │              │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘              │
│           │                    │                    │                        │
│  ┌────────┴────────────────────┴────────────────────┴────────┐              │
│  │                    CLIENT-SIDE SERVICES                    │              │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │              │
│  │  │ Urql     │ │ Viem     │ │ Storracha│ │ Pimlico  │      │              │
│  │  │ GraphQL  │ │ Contract │ │ IPFS     │ │ UserOp   │      │              │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘      │              │
│  └───────┼────────────┼────────────┼────────────┼────────────┘              │
└──────────┼────────────┼────────────┼────────────┼────────────────────────────┘
           │            │            │            │
           ▼            │            │            │
┌──────────────────┐    │            │            │
│  Green Goods     │    │            │            │
│  Envio Indexer   │    │            │            │
│  (GraphQL API)   │    │            │            │
└────────┬─────────┘    │            │            │
         │              │            │            │
         ▼              ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL SERVICES                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Hypercerts   │  │ Storracha    │  │ Pimlico      │  │ Karma GAP    │     │
│  │ Graph        │  │ (IPFS)       │  │ (4337)       │  │ SDK          │     │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
           │              │            │            │
           ▼              ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ARBITRUM ONE (L2)                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                 │
│  │ Green Goods    │  │ HypercertMinter│  │ EAS            │                 │
│  │ Contracts      │  │ Contract       │  │ Contract       │                 │
│  │ - GardenToken  │  │                │  │                │                 │
│  │ - GardenAcct   │  │                │  │                │                 │
│  │ - ActionReg    │  │                │  │                │                 │
│  └────────────────┘  └────────────────┘  └────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Green Goods Contract Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      GREEN GOODS CONTRACT HIERARCHY                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                              GardenToken (ERC-721)                          │
│  - Mints and initializes GardenAccount (token-bound account)               │
│  - Creates Karma GAP project via KarmaLib                                  │
└────────────────────────┬───────────────────────────────────────────────────┘
                         │ owns (ERC-6551)
                         ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                            GardenAccount (ERC-6551)                         │
│  - Token-bound account for the garden                                       │
│  - Stores gapProjectUID (bytes32)                                          │
│  - Holds treasury funds                                                     │
│  - Creates GAP impact attestations on approval                             │
└────────────────────────────────────────────────────────────────────────────┘
         │                          │                           │
         │ registers               │ resolves                 │ resolves
         ▼                          ▼                           ▼
┌─────────────────┐       ┌─────────────────────┐      ┌─────────────────────┐
│ ActionRegistry  │       │ WorkApprovalResolver│      │ AssessmentResolver  │
│                 │       │                     │      │                     │
│ - Defines       │       │ - Validates roles   │      │ - Generates         │
│   allowable     │       │ - Records EAS       │      │   milestone         │
│   work          │       │   attestation       │      │   attestations      │
│   activities    │       │ - Creates GAP       │      │ - Syncs to GAP      │
│                 │       │   impact attestation│      │                     │
└─────────────────┘       └─────────────────────┘      └─────────────────────┘
```

### 2.3 Entity Relationship Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          ENTITIES & RELATIONSHIPS                         │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────┐  ERC-6551   ┌─────────────┐                           │
│   │ GardenToken │────────────►│GardenAccount│                           │
│   │  (ERC-721)  │   owns      │ (ERC-6551)  │                           │
│   └──────┬──────┘             └──────┬──────┘                           │
│          │                           │                                   │
│          │ operator of               │ treasury of                       │
│          ▼                           ▼                                   │
│   ┌─────────────┐             ┌─────────────┐                           │
│   │  Operator   │             │  Hypercert  │                           │
│   │  (Wallet)   │────────────►│ (ERC-1155)  │                           │
│   └─────────────┘   mints     └──────┬──────┘                           │
│                                      │                                   │
│                                      │ distributed to                    │
│   ┌─────────────┐                    ▼                                   │
│   │ Attestation │──────────►┌─────────────┐                             │
│   │   (EAS)     │ bundled   │ Allowlist   │◄──────┌─────────────┐       │
│   └──────┬──────┘  in       │   Entry     │       │  Gardener   │       │
│          │                  └─────────────┘       │  (Wallet)   │       │
│          │ created by            receives        └─────────────┘       │
│          ▼                                                              │
│   ┌─────────────┐                                                       │
│   │  Gardener   │                                                       │
│   │ (Smart Acct)│                                                       │
│   └─────────────┘                                                       │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Environment

**Production Environment:**
- **Blockchain:** Arbitrum One (Chain ID: 42161)
- **Additional Networks:** Celo (42220), Base Sepolia (84532)
- **RPC:** Alchemy or Infura endpoints
- **Indexer:** Green Goods Envio Indexer (self-hosted)
- **Storage:** Storracha (w3up) for IPFS/Filecoin
- **Bundler:** Pimlico for ERC-4337 operations
- **Frontend:** Vercel (Vite static build)
- **Wallet:** Reown AppKit (formerly WalletConnect)

**Development Environment:**
- **Blockchain:** Base Sepolia (Chain ID: 84532) - default
- **Commands:** `bun --filter admin dev` runs on http://localhost:3002

---

## 3. Detailed Requirements

### 3.1 Functional Requirements

*See GG-FEAT-005 Section 6 for complete requirements. Below are key technical implementations.*

| Req ID | Description | Technical Implementation |
|--------|-------------|-------------------------|
| FR-A-001 | Display approved attestations | GraphQL query to GG Envio Indexer with approved=true filter |
| FR-A-002 | Filter by date, domain, scope | GraphQL variables with WHERE clauses |
| FR-B-001 | Pre-fill metadata | Client-side aggregation from selected attestations via Zustand |
| FR-C-001 | Generate preview artwork | Client-side canvas rendering or Hypercerts API |
| FR-D-002 | Validate 100M units | Client-side validation in XState workflow |
| FR-E-001 | Upload to IPFS | Client-side Storracha w3up-client upload |
| FR-E-002 | Submit transaction | Client-side Pimlico UserOp via permissionless.js |

### 3.2 Non-Functional Requirements

| Category | Requirement | Target |
|----------|------------|--------|
| Performance | Attestation load (100 items) | < 2 seconds |
| Performance | IPFS upload | < 10 seconds |
| Performance | Transaction confirmation | < 30 seconds |
| Availability | Indexer uptime | 99.5% |
| Security | Role verification | On-chain check via useRole hook |
| Scalability | Concurrent mints | 10 simultaneous |

### 3.3 Interface Requirements

**External Service Integrations (all client-side):**

| Service | Protocol | Authentication | Rate Limit |
|---------|----------|----------------|------------|
| GG Envio Indexer | GraphQL (Urql) | None | 100 req/min |
| Hypercerts Graph | GraphQL | None | 50 req/min |
| Storracha | HTTP | DID Key (env var) | 10 uploads/min |
| Pimlico | JSON-RPC | API Key (env var) | 100 req/min |
| Karma GAP SDK | JS SDK | gapProjectUID | Per SDK limits |
| Arbitrum RPC | JSON-RPC | API Key (env var) | 300 req/min |

---

## 4. System Design

### 4.1 Data Flow Diagrams

#### 4.1.1 High-Level Minting Flow (Client-Side)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HYPERCERT MINTING DATA FLOW (CLIENT-SIDE)                 │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
    │  Step 1 │────►│  Step 2 │────►│  Step 3 │────►│  Step 4 │────►│  Step 5 │
    │ Select  │     │Metadata │     │ Preview │     │ Distrib │     │  Mint   │
    └────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘
         │               │               │               │               │
         │               │               │               │               │
         ▼               ▼               ▼               ▼               ▼
    ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
    │ Envio   │     │ Zustand │     │ Canvas  │     │ Merkle  │     │Storracha│
    │ GraphQL │     │ Store   │     │ Render  │     │  Tree   │     │ Upload  │
    │ (Urql)  │     │         │     │         │     │(client) │     │(client) │
    └─────────┘     └─────────┘     └─────────┘     └─────────┘     └────┬────┘
                                                                         │
    ┌────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MINTING ORCHESTRATION (XState)                       │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐           │
│  │ Build    │────►│ Request  │────►│ Submit   │────►│ Poll for │           │
│  │ UserOp   │     │ Passkey  │     │ to       │     │ Receipt  │           │
│  │          │     │ Signature│     │ Pimlico  │     │          │           │
│  └──────────┘     └──────────┘     └──────────┘     └──────────┘           │
└─────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
                                    ┌─────────┐
                                    │Hypercert│
                                    │ Minter  │
                                    │Contract │
                                    └────┬────┘
                                         │
                                         ▼
                                    ┌─────────┐
                                    │  Karma  │
                                    │ GAP SDK │
                                    └─────────┘
```

#### 4.1.2 Attestation Query Flow

```
┌──────────────────┐     ┌──────────────┐     ┌──────────────┐
│  Admin Dashboard │     │ Green Goods  │     │   Arbitrum   │
│  (useAttestations│     │ Envio Indexer│     │     EAS      │
│       hook)      │     │              │     │              │
└────────┬─────────┘     └──────┬───────┘     └──────┬───────┘
         │                      │                    │
         │ GraphQL Query (Urql) │                    │
         │ GetApprovedAttestations                   │
         │ { gardenId, filters }│                    │
         │─────────────────────►│                    │
         │                      │                    │
         │                      │ (Pre-indexed from  │
         │                      │  WorkSubmitted and │
         │                      │  WorkApproval      │
         │                      │  events)           │
         │                      │◄───────────────────│
         │                      │                    │
         │ {                    │                    │
         │   attestations: [...]│                    │
         │   totalCount: N      │                    │
         │ }                    │                    │
         │◄─────────────────────│                    │
         │                      │                    │
         │ Render to UI         │                    │
         │                      │                    │
```

### 4.2 Data Model

#### 4.2.1 Envio Indexer Schema (Read-Only)

The Green Goods Envio Indexer provides the following entities via GraphQL. **Note:** This is the source of truth for reads; there is no separate database.

```graphql
# Indexed from GardenToken events
type Garden {
  id: ID!                          # GardenToken tokenId
  name: String!
  description: String
  gardenAccount: String!           # ERC-6551 account address
  gapProjectUID: String            # Karma GAP project ID (bytes32 as string)
  operator: String!                # Operator wallet address
  createdAt: BigInt!
  createdTxHash: String!
}

# Indexed from WorkSubmitted events
type WorkSubmission {
  id: ID!                          # EAS UID
  garden: Garden!
  gardener: String!                # Gardener smart account address
  gardenerName: String
  actionType: String!
  domain: String!
  title: String!
  workScope: [String!]!
  metrics: JSON
  mediaUrls: [String!]!
  createdAt: BigInt!
  txHash: String!
}

# Indexed from WorkApproval events
type WorkApproval {
  id: ID!                          # EAS UID
  workSubmission: WorkSubmission!
  garden: Garden!
  approved: Boolean!
  approvedBy: String!
  approvedAt: BigInt!
  txHash: String!
  # Denormalized for query efficiency
  bundledInHypercert: Hypercert    # null if not yet bundled
}

# Indexed from HypercertMinter TransferSingle events
type Hypercert {
  id: ID!                          # {chainId}-{contract}-{tokenId}
  tokenId: BigInt!
  garden: Garden!
  metadataUri: String!
  totalUnits: BigInt!
  mintedBy: String!
  mintedAt: BigInt!
  txHash: String!
  # Derived from metadata
  title: String
  description: String
  workScopes: [String!]
  attestationCount: Int!
}

# Indexed from HypercertMinter claim events
type AllowlistClaim {
  id: ID!
  hypercert: Hypercert!
  claimant: String!
  units: BigInt!
  claimedAt: BigInt!
  txHash: String!
}
```

#### 4.2.2 Client-Side State (Zustand + IndexedDB)

```typescript
// stores/hypercertWizardStore.ts

interface HypercertWizardState {
  // Current step
  currentStep: 1 | 2 | 3 | 4 | 5;

  // Step 1: Selection
  selectedAttestationIds: string[];

  // Step 2: Metadata
  title: string;
  description: string;
  workScopes: string[];
  impactScopes: string[];
  workTimeframeStart: Date;
  workTimeframeEnd: Date;
  impactTimeframeStart: Date;
  impactTimeframeEnd: Date | null;  // null = indefinite
  sdgs: number[];
  capitals: CapitalType[];
  outcomes: OutcomeMetrics;
  externalUrl: string;

  // Step 4: Distribution
  distributionMode: 'equal' | 'proportional' | 'custom';
  allowlist: AllowlistEntry[];

  // Step 5: Minting state
  mintingState: MintingState;

  // Draft management
  draftId: string | null;
  lastSavedAt: Date | null;

  // Actions
  setStep: (step: number) => void;
  selectAttestation: (id: string) => void;
  deselectAttestation: (id: string) => void;
  updateMetadata: (updates: Partial<MetadataState>) => void;
  setDistribution: (allowlist: AllowlistEntry[]) => void;
  saveDraft: () => Promise<void>;
  loadDraft: (draftId: string) => Promise<void>;
  clearDraft: () => void;
  reset: () => void;
}

interface MintingState {
  status: 'idle' | 'uploading_metadata' | 'uploading_allowlist' |
          'building_userop' | 'awaiting_signature' | 'submitting' |
          'pending' | 'confirmed' | 'failed';
  metadataCid: string | null;
  allowlistCid: string | null;
  merkleRoot: string | null;
  userOpHash: string | null;
  txHash: string | null;
  hypercertId: string | null;
  error: string | null;
}

// IndexedDB Schema for drafts (via idb-keyval or Dexie)
interface HypercertDraft {
  id: string;              // UUID
  gardenId: string;
  operatorAddress: string;
  stepNumber: number;
  attestationIds: string[];
  title: string;
  description: string;
  workScopes: string[];
  impactScopes: string[];
  workTimeframeStart: number;  // Unix timestamp
  workTimeframeEnd: number;
  impactTimeframeStart: number;
  impactTimeframeEnd: number | null;
  sdgs: number[];
  capitals: string[];
  outcomes: OutcomeMetrics;
  allowlist: AllowlistEntry[];
  externalUrl: string;
  createdAt: number;
  updatedAt: number;
}
```

#### 4.2.3 TypeScript Interfaces

```typescript
// packages/shared/src/types/hypercerts.ts

import type { Address, Hex } from 'viem';

// Domain types matching Envio schema
export interface Garden {
  id: string;
  name: string;
  description: string | null;
  gardenAccount: Address;
  gapProjectUID: string | null;
  operator: Address;
  createdAt: bigint;
}

export interface WorkApproval {
  id: string;  // EAS UID
  workSubmission: WorkSubmission;
  garden: Garden;
  approved: boolean;
  approvedBy: Address;
  approvedAt: bigint;
  bundledInHypercert: Hypercert | null;
}

export interface WorkSubmission {
  id: string;  // EAS UID
  garden: Garden;
  gardener: Address;
  gardenerName: string | null;
  actionType: ActionType;
  domain: ActionDomain;
  title: string;
  workScope: string[];
  metrics: Record<string, MetricValue> | null;
  mediaUrls: string[];
  createdAt: bigint;
}

export interface Hypercert {
  id: string;  // {chainId}-{contract}-{tokenId}
  tokenId: bigint;
  garden: Garden;
  metadataUri: string;
  totalUnits: bigint;
  mintedBy: Address;
  mintedAt: bigint;
  txHash: Hex;
  title: string | null;
  attestationCount: number;
}

// Action types from ActionRegistry
export type ActionDomain =
  | 'solar'
  | 'waste'
  | 'agroforestry'
  | 'education'
  | 'mutual_credit';

export type ActionType =
  | 'hub_session' | 'workshop' | 'node_deployment'  // Solar
  | 'cleanup' | 'recycling' | 'composting'          // Waste
  | 'planting' | 'nursery' | 'maintenance'          // Agroforestry
  | 'training' | 'certification'                    // Education
  | 'commitment' | 'exchange';                      // Mutual Credit

export type CapitalType =
  | 'living' | 'social' | 'material' | 'financial'
  | 'intellectual' | 'experiential' | 'spiritual' | 'cultural';

// Metric types
export interface MetricValue {
  value: number;
  unit: string;
}

export interface OutcomeMetrics {
  predefined: Record<string, PredefinedMetric>;
  custom: Record<string, CustomMetric>;
}

export interface PredefinedMetric {
  value: number;
  unit: string;
  aggregation: 'sum' | 'count' | 'average' | 'max';
  label: string;
}

export interface CustomMetric {
  value: number;
  unit: string;
  label: string;
}

// Allowlist types
export interface AllowlistEntry {
  address: Address;
  units: bigint;
  label?: string;
}

// Hypercert metadata (follows Hypercerts standard)
export interface HypercertMetadata {
  name: string;
  description: string;
  image: string;  // IPFS URI
  external_url?: string;
  hypercert: {
    work_scope: ScopeDefinition;
    impact_scope: ScopeDefinition;
    work_timeframe: TimeframeDefinition;
    impact_timeframe: TimeframeDefinition;
    contributors: string[];
    rights: string[];
  };
  properties?: PropertyDefinition[];
  // Green Goods extension (stored but not displayed by Hypercerts)
  hidden_properties?: GreenGoodsExtension;
}

export interface ScopeDefinition {
  name: string;
  value: string[];
  excludes?: string[];
}

export interface TimeframeDefinition {
  name: string;
  value: [number, number];  // [start, end] as Unix timestamps, 0 = indefinite
  display_value: string;
}

export interface PropertyDefinition {
  trait_type: string;
  value: string | number;
}

export interface GreenGoodsExtension {
  gardenId: string;
  attestationRefs: AttestationRef[];
  sdgs: number[];
  capitals: CapitalType[];
  outcomes: OutcomeMetrics;
  domain: ActionDomain;
  karmaGapProjectId?: string;
  protocolVersion: string;
}

export interface AttestationRef {
  uid: Hex;
  title: string;
  domain: ActionDomain;
}
```

### 4.3 Component Design

#### 4.3.1 Frontend Components (Vite + React)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   ADMIN DASHBOARD COMPONENT HIERARCHY                        │
│                        (packages/admin/src)                                  │
└─────────────────────────────────────────────────────────────────────────────┘

src/
├── main.tsx                              # Vite entry point
├── App.tsx                               # Router setup
│
├── routes/
│   └── gardens/
│       └── [gardenId]/
│           └── hypercerts/
│               ├── index.tsx             # Hypercerts list page
│               ├── [hypercertId].tsx     # Hypercert detail page
│               └── create.tsx            # Wizard container
│
├── components/
│   ├── hypercerts/
│   │   ├── wizard/
│   │   │   ├── HypercertWizard.tsx       # Main wizard (XState machine)
│   │   │   ├── WizardStepper.tsx         # Progress indicator
│   │   │   ├── WizardNavigation.tsx      # Back/Next buttons
│   │   │   │
│   │   │   ├── steps/
│   │   │   │   ├── AttestationSelector.tsx    # Step 1
│   │   │   │   ├── MetadataEditor.tsx         # Step 2
│   │   │   │   ├── PreviewPanel.tsx           # Step 3
│   │   │   │   ├── DistributionConfig.tsx     # Step 4
│   │   │   │   └── MintConfirmation.tsx       # Step 5
│   │   │   │
│   │   │   └── shared/
│   │   │       ├── AttestationCard.tsx        # Single attestation
│   │   │       ├── AttestationFilters.tsx     # Filter controls
│   │   │       ├── TagSelector.tsx            # Work/Impact scope
│   │   │       ├── SDGPicker.tsx              # SDG selection
│   │   │       ├── CapitalsPicker.tsx         # 8 capitals
│   │   │       ├── OutcomeMetricsTable.tsx    # Metrics edit
│   │   │       ├── DistributionTable.tsx      # Allowlist editor
│   │   │       ├── HypercertPreviewCard.tsx   # Generated artwork
│   │   │       ├── GasEstimator.tsx           # Gas display
│   │   │       └── TransactionProgress.tsx    # Mint progress
│   │   │
│   │   ├── list/
│   │   │   ├── HypercertsList.tsx             # Grid/list view
│   │   │   ├── HypercertCard.tsx              # Summary card
│   │   │   └── HypercertsFilters.tsx          # Filters
│   │   │
│   │   └── detail/
│   │       ├── HypercertDetail.tsx            # Full detail
│   │       ├── AllowlistTable.tsx             # Claim status
│   │       └── AttestationReferences.tsx      # Linked atts
│   │
│   └── ui/                               # Radix UI components (shared)
│
├── hooks/
│   ├── useAttestations.ts                # Query from Envio
│   ├── useHypercerts.ts                  # Query minted HCs
│   ├── useHypercertDraft.ts              # IndexedDB draft
│   ├── useMintHypercert.ts               # Minting mutation
│   ├── useGasEstimate.ts                 # Pimlico estimate
│   └── useRole.ts                        # Operator check (from shared)
│
├── lib/
│   ├── hypercerts/
│   │   ├── metadata.ts                   # Format metadata
│   │   ├── merkle.ts                     # Generate merkle tree
│   │   ├── distribution.ts               # Calculate units
│   │   ├── aggregation.ts                # Aggregate metrics
│   │   └── validation.ts                 # Zod schemas
│   │
│   ├── ipfs/
│   │   └── storracha.ts                  # w3up-client wrapper
│   │
│   └── transactions/
│       ├── hypercertMinter.ts            # Contract calls
│       └── userOp.ts                     # Pimlico UserOp
│
├── machines/
│   └── hypercertMintingMachine.ts        # XState workflow
│
├── stores/
│   └── hypercertWizardStore.ts           # Zustand store
│
└── graphql/
    ├── client.ts                         # Urql client setup
    └── queries/
        ├── attestations.ts               # Attestation queries
        └── hypercerts.ts                 # Hypercert queries
```

#### 4.3.2 XState Minting Machine

```typescript
// machines/hypercertMintingMachine.ts

import { createMachine, assign } from 'xstate';

export const hypercertMintingMachine = createMachine({
  id: 'hypercertMinting',
  initial: 'idle',
  context: {
    metadataCid: null,
    allowlistCid: null,
    merkleRoot: null,
    userOpHash: null,
    txHash: null,
    hypercertId: null,
    error: null,
  },
  states: {
    idle: {
      on: {
        START_MINT: 'uploadingMetadata'
      }
    },
    uploadingMetadata: {
      invoke: {
        src: 'uploadMetadata',
        onDone: {
          target: 'uploadingAllowlist',
          actions: assign({ metadataCid: (_, event) => event.data.cid })
        },
        onError: {
          target: 'failed',
          actions: assign({ error: (_, event) => event.data.message })
        }
      }
    },
    uploadingAllowlist: {
      invoke: {
        src: 'uploadAllowlist',
        onDone: {
          target: 'buildingUserOp',
          actions: assign({
            allowlistCid: (_, event) => event.data.cid,
            merkleRoot: (_, event) => event.data.merkleRoot
          })
        },
        onError: {
          target: 'failed',
          actions: assign({ error: (_, event) => event.data.message })
        }
      }
    },
    buildingUserOp: {
      invoke: {
        src: 'buildUserOperation',
        onDone: 'awaitingSignature',
        onError: {
          target: 'failed',
          actions: assign({ error: (_, event) => event.data.message })
        }
      }
    },
    awaitingSignature: {
      invoke: {
        src: 'requestSignature',
        onDone: 'submitting',
        onError: {
          target: 'failed',
          actions: assign({ error: 'Signature rejected' })
        }
      }
    },
    submitting: {
      invoke: {
        src: 'submitUserOp',
        onDone: {
          target: 'pending',
          actions: assign({ userOpHash: (_, event) => event.data.hash })
        },
        onError: {
          target: 'failed',
          actions: assign({ error: (_, event) => event.data.message })
        }
      }
    },
    pending: {
      invoke: {
        src: 'pollForReceipt',
        onDone: {
          target: 'confirmed',
          actions: assign({
            txHash: (_, event) => event.data.txHash,
            hypercertId: (_, event) => event.data.hypercertId
          })
        },
        onError: {
          target: 'failed',
          actions: assign({ error: (_, event) => event.data.message })
        }
      }
    },
    confirmed: {
      type: 'final'
    },
    failed: {
      on: {
        RETRY: 'idle'
      }
    }
  }
});
```

---

## 5. Sequence Diagrams

### 5.1 Complete Minting Flow (End-to-End)

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Operator │ │  Admin   │ │  Envio   │ │Storracha │ │ Pimlico  │ │Hypercert │ │  Karma   │
│ (User)   │ │Dashboard │ │ Indexer  │ │  (IPFS)  │ │ (4337)   │ │ Minter   │ │ GAP SDK  │
└────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
     │            │            │            │            │            │            │
     │ Open Create Hypercert   │            │            │            │            │
     │──────────►│            │            │            │            │            │
     │            │            │            │            │            │            │
     │            │ useRole hook checks operator on-chain              │            │
     │            │────────────────────────────────────────────────────►           │
     │            │◄───────────────────────────────────────────────────│           │
     │            │            │            │            │            │            │
     │            │ Check IndexedDB for draft                         │            │
     │            │            │            │            │            │            │
     │            │ Query Attestations (Urql GraphQL)   │            │            │
     │            │───────────►│            │            │            │            │
     │            │ { attestations, totalCount }        │            │            │
     │            │◄───────────│            │            │            │            │
     │            │            │            │            │            │            │
     │ Display Attestation List│            │            │            │            │
     │◄──────────│            │            │            │            │            │
     │            │            │            │            │            │            │
     │ Select Attestations    │            │            │            │            │
     │──────────►│            │            │            │            │            │
     │            │ Update Zustand store   │            │            │            │
     │            │            │            │            │            │            │
     │ Edit Metadata (Step 2) │            │            │            │            │
     │──────────►│            │            │            │            │            │
     │            │ Aggregate metrics client-side       │            │            │
     │            │            │            │            │            │            │
     │ Configure Distribution (Step 4)     │            │            │            │
     │──────────►│            │            │            │            │            │
     │            │ Calculate merkle root client-side   │            │            │
     │            │            │            │            │            │            │
     │ Click Mint (Step 5)    │            │            │            │            │
     │──────────►│            │            │            │            │            │
     │            │            │            │            │            │            │
     │            │ XState: uploadingMetadata           │            │            │
     │            │───────────────────────►│            │            │            │
     │            │            │ CID       │            │            │            │
     │            │◄───────────────────────│            │            │            │
     │            │            │            │            │            │            │
     │            │ XState: uploadingAllowlist          │            │            │
     │            │───────────────────────►│            │            │            │
     │            │            │ CID, root │            │            │            │
     │            │◄───────────────────────│            │            │            │
     │            │            │            │            │            │            │
     │            │ XState: buildingUserOp │            │            │            │
     │            │ Build calldata for createAllowlist  │            │            │
     │            │ Get gas estimate       │            │            │            │
     │            │──────────────────────────────────►│            │            │
     │            │◄──────────────────────────────────│            │            │
     │            │ Get paymaster signature │            │            │            │
     │            │──────────────────────────────────►│            │            │
     │            │◄──────────────────────────────────│            │            │
     │            │            │            │            │            │            │
     │            │ XState: awaitingSignature          │            │            │
     │ Prompt Passkey/Wallet Signature     │            │            │            │
     │◄──────────│            │            │            │            │            │
     │ Sign (WebAuthn or EOA) │            │            │            │            │
     │──────────►│            │            │            │            │            │
     │            │            │            │            │            │            │
     │            │ XState: submitting     │            │            │            │
     │            │ sendUserOperation      │            │            │            │
     │            │──────────────────────────────────►│            │            │
     │            │            │            │            │ Bundle & submit         │
     │            │            │            │            │───────────►│            │
     │            │            │            │            │            │createAllowlist
     │            │            │            │            │            │──────────►│
     │            │            │            │            │ UserOpHash │            │
     │            │◄──────────────────────────────────│            │            │
     │            │            │            │            │            │            │
     │ Show Pending State     │            │            │            │            │
     │◄──────────│            │            │            │            │            │
     │            │            │            │            │            │            │
     │            │ XState: pending (polling)          │            │            │
     │            │ getUserOperationReceipt            │            │            │
     │            │──────────────────────────────────►│            │            │
     │            │            │            │            │            │(Block mined)
     │            │            │            │            │◄───────────│            │
     │            │◄──────────────────────────────────│            │            │
     │            │            │            │            │            │            │
     │            │ XState: confirmed      │            │            │            │
     │            │ Update Karma GAP milestone via SDK │            │            │
     │            │──────────────────────────────────────────────────────────────►│
     │            │            │            │            │            │            │
     │ Show Success Screen    │            │            │            │            │
     │◄──────────│            │            │            │            │            │
     │            │            │            │            │            │            │
```

### 5.2 Attestation Selection Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Admin       │     │ useAttestations    │  GG Envio    │
│  Dashboard   │     │ Hook (Urql)  │     │  Indexer     │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │ Enter Step 1       │                    │
       │───────────────────►│                    │
       │                    │                    │
       │                    │ GraphQL Query:     │
       │                    │ query GetApprovedAttestations(
       │                    │   $gardenId: ID!
       │                    │   $domain: String
       │                    │   $startDate: BigInt
       │                    │   $endDate: BigInt
       │                    │ ) {
       │                    │   workApprovals(where: {
       │                    │     garden: $gardenId
       │                    │     approved: true
       │                    │     bundledInHypercert: null
       │                    │     ...filters
       │                    │   }) {
       │                    │     id
       │                    │     workSubmission { ... }
       │                    │   }
       │                    │ }
       │                    │───────────────────►│
       │                    │                    │
       │                    │ { workApprovals: [...] }
       │                    │◄───────────────────│
       │                    │                    │
       │ { data, isLoading }│                    │
       │◄───────────────────│                    │
       │                    │                    │
       │ Render AttestationSelector              │
       │ with filter controls                    │
       │                    │                    │
       │ User toggles checkbox                   │
       │───────────────────►│                    │
       │                    │                    │
       │ Zustand: selectAttestation(id)          │
       │                    │                    │
       │ Re-render with     │                    │
       │ updated selection  │                    │
       │◄───────────────────│                    │
       │                    │                    │
```

### 5.3 IPFS Upload Flow (Client-Side)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Admin       │     │  Storracha   │     │  Storracha   │     │  Filecoin    │
│  Dashboard   │     │  Client      │     │  API         │     │  Network     │
│  (XState)    │     │  (w3up)      │     │              │     │              │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │                    │
       │ XState: uploadingMetadata               │                    │
       │───────────────────►│                    │                    │
       │                    │                    │                    │
       │                    │ Validate metadata schema (Zod)          │
       │                    │                    │                    │
       │                    │ Generate preview image (canvas)         │
       │                    │                    │                    │
       │                    │ client.uploadFile(metadataBlob)         │
       │                    │───────────────────►│                    │
       │                    │                    │                    │
       │                    │                    │ Store with         │
       │                    │                    │ Filecoin deal      │
       │                    │                    │───────────────────►│
       │                    │                    │                    │
       │                    │                    │ Deal confirmed     │
       │                    │                    │◄───────────────────│
       │                    │                    │                    │
       │                    │ { cid }            │                    │
       │                    │◄───────────────────│                    │
       │                    │                    │                    │
       │ { metadataCid }    │                    │                    │
       │◄───────────────────│                    │                    │
       │                    │                    │                    │
       │ XState → uploadingAllowlist             │                    │
       │                    │                    │                    │
       │ Generate merkle tree from allowlist     │                    │
       │ (client-side, @hypercerts-org/sdk)      │                    │
       │                    │                    │                    │
       │ client.uploadFile(allowlistCSV)         │                    │
       │───────────────────►│                    │                    │
       │                    │───────────────────►│                    │
       │                    │◄───────────────────│                    │
       │ { allowlistCid, merkleRoot }            │                    │
       │◄───────────────────│                    │                    │
       │                    │                    │                    │
```

### 5.4 Transaction Submission Flow (ERC-4337)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Admin       │     │  Permissionless    │  Pimlico     │     │ Hypercert    │
│  Dashboard   │     │  (viem ext)  │     │  Bundler     │     │ Minter       │
│  (XState)    │     │              │     │              │     │              │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │                    │
       │ XState: buildingUserOp                  │                    │
       │───────────────────►│                    │                    │
       │                    │                    │                    │
       │                    │ Encode createAllowlist calldata         │
       │                    │ (viem encodeFunctionData)               │
       │                    │                    │                    │
       │                    │ buildUserOperation({                    │
       │                    │   sender: smartAccountAddress,          │
       │                    │   callData: createAllowlistCalldata,    │
       │                    │   ...                                   │
       │                    │ })                 │                    │
       │                    │                    │                    │
       │                    │ estimateUserOperationGas                │
       │                    │───────────────────►│                    │
       │                    │◄───────────────────│                    │
       │                    │                    │                    │
       │                    │ Get paymaster sponsorship               │
       │                    │───────────────────►│                    │
       │                    │◄───────────────────│                    │
       │                    │                    │                    │
       │ { userOp }         │                    │                    │
       │◄───────────────────│                    │                    │
       │                    │                    │                    │
       │ XState: awaitingSignature               │                    │
       │ Trigger Passkey or Wallet signature     │                    │
       │ (Reown AppKit)     │                    │                    │
       │                    │                    │                    │
       │ User signs         │                    │                    │
       │                    │                    │                    │
       │ XState: submitting │                    │                    │
       │ sendUserOperation  │                    │                    │
       │───────────────────►│                    │                    │
       │                    │───────────────────►│                    │
       │                    │                    │                    │
       │                    │                    │ Bundle into tx     │
       │                    │                    │───────────────────►│
       │                    │                    │                    │
       │                    │                    │ createAllowlist()  │
       │                    │                    │                    │
       │                    │ { userOpHash }     │                    │
       │                    │◄───────────────────│                    │
       │ { userOpHash }     │                    │                    │
       │◄───────────────────│                    │                    │
       │                    │                    │                    │
       │ XState: pending    │                    │                    │
       │ Poll getUserOperationReceipt            │                    │
       │───────────────────►│                    │                    │
       │                    │───────────────────►│                    │
       │                    │                    │ (Block confirmed)  │
       │                    │                    │◄───────────────────│
       │                    │◄───────────────────│                    │
       │ { txHash, logs }   │                    │                    │
       │◄───────────────────│                    │                    │
       │                    │                    │                    │
       │ XState: confirmed  │                    │                    │
       │ Extract hypercertId from logs           │                    │
       │                    │                    │                    │
```

### 5.5 Operator Permission Check

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Admin       │     │  useRole     │     │  GardenToken │
│  Dashboard   │     │  Hook        │     │  Contract    │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │ Mount wizard       │                    │
       │───────────────────►│                    │
       │                    │                    │
       │                    │ Check if wallet is operator            │
       │                    │ via Envio query or direct call         │
       │                    │                    │
       │                    │ // Option 1: Envio query               │
       │                    │ garden(id: $gardenId) {                │
       │                    │   operator                             │
       │                    │ }                  │                    │
       │                    │                    │
       │                    │ // Option 2: Direct call               │
       │                    │ gardenToken.ownerOf(tokenId)           │
       │                    │───────────────────►│                    │
       │                    │◄───────────────────│                    │
       │                    │                    │
       │ { isOperator, isLoading }               │
       │◄───────────────────│                    │
       │                    │                    │
       │ If !isOperator:    │                    │
       │ Show access denied │                    │
       │                    │                    │
       │ If isOperator:     │                    │
       │ Show wizard        │                    │
       │                    │                    │
```

### 5.6 Draft Recovery Flow (IndexedDB)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Operator    │     │  Admin       │     │  IndexedDB   │     │  Envio       │
│  (User)      │     │  Dashboard   │     │  (idb-keyval)│     │  Indexer     │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │                    │
       │ Navigate to        │                    │                    │
       │ Create Hypercert   │                    │                    │
       │───────────────────►│                    │                    │
       │                    │                    │                    │
       │                    │ useHypercertDraft hook                  │
       │                    │ get(`draft_${gardenId}_${wallet}`)      │
       │                    │───────────────────►│                    │
       │                    │                    │                    │
       │                    │ Draft found        │                    │
       │                    │◄───────────────────│                    │
       │                    │                    │                    │
       │                    │ Verify attestations still valid         │
       │                    │───────────────────────────────────────►│
       │                    │                    │                    │
       │                    │ Check which are now bundled             │
       │                    │◄───────────────────────────────────────│
       │                    │                    │                    │
       │ Show Recovery Modal│                    │                    │
       │ "Resume from Step 3?"                   │                    │
       │◄───────────────────│                    │                    │
       │                    │                    │                    │
       │ Click "Resume"     │                    │                    │
       │───────────────────►│                    │                    │
       │                    │                    │                    │
       │                    │ Load draft into Zustand store          │
       │                    │                    │                    │
       │                    │ If some attestations now bundled:      │
       │                    │ Remove from selection, show warning    │
       │                    │                    │                    │
       │ Show Wizard at Step 3                   │                    │
       │ with restored data │                    │                    │
       │◄───────────────────│                    │                    │
       │                    │                    │                    │
       │ (Auto-save every 30s)                   │                    │
       │                    │                    │                    │
       │                    │ set(`draft_${gardenId}_${wallet}`, draft)
       │                    │───────────────────►│                    │
       │                    │                    │                    │
```

---

## 6. GraphQL Queries (Envio Indexer)

### 6.1 Attestation Queries

```graphql
# Get approved attestations available for bundling
query GetApprovedAttestations(
  $gardenId: ID!
  $domain: String
  $startDate: BigInt
  $endDate: BigInt
  $first: Int = 100
  $skip: Int = 0
) {
  workApprovals(
    where: {
      garden: $gardenId
      approved: true
      bundledInHypercert: null
      workSubmission_: {
        domain: $domain
        createdAt_gte: $startDate
        createdAt_lte: $endDate
      }
    }
    first: $first
    skip: $skip
    orderBy: approvedAt
    orderDirection: desc
  ) {
    id
    approvedAt
    approvedBy
    workSubmission {
      id
      title
      actionType
      domain
      workScope
      gardener
      gardenerName
      metrics
      mediaUrls
      createdAt
    }
  }
}

# Check if attestations are already bundled
query CheckAttestationsBundled($uids: [ID!]!) {
  workApprovals(where: { id_in: $uids, bundledInHypercert_not: null }) {
    id
    bundledInHypercert {
      id
      title
    }
  }
}
```

### 6.2 Hypercert Queries

```graphql
# Get hypercerts for a garden
query GetGardenHypercerts(
  $gardenId: ID!
  $first: Int = 50
  $skip: Int = 0
) {
  hypercerts(
    where: { garden: $gardenId }
    first: $first
    skip: $skip
    orderBy: mintedAt
    orderDirection: desc
  ) {
    id
    tokenId
    title
    metadataUri
    totalUnits
    mintedAt
    mintedBy
    txHash
    attestationCount
  }
}

# Get single hypercert with details
query GetHypercertDetail($id: ID!) {
  hypercert(id: $id) {
    id
    tokenId
    title
    description
    metadataUri
    totalUnits
    mintedAt
    mintedBy
    txHash
    workScopes
    attestationCount
    garden {
      id
      name
      gapProjectUID
    }
  }
}
```

### 6.3 Garden Queries

```graphql
# Get garden details including GAP project
query GetGarden($id: ID!) {
  garden(id: $id) {
    id
    name
    description
    gardenAccount
    gapProjectUID
    operator
    createdAt
  }
}
```

---

## 7. Contract Interactions

### 7.1 HypercertMinter Contract

**Contract Address (Arbitrum):** `0x822F17A9A5EeCFd66dBAFf7946a8071C265D1d07`

**Key Functions:**

```typescript
// lib/transactions/hypercertMinter.ts

import { encodeFunctionData, type Address, type Hex } from 'viem';

export const HYPERCERT_MINTER_ADDRESS = '0x822F17A9A5EeCFd66dBAFf7946a8071C265D1d07' as const;

export const HYPERCERT_MINTER_ABI = [
  {
    name: 'createAllowlist',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'units', type: 'uint256' },
      { name: 'merkleRoot', type: 'bytes32' },
      { name: '_uri', type: 'string' },
      { name: 'transferRestrictions', type: 'uint8' }
    ],
    outputs: [{ name: 'claimID', type: 'uint256' }]
  },
  {
    name: 'mintClaimFromAllowlist',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'proof', type: 'bytes32[]' },
      { name: 'claimID', type: 'uint256' },
      { name: 'units', type: 'uint256' }
    ],
    outputs: []
  },
  {
    name: 'TransferSingle',
    type: 'event',
    inputs: [
      { name: 'operator', type: 'address', indexed: true },
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'id', type: 'uint256', indexed: false },
      { name: 'value', type: 'uint256', indexed: false }
    ]
  }
] as const;

export enum TransferRestrictions {
  AllowAll = 0,
  DisallowAll = 1,
  FromCreatorOnly = 2
}

export function encodeCreateAllowlist(params: {
  account: Address;
  totalUnits: bigint;
  merkleRoot: Hex;
  metadataUri: string;
  transferRestrictions?: TransferRestrictions;
}): Hex {
  return encodeFunctionData({
    abi: HYPERCERT_MINTER_ABI,
    functionName: 'createAllowlist',
    args: [
      params.account,
      params.totalUnits,
      params.merkleRoot,
      params.metadataUri,
      params.transferRestrictions ?? TransferRestrictions.AllowAll
    ]
  });
}
```

### 7.2 Green Goods Contracts

**Deployment addresses from:** `packages/contracts/deployments/*.json`

```typescript
// packages/shared/src/config/contracts.ts

export const CONTRACTS = {
  arbitrum: {
    gardenToken: '0x...' as const,
    actionRegistry: '0x...' as const,
    workApprovalResolver: '0x...' as const,
    assessmentResolver: '0x...' as const,
    eas: '0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458' as const,
  },
  celo: {
    // ...
  },
  baseSepolia: {
    // Default dev network
    // ...
  }
} as const;

// EAS schema UIDs from config/schemas.json
export const EAS_SCHEMAS = {
  workSubmission: '0x...' as const,
  workApproval: '0x...' as const,
  assessment: '0x...' as const,
} as const;
```

### 7.3 UserOperation Building

```typescript
// lib/transactions/userOp.ts

import {
  createSmartAccountClient,
  type SmartAccountClient
} from 'permissionless';
import {
  createPimlicoClient
} from 'permissionless/clients/pimlico';
import { arbitrum } from 'viem/chains';

export async function buildMintUserOp(params: {
  smartAccountClient: SmartAccountClient;
  metadataUri: string;
  merkleRoot: Hex;
  totalUnits: bigint;
}) {
  const calldata = encodeCreateAllowlist({
    account: smartAccountClient.account.address,
    totalUnits: params.totalUnits,
    merkleRoot: params.merkleRoot,
    metadataUri: params.metadataUri,
    transferRestrictions: TransferRestrictions.AllowAll
  });

  const userOp = await smartAccountClient.prepareUserOperationRequest({
    userOperation: {
      callData: await smartAccountClient.account.encodeCallData({
        to: HYPERCERT_MINTER_ADDRESS,
        data: calldata,
        value: 0n
      })
    }
  });

  return userOp;
}

export async function submitUserOp(params: {
  smartAccountClient: SmartAccountClient;
  userOp: UserOperation;
}) {
  const hash = await smartAccountClient.sendUserOperation({
    userOperation: params.userOp
  });

  return hash;
}

export async function waitForReceipt(params: {
  bundlerClient: ReturnType<typeof createPimlicoClient>;
  userOpHash: Hex;
}) {
  const receipt = await params.bundlerClient.waitForUserOperationReceipt({
    hash: params.userOpHash
  });

  return receipt;
}
```

---

## 8. Implementation Plan

### 8.1 Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React + Vite | 18.x / 5.x |
| UI Components | Radix UI | Latest |
| State Management | Zustand | 5.x |
| State Machines | XState | 5.x |
| Form Handling | React Hook Form + Zod | 7.x |
| GraphQL Client | Urql | 5.x |
| Blockchain | Viem | 2.x |
| Account Abstraction | Permissionless | 0.x |
| Wallet Connection | Reown AppKit | Latest |
| Styling | Tailwind CSS v4 | 4.x |
| Testing | Vitest | Latest |
| IPFS | @web3-storage/w3up-client | Latest |
| Bundler | Pimlico | v2 API |
| Indexer | Envio | 2.x |
| Package Manager | Bun | Latest |

### 8.2 Development Phases

#### Phase 1: Foundation (Week 1)
- [ ] Add hypercert types to `packages/shared`
- [ ] Create Envio indexer schema extensions for hypercerts
- [ ] Implement GraphQL queries in admin package
- [ ] Set up Zustand store for wizard state

#### Phase 2: Core Wizard (Week 2)
- [ ] Implement wizard container with XState
- [ ] Build AttestationSelector (Step 1)
- [ ] Build MetadataEditor (Step 2)
- [ ] Build PreviewPanel (Step 3)
- [ ] Build DistributionConfig (Step 4)

#### Phase 3: Minting Flow (Week 3)
- [ ] Implement Storracha upload client
- [ ] Implement merkle tree generation
- [ ] Build UserOp construction with permissionless
- [ ] Integrate Pimlico bundler
- [ ] Build MintConfirmation (Step 5)

#### Phase 4: Polish & Testing (Week 4)
- [ ] Implement draft persistence (IndexedDB)
- [ ] Add Karma GAP SDK integration
- [ ] Build hypercert list and detail views
- [ ] End-to-end testing with Vitest
- [ ] Performance optimization

### 8.3 Commands

```bash
# Development
bun --filter admin dev          # http://localhost:3002
bun --filter indexer dev        # Envio playground

# Testing
bun --filter admin test         # Vitest
bun --filter admin test:coverage

# Building
bun --filter admin build        # Vite production build

# Linting
bun --filter admin lint         # oxlint
bun --filter admin format       # Biome
```

### 8.4 Milestones

| Milestone | Date | Deliverable |
|-----------|------|-------------|
| M1: Schema Complete | Jan 22, 2026 | Types, indexer, GraphQL |
| M2: Wizard UI Complete | Jan 29, 2026 | All 5 wizard steps |
| M3: Minting Works | Feb 5, 2026 | Full mint on testnet |
| M4: Production Ready | Feb 12, 2026 | All features, tested |

---

## 9. Testing Strategy

### 9.1 Test Types

| Test Type | Scope | Tools |
|-----------|-------|-------|
| Unit | Functions, utilities | Vitest |
| Component | React components | Vitest + Testing Library |
| Integration | GraphQL, contracts | Vitest + MSW |
| E2E | Full user flows | Playwright |

### 9.2 Key Test Cases

```typescript
// lib/hypercerts/merkle.test.ts
describe('generateMerkleTree', () => {
  it('creates valid merkle root from allowlist', () => {
    const allowlist = [
      { address: '0x1234...', units: 50_000_000n },
      { address: '0x5678...', units: 50_000_000n }
    ];
    const { root, proofs } = generateMerkleTree(allowlist);
    expect(root).toMatch(/^0x[a-f0-9]{64}$/);
    expect(proofs).toHaveLength(2);
  });
});

// hooks/useAttestations.test.ts
describe('useAttestations', () => {
  it('fetches approved attestations for garden', async () => {
    const { result } = renderHook(() =>
      useAttestations({ gardenId: 'test-garden' })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toHaveLength(10);
  });
});
```

---

## 10. Deployment

### 10.1 Infrastructure

- **Frontend:** Vercel (static Vite build)
- **Indexer:** Envio Cloud or self-hosted
- **Networks:** Arbitrum One (production), Base Sepolia (staging)

### 10.2 Environment Variables

```bash
# .env.local (admin package)
VITE_ENVIO_ENDPOINT=https://indexer.greengoods.app/graphql
VITE_PIMLICO_API_KEY=your-pimlico-key
VITE_STORRACHA_PRIVATE_KEY=your-storracha-key
VITE_REOWN_PROJECT_ID=your-reown-project-id
VITE_DEFAULT_CHAIN_ID=42161  # Arbitrum One
```

---

## 11. Appendices

### 11.1 Glossary

| Term | Definition |
|------|------------|
| GardenAccount | ERC-6551 token-bound account for a garden |
| GardenToken | ERC-721 token representing garden ownership |
| ActionRegistry | Contract defining allowable work activities |
| WorkApprovalResolver | Resolver that validates and records approvals |
| gapProjectUID | Karma GAP project identifier stored in GardenAccount |

### 11.2 Related Documents

- Feature Spec: GG-FEAT-005_Hypercerts_Minting_Spec.md
- PRD: Green_Goods_v1_PRD_FINAL_v2.md
- Architecture: docs/developer/architecture.md
- Contracts Handbook: docs/developer/contracts-handbook.md

### 11.3 Changelog

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 18, 2026 | Engineering | Initial technical specification |
| 2.0 | Jan 18, 2026 | Engineering | Corrected architecture: Vite (not Next.js), no backend API, client-side orchestration, updated contract details |

---

*End of Technical Specification*
