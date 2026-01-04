# Accessing Data

Query Green Goods impact data via GraphQL APIs, on-chain attestations, and admin UI.

---

## Data Sources

Green Goods data comes from **two separate APIs**:

### 1. Green Goods Indexer (Gardens & Actions)

**Endpoint**: https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql

**Provides**:
- Gardens (metadata, members)
- Actions (task registry)
- Gardeners (profiles)

**Example queries**:

```graphql
# All gardens
query AllGardens {
  Garden {
    id
    name
    location
    gardeners
    operators
    createdAt
  }
}

# Gardens by chain
query GardensByChain($chainId: Int!) {
  Garden(where: {chainId: {_eq: $chainId}}) {
    id
    name
    location
  }
}

# Actions for all gardens
query AllActions($chainId: Int!) {
  Action(where: {chainId: {_eq: $chainId}}) {
    id
    title
    instructions
    capitals
    startTime
    endTime
  }
}
```

### 2. EAS GraphQL (Work & Approvals)

**Endpoints**:
- Arbitrum: https://arbitrum.easscan.org/graphql
- Celo: https://celo.easscan.org/graphql
- Base Sepolia: https://base-sepolia.easscan.org/graphql

**Provides**:
- Work submission attestations
- Work approval attestations
- Assessment attestations

**Example query** (get work for a garden):

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
    timeCreated
    decodedDataJson
  }
}
```

**Variables (Arbitrum)**:
```json
{
  "schemaId": "0xf6fd183baeb8ae5c5f2f27a734b546b6128bee7877ea074f5cf9b18981be3a20",
  "recipient": "0xGardenAccountAddress"
}
```

[Full API Reference →](../../developer/api-reference)

---

## On-Chain Verification

**EAS Explorers** for direct attestation verification:
- Arbitrum: https://arbitrum.easscan.org
- Celo: https://celo.easscan.org
- Base Sepolia: https://base-sepolia.easscan.org

**Contract Addresses**:
- [Deployment artifacts](https://github.com/greenpill-dev-guild/green-goods/tree/main/packages/contracts/deployments)

---

## Admin Dashboard (Read-Only)

Connect wallet to [admin.greengoods.app](https://admin.greengoods.app) for visual interface to browse gardens and generate reports.

---

## Export Options

**From GraphQL**:
- JSON for databases/analysis
- Custom integrations

**From Admin UI** (planned):
- CSV for spreadsheets
- PDF reports

[See Evaluator Quickstart →](../../welcome/quickstart-evaluator)

