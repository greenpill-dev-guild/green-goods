# Karma GAP Integration - Client Queries

This guide explains how to use the Karma GAP project UID stored in the indexer to query project data in client and admin packages.

## Overview

When a Garden is created, it automatically creates a Karma GAP project (if supported on the current chain). The indexer captures and stores the `gapProjectUID` which can then be used to fetch detailed project data from the Karma GAP SDK.

## GraphQL Schema Update

The `Garden` entity now includes:

```graphql
type Garden {
  # ... existing fields ...
  gapProjectUID: String # Karma GAP project attestation UID (bytes32)
}
```

## Querying Gardens with GAP Project UID

### Basic Garden Query

```graphql
query GetGarden($gardenId: ID!) {
  garden(id: $gardenId) {
    id
    name
    description
    bannerImage
    location
    gardeners
    operators
    gapProjectUID
  }
}
```

### All Gardens with GAP Projects

```graphql
query GetGardensWithGAP {
  gardens(where: { gapProjectUID_not: null }) {
    id
    name
    gapProjectUID
    createdAt
  }
}
```

## Using Karma GAP SDK in Client/Admin

Once you have the `gapProjectUID` from the indexer, use it with the Karma GAP SDK:

### 1. Install the SDK

```bash
pnpm add @show-karma/karma-gap-sdk
```

### 2. Initialize GAP Client

**File: `src/lib/gapClient.ts`**

```typescript
import { GAP } from "@show-karma/karma-gap-sdk";
import { getDefaultChain } from "@/config/blockchain";

// Map chain IDs to GAP network names
const CHAIN_ID_TO_GAP_NETWORK: Record<number, string> = {
  10: "optimism",
  11155420: "optimism-sepolia",
  42161: "arbitrum",
  11155111: "sepolia",
  84532: "base-sepolia",
  42220: "celo",
  1329: "sei",
  1328: "sei-testnet",
};

const chainId = getDefaultChain().id;
const gapNetwork = CHAIN_ID_TO_GAP_NETWORK[chainId];

if (!gapNetwork) {
  throw new Error(`Karma GAP not supported on chain ${chainId}`);
}

export const gap = new GAP({
  network: gapNetwork,
});

export default gap;
```

### 3. Create Query Utilities

**File: `src/lib/gapQueries.ts`**

```typescript
import { gap } from "./gapClient";
import type { Project, ProjectImpact, ProjectMilestone } from "@show-karma/karma-gap-sdk";

/**
 * Fetches a Garden's Karma GAP project by its project UID
 */
export async function fetchGardenProject(projectUID: string): Promise<Project> {
  try {
    const project = await gap.fetch.projectByUID(projectUID);
    return project;
  } catch (error) {
    console.error("[GAP] Failed to fetch project:", error);
    throw error;
  }
}

/**
 * Fetches all impacts (approved work) for a Garden project
 */
export async function fetchGardenImpacts(projectUID: string): Promise<ProjectImpact[]> {
  try {
    const project = await gap.fetch.projectByUID(projectUID);
    const updates = await project.getUpdates();
    
    // Filter to only impacts (type: "project-impact")
    return updates.filter((update) => update.data?.type === "project-impact");
  } catch (error) {
    console.error("[GAP] Failed to fetch impacts:", error);
    return [];
  }
}

/**
 * Fetches all milestones (assessments) for a Garden project
 */
export async function fetchGardenMilestones(projectUID: string): Promise<ProjectMilestone[]> {
  try {
    const project = await gap.fetch.projectByUID(projectUID);
    return await project.getMilestones();
  } catch (error) {
    console.error("[GAP] Failed to fetch milestones:", error);
    return [];
  }
}

/**
 * Extract project details
 */
export function getProjectDetails(project: Project) {
  return {
    title: project.details?.title,
    description: project.details?.description,
    imageURL: project.details?.imageURL,
    website: project.details?.website,
    problem: project.details?.problem,
    solution: project.details?.solution,
    projectUID: project.uid,
    recipient: project.recipient, // Garden account address
  };
}

/**
 * Parse impact data
 */
export function parseImpact(impact: ProjectImpact) {
  return {
    uid: impact.uid,
    title: impact.data?.title,
    text: impact.data?.text,
    proof: impact.data?.proof,
    completedAt: impact.data?.completedAt,
    type: impact.data?.type,
    timestamp: impact.attestation?.time,
    refUID: impact.refUID,
  };
}

/**
 * Parse milestone data
 */
export function parseMilestone(milestone: ProjectMilestone) {
  const metadata = JSON.parse(milestone.data?.metadata || "{}");
  
  return {
    uid: milestone.uid,
    title: milestone.data?.title,
    text: milestone.data?.text,
    completedAt: milestone.data?.completedAt,
    type: milestone.data?.type,
    capitals: metadata.capitals,
    assessmentType: metadata.assessmentType,
    metricsJSON: metadata.metricsJSON,
    timestamp: milestone.attestation?.time,
    refUID: milestone.refUID,
  };
}
```

### 4. React Query Hooks

**File: `src/hooks/karma/useGardenProject.ts`**

