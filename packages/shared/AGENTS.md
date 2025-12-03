# Green Goods Shared Package — Architecture Guide

The shared package contains all common code used by both client (PWA) and admin (dashboard) apps. This is the central repository for hooks, providers, stores, workflows, modules, and utilities.

## Architecture Overview

```
src/
├── components/      # Shared UI (Toast, Spinner, Forms, StatusBadge)
├── config/          # App, blockchain, chains, pimlico, react-query
├── hooks/           # All custom hooks (auth, garden, work, blockchain, etc.)
├── modules/         # Core business logic
│   ├── job-queue/   # Offline queue system (IndexedDB, event bus)
│   ├── data/        # API clients (eas, greengoods, pinata, urql)
│   ├── work/        # Work submission logic
│   ├── app/         # PWA, analytics (posthog)
│   ├── auth/        # Passkey session management
│   └── translation/ # Translation utilities
├── providers/       # All React providers (Auth, JobQueue, Work, App)
├── stores/          # Zustand stores (admin, createGarden, UI, workFlow)
├── workflows/       # XState machines (createAssessment, createGarden)
├── types/           # TypeScript definitions
├── utils/           # Utility functions (action, app, blockchain, eas, etc.)
├── i18n/            # Translations (en, es, pt)
└── styles/          # Shared theme CSS
```

## Core Modules

### modules/job-queue/

The offline-first job queue system for work submissions and approvals.

**Files:**
- `index.ts` — JobQueue class with `addJob`, `getJobs`, `deleteJob`
- `db.ts` — IndexedDB interface for persistent storage
- `event-bus.ts` — Event-driven updates (`job:added`, `job:completed`, `job:failed`)
- `media-resource-manager.ts` — Blob URL lifecycle management

**Key patterns:**
```typescript
import { jobQueue, jobQueueEventBus } from '@green-goods/shared';

// Add job to queue
const jobId = await jobQueue.addJob('work', payload, { chainId });

// Listen for events
jobQueueEventBus.on('job:completed', ({ jobId, txHash }) => {
  // Handle completion
});

// Flush pending jobs
await jobQueue.flush({ smartAccountClient });
```

### modules/data/

Data fetching and API clients.

**Files:**
- `eas.ts` — EAS attestation queries
- `greengoods.ts` — Indexer queries (gardens, actions)
- `pinata.ts` — IPFS uploads
- `urql.ts` — GraphQL client configuration
- `graphql.ts` — Type-safe GraphQL (gql.tada)

### modules/work/

Work submission and approval logic.

**Files:**
- `index.ts` — Module exports
- `work-submission.ts` — Queue-based work submission
- `passkey-submission.ts` — Submit work/approval via passkey smart account
- `wallet-submission.ts` — Submit work/approval via wallet
- `bot-submission.ts` — Submit work via Telegram bot

### modules/auth/

Authentication utilities.

**Files:**
- `passkey.ts` — WebAuthn credential management
- `session.ts` — Session storage utilities

## Providers

All React context providers live here and are consumed by client and admin apps.

```typescript
// Provider hierarchy (required nesting order)
<WagmiProvider>
  <AppProvider>
    <ClientAuthProvider chainId={chainId}>
      <QueryClientProvider>
        <JobQueueProvider>
          <WorkProvider>
            {children}
          </WorkProvider>
        </JobQueueProvider>
      </QueryClientProvider>
    </ClientAuthProvider>
  </AppProvider>
</WagmiProvider>
```

**Available providers:**
- `AppProvider` — App settings, i18n, PWA state
- `AppKitProvider` — Wallet connection (Reown AppKit)
- `ClientAuthProvider` — Unified auth (passkey + wallet)
- `PasskeyAuthProvider` — Passkey-only auth
- `WalletAuthProvider` — Wallet-only auth
- `JobQueueProvider` — Offline job processing
- `WorkProvider` — Work submission state

## Hooks

All hooks are organized by domain:

### Auth Hooks
```typescript
import { useAuth, useUser } from '@green-goods/shared';

const { authMode, smartAccountClient, walletAddress } = useAuth();
const { user, ready, eoa, smartAccountAddress } = useUser();
```

### Garden Hooks
```typescript
import { useGardens, useGardenOperations, useGardenPermissions } from '@green-goods/shared';

const { data: gardens } = useGardens(chainId);
const { addGardener, removeGardener } = useGardenOperations();
const { canManageGarden } = useGardenPermissions();
```

### Work Hooks
```typescript
import { useWorks, useWorkApproval, useWorkMutation } from '@green-goods/shared';

const { data: works } = useWorks(gardenId, chainId);
const { approve, reject } = useWorkApproval();
const workMutation = useWorkMutation();
```

