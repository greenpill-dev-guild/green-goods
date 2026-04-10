import {
  AudioRecorder,
  adminRoutes,
  Confidence,
  ConfidenceSelector,
  ErrorBoundary,
  formatAddress,
  logger,
  MethodSelector,
  parseContractError,
  toastService,
  USER_FRIENDLY_ERRORS,
  uploadFileToIPFS,
  uploadJSONToIPFS,
  useWorkApproval,
  type Work,
  type WorkApprovalDraft,
} from "@green-goods/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import {
  getDefaultMethodForDomain,
  ReviewSummary,
  workApprovalSchema,
  type WorkApprovalFormData,
} from "./helpers";

interface ReviewFormProps {
  work: Work;
  gardenId: string;
  gardenName: string;
  actionSlug?: string;
  canReview: boolean;
  isReviewed: boolean;
}

export function ReviewForm({
  work,
  gardenId,
  gardenName,
  actionSlug,
  canReview,
  isReviewed,
}: ReviewFormProps) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();

  const defaultMethod = getDefaultMethodForDomain(actionSlug);

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

      // Navigate back to the Hub work queue on success
      navigate(adminRoutes.work());
    } catch (error) {
      const parsed = parseContractError(error);
      const normalizedName = parsed.name.toLowerCase();
      const knownMessage =
        USER_FRIENDLY_ERRORS[normalizedName] ??
        Object.entries(USER_FRIENDLY_ERRORS).find(([pattern]) => {
          const lowerMessage = parsed.message.toLowerCase();
          return normalizedName.includes(pattern) || lowerMessage.includes(pattern);
        })?.[1];

      logger.error("Work approval submission failed", {
        error,
        source: "WorkDetail",
      });

      toastService.error({
        title: formatMessage({ id: "app.toast.approval.errorDecision.title" }),
        message:
          knownMessage ??
          (parsed.isKnown
            ? parsed.message
            : formatMessage({ id: "app.toast.approval.errorWallet.message" })),
      });
    } finally {
      setIsSubmitting(false);
      setSubmittingAction(null);
    }
  };

  return (
    <div className="lg:col-span-2">
      <div className="lg:sticky lg:top-24">
        <ErrorBoundary context="WorkDetail.ReviewForm">
          <section className="surface-inset sm:p-6">
            <h3 className="text-base font-semibold text-text-strong">
              {isReviewed
                ? formatMessage({ id: "app.work.detail.reviewSummary" })
                : formatMessage({ id: "app.work.detail.operatorReview" })}
            </h3>

            {isReviewed ? (
              <ReviewSummary work={work} />
            ) : canReview ? (
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
                      <textarea
                        {...field}
                        id="feedback"
                        rows={3}
                        placeholder={formatMessage({
                          id: "app.work.detail.feedbackPlaceholder",
                        })}
                        className="w-full rounded-lg border border-stroke-sub bg-bg-white px-3 py-2 text-sm text-text-strong placeholder:text-text-soft focus:border-primary-base focus:outline-none focus:ring-1 focus:ring-primary-base"
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
                        gardener: formatAddress(work.gardenerAddress, { variant: "card" }),
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
