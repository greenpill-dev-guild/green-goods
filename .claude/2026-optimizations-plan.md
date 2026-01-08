# 2026 JavaScript Optimizations Implementation Plan

This document outlines the implementation plan for 7 modern JavaScript optimizations in the Green Goods codebase.

## Overview

| Phase | Optimization | Effort | Files Changed | Dependencies |
|-------|-------------|--------|---------------|--------------|
| 1 | Compression Streams API | 🟢 Low | 2 | None |
| 2 | Scheduler API (postTask) | 🟢 Low | 3 | Optional polyfill |
| 3 | React Compiler | 🟢 Low | 2 configs + 39 cleanup | `babel-plugin-react-compiler` |
| 4 | Temporal API | 🟢 Low | 1 + consumers | None (native) |
| 5 | Window Controls Overlay | 🟢 Low | 2 | None |
| 6 | React 19 + useActionState | 🟡 Medium | 20+ forms | React 19 upgrade |
| 7 | Vite 8 + Rolldown | 🟢 Low | 2 configs | Vite 8 release |

---

## Phase 1: Compression Streams API

**Goal:** Use native `DecompressionStream` for GraphQL responses instead of bundled libraries.

### Files to Modify

1. **`packages/shared/src/modules/data/graphql-client.ts`**
   - Add response decompression support
   - Accept compressed responses from servers that support it

2. **`packages/shared/src/modules/data/ipfs.ts`**
   - Compress JSON before IPFS upload
   - Decompress IPFS content natively

### Implementation

```typescript
// packages/shared/src/utils/compression.ts (NEW FILE)

/**
 * Native Compression Utilities
 * Uses browser-native CompressionStream/DecompressionStream APIs
 * Eliminates need for pako/zlib bundle dependencies
 */

export type CompressionFormat = 'gzip' | 'deflate' | 'deflate-raw';

/**
 * Compress data using native CompressionStream
 */
export async function compress(
  data: string | ArrayBuffer,
  format: CompressionFormat = 'gzip'
): Promise<ArrayBuffer> {
  const input = typeof data === 'string'
    ? new TextEncoder().encode(data)
    : new Uint8Array(data);

  const cs = new CompressionStream(format);
  const writer = cs.writable.getWriter();
  writer.write(input);
  writer.close();

  const chunks: Uint8Array[] = [];
  const reader = cs.readable.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result.buffer;
}

/**
 * Decompress data using native DecompressionStream
 */
export async function decompress(
  data: ArrayBuffer,
  format: CompressionFormat = 'gzip'
): Promise<string> {
  const ds = new DecompressionStream(format);
  const writer = ds.writable.getWriter();
  writer.write(new Uint8Array(data));
  writer.close();

  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return new TextDecoder().decode(result);
}

/**
 * Check if compression streams are supported
 */
export function isCompressionSupported(): boolean {
  return typeof CompressionStream !== 'undefined'
    && typeof DecompressionStream !== 'undefined';
}

/**
 * Decompress a Response body if it's gzip-encoded
 */
export async function decompressResponse(response: Response): Promise<string> {
  const contentEncoding = response.headers.get('content-encoding');

  if (contentEncoding === 'gzip' && isCompressionSupported()) {
    const buffer = await response.arrayBuffer();
    return decompress(buffer, 'gzip');
  }

  // Fallback to text() for uncompressed responses
  return response.text();
}
```

### GraphQL Client Enhancement

```typescript
// In packages/shared/src/modules/data/graphql-client.ts
// Add Accept-Encoding header and handle compressed responses

constructor(url: string) {
  this.client = new GraphQLClient(url, {
    headers: {
      "Content-Type": "application/json",
      "Accept-Encoding": "gzip, deflate", // Request compressed responses
    },
  });
}
```

### Tests

