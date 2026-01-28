# Shared Package

> **Audience:** Frontend engineers building features in Client or Admin.
> **Path:** `packages/shared/`
> **Related:** [Architecture](architecture), [Client](client), [Admin](admin)

The shared package (`@green-goods/shared`) is the **central hub** for all React hooks, business logic modules, Zustand stores, TypeScript types, and utilities used across the Green Goods frontend applications.

---

## Hook Boundary Rule

**ALL React hooks MUST live in `@green-goods/shared`**. Client and Admin packages only contain components and views.

```typescript
// ✅ Correct - import hooks from shared
import { useAuth, useGardens, useRole, useWorks } from '@green-goods/shared';

// ❌ Wrong - never define hooks in client/admin
export function useLocalHook() { ... }  // DON'T DO THIS
```

---

## Quick Reference

| Directory | Purpose | Examples |
|-----------|---------|----------|
| `hooks/` | React hooks by domain | `useGardens()`, `useAuth()`, `useWorks()` |
| `modules/` | Business logic (non-React) | `eas.ts`, `hypercerts.ts`, `job-queue/` |
| `stores/` | Zustand global state | `useAdminStore`, `useHypercertWizardStore` |
| `types/` | TypeScript definitions | `Garden`, `Work`, `HypercertDraft` |
| `utils/` | Utility functions | Error handling, formatting, ABIs |
| `workflows/` | XState state machines | `authMachine`, `mintHypercertMachine` |
| `providers/` | React context providers | `AuthProvider`, `JobQueueProvider` |
| `components/` | Shared UI components | `Spinner`, `ErrorBoundary`, `DatePicker` |
| `config/` | Configuration | Network configs, chain setup |
| `lib/` | Specialized libraries | Hypercert distribution, merkle trees |

---

## Import Pattern

Always import from the barrel export, never from deep paths:

```typescript
// ✅ Correct - barrel import
import {
  useAuth,
  useGardens,
  useWorks,
  type Garden,
  type Work,
  queryKeys,
  queryInvalidation,
} from '@green-goods/shared';

// ❌ Wrong - deep import
import { useAuth } from '@green-goods/shared/hooks/auth/useAuth';
```

---

## Hook Organization

Hooks are organized by domain:

```
hooks/
├── action/        # Action management
├── analytics/     # PostHog tracking
├── app/           # App-level (theme, locale, install guidance)
├── assessment/    # Garden assessments
├── auth/          # Authentication (useAuth, useRole)
├── blockchain/    # Web3 (useDeploymentRegistry, useChainConfig)
├── garden/        # Garden domain (useGardens, useGardenPermissions)
├── gardener/      # Gardener profiles
├── hypercerts/    # Hypercerts (useHypercerts, useMintHypercert)
├── storage/       # Draft storage
├── translation/   # i18n
├── work/          # Work domain (useWorks, useWorkApprovals)
├── index.ts       # Barrel export
└── query-keys.ts  # TanStack Query key factory
```

### Key Hooks by Domain

**Authentication:**
```typescript
const { user, isAuthenticated, loginWithPasskey, logout } = useAuth();
const { role, isOperator, isAdmin } = useRole();
```

**Gardens:**
```typescript
const { data: gardens, isLoading } = useGardens(chainId);
const { permissions, canApprove, canCreateAction } = useGardenPermissions(gardenId);
```

**Work:**
```typescript
const { data: works } = useWorks(gardenId, chainId);
const { data: approvals } = useWorkApprovals(attesterAddress, chainId);
const { mutate: submitWork } = useWorkMutation();
```

**Hypercerts:**
```typescript
const { data: hypercerts } = useHypercerts(gardenId);
const { data: attestations } = useHypercertAttestations(gardenId, filters);
const { draft, updateDraft } = useHypercertDraft(gardenId);
const { mint, state } = useMintHypercert();
```

---

## Query Keys

Centralized query key factory for TanStack Query:

