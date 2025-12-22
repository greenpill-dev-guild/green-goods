/**
 * Work Provider
 *
 * Orchestrates work submission functionality by composing hooks.
 * Provides context for work form, images, mutation, and navigation.
 *
 * @module providers/work
 */

import React, { useCallback, useContext, useMemo } from "react";
import type { Control, FormState, UseFormRegister } from "react-hook-form";
import { useShallow } from "zustand/react/shallow";
import { validationToasts } from "../components/toast";
import { DEFAULT_CHAIN_ID } from "../config/blockchain";
import { useUser } from "../hooks/auth/useUser";
import { useActions, useGardens } from "../hooks/blockchain/useBaseLists";
import { useWorkForm, type WorkFormData } from "../hooks/work/useWorkForm";
import { useWorkImages } from "../hooks/work/useWorkImages";
import { useWorkMutation } from "../hooks/work/useWorkMutation";
import { validateWorkSubmissionContext } from "../modules/work/work-submission";
import { useWorkFlowStore } from "../stores/useWorkFlowStore";
import { WorkTab } from "../stores/workFlowTypes";
import { isAddressInList, normalizeAddress } from "../utils/blockchain/address";
import { DEBUG_ENABLED, debugError, debugLog, debugWarn } from "../utils/debug";

// Re-export WorkTab for backward compatibility
export { WorkTab };

export interface WorkDataProps {
  gardens: Garden[];
  actions: Action[];
  isLoading?: boolean;
  workMutation: ReturnType<typeof useWorkMutation>;
  form: {
    state: FormState<WorkFormData>;
    actionUID: number | null;
    images: File[];
    setImages: React.Dispatch<React.SetStateAction<File[]>>;
    setActionUID: (value: number | null) => void;
    register: UseFormRegister<WorkFormData>;
    control: Control<WorkFormData>;
    uploadWork: (e?: React.BaseSyntheticEvent) => Promise<void>;
    gardenAddress: string | null;
    setGardenAddress: (value: string | null) => void;
    feedback: string;
    plantSelection: string[];
    plantCount: number | undefined;
    values: Record<string, unknown>;
    reset: () => void;
  };
  activeTab: WorkTab;
  setActiveTab: (value: WorkTab) => void;
}

const WorkContext = React.createContext<WorkDataProps>({
  form: {
    register: () => ({}) as ReturnType<UseFormRegister<WorkFormData>>,
    control: {} as Control<WorkFormData>,
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
  const { smartAccountClient, authMode, primaryAddress } = useUser();
  const chainId = DEFAULT_CHAIN_ID;

  // Base lists via React Query
  const { data: actionsData = [], isLoading: actionsLoading } = useActions(chainId);
  const { data: gardensData = [], isLoading: gardensLoading } = useGardens(chainId);

  // Normalize user address for comparisons (primaryAddress is already resolved by authMode)
  const userAddress = useMemo(() => {
    return normalizeAddress(primaryAddress);
  }, [primaryAddress]);

  // Filter gardens to only show ones user is a member of
  const userGardens = useMemo(() => {
    if (!userAddress || !gardensData) return [];

    return gardensData.filter((garden: Garden) => {
      // Check if user is in gardeners or operators list (case-insensitive)
      return (
        isAddressInList(userAddress, garden.gardeners) ||
        isAddressInList(userAddress, garden.operators)
      );
    });
  }, [gardensData, userAddress]);

  // UI state via Zustand with useShallow for multi-select optimization
  const { actionUID, gardenAddress, activeTab, setActionUID, setGardenAddress, setActiveTab } =
    useWorkFlowStore(
      useShallow((s) => ({
        actionUID: s.actionUID,
        gardenAddress: s.gardenAddress,
        activeTab: s.activeTab,
        setActionUID: s.setActionUID,
        setGardenAddress: s.setGardenAddress,
        setActiveTab: s.setActiveTab,
      }))
    );

  // Use extracted hooks (setImages uses dispatch adapter for functional updates)
  const { images, setImages } = useWorkImages();
  const workForm = useWorkForm();

  // Work mutation with proper auth branching
  const workMutation = useWorkMutation({
    authMode,
    smartAccountClient,
    gardenAddress,
    actionUID,
    actions: actionsData,
  });

  // Upload work handler - memoized to prevent unnecessary re-renders
  const handleUploadWork = useCallback(
    async (data: WorkFormData) => {
      // Build draft from form data (partial) - validation will check for required fields
      const draft = {
        feedback: data.feedback,
        plantSelection: data.plantSelection,
        ...(typeof data.plantCount === "number" ? { plantCount: data.plantCount } : {}),
      };

      const errors = validateWorkSubmissionContext(gardenAddress, actionUID, images);
      if (errors.length > 0) {
        validationToasts.formError(errors[0]);
        if (DEBUG_ENABLED) {
          debugWarn("[WorkProvider] Work submission context validation failed", { errors });
        }
        return;
      }
      // Snapshot images to avoid race with state clearing after navigation
      const imagesSnapshot = images.slice();
      if (DEBUG_ENABLED) {
        debugLog("[WorkProvider] Submitting work with validated draft", {
          gardenAddress,
          actionUID,
          imageCount: imagesSnapshot.length,
        });
      }
      try {
        await workMutation.mutateAsync({ draft: draft as WorkDraft, images: imagesSnapshot });
      } catch (error) {
        if (DEBUG_ENABLED) {
          debugError("[WorkProvider] mutateAsync threw", error, {
            gardenAddress,
            actionUID,
          });
        }
      }
    },
    [gardenAddress, actionUID, images, workMutation]
  );

  // Wrap with handleSubmit for form validation
  const uploadWork = useMemo(
    () => workForm.handleSubmit(handleUploadWork),
    [workForm, handleUploadWork]
  );

  return (
    <WorkContext.Provider
      value={{
        gardens: userGardens,
        actions: actionsData,
        isLoading: actionsLoading || gardensLoading,
        workMutation,
        form: {
          state: workForm.formState,
          control: workForm.control,
          register: workForm.register,
          actionUID,
          images,
          setImages,
          setActionUID,
          uploadWork,
          gardenAddress,
          setGardenAddress,
          feedback: workForm.feedback,
          plantSelection: workForm.plantSelection,
          plantCount: workForm.plantCount,
          values: workForm.values,
          reset: workForm.reset,
        },
        activeTab,
        setActiveTab,
      }}
    >
      {children}
    </WorkContext.Provider>
  );
};
