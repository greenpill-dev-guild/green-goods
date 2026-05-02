import { DEFAULT_CHAIN_ID } from "../src/config";
import { DEV_MOCK_AUTH_STORAGE_KEY } from "../src/providers/DevAuthProvider";
import {
  ADMIN_GARDEN_PREFERENCES_STORAGE_KEY,
  useAdminStore,
} from "../src/stores/useAdminStore";
import { resetCreateAssessmentStore } from "../src/stores/useCreateAssessmentStore";
import { resetCreateGardenStore } from "../src/stores/useCreateGardenStore";
import {
  GARDEN_STATE_STORAGE_KEY,
  useGardenStateStore,
} from "../src/stores/useGardenStateStore";
import { useHypercertWizardStore } from "../src/stores/useHypercertWizardStore";
import {
  SHEET_STATE_STORAGE_KEY,
  useSheetOrchestratorStore,
} from "../src/stores/useSheetOrchestratorStore";
import { useWorkFlowStore } from "../src/stores/useWorkFlowStore";

const HYPERCERT_MINTING_STATE_STORAGE_KEY = "hypercert-minting-state";

export function resetAdminStoryState(): void {
  useAdminStore.setState({
    selectedChainId: DEFAULT_CHAIN_ID,
    selectedGarden: null,
    lastGardenIdsByScope: {},
    pendingTransactions: {},
    lastAttestationId: null,
  });

  useSheetOrchestratorStore.setState({
    viewStates: {},
    activeSheet: null,
    activeContentId: null,
  });

  useGardenStateStore.getState().clearAll();
  resetCreateGardenStore();
  resetCreateAssessmentStore();
  useWorkFlowStore.getState().reset();
  useHypercertWizardStore.getState().reset();

  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ADMIN_GARDEN_PREFERENCES_STORAGE_KEY);
  window.sessionStorage.removeItem(SHEET_STATE_STORAGE_KEY);
  window.sessionStorage.removeItem(GARDEN_STATE_STORAGE_KEY);
  window.sessionStorage.removeItem(DEV_MOCK_AUTH_STORAGE_KEY);
  window.sessionStorage.removeItem(HYPERCERT_MINTING_STATE_STORAGE_KEY);
}
