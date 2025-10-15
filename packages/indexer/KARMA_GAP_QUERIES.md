# Karma GAP Integration - Client Queries

This guide explains how to query Karma GAP impact data in client and admin packages.

## Overview

The Green Goods indexer stores `gapProjectUID` for each garden. Use this UID with the Karma GAP SDK to fetch project impacts and milestones.

## GraphQL Schema

```graphql
type Garden {
  gapProjectUID: String  # Karma GAP project attestation UID
}
```

## Query Gardens with GAP Projects

```graphql
query GetGarden($gardenId: ID!) {
  garden(id: $gardenId) {
    id
    name
    gapProjectUID
  }
}

query GardensWithGAP {
  gardens(where: { gapProjectUID_not: null }) {
    id
    name
    gapProjectUID
  }
}
```

## Using Karma GAP SDK

### 1. Install SDK

```bash
bun add @show-karma/karma-gap-sdk
```

### 2. Initialize Client

```typescript
import { GAP } from "@show-karma/karma-gap-sdk";

const CHAIN_TO_NETWORK: Record<number, string> = {
  10: "optimism",
  42161: "arbitrum",
  84532: "base-sepolia",
  42220: "celo",
  // ... see Karma GAP docs for all networks
};

export const gap = new GAP({
  network: CHAIN_TO_NETWORK[chainId],
});
```

### 3. Query Impact Data

```typescript
// Fetch project
const project = await gap.fetch.projectByUID(gapProjectUID);

// Fetch impacts (approved work)
const updates = await project.getUpdates();
const impacts = updates.filter(u => u.data?.type === "project-impact");

// Fetch milestones (assessments)
const milestones = await project.getMilestones();
```

### 4. React Hook Example

```typescript
import { useQuery } from "@tanstack/react-query";

export function useGardenImpacts(projectUID: string | undefined) {
  return useQuery({
    queryKey: ["gap-impacts", projectUID],
    queryFn: async () => {
      const project = await gap.fetch.projectByUID(projectUID!);
      const updates = await project.getUpdates();
      return updates.filter(u => u.data?.type === "project-impact");
    },
    enabled: !!projectUID,
  });
}
```

## Data Flow

```
Garden Created → GAPProjectCreated event → Indexer stores gapProjectUID
→ Client queries garden → Use gapProjectUID with GAP SDK
```

## Notes

- `gapProjectUID` is `null` for unsupported chains
- Stored as string representation of `bytes32`
- Use UID directly with Karma GAP SDK (no conversion needed)

## Troubleshooting

**No gapProjectUID:** Check if chain supports Karma GAP via `KarmaLib.isSupported()`  
**SDK queries fail:** Verify network configuration and UID validity

**Resources:** [Karma GAP Docs](https://docs.gap.karmahq.xyz/) • [Platform](https://gap.karmahq.xyz/)







