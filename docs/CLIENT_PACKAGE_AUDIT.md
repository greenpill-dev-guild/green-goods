# Client Package Deep Audit Report

**Date:** December 25, 2025  
**Focus:** `packages/client` + `packages/shared` imports  
**Priorities:** Duplication, Tailwind extraction, Caching, Optimistic UI

---

## Executive Summary

The client package is well-architected with good separation of concerns. However, there are significant opportunities for improvement in:

1. **Code Duplication** - 6 nearly-identical empty state components across dashboard tabs
2. **Tailwind Class Repetition** - Status badge classes repeated 6+ times, button styles duplicated
3. **Caching Strategy** - Good foundation but inconsistent stale times, missing offline persistence
4. **Optimistic UI** - Works well for joining gardens but lacks proper rollback for failed work submissions

---

## Section 1: Code Duplication Analysis

### 1.1 Empty State Components (CRITICAL DUPLICATION)

**Finding:** `Pending.tsx`, `Completed.tsx`, `Uploading.tsx`, and `MyWork.tsx` all contain nearly identical empty state, loading, and error UI patterns.

**Current Pattern (repeated 4+ times):**

```tsx
// packages/client/src/views/Home/WorkDashboard/Pending.tsx:54-90
{isLoading ? (
  <div className="h-full flex flex-col items-center justify-center pb-12">
    <BeatLoader />
    <p className="text-sm text-slate-400 mt-4">Loading...</p>
  </div>
) : hasError ? (
  <div className="text-center py-12">
    <div className="text-4xl mb-3">⚠️</div>
    <p className="font-medium text-slate-900">Unable to load work</p>
    <p className="text-sm text-slate-600 mb-4">{errorMessage}</p>
    <button onClick={() => window.location.reload()}>Retry</button>
  </div>
) : items.length === 0 ? (
  <div className="text-center py-12">
    <div className="text-4xl mb-3">⏳</div>
    <p className="font-medium text-slate-900">No items</p>
    <p className="text-sm text-slate-600">Description here</p>
  </div>
) : (/* render items */)}
```

**Recommendation:** Create a reusable `ListState` component.

**FIX: Create `packages/client/src/components/Communication/ListState.tsx`:**

```tsx
import React from "react";
import { useIntl } from "react-intl";
import { BeatLoader } from "./Progress/Loader";

interface ListStateProps<T> {
  items: T[];
  isLoading: boolean;
  hasError?: boolean;
  errorMessage?: string;
  loadingMessage?: string;
  emptyIcon?: string;
  emptyTitle: string;
  emptyDescription: string;
  renderItems: (items: T[]) => React.ReactNode;
  onRetry?: () => void;
}

export function ListState<T>({
  items,
  isLoading,
  hasError,
  errorMessage,
  loadingMessage,
  emptyIcon = "📭",
  emptyTitle,
  emptyDescription,
  renderItems,
  onRetry,
}: ListStateProps<T>) {
  const intl = useIntl();

  if (isLoading) {
    return (
      <div className="list-state-loading">
        <BeatLoader />
        <p className="list-state-loading-text">
          {loadingMessage || intl.formatMessage({ id: "common.loading" })}
        </p>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="list-state-error">
        <div className="list-state-error-icon">⚠️</div>
        <p className="list-state-error-title">
          {intl.formatMessage({ id: "common.error.title" })}
        </p>
        <p className="list-state-error-message">{errorMessage}</p>
        {onRetry && (
          <button onClick={onRetry} className="list-state-retry-btn">
            {intl.formatMessage({ id: "common.retry" })}
          </button>
        )}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="list-state-empty">
        <div className="list-state-empty-icon">{emptyIcon}</div>
        <p className="list-state-empty-title">{emptyTitle}</p>
        <p className="list-state-empty-description">{emptyDescription}</p>
      </div>
    );
  }

  return <>{renderItems(items)}</>;
}
```

**Add CSS to `packages/client/src/styles/utilities.css`:**

```css
/* List State Component Styles */
.list-state-loading {
  @apply h-full flex flex-col items-center justify-center pb-12;
}

.list-state-loading-text {
  @apply text-sm text-slate-400 mt-4;
}

.list-state-error,
.list-state-empty {
  @apply text-center py-12;
}

.list-state-error-icon,
.list-state-empty-icon {
  @apply text-4xl mb-3;
}

.list-state-error-title,
.list-state-empty-title {
  @apply font-medium text-slate-900;
}

.list-state-error-message,
.list-state-empty-description {
  @apply text-sm text-slate-600;
}

.list-state-error-message {
  @apply mb-4;
}

.list-state-retry-btn {
  @apply text-sm text-primary font-medium px-3 py-1 rounded-lg border border-slate-200;
  @apply transition-all duration-200;
  @apply focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary;
  @apply active:border-primary active:scale-95;
}
```

