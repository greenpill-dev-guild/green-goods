import { z } from "zod";
import toast from "react-hot-toast";
import { Form, useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";

import { EAS } from "@/constants";
import { encodeWorkApprovalData } from "@/utils/eas";

import { queryClient } from "@/modules/react-query";

import { useUser } from "@/providers/user";

import { FormInput } from "../Form/Input";
import { Button } from "../Button";

interface GardenWorkApprovalProps {
  work: Work;
}

const workApprovalSchema = z.object({
  actionUID: z.string(),
  workUID: z.string(),
  approved: z.boolean(),
  feedback: z.string(),
});

export const GardenWorkApproval: React.FC<GardenWorkApprovalProps> = ({
  work,
}) => {
  const { title, feedback, media } = work;

  const { smartAccountClient } = useUser();
  const { register, handleSubmit } = useForm<WorkApprovalDraft>({
    defaultValues: {
      actionUID: work.actionUID,
      workUID: work.id,
      approved: false,
      feedback: "",
    },
    resolver: zodResolver(workApprovalSchema),
  });

  const workApprovalMutation = useMutation({
    mutationFn: async (draft: WorkApprovalDraft) => {
      if (!smartAccountClient) {
        throw new Error("No smart account client found");
      }

      const recipient = work.gardenerAddress as `0x${string}`;

      const data = encodeWorkApprovalData(draft, recipient);

      const receipt = await smartAccountClient.sendTransaction({
        to: EAS["42161"].EAS.address as `0x${string}`,
        data,
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

  return (
    <Form>
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
          label="Reject"
          onClick={handleSubmit((data) => {
            data.approved = false;
            workApprovalMutation.mutate(data);
          })}
        />
        <Button
          label="Approve"
          onClick={handleSubmit((data) => {
            data.approved = true;
            workApprovalMutation.mutate(data);
          })}
        />
      </div>
    </Form>
  );
};
