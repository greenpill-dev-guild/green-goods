# Architectural Rules

> **Scope**: These rules apply when writing or reviewing code in this monorepo. Each rule has a scope tag — skip rules that don't match the package you're editing.
>
> **Scope tags**: `react` = shared/client/admin | `all-ts` = any TypeScript | `contracts` = Solidity/Foundry | `universal` = everywhere

---

## Rule 1: Timer Cleanup in Hooks `[react]`

**Pattern:** `setTimeout`/`setInterval` inside React hooks or mutation callbacks

```
IF: setTimeout/setInterval is used inside a React hook or mutation callback
THEN: Timer leaks on component unmount
FIX: Use useTimeout() or useDelayedInvalidation() from @green-goods/shared
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

## Rule 2: Event Listener Cleanup `[react]`

**Pattern:** `addEventListener` without corresponding `removeEventListener`

```
IF: addEventListener is called inside a hook/effect/callback
THEN: Listener leaks if no matching removeEventListener exists
FIX: Use useEventListener() from @green-goods/shared, or { once: true }
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

// Option 3: Manual cleanup in useEffect return
useEffect(() => {
  const handler = () => window.location.reload();
  target.addEventListener("event", handler);
  return () => target.removeEventListener("event", handler);
}, []);
```

---

## Rule 3: Async Cleanup Race Prevention `[react]`

**Pattern:** Promise chains in useEffect without mount guards

```
IF: Async operation runs in useEffect without isMounted guard
THEN: State updates after unmount and stale closures
FIX: Use isMounted flag or useAsyncEffect() from @green-goods/shared
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

## Rule 4: Error Handling Consistency `[all-ts]`

**Pattern:** Inconsistent error handling (some log, some toast, some silent)

```
IF: catch block has empty body or only console.log/warn
THEN: Error is swallowed — no user feedback, no tracking
FIX: Log + track + display. In mutation hooks inside shared, use createMutationErrorHandler().
     In components, use parseContractError() + toast.
```

### ❌ Anti-pattern
```typescript
// Empty catch
try { await riskyOp(); } catch (e) { }

// Log-only
try { await riskyOp(); } catch (e) { console.warn(e); }
```

### ✅ Correct pattern (in components/views)
```typescript
import { parseContractError, USER_FRIENDLY_ERRORS, logger } from '@green-goods/shared';

try {
  await contractCall();
} catch (error) {
  const parsed = parseContractError(error);
  const message = USER_FRIENDLY_ERRORS[parsed.name] || 'Transaction failed';
  logger.error("Contract call failed", { error, parsed });
  toast.error(message);
}
```

### ✅ Correct pattern (in shared mutation hooks — internal import)
```typescript
// NOTE: createMutationErrorHandler is internal to @green-goods/shared.
// It is NOT barrel-exported. Use it only inside packages/shared/src/hooks/.
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";

const handleError = createMutationErrorHandler({
  source: "useMyHook",
  toastContext: "operation name",
  trackError: (error, meta) => trackOperationFailed({ error, ...meta }),
});

// In mutation
onError: (error) => handleError(error, { authMode, gardenAddress });
```

---

## Rule 5: Address Type Enforcement `[all-ts]`

**Pattern:** Using `string` instead of `Address` type for Ethereum addresses

```
IF: Variable/parameter named *address, *Address, or represents an Ethereum address
THEN: Type safety loss — wrong values pass silently
FIX: Use Address type from @green-goods/shared
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
import type { Address } from '@green-goods/shared';

interface Garden {
  tokenAddress: Address;
  operators: Address[];
}
```

---

## Rule 6: Zustand Selector Granularity `[react]`

**Pattern:** Selecting entire store state instead of specific slices

```
IF: useZustandStore(state => state) or useZustandStore() without selector
THEN: Component re-renders on ANY state change
FIX: Select only needed fields with separate selectors
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

## Rule 7: Query Key Stability `[react]`

**Pattern:** Object parameters in query keys without serialization

```
IF: TanStack Query key includes object/array that may be recreated each render
THEN: Cache key instability causes duplicate fetches
FIX: Serialize objects in query keys or ensure stable references via useMemo
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

## Rule 8: Form Validation Consistency `[react]`

**Pattern:** Manual validation mixed with React Hook Form

```
IF: Form uses useState for field values alongside manual validation
THEN: Inconsistent form patterns across codebase
FIX: Use React Hook Form + Zod schema in a useXxxForm() hook in packages/shared
```

### ❌ Anti-pattern
```typescript
const [value, setValue] = useState("");
const [error, setError] = useState("");

const handleSubmit = () => {
  if (!value) { setError("Required"); return; }
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

## Rule 9: Chained useMemo Dependencies `[react]`

**Pattern:** useMemo depending on another useMemo's output object

```
IF: useMemo B depends on useMemo A's output (object/array property)
THEN: Reference instability causes unnecessary recalculations
FIX: Combine into single useMemo or use primitive values as dependencies
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

## Rule 10: Context Provider Value Memoization `[react]`

**Pattern:** Context value objects recreated on every render

