# @green-goods/shared

Shared utilities, hooks, providers, modules, and types for the Green Goods monorepo.

## Installation

This package is used internally by client and admin packages:

```json
{
  "dependencies": {
    "@green-goods/shared": "workspace:*"
  }
}
```

## Usage

Import everything from the package root:

```typescript
// Hooks
import { useAuth, useWorks, useGardens, useRole } from '@green-goods/shared';

// Providers
import { AppProvider, JobQueueProvider, WorkProvider } from '@green-goods/shared';

// Stores
import { useAdminStore, useUIStore, useWorkFlowStore } from '@green-goods/shared';

// Modules
import { jobQueue, track, submitWorkWithPasskey } from '@green-goods/shared';

// Config
import { DEFAULT_CHAIN_ID, getNetworkConfig, queryClient } from '@green-goods/shared';

// Utils
import { cn, formatAddress, truncateAddress } from '@green-goods/shared';

// Components
import { Spinner, ToastViewport, toastService, StatusBadge } from '@green-goods/shared';

// Types
import type { Garden, Work, UserRole, AuthMode } from '@green-goods/shared';
```

## Package Structure

```
src/
├── components/      # Shared UI (Toast, Spinner, Forms, StatusBadge)
├── config/          # App, blockchain, chains, pimlico, react-query
├── hooks/           # All custom hooks (auth, garden, work, blockchain, etc.)
│   ├── action/      # Action operations
│   ├── app/         # App-level hooks (offline, toast, theme)
│   ├── assessment/  # Assessment workflows
│   ├── auth/        # Authentication (useAuth, useUser)
│   ├── blockchain/  # Chain config, ENS, deployment registry
│   ├── garden/      # Garden operations, permissions, invites
│   ├── gardener/    # Role, profile hooks
│   ├── translation/ # i18n hooks
│   ├── ui/          # UI utilities
│   └── work/        # Work submission, approval, mutations
├── modules/         # Core business logic
│   ├── app/         # Analytics (posthog), service worker
│   ├── auth/        # Passkey session management
│   ├── data/        # API clients (eas, greengoods, ipfs/storacha, urql)
│   ├── job-queue/   # Offline queue system (IndexedDB, event bus)
│   ├── translation/ # Browser translation, cache
│   └── work/        # Work/approval submission logic
├── providers/       # React providers (Auth, JobQueue, Work, App)
├── stores/          # Zustand stores (admin, UI, workFlow, createGarden)
├── workflows/       # XState machines (createGarden, createAssessment)
├── types/           # TypeScript definitions
├── utils/           # Utility functions
├── i18n/            # Translations (en, es, pt)
└── styles/          # Shared theme CSS
```

## Key Features

### Toast Notifications

```typescript
import { toastService, ToastViewport } from '@green-goods/shared';

// Show toasts
toastService.success({ title: 'Saved!', message: 'Your changes were saved.' });
toastService.error({ title: 'Error', message: 'Something went wrong.', error });
toastService.loading({ title: 'Processing...', message: 'Please wait.' });

// Render once in your root layout
<ToastViewport />
```

### Job Queue (Offline Support)

```typescript
import { jobQueue, useJobQueueEvents, queryKeys } from '@green-goods/shared';

// Add job to queue
await jobQueue.addJob('work', payload, { chainId });

// Listen for completion
useJobQueueEvents(['job:completed'], ({ txHash }) => {
  queryClient.invalidateQueries({ queryKey: queryKeys.works.merged(gardenId, chainId) });
});

// Flush pending jobs
await jobQueue.flush({ smartAccountClient });
```

### Query Keys

Always use centralized query keys:

```typescript
import { queryKeys } from '@green-goods/shared';

queryClient.invalidateQueries({ queryKey: queryKeys.gardens.all(chainId) });
queryClient.invalidateQueries({ queryKey: queryKeys.works.merged(gardenId, chainId) });
queryClient.invalidateQueries({ queryKey: queryKeys.queue.stats() });
```

### Auth Mode Branching

```typescript
import { useAuth } from '@green-goods/shared';

const { authMode, smartAccountClient } = useAuth();

if (authMode === 'wallet') {
  // Direct wallet transaction
} else {
  // Passkey mode - use job queue for offline support
}
```

## Development

```bash
# Format code
bun format

# Lint code
bun lint

# Run tests
bun test

# Run specific test
bun test job-queue
```

## Documentation

📖 **[Shared Package Documentation](https://docs.greengoods.app/developer/architecture/monorepo-structure#shared-package)** — Shared utilities and architecture patterns

**Essential Guides:**
- 🏗️ [Hook Architecture](https://docs.greengoods.app/developer/architecture/monorepo-structure#hook-boundary-critical) — All hooks centralized in shared
- 🔄 [State Management](https://docs.greengoods.app/developer/architecture/monorepo-structure#state-management) — Providers, stores, and query patterns
- 📦 [Cross-Package Imports](https://docs.greengoods.app/developer/architecture/monorepo-structure#cross-package-dependencies) — Import boundaries and conventions

**For AI Agents:**
- [AGENTS.md](./AGENTS.md) — AI agent architecture guide
- [Root AGENTS.md](/AGENTS.md) — Monorepo-wide documentation
