# Attestations & On-Chain Records

Understanding how Green Goods creates permanent, verifiable proof of regenerative impact using the Ethereum Attestation Service (EAS).

---

## What Is an Attestation?

An **attestation** is a cryptographically signed, on-chain statement about something. In Green Goods, attestations prove:
- ✅ Gardeners completed specific work
- ✅ Operators validated that work
- ✅ Gardens conducted assessments
- ✅ Impact was measured and verified

**Key Properties**:
- **Permanent**: Cannot be edited or deleted
- **Verifiable**: Cryptographically signed
- **Transparent**: Publicly queryable
- **Composable**: Can reference other attestations

---

## Why Attestations Matter

### The Problem with Traditional Proof

**Off-chain records**:
- 📄 Can be edited or deleted
- 🔒 Controlled by single entity
- ❓ Hard to verify authenticity
- 🚫 Not interoperable

**Green Goods attestations**:
- ⛓️ Immutable on blockchain
- 🌍 No single point of control
- ✅ Cryptographically verifiable
- 🔗 Composable with other protocols

### Real-World Impact

**For Gardeners**:
- Build verifiable impact portfolio
- Prove work to funders
- Transfer reputation across platforms

**For Operators**:
- Transparent validation process
- Audit trail of approvals
- Accountability to community

**For Funders**:
- Verify impact before funding
- Track outcomes transparently
- Ensure grants went to real work

---

## EAS (Ethereum Attestation Service)

Green Goods uses **EAS**, a battle-tested protocol for on-chain attestations.

### EAS Architecture

```
EAS Contract (on Arbitrum, Celo, Base)
├── Schema Registry: Defines attestation structures
└── Attestations: Actual signed records
```

