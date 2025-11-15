<!-- 7dddb450-b2aa-4392-84d5-29bd1c2cb34c 8bd26ad4-8ec5-4729-9ec4-acce2d39b52a -->
# Shared Package Refactor Plan

## Phase 1: Package Structure Setup

### 1.1 Create shared package skeleton

Create `packages/shared/` with the following structure:

```
packages/shared/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                  # Main entry point
│   ├── utils/
│   │   ├── index.ts
│   │   └── cn.ts                 # className utility
│   ├── config/
│   │   ├── index.ts
│   │   └── blockchain.ts         # Chain configs
│   ├── modules/
│   │   ├── index.ts
│   │   ├── eas.ts                # EAS queries
│   │   ├── urql.ts               # URQL clients
│   │   ├── graphql.ts            # GraphQL helpers
│   │   └── pinata.ts             # IPFS utilities
│   ├── types/
│   │   ├── index.ts
│   │   ├── eas.d.ts              # EAS types
│   │   ├── garden.d.ts           # Garden types
│   │   └── blockchain.d.ts       # Blockchain types
│   └── constants/
│       ├── index.ts
│       └── chains.ts             # Chain constants
└── README.md
```

**package.json configuration:**

- Name: `@green-goods/shared`
- Mark as private workspace package
- Peer dependencies: React, Viem, @urql/core (provided by consumers)
- Direct dependencies: clsx, tailwind-merge, pinata, gql.tada

**tsconfig.json:**

- Inherit from root config
- Output ES modules
- Enable `resolveJsonModule` for deployment JSONs
- Path alias `@shared/*` for internal imports

### 1.2 Update workspace configuration

Update root `package.json`:

```json
{
  "workspaces": ["packages/*"]
}
```

Update root `bun.lock` to include shared package dependencies.

Add shared package to build order:

```json
{
  "scripts": {
    "build": "bun run build:contracts && bun run build:shared && bun run build:indexer && bun run build:client && bun run build:admin",
    "build:shared": "cd packages/shared && bun run build"
  }
}
```

---

## Phase 2: Migration Wave 1 - Core Utilities (Highest Value)

### 2.1 Migrate `cn()` utility

**Source files:**

- `packages/admin/src/utils/cn.ts`
- `packages/client/src/utils/styles/cn.ts`

**Target:** `packages/shared/src/utils/cn.ts`

**Implementation:**

```typescript
// packages/shared/src/utils/cn.ts
import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges className values with Tailwind CSS classes
 * Handles conditional classes and deduplicates conflicting utilities
 */
export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

export type { ClassValue };
```

**Updates required:**

- Admin: Change `import { cn } from "@/utils/cn"` → `import { cn } from "@green-goods/shared/utils"`
- Client: Change `import { cn } from "@/utils/styles/cn"` → `import { cn } from "@green-goods/shared/utils"`

**Files to update (admin):**

- All component files importing `cn` (~20 files)

**Files to update (client):**

- All component files importing `cn` (~40 files)

**Test after migration:**

```bash
bun --filter admin test
bun --filter client test
```

### 2.2 Migrate blockchain config utilities

**Source files:**

- `packages/admin/src/config.ts` (lines 29-120)
- `packages/client/src/config/blockchain.ts` (lines 29-267)

**Target:** `packages/shared/src/config/blockchain.ts`

**Key functions to extract:**

- `getDeploymentConfig(chainId)` - loads deployment JSON
- `getNetworkConfigFromNetworksJson(chainId)` - reads networks.json
- `getEasGraphqlUrl(chainId)` - returns EAS API URL
- `getEASConfig(chainId)` - returns schema UIDs and addresses
- `getNetworkConfig(chainId)` - returns full network config
- `buildRpcUrl(template, alchemyKey)` - constructs RPC URLs

**Implementation:**

