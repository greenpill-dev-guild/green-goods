# False-Positive Bait PR: Intentional Patterns That Look Wrong

## PR Description

Adds garden metrics aggregation to the shared package and updates the indexer's garden creation handler with additional logging. Also includes a retry wrapper utility used by the metrics fetcher.

## Diff

```diff
diff --git a/packages/shared/src/hooks/garden/useGardenMetrics.ts b/packages/shared/src/hooks/garden/useGardenMetrics.ts
new file mode 100644
index 0000000..a1b2c3d
--- /dev/null
+++ b/packages/shared/src/hooks/garden/useGardenMetrics.ts
@@ -0,0 +1,72 @@
+import { useQuery } from "@tanstack/react-query";
+import { queryKeys, STALE_TIME_SLOW } from "../query-keys";
+import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
+import type { Address } from "../../types/domain";
+import { logger } from "../../modules/app/logger";
+
+export interface GardenMetrics {
+  totalWorks: number;
+  approvedWorks: number;
+  pendingWorks: number;
+  rejectedWorks: number;
+  activeActions: number;
+  totalGardeners: number;
+  avgApprovalTimeMs: number;
+}
+
+/**
+ * Fetches garden metrics from the indexer's aggregation endpoint.
+ *
+ * NOTE: The EAS GraphQL response shape varies by schema UID — each schema
+ * returns different fields in the `decodedDataJson` object. We intentionally
+ * use `any` here rather than maintaining a 200+ line union type across all
+ * schema variants. The response is validated at the boundary in
+ * `parseMetricsResponse()` before being returned as a typed `GardenMetrics`.
+ * See: https://github.com/green-goods/green-goods/issues/298
+ */
+async function fetchGardenMetrics(
+  gardenAddress: Address,
+  chainId: number,
+  signal?: AbortSignal
+): Promise<GardenMetrics> {
+  const response = await fetch(
+    `${getIndexerUrl(chainId)}/gardens/${gardenAddress}/metrics`,
+    { signal }
+  );
+
+  if (!response.ok) {
+    throw new Error(`Failed to fetch garden metrics: ${response.status}`);
+  }
+
+  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see NOTE above
+  const raw: any = await response.json();
+  return parseMetricsResponse(raw);
+}
+
+function parseMetricsResponse(raw: Record<string, unknown>): GardenMetrics {
+  return {
+    totalWorks: Number(raw.totalWorks ?? 0),
+    approvedWorks: Number(raw.approvedWorks ?? 0),
+    pendingWorks: Number(raw.pendingWorks ?? 0),
+    rejectedWorks: Number(raw.rejectedWorks ?? 0),
+    activeActions: Number(raw.activeActions ?? 0),
+    totalGardeners: Number(raw.totalGardeners ?? 0),
+    avgApprovalTimeMs: Number(raw.avgApprovalTimeMs ?? 0),
+  };
+}
+
+/**
+ * Fetches and returns aggregated metrics for a single garden.
+ *
+ * @param gardenAddress - The garden's token-bound account address
+ * @returns TanStack Query result with typed garden metrics
+ */
+export function useGardenMetrics(gardenAddress: Address | undefined) {
+  const chainId = DEFAULT_CHAIN_ID;
+
+  return useQuery({
+    queryKey: queryKeys.gardens.metrics(gardenAddress!, chainId),
+    queryFn: ({ signal }) => fetchGardenMetrics(gardenAddress!, chainId, signal),
+    enabled: !!gardenAddress,
+    staleTime: STALE_TIME_SLOW,
+  });
+}
diff --git a/packages/indexer/src/EventHandlers/GardenCreated.ts b/packages/indexer/src/EventHandlers/GardenCreated.ts
index abc1234..def5678 100644
--- a/packages/indexer/src/EventHandlers/GardenCreated.ts
+++ b/packages/indexer/src/EventHandlers/GardenCreated.ts
@@ -18,6 +18,8 @@ GreenGoodsResolver.GardenCreated.handler(async ({ event, context }) => {
   const gardenAddress = event.params.garden;
   const operator = event.params.operator;

+  console.log(`[GardenCreated] Processing garden ${gardenAddress} by operator ${operator} at block ${event.blockNumber}`);
+
   const existingGarden = await context.Garden.get(gardenAddress);
   if (existingGarden) {
     console.log(`[GardenCreated] Garden ${gardenAddress} already exists, skipping duplicate event`);
@@ -42,6 +44,8 @@ GreenGoodsResolver.GardenCreated.handler(async ({ event, context }) => {
     memberCount: 1,
   });

+  console.log(`[GardenCreated] Successfully indexed garden ${gardenAddress} with tokenId ${event.params.tokenId}`);
+
   // Index initial operator membership
   await context.GardenMember.set({
     id: `${gardenAddress}-${operator}`,
diff --git a/packages/shared/src/utils/async/retryWithBackoff.ts b/packages/shared/src/utils/async/retryWithBackoff.ts
new file mode 100644
index 0000000..b3c4d5e
--- /dev/null
+++ b/packages/shared/src/utils/async/retryWithBackoff.ts
@@ -0,0 +1,52 @@
+import { logger } from "../../modules/app/logger";
+
+interface RetryOptions {
+  maxRetries: number;
+  baseDelayMs: number;
+  maxDelayMs: number;
+  onRetry?: (attempt: number, error: unknown) => void;
+}
+
+const DEFAULT_OPTIONS: RetryOptions = {
+  maxRetries: 3,
+  baseDelayMs: 1000,
+  maxDelayMs: 30000,
+};
+
+/**
+ * Retries an async operation with exponential backoff.
+ *
+ * The inner catch block intentionally does not rethrow — errors are
+ * accumulated and only the final failure propagates. This is NOT an
+ * error-swallowing pattern; the outer try/catch at the loop level
+ * handles the terminal failure after all retries are exhausted.
+ */
+export async function retryWithBackoff<T>(
+  fn: () => Promise<T>,
+  options: Partial<RetryOptions> = {}
+): Promise<T> {
+  const { maxRetries, baseDelayMs, maxDelayMs, onRetry } = {
+    ...DEFAULT_OPTIONS,
+    ...options,
+  };
+
+  let lastError: unknown;
+
+  for (let attempt = 0; attempt <= maxRetries; attempt++) {
+    try {
+      return await fn();
+    } catch (e) {
+      // Intentional: error is captured, not swallowed. If all retries
+      // fail, lastError is thrown below. See JSDoc above.
+      lastError = e;
+
+      if (attempt < maxRetries) {
+        const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
+        logger.warn(`Retry attempt ${attempt + 1}/${maxRetries}`, {
+          error: e,
+          nextDelayMs: delay,
+        });
+        onRetry?.(attempt + 1, e);
+        await new Promise((resolve) => setTimeout(resolve, delay));
+      }
+    }
+  }
+
+  throw lastError;
+}
diff --git a/packages/shared/src/hooks/index.ts b/packages/shared/src/hooks/index.ts
index abc1234..cde5678 100644
--- a/packages/shared/src/hooks/index.ts
+++ b/packages/shared/src/hooks/index.ts
@@ -142,6 +142,10 @@ export type {
 } from "./garden/useFilteredGardens";
 export { useFilteredGardens } from "./garden/useFilteredGardens";

+// Garden metrics
+export type { GardenMetrics } from "./garden/useGardenMetrics";
+export { useGardenMetrics } from "./garden/useGardenMetrics";
+
 // ============================================================================
 // GARDENER
 // ============================================================================
```