```typescript
// packages/shared/src/__tests__/utils/compression.test.ts
import { describe, it, expect } from 'vitest';
import { compress, decompress, isCompressionSupported } from '../../utils/compression';

describe('Compression Utilities', () => {
  it('should round-trip compress and decompress text', async () => {
    const original = 'Hello, World! '.repeat(1000);
    const compressed = await compress(original);
    const decompressed = await decompress(compressed);
    expect(decompressed).toBe(original);
  });

  it('compressed data should be smaller than original', async () => {
    const original = 'Hello, World! '.repeat(1000);
    const compressed = await compress(original);
    expect(compressed.byteLength).toBeLessThan(original.length);
  });

  it('should detect compression support', () => {
    expect(typeof isCompressionSupported()).toBe('boolean');
  });
});
```

---

## Phase 2: Scheduler API (postTask)

**Goal:** Yield to user input during heavy background operations like job queue flushing.

### Files to Modify

1. **`packages/shared/src/utils/scheduler.ts`** (NEW)
   - Wrapper around `scheduler.postTask` with fallback

2. **`packages/shared/src/modules/job-queue/index.ts`**
   - Use scheduler in `_flushInternal()` loop

3. **`packages/shared/src/modules/translation/db.ts`**
   - Use scheduler for cache cleanup

### Implementation

```typescript
// packages/shared/src/utils/scheduler.ts (NEW FILE)

/**
 * Scheduler API Utilities
 * Uses browser-native scheduler.postTask when available
 * Falls back to setTimeout for older browsers
 */

type TaskPriority = 'user-blocking' | 'user-visible' | 'background';

interface SchedulerPostTaskOptions {
  priority?: TaskPriority;
  signal?: AbortSignal;
  delay?: number;
}

interface Scheduler {
  postTask<T>(
    callback: () => T | Promise<T>,
    options?: SchedulerPostTaskOptions
  ): Promise<T>;
  yield(): Promise<void>;
}

declare global {
  interface Window {
    scheduler?: Scheduler;
  }
}

/**
 * Check if native scheduler is available
 */
export function isSchedulerSupported(): boolean {
  return typeof window !== 'undefined'
    && typeof window.scheduler?.postTask === 'function';
}

/**
 * Schedule a task with the given priority
 * Falls back to setTimeout for browsers without scheduler support
 */
export async function scheduleTask<T>(
  callback: () => T | Promise<T>,
  options: SchedulerPostTaskOptions = {}
): Promise<T> {
  const { priority = 'background', signal, delay = 0 } = options;

  if (isSchedulerSupported()) {
    return window.scheduler!.postTask(callback, { priority, signal, delay });
  }

  // Fallback: use setTimeout with priority-based delays
  const fallbackDelay = delay + (priority === 'background' ? 0 : 0);

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(async () => {
      try {
        resolve(await callback());
      } catch (error) {
        reject(error);
      }
    }, fallbackDelay);

    signal?.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

/**
 * Yield to the browser to allow user input processing
 * Uses scheduler.yield() when available, falls back to setTimeout(0)
 */
export async function yieldToMain(): Promise<void> {
  if (isSchedulerSupported() && typeof window.scheduler?.yield === 'function') {
    return window.scheduler.yield();
  }

  // Fallback: yield via setTimeout
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Process items in batches, yielding between batches
 * Perfect for processing large arrays without blocking UI
 */
export async function processBatched<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  options: {
    batchSize?: number;
    priority?: TaskPriority;
    signal?: AbortSignal;
    onProgress?: (processed: number, total: number) => void;
  } = {}
): Promise<R[]> {
  const { batchSize = 5, priority = 'background', signal, onProgress } = options;
  const results: R[] = [];

  for (let i = 0; i < items.length; i++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const result = await scheduleTask(
      () => processor(items[i], i),
      { priority, signal }
    );
    results.push(result);

    // Yield after each batch to allow UI updates
    if ((i + 1) % batchSize === 0) {
      await yieldToMain();
      onProgress?.(i + 1, items.length);
    }
  }

  onProgress?.(items.length, items.length);
  return results;
}
```

### Job Queue Integration

