# React Best Practices Skill

Performance optimization guidance for React development with 27 rules across 8 categories.

**Source**: [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices)

---

## Activation

| Trigger | When to Apply |
|---------|---------------|
| Writing React components | Check rendering/memoization rules |
| Implementing data fetching | Check waterfall/deduplication rules |
| Performance optimization | Full audit against all categories |
| Bundle size concerns | Check import/dynamic loading rules |
| Code review | Reference during Pass 1-4 |

## Rule Categories (By Priority)

### CRITICAL: Eliminating Waterfalls

**The #1 performance killer in React apps.**

1. **Move await into branches** — Don't await before conditional logic
2. **Use Promise.all** — Parallelize independent async operations
3. **Suspense boundaries** — Fetch data at component level, not parent
4. **Avoid serial fetches** — Don't chain dependent requests unnecessarily

```typescript
// ❌ Waterfall
const user = await getUser();
const posts = await getPosts(user.id);

// ✅ Parallel where possible
const [user, recentPosts] = await Promise.all([
  getUser(),
  getRecentPosts()
]);
```

### CRITICAL: Bundle Size Optimization

**Every KB matters for mobile-first PWA.**

5. **Direct imports** — Import only what you need from libraries
6. **Dynamic imports** — Lazy load below-fold components
7. **Defer third-party scripts** — Non-essential scripts load after hydration
8. **Tree-shake properly** — Use ES modules, avoid barrel re-exports of large libs

```typescript
// ❌ Imports entire library
import { format } from "date-fns";

// ✅ Direct import
import format from "date-fns/format";

// ✅ Dynamic import for heavy components
const HeavyChart = lazy(() => import("./HeavyChart"));
```

### HIGH: Server-Side Performance

9. **Cache expensive operations** — Use memoization for repeated computations
10. **Deduplicate requests** — TanStack Query handles this automatically
11. **Serialize efficiently** — Avoid sending unnecessary data to client

### MEDIUM-HIGH: Client-Side Data Fetching

12. **Request deduplication** — TanStack Query's `queryKey` handles this
13. **Stale-while-revalidate** — Show cached data while fetching fresh
14. **Optimistic updates** — Update UI before server confirms

```typescript
// ✅ Green Goods pattern — query keys ensure deduplication
import { queryKeys } from "@green-goods/shared";

useQuery({
  queryKey: queryKeys.gardens.list(chainId),
  queryFn: fetchGardens,
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

### MEDIUM: Re-render Optimization

15. **Granular state** — Split state to avoid unnecessary re-renders
16. **useMemo for expensive computations** — Not for primitives
17. **useCallback for stable callbacks** — Only when passed to memoized children
18. **React.memo sparingly** — For list items and stable-prop components

```typescript
// ❌ Entire store causes re-renders
const state = useAppStore();

// ✅ Granular selector (Green Goods Architectural Rule #6: Zustand Selectors)
const gardens = useAppStore((state) => state.gardens);
```

### MEDIUM: Rendering Performance

19. **CSS > JS for animations** — `transform` and `opacity` only
20. **Virtualize long lists** — @tanstack/react-virtual for 50+ items
21. **Avoid layout thrashing** — Batch DOM reads/writes
22. **Hydration-safe code** — Match server and client renders

### LOW-MEDIUM: JavaScript Performance

23. **Use Maps for lookups** — O(1) vs O(n) for arrays
24. **Avoid unnecessary iterations** — Combine map/filter when possible
25. **Early returns** — Exit loops early when found

### LOW: Advanced Patterns

26. **Event handler refs** — Avoid re-creating handlers in effects
27. **Initialization guards** — Prevent expensive re-computations

---

## Green Goods Integration

### Alignment with Architectural Rules

| Vercel Rule | Green Goods Rule | Notes |
|-------------|------------------|-------|
| Granular state | #6 Zustand selectors | Already enforced |
| Avoid chained deps | #9 Chained useMemo | Already enforced |
| Query key stability | #7 Serialized keys | Already enforced |

### When Cracked-Coder Uses This

Reference these rules during:

1. **PLAN phase** — Consider performance implications
2. **IMPLEMENT phase** — Apply specific rules
3. **VERIFY phase** — Check for violations

### Bundle Budgets (Green Goods)

Per CLAUDE.md:
- Main bundle: < 150KB gzipped
- Per-route chunk: < 50KB gzipped
- Total JS: < 400KB gzipped

---

## Quick Reference Checklist

Before committing React code:

- [ ] No serial awaits that could be parallel
- [ ] Dynamic imports for below-fold content
- [ ] Direct imports from large libraries
- [ ] Memoization only where justified
- [ ] Query keys are stable (use `queryKeys` helper)
- [ ] Long lists virtualized (50+ items)
- [ ] Animations use transform/opacity only

---

## Full Rules

For complete rules with examples, see:
- [AGENTS.md](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/AGENTS.md) — Compiled rules
- [rules/](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices/rules) — Individual rule files
