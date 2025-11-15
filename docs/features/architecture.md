# System Architecture (Non-Technical)

A high-level overview of how Green Goods works—designed for users, operators, and non-technical stakeholders who want to understand the system without diving into code.

---

## The Big Picture

Green Goods is a **full-stack regenerative impact platform** connecting mobile users, web dashboards, blockchain networks, and data infrastructure.

```
┌─────────────────────────────────────────────────────────┐
│                    User Layer                            │
│                                                          │
│  Gardener (Mobile PWA)  ←→  Operator (Admin Dashboard)  │
│  Evaluator (API/Explorers)                              │
└─────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────┐
│                   Application Layer                      │
│                                                          │
│  Client App        Admin Dashboard        GraphQL API   │
│  (React PWA)       (React Dashboard)      (Envio)       │
└─────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                    │
│                                                          │
│  IPFS Storage      Smart Accounts        Indexer DB     │
│  (Pinata)          (Pimlico)             (PostgreSQL)   │
└─────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────┐
│                   Blockchain Layer                       │
│                                                          │
│  Arbitrum One  ←→  Celo  ←→  Base Sepolia              │
│  (Smart Contracts + EAS Attestations)                   │
└─────────────────────────────────────────────────────────┘
```

---

## User Journeys

### Gardener Journey: Submit Work

**1. In the Field**
```
Gardener plants trees
  ↓
Opens greengoods.app on phone (works offline)
  ↓
Takes before/after photos
  ↓
Fills MDR form (2 minutes)
  ↓
Submits work
```

**2. Behind the Scenes**
```
Photos stored locally (IndexedDB)
  ↓
Form data queued
  ↓
When online: Photos → IPFS (via Pinata)
  ↓
Work data → Smart Account transaction
  ↓
Smart Contract creates attestation
  ↓
Indexer detects event → Updates GraphQL API
```

**3. Operator Reviews**
```
Operator sees pending work in admin dashboard
  ↓
Reviews photos and metrics
  ↓
Approves work
  ↓
Approval attestation created on-chain
  ↓
Karma GAP impact attestation auto-created
  ↓
Gardener receives notification
```

**Result**: Verified, permanent on-chain record of impact work

### Operator Journey: Approve Work

**1. Access Dashboard**
```
Operator visits admin.greengoods.app
  ↓
Connects wallet (MetaMask, etc.)
  ↓
Dashboard shows pending work
```

**2. Review Workflow**
```
Click pending submission
  ↓
View photos from IPFS
  ↓
Check metrics and context
  ↓
Approve or reject with feedback
```

**3. On-Chain Recording**
```
Approve button → Transaction sent
  ↓
WorkApprovalResolver validates operator permission
  ↓
Creates EAS attestation
  ↓
Triggers Karma GAP impact attestation
  ↓
Indexer updates GraphQL
  ↓
Gardener sees approved status
```

### Evaluator Journey: Query Data

**1. Access API**
```
Evaluator visits GraphQL playground
  ↓
Or uses API client (Postman, code)
```

**2. Query Garden Impact**
```graphql
query GardenWork {
  Garden(where: {id: {_eq: "42161-1"}}) {
    name
    work: Work_aggregate {
      aggregate { count }
    }
  }
}
```

**3. Verify On-Chain**
```
Get attestation UID from query result
  ↓
Visit EAS explorer
  ↓
Verify cryptographic signature
  ↓
Confirm data matches
```

---

## Components Deep Dive

### Client PWA (greengoods.app)

**Purpose**: Mobile-first app for gardeners to document work

**Technology**:
- React 18 + TypeScript
- Vite bundler
- TanStack Query (data fetching)
- Zustand (state management)
- Tailwind CSS v4

**Key Features**:
- Passkey authentication
- Offline job queue
- Camera integration
- Real-time sync status

**Data Flow**:
```
User input → Local validation → IndexedDB queue
  → Background sync → IPFS + Blockchain
  → Confirmation to user
```

**Deployment**: Vercel CDN (instant global access)

### Admin Dashboard (admin.greengoods.app)

**Purpose**: Web dashboard for operators to manage gardens and approve work

**Technology**:
- React 18 + TypeScript
- Urql (GraphQL client)
- XState (workflow orchestration)
- Zustand (state management)

**Key Features**:
- Wallet connection (MetaMask, etc.)
- Real-time GraphQL subscriptions
- Garden and member management
- Work review interface
- Impact analytics

**Data Flow**:
```
GraphQL subscription → Real-time updates
  → Operator action → Blockchain transaction
  → Indexer detects → UI updates
```

**Deployment**: Vercel

### GraphQL Indexer (Envio)

**Purpose**: Fast, queryable database of blockchain events

**Technology**:
- Envio HyperIndex
- PostgreSQL database
- GraphQL API
- ReScript event handlers

**What It Indexes**:
- Garden creations
- Action registrations
- Work submissions
- Work approvals
- Member additions/removals
- Attestations

**Query Example**:
```graphql
subscription NewApprovals {
  WorkApproval(where: {approved: {_eq: true}}) {
    id
    workUID
    feedback
    work {
      title
      gardener
    }
  }
}
```

**Public Endpoint**: https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql

### Smart Contracts (On-Chain)

**Core Contracts**:

**1. GardenToken** (ERC-721)
- Gardens as NFTs
- Tokenbound account per garden
- Garden creation and transfer

**2. ActionRegistry**
- Register available actions
- Track action metadata
- Emit action events

**3. WorkResolver**
- Validates work submissions
- Creates work attestations
- Enforces gardener membership

**4. WorkApprovalResolver**
- Validates approvals
- Creates approval attestations
- Enforces operator permissions
- Triggers Karma GAP attestations

