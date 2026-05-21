import {
  AudioRecorder,
  Confidence,
  ConfidenceSelector,
  ErrorBoundary,
  logger,
  MethodSelector,
  parseAndFormatError,
  Textarea,
  toastService,
  uploadFileToIPFS,
  uploadJSONToIPFS,
  useEnsName,
  useWorkApproval,
  type Work,
  type WorkApprovalDraft,
} from "@green-goods/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useIntl } from "react-intl";
import { formatEnsAddressName } from "@/components/EnsAddressText";
import {
  getDefaultMethodForDomain,
  ReviewSummary,
  workApprovalSchema,
  type WorkApprovalFormData,
} from "./helpers";

interface ReviewFormProps {
  work: Work;
  gardenName: string;
  actionSlug?: string;
  actionEndTime?: number;
  canReview: boolean;
  canApproveOrReject: boolean;
  isReviewed: boolean;
  layout?: "page" | "sheet";
  onSuccess?: () => void;
}

export function ReviewForm({
  work,
  gardenName,
  actionSlug,
  actionEndTime,
  canReview,
  canApproveOrReject,
  isReviewed,
  layout = "page",
  onSuccess,
}: ReviewFormProps) {
  const { formatMessage } = useIntl();
  const { data: gardenerEnsName } = useEnsName(work.gardenerAddress);
  const gardenerDisplayName = formatEnsAddressName(work.gardenerAddress, gardenerEnsName);

  const defaultMethod = getDefaultMethodForDomain(actionSlug);
  const isActionExpired = typeof actionEndTime === "number" && actionEndTime < Date.now();

  const { control, watch, getValues } = useForm<WorkApprovalFormData>({
    resolver: zodResolver(workApprovalSchema),
    defaultValues: {
      confidence: Confidence.NONE,
      verificationMethod: defaultMethod,
      feedback: "",
    },
  });

  const confidence = watch("confidence");
  const verificationMethod = watch("verificationMethod");
  const hasLowConfidenceHint = confidence < Confidence.LOW;
  const hasMissingVerificationMethodHint = verificationMethod === 0;
  const hasApprovalValidationHints = hasLowConfidenceHint || hasMissingVerificationMethodHint;

  // Audio recording state
  const [reviewAudioFile, setReviewAudioFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<"approve" | "reject" | null>(null);

  const approvalMutation = useWorkApproval();

  const handleApprovalSubmit = async (approved: boolean) => {
    // Validate form data manually since approval/rejection isn't a form field
    const formData = {
      confidence: approved ? confidence : Confidence.NONE,
      verificationMethod: approved ? verificationMethod : 0,
      feedback: getValues("feedback"),
    };

    // Validation for approvals
    if (approved) {
      if (formData.confidence < Confidence.LOW) {
        // Can't approve with NONE confidence
        return;
      }
      if (formData.verificationMethod === 0) {
        // Must select at least 1 verification method
        return;
      }
    }

    setSubmittingAction(approved ? "approve" : "reject");
    setIsSubmitting(true);

    try {
      // Build review notes CID if audio exists
      let reviewNotesCID: string | undefined;

      if (reviewAudioFile) {
        // IPFS upload chain: audio file -> IPFS CID -> JSON envelope -> IPFS CID
        try {
          const { cid: audioCid } = await uploadFileToIPFS(reviewAudioFile, {
            source: "WorkDetail.reviewNotes",
          });

          const reviewNotesJson: Record<string, unknown> = {
            schemaVersion: "review_notes_v1",
            audioNoteCids: [audioCid],
            reviewerComments: formData.feedback || "",
          };

          const { cid: jsonCid } = await uploadJSONToIPFS(reviewNotesJson, {
            source: "WorkDetail.reviewNotes",
            metadataType: "review_notes",
          });

          reviewNotesCID = jsonCid;
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
          return;
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

      await approvalMutation.mutateAsync({ draft, work });

      onSuccess?.();
    } catch (error) {
      const { message, parsed } = parseAndFormatError(error);

      logger.error("Work approval submission failed", {
        error,
        source: "WorkDetail",
      });

      toastService.error({
        title: formatMessage({ id: "app.toast.approval.errorDecision.title" }),
        message: parsed.isKnown
          ? message
          : formatMessage({ id: "app.toast.approval.errorWallet.message" }),
      });
    } finally {
      setIsSubmitting(false);
      setSubmittingAction(null);
    }
  };

  const blockedState = isReviewed
    ? "reviewed"
    : isActionExpired
      ? "expired"
      : canReview && !canApproveOrReject
        ? "role-blocked"
        : canReview
          ? "actionable"
          : "no-permission";

  return (
    <div className={layout === "page" ? "lg:col-span-2" : undefined}>
      <div className={layout === "page" ? "lg:sticky lg:top-24" : undefined}>
        <ErrorBoundary context="WorkDetail.ReviewForm">
          <section className="surface-inset sm:p-6">
            <h3 className="text-base font-semibold text-text-strong">
              {blockedState === "reviewed"
                ? formatMessage({ id: "app.work.detail.reviewSummary" })
                : formatMessage({ id: "app.work.detail.operatorReview" })}
            </h3>

            {blockedState === "reviewed" ? (
              <ReviewSummary work={work} />
            ) : blockedState === "expired" ? (
              <div className="mt-4 rounded-xl border border-warning-light bg-warning-lighter/70 p-4">
                <p className="text-sm font-medium text-warning-dark">
                  {formatMessage({
                    id: "app.work.detail.reviewBlocked.expiredTitle",
                    defaultMessage: "Action expired",
                  })}
                </p>
                <p className="mt-1 text-sm text-warning-dark">
                  {formatMessage({
                    id: "app.work.detail.reviewBlocked.expiredMessage",
                    defaultMessage:
                      "This action is no longer active, so new approval decisions are blocked.",
                  })}
                </p>
              </div>
            ) : blockedState === "role-blocked" ? (
              <div className="mt-4 rounded-xl border border-information-light bg-information-lighter p-4">
                <p className="text-sm font-medium text-information-dark">
                  {formatMessage({
                    id: "app.work.detail.reviewBlocked.operatorTitle",
                    defaultMessage: "Owner or operator access required",
                  })}
                </p>
                <p className="mt-1 text-sm text-information-dark">
                  {formatMessage({
                    id: "app.work.detail.reviewBlocked.operatorMessage",
                    defaultMessage:
                      "Only garden owners or operators can approve or reject work for this garden.",
                  })}
                </p>
              </div>
            ) : blockedState === "actionable" ? (
              <form onSubmit={(e) => e.preventDefault()} className="mt-4 space-y-5">
                {/* Confidence Selector */}
                <div>
                  <span
                    className="mb-1.5 block text-sm font-medium text-text-strong"
                    id="confidence-label"
                  >
                    {formatMessage({ id: "app.work.detail.confidenceLevel" })}
                    <span className="ml-1 text-xs text-text-soft">
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
                </div>

                {/* Method Selector */}
                <div>
                  <span
                    className="mb-1.5 block text-sm font-medium text-text-strong"
                    id="method-label"
                  >
                    {formatMessage({ id: "app.work.detail.verificationMethods" })}
                    <span className="ml-1 text-xs text-text-soft">
                      ({formatMessage({ id: "app.work.detail.selectAllThatApply" })})
                    </span>
                  </span>
                  <Controller
                    name="verificationMethod"
                    control={control}
                    render={({ field }) => (
                      <MethodSelector
                        value={field.value}
                        onChange={field.onChange}
                        aria-labelledby="method-label"
                      />
                    )}
                  />
                </div>

                {/* Feedback textarea */}
                <div>
                  <label
                    htmlFor="feedback"
                    className="mb-1.5 block text-sm font-medium text-text-strong"
                  >
                    {formatMessage({ id: "app.work.detail.feedback" })}
                    <span className="ml-1 text-xs text-text-soft">
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
                  <span className="mb-1.5 block text-sm font-medium text-text-strong">
                    {formatMessage({ id: "app.work.detail.audioReviewNote" })}
                    <span className="ml-1 text-xs text-text-soft">
                      ({formatMessage({ id: "app.common.optional" })})
                    </span>
                  </span>
                  {reviewAudioFile ? (
                    <div className="flex items-center gap-2">
                      <span
                        className="flex-1 truncate text-sm text-text-sub"
                        title={reviewAudioFile.name}
                      >
                        {reviewAudioFile.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setReviewAudioFile(null)}
                        className="text-xs text-error-base hover:text-error-dark"
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
                  <p className="text-xs text-information-dark">
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

                {/* Action buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handleApprovalSubmit(true)}
                    disabled={isSubmitting || hasApprovalValidationHints}
                    className="flex-1 rounded-lg bg-success-base px-4 py-2.5 text-sm font-medium text-static-white transition hover:bg-success-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success-base focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting && submittingAction === "approve"
                      ? formatMessage({
                          id: "app.work.detail.approving",
                          defaultMessage: "Approving...",
                        })
                      : formatMessage({ id: "app.work.detail.approve" })}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApprovalSubmit(false)}
                    disabled={isSubmitting}
                    className="flex-1 rounded-lg border border-error-base px-4 py-2.5 text-sm font-medium text-error-base transition hover:bg-error-lighter focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error-base focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting && submittingAction === "reject"
                      ? formatMessage({
                          id: "app.work.detail.rejecting",
                          defaultMessage: "Rejecting...",
                        })
                      : formatMessage({ id: "app.work.detail.reject" })}
                  </button>
                </div>

                {/* Validation hints */}
                {hasLowConfidenceHint && (
                  <p className="text-xs text-warning-base">
                    {formatMessage({ id: "app.work.detail.hint.lowConfidence" })}
                  </p>
                )}
                {hasMissingVerificationMethodHint && (
                  <p className="text-xs text-warning-base">
                    {formatMessage({ id: "app.work.detail.hint.missingMethod" })}
                  </p>
                )}
              </form>
            ) : (
              <p className="mt-4 text-sm text-text-soft">
                {formatMessage({ id: "app.work.detail.noPermission" })}
              </p>
            )}
          </section>
        </ErrorBoundary>
      </div>
    </div>
  );
}
