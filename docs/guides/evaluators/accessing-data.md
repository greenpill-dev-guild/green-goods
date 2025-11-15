# Accessing Data

> **Tip:** For ready-to-run snippets, see [GraphQL Recipes](../examples/graphql-recipes.md) and [Integration Snippets](../examples/integration-snippets.md).

Query Green Goods impact data via GraphQL API, on-chain attestations, and admin UI.

---

## GraphQL API

**Endpoint**: https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql

**No Authentication Required** for public data.

**Example Queries**:

```graphql
# All gardens
query AllGardens {
  Garden {
    id
    name
    location
    gardeners
    createdAt
  }
}

# Work in garden
query GardenWork($gardenId: String!) {
  Work(where: {gardenId: {_eq: $gardenId}}) {
    id
    title
    gardener
    media
    approvals: WorkApproval {
      approved
      feedback
    }
  }
}

# Approved work in date range
query ApprovedWork($startDate: Int!, $endDate: Int!) {
  WorkApproval(where: {
    approved: {_eq: true}
    timestamp: {_gte: $startDate, _lte: $endDate}
  }) {
    id
    workUID
    timestamp
    work: Work {
      title
      gardener
    }
  }
}
```

[Full API Reference →](../../developer/api-reference.md)

---

## On-Chain Access

**EAS Explorers**:
- Arbitrum: https://arbitrum.easscan.org
- Celo: https://celo.easscan.org
- Base Sepolia: https://base-sepolia.easscan.org

**Contract Addresses**:
- See [deployments folder](../../../../packages/contracts/deployments/)

---

## Admin Dashboard (Read-Only)

Connect wallet to [admin.greengoods.app](https://admin.greengoods.app) for visual interface to browse data.

---

## Export Options

- CSV for spreadsheets
- JSON for databases/analysis
- GraphQL for custom integrations

[See Evaluator Quickstart →](../../welcome/quickstart-evaluator.md)

