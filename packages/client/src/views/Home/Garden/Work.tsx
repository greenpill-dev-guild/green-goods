import {
  type Address,
  ConfidenceSelector,
  cn,
  DEFAULT_CHAIN_ID,
  downloadWorkData,
  downloadWorkMedia,
  isAddressInList,
  isValidAttestationId,
  jobQueue,
  openEASExplorer,
  isUserAddress as sharedIsUserAddress,
  shareWork,
  toastService,
  useActions,
  useGardens,
  useHasRole,
  useNavigateToTop,
  useUser,
  useWorkApprovalActions,
  useWorkMetadata,
  useWorks,
  type WorkData,
} from "@green-goods/shared";
import {
  RiCheckLine,
  RiCloseLine,
  RiErrorWarningLine,
  RiLoader4Line,
  RiUploadCloudLine,
} from "@remixicon/react";
import React, { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";

import { Button } from "@/components/Actions";
import { WorkViewSkeleton } from "@/components/Features/Work";
import { TopNav } from "@/components/Navigation";
import { WorkViewSection } from "./WorkViewSection";

export const GardenWork: React.FC = () => {
  const intl = useIntl();
  const { id: gardenIdParam, workId } = useParams<{ id: string; workId: string }>();
  const { gardenId: gardenIdFromContext } = (useOutletContext() as { gardenId?: string }) || {};
  const navigateToTop = useNavigateToTop();
  const navigate = useNavigate();
  const location = useLocation();
  const chainId = DEFAULT_CHAIN_ID;
  const { data: gardens = [], isLoading: gardensLoading } = useGardens();
  const gardenId = (gardenIdFromContext || gardenIdParam) as string;
  const garden = gardens.find((g) => g.id === gardenId);
  const { data: actions = [] } = useActions(chainId);
  const { works: mergedWorks } = useWorks(gardenId || "", { offline: true });
  const work = mergedWorks.find((w) => w.id === (workId || ""));

  // Metadata loading (with retry support)
  const {
    metadata: workMetadata,
    status: metadataStatus,
    error: metadataError,
    retryFetch: handleRetryMetadataFetch,
  } = useWorkMetadata(work?.metadata);

  const matchedAction = useMemo(() => {
    if (!work) return null;
    const compositeId = `${chainId}-${work.actionUID}`;
    return actions.find((a) => a.id === compositeId) ?? null;
  }, [actions, chainId, work]);
  const actionTitle = matchedAction?.title ?? null;
  const isActionExpired = matchedAction ? matchedAction.endTime <= Date.now() / 1000 : false;

  const { user, smartAccountClient } = useUser();
  const activeAddress = user?.id;
  const [isRetrying, setIsRetrying] = useState(false);
  const { hasRole: canReviewOnChain } = useHasRole(
    garden?.id as Address | undefined,
    activeAddress as Address | undefined,
    "evaluator"
  );

  // Determine user role and viewing mode
  const viewingMode = useMemo<"operator" | "gardener" | "viewer">(() => {
    if (!garden || !work) return "viewer";

    const isOperator = isAddressInList(activeAddress, garden.operators);
    const canReview = isOperator || canReviewOnChain;
    const isGardener = sharedIsUserAddress(work.gardenerAddress, activeAddress);

    if (canReview) return "operator";
    if (isGardener) return "gardener";
    return "viewer";
  }, [garden, work, activeAddress, canReviewOnChain]);

  // Approval interaction state (extracted to shared hook)
  const {
    feedbackMode,
    inlineFeedback,
    setInlineFeedback,
    confidence,
    setConfidence,
    effectiveStatus,
    handleApprovePress,
    handleRejectPress,
    handleCancelFeedback,
    handleSubmitApproval,
    workApprovalMutation,
  } = useWorkApprovalActions({
    work,
    gardenId: garden?.id,
    chainId,
    viewingMode,
    onApprovalComplete: (gId) => navigateToTop(`/home/${gId || gardenIdParam || ""}`),
  });

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
          title: intl.formatMessage({
            id: "app.home.work.retrySuccess",
            defaultMessage: "Work uploaded successfully",
          }),
          message: intl.formatMessage({
            id: "app.home.work.retrySuccessMessage",
            defaultMessage: "Your work is now on-chain",
          }),
          context: "work upload",
        });
      } else {
        toastService.error({
          title: intl.formatMessage({
            id: "app.home.work.retryFailed",
            defaultMessage: "Upload failed",
          }),
          message:
            result.error ||
            intl.formatMessage({
              id: "app.home.work.retryFailedMessage",
              defaultMessage: "Please try again",
            }),
          context: "work upload",
        });
      }
    } catch (error) {
      toastService.error({
        title: intl.formatMessage({
          id: "app.home.work.retryError",
          defaultMessage: "Failed to retry upload",
        }),
        message:
          error instanceof Error
            ? error.message
            : intl.formatMessage({
                id: "app.home.work.unknownError",
                defaultMessage: "Unknown error",
              }),
        context: "work upload",
      });
    } finally {
      setIsRetrying(false);
    }
  };

  // Build a WorkData object from the current work + metadata context
  const buildWorkData = (): WorkData | null => {
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
  };

  // Helper functions for work actions
  const handleDownloadMedia = async () => {
    const workData = buildWorkData();
    if (!workData) return;
    try {
      await downloadWorkMedia(workData);
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
    const workData = buildWorkData();
    if (!workData) return;
    try {
      downloadWorkData(workData);
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
    const workData = buildWorkData();
    if (!workData) return;
    try {
      await shareWork(workData);
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

  const handleBack = () => {
    const state = (location.state as { from?: string; returnTo?: string } | null | undefined) ?? {};
    const from = state.from;
    if (from === "dashboard") {
      navigateToTop("/home");
      return;
    }
    if (state.returnTo) {
      navigateToTop(state.returnTo);
      return;
    }
    // Always navigate to the garden if we have a gardenId, rather than
    // relying on browser history which may go to /home instead
    if (gardenId) {
      navigateToTop(`/home/${gardenId}`);
      return;
    }
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigateToTop("/home");
  };

  if (!work)
    return (
      <article>
        <TopNav onBackClick={handleBack} />
        <div className="padded">
          {gardensLoading ? (
            <WorkViewSkeleton showMedia showActions={false} numDetails={3} />
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <p className="text-sm text-text-sub-600">
                {intl.formatMessage({
                  id: "app.home.work.notFound",
                  defaultMessage: "Work submission not found.",
                })}
              </p>
            </div>
          )}
        </div>
      </article>
    );

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
      <div className="fixed left-0 right-0 bottom-0 bg-warning-lighter border-t border-warning-light p-4 pb-6 z-sticky">
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
    viewingMode === "operator" && effectiveStatus === "pending" ? (
      <>
        {/* Backdrop - Fades in over content */}
        <div
          className={cn(
            "fixed inset-0 bg-black/30 backdrop-blur-sm z-overlay transition-opacity duration-300",
            feedbackMode ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          )}
          onClick={handleCancelFeedback}
          aria-hidden="true"
        />

        {/* Footer Container */}
        <div className="fixed left-0 right-0 bottom-0 z-modal">
          {/* Feedback Drawer - Slides up from behind the footer bar */}
          <div
            className={cn(
              "absolute bottom-full left-0 right-0 bg-bg-white-0 rounded-t-2xl shadow-xl overflow-hidden transition-transform duration-300 ease-out origin-bottom",
              feedbackMode ? "translate-y-0" : "translate-y-full"
            )}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") handleCancelFeedback();
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-drawer-title"
            aria-describedby="feedback-drawer-description"
          >
            <div className="p-4 space-y-3 max-w-screen-sm mx-auto overflow-y-auto max-h-[60vh]">
              <div className="flex items-center justify-between">
                <h2 id="feedback-drawer-title" className="text-sm font-medium text-text-strong-950">
                  {feedbackMode === "approve"
                    ? intl.formatMessage({
                        id: "app.home.workApproval.addFeedbackOptional",
                        defaultMessage: "Add Feedback (Optional)",
                      })
                    : intl.formatMessage({
                        id: "app.home.workApproval.addFeedbackRequired",
                        defaultMessage: "Add Feedback (Required)",
                      })}
                </h2>
                <button
                  type="button"
                  onClick={handleCancelFeedback}
                  className="p-1 rounded-md text-text-soft-400 hover:text-text-strong-950 focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label={intl.formatMessage({
                    id: "app.home.workApproval.closeFeedback",
                    defaultMessage: "Close feedback",
                  })}
                >
                  <RiCloseLine className="w-5 h-5" />
                </button>
              </div>

              <p id="feedback-drawer-description" className="sr-only">
                {intl.formatMessage({
                  id: "app.home.workApproval.feedbackDescription",
                  defaultMessage: "Enter your feedback for this work submission.",
                })}
              </p>

              {/* Confidence selector — above feedback, required for approvals */}
              {feedbackMode === "approve" && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text-sub-600 uppercase tracking-wide">
                    {intl.formatMessage({
                      id: "app.home.workApproval.confidence",
                      defaultMessage: "Confidence",
                    })}
                  </label>
                  <ConfidenceSelector value={confidence} onChange={setConfidence} required />
                </div>
              )}

              <label htmlFor="approval-feedback-input" className="sr-only">
                {intl.formatMessage({
                  id: "app.home.workApproval.feedbackLabel",
                  defaultMessage: "Feedback",
                })}
              </label>
              <textarea
                id="approval-feedback-input"
                value={inlineFeedback}
                onChange={(e) => setInlineFeedback(e.target.value)}
                placeholder={intl.formatMessage({
                  id: "app.home.workApproval.feedbackPlaceholder",
                  defaultMessage: "Add your feedback here...",
                })}
                className="w-full min-h-[120px] max-h-[40vh] p-3 rounded-xl border border-stroke-soft-200 bg-bg-weak-50 text-text-strong-950 placeholder:text-text-soft-400 focus:outline-none focus:ring-2 focus:ring-primary resize-none overflow-y-auto [touch-action:pan-y] [overscroll-behavior-y:auto]"
              />
            </div>

            {/* Visual separator */}
            <div className="h-px w-full bg-stroke-soft-200" />
          </div>

          {/* Action Bar - Always visible */}
          <div className="bg-bg-white-0 border-t border-stroke-soft-200 shadow-[0_-4px_16px_rgba(0,0,0,0.12)] p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] relative">
            <div className="max-w-screen-sm mx-auto">
              {/* Action expiry notice */}
              {isActionExpired && (
                <p className="text-xs text-warning-dark mb-2 text-center">
                  {intl.formatMessage({
                    id: "app.home.workApproval.actionExpired",
                    defaultMessage: "This action has ended. Approval may fail on-chain.",
                  })}
                </p>
              )}
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
                      disabled={workApprovalMutation.isPending || isActionExpired}
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
                      disabled={workApprovalMutation.isPending || isActionExpired}
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

  // Success footer shows when work has been approved/rejected (on-chain resolved only)
  const isResolved = effectiveStatus === "approved" || effectiveStatus === "rejected";
  const successFooter =
    viewingMode === "operator" && isResolved ? (
      <div className="fixed left-0 right-0 bottom-0 z-sticky">
        <div className="bg-bg-white-0 border-t border-stroke-soft-200 p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <div className="max-w-screen-sm mx-auto flex items-center justify-center gap-2">
            {effectiveStatus === "approved" ? (
              <RiCheckLine className="w-5 h-5 text-success-base" />
            ) : (
              <RiCloseLine className="w-5 h-5 text-error-base" />
            )}
            <span
              className={cn(
                "text-sm font-medium",
                effectiveStatus === "approved" ? "text-success-base" : "text-error-base"
              )}
            >
              {effectiveStatus === "approved"
                ? intl.formatMessage({
                    id: "app.home.workApproval.approved",
                    defaultMessage: "Work Approved",
                  })
                : intl.formatMessage({
                    id: "app.home.workApproval.rejected",
                    defaultMessage: "Work Rejected",
                  })}
            </span>
          </div>
        </div>
      </div>
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
      <div className="padded pt-20">
        <WorkViewSection
          garden={garden}
          work={work}
          workMetadata={workMetadata}
          metadataStatus={metadataStatus}
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
              <button
                type="button"
                onClick={handleRetryMetadataFetch}
                className="mt-2 text-xs font-medium text-error-dark underline underline-offset-2 hover:text-error-base"
              >
                {intl.formatMessage({
                  id: "app.home.work.retryMetadataLoad",
                  defaultMessage: "Retry loading details",
                })}
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
};
