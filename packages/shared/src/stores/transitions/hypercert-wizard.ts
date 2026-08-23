import type { HypercertDraft } from "../../types/hypercerts";
import type { HypercertWizardStore, MintingState } from "../useHypercertWizardStore";

const MIN_STEP = 1;
const MAX_STEP = 4;

export function setHypercertStepTransition(
  _state: HypercertWizardStore,
  step: number
): Partial<HypercertWizardStore> {
  return { currentStep: Math.min(Math.max(step, MIN_STEP), MAX_STEP) };
}

export function nextHypercertStepTransition(
  state: HypercertWizardStore
): Partial<HypercertWizardStore> {
  return { currentStep: Math.min(state.currentStep + 1, MAX_STEP) };
}

export function previousHypercertStepTransition(
  state: HypercertWizardStore
): Partial<HypercertWizardStore> {
  return { currentStep: Math.max(state.currentStep - 1, MIN_STEP) };
}

export function setSelectedAttestationsTransition(
  _state: HypercertWizardStore,
  ids: string[]
): Partial<HypercertWizardStore> {
  return { selectedAttestationIds: ids };
}

export function toggleAttestationTransition(
  state: HypercertWizardStore,
  id: string
): Partial<HypercertWizardStore> {
  const exists = state.selectedAttestationIds.includes(id);
  return {
    selectedAttestationIds: exists
      ? state.selectedAttestationIds.filter((item) => item !== id)
      : [...state.selectedAttestationIds, id],
  };
}

export function updateHypercertMetadataTransition(
  _state: HypercertWizardStore,
  updates: Parameters<HypercertWizardStore["updateMetadata"]>[0]
): Partial<HypercertWizardStore> {
  return updates;
}

export function setMintingStateTransition(
  state: HypercertWizardStore,
  update: Partial<MintingState>
): Partial<HypercertWizardStore> {
  return { mintingState: { ...state.mintingState, ...update } };
}

export function setHypercertDraftMetaTransition(
  _state: HypercertWizardStore,
  input: { draftId: string | null; savedAt: number | null }
): Partial<HypercertWizardStore> {
  return { draftId: input.draftId, lastSavedAt: input.savedAt };
}

export function loadHypercertDraftTransition(
  _state: HypercertWizardStore,
  draft: HypercertDraft
): Partial<HypercertWizardStore> {
  return {
    currentStep: draft.stepNumber,
    selectedAttestationIds: draft.attestationIds,
    title: draft.title ?? "",
    description: draft.description ?? "",
    workScopes: draft.workScopes ?? [],
    impactScopes: draft.impactScopes ?? [],
    workTimeframeStart: draft.workTimeframeStart ?? 0,
    workTimeframeEnd: draft.workTimeframeEnd ?? 0,
    impactTimeframeStart: draft.impactTimeframeStart ?? 0,
    impactTimeframeEnd: draft.impactTimeframeEnd,
    sdgs: draft.sdgs ?? [],
    capitals: draft.capitals ?? [],
    outcomes: draft.outcomes ?? { predefined: {}, custom: {} },
    allowlist: draft.allowlist ?? [],
    externalUrl: draft.externalUrl ?? "",
    draftId: draft.id,
    lastSavedAt: draft.updatedAt,
  };
}

export function resetHypercertWizardTransition(
  _state: HypercertWizardStore,
  initial: Partial<HypercertWizardStore>
): Partial<HypercertWizardStore> {
  return initial;
}
