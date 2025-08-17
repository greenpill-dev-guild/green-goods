import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import React, { useContext } from "react";
import { type Control, type FormState, type UseFormRegister, useForm } from "react-hook-form";
import toast from "react-hot-toast";
// import { decodeErrorResult } from "viem";
import { DEFAULT_CHAIN_ID } from "@/config";
// import { jobQueue } from "@/modules/job-queue";
import { processWorkJobInline } from "@/modules/job-queue/inline-processor";
import { submitWorkToQueue, validateWorkDraft, formatJobError } from "@/modules/work-submission";
// import { abi as WorkResolverABI } from "@/utils/abis/WorkResolver.json";

import { useUser } from "./user";
import { useActions, useGardens } from "@/hooks/useBaseLists";
import { useWorkFlowStore, type WorkFlowState } from "@/state/useWorkFlowStore";

export enum WorkTab {
  Intro = "Intro",
  Media = "Media",
  Details = "Details",
  Review = "Review",
}

export interface WorkDataProps {
  gardens: Garden[];
  actions: Action[];
  isLoading?: boolean;
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

const workSchema = z.object({
  feedback: z.string().min(1, "Feedback is required"),
  plantSelection: z.array(z.string()).default([]),
  plantCount: z.number().nonnegative().optional(),
});

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
} as unknown as WorkDataProps);

export const useWork = () => {
  return useContext(WorkContext);
};

export const WorkProvider = ({ children }: { children: React.ReactNode }) => {
  const { smartAccountClient } = useUser();
  const chainId = DEFAULT_CHAIN_ID;

  // Base lists via React Query
  const { data: actionsData = [], isLoading: actionsLoading } = useActions(chainId);
  const { data: gardensData = [], isLoading: gardensLoading } = useGardens(chainId);

  // UI state via Zustand
  const actionUID = useWorkFlowStore((s: WorkFlowState) => s.actionUID);
  const gardenAddress = useWorkFlowStore((s: WorkFlowState) => s.gardenAddress);
  const images = useWorkFlowStore((s: WorkFlowState) => s.images);
  const activeTab = useWorkFlowStore((s: WorkFlowState) => s.activeTab);
  const _setActionUID = useWorkFlowStore((s: WorkFlowState) => s.setActionUID);
  const _setGardenAddress = useWorkFlowStore((s: WorkFlowState) => s.setGardenAddress);
  const _setImages = useWorkFlowStore((s: WorkFlowState) => s.setImages);
  const _setActiveTab = useWorkFlowStore((s: WorkFlowState) => s.setActiveTab);

  // Adapters to maintain React.Dispatch API for consumers
  const setActionUID: React.Dispatch<React.SetStateAction<number | null>> = (
    updater: React.SetStateAction<number | null>
  ) => {
    const next =
      typeof updater === "function"
        ? (updater as (prev: number | null) => number | null)(actionUID)
        : updater;
    _setActionUID(next);
  };
  const setGardenAddress: React.Dispatch<React.SetStateAction<string | null>> = (
    updater: React.SetStateAction<string | null>
  ) => {
    const next =
      typeof updater === "function"
        ? (updater as (prev: string | null) => string | null)(gardenAddress)
        : updater;
    _setGardenAddress(next);
  };
  const setImages: React.Dispatch<React.SetStateAction<File[]>> = (
    updater: React.SetStateAction<File[]>
  ) => {
    const next =
      typeof updater === "function" ? (updater as (prev: File[]) => File[])(images) : updater;
    _setImages(next);
  };
  const setActiveTab: React.Dispatch<React.SetStateAction<WorkTab>> = (
    updater: React.SetStateAction<WorkTab>
  ) => {
    const next =
      typeof updater === "function" ? (updater as (prev: WorkTab) => WorkTab)(activeTab) : updater;
    _setActiveTab(next);
  };

  const { control, register, handleSubmit, formState, watch, reset } = useForm<WorkDraft>({
    defaultValues: {
      feedback: "",
      plantSelection: [],
      // plantCount is optional
    },
    shouldUseNativeValidation: true,
    mode: "onChange",
    resolver: zodResolver(workSchema),
  });

  const feedback = watch("feedback");
  const plantSelection = watch("plantSelection");
  const plantCount = watch("plantCount");
  const values = watch() as unknown as Record<string, unknown>;

  const workMutation = useMutation({
    mutationFn: async ({ draft, images }: { draft: WorkDraft; images: File[] }) => {
      // Use consolidated submission utility with actions from React Query
      const ctxActions = actionsData as Action[];
      // Always persist job to queue first
      const { txHash, jobId } = await submitWorkToQueue(
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
          await processWorkJobInline(jobId, chainId, smartAccountClient);
        } catch {
          // best-effort inline processing; job remains queued otherwise
        }
      }
      return txHash;
    },
    onMutate: () => {
      toast.loading("Uploading work...", { id: "work-upload" });
    },
    onSuccess: () => {
      // Queue add succeeded; dismiss loading. Actual upload success is toasted via queue events.
      toast.dismiss("work-upload");
    },
    onError: (error: unknown) => {
      const message = formatJobError(
        typeof error === "object" && error && "message" in (error as { message?: unknown })
          ? String((error as { message?: unknown }).message)
          : String(error)
      );
      toast.error(message);
      toast.dismiss("work-upload");
    },
  });

  const uploadWork = handleSubmit(async (data: WorkDraft) => {
    // Ensure optional plantCount is handled; react-hook-form may provide undefined
    const draft: WorkDraft = {
      feedback: data.feedback,
      plantSelection: data.plantSelection,
      ...(typeof data.plantCount === "number" ? { plantCount: data.plantCount } : {}),
    } as WorkDraft;

    const errors = validateWorkDraft(draft, gardenAddress, actionUID, images);
    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }
    // Snapshot images to avoid race with state clearing after navigation
    const imagesSnapshot = images.slice();
    await workMutation.mutateAsync({ draft, images: imagesSnapshot });
  });

  return (
    <WorkContext.Provider
      value={{
        gardens: gardensData,
        actions: actionsData,
        isLoading: actionsLoading || gardensLoading,
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
  );
};
