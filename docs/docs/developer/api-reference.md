# API & Integration Reference

GraphQL APIs, smart contract interfaces, and integration examples for Green Goods protocol.

> **Networks:** Arbitrum One (42161), Celo (42220), Base Sepolia (84532). Contract addresses and schema UIDs are published in `packages/contracts/deployments/*.json`. Updated November 2024.

---

## Data Sources Overview

Green Goods uses **two separate GraphQL APIs** for different data:

### 1. Green Goods Indexer (Envio)

**Endpoint**: https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql

**Provides:**
- Gardens (metadata, members, GAP projects)
- Actions (task registry)
- Gardeners (member profiles)

**Local dev**: http://localhost:8080/v1/graphql (password: `testing`)

### 2. EAS GraphQL API

**Endpoints (by network)**:
- **Arbitrum**: https://arbitrum.easscan.org/graphql
- **Celo**: https://celo.easscan.org/graphql
- **Base Sepolia**: https://base-sepolia.easscan.org/graphql

**Provides:**
- Work submission attestations
- Work approval attestations
- Assessment attestations

**Why separate?** Work/approval data lives in EAS attestations (general-purpose attestation system). Garden/action/member data needs custom indexed relationships for efficient queries.

---

## Green Goods Indexer Queries

### Gardens

```graphql
query AllGardens {
  Garden {
    id
    chainId
    name
    location
    gardeners
    operators
    createdAt
    gapProjectUID
  }
}

query GardenById($id: String!) {
  Garden(where: {id: {_eq: $id}}) {
    id
    chainId
    name
    description
    location
    bannerImage
    openJoining
    gardeners
    operators
    gapProjectUID
  }
}

query GardensByChain($chainId: Int!) {
  Garden(where: {chainId: {_eq: $chainId}}) {
    id
    name
    location
  }
}
```

### Actions

```graphql
query AllActions {
  Action {
    id
    chainId
    title
    instructions
    capitals
    startTime
    endTime
    ownerAddress
    media
  }
}

query ActionsByChain($chainId: Int!) {
  Action(where: {chainId: {_eq: $chainId}}) {
    id
    title
    startTime
    endTime
  }
}
```

### Gardeners

```graphql
query Gardeners($gardenId: String!) {
  Gardener(where: {gardens: {_contains: $gardenId}}) {
    id
    chainId
    gardens
    firstGarden
    ensName
    ensAvatar
  }
}

query GardenersByChain($chainId: Int!) {
  Gardener(where: {chainId: {_eq: $chainId}}) {
    id
    gardens
  }
}
```

---

## EAS Attestation Queries

Work and approval data must be queried from **EAS GraphQL** (not Green Goods indexer).

### Work Submissions

```graphql
query WorkSubmissions($schemaId: String!, $recipient: String!) {
  attestations(
    where: {
      schemaId: { equals: $schemaId }
      recipient: { equals: $recipient }
      revoked: { equals: false }
    }
    orderBy: { timeCreated: desc }
  ) {
    id
    attester
    recipient
    timeCreated
    decodedDataJson
  }
}
```

**Variables (Arbitrum example)**:
```json
{
  "schemaId": "0xf6fd183baeb8ae5c5f2f27a734b546b6128bee7877ea074f5cf9b18981be3a20",
  "recipient": "0xGardenAccountAddress..."
}
```

**Decoded fields**:
- `actionUID`: Action identifier
- `title`: Work title
- `feedback`: Gardener notes
- `metadata`: IPFS CID with metrics JSON
- `media`: Array of IPFS CIDs (photos/videos)

### Work Approvals

```graphql
query WorkApprovals($schemaId: String!, $recipient: String!) {
  attestations(
    where: {
      schemaId: { equals: $schemaId }
      recipient: { equals: $recipient }
      revoked: { equals: false }
    }
    orderBy: { timeCreated: desc }
  ) {
    id
    attester
    recipient
    refUID
    timeCreated
    decodedDataJson
  }
}
```

