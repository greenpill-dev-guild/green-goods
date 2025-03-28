import { z } from "zod";
import React from "react";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
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
import { FormInput } from "@/components/UI/Form/Input";

interface GardenWorkApprovalProps {}

const workApprovalSchema = z.object({
  actionUID: z.string(),
  workUID: z.string(),
  approved: z.boolean(),
  feedback: z.string(),
});

export const GardenWorkApproval: React.FC<GardenWorkApprovalProps> = ({}) => {
  const { id, workId } = useParams<{
    id: string;
    workId: string;
  }>();

  const { garden } = useGarden(id!);
  const { actions } = useGardens();

  const work = garden?.works.find((work) => work.id === workId);
  const action = actions.find((action) => action.id === work?.actionUID);

  const { smartAccountClient } = useUser();
  const { register, handleSubmit } = useForm<WorkApprovalDraft>({
    defaultValues: {
      actionUID: work?.actionUID,
      workUID: work?.id,
      approved: false,
      feedback: "",
    },
    resolver: zodResolver(workApprovalSchema),
    shouldUseNativeValidation: true,
  });

  const workApprovalMutation = useMutation({
    mutationFn: async (draft: WorkApprovalDraft) => {
      if (!smartAccountClient) {
        throw new Error("No smart account client found");
      }

      const data = encodeWorkApprovalData(draft);

      const receipt = await smartAccountClient.writeContract({
        abi,
        address: EAS["42161"].EAS.address as `0x${string}`,
        functionName: "attest",
        args: [
          {
            schema: EAS["42161"].WORK_APPROVAL.uid,
            data: {
              recipient: work?.gardenerAddress as `0x${string}`,
              expirationTime: NO_EXPIRATION,
              revocable: true,
              refUID: ZERO_BYTES32,
              data,
              value: 0n,
            },
          },
        ],
      });

      return receipt;
    },
    onMutate: () => {
      toast.loading("Approving work...");
    },
    onSuccess: () => {
      toast.success("Work approved!");
      queryClient.invalidateQueries({ queryKey: ["workApprovals"] });
    },
    onError: () => {
      toast.error("Work approval failed!");
    },
  });

  if (!work || !action || !garden)
    return (
      <main className="w-full h-full grid place-items-center">
        <CircleLoader />;
      </main>
    );

  const { title, feedback, media } = work;

  return (
    <form>
      <h2>{title}</h2>
      <p>{feedback}</p>
      <ul className="carousel rounded-box w-full">
        {media.map((media) => (
          <li key={media} className="carousel-item w-full">
            <img src={media} alt="Media" />
          </li>
        ))}
      </ul>
      <FormInput label="Feedback" {...register("feedback")} />
      <div className="flex gap-2 w-full">
        <Button
          type="button"
          label="Reject"
          onClick={handleSubmit((data) => {
            data.approved = false;
            workApprovalMutation.mutate(data);
          })}
        />
        <Button
          type="button"
          label="Approve"
          onClick={handleSubmit((data) => {
            data.approved = true;
            workApprovalMutation.mutate(data);
          })}
        />
      </div>
    </form>
  );
};
