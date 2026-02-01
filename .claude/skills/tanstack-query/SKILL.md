---
name: tanstack-query
description: TanStack Query v5 for server state. Use when setting up data fetching, fixing v4→v5 migration, or debugging hydration.
---

# TanStack Query v5 Skill

Modern server state management with caching, synchronization, and background updates.

**Source**: [jezweb/claude-skills](https://github.com/jezweb/claude-skills)

---

## v5 Critical Changes

### Always Use Object Syntax

```typescript
// ❌ v4 syntax (broken)
useQuery(["todos"], fetchTodos);

// ✅ v5 syntax (required)
useQuery({
  queryKey: ["todos"],
  queryFn: fetchTodos,
});
```

### Status Flag Changes

| v4 | v5 | Meaning |
|----|----|----|
| `isLoading` | `isPending` | No data yet, fetching |
| `isLoading && isFetching` | `isLoading` | First fetch in progress |
| `cacheTime` | `gcTime` | Garbage collection time |
| `keepPreviousData` | `placeholderData: keepPreviousData` | Keep old data while refetching |

### Removed: Query Callbacks

```typescript
// ❌ Removed in v5
useQuery({
  queryKey: ["todos"],
  queryFn: fetchTodos,
  onSuccess: (data) => {},  // REMOVED
  onError: (error) => {},   // REMOVED
});

// ✅ Use useEffect instead
const { data, error } = useQuery({ queryKey: ["todos"], queryFn: fetchTodos });

useEffect(() => {
  if (data) handleSuccess(data);
}, [data]);

useEffect(() => {
  if (error) handleError(error);
}, [error]);
```

---

## Green Goods Query Patterns

### Using queryKeys Helper

```typescript
// packages/shared/src/hooks/query-keys.ts
import { queryKeys } from "@green-goods/shared";

// ✅ Always use centralized query keys
useQuery({
  queryKey: queryKeys.gardens.list(chainId),
  queryFn: () => fetchGardens(chainId),
});

useQuery({
  queryKey: queryKeys.gardens.detail(address),
  queryFn: () => fetchGarden(address),
});

useQuery({
  queryKey: queryKeys.work.byGarden(gardenAddress),
  queryFn: () => fetchWorkByGarden(gardenAddress),
});
```

### Query Options Factory

```typescript
// Reusable query options
export const gardenQueryOptions = (chainId: number) => ({
  queryKey: queryKeys.gardens.list(chainId),
  queryFn: () => fetchGardens(chainId),
  staleTime: 5 * 60 * 1000, // 5 minutes
});

// Use in component
const { data } = useQuery(gardenQueryOptions(chainId));

// Use for prefetching
await queryClient.prefetchQuery(gardenQueryOptions(chainId));
```

### Mutations with Invalidation

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryInvalidation } from "@green-goods/shared";

export function useSubmitWork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitWork,
    onSuccess: () => {
      // Invalidate related queries
      queryInvalidation.work(queryClient);
      queryInvalidation.gardens(queryClient);
    },
  });
}
```

### Mutations with User Feedback

```typescript
import { toastService, createWorkToasts, queryInvalidation } from "@green-goods/shared";
import { useIntl } from "react-intl";

export function useSubmitWork() {
  const queryClient = useQueryClient();
  const intl = useIntl();
  const workToasts = createWorkToasts(intl.formatMessage);

  return useMutation({
    mutationFn: submitWork,
    onMutate: async () => {
      // Show loading toast
      toastService.show(workToasts.submitting);
    },
    onSuccess: () => {
      toastService.show(workToasts.success);
      queryInvalidation.work(queryClient);
      queryInvalidation.gardens(queryClient);
    },
    onError: (error) => {
      toastService.show(workToasts.error(error.message));
    },
  });
}
```

### Optimistic Updates

```typescript
// v5 simplified optimistic updates
const mutation = useMutation({
  mutationFn: updateGarden,
  onMutate: async (newGarden) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: queryKeys.gardens.detail(newGarden.address) });

    // Snapshot previous value
    const previous = queryClient.getQueryData(queryKeys.gardens.detail(newGarden.address));

    // Optimistically update
    queryClient.setQueryData(queryKeys.gardens.detail(newGarden.address), newGarden);

    return { previous };
  },
  onError: (err, newGarden, context) => {
    // Rollback on error
    queryClient.setQueryData(
      queryKeys.gardens.detail(newGarden.address),
      context?.previous
    );
  },
  onSettled: () => {
    // Refetch after mutation
    queryClient.invalidateQueries({ queryKey: queryKeys.gardens.all });
  },
});
```

---

## Dependent Queries

```typescript
// Fetch garden first, then fetch its work
const { data: garden } = useQuery({
  queryKey: queryKeys.gardens.detail(address),
  queryFn: () => fetchGarden(address),
});

