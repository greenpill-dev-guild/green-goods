import { type QueryObserverResult, useMutation, useQuery } from "@tanstack/react-query";
import React, { useContext, useState } from "react";
import { type Control, type FormState, type UseFormRegister, useForm } from "react-hook-form";
import { decodeErrorResult } from "viem";
import { DEFAULT_CHAIN_ID } from "@/config";
import { getWorkApprovals } from "@/modules/eas";
import { queryClient } from "@/modules/react-query";
import { formatJobError, submitWorkToQueue } from "@/modules/work-submission";
import { abi as WorkResolverABI } from "@/utils/abis/WorkResolver.json";

import { Await, useLoaderData } from "react-router-dom";
import { useUser } from "./user";

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
  workMutation: ReturnType<typeof useMutation<`0x${string}`, unknown, WorkDraft, void>>;
  workApprovals: WorkApproval[];
  workApprovalMap: Record<string, WorkApproval>;
  refetchWorkApprovals: () => Promise<QueryObserverResult<WorkApproval[], Error>>;
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
    values: Record<string, unknown>;
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
  const { eoa } = useUser();
  // Actions and gardens streamed via route loader at garden-submit route
  const loader = ((): { actions?: Promise<Action[]>; gardens?: Promise<Garden[]> } => {
    try {
      return useLoaderData() as any;
    } catch {
      return {};
    }
  })();
  const chainId = DEFAULT_CHAIN_ID;

  // QUERIES
  const { data: workApprovals, refetch: refetchWorkApprovals } = useQuery<WorkApproval[]>({
    queryKey: ["workApprovals", chainId, eoa?.address],
    queryFn: () => getWorkApprovals(eoa?.address, chainId),
  });

  // MUTATIONS
  const [actionUID, setActionUID] = useState<number | null>(null);
  const [gardenAddress, setGardenAddress] = useState<string | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [activeTab, setActiveTab] = useState(WorkTab.Intro);

  const { control, register, handleSubmit, formState, watch, reset } = useForm<WorkDraft>({
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
  const values = watch() as unknown as Record<string, unknown>;

  const workMutation = useMutation({
    mutationFn: async (draft: WorkDraft) => {
      // Use consolidated submission utility
      // Use actions from the loader if provided later; fallback to empty list
      const ctxActions = [] as Action[];
      return submitWorkToQueue(draft, gardenAddress!, actionUID!, ctxActions, chainId, images);
    },
    onMutate: () => {
      // toast.loading("Uploading work..."); @dev deprecated
    },
    onSuccess: () => {
      // toast.remove();
      // toast.success("Work uploaded!"); @dev deprecated
      queryClient.invalidateQueries({ queryKey: ["works"] });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      console.error("Work submission failed:", error);

      if (error.data) {
        const _decodedError = decodeErrorResult({
          abi: WorkResolverABI,
          data: error.data as `0x${string}`,
        });
        void _decodedError; // For debugging purposes
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
            abi: WorkResolverABI,
            data: error.data as `0x${string}`,
          });
        } catch (decodeError) {
          console.error("Failed to decode error result:", decodeError);
        }
      }

      // Show user-friendly error message
      const userFriendlyError = formatJobError(error.message || "Unknown error occurred");
      console.error("User-friendly error:", userFriendlyError);

      queryClient.invalidateQueries({
        queryKey: ["work-approvals"],
      });
    },
  });

  const uploadWork = handleSubmit((data) => {
    workMutation.mutate(data);
  });

  return (
    <WorkContext.Provider
      value={{
        gardens: [],
        actions: [],
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
          values,

          reset,
        },
        activeTab,
        setActiveTab,
      }}
    >
      {/* Resolve actions/gardens lazily if provided by route loader */}
      {loader.actions && loader.gardens ? (
        <React.Suspense fallback={children}>
          <Await resolve={Promise.all([loader.actions, loader.gardens])}>
            {([actions, gardens]: [Action[], Garden[]]) => (
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
                    values,
                    reset,
                  },
                  activeTab,
                  setActiveTab,
                }}
              >
                {children}
              </WorkContext.Provider>
            )}
          </Await>
        </React.Suspense>
      ) : (
        children
      )}
    </WorkContext.Provider>
  );
};