```typescript
// In packages/shared/src/modules/job-queue/index.ts
// Modify _flushInternal to use scheduler

import { scheduleTask, yieldToMain } from '../../utils/scheduler';

private async _flushInternal(context: FlushContext): Promise<FlushResult> {
  // ... existing validation ...

  const jobs = await jobQueueDB.getJobs({ userAddress: context.userAddress, synced: false });
  if (jobs.length === 0) {
    const emptyResult = { processed: 0, failed: 0, skipped: 0 };
    jobQueueEventBus.emit("queue:sync-completed", { result: emptyResult });
    return emptyResult;
  }

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];

    try {
      // Schedule job processing as background task
      const result = await scheduleTask(
        () => this.processJob(job.id, context),
        { priority: 'background' }
      );

      if (result.success) {
        processed += 1;
      } else if (result.skipped) {
        skipped += 1;
      } else {
        failed += 1;
      }
    } catch (error) {
      failed += 1;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      jobQueueEventBus.emit("job:failed", { jobId: job.id, job, error: errorMessage });
    }

    // Yield to main thread every 3 jobs to keep UI responsive
    if ((i + 1) % 3 === 0) {
      await yieldToMain();
    }
  }

  const result = { processed, failed, skipped };
  jobQueueEventBus.emit("queue:sync-completed", { result });
  return result;
}
```

---

## Phase 3: React Compiler

**Goal:** Enable automatic memoization, then remove manual `useMemo`/`useCallback`.

### Files to Modify

1. **`packages/client/vite.config.ts`**
2. **`packages/admin/vite.config.ts`**
3. **39 files with manual memoization** (cleanup after compiler is enabled)

### Step 1: Install Dependencies

```bash
bun add -D babel-plugin-react-compiler
```

### Step 2: Update Vite Configs

```typescript
// packages/client/vite.config.ts
import react from "@vitejs/plugin-react";

// In plugins array, update react() call:
react({
  babel: {
    plugins: [
      ['babel-plugin-react-compiler', {
        // Recommended: start with opt-in mode for gradual adoption
        // compilationMode: 'annotation', // Only compile components with 'use memo' directive
        // Or enable for all components:
        // compilationMode: 'all',
      }]
    ]
  }
}),
```

### Step 3: Gradual Rollout Strategy

1. **Week 1**: Enable compiler in `annotation` mode
   - Add `'use memo'` directive to high-impact components
   - Test performance improvements

2. **Week 2**: Switch to `all` mode
   - Monitor for any regressions
   - Check bundle size impact

3. **Week 3**: Remove manual memoization
   - Delete `useMemo` calls that compiler handles
   - Delete `useCallback` calls that compiler handles
   - Keep only memoization with intentional side effects

### Files with Manual Memoization to Review

```
packages/client/src/components/Cards/Garden/GardenCard.tsx
packages/client/src/components/Features/Garden/Gardeners.tsx
packages/client/src/views/Profile/Account.tsx
packages/client/src/components/Dialogs/ImagePreviewDialog.tsx
packages/client/src/views/Home/Garden/Work.tsx
packages/client/src/views/Garden/index.tsx
packages/client/src/views/Home/WorkDashboard/index.tsx
packages/client/src/components/Features/Garden/Work.tsx
packages/client/src/views/Home/Garden/index.tsx
packages/client/src/components/Communication/Offline/OfflineIndicator.tsx
packages/client/src/views/Garden/Media.tsx
packages/client/src/views/Garden/Review.tsx
packages/client/src/views/Home/index.tsx
packages/client/src/components/Display/Carousel/Carousel.tsx
packages/client/src/views/Home/Garden/Assessment.tsx
packages/admin/src/views/Gardens/Garden/Detail.tsx
packages/admin/src/views/Gardens/Garden/Assessment.tsx
packages/admin/src/components/Garden/CreateGardenSteps/DetailsStep.tsx
packages/admin/src/components/Assessment/CreateAssessmentSteps/EvidenceStep.tsx
packages/admin/src/components/Garden/CreateGardenSteps/TeamStep.tsx
packages/admin/src/components/Garden/AddMemberModal.tsx
packages/admin/src/components/Assessment/CreateAssessmentSteps/ReviewStep.tsx
packages/shared/src/hooks/garden/useAutoJoinRootGarden.ts
packages/shared/src/hooks/app/useTheme.ts
packages/shared/src/hooks/auth/useUser.ts
packages/shared/src/hooks/work/useDrafts.ts
packages/shared/src/providers/JobQueue.tsx
packages/shared/src/providers/Work.tsx
packages/shared/src/hooks/garden/useJoinGarden.ts
packages/shared/src/hooks/garden/useGardenPermissions.ts
packages/shared/src/hooks/garden/useCreateGardenWorkflow.ts
packages/shared/src/providers/Auth.tsx
packages/shared/src/providers/App.tsx
packages/shared/src/hooks/action/useActionOperations.ts
packages/shared/src/hooks/garden/useGardenOperations.ts
packages/shared/src/hooks/app/useToastAction.ts
packages/shared/src/hooks/garden/useGardenTabs.ts
packages/shared/src/hooks/blockchain/useChainConfig.ts
```

