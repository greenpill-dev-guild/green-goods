# Green Goods Shared

Central code repository consumed by client and admin packages. Contains all hooks, providers, stores, modules, and utilities.

## Quick Reference

| Command | Description |
|---------|-------------|
| `bun test` | Run tests |
| `bun test --coverage` | Run with coverage |
| `npx tsc --noEmit` | Type check |
| `bun lint` | Run linter |

## Architecture

```
src/
├── hooks/           # All custom React hooks
│   ├── auth/       # useAuth, useUser
│   ├── garden/     # useGardens, useGardenOperations
│   ├── work/       # useWorks, useWorkApproval
│   ├── blockchain/ # useCurrentChain, useEnsName
│   └── app/        # useOffline, useToastAction
├── providers/       # Auth, JobQueue, Work, App
├── stores/          # Zustand (admin, UI, workFlow)
├── modules/         # Core business logic
│   ├── job-queue/  # Offline queue system
│   ├── data/       # API clients (EAS, indexer, IPFS)
│   ├── work/       # Submission logic
│   └── auth/       # Passkey session
├── workflows/       # XState machines
├── config/          # Chain, pimlico, react-query
├── types/           # TypeScript definitions
├── utils/           # Utility functions
├── i18n/            # Translations (en, es, pt)
└── components/      # Toast, Spinner, StatusBadge
```

## Core Concepts

### Hook Centralization

**All hooks live in shared.** Client and admin packages consume hooks but never define them.

```typescript
// ✅ Correct — import from shared
import { useAuth, useWorks, useRole } from "@green-goods/shared";

// ❌ Wrong — no local hooks
import { useLocalHook } from "./hooks/useLocalHook";
```

### Provider Hierarchy

Required nesting order:

```tsx
<WagmiProvider>
  <AppKitProvider>
    <AuthProvider>
      <AppProvider>
        <QueryClientProvider>
          <JobQueueProvider>
            <WorkProvider>
              {children}
            </WorkProvider>
          </JobQueueProvider>
        </QueryClientProvider>
      </AppProvider>
    </AuthProvider>
  </AppKitProvider>
</WagmiProvider>
```

### Query Key Centralization

Always use centralized query keys:

```typescript
import { queryKeys, queryInvalidation } from '@green-goods/shared';

// ✅ Correct
queryClient.invalidateQueries({ queryKey: queryKeys.works.merged(gardenId, chainId) });

// ❌ Wrong
queryClient.invalidateQueries({ queryKey: ['works', gardenId] });
```

### Event-Driven Updates

No polling — use events:

```typescript
useJobQueueEvents(['job:completed'], () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.queue.stats() });
});
```

## Cursor Rules

Detailed patterns are documented in `.cursor/rules/`:

| Rule File | Description |
|-----------|-------------|
| `rules.mdc` | **Start here** — Package overview and critical patterns |
| `hook-architecture.mdc` | Hook categories, naming conventions, creation guide |
| `state-patterns.mdc` | Providers, Zustand, TanStack Query, XState |
| `design-system.mdc` | Colors, typography, spacing, icons |
| `testing-patterns.mdc` | Vitest, mocks, coverage targets |
| `appkit-integration.mdc` | Wallet connection configuration |
| `cross-package-imports.mdc` | Import boundaries and patterns |

## Key Exports

### Hooks

```typescript
// Auth
import { useAuth, useUser } from '@green-goods/shared';

// Garden
import { useGardens, useGardenOperations, useGardenPermissions, useRole } from '@green-goods/shared';

// Work
import { useWorks, useWorkApproval, useWorkMutation } from '@green-goods/shared';

// App
import { useOffline, useToastAction, useCurrentChain } from '@green-goods/shared';

// Query keys
import { queryKeys, queryInvalidation } from '@green-goods/shared';
```

### Providers

```typescript
import { AppKitProvider, AuthProvider, AppProvider, JobQueueProvider, WorkProvider } from '@green-goods/shared';
```

### Stores

```typescript
import { useAdminStore, useUIStore, useWorkFlowStore, useCreateGardenStore } from '@green-goods/shared';
```

### Modules

```typescript
import { jobQueue, jobQueueEventBus, mediaResourceManager } from '@green-goods/shared';
```

### Config

```typescript
import { DEFAULT_CHAIN_ID, getNetworkConfig, getDefaultChain } from '@green-goods/shared';
```

## Critical Rules

1. **Explicit exports** — No wildcard exports, always explicit
2. **Type-only exports** — Use `export type` for types
3. **Chain from environment** — Use `DEFAULT_CHAIN_ID`, never wallet chain
4. **No polling** — Use event-driven updates
5. **Centralized query keys** — Always use `queryKeys` from shared

## Adding New Functionality

### New Hook

1. Create in `src/hooks/{domain}/useHookName.ts`
2. Export from `src/hooks/index.ts`
3. Add tests in `src/__tests__/hooks/`

### New Module

1. Create in `src/modules/{name}/`
2. Export from `src/modules/index.ts`
3. Add tests in `src/__tests__/modules/`

### New Store

1. Create in `src/stores/use{Name}Store.ts`
2. Export from `src/stores/index.ts`

## Reference

- **Client package:** `/packages/client/AGENTS.md`
- **Admin package:** `/packages/admin/AGENTS.md`
- **Root guide:** `/AGENTS.md`
- **README:** `/packages/shared/README.md`