```typescript
import { useQuery } from "@tanstack/react-query";
import {
  fetchGardenProject,
  fetchGardenImpacts,
  fetchGardenMilestones,
  getProjectDetails,
  parseImpact,
  parseMilestone,
} from "@/lib/gapQueries";

/**
 * Hook to fetch a Garden's Karma GAP project
 */
export function useGardenProject(projectUID: string | undefined) {
  return useQuery({
    queryKey: ["gap-project", projectUID],
    queryFn: () => fetchGardenProject(projectUID!),
    enabled: !!projectUID,
    staleTime: 5 * 60 * 1000, // 5 minutes
    select: (project) => getProjectDetails(project),
  });
}

/**
 * Hook to fetch Garden impacts (approved work)
 */
export function useGardenImpacts(projectUID: string | undefined) {
  return useQuery({
    queryKey: ["gap-impacts", projectUID],
    queryFn: () => fetchGardenImpacts(projectUID!),
    enabled: !!projectUID,
    staleTime: 2 * 60 * 1000, // 2 minutes
    select: (impacts) => impacts.map(parseImpact),
  });
}

/**
 * Hook to fetch Garden milestones (assessments)
 */
export function useGardenMilestones(projectUID: string | undefined) {
  return useQuery({
    queryKey: ["gap-milestones", projectUID],
    queryFn: () => fetchGardenMilestones(projectUID!),
    enabled: !!projectUID,
    staleTime: 2 * 60 * 1000, // 2 minutes
    select: (milestones) => milestones.map(parseMilestone),
  });
}
```

### 5. Component Usage Example

```typescript
import { useGardenProject, useGardenImpacts } from "@/hooks/karma/useGardenProject";
import { graphql } from "@/gql";
import { useQuery } from "@urql/core";

const GardenQuery = graphql(`
  query GetGarden($id: ID!) {
    garden(id: $id) {
      id
      name
      description
      gapProjectUID
    }
  }
`);

export function GardenImpactDashboard({ gardenId }: { gardenId: string }) {
  // Fetch garden from indexer to get gapProjectUID
  const [{ data: gardenData }] = useQuery({ query: GardenQuery, variables: { id: gardenId } });
  const garden = gardenData?.garden;
  const projectUID = garden?.gapProjectUID;

  // Fetch GAP data using the projectUID
  const { data: project, isLoading: projectLoading } = useGardenProject(projectUID);
  const { data: impacts, isLoading: impactsLoading } = useGardenImpacts(projectUID);

  if (!garden) return <div>Garden not found</div>;
  if (!projectUID) return <div>This garden doesn't have a Karma GAP project</div>;
  if (projectLoading || impactsLoading) return <div>Loading impact data...</div>;

  return (
    <div>
      <h1>{garden.name}</h1>
      <p>{project?.description}</p>

      <h2>Impact History</h2>
      {impacts?.map((impact) => (
        <div key={impact.uid}>
          <h3>{impact.title}</h3>
          <p>{impact.text}</p>
          {impact.proof && (
            <a href={`https://ipfs.io/ipfs/${impact.proof}`} target="_blank" rel="noopener">
              View Proof
            </a>
          )}
          <time>{new Date(impact.completedAt * 1000).toLocaleDateString()}</time>
        </div>
      ))}
    </div>
  );
}
```

## Data Flow

```
┌─────────────────────────────────────────────────┐
│ 1. Garden Created                               │
│    └─> GAPProjectCreated event emitted         │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│ 2. Indexer Captures Event                       │
│    └─> Stores gapProjectUID in Garden entity   │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│ 3. Client Queries Garden                        │
│    └─> GraphQL: garden(id) { gapProjectUID }   │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│ 4. Client Uses GAP SDK                          │
│    └─> gap.fetch.projectByUID(gapProjectUID)   │
│    └─> project.getUpdates() // Impacts         │
│    └─> project.getMilestones() // Assessments  │
└─────────────────────────────────────────────────┘
```

## Benefits

1. **Single Source of Truth**: Indexer stores the link between Gardens and GAP projects
2. **Easy Querying**: Fetch all gardens with GAP projects in one query
3. **SDK Integration**: Seamlessly use Karma GAP SDK with stored UIDs
4. **Cross-Platform**: Works in both client and admin packages

## Example Queries

### Find all gardens with GAP projects on a specific chain

```typescript
const { data } = useQuery({
  query: graphql(`
    query GardensWithGAP($chainId: Int!) {
      gardens(
        where: { 
          chainId: $chainId, 
          gapProjectUID_not: null 
        }
      ) {
        id
        name
        gapProjectUID
      }
    }
  `),
  variables: { chainId: 84532 }, // Base Sepolia
});
```

### Aggregate impact data for a garden

```typescript
async function getGardenImpactStats(projectUID: string) {
  const impacts = await fetchGardenImpacts(projectUID);
  
  return {
    totalImpacts: impacts.length,
    recentImpacts: impacts.slice(0, 5),
    impactTypes: [...new Set(impacts.map(i => i.data?.title))],
  };
}
```

## Notes

- The `gapProjectUID` will be `null` for chains that don't support Karma GAP
- The `gapProjectUID` is stored as a string representation of `bytes32`
- Use the UID directly with the Karma GAP SDK - no conversion needed
- The indexer automatically updates when gardens are created on supported chains

## Troubleshooting

**Garden has no gapProjectUID:**
- Check if the chain supports Karma GAP (see `KarmaLib.isSupported()`)
- Verify the garden was created after this indexer update
- Check indexer logs for GAPProjectCreated event processing

**GAP SDK queries fail:**
- Verify correct network configuration in GAP client
- Ensure gapProjectUID is valid (not null/empty)
- Check Karma GAP service status at https://gap.karmahq.xyz/







