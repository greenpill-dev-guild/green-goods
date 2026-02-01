# Composition Patterns Skill

React component architecture patterns emphasizing composition over configuration.

**Source**: [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/composition-patterns)

---

## Activation

| Trigger | When to Apply |
|---------|---------------|
| Building reusable components | Use compound component pattern |
| Props growing beyond 5-6 | Consider composition refactor |
| Boolean props accumulating | Split into variants or compound |
| State shared between siblings | Lift to provider |
| Designing component APIs | Reference architecture rules |

## Core Principle

> **Composition over configuration** — Instead of adding props to customize behavior, compose smaller specialized components.

---

## Pattern Categories (By Priority)

### HIGH: Component Architecture

**Avoid boolean prop proliferation.**

```typescript
// ❌ Boolean prop explosion
<Button
  primary
  large
  withIcon
  loading
  disabled
  outlined
/>

// ✅ Composition + explicit variants
<Button variant="primary" size="lg">
  <Button.Icon name="save" />
  <Button.Text>Save</Button.Text>
</Button>
```

**Compound components for complex UI:**

```typescript
// ✅ Compound component pattern (Green Goods uses this)
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

### MEDIUM: State Management

**For global state, prefer Zustand stores over Context/useState.**

```typescript
// ❌ State implementation leaked to consumers
function ParentComponent() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("");

  return (
    <ItemList
      items={items}
      setItems={setItems}
      filter={filter}
      setFilter={setFilter}
    />
  );
}

// ✅ Green Goods pattern: Zustand store with granular selectors
// packages/shared/src/stores/itemStore.ts
import { create } from "zustand";

interface ItemState {
  items: Item[];
  filter: string;
  setFilter: (filter: string) => void;
  addItem: (item: Item) => void;
}

export const useItemStore = create<ItemState>((set) => ({
  items: [],
  filter: "",
  setFilter: (filter) => set({ filter }),
  addItem: (item) => set((s) => ({ items: [...s.items, item] })),
}));

// Consumer uses granular selectors (Architectural Rule #6)
function ItemList() {
  const items = useItemStore((s) => s.items);
  const filter = useItemStore((s) => s.filter);
  const filteredItems = useMemo(
    () => items.filter(i => i.name.includes(filter)),
    [items, filter]
  );
  return filteredItems.map(item => <Item key={item.id} {...item} />);
}
```

**Generic interfaces for dependency injection:**

```typescript
// ✅ Provider doesn't know about specific implementations
interface StorageProvider {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<void>;
}

// Can swap IndexedDB, localStorage, or mock in tests
<StorageContext value={indexedDBStorage}>
  <App />
</StorageContext>
```

### MEDIUM: Implementation Patterns

**Explicit variants over boolean modes:**

```typescript
// ❌ Boolean mode
<Input error={true} />
<Input success={true} />

// ✅ Explicit variant
<Input variant="error" />
<Input variant="success" />

// ✅ Or specialized components
<ErrorInput />
<SuccessInput />
```

**Children over render props:**

```typescript
// ❌ Render prop (harder to read)
<List
  items={gardens}
  renderItem={(garden) => <GardenCard garden={garden} />}
/>

// ✅ Children composition (clearer)
<List items={gardens}>
  {(garden) => <GardenCard garden={garden} />}
</List>

// ✅ Or fully composed
<List>
  {gardens.map(garden => (
    <List.Item key={garden.address}>
      <GardenCard garden={garden} />
    </List.Item>
  ))}
</List>
```

### MEDIUM: React 19 APIs

**Use `use()` instead of `useContext()`:**

```typescript
// ❌ Old pattern
import { useContext } from "react";
const value = useContext(MyContext);

// ✅ React 19 pattern
import { use } from "react";
const value = use(MyContext);
```

**Note**: Green Goods uses React 19, so prefer `use()` for new code.

---

## Green Goods Integration

### Alignment with Existing Patterns

| Pattern | Green Goods Implementation |
|---------|---------------------------|
| Compound components | `@green-goods/shared/components/` |
| State in providers | `packages/shared/src/providers/` (context) |
| Global state | `packages/shared/src/stores/` (Zustand) |
| Generic interfaces | `AuthProvider`, `StorageProvider` |
| Hook boundary | All hooks in `@green-goods/shared` |

### When Cracked-Coder Uses This

Reference these patterns when:

1. **Designing new components** — Choose composition approach
2. **Refactoring prop-heavy components** — Apply compound pattern
3. **Adding shared state** — Prefer Zustand stores over Context for global state
4. **Building for Storybook** — Compound components are easier to test

### Example: Green Goods Card Pattern

```typescript
// packages/shared/src/components/cards/GardenCard.tsx
import { tv } from "tailwind-variants";

const cardStyles = tv({
  base: "rounded-lg border p-4",
  variants: {
    selected: {
      true: "border-primary bg-primary/5",
      false: "border-border hover:border-primary/50"
    }
  }
});

interface GardenCardProps {
  garden: Garden;
  selected?: boolean;
  onSelect?: (address: Address) => void;
}

export function GardenCard({ garden, selected, onSelect }: GardenCardProps) {
  return (
    <button
      onClick={() => onSelect?.(garden.address)}
      className={cardStyles({ selected })}
    >
      <GardenCard.Header garden={garden} />
      <GardenCard.Stats garden={garden} />
      <GardenCard.Actions garden={garden} />
    </button>
  );
}

// Compound subcomponents
GardenCard.Header = function Header({ garden }: { garden: Garden }) { /* ... */ };
GardenCard.Stats = function Stats({ garden }: { garden: Garden }) { /* ... */ };
GardenCard.Actions = function Actions({ garden }: { garden: Garden }) { /* ... */ };
```

---

## Quick Reference Checklist

Before designing a component:

- [ ] Can this be composed from smaller pieces?
- [ ] Are there boolean props that should be variants?
- [ ] Is state being drilled through multiple levels?
- [ ] Would a provider simplify the API?
- [ ] Does this follow existing Green Goods patterns?

---

## Full Rules

For complete rules with examples, see:
- [AGENTS.md](https://github.com/vercel-labs/agent-skills/blob/main/skills/composition-patterns/AGENTS.md) — Compiled rules
- [rules/](https://github.com/vercel-labs/agent-skills/tree/main/skills/composition-patterns/rules) — Individual rule files