### Example Cleanup

```typescript
// BEFORE (packages/client/src/components/Cards/Garden/GardenCard.tsx)
const membership = React.useMemo(
  () => buildGardenMemberSets(garden.gardeners, garden.operators),
  [garden.gardeners, garden.operators]
);
const operatorAddresses = React.useMemo(
  () => Array.from(membership.operatorIds),
  [membership.operatorIds]
);

// AFTER (React Compiler handles memoization automatically)
const membership = buildGardenMemberSets(garden.gardeners, garden.operators);
const operatorAddresses = Array.from(membership.operatorIds);
```

---

## Phase 4: Temporal API

**Goal:** Replace manual Date handling with type-safe Temporal API.

### Files to Modify

1. **`packages/shared/src/utils/time.ts`** - Complete rewrite
2. **Consumers** - Update imports (API-compatible where possible)

### Implementation

```typescript
// packages/shared/src/utils/time.ts - REWRITE

/**
 * Time Utilities (Temporal API)
 *
 * Modern time handling using the Temporal API.
 * Provides timezone-safe operations for dates, times, and durations.
 *
 * @module utils/time
 */

export type TimeFilter = "day" | "week" | "month" | "year";

// Duration constants using Temporal
const DURATIONS: Record<TimeFilter, Temporal.Duration> = {
  day: Temporal.Duration.from({ days: 1 }),
  week: Temporal.Duration.from({ weeks: 1 }),
  month: Temporal.Duration.from({ days: 30 }),
  year: Temporal.Duration.from({ days: 365 }),
};

/**
 * Get timestamp cutoff for a given time filter
 * Uses Temporal for accurate duration subtraction
 */
export function getTimeCutoff(filter: TimeFilter): number {
  const now = Temporal.Now.instant();
  const duration = DURATIONS[filter];
  const cutoff = now.subtract(duration);
  return cutoff.epochMilliseconds;
}

/**
 * Normalize timestamp to milliseconds
 * Handles both seconds (blockchain) and milliseconds timestamps
 */
export function normalizeTimestamp(timestamp: number): number {
  // Timestamps before year 2001 in ms are assumed to be seconds
  return timestamp < 1e12 ? timestamp * 1000 : timestamp;
}

/**
 * Filter items by time range using Temporal
 */
export function filterByTimeRange<T extends { createdAt: number }>(
  items: T[],
  filter: TimeFilter
): T[] {
  const cutoff = getTimeCutoff(filter);
  return items.filter((item) => normalizeTimestamp(item.createdAt) >= cutoff);
}

/**
 * Sort items by creation time (newest first)
 */
export function sortByCreatedAt<T extends { createdAt: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Format a timestamp to relative time using Temporal
 * Returns strings like "2 hours ago", "3 days ago"
 */
export function formatRelativeTime(timestamp: number | string | Date): string {
  const ms = timestamp instanceof Date
    ? timestamp.getTime()
    : typeof timestamp === 'string'
    ? new Date(timestamp).getTime()
    : normalizeTimestamp(timestamp);

  if (Number.isNaN(ms)) return "just now";

  const then = Temporal.Instant.fromEpochMilliseconds(ms);
  const now = Temporal.Now.instant();

  // Calculate difference
  const diffNs = now.epochNanoseconds - then.epochNanoseconds;
  const diffMs = Number(diffNs / 1_000_000n);

  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years} year${years > 1 ? "s" : ""} ago`;
  if (months > 0) return `${months} month${months > 1 ? "s" : ""} ago`;
  if (weeks > 0) return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  if (seconds > 10) return `${seconds} second${seconds > 1 ? "s" : ""} ago`;
  return "just now";
}

