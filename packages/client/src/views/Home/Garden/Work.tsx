import {
  Confidence,
  debugWarn,
  DEFAULT_CHAIN_ID,
  downloadWorkData,
  downloadWorkMedia,
  getJsonByHash,
  isAddressInList,
  isUserAddress as sharedIsUserAddress,
  isValidAttestationId,
  jobQueue,
  openEASExplorer,
  queryKeys,
  shareWork,
  toastService,
  useActions,
  useAsyncEffect,
  useGardens,
  useHasRole,
  useJobQueueEvents,
  useNavigateToTop,
  useTimeout,
  useUser,
  useWorkApproval,
  useWorks,
  VerificationMethod,
  type Address,
  type ApprovalJobPayload,
  type WorkApprovalDraft,
  type WorkData,
  type WorkMetadata,
  type WorkMetadataV1,
} from "@green-goods/shared";
import { useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useLocation, useOutletContext, useParams } from "react-router-dom";

import { WorkViewSkeleton } from "@/components/Features/Work";
import { TopNav } from "@/components/Navigation";

import { WorkApprovalFooter } from "./WorkApprovalFooter";
import { WorkMetadataError } from "./WorkMetadataError";
import { WorkRetryFooter } from "./WorkRetryFooter";
import { WorkSuccessFooter } from "./WorkSuccessFooter";
import { WorkViewSection } from "./WorkViewSection";

type ResolvedWorkMetadata = WorkMetadata | WorkMetadataV1 | Record<string, unknown>;

