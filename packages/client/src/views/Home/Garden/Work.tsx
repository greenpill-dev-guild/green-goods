import { Button } from "@green-goods/shared/components/Button";
import { SheetHeader } from "@green-goods/shared/components/Dialog/SheetHeader";
import { SheetHeading } from "@green-goods/shared/components/Dialog/SheetHeading";
import { ConfidenceSelector } from "@green-goods/shared/components/Form/ConfidenceSelector";
import { Textarea } from "@green-goods/shared/components/Form/ControlPrimitives";
import { useWorkDetailController } from "@green-goods/shared/hooks/client-ui/work/useWorkDetailController";
import { useQueuedWorkActions } from "@green-goods/shared/hooks/work/useQueuedWorkActions";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiCheckLine, RiCloseLine, RiErrorWarningLine } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";

import { WorkViewSkeleton } from "@/components/Features/Work";
import { TopNav } from "@/components/Navigation";
import { pwaSheetStyles } from "@/components/Pwa/sheetStyles";
import { WorkFulfills } from "./WorkFulfills";
import { WorkUploadFooter } from "./WorkUploadFooter";
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
  const queuedWork = useQueuedWorkActions(isOfflineWork ? work?.id : undefined);

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
      defaultMessage: "Unknown action",
    });

  // The gardener's own queued work: where it stands and what they can do about it.
  const retryFooter =
    isOfflineWork && viewingMode === "gardener" ? (
      <WorkUploadFooter
        work={work}
        isOnline={isOnline}
        onRetry={handleRetry}
        isRetrying={isRetrying}
        onOpenUploads={queuedWork.openUploads}
        onTryAgain={queuedWork.tryAgain}
        isTryingAgain={queuedWork.isTryingAgain}
        onDiscard={async () => {
          if (await queuedWork.discard()) handleBack();
        }}
        isDiscarding={queuedWork.isDiscarding}
      />
    ) : null;

  const approvalFooter =
    viewingMode === "steward" && effectiveStatus === "pending" ? (
      <>
        {/* Backdrop - Fades in over content */}
        <div
          className={cn(
            pwaSheetStyles.dialogOverlay,
            pwaSheetStyles.overlayTransition,
            feedbackMode ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          )}
          onClick={handleCancelFeedback}
          aria-hidden="true"
        />

        {/* Footer Container */}
        <div className="fixed left-0 right-0 bottom-0 z-modal">
          {/* Feedback Drawer - Slides up from behind the footer bar */}
          <div // eslint-disable-line jsx-a11y/no-noninteractive-element-interactions -- dialog surface; handler stops propagation and closes on Escape
            data-testid="work-feedback-sheet"
            className={cn(
              pwaSheetStyles.workFeedbackSheet,
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
            {/* The drawer caps at the half height; its header stays put while the fields scroll. */}
            <div className="mx-auto flex max-h-[50dvh] max-w-screen-sm flex-col">
              <SheetHeader
                standalone
                title={intl.formatMessage({
                  id: "app.home.workApproval.feedbackTitle",
                  defaultMessage: "Add Feedback",
                })}
                titleId="feedback-drawer-title"
                description={
                  feedbackMode === "approve"
                    ? intl.formatMessage({
                        id: "app.home.workApproval.feedbackApproveDescription",
                        defaultMessage: "Optional when you approve.",
                      })
                    : intl.formatMessage({
                        id: "app.home.workApproval.feedbackRejectDescription",
                        defaultMessage: "Required when you reject work.",
                      })
                }
                descriptionId="feedback-drawer-description"
                closeLabel={intl.formatMessage({ id: "app.common.close", defaultMessage: "Close" })}
                onClose={handleCancelFeedback}
                closeTestId="work-feedback-close"
              />
              <div className="min-h-0 space-y-3 overflow-y-auto px-4 pb-4">
                {/* Confidence selector — above feedback, required for approvals */}
                {feedbackMode === "approve" && (
                  <div className="space-y-2">
                    <SheetHeading as="label" className="block">
                      {intl.formatMessage({
                        id: "app.home.workApproval.confidence",
                        defaultMessage: "Confidence",
                      })}
                    </SheetHeading>
                    <ConfidenceSelector value={confidence} onChange={setConfidence} required />
                  </div>
                )}

                <label htmlFor="approval-feedback-input" className="sr-only">
                  {intl.formatMessage({
                    id: "app.home.workApproval.feedbackLabel",
                    defaultMessage: "Feedback",
                  })}
                </label>
                <Textarea
                  id="approval-feedback-input"
                  value={inlineFeedback}
                  onChange={(e) => setInlineFeedback(e.target.value)}
                  placeholder={intl.formatMessage({
                    id: "app.home.workApproval.feedbackPlaceholder",
                    defaultMessage:
                      "Add feedback for the gardener (optional for approval, required for rejection)...",
                  })}
                  className="min-h-[120px] resize-none overflow-y-auto [touch-action:pan-y] [overscroll-behavior-y:auto]"
                />
              </div>
            </div>

            {/* Visual separator */}
            <div className="h-px w-full bg-stroke-soft-200" />
          </div>

          {/* Action Bar - Always visible */}
          <div
            data-testid="work-approval-action-bar"
            className={cn(
              pwaSheetStyles.workActionBar,
              !feedbackMode && pwaSheetStyles.workActionBarStandalone,
              "p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] relative"
            )}
          >
            <div className="max-w-screen-sm mx-auto">
              {/* Action expiry notice */}
              {isActionExpired && (
                <p className="text-xs text-warning-dark mb-2 text-center">
                  {intl.formatMessage({
                    id: "app.home.workApproval.actionExpired",
                    defaultMessage: "This action has expired",
                  })}
                </p>
              )}
              {/* Offline notice — approval is queued, not committed, until reconnect */}
              {!isOnline && (
                <p className="text-xs text-warning-dark mb-2 text-center">
                  {intl.formatMessage({
                    id: "app.home.workApproval.offline",
                    defaultMessage:
                      "You're offline. Your decision stays on this device until you upload it from Your Work.",
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
                      className="flex-1 touch-manipulation"
                      emphasis="secondary"
                      tone="danger"
                      type="button"
                      size="lg"
                      leadingIcon={<RiCloseLine className="h-5 w-5" aria-hidden="true" />}
                      disabled={workApprovalMutation.isPending || isActionExpired}
                    >
                      {intl.formatMessage({
                        id: "app.home.workApproval.reject",
                        defaultMessage: "Reject",
                      })}
                    </Button>
                    <Button
                      onClick={handleApprovePress}
                      type="button"
                      className="flex-1 touch-manipulation"
                      size="lg"
                      leadingIcon={<RiCheckLine className="h-5 w-5" aria-hidden="true" />}
                      disabled={workApprovalMutation.isPending || isActionExpired}
                    >
                      {intl.formatMessage({
                        id: "app.home.workApproval.approve",
                        defaultMessage: "Approve",
                      })}
                    </Button>
                  </>
                ) : (
                  // Feedback mode: Cancel/Submit
                  <>
                    <Button
                      onClick={handleCancelFeedback}
                      className="flex-1 touch-manipulation"
                      emphasis="secondary"
                      type="button"
                      size="lg"
                      disabled={workApprovalMutation.isPending}
                    >
                      {intl.formatMessage({
                        id: "app.common.cancel",
                        defaultMessage: "Cancel",
                      })}
                    </Button>
                    <Button
                      onClick={handleSubmitApproval}
                      type="button"
                      className="flex-1 touch-manipulation"
                      tone={feedbackMode === "reject" ? "danger" : "default"}
                      size="lg"
                      leadingIcon={
                        feedbackMode === "approve" ? (
                          <RiCheckLine className="h-5 w-5" aria-hidden="true" />
                        ) : (
                          <RiCloseLine className="h-5 w-5" aria-hidden="true" />
                        )
                      }
                      loading={workApprovalMutation.isPending}
                      disabled={
                        !workApprovalMutation.isPending &&
                        feedbackMode === "reject" &&
                        !inlineFeedback
                      }
                    >
                      {intl.formatMessage({
                        id: "app.common.submit",
                        defaultMessage: "Submit",
                      })}
                    </Button>
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
                    defaultMessage: "Approved",
                  })
                : intl.formatMessage({
                    id: "app.home.workApproval.rejected",
                    defaultMessage: "Rejected",
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

        {metadataStatus === "unavailable" && (
          <p role="status" className="mt-4 text-sm text-text-sub-600">
            {intl.formatMessage({
              id: "app.offline.detailsUnavailable",
              defaultMessage: "These details haven’t been downloaded. Connect to load them.",
            })}
          </p>
        )}
        {metadataStatus === "error" && (
          <div className="mt-4 rounded-xl border border-error-light bg-error-lighter px-4 py-3 flex items-start gap-3">
            <RiErrorWarningLine className="w-5 h-5 text-error-base flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-error-dark font-medium">
                {intl.formatMessage({
                  id: "app.home.work.metadataFallbackNotice",
                  defaultMessage:
                    "We couldn't load all of this work's details. Some fields may be unavailable.",
                })}
              </p>
              {metadataErrorDetail && (
                <p className="mt-1 text-xs text-error-base">{metadataErrorDetail}</p>
              )}
              <Button
                type="button"
                emphasis="tertiary"
                tone="danger"
                size="compact"
                onClick={handleRetryMetadataFetch}
                className="mt-2"
              >
                {intl.formatMessage({
                  id: "app.home.work.retryMetadataLoad",
                  defaultMessage: "Retry Loading Details",
                })}
              </Button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
};
