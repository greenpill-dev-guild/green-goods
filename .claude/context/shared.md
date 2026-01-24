# Shared Package Context

Loaded when working in `packages/shared/`. Extends CLAUDE.md.

## Quick Reference

| Command | Purpose |
|---------|---------|
| `bun test` | Run tests |
| `npx tsc --noEmit` | Type check |
| `bun lint` | Lint with oxlint |

## Architecture

```
packages/shared/src/
├── hooks/        # ALL React hooks (domain-organized)
├── providers/    # Auth, JobQueue, Work, App contexts
├── stores/       # Zustand state management
├── modules/      # Core business logic
├── workflows/    # XState state machines
├── types/        # TypeScript definitions
├── config/       # App, chains, pimlico configuration
├── utils/        # Utility functions
├── i18n/         # Translations (en, es, pt)
└── components/   # Toast, Spinner, StatusBadge
```

## Critical Patterns

### Hook Architecture (MANDATORY)

**ALL hooks live in shared. Client/admin have ZERO hook definitions.**

```typescript
// ✅ Correct — import from shared
import { useAuth, useWorks, useRole } from "@green-goods/shared";

// ❌ Wrong — never create hooks in client/admin
// packages/client/src/hooks/useLocalHook.ts
export function useLocalHook() { ... }  // DON'T DO THIS
```

### Hook Categories

| Category | Location | Examples |
|----------|----------|----------|
| Authentication | `hooks/auth/` | `useAuth`, `useUser` |
| Garden | `hooks/garden/` | `useGardens`, `useGardenOperations`, `useGardenPermissions` |
| Work | `hooks/work/` | `useWorks`, `useWorkMutation`, `useWorkApproval` |
| Blockchain | `hooks/blockchain/` | `useCurrentChain`, `useNetworkConfig`, `useEnsName` |
| App | `hooks/app/` | `useOffline`, `useToastAction`, `useTheme` |
| Role | `hooks/gardener/` | `useRole`, `useGardenerProfile` |

### Query Key Pattern (MANDATORY)

Always use centralized query keys — never ad-hoc strings:

```typescript
import { queryKeys, queryInvalidation } from "@green-goods/shared";

// ✅ Correct — centralized keys
useQuery({ queryKey: queryKeys.gardens.all(chainId) });
queryClient.invalidateQueries({ queryKey: queryKeys.works.merged(gardenId, chainId) });

// ❌ Wrong — ad-hoc keys
useQuery({ queryKey: ["gardens", chainId] });
queryClient.invalidateQueries({ queryKey: ["works", gardenId] });
```

**Key factories:**
- `queryKeys.gardens.all(chainId)` — All gardens
- `queryKeys.gardens.detail(gardenId, chainId)` — Single garden
- `queryKeys.works.merged(gardenId, chainId)` — Online + offline works
- `queryKeys.queue.stats()` — Job queue statistics

### Provider Hierarchy (MANDATORY)

Providers must nest in this exact order:

```tsx
<WagmiProvider config={wagmiConfig}>
  <QueryClientProvider client={queryClient}>
    <AppKitProvider>
      <AuthProvider>
        <AppProvider>
          <JobQueueProvider>
            <WorkProvider>
              {children}
            </WorkProvider>
          </JobQueueProvider>
        </AppProvider>
      </AuthProvider>
    </AppKitProvider>
  </QueryClientProvider>
</WagmiProvider>
```

### State Tool Selection

| Concern | Tool | Notes |
|---------|------|-------|
| Server state | TanStack Query | Remote data, caching |
| UI state | Zustand | Stores in `shared/stores/` |
| Form state | React Hook Form | Local to component |
| Global context | React Context | Providers in shared |
| Complex workflows | XState | Multi-step state machines |

### Event-Driven Updates (MANDATORY)

**Never poll. Always react to events:**

