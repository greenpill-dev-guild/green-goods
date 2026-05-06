---
name: react
user-invocable: false
description: React patterns - component architecture, state management (Zustand, TanStack Query), hook composition, error handling, state machines, render performance. Use for React components, hooks, data fetching, mutations, error boundaries, state machines, or performance optimization.
version: "2.0.0"
status: active
packages: ["shared", "client", "admin"]
dependencies: []
keywords: ["data fetching", "query", "mutation", "cache", "error handling", "try/catch", "error boundary", "state machine", "workflow", "XState", "actor", "performance", "bundle size", "profiling", "memory leak"]
last_updated: "2026-03-18"
last_verified: "2026-03-18"
---

# React Skill

Complete React guide: state management, component composition, and performance optimization.

---

## Activation

When invoked:
- Identify state category (local/global/server/form/flow) before choosing a tool.
- Keep hooks in `@green-goods/shared` only.
- Use granular Zustand selectors to limit re-renders.

## Part 1: State Management

### State Categories

| Type | Green Goods Solution |
|------|---------------------|
| **Local State** | useState, useReducer |
| **Global State** | Zustand |
| **Server State** | TanStack Query |
| **URL State** | React Router |
| **Form State** | React Hook Form + Zod |
| **Complex Flows** | XState (workflows/) |

**Green Goods uses:** Zustand + XState + TanStack Query

### Zustand Patterns

**Selector rule:** Never subscribe to entire store. Always use granular selectors or export selector hooks.

```typescript
// Bad: re-renders on any store change
const state = useAppStore();

// Good: granular selector
const user = useAppStore((state) => state.user);

// Better: exported selector hook (in shared)
export const useUser = () => useAppStore((state) => state.user);
```

### Combining Client + Server State

Use Zustand for UI state (sidebar, modals, preferences) and TanStack Query for server state (gardens, works, approvals). Never duplicate server data into Zustand -- let Query manage caching and invalidation.

### Advanced Zustand Patterns

**Persist middleware:** Green Goods stores use `persist` for offline state survival. Always use `partialize` to persist only specific fields -- without it, transient UI state (modals, banners) gets restored on refresh, causing stale UI.

**Multi-step form stores** (like `useCreateGardenStore`) combine `persist` with step progression and derived validation via `get()`. Key patterns: `setField` for individual updates, `isStepValid` computed from state (not stored), `reset()` for cleanup.

#### Store Testing

```typescript
beforeEach(() => {
  act(() => useCreateGardenStore.getState().reset()); // Reset between tests
});

test("advances step when valid", () => {
  act(() => {
    useCreateGardenStore.getState().setField("name", "My Garden");
    useCreateGardenStore.getState().nextStep();
  });
  expect(useCreateGardenStore.getState().currentStep).toBe(1);
});
```

#### When to Use Which Middleware

| Middleware | Use When |
|-----------|----------|
| `persist` | State must survive page refresh (drafts, preferences) |
| `devtools` | Development debugging (Redux DevTools integration) |
| `immer` | Deep nested state updates (avoid in Green Goods — prefer flat state) |

### Hook Boundary Rule

**All state hooks MUST be in `@green-goods/shared`:**

```typescript
// Correct: Import from shared
import { useAuth, useGardens, useUIStore } from "@green-goods/shared";

// Wrong: Define hooks in client/admin
export function useLocalState() { /* ... */ }
```

---

## Part 2: Component Composition

**Core principle:** Composition over configuration. Compose from smaller pieces, use explicit variants (not boolean props), use providers to avoid prop drilling.

### State Encapsulation in Providers (Green Goods Pattern)

```typescript
// Bad: State leaked to consumers
function ParentComponent() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("");
  return <ItemList items={items} setItems={setItems} filter={filter} />;
}

// Good: State encapsulated in provider
function ItemListProvider({ children }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("");

  const filteredItems = useMemo(
    () => items.filter(i => i.name.includes(filter)),
    [items, filter]
  );

  return (
    <ItemListContext value={{ items: filteredItems, setFilter }}>
      {children}
    </ItemListContext>
  );
}
```

### React 19 — When to Use vs Existing Patterns

Green Goods runs **React 19**.

| Task | React 19 | Existing |
|------|----------|----------|
| Read context | `use(Context)` | `useContext(Context)` — both work |
| Form submission | `useActionState` | React Hook Form + Zod (preferred for validation) |
| Optimistic UI | `useOptimistic` | Manual state + rollback |
| Async data | `use(promise)` + Suspense | TanStack Query (preferred for caching) |
| Ref cleanup | Return cleanup from ref callback | `useEffect` cleanup |

**Note:** TanStack Query remains the primary data fetching solution (caching, invalidation, offline). Use `use()` for simple one-shot reads where Query is overkill.

---

## Part 3: React Compiler & Memoization

> For full React Compiler integration details, see [compiler.md](./compiler.md)

Green Goods uses `babel-plugin-react-compiler` in both `client` and `admin` Vite configs. The compiler **automatically memoizes** components, hooks, and expressions -- eliminating most manual `useMemo`, `useCallback`, and `React.memo` usage.

