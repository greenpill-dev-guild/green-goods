import { z } from "zod";
import toast from "react-hot-toast";
import React, { useContext, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FormState, useForm, UseFormRegister } from "react-hook-form";

import { EAS } from "@/constants";

import { queryClient } from "@/modules/react-query";

import { useUser } from "./UserProvider";
import { useGarden } from "./GardenProvider";
import { encodeWorkData } from "@/utils/eas";

export interface WorkDataProps {
  actions: Action[];
  works: Work[];
  workApprovals: WorkApprovalCard[];
  form: {
    state: FormState<WorkDraft>;
    actionUID: number | null;
    images: File[];
    setImages: React.Dispatch<React.SetStateAction<File[]>>;
    setActionUID: React.Dispatch<React.SetStateAction<number | null>>;
    register: UseFormRegister<WorkDraft>;
    uploadWork?: (e?: React.BaseSyntheticEvent) => Promise<void>;
  };
}

const workSchema = z.object({
  actionUID: z.number(),
  title: z.string(),
  feedback: z.string(),
  metadata: z.string(),
  plantSelection: z.array(z.string()),
  plantCount: z.number(),
  media: z.array(z.instanceof(File)),
});

const WorkContext = React.createContext<WorkDataProps>({
  actions: [],
  actionUID: null,
  setActionUID: () => {},
  works: [],
  workApprovals: [],
  uploadWork: async () => "",
  form: {
    // @ts-ignore
    register: () => {},
    actionUID: null,
    setActionUID: () => {},
    uploadWork: async () => {},
  },
});

export const useWork = () => {
  return useContext(WorkContext);
};

export const WorkProvider = ({ children }: { children: React.ReactNode }) => {
  const { smartAccountClient } = useUser();
  const { actions } = useGarden();

  // QUERIES
  const { data: works } = useQuery<Work[]>({
    queryKey: ["works"],
    queryFn: () => [],
  });
  const { data: workApprovals } = useQuery<WorkApproval[]>({
    queryKey: ["workApprovals"],
    queryFn: () => [],
  });

  // MUTATIONS
  const [actionUID, setActionUID] = useState<number | null>(null);
  const [images, setImages] = useState<File[]>([]);

  const { register, handleSubmit, formState } = useForm<WorkDraft>({
    defaultValues: {
      actionUID: 0,
      title: "",
      feedback: "",
      plantSelection: [],
      plantCount: 0,
      // metadata: {},
      media: [],
    },
    resolver: zodResolver(workSchema),
  });

  const workMutation = useMutation({
    mutationFn: async (draft: WorkDraft) => {
      if (!smartAccountClient) {
        throw new Error("No smart account client found");
      }

      const encodedData = encodeWorkData(
        {
          ...draft,
          media: images,
        },
        "0x"
      );

      const encodedFunctionCall: `0x${string}` = `0x${encodedData}`; // Todo encode function call and arguments

      const receipt = await smartAccountClient.sendTransaction({
        to: EAS["42161"].EAS.address as `0x${string}`,
        data: encodedFunctionCall, // Todo encode solidty function call and arguments
      });

      return receipt;
    },
    onMutate: () => {
      toast.loading("Uploading work...");
    },
    onSuccess: () => {
      toast.success("Work uploaded!");
      queryClient.invalidateQueries({ queryKey: ["works"] });
    },
    onError: () => {
      toast.error("Work upload failed!");
    },
  });

  const uploadWork = handleSubmit((data) => {
    workMutation.mutate(data);
  });

  return (
    <WorkContext.Provider
      value={{
        actions: actions || [],
        works:
          works?.map((work) => {
            return {
              ...work,
              metadata: JSON.parse(work.metadata),
              approvals:
                workApprovals?.filter(
                  (approval) => approval.workUID === work.id
                ) || [],
            };
          }) || [],
        workApprovals: workApprovals || [],
        form: {
          state: formState,
          register,
          actionUID,
          images,
          setImages,
          setActionUID,
          uploadWork,
        },
      }}
    >
      {children}
    </WorkContext.Provider>
  );
};
