import { cn, type Confidence, ConfidenceSelector } from "@green-goods/shared";
import { RiCheckLine, RiCloseLine } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";

import { Button } from "@/components/Actions";

type WorkApprovalFooterProps = {
  feedbackMode: "approve" | "reject" | null;
  inlineFeedback: string;
  confidence: Confidence;
  isPending: boolean;
  onApprovePress: () => void;
  onRejectPress: () => void;
  onCancelFeedback: () => void;
  onSubmitApproval: () => void;
  onFeedbackChange: (value: string) => void;
  onConfidenceChange: (value: Confidence) => void;
};

export const WorkApprovalFooter: React.FC<WorkApprovalFooterProps> = ({
  feedbackMode,
  inlineFeedback,
  confidence,
  isPending,
  onApprovePress,
  onRejectPress,
  onCancelFeedback,
  onSubmitApproval,
  onFeedbackChange,
  onConfidenceChange,
}) => {
  const intl = useIntl();

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 bg-black/30 backdrop-blur-sm z-[190] transition-opacity duration-300",
          feedbackMode ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onCancelFeedback}
        aria-hidden="true"
      />

      <div className="fixed left-0 right-0 bottom-0 z-[200]">
        <div
          className={cn(
            "absolute bottom-full left-0 right-0 bg-bg-white-0 rounded-t-2xl shadow-xl overflow-hidden transition-transform duration-300 ease-out origin-bottom",
            feedbackMode ? "translate-y-0" : "translate-y-full"
          )}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") onCancelFeedback();
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
                onClick={onCancelFeedback}
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

            {feedbackMode === "approve" && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-text-sub-600 uppercase tracking-wide">
                  {intl.formatMessage({
                    id: "app.home.workApproval.confidence",
                    defaultMessage: "Confidence",
                  })}
                </label>
                <ConfidenceSelector value={confidence} onChange={onConfidenceChange} required />
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
              onChange={(e) => onFeedbackChange(e.target.value)}
              placeholder={intl.formatMessage({
                id: "app.home.workApproval.feedbackPlaceholder",
                defaultMessage: "Add your feedback here...",
              })}
              className="w-full min-h-[120px] p-3 rounded-xl border border-stroke-soft-200 bg-bg-weak-50 text-text-strong-950 placeholder:text-text-soft-400 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div className="h-px w-full bg-stroke-soft-200" />
        </div>

        <div className="bg-bg-white-0 border-t border-stroke-soft-200 shadow-[0_-4px_16px_rgba(0,0,0,0.12)] p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] relative">
          <div className="max-w-screen-sm mx-auto">
            <div className="flex gap-3">
              {!feedbackMode ? (
                <>
                  <Button
                    onClick={onRejectPress}
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
                    disabled={isPending}
                  />
                  <Button
                    onClick={onApprovePress}
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
                    disabled={isPending}
                  />
                </>
              ) : (
                <>
                  <Button
                    onClick={onCancelFeedback}
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
                    disabled={isPending}
                  />
                  <Button
                    onClick={onSubmitApproval}
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
                    disabled={isPending || (feedbackMode === "reject" && !inlineFeedback)}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
