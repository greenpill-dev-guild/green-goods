// import { z } from "zod";
import toast from "react-hot-toast";
import React, { useContext, useState } from "react";
// import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Control, FormState, useForm, UseFormRegister } from "react-hook-form";

import { EAS } from "@/constants";

import { queryClient } from "@/modules/react-query";

import { useUser } from "./user";
import { useGarden } from "./garden";
import { encodeWorkData } from "@/utils/eas";
import { abi } from "@/utils/abis/EAS.json";
import {
  NO_EXPIRATION,
  ZERO_BYTES32,
} from "@ethereum-attestation-service/eas-sdk";

export enum WorkTab {
  Intro = "Intro",
  Media = "Media",
  Details = "Details",
  Review = "Review",
  Complete = "Complete",
}

export interface WorkDataProps {
  gardens: Garden[];
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
    control: Control<WorkDraft>;
    uploadWork: (e?: React.BaseSyntheticEvent) => Promise<void>;
    gardenAddress: string | null;
    setGardenAddress: React.Dispatch<React.SetStateAction<string | null>>;
    feedback: string;
    plantSelection: string[];
    plantCount: number;
  };
  activeTab: WorkTab;
  setActiveTab: React.Dispatch<React.SetStateAction<WorkTab>>;
}

// const workSchema = z.object({
//   title: z.string().optional(),
//   feedback: z.string().optional(),
//   metadata: z.string().optional(),
//   plantSelection: z.array(z.string()).optional(),
//   plantCount: z.number(),
//   media: z.array(z.instanceof(File)).optional(),
// });

const WorkContext = React.createContext<WorkDataProps>({
  gardens: [],
  actions: [],
  works: [],
  workApprovals: [],
  form: {
    // @ts-ignore
    register: () => {},
    // @ts-ignore
    control: () => {},
    actionUID: null,
    setActionUID: () => {},
    uploadWork: async () => {},
    gardenAddress: null,
    setGardenAddress: () => {},
  },
});

export const useWork = () => {
  return useContext(WorkContext);
};

export const WorkProvider = ({ children }: { children: React.ReactNode }) => {
  const { smartAccountClient } = useUser();
  const { actions, gardens } = useGarden();

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
  const [gardenAddress, setGardenAddress] = useState<string | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [activeTab, setActiveTab] = useState(WorkTab.Intro);

  const { control, register, handleSubmit, formState, watch } =
    useForm<WorkDraft>({
      defaultValues: {
        feedback: "",
        plantSelection: [],
        plantCount: 0,
      },
      shouldUseNativeValidation: true,
      mode: "onChange",
      // resolver: zodResolver(workSchema),
    });

  const feedback = watch("feedback");
  const plantSelection = watch("plantSelection");
  const plantCount = watch("plantCount");

  const workMutation = useMutation({
    mutationFn: async (draft: WorkDraft) => {
      if (!smartAccountClient) throw new Error("No smart account client found");
      if (!gardenAddress) throw new Error("No garden address found");
      if (typeof actionUID !== "number") throw new Error("No action UID found");

      const action = actions.find((action) => action.id === actionUID);

      const encodedData = await encodeWorkData({
        ...draft,
        title: `${action?.title} - ${new Date().toISOString()}`,
        actionUID,
        media: images,
      });

      const receipt = await smartAccountClient.writeContract({
        abi,
        address: EAS["42161"].EAS.address as `0x${string}`,
        functionName: "attest",
        args: [
          {
            schema: EAS["42161"].WORK.uid,
            data: {
              recipient: gardenAddress as `0x${string}`,
              expirationTime: NO_EXPIRATION,
              revocable: true,
              refUID: ZERO_BYTES32,
              data: encodedData,
              value: 0n,
            },
          },
        ],
      });

      return receipt;
    },
    onMutate: () => {
      toast.loading("Uploading work...");
    },
    onSuccess: () => {
      toast.remove();
      toast.success("Work uploaded!");
      queryClient.invalidateQueries({ queryKey: ["works"] });
    },
    onError: () => {
      toast.remove();
      toast.error("Work upload failed!");
    },
  });

  const uploadWork = handleSubmit((data) => {
    workMutation.mutate(data);
  });

  return (
    <WorkContext.Provider
      value={{
        gardens,
        actions,
        works: works || [],
        workApprovals: workApprovals || [],
        form: {
          state: formState,
          control,
          register,
          actionUID,
          images,
          setImages,
          setActionUID,
          uploadWork,
          gardenAddress,
          setGardenAddress,
          feedback,
          plantSelection,
          plantCount,
        },
        activeTab,
        setActiveTab,
      }}
    >
      {children}
    </WorkContext.Provider>
  );
};