**Variables (Arbitrum example)**:
```json
{
  "schemaId": "0x9d734bc51ee7d3186a8f61603500c41386a5670d210e6995ba4973a7dedae60f",
  "recipient": "0xGardenAccountAddress..."
}
```

**Decoded fields**:
- `actionUID`: Action identifier
- `workUID`: Referenced work attestation UID
- `approved`: Boolean (true = approved, false = rejected)
- `feedback`: Operator comments

---

## Combined Query Pattern

To get complete garden data with work, query **both** APIs:

### Step 1: Get Garden (Envio Indexer)

```typescript
const gardenQuery = `
  query GardenById($id: String!) {
    Garden(where: {id: {_eq: $id}}) {
      id
      name
      gardeners
      operators
    }
  }
`;

const garden = await fetch('https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    query: gardenQuery,
    variables: { id: gardenAddress }
  })
});
```

### Step 2: Get Work Attestations (EAS GraphQL)

```typescript
const workQuery = `
  query WorkSubmissions($schemaId: String!, $recipient: String!) {
    attestations(where: {
      schemaId: { equals: $schemaId },
      recipient: { equals: $recipient },
      revoked: { equals: false }
    }) {
      id
      decodedDataJson
    }
  }
`;

const works = await fetch('https://arbitrum.easscan.org/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: workQuery,
    variables: {
      schemaId: "0xf6fd183baeb8ae5c5f2f27a734b546b6128bee7877ea074f5cf9b18981be3a20",
      recipient: gardenAddress
    }
  })
});
```

### Using @green-goods/shared

The shared package abstracts these data sources:

```typescript
import { getGardens } from '@green-goods/shared/modules/data/indexer';
import { getWorks, getWorkApprovals } from '@green-goods/shared/modules/data/eas';

// From Envio indexer
const gardens = await getGardens(chainId);

// From EAS GraphQL
const works = await getWorks(gardenAddress, chainId);
const approvals = await getWorkApprovals(gardenAddress, chainId);
```

---

## Contract Interfaces

### GardenToken

```solidity
// Struct for garden configuration
struct GardenConfig {
    address communityToken;
    string name;
    string description;
    string location;
    string bannerImage;
    string metadata;
    bool openJoining;
    address[] gardeners;
    address[] gardenOperators;
}

interface IGardenToken {
    /// @notice Mints a new garden NFT and creates token-bound account
    /// @param config Garden configuration struct
    /// @return Garden account address (ERC-6551)
    function mintGarden(GardenConfig calldata config) external returns (address);
}
```

**Garden management** happens via the GardenAccount contract (token-bound account), not GardenToken.

### GardenAccount

```solidity
interface IGardenAccount {
    /// @notice Add gardener (operators and owner only)
    function addGardener(address gardener) external;
    
    /// @notice Remove gardener (operators and owner only)
    function removeGardener(address gardener) external;
    
    /// @notice Add operator (operators and owner only)
    function addOperator(address operator) external;
    
    /// @notice Remove operator (operators and owner only)
    function removeOperator(address operator) external;
    
    /// @notice Update garden name (owner only)
    function updateName(string memory _name) external;
    
    /// @notice Update garden description (owner only)
    function updateDescription(string memory _description) external;
}
```

### ActionRegistry

```solidity
enum Capital {
    SOCIAL,
    MATERIAL,
    FINANCIAL,
    LIVING,
    INTELLECTUAL,
    EXPERIENTIAL,
    SPIRITUAL,
    CULTURAL
}

interface IActionRegistry {
    /// @notice Register new action (owner only)
    /// @return actionUID The unique identifier for the created action
    function registerAction(
        uint256 _startTime,
        uint256 _endTime,
        string calldata _title,
        string calldata _instructions,
        Capital[] calldata _capitals,
        string[] calldata _media
    ) external returns (uint256 actionUID);
    
    /// @notice Get action details
    function getAction(uint256 actionUID) external view returns (Action memory);
}
```

---

## Contract Addresses

