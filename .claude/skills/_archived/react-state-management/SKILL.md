---
name: react-state-management
description: Modern React state management with Zustand, Redux Toolkit, Jotai, and React Query. Use when setting up state, choosing solutions, or debugging state issues.
---

# React State Management

Comprehensive guide to modern React state management patterns.

## When to Use

- Setting up global state
- Choosing between Zustand, Redux Toolkit, or Jotai
- Managing server state with React Query
- Implementing optimistic updates
- Debugging state issues

## State Categories

| Type | Description | Solutions |
|------|-------------|-----------|
| **Local State** | Component-specific UI | useState, useReducer |
| **Global State** | Shared across components | Zustand (Green Goods default) |
| **Server State** | Remote data, caching | TanStack Query |
| **URL State** | Route params, search | React Router |
| **Form State** | Input values, validation | React Hook Form + Zod |
| **Complex Flows** | Multi-step workflows, state machines | XState (Green Goods `workflows/`) |

## Selection Criteria

```
Small app, simple state     → Zustand
Large app, complex state    → Redux Toolkit
Heavy server interaction    → React Query + light client state
Atomic/granular updates     → Jotai
```

**Green Goods uses:** Zustand + TanStack Query

## Zustand Patterns

### Basic Store

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

### Granular Selectors (Architectural Rule #6)

```typescript
// ❌ Bad: Subscribes to entire store, re-renders on any change
const state = useAppStore();

// ✅ Good: Subscribes only to what's needed
const user = useAppStore((state) => state.user);
const theme = useAppStore((state) => state.theme);

// ✅ Better: Export selector hooks
export const useUser = () => useAppStore((state) => state.user);
export const useTheme = () => useAppStore((state) => state.theme);
```

### Slice Pattern (Scalable)

```typescript
// packages/shared/src/stores/slices/userSlice.ts
import { StateCreator } from "zustand";

export interface UserSlice {
  user: User | null;
  isAuthenticated: boolean;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => void;
}

export const createUserSlice: StateCreator<
  UserSlice & CartSlice,  // Combined store type
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
  logout: () => {
    set({ user: null, isAuthenticated: false });
  },
});

// packages/shared/src/stores/index.ts
import { create } from "zustand";
import { createUserSlice, UserSlice } from "./slices/userSlice";
import { createUiSlice, UiSlice } from "./slices/uiSlice";

type StoreState = UserSlice & UiSlice;

export const useStore = create<StoreState>()((...args) => ({
  ...createUserSlice(...args),
  ...createUiSlice(...args),
}));
```

## Combining Client + Server State

```typescript
// Zustand for UI state
const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  modal: null,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),
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

## Green Goods State Architecture

### Where State Lives

| State Type | Location | Example |
|------------|----------|---------|
| **Auth state** | Zustand store | `useAuthStore()` |
| **UI state** | Zustand store | `useUIStore()` |
| **Server data** | TanStack Query | `useGardens()`, `useWork()` |
| **Form state** | React Hook Form | `useForm()` |
| **Offline queue** | IndexedDB + Zustand | `useJobQueue()` |

### Hook Boundary Rule

All state hooks MUST be in `@green-goods/shared`:

```typescript
// ✅ Correct: Import from shared
import { useAuth, useGardens, useUIStore } from "@green-goods/shared";

// ❌ Wrong: Define hooks in client/admin
export function useLocalState() { /* ... */ }
```

## Best Practices

### Do's

- **Colocate state** — Keep state close to where it's used
- **Use selectors** — Prevent unnecessary re-renders
- **Normalize data** — Flatten nested structures
- **Type everything** — Full TypeScript coverage
- **Separate concerns** — Server state (Query) vs client state (Zustand)

### Don'ts

- **Don't over-globalize** — Not everything needs global state
- **Don't duplicate server state** — Let React Query manage it
- **Don't mutate directly** — Use Zustand's `set()`
- **Don't store derived data** — Compute it with `useMemo()`

## Common Patterns

### Optimistic Updates

```typescript
const mutation = useMutation({
  mutationFn: updateGarden,
  onMutate: async (newGarden) => {
    await queryClient.cancelQueries({ queryKey: queryKeys.gardens.detail(newGarden.address) });
    const previous = queryClient.getQueryData(queryKeys.gardens.detail(newGarden.address));
    queryClient.setQueryData(queryKeys.gardens.detail(newGarden.address), newGarden);
    return { previous };
  },
  onError: (err, newGarden, context) => {
    queryClient.setQueryData(
      queryKeys.gardens.detail(newGarden.address),
      context?.previous
    );
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.gardens.all });
  },
});
```

### Persisted State

```typescript
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: "en",
      notifications: true,
      setLanguage: (language) => set({ language }),
      toggleNotifications: () => set((s) => ({ notifications: !s.notifications })),
    }),
    {
      name: "settings-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
```
