import {
  useCallback,
  useMemo,
  useState,
  type BaseSyntheticEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { Control, FormState, UseFormRegister, UseFormSetValue } from "react-hook-form";
import { useShallow } from "zustand/react/shallow";
import { validationToasts } from "../../components/toast";
import { getDefaultChain } from "../../config/blockchain";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { validateWorkSubmissionContext } from "../../modules/work/work-submission";
import { useWorkFlowStore } from "../../stores/useWorkFlowStore";
import { WorkTab } from "../../stores/workFlowTypes";
import type { Action, Domain, Garden, WorkDraft } from "../../types/domain";
import { findActionByUID } from "../../utils/action/parsers";
import {
  compareAddresses,
  isAddressInList,
  normalizeAddress,
} from "../../utils/blockchain/address";
import { DEBUG_ENABLED, debugError, debugLog, debugWarn } from "../../utils/debug";
import { useUser } from "../auth/useUser";
import { useActions, useGardens } from "../blockchain/useBaseLists";
import { isGardenMember, usePendingJoinsVersion } from "../garden/useJoinGarden";
import { useWorkForm, type WorkFormData } from "./useWorkForm";
import { useWorkImages } from "./useWorkImages";
import { useWorkMutation } from "./useWorkMutation";

export interface WorkSelectionValue {
  gardens: Garden[];
  hasJoinedGardens: boolean;
  joinableCommunityGarden: Garden | null;
  actions: Action[];
  isLoading: boolean;
  activeTab: WorkTab;
  setActiveTab: (value: WorkTab) => void;
  gardenAddress: string | null;
  setGardenAddress: (value: string | null) => void;
  actionUID: number | null;
  setActionUID: (value: number | null) => void;
  selectedDomain: Domain | null;
  setSelectedDomain: (domain: Domain | null) => void;
}

export interface WorkFormValue {
  state: FormState<WorkFormData>;
  control: Control<WorkFormData>;
  register: UseFormRegister<WorkFormData>;
  setValue: UseFormSetValue<WorkFormData>;
  images: File[];
  setImages: Dispatch<SetStateAction<File[]>>;
  feedback: string;
  timeSpentMinutes: number | undefined;
  values: Record<string, unknown>;
  reset: () => void;
  uploadWork: (event?: BaseSyntheticEvent) => Promise<void>;
  workMutation: ReturnType<typeof useWorkMutation>;
  validationErrors: string[];
}

export interface WorkDataProps {
  gardens: Garden[];
  hasJoinedGardens: boolean;
  joinableCommunityGarden: Garden | null;
  actions: Action[];
  isLoading?: boolean;
  workMutation: ReturnType<typeof useWorkMutation>;
  form: {
    state: FormState<WorkFormData>;
    actionUID: number | null;
    images: File[];
    setImages: Dispatch<SetStateAction<File[]>>;
    setActionUID: (value: number | null) => void;
    register: UseFormRegister<WorkFormData>;
    setValue: UseFormSetValue<WorkFormData>;
    control: Control<WorkFormData>;
    uploadWork: (event?: BaseSyntheticEvent) => Promise<void>;
    gardenAddress: string | null;
    setGardenAddress: (value: string | null) => void;
    feedback: string;
    timeSpentMinutes: number | undefined;
    values: Record<string, unknown>;
    reset: () => void;
    validationErrors: string[];
  };
  activeTab: WorkTab;
  setActiveTab: (value: WorkTab) => void;
}

export function useWorkSubmissionFlow(): {
  selectionValue: WorkSelectionValue;
  formValue: WorkFormValue;
  legacyValue: WorkDataProps;
} {
  const { authMode, primaryAddress } = useUser();
  const chainId = DEFAULT_CHAIN_ID;
  const rootGardenAddress = getDefaultChain().rootGarden?.address;
  const { data: actionsData = [], isLoading: actionsLoading } = useActions(chainId);
  const { data: gardensData = [], isLoading: gardensLoading } = useGardens(chainId);
  const userAddress = normalizeAddress(primaryAddress);
  const pendingJoinsVersion = usePendingJoinsVersion();
  const userGardens = useMemo(
    () =>
      userAddress
        ? gardensData.filter((garden) =>
            isGardenMember(userAddress, garden.gardeners, garden.stewards, garden.id)
          )
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version counter is a deliberate cache-buster
    [userAddress, gardensData, pendingJoinsVersion]
  );
  const joinableCommunityGarden = useMemo(() => {
    if (!userAddress || !rootGardenAddress) return null;
    const communityGarden = gardensData.find((garden) =>
      compareAddresses(garden.id, rootGardenAddress)
    );
    if (!communityGarden?.openJoining) return null;
    const member =
      isAddressInList(userAddress, communityGarden.gardeners) ||
      isAddressInList(userAddress, communityGarden.stewards);
    return member ? null : communityGarden;
  }, [gardensData, rootGardenAddress, userAddress]);

  const {
    actionUID,
    gardenAddress,
    activeTab,
    selectedDomain,
    setActionUID,
    setGardenAddress,
    setActiveTab,
    setSelectedDomain,
  } = useWorkFlowStore(
    useShallow((state) => ({
      actionUID: state.actionUID,
      gardenAddress: state.gardenAddress,
      activeTab: state.activeTab,
      selectedDomain: state.selectedDomain,
      setActionUID: state.setActionUID,
      setGardenAddress: state.setGardenAddress,
      setActiveTab: state.setActiveTab,
      setSelectedDomain: state.setSelectedDomain,
    }))
  );
  const selectedAction = useMemo(
    () => findActionByUID(actionsData, actionUID),
    [actionsData, actionUID]
  );
  const { images, setImages } = useWorkImages();
  const workForm = useWorkForm(selectedAction?.inputs ?? []);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const workMutation = useWorkMutation({
    authMode,
    gardenAddress,
    actionUID,
    actions: actionsData,
    userAddress,
  });
  const minRequiredImages = selectedAction?.mediaInfo?.required
    ? (selectedAction.mediaInfo.minImageCount ?? 1)
    : 0;
  const handleUploadWork = useCallback(
    async (data: WorkFormData) => {
      const { feedback: _feedback, timeSpentMinutes: _time, ...dynamicFields } = data;
      const audioNotes = useWorkFlowStore.getState().audioNotes.slice();
      const draft = {
        feedback: data.feedback ?? "",
        details: dynamicFields as Record<string, unknown>,
        ...(typeof data.timeSpentMinutes === "number"
          ? { timeSpentMinutes: data.timeSpentMinutes }
          : {}),
        ...(audioNotes.length > 0 ? { audioNotes } : {}),
      };
      const errors = validateWorkSubmissionContext(gardenAddress, actionUID, images, {
        minRequired: minRequiredImages,
      });
      if (errors.length > 0) {
        setValidationErrors(errors);
        validationToasts.formError(errors[0]);
        if (DEBUG_ENABLED) {
          debugWarn("[WorkProvider] Work submission context validation failed", { errors });
        }
        return;
      }
      setValidationErrors([]);
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
          debugError("[WorkProvider] mutateAsync threw", error, { gardenAddress, actionUID });
        }
        throw error;
      }
    },
    [gardenAddress, actionUID, images, workMutation, minRequiredImages]
  );
  const uploadWork = workForm.handleSubmit(handleUploadWork);
  const isLoading = actionsLoading || gardensLoading;
  const hasJoinedGardens = userGardens.length > 0;

  const selectionValue = useMemo<WorkSelectionValue>(
    () => ({
      gardens: userGardens,
      hasJoinedGardens,
      joinableCommunityGarden,
      actions: actionsData,
      isLoading,
      activeTab,
      setActiveTab,
      gardenAddress,
      setGardenAddress,
      actionUID,
      setActionUID,
      selectedDomain,
      setSelectedDomain,
    }),
    [
      userGardens,
      hasJoinedGardens,
      joinableCommunityGarden,
      actionsData,
      isLoading,
      activeTab,
      setActiveTab,
      gardenAddress,
      setGardenAddress,
      actionUID,
      setActionUID,
      selectedDomain,
      setSelectedDomain,
    ]
  );
  const formValue = useMemo<WorkFormValue>(
    () => ({
      state: workForm.formState,
      control: workForm.control,
      register: workForm.register,
      setValue: workForm.setValue,
      images,
      setImages,
      feedback: workForm.feedback as string,
      timeSpentMinutes: workForm.timeSpentMinutes,
      values: workForm.values,
      reset: workForm.reset,
      uploadWork,
      workMutation,
      validationErrors,
    }),
    [
      workForm.formState,
      workForm.control,
      workForm.register,
      workForm.setValue,
      images,
      setImages,
      workForm.feedback,
      workForm.timeSpentMinutes,
      workForm.values,
      workForm.reset,
      uploadWork,
      workMutation,
      validationErrors,
    ]
  );
  const legacyValue = useMemo<WorkDataProps>(
    () => ({
      gardens: userGardens,
      hasJoinedGardens,
      joinableCommunityGarden,
      actions: actionsData,
      isLoading,
      workMutation,
      form: {
        state: workForm.formState,
        control: workForm.control,
        register: workForm.register,
        setValue: workForm.setValue,
        actionUID,
        images,
        setImages,
        setActionUID,
        uploadWork,
        gardenAddress,
        setGardenAddress,
        feedback: workForm.feedback as string,
        timeSpentMinutes: workForm.timeSpentMinutes,
        values: workForm.values,
        reset: workForm.reset,
        validationErrors,
      },
      activeTab,
      setActiveTab,
    }),
    [
      userGardens,
      hasJoinedGardens,
      joinableCommunityGarden,
      actionsData,
      isLoading,
      workMutation,
      workForm.formState,
      workForm.control,
      workForm.register,
      workForm.setValue,
      actionUID,
      images,
      setImages,
      setActionUID,
      uploadWork,
      gardenAddress,
      setGardenAddress,
      workForm.feedback,
      workForm.timeSpentMinutes,
      workForm.values,
      workForm.reset,
      validationErrors,
      activeTab,
      setActiveTab,
    ]
  );

  return { selectionValue, formValue, legacyValue };
}
