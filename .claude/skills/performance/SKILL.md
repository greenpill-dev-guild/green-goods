---
name: performance
user-invocable: false
description: Performance profiling and optimization - bundle analysis, Lighthouse CI, React Profiler, memory leaks, service worker cache efficiency. Use for performance investigations, optimization, and budget enforcement.
version: "1.0.0"
status: active
packages: ["shared", "client", "admin"]
dependencies: []
last_updated: "2026-02-19"
last_verified: "2026-02-19"
---

# Performance Skill

Performance profiling and optimization guide: bundle analysis, runtime profiling, memory management, and monitoring.

---

## Activation

When invoked:
- Identify the performance layer (bundle size, runtime, memory, network).
- Measure before optimizing — never optimize without data.
- Check bundle budgets from CLAUDE.md before adding dependencies.

## Part 1: Bundle Budgets

### Green Goods Limits

| Target | Budget | Check |
|--------|--------|-------|
| Main bundle | < 150KB gzipped | `bun run build && ls -la dist/assets/` |
| Per-route chunk | < 50KB gzipped | Vite code splitting |
| Total JS | < 400KB gzipped | `bun run build` output |

### Bundle Analysis

```bash
# Analyze bundle composition
cd packages/client
ANALYZE=true bun build

# Or use vite-bundle-visualizer
npx vite-bundle-visualizer
```

### Code Splitting Strategy

```typescript
// Route-level splitting (automatic with React Router lazy)
const GardenView = lazy(() => import("./views/GardenView"));
const AdminDashboard = lazy(() => import("./views/AdminDashboard"));

// Component-level splitting (for heavy components)
const MapView = lazy(() => import("./components/MapView"));
const ChartWidget = lazy(() => import("./components/ChartWidget"));

// Always wrap lazy components in Suspense
<Suspense fallback={<Skeleton />}>
  <GardenView />
</Suspense>
```

### Dependency Impact Check

Before adding any dependency:

```bash
# Check package size
npx bundlephobia <package-name>

# Or check locally after adding
bun build 2>&1 | grep "chunk size"
```

| Category | Max Size | Examples |
|----------|----------|---------|
| UI library | < 20KB | Radix primitives (~3KB each) |
| Utility | < 10KB | date-fns (tree-shakeable) |
| Web3 | < 50KB | Wagmi + Viem (tree-shakeable) |
| State | < 5KB | Zustand (~1KB) |

### Tree Shaking

```typescript
// ✅ GOOD: Named imports allow tree shaking
import { formatEther } from "viem";
import { useAccount } from "wagmi";

// ❌ BAD: Barrel re-export may prevent tree shaking for large libs
import * as viem from "viem";

// ✅ GOOD: Direct path imports for large libraries
import format from "date-fns/format";

// ❌ BAD: Top-level import pulls entire library
import { format } from "date-fns";
```

## Part 2: Runtime Profiling

### React Profiler

```typescript
import { Profiler } from "react";

function onRenderCallback(
  id: string,
  phase: "mount" | "update",
  actualDuration: number,
  baseDuration: number,
) {
  if (actualDuration > 16) {
    // Longer than one frame (60fps)
    logger.warn("Slow render detected", {
      component: id,
      phase,
      actualDuration: `${actualDuration.toFixed(1)}ms`,
      baseDuration: `${baseDuration.toFixed(1)}ms`,
    });
  }
}

// Wrap suspect components
<Profiler id="GardenList" onRender={onRenderCallback}>
  <GardenList gardens={gardens} />
</Profiler>
```

### Identifying Re-render Causes

```typescript
// Debug hook: log what caused a re-render
function useWhyDidYouRender(componentName: string, props: Record<string, unknown>) {
  const previousProps = useRef(props);

  useEffect(() => {
    const changedProps = Object.entries(props).reduce<Record<string, { from: unknown; to: unknown }>>(
      (acc, [key, value]) => {
        if (previousProps.current[key] !== value) {
          acc[key] = { from: previousProps.current[key], to: value };
        }
        return acc;
      },
      {}
    );

    if (Object.keys(changedProps).length > 0) {
      logger.debug(`${componentName} re-rendered`, { changedProps });
    }

    previousProps.current = props;
  });
}
```

### Performance Marks

```typescript
// Mark critical operations
performance.mark("garden-load-start");
const gardens = await fetchGardens();
performance.mark("garden-load-end");
performance.measure("garden-load", "garden-load-start", "garden-load-end");

// Read measurements
const entries = performance.getEntriesByName("garden-load");
logger.info("Garden load time", { duration: entries[0]?.duration });
```

## Part 3: Web Vitals

### Core Metrics

| Metric | Good | Needs Work | Poor |
|--------|------|------------|------|
| **LCP** (Largest Contentful Paint) | < 2.5s | 2.5–4s | > 4s |
| **FID** (First Input Delay) | < 100ms | 100–300ms | > 300ms |
| **CLS** (Cumulative Layout Shift) | < 0.1 | 0.1–0.25 | > 0.25 |
| **INP** (Interaction to Next Paint) | < 200ms | 200–500ms | > 500ms |
| **TTFB** (Time to First Byte) | < 800ms | 800ms–1.8s | > 1.8s |

### Collecting Web Vitals

```typescript
// Use web-vitals library
import { onLCP, onFID, onCLS, onINP, onTTFB } from "web-vitals";

function reportWebVital(metric: { name: string; value: number; rating: string }) {
  logger.info("Web Vital", {
    name: metric.name,
    value: metric.value.toFixed(1),
    rating: metric.rating,
  });
}

onLCP(reportWebVital);
onFID(reportWebVital);
onCLS(reportWebVital);
onINP(reportWebVital);
onTTFB(reportWebVital);
```