```
IF: Context Provider value is an object literal without useMemo
THEN: ALL consumers re-render on provider's every render
FIX: Wrap context value in useMemo with appropriate dependencies
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

## Rule 11: Barrel Import Enforcement `[all-ts]`

**Pattern:** Deep imports bypassing `@green-goods/shared` barrel exports

```
IF: Import uses @green-goods/shared/hooks/... or @green-goods/shared/stores/... etc.
THEN: Bypasses barrel exports, breaks tree-shaking, couples to internal structure
FIX: Import from @green-goods/shared root
EXCEPTION: Internal code within packages/shared/src/ uses relative imports (this is expected)
```

### ❌ Anti-pattern
```typescript
import { useAuth } from "@green-goods/shared/hooks/auth/useAuth";
import { useGardenStore } from "@green-goods/shared/stores/gardenStore";
```

### ✅ Correct pattern
```typescript
import { useAuth } from "@green-goods/shared";
import { useGardenStore } from "@green-goods/shared";
```

---

## Rule 12: Console.log Cleanup `[all-ts]`

**Pattern:** `console.log/warn/error` in production code (not tests)

```
IF: console.log/warn/error appears in production source files
THEN: Unstructured logging — no levels, no context, no filtering
FIX: Use logger service from @green-goods/shared
EXCEPTION: console.error in indexer event handlers is acceptable (Envio runtime has no logger)
```

### ❌ Anti-pattern
```typescript
console.log("Garden loaded", garden);
console.error("Failed to submit work", error);
```

### ✅ Correct pattern
```typescript
import { logger } from "@green-goods/shared";

logger.info("Garden loaded", { garden });
logger.error("Failed to submit work", { error });
```

---

## Rule 13: Provider Nesting Order `[react]`

**Pattern:** Incorrect provider hierarchy causing initialization failures

```
IF: Provider nesting order differs from documented hierarchy
THEN: Runtime errors — providers depend on ancestors for context
FIX: Follow exact order below
```

### Required Order (outermost → innermost)

**Admin** (`packages/admin/src/main.tsx`):
```tsx
<QueryClientProvider>
  <AppKitProvider>       {/* internally wraps WagmiProvider */}
    <AuthProvider>
      <AppProvider>
        <App />
      </AppProvider>
    </AuthProvider>
  </AppKitProvider>
</QueryClientProvider>
```

**Client** (`packages/client/src/main.tsx` + `App.tsx`):
```tsx
<HelmetProvider>
  <AppErrorBoundary>
    <AppKitProvider>           {/* internally wraps WagmiProvider */}
      <AuthProvider>
        <AppProvider>
          <App />  {/* App.tsx wraps PersistQueryClientProvider */}
        </AppProvider>
      </AuthProvider>
    </AppKitProvider>
  </AppErrorBoundary>
</HelmetProvider>
```

**Key constraints:**
- `AppKitProvider` wraps `WagmiProvider` internally — never add a separate `WagmiProvider`
- `JobQueueProvider` and `WorkProvider` go at route/view level, not app root
- `QueryClientProvider` placement differs: admin at root, client uses `PersistQueryClientProvider` inside `App.tsx`

---

## Rule 14: Always Use Bun Scripts for Contracts `[contracts]`

**Pattern:** Running `forge build`, `forge test`, or `forge script` directly

```
IF: forge build, forge test, or forge script is used directly
THEN: Bypasses adaptive build (~180s vs ~2s), missing test exclusions, missing env loading
FIX: Use the bun scripts defined in packages/contracts/package.json
```

### ❌ Anti-pattern
```bash
forge build
forge test --match-contract 'E2EWorkflowTest' -vvv
forge script script/Deploy.s.sol --broadcast --rpc-url $RPC
```

### ✅ Correct pattern
```bash
cd packages/contracts && bun build            # Adaptive build
cd packages/contracts && bun run test          # Unit tests (excludes E2E)
cd packages/contracts && bun run test:e2e:workflow  # E2E workflow
cd packages/contracts && bun run test:fork     # Fork tests
bun script/deploy.ts core --network sepolia --broadcast  # Deploy
```

---

## Utility Hooks Reference

These hooks from `@green-goods/shared` enforce Rules 1-3. Import from the barrel:

```typescript
import {
  useEventListener, useWindowEvent, useDocumentEvent,  // Rule 2
  useTimeout, useDelayedInvalidation,                    // Rule 1
  useAsyncEffect, useAsyncSetup,                         // Rule 3
} from '@green-goods/shared';
```

| Hook | Rule | Purpose |
|------|------|---------|
| `useEventListener(target, event, handler)` | 2 | Auto-cleanup event listeners |
| `useWindowEvent(event, handler)` | 2 | Window events with cleanup |
| `useDocumentEvent(event, handler)` | 2 | Document events with cleanup |
| `useTimeout()` | 1 | Returns `{ set, clear, isPending }` with auto-cleanup |
| `useDelayedInvalidation(fn, delay)` | 1 | Delayed query invalidation with cleanup |
| `useAsyncEffect(asyncFn, deps)` | 3 | Async effects with isMounted guard |
| `useAsyncSetup(setupFn, deps)` | 3 | Async init returning cleanup function |

---

## Enforcement Checklist

> Use during `/review` passes. Skip rules outside your current scope tag.

- [ ] **[react]** Timers: setTimeout/setInterval use utility hooks or manual cleanup
- [ ] **[react]** Listeners: addEventListener have matching removeEventListener or `{ once: true }`
- [ ] **[react]** Async: useEffect with async have isMounted guards
- [ ] **[all-ts]** Errors: No empty catch blocks; errors logged + tracked + displayed
- [ ] **[all-ts]** Types: Ethereum addresses use `Address` type
- [ ] **[react]** Zustand: No `(state) => state` selectors; use granular selectors
- [ ] **[react]** Query Keys: Objects in query keys are serialized or stable
- [ ] **[react]** Forms: React Hook Form + Zod for all forms
- [ ] **[react]** useMemo: No chained dependencies; combine into single useMemo
- [ ] **[react]** Context: Provider values wrapped in useMemo
- [ ] **[all-ts]** Imports: Barrel imports only from `@green-goods/shared` (no deep paths)
- [ ] **[all-ts]** Logging: No console.log/warn/error in production code; use logger
- [ ] **[react]** Providers: Nesting order matches documented hierarchy
- [ ] **[contracts]** Build/Test: Using bun scripts, never raw forge commands
