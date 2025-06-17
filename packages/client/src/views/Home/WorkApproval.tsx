import { NO_EXPIRATION, ZERO_BYTES32 } from "@ethereum-attestation-service/eas-sdk";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  RiCheckDoubleFill,
  RiCheckFill,
  RiCloseFill,
  RiHammerFill,
  RiLeafFill,
  RiPencilFill,
  RiPlantFill,
} from "@remixicon/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useState } from "react";
import { Form, useForm } from "react-hook-form";
import { useIntl } from "react-intl";
import { useParams } from "react-router-dom";
import { decodeErrorResult } from "viem";
import { arbitrum } from "viem/chains";
import { encodeFunctionData } from "viem/utils";
import { z } from "zod";
import { Button } from "@/components/UI/Button";
import { GardenCard } from "@/components/UI/Card/GardenCard";
import { Carousel, CarouselContent, CarouselItem } from "@/components/UI/Carousel/Carousel";
import { FormCard } from "@/components/UI/Form/Card";
import { FormInfo } from "@/components/UI/Form/Info";
import { FormText } from "@/components/UI/Form/Text";
import { CircleLoader } from "@/components/UI/Loader";
import { TopNav } from "@/components/UI/TopNav/TopNav";
import { EAS } from "@/constants";
import { getFileByHash } from "@/modules/pinata";
import { useGarden, useGardens } from "@/providers/garden";
import { useUser } from "@/providers/user";
import { abi } from "@/utils/abis/EAS.json";
import { abi as WorkApprovalResolverABI } from "@/utils/abis/WorkApprovalResolver.json";
import { encodeWorkApprovalData } from "@/utils/eas";
import { useNavigateToTop } from "@/utils/useNavigateToTop";
import { WorkCompleted } from "../Garden/Completed";
import { offlineDB } from "@/modules/offline-db";

type GardenWorkApprovalProps = {};

const workApprovalSchema = z.object({
  actionUID: z.number(),
  workUID: z.string(),
  approved: z.boolean(),
  feedback: z.string().optional(),
});

export const GardenWorkApproval: React.FC<GardenWorkApprovalProps> = () => {
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

  const work = garden?.works.find((work) => work.id === workId);
  const action = actions.find((action) => action.id === work?.actionUID);

  const { smartAccountClient } = useUser();
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
      // Check if we're offline or if smart account is not available
      if (!navigator.onLine || !smartAccountClient) {
        // Save to offline storage
        const offlineId = await offlineDB.addPendingWork({
          type: "approval",
          data: {
            ...draft,
            gardenerAddress: work?.gardenerAddress,
          },
          synced: false,
        });

        // Return a fake transaction hash for offline work
        return `0xoffline_${offlineId}` as `0x${string}`;
      }

      const encodedAttestationData = encodeWorkApprovalData(draft);

      const encodedData = encodeFunctionData({
        abi,
        functionName: "attest",
        args: [
          {
            schema: EAS["42161"].WORK_APPROVAL.uid,
            data: {
              recipient: work?.gardenerAddress as `0x${string}`,
              expirationTime: NO_EXPIRATION,
              revocable: true,
              refUID: ZERO_BYTES32,
              data: encodedAttestationData,
              value: 0n,
            },
          },
        ],
      });

      const receipt = await smartAccountClient.sendTransaction({
        chain: arbitrum,
        to: EAS["42161"].EAS.address as `0x${string}`,
        value: 0n,
        data: encodedData,
      });

      return receipt;
    },
    onMutate: () => {
      // toast.loading("Approving work...");
    },
    onSuccess: () => {
      // toast.dismiss();
      // toast.success("Work approved!");
      queryClient.invalidateQueries({ queryKey: ["workApprovals"] });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      if (error.data) {
        const _decodedError = decodeErrorResult({
          abi: WorkApprovalResolverABI,
          data: error.data as `0x${string}`,
        });
      }
    },
  });

  async function fetchWorkMetadata() {
    if (work) {
      const res = await getFileByHash(work.metadata);

      if (!res.data) throw new Error("No metadata found");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const metadata: WorkMetadata = res.data as any;

      setWorkMetadata(metadata);
    }
  }

  useEffect(() => {
    fetchWorkMetadata();
  }, [fetchWorkMetadata]);

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
              title={intl.formatMessage({
                id: "app.home.workApproval.evaluateWork",
                defaultMessage: "Evaluate Work",
              })}
              info={intl.formatMessage({
                id: "app.home.workApproval.verifyIfTheWorkIsAcceptable",
                defaultMessage: "Verify if the work is acceptable",
              })}
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
                <Carousel>
                  <CarouselContent>
                    {media.map((item, index) => (
                      <CarouselItem
                        key={item}
                        className="max-w-40 aspect-3/4 object-cover rounded-2xl "
                      >
                        <img
                          src={item}
                          alt={`Preview ${index}`}
                          className="w-full h-full aspect-3/4 object-cover rounded-2xl"
                        />
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
          </div>
          {work.status === "pending" && (
            <div className="flex border-t border-stroke-soft-200">
              <div className="flex flex-row gap-4 w-full mt-4 padded">
                <Button
                  onClick={handleSubmit((data) => {
                    data.approved = false;
                    workApprovalMutation.mutate(data);
                    queryClient.clear();
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
                    queryClient.clear();
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
            </div>
          )}
        </Form>
      )}
      {!workApprovalMutation.isIdle && (
        <div className="padded">
          <WorkCompleted
            garden={garden}
            status={workApprovalMutation.status}
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
