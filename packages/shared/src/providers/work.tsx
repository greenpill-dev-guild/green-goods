import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import React, { useContext } from "react";
import { type Control, type FormState, type UseFormRegister, useForm } from "react-hook-form";
import { type ZodType, z } from "zod";
// import { decodeErrorResult } from "viem";
import { DEFAULT_CHAIN_ID } from "../config/blockchain";
import { jobQueue } from "../modules/job-queue";
import { submitWorkDirectly } from "../modules/work/wallet-submission";
import { formatJobError, submitWorkToQueue, validateWorkDraft } from "../modules/work/work-submission";
// import { abi as WorkResolverABI } from "../utils/abis/WorkResolver.json";

import { useUser } from "../hooks/auth/useUser";
import { useActions, useGardens } from "../hooks/blockchain/useBaseLists";
import { useWorkFlowStore, type WorkFlowState } from "../stores/useWorkFlowStore";
import { toastService } from "../toast";
import { DEBUG_ENABLED, debugError, debugLog, debugWarn } from "../utils/debug";

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
    state: FormState<WorkFormData>;
    actionUID: number | null;
    images: File[];
    setImages: React.Dispatch<React.SetStateAction<File[]>>;
    setActionUID: React.Dispatch<React.SetStateAction<number | null>>;
    register: UseFormRegister<WorkFormData>;
    control: Control<WorkFormData>;
    uploadWork: (e?: React.BaseSyntheticEvent) => Promise<boolean>;
    gardenAddress: string | null;
    setGardenAddress: React.Dispatch<React.SetStateAction<string | null>>;
    feedback: string;
    plantSelection: string[];
    plantCount: number | undefined;
    values: Record<string, unknown>;
    reset: () => void;
  };
  activeTab: WorkTab;
  setActiveTab: React.Dispatch<React.SetStateAction<WorkTab>>;
}

// Zod schema for work submission form validation
// Note: Only validating form fields (feedback, plantSelection, plantCount)
// actionUID, title, and media are managed outside the form
const workFormSchema: ZodType<{
  feedback: string;
  plantSelection: string[];
  plantCount?: number;
}> = z.object({
  feedback: z.string().min(1, "Feedback is required"),
  plantSelection: z.preprocess((val) => {
    if (Array.isArray(val)) {
      return val.filter((item) => typeof item === "string" && item.trim().length > 0);
    }
    if (typeof val === "string") {
      const trimmed = val.trim();
      return trimmed.length > 0 ? [trimmed] : [];
    }
    return [];
  }, z.array(z.string())),
  plantCount: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) {
      return undefined;
    }
    if (typeof val === "number") {
      return Number.isNaN(val) ? undefined : val;
    }
    if (typeof val === "string") {
      const parsed = Number(val);
      return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }, z.number().nonnegative().optional()),
});

// Infer form type from Zod schema (single source of truth)
type WorkFormData = z.infer<typeof workFormSchema>;

const WorkContext = React.createContext<WorkDataProps>({
  form: {
    // @ts-ignore
    register: () => {},
    // @ts-ignore
    control: () => {},
    actionUID: null,
    setActionUID: () => {},
    uploadWork: async () => false,
    gardenAddress: null,
    setGardenAddress: () => {},
    reset: () => {},
  },
} as unknown as WorkDataProps);

export const useWork = () => {
  return useContext(WorkContext);
};

