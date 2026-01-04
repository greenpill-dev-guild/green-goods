# Exploring Gardens & Work

Browse gardens, analyze impact metrics, and track community progress.

---

## Browsing Gardens

**Via GraphQL** (Green Goods Indexer):
```graphql
query Gardens($chainId: Int!) {
  Garden(where: {chainId: {_eq: $chainId}}) {
    id
    chainId
    name
    location
    gardeners
    operators
    gapProjectUID
    createdAt
  }
}
```

**Filter By**:
- Chain ID (84532 = Base Sepolia, 42161 = Arbitrum, 42220 = Celo)
- Location (city, region)
- Specific garden IDs

---

## Garden-Level Analytics

**Key Metrics** (from Envio indexer):
- Garden metadata and members
- Active gardeners count
- GAP project tracking

**Query Example**:
```graphql
query GardenDetails($gardenId: String!) {
  Garden(where: {id: {_eq: $gardenId}}) {
    id
    name
    location
    gardeners
    operators
    gapProjectUID
    createdAt
  }
  
  Gardener(where: {gardens: {_contains: $gardenId}}) {
    id
    ensName
  }
}
```

**For work submissions and approvals**, query **EAS GraphQL API** separately:
```graphql
# Query work attestations from EAS (not Green Goods indexer)
query WorkSubmissions($schemaId: String!, $recipient: String!) {
  attestations(
    where: {
      schemaId: { equals: $schemaId }
      recipient: { equals: $recipient }
      revoked: { equals: false }
    }
  ) {
    id
    attester
    timeCreated
    decodedDataJson
  }
}
```

**Variables** (Arbitrum example):
```json
{
  "schemaId": "0xf6fd183baeb8ae5c5f2f27a734b546b6128bee7877ea074f5cf9b18981be3a20",
  "recipient": "0xGardenAccountAddress"
}
```

**EAS GraphQL endpoints**:
- Arbitrum: https://arbitrum.easscan.org/graphql
- Celo: https://celo.easscan.org/graphql
- Base Sepolia: https://base-sepolia.easscan.org/graphql

---

## Viewing Actions

**Query actions** (from Green Goods indexer):
```graphql
query GardenActions($chainId: Int!) {
  Action(where: {chainId: {_eq: $chainId}}) {
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
```

---

## Combined Data Pattern

To get complete garden data, query **both** APIs:

### Step 1: Get Garden Info (Envio)
```graphql
query GardenById($id: String!) {
  Garden(where: {id: {_eq: $id}}) {
    id
    name
    gardeners
    operators
  }
}
```

### Step 2: Get Work Attestations (EAS)
```graphql
query WorkAttestations($schemaId: String!, $recipient: String!) {
  attestations(
    where: {
      schemaId: { equals: $schemaId }
      recipient: { equals: $recipient }
    }
    orderBy: { timeCreated: desc }
  ) {
    id
    decodedDataJson
    timeCreated
  }
}
```

### Step 3: Get Approvals (EAS)
```graphql
query ApprovalAttestations($schemaId: String!, $recipient: String!) {
  attestations(
    where: {
      schemaId: { equals: $schemaId }
      recipient: { equals: $recipient }
    }
    orderBy: { timeCreated: desc }
  ) {
    id
    refUID
    decodedDataJson
  }
}
```

**Tip**: Use `@green-goods/shared` package which abstracts this dual-source pattern:
```typescript
import { getGardens } from '@green-goods/shared/modules/data/indexer';
import { getWorks, getWorkApprovals } from '@green-goods/shared/modules/data/eas';

const gardens = await getGardens(chainId);
const works = await getWorks(gardenAddress, chainId);
const approvals = await getWorkApprovals(gardenAddress, chainId);
```

---

## IPFS Media Access

**Photos/Media**: Attestations contain IPFS CIDs

**Access via gateways**:
- Storacha: `https://storacha.link/ipfs/{CID}`
- IPFS.io: `https://ipfs.io/ipfs/{CID}`
- Pinata: `https://gateway.pinata.cloud/ipfs/{CID}`

**Example**:
```
media: ["bafkreiabc123..."]
→ https://storacha.link/ipfs/bafkreiabc123...
```

---

## Learn More

- [Accessing Data](accessing-data) — Data source overview
- [Using Attestation Data](using-attestation-data) — Verification guide
- [External Frameworks](external-frameworks) — Integration patterns
- [API Reference](../../developer/api-reference) — Complete API docs

