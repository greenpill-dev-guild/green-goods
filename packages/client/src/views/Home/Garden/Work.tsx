import { Alert } from "@green-goods/shared/components/Alert";
import { ConfidenceSelector } from "@green-goods/shared/components/Form/ConfidenceSelector";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { useWorkDetailController } from "@green-goods/shared/hooks/client-ui/work/useWorkDetailController";
import {
  RiCheckLine,
  RiCloseLine,
  RiErrorWarningLine,
  RiLoader4Line,
  RiUploadCloudLine,
} from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";

import { Button } from "@/components/Actions";
import { WorkViewSkeleton } from "@/components/Features/Work";
import { TopNav } from "@/components/Navigation";
import { pwaDrawerStyles } from "@/components/Pwa/drawerStyles";
import { WorkFulfills } from "./WorkFulfills";
import { WorkViewSection } from "./WorkViewSection";

export const GardenWork: React.FC = () => {
  const intl = useIntl();
  const {
    actionTitle,
    back: handleBack,
    canViewAttestation,
    chainId,
    downloadData: handleDownloadData,
    downloadMedia: handleDownloadMedia,
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
    isActionExpired,
    isOfflineWork,
    isOnline,
    isRetrying,
    gardensLoading,
    garden,
    gardenId,
    metadataError,
    metadataStatus,
    onChainWorkId,
    retry: handleRetry,
    retryMetadata: handleRetryMetadataFetch,
    share: handleShare,
    viewAttestation: handleViewAttestation,
    viewingMode,
    work,
    workMetadata,
    workApprovalMutation,
  } = useWorkDetailController();

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

  // Retry footer for offline work
  const retryFooter =
    isOfflineWork && viewingMode === "gardener" ? (
      <Alert
        variant="warning"
        className="fixed left-0 right-0 bottom-0 z-sticky overflow-hidden rounded-t-[var(--radius-lg)] border-t p-4 pb-6"
      >
        <div className="max-w-screen-sm mx-auto">
          <p className="text-sm text-warning-dark mb-3 flex items-center gap-2">
            <RiErrorWarningLine className="w-4 h-4 flex-shrink-0" />
            {intl.formatMessage({
              id: "app.home.work.pendingUpload",
              defaultMessage:
                "Saved on your device — we'll send it to the garden record when you're online.",
            })}
          </p>
          <Button
            onClick={handleRetry}
            disabled={isRetrying || !isOnline}
            label={
              isRetrying
                ? intl.formatMessage({
                    id: "app.home.work.uploading",
                    defaultMessage: "Sending...",
                  })
                : intl.formatMessage({
                    id: "app.home.work.uploadNow",
                    defaultMessage: "Send now",
                  })
            }
            className="w-full"
            variant="primary"
            mode="filled"
            shape="regular"
            leadingIcon={
              isRetrying ? (
                <RiLoader4Line className="w-5 h-5 animate-spin" />
              ) : (
                <RiUploadCloudLine className="w-5 h-5" />
              )
            }
          />
          {!isOnline && (
            <p className="text-xs text-warning-base mt-2 text-center">
              {intl.formatMessage({
                id: "app.home.work.offlineNotice",
                defaultMessage: "You're offline. We'll send this when you reconnect.",
              })}
            </p>
          )}
        </div>
      </Alert>
    ) : null;

  const approvalFooter =
    viewingMode === "steward" && effectiveStatus === "pending" ? (
      <>
        {/* Backdrop - Fades in over content */}
        <div
          className={cn(
            pwaDrawerStyles.dialogOverlay,
            pwaDrawerStyles.overlayTransition,
            feedbackMode ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          )}
          onClick={handleCancelFeedback}
          aria-hidden="true"
        />

        {/* Footer Container */}
        <div className="fixed left-0 right-0 bottom-0 z-modal">
          {/* Feedback Drawer - Slides up from behind the footer bar */}
          <div // eslint-disable-line jsx-a11y/no-noninteractive-element-interactions -- dialog surface; handler stops propagation and closes on Escape
            className={cn(
              pwaDrawerStyles.workFeedbackDrawer,
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
                  className={cn("p-1", pwaDrawerStyles.workCloseButton)}
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
          <div
            className={cn(
              pwaDrawerStyles.workActionBar,
              "p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] relative"
            )}
          >
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
              {/* Offline notice — approval is queued, not committed, until reconnect */}
              {!isOnline && (
                <p className="text-xs text-warning-dark mb-2 text-center">
                  {intl.formatMessage({
                    id: "app.home.workApproval.offline",
                    defaultMessage:
                      "You're offline. Your decision will be sent when you reconnect.",
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
                      shape="regular"
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
                      shape="regular"
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
                      shape="regular"
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
                      shape="regular"
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
    viewingMode === "steward" && isResolved ? (
      <div className="fixed left-0 right-0 bottom-0 z-sticky">
        <div className="bg-bg-white-0 border-t border-stroke-soft-200 rounded-t-[var(--radius-lg)] overflow-hidden p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
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
          fulfills={<WorkFulfills chainId={chainId} workUID={onChainWorkId} gardenId={gardenId} />}
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