```typescript
// packages/shared/src/config/blockchain.ts
import deployment31337 from "../../contracts/deployments/31337-latest.json";
import deployment42161 from "../../contracts/deployments/42161-latest.json";
import deployment42220 from "../../contracts/deployments/42220-latest.json";
import deployment84532 from "../../contracts/deployments/84532-latest.json";
import networksConfig from "../../contracts/deployments/networks.json";

// Export types
export interface EASConfig {
  GARDEN_ASSESSMENT: { uid: string; schema: string };
  WORK: { uid: string; schema: string };
  WORK_APPROVAL: { uid: string; schema: string };
  EAS: { address: string };
  SCHEMA_REGISTRY: { address: string };
}

export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  blockExplorer: string | null;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  contracts: Record<string, string>;
  rootGarden?: { address: `0x${string}`; tokenId: number };
}

// Implementation of all config functions...
```

**Updates required:**

- Admin: Update imports in `config.ts` to import from shared
- Client: Update imports in `config/blockchain.ts` to import from shared
- Both: Keep app-specific config (DEFAULT_CHAIN_ID, INDEXER_URL) in local files

**Test after migration:**

```bash
bun --filter admin test
bun --filter client test
```

### 2.3 Migrate chain constants

**Source files:**

- `packages/admin/src/config.ts` (lines 12-21)
- `packages/client/src/config/blockchain.ts` (lines 11-47)

**Target:** `packages/shared/src/constants/chains.ts`

**Implementation:**

```typescript
// packages/shared/src/constants/chains.ts
import type { Chain } from "viem";
import { arbitrum, baseSepolia, celo } from "viem/chains";

export const SUPPORTED_CHAINS = {
  42161: "arbitrum",
  84532: "base-sepolia", 
  42220: "celo",
} as const;

export type SupportedChainId = keyof typeof SUPPORTED_CHAINS;

export const getChainName = (chainId: number): string => {
  return SUPPORTED_CHAINS[chainId as SupportedChainId] || "unknown";
};

export const isChainSupported = (chainId: number): chainId is SupportedChainId => {
  return chainId in SUPPORTED_CHAINS;
};

export const getChainFromId = (chainId: number): Chain => {
  switch (chainId) {
    case 42161: return arbitrum;
    case 84532: return baseSepolia;
    case 42220: return celo;
    default: return baseSepolia;
  }
};
```

**Updates required:**

- Both apps: Import chain utilities from shared
- Keep `DEFAULT_CHAIN_ID` calculation local (reads from env)

**Test after migration:**

```bash
bun --filter admin test
bun --filter client test
```

---

## Phase 3: Migration Wave 2 - Data Modules

### 3.1 Migrate URQL client factory

**Source files:**

- `packages/admin/src/modules/urql.ts`
- `packages/client/src/modules/data/urql.ts`

**Target:** `packages/shared/src/modules/urql.ts`

**Implementation:**

```typescript
// packages/shared/src/modules/urql.ts
import { Client, cacheExchange, fetchExchange } from "@urql/core";
import { getEasGraphqlUrl } from "../config/blockchain";

/** Creates a chain-specific URQL client for EAS GraphQL API */
export function createEasClient(chainId?: number | string) {
  return new Client({
    url: getEasGraphqlUrl(chainId),
    exchanges: [cacheExchange, fetchExchange],
  });
}

/** 
 * Creates a URQL client for the Green Goods indexer
 * URL must be provided by the consuming app (client or admin)
 */
export function createIndexerClient(url: string) {
  return new Client({
    url,
    exchanges: [cacheExchange, fetchExchange],
  });
}
```

**Updates required:**

- Admin: Update `import { createEasClient } from "./modules/urql"` → `from "@green-goods/shared/modules"`
- Client: Update `import { createEasClient } from "@/modules/data/urql"` → `from "@green-goods/shared/modules"`
- Client: Keep `greenGoodsIndexer` instance local (uses app-specific INDEXER_URL)

**Test after migration:**

```bash
bun --filter admin test
bun --filter client test
```

### 3.2 Migrate Pinata utilities

**Source files:**

- `packages/admin/src/utils/pinata.ts`
- `packages/client/src/modules/data/pinata.ts`

**Target:** `packages/shared/src/modules/pinata.ts`

**Implementation:**

