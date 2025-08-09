import { zodResolver } from "@hookform/resolvers/zod";
import {
  RiCheckDoubleFill,
  RiCheckFill,
  RiCloseFill,
  RiDownloadLine,
  RiExternalLinkLine,
  RiHammerFill,
  RiLeafFill,
  RiPencilFill,
  RiPlantFill,
  RiShareLine,
  RiZoomInLine,
} from "@remixicon/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import { Form, useForm } from "react-hook-form";
import { useIntl } from "react-intl";
import { useParams } from "react-router-dom";
import { decodeErrorResult } from "viem";

import { z } from "zod";
import { Button } from "@/components/UI/Button";
import { GardenCard } from "@/components/UI/Card/GardenCard";
import { Carousel, CarouselContent, CarouselItem } from "@/components/UI/Carousel/Carousel";
import { FormCard } from "@/components/UI/Form/Card";
import { FormInfo } from "@/components/UI/Form/Info";
import { FormText } from "@/components/UI/Form/Text";
import { CircleLoader } from "@/components/UI/Loader";
import { TopNav } from "@/components/UI/TopNav/TopNav";
import { useCurrentChain, useNavigateToTop } from "@/hooks";
import { createOfflineTxHash, jobQueue } from "@/modules/job-queue";
import { getFileByHash } from "@/modules/pinata";
import { useGarden, useGardens } from "@/providers/garden";
import { useUser } from "@/providers/user";
import { abi as WorkApprovalResolverABI } from "@/utils/abis/WorkApprovalResolver.json";
import { compareChainId } from "@/utils/chainId";
import { isValidAttestationId, openEASExplorer } from "@/utils/easExplorer";
import { downloadWorkData, downloadWorkMedia, shareWork, type WorkData } from "@/utils/workActions";
import { WorkCompleted } from "../../Garden/Completed";

type GardenWorkProps = {};

const workApprovalSchema = z.object({
  actionUID: z.number(),
  workUID: z.string(),
  approved: z.boolean(),
  feedback: z.string().optional(),
});

