# Architectural Rules

> **Auto-generated from codebase analysis. Enforce during code reviews.**

These rules prevent common anti-patterns that cause performance leaks, fragile abstractions, and consistency drifts.

---

## Rule 1: Timer Cleanup in Hooks

**Pattern:** `setTimeout`/`setInterval` inside React hooks or mutation callbacks

```
IF: setTimeout/setInterval is used inside a React hook or mutation callback
THEN: Warn about timer leak on component unmount
SUGGEST: Use useTimeout() or useDelayedInvalidation() from @green-goods/shared
```

### ❌ Anti-pattern
```typescript
onSuccess: () => {
  setTimeout(() => queryClient.invalidateQueries(...), 3000);
}
```

### ✅ Correct pattern
```typescript
import { useDelayedInvalidation } from '@green-goods/shared';

const scheduleRefetch = useDelayedInvalidation(
  () => queryClient.invalidateQueries(...),
  3000
);

onSuccess: () => {
  scheduleRefetch();
}
```

---

## Rule 2: Event Listener Cleanup

**Pattern:** `addEventListener` without corresponding `removeEventListener`

```
IF: addEventListener is called inside a hook/effect/callback
THEN: Warn about listener leak if no matching removeEventListener exists
SUGGEST: Use useEventListener() from @green-goods/shared, or { once: true }
```

### ❌ Anti-pattern
```typescript
navigator.serviceWorker.addEventListener("controllerchange", () => {
  window.location.reload();
});
```

### ✅ Correct patterns
```typescript
// Option 1: Use { once: true } for one-time listeners
navigator.serviceWorker.addEventListener("controllerchange", handler, { once: true });

// Option 2: Use useEventListener hook
import { useEventListener } from '@green-goods/shared';
useEventListener(navigator.serviceWorker, "controllerchange", handler);

// Option 3: Manual cleanup
const handler = () => window.location.reload();
target.addEventListener("event", handler);
return () => target.removeEventListener("event", handler);
```

---

## Rule 3: Async Cleanup Race Prevention

**Pattern:** Promise chains in useEffect without mount guards

```
IF: Async operation runs in useEffect without isMounted guard
THEN: Warn about state updates after unmount and stale closures
SUGGEST: Use isMounted flag or useAsyncEffect() from @green-goods/shared
```

### ❌ Anti-pattern
```typescript
useEffect(() => {
  fetchData().then(data => setData(data));
}, []);
```

### ✅ Correct patterns
```typescript
// Option 1: isMounted guard
useEffect(() => {
  let isMounted = true;
  fetchData().then(data => {
    if (isMounted) setData(data);
  });
  return () => { isMounted = false; };
}, []);

// Option 2: useAsyncEffect hook
import { useAsyncEffect } from '@green-goods/shared';
useAsyncEffect(async ({ isMounted }) => {
  const data = await fetchData();
  if (isMounted()) setData(data);
}, []);
```

---

## Rule 4: Error Handling Consistency

**Pattern:** Inconsistent error handling (some log, some toast, some silent)

```
IF: catch block has empty body or only console.log/warn
THEN: Warn about silent error swallowing
SUGGEST: Use createMutationErrorHandler() for mutations, trackNetworkError() for network calls
```

### ❌ Anti-pattern
```typescript
// Empty catch
try { await riskyOp(); } catch (e) { }

// Log-only
try { await riskyOp(); } catch (e) { console.warn(e); }
```

### ✅ Correct pattern
```typescript
import { createMutationErrorHandler } from '@green-goods/shared/utils/errors';

const handleError = createMutationErrorHandler({
  source: "useMyHook",
  toastContext: "operation name",
  trackError: (error, meta) => trackOperationFailed({ error, ...meta }),
});

// In mutation
onError: (error) => handleError(error, { authMode, gardenAddress });
```

---

## Rule 5: Address Type Enforcement

**Pattern:** Using `string` instead of `Address` type for Ethereum addresses

```
IF: Variable/parameter named *address, *Address, or represents an Ethereum address
THEN: Warn about type safety loss
SUGGEST: Use Address type from '@green-goods/shared/types'
```

### ❌ Anti-pattern
```typescript
interface Garden {
  tokenAddress: string;
  operators: string[];
}
```

### ✅ Correct pattern
```typescript
import type { Address } from '@green-goods/shared/types';

interface Garden {
  tokenAddress: Address;
  operators: Address[];
}
```

---

## Rule 6: Zustand Selector Granularity

**Pattern:** Selecting entire store state instead of specific slices

```
IF: useZustandStore(state => state) or useZustandStore() without selector
THEN: Warn about unnecessary re-renders on any state change
SUGGEST: Select only needed fields with separate selectors
```