```typescript
// packages/shared/src/modules/pinata.ts
import { PinataSDK } from "pinata";

/** 
 * Creates configured Pinata SDK instance
 * Supports dev proxy for local development
 */
export function createPinataClient(config: {
  jwt: string;
  gateway?: string;
  uploadUrl?: string;
  endpointUrl?: string;
}) {
  return new PinataSDK({
    pinataJwt: config.jwt,
    pinataGateway: config.gateway || "greengoods.mypinata.cloud",
    uploadUrl: config.uploadUrl,
    endpointUrl: config.endpointUrl,
  });
}

/** Uploads a file to IPFS using the provided Pinata client */
export async function uploadFileToIPFS(client: PinataSDK, file: File) {
  return await client.upload.private.file(file);
}

/** Uploads JSON metadata to IPFS */
export async function uploadJSONToIPFS(client: PinataSDK, json: Record<string, unknown>) {
  return await client.upload.private.json(json);
}

/** Reads a file from the Pinata gateway by CID */
export async function getFileByHash(client: PinataSDK, hash: string) {
  return await client.gateways.public.get(hash);
}

/** Resolves IPFS URL to gateway URL */
export function resolveIPFSUrl(url: string, gateway = "greengoods.mypinata.cloud"): string {
  if (!url) return "";
  if (url.startsWith(`https://${gateway}/`)) return url;
  if (url.startsWith("ipfs://")) {
    return `https://${gateway}/ipfs/${url.replace("ipfs://", "")}`;
  }
  if (url.includes("ipfs.io/ipfs/")) {
    const hash = url.split("ipfs.io/ipfs/")[1];
    return `https://${gateway}/ipfs/${hash}`;
  }
  if (url.startsWith("Qm") || url.startsWith("baf")) {
    return `https://${gateway}/ipfs/${url}`;
  }
  return url;
}
```

**Updates required:**

- Both apps: Create local `pinata` instance using `createPinataClient()`
- Both apps: Update function calls to pass client as first param
- Client: Keep dev proxy configuration in local file

**Test after migration:**

```bash
bun --filter admin test
bun --filter client test
```

### 3.3 Migrate EAS query utilities

**Source files:**

- `packages/admin/src/modules/eas.ts` (simplified version)
- `packages/client/src/modules/data/eas.ts` (comprehensive version)

**Target:** `packages/shared/src/modules/eas.ts`

**Strategy:** Use client version as base (has more functions), simplify to remove client-specific logic (media URL creation, blob URLs)

**Key functions to extract:**

- `getGardenAssessments(gardenAddress?, chainId?)`
- `getWorks(gardenAddress?, chainId?)`
- `getWorksByGardener(gardenerAddress?, chainId?)`
- `getWorkApprovals(gardenerAddress?, chainId?)`
- Helper parsers: `parseDataToWork()`, `parseDataToWorkApproval()`

**Changes needed:**

- Remove blob URL creation (client-specific)
- Remove automatic media fetching (keep hash only)
- Return plain data structures
- Let consuming apps handle media resolution

**Test after migration:**

```bash
bun --filter admin test
bun --filter client test
```

### 3.4 Migrate GraphQL helpers

**Source files:**

- `packages/admin/src/modules/graphql.ts`
- `packages/client/src/modules/data/graphql.ts`

**Target:** `packages/shared/src/modules/graphql.ts`

**Implementation:**

```typescript
// packages/shared/src/modules/graphql.ts
import { initGraphQLTada } from "gql.tada";
import type { introspection } from "../types/eas";

/** Tagged template for EAS GraphQL queries with type safety */
export const easGraphQL = initGraphQLTada<{
  introspection: introspection;
  scalars: {
    BigInt: string;
  };
}>();

export type { FragmentOf, ResultOf, VariablesOf } from "gql.tada";
```

**Updates required:**

- Both apps: Update imports from local modules to shared
- Keep app-specific GraphQL schemas local (indexer schemas)

**Test after migration:**

```bash
bun --filter admin test
bun --filter client test
```

---

## Phase 4: Migration Wave 3 - Types

### 4.1 Consolidate EAS types

**Current state:**

- Admin already imports from client: `export type { introspection } from "../../client/src/types/eas"`
- Client has comprehensive EAS introspection types

**Target:** `packages/shared/src/types/eas.d.ts`

**Action:** Move client's `eas.d.ts` to shared package (it's generated, 49k tokens, so just move the file)

**Updates required:**

- Admin: Update import to `"@green-goods/shared/types"`
- Client: Update internal imports to shared package

### 4.2 Create shared Garden types

**Source files:**

- `packages/admin/src/types/garden.ts`
- Client has similar types scattered in `types/green-goods.d.ts`

**Target:** `packages/shared/src/types/garden.d.ts`

**Implementation:**

```typescript
// packages/shared/src/types/garden.d.ts
export interface Garden {
  id: string;
  tokenId: string;
  name: string;
  description: string;
  location: string;
  communityToken: string;
  bannerImage: string;
  operators: string[];
  gardeners: string[];
  createdAt: number;
}

