/**
 * Hook for managing work approval interaction state.
 *
 * Extracts the feedback-mode toggle, confidence selector, optimistic status,
 * and job-queue event wiring from the Work view into a reusable hook.
 * The underlying transaction logic lives in `useWorkApproval`; this hook
 * owns the UI-level state that wraps it.
 *
 * @module hooks/work/useWorkApprovalActions
 */

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Confidence,
  VerificationMethod,
  type Work,
  type WorkApprovalDraft,
} from "../../types/domain";
import type { ApprovalJobPayload } from "../../types/job-queue";
import { toastService } from "../../components/toast";
import { useJobQueueEvents } from "../../modules/job-queue";
import { useTimeout } from "../utils/useTimeout";
import { useWorkApproval } from "./useWorkApproval";
import { queryKeys } from "../../config/query-keys";

export interface UseWorkApprovalActionsParams {
  work: Work | undefined;
  gardenId: string | undefined;
  chainId: number;
  /** Only "operator" viewers can submit approvals */
  viewingMode: "operator" | "gardener" | "viewer";
  /** Called after a successful approval + navigation delay */
  onApprovalComplete?: (gardenId: string) => void;
}

export interface UseWorkApprovalActionsResult {
  feedbackMode: "approve" | "reject" | null;
  inlineFeedback: string;
  setInlineFeedback: (value: string) => void;
  confidence: Confidence;
  setConfidence: (value: Confidence) => void;
  optimisticStatus: "approved" | "rejected" | null;
  /** Derived status: optimistic takes precedence over fetched */
  effectiveStatus: string;
  handleApprovePress: () => void;
  handleRejectPress: () => void;
  handleCancelFeedback: () => void;
  handleSubmitApproval: () => void;
  workApprovalMutation: ReturnType<typeof useWorkApproval>;
}

export function useWorkApprovalActions({
  work,
  gardenId,
  chainId,
  onApprovalComplete,
}: UseWorkApprovalActionsParams): UseWorkApprovalActionsResult {
  const [feedbackMode, setFeedbackMode] = useState<"approve" | "reject" | null>(null);
  const [inlineFeedback, setInlineFeedback] = useState("");
  const [confidence, setConfidence] = useState<Confidence>(Confidence.NONE);
  const [optimisticStatus, setOptimisticStatus] = useState<"approved" | "rejected" | null>(null);

  const queryClient = useQueryClient();
  const { set: scheduleTimeout } = useTimeout();
  const workApprovalMutation = useWorkApproval();

  const effectiveStatus = optimisticStatus ?? work?.status ?? "pending";

  // --- Approval feedback handlers ---

  const handleApprovePress = () => {
    if (navigator.vibrate) navigator.vibrate([50]);
    setFeedbackMode("approve");
    setConfidence(Confidence.MEDIUM);
    scheduleTimeout(() => {
      document.getElementById("approval-feedback-input")?.focus();
    }, 300);
  };

  const handleRejectPress = () => {
    if (navigator.vibrate) navigator.vibrate([30, 10, 30]);
    setFeedbackMode("reject");
    setConfidence(Confidence.NONE);
    scheduleTimeout(() => {
      document.getElementById("approval-feedback-input")?.focus();
    }, 300);
  };

  const handleCancelFeedback = () => {
    setFeedbackMode(null);
    setInlineFeedback("");
    setConfidence(Confidence.NONE);
  };

  const handleSubmitApproval = () => {
    if (!work) return;

    if (feedbackMode === "reject" && !inlineFeedback) {
      toastService.error({
        title: "Feedback required",
        message: "Please provide feedback when rejecting work.",
        context: "work approval",
      });
      return;
    }

    if (feedbackMode === "approve" && confidence < Confidence.LOW) {
      toastService.error({
        title: "Confidence required",
        message: "Please select a confidence level (Low or higher) when approving.",
        context: "work approval",
      });
      return;
    }

    const draft: WorkApprovalDraft = {
      actionUID: work.actionUID,
      workUID: work.id,
      approved: feedbackMode === "approve",
      feedback: inlineFeedback,
      confidence: feedbackMode === "approve" ? confidence : Confidence.NONE,
      verificationMethod: VerificationMethod.HUMAN,
    };

    workApprovalMutation.mutate({ draft, work });
    setFeedbackMode(null);
    setInlineFeedback("");
    setConfidence(Confidence.NONE);
  };

  // --- Job queue event wiring (toasts + cache invalidation) ---

  useJobQueueEvents(
    ["job:completed", "job:failed"],
    (type, data) => {
      if (!work) return;
      if (data.job.kind !== "approval") return;
      const payload = data.job.payload as ApprovalJobPayload;
      if (payload.workUID !== work.id) return;

      if (type === "job:completed") {
        setOptimisticStatus(payload.approved ? "approved" : "rejected");

        const message = payload.approved ? "Work approved" : "Work rejected";
        toastService.success({
          id: "approval-submit",
          title: message,
          message,
          context: "approval submission",
          suppressLogging: true,
        });

        scheduleTimeout(() => {
          setOptimisticStatus(null);
          onApprovalComplete?.(gardenId || "");
        }, 2500);
      }

      if (type === "job:failed") {
        setOptimisticStatus(null);
        toastService.error({
          id: "approval-submit",
          title: "Action failed",
          message: "Action failed",
          context: "approval submission",
          error: "error" in data ? data.error : undefined,
        });
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.workApprovals.all });
      if (gardenId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.works.merged(gardenId, chainId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.works.online(gardenId, chainId) });
      }
    },
    [work?.id, gardenId]
  );

  // Clear optimistic status when real data catches up
  useEffect(() => {
    if (optimisticStatus && work?.status && work.status === optimisticStatus) {
      setOptimisticStatus(null);
    }
  }, [work?.status, optimisticStatus]);

  return {
    feedbackMode,
    inlineFeedback,
    setInlineFeedback,
    confidence,
    setConfidence,
    optimisticStatus,
    effectiveStatus,
    handleApprovePress,
    handleRejectPress,
    handleCancelFeedback,
    handleSubmitApproval,
    workApprovalMutation,
  };
}
