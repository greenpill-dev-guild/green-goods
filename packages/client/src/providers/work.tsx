import {
  QueryObserverResult,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import {
  NO_EXPIRATION,
  ZERO_BYTES32,
} from "@ethereum-attestation-service/eas-sdk";
import React, { useContext, useState } from "react";
// import { encodeFunctionData, parseEther, zeroAddress } from "viem";
// import { zodResolver } from "@hookform/resolvers/zod";
import { Control, FormState, useForm, UseFormRegister } from "react-hook-form";

import { EAS } from "@/constants";

import { getWorkApprovals } from "@/modules/eas";
import { queryClient } from "@/modules/react-query";

import { encodeWorkData } from "@/utils/eas";
import { abi } from "@/utils/abis/EAS.json";

import { useUser } from "./user";
import { useGardens } from "./garden";
import { arbitrum } from "viem/chains";
import { encodeFunctionData } from "viem/utils";
import { Chain, TransactionRequest } from "viem";

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
  workMutation: ReturnType<
    typeof useMutation<`0x${string}`, Error, WorkDraft, void>
  >;
  workApprovals: WorkApproval[];
  workApprovalMap: Record<string, WorkApproval>;
  refetchWorkApprovals: () => Promise<
    QueryObserverResult<WorkApproval[], Error>
  >;
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
    reset: () => void;
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
  workApprovals: [],
  workApprovalMap: {},
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
    reset: () => {},
  },
});

export const useWork = () => {
  return useContext(WorkContext);
};

export const WorkProvider = ({ children }: { children: React.ReactNode }) => {
  const { smartAccountClient } = useUser();
  const { actions, gardens } = useGardens();

  // QUERIES
  const { data: workApprovals, refetch: refetchWorkApprovals } = useQuery<
    WorkApproval[]
  >({
    queryKey: ["workApprovals"],
    queryFn: () => getWorkApprovals(),
  });

  // MUTATIONS
  const [actionUID, setActionUID] = useState<number | null>(null);
  const [gardenAddress, setGardenAddress] = useState<string | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [activeTab, setActiveTab] = useState(WorkTab.Intro);

  const { control, register, handleSubmit, formState, watch, reset } =
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

      const encodedAttestationData = await encodeWorkData({
        ...draft,
        title: `${action?.title} - ${new Date().toISOString()}`,
        actionUID,
        media: images,
      });

      const encodedData = encodeFunctionData({
        abi,
        args: [
          {
            schema: EAS["42161"].WORK.uid,
            data: {
              recipient: gardenAddress as `0x${string}`,
              expirationTime: NO_EXPIRATION,
              revocable: true,
              refUID: ZERO_BYTES32,
              data: encodedAttestationData,
              value: 0n,
            },
          },
        ],
        functionName: "attest",
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
      // toast.loading("Uploading work..."); @dev deprecated
    },
    onSuccess: () => {
      // toast.remove();
      // toast.success("Work uploaded!"); @dev deprecated
      queryClient.invalidateQueries({ queryKey: ["works"] });
    },
    onError: (error) => {
      console.error("Upload Work", error);
      // toast.remove();
      // toast.error("Work upload failed!"); @dev deprecated
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
        workMutation,
        workApprovals: workApprovals ?? [],
        workApprovalMap:
          workApprovals?.reduce(
            (acc, work) => {
              acc[work.workUID] = work;
              return acc;
            },
            {} as Record<string, WorkApproval>
          ) ?? {},
        refetchWorkApprovals,
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
          reset,
        },
        activeTab,
        setActiveTab,
      }}
    >
      {children}
    </WorkContext.Provider>
  );
};
