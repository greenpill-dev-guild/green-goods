import { AudioRecorder } from "@green-goods/shared/components/Audio/AudioRecorder";
import { Button } from "@green-goods/shared/components/Button";
import { ErrorBoundary } from "@green-goods/shared/components/ErrorBoundary/ErrorBoundary";
import { ConfidenceSelector } from "@green-goods/shared/components/Form/ConfidenceSelector";
import { Textarea } from "@green-goods/shared/components/Form/ControlPrimitives";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { usePrimaryAddress } from "@green-goods/shared/hooks/auth/usePrimaryAddress";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import { TxHoldFeedback } from "@green-goods/shared/components/feedback/TxInlineFeedback";
import { useReviewBatch, useWorkApproval } from "@green-goods/shared/hooks/work/useWorkApproval";
import { logger } from "@green-goods/shared/modules/app/logger";
import {
  Confidence,
  VerificationMethod,
  type Work,
  type WorkApprovalDraft,
} from "@green-goods/shared/types/domain";
import { compareAddresses } from "@green-goods/shared/utils/blockchain/address";
import { parseAndFormatError } from "@green-goods/shared/utils/errors/contract-errors";
import { toWorkDisplayTitle } from "@green-goods/shared/utils/work/workTitles";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useIntl } from "react-intl";
import { localizeCanonicalActionTitle } from "@/components/Action/actionDisplay";
import { AdminReasonDialog } from "@/components/AdminReasonDialog";
import { formatEnsAddressName } from "@/components/EnsAddressText";
import {
  ReviewSummary,
  reviewFormState,
  uploadReviewNotes,
  type WorkApprovalFormData,
  workApprovalSchema,
} from "./helpers";
import { StagedReviewNotice } from "./StagedReviewNotice";

const REJECT_REASON_SUGGESTION_IDS = [
  "app.work.detail.rejectDialog.suggestion.photos",
  "app.work.detail.rejectDialog.suggestion.details",
  "app.work.detail.rejectDialog.suggestion.action",
];

interface ReviewFormProps {
  work: Work;
  gardenName: string;
  actionSlug?: string;
  actionEndTime?: number;
  canReview: boolean;
  canApproveOrReject: boolean;
  isReviewed: boolean;
  layout?: "page" | "sheet";
  onSuccess?: (approved: boolean) => void;
}