```typescript
import { queryKeys, queryInvalidation } from '@green-goods/shared';

// Standard query usage
const { data } = useQuery({
  queryKey: queryKeys.gardens.byChain(chainId),
  queryFn: () => getGardens(chainId),
});

// Invalidation after mutations
await queryClient.invalidateQueries({
  queryKey: queryInvalidation.invalidateGardens(chainId),
});
```

### Key Domains

| Domain | Key Factory | Example |
|--------|-------------|---------|
| Gardens | `queryKeys.gardens` | `queryKeys.gardens.byChain(chainId)` |
| Works | `queryKeys.works` | `queryKeys.works.online(gardenId, chainId)` |
| Approvals | `queryKeys.workApprovals` | `queryKeys.workApprovals.byAttester(address)` |
| Queue | `queryKeys.queue` | `queryKeys.queue.stats()` |
| Hypercerts | `queryKeys.hypercerts` | `queryKeys.hypercerts.list(gardenId)` |

### Stale Time Constants

```typescript
import { STALE_TIME_FAST, STALE_TIME_MEDIUM, STALE_TIME_SLOW } from '@green-goods/shared';

STALE_TIME_FAST   // 5 seconds - queue status, uploads
STALE_TIME_MEDIUM // 30 seconds - approvals, recent works
STALE_TIME_SLOW   // 1 minute - gardens, actions
```

---

## Stores (Zustand)

Global state management with Zustand:

```typescript
import { useAdminStore, useHypercertWizardStore, useUIStore } from '@green-goods/shared';

// Admin state
const { selectedChainId, selectedGarden } = useAdminStore();

// Hypercert wizard state
const { step, draft, nextStep, updateDraft } = useHypercertWizardStore();

// UI state
const { sidebarOpen, toggleSidebar } = useUIStore();
```

### Available Stores

| Store | Purpose | Key State |
|-------|---------|-----------|
| `useAdminStore` | Admin dashboard | `selectedChainId`, `selectedGarden` |
| `useHypercertWizardStore` | Hypercert minting | `step`, `draft`, `mintingState` |
| `useUIStore` | UI state | `sidebarOpen`, `theme` |
| `useWorkFlowStore` | Work submission | `currentStep`, `workDraft` |
| `useCreateGardenStore` | Garden creation | `step`, `formData` |

### Hypercert Wizard Store (Multi-Step Pattern)

The `useHypercertWizardStore` demonstrates the pattern for complex multi-step forms:

```typescript
import { useHypercertWizardStore } from '@green-goods/shared';

function WizardStep() {
  const {
    // Navigation
    currentStep,
    nextStep,
    previousStep,
    setStep,

    // Step 1: Attestations
    selectedAttestationIds,
    toggleAttestation,
    setSelectedAttestations,

    // Step 2: Metadata
    title,
    description,
    workScopes,
    sdgs,
    capitals,
    updateMetadata,

    // Step 3: Distribution
    distributionMode,
    allowlist,
    setDistributionMode,
    setAllowlist,

    // Step 4: Minting
    mintingState,
    setMintingState,

    // Persistence
    loadDraft,
    toDraft,
    reset,
  } = useHypercertWizardStore();
}
```

**Step Navigation:**
```typescript
function StepNavigation() {
  const { currentStep, nextStep, previousStep } = useHypercertWizardStore();

  return (
    <div className="flex justify-between">
      <button onClick={previousStep} disabled={currentStep === 1}>
        Previous
      </button>
      <span>Step {currentStep} of 4</span>
      <button onClick={nextStep} disabled={currentStep === 4}>
        Next
      </button>
    </div>
  );
}
```

**Draft Persistence:** Auto-save progress to IndexedDB:
```typescript
const store = useHypercertWizardStore();
const { hasDraft, saveDraft } = useHypercertDraft(gardenId);

// Auto-save on changes (debounced)
useEffect(() => {
  const timeout = setTimeout(() => {
    const draft = store.toDraft(gardenId, operatorAddress);
    saveDraft(draft);
  }, 1000);
  return () => clearTimeout(timeout);
}, [store.currentStep, store.selectedAttestationIds, store.title]);
```