export interface WorkCard {
  id: string;
  gardenerAddress: string;
  gardenAddress: string;
  actionUID: number;
  title: string;
  feedback: string;
  metadata: string;
  media: string[];
  createdAt: number;
}

export interface WorkApproval {
  id: string;
  operatorAddress: string;
  gardenerAddress: string;
  actionUID: number;
  workUID: string;
  approved: boolean;
  feedback: string;
  createdAt: number;
}

export interface GardenAssessment {
  id: string;
  authorAddress: string;
  gardenAddress: string;
  title: string;
  description: string;
  assessmentType: string;
  capitals: string[];
  metricsCid: string | null;
  metrics: Record<string, unknown> | null;
  evidenceMedia: string[];
  reportDocuments: string[];
  impactAttestations: string[];
  startDate: number | null;
  endDate: number | null;
  location: string;
  tags: string[];
  createdAt: number;
}
```

**Updates required:**

- Both apps: Update type imports to use shared types
- Keep app-specific type extensions local

### 4.3 Create blockchain utility types

**Target:** `packages/shared/src/types/blockchain.d.ts`

**Implementation:**

```typescript
// packages/shared/src/types/blockchain.d.ts
import type { Hex } from "viem";

export type ChainId = number;
export type Address = Hex;

export interface DeploymentConfig {
  gardenToken?: Address;
  actionRegistry?: Address;
  workResolver?: Address;
  workApprovalResolver?: Address;
  deploymentRegistry?: Address;
  eas?: {
    address: Address;
    schemaRegistry: Address;
  };
  schemas?: {
    gardenAssessmentSchemaUID: string;
    workSchemaUID: string;
    workApprovalSchemaUID: string;
  };
  rootGarden?: {
    address: Address;
    tokenId: number;
  };
}
```

---

## Phase 5: Package Integration & Cleanup

### 5.1 Update client package.json

Add shared package dependency:

```json
{
  "dependencies": {
    "@green-goods/shared": "workspace:*"
  }
}
```

Update tsconfig to resolve shared imports:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@green-goods/shared/*": ["../shared/src/*"]
    }
  }
}
```

### 5.2 Update admin package.json

Add shared package dependency:

```json
{
  "dependencies": {
    "@green-goods/shared": "workspace:*"
  }
}
```

Update tsconfig similarly.

### 5.3 Remove duplicated code

After migration and successful tests:

**Admin deletions:**

- `src/utils/cn.ts` (migrated)
- `src/modules/urql.ts` (migrated)
- Portions of `src/config.ts` (keep app-specific parts)

**Client deletions:**

- `src/utils/styles/cn.ts` (migrated)
- `src/modules/data/urql.ts` (migrated)
- Portions of `src/config/blockchain.ts` (keep app-specific parts)
- `src/modules/data/graphql.ts` (migrated)

### 5.4 Update linting and formatting

Update root `.biome.json` to include shared package:

```json
{
  "files": {
    "include": ["packages/*/src/**"]
  }
}
```

Update lint script:

```json
{
  "scripts": {
    "lint": "oxlint packages/client/src packages/admin/src packages/shared/src packages/indexer/src packages/contracts/script"
  }
}
```

---

## Phase 6: Testing & Validation

### 6.1 Run comprehensive test suite

```bash
# Test shared package
bun --filter shared test

# Test consuming packages
bun --filter client test
bun --filter admin test

# Run E2E tests
bun test:e2e

# Check formatting
bun format:check

# Check linting
bun lint

# Verify builds
bun build
```

### 6.2 Manual validation checklist

- [ ] Admin can connect wallet and fetch gardens
- [ ] Client can create passkey and submit work
- [ ] EAS attestations display correctly in both apps
- [ ] IPFS uploads work in both apps
- [ ] Chain switching works correctly
- [ ] Dev mode proxy works for client
- [ ] Build sizes acceptable (no duplicate bundles)

