import {
  AudioRecorder,
  Confidence,
  ConfidenceSelector,
  logger,
  MethodSelector,
  parseContractError,
  toastService,
  USER_FRIENDLY_ERRORS,
  uploadFileToIPFS,
  uploadJSONToIPFS,
  useWorkApproval,
  VerificationMethod,
  type Work,
  type WorkApprovalDraft,
} from "@green-goods/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

const workApprovalSchema = z.object({
  confidence: z.nativeEnum(Confidence),
  verificationMethod: z.number(),
  feedback: z.string().optional(),
});

type WorkApprovalFormData = z.infer<typeof workApprovalSchema>;

function getDefaultMethodForDomain(domainSlug?: string): number {
  if (!domainSlug) return VerificationMethod.HUMAN;
  if (domainSlug.startsWith("solar.")) return VerificationMethod.HUMAN | VerificationMethod.IOT;
  if (domainSlug.startsWith("edu.")) return VerificationMethod.HUMAN;
  return VerificationMethod.HUMAN;
}

interface WorkReviewFormProps {
  work: Work;
  gardenId: string;
  actionSlug?: string;
}

export function WorkReviewForm({
  work,
  gardenId,
  actionSlug,
}: WorkReviewFormProps): React.ReactNode {
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

  const [reviewAudioFile, setReviewAudioFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<"approve" | "reject" | null>(null);

  const approvalMutation = useWorkApproval();

  async function handleApprovalSubmit(approved: boolean): Promise<void> {
    if (!work || !gardenId) return;

    const formData = {
      confidence: approved ? confidence : Confidence.NONE,
      verificationMethod: approved ? verificationMethod : 0,
      feedback: getValues("feedback"),
    };

    if (approved) {
      if (formData.confidence < Confidence.LOW) return;
      if (formData.verificationMethod === 0) return;
    }

    setSubmittingAction(approved ? "approve" : "reject");
    setIsSubmitting(true);

    try {
      let reviewNotesCID: string | undefined;

      if (reviewAudioFile) {
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

      navigate(`/gardens/${gardenId}`);
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
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="mt-4 space-y-5">
      <div>
        <span className="mb-1.5 block text-sm font-medium text-text-strong" id="confidence-label">
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

      <div>
        <span className="mb-1.5 block text-sm font-medium text-text-strong" id="method-label">
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

      <div>
        <label htmlFor="feedback" className="mb-1.5 block text-sm font-medium text-text-strong">
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

      <div>
        <span className="mb-1.5 block text-sm font-medium text-text-strong">
          {formatMessage({ id: "app.work.detail.audioReviewNote" })}
          <span className="ml-1 text-xs text-text-soft">
            ({formatMessage({ id: "app.common.optional" })})
          </span>
        </span>
        {reviewAudioFile ? (
          <div className="flex items-center gap-2">
            <span className="flex-1 truncate text-sm text-text-sub">{reviewAudioFile.name}</span>
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
  );
}