### LCP Optimization

```typescript
// Preload critical images
<link rel="preload" href="/hero-image.webp" as="image" fetchPriority="high" />

// Explicit dimensions prevent layout shift
<img
  src={garden.coverImage}
  width={800}
  height={400}
  loading="eager"         // Above-fold: eager
  fetchPriority="high"    // LCP candidate
  alt={garden.name}
/>

// Below-fold images: lazy load
<img
  src={work.photo}
  loading="lazy"          // Below-fold: lazy
  width={400}
  height={300}
  alt={work.description}
/>
```

## Part 4: Memory Management

### Detecting Memory Leaks

Common leak sources in Green Goods:

| Source | Symptom | Fix |
|--------|---------|-----|
| Blob URLs not revoked | Memory grows with each photo | `mediaResourceManager.revokeObjectURL()` |
| Event listeners not removed | Memory grows on navigation | `useEventListener()` or `{ once: true }` |
| Timers not cleared | Callbacks fire after unmount | `useTimeout()` or `useDelayedInvalidation()` |
| Async state updates after unmount | React warnings | `useAsyncEffect()` with isMounted |
| Large IndexedDB cursors | Memory spike during iteration | Use pagination/limits |

### Blob URL Tracking

```typescript
import { mediaResourceManager } from "@green-goods/shared";

// Always track blob URLs
const url = mediaResourceManager.createObjectURL(file);

// Always revoke when done
mediaResourceManager.revokeObjectURL(url);

// Revoke all for a context (e.g., when form is abandoned)
mediaResourceManager.revokeAll(formId);

// Check for leaks in development
if (import.meta.env.DEV) {
  const activeUrls = mediaResourceManager.getActiveCount();
  if (activeUrls > 10) {
    logger.warn("Potential blob URL leak", { activeUrls });
  }
}
```

### AbortController Cleanup

```typescript
function useGardenSearch(query: string) {
  const [results, setResults] = useState<Garden[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    searchGardens(query, { signal: controller.signal })
      .then(setResults)
      .catch((error) => {
        if (error.name !== "AbortError") {
          logger.error("Search failed", { error });
        }
      });

    return () => controller.abort();
  }, [query]);

  return results;
}
```

## Part 5: List Performance

### Virtualization (50+ Items)

```typescript
import { useVirtualizer } from "@tanstack/react-virtual";

function GardenList({ gardens }: { gardens: Garden[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: gardens.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,  // Estimated row height
    overscan: 5,              // Render 5 extra items above/below
  });

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div
        style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: "absolute",
              top: 0,
              transform: `translateY(${virtualItem.start}px)`,
              width: "100%",
            }}
          >
            <GardenCard garden={gardens[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Memoization Guidelines

```typescript
// ✅ USE useMemo for:
// - Expensive computations (filtering, sorting large arrays)
const filteredGardens = useMemo(
  () => gardens.filter(g => g.status === "active").sort(byDistance),
  [gardens]
);

// ✅ USE useCallback for:
// - Callbacks passed to memoized children
const handleApprove = useCallback(
  (workId: string) => approveMutation.mutate(workId),
  [approveMutation]
);

// ✅ USE React.memo for:
// - List item components rendered many times
const GardenCard = React.memo(function GardenCard({ garden }: Props) {
  return <Card>{/* ... */}</Card>;
});

// ❌ DON'T memoize:
// - Primitives (strings, numbers, booleans)
// - Components that always re-render anyway
// - Cheap computations
```

## Part 6: Network Performance

### Request Deduplication

TanStack Query handles this automatically:

```typescript
// These two calls produce ONE network request
const { data: gardensA } = useQuery({
  queryKey: queryKeys.gardens.list(chainId),
  queryFn: fetchGardens,
});
const { data: gardensB } = useQuery({
  queryKey: queryKeys.gardens.list(chainId), // Same key = deduplicated
  queryFn: fetchGardens,
});
```

### Prefetching

```typescript
// Prefetch on hover for instant navigation
function GardenLink({ gardenAddress }: Props) {
  const queryClient = useQueryClient();

  const prefetch = () => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.gardens.detail(gardenAddress),
      queryFn: () => fetchGarden(gardenAddress),
      staleTime: 60_000,
    });
  };

  return (
    <Link to={`/garden/${gardenAddress}`} onMouseEnter={prefetch}>
      View Garden
    </Link>
  );
}
```

## Anti-Patterns

- **Never optimize without measuring first** — profile before changing code
- **Never add large dependencies without checking size** — use bundlephobia
- **Never forget to clean up blob URLs** — use mediaResourceManager
- **Never render 50+ items without virtualization** — use @tanstack/react-virtual
- **Never memoize primitives** — only expensive computations
- **Never use `import *`** — prevents tree shaking
- **Never set images without explicit dimensions** — causes CLS

## Quick Reference Checklist

### Performance Investigation

- [ ] Bundle size within budgets? (`bun build` output)
- [ ] Web Vitals in "good" range? (LCP < 2.5s, CLS < 0.1)
- [ ] No memory leaks? (blob URLs, listeners, timers cleaned up)
- [ ] Lists virtualized if 50+ items?
- [ ] Images have explicit width/height?
- [ ] Heavy components code-split with `lazy()`?
- [ ] No waterfall fetches? (parallel where possible)
- [ ] Memoization only where justified?

## Related Skills

- `react` — React-specific optimization (useMemo, useCallback, React.memo)
- `vite` — Bundle splitting and build optimization
- `data-layer` — Service worker cache efficiency
- `monitoring` — Runtime performance tracking
- `storybook` — Visual regression for performance-impacting changes