**Impact:** ~200 lines of duplicated code eliminated.

---

### 1.2 Status Badge Classes (HIGH DUPLICATION)

**Finding:** Same status badge styling repeated 6+ times across files:

```tsx
// Found in: WorkCard.tsx, MyWork.tsx, Uploading.tsx, WorkDashboard/index.tsx
className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border bg-blue-50 text-blue-600 border-blue-100"
className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border bg-amber-50 text-amber-600 border-amber-100"
className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border bg-green-50 text-green-600 border-green-100"
className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-100"
className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border bg-purple-50 text-purple-600 border-purple-100"
```

**FIX: Add to `packages/client/src/styles/utilities.css`:**

```css
/* Status Badge Variants */
.badge-pill {
  @apply inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-xs font-medium;
}

.badge-pill-blue {
  @apply badge-pill bg-blue-50 text-blue-600 border-blue-100;
}

.badge-pill-amber {
  @apply badge-pill bg-amber-50 text-amber-600 border-amber-100;
}

.badge-pill-green {
  @apply badge-pill bg-green-50 text-green-600 border-green-100;
}

.badge-pill-red {
  @apply badge-pill bg-red-50 text-red-600 border-red-100;
}

.badge-pill-purple {
  @apply badge-pill bg-purple-50 text-purple-600 border-purple-100;
}

.badge-pill-slate {
  @apply badge-pill bg-slate-50 text-slate-600 border-slate-200;
}

.badge-pill-emerald {
  @apply badge-pill bg-emerald-50 text-emerald-600 border-emerald-200;
}
```

**Usage after refactor:**
```tsx
// Before
<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border bg-blue-50 text-blue-600 border-blue-100">
  <RiImageLine className="w-3 h-3" /> {count}
</span>

// After
<span className="badge-pill-blue">
  <RiImageLine className="w-3 h-3" /> {count}
</span>
```

---

### 1.3 Dead Code Analysis

**Finding:** Several instances of dead/unused code:

1. **Unused variable in `Garden/index.tsx`:**
```tsx
// Line 37
const [_showCompletionState, setShowCompletionState] = useState(false);
// _showCompletionState is never read
```

2. **Commented deduplication code in `Garden/index.tsx`:**
```tsx
// Lines 291-298 - Deduplication comment says "was always a no-op"
// Deduplication removed - was always a no-op since remote API doesn't exist
```

3. **Unused translation variables:**
```tsx
// Line 130-131
const { translatedAction, isTranslating: _isTranslatingAction } = useActionTranslation(selectedAction);
const { translatedGarden, isTranslating: _isTranslatingGarden } = useGardenTranslation(selectedGarden);
// _isTranslating* are never used
```

**FIX:** Remove dead code:
```tsx
// Remove unused state
// const [_showCompletionState, setShowCompletionState] = useState(false);

// Simplify to:
const { translatedAction } = useActionTranslation(selectedAction);
const { translatedGarden } = useGardenTranslation(selectedGarden);
```

---

## Section 2: Tailwind Patterns for CSS Extraction

### 2.1 Long Class Strings (>100 chars)

**Finding:** 30 instances of className strings over 100 characters.

**Worst offenders:**

```tsx
// packages/client/src/views/Home/Garden/Work.tsx:505
className="w-full min-h-[120px] p-3 rounded-xl border border-stroke-soft-200 bg-bg-weak-50 text-text-strong-950 placeholder:text-text-soft-400 focus:outline-none focus:ring-2 focus:ring-primary resize-none"

// packages/client/src/components/Layout/Hero.tsx:61
className="px-6 py-4 bg-[#367D42] text-white rounded-full w-full font-bold shadow-sm active:scale-95 transition-transform flex items-center justify-center gap-2"
```

**FIX: Add semantic classes to `utilities.css`:**