export const WorkProvider = ({ children }: { children: React.ReactNode }) => {
  const { smartAccountClient, authMode } = useUser();
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

  const { control, register, handleSubmit, formState, watch, reset } = useForm<WorkFormData>({
    defaultValues: {
      feedback: "",
      plantSelection: [],
      // plantCount is optional
    },
    shouldUseNativeValidation: true,
    mode: "onChange",
    // Compatibility note: older @hookform/resolvers versions had a signature mismatch with Zod.
    // Current versions compile cleanly; keeping the context here for future regressions.
    resolver: zodResolver(workFormSchema as any),
  });

  const feedback = watch("feedback");
  const plantSelectionRaw = watch("plantSelection");
  const plantCountRaw = watch("plantCount");
  const plantSelection = Array.isArray(plantSelectionRaw)
    ? (plantSelectionRaw as string[])
    : typeof plantSelectionRaw === "string" && plantSelectionRaw.trim().length > 0
    ? [plantSelectionRaw.trim()]
    : [];
  const plantCount =
    typeof plantCountRaw === "number"
      ? plantCountRaw
      : typeof plantCountRaw === "string" && plantCountRaw.trim().length > 0
      ? (() => {
          const parsed = Number(plantCountRaw);
          return Number.isNaN(parsed) ? undefined : parsed;
        })()
      : undefined;
  const values = watch() as unknown as Record<string, unknown>;

  const workMutation = useMutation({
    mutationFn: async ({ draft, images }: { draft: WorkDraft; images: File[] }) => {
      if (DEBUG_ENABLED) {
        const draftSummary = {
          hasFeedback: Boolean(draft.feedback),
          feedbackLength: draft.feedback?.length ?? 0,
          plantSelection: draft.plantSelection,
          plantCount: draft.plantCount ?? null,
        };
        debugLog("[GardenFlow] Preparing work submission payload", {
          authMode,
          gardenAddress,
          actionUID,
          imageCount: images.length,
          draftSummary,
        });
      }

      const ctxActions = actionsData as Action[];
      const action = ctxActions.find((a) => {
        const idPart = a.id?.split("-").pop();
        return Number(idPart) === actionUID;
      });
      const actionTitle = action?.title || "Unknown Action";

      // Branch based on authentication mode
      if (authMode === "wallet") {
        if (DEBUG_ENABLED) {
          debugLog("[GardenFlow] Submitting work via wallet flow", {
            gardenAddress,
            actionUID,
            actionTitle,
          });
        }
        return await submitWorkDirectly(
          draft,
          gardenAddress!,
          actionUID!,
          actionTitle,
          chainId,
          images
        );
      }

      if (DEBUG_ENABLED) {
        debugLog("[GardenFlow] Queuing work submission for passkey flow", {
          gardenAddress,
          actionUID,
          actionTitle,
        });
      }

      const { txHash: offlineTxHash, jobId } = await submitWorkToQueue(
        {
          ...draft,
        } as any,
        gardenAddress!,
        actionUID!,
        ctxActions,
        chainId,
        images
      );

      if (DEBUG_ENABLED) {
        debugLog("[GardenFlow] Work queued", {
          jobId,
          gardenAddress,
          actionUID,
          isOnline: navigator.onLine,
        });
      }

      if (navigator.onLine && smartAccountClient) {
        try {
          const result = await jobQueue.processJob(jobId, { smartAccountClient });
          if (DEBUG_ENABLED) {
            debugLog("[GardenFlow] Inline processing attempt finished", {
              jobId,
              success: result.success,
              skipped: result.skipped,
              error: result.error,
            });
          }
          if (result.success && result.txHash) {
            return result.txHash as `0x${string}`;
          }
        } catch (error) {
          if (DEBUG_ENABLED) {
            debugWarn("[GardenFlow] Inline processing threw", { jobId, error });
          }
        }
      }

      return offlineTxHash;
    },
    onMutate: (variables) => {
      if (DEBUG_ENABLED && variables) {
        debugLog("[GardenFlow] Starting work submission", {
          gardenAddress,
          actionUID,
          imageCount: variables.images.length,
        });
      }

      const isOffline = !navigator.onLine && authMode !== "wallet";
      const message =
        authMode === "wallet"
          ? "Waiting for wallet confirmation..."
          : isOffline
            ? "Saving work offline..."
            : "Submitting your work...";
      const title =
        authMode === "wallet"
          ? "Confirm in your wallet"
          : isOffline
            ? "Working offline"
            : "Submitting work";
      toastService.loading({
        id: "work-upload",
        title,
        message,
        context: authMode === "wallet" ? "wallet confirmation" : "work upload",
        suppressLogging: true,
      });
    },
    onSuccess: (txHash) => {
      const isOfflineHash = typeof txHash === "string" && txHash.startsWith("0xoffline_");
      const title =
        authMode === "wallet"
          ? "Work submitted"
          : isOfflineHash
            ? "Work saved offline"
            : "Work submitted";
      const message =
        authMode === "wallet"
          ? "Transaction confirmed. You're all set!"
          : isOfflineHash
            ? "We'll sync this work automatically when you're back online."
            : "Work submitted successfully.";
      toastService.success({
        id: "work-upload",
        title,
        message,
        context: authMode === "wallet" ? "wallet confirmation" : "work upload",
        suppressLogging: true,
      });
      if (DEBUG_ENABLED) {
        debugLog("[GardenFlow] Work submission completed", {
          gardenAddress,
          actionUID,
          authMode,
          txHash,
          wasOffline: isOfflineHash,
        });
      }
    },
    onError: (error: unknown, variables) => {
      const raw =
        typeof error === "object" && error && "message" in (error as { message?: unknown })
          ? String((error as { message?: unknown }).message)
          : String(error);
      const formatted = formatJobError(raw);
      const message =
        formatted === raw
          ? authMode === "wallet"
            ? "Transaction failed. Check your wallet and try again."
            : "We couldn't submit your work. It'll retry shortly."
          : formatted;
      toastService.error({
        id: "work-upload",
        title: "Work submission failed",
        message,
        context: authMode === "wallet" ? "wallet confirmation" : "work upload",
        description: authMode === "wallet"
          ? "If the issue persists, reconnect your wallet and resubmit."
          : "You can stay on this page; the queue will keep retrying.",
        error,
      });
      if (DEBUG_ENABLED) {
        debugError("[GardenFlow] Work submission failed", error, {
          gardenAddress,
          actionUID,
          authMode,
          imageCount: variables?.images.length ?? 0,
          message,
        });
      }
    },
  });

  const uploadWork = handleSubmit(async (data) => {
    // Build draft from form data (partial) - validation will check for required fields
    const draft = {
      feedback: data.feedback,
      plantSelection: data.plantSelection,
      ...(typeof data.plantCount === "number" ? { plantCount: data.plantCount } : {}),
    };

    const errors = validateWorkDraft(draft as any, gardenAddress, actionUID, images);
   if (errors.length > 0) {
      toastService.error({
        title: "Check your submission",
        message: errors[0],
        context: "work form validation",
        suppressLogging: true,
      });
      if (DEBUG_ENABLED) {
        debugWarn("[GardenFlow] Work draft validation failed", { errors });
      }
      return false;
    }
    // Snapshot images to avoid race with state clearing after navigation
    const imagesSnapshot = images.slice();
    if (DEBUG_ENABLED) {
      debugLog("[GardenFlow] Submitting work with validated draft", {
        gardenAddress,
        actionUID,
        imageCount: imagesSnapshot.length,
      });
    }
    try {
      await workMutation.mutateAsync({ draft: draft as any, images: imagesSnapshot });
      return true;
    } catch (error) {
      if (DEBUG_ENABLED) {
        debugError("[GardenFlow] mutateAsync threw", error, {
          gardenAddress,
          actionUID,
        });
      }
      return false;
    }
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
