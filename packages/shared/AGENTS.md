# Green Goods Shared Package — Architecture Guide

The shared package contains all common code used by both client (PWA) and admin (dashboard) apps. This is the central repository for hooks, providers, stores, workflows, modules, and utilities.

## Architecture Overview

```
src/
├── components/      # Shared UI (Toast, Spinner, Forms, StatusBadge)
├── config/          # App, blockchain, chains, pimlico, react-query
├── hooks/           # All custom hooks (auth, garden, work, blockchain, etc.)
│   ├── action/      # Action operations
│   ├── app/         # App-level hooks (offline, toast, theme, navigation)
│   ├── assessment/  # Assessment workflows
│   ├── auth/        # Authentication hooks (useAuth, useUser)
│   ├── blockchain/  # Chain config, ENS, deployment registry
│   ├── garden/      # Garden operations, permissions, invites
│   ├── gardener/    # Role, profile hooks
│   ├── translation/ # i18n hooks
│   ├── ui/          # UI utilities (scroll reveal)
│   └── work/        # Work submission, approval, mutations
├── modules/         # Core business logic
│   ├── app/         # Analytics (posthog), service worker
│   ├── auth/        # Passkey session management
│   ├── data/        # API clients (eas, greengoods, pinata, urql, graphql)
│   ├── job-queue/   # Offline queue system (IndexedDB, event bus)
│   ├── translation/ # Browser translation, cache
│   └── work/        # Work/approval submission logic
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
- `index.ts` — JobQueue class with `addJob`, `processJob`, `flush`, `getStats`
- `db.ts` — IndexedDB interface for persistent storage
- `event-bus.ts` — Event-driven updates (`job:added`, `job:completed`, `job:failed`, `job:processing`)
- `media-resource-manager.ts` — Blob URL lifecycle management

**Key patterns:**
```typescript
import { jobQueue, jobQueueEventBus, useJobQueueEvents } from '@green-goods/shared';

// Add job to queue
const jobId = await jobQueue.addJob('work', payload, { chainId });

// Listen for events (React hook)
useJobQueueEvents(['job:completed'], ({ jobId, txHash }) => {
  queryClient.invalidateQueries({ queryKey: queryKeys.works.merged(gardenId, chainId) });
});

// Or use event bus directly
jobQueueEventBus.on('job:completed', ({ jobId, txHash }) => {
  // Handle completion
});

// Flush pending jobs
await jobQueue.flush({ smartAccountClient });

// Get queue statistics
const stats = await jobQueue.getStats();
```

### modules/data/

Data fetching and API clients.

**Files:**
- `eas.ts` — EAS attestation queries (getWorks, getWorkApprovals, getGardenAssessments)
- `greengoods.ts` — Indexer queries (getGardens, getActions, getGardeners)
- `pinata.ts` — IPFS uploads (uploadFileToIPFS, uploadJSONToIPFS, resolveIPFSUrl)
- `urql.ts` — GraphQL client configuration (createEasClient, greenGoodsIndexer)
- `graphql.ts` — Type-safe GraphQL with gql.tada (easGraphQL, greenGoodsGraphQL)

### modules/work/

Work submission and approval logic.

**Files:**
- `index.ts` — Module exports
- `work-submission.ts` — Validation and status utilities (validateWorkDraft, formatJobError)
- `passkey-submission.ts` — Submit work/approval via passkey smart account
- `wallet-submission.ts` — Submit work/approval via wallet
- `bot-submission.ts` — Submit work via Telegram bot

### modules/app/

Application-level utilities.

**Files:**
- `posthog.ts` — Analytics (track, identify, trackOfflineEvent, trackSyncPerformance)
- `service-worker.ts` — Service worker manager for PWA

### modules/auth/

Authentication utilities.

**Files:**
- `passkey.ts` — WebAuthn credential management (registerPasskeySession, authenticatePasskey)
- `session.ts` — Session storage utilities (saveAuthMode, clearAllAuthStorage)

### modules/translation/

Translation and i18n utilities.

**Files:**
- `browser-translator.ts` — Browser-based translation service
- `db.ts` — Translation cache (IndexedDB)
- `diagnostics.ts` — Translation debugging tools

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
import { useAuth, useUser, useClientAuth, usePasskeyAuth, useWalletAuth } from '@green-goods/shared';

const { authMode, smartAccountClient, walletAddress } = useAuth();
const { user, ready, eoa, smartAccountAddress } = useUser();
```

