# React Compiler & Memoization

> Back to [SKILL.md](./SKILL.md)

## Table of Contents

- [Compiler is Enabled](#react-compiler-is-enabled)
- [What the Compiler Handles](#what-the-compiler-handles-automatically)
- [When Manual Memoization is Still Needed](#when-manual-memoization-is-still-needed)
- [Reconciliation with Architectural Rules](#reconciliation-with-architectural-rules)
- [Anti-Patterns with the Compiler](#anti-patterns-with-the-compiler)
- [When to Profile Before Memoizing](#when-to-profile-before-memoizing)
- [Shared Package Exception](#shared-package-exception)

---

## React Compiler is Enabled

Green Goods uses `babel-plugin-react-compiler` in both `client` and `admin` Vite configs. The compiler **automatically memoizes** components, hooks, and expressions -- eliminating most manual `useMemo`, `useCallback`, and `React.memo` usage.

```typescript
// vite.config.ts (client + admin)
react({
  babel: {
    plugins: [["babel-plugin-react-compiler", {}]],
  },
})
```

## What the Compiler Handles Automatically

| Pattern | Manual Code | Compiler | Action |
|---------|------------|----------|--------|
| Memoizing a computation | `useMemo(() => expensive(x), [x])` | Auto-memoized | **Don't add useMemo** |
| Stabilizing a callback | `useCallback((e) => handler(e), [dep])` | Auto-memoized | **Don't add useCallback** |
| Preventing child re-renders | `React.memo(Child)` | Auto-skipped | **Don't add React.memo** |
| Object literals in JSX | `style={{ color: 'red' }}` | Auto-memoized | **Don't wrap in useMemo** |

## When Manual Memoization is STILL Needed

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

## Reconciliation with Architectural Rules

**Rules 9 and 10** (chained useMemo, context provider values) are still valid principles, but the compiler handles most cases:

| Rule | With Compiler | Guidance |
|------|--------------|----------|
| **Rule 9** (Chained useMemo) | Compiler auto-combines | Don't manually combine unless debugging perf |
| **Rule 10** (Context Provider values) | Compiler auto-memoizes | Don't wrap in useMemo unless provider is in shared package consumed externally |

## Anti-Patterns with the Compiler

```typescript
// BAD: Add useMemo/useCallback "just in case"
const memoized = useMemo(() => items.map(transform), [items]);
// The compiler already handles this -- the useMemo is redundant noise

// GOOD: Write plain code and let the compiler optimize
const transformed = items.map(transform);

// BAD: Wrap components in React.memo by default
export default React.memo(GardenCard);
// The compiler already skips re-renders when props haven't changed

// GOOD: Export components directly
export default GardenCard;
```

## When to Profile Before Memoizing

If you suspect a performance issue:

1. **Use React DevTools Profiler** -- identify which components re-render
2. **Check the compiler output** -- `npx react-compiler-healthcheck` validates the compiler is working
3. **Only then** add manual optimization if the compiler misses something

## Shared Package Exception

Hooks in `@green-goods/shared` may still benefit from manual memoization because:
- They're consumed by both `client` and `admin` (compiler optimizes per-app build)
- Complex derived state in hooks should be explicitly memoized for clarity
- Query keys should use the `queryKeys` helper for guaranteed stability
