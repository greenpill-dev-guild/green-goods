---
name: react
user-invocable: false
description: React patterns - state management (Zustand, Query), composition, performance. Use for components, state, hooks, optimization.
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

| Type | Description | Solutions |
|------|-------------|-----------|
| **Local State** | Component-specific UI | useState, useReducer |
| **Global State** | Shared across components | Zustand (Green Goods default) |
| **Server State** | Remote data, caching | TanStack Query |
| **URL State** | Route params, search | React Router |
| **Form State** | Input values, validation | React Hook Form + Zod |
| **Complex Flows** | Multi-step workflows, state machines | XState (Green Goods workflows/) |

**Green Goods uses:** Zustand + XState + TanStack Query

### Zustand Patterns

#### Basic Store

```typescript
// packages/shared/src/stores/appStore.ts
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface AppState {
  user: User | null;
  theme: "light" | "dark";
  setUser: (user: User | null) => void;
  toggleTheme: () => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        theme: "light",
        setUser: (user) => set({ user }),
        toggleTheme: () =>
          set((state) => ({
            theme: state.theme === "light" ? "dark" : "light",
          })),
      }),
      { name: "app-storage" }
    )
  )
);
```

#### Granular Selectors (Prevent Re-renders)

```typescript
// Bad: Subscribes to entire store, re-renders on any change
const state = useAppStore();

// Good: Subscribes only to what's needed
const user = useAppStore((state) => state.user);
const theme = useAppStore((state) => state.theme);

// Better: Export selector hooks
export const useUser = () => useAppStore((state) => state.user);
export const useTheme = () => useAppStore((state) => state.theme);
```

#### Slice Pattern (Scalable)

```typescript
import { StateCreator } from "zustand";

export interface UserSlice {
  user: User | null;
  isAuthenticated: boolean;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => void;
}

export const createUserSlice: StateCreator<
  UserSlice & UiSlice,
  [],
  [],
  UserSlice
> = (set, get) => ({
  user: null,
  isAuthenticated: false,
  login: async (credentials) => {
    const user = await authApi.login(credentials);
    set({ user, isAuthenticated: true });
  },
  logout: () => set({ user: null, isAuthenticated: false }),
});
```

### Combining Client + Server State

```typescript
// Zustand for UI state
const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));

// React Query for server state
function Dashboard() {
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const { data: gardens } = useQuery({
    queryKey: queryKeys.gardens.list(chainId),
    queryFn: fetchGardens,
  });

  return (
    <div className={sidebarOpen ? "with-sidebar" : ""}>
      <Sidebar open={sidebarOpen} onToggle={toggleSidebar} />
      <GardenList gardens={gardens} />
    </div>
  );
}
```

### Advanced Zustand Patterns

#### Persist Middleware

Green Goods stores use `persist` for offline state survival:

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      debugMode: false,
      isOfflineBannerVisible: false,
      toggleDebug: () => set((s) => ({ debugMode: !s.debugMode })),
    }),
    {
      name: "green-goods:debug-mode", // localStorage key
      partialize: (state) => ({ debugMode: state.debugMode }), // Only persist specific fields
    }
  )
);
```

**`partialize` is critical** — without it, transient UI state (modals, banners) gets persisted and restored on refresh, causing stale UI.

#### Multi-Step Form Store

Complex wizard stores (like `useCreateGardenStore`) manage step progression:

```typescript
export const useCreateGardenStore = create<CreateGardenState>()(
  persist(
    (set, get) => ({
      form: initialFormState,
      currentStep: 0,

      setField: (key, value) =>
        set((s) => ({ form: { ...s.form, [key]: value } })),

      nextStep: () => {
        const { currentStep, isStepValid } = get();
        if (isStepValid(currentStep)) {
          set({ currentStep: currentStep + 1 });
        }
      },

      // Derived validation — computed from state, not stored
      isStepValid: (stepId) => {
        const { form } = get();
        switch (stepId) {
          case 0: return form.name.length > 0;
          case 1: return form.operators.length > 0;
          default: return true;
        }
      },

      reset: () => set({ form: initialFormState, currentStep: 0 }),
    }),
    { name: "green-goods:create-garden" }
  )
);
```

#### Store Testing

```typescript
import { act } from "@testing-library/react";
import { useCreateGardenStore } from "@green-goods/shared";