### ❌ Anti-pattern
```typescript
const wizardState = useHypercertWizardStore((state) => state);
const { selectedAttestationIds, distributionMode } = wizardState;
```

### ✅ Correct pattern
```typescript
const selectedAttestationIds = useHypercertWizardStore(s => s.selectedAttestationIds);
const distributionMode = useHypercertWizardStore(s => s.distributionMode);
```

---

## Rule 7: Query Key Stability

**Pattern:** Object parameters in query keys without serialization

```
IF: TanStack Query key includes object/array parameter that may be recreated each render
THEN: Warn about cache key instability causing duplicate fetches
SUGGEST: Serialize objects in query keys or ensure stable references via useMemo
```

### ❌ Anti-pattern
```typescript
queryKey: ["data", gardenId, filters] // filters is new object each render
```

### ✅ Correct patterns
```typescript
// Option 1: Serialize
queryKey: ["data", gardenId, JSON.stringify(filters)]

// Option 2: Stable reference
const stableFilters = useMemo(() => filters, [filters.field1, filters.field2]);
queryKey: ["data", gardenId, stableFilters]
```

---

## Rule 8: Form Validation Consistency

**Pattern:** Manual validation mixed with React Hook Form

```
IF: Form uses useState for field values alongside manual validation
THEN: Warn about inconsistent form patterns
SUGGEST: Use React Hook Form + Zod schema in a useXxxForm() hook
```

### ❌ Anti-pattern
```typescript
const [value, setValue] = useState("");
const [error, setError] = useState("");

const handleSubmit = () => {
  if (!value) { setError("Required"); return; }
  // ...
};
```

### ✅ Correct pattern
```typescript
// In packages/shared/src/hooks/xxx/useXxxForm.ts
export const xxxFormSchema = z.object({
  field: z.string().min(1, "Required"),
});

export function useXxxForm() {
  return useForm<z.infer<typeof xxxFormSchema>>({
    resolver: zodResolver(xxxFormSchema),
    mode: "onChange",
  });
}
```

---

## Rule 9: Chained useMemo Dependencies

**Pattern:** useMemo depending on another useMemo's output object

```
IF: useMemo B depends on useMemo A's output (object/array property)
THEN: Warn about reference instability causing unnecessary recalculations
SUGGEST: Combine into single useMemo or use primitive values as dependencies
```

### ❌ Anti-pattern
```typescript
const membership = useMemo(() => buildSets(data), [data]);
const addresses = useMemo(() => Array.from(membership.operatorIds), [membership.operatorIds]);
```

### ✅ Correct pattern
```typescript
const { membership, addresses } = useMemo(() => {
  const m = buildSets(data);
  return { membership: m, addresses: Array.from(m.operatorIds) };
}, [data]);
```

---

## Rule 10: Context Provider Value Memoization

**Pattern:** Context value objects recreated on every render

```
IF: Context Provider value is an object literal without useMemo
THEN: Warn about all consumers re-rendering on provider's every render
SUGGEST: Wrap context value in useMemo with appropriate dependencies
```

### ❌ Anti-pattern
```typescript
<Context.Provider value={{ data, isLoading, actions }}>
```

### ✅ Correct pattern
```typescript
const value = useMemo(() => ({
  data,
  isLoading,
  actions,
}), [data, isLoading, actions]);

<Context.Provider value={value}>
```

---

## Utility Hooks Reference

Located in `@green-goods/shared/hooks/utils/`:

| Hook | Purpose |
|------|---------|
| `useEventListener(target, event, handler)` | Auto-cleanup event listeners |
| `useWindowEvent(event, handler)` | Window events with cleanup |
| `useDocumentEvent(event, handler)` | Document events with cleanup |
| `useTimeout()` | Returns `{ set, clear, isPending }` with auto-cleanup |
| `useDelayedInvalidation(fn, delay)` | Delayed query invalidation with cleanup |
| `useAsyncEffect(asyncFn, deps)` | Async effects with isMounted guard |
| `useAsyncSetup(setupFn, deps)` | Async init returning cleanup function |

---

## Enforcement Checklist

Use this checklist during code reviews:

- [ ] **Timers**: All setTimeout/setInterval use utility hooks or manual cleanup
- [ ] **Listeners**: All addEventListener have matching removeEventListener or { once: true }
- [ ] **Async**: All useEffect with async have isMounted guards
- [ ] **Errors**: No empty catch blocks; all errors logged + tracked + displayed
- [ ] **Types**: All Ethereum addresses use `Address` type
- [ ] **Zustand**: No `(state) => state` selectors; use granular selectors
- [ ] **Query Keys**: Objects in query keys are serialized or stable
- [ ] **Forms**: React Hook Form + Zod for all forms
- [ ] **useMemo**: No chained dependencies; combine into single useMemo
- [ ] **Context**: Provider values wrapped in useMemo
