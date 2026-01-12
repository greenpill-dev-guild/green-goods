/**
 * Work Provider
 *
 * Orchestrates work submission functionality by composing hooks.
 * Split into two contexts for performance optimization:
 * - WorkSelectionContext: Low-frequency updates (gardens, actions, tabs)
 * - WorkFormContext: High-frequency updates (form state, images)
 *
 * @module providers/work
 */

import React, { useCallback, useContext } from "react";
import type { Action, Garden, WorkDraft } from "../types/domain";
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

// ============================================================================
// Types
// ============================================================================

/**
 * Low-frequency selection data (gardens, actions, navigation)
 */
export interface WorkSelectionValue {
  gardens: Garden[];
  actions: Action[];
  isLoading: boolean;
  activeTab: WorkTab;
  setActiveTab: (value: WorkTab) => void;
  gardenAddress: string | null;
  setGardenAddress: (value: string | null) => void;
  actionUID: number | null;
  setActionUID: (value: number | null) => void;
}

/**
 * High-frequency form data (form state, images, mutation)
 */
export interface WorkFormValue {
  state: FormState<WorkFormData>;
  control: Control<WorkFormData>;
  register: UseFormRegister<WorkFormData>;
  images: File[];
  setImages: React.Dispatch<React.SetStateAction<File[]>>;
  feedback: string;
  plantSelection: string[];
  plantCount: number | undefined;
  values: Record<string, unknown>;
  reset: () => void;
  uploadWork: (e?: React.BaseSyntheticEvent) => Promise<void>;
  workMutation: ReturnType<typeof useWorkMutation>;
}

/**
 * Combined interface for backward compatibility
 */
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

// ============================================================================
// Contexts
// ============================================================================

const WorkSelectionContext = React.createContext<WorkSelectionValue | null>(null);
const WorkFormContext = React.createContext<WorkFormValue | null>(null);

// Legacy context for backward compatibility
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

// ============================================================================
// Hooks
// ============================================================================

/**
 * Access low-frequency selection data (gardens, actions, tabs).
 * Use this when you only need selection state to avoid re-renders on form changes.
 */
export function useWorkSelection(): WorkSelectionValue {
  const context = useContext(WorkSelectionContext);
  if (!context) {
    throw new Error("useWorkSelection must be used within a WorkProvider");
  }
  return context;
}

/**
 * Access high-frequency form data (form state, images, mutation).
 * Use this when you need form state to avoid re-renders on selection changes.
 */
export function useWorkFormContext(): WorkFormValue {
  const context = useContext(WorkFormContext);
  if (!context) {
    throw new Error("useWorkFormContext must be used within a WorkProvider");
  }
  return context;
}

/**
 * Access all work data (backward compatible hook).
 * Combines selection and form contexts.
 *
 * @deprecated Consider using useWorkSelection or useWorkFormContext for better performance
 */
export const useWork = () => {
  return useContext(WorkContext);
};

// ============================================================================
// Provider
// ============================================================================

export const WorkProvider = ({ children }: { children: React.ReactNode }) => {
  const { smartAccountClient, authMode, primaryAddress } = useUser();
  const chainId = DEFAULT_CHAIN_ID;

  // Base lists via React Query
  const { data: actionsData = [], isLoading: actionsLoading } = useActions(chainId);
  const { data: gardensData = [], isLoading: gardensLoading } = useGardens(chainId);

  // Normalize user address for comparisons
  const userAddress = normalizeAddress(primaryAddress);

  // Filter gardens to only show ones user is a member of
  // React 19: Compiler handles memoization
  const userGardens =
    userAddress && gardensData
      ? gardensData.filter((garden: Garden) => {
          return (
            isAddressInList(userAddress, garden.gardeners) ||
            isAddressInList(userAddress, garden.operators)
          );
        })
      : [];

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

  // Use extracted hooks
  const { images, setImages } = useWorkImages();
  const workForm = useWorkForm();

  // Work mutation with proper auth branching
  const workMutation = useWorkMutation({
    authMode,
    smartAccountClient,
    gardenAddress,
    actionUID,
    actions: actionsData,
    userAddress,
  });

  // Compute minimum required images from selected action
  // React 19: Compiler handles memoization
  const getMinRequiredImages = () => {
    if (typeof actionUID !== "number" || !actionsData.length) return 1;
    const selectedAction = actionsData.find(
      (a: Action) => Number(a.id.split("-").pop()) === actionUID
    );
    if (!selectedAction?.mediaInfo?.required) return 0;
    return selectedAction.mediaInfo.minImageCount ?? 1;
  };
  const minRequiredImages = getMinRequiredImages();

  // Upload work handler
  const handleUploadWork = useCallback(
    async (data: WorkFormData) => {
      const draft = {
        feedback: data.feedback,
        plantSelection: data.plantSelection,
        ...(typeof data.plantCount === "number" ? { plantCount: data.plantCount } : {}),
      };

      const errors = validateWorkSubmissionContext(gardenAddress, actionUID, images, {
        minRequired: minRequiredImages,
      });
      if (errors.length > 0) {
        validationToasts.formError(errors[0]);
        if (DEBUG_ENABLED) {
          debugWarn("[WorkProvider] Work submission context validation failed", { errors });
        }
        return;
      }

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
    [gardenAddress, actionUID, images, workMutation, minRequiredImages]
  );

  const uploadWork = workForm.handleSubmit(handleUploadWork);

  // Selection context value (low-frequency updates)
  // React 19: Compiler handles memoization
  const selectionValue: WorkSelectionValue = {
    gardens: userGardens,
    actions: actionsData,
    isLoading: actionsLoading || gardensLoading,
    activeTab,
    setActiveTab,
    gardenAddress,
    setGardenAddress,
    actionUID,
    setActionUID,
  };

  // Form context value (high-frequency updates)
  // React 19: Compiler handles memoization
  const formValue: WorkFormValue = {
    state: workForm.formState,
    control: workForm.control,
    register: workForm.register,
    images,
    setImages,
    feedback: workForm.feedback,
    plantSelection: workForm.plantSelection,
    plantCount: workForm.plantCount,
    values: workForm.values,
    reset: workForm.reset,
    uploadWork,
    workMutation,
  };

  // Legacy combined value for backward compatibility
  // React 19: Compiler handles memoization
  const legacyValue: WorkDataProps = {
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
  };

  return (
    <WorkSelectionContext.Provider value={selectionValue}>
      <WorkFormContext.Provider value={formValue}>
        <WorkContext.Provider value={legacyValue}>{children}</WorkContext.Provider>
      </WorkFormContext.Provider>
    </WorkSelectionContext.Provider>
  );
};