```typescript
// ✅ Correct — event-driven
import { useJobQueueEvents, queryKeys } from "@green-goods/shared";

useJobQueueEvents(["job:completed"], () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.works.merged(gardenId, chainId) });
});

// ❌ Wrong — polling
setInterval(() => refetch(), 5000);
```

### TypeScript Strictness

**Never use `any` — use `unknown` for untrusted data:**

```typescript
// ✅ Forces type narrowing
function processApiResponse(data: unknown): Garden | null {
  if (isGarden(data)) return data;
  return null;
}

// ❌ Disables type safety
function processApiResponse(data: any): Garden {
  return data;  // No validation!
}
```

**Use discriminated unions for state:**

```typescript
// ✅ Type-safe
type JobState =
  | { status: 'pending' }
  | { status: 'processing'; progress: number }
  | { status: 'completed'; result: Work }
  | { status: 'failed'; error: string };
```

### Chain from Environment Only

```typescript
// ✅ Correct — environment chain
import { DEFAULT_CHAIN_ID, useCurrentChain } from '@green-goods/shared';
const chainId = useCurrentChain();

// ❌ Wrong — wallet chain can differ
const { chainId } = useAccount();
```

### i18n (MANDATORY for User-Facing Strings)

All new user-facing strings MUST be added to ALL THREE language files:

```typescript
// ✅ Correct
intl.formatMessage({ id: "app.update.title", defaultMessage: "Refresh app" })

// ❌ Wrong — hardcoded
<button>Refresh app</button>
```

**Files to update simultaneously:**
- `src/i18n/en.json`
- `src/i18n/es.json`
- `src/i18n/pt.json`

## Anti-Patterns

### Never Mix State Concerns

```typescript
// ❌ Wrong — server state in Zustand
const useStore = create((set) => ({
  gardens: [],  // Server data in Zustand!
  fetchGardens: async () => { ... },
}));

// ✅ Correct — TanStack Query for server state
const { data: gardens } = useQuery({
  queryKey: queryKeys.gardens.all(chainId),
  queryFn: fetchGardens,
});
```

### Never Create Stores Outside Shared

```typescript
// ❌ Wrong — store in client/admin
// packages/client/src/stores/useLocalStore.ts

// ✅ Correct — store in shared
// packages/shared/src/stores/useStore.ts
```

### Never Skip Hook Index Export

```typescript
// ❌ Missing from index (hook exists but not exported)
// packages/shared/src/hooks/domain/useNewHook.ts exists
// but not exported from hooks/index.ts

// ✅ Always export from index
// hooks/index.ts
export { useNewHook } from "./domain/useNewHook";
// Then re-export from packages/shared/src/index.ts
```

## Common Mistakes

| Mistake | Why It Fails | Solution |
|---------|--------------|----------|
| Deep imports from shared | Bypasses barrel exports | Import from `@green-goods/shared` root |
| Using wallet chainId | Wallet may be on wrong chain | Use `useCurrentChain()` |
| Polling for updates | Wastes resources, stale data | Use event-driven updates |
| Creating hooks in client | Violates hook boundary | Move to shared |
| Ad-hoc query keys | Cache misses, stale data | Use `queryKeys` factory |

## Creating New Hooks

1. **Choose domain folder:** `hooks/{auth,garden,work,blockchain,app}/`
2. **Follow naming:** `useEntityVerb` (operations), `useEntity` (data), `useAdjective` (state)
3. **Export from index:** `hooks/index.ts` → `src/index.ts`
4. **Use centralized query keys**

```typescript
// hooks/{domain}/useNewHook.ts
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";

export function useNewHook(param: string) {
  return useQuery({
    queryKey: queryKeys.domain.key(param),
    queryFn: ({ signal }) => fetchData(param, signal),  // Support cancellation
  });
}
```

## Reference Files

- Hook exports: `src/hooks/index.ts`
- Query keys: `src/hooks/query-keys.ts`
- Package exports: `src/index.ts`
- Providers: `src/providers/`
- Stores: `src/stores/`
