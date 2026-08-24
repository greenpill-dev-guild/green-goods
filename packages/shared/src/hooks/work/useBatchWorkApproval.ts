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
import { useCallback, useRef } from "react";
import { toastService } from "../../components/toast";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { trackContractError } from "../../modules/app/error-tracking";
import { track } from "../../modules/app/posthog";
import { type OverlayWork, overlayDeadline } from "../../modules/work/local-status-overlay";
import {
  type BatchApprovalItem,
  createDefaultSubmitBatchApprovalsPorts,
  submitBatchApprovals,
} from "../../modules/work/submit-approval-command";
import type { Work } from "../../types/domain";
import { hapticError, hapticSuccess } from "../../utils/app/haptics";
import { DEBUG_ENABLED, debugLog } from "../../utils/debug";
import { parseAndFormatError } from "../../utils/errors/contract-errors";
import { useUser } from "../auth/useUser";
import { INDEXER_LAG_SCHEDULE_MS } from "../../config/query-keys/constants";
import { approvalsKeys, workApprovalsKeys, worksKeys } from "../../config/query-keys/work";
import { useSafeMutation } from "../utils/useSafeMutation";
import { useProgressiveInvalidation } from "../utils/useTimeout";

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
  const lastGardenAddressesRef = useRef<string[]>([]);
  const { start: scheduleFollowUp } = useProgressiveInvalidation(
    useCallback(() => {
      for (const addr of lastGardenAddressesRef.current) {
        queryClient.invalidateQueries({ queryKey: worksKeys.online(addr, chainId) });
        queryClient.invalidateQueries({ queryKey: worksKeys.merged(addr, chainId) });
      }
      queryClient.invalidateQueries({ queryKey: approvalsKeys.all });
    }, [queryClient, chainId]),
    INDEXER_LAG_SCHEDULE_MS
  );

  const mutation = useMutation({
    mutationFn: async (items: BatchApprovalItem[]) => {
      if (DEBUG_ENABLED) {
        debugLog("[useBatchWorkApproval] Starting batch approval", {
          authMode,
          count: items.length,
          chainId,
        });
      }

      return submitBatchApprovals(
        { authMode, items, chainId },
        createDefaultSubmitBatchApprovalsPorts(smartAccountClient)
      );
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
          queryKey: worksKeys.merged(addr, chainId),
        });
        await queryClient.cancelQueries({
          queryKey: worksKeys.online(addr, chainId),
        });
      }

      // Snapshot previous states for rollback
      const previousStates = new Map<string, Work[] | undefined>();
      for (const addr of gardenAddresses) {
        previousStates.set(
          `merged-${addr}`,
          queryClient.getQueryData<Work[]>(worksKeys.merged(addr, chainId))
        );
        previousStates.set(
          `online-${addr}`,
          queryClient.getQueryData<Work[]>(worksKeys.online(addr, chainId))
        );
      }

      // Optimistically update all works. The deadline matters: without one the
      // overlay would outrank the indexer forever if this batch never lands.
      for (const { draft, work } of items) {
        const optimisticStatus = draft.approved ? ("approved" as const) : ("rejected" as const);

        const applyOptimistic = (old: OverlayWork[] = []): OverlayWork[] =>
          old.map((w) =>
            w.id === draft.workUID
              ? {
                  ...w,
                  status: optimisticStatus,
                  _isPending: true,
                  _pendingUntilMs: overlayDeadline(),
                }
              : w
          );

        queryClient.setQueryData(worksKeys.merged(work.gardenAddress, chainId), applyOptimistic);
        queryClient.setQueryData(worksKeys.online(work.gardenAddress, chainId), applyOptimistic);
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
        // Wallet mode waits on the human signature, which can exceed any fixed
        // timeout — keep it up until the flow replaces it. Passkey/offline are
        // fast, so they keep the default auto-dismiss safety window.
        persistent: authMode === "wallet",
      });

      return { previousStates };
    },

    onSuccess: (result, items) => {
      hapticSuccess();

      // Clear pending flags on all items, keeping a grace window so the decision
      // survives indexer lag without outliving a transaction that never landed.
      for (const { draft, work } of items) {
        const confirmedStatus = draft.approved ? ("approved" as const) : ("rejected" as const);

        const recordDecision = (old: OverlayWork[] = []): OverlayWork[] =>
          old.map((w) =>
            w.id === draft.workUID
              ? {
                  ...w,
                  status: confirmedStatus,
                  _isPending: false,
                  _txHash: result.hash,
                  _pendingUntilMs: overlayDeadline(),
                }
              : w
          );

        queryClient.setQueryData(worksKeys.merged(work.gardenAddress, chainId), recordDecision);
        queryClient.setQueryData(worksKeys.online(work.gardenAddress, chainId), recordDecision);
      }

      // Invalidate queries
      const gardenAddresses = [...new Set(items.map((i) => i.work.gardenAddress))];
      for (const addr of gardenAddresses) {
        queryClient.invalidateQueries({ queryKey: worksKeys.online(addr, chainId) });
        queryClient.invalidateQueries({ queryKey: worksKeys.merged(addr, chainId) });
      }
      queryClient.invalidateQueries({ queryKey: workApprovalsKeys.all });
      queryClient.invalidateQueries({ queryKey: approvalsKeys.all });

      // Schedule progressive follow-up invalidations for indexer lag (non-blocking)
      lastGardenAddressesRef.current = gardenAddresses;
      scheduleFollowUp();

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
            queryClient.setQueryData(worksKeys.merged(addr, chainId), prevMerged);
          }
          if (prevOnline) {
            queryClient.setQueryData(worksKeys.online(addr, chainId), prevOnline);
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

  return useSafeMutation(mutation, "approval");
}
