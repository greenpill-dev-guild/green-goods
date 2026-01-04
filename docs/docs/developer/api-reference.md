# API & Integration Reference

GraphQL API, smart contract interfaces, and integration examples.


> **Networks:** Arbitrum One (42161), Celo (42220), Base Sepolia (84532). Contract addresses and schema UIDs are published in `packages/contracts/deployments/*.json`. Updated November 2024.
> **GraphQL Playground:** https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql (HyperIndex-hosted; see `packages/indexer/README.md` for auth notes).

---

## GraphQL API

**Endpoint**: https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql

**No authentication required** for public data.

---

## Core Queries

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
  }
}

query GardenById($id: String!) {
  Garden(where: {id: {_eq: $id}}) {
    id
    name
    work: Work {
      id
      title
      approved
    }
  }
}
```

### Work

```graphql
query GardenWork($gardenId: String!) {
  Work(where: {gardenId: {_eq: $gardenId}}) {
    id
    title
    gardener
    actionUID
    media
    metadata
    createdAt
    approvals: WorkApproval {
      approved
      feedback
      timestamp
    }
  }
}
```

### Actions

```graphql
query GardenActions($gardenId: String!) {
  Action(where: {gardenId: {_eq: $gardenId}}) {
    id
    title
    instructions
    capitals
    startTime
    endTime
  }
}
```

---

## Subscriptions

**Real-time updates**:

```graphql
subscription NewApprovals {
  WorkApproval(where: {approved: {_eq: true}}) {
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

---

## Contract Interfaces

### GardenToken

```solidity
interface IGardenToken {
    function mintGarden(
        address to,
        string memory name,
        string memory metadata,
        address[] memory gardeners,
        address[] memory operators
    ) external returns (uint256 tokenId);
    
    function addGardener(uint256 tokenId, address gardener) external;
    function removeGardener(uint256 tokenId, address gardener) external;
}
```

### ActionRegistry

```solidity
interface IActionRegistry {
    function registerAction(
        uint256 gardenId,
        string memory title,
        string memory instructions,
        uint256 startTime,
        uint256 endTime,
        string[] memory capitals,
        string[] memory media
    ) external returns (uint256 actionUID);
}
```

---

## Contract Addresses

**See deployment files**:
- [Arbitrum (42161)](../../../packages/contracts/deployments/42161-latest.json)
- [Celo (42220)](../../../packages/contracts/deployments/42220-latest.json)
- [Base Sepolia (84532)](../../../packages/contracts/deployments/84532-latest.json)

---

## Integration Examples

### Node.js

```javascript
import fetch from 'node-fetch';

const query = `
  query {
    Garden {
      id
      name
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

```python
import requests

query = """
query {
  Garden {
    id
    name
  }
}
"""

response = requests.post(
    'https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql',
    json={'query': query}
)

gardens = response.json()['data']['Garden']
```

### React (with Urql)

```typescript
import { useQuery } from 'urql';

const GARDENS_QUERY = `
  query {
    Garden {
      id
      name
    }
  }
`;

function GardenList() {
  const [result] = useQuery({ query: GARDENS_QUERY });
  
  if (result.fetching) return <div>Loading...</div>;
  if (result.error) return <div>Error</div>;
  
  return (
    <ul>
      {result.data.Garden.map(garden => (
        <li key={garden.id}>{garden.name}</li>
      ))}
    </ul>
  );
}
```

---

## Schema UIDs

### Arbitrum One (42161)

- Work: `0xb4318a3d228cb57828e9c56d96f88756beb71be540140226b8fc31ca97099f26`
- Approval: `0xe386d0277645e801c701259783b5338314a2d67fdc52dc963da1f27fda40074b`
- Assessment: `0x0027bf6235b41365962ecc3df493a9bfe12160a6c72c7b39f34c6955975b3fa4`

### Celo (42220)

- Work: `0x481c4190bcaf0140d77d1124acd443f51ed78d73fecb6cd4f77265142df0c00a`
- Approval: `0x584054ca6d3ed2d3adaed85fd3e2375d1197cb7e4c9698fec62d7431323f20c6`
- Assessment: `0xcbcd83143911085d2010d921a12ecf53569eb8dc4564b0ddb5d469c03b44d232`

### Base Sepolia (84532)

- Work: `0x481c4190bcaf0140d77d1124acd443f51ed78d73fecb6cd4f77265142df0c00a`
- Approval: `0x584054ca6d3ed2d3adaed85fd3e2375d1197cb7e4c9698fec62d7431323f20c6`
- Assessment: `0xcbcd83143911085d2010d921a12ecf53569eb8dc4564b0ddb5d469c03b44d232`

---

## Rate Limits

**No limits currently** on GraphQL API.

Future: May add reasonable limits for abuse prevention.

---

## Learn More

- [Indexer Package Docs](architecture/indexer-package.md)
- [Contracts Package Docs](architecture/contracts-package.md)
- [Evaluator Guide: Accessing Data](../guides/evaluators/accessing-data.md)