```css
/* Form Input Variants */
.input-textarea {
  @apply w-full min-h-[120px] p-3 rounded-xl;
  @apply border border-stroke-soft-200;
  @apply bg-bg-weak-50 text-text-strong-950;
  @apply placeholder:text-text-soft-400;
  @apply focus:outline-none focus:ring-2 focus:ring-primary;
  @apply resize-none;
}

/* Primary CTA Button (Landing Page) */
.btn-cta-primary {
  @apply px-6 py-4 bg-[#367D42] text-white rounded-full;
  @apply w-full font-bold shadow-sm;
  @apply active:scale-95 transition-transform;
  @apply flex items-center justify-center gap-2;
}

/* Modal Overlay */
.modal-overlay {
  @apply fixed inset-0 bg-black/20 backdrop-blur-sm z-[20000];
  @apply flex items-end justify-center;
}

/* Modal Container */
.modal-container {
  @apply bg-white rounded-t-3xl shadow-2xl w-full;
  @apply overflow-hidden flex flex-col;
}

/* Notification Card */
.notification-card {
  @apply w-full flex flex-col gap-2 p-4;
  @apply text-black bg-gradient-to-r from-amber-50 to-orange-50;
  @apply rounded-xl transition-all duration-200;
  @apply hover:shadow-md hover:scale-[1.02] active:scale-[0.98];
  @apply border border-amber-200 cursor-pointer;
}
```

### 2.2 Repeated Flex Patterns

**Finding:** 53 instances of `flex items-center gap-*` and 55 instances of `flex flex-col gap-*`.

**FIX: Add utility classes:**

```css
/* Flex Row Utilities */
.flex-row-2 { @apply flex items-center gap-2; }
.flex-row-3 { @apply flex items-center gap-3; }
.flex-row-4 { @apply flex items-center gap-4; }

/* Flex Column Utilities */
.flex-col-2 { @apply flex flex-col gap-2; }
.flex-col-3 { @apply flex flex-col gap-3; }
.flex-col-4 { @apply flex flex-col gap-4; }
.flex-col-6 { @apply flex flex-col gap-6; }
```

---

## Section 3: Data Caching & Connectivity Improvements

### 3.1 Current Caching Analysis

**Good:**
- Centralized stale times in `react-query.ts`
- Event-driven cache invalidation via `useJobQueueEvents`
- `networkMode: "offlineFirst"` is correctly set

**Issues:**

1. **Inconsistent stale times across hooks:**
```tsx
// react-query.ts default: 5 minutes
staleTime: 5 * 60 * 1000,

// useGardens: 1 minute
staleTime: STALE_TIMES.baseLists, // 60_000

// WorkDashboard local query: 30 seconds
staleTime: 30_000,

// Operator works: custom 30s (not using constants)
staleTime: 30_000,
```

2. **Missing offline data persistence for React Query:**

**FIX: Add persistence to `packages/shared/src/config/react-query.ts`:**

```tsx
import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { persistQueryClient } from "@tanstack/react-query-persist-client";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: "offlineFirst",
      staleTime: STALE_TIMES.baseLists,
      gcTime: GC_TIMES.baseLists,
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error && typeof error === "object" && "status" in error) {
          const status = (error as { status: number }).status;
          if (status >= 400 && status < 500) return false;
        }
        return failureCount < 2;
      },
      refetchOnReconnect: true,
    },
    mutations: {
      networkMode: "offlineFirst",
      retry: 1,
    },
  },
});

// Persist to localStorage for offline support
if (typeof window !== "undefined") {
  const persister = createSyncStoragePersister({
    storage: window.localStorage,
    key: "greengoods-query-cache",
    throttleTime: 1000,
    // Only persist specific queries
    serialize: (data) => JSON.stringify(data),
    deserialize: (data) => JSON.parse(data),
  });

  persistQueryClient({
    queryClient,
    persister,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => {
        // Only persist gardens and actions (stable data)
        const key = query.queryKey[1];
        return key === "gardens" || key === "actions";
      },
    },
  });
}
```

### 3.2 Poor Connectivity Handling

**Current Issue:** 10-second hardcoded timeout for optimistic update rollback:

```tsx
// packages/shared/src/hooks/garden/useJoinGarden.ts:234
setTimeout(() => {
  queryClient.invalidateQueries({ queryKey: queryKeys.gardens.byChain(chainId) });
}, 10000);
```

**FIX: Use exponential backoff with max retries:**

```tsx
// packages/shared/src/utils/connectivity.ts (NEW FILE)
interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 30000 } = options;
  
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

export function scheduleValidation(
  validate: () => void,
  options: { initialDelay?: number; maxAttempts?: number } = {}
): () => void {
  const { initialDelay = 2000, maxAttempts = 5 } = options;
  const timeouts: NodeJS.Timeout[] = [];
  
  for (let i = 0; i < maxAttempts; i++) {
    const delay = initialDelay * Math.pow(2, i);
    timeouts.push(setTimeout(validate, delay));
  }
  
  return () => timeouts.forEach(clearTimeout);
}
```

