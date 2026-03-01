# Hook Boundary Violation PR: Work Draft Auto-Save Feature

## PR Description

Adds auto-save functionality for work submission drafts in the client app. Drafts are saved to IndexedDB every 30 seconds while the user is filling out the work form, and restored when they return to the form.

## Diff

```diff
diff --git a/packages/client/src/hooks/useDraftAutoSave.ts b/packages/client/src/hooks/useDraftAutoSave.ts
new file mode 100644
index 0000000..a1b2c3d
--- /dev/null
+++ b/packages/client/src/hooks/useDraftAutoSave.ts
@@ -0,0 +1,78 @@
+import { useEffect, useRef, useCallback } from "react";
+import { useQueryClient } from "@tanstack/react-query";
+import type { Address } from "@green-goods/shared";
+import { queryKeys, logger } from "@green-goods/shared";
+import { jobQueueDB } from "@green-goods/shared/modules/job-queue/db";
+
+interface DraftData {
+  actionUID: string;
+  gardenAddress: Address;
+  feedback: string;
+  media: File[];
+  details: Record<string, unknown>;
+  savedAt: number;
+}
+
+interface UseDraftAutoSaveOptions {
+  /** Interval in ms between auto-saves (default: 30000) */
+  interval?: number;
+  /** Whether auto-save is enabled (default: true) */
+  enabled?: boolean;
+}
+
+/**
+ * Auto-saves work submission draft data to IndexedDB at regular intervals.
+ * Restores draft data when the component mounts if a previous draft exists.
+ */
+export function useDraftAutoSave(
+  gardenAddress: Address,
+  actionUID: string,
+  getCurrentData: () => DraftData,
+  onRestore: (data: DraftData) => void,
+  options: UseDraftAutoSaveOptions = {}
+) {
+  const { interval = 30000, enabled = true } = options;
+  const queryClient = useQueryClient();
+  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
+  const isMountedRef = useRef(true);
+
+  const saveDraft = useCallback(async () => {
+    if (!isMountedRef.current) return;
+
+    try {
+      const data = getCurrentData();
+      await jobQueueDB.saveCachedWork({
+        id: `draft-${gardenAddress}-${actionUID}`,
+        ...data,
+        savedAt: Date.now(),
+      });
+      logger.debug("Draft auto-saved", { gardenAddress, actionUID });
+    } catch (error) {
+      logger.warn("Failed to auto-save draft", { error });
+    }
+  }, [gardenAddress, actionUID, getCurrentData]);
+
+  // Restore draft on mount
+  useEffect(() => {
+    async function restoreDraft() {
+      try {
+        const cached = await jobQueueDB.getCachedWork(
+          `draft-${gardenAddress}-${actionUID}`
+        );
+        if (cached && isMountedRef.current) {
+          onRestore(cached as unknown as DraftData);
+          logger.info("Draft restored", { gardenAddress, actionUID });
+        }
+      } catch (error) {
+        logger.warn("Failed to restore draft", { error });
+      }
+    }
+    restoreDraft();
+  }, [gardenAddress, actionUID, onRestore]);
+
+  // Auto-save interval
+  useEffect(() => {
+    if (!enabled) return;
+
+    intervalRef.current = setInterval(saveDraft, interval);
+
+    return () => {
+      if (intervalRef.current) {
+        clearInterval(intervalRef.current);
+        intervalRef.current = null;
+      }
+    };
+  }, [saveDraft, interval, enabled]);
+
+  return { saveDraft };
+}
diff --git a/packages/client/src/views/Work/SubmitWork.tsx b/packages/client/src/views/Work/SubmitWork.tsx
index abc1234..def5678 100644
--- a/packages/client/src/views/Work/SubmitWork.tsx
+++ b/packages/client/src/views/Work/SubmitWork.tsx
@@ -5,6 +5,7 @@ import { useWorkForm, useWorkMutation, type Address } from "@green-goods/shared"
 import { WorkForm } from "@/components/Work/WorkForm";
 import { SubmitButton } from "@/components/ui/SubmitButton";
+import { useDraftAutoSave } from "@/hooks/useDraftAutoSave";

 interface SubmitWorkProps {
   gardenAddress: Address;
@@ -16,6 +17,14 @@ export function SubmitWork({ gardenAddress, actionUID }: SubmitWorkProps) {
   const { form, handleSubmit } = useWorkForm({ gardenAddress, actionUID });
   const { mutate, isPending } = useWorkMutation();

+  const { saveDraft } = useDraftAutoSave(
+    gardenAddress,
+    actionUID,
+    () => form.getValues() as DraftData,
+    (data) => form.reset(data),
+    { interval: 30000 }
+  );
+
   return (
     <div className="flex flex-col gap-4">
       <WorkForm form={form} onSubmit={handleSubmit(mutate)} />
diff --git a/packages/shared/src/hooks/work/useDraftAutoSave.ts b/packages/shared/src/hooks/work/useDraftAutoSave.ts
deleted file mode 100644
index e7f8g9h..0000000
--- a/packages/shared/src/hooks/work/useDraftAutoSave.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-// Placeholder for draft auto-save hook
-// TODO: Implement auto-save for work drafts
-export {};
```

## Summary of Changes

1. **New hook**: `useDraftAutoSave` in client package for auto-saving work submission drafts
2. **Deleted placeholder**: Removed empty placeholder file from shared that was meant to hold this hook
3. **Updated view**: `SubmitWork.tsx` uses the new auto-save hook
4. **Interval-based saving**: Saves to IndexedDB every 30 seconds with restore on mount
