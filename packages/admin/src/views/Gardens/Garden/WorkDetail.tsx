import {
  AudioRecorder,
  Confidence,
  ErrorBoundary,
  ConfidenceSelector,
  DEFAULT_CHAIN_ID,
  formatDate,
  logger,
  MethodSelector,
  parseContractError,
  toastService,
  uploadFileToIPFS,
  uploadJSONToIPFS,
  USER_FRIENDLY_ERRORS,
  useActions,
  useGardenPermissions,
  useGardens,
  useWorkApproval,
  useWorks,
  VerificationMethod,
  type Work,
  type WorkApprovalDraft,
  type WorkMetadata,
} from "@green-goods/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  RiCheckboxCircleLine,
  RiCloseLine,
  RiFileList3Line,
  RiTimeLine,
  RiUserLine,
} from "@remixicon/react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useIntl } from "react-intl";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { AddressDisplay } from "@/components/AddressDisplay";
import { PageHeader } from "@/components/Layout/PageHeader";
import { MediaEvidence } from "@/components/Work/MediaEvidence";

// ─────────────────────────────────────────────────────────────
// Zod schema for the approval form (Rule 8: RHF + Zod)
// ─────────────────────────────────────────────────────────────

// Approval vs rejection is determined by which button the user clicks,
// so additional validation beyond type constraints happens in the submit handler.
const workApprovalSchema = z.object({
  confidence: z.nativeEnum(Confidence),
  verificationMethod: z.number(),
  feedback: z.string().optional(),
});

type WorkApprovalFormData = z.infer<typeof workApprovalSchema>;

// ─────────────────────────────────────────────────────────────
// Domain default method mapping
// ─────────────────────────────────────────────────────────────

function getDefaultMethodForDomain(domainSlug?: string): number {
  if (!domainSlug) return VerificationMethod.HUMAN;
  if (domainSlug.startsWith("solar.")) return VerificationMethod.HUMAN | VerificationMethod.IOT;
  if (domainSlug.startsWith("edu.")) return VerificationMethod.HUMAN;
  return VerificationMethod.HUMAN;
}

// ─────────────────────────────────────────────────────────────
// Helper: parse work metadata safely
// ─────────────────────────────────────────────────────────────