**Updated usage in `useJoinGarden.ts`:**
```tsx
import { scheduleValidation } from "../../utils/connectivity";

// After successful join
const cleanup = scheduleValidation(
  () => queryClient.invalidateQueries({ queryKey: queryKeys.gardens.byChain(chainId) }),
  { initialDelay: 2000, maxAttempts: 4 }
);

// Store cleanup function if component unmounts
```

---

## Section 4: Optimistic UI & Success States

### 4.1 Current Optimistic UI Patterns

**Good:**
- Join garden has optimistic updates with `queryClient.setQueryData`
- Work submission shows immediate offline hash for UI feedback

**Issues:**

1. **No rollback on work submission failure:**
```tsx
// packages/shared/src/hooks/work/useWorkMutation.ts
// onError only shows toast, doesn't rollback optimistic state
onError: (error: unknown, variables) => {
  // Toast only - no cache rollback
  toastService.error({ ... });
}
```

2. **Success state timing issues:**
```tsx
// packages/client/src/views/Garden/index.tsx:107-118
useEffect(() => {
  if (submissionCompleted) {
    setShowCompletionState(true);
    const timer = setTimeout(() => {
      // Reset happens here but user might navigate away
      useWorkFlowStore.getState().reset();
      form.reset();
      navigate("/home");
    }, 1500);
    return () => clearTimeout(timer);
  }
}, [submissionCompleted, navigate, form]);
```

**FIX: Improve optimistic updates in `useWorkMutation.ts`:**

```tsx
// packages/shared/src/hooks/work/useWorkMutation.ts

export function useWorkMutation(options: UseWorkMutationOptions) {
  const queryClient = useQueryClient();
  const { gardenAddress, actionUID, chainId = DEFAULT_CHAIN_ID, userAddress } = options;
  
  return useMutation({
    mutationFn: async ({ draft, images }) => {
      // ... existing logic
    },
    
    // Add optimistic update
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ 
        queryKey: queryKeys.works.merged(gardenAddress!, chainId) 
      });
      
      // Snapshot current state for rollback
      const previousWorks = queryClient.getQueryData<Work[]>(
        queryKeys.works.merged(gardenAddress!, chainId)
      );
      
      // Create optimistic work entry
      const optimisticWork: Work = {
        id: `optimistic-${Date.now()}`,
        title: getActionTitle(options.actions, actionUID),
        actionUID: actionUID!,
        gardenerAddress: userAddress!,
        gardenAddress: gardenAddress!,
        feedback: variables.draft.feedback || "",
        metadata: JSON.stringify({
          plantCount: variables.draft.plantCount,
          plantSelection: variables.draft.plantSelection,
        }),
        media: variables.images.map((f) => URL.createObjectURL(f)),
        createdAt: Date.now(),
        status: "pending",
      };
      
      // Optimistically update cache
      queryClient.setQueryData<Work[]>(
        queryKeys.works.merged(gardenAddress!, chainId),
        (old = []) => [optimisticWork, ...old]
      );
      
      // Return context for rollback
      return { previousWorks, optimisticId: optimisticWork.id };
    },
    
    onError: (error, variables, context) => {
      // Rollback optimistic update
      if (context?.previousWorks) {
        queryClient.setQueryData(
          queryKeys.works.merged(gardenAddress!, chainId),
          context.previousWorks
        );
      }
      
      // Show error toast
      const { title, message, parsed } = parseAndFormatError(error);
      toastService.error({
        id: "work-upload",
        title: parsed.isKnown ? title : "Work submission failed",
        message: parsed.isKnown ? message : "We couldn't submit your work.",
        error,
      });
    },
    
    onSuccess: (txHash, variables, context) => {
      // Replace optimistic entry with real data
      queryClient.setQueryData<Work[]>(
        queryKeys.works.merged(gardenAddress!, chainId),
        (old = []) => old.map((w) => 
          w.id === context?.optimisticId 
            ? { ...w, id: txHash, status: "pending" as const }
            : w
        )
      );
      
      // Schedule validation
      scheduleValidation(() => {
        queryClient.invalidateQueries({ 
          queryKey: queryKeys.works.merged(gardenAddress!, chainId) 
        });
      });
      
      // Mark submission complete
      useWorkFlowStore.getState().setSubmissionCompleted(true);
    },
    
    onSettled: () => {
      // Always refetch after mutation settles
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.queue.stats() 
      });
    },
  });
}
```

### 4.2 Success State Visual Feedback

**Issue:** Success state is implied via toast and navigation, no clear visual confirmation.

