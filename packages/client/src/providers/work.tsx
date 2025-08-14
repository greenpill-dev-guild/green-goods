import { useMutation } from "@tanstack/react-query";
import React, { useContext, useState } from "react";
import { type Control, type FormState, type UseFormRegister, useForm } from "react-hook-form";
import toast from "react-hot-toast";
// import { decodeErrorResult } from "viem";
import { DEFAULT_CHAIN_ID } from "@/config";
import { jobQueue } from "@/modules/job-queue";
import { processWorkJobInline } from "@/modules/job-queue/inline-processor";
import { submitWorkToQueue, validateWorkDraft } from "@/modules/work-submission";
// import { abi as WorkResolverABI } from "@/utils/abis/WorkResolver.json";

import { Await, useRouteLoaderData } from "react-router-dom";
import { useUser } from "./user";

export enum WorkTab {
  Intro = "Intro",
  Media = "Media",
  Details = "Details",
  Review = "Review",
}

export interface WorkDataProps {
  gardens: Garden[];
  actions: Action[];
  workMutation: ReturnType<
    typeof useMutation<`0x${string}`, unknown, { draft: WorkDraft; images: File[] }, void>
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
  // Actions and gardens streamed via route loader at `garden-submit` route
  const loaderData = useRouteLoaderData("garden-submit") as
    | { actions?: Promise<Action[]>; gardens?: Promise<Garden[]> }
    | undefined;
  const chainId = DEFAULT_CHAIN_ID;

  // MUTATIONS
  const [actionUID, setActionUID] = useState<number | null>(null);
  const [gardenAddress, setGardenAddress] = useState<string | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [activeTab, setActiveTab] = useState(WorkTab.Intro);

  const { control, register, handleSubmit, formState, watch, reset } = useForm<WorkDraft>({
    defaultValues: {
      feedback: "",
      plantSelection: [],
      // plantCount is optional
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
    mutationFn: async ({ draft, images }: { draft: WorkDraft; images: File[] }) => {
      // Use consolidated submission utility
      // Use actions from the loader if provided; fallback to empty list
      const ctxActions = (loaderData?.actions ? await loaderData.actions : []) as Action[];
      // Always persist job to queue first
      const tx = await submitWorkToQueue(
        draft,
        gardenAddress!,
        actionUID!,
        ctxActions,
        chainId,
        images
      );

      // If a client is available, try to process inline immediately
      if (smartAccountClient) {
        try {
          const latestJobs = await jobQueue.getJobs({ kind: "work", synced: false });
          const job = latestJobs.find(
            (j) =>
              (j.payload as any)?.gardenAddress === gardenAddress &&
              (j.payload as any)?.actionUID === actionUID
          );
          if (job) {
            await processWorkJobInline(job.id, chainId, smartAccountClient);
          }
        } catch {
          // best-effort inline processing; job remains queued otherwise
        }
      }
      return tx;
    },
    onMutate: () => {
      toast.loading("Uploading work...", { id: "work-upload" });
    },
    onSuccess: () => {
      // Queue add succeeded; dismiss loading. Actual upload success is toasted via queue events.
      toast.dismiss("work-upload");
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (_error: any) => {
      // TODO: Move to job queue error handling
      // console.error("Work submission failed:", error);
      // if (error.data) {
      //   const _decodedError = decodeErrorResult({
      //     abi: WorkResolverABI,
      //     data: error.data as `0x${string}`,
      //   });
      //   void _decodedError; // For debugging purposes
      // } // TODO: Move to job queue error handling
      // // Properly decode revert data if available
      // if (
      //   error &&
      //   typeof error === "object" &&
      //   "data" in error &&
      //   typeof error.data === "string" &&
      //   error.data.startsWith("0x")
      // ) {
      //   try {
      //     decodeErrorResult({
      //       abi: WorkResolverABI,
      //       data: error.data as `0x${string}`,
      //     });
      //   } catch (decodeError) {
      //     console.error("Failed to decode error result:", decodeError);
      //   }
      // }
      // // Show user-friendly error message
      // const userFriendlyError = formatJobError(error.message || "Unknown error occurred");
      // console.error("User-friendly error:", userFriendlyError);
      // toast.error(userFriendlyError, { id: "work-upload" });
      // queryClient.invalidateQueries({
      //   queryKey: ["work-approvals"],
      // });
    },
  });

  const uploadWork = handleSubmit((data) => {
    // Ensure optional plantCount is handled; react-hook-form may provide undefined
    const draft: WorkDraft = {
      feedback: data.feedback,
      plantSelection: data.plantSelection,
      ...(typeof (data as any).plantCount === "number"
        ? { plantCount: (data as any).plantCount }
        : {}),
    } as WorkDraft;

    const errors = validateWorkDraft(draft, gardenAddress, actionUID, images);
    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }
    // Snapshot images to avoid race with state clearing after navigation
    const imagesSnapshot = images.slice();
    workMutation.mutate({ draft, images: imagesSnapshot });
  });

  return (
    <WorkContext.Provider
      value={{
        gardens: [],
        actions: [],
        workMutation,
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
      {loaderData?.actions && loaderData?.gardens ? (
        <React.Suspense fallback={children}>
          <Await resolve={Promise.all([loaderData.actions, loaderData.gardens])}>
            {([actions, gardens]: [Action[], Garden[]]) => (
              <WorkContext.Provider
                value={{
                  gardens,
                  actions,
                  workMutation,
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
