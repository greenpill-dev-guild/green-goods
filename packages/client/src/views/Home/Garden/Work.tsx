import { toastService } from "@green-goods/shared";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/blockchain";
import {
  useActions,
  useGardens,
  useNavigateToTop,
  useUser,
  useWorkApproval,
  useWorks,
} from "@green-goods/shared/hooks";
import { getFileByHash, useJobQueueEvents } from "@green-goods/shared/modules";
import { jobQueue } from "@green-goods/shared/modules/job-queue";
import { cn } from "@green-goods/shared/utils";
import { debugWarn } from "@green-goods/shared/utils/debug";
import { isValidAttestationId, openEASExplorer } from "@green-goods/shared/utils/eas/explorers";
import {
  downloadWorkData,
  downloadWorkMedia,
  shareWork,
  type WorkData,
} from "@green-goods/shared/utils/work/workActions";
import {
  RiCheckFill,
  RiCheckLine,
  RiCloseFill,
  RiCloseLine,
  RiErrorWarningLine,
  RiLoader4Line,
  RiUploadCloudLine,
} from "@remixicon/react";
import { useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useLocation, useOutletContext, useParams } from "react-router-dom";
import { Button } from "@/components/UI/Button";
import { TopNav } from "@/components/UI/TopNav/TopNav";
import { WorkViewSkeleton } from "@/components/UI/WorkView/WorkView";
import { WorkCompleted } from "../../Garden/Completed";
import WorkViewSection from "./WorkViewSection";

type GardenWorkProps = {};

