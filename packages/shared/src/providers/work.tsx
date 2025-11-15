import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import React, { useContext } from "react";
import { type Control, type FormState, type UseFormRegister, useForm } from "react-hook-form";
import { z } from "zod";
// import { decodeErrorResult } from "viem";
import { DEFAULT_CHAIN_ID } from "../config/blockchain";
import { jobQueue } from "../modules/job-queue";
import { submitWorkDirectly } from "../modules/work/wallet-submission";
import { submitWorkToQueue, validateWorkDraft } from "../modules/work/work-submission";
// import { abi as WorkResolverABI } from "../utils/abis/WorkResolver.json";

import { useUser } from "../hooks/auth/useUser";
import { useActions, useGardens } from "../hooks/blockchain/useBaseLists";
import { useWorkFlowStore, type WorkFlowState } from "../stores/useWorkFlowStore";
import { useUIStore } from "../stores/useUIStore";
import { toastService } from "../toast";
import { DEBUG_ENABLED, debugError, debugLog, debugWarn } from "../utils/debug";
import { parseAndFormatError } from "../utils/errors";

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
    uploadWork: (e?: React.BaseSyntheticEvent) => Promise<void>;
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
const workFormSchema = z.object({
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
  const { smartAccountClient, authMode, eoa, smartAccountAddress } = useUser();
  const chainId = DEFAULT_CHAIN_ID;

  // Base lists via React Query
  const { data: actionsData = [], isLoading: actionsLoading } = useActions(chainId);
  const { data: gardensData = [], isLoading: gardensLoading } = useGardens(chainId);

  // Get current user address (prioritize smart account for passkey users)
  const userAddress = (smartAccountAddress || eoa?.address)?.toLowerCase();

  // Filter gardens to only show ones user is a member of
  const userGardens = React.useMemo(() => {
    if (!userAddress || !gardensData) return [];

    return gardensData.filter((garden: Garden) => {
      // Check if user is in gardeners list (case-insensitive)
      const isGardener = garden.gardeners?.some(
        (gardenerAddress: string) => gardenerAddress.toLowerCase() === userAddress
      );

      if (DEBUG_ENABLED && isGardener) {
        debugLog("[WorkProvider] User is gardener in garden", {
          gardenId: garden.id,
          gardenName: garden.name,
          userAddress,
        });
      }

      return isGardener;
    });
  }, [gardensData, userAddress]);

  // UI state via Zustand
  const actionUID = useWorkFlowStore((s: WorkFlowState) => s.actionUID);
  const gardenAddress = useWorkFlowStore((s: WorkFlowState) => s.gardenAddress);
  const images = useWorkFlowStore((s: WorkFlowState) => s.images);
  const activeTab = useWorkFlowStore((s: WorkFlowState) => s.activeTab);
  const _setActionUID = useWorkFlowStore((s: WorkFlowState) => s.setActionUID);
  const _setGardenAddress = useWorkFlowStore((s: WorkFlowState) => s.setGardenAddress);
  const _setImages = useWorkFlowStore((s: WorkFlowState) => s.setImages);
  const _setActiveTab = useWorkFlowStore((s: WorkFlowState) => s.setActiveTab);
  const openWorkDashboard = useUIStore((s) => s.openWorkDashboard);

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
    : typeof plantSelectionRaw === "string" && (plantSelectionRaw as string).trim().length > 0
      ? [(plantSelectionRaw as string).trim()]
      : [];
  const plantCount =
    typeof plantCountRaw === "number"
      ? plantCountRaw
      : typeof plantCountRaw === "string" && (plantCountRaw as string).trim().length > 0
        ? (() => {
            const parsed = Number(plantCountRaw as string);
            return Number.isNaN(parsed) ? undefined : parsed;
          })()
        : undefined;
  const values = watch() as unknown as Record<string, unknown>;

  const workMutation = useMutation({
    mutationFn: async ({ draft, images }: { draft: WorkDraft; images: File[] }) => {
      // DEBUG: Log the gardenAddress from multiple sources
      const currentStoreState = useWorkFlowStore.getState();
      console.log("[WorkProvider] mutationFn called - garden sources:", {
        gardenAddressFromProvider: gardenAddress,
        gardenAddressFromStore: currentStoreState.gardenAddress,
        actionUID,
        authMode,
        match: gardenAddress === currentStoreState.gardenAddress,
        timestamp: new Date().toISOString(),
      });

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
        // Check if offline - wallet users also queue when offline
        if (!navigator.onLine) {
          if (DEBUG_ENABLED) {
            debugLog("[GardenFlow] Wallet user offline - queuing work", {
              gardenAddress,
              actionUID,
              actionTitle,
            });
          }
          const {
            txHash: offlineTxHash,
            jobId: _jobId,
            clientWorkId: _clientWorkId,
          } = await submitWorkToQueue(
            { ...draft } as any,
            gardenAddress!,
            actionUID!,
            ctxActions,
            chainId,
            images
          );
          return offlineTxHash;
        }

        // Online wallet users: direct submission
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

      const {
        txHash: offlineTxHash,
        jobId,
        clientWorkId,
      } = await submitWorkToQueue(
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
          clientWorkId,
          gardenAddress,
          actionUID,
          isOnline: navigator.onLine,
        });
      }

      if (navigator.onLine && smartAccountClient) {
        try {
          console.log("[WorkProvider] Attempting inline processing for job:", jobId);
          const result = await jobQueue.processJob(jobId, { smartAccountClient });
          console.log("[WorkProvider] Inline processing result:", {
            jobId,
            success: result.success,
            skipped: result.skipped,
            error: result.error,
            txHash: result.txHash,
          });
          if (DEBUG_ENABLED) {
            debugLog("[GardenFlow] Inline processing attempt finished", {
              jobId,
              clientWorkId,
              success: result.success,
              skipped: result.skipped,
              error: result.error,
            });
          }
          if (result.success && result.txHash) {
            return result.txHash as `0x${string}`;
          }
        } catch (error) {
          console.log("[WorkProvider] Inline processing threw exception:", {
            jobId,
            error,
            errorMessage: error instanceof Error ? error.message : String(error),
          });
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

      const isOffline = !navigator.onLine;

      if (isOffline) {
        // Offline: brief save notification
        toastService.info({
          id: "work-upload",
          title: "Saved offline",
          message: "Work added to upload queue",
          context: "work upload",
          duration: 2000,
          suppressLogging: true,
        });
      } else {
        // Online: loading toast
        toastService.loading({
          id: "work-upload",
          title: "Submitting work",
          message: "Processing your submission...",
          context: "work upload",
          suppressLogging: true,
        });
      }
    },
    onSuccess: (txHash) => {
      const isOfflineHash = typeof txHash === "string" && txHash.startsWith("0xoffline_");

      // Mark submission as complete (triggers checkmark)
      useWorkFlowStore.getState().setSubmissionCompleted(true);

      if (isOfflineHash) {
        // Offline: dismiss info toast after brief delay
        setTimeout(() => {
          toastService.dismiss("work-upload");
        }, 1500);
      } else if (authMode === "wallet") {
        // Wallet mode: show success toast (passkey mode handled by queue events)
        toastService.success({
          id: "work-upload",
          title: "Work submitted",
          message: "Your work is now on-chain",
          context: "work upload",
          suppressLogging: true,
        });
      } else {
        // Passkey mode with inline processing: dismiss loading toast
        // Success will be shown by job queue event handler
        toastService.dismiss("work-upload");
      }

      // Navigate after short delay to show checkmark
      setTimeout(
        () => {
          openWorkDashboard();
          // Navigation will happen in Garden view via useEffect watching submissionCompleted
        },
        isOfflineHash ? 1000 : 1500
      );

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
      // Parse contract error for user-friendly message
      const { title, message, parsed } = parseAndFormatError(error);

      // Use parsed error if known, otherwise provide fallback based on auth mode
      const displayTitle = parsed.isKnown ? title : "Work submission failed";
      const displayMessage = parsed.isKnown
        ? message
        : authMode === "wallet"
          ? "Transaction failed. Check your wallet and try again."
          : "We couldn't submit your work. It'll retry shortly.";

      const description = parsed.isKnown
        ? parsed.action || undefined
        : authMode === "wallet"
          ? "If the issue persists, reconnect your wallet and resubmit."
          : "You can stay on this page; the queue will keep retrying.";

      toastService.error({
        id: "work-upload",
        title: displayTitle,
        message: displayMessage,
        context: authMode === "wallet" ? "wallet confirmation" : "work upload",
        description,
        error,
      });

      if (DEBUG_ENABLED) {
        debugError("[GardenFlow] Work submission failed", error, {
          gardenAddress,
          actionUID,
          authMode,
          imageCount: variables?.images.length ?? 0,
          parsedError: parsed.name,
          message: displayMessage,
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
      return;
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
    } catch (error) {
      if (DEBUG_ENABLED) {
        debugError("[GardenFlow] mutateAsync threw", error, {
          gardenAddress,
          actionUID,
        });
      }
    }
  });

  return (
    <WorkContext.Provider
      value={{
        gardens: userGardens,
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
