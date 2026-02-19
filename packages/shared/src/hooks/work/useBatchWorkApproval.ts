/**
 * Batch Work Approval Hook
 *
 * Enables operators to approve/reject multiple works in a single transaction
 * using EAS multiAttest. This dramatically improves UX by:
 * - Single wallet confirmation instead of N confirmations
 * - Single gas payment
 * - Single polling cycle
 *
 * @module hooks/work/useBatchWorkApproval
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { Work, WorkApprovalDraft } from "../../types/domain";
import { toastService } from "../../components/toast";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { track } from "../../modules/app/posthog";
import { trackContractError } from "../../modules/app/error-tracking";
import { parseAndFormatError } from "../../utils/errors/contract-errors";
import { submitBatchApprovalsDirectly } from "../../modules/work/wallet-submission";
import { submitBatchApprovalsWithPasskey } from "../../modules/work/passkey-submission";
import { hapticError, hapticSuccess } from "../../utils/app/haptics";
import { DEBUG_ENABLED, debugLog } from "../../utils/debug";
import { useUser } from "../auth/useUser";
import { INDEXER_LAG_FOLLOWUP_MS, queryKeys } from "../query-keys";
import { useBeforeUnloadWhilePending } from "../utils/useBeforeUnloadWhilePending";
import { useMutationLock } from "../utils/useMutationLock";
import { useTimeout } from "../utils/useTimeout";

interface BatchApprovalItem {
  draft: WorkApprovalDraft;
  work: Work;
}

interface BatchApprovalResult {
  hash: `0x${string}`;
  count: number;
}

/**
 * Hook for submitting multiple work approvals in a single transaction.
 *
 * Benefits:
 * - Single wallet confirmation for all approvals
 * - 70-85% time savings compared to individual approvals
 * - Optimistic UI updates for immediate feedback
 *
 * @returns TanStack Query mutation for batch approval submission
 *
 * @example
 * ```tsx
 * function BatchApprovalPanel({ works }) {
 *   const [selected, setSelected] = useState<string[]>([]);
 *   const batchApproval = useBatchWorkApproval();
 *
 *   const handleBatchApprove = async () => {
 *     const approvals = selected.map(workId => {
 *       const work = works.find(w => w.id === workId);
 *       return {
 *         draft: { workUID: workId, actionUID: work.actionUID, approved: true },
 *         work
 *       };
 *     });
 *
 *     await batchApproval.mutateAsync(approvals);
 *   };
 *
 *   return (
 *     <button
 *       onClick={handleBatchApprove}
 *       disabled={batchApproval.isPending || selected.length === 0}
 *     >
 *       {batchApproval.isPending
 *         ? `Approving ${selected.length}...`
 *         : `Approve ${selected.length} works`}
 *     </button>
 *   );
 * }
 * ```
 */
