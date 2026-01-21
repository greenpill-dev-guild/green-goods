# Superpower Zustand Skill

Standardized patterns for Zustand stores in Green Goods.

## Activation

Use when:
- Creating new Zustand stores
- Refactoring existing stores
- Adding persistence to stores
- Optimizing store performance

## Green Goods Store Pattern

Based on existing stores in `packages/shared/src/stores/`:

### Basic Structure

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

// Storage key naming convention
const STORAGE_KEY = "green-goods:[store-name]";

// Combined state and actions type
export type [StoreName]State = {
  // State properties
  someValue: string;
  isLoading: boolean;

  // Action methods
  setSomeValue: (value: string) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
};

export const use[StoreName]Store = create<[StoreName]State>()(
  persist(
    (set, get) => ({
      // Initial state
      someValue: "",
      isLoading: false,

      // Actions
      setSomeValue: (value) => set({ someValue: value }),
      setLoading: (loading) => set({ isLoading: loading }),
      reset: () => set({ someValue: "", isLoading: false }),
    }),
    {
      name: STORAGE_KEY,
      // Selective persistence
      partialize: (state) => ({
        someValue: state.someValue,
        // Don't persist isLoading
      }),
    }
  )
);
```

### Without Persistence

```typescript
import { create } from "zustand";

export type [StoreName]State = {
  value: string;
  setValue: (v: string) => void;
};

export const use[StoreName]Store = create<[StoreName]State>()((set) => ({
  value: "",
  setValue: (v) => set({ value: v }),
}));
```

### Computed Values Pattern

Use `get()` for computed values:

```typescript
export const useExampleStore = create<ExampleState>()((set, get) => ({
  items: [],
  filter: "",

  // Computed
  filteredItems: () => {
    const { items, filter } = get();
    return items.filter(item => item.includes(filter));
  },

  // Actions
  setFilter: (filter) => set({ filter }),
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
}));
```

### Async Actions Pattern

```typescript
export const useDataStore = create<DataState>()((set, get) => ({
  data: null,
  isLoading: false,
  error: null,

  fetchData: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/data/${id}`);
      const data = await response.json();
      set({ data, isLoading: false });
    } catch (error) {
      set({ error: error as Error, isLoading: false });
    }
  },
}));
```

## Green Goods Conventions

### Storage Key Format

```
green-goods:[store-name]
```

Examples:
- `green-goods:debug-mode`
- `green-goods:work-flow`
- `green-goods:create-garden`

### Store Location

**All stores MUST be in**: `packages/shared/src/stores/`

Never create stores in:
- `packages/client/`
- `packages/admin/`

### Naming Conventions

- File: `use[StoreName]Store.ts`
- Hook: `use[StoreName]Store`
- Type: `[StoreName]State`

### Selective Persistence

Use `partialize` to persist only necessary state:

```typescript
partialize: (state) => ({
  // Persist user preferences
  theme: state.theme,
  locale: state.locale,
  // Don't persist transient state
  // isLoading, error, etc.
})
```

## Existing Stores Reference

| Store | Purpose | Persisted |
|-------|---------|-----------|
| `useUIStore` | UI state (drawers, debug mode) | debugMode only |
| `useWorkFlowStore` | Work submission flow | Partial |
| `useCreateGardenStore` | Garden creation wizard | Form data |
| `useAdminStore` | Admin dashboard state | - |

## Non-React Access

For utilities/middleware that can't use hooks:

```typescript
// Get current state
const state = useExampleStore.getState();

// Update state
useExampleStore.setState({ value: "new" });

// Subscribe to changes
const unsubscribe = useExampleStore.subscribe(
  (state) => console.log("State changed:", state)
);
```

## Verification Checklist

When creating/modifying stores, verify:

- [ ] Store is in `packages/shared/src/stores/`
- [ ] Uses `green-goods:` storage key prefix
- [ ] Type includes all state and actions
- [ ] Persistence uses `partialize` appropriately
- [ ] No transient state persisted (loading, errors)
- [ ] Naming follows conventions

## Anti-Patterns to Avoid

- Stores outside shared package
- Persisting loading/error state
- Missing type definitions
- Direct state mutation (use set() or immer)
- Storage keys without `green-goods:` prefix