### Garden Hooks
```typescript
import { 
  useGardens, 
  useGardenOperations, 
  useGardenPermissions,
  useGardenInvites,
  useGardenTabs,
  useJoinGarden,
  useAutoJoinRootGarden,
  useCreateGardenWorkflow
} from '@green-goods/shared';

const { data: gardens } = useGardens(chainId);
const { addGardener, removeGardener, addOperator, removeOperator } = useGardenOperations();
const permissions = useGardenPermissions();
```

### Work Hooks
```typescript
import { 
  useWorks, 
  useMyWorks,
  useMyMergedWorks,
  useWorkApproval, 
  useWorkApprovals,
  useWorkMutation,
  useWorkForm,
  useWorkImages,
  usePendingWorksCount,
  useQueueStatistics
} from '@green-goods/shared';

const { data: works } = useWorks(gardenId, chainId);
const { approve, reject } = useWorkApproval();
const workMutation = useWorkMutation();
```

### Blockchain Hooks
```typescript
import { 
  useCurrentChain, 
  useNetworkConfig, 
  useChainConfig,
  useEASConfig,
  useEnsName,
  useEnsAddress,
  useEnsAvatar,
  useDeploymentRegistry,
  useActions,
  useGardeners
} from '@green-goods/shared';

const chainId = useCurrentChain(); // From VITE_CHAIN_ID
const config = useNetworkConfig();
const { data: ensName } = useEnsName(address);
```

### App Hooks
```typescript
import { 
  useOffline, 
  useToastAction, 
  useMerged,
  useTheme,
  useBrowserNavigation,
  useNavigateToTop,
  useScrollReveal
} from '@green-goods/shared';

const isOffline = useOffline();
const { executeWithToast } = useToastAction();
```

### Role & Profile Hooks
```typescript
import { useRole, useGardenerProfile } from '@green-goods/shared';

const { role, isDeployer, isOperator, operatorGardens } = useRole();
const { profile, updateProfile } = useGardenerProfile();
```

### Translation Hooks
```typescript
import { useTranslation, useActionTranslation, useGardenTranslation } from '@green-goods/shared';

const { translate, isTranslating } = useTranslation();
const translatedAction = useActionTranslation(action);
```

### Query Keys
```typescript
import { queryKeys, queryInvalidation } from '@green-goods/shared';

// Centralized query keys (ALWAYS use these)
queryClient.invalidateQueries({ queryKey: queryKeys.works.merged(gardenId, chainId) });
queryClient.invalidateQueries({ queryKey: queryKeys.queue.stats() });

// Available key factories
queryKeys.gardens.all(chainId)
queryKeys.gardens.detail(gardenId, chainId)
queryKeys.works.merged(gardenId, chainId)
queryKeys.works.online(gardenId, chainId)
queryKeys.queue.stats()
queryKeys.queue.pending()
```

## Stores (Zustand)

Global UI state management:

```typescript
import { useAdminStore, useUIStore, useWorkFlowStore, useCreateGardenStore } from '@green-goods/shared';

// Admin state
const { selectedGarden, setSelectedGarden, pendingTransactions } = useAdminStore();

// UI state
const { sidebarOpen, setSidebarOpen } = useUIStore();

// Work flow state
const { draft, setDraft, resetDraft } = useWorkFlowStore();

// Garden creation wizard state
const { step, formData, setStep, updateFormData } = useCreateGardenStore();
```

## Workflows (XState)

Complex multi-step flows with state machines:

```typescript
import { createGardenMachine, createAssessmentMachine } from '@green-goods/shared';
import { useMachine } from '@xstate/react';

// Garden creation workflow
const [state, send] = useMachine(createGardenMachine);
send({ type: 'NEXT' });
send({ type: 'SUBMIT', data: formData });

// Assessment workflow
const [assessmentState, sendAssessment] = useMachine(createAssessmentMachine);
```

## Key Patterns

### 1. Chain from Environment Only

```typescript
// ✅ Correct
import { DEFAULT_CHAIN_ID, getDefaultChain } from '@green-goods/shared';
const chainId = DEFAULT_CHAIN_ID;

// ❌ Wrong - never use wallet chain
const { chainId } = useAccount();
```

### 2. Event-Driven Updates (No Polling)