**See deployment files** for complete addresses:
- [Arbitrum (42161)](https://github.com/greenpill-dev-guild/green-goods/blob/main/packages/contracts/deployments/42161-latest.json)
- [Celo (42220)](https://github.com/greenpill-dev-guild/green-goods/blob/main/packages/contracts/deployments/42220-latest.json)
- [Base Sepolia (84532)](https://github.com/greenpill-dev-guild/green-goods/blob/main/packages/contracts/deployments/84532-latest.json)

**Key contracts** (Base Sepolia):
- GardenToken: `0x0B0EA0FfB996B0b04335507Ef1523124480f7310`
- ActionRegistry: `0x9685E9E5430C13AFF7ef32D9E8fc93d516e121E0`
- WorkResolver: `0x028ff0640262a1847d512B3690266d0B35d5260F`
- WorkApprovalResolver: `0x54b9Dd27d4eD2282D8Cd12CD55ee4B983eC9E3D6`

---

## Integration Examples

### Node.js

**Query gardens from Envio indexer:**
```javascript
import fetch from 'node-fetch';

const query = `
  query {
    Garden {
      id
      name
      location
    }
  }
`;

const res = await fetch('https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
});

const { data } = await res.json();
console.log(data.Garden);
```

### Python

**Query gardens from Envio indexer:**
```python
import requests

query = """
query {
  Garden {
    id
    name
    gardeners
  }
}
"""

response = requests.post(
    'https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql',
    json={'query': query}
)

gardens = response.json()['data']['Garden']
```

### React (with TanStack Query)

**Query gardens from Envio indexer:**
```typescript
import { useQuery } from '@tanstack/react-query';
import { request, gql } from 'graphql-request';

const GARDENS_QUERY = gql`
  query GardensByChain($chainId: Int!) {
    Garden(where: {chainId: {_eq: $chainId}}) {
      id
      name
      location
    }
  }
`;

function GardenList({ chainId }: { chainId: number }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['gardens', chainId],
    queryFn: () => request(
      'https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql',
      GARDENS_QUERY,
      { chainId }
    ),
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {data.Garden.map(garden => (
        <li key={garden.id}>{garden.name}</li>
      ))}
    </ul>
  );
}
```

---

## Schema UIDs

**For EAS GraphQL queries** - use these schema UIDs to filter attestations:

### Arbitrum One (42161)

- Work: `0x8b8d53d8d4f258c621319185e86dad094e45a21b8ca7770a44770daae22c5a16`
- Approval: `0xe8dc098b57c5db925256ff6274da00aeb53377f241c8db56e5ec87d521c43367`
- Assessment: `0xcf9a20d8c1c3037199d178580c0de0946beb5f1b1f3a9c97446d2a69f55187d1`


**Source**: `packages/contracts/deployments/<chainId>-latest.json`


---

## Rate Limits

**No limits currently** on GraphQL APIs.

Future: May add reasonable limits for abuse prevention.

---

## Hypercerts API

Hypercerts aggregate approved work attestations into tradeable impact certificates.

### Data Sources

| Data Type | Source | Query Method |
|-----------|--------|--------------|
| Approved attestations | EAS GraphQL | `getApprovedAttestations()` |
| Garden metadata | Envio Indexer | `getGardens()` |
| Hypercert records | Hypercerts API | `getHypercertById()` |
| Draft persistence | IndexedDB | `useHypercertDraft()` |

**Hypercerts Contract** (Arbitrum One):
```
0x822F17A9A5EeCFd66dBAFf7946a8071C265D1d07
```

### Fetching Approved Attestations

```typescript
import { getApprovedAttestations } from '@green-goods/shared';
import type { AttestationFilters, HypercertAttestation } from '@green-goods/shared';

const filters: AttestationFilters = {
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-12-31'),
  domain: 'agroforestry',
  gardenerAddress: '0x...',
};

const attestations: HypercertAttestation[] = await getApprovedAttestations(
  gardenId,
  chainId,
  filters
);
```

### Filter Options

```typescript
interface AttestationFilters {
  startDate?: Date | number | null;    // Filter by approval date
  endDate?: Date | number | null;
  domain?: ActionDomain | null;        // solar, waste, agroforestry, education, mutual_credit
  workScope?: string | null;           // Work scope tag
  actionType?: ActionType | null;      // Action type filter
  gardenerAddress?: Address | null;    // Specific gardener
  searchQuery?: string;                // Text search
}
```

### Query Keys

```typescript
import { queryKeys, queryInvalidation } from '@green-goods/shared';

queryKeys.hypercerts.all                              // ["greengoods", "hypercerts"]
queryKeys.hypercerts.list(gardenId)                   // ["greengoods", "hypercerts", "list", gardenId]
queryKeys.hypercerts.detail(hypercertId)              // ["greengoods", "hypercerts", "detail", hypercertId]
queryKeys.hypercerts.attestations(gardenId, filters)  // For attestation queries

// Invalidation
await queryClient.invalidateQueries({
  queryKey: queryInvalidation.invalidateHypercerts(gardenId),
});
```

### Key Types

**HypercertAttestation** - Approved work eligible for bundling:

```typescript
interface HypercertAttestation {
  id: string;                    // Work approval UID (EAS)
  workUid: string;               // Work submission UID (EAS)
  gardenId: string;
  title: string;
  actionType?: ActionType;       // e.g., "planting", "cleanup"
  domain?: ActionDomain;         // e.g., "agroforestry", "waste"
  workScope: string[];           // Tags describing the work
  gardenerAddress: Address;
  gardenerName?: string | null;
  mediaUrls: string[];           // IPFS URLs
  createdAt: number;             // Unix timestamp
  approvedAt: number;            // Unix timestamp
}
```

**HypercertRecord** - Minted hypercert:

```typescript
interface HypercertRecord {
  id: string;
  tokenId: bigint;
  gardenId: string;
  metadataUri: string;           // IPFS URI
  mintedAt: number;
  mintedBy: Address;
  txHash: Hex;
  totalUnits: bigint;            // 100_000_000n total
  claimedUnits: bigint;
  attestationCount: number;
  status?: HypercertStatus;      // "active" | "claimed" | "sold"
}
```

**AllowlistEntry** - Recipient share:

```typescript
interface AllowlistEntry {
  address: Address;              // Recipient wallet
  units: bigint;                 // Fraction units (out of 100_000_000n)
  label?: string;                // Display name
}
```

### Distribution Calculation

```typescript
import {
  calculateDistribution,
  buildContributorWeights,
  TOTAL_UNITS,
} from '@green-goods/shared';

// Equal distribution among contributors
const allowlist = calculateDistribution(attestations, 'equal');

// Weighted by contribution count
const weights = buildContributorWeights(attestations);
const allowlist = calculateDistribution(attestations, 'weighted', weights);

// Total units is always 100_000_000n (100%)
```

### Metadata Format

Follows the [Hypercerts standard](https://hypercerts.org/docs/developer/metadata) with Green Goods extensions:

```typescript
interface HypercertMetadata {
  name: string;
  description: string;
  image: string;                 // IPFS URI
  external_url?: string;
  hypercert: {
    work_scope: ScopeDefinition;
    impact_scope: ScopeDefinition;
    work_timeframe: TimeframeDefinition;
    impact_timeframe: TimeframeDefinition;
    contributors: ScopeDefinition;
    rights: ScopeDefinition;
  };
  hidden_properties?: {          // Green Goods extension
    gardenId: string;
    attestationRefs: AttestationRef[];
    sdgs: number[];
    capitals: CapitalType[];
    protocolVersion: string;
  };
}
```

---

## Learn More

- [Indexer Package Docs](./indexer) — Envio indexer architecture
- [Contracts Package Docs](./contracts) — Smart contract interfaces
- [Evaluator Guide: Accessing Data](../guides/evaluators/accessing-data) — Complete data access guide
- [EAS Documentation](https://docs.attest.org/) — Ethereum Attestation Service reference