const { data: work } = useQuery({
  queryKey: queryKeys.work.byGarden(address),
  queryFn: () => fetchWorkByGarden(address),
  enabled: !!garden, // Only fetch when garden exists
});
```

---

## Parallel Queries

```typescript
import { useQueries } from "@tanstack/react-query";

// Fetch multiple gardens in parallel
const results = useQueries({
  queries: gardenAddresses.map((address) => ({
    queryKey: queryKeys.gardens.detail(address),
    queryFn: () => fetchGarden(address),
  })),
  combine: (results) => ({
    data: results.map((r) => r.data).filter(Boolean),
    isPending: results.some((r) => r.isPending),
  }),
});
```

---

## Infinite Queries

```typescript
const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = useInfiniteQuery({
  queryKey: queryKeys.work.infinite(gardenAddress),
  queryFn: ({ pageParam }) => fetchWorkPage(gardenAddress, pageParam),
  initialPageParam: 0,  // Required in v5!
  getNextPageParam: (lastPage) => lastPage.nextCursor,
});
```

---

## Error Handling

```typescript
// With Error Boundary
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

<QueryErrorResetBoundary>
  {({ reset }) => (
    <ErrorBoundary onReset={reset} fallbackRender={ErrorFallback}>
      <GardenList />
    </ErrorBoundary>
  )}
</QueryErrorResetBoundary>

// Or manual handling
const { data, error, isError } = useQuery({
  queryKey: queryKeys.gardens.list(chainId),
  queryFn: fetchGardens,
  throwOnError: false, // Handle manually
});

if (isError) {
  return <ErrorDisplay error={error} />;
}
```

---

## Configuration

```typescript
// Green Goods QueryClient setup
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,      // 5 minutes
      gcTime: 1000 * 60 * 60,        // 1 hour (was cacheTime)
      refetchOnWindowFocus: false,   // Disable for offline-first
      retry: (failureCount, error) => {
        if (error?.status === 404) return false;
        return failureCount < 3;
      },
    },
  },
});
```

---

## Never Do

- [ ] Use v4 array syntax `useQuery(["key"], fn)`
- [ ] Use query callbacks (`onSuccess`, `onError`, `onSettled` in queries)
- [ ] Use `isLoading` for "no data yet" (use `isPending`)
- [ ] Use `cacheTime` (use `gcTime`)
- [ ] Use `keepPreviousData` option (use `placeholderData: keepPreviousData`)
- [ ] Forget `initialPageParam` in infinite queries
- [ ] Use `enabled` with `useSuspenseQuery`

---

## GraphQL Integration with graphql-request

```typescript
import { request, gql } from "graphql-request";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@green-goods/shared";

const GARDENS_QUERY = gql`
  query GetGardens($chainId: Int!) {
    gardens(where: { chainId: $chainId }) {
      address
      name
      operators
    }
  }
`;

export function useGardens(chainId: number) {
  return useQuery({
    queryKey: queryKeys.gardens.list(chainId),
    queryFn: async () => {
      const endpoint = import.meta.env.VITE_GRAPHQL_ENDPOINT;
      const { gardens } = await request(endpoint, GARDENS_QUERY, { chainId });
      return gardens;
    },
  });
}
```

---

## Virtualizing Large Lists

For lists with >50 items, combine TanStack Query with `@tanstack/react-virtual`:

```typescript
import { useRef, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "@green-goods/shared";

function VirtualizedWorkList({ gardenAddress }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: queryKeys.work.infinite(gardenAddress),
      queryFn: ({ pageParam }) => fetchWorkPage(gardenAddress, pageParam),
      initialPageParam: 0,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    });

  const allItems = data?.pages.flatMap((p) => p.items) ?? [];

  const virtualizer = useVirtualizer({
    count: allItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
  });

  // Load more when nearing end
  useEffect(() => {
    const lastItem = virtualizer.getVirtualItems().at(-1);
    if (lastItem && lastItem.index >= allItems.length - 5 && hasNextPage) {
      fetchNextPage();
    }
  }, [virtualizer.getVirtualItems(), hasNextPage, fetchNextPage]);

  return (
    <div ref={parentRef} className="h-96 overflow-auto">
      {/* Virtual list rendering */}
    </div>
  );
}
```

---

## Performance Patterns

### Memoizing Query Results

```typescript
import { useMemo, useCallback } from "react";

// Use select option to transform/filter data
const { data } = useQuery({
  queryKey: queryKeys.gardens.list(chainId),
  queryFn: fetchGardens,
  select: (gardens) => gardens.filter((g) => g.active),
});

// Memoize expensive computations on query data
const sortedGardens = useMemo(
  () => data?.slice().sort((a, b) => b.workCount - a.workCount),
  [data]
);

// Stable callbacks for memoized children
const handleSelect = useCallback(
  (address: Address) => navigate(`/gardens/${address}`),
  [navigate]
);
```

### Best Practices

- Use `select` for data transformation (reduces re-renders)
- Use `useMemo` for expensive derived computations
- Use `useCallback` for handlers passed to memoized components
- Use `React.memo` for list item components with stable props