**5. AssessmentResolver**
- Garden assessments
- Multi-capital tracking
- Impact aggregation

**Deployment**:
- **Arbitrum One**: 0x8578004FD468212B9056052856c7cF282760Ef25 (ActionRegistry)
- **Celo**: 0x0747ED4f1915b8f3A6eA8a9d8216E8F53EE80f92 (ActionRegistry)
- **Base Sepolia**: 0x9685E9E5430C13AFF7ef32D9E8fc93d516e121E0 (ActionRegistry)

[Full Contract Addresses →](../../packages/contracts/deployments/)

---

## Data Flow Diagrams

### Work Submission Flow

```
┌──────────────┐
│   Gardener   │
│  (Mobile)    │
└──────┬───────┘
       │ 1. Take photos
       │ 2. Fill form
       │ 3. Submit
       ↓
┌──────────────┐
│  IndexedDB   │ ← Offline storage
│  (Local)     │
└──────┬───────┘
       │ When online
       ↓
┌──────────────┐
│     IPFS     │ ← Media storage
│   (Pinata)   │   (photos/videos)
└──────┬───────┘
       │ CIDs returned
       ↓
┌──────────────┐
│ Smart Account│ ← Gasless transaction
│  (Pimlico)   │   via paymaster
└──────┬───────┘
       │ Transaction
       ↓
┌──────────────┐
│ WorkResolver │ ← Smart contract
│ (On-Chain)   │   validates + creates attestation
└──────┬───────┘
       │ Event emitted
       ↓
┌──────────────┐
│   Indexer    │ ← Listens for events
│   (Envio)    │   updates database
└──────┬───────┘
       │ GraphQL update
       ↓
┌──────────────┐
│   Operator   │ ← Sees pending work
│  Dashboard   │   in real-time
└──────────────┘
```

### Work Approval Flow

```
┌──────────────┐
│   Operator   │
│  Dashboard   │
└──────┬───────┘
       │ 1. Review work
       │ 2. Approve
       ↓
┌──────────────┐
│    Wallet    │ ← Operator signs
│ (MetaMask)   │   transaction
└──────┬───────┘
       │ Transaction
       ↓
┌──────────────────┐
│ WorkApproval     │ ← Smart contract
│ Resolver         │   validates operator
│ (On-Chain)       │   creates attestation
└──────┬───────────┘
       │ Triggers
       ↓
┌──────────────────┐
│  Karma GAP       │ ← Auto-creates
│  Integration     │   impact attestation
└──────┬───────────┘
       │ Events emitted
       ↓
┌──────────────────┐
│    Indexer       │ ← Updates database
│    (Envio)       │
└──────┬───────────┘
       │ GraphQL updates
       ↓
┌──────────────────┐
│    Gardener      │ ← Sees approved work
│    Client        │   receives confirmation
└──────────────────┘
```

---

## Security & Trust Model

### Authentication

**Gardeners (Passkey)**:
- WebAuthn standard
- Biometric verification
- Device-bound credentials
- Can't be phished

**Operators (Wallet)**:
- Self-custody wallets
- Transaction signing
- Full transparency
- User controls keys

### Authorization

**On-Chain Enforcement**:
- Only gardeners can submit work
- Only operators can approve work
- Only admins can create gardens
- Enforced by smart contracts

**Off-Chain Validation**:
- UI hides unavailable features
- API respects permissions
- Graceful error messages

### Data Integrity

**Immutable Records**:
- Attestations can't be edited
- Blockchain provides finality
- Timestamp proofs

**Verification**:
- Anyone can verify attestations
- Cryptographic signatures
- Open data, open source

---

## Scalability

### Current Capacity

**Transactions**:
- L2 networks handle 1000+ TPS
- Green Goods uses minimal gas
- Batch operations where possible

**Storage**:
- IPFS handles large media
- On-chain stores only CIDs
- Indexer optimized for queries

### Future Scaling

**Multi-Chain**:
- Deploy to more L2s
- Cross-chain bridges
- Unified data layer

**Caching**:
- CDN for static assets
- GraphQL response caching
- Optimistic UI updates

**Sharding** (if needed):
- Regional gardens on different chains
- Unified query layer
- Cross-chain attestations

---

## Monitoring & Observability

### User Analytics

**PostHog Integration**:
- Anonymous usage tracking
- Feature adoption rates
- Error tracking
- Performance metrics

**Privacy-First**:
- No personal data collected
- Opt-out available
- GDPR compliant

### System Health

**Blockchain Monitoring**:
- Transaction success rates
- Gas prices
- Contract events

**API Monitoring**:
- Query latencies
- Error rates
- Uptime

**Alerting**:
- Critical errors → Telegram
- Performance degradation monitoring
- Automatic retries

---

## Learn More

### Technical Documentation

- [Developer Architecture Guide](../developer/architecture/monorepo-structure.md) — Code-level details
- [Client Package](../developer/architecture/client-package.md) — PWA architecture
- [Admin Package](../developer/architecture/admin-package.md) — Dashboard architecture
- [Indexer Package](../developer/architecture/indexer-package.md) — GraphQL indexer
- [Contracts Package](../developer/architecture/contracts-package.md) — Smart contracts

### Product Documentation

- [Product Overview](overview.md) — Vision and goals
- [Core Features](core-features.md) — Feature breakdown
- [Offline Architecture](../developer/architecture/client-package.md) — Offline-first details
- [Karma GAP Integration](../developer/karma-gap.md) — GAP technical spec

### Concepts

- [Attestations](../concepts/attestations.md) — How verification works
- [Gardens & Work](../concepts/gardens-and-work.md) — Data model
- [MDR Workflow](../concepts/mdr-workflow.md) — User experience