export const GardenWork: React.FC<GardenWorkProps> = () => {
  const intl = useIntl();
  const { id: gardenIdParam, workId } = useParams<{ id: string; workId: string }>();
  const { gardenId: gardenIdFromContext } = (useOutletContext() as { gardenId?: string }) || {};
  const [workMetadata, setWorkMetadata] = useState<WorkMetadata | null>(null);
  const [metadataStatus, setMetadataStatus] = useState<"idle" | "loading" | "success" | "error">(
    "loading"
  );
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [feedbackMode, setFeedbackMode] = useState<"approve" | "reject" | null>(null);
  const [inlineFeedback, setInlineFeedback] = useState<string>("");
  const navigateToTop = useNavigateToTop();
  const location = useLocation();
  const chainId = DEFAULT_CHAIN_ID;
  const { data: gardens = [] } = useGardens();
  const gardenId = (gardenIdFromContext || gardenIdParam) as string;
  const garden = gardens.find((g) => g.id === gardenId);
  const { data: actions = [] } = useActions(chainId);
  const { works: mergedWorks } = useWorks(gardenId || "");
  const work = mergedWorks.find((w) => w.id === (workId || ""));
  const queryClient = useQueryClient();
  const actionTitle = useMemo(() => {
    if (!work) return null;
    const compositeId = `${chainId}-${work.actionUID}`;
    const match = actions.find((a) => a.id === compositeId);
    return match?.title ?? null;
  }, [actions, chainId, work]);

  const { user, smartAccountClient, smartAccountAddress } = useUser();
  const userAddress = user?.wallet?.address;
  const [isRetrying, setIsRetrying] = useState(false);

  // Helper to check if an address matches the current user (smart account or wallet)
  const isUserAddress = (address: string | undefined): boolean => {
    if (!address) return false;
    const addr = address.toLowerCase();
    const sa = smartAccountAddress?.toLowerCase();
    const wallet = userAddress?.toLowerCase();
    return (sa && addr === sa) || (wallet && addr === wallet);
  };

  // Determine user role and viewing mode
  const viewingMode = useMemo<"operator" | "gardener" | "viewer">(() => {
    if (!garden || !work) return "viewer";

    // Check if user is garden operator (check both smart account and wallet)
    const isOperator = garden.operators?.some((op) => isUserAddress(op));

    // Check if user is the gardener who submitted the work (check both smart account and wallet)
    const isGardener = isUserAddress(work.gardenerAddress);

    if (isOperator) return "operator";
    if (isGardener) return "gardener";
    return "viewer";
  }, [garden, work, userAddress, smartAccountAddress]);

  // Detect if this is offline work
  const isOfflineWork =
    work?.id.startsWith("0xoffline_") || (work?.id && !work.id.startsWith("0x"));

  // Handle individual work retry
  const handleRetry = async () => {
    if (!smartAccountClient || !work) return;

    setIsRetrying(true);
    try {
      // Process just this job
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

  // Helper functions for work actions
  const handleDownloadMedia = async () => {
    if (!work) return;
    try {
      const workData: WorkData = {
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
      await downloadWorkMedia(workData);
    } catch {}
  };

  const handleDownloadData = () => {
    if (!work) return;
    try {
      const workData: WorkData = {
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
      downloadWorkData(workData);
    } catch {}
  };

  const handleShare = async () => {
    if (!work) return;
    try {
      const workData: WorkData = {
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
      await shareWork(workData);
    } catch {}
  };

  const handleViewAttestation = () => {
    if (!work?.id || !isValidAttestationId(work.id)) {
      return;
    }
    openEASExplorer(chainId, work.id);
  };

  // Approval feedback handlers
  const handleApprovePress = () => {
    if (navigator.vibrate) navigator.vibrate([50]);
    setFeedbackMode("approve");
    // Focus feedback input after animation
    setTimeout(() => {
      document.getElementById("approval-feedback-input")?.focus();
    }, 300);
  };

  const handleRejectPress = () => {
    if (navigator.vibrate) navigator.vibrate([30, 10, 30]);
    setFeedbackMode("reject");
    setTimeout(() => {
      document.getElementById("approval-feedback-input")?.focus();
    }, 300);
  };

  const handleCancelFeedback = () => {
    setFeedbackMode(null);
    setInlineFeedback("");
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

    const draft: WorkApprovalDraft = {
      actionUID: work.actionUID,
      workUID: work.id,
      approved: feedbackMode === "approve",
      feedback: inlineFeedback,
    };

    workApprovalMutation.mutate({ draft, work });
    setFeedbackMode(null);
    setInlineFeedback("");
  };

  const workApprovalMutation = useWorkApproval();

  // Toasts + cache invalidation from queue events
  useJobQueueEvents(
    ["job:completed", "job:failed"],
    (type, data) => {
      if (!work) return;
      if (data.job.kind !== "approval") return;
      const payload = data.job.payload as ApprovalJobPayload;
      if (payload.workUID !== work.id) return;

      if (type === "job:completed") {
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
      }
      if (type === "job:failed") {
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

  // using shared ConfirmDrawer component

  useEffect(() => {
    let mounted = true;
    const loadMetadata = async () => {
      if (mounted) {
        setMetadataStatus("loading");
        setMetadataError(null);
        setWorkMetadata(null);
      }

      if (!work) {
        if (mounted) {
          setMetadataStatus("idle");
        }
        return;
      }

      const raw = work.metadata;
      if (!raw || typeof raw !== "string") {
        if (mounted) {
          setWorkMetadata(null);
          setMetadataStatus("success");
        }
        return;
      }

      const trimmed = raw.trim();

      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          const parsed = JSON.parse(trimmed) as unknown;
          if (mounted) {
            setWorkMetadata(parsed as WorkMetadata);
            setMetadataStatus("success");
          }
          return;
        } catch (error) {
          if (mounted) {
            debugWarn(
              `[GardenWork] Failed to parse inline metadata for work ${work.id}: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
          // Continue to gateway fetch fallback
        }
      }

      try {
        const file = await getFileByHash(trimmed);
        const data = file.data as unknown as WorkMetadata | null | undefined;
        if (!mounted) return;

        if (data) {
          setWorkMetadata(data);
          setMetadataStatus("success");
        } else {
          setWorkMetadata(null);
          setMetadataStatus("error");
          setMetadataError("Empty metadata response");
          debugWarn(
            `[GardenWork] Received empty metadata response from gateway for work ${work.id}`
          );
        }
      } catch (error) {
        if (!mounted) return;
        const message = error instanceof Error ? error.message : String(error);
        setWorkMetadata(null);
        setMetadataStatus("error");
        setMetadataError(message);
        debugWarn(`[GardenWork] Failed to fetch metadata for work ${work.id}: ${message}`);
      }
    };

    void loadMetadata();
    return () => {
      mounted = false;
    };
  }, [work]);

  const handleBack = () => {
    const from = (location.state as { from?: string } | null | undefined)?.from;
    if (from === "dashboard") {
      navigateToTop("/home");
      return;
    }
    navigateToTop(`/home/${garden?.id ?? ""}`);
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

  // Retry footer for offline work
  const retryFooter =
    isOfflineWork && viewingMode === "gardener" ? (
      <div className="fixed left-0 right-0 bottom-0 bg-warning-lighter border-t border-warning-light p-4 pb-6 z-[100]">
        <div className="max-w-screen-sm mx-auto">
          <p className="text-sm text-warning-dark mb-3 flex items-center gap-2">
            <RiErrorWarningLine className="w-4 h-4 flex-shrink-0" />
            {intl.formatMessage({
              id: "app.home.work.pendingUpload",
              defaultMessage: "This work is pending upload to the blockchain.",
            })}
          </p>
          <Button
            onClick={handleRetry}
            disabled={isRetrying || !navigator.onLine}
            label={
              isRetrying
                ? intl.formatMessage({
                    id: "app.home.work.uploading",
                    defaultMessage: "Uploading...",
                  })
                : intl.formatMessage({
                    id: "app.home.work.uploadNow",
                    defaultMessage: "Upload Now",
                  })
            }
            className="w-full"
            variant="primary"
            mode="filled"
            shape="pilled"
            leadingIcon={
              isRetrying ? (
                <RiLoader4Line className="w-5 h-5 animate-spin" />
              ) : (
                <RiUploadCloudLine className="w-5 h-5" />
              )
            }
          />
          {!navigator.onLine && (
            <p className="text-xs text-warning-base mt-2 text-center">
              {intl.formatMessage({
                id: "app.home.work.offlineNotice",
                defaultMessage: "You're offline. Connect to upload.",
              })}
            </p>
          )}
        </div>
      </div>
    ) : null;

  const approvalFooter =
    viewingMode === "operator" && work.status === "pending" ? (
      <>
        {/* Backdrop - Fades in over content */}
        <div
          className={cn(
            "fixed inset-0 bg-black/40 backdrop-blur-sm z-[190] transition-opacity duration-300",
            feedbackMode ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          )}
          onClick={handleCancelFeedback}
          aria-hidden="true"
        />

        {/* Footer Container */}
        <div className="fixed left-0 right-0 bottom-0 z-[200]">
          {/* Feedback Drawer - Slides up from behind the footer bar */}
          <div
            className={cn(
              "absolute bottom-full left-0 right-0 bg-bg-white-0 rounded-t-2xl shadow-xl overflow-hidden transition-transform duration-300 ease-out origin-bottom",
              feedbackMode ? "translate-y-0" : "translate-y-full"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 space-y-3 max-w-screen-sm mx-auto">
              <div className="flex items-center justify-between">
                <h6 className="text-sm font-medium text-text-strong-950">
                  {feedbackMode === "approve"
                    ? intl.formatMessage({
                        id: "app.home.workApproval.addFeedbackOptional",
                        defaultMessage: "Add Feedback (Optional)",
                      })
                    : intl.formatMessage({
                        id: "app.home.workApproval.addFeedbackRequired",
                        defaultMessage: "Add Feedback (Required)",
                      })}
                </h6>
              </div>

              <textarea
                id="approval-feedback-input"
                value={inlineFeedback}
                onChange={(e) => setInlineFeedback(e.target.value)}
                placeholder={intl.formatMessage({
                  id: "app.home.workApproval.feedbackPlaceholder",
                  defaultMessage: "Add your feedback here...",
                })}
                className="w-full min-h-[120px] p-3 rounded-xl border border-stroke-soft-200 bg-bg-weak-50 text-text-strong-950 placeholder:text-text-soft-400 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            {/* Visual separator */}
            <div className="h-px w-full bg-stroke-soft-200" />
          </div>

          {/* Action Bar - Always visible */}
          <div className="bg-bg-white-0 border-t border-stroke-soft-200 shadow-[0_-4px_16px_rgba(0,0,0,0.12)] p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] relative">
            <div className="max-w-screen-sm mx-auto">
              {/* Button Group - changes based on mode */}
              <div className="flex gap-3">
                {!feedbackMode ? (
                  // Initial state: Approve/Reject
                  <>
                    <Button
                      onClick={handleRejectPress}
                      label={intl.formatMessage({
                        id: "app.home.workApproval.reject",
                        defaultMessage: "Reject",
                      })}
                      className="flex-1 touch-manipulation"
                      variant="error"
                      type="button"
                      shape="pilled"
                      mode="stroke"
                      size="medium"
                      leadingIcon={<RiCloseLine className="w-5 h-5" />}
                      disabled={workApprovalMutation.isPending}
                    />
                    <Button
                      onClick={handleApprovePress}
                      type="button"
                      label={intl.formatMessage({
                        id: "app.home.workApproval.approve",
                        defaultMessage: "Approve",
                      })}
                      className="flex-1 touch-manipulation"
                      variant="primary"
                      mode="filled"
                      size="medium"
                      shape="pilled"
                      leadingIcon={<RiCheckLine className="w-5 h-5" />}
                      disabled={workApprovalMutation.isPending}
                    />
                  </>
                ) : (
                  // Feedback mode: Cancel/Submit
                  <>
                    <Button
                      onClick={handleCancelFeedback}
                      label={intl.formatMessage({
                        id: "app.common.cancel",
                        defaultMessage: "Cancel",
                      })}
                      className="flex-1 touch-manipulation"
                      variant="neutral"
                      type="button"
                      shape="pilled"
                      mode="stroke"
                      size="medium"
                      disabled={workApprovalMutation.isPending}
                    />
                    <Button
                      onClick={handleSubmitApproval}
                      type="button"
                      label={intl.formatMessage({
                        id: "app.common.submit",
                        defaultMessage: "Submit",
                      })}
                      className="flex-1 touch-manipulation"
                      variant={feedbackMode === "reject" ? "error" : "primary"}
                      mode="filled"
                      size="medium"
                      shape="pilled"
                      leadingIcon={
                        feedbackMode === "approve" ? (
                          <RiCheckLine className="w-5 h-5" />
                        ) : (
                          <RiCloseLine className="w-5 h-5" />
                        )
                      }
                      disabled={
                        workApprovalMutation.isPending ||
                        (feedbackMode === "reject" && !inlineFeedback)
                      }
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    ) : null;
  const metadataErrorDetail =
    metadataStatus === "error" && metadataError
      ? intl.formatMessage(
          {
            id: "app.home.work.metadataFallbackNotice.detail",
            defaultMessage: "Details: {message}",
          },
          { message: metadataError }
        )
      : null;

  return (
    <article>
      <TopNav onBackClick={handleBack} overlay />
      {workApprovalMutation.isIdle && (
        <div className={cn("padded pt-20", (retryFooter || approvalFooter) && "pb-8")}>
          {isMetadataLoading ? (
            <WorkViewSkeleton showMedia showActions={false} numDetails={3} />
          ) : (
            <WorkViewSection
              garden={garden}
              work={work}
              workMetadata={workMetadata}
              viewingMode={viewingMode}
              actionTitle={resolvedActionTitle}
              onDownloadData={handleDownloadData}
              onDownloadMedia={hasMedia ? handleDownloadMedia : undefined}
              onShare={handleShare}
              onViewAttestation={canViewAttestation ? handleViewAttestation : undefined}
              footer={retryFooter || approvalFooter}
            />
          )}

          {metadataStatus === "error" && (
            <div className="mt-4 rounded-xl border border-error-light bg-error-lighter px-4 py-3 flex items-start gap-3">
              <RiErrorWarningLine className="w-5 h-5 text-error-base flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-error-dark font-medium">
                  {intl.formatMessage({
                    id: "app.home.work.metadataFallbackNotice",
                    defaultMessage:
                      "We couldn't load all work details from storage. Some fields may be unavailable.",
                  })}
                </p>
                {metadataErrorDetail && (
                  <p className="mt-1 text-xs text-error-base">{metadataErrorDetail}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {workApprovalMutation.isPending && (
        <div className="fixed left-0 right-0 bottom-0 bg-bg-white-0 border-t border-stroke-soft-200 p-4 pb-6 z-[201]">
          <div className="flex items-center justify-center gap-2 text-text-sub-600">
            <RiLoader4Line className="w-5 h-5 animate-spin" />
            <span className="text-sm">
              {intl.formatMessage({ id: "app.common.processing", defaultMessage: "Processing..." })}
            </span>
          </div>
        </div>
      )}
      {!workApprovalMutation.isIdle && (
        <div className="padded">
          <WorkCompleted
            garden={garden}
            status={workApprovalMutation.status}
            mutationData={workApprovalMutation.data}
            messages={{
              success: {
                header: intl.formatMessage(
                  {
                    id: "app.home.workApproval.header",
                    defaultMessage: "You've {status} the work!",
                  },
                  {
                    status: workApprovalMutation.variables?.draft.approved
                      ? intl
                          .formatMessage({
                            id: "app.home.workApproval.approved",
                            defaultMessage: "Approved",
                          })
                          .toLocaleLowerCase()
                      : intl
                          .formatMessage({
                            id: "app.home.workApproval.rejected",
                            defaultMessage: "Rejected",
                          })
                          .toLocaleLowerCase(),
                  }
                ),
                variant: "success",
                title: `${
                  workApprovalMutation.variables?.draft.approved
                    ? intl.formatMessage({
                        id: "app.home.workApproval.approved",
                        defaultMessage: "Approved",
                      })
                    : intl.formatMessage({
                        id: "app.home.workApproval.rejected",
                        defaultMessage: "Rejected",
                      })
                }!`,
                body: intl.formatMessage(
                  {
                    id: "app.home.workApproval.body",
                    defaultMessage: "You've {status} the work!<br/><br/>Excellent work!",
                  },
                  {
                    status: workApprovalMutation.variables?.draft.approved
                      ? intl
                          .formatMessage({
                            id: "app.home.workApproval.approved",
                            defaultMessage: "Approved",
                          })
                          .toLocaleLowerCase()
                      : intl
                          .formatMessage({
                            id: "app.home.workApproval.rejected",
                            defaultMessage: "Rejected",
                          })
                          .toLocaleLowerCase(),
                  }
                ),
                icon: workApprovalMutation.variables?.draft.approved ? RiCheckFill : RiCloseFill,
                spinner: false,
              },
            }}
          />
        </div>
      )}
    </article>
  );
};
