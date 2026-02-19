---
paths:
  - "packages/shared/**/*.{ts,tsx}"
  - "packages/client/**/*.{ts,tsx}"
  - "packages/admin/**/*.{ts,tsx}"
---

# React Patterns

Rules for React code in shared, client, and admin packages. Use utility hooks from `@green-goods/shared` to enforce these patterns.

## Rule 1: Timer Cleanup in Hooks

Never use raw `setTimeout`/`setInterval` in hooks. Use `useTimeout()` or `useDelayedInvalidation()`.

```typescript
// Bad
onSuccess: () => { setTimeout(() => queryClient.invalidateQueries(...), 3000); }

// Good
const scheduleRefetch = useDelayedInvalidation(() => queryClient.invalidateQueries(...), 3000);
onSuccess: () => { scheduleRefetch(); }
```

## Rule 2: Event Listener Cleanup

Never use `addEventListener` without cleanup. Use `useEventListener()` or `{ once: true }`.

```typescript
// Bad
navigator.serviceWorker.addEventListener("controllerchange", () => { window.location.reload(); });

// Good - Option 1
navigator.serviceWorker.addEventListener("controllerchange", handler, { once: true });

// Good - Option 2
import { useEventListener } from '@green-goods/shared';
useEventListener(navigator.serviceWorker, "controllerchange", handler);
```

## Rule 3: Async Cleanup Race Prevention

Never run async in `useEffect` without `isMounted` guard. Use `useAsyncEffect()`.

```typescript
// Bad
useEffect(() => { fetchData().then(data => setData(data)); }, []);

// Good
import { useAsyncEffect } from '@green-goods/shared';
useAsyncEffect(async ({ isMounted }) => {
  const data = await fetchData();
  if (isMounted()) setData(data);
}, []);
```

## Rule 6: Zustand Selector Granularity

Never use `(state) => state`. Select specific fields.

```typescript
// Bad
const wizardState = useHypercertWizardStore((state) => state);

// Good
const selectedIds = useHypercertWizardStore(s => s.selectedAttestationIds);
const mode = useHypercertWizardStore(s => s.distributionMode);
```

## Rule 7: Query Key Stability

Serialize objects in query keys or ensure stable references.

```typescript
// Bad
queryKey: ["data", gardenId, filters] // filters recreated each render

// Good
queryKey: ["data", gardenId, JSON.stringify(filters)]
```

## Rule 8: Form Validation

Use React Hook Form + Zod in a `useXxxForm()` hook in `packages/shared`.

```typescript
// Good
export const xxxFormSchema = z.object({ field: z.string().min(1, "Required") });
export function useXxxForm() {
  return useForm<z.infer<typeof xxxFormSchema>>({
    resolver: zodResolver(xxxFormSchema), mode: "onChange",
  });
}
```

## Rule 9: Chained useMemo Dependencies

Never chain useMemo depending on another useMemo output. Combine into single useMemo.

```typescript
// Bad
const membership = useMemo(() => buildSets(data), [data]);
const addresses = useMemo(() => Array.from(membership.operatorIds), [membership.operatorIds]);

// Good
const { membership, addresses } = useMemo(() => {
  const m = buildSets(data);
  return { membership: m, addresses: Array.from(m.operatorIds) };
}, [data]);
```

## Rule 10: Context Provider Value Memoization

Wrap context provider values in useMemo.

```typescript
// Bad
<Context.Provider value={{ data, isLoading, actions }}>

// Good
const value = useMemo(() => ({ data, isLoading, actions }), [data, isLoading, actions]);
<Context.Provider value={value}>
```

## Rule 13: Provider Nesting Order

**Admin** (`packages/admin/src/main.tsx`):
```
QueryClientProvider > AppKitProvider > AuthProvider > AppProvider > App
```

**Client** (`packages/client/src/main.tsx` + `App.tsx`):
```
HelmetProvider > AppErrorBoundary > AppKitProvider > AuthProvider > AppProvider > App
```

Key constraints:
- `AppKitProvider` wraps `WagmiProvider` internally — never add a separate `WagmiProvider`
- `JobQueueProvider` and `WorkProvider` go at route/view level, not app root

## Utility Hooks Reference

```typescript
import {
  useEventListener, useWindowEvent, useDocumentEvent,  // Rule 2
  useTimeout, useDelayedInvalidation,                    // Rule 1
  useAsyncEffect, useAsyncSetup,                         // Rule 3
} from '@green-goods/shared';
```