function parseWorkMetadata(metadataStr: string): Partial<WorkMetadata> | null {
  try {
    const parsed = JSON.parse(metadataStr);
    return parsed;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// View
// ─────────────────────────────────────────────────────────────

export default function WorkDetail() {
  const { id: gardenId, workId } = useParams<{ id: string; workId: string }>();
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const gardenPermissions = useGardenPermissions();

  // Fetch garden, work, and actions data
  const { data: gardens = [], isLoading: gardensLoading } = useGardens();
  const garden = gardens.find((g) => g.id === gardenId);

  const { works, isLoading: worksLoading } = useWorks(gardenId ?? "");
  const work = works.find((w) => w.id === workId);

  const { data: actions = [] } = useActions(DEFAULT_CHAIN_ID);
  const action = useMemo(
    () => actions.find((a) => work && Number(a.id) === work.actionUID),
    [actions, work]
  );

  const canReview = garden ? gardenPermissions.canReviewGarden(garden) : false;
  const isReviewed = work?.status === "approved" || work?.status === "rejected";

  // Parse metadata for additional details
  const metadata = useMemo(
    () => (work?.metadata ? parseWorkMetadata(work.metadata) : null),
    [work?.metadata]
  );

  // Audio note CIDs from work metadata
  const audioNoteCids = metadata?.audioNoteCids;

  // ─────────────────────────────────────────────────────────────
  // Approval form (RHF + Zod)
  // ─────────────────────────────────────────────────────────────

  const defaultMethod = getDefaultMethodForDomain(action?.slug);

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
    if (!work || !gardenId) return;

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

      // Navigate back to garden detail on success
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
  };

  // ─────────────────────────────────────────────────────────────
  // Loading / Error states
  // ─────────────────────────────────────────────────────────────

  const isLoading = gardensLoading || worksLoading;

  const baseHeaderProps = {
    backLink: {
      to: `/gardens/${gardenId}`,
      label: formatMessage({ id: "app.garden.admin.backToGarden" }),
    },
    sticky: true,
  } as const;

  if (isLoading) {
    return (
      <div className="pb-6">
        <PageHeader
          title={formatMessage({ id: "app.work.detail.loading" })}
          description={formatMessage({ id: "app.work.detail.loadingDescription" })}
          {...baseHeaderProps}
        />
        <div className="mt-6 px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3 space-y-4">
              <div className="h-64 animate-pulse rounded-lg bg-bg-soft" />
              <div className="h-32 animate-pulse rounded-lg bg-bg-soft" />
            </div>
            <div className="lg:col-span-2">
              <div className="h-96 animate-pulse rounded-lg bg-bg-soft" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!work || !garden) {
    return (
      <div className="pb-6">
        <PageHeader
          title={formatMessage({ id: "app.work.detail.title" })}
          description={formatMessage({ id: "app.work.detail.notFoundDescription" })}
          {...baseHeaderProps}
        />
        <div className="mt-6 px-4 sm:px-6">
          <div className="rounded-md border border-error-light bg-error-lighter p-4" role="alert">
            <p className="text-sm text-error-dark">
              {formatMessage({ id: "app.work.detail.notFound" })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Status badge
  // ─────────────────────────────────────────────────────────────

  const statusConfig = {
    pending: {
      label: formatMessage({ id: "app.work.status.pending" }),
      color: "bg-warning-lighter text-warning-dark",
      icon: RiTimeLine,
    },
    approved: {
      label: formatMessage({ id: "app.work.status.approved" }),
      color: "bg-success-lighter text-success-dark",
      icon: RiCheckboxCircleLine,
    },
    rejected: {
      label: formatMessage({ id: "app.work.status.rejected" }),
      color: "bg-error-lighter text-error-dark",
      icon: RiCloseLine,
    },
  };

  const status = statusConfig[work.status];
  const StatusIcon = status.icon;

  return (
    <div className="pb-6">
      <PageHeader
        title={formatMessage({ id: "app.work.detail.reviewTitle" })}
        description={action?.title ?? work.title}
        metadata={
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}
          >
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </span>
        }
        {...baseHeaderProps}
      />

      <div className="mt-6 px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* ─── Left column: Evidence + Details (scrollable) ─── */}
          <div className="space-y-4 lg:col-span-3">
            {/* Media Evidence */}
            <section className="rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm sm:p-6">
              <MediaEvidence
                media={work.media}
                audioNoteCids={audioNoteCids}
                actionTitle={action?.title}
              />
            </section>

            {/* Submission Details */}
            <section className="rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm sm:p-6">
              <h3 className="text-sm font-semibold text-text-strong">
                {formatMessage({ id: "app.work.detail.submissionDetails" })}
              </h3>

              <div className="mt-4 space-y-3">
                {/* Action */}
                <DetailRow
                  icon={<RiFileList3Line className="h-4 w-4" />}
                  label={formatMessage({ id: "app.work.detail.action" })}
                  value={
                    <span>
                      {action?.title ?? `Action #${work.actionUID}`}
                      {action?.slug && (
                        <span className="ml-1.5 text-xs text-text-soft">({action.slug})</span>
                      )}
                    </span>
                  }
                />

                {/* Garden */}
                <DetailRow
                  icon={<RiFileList3Line className="h-4 w-4" />}
                  label={formatMessage({ id: "app.work.detail.garden" })}
                  value={garden.name}
                />

                {/* Gardener */}
                <DetailRow
                  icon={<RiUserLine className="h-4 w-4" />}
                  label={formatMessage({ id: "app.work.detail.gardener" })}
                  value={<AddressDisplay address={work.gardenerAddress} />}
                />

                {/* Submitted at */}
                <DetailRow
                  icon={<RiTimeLine className="h-4 w-4" />}
                  label={formatMessage({ id: "app.work.detail.submitted" })}
                  value={formatDate(work.createdAt)}
                />

                {/* Metadata details (v2) */}
                {metadata && renderMetadataDetails(metadata)}

                {/* Gardener feedback */}
                {work.feedback && (
                  <div className="mt-3 rounded-md bg-bg-weak p-3">
                    <p className="text-xs font-medium text-text-soft">
                      {formatMessage({ id: "app.work.detail.gardenerNotes" })}
                    </p>
                    <p className="mt-1 text-sm text-text-sub">{work.feedback}</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* ─── Right column: Review Form (sticky on desktop) ─── */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-24">
              <ErrorBoundary context="WorkDetail.ReviewForm">
                <section className="rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm sm:p-6">
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
                            <span className="flex-1 truncate text-sm text-text-sub">
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
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex-shrink-0 text-text-soft">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-text-soft">{label}</p>
        <div className="mt-0.5 text-sm text-text-strong">{value}</div>
      </div>
    </div>
  );
}

function ReviewSummary({ work }: { work: Work }) {
  const { formatMessage } = useIntl();
  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-md bg-bg-weak p-3">
        <p className="text-xs font-medium text-text-soft">
          {formatMessage({ id: "app.work.detail.statusLabel" })}
        </p>
        <p className="mt-0.5 text-sm font-medium text-text-strong">
          {work.status === "approved"
            ? formatMessage({ id: "app.work.status.approved" })
            : formatMessage({ id: "app.work.status.rejected" })}
        </p>
      </div>
      <p className="text-xs text-text-soft">
        {formatMessage({ id: "app.work.detail.alreadyReviewed" })}
      </p>
    </div>
  );
}

function renderMetadataDetails(metadata: Partial<WorkMetadata>): React.ReactNode {
  const entries: Array<{ label: string; value: string }> = [];

  if (metadata.timeSpentMinutes) {
    entries.push({ label: "Time Spent", value: `${metadata.timeSpentMinutes} min` });
  }

  if (metadata.actionSlug) {
    entries.push({ label: "Action Slug", value: metadata.actionSlug });
  }

  if (metadata.tags && metadata.tags.length > 0) {
    entries.push({ label: "Tags", value: metadata.tags.join(", ") });
  }

  // Render generic details
  if (metadata.details) {
    for (const [key, val] of Object.entries(metadata.details)) {
      if (val !== null && val !== undefined && val !== "") {
        const label = key
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (s) => s.toUpperCase())
          .trim();
        entries.push({
          label,
          value: Array.isArray(val) ? val.join(", ") : String(val),
        });
      }
    }
  }

  if (entries.length === 0) return null;

  return (
    <>
      {entries.map((entry) => (
        <div key={entry.label} className="flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0 text-text-soft">
            <RiFileList3Line className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-text-soft">{entry.label}</p>
            <p className="mt-0.5 text-sm text-text-strong">{entry.value}</p>
          </div>
        </div>
      ))}
    </>
  );
}
