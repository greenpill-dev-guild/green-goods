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
import { zodResolver } from "@hookform/resolvers/zod";
import {
  RiCheckDoubleFill,
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
import { Form, useForm } from "react-hook-form";
import { useIntl } from "react-intl";
import { useLocation, useOutletContext, useParams } from "react-router-dom";
import { type ZodType, z } from "zod";
import { Button } from "@/components/UI/Button";
import { FormText } from "@/components/UI/Form/Text";
import ConfirmDrawer from "@/components/UI/ModalDrawer/ConfirmDrawer";
import { TopNav } from "@/components/UI/TopNav/TopNav";
import { WorkViewSkeleton } from "@/components/UI/WorkView/WorkView";
import { WorkCompleted } from "../../Garden/Completed";
import WorkViewSection from "./WorkViewSection";

type GardenWorkProps = {};

// Zod schema for work approval form validation
const workApprovalFormSchema: ZodType<{
  actionUID: number;
  workUID: string;
  approved: boolean;
  feedback?: string;
}> = z.object({
  actionUID: z.number(),
  workUID: z.string(),
  approved: z.boolean(),
  feedback: z.string().optional(),
});

// Infer form type from Zod schema (single source of truth)
type WorkApprovalFormData = z.infer<typeof workApprovalFormSchema>;

export const GardenWork: React.FC<GardenWorkProps> = () => {
  const intl = useIntl();
  const { id: gardenIdParam, workId } = useParams<{ id: string; workId: string }>();
  const { gardenId: gardenIdFromContext } = (useOutletContext() as { gardenId?: string }) || {};
  const [workMetadata, setWorkMetadata] = useState<WorkMetadata | null>(null);
  const [metadataStatus, setMetadataStatus] = useState<"idle" | "loading" | "success" | "error">(
    "loading"
  );
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [isApproveDialogOpen, setApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setRejectDialogOpen] = useState(false);
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

  const { smartAccountAddress, smartAccountClient } = useUser();
  const [isRetrying, setIsRetrying] = useState(false);

  // Determine user role and viewing mode
  const viewingMode = useMemo<"operator" | "gardener" | "viewer">(() => {
    if (!garden || !work) return "viewer";

    // Check if user is garden operator
    const isOperator = garden.operators?.some(
      (op) => op.toLowerCase() === smartAccountAddress?.toLowerCase()
    );

    // Check if user is the gardener who submitted the work
    const isGardener = work.gardenerAddress?.toLowerCase() === smartAccountAddress?.toLowerCase();

    if (isOperator) return "operator";
    if (isGardener) return "gardener";
    return "viewer";
  }, [garden, work, smartAccountAddress]);

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
  const { register, handleSubmit, control, setValue } = useForm<WorkApprovalFormData>({
    defaultValues: {
      actionUID: work?.actionUID ?? 0,
      workUID: work?.id ?? "",
      approved: false,
      feedback: inlineFeedback,
    },
    // Compatibility note: older @hookform/resolvers versions had a signature mismatch with Zod.
    // Current versions compile cleanly; keeping the context here for future regressions.
    resolver: zodResolver(workApprovalFormSchema as any),
    shouldUseNativeValidation: true,
    mode: "onChange",
  });

  const workApprovalMutation = useWorkApproval();

  // Sync inline feedback with form feedback field
  useEffect(() => {
    setValue("feedback", inlineFeedback);
  }, [inlineFeedback, setValue]);

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
      queryClient.invalidateQueries({ queryKey: ["workApprovals"] });
      if (garden?.id) {
        queryClient.invalidateQueries({ queryKey: ["works", garden.id] });
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
      <div className="fixed left-0 right-0 bottom-0 bg-bg-white-0 border-t border-stroke-soft-200 shadow-[0_-4px_16px_rgba(0,0,0,0.12)] backdrop-blur-sm p-4 pb-6 z-[100] animate-in slide-in-from-bottom-4 duration-300">
        <div className="max-w-screen-sm mx-auto space-y-3">
          {/* Action Info Bar */}
          <div className="flex items-center justify-between text-xs text-text-sub-600 px-1">
            <span className="flex items-center gap-1.5">
              <RiCheckDoubleFill className="w-4 h-4 text-primary" />
              {intl.formatMessage({
                id: "app.home.workApproval.reviewAction",
                defaultMessage: "Review & Decision",
              })}
            </span>
            <span className="font-medium text-text-strong-950">
              {intl.formatMessage({
                id: "app.home.workApproval.actionRequired",
                defaultMessage: "Action Required",
              })}
            </span>
          </div>

          {/* Button Group */}
          <div className="flex gap-3">
            <Button
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate([30, 10, 30]);
                setRejectDialogOpen(true);
              }}
              label={intl.formatMessage({
                id: "app.home.workApproval.reject",
                defaultMessage: "Reject",
              })}
              className="flex-1 min-h-[48px] touch-manipulation"
              variant="error"
              type="button"
              shape="pilled"
              mode="stroke"
              size="medium"
              leadingIcon={<RiCloseLine className="w-5 h-5" />}
              disabled={workApprovalMutation.isPending}
            />
            <Button
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate([50]);
                setApproveDialogOpen(true);
              }}
              type="button"
              label={intl.formatMessage({
                id: "app.home.workApproval.approve",
                defaultMessage: "Approve",
              })}
              className="flex-1 min-h-[48px] touch-manipulation"
              variant="primary"
              mode="filled"
              size="medium"
              shape="pilled"
              leadingIcon={<RiCheckLine className="w-5 h-5" />}
              disabled={workApprovalMutation.isPending}
            />
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
      <TopNav onBackClick={handleBack} />
      {workApprovalMutation.isIdle && (
        <Form id="work-approve" control={control} className="relative min-h-screen">
          <>
            <div className={cn("padded", (retryFooter || approvalFooter) && "pb-32")}>
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
                  onApprove={
                    viewingMode === "operator" && work.status === "pending"
                      ? () => {
                          if (navigator.vibrate) navigator.vibrate([50]);
                          setApproveDialogOpen(true);
                        }
                      : undefined
                  }
                  onReject={
                    viewingMode === "operator" && work.status === "pending"
                      ? () => {
                          if (navigator.vibrate) navigator.vibrate([30, 10, 30]);
                          setRejectDialogOpen(true);
                        }
                      : undefined
                  }
                  feedback={inlineFeedback}
                  onFeedbackChange={setInlineFeedback}
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
          </>
        </Form>
      )}

      {workApprovalMutation.isPending && (
        <div className="fixed left-0 right-0 bottom-0 bg-bg-white-0 border-t border-stroke-soft-200 p-4 pb-6 z-[101]">
          <div className="flex items-center justify-center gap-2 text-text-sub-600">
            <RiLoader4Line className="w-5 h-5 animate-spin" />
            <span className="text-sm">
              {intl.formatMessage({ id: "app.common.processing", defaultMessage: "Processing..." })}
            </span>
          </div>
        </div>
      )}

      <ConfirmDrawer
        isOpen={isApproveDialogOpen}
        onClose={() => setApproveDialogOpen(false)}
        title={intl.formatMessage({
          id: "app.home.workApproval.confirmApprove",
          defaultMessage: "Confirm Approval",
        })}
        description={
          inlineFeedback
            ? intl.formatMessage({
                id: "app.home.workApproval.confirmApproveWithFeedback",
                defaultMessage: "You're about to approve this work with your feedback. Proceed?",
              })
            : intl.formatMessage({
                id: "app.home.workApproval.confirmApproveNoFeedback",
                defaultMessage:
                  "You're about to approve this work. You can still add feedback below if needed.",
              })
        }
        confirmLabel={intl.formatMessage({ id: "app.common.confirm", defaultMessage: "Confirm" })}
        confirmVariant="primary"
        onConfirm={handleSubmit((data) => {
          if (!work) return;
          const draft: WorkApprovalDraft = {
            actionUID: data.actionUID,
            workUID: data.workUID,
            approved: true,
            feedback: data.feedback || inlineFeedback,
          };
          workApprovalMutation.mutate({ draft, work });
          setApproveDialogOpen(false);
        })}
      >
        <FormText
          rows={4}
          label={intl.formatMessage({
            id: "app.home.workApproval.feedback",
            defaultMessage: "Feedback",
          })}
          placeholder={intl.formatMessage({
            id: "app.home.workApproval.feedbackOptional",
            defaultMessage: "Optional feedback...",
          })}
          {...register("feedback")}
        />
      </ConfirmDrawer>

      <ConfirmDrawer
        isOpen={isRejectDialogOpen}
        onClose={() => setRejectDialogOpen(false)}
        title={intl.formatMessage({
          id: "app.home.workApproval.confirmReject",
          defaultMessage: "Confirm Rejection",
        })}
        description={
          inlineFeedback
            ? intl.formatMessage({
                id: "app.home.workApproval.confirmRejectWithFeedback",
                defaultMessage: "You're about to reject this work with your feedback. Proceed?",
              })
            : intl.formatMessage({
                id: "app.home.workApproval.confirmRejectNeedsFeedback",
                defaultMessage:
                  "Feedback is required when rejecting work. Please add feedback below.",
              })
        }
        confirmLabel={intl.formatMessage({ id: "app.common.confirm", defaultMessage: "Confirm" })}
        confirmVariant="error"
        confirmDisabled={!inlineFeedback && !register("feedback").name}
        onConfirm={handleSubmit((data) => {
          if (!work) return;
          const finalFeedback = data.feedback || inlineFeedback;
          if (!finalFeedback) {
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
            actionUID: data.actionUID,
            workUID: data.workUID,
            approved: false,
            feedback: finalFeedback,
          };
          workApprovalMutation.mutate({ draft, work });
          setRejectDialogOpen(false);
        })}
      >
        <FormText
          rows={4}
          label={intl.formatMessage({
            id: "app.home.workApproval.feedback",
            defaultMessage: "Feedback",
          })}
          placeholder={intl.formatMessage({
            id: "app.home.workApproval.feedbackRequired",
            defaultMessage: "Feedback required",
          })}
          {...register("feedback", { required: !inlineFeedback })}
        />
      </ConfirmDrawer>
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