```typescript
// ✅ Correct
import { useJobQueueEvents, queryKeys } from '@green-goods/shared';

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

### 5. Toast Notifications for Transactions

```typescript
import { useToastAction } from '@green-goods/shared';

const { executeWithToast } = useToastAction();

await executeWithToast(
  () => writeContractAsync({/*...*/}),
  {
    loadingMessage: 'Processing...',
    successMessage: 'Success!',
    errorMessage: 'Failed',
  }
);
```

## Usage from Client/Admin

### Client imports
```typescript
// Hooks
import { useAuth, useWorks, useWorkMutation, useOffline } from '@green-goods/shared';

// Providers
import { AppProvider, ClientAuthProvider, JobQueueProvider, WorkProvider } from '@green-goods/shared';

// Modules
import { jobQueue, jobQueueEventBus, submitWorkWithPasskey } from '@green-goods/shared';

// Config
import { DEFAULT_CHAIN_ID, getNetworkConfig } from '@green-goods/shared';

// Types
import type { Garden, Work, WorkDraft, Job, QueueStats } from '@green-goods/shared';
```

### Admin imports
```typescript
// Hooks
import { useRole, useGardenOperations, useDeploymentRegistry, useToastAction } from '@green-goods/shared';

// Stores
import { useAdminStore, useCreateGardenStore, useUIStore } from '@green-goods/shared';

// Workflows
import { createGardenMachine, createAssessmentMachine } from '@green-goods/shared';

// Utils
import { formatAddress, truncateAddress, cn } from '@green-goods/shared';
```

## Components

Shared UI components for consistency across apps:

```typescript
import { 
  Spinner, 
  CenteredSpinner,
  StatusBadge, 
  ToastViewport, 
  toastService,
  FormInput,
  FormTextarea,
  FormLayout,
  TranslationBadge,
  HydrationFallback
} from '@green-goods/shared';

// Toast service
toastService.success({ title: 'Saved!', message: 'Your changes were saved.' });
toastService.error({ title: 'Error', message: 'Something went wrong.' });

// Render toast viewport once in root layout
<ToastViewport />
```

## Testing

Tests for shared code live in `src/__tests__/`:

```
__tests__/
├── hooks/
│   ├── useGardenOperations.test.ts
│   ├── useRole.test.ts
│   ├── useToastAction.test.ts
│   └── useUser.test.tsx
├── modules/
│   ├── job-queue.core.test.ts
│   ├── job-queue.db.test.ts
│   ├── job-queue.event-bus.test.ts
│   ├── work-submission.test.ts
│   ├── eas.test.ts
│   ├── greengoods.test.ts
│   └── ... (deduplication, posthog, urql, etc.)
├── providers/
│   ├── AuthProvider.test.tsx
│   └── garden-filtering.test.ts
├── utils/
│   ├── ens.test.ts
│   └── text.test.ts
└── views/
    └── Login.test.tsx
```

Run tests:
```bash
cd packages/shared
bun test

# Run specific test
bun test job-queue

# Run with coverage
bun test --coverage
```

## Adding New Functionality

### Adding a New Hook

1. Create hook in appropriate `src/hooks/{domain}/` directory
2. Export from `src/hooks/index.ts` with explicit named export
3. Re-export from `src/index.ts` if needed at package root
4. Add tests in `src/__tests__/hooks/`
5. Update query keys in `src/hooks/query-keys.ts` if fetching data

### Adding a New Module

1. Create module in `src/modules/{name}/`
2. Export from `src/modules/index.ts`
3. Re-export from `src/index.ts` if needed
4. Add tests in `src/__tests__/modules/`
5. Document usage patterns in this file

### Adding a New Store

1. Create store in `src/stores/use{Name}Store.ts`
2. Export from `src/stores/index.ts`
3. Re-export from `src/index.ts`
4. Add tests

### Adding a New Provider

1. Create provider in `src/providers/{Name}.tsx`
2. Export from `src/providers/index.ts`
3. Document required position in provider hierarchy
4. Add tests in `src/__tests__/providers/`

## Reference Documentation

- Client AGENTS.md: `/packages/client/AGENTS.md`
- Admin AGENTS.md: `/packages/admin/AGENTS.md`
- Root AGENTS.md: `/AGENTS.md`
- Shared README: `/packages/shared/README.md`