### 6.3 Dependency audit

Verify no duplicate dependencies in bundles:

```bash
# Check bundle analysis
cd packages/client && bun build && ls -lh dist/
cd packages/admin && bun build && ls -lh dist/

# Verify peer dependencies resolved correctly
bun list viem --depth=0 -r
bun list react --depth=0 -r
```

---

## Phase 7: Documentation

### 7.1 Update shared package README

Create `packages/shared/README.md`:

```markdown
# @green-goods/shared

Shared utilities, types, and modules for Green Goods monorepo.

## Installation

This package is used internally by client and admin packages:

\`\`\`json
{
  "dependencies": {
    "@green-goods/shared": "workspace:*"
  }
}
\`\`\`

## Usage

### Utilities
\`\`\`typescript
import { cn } from "@green-goods/shared/utils";
\`\`\`

### Config
\`\`\`typescript
import { getEASConfig, getNetworkConfig } from "@green-goods/shared/config";
\`\`\`

### Modules
\`\`\`typescript
import { createEasClient, uploadFileToIPFS } from "@green-goods/shared/modules";
\`\`\`

### Types
\`\`\`typescript
import type { Garden, WorkCard } from "@green-goods/shared/types";
\`\`\`
```

### 7.2 Update root README

Add shared package to architecture diagram and package descriptions.

### 7.3 Update cursor rules

Update `green-goods/monorepo` rule to document shared package:

```markdown
## Cross-Package Dependencies

### Shared Package
- Location: `packages/shared/`
- Purpose: Common utilities, types, and data modules
- Used by: client, admin
- Exports: utilities (cn), config (blockchain), modules (EAS, Pinata, URQL), types

### Import Patterns
✅ Import from shared:
import { cn } from "@green-goods/shared/utils";
import { getEASConfig } from "@green-goods/shared/config";
```

---

## Rollback Plan

If issues arise during migration:

1. **Revert specific migration:** Use git to restore original files, remove shared imports
2. **Keep shared package:** Even if migration incomplete, package structure is useful for future
3. **Partial adoption:** Can keep some utilities in shared while reverting others

## Success Metrics

- ✅ Reduced LOC: ~500-800 lines eliminated from client/admin
- ✅ Single source of truth: Config logic centralized
- ✅ Easier maintenance: Bug fixes in shared affect both apps
- ✅ Faster development: New features use shared utilities
- ✅ No bundle bloat: Shared code tree-shaken correctly
- ✅ Tests pass: 100% of existing tests still pass

## Estimated Timeline

- Phase 1 (Setup): 2 hours
- Phase 2 (Wave 1): 3 hours
- Phase 3 (Wave 2): 4 hours
- Phase 4 (Wave 3): 2 hours
- Phase 5 (Integration): 2 hours
- Phase 6 (Testing): 2 hours
- Phase 7 (Docs): 1 hour

**Total: ~16 hours** for complete refactor with testing and documentation.

### To-dos

- [ ] Create shared package structure with package.json, tsconfig, and directory layout
- [ ] Migrate cn() className utility to shared and update imports in client/admin
- [ ] Migrate blockchain config utilities (getEASConfig, getNetworkConfig, etc.) to shared
- [ ] Migrate chain constants and helper functions to shared
- [ ] Run full test suite after Wave 1 migrations (utils, config, constants)
- [ ] Migrate URQL client factory to shared
- [ ] Migrate Pinata utilities to shared with factory pattern
- [ ] Migrate EAS query utilities and parsers to shared
- [ ] Migrate GraphQL helpers (easGraphQL tagged template) to shared
- [ ] Run full test suite after Wave 2 migrations (data modules)
- [ ] Move EAS introspection types to shared package
- [ ] Create shared Garden, WorkCard, and blockchain types
- [ ] Add shared package dependency to client and admin package.json files
- [ ] Remove duplicated code from client and admin after successful migration
- [ ] Update root lint and format scripts to include shared package
- [ ] Run comprehensive test suite: unit, integration, E2E, format, lint, build
- [ ] Perform manual validation checklist (wallet connect, work submission, attestations, etc.)
- [ ] Create shared package README and update root docs with shared package info