---

## Modules

Business logic organized by domain:

```
modules/
├── app/           # App utilities (logger)
├── auth/          # Passkey authentication
├── data/          # GraphQL clients and queries
├── job-queue/     # Offline job queue
├── translation/   # i18n utilities
└── work/          # Work validation and submission
```

### Data Module

GraphQL clients and queries:

```typescript
import {
  getGardens,
  getWorks,
  getApprovedAttestations,
  createIndexerClient,
  createEasClient,
} from '@green-goods/shared';

// Fetch gardens from Envio indexer
const gardens = await getGardens(chainId);

// Fetch approved attestations from EAS
const attestations = await getApprovedAttestations(gardenId, chainId, filters);
```

### Job Queue Module

Offline-first job processing:

```typescript
import { jobQueue, jobQueueEventBus, JobKind } from '@green-goods/shared';

// Add job to queue
await jobQueue.addJob({
  kind: JobKind.WORK_SUBMISSION,
  payload: { gardenAddress, actionUID, ... },
  maxRetries: 3,
});

// Listen for events
jobQueueEventBus.on('jobCompleted', (job) => {
  console.log('Job completed:', job.id);
});
```

---

## Types

All domain types are centralized:

```typescript
import type {
  // Domain entities
  Garden,
  Work,
  WorkApproval,
  Action,
  GardenAssessment,

  // Cards (display variants)
  GardenCard,
  WorkCard,
  ActionCard,

  // Drafts (form state)
  WorkDraft,
  HypercertDraft,
  AssessmentDraft,

  // Job queue
  Job,
  JobKind,
  JobPayload,

  // Hypercerts
  HypercertMetadata,
  AllowlistEntry,
  OutcomeMetrics,
} from '@green-goods/shared';
```

### Address Type

Use `Address` from shared, not `Hex` from viem:

```typescript
import type { Address } from '@green-goods/shared';

function isGardener(address: Address, garden: Garden): boolean {
  return garden.gardeners.includes(address);
}
```

---

## Utilities

### Error Handling

```typescript
import {
  parseContractError,
  USER_FRIENDLY_ERRORS,
  categorizeError,
  formatErrorForToast,
} from '@green-goods/shared';

try {
  await contractCall();
} catch (error) {
  const parsed = parseContractError(error);
  const message = USER_FRIENDLY_ERRORS[parsed.name] || 'Transaction failed';
  toast.error(message);
}
```

### Address Utilities

```typescript
import {
  formatAddress,
  truncateAddress,
  compareAddresses,
  isValidAddressFormat,
} from '@green-goods/shared';

formatAddress('0x1234...5678', { variant: 'short' }); // "0x12...78"
truncateAddress('0x1234...5678'); // "0x1234...5678"
compareAddresses(addr1, addr2); // case-insensitive comparison
```

### Date/Time Utilities

```typescript
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  toDateInputValue,
  fromDateInputValue,
} from '@green-goods/shared';

formatDate(timestamp); // "Jan 27, 2026"
formatRelativeTime(timestamp); // "2 hours ago"
```

---

## Workflows (XState)

Complex async flows with state machines:

```typescript
import { authMachine, mintHypercertMachine } from '@green-goods/shared';

// Auth machine states: idle → authenticating → authenticated / error
// Mint machine states: idle → uploadingMetadata → uploadingAllowlist → signing → pending → confirmed / failed
```

### Mint Hypercert Workflow

The `mintHypercertMachine` orchestrates the multi-step minting process:

```
idle → uploadingMetadata → uploadingAllowlist → signing → pending → confirmed
                ↓                    ↓              ↓         ↓
             failed              failed          failed   failed
```

**Minting Status Labels:**
```typescript
import type { MintingStatus } from '@green-goods/shared';

const STATUS_LABELS: Record<MintingStatus, string> = {
  idle: 'Ready to mint',
  uploading_metadata: 'Uploading metadata to IPFS...',
  uploading_allowlist: 'Uploading allowlist...',
  building_userop: 'Building transaction...',
  awaiting_signature: 'Please sign in your wallet...',
  submitting: 'Submitting transaction...',
  pending: 'Waiting for confirmation...',
  confirmed: 'Hypercert minted successfully!',
  failed: 'Minting failed',
};
```