**Learn more**: [attest.sh](https://attest.sh)

### Why EAS?

- ✅ **Battle-tested**: Used by ENS, Gitcoin, Optimism
- ✅ **Multi-chain**: Deployed on 15+ networks
- ✅ **Composable**: Attestations can reference each other
- ✅ **Flexible**: Custom schemas for any use case
- ✅ **Open**: Free to use, open source

---

## Green Goods Schemas

Green Goods defines three core attestation schemas:

### 1. Work Submission Schema

**Purpose**: Document completed regenerative tasks

**Fields**:
```
Work Submission {
  actionUID: uint256     // Which action was completed
  title: string          // Brief description
  feedback: string       // Gardener notes
  metadata: string       // JSON with metrics (IPFS)
  media: string[]        // Photo/video CIDs (IPFS)
}
```

**Who creates**: Gardeners (via smart account)
**When**: After completing MDR workflow
**Attester**: Gardener's address (or garden account)

**Example (Arbitrum)**:
```
Schema UID: 0xf6fd183baeb8ae5c5f2f27a734b546b6128bee7877ea074f5cf9b18981be3a20
Attester: 0xGardenerSmartAccount...
Data:
  actionUID: 1
  title: "Planted 25 oak trees"
  metadata: "ipfs://Qm.../metrics.json"
  media: ["ipfs://Qm.../before.jpg", "ipfs://Qm.../after.jpg"]
```

### 2. Work Approval Schema

**Purpose**: Validate gardener submissions

**Fields**:
```
Work Approval {
  actionUID: uint256   // Action reference
  workUID: bytes32     // Reference to work attestation
  approved: bool       // True = approved, False = rejected
  feedback: string     // Operator comments
}
```

**Who creates**: Garden operators
**When**: After reviewing gardener work
**Attester**: Operator's wallet address
**References**: Points to work submission attestation

**Example (Arbitrum)**:
```
Schema UID: 0x9d734bc51ee7d3186a8f61603500c41386a5670d210e6995ba4973a7dedae60f
Attester: 0xOperatorAddress...
Referenced Attestation: 0xWorkSubmissionUID...
Data:
  actionUID: 1
  workUID: 0xWorkSubmissionUID...
  approved: true
  feedback: "Excellent work, well-documented"
```

### 3. Assessment Schema

**Purpose**: Comprehensive garden evaluations

**Fields**:
```
Assessment {
  title: string
  description: string
  assessmentType: string
  capitals: string[]          // Which capitals measured
  metricsJSON: string         // Detailed metrics (IPFS)
  evidenceMedia: string[]     // Supporting photos/docs
  reportDocuments: string[]   // PDFs, reports
  impactAttestations: bytes32[] // Links to work attestations
  startDate: uint256
  endDate: uint256
  location: string
  tags: string[]
}
```

**Who creates**: Operators or evaluators
**When**: Quarterly, annually, or milestone-based
**Attester**: Garden account or operator

---

## Attestation Lifecycle

### 1. Creation

**On-chain transaction** creates permanent record:

```solidity
// Example: Garden creates work submission attestation
eas.attest(AttestationRequest({
  schema: WORK_SCHEMA_UID,
  data: AttestationRequestData({
    recipient: gardener,
    expirationTime: 0, // Never expires
    revocable: false,  // Cannot be revoked
    refUID: 0x0,       // No reference
    data: encodedData, // ABI-encoded work data
    value: 0           // No ETH sent
  })
}));
```

**Transaction broadcast** → **Confirmed** → **Attestation UID generated** → **Indexed by Envio**

### 2. Storage

**On-chain**:
- Attestation UID
- Schema reference
- Attester address
- Timestamp
- Data (ABI-encoded)

**Off-chain** (IPFS):
- Large media files
- Detailed JSON metadata
- Referenced by CID in attestation

### 3. Verification

**Anyone can verify** attestations:
1. Query EAS contract with attestation UID
2. Decode data using schema
3. Verify attester signature
4. Check referenced attestations

**EAS Explorers**:
- Arbitrum: [arbitrum.easscan.org](https://arbitrum.easscan.org)
- Celo: [celo.easscan.org](https://celo.easscan.org)
- Base Sepolia: [base-sepolia.easscan.org](https://base-sepolia.easscan.org)

<!-- TODO: Add screenshot of EAS explorer -->
<!-- TODO: Add image - EAS Explorer -->
<!-- ![EAS Explorer](../.gitbook/assets/eas-explorer.png) -->
*View attestations on EAS explorer*

---

## Attestation Chains

Green Goods attestations reference each other, creating verifiable chains:

```
Garden Assessment
└─ references ──> Work Approval #1
                  └─ references ──> Work Submission #1
                  
└─ references ──> Work Approval #2
                  └─ references ──> Work Submission #2
```

**Benefits**:
- 🔗 **Traceability**: Follow work → approval → assessment chain
- ✅ **Verification**: Confirm each link in chain
- 📊 **Aggregation**: Roll up impact across attestations

---

## Karma GAP Integration

Green Goods automatically creates **Karma GAP** attestations alongside core attestations.

### What Is Karma GAP?

The **Grantee Accountability Protocol (GAP)** is a standardized framework for impact reporting across chains.

**Two GAP Attestation Types**:

**1. GAP Project** (Garden creation)
```
When: Garden is created
Data:
  - Project name
  - Description
  - Members
  - Metadata
```

**2. GAP Impact** (Work approval)
```
When: Operator approves work
Data:
  - Impact description
  - Metrics
  - Evidence (IPFS links)
  - Project reference
```

### Automatic GAP Attestations

When operators approve work in Green Goods:
1. ✅ Work Approval attestation created (Green Goods schema)
2. ✅ GAP Impact attestation created (Karma schema)
3. ✅ Both reference same work and evidence
4. ✅ Transparent reporting to GAP platform

**View on Karma GAP**: [gap.karmahq.xyz](https://gap.karmahq.xyz/)

[Learn more about Karma GAP →](../developer/karma-gap)

---

## Attestation Data Model

### Deployed Networks

Green Goods attestations are deployed on:

**Arbitrum One** (42161):
- Work Schema: `0xf6fd183baeb8ae5c5f2f27a734b546b6128bee7877ea074f5cf9b18981be3a20`
- Approval Schema: `0x9d734bc51ee7d3186a8f61603500c41386a5670d210e6995ba4973a7dedae60f`
- Assessment Schema: `0x0356357a57e39ec4057763f3853116b97193589c7592eb7f81b9ed45d97cc598`

**Celo** (42220):
- Work Schema: `0x481c4190bcaf0140d77d1124acd443f51ed78d73fecb6cd4f77265142df0c00a`
- Approval Schema: `0x584054ca6d3ed2d3adaed85fd3e2375d1197cb7e4c9698fec62d7431323f20c6`
- Assessment Schema: `0xcbcd83143911085d2010d921a12ecf53569eb8dc4564b0ddb5d469c03b44d232`

**Base Sepolia** (84532):
- Work Schema: `0x481c4190bcaf0140d77d1124acd443f51ed78d73fecb6cd4f77265142df0c00a`
- Approval Schema: `0x584054ca6d3ed2d3adaed85fd3e2375d1197cb7e4c9698fec62d7431323f20c6`
- Assessment Schema: `0xcbcd83143911085d2010d921a12ecf53569eb8dc4564b0ddb5d469c03b44d232`



---

## Querying Attestations

### Via Green Goods Indexer

**GraphQL API** provides easy access:

```graphql
query WorkAttestations($gardenId: String!) {
  Work(where: {gardenId: {_eq: $gardenId}}) {
    id
    attestationUID
    title
    media
    approvals: WorkApproval {
      approved
      attestationUID
      feedback
    }
  }
}
```

### Via EAS SDK

**Direct on-chain queries**:

```typescript
import { EAS } from "@ethereum-attestation-service/eas-sdk";

const eas = new EAS("0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458"); // Arbitrum EAS address
eas.connect(provider);

// Get attestation by UID (not schema UID)
const attestationUID = "0x1234..."; // Actual attestation UID from transaction
const attestation = await eas.getAttestation(attestationUID);

console.log(attestation.attester);
console.log(attestation.recipient);
console.log(attestation.data);
```

---

## Why Verifiability Matters

### For Impact Funding

**Traditional approach**:
- Funder relies on grantee self-reporting
- Hard to verify actual work done
- Delayed or incomplete reports common

**With Green Goods attestations**:
- Funder queries on-chain records
- Verifies work was done and approved
- Sees real-time progress
- Makes retroactive funding possible

### For Reputation

**Build portable impact history**:
- Attestations follow you across platforms
- Can't be deleted by any party
- Verifiable by anyone, anytime
- Composable with other protocols

### For Research

**Academic credibility**:
- Cite verifiable on-chain sources
- Reproducible data analysis
- No trust required in data provider
- Transparent methodology

---

## Future: Composability

Attestations enable powerful future use cases:

**Impact Markets**:
- Trade attestations as impact certificates
- Price based on verified outcomes
- Liquid markets for regenerative work

**DAO Governance**:
- Voting weight based on verified work
- Reputation-weighted proposals
- Transparent contribution tracking

**Cross-Protocol Integration**:
- Attestations as credentials in other dApps
- Unlock benefits based on verified impact
- Portable reputation across ecosystems

---

## Learn More

- [Gardens & Work](gardens-and-work) — What gets attested
- [MDR Workflow](mdr-workflow) — How work creates attestations
- [Karma GAP Integration](../developer/karma-gap) — Technical details
- [EAS Documentation](https://docs.attest.org/) — Ethereum Attestation Service background and reference
- [Contract Deployments](https://github.com/greenpill-dev-guild/green-goods/tree/main/packages/contracts/deployments) — Schema UIDs by network

