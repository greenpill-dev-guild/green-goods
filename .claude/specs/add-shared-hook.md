# Task: Add Shared Hook

## Trigger

A new React hook is needed for data fetching, state management, or business logic that will be consumed by client, admin, or both. All hooks MUST live in `@green-goods/shared` per the hook boundary rule.

## Acceptance Criteria

The hook lives in `packages/shared/src/hooks/{domain}/` and is exported from both `hooks/index.ts` and `src/index.ts`. It uses the `queryKeys` factory for cache keys (no ad-hoc strings). It handles offline scenarios gracefully (returns cached data when offline, queues mutations). Error handling uses `createMutationErrorHandler` for mutations or `categorizeError` for queries. A failing test exists before the implementation. At least one consumer (client or admin) imports and uses the hook via `@green-goods/shared`. `bun run test && bun lint && bun build` passes.

## Decomposition

### Step 1: Cathedral Check
**Packages**: `shared`
**Input**: Hook requirements (what data, what operations)
**Output**: Identify the most similar existing hook by browsing `packages/shared/src/hooks/`. Note its patterns: query key structure, stale time, error handling, parameter types, return shape. Determine domain folder: `auth/`, `garden/`, `work/`, `blockchain/`, `app/`, `gardener/`, `vault/`, `hypercerts/`, etc.
**Verification**: Existing hook identified and read. Domain folder selected
**Complexity**: S

### Step 2: Define Query Key
**Packages**: `shared`
**Input**: Data shape and parameters from requirements
**Output**: New entry in `packages/shared/src/hooks/query-keys.ts` under the appropriate domain namespace. Use the factory pattern: `domain: { key: (param: Type) => ["domain", "key", param] as const }`. For object parameters, serialize with `JSON.stringify` to ensure stable keys. Choose stale time: `STALE_TIME_FAST` (5s) for queue/upload data, `STALE_TIME_MEDIUM` (30s) for approvals/works, `STALE_TIME_SLOW` (60s) for gardens/actions
**Verification**: `cd packages/shared && npx tsc --noEmit` (type-checks the key factory)
**Complexity**: S

### Step 3: Write Failing Test
**Packages**: `shared`
**Input**: Query key from Step 2, expected hook behavior
**Output**: Test file at `packages/shared/src/hooks/{domain}/__tests__/useNewHook.test.ts` (or co-located `useNewHook.test.ts`). Use `renderHook` with QueryClientProvider wrapper. Test: successful fetch populates data, loading state transitions, error state handled, offline returns cached data (`vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)`). For mutations: test optimistic update and rollback on error
**Verification**: `cd packages/shared && bun run test -- path/to/test.test.ts` (must FAIL)
**Complexity**: S-M

### Step 4: Implement Hook
**Packages**: `shared`
**Input**: Failing test from Step 3, cathedral reference from Step 1
**Output**: Hook at `packages/shared/src/hooks/{domain}/useNewHook.ts`. For queries: use `useQuery` with `queryKey` from factory, `queryFn` with `{ signal }` for cancellation support, appropriate `staleTime`. For mutations: use `useMutation` with `onError: createMutationErrorHandler(...)`, `onSuccess` with query invalidation via `queryClient.invalidateQueries({ queryKey: queryKeys.domain.key() })`. Use `Address` type (not `string`) for Ethereum addresses. Use `unknown` (not `any`) for untrusted data
**Verification**: `cd packages/shared && bun run test -- path/to/test.test.ts` (must PASS)
**On Failure**: If tests still fail, iterate on implementation until passing (max 3 attempts before escalating)
**Complexity**: M

### Step 5: Barrel Export
**Packages**: `shared`
**Input**: Hook from Step 4
**Output**: Export added to `packages/shared/src/hooks/index.ts` (named export) and re-exported from `packages/shared/src/index.ts`. Export any associated types. Follow existing export style (explicit named exports, type exports separate)
**Verification**: `cd packages/shared && bun build`
**Complexity**: S

### Step 6: Consumer Integration
**Packages**: `client` and/or `admin`
**Input**: Exported hook from Step 5
**Output**: At least one consumer component imports `useNewHook` from `@green-goods/shared` (barrel import, never deep path). Component handles all query states with specific UI:
- `isLoading` → `<Spinner />` component (never a blank screen)
- `isError` → `<ErrorBoundary />` fallback or toast with categorized message (network → retry prompt, auth → redirect, contract → parsed error)
- `data` is empty → `<EmptyState />` component with contextual message
Admin consumers check role permissions if data is role-scoped
**Verification**: `cd packages/{client,admin} && bun build`
**Complexity**: S-M

### Step 7: Full Stack Verification
**Packages**: all affected
**Input**: All prior steps
**Output**: Full stack passes
**Verification**: `bun run test && bun lint && bun build`
**Complexity**: S

## Edge Cases

- **Query key serialization**: Objects in query keys must be serialized to strings (`JSON.stringify`), otherwise React Query treats each render's object reference as a new key, causing infinite refetches. Use `serializeAttestationFilters` or similar helpers for complex filter objects.
- **Offline behavior for queries**: Set `networkMode: "offlineFirst"` for queries that should return cached data when offline. For mutations, use the job queue (`submitWorkToQueue`) instead of direct mutation when offline support is required.
- **Stale time selection**: Choosing too-short stale times causes unnecessary network requests. Choosing too-long stale times causes stale UI. Match the data's actual change frequency: gardens change rarely (SLOW), works change often (MEDIUM), queue status changes constantly (FAST).
- **Event-driven invalidation**: If the data changes in response to on-chain transactions, wire up `useJobQueueEvents(["job:completed"], () => invalidate(...))` instead of relying on stale time alone. Never use `setInterval` polling.
- **Hook composition**: If the new hook depends on data from another hook (e.g., needs `gardenId` from `useGardens`), accept the dependency as a parameter rather than calling the other hook internally. This keeps hooks composable and testable.
- **Chain ID source**: Always use `DEFAULT_CHAIN_ID` from config or `useCurrentChain()` hook. Never use `useAccount().chainId` which reflects the wallet's current chain, not the app's target chain.
- **Cancellation support**: Pass `{ signal }` from the queryFn to any fetch/RPC calls so React Query can abort in-flight requests on unmount or key change.

## Anti-Patterns

- Creating hooks in `packages/client/` or `packages/admin/` (violates hook boundary)
- Using ad-hoc query key strings (`["myData", id]`) instead of `queryKeys` factory
- Importing from `@green-goods/shared/hooks/domain/useHook` (deep path) instead of barrel
- Using `any` type for API responses (use `unknown` + type narrowing)
- Using `string` type for Ethereum addresses (use `Address` from shared)
- Calling `useQuery` without a stale time (defaults to 0, refetches on every render focus)
- Swallowing mutation errors in `onError` without logging or user notification
- Polling with `refetchInterval` instead of event-driven invalidation
- Writing the implementation before the failing test (violates TDD)
- Skipping the barrel export step (hook exists but consumers can't import it)