function isResolvedWorkMetadata(value: unknown): value is ResolvedWorkMetadata {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export const GardenWork: React.FC = () => {
  const intl = useIntl();
  const { id: gardenIdParam, workId } = useParams<{ id: string; workId: string }>();
  const { gardenId: gardenIdFromContext } = (useOutletContext() as { gardenId?: string }) || {};
  const [workMetadata, setWorkMetadata] = useState<ResolvedWorkMetadata | null>(null);
  const [metadataStatus, setMetadataStatus] = useState<"idle" | "loading" | "success" | "error">(
    "loading"
  );
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [metadataRetryKey, setMetadataRetryKey] = useState(0);
  const [feedbackMode, setFeedbackMode] = useState<"approve" | "reject" | null>(null);
  const [inlineFeedback, setInlineFeedback] = useState<string>("");
  const [confidence, setConfidence] = useState<Confidence>(Confidence.NONE);
  const [optimisticStatus, setOptimisticStatus] = useState<"approved" | "rejected" | null>(null);
  const navigateToTop = useNavigateToTop();
  const location = useLocation();
  const chainId = DEFAULT_CHAIN_ID;
  const { data: gardens = [] } = useGardens();
  const gardenId = (gardenIdFromContext || gardenIdParam) as string;
  const garden = gardens.find((g) => g.id === gardenId);
  const { data: actions = [] } = useActions(chainId);
  const { works: mergedWorks } = useWorks(gardenId || "", { offline: true });
  const work = mergedWorks.find((w) => w.id === (workId || ""));

  const effectiveStatus = optimisticStatus ?? work?.status ?? "pending";

  const queryClient = useQueryClient();
  const actionTitle = useMemo(() => {
    if (!work) return null;
    const compositeId = `${chainId}-${work.actionUID}`;
    const match = actions.find((a) => a.id === compositeId);
    return match?.title ?? null;
  }, [actions, chainId, work]);

  const { user, smartAccountClient } = useUser();
  const activeAddress = user?.id;
  const [isRetrying, setIsRetrying] = useState(false);
  const { set: scheduleTimeout } = useTimeout();
  const { hasRole: canReviewOnChain } = useHasRole(
    garden?.id as Address | undefined,
    activeAddress as Address | undefined,
    "evaluator"
  );

  const viewingMode = useMemo<"operator" | "gardener" | "viewer">(() => {
    if (!garden || !work) return "viewer";

    const isOperator = isAddressInList(activeAddress, garden.operators);
    const canReview = isOperator || canReviewOnChain;
    const isGardener = sharedIsUserAddress(work.gardenerAddress, activeAddress);

    if (canReview) return "operator";
    if (isGardener) return "gardener";
    return "viewer";
  }, [garden, work, activeAddress, canReviewOnChain]);

  const isOfflineWork =
    work?.id.startsWith("0xoffline_") || (work?.id && !work.id.startsWith("0x"));

  function buildWorkData(): WorkData | null {
    if (!work) return null;
    return {
      id: work.id,
      title: work.feedback || `Work ${work.id}`,
      description: work.feedback,
      status: work.status,
      createdAt: work.createdAt,
      media: work.media || [],
      metadata: workMetadata,
      feedback: work.feedback,
      gardenId: garden?.id || "",
    };
  }

  const handleRetry = async () => {
    if (!smartAccountClient || !work) return;

    setIsRetrying(true);
    try {
      const result = await jobQueue.processJob(work.id, { smartAccountClient });

      if (result.success) {
        toastService.success({
          title: "Work uploaded successfully",
          message: "Your work is now on-chain",
          context: "work upload",
        });
      } else {
        toastService.error({
          title: "Upload failed",
          message: result.error || "Please try again",
          context: "work upload",
        });
      }
    } catch (error) {
      toastService.error({
        title: "Failed to retry upload",
        message: error instanceof Error ? error.message : "Unknown error",
        context: "work upload",
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const handleDownloadMedia = async () => {
    const data = buildWorkData();
    if (!data) return;
    try {
      await downloadWorkMedia(data);
    } catch (error) {
      toastService.error({
        title: intl.formatMessage({
          id: "app.home.work.downloadMediaFailed",
          defaultMessage: "Failed to download media",
        }),
        message: error instanceof Error ? error.message : "Unknown error",
        context: "work media download",
      });
    }
  };

  const handleDownloadData = () => {
    const data = buildWorkData();
    if (!data) return;
    try {
      downloadWorkData(data);
    } catch (error) {
      toastService.error({
        title: intl.formatMessage({
          id: "app.home.work.downloadDataFailed",
          defaultMessage: "Failed to download data",
        }),
        message: error instanceof Error ? error.message : "Unknown error",
        context: "work data download",
      });
    }
  };

  const handleShare = async () => {
    const data = buildWorkData();
    if (!data) return;
    try {
      await shareWork(data);
    } catch (error) {
      toastService.error({
        title: intl.formatMessage({
          id: "app.home.work.shareFailed",
          defaultMessage: "Failed to share work",
        }),
        message: error instanceof Error ? error.message : "Unknown error",
        context: "work sharing",
      });
    }
  };

  const handleViewAttestation = () => {
    if (!work?.id || !isValidAttestationId(work.id)) {
      return;
    }
    openEASExplorer(chainId, work.id);
  };

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
        title: intl.formatMessage({
          id: "app.home.workApproval.feedbackRequired",
          defaultMessage: "Feedback required",
        }),
        message: intl.formatMessage({
          id: "app.home.workApproval.feedbackRequiredMessage",
          defaultMessage: "Please provide feedback when rejecting work.",
        }),
        context: "work approval",
      });
      return;
    }

    if (feedbackMode === "approve" && confidence < Confidence.LOW) {
      toastService.error({
        title: intl.formatMessage({
          id: "app.home.workApproval.confidenceRequired",
          defaultMessage: "Confidence required",
        }),
        message: intl.formatMessage({
          id: "app.home.workApproval.confidenceRequiredMessage",
          defaultMessage: "Please select a confidence level (Low or higher) when approving.",
        }),
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

  const workApprovalMutation = useWorkApproval();

  useJobQueueEvents(
    ["job:completed", "job:failed"],
    (type, data) => {
      if (!work) return;
      if (data.job.kind !== "approval") return;
      const payload = data.job.payload as ApprovalJobPayload;
      if (payload.workUID !== work.id) return;

      if (type === "job:completed") {
        setOptimisticStatus(payload.approved ? "approved" : "rejected");

        const message = payload.approved
          ? intl.formatMessage({ id: "app.toast.workApproved", defaultMessage: "Work approved" })
          : intl.formatMessage({ id: "app.toast.workRejected", defaultMessage: "Work rejected" });
        toastService.success({
          id: "approval-submit",
          title: message,
          message,
          context: "approval submission",
          suppressLogging: true,
        });

        scheduleTimeout(() => {
          setOptimisticStatus(null);
          navigateToTop(`/home/${garden?.id ?? ""}`);
        }, 2500);
      }
      if (type === "job:failed") {
        setOptimisticStatus(null);

        const failureMessage = intl.formatMessage({
          id: "app.toast.actionFailed",
          defaultMessage: "Action failed",
        });
        toastService.error({
          id: "approval-submit",
          title: failureMessage,
          message: failureMessage,
          context: "approval submission",
          error: "error" in data ? data.error : undefined,
        });
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.workApprovals.all });
      if (garden?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.works.merged(garden.id, chainId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.works.online(garden.id, chainId) });
      }
    },
    [work?.id, garden?.id]
  );

  useEffect(() => {
    if (optimisticStatus && work?.status && work.status === optimisticStatus) {
      setOptimisticStatus(null);
    }
  }, [work?.status, optimisticStatus]);

  useAsyncEffect(
    async ({ signal, isMounted }) => {
      setMetadataStatus("loading");
      setMetadataError(null);
      setWorkMetadata(null);

      if (!work) {
        if (isMounted()) {
          setMetadataStatus("idle");
        }
        return;
      }

      const raw = work.metadata;
      if (!raw || typeof raw !== "string") {
        if (isMounted()) {
          setWorkMetadata(null);
          setMetadataStatus("success");
        }
        return;
      }

      const trimmed = raw.trim();

      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          const parsed = JSON.parse(trimmed) as unknown;
          if (!isMounted()) return;

          if (isResolvedWorkMetadata(parsed)) {
            setWorkMetadata(parsed);
            setMetadataStatus("success");
          } else {
            setWorkMetadata(null);
            setMetadataStatus("error");
            setMetadataError("Invalid inline metadata payload");
          }
          return;
        } catch (error) {
          if (!isMounted()) return;
          const message = error instanceof Error ? error.message : String(error);
          setWorkMetadata(null);
          setMetadataStatus("error");
          setMetadataError(message);
          debugWarn(`[GardenWork] Failed to parse inline metadata for work ${work.id}: ${message}`);
          return;
        }
      }

      try {
        const data = await getJsonByHash(trimmed, { signal, timeoutMs: 30_000 });
        if (!isMounted()) return;

        if (isResolvedWorkMetadata(data)) {
          setWorkMetadata(data);
          setMetadataStatus("success");
        } else {
          setWorkMetadata(null);
          setMetadataStatus("error");
          setMetadataError("Invalid metadata payload");
          debugWarn(
            `[GardenWork] Received invalid metadata payload from gateway for work ${work.id}`
          );
        }
      } catch (error) {
        if (!isMounted()) return;
        const message = error instanceof Error ? error.message : String(error);
        setWorkMetadata(null);
        setMetadataStatus("error");
        setMetadataError(message);
        debugWarn(`[GardenWork] Failed to fetch metadata for work ${work.id}: ${message}`);
      }
    },
    [work?.id, work?.metadata, metadataRetryKey]
  );

  const handleBack = () => {
    const state = (location.state as { backTo?: string; from?: string } | null | undefined) ?? null;
    const fallbackPath = gardenId ? `/home/${gardenId}` : "/home";

    if (state?.backTo) {
      navigateToTop(state.backTo);
      return;
    }

    if (state?.from === "dashboard") {
      navigateToTop("/home");
      return;
    }

    navigateToTop(fallbackPath);
  };

  if (!work || !garden)
    return (
      <article>
        <TopNav onBackClick={handleBack} />
        <div className="padded">
          <WorkViewSkeleton showMedia showActions={false} numDetails={3} />
        </div>
      </article>
    );

  const isMetadataLoading = metadataStatus === "loading" || metadataStatus === "idle";
  const hasMedia = Array.isArray(work.media) && work.media.length > 0;
  const resolvedActionTitle =
    actionTitle ??
    intl.formatMessage({
      id: "app.home.work.unknownAction",
      defaultMessage: "Unknown Action",
    });
  const canViewAttestation = Boolean(work?.id && isValidAttestationId(work.id));

  const retryFooter =
    isOfflineWork && viewingMode === "gardener" ? (
      <WorkRetryFooter isRetrying={isRetrying} onRetry={handleRetry} />
    ) : null;

  const approvalFooter =
    viewingMode === "operator" && effectiveStatus === "pending" ? (
      <WorkApprovalFooter
        feedbackMode={feedbackMode}
        inlineFeedback={inlineFeedback}
        confidence={confidence}
        isPending={workApprovalMutation.isPending}
        onApprovePress={handleApprovePress}
        onRejectPress={handleRejectPress}
        onCancelFeedback={handleCancelFeedback}
        onSubmitApproval={handleSubmitApproval}
        onFeedbackChange={setInlineFeedback}
        onConfidenceChange={setConfidence}
      />
    ) : null;

  const successFooter =
    viewingMode === "operator" && effectiveStatus !== "pending" ? (
      <WorkSuccessFooter effectiveStatus={effectiveStatus as "approved" | "rejected"} />
    ) : null;

  return (
    <article>
      <TopNav onBackClick={handleBack} overlay />
      <div className="padded pt-20">
        {isMetadataLoading ? (
          <WorkViewSkeleton showMedia showActions={false} numDetails={3} />
        ) : (
          <WorkViewSection
            garden={garden}
            work={work}
            workMetadata={workMetadata}
            viewingMode={viewingMode}
            actionTitle={resolvedActionTitle}
            effectiveStatus={effectiveStatus}
            onDownloadData={handleDownloadData}
            onDownloadMedia={hasMedia ? handleDownloadMedia : undefined}
            onShare={handleShare}
            onViewAttestation={canViewAttestation ? handleViewAttestation : undefined}
            footer={retryFooter || approvalFooter || successFooter}
            reserveFooterSpace={Boolean(retryFooter || approvalFooter || successFooter)}
            footerSpacerClassName="h-[calc(112px+env(safe-area-inset-bottom))]"
          />
        )}

        {metadataStatus === "error" && (
          <WorkMetadataError
            errorMessage={metadataError}
            onRetry={() => setMetadataRetryKey((prev) => prev + 1)}
          />
        )}
      </div>
    </article>
  );
};
