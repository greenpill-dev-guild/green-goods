---
name: react
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

### React 19: use() Instead of useContext()

```typescript
// Old pattern
import { useContext } from "react";
const value = useContext(MyContext);

// React 19 pattern
import { use } from "react";
const value = use(MyContext);
```

---

## Part 3: Performance Optimization

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

**When to use memoization:**
- `useMemo`: For expensive computations (not primitives)
- `useCallback`: Only when passed to memoized children
- `React.memo`: For list items and stable-prop components

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
- Don't store derived data — Compute it with `useMemo()`
- Don't use boolean props — Use explicit variants
- Don't chain useMemo — Combine into single useMemo
