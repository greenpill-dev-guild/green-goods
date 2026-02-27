# Clean PR: Garden Statistics Query Hook

## PR Description

Adds a `useGardenStats` query hook to `@green-goods/shared` that fetches aggregate statistics for a single garden (total works, approval rate, active actions count). Used by the garden detail view to show a stats summary card.

## Diff

```diff
diff --git a/packages/shared/src/hooks/garden/useGardenStats.ts b/packages/shared/src/hooks/garden/useGardenStats.ts
new file mode 100644
index 0000000..f1a2b3c
--- /dev/null
+++ b/packages/shared/src/hooks/garden/useGardenStats.ts
@@ -0,0 +1,64 @@
+import { useQuery } from "@tanstack/react-query";
+import { queryKeys, STALE_TIME_MEDIUM } from "../query-keys";
+import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
+import type { Address } from "../../types/domain";
+import { logger } from "../../modules/app/logger";
+import { fetchGardenData } from "../../modules/data/gardens";
+
+export interface GardenStats {
+  /** Total number of works submitted to this garden */
+  totalWorks: number;
+  /** Number of approved works */
+  approvedWorks: number;
+  /** Approval rate as a percentage (0-100) */
+  approvalRate: number;
+  /** Number of currently active actions */
+  activeActions: number;
+  /** Number of registered gardeners */
+  gardenerCount: number;
+}
+
+async function computeGardenStats(
+  gardenAddress: Address,
+  chainId: number,
+  signal?: AbortSignal
+): Promise<GardenStats> {
+  const gardenData = await fetchGardenData(gardenAddress, chainId, signal);
+
+  const totalWorks = gardenData.works.length;
+  const approvedWorks = gardenData.works.filter(
+    (w) => w.status === "approved"
+  ).length;
+  const approvalRate = totalWorks > 0
+    ? Math.round((approvedWorks / totalWorks) * 100)
+    : 0;
+  const now = Date.now() / 1000;
+  const activeActions = gardenData.actions.filter(
+    (a) => a.startTime <= now && a.endTime >= now
+  ).length;
+
+  return {
+    totalWorks,
+    approvedWorks,
+    approvalRate,
+    activeActions,
+    gardenerCount: gardenData.gardeners.length,
+  };
+}
+
+/**
+ * Fetches and computes aggregate statistics for a single garden.
+ *
+ * @param gardenAddress - The garden's token-bound account address
+ * @returns TanStack Query result with computed garden stats
+ */
+export function useGardenStats(gardenAddress: Address | undefined) {
+  const chainId = DEFAULT_CHAIN_ID;
+
+  return useQuery({
+    queryKey: queryKeys.gardens.stats(gardenAddress!, chainId),
+    queryFn: ({ signal }) => computeGardenStats(gardenAddress!, chainId, signal),
+    enabled: !!gardenAddress,
+    staleTime: STALE_TIME_MEDIUM,
+  });
+}
diff --git a/packages/shared/src/hooks/index.ts b/packages/shared/src/hooks/index.ts
index abc1234..cde5678 100644
--- a/packages/shared/src/hooks/index.ts
+++ b/packages/shared/src/hooks/index.ts
@@ -142,6 +142,10 @@ export type {
 } from "./garden/useFilteredGardens";
 export { useFilteredGardens } from "./garden/useFilteredGardens";

+// Garden statistics
+export type { GardenStats } from "./garden/useGardenStats";
+export { useGardenStats } from "./garden/useGardenStats";
+
 // ============================================================================
 // GARDENER
 // ============================================================================
diff --git a/packages/admin/src/views/Gardens/GardenStatsCard.tsx b/packages/admin/src/views/Gardens/GardenStatsCard.tsx
new file mode 100644
index 0000000..e7d8f90
--- /dev/null
+++ b/packages/admin/src/views/Gardens/GardenStatsCard.tsx
@@ -0,0 +1,70 @@
+import { useIntl } from "react-intl";
+import { useGardenStats, type Address } from "@green-goods/shared";
+import { Card } from "@/components/ui/Card";
+import { Spinner } from "@green-goods/shared";
+
+interface GardenStatsCardProps {
+  gardenAddress: Address;
+}
+
+export function GardenStatsCard({ gardenAddress }: GardenStatsCardProps) {
+  const intl = useIntl();
+  const { data: stats, isLoading, error } = useGardenStats(gardenAddress);
+
+  if (isLoading) {
+    return (
+      <Card>
+        <Card.Body className="flex items-center justify-center py-8">
+          <Spinner size="md" />
+        </Card.Body>
+      </Card>
+    );
+  }
+
+  if (error || !stats) {
+    return (
+      <Card>
+        <Card.Body className="text-center py-8 text-text-weak">
+          {intl.formatMessage({
+            id: "garden.stats.error",
+            defaultMessage: "Unable to load garden statistics",
+          })}
+        </Card.Body>
+      </Card>
+    );
+  }
+
+  const statItems = [
+    {
+      label: intl.formatMessage({ id: "garden.stats.totalWorks", defaultMessage: "Total Works" }),
+      value: stats.totalWorks,
+    },
+    {
+      label: intl.formatMessage({ id: "garden.stats.approvalRate", defaultMessage: "Approval Rate" }),
+      value: `${stats.approvalRate}%`,
+    },
+    {
+      label: intl.formatMessage({ id: "garden.stats.activeActions", defaultMessage: "Active Actions" }),
+      value: stats.activeActions,
+    },
+    {
+      label: intl.formatMessage({ id: "garden.stats.gardeners", defaultMessage: "Gardeners" }),
+      value: stats.gardenerCount,
+    },
+  ];
+
+  return (
+    <Card>
+      <Card.Header>
+        <Card.Title>
+          {intl.formatMessage({ id: "garden.stats.title", defaultMessage: "Garden Statistics" })}
+        </Card.Title>
+      </Card.Header>
+      <Card.Body>
+        <div className="grid grid-cols-2 gap-4">
+          {statItems.map((item) => (
+            <div key={item.label} className="text-center">
+              <div className="text-2xl font-semibold text-text-strong">
+                {item.value}
+              </div>
+              <div className="text-sm text-text-weak mt-1">{item.label}</div>
+            </div>
+          ))}
+        </div>
+      </Card.Body>
+    </Card>
+  );
+}
```

## Summary of Changes

1. **New query hook**: `useGardenStats` in shared (follows hook boundary, uses centralized query keys)
2. **New component**: `GardenStatsCard` in admin (imports from barrel, uses intl, proper loading/error states)
3. **Updated barrel exports** in shared hooks index