export function ReviewForm({
  work,
  gardenName,
  actionEndTime,
  canReview,
  canApproveOrReject,
  isReviewed,
  layout = "page",
  onSuccess,
}: ReviewFormProps) {
  const { formatMessage } = useIntl();
  const primaryAddress = usePrimaryAddress();
  const { data: gardenerEnsName } = useEnsName(work.gardenerAddress);
  const { data: gardenerProtocolName } = useGreenGoodsEnsName(work.gardenerAddress);
  const gardenerDisplayName = formatEnsAddressName(
    work.gardenerAddress,
    gardenerProtocolName || gardenerEnsName
  );

  const workTitle = localizeCanonicalActionTitle(
    toWorkDisplayTitle(work.title, formatMessage({ id: "app.admin.work.untitledWork" })),
    formatMessage
  );

  const isActionExpired = typeof actionEndTime === "number" && actionEndTime < Date.now();
  const isOwnSubmission = compareAddresses(primaryAddress, work.gardenerAddress);

  const { control, watch, getValues, setValue } = useForm<WorkApprovalFormData>({
    resolver: zodResolver(workApprovalSchema),
    defaultValues: {
      confidence: Confidence.NONE,
      verificationMethod: VerificationMethod.HUMAN,
      feedback: "",
    },
  });

  const confidence = watch("confidence");
  // Approve waits for a confidence level; nothing is chosen until the steward picks one.
  const needsConfidence = confidence < Confidence.LOW;

  // Audio recording state
  const [reviewAudioFile, setReviewAudioFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<"approve" | "reject" | "batch" | null>(
    null
  );
  const [isRejectDialogOpen, setRejectDialogOpen] = useState(false);

  const approvalMutation = useWorkApproval();
  const reviewBatch = useReviewBatch(work.gardenAddress);
  const stagedReview = reviewBatch.reviewFor(work.id);
  const isHeld = reviewBatch.isHeld(work.id);
  // Sending from here skips the journal, so it waits to learn whether this work is held. It also
  // shares the batch's lock, which would hand it the batch's result as its own.
  const isDecisionPaused = isSubmitting || reviewBatch.isSettlingHold || reviewBatch.isSending;

  /**
   * Sends the decision, or keeps it for the batch. A rejection always carries
   * the steward's reason as its feedback (DL-048); an approval keeps the
   * optional Feedback field. An audio note uploads now either way, so a batch
   * keeps only its link. Resolves false when nothing was sent or kept, so the
   * reason dialog stays open for a retry.
   */
  const handleApprovalSubmit = async (
    approved: boolean,
    reason?: string,
    toBatch = false
  ): Promise<boolean> => {
    // Validate form data manually since approval/rejection isn't a form field
    const formData = {
      confidence: approved ? confidence : Confidence.NONE,
      verificationMethod: approved ? VerificationMethod.HUMAN : 0,
      feedback: approved ? getValues("feedback") : reason,
    };

    // An approval needs a confidence level; a rejection needs a reason.
    if (approved ? formData.confidence < Confidence.LOW : !formData.feedback) return false;

    setSubmittingAction(toBatch ? "batch" : approved ? "approve" : "reject");
    setIsSubmitting(true);

    try {
      // Build review notes CID if audio exists
      let reviewNotesCID: string | undefined;

      if (reviewAudioFile) {
        try {
          reviewNotesCID = await uploadReviewNotes(reviewAudioFile, formData.feedback || "");
        } catch (uploadError) {
          logger.error("Failed to upload review notes to IPFS", {
            error: uploadError,
            source: "WorkDetail",
          });
          // Show user-facing error so the failure isn't silent
          toastService.error({
            title: formatMessage({ id: "app.toast.approval.errorDecision.title" }),
            message: formatMessage({ id: "app.toast.approval.errorWallet.message" }),
          });
          setIsSubmitting(false);
          setSubmittingAction(null);
          return false;
        }
      }

      const draft: WorkApprovalDraft = {
        actionUID: work.actionUID,
        workUID: work.id,
        approved,
        feedback: formData.feedback || undefined,
        confidence: approved ? formData.confidence : Confidence.NONE,
        verificationMethod: approved ? formData.verificationMethod : 0,
        reviewNotesCID,
      };

      if (toBatch) reviewBatch.stage(draft);
      else await approvalMutation.mutateAsync({ draft, work });

      onSuccess?.(approved);
      return true;
    } catch (error) {
      const { message: formattedMessage, parsed } = parseAndFormatError(error);

      logger.error("Work approval submission failed", {
        error,
        source: "WorkDetail",
      });

      const localizedKnownMessage = parsed.messageKey
        ? [
            formatMessage({ id: parsed.messageKey, defaultMessage: parsed.message }),
            parsed.actionKey
              ? formatMessage({
                  id: parsed.actionKey,
                  defaultMessage: parsed.action ?? "",
                })
              : parsed.action,
          ]
            .filter(Boolean)
            .join(". ")
        : formattedMessage;
      toastService.error({
        title: formatMessage({ id: "app.toast.approval.errorDecision.title" }),
        message: parsed.isKnown
          ? localizedKnownMessage
          : formatMessage({ id: "app.toast.approval.errorWallet.message" }),
      });
      return false;
    } finally {
      setIsSubmitting(false);
      setSubmittingAction(null);
    }
  };

  const finishReject = async (reason: string, toBatch: boolean) => {
    if (await handleApprovalSubmit(false, reason, toBatch)) setRejectDialogOpen(false);
  };

  // The batch kept the words, so they come back. A recording only stays if this form still holds it.
  const handleRemoveFromBatch = () => {
    if (!stagedReview) return;
    const { approved, confidence, feedback } = stagedReview.draft;
    if (approved) setValue("confidence", confidence);
    setValue("feedback", feedback ?? "");
    reviewBatch.unstage(work.id);
  };

  const blockedState = reviewFormState({
    isReviewed,
    isHeld,
    isStaged: Boolean(stagedReview),
    isOwnSubmission,
    isActionExpired,
    canReview,
    canApproveOrReject,
  });

  return (
    <div className={layout === "page" ? "lg:col-span-2" : undefined}>
      <div className={layout === "page" ? "lg:sticky lg:top-24" : undefined}>
        <ErrorBoundary context="WorkDetail.ReviewForm">
          <section className="surface-inset sm:p-6">
            <h3 className="type-title-md font-semibold text-text-strong">
              {blockedState === "reviewed"
                ? formatMessage({ id: "app.work.detail.reviewSummary" })
                : formatMessage({ id: "app.work.detail.stewardReview" })}
            </h3>

            {blockedState === "reviewed" ? (
              <ReviewSummary work={work} />
            ) : blockedState === "held" ? (
              reviewBatch.holdFeedback && (
                <TxHoldFeedback {...reviewBatch.holdFeedback} className="mt-4" />
              )
            ) : blockedState === "staged" && stagedReview ? (
              <StagedReviewNotice
                review={stagedReview}
                disabled={reviewBatch.isSending}
                onRemove={handleRemoveFromBatch}
              />
            ) : blockedState === "self-review" ? (
              <div className="mt-4 rounded-xl border border-information-light bg-information-lighter p-4">
                <p className="type-body font-medium text-information-dark">
                  {formatMessage({
                    id: "app.work.detail.reviewBlocked.selfReviewTitle",
                    defaultMessage: "Independent review required",
                  })}
                </p>
                <p className="mt-1 type-body text-information-dark">
                  {formatMessage({
                    id: "app.work.detail.reviewBlocked.selfReviewMessage",
                    defaultMessage:
                      "You submitted this work. Another garden steward must approve or reject it.",
                  })}
                </p>
              </div>
            ) : blockedState === "expired" ? (
              <div className="mt-4 rounded-xl border border-warning-light bg-warning-lighter/70 p-4">
                <p className="type-body font-medium text-warning-dark">
                  {formatMessage({
                    id: "app.work.detail.reviewBlocked.expiredTitle",
                    defaultMessage: "Action expired",
                  })}
                </p>
                <p className="mt-1 type-body text-warning-dark">
                  {formatMessage({
                    id: "app.work.detail.reviewBlocked.expiredMessage",
                    defaultMessage:
                      "This action is no longer active, so new approval decisions are blocked.",
                  })}
                </p>
              </div>
            ) : blockedState === "role-blocked" ? (
              <div className="mt-4 rounded-xl border border-information-light bg-information-lighter p-4">
                <p className="type-body font-medium text-information-dark">
                  {formatMessage({
                    id: "app.work.detail.reviewBlocked.stewardTitle",
                    defaultMessage: "Owner or steward access required",
                  })}
                </p>
                <p className="mt-1 type-body text-information-dark">
                  {formatMessage({
                    id: "app.work.detail.reviewBlocked.stewardMessage",
                    defaultMessage:
                      "Only garden owners or stewards can approve or reject work for this garden.",
                  })}
                </p>
              </div>
            ) : blockedState === "actionable" ? (
              <form onSubmit={(e) => e.preventDefault()} className="mt-4 space-y-5">
                {/* Confidence Selector */}
                <div>
                  <span
                    className="mb-1.5 block type-body font-medium text-text-strong"
                    id="confidence-label"
                  >
                    {formatMessage({ id: "app.work.detail.confidenceLevel" })}
                    <span className="ml-1 type-label-sm text-text-soft">
                      ({formatMessage({ id: "app.work.detail.requiredForApproval" })})
                    </span>
                  </span>
                  <Controller
                    name="confidence"
                    control={control}
                    render={({ field }) => (
                      <ConfidenceSelector
                        value={field.value}
                        onChange={field.onChange}
                        required
                        aria-labelledby="confidence-label"
                      />
                    )}
                  />
                  {needsConfidence ? (
                    <p className="mt-1.5 type-meta text-text-soft" data-slot="approval-hint">
                      {formatMessage({ id: "app.work.detail.hint.lowConfidence" })}
                    </p>
                  ) : null}
                </div>

                {/* Feedback textarea */}
                <div>
                  <label
                    htmlFor="feedback"
                    className="mb-1.5 block type-body font-medium text-text-strong"
                  >
                    {formatMessage({ id: "app.work.detail.feedback" })}
                    <span className="ml-1 type-label-sm text-text-soft">
                      ({formatMessage({ id: "app.common.optional" })})
                    </span>
                  </label>
                  <Controller
                    name="feedback"
                    control={control}
                    render={({ field }) => (
                      <Textarea
                        surface="admin"
                        {...field}
                        id="feedback"
                        rows={3}
                        placeholder={formatMessage({
                          id: "app.work.detail.feedbackPlaceholder",
                        })}
                      />
                    )}
                  />
                </div>

                {/* Audio Recorder */}
                <div>
                  <span className="mb-1.5 block type-body font-medium text-text-strong">
                    {formatMessage({ id: "app.work.detail.audioReviewNote" })}
                    <span className="ml-1 type-label-sm text-text-soft">
                      ({formatMessage({ id: "app.common.optional" })})
                    </span>
                  </span>
                  {reviewAudioFile ? (
                    <div className="flex items-center gap-2">
                      <span
                        className="flex-1 truncate type-body text-text-sub"
                        title={reviewAudioFile.name}
                      >
                        {reviewAudioFile.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setReviewAudioFile(null)}
                        className="type-meta text-error-base hover:text-error-dark"
                      >
                        {formatMessage({ id: "app.common.remove" })}
                      </button>
                    </div>
                  ) : (
                    <AudioRecorder onRecordingComplete={(file) => setReviewAudioFile(file)} />
                  )}
                </div>

                {/* Cascade awareness — who this decision affects */}
                <div className="rounded-md border border-information-light bg-information-lighter p-3">
                  <p className="type-meta text-information-dark">
                    <span className="font-medium">
                      {formatMessage({
                        id: "app.work.detail.cascade.heading",
                        defaultMessage: "Who this affects",
                      })}
                    </span>
                    {" — "}
                    {formatMessage(
                      {
                        id: "app.work.detail.cascade.notice",
                        defaultMessage:
                          "{gardener} will see this decision. This counts toward {garden}'s impact record.",
                      },
                      {
                        gardener: gardenerDisplayName,
                        garden: gardenName,
                      }
                    )}
                  </p>
                </div>

                {/* Decision row — M3 button hierarchy: Reject reads clearly
                    destructive but secondary (outlined, error color role);
                    Approve is the filled primary and sits rightmost. */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  {reviewBatch.available ? (
                    <Button
                      type="button"
                      emphasis="secondary"
                      size="sm"
                      onClick={() => void handleApprovalSubmit(true, undefined, true)}
                      disabled={isDecisionPaused || needsConfidence}
                      loading={isSubmitting && submittingAction === "batch"}
                      data-action="add-to-batch"
                    >
                      {formatMessage({ id: "app.work.batch.add" })}
                    </Button>
                  ) : null}
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      type="button"
                      emphasis="secondary"
                      tone="danger"
                      size="sm"
                      onClick={() => setRejectDialogOpen(true)}
                      disabled={isDecisionPaused}
                      loading={isSubmitting && submittingAction === "reject"}
                      data-action="reject"
                    >
                      {formatMessage({ id: "app.work.detail.reject" })}
                    </Button>
                    <Button
                      type="button"
                      emphasis="primary"
                      size="sm"
                      onClick={() => void handleApprovalSubmit(true)}
                      disabled={isDecisionPaused || needsConfidence}
                      loading={isSubmitting && submittingAction === "approve"}
                      data-action="approve"
                    >
                      {formatMessage({ id: "app.work.detail.approve" })}
                    </Button>
                  </div>
                </div>

                <AdminReasonDialog
                  isOpen={isRejectDialogOpen}
                  onClose={() => setRejectDialogOpen(false)}
                  onConfirm={(reason) => finishReject(reason, false)}
                  title={formatMessage({ id: "app.work.detail.rejectDialog.title" })}
                  target={`${workTitle} · ${gardenerDisplayName}`}
                  description={formatMessage(
                    { id: "app.work.detail.rejectDialog.description" },
                    { garden: gardenName }
                  )}
                  reasonLabel={formatMessage({ id: "app.work.detail.rejectDialog.reasonLabel" })}
                  reasonPlaceholder={formatMessage({
                    id: "app.work.detail.rejectDialog.reasonPlaceholder",
                  })}
                  suggestions={REJECT_REASON_SUGGESTION_IDS.map((id) => formatMessage({ id }))}
                  initialReason={getValues("feedback")}
                  confirmLabel={formatMessage({ id: "app.work.detail.rejectDialog.confirm" })}
                  variant="danger"
                  isLoading={isSubmitting && submittingAction === "reject"}
                  alternative={
                    reviewBatch.available
                      ? {
                          label: formatMessage({ id: "app.work.batch.add" }),
                          onConfirm: (reason) => finishReject(reason, true),
                        }
                      : undefined
                  }
                />
              </form>
            ) : (
              <p className="mt-4 type-body text-text-soft">
                {formatMessage({ id: "app.work.detail.noPermission" })}
              </p>
            )}
          </section>
        </ErrorBoundary>
      </div>
    </div>
  );
}