**Using the Hook:**
```typescript
import { useMintHypercert, useHypercertWizardStore } from '@green-goods/shared';

function MintButton({ gardenAddress }) {
  const store = useHypercertWizardStore();
  const { mint, state, error, reset } = useMintHypercert();

  const handleMint = async () => {
    await mint({
      metadata: buildMetadata(store),
      allowlist: store.allowlist,
      totalUnits: TOTAL_UNITS,
      gardenAddress,
      attestationUIDs: store.selectedAttestationIds,
    });
  };

  return (
    <button onClick={handleMint} disabled={state !== 'idle' && state !== 'failed'}>
      {state === 'idle' ? 'Mint Hypercert' : 'Minting...'}
    </button>
  );
}
```

**Navigation Blocking:** Prevent accidental navigation during minting:
```typescript
import { useBrowserNavigation } from '@green-goods/shared';

function WizardContainer() {
  const { mintingState } = useHypercertWizardStore();

  const isBlocking = ['uploading_metadata', 'uploading_allowlist', 'signing', 'pending']
    .includes(mintingState.status);

  useBrowserNavigation({
    when: isBlocking,
    message: 'Minting in progress. Are you sure you want to leave?',
  });
}
```

---

## Providers

React context providers for app-wide state:

```typescript
import {
  AppProvider,
  AuthProvider,
  JobQueueProvider,
  WorkProvider,
} from '@green-goods/shared';

// Provider hierarchy (order matters)
<WagmiProvider>
  <AppProvider>
    <AuthProvider>
      <QueryClientProvider>
        <JobQueueProvider>
          <WorkProvider>
            <Routes />
```

---

## Components

Shared UI components:

```typescript
import {
  Spinner,
  CenteredSpinner,
  ErrorBoundary,
  DatePicker,
  DateRangePicker,
  ConfirmDialog,
  StatusBadge,
  ImageWithFallback,
} from '@green-goods/shared';
```

### Toast Service

Centralized toast notifications:

```typescript
import { toastService, createWorkToasts } from '@green-goods/shared';

const workToasts = createWorkToasts(t); // t = translation function
toastService.show(workToasts.submitting);
toastService.show(workToasts.success);
```

---

## Testing Utilities

Mock factories for testing:

```typescript
import {
  createMockGarden,
  createMockWork,
  createMockHypercertDraft,
  createMockAttestation,
} from '@green-goods/shared/__tests__/test-utils';

const garden = createMockGarden({ name: 'Test Garden' });
const work = createMockWork({ title: 'Test Work', gardenTokenId: garden.id });
```

---

## Development

```bash
# Type check
cd packages/shared && npx tsc --noEmit

# Run tests
bun --filter shared test

# Start Storybook (component playground)
bun --filter shared storybook    # http://localhost:6006

# Build Storybook
bun --filter shared build-storybook
```

---

## Adding New Hooks

1. Create hook in appropriate domain folder under `hooks/`
2. Export from `hooks/index.ts`
3. Re-export from `src/index.ts`
4. Add query keys to `query-keys.ts` if using TanStack Query
5. Add tests in `__tests__/hooks/`

Example:

```typescript
// hooks/garden/useGardenStats.ts
export function useGardenStats(gardenId: string, chainId: number) {
  return useQuery({
    queryKey: queryKeys.gardens.stats(gardenId, chainId),
    queryFn: () => fetchGardenStats(gardenId, chainId),
    staleTime: STALE_TIME_MEDIUM,
  });
}
```

---

## Related Documentation

- [Architecture](architecture) — System overview
- [Client Package](client) — Offline-first PWA patterns
- [Admin Package](admin) — Dashboard patterns
- [Error Handling](error-handling) — Error categories and toasts
- [Testing Guide](testing) — Test patterns and coverage