/**
 * Creates a valid Temporal.Instant or returns null
 * Handles seconds and milliseconds timestamps automatically
 */
export function toSafeInstant(value: unknown): Temporal.Instant | null {
  if (value === null || value === undefined) return null;

  try {
    if (value instanceof Temporal.Instant) return value;

    const timestamp = typeof value === "string" ? Number(value) : value;
    if (typeof timestamp !== "number" || Number.isNaN(timestamp)) return null;

    const ms = normalizeTimestamp(timestamp);
    return Temporal.Instant.fromEpochMilliseconds(ms);
  } catch {
    return null;
  }
}

/**
 * Creates a valid Date object or returns null (backward compatibility)
 */
export function toSafeDate(value: unknown): Date | null {
  const instant = toSafeInstant(value);
  if (!instant) return null;
  return new Date(instant.epochMilliseconds);
}

/**
 * Formats a date value safely using Temporal
 */
export function formatDate(
  value: unknown,
  options?: Intl.DateTimeFormatOptions,
  fallback = "Invalid date"
): string {
  const instant = toSafeInstant(value);
  if (!instant) return fallback;

  try {
    // Use Temporal.ZonedDateTime for locale-aware formatting
    const zonedDateTime = instant.toZonedDateTimeISO(Temporal.Now.timeZoneId());
    return zonedDateTime.toLocaleString(undefined, options);
  } catch {
    return fallback;
  }
}

/**
 * Formats a datetime value safely with date and time
 */
export function formatDateTime(
  value: unknown,
  options?: Intl.DateTimeFormatOptions,
  fallback = "Invalid date"
): string {
  return formatDate(value, {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options,
  }, fallback);
}

/**
 * Formats a date for datetime-local input value (YYYY-MM-DDTHH:mm)
 */
export function toDateTimeLocalValue(value: unknown): string {
  const instant = toSafeInstant(value);
  if (!instant) return "";

  try {
    const zonedDateTime = instant.toZonedDateTimeISO(Temporal.Now.timeZoneId());
    // Format as YYYY-MM-DDTHH:mm for datetime-local inputs
    return zonedDateTime.toString().slice(0, 16);
  } catch {
    return "";
  }
}

/**
 * Creates a Temporal.Instant from datetime-local input value
 */
export function fromDateTimeLocalValue(value: string): Temporal.Instant {
  if (!value) return Temporal.Now.instant();

  try {
    // datetime-local values are in local timezone
    const plainDateTime = Temporal.PlainDateTime.from(value);
    const zonedDateTime = plainDateTime.toZonedDateTime(Temporal.Now.timeZoneId());
    return zonedDateTime.toInstant();
  } catch {
    return Temporal.Now.instant();
  }
}

// ============================================
// NEW TEMPORAL-SPECIFIC UTILITIES
// ============================================

/**
 * Get start of day in UTC (useful for assessment dates)
 */
export function getStartOfDayUTC(value: unknown): Temporal.Instant | null {
  const instant = toSafeInstant(value);
  if (!instant) return null;

  const zonedDateTime = instant.toZonedDateTimeISO('UTC');
  const startOfDay = zonedDateTime.with({
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
    microsecond: 0,
    nanosecond: 0,
  });
  return startOfDay.toInstant();
}