### Blockchain Hooks
```typescript
import { useCurrentChain, useNetworkConfig, useEnsName } from '@green-goods/shared';

const chainId = useCurrentChain(); // From VITE_CHAIN_ID
const config = useNetworkConfig();
const { data: ensName } = useEnsName(address);
```

### Query Keys
```typescript
import { queryKeys, queryInvalidation } from '@green-goods/shared';

// Centralized query keys (ALWAYS use these)
queryClient.invalidateQueries({ queryKey: queryKeys.works.merged(gardenId, chainId) });
queryClient.invalidateQueries({ queryKey: queryKeys.queue.stats() });
```

## Stores (Zustand)

Global UI state management:

```typescript
import { useAdminStore, useUIStore, useWorkFlowStore } from '@green-goods/shared';

// Admin state
const { selectedGarden, pendingTransactions } = useAdminStore();

// UI state
const { sidebarOpen, setSidebarOpen } = useUIStore();

// Work flow state
const { draft, setDraft, resetDraft } = useWorkFlowStore();
```

## Workflows (XState)

Complex multi-step flows with state machines:

```typescript
import { createGardenMachine, createAssessmentMachine } from '@green-goods/shared';

// Use with @xstate/react
const [state, send] = useMachine(createGardenMachine);
```

## Key Patterns

### 1. Chain from Environment Only

```typescript
// ✅ Correct
import { DEFAULT_CHAIN_ID, getDefaultChain } from '@green-goods/shared/config';
const chainId = DEFAULT_CHAIN_ID;

// ❌ Wrong - never use wallet chain
const { chainId } = useAccount();
```

### 2. Event-Driven Updates (No Polling)

```typescript
// ✅ Correct
import { useJobQueueEvents } from '@green-goods/shared';

useJobQueueEvents(['job:completed'], () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.works.merged(gardenId, chainId) });
});

// ❌ Wrong - no setInterval polling
setInterval(() => queryClient.invalidateQueries(), 5000);
```

### 3. Auth Mode Branching

```typescript
const { authMode, smartAccountClient } = useAuth();

if (authMode === 'wallet') {
  // Direct wallet transaction
  await submitWorkDirectly(draft, gardenAddress, actionUID);
} else {
  // Passkey mode - use job queue
  const { txHash, jobId } = await submitWorkToQueue(draft, gardenAddress, actionUID);
  if (smartAccountClient) {
    await processWorkJobInline(jobId, chainId, smartAccountClient);
  }
}
```

### 4. Media URL Lifecycle

```typescript
import { mediaResourceManager } from '@green-goods/shared';

// Create tracked URLs
const url = mediaResourceManager.createUrl(file, jobId);

// Cleanup when done
useEffect(() => () => mediaResourceManager.cleanupUrls(jobId), [jobId]);
```

## Usage from Client/Admin

### Client imports
```typescript
// Hooks
import { useAuth, useWorks, useWorkMutation } from '@green-goods/shared';

// Providers
import { AppProvider, JobQueueProvider, WorkProvider } from '@green-goods/shared';

// Config
import { DEFAULT_CHAIN_ID, getNetworkConfig } from '@green-goods/shared';

// Types
import type { Garden, Work, WorkDraft } from '@green-goods/shared';
```

### Admin imports
```typescript
// Hooks
import { useRole, useGardenOperations, useDeploymentRegistry } from '@green-goods/shared';

// Stores
import { useAdminStore, useCreateGardenStore } from '@green-goods/shared';

// Workflows
import { createGardenMachine } from '@green-goods/shared';
```

## Testing

Tests for shared code live in `src/__tests__/`:

```
__tests__/
├── hooks/           # Hook tests
├── modules/         # Module tests (job-queue, eas, etc.)
├── providers/       # Provider tests
├── utils/           # Utility tests
└── views/           # View component tests
```

Run tests:
```bash
cd packages/shared
bun test
```

## Adding New Functionality

### Adding a New Hook

1. Create hook in appropriate `src/hooks/{domain}/` directory
2. Export from `src/hooks/index.ts`
3. Add tests in `src/__tests__/hooks/`
4. Update query keys if needed in `src/hooks/query-keys.ts`

### Adding a New Module

1. Create module in `src/modules/{name}/`
2. Export from `src/modules/index.ts`
3. Add tests in `src/__tests__/modules/`
4. Document usage patterns

### Adding a New Store

1. Create store in `src/stores/use{Name}Store.ts`
2. Export from `src/stores/index.ts`
3. Add tests

## Reference Documentation

- Client AGENTS.md: `/packages/client/AGENTS.md`
- Admin AGENTS.md: `/packages/admin/AGENTS.md`
- Root AGENTS.md: `/AGENTS.md`
- Shared README: `/packages/shared/README.md`