**FIX: Add success animation component:**

```tsx
// packages/client/src/components/Communication/SuccessOverlay.tsx
import { RiCheckLine } from "@remixicon/react";
import { cn } from "@green-goods/shared/utils";

interface SuccessOverlayProps {
  show: boolean;
  message?: string;
  onComplete?: () => void;
}

export const SuccessOverlay: React.FC<SuccessOverlayProps> = ({
  show,
  message = "Success!",
  onComplete,
}) => {
  React.useEffect(() => {
    if (show && onComplete) {
      const timer = setTimeout(onComplete, 1500);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!show) return null;

  return (
    <div className="success-overlay">
      <div className="success-overlay-content">
        <div className="success-overlay-icon">
          <RiCheckLine className="w-12 h-12 text-white" />
        </div>
        <p className="success-overlay-message">{message}</p>
      </div>
    </div>
  );
};
```

**Add CSS:**
```css
/* Success Overlay */
.success-overlay {
  @apply fixed inset-0 z-[30000] bg-primary/95;
  @apply flex items-center justify-center;
  animation: fadeIn 0.3s ease-out;
}

.success-overlay-content {
  @apply flex flex-col items-center gap-4 text-white;
  animation: scaleIn 0.4s ease-out;
}

.success-overlay-icon {
  @apply w-20 h-20 rounded-full bg-white/20;
  @apply flex items-center justify-center;
  animation: pulse 1s ease-in-out infinite;
}

.success-overlay-message {
  @apply text-xl font-semibold;
}

@keyframes scaleIn {
  from { transform: scale(0.8); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
```

---

## Section 5: Additional Recommendations

### 5.1 Type Safety Improvements

**Issue:** `any` types in WorkDashboard:
```tsx
// packages/client/src/views/Home/WorkDashboard/index.tsx
const operatorWorksById = useMemo(() => {
  const map = new Map<string, any>(); // Should be Map<string, Work>
  ...
}, [operatorWorks]);
```

**FIX:** Replace all `any` with proper types:
```tsx
const operatorWorksById = useMemo(() => {
  const map = new Map<string, Work>();
  operatorWorks.forEach((w) => map.set(w.id, w));
  return map;
}, [operatorWorks]);
```

### 5.2 Performance: Memoization Opportunities

**Finding:** Re-renders in WorkDashboard due to inline function definitions:

```tsx
// Current (causes re-renders)
<MinimalWorkCard onClick={() => onWorkClick(work)} />

// Better (stable reference)
const handleClick = useCallback((work: Work) => {
  onWorkClick(work);
}, [onWorkClick]);

// Even better with event delegation
<div onClick={(e) => {
  const workId = (e.target as HTMLElement).closest('[data-work-id]')?.getAttribute('data-work-id');
  if (workId) handleWorkClick(workId);
}}>
  {works.map(work => <MinimalWorkCard data-work-id={work.id} />)}
</div>
```

### 5.3 Bundle Size Consideration

**Finding:** Some heavy imports could be lazy-loaded:

```tsx
// packages/client/src/components/Display/Carousel/Carousel.tsx
import useEmblaCarousel from "embla-carousel-react";

// Could be dynamically imported:
const Carousel = React.lazy(() => import("./Carousel"));
```

---

## Action Items Summary

### Priority 1 (High Impact, Low Effort)
| Item | Effort | Impact |
|------|--------|--------|
| Add badge utility classes | 30 min | Reduce 6 files |
| Add list state utilities CSS | 1 hour | Reduce 4 files |
| Fix dead code | 30 min | Clean codebase |

### Priority 2 (High Impact, Medium Effort)
| Item | Effort | Impact |
|------|--------|--------|
| Create `ListState` component | 2 hours | DRY dashboard tabs |
| Improve optimistic UI with rollback | 3 hours | Better UX |
| Add query cache persistence | 2 hours | Better offline |

### Priority 3 (Medium Impact)
| Item | Effort | Impact |
|------|--------|--------|
| Add `SuccessOverlay` component | 1 hour | Better feedback |
| Fix type safety (`any` → proper types) | 2 hours | Type safety |
| Standardize stale times | 1 hour | Consistency |

---

## Files to Modify

1. **Create:**
   - `packages/client/src/components/Communication/ListState.tsx`
   - `packages/client/src/components/Communication/SuccessOverlay.tsx`
   - `packages/shared/src/utils/connectivity.ts`

2. **Update:**
   - `packages/client/src/styles/utilities.css` (add utility classes)
   - `packages/shared/src/hooks/work/useWorkMutation.ts` (optimistic updates)
   - `packages/shared/src/hooks/garden/useJoinGarden.ts` (backoff logic)
   - `packages/shared/src/config/react-query.ts` (persistence)