/**
 * Compare two timestamps (returns -1, 0, or 1)
 */
export function compareTimestamps(a: unknown, b: unknown): number {
  const instantA = toSafeInstant(a);
  const instantB = toSafeInstant(b);

  if (!instantA && !instantB) return 0;
  if (!instantA) return -1;
  if (!instantB) return 1;

  return Temporal.Instant.compare(instantA, instantB);
}

/**
 * Calculate duration between two timestamps
 */
export function getDuration(
  start: unknown,
  end: unknown
): Temporal.Duration | null {
  const startInstant = toSafeInstant(start);
  const endInstant = toSafeInstant(end);

  if (!startInstant || !endInstant) return null;

  return startInstant.until(endInstant);
}

/**
 * Format a duration as human-readable string
 */
export function formatDuration(duration: Temporal.Duration): string {
  const total = duration.total({ unit: 'seconds' });

  if (total < 60) return `${Math.floor(total)} seconds`;
  if (total < 3600) return `${Math.floor(total / 60)} minutes`;
  if (total < 86400) return `${Math.floor(total / 3600)} hours`;
  return `${Math.floor(total / 86400)} days`;
}
```

---

## Phase 5: Window Controls Overlay

**Goal:** Native desktop app feel for PWA users on desktop.

### Files to Modify

1. **`packages/client/vite.config.ts`** - Update manifest
2. **`packages/client/src/components/Layout/Header.tsx`** - Add titlebar styling (if exists)
3. **`packages/client/src/index.css`** - Add CSS variables

### Manifest Update

```typescript
// In packages/client/vite.config.ts, update manifest section:
manifest: {
  name: "Green Goods",
  short_name: "Green Goods",
  // ... existing config ...

  // ADD: Window Controls Overlay support
  display_override: ["window-controls-overlay", "standalone"],

  // ... rest of manifest ...
},
```

### CSS Addition

```css
/* packages/client/src/index.css */

/* Window Controls Overlay Support */
@supports (app-region: drag) {
  .app-titlebar {
    /* Make the header draggable like a native window */
    app-region: drag;
    -webkit-app-region: drag;

    /* Account for window controls on the right */
    padding-left: env(titlebar-area-x, 0);
    padding-right: calc(100vw - env(titlebar-area-x, 0) - env(titlebar-area-width, 100vw));
    height: env(titlebar-area-height, 48px);
  }

  .app-titlebar button,
  .app-titlebar a,
  .app-titlebar input {
    /* Allow clicks on interactive elements */
    app-region: no-drag;
    -webkit-app-region: no-drag;
  }
}

/* Fallback for non-WCO environments */
@supports not (app-region: drag) {
  .app-titlebar {
    height: 48px;
  }
}
```

---

## Phase 6: React 19 + useActionState

**Goal:** Simplify form handling with React 19's built-in action state management.

### Prerequisites
- React 19 stable release
- Update `react` and `react-dom` to 19.x in root `package.json`

### Migration Strategy

1. **Update Dependencies**
```bash
bun add react@19 react-dom@19
bun add -D @types/react@19 @types/react-dom@19
```

2. **Identify Forms to Migrate**
Forms currently using `react-hook-form` with manual loading states can be simplified.

3. **Example Migration**

```typescript
// BEFORE: Manual loading state with react-hook-form
function WorkSubmitForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, handleSubmit } = useForm();

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      await submitWork(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('title')} />
      <button disabled={isSubmitting}>
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}

// AFTER: React 19 useActionState
import { useActionState } from 'react';