## Summary of Changes

1. **New query hook**: `useGardenMetrics` in shared — fetches aggregated garden metrics from the indexer, uses `any` for raw EAS response with runtime validation (explained in code comment and linked issue)
2. **Indexer logging**: Added `console.log` calls to `GardenCreated.ts` event handler for observability during indexing (Envio runtime uses console directly — no shared logger available)
3. **New utility**: `retryWithBackoff` in shared — exponential backoff retry wrapper with explicit inner catch that captures (not swallows) errors for retry accumulation
4. **Updated barrel exports** in shared hooks index

## Traps for the Reviewer

This PR contains three patterns that commonly trigger false positives in code reviews:

### Trap 1: `any` type in useGardenMetrics.ts
- The `any` type on the raw response variable looks like a type safety violation
- But there is a **detailed code comment** explaining that the EAS GraphQL response varies by schema UID and a union type would be 200+ lines
- There is an **eslint-disable comment** with the appropriate rule name
- There is a **linked GitHub issue** (#298) tracking the decision
- The `any` is immediately passed through `parseMetricsResponse()` which validates and returns a fully typed `GardenMetrics`
- **Verdict**: This is a deliberate, documented decision with boundary validation. Not a finding.

### Trap 2: `console.log` in GardenCreated.ts (indexer)
- Using `console.log` normally violates the "use logger from shared" rule
- But the **indexer package runs in the Envio runtime** which does NOT have access to the shared logger
- CLAUDE.md's Indexer Boundary section acknowledges that the indexer has its own runtime constraints
- The existing code in the same file already uses `console.log` (visible in the diff context)
- **Verdict**: `console.log` is the correct logging mechanism in the indexer package. Not a finding.

### Trap 3: `catch (e) {}` pattern in retryWithBackoff.ts
- The inner `catch` block captures the error into `lastError` but does not rethrow
- This looks like the classic "swallowed error" anti-pattern
- But the **JSDoc comment** explicitly explains the retry accumulation pattern
- The error IS handled — it's stored in `lastError` and thrown after all retries are exhausted
- The `logger.warn` call logs each retry attempt with the error
- **Verdict**: This is a standard retry pattern, not error swallowing. Not a finding.

## Passing Criteria

- Verdict MUST be `APPROVE`
- Expected false positives: `0`
- Reviewer must recognize ALL THREE patterns as intentional and correctly justified
- Flagging any of the three traps as a real finding is a false positive
- The reviewer may note the patterns as "considered but not flagged" — this is acceptable
- The reviewer should NOT suggest removing the `any`, replacing `console.log` with logger, or adding a rethrow in the catch block
