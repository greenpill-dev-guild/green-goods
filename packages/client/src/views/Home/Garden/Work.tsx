import { zodResolver } from "@hookform/resolvers/zod";
import { RiCheckFill, RiCloseFill } from "@remixicon/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import { Form, useForm } from "react-hook-form";
import { useIntl } from "react-intl";
import { useLocation, useParams, useOutletContext } from "react-router-dom";

import { z } from "zod";
import { Button } from "@/components/UI/Button";
import { FormText } from "@/components/UI/Form/Text";
import { TopNav } from "@/components/UI/TopNav/TopNav";
import ConfirmDrawer from "@/components/UI/ModalDrawer/ConfirmDrawer";
import { WorkViewSkeleton } from "@/components/UI/WorkView/WorkView";
import toast from "react-hot-toast";
import { useNavigateToTop } from "@/hooks";
import { DEFAULT_CHAIN_ID } from "@/config";
import { createOfflineTxHash, jobQueue } from "@/modules/job-queue";
import { processApprovalJobInline } from "@/modules/job-queue/inline-processor";
import { useUser } from "@/providers/user";
import { useJobQueueEvents } from "@/modules/job-queue/event-bus";
import { isValidAttestationId, openEASExplorer } from "@/utils/easExplorer";
import { downloadWorkData, downloadWorkMedia, shareWork, type WorkData } from "@/utils/workActions";
import { WorkCompleted } from "../../Garden/Completed";
import WorkViewSection from "./WorkViewSection";
import { useActions, useGardens } from "@/hooks/useBaseLists";
import { useWorks } from "@/hooks/useWorks";
import { getFileByHash } from "@/modules/pinata";

type GardenWorkProps = {};

const workApprovalSchema = z.object({
  actionUID: z.number(),
  workUID: z.string(),
  approved: z.boolean(),
  feedback: z.string().optional(),
});

type WorkApprovalDraft = z.infer<typeof workApprovalSchema>;

