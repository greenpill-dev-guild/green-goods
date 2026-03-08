# Known-Bug PR: Garden Filtering Feature

## PR Description

Adds garden filtering by domain to the client and shared packages. Users can now filter gardens by their primary domain (Solar, Agro, Edu, Waste) from the gardens list view.

## Diff

```diff
diff --git a/packages/client/src/hooks/useGardenFilters.ts b/packages/client/src/hooks/useGardenFilters.ts
new file mode 100644
index 0000000..a3e7f21
--- /dev/null
+++ b/packages/client/src/hooks/useGardenFilters.ts
@@ -0,0 +1,48 @@
+import { useState, useCallback, useMemo } from "react";
+import { useGardens, type Garden, Domain } from "@green-goods/shared";
+
+export type DomainFilter = Domain | "all";
+
+interface UseGardenFiltersReturn {
+  selectedDomain: DomainFilter;
+  setDomainFilter: (domain: DomainFilter) => void;
+  filteredGardens: Garden[];
+  domainCounts: Record<DomainFilter, number>;
+}
+
+/**
+ * Filters the garden list by domain. Used by GardenListView to let users
+ * narrow down gardens by their primary activity domain.
+ */
+export function useGardenFilters(): UseGardenFiltersReturn {
+  const { data: gardens = [] } = useGardens();
+  const [selectedDomain, setSelectedDomain] = useState<DomainFilter>("all");
+
+  const setDomainFilter = useCallback((domain: DomainFilter) => {
+    setSelectedDomain(domain);
+  }, []);
+
+  const filteredGardens = useMemo(() => {
+    if (selectedDomain === "all") return gardens;
+    return gardens.filter((g) => g.domain === selectedDomain);
+  }, [gardens, selectedDomain]);
+
+  const domainCounts = useMemo(() => {
+    const counts: Record<DomainFilter, number> = {
+      all: gardens.length,
+      [Domain.SOLAR]: 0,
+      [Domain.AGRO]: 0,
+      [Domain.EDU]: 0,
+      [Domain.WASTE]: 0,
+    };
+    for (const garden of gardens) {
+      if (garden.domain !== undefined) {
+        counts[garden.domain] = (counts[garden.domain] ?? 0) + 1;
+      }
+    }
+    return counts;
+  }, [gardens]);
+
+  return {
+    selectedDomain,
+    setDomainFilter,
+    filteredGardens,
+    domainCounts,
+  };
+}
diff --git a/packages/shared/src/hooks/garden/useGardenDomainStats.ts b/packages/shared/src/hooks/garden/useGardenDomainStats.ts
new file mode 100644
index 0000000..b4d2e89
--- /dev/null
+++ b/packages/shared/src/hooks/garden/useGardenDomainStats.ts
@@ -0,0 +1,42 @@
+import { useQuery } from "@tanstack/react-query";
+import { queryKeys } from "../query-keys";
+import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
+import type { Garden, Address } from "../../types/domain";
+import { Domain } from "../../types/domain";
+
+export interface GardenDomainStats {
+  domain: Domain;
+  gardenCount: number;
+  activeActionCount: number;
+  totalWorksSubmitted: number;
+}
+
+async function fetchDomainStats(
+  chainId: number,
+  signal?: AbortSignal
+): Promise<GardenDomainStats[]> {
+  // Aggregates domain statistics from indexed garden data
+  const response = await fetch(
+    `${getIndexerUrl(chainId)}/garden-domain-stats`,
+    { signal }
+  );
+  if (!response.ok) throw new Error("Failed to fetch domain stats");
+  return response.json();
+}
+
+/**
+ * Fetches aggregated statistics for each garden domain.
+ * Used by the dashboard to show domain-level metrics.
+ */
+export function useGardenDomainStats() {
+  const chainId = DEFAULT_CHAIN_ID;
+
+  return useQuery({
+    queryKey: queryKeys.gardens.domainStats(chainId),
+    queryFn: ({ signal }) => fetchDomainStats(chainId, signal),
+    staleTime: STALE_TIME_SLOW,
+  });
+}
diff --git a/packages/shared/src/hooks/garden/useUpdateGardenDomain.ts b/packages/shared/src/hooks/garden/useUpdateGardenDomain.ts
new file mode 100644
index 0000000..c8f1a3d
--- /dev/null
+++ b/packages/shared/src/hooks/garden/useUpdateGardenDomain.ts
@@ -0,0 +1,58 @@
+import { useMutation, useQueryClient } from "@tanstack/react-query";
+import { useCallback } from "react";
+import type { Address } from "../../types/domain";
+import { Domain } from "../../types/domain";
+import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
+import { toastService } from "../../components/toast";
+import { useUser } from "../auth/useUser";
+import { queryKeys } from "../query-keys";
+import { useContractTxSender } from "../blockchain/useContractTxSender";
+import { useMutationLock } from "../utils/useMutationLock";
+import { useBeforeUnloadWhilePending } from "../utils/useBeforeUnloadWhilePending";
+
+interface UpdateGardenDomainParams {
+  gardenAddress: Address;
+  domain: Domain;
+}
+
+/**
+ * Mutation hook for updating a garden's primary domain.
+ * Only garden operators can change the domain.
+ */
+export function useUpdateGardenDomain() {
+  const { authMode } = useUser();
+  const chainId = DEFAULT_CHAIN_ID;
+  const queryClient = useQueryClient();
+  const { sendTransaction } = useContractTxSender();
+  const { runWithLock, isPending: isLockPending } = useMutationLock("update-domain");
+
+  const mutation = useMutation({
+    mutationFn: async ({ gardenAddress, domain }: UpdateGardenDomainParams) => {
+      return sendTransaction({
+        address: gardenAddress,
+        abi: gardenAccountAbi,
+        functionName: "setDomain",
+        args: [domain],
+      });
+    },
+    onSuccess: (_data, variables) => {
+      toastService.success({
+        id: "update-domain",
+        title: "Domain updated",
+        message: "Garden domain has been changed.",
+        context: "domain update",
+      });
+      queryClient.invalidateQueries({
+        queryKey: queryKeys.gardens.detail(variables.gardenAddress, chainId),
+      });
+    },
+    onError: (error) => {
+      console.error("Failed to update garden domain:", error);
+      toastService.error({
+        id: "update-domain",
+        title: "Update failed",
+        message: "Could not update garden domain. Please try again.",
+        context: "domain update",
+      });
+    },
+  });
+
+  const isPending = mutation.isPending || isLockPending;
+  useBeforeUnloadWhilePending(isPending);
+
+  return { ...mutation, isPending };
+}
diff --git a/packages/admin/src/views/Gardens/GardenDomainFilter.tsx b/packages/admin/src/views/Gardens/GardenDomainFilter.tsx
new file mode 100644
index 0000000..d9e2c4a
--- /dev/null
+++ b/packages/admin/src/views/Gardens/GardenDomainFilter.tsx
@@ -0,0 +1,55 @@
+import { useIntl } from "react-intl";
+import { Domain, DOMAIN_COLORS } from "@green-goods/shared";
+import { useAuth } from "@green-goods/shared/hooks/auth/useAuth";
+import { Button } from "@/components/ui/Button";
+
+interface GardenDomainFilterProps {
+  selectedDomain: Domain | "all";
+  onDomainChange: (domain: Domain | "all") => void;
+  counts: Record<Domain | "all", number>;
+}
+
+const DOMAIN_LABELS: Record<Domain | "all", string> = {
+  all: "All",
+  [Domain.SOLAR]: "Solar",
+  [Domain.AGRO]: "Agro",
+  [Domain.EDU]: "Edu",
+  [Domain.WASTE]: "Waste",
+};
+
+export function GardenDomainFilter({
+  selectedDomain,
+  onDomainChange,
+  counts,
+}: GardenDomainFilterProps) {
+  const intl = useIntl();
+  const { isAuthenticated } = useAuth();
+
+  if (!isAuthenticated) return null;
+
+  return (
+    <div className="flex gap-2 flex-wrap" role="group" aria-label="Filter by domain">
+      {(Object.entries(DOMAIN_LABELS) as [Domain | "all", string][]).map(
+        ([domain, label]) => (
+          <Button
+            key={domain}
+            variant={selectedDomain === domain ? "primary" : "secondary"}
+            size="sm"
+            onClick={() => onDomainChange(domain)}
+            aria-pressed={selectedDomain === domain}
+          >
+            {domain !== "all" && (
+              <span
+                className="inline-block w-2 h-2 rounded-full mr-1.5"
+                style={{ backgroundColor: DOMAIN_COLORS[domain as Domain] }}
+              />
+            )}
+            {intl.formatMessage({
+              id: `garden.domain.${domain}`,
+              defaultMessage: label,
+            })}
+            <span className="ml-1 text-text-weak text-xs">({counts[domain] ?? 0})</span>
+          </Button>
+        )
+      )}
+    </div>
+  );
+}
diff --git a/packages/shared/src/hooks/index.ts b/packages/shared/src/hooks/index.ts
index abc1234..def5678 100644
--- a/packages/shared/src/hooks/index.ts
+++ b/packages/shared/src/hooks/index.ts
@@ -142,6 +142,12 @@ export type {
 } from "./garden/useFilteredGardens";
 export { useFilteredGardens } from "./garden/useFilteredGardens";

+// Garden domain stats and mutations
+export type { GardenDomainStats } from "./garden/useGardenDomainStats";
+export { useGardenDomainStats } from "./garden/useGardenDomainStats";
+export { useUpdateGardenDomain } from "./garden/useUpdateGardenDomain";
+
 // ============================================================================
 // GARDENER
 // ============================================================================
```

## Summary of Changes

1. **New hook**: `useGardenFilters` in client for domain-based filtering
2. **New query hook**: `useGardenDomainStats` in shared for aggregated domain statistics
3. **New mutation hook**: `useUpdateGardenDomain` in shared for changing garden domains
4. **New component**: `GardenDomainFilter` in admin for the filter UI
5. **Updated barrel exports** in shared hooks index