export const GardenWork: React.FC<GardenWorkProps> = () => {
  const intl = useIntl();
  const { id, workId } = useParams<{
    id: string;
    workId: string;
  }>();
  const [workMetadata, setWorkMetadata] = useState<WorkMetadata | null>(null);
  const navigate = useNavigateToTop();
  const { garden } = useGarden(id!);
  const { actions } = useGardens();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();

  const work = garden?.works.find((work) => work.id === workId);
  const action = actions.find((action) => compareChainId(action.id, work?.actionUID || 0));

  const { smartAccountAddress } = useUser();

  // Determine user role and viewing mode
  const viewingMode = useMemo(() => {
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
    } catch (error) {
      // Error tracked in analytics
    }
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
    } catch (error) {
      // Error tracked in analytics
    }
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
    } catch (error) {
      // Error tracked in analytics
    }
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

  const workApprovalMutation = useMutation({
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
      return createOfflineTxHash(jobId);
    },
    onMutate: () => {
      // toast.loading("Approving work...");
    },
    onSuccess: () => {
      // toast.dismiss();
      // toast.success("Work approved!");
      queryClient.invalidateQueries({ queryKey: ["workApprovals"] });
    },
    onError: (error: unknown) => {
      if (error instanceof Error && error.message.includes("User rejected the request")) {
        return;
      }

      // Properly decode revert data if available
      if (
        error &&
        typeof error === "object" &&
        "data" in error &&
        typeof error.data === "string" &&
        error.data.startsWith("0x")
      ) {
        try {
          decodeErrorResult({
            abi: WorkApprovalResolverABI,
            data: error.data as `0x${string}`,
          });
        } catch (decodeError) {
          // Failed to decode error result
        }
      }
    },
  });

  useEffect(() => {
    async function fetchWorkMetadata() {
      if (work) {
        const res = await getFileByHash(work.metadata);

        if (!res.data) throw new Error("No metadata found");

        const metadata: WorkMetadata = res.data as unknown as WorkMetadata;

        setWorkMetadata(metadata);
      }
    }

    fetchWorkMetadata();
  }, [work]);

  if (!work || !action || !garden)
    return (
      <div className="w-full h-full grid place-items-center">
        <CircleLoader />
      </div>
    );

  const { feedback, media } = work;

  return (
    <article>
      <TopNav onBackClick={() => navigate(`/home/${garden.id}`)} />
      {workApprovalMutation.isIdle && (
        <Form
          id="work-approve"
          control={control}
          className="relative flex flex-col gap-4 min-h-screen pb-6"
        >
          <div className="padded flex flex-col gap-4">
            <FormInfo
              title={
                viewingMode === "operator"
                  ? intl.formatMessage({
                      id: "app.home.workApproval.evaluateWork",
                      defaultMessage: "Evaluate Work",
                    })
                  : viewingMode === "gardener"
                    ? intl.formatMessage({
                        id: "app.home.work.yourSubmission",
                        defaultMessage: "Your Work Submission",
                      })
                    : intl.formatMessage({
                        id: "app.home.work.viewWork",
                        defaultMessage: "View Work",
                      })
              }
              info={
                viewingMode === "operator"
                  ? intl.formatMessage({
                      id: "app.home.workApproval.verifyIfTheWorkIsAcceptable",
                      defaultMessage: "Verify if the work is acceptable",
                    })
                  : viewingMode === "gardener"
                    ? intl.formatMessage({
                        id: "app.home.work.submittedForReview",
                        defaultMessage: "Submitted for review",
                      })
                    : intl.formatMessage({
                        id: "app.home.work.exploreSubmission",
                        defaultMessage: "Explore this work submission",
                      })
              }
              Icon={RiCheckDoubleFill}
            />
            <h6>
              {intl.formatMessage({
                id: "app.home.workApproval.garden",
                defaultMessage: "Garden",
              })}
            </h6>
            <GardenCard
              garden={garden}
              media="small"
              height="selection"
              showOperators={true}
              selected={false}
              showDescription={false}
              showBanner={false}
            />
            {media.length > 0 && (
              <>
                <h6>
                  {intl.formatMessage({
                    id: "app.home.workApproval.media",
                    defaultMessage: "Media",
                  })}
                </h6>
                <Carousel enablePreview previewImages={media}>
                  <CarouselContent>
                    {media.map((item, index) => (
                      <CarouselItem
                        key={item}
                        index={index}
                        className="max-w-40 aspect-3/4 object-cover rounded-2xl"
                      >
                        <div className="relative group">
                          <img
                            src={item}
                            alt={`Preview ${index}`}
                            className="w-full h-full aspect-3/4 object-cover rounded-2xl"
                          />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-2xl flex items-center justify-center">
                            <RiZoomInLine className="w-8 h-8 text-white" />
                          </div>
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                </Carousel>
              </>
            )}
            <h6>
              {intl.formatMessage({
                id: "app.home.workApproval.details",
                defaultMessage: "Details",
              })}
            </h6>
            <FormCard
              label={intl.formatMessage({
                id: "app.home.workApproval.action",
                defaultMessage: "Action",
              })}
              value={action.title}
              Icon={RiHammerFill}
            />
            <FormCard
              label={intl.formatMessage({
                id: "app.home.workApproval.plantTypes",
                defaultMessage: "Plant Types",
              })}
              value={workMetadata?.plantSelection.join(", ") || ""}
              Icon={RiPlantFill}
            />
            {feedback && (
              <FormCard
                label={intl.formatMessage({
                  id: "app.home.workApproval.description",
                  defaultMessage: "Description",
                })}
                value={feedback}
                Icon={RiPencilFill}
              />
            )}
            <FormCard
              label={intl.formatMessage({
                id: "app.home.workApproval.plantAmount",
                defaultMessage: "Plant Amount",
              })}
              value={workMetadata?.plantCount.toString() || ""}
              Icon={RiLeafFill}
            />
            {viewingMode === "operator" && work.status === "pending" && (
              <>
                <h6>
                  {intl.formatMessage({
                    id: "app.home.workApproval.giveYourFeedback",
                    defaultMessage: "Give your feedback",
                  })}
                </h6>
                <FormText
                  rows={4}
                  label={intl.formatMessage({
                    id: "app.home.workApproval.description",
                    defaultMessage: "Description",
                  })}
                  {...register("feedback")}
                />
              </>
            )}
          </div>
          {/* Action buttons based on viewing mode and work status */}
          <div className="flex border-t border-stroke-soft-200">
            <div className="flex flex-col gap-3 w-full mt-4 padded">
              {/* Operator View - Can approve/reject pending work */}
              {viewingMode === "operator" && (
                <div className="flex flex-col gap-3">
                  {work.status === "pending" && (
                    <div className="flex flex-row gap-4 w-full">
                      <Button
                        onClick={handleSubmit((data) => {
                          data.approved = false;
                          workApprovalMutation.mutate(data);
                          queryClient.invalidateQueries({ queryKey: ["workApprovals"] });
                          if (garden?.id) {
                            queryClient.invalidateQueries({ queryKey: ["works", garden.id] });
                          }
                        })}
                        label={intl.formatMessage({
                          id: "app.home.workApproval.reject",
                          defaultMessage: "Reject",
                        })}
                        className="w-full"
                        variant="error"
                        type="button"
                        shape="pilled"
                        mode="stroke"
                        leadingIcon={<RiCloseFill className="w-5 h-5" />}
                      />
                      <Button
                        onClick={handleSubmit((data) => {
                          data.approved = true;
                          workApprovalMutation.mutate(data);
                          queryClient.invalidateQueries({ queryKey: ["workApprovals"] });
                          if (garden?.id) {
                            queryClient.invalidateQueries({ queryKey: ["works", garden.id] });
                          }
                        })}
                        type="button"
                        label={intl.formatMessage({
                          id: "app.home.workApproval.approve",
                          defaultMessage: "Approve",
                        })}
                        className="w-full"
                        variant="primary"
                        mode="filled"
                        size="medium"
                        shape="pilled"
                        trailingIcon={<RiCheckFill className="w-5 h-5" />}
                      />
                    </div>
                  )}

                  {/* Operator tools - always available */}
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-row gap-3">
                      <Button
                        onClick={handleDownloadData}
                        label={intl.formatMessage({
                          id: "app.home.work.downloadData",
                          defaultMessage: "Download Data",
                        })}
                        className="flex-1"
                        variant="neutral"
                        type="button"
                        shape="pilled"
                        mode="stroke"
                        leadingIcon={<RiDownloadLine className="w-5 h-5" />}
                      />
                      {work.media && work.media.length > 0 && (
                        <Button
                          onClick={handleDownloadMedia}
                          label={intl.formatMessage({
                            id: "app.home.work.downloadMedia",
                            defaultMessage: "Download Media",
                          })}
                          className="flex-1"
                          variant="neutral"
                          type="button"
                          shape="pilled"
                          mode="stroke"
                          leadingIcon={<RiDownloadLine className="w-5 h-5" />}
                        />
                      )}
                    </div>
                    <div className="flex flex-row gap-3">
                      <Button
                        onClick={handleShare}
                        label={intl.formatMessage({
                          id: "app.home.work.share",
                          defaultMessage: "Share Work",
                        })}
                        className="flex-1"
                        variant="neutral"
                        type="button"
                        shape="pilled"
                        mode="stroke"
                        leadingIcon={<RiShareLine className="w-5 h-5" />}
                      />
                      {work.id && isValidAttestationId(work.id) && (
                        <Button
                          onClick={handleViewAttestation}
                          label={intl.formatMessage({
                            id: "app.home.work.viewAttestation",
                            defaultMessage: "View Attestation",
                          })}
                          className="flex-1"
                          variant="neutral"
                          type="button"
                          shape="pilled"
                          mode="stroke"
                          leadingIcon={<RiExternalLinkLine className="w-5 h-5" />}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Gardener View - Can see their work status and actions */}
              {viewingMode === "gardener" && (
                <div className="flex flex-col gap-3">
                  {work.status === "pending" && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-700">
                        {intl.formatMessage({
                          id: "app.home.work.pendingReview",
                          defaultMessage: "Your work is pending review by a garden operator.",
                        })}
                      </p>
                    </div>
                  )}
                  {work.status === "approved" && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-sm text-green-700">
                        {intl.formatMessage({
                          id: "app.home.work.approved",
                          defaultMessage: "Your work has been approved!",
                        })}
                      </p>
                    </div>
                  )}
                  {work.status === "rejected" && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-sm text-red-700">
                        {intl.formatMessage({
                          id: "app.home.work.rejected",
                          defaultMessage: "Your work was rejected. Please review the feedback.",
                        })}
                      </p>
                    </div>
                  )}

                  {/* Action buttons for gardener - always available */}
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-row gap-3">
                      <Button
                        onClick={handleDownloadData}
                        label={intl.formatMessage({
                          id: "app.home.work.downloadData",
                          defaultMessage: "Download Data",
                        })}
                        className="flex-1"
                        variant="neutral"
                        type="button"
                        shape="pilled"
                        mode="stroke"
                        leadingIcon={<RiDownloadLine className="w-5 h-5" />}
                      />
                      {work.media && work.media.length > 0 && (
                        <Button
                          onClick={handleDownloadMedia}
                          label={intl.formatMessage({
                            id: "app.home.work.downloadMedia",
                            defaultMessage: "Download Media",
                          })}
                          className="flex-1"
                          variant="neutral"
                          type="button"
                          shape="pilled"
                          mode="stroke"
                          leadingIcon={<RiDownloadLine className="w-5 h-5" />}
                        />
                      )}
                    </div>
                    <div className="flex flex-row gap-3">
                      <Button
                        onClick={handleShare}
                        label={intl.formatMessage({
                          id: "app.home.work.share",
                          defaultMessage: "Share Work",
                        })}
                        className="flex-1"
                        variant="neutral"
                        type="button"
                        shape="pilled"
                        mode="stroke"
                        leadingIcon={<RiShareLine className="w-5 h-5" />}
                      />
                      {work.id && isValidAttestationId(work.id) && (
                        <Button
                          onClick={handleViewAttestation}
                          label={intl.formatMessage({
                            id: "app.home.work.viewAttestation",
                            defaultMessage: "View Attestation",
                          })}
                          className="flex-1"
                          variant="neutral"
                          type="button"
                          shape="pilled"
                          mode="stroke"
                          leadingIcon={<RiExternalLinkLine className="w-5 h-5" />}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Viewer Mode - Read-only view with limited actions */}
              {viewingMode === "viewer" && (
                <div className="flex flex-col gap-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <p className="text-sm text-slate-700">
                      {intl.formatMessage({
                        id: "app.home.work.viewerMode",
                        defaultMessage: "You are viewing this work submission.",
                      })}
                    </p>
                  </div>

                  {/* Action buttons for viewers */}
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-row gap-3">
                      <Button
                        onClick={handleDownloadData}
                        label={intl.formatMessage({
                          id: "app.home.work.downloadData",
                          defaultMessage: "Download Data",
                        })}
                        className="flex-1"
                        variant="neutral"
                        type="button"
                        shape="pilled"
                        mode="stroke"
                        leadingIcon={<RiDownloadLine className="w-5 h-5" />}
                      />
                      {work.media && work.media.length > 0 && (
                        <Button
                          onClick={handleDownloadMedia}
                          label={intl.formatMessage({
                            id: "app.home.work.downloadMedia",
                            defaultMessage: "Download Media",
                          })}
                          className="flex-1"
                          variant="neutral"
                          type="button"
                          shape="pilled"
                          mode="stroke"
                          leadingIcon={<RiDownloadLine className="w-5 h-5" />}
                        />
                      )}
                    </div>
                    <div className="flex flex-row gap-3">
                      <Button
                        onClick={handleShare}
                        label={intl.formatMessage({
                          id: "app.home.work.share",
                          defaultMessage: "Share Work",
                        })}
                        className="flex-1"
                        variant="neutral"
                        type="button"
                        shape="pilled"
                        mode="stroke"
                        leadingIcon={<RiShareLine className="w-5 h-5" />}
                      />
                      {work.id && isValidAttestationId(work.id) && (
                        <Button
                          onClick={handleViewAttestation}
                          label={intl.formatMessage({
                            id: "app.home.work.viewAttestation",
                            defaultMessage: "View Attestation",
                          })}
                          className="flex-1"
                          variant="neutral"
                          type="button"
                          shape="pilled"
                          mode="stroke"
                          leadingIcon={<RiExternalLinkLine className="w-5 h-5" />}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Form>
      )}
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