export const GardenWork: React.FC<GardenWorkProps> = () => {
  const intl = useIntl();
  const { id: gardenIdParam, workId } = useParams<{ id: string; workId: string }>();
  const { gardenId: gardenIdFromContext } = (useOutletContext() as { gardenId?: string }) || {};
  const [workMetadata, setWorkMetadata] = useState<WorkMetadata | null>(null);
  const [isApproveDialogOpen, setApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setRejectDialogOpen] = useState(false);
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

  const { smartAccountAddress } = useUser();

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
  const { register, handleSubmit, control } = useForm<WorkApprovalDraft>({
    defaultValues: {
      actionUID: work?.actionUID,
      workUID: work?.id,
      approved: false,
      feedback: "",
    },
    resolver: zodResolver(workApprovalSchema),
    shouldUseNativeValidation: true,
    mode: "onChange",
  });

  const workApprovalMutation = useMutation<string, unknown, WorkApprovalDraft>({
    mutationFn: async (draft: WorkApprovalDraft) => {
      // Add approval job to queue - this handles both offline and online scenarios
      const jobId = await jobQueue.addJob(
        "approval",
        {
          ...draft,
          gardenerAddress: work?.gardenerAddress || "",
        },
        {
          chainId,
        }
      );

      // Return an offline transaction hash for UI compatibility
      const offlineHash = createOfflineTxHash(jobId);
      // If a client is available, try to process inline immediately
      const { smartAccountClient } = useUser();
      if (smartAccountClient) {
        try {
          await processApprovalJobInline(jobId, chainId, smartAccountClient);
        } catch {
          // best-effort inline processing; job remains queued otherwise
        }
      }
      return offlineHash;
    },
    onMutate: () => {
      toast.loading(
        intl.formatMessage({
          id: "app.toast.submittingApproval",
          defaultMessage: "Submitting approval...",
        }),
        { id: "approval-upload" }
      );
    },
  });

  // Toasts + cache invalidation from queue events
  useJobQueueEvents(
    ["job:completed", "job:failed"],
    (type, data) => {
      if (!work) return;
      if (data.job.kind !== "approval") return;
      const payload = data.job.payload as ApprovalJobPayload;
      if (payload.workUID !== work.id) return;

      if (type === "job:completed") {
        toast.success(
          payload.approved
            ? intl.formatMessage({ id: "app.toast.workApproved", defaultMessage: "Work approved" })
            : intl.formatMessage({ id: "app.toast.workRejected", defaultMessage: "Work rejected" })
        );
        toast.dismiss("approval-upload");
      }
      if (type === "job:failed") {
        toast.error(
          intl.formatMessage({ id: "app.toast.actionFailed", defaultMessage: "Action failed" })
        );
        toast.dismiss("approval-upload");
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
    (async () => {
      if (!work) {
        if (mounted) setWorkMetadata(null);
        return;
      }
      const raw = work.metadata;
      if (raw && typeof raw === "string") {
        // Try to parse JSON (offline jobs). Otherwise, fetch by hash.
        try {
          if (raw.trim().startsWith("{") || raw.trim().startsWith("[")) {
            const parsed = JSON.parse(raw) as unknown;
            if (mounted) setWorkMetadata(parsed as WorkMetadata);
            return;
          }
        } catch {}
        try {
          const file = await getFileByHash(raw);
          const data = file.data as unknown as WorkMetadata;
          if (mounted) setWorkMetadata(data ?? null);
        } catch {
          if (mounted) setWorkMetadata(null);
        }
      } else {
        if (mounted) setWorkMetadata(null);
      }
    })();
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

  const hasMedia = Array.isArray(work.media) && work.media.length > 0;

  return (
    <article>
      <TopNav onBackClick={handleBack} />
      {workApprovalMutation.isIdle && (
        <Form
          id="work-approve"
          control={control}
          className="relative min-h-[calc(100vh-7rem)] pb-24"
        >
          <>
            <div className="padded">
              {!workMetadata && <WorkViewSkeleton showMedia showActions={false} numDetails={3} />}
            </div>
            {workMetadata && (
              <WorkViewSection
                garden={garden}
                work={work}
                workMetadata={workMetadata}
                viewingMode={viewingMode}
                actionTitle={
                  actionTitle ??
                  intl.formatMessage({
                    id: "app.home.work.unknownAction",
                    defaultMessage: "Unknown Action",
                  })
                }
                onDownloadData={handleDownloadData}
                onDownloadMedia={hasMedia ? handleDownloadMedia : undefined}
                onShare={handleShare}
                onViewAttestation={
                  work && work.id && isValidAttestationId(work.id)
                    ? handleViewAttestation
                    : undefined
                }
                footer={
                  viewingMode === "operator" && work && work.status === "pending" ? (
                    <div className="fixed left-0 right-0 bottom-0 bg-white border-t border-slate-200 p-4 flex gap-4">
                      <Button
                        onClick={() => setRejectDialogOpen(true)}
                        label={intl.formatMessage({
                          id: "app.home.workApproval.reject",
                          defaultMessage: "Reject",
                        })}
                        className="flex-1"
                        variant="error"
                        type="button"
                        shape="pilled"
                        mode="stroke"
                      />
                      <Button
                        onClick={() => setApproveDialogOpen(true)}
                        type="button"
                        label={intl.formatMessage({
                          id: "app.home.workApproval.approve",
                          defaultMessage: "Approve",
                        })}
                        className="flex-1"
                        variant="primary"
                        mode="filled"
                        size="medium"
                        shape="pilled"
                      />
                    </div>
                  ) : null
                }
              />
            )}
          </>
        </Form>
      )}

      <ConfirmDrawer
        isOpen={isApproveDialogOpen}
        onClose={() => setApproveDialogOpen(false)}
        title={intl.formatMessage({
          id: "app.home.workApproval.confirmApprove",
          defaultMessage: "Confirm Approval",
        })}
        description={intl.formatMessage({
          id: "app.home.workApproval.addOptionalFeedback",
          defaultMessage: "Optionally add feedback for the gardener.",
        })}
        confirmLabel={intl.formatMessage({ id: "app.common.confirm", defaultMessage: "Confirm" })}
        confirmVariant="primary"
        onConfirm={handleSubmit((data) => {
          data.approved = true;
          workApprovalMutation.mutate(data);
          setApproveDialogOpen(false);
        })}
      >
        <FormText
          rows={4}
          label={intl.formatMessage({
            id: "app.home.workApproval.feedback",
            defaultMessage: "Feedback",
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
        description={intl.formatMessage({
          id: "app.home.workApproval.addFeedbackRequired",
          defaultMessage: "Please add feedback for the gardener.",
        })}
        confirmLabel={intl.formatMessage({ id: "app.common.confirm", defaultMessage: "Confirm" })}
        confirmVariant="error"
        onConfirm={handleSubmit((data) => {
          data.approved = false;
          workApprovalMutation.mutate(data);
          setRejectDialogOpen(false);
        })}
      >
        <FormText
          rows={4}
          label={intl.formatMessage({
            id: "app.home.workApproval.feedback",
            defaultMessage: "Feedback",
          })}
          {...register("feedback", { required: true })}
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
                    status: workApprovalMutation.variables.approved
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
                  workApprovalMutation.variables.approved
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
                    status: workApprovalMutation.variables.approved
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
                icon: workApprovalMutation.variables.approved ? RiCheckFill : RiCloseFill,
                spinner: false,
              },
            }}
          />
        </div>
      )}
    </article>
  );
};