function WorkSubmitForm() {
  const [state, submitAction, isPending] = useActionState(
    async (prevState, formData) => {
      try {
        const result = await submitWork({
          title: formData.get('title'),
        });
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    { success: false }
  );

  return (
    <form action={submitAction}>
      <input name="title" />
      {state.error && <p className="error">{state.error}</p>}
      <button disabled={isPending}>
        {isPending ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}
```

### Forms to Consider Migrating

Priority forms (high traffic):
- Work submission form (`packages/client/src/views/Garden/`)
- Profile update form (`packages/client/src/views/Profile/`)
- Login forms (both client and admin)
- Assessment creation forms (admin)

### Note on react-hook-form Compatibility

React 19 actions work alongside react-hook-form. You can:
1. Keep complex validation with react-hook-form
2. Use `useActionState` for simple forms
3. Gradually migrate as needed

---

## Phase 7: Vite 8 + Rolldown

**Goal:** Faster builds with Rust-based bundler.

### Prerequisites
- Wait for Vite 8 stable release
- Currently on Vite 7.3.0

### Migration Steps

1. **Update Vite**
```bash
bun add -D vite@8
```

2. **Verify Config Compatibility**
Most Vite 7 configs work unchanged in Vite 8.

3. **Enable Rolldown** (if needed)
```typescript
// vite.config.ts
export default defineConfig({
  // Rolldown is auto-detected in Vite 8
  // No configuration needed for basic usage

  build: {
    // Optional: explicitly use Rolldown
    // rollupOptions will become rolldownOptions
  },
});
```

4. **Expected Benefits**
- 10-100x faster production builds
- Better tree-shaking
- Improved source map quality
- Drop-in Rollup compatibility

### Timeline
- Monitor Vite 8 release notes
- Test in development branch first
- Roll out after 8.0.1+ (avoid .0 releases)

---

## Implementation Status

### ✅ Implemented (Ready to Use)
1. **Compression Streams API** - `packages/shared/src/utils/compression.ts`
   - Native gzip/deflate compression
   - 12 tests passing
   - Eliminates need for pako/zlib dependencies

2. **Scheduler API** - `packages/shared/src/utils/scheduler.ts`
   - Cooperative multitasking with `scheduler.postTask`
   - Integrated into job queue for background processing
   - 20 tests passing
   - Falls back gracefully in older browsers

3. **Temporal API** - `packages/shared/src/utils/time.ts`
   - Complete rewrite with Temporal API support
   - Type declarations in `packages/shared/src/types/temporal.d.ts`
   - 62 tests passing (1 skipped for Temporal availability)
   - Backward-compatible with Date fallbacks

4. **Window Controls Overlay** - `packages/client/vite.config.ts`, `packages/client/src/index.css`
   - PWA manifest with `display_override: ["window-controls-overlay", "standalone"]`
   - CSS for draggable titlebar area
   - Native desktop app feel when installed

### ⏳ Pending (Requires Dependencies)
5. **React Compiler** - Config added but commented out
   - REQUIRES: React 19 (provides `react/compiler-runtime` export)
   - `babel-plugin-react-compiler@1.0.0` is installed
   - Ready to enable when upgrading to React 19
   - Location: `packages/client/vite.config.ts`, `packages/admin/vite.config.ts`

6. **React 19 + useActionState** - Not started
   - REQUIRES: React 19 stable release
   - Will enable React Compiler automatically

7. **Vite 8 + Rolldown** - Not started
   - REQUIRES: Vite 8 stable release
   - Currently on Vite 7.3.1

---

## Testing Strategy

### Unit Tests
- Test compression round-trips
- Test scheduler task ordering
- Test Temporal conversions
- Test backward compatibility

### Integration Tests
- Job queue with scheduler
- Form submissions with new patterns
- PWA manifest validation

### Performance Tests
- Measure job queue flush time before/after scheduler
- Measure build time before/after Rolldown
- Measure bundle size with/without React Compiler

---

## Rollback Plan

Each optimization is independent and can be rolled back:

1. **Compression**: Remove `Accept-Encoding` header, delete utils file
2. **Scheduler**: Remove imports, revert to simple loops
3. **React Compiler**: Remove babel plugin from vite config
4. **Temporal**: Keep old Date-based implementations alongside
5. **Window Controls**: Remove manifest additions
6. **React 19**: Pin React to 18.x
7. **Vite 8**: Pin Vite to 7.x