**Key rules:**
- Don't add `useMemo`, `useCallback`, or `React.memo` by default -- the compiler handles it
- Manual memoization still needed for: values passed to non-React APIs, shared hooks consumed across apps, and query key stability
- Hooks in `@green-goods/shared` may still benefit from manual memoization (compiler optimizes per-app build)
- When in doubt, profile first with React DevTools Profiler

---

## Part 4: Performance Optimization

> For detailed performance patterns, bundle budgets, Web Vitals, memory management, and list virtualization, see [performance.md](./performance.md)

**Critical rules:**
- Eliminate request waterfalls -- use `Promise.all` for independent fetches
- Use direct imports from large libraries (e.g., `import format from "date-fns/format"`)
- Dynamic import for below-fold content (`lazy(() => import(...))`)
- Use granular Zustand selectors, never subscribe to entire store
- Virtualize long lists (50+ items) with @tanstack/react-virtual
- CSS animations only (`transform`, `opacity`)
- Clean up blob URLs, event listeners, and AbortControllers on unmount
- Monitor Web Vitals (LCP < 2.5s, CLS < 0.1, INP < 200ms)

**Bundle Budgets:** Main < 150KB, per-route < 50KB, total JS < 400KB (gzipped)

---

## Quick Reference

**Before committing:** No serial awaits (use `Promise.all`), dynamic imports for below-fold, direct imports from large libs, stable query keys (`queryKeys` helper), long lists virtualized (50+ items), CSS-only animations.

**Before designing a component:** Compose from smaller pieces, use explicit variants (not boolean props), use providers to avoid prop drilling, follow existing Green Goods patterns.

**State management:** Zustand for UI state, TanStack Query for server state, granular selectors only, all hooks in `@green-goods/shared`, forms via React Hook Form + Zod.

## Reference Files

- **[compiler.md](./compiler.md)** -- React 19 compiler, automatic memoization, opt-out patterns
- **[performance.md](./performance.md)** -- Bundle budgets, React Profiler, Web Vitals, memory management, list virtualization
- **[tanstack-query.md](./tanstack-query.md)** -- TanStack Query v5: query keys, mutations, optimistic updates, cache invalidation, offline patterns
- **[error-handling.md](./error-handling.md)** -- Error categorization, error boundaries, contract error parsing, retry patterns, toast service
- **[xstate.md](./xstate.md)** -- XState v5 state machines: actor model, React integration, guards, actions, testing

## Decision Tree

```text
What are you building?
|
+---> Component with local UI state? ---------> useState / useReducer
|                                                 See Part 1: State Management
|
+---> Component with shared state? -----------> Zustand with granular selectors
|                                                 See Part 1: Zustand Patterns
|
+---> Data fetching / server state? ----------> TanStack Query
|     |                                          See tanstack-query.md
|     +---> Simple fetch? --------------------> useQuery + queryKeys
|     +---> After mutation? ------------------> useMutation + queryInvalidation
|     +---> Optimistic update? ---------------> useMutation with onMutate
|     +---> Dependent data? ------------------> useQuery with enabled flag
|     +---> Paginated list? ------------------> useInfiniteQuery
|
+---> Multi-step workflow / complex flow? ----> XState state machine
|                                                See xstate.md
|
+---> Error handling? -----------------------> categorizeError + error boundaries
|     |                                          See error-handling.md
|     +---> Contract error? ------------------> parseContractError + USER_FRIENDLY_ERRORS
|     +---> Mutation error? ------------------> createMutationErrorHandler
|     +---> Network error? ------------------> Retry with backoff
|     +---> Component crash? -----------------> ErrorBoundary wrapper
|
+---> Performance issue? --------------------> Measure first, then optimize
|     |                                          See performance.md
|     +---> Bundle too large? ----------------> Code splitting + tree shaking
|     +---> Slow renders? -------------------> React Profiler + granular selectors
|     +---> Memory leak? --------------------> Blob URL / listener / timer cleanup
|     +---> Long list? ----------------------> @tanstack/react-virtual
|
+---> Memoization question? -----------------> Compiler handles most cases
                                                See compiler.md
```

## Anti-Patterns

- Creating hooks in `client` or `admin` instead of `shared`
- Selecting full Zustand state (`state => state`) in UI components
- Introducing query waterfalls when data can be prefetched in parallel
- Using deep imports from `@green-goods/shared/*` instead of barrel imports
- Memoizing trivial values without measured performance impact
- Swallowing errors with empty `catch {}` blocks
- Using XState for simple toggles (use `useState`)
- Using v4 TanStack Query syntax (array keys, query callbacks)

## Related Skills

- `data-layer` — Offline indicators and sync state that integrate with React components
- `architecture` — Clean Architecture and composition patterns for React
- `testing` — Vitest and React Testing Library patterns for component tests
- `ui` (storybook sub-file) — Component documentation and visual testing
- `ui` (compliance sub-file) — WCAG accessibility, responsive design, and i18n for React components
- `ui` — Visual design direction and aesthetic choices for React UIs