export function useBatchWorkApproval() {
  const { authMode, smartAccountClient } = useUser();
  const chainId = DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();
  const { set: scheduleInvalidation } = useTimeout();
  const { runWithLock, isPending: isLockPending } = useMutationLock();

  const mutation = useMutation({
    mutationFn: async (items: BatchApprovalItem[]): Promise<BatchApprovalResult> => {
      if (items.length === 0) {
        throw new Error("No items to approve");
      }

      if (DEBUG_ENABLED) {
        debugLog("[useBatchWorkApproval] Starting batch approval", {
          authMode,
          count: items.length,
          chainId,
        });
      }

      const approvals = items.map(({ draft, work }) => ({
        draft,
        gardenAddress: work.gardenAddress,
        gardenerAddress: work.gardenerAddress,
      }));

      if (authMode === "wallet") {
        const hash = await submitBatchApprovalsDirectly(approvals, chainId);
        return { hash, count: items.length };
      }

      // Passkey mode
      if (!smartAccountClient) {
        throw new Error("Smart account not available. Please re-authenticate.");
      }

      const hash = await submitBatchApprovalsWithPasskey({
        client: smartAccountClient,
        approvals: approvals.map(({ draft, gardenAddress }) => ({ draft, gardenAddress })),
        chainId,
      });

      return { hash, count: items.length };
    },

    onMutate: async (items) => {
      if (!items || items.length === 0) return;

      // Track batch approval started
      track("batch_approval_started", {
        count: items.length,
        auth_mode: authMode,
      });

      // Cancel outgoing refetches
      const gardenAddresses = [...new Set(items.map((i) => i.work.gardenAddress))];
      for (const addr of gardenAddresses) {
        await queryClient.cancelQueries({
          queryKey: queryKeys.works.merged(addr, chainId),
        });
        await queryClient.cancelQueries({
          queryKey: queryKeys.works.online(addr, chainId),
        });
      }

      // Snapshot previous states for rollback
      const previousStates = new Map<string, Work[] | undefined>();
      for (const addr of gardenAddresses) {
        previousStates.set(
          `merged-${addr}`,
          queryClient.getQueryData<Work[]>(queryKeys.works.merged(addr, chainId))
        );
        previousStates.set(
          `online-${addr}`,
          queryClient.getQueryData<Work[]>(queryKeys.works.online(addr, chainId))
        );
      }

      // Optimistically update all works
      for (const { draft, work } of items) {
        const optimisticStatus = draft.approved ? ("approved" as const) : ("rejected" as const);

        queryClient.setQueryData(
          queryKeys.works.merged(work.gardenAddress, chainId),
          (old: Work[] = []) =>
            old.map((w) =>
              w.id === draft.workUID ? { ...w, status: optimisticStatus, _isPending: true } : w
            )
        );

        queryClient.setQueryData(
          queryKeys.works.online(work.gardenAddress, chainId),
          (old: Work[] = []) =>
            old.map((w) =>
              w.id === draft.workUID ? { ...w, status: optimisticStatus, _isPending: true } : w
            )
        );
      }

      // Show loading toast
      const approvedCount = items.filter((i) => i.draft.approved).length;
      const rejectedCount = items.length - approvedCount;
      const message =
        approvedCount > 0 && rejectedCount > 0
          ? `${approvedCount} approvals, ${rejectedCount} rejections`
          : approvedCount > 0
            ? `${approvedCount} approval${approvedCount > 1 ? "s" : ""}`
            : `${rejectedCount} rejection${rejectedCount > 1 ? "s" : ""}`;

      toastService.loading({
        id: "batch-approval",
        title: authMode === "wallet" ? "Confirm in your wallet" : "Submitting batch...",
        message: `Processing ${message}...`,
        context: "batch approval",
      });

      return { previousStates };
    },

    onSuccess: (result, items) => {
      hapticSuccess();

      // Clear pending flags on all items
      for (const { draft, work } of items) {
        const confirmedStatus = draft.approved ? ("approved" as const) : ("rejected" as const);

        queryClient.setQueryData(
          queryKeys.works.merged(work.gardenAddress, chainId),
          (old: Work[] = []) =>
            old.map((w) =>
              w.id === draft.workUID
                ? { ...w, status: confirmedStatus, _isPending: false, _txHash: result.hash }
                : w
            )
        );

        queryClient.setQueryData(
          queryKeys.works.online(work.gardenAddress, chainId),
          (old: Work[] = []) =>
            old.map((w) =>
              w.id === draft.workUID
                ? { ...w, status: confirmedStatus, _isPending: false, _txHash: result.hash }
                : w
            )
        );
      }

      // Invalidate queries
      const gardenAddresses = [...new Set(items.map((i) => i.work.gardenAddress))];
      for (const addr of gardenAddresses) {
        queryClient.invalidateQueries({ queryKey: queryKeys.works.online(addr, chainId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.works.merged(addr, chainId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.workApprovals.all });

      // Schedule a follow-up invalidation for indexer lag (non-blocking)
      scheduleInvalidation(() => {
        for (const addr of gardenAddresses) {
          queryClient.invalidateQueries({ queryKey: queryKeys.works.online(addr, chainId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.works.merged(addr, chainId) });
        }
      }, INDEXER_LAG_FOLLOWUP_MS);

      toastService.success({
        id: "batch-approval",
        title: "Batch approved!",
        message: `${result.count} work${result.count > 1 ? "s" : ""} processed successfully.`,
        context: "batch approval",
      });

      track("batch_approval_success", {
        count: result.count,
        auth_mode: authMode,
        tx_hash: result.hash,
      });

      if (DEBUG_ENABLED) {
        debugLog("[useBatchWorkApproval] Batch approval successful", {
          count: result.count,
          hash: result.hash,
        });
      }
    },

    onError: (error, items, context) => {
      hapticError();

      // Rollback optimistic updates
      if (context?.previousStates && items) {
        const gardenAddresses = [...new Set(items.map((i) => i.work.gardenAddress))];
        for (const addr of gardenAddresses) {
          const prevMerged = context.previousStates.get(`merged-${addr}`);
          const prevOnline = context.previousStates.get(`online-${addr}`);
          if (prevMerged) {
            queryClient.setQueryData(queryKeys.works.merged(addr, chainId), prevMerged);
          }
          if (prevOnline) {
            queryClient.setQueryData(queryKeys.works.online(addr, chainId), prevOnline);
          }
        }
      }

      // Parse error for user-friendly message
      const { title, message, parsed } = parseAndFormatError(error);
      const displayMessage = parsed.isKnown ? message : "Batch approval failed. Please try again.";
      const displayTitle = parsed.isKnown ? title : "Batch approval failed";

      // Structured error tracking
      trackContractError(error, {
        source: "useBatchWorkApproval",
        authMode,
        userAction: "batch approval",
        metadata: {
          count: items?.length ?? 0,
          parsedErrorName: parsed.name,
          isKnown: parsed.isKnown,
        },
      });

      toastService.error({
        id: "batch-approval",
        title: displayTitle,
        message: displayMessage,
        context: "batch approval",
        description: parsed.isKnown ? parsed.action || undefined : undefined,
        error,
      });

      track("batch_approval_failed", {
        count: items?.length ?? 0,
        auth_mode: authMode,
        error: parsed.message || (error instanceof Error ? error.message : "Unknown error"),
      });

      if (DEBUG_ENABLED) {
        debugLog("[useBatchWorkApproval] Batch approval failed", {
          error,
          parsedError: parsed.name,
          message: displayMessage,
        });
      }
    },
  });

  const isPending = mutation.isPending || isLockPending;
  useBeforeUnloadWhilePending(isPending);

  const mutateAsync = useCallback(
    (...args: Parameters<typeof mutation.mutateAsync>) =>
      runWithLock(() => mutation.mutateAsync(...args)),
    [mutation, runWithLock]
  );

  const mutate = useCallback(
    (...args: Parameters<typeof mutation.mutate>) => {
      void mutateAsync(...args).catch(() => undefined);
    },
    [mutateAsync]
  );

  return { ...mutation, mutate, mutateAsync, isPending };
}