beforeEach(() => {
  // Reset store between tests
  act(() => useCreateGardenStore.getState().reset());
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

### Core Principle

> **Composition over configuration** — Instead of adding props to customize behavior, compose smaller specialized components.

### Avoid Boolean Prop Explosion

```typescript
// Bad: Boolean prop explosion
<Button primary large withIcon loading disabled outlined />

// Good: Composition + explicit variants
<Button variant="primary" size="lg">
  <Button.Icon name="save" />
  <Button.Text>Save</Button.Text>
</Button>
```

### Compound Components

```typescript
// Good: Compound component pattern
<Card>
  <Card.Header>
    <Card.Title>Garden Details</Card.Title>
  </Card.Header>
  <Card.Content>
    {/* Content */}
  </Card.Content>
  <Card.Footer>
    <Card.Actions>
      <Button>Edit</Button>
    </Card.Actions>
  </Card.Footer>
</Card>
```

### State Encapsulation in Providers

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

### Explicit Variants Over Boolean Modes

```typescript
// Bad: Boolean mode
<Input error={true} />
<Input success={true} />

// Good: Explicit variant
<Input variant="error" />
<Input variant="success" />
```

### React 19 Patterns

Green Goods runs **React 19**. Use these new APIs:

#### `use()` for Context and Promises

```typescript
import { Suspense, use, useMemo } from "react";

// Replace useContext
const value = use(MyContext);

// Read a promise (suspends until resolved)
function GardenDetails({ gardenPromise }: { gardenPromise: Promise<Garden> }) {
  const garden = use(gardenPromise); // Suspends component
  return <h1>{garden.name}</h1>;
}

// Create the promise once per id, outside JSX
function GardenDetailsContainer({ id }: { id: string }) {
  const gardenPromise = useMemo(() => fetchGarden(id), [id]);

  return (
    <Suspense fallback={<Skeleton />}>
      <GardenDetails gardenPromise={gardenPromise} />
    </Suspense>
  );
}
```

#### `useActionState()` for Form Actions

```typescript
import { useActionState } from "react";

function JoinGardenForm({ gardenAddress }: { gardenAddress: Address }) {
  const [state, submitAction, isPending] = useActionState(
    async (prevState: FormState, formData: FormData) => {
      const result = await joinGarden(gardenAddress, formData);
      if (!result.success) return { error: result.message };
      return { success: true };
    },
    { error: null, success: false }
  );

  return (
    <form action={submitAction}>
      <input name="role" />
      <button disabled={isPending}>
        {isPending ? "Joining..." : "Join Garden"}
      </button>
      {state.error && <p className="text-destructive">{state.error}</p>}
    </form>
  );
}
```

#### `useOptimistic()` for Instant UI Feedback

```typescript
import { useOptimistic } from "react";

function WorkApprovalList({ approvals }: { approvals: WorkApproval[] }) {
  const [optimisticApprovals, addOptimistic] = useOptimistic(
    approvals,
    (current, newApproval: WorkApproval) => [...current, newApproval]
  );

  const handleApprove = async (work: Work) => {
    // Show immediately in UI
    addOptimistic({ ...work, status: "approved", approvedAt: Date.now() });
    // Then sync via job queue
    await addJob({ kind: JobKind.APPROVAL, payload: { workUID: work.uid } });
  };

  return optimisticApprovals.map((a) => <ApprovalCard key={a.uid} approval={a} />);
}
```

#### Ref Cleanup Functions (New in 19)

```typescript
// React 19: ref callbacks can return a cleanup function
function VideoPlayer() {
  return (
    <video
      ref={(node) => {
        if (node) {
          node.play();
          // Cleanup runs when ref detaches
          return () => node.pause();
        }
      }}
    />
  );
}

// Useful for event listeners on ref'd elements
<div
  ref={(node) => {
    if (!node) return;
    const handler = (e: Event) => { /* ... */ };
    node.addEventListener("scroll", handler);
    return () => node.removeEventListener("scroll", handler);
  }}
/>
```

#### When to Use React 19 vs Existing Patterns

| Task | React 19 | Existing |
|------|----------|----------|
| Read context | `use(Context)` | `useContext(Context)` — both work |
| Form submission | `useActionState` | React Hook Form + Zod (preferred for validation) |
| Optimistic UI | `useOptimistic` | Manual state + rollback |
| Async data | `use(promise)` + Suspense | TanStack Query (preferred for caching) |
| Ref cleanup | Return cleanup from ref callback | `useEffect` cleanup |

**Note:** For Green Goods, TanStack Query remains the primary data fetching solution (caching, invalidation, offline). Use `use()` for simple one-shot reads where Query is overkill.

---

## Part 3: React Compiler & Memoization

### React Compiler is Enabled

Green Goods uses `babel-plugin-react-compiler` in both `client` and `admin` Vite configs. The compiler **automatically memoizes** components, hooks, and expressions — eliminating most manual `useMemo`, `useCallback`, and `React.memo` usage.

```typescript
// vite.config.ts (client + admin)
react({
  babel: {
    plugins: [["babel-plugin-react-compiler", {}]],
  },
})
```

### What the Compiler Handles Automatically

| Pattern | Manual Code | Compiler | Action |
|---------|------------|----------|--------|
| Memoizing a computation | `useMemo(() => expensive(x), [x])` | Auto-memoized | **Don't add useMemo** |
| Stabilizing a callback | `useCallback((e) => handler(e), [dep])` | Auto-memoized | **Don't add useCallback** |
| Preventing child re-renders | `React.memo(Child)` | Auto-skipped | **Don't add React.memo** |
| Object literals in JSX | `style={{ color: 'red' }}` | Auto-memoized | **Don't wrap in useMemo** |

### When Manual Memoization is STILL Needed

The compiler cannot optimize everything. Use manual memoization for:

```typescript
// 1. Values passed to non-React APIs (third-party libraries, Web APIs)
const config = useMemo(() => buildConfig(data), [data]);
thirdPartyLib.init(config); // Compiler can't track external consumption

// 2. Expensive computations in custom hooks consumed by multiple components
// The compiler optimizes per-component, not across component boundaries
export function useFilteredGardens(gardens: Garden[], filters: Filters) {
  return useMemo(
    () => gardens.filter(g => matchesFilters(g, filters)),
    [gardens, filters]
  );
}

// 3. Query key stability (TanStack Query compares by reference)
// The compiler may not stabilize objects used as query keys
const queryKey = useMemo(() => queryKeys.gardens.list(chainId), [chainId]);
```

### Reconciliation with Architectural Rules

**Rules 9 and 10** (chained useMemo, context provider values) are still valid principles, but the compiler handles most cases:

| Rule | With Compiler | Guidance |
|------|--------------|----------|
| **Rule 9** (Chained useMemo) | Compiler auto-combines | Don't manually combine unless debugging perf |
| **Rule 10** (Context Provider values) | Compiler auto-memoizes | Don't wrap in useMemo unless provider is in shared package consumed externally |

### Anti-Patterns with the Compiler

```typescript
// ❌ Don't: Add useMemo/useCallback "just in case"
const memoized = useMemo(() => items.map(transform), [items]);
// The compiler already handles this — the useMemo is redundant noise

// ✅ Do: Write plain code and let the compiler optimize
const transformed = items.map(transform);

// ❌ Don't: Wrap components in React.memo by default
export default React.memo(GardenCard);
// The compiler already skips re-renders when props haven't changed

// ✅ Do: Export components directly
export default GardenCard;
```

### When to Profile Before Memoizing

If you suspect a performance issue:

1. **Use React DevTools Profiler** — identify which components re-render
2. **Check the compiler output** — `npx react-compiler-healthcheck` validates the compiler is working
3. **Only then** add manual optimization if the compiler misses something

### Shared Package Exception

Hooks in `@green-goods/shared` may still benefit from manual memoization because:
- They're consumed by both `client` and `admin` (compiler optimizes per-app build)
- Complex derived state in hooks should be explicitly memoized for clarity
- Query keys should use the `queryKeys` helper for guaranteed stability

---

## Part 4: Performance Optimization

### CRITICAL: Eliminating Waterfalls

**The #1 performance killer in React apps.**

```typescript
// Bad: Waterfall
const user = await getUser();
const posts = await getPosts(user.id);

// Good: Parallel where possible
const [user, recentPosts] = await Promise.all([
  getUser(),
  getRecentPosts()
]);
```

### CRITICAL: Bundle Size Optimization

**Every KB matters for mobile-first PWA.**

```typescript
// Bad: Imports entire library
import { format } from "date-fns";

// Good: Direct import
import format from "date-fns/format";

// Good: Dynamic import for heavy components
const HeavyChart = lazy(() => import("./HeavyChart"));
```

**Bundle Budgets (Green Goods):**
- Main bundle: < 150KB gzipped
- Per-route chunk: < 50KB gzipped
- Total JS: < 400KB gzipped

### MEDIUM: Re-render Optimization

```typescript
// Bad: Entire store causes re-renders
const state = useAppStore();

// Good: Granular selector (Architectural Rule #6)
const gardens = useAppStore((state) => state.gardens);
```

**When to use memoization (with React Compiler active):**
- The compiler handles most cases automatically (see Part 3)
- Manual `useMemo`: Only for values passed to non-React APIs or shared hooks
- Manual `useCallback`: Only when debugging a specific re-render issue
- `React.memo`: Almost never needed — compiler auto-skips unchanged props

### MEDIUM: Rendering Performance

- **CSS > JS for animations** — `transform` and `opacity` only
- **Virtualize long lists** — @tanstack/react-virtual for 50+ items
- **Avoid layout thrashing** — Batch DOM reads/writes
- **Hydration-safe code** — Match server and client renders

### Query Key Stability

```typescript
// Good: Use queryKeys helper for stable keys
import { queryKeys } from "@green-goods/shared";

useQuery({
  queryKey: queryKeys.gardens.list(chainId),
  queryFn: fetchGardens,
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

---

## Quick Reference Checklist

### Before Committing React Code

- [ ] No serial awaits that could be parallel
- [ ] Dynamic imports for below-fold content
- [ ] Direct imports from large libraries
- [ ] Memoization only where justified
- [ ] Query keys are stable (use `queryKeys` helper)
- [ ] Long lists virtualized (50+ items)
- [ ] Animations use transform/opacity only

### Before Designing a Component

- [ ] Can this be composed from smaller pieces?
- [ ] Are there boolean props that should be variants?
- [ ] Is state being drilled through multiple levels?
- [ ] Would a provider simplify the API?
- [ ] Does this follow existing Green Goods patterns?

### State Management Checklist

- [ ] Is this UI state (Zustand) or server state (Query)?
- [ ] Using granular selectors, not entire store?
- [ ] Hook defined in `@green-goods/shared`?
- [ ] Form state using React Hook Form + Zod?

---

## Best Practices Summary

### Do's

- Colocate state — Keep state close to where it's used
- Use selectors — Prevent unnecessary re-renders
- Normalize data — Flatten nested structures
- Type everything — Full TypeScript coverage
- Separate concerns — Server state (Query) vs client state (Zustand)
- Prefer composition — Smaller components over prop-heavy ones

### Don'ts

- Don't over-globalize — Not everything needs global state
- Don't duplicate server state — Let React Query manage it
- Don't mutate directly — Use Zustand's `set()`
- Don't store derived data — Compute it inline (compiler memoizes automatically)
- Don't use boolean props — Use explicit variants
- Don't add useMemo/useCallback/React.memo by default — React Compiler handles it (see Part 3)

## Anti-Patterns

- Creating hooks in `client` or `admin` instead of `shared`
- Selecting full Zustand state (`state => state`) in UI components
- Introducing query waterfalls when data can be prefetched in parallel
- Using deep imports from `@green-goods/shared/*` instead of barrel imports
- Memoizing trivial values without measured performance impact

## Related Skills

- `tanstack-query` — Server state management that complements React's local state patterns
- `data-layer` — Offline indicators and sync state that integrate with React components
- `architecture` — Clean Architecture and composition patterns for React
- `testing` — Vitest and React Testing Library patterns for component tests
- `performance` — React Profiler, re-render optimization, and bundle analysis
- `storybook` — Component documentation and visual testing
- `ui-compliance` — WCAG accessibility, responsive design, and i18n for React components
- `frontend-design:frontend-design` — Visual design direction and aesthetic choices for React UIs
