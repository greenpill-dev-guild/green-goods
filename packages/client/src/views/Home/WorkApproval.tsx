import { z } from "zod";
import React from "react";
import toast from "react-hot-toast";
import { Form, useForm } from "react-hook-form";
import { useParams } from "react-router-dom";
import {
  NO_EXPIRATION,
  ZERO_BYTES32,
} from "@ethereum-attestation-service/eas-sdk";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";

import { EAS } from "@/constants";

import { abi } from "@/utils/abis/EAS.json";
import { encodeWorkApprovalData } from "@/utils/eas";

import { queryClient } from "@/modules/react-query";

import { useUser } from "@/providers/user";
import { useGardens, useGarden } from "@/providers/garden";

import { Button } from "@/components/UI/Button";
import { CircleLoader } from "@/components/Loader";
import { FormInfo } from "@/components/UI/Form/Info";
import {
  RiCheckDoubleFill,
  RiCheckFill,
  RiCloseFill,
  RiHammerFill,
  RiLeafFill,
  RiPencilFill,
  RiPlantFill,
} from "@remixicon/react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/UI/Carousel/Carousel";
import { FormCard } from "@/components/UI/Form/Card";
import { FormText } from "@/components/UI/Form/Text";
import { TopNav } from "@/components/UI/TopNav/TopNav";
import { useNavigateToTop } from "@/utils/useNavigateToTop";
import { Chain, encodeFunctionData, TransactionRequest } from "viem";
import { arbitrum } from "viem/chains";

interface GardenWorkApprovalProps {}

const workApprovalSchema = z.object({
  actionUID: z.number(),
  workUID: z.string(),
  approved: z.boolean(),
  feedback: z.string().optional(),
});

export const GardenWorkApproval: React.FC<GardenWorkApprovalProps> = ({}) => {
  const { id, workId } = useParams<{
    id: string;
    workId: string;
  }>();
  const navigate = useNavigateToTop();
  const { garden } = useGarden(id!);
  const { actions } = useGardens();

  const work = garden?.works.find((work) => work.id === workId);
  const action = actions.find((action) => action.id === work?.actionUID);

  const { smartAccountClient } = useUser();
  const { register, handleSubmit, control } = useForm<WorkApprovalDraft>({
    defaultValues: {
      actionUID: work?.actionUID,
      workUID: work?.id,
      approved: false,
      feedback: "mmnnjknjun",
    },
    resolver: zodResolver(workApprovalSchema),
    shouldUseNativeValidation: true,
    mode: "onChange",
  });

  const workApprovalMutation = useMutation({
    mutationFn: async (draft: WorkApprovalDraft) => {
      if (!smartAccountClient) {
        throw new Error("No smart account client found");
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

      const transactionRequest: TransactionRequest & { chain: Chain } = {
        chain: arbitrum,
        to: EAS["42161"].EAS.address as `0x${string}`,
        value: 0n,
        data: encodedData,
      };

      const receipt =
        await smartAccountClient.sendTransaction(transactionRequest);

      return receipt;
    },
    onMutate: () => {
      console.log("Approving work...");
      toast.loading("Approving work...");
    },
    onSuccess: () => {
      console.log("Work approved!");
      toast.dismiss();
      toast.success("Work approved!");
      queryClient.invalidateQueries({ queryKey: ["workApprovals"] });
    },
    onError: (e) => {
      console.log("Work approval failed!", e);
      toast.dismiss();
      toast.error("Work approval failed!");
    },
  });

  if (!work || !action || !garden)
    return (
      <div className="w-full h-full grid place-items-center">
        <CircleLoader />
      </div>
    );

  const { title, feedback, media } = work;
  const plantSelection = [work.metadata];
  const plantCount = [work.metadata];

  return (
    <article>
      <TopNav onBackClick={() => navigate(`/home/${garden.id}`)} />
      <Form
        id="work-approve"
        control={control}
        className="relative flex flex-col gap-4 min-h-screen pb-6"
      >
        <div className="padded flex flex-col gap-4">
          <FormInfo
            title="Evaluate Work"
            info="Verify if the work is acceptable"
            Icon={RiCheckDoubleFill}
          />
          <h2>{title}</h2>
          <h6>Media</h6>
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
          <h6>Details</h6>
          <FormCard label="Action" value={action.title} Icon={RiHammerFill} />
          <FormCard
            label="Plant Types"
            value={plantSelection.join(", ")}
            Icon={RiPlantFill}
          />
          {feedback && (
            <FormCard
              label="Description"
              value={feedback}
              Icon={RiPencilFill}
            />
          )}
          <FormCard
            label="Plant Amount"
            value={plantCount.toString()}
            Icon={RiLeafFill}
          />
          <h6>Give your feedback</h6>
          <FormText rows={4} label="Description" {...register("feedback")} />
        </div>
        <div className="flex border-t border-stroke-soft-200">
          <div className="flex flex-row gap-4 w-full mt-4 padded">
            <Button
              onClick={handleSubmit((data) => {
                data.approved = false;
                workApprovalMutation.mutate(data);
              })}
              label="Reject"
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
              })}
              type="button"
              label="Approve"
              className="w-full"
              variant="primary"
              mode="filled"
              size="medium"
              shape="pilled"
              trailingIcon={<RiCheckFill className="w-5 h-5" />}
            />
          </div>
        </div>
      </Form>
    </article>
  );
};