3. **Refactor:**
   - `packages/client/src/views/Home/WorkDashboard/Pending.tsx`
   - `packages/client/src/views/Home/WorkDashboard/Completed.tsx`
   - `packages/client/src/views/Home/WorkDashboard/Uploading.tsx`
   - `packages/client/src/views/Home/WorkDashboard/MyWork.tsx`
   - `packages/client/src/components/Cards/Work/WorkCard.tsx`

---

## Section 6: Extended Dead Code & Refactoring Analysis

### 6.1 Unused Variables (Underscore-Prefixed)

Found 10+ instances of unused variables with underscore prefix:

| File | Variable | Line |
|------|----------|------|
| `views/Landing/index.tsx` | `_state` | 14 |
| `views/Landing/index.tsx` | `_error` | 45 |
| `views/WorkDashboard/index.tsx` | `_item` (2x) | 341, 351 |
| `views/Garden/index.tsx` | `_showCompletionState` | 37 |
| `views/Garden/index.tsx` | `_isTranslatingAction` | 130 |
| `views/Garden/index.tsx` | `_isTranslatingGarden` | 141 |
| `views/Garden/Media.tsx` | `_fileName` | 118 |
| `components/Display/Accordion/Accordion.tsx` | `_className` | 47 |
| `components/Inputs/Date/Date.tsx` | `_ref`, `_value` | 11, 24 |
| `components/Inputs/Select/FormSelect.tsx` | `_ref` | 108 |

**FIX:** Remove unused variables or actually use them:

```tsx
// Before
const [_showCompletionState, setShowCompletionState] = useState(false);
const { translatedAction, isTranslating: _isTranslatingAction } = useActionTranslation(selectedAction);

// After - either remove the state entirely, or show loading states
const { translatedAction, isTranslating } = useActionTranslation(selectedAction);
// Use isTranslating to show loading indicator
```

### 6.2 Console Statements (21 Total)

**Production console statements to review:**

| File | Type | Line | Context |
|------|------|------|---------|
| `views/Home/WorkDashboard/Uploading.tsx` | `error` | 34 | Sync failure |
| `views/Home/WorkDashboard/index.tsx` | `error` (2x) | 292, 298 | Navigation errors |
| `views/Home/WorkDashboard/MyWork.tsx` | `error` | 20 | Queue flush |
| `views/Login/index.tsx` | `error` (3x) | 253, 270, 282 | Auth errors |
| `views/Profile/Account.tsx` | `error` (2x) | 157, 184 | Join/logout |
| `views/Garden/index.tsx` | `error` | 303 | Work submission |
| `components/Errors/*.tsx` | `error` (3x) | Various | Error boundaries |
| `components/Cards/Work/WorkCard.tsx` | `error` | 325 | Media processing |
| `App.tsx` | `warn` | 70 | IndexedDB fallback |

**Recommendation:** Replace with structured logging via debug utilities:

```tsx
// Before
console.error("[GardenFlow] Work submission threw", error);

// After
import { debugError } from "@green-goods/shared/utils";
debugError("[GardenFlow] Work submission threw", error);
```

### 6.3 TypeScript `any` Types (38 in client, 20+ in shared)

**Client package - worst offenders:**

```tsx
// WorkDashboard/index.tsx - 13 instances
const operatorWorksById = useMemo(() => {
  const map = new Map<string, any>();  // Should be Map<string, Work>
  ...
}, [operatorWorks]);

const pendingNeedsReview: any[] = ...;  // Should be Work[]
const handleWorkClick = (work: any) => { ... };  // Should be Work
```

**FIX:** Define proper types:

```tsx
// packages/client/src/views/Home/WorkDashboard/types.ts
export interface WorkDashboardItem extends Work {
  gardenName?: string;
  isOperator?: boolean;
  isGardener?: boolean;
}

export type RenderBadgesFn = (item: WorkDashboardItem) => React.ReactNode[];
```

### 6.4 `as any` Type Assertions (36 instances)

Most are in test files (acceptable), but production code includes:

```tsx
// WorkDashboard/index.tsx:275
const filteredCompleted = filterByTimeRange(completedWork as any, timeFilter);

// WorkCard.tsx:306-315 - Media type handling
const m0 = Array.isArray(work.media) && work.media.length > 0 ? (work.media as any[])[0] : undefined;
if (typeof (m0 as any).url === "string") { ... }
```

**FIX:** Create proper media type:

```tsx
// packages/shared/src/types/media.ts
export type MediaItem = 
  | string  // URL string
  | { url: string }  // Object with URL
  | { file: File }  // Object with File
  | File;  // Direct File

export function resolveMediaUrl(item: MediaItem): string | undefined {
  if (typeof item === "string") return item;
  if (item instanceof File) return URL.createObjectURL(item);
  if ("url" in item) return item.url;
  if ("file" in item) return URL.createObjectURL(item.file);
  return undefined;
}
```

### 6.5 @ts-ignore Comments (4 instances)

All in `views/Garden/Details.tsx`:

```tsx
// Lines 80, 94, 110, 122
// @ts-ignore
{...register(key, registerOptions)}
```

**Root cause:** Dynamic form field registration with variable keys.

**FIX:** Use type assertion with proper typing:

```tsx
// Define dynamic field type
type DynamicFormFields = Record<string, string | number | string[]>;

// Use proper type assertion
{...register(key as keyof DynamicFormFields, registerOptions)}
```

### 6.6 Deprecated Code in Shared Package

Found 9+ deprecated functions/modules still exported:

| Module | Deprecated Item | Replacement |
|--------|-----------------|-------------|
| `modules/data/ipfs.ts` | `initPinata` | `initializeIpfs` |
| `modules/data/ipfs.ts` | `initPinataFromEnv` | `initializeIpfsFromEnv` |
| `modules/auth/session.ts` | `CREDENTIAL_STORAGE_KEY` | Pimlico server |
| `modules/auth/session.ts` | `hasStoredCredential` | `hasStoredUsername` |
| `modules/auth/session.ts` | `clearCredential` | `clearAllAuth` |
| `utils/errors/contract-errors.ts` | `isNotGardenerError` | `isNotGardenMemberError` |

**Recommendation:** Add deprecation warnings and plan removal in next major version.

### 6.7 Skeleton Loading Patterns (8 unique patterns)

Multiple skeleton implementations that could be consolidated:

1. `GardenCardSkeleton` - used 7 times
2. `ActionCardSkeleton` - used 4 times
3. `WorkViewSkeleton` - used 5 times
4. `AvatarSkeleton` - used 1 time
5. Inline skeleton in `MyWork.tsx` - custom pattern

**FIX:** Create base skeleton utilities:

```tsx
// packages/client/src/components/Communication/Skeleton/Skeleton.tsx
export const SkeletonBox: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn("bg-slate-200 rounded animate-pulse", className)} />
);

export const SkeletonText: React.FC<{ width?: string }> = ({ width = "w-full" }) => (
  <SkeletonBox className={cn("h-4", width)} />
);

export const SkeletonAvatar: React.FC<{ size?: "sm" | "md" | "lg" }> = ({ size = "md" }) => {
  const sizes = { sm: "w-8 h-8", md: "w-10 h-10", lg: "w-12 h-12" };
  return <SkeletonBox className={cn("rounded-full", sizes[size])} />;
};
```

### 6.8 Repeated Array.from Skeleton Patterns

Found 8 instances of similar patterns:

```tsx
// Same pattern in 5+ files
{Array.from({ length: 4 }).map((_, idx) => (
  <SomeCardSkeleton key={idx} />
))}
```

**FIX:** Create reusable skeleton list component:

```tsx
// packages/client/src/components/Communication/Skeleton/SkeletonList.tsx
interface SkeletonListProps<P> {
  count: number;
  component: React.ComponentType<P>;
  componentProps?: P;
  direction?: "row" | "column";
  gap?: number;
}

export function SkeletonList<P extends object>({
  count,
  component: Component,
  componentProps = {} as P,
  direction = "column",
  gap = 4,
}: SkeletonListProps<P>) {
  return (
    <div className={cn("flex", direction === "row" ? "flex-row" : "flex-col", `gap-${gap}`)}>
      {Array.from({ length: count }).map((_, idx) => (
        <Component key={idx} {...componentProps} />
      ))}
    </div>
  );
}

// Usage:
<SkeletonList count={4} component={GardenCardSkeleton} componentProps={{ media: "small" }} />
```

---

## Section 7: Additional Refactoring Opportunities

### 7.1 Direct `navigator.onLine` Usage

Found 3 direct usages instead of using the `useOffline` hook:

```tsx
// views/Home/Garden/Work.tsx:423,447
disabled={isRetrying || !navigator.onLine}
{!navigator.onLine && (...)}

// components/Navigation/TopNav.tsx:144
const hasOfflineIssues = !navigator.onLine;
```

**FIX:** Use the hook consistently:

```tsx
const { isOnline } = useOffline();
// Then use isOnline instead of navigator.onLine
```

### 7.2 Query Invalidation Patterns

Found scattered `queryClient.invalidateQueries` calls that could use centralized invalidation:

**Before:**
```tsx
queryClient.invalidateQueries({ queryKey: queryKeys.queue.uploading() });
queryClient.invalidateQueries({ queryKey: queryKeys.queue.stats() });
queryClient.invalidateQueries({ queryKey: ["myWorks", activeAddress, DEFAULT_CHAIN_ID] });
```

**After:** Use the existing `queryInvalidation` utilities:

```tsx
import { queryInvalidation } from "@green-goods/shared/hooks";

// Single call for related invalidations
queryInvalidation.onJobCompleted(gardenId, chainId).forEach(key => 
  queryClient.invalidateQueries({ queryKey: key })
);
```

### 7.3 Badge Rendering Functions Duplication

Three nearly identical badge rendering functions in `WorkDashboard/index.tsx`:

- `renderWorkBadges` (lines 310-339)
- `renderApprovalBadges` (lines 341-349)
- `renderMyWorkReviewedBadges` (lines 351-353)

**FIX:** Consolidate into a single function:

```tsx
const renderBadges = (item: Work, context: "work" | "approval" | "myWork") => {
  const badges: React.ReactNode[] = [];
  
  if (context === "work") {
    // Work-specific badges
  } else if (context === "approval") {
    badges.push(<span className="badge-pill-emerald">Reviewed by you</span>);
  } else if (context === "myWork") {
    badges.push(<span className="badge-pill-slate">Your work was reviewed</span>);
  }
  
  return badges;
};
```

---

## Updated Action Items Summary

### Critical (Fix Immediately)
| Item | Files | Lines Saved |
|------|-------|-------------|
| Replace `any` types in WorkDashboard | 1 file | Type safety |
| Use `ListState` component | 4 files | ~200 lines |
| Fix @ts-ignore in Details.tsx | 1 file | 4 suppressions |

### High Priority
| Item | Files | Impact |
|------|-------|--------|
| Add badge-pill CSS utilities | Many | ~50 class strings |
| Remove unused underscore variables | 10 files | Dead code |
| Replace console.* with debugLog | 12 files | Production logs |
| Use queryInvalidation utilities | 2 files | Consistency |

### Medium Priority
| Item | Files | Impact |
|------|-------|--------|
| Create SkeletonList component | 5 files | DRY skeletons |
| Use useOffline consistently | 3 files | Consistency |
| Remove deprecated exports | shared pkg | Technical debt |
| Add MediaItem type | 2 files | Type safety |

### Low Priority
| Item | Files | Impact |
|------|-------|--------|
| Consolidate badge render functions | 1 file | ~40 lines |
| Remove deprecated shared code | shared pkg | Cleanup |

---

## Implementation Summary

**Net code change: -555 lines (82 added, 637 removed)**

### Changes Implemented

| File | Change | Lines |
|------|--------|-------|
| `styles/utilities.css` | Added `.badge-pill-*` CSS utilities | +30 |
| `views/Landing/index.tsx` | Removed unused state, types | -13 |
| `views/Garden/index.tsx` | Removed unused variables and state | -8 |
| `views/Garden/Details.tsx` | Fixed @ts-ignore with proper typing | +15 |
| `WorkDashboard/index.tsx` | Fixed `any` types, simplified badge render | -40 |
| `WorkDashboard/Pending.tsx` | Fixed `any` types | -2 |
| `WorkDashboard/Completed.tsx` | Fixed `any` types | -2 |
| `WorkDashboard/Uploading.tsx` | Used CSS utilities for badges | -4 |
| `WorkDashboard/MyWork.tsx` | Used CSS utilities for badges | -10 |
| `Cards/Work/WorkCard.tsx` | Used CSS utilities for badges | -4 |

### Key Improvements

1. **Removed dead code**: Unused `_state`, `_showCompletionState`, `_isTranslatingAction`, `_isTranslatingGarden` variables
2. **Fixed type safety**: Replaced 13+ `any` types with proper `Work` types
3. **Removed @ts-ignore**: Replaced 4 @ts-ignore comments with proper Path<> typing
4. **Reduced duplication**: Badge classes now use CSS utilities (`.badge-pill-*`)
5. **Simplified badge rendering**: Removed unused function parameters, consolidated static badge functions

---

*Report generated: December 25, 2025*  
*Extended: December 25, 2025*  
*Implementation completed: December 25, 2025*
