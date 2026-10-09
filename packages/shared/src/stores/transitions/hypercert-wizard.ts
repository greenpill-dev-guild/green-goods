import type { HypercertDraft } from "../../types/hypercerts";
import { toUtcDay } from "../../utils/calendar-date";
import { transitionWizardStep } from "./wizard-navigation";
import type { HypercertWizardStore, MintingState } from "../useHypercertWizardStore";

const MIN_STEP = 1;
const MAX_STEP = 4;
/** The step that holds the time frames and shows their date-range error. */
const METADATA_STEP = 2;

type HypercertTimeframes = Pick<
  HypercertDraft,
  "workTimeframeStart" | "workTimeframeEnd" | "impactTimeframeStart" | "impactTimeframeEnd"
>;

/**
 * What the wizard keeps for one end of a time frame. An end is a calendar day,
 * kept as UTC midnight: the pickers store it that way, an assessment prefills
 * it that way, and the minted metadata names its UTC day. Whatever moment a
 * caller hands over, the wizard keeps its day; a value that is no day a
 * calendar holds is an end that is not set.
 */
function asTimeframeDay(seconds: number): number {
  if (!(seconds > 0) || Number.isNaN(new Date(seconds * 1000).getTime())) return 0;
  return toUtcDay(seconds);
}

/**
 * A text field of a saved draft. The draft is read back from the browser's
 * storage, so the field can come back as anything; one that is not text is
 * read as empty. The wizard calls string methods on all three: the metadata
 * step's rule trims the title, the autosave trims the title and description,
 * and the metadata builder trims the link.
 */
function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function withTimeframeDays<Fields extends Partial<HypercertTimeframes>>(fields: Fields): Fields {
  const kept: Partial<HypercertTimeframes> = {};
  if (typeof fields.workTimeframeStart === "number") {
    kept.workTimeframeStart = asTimeframeDay(fields.workTimeframeStart);
  }
  if (typeof fields.workTimeframeEnd === "number") {
    kept.workTimeframeEnd = asTimeframeDay(fields.workTimeframeEnd);
  }
  if (typeof fields.impactTimeframeStart === "number") {
    kept.impactTimeframeStart = asTimeframeDay(fields.impactTimeframeStart);
  }
  // An impact period can be left open: a null end stays null.
  if (typeof fields.impactTimeframeEnd === "number") {
    kept.impactTimeframeEnd = asTimeframeDay(fields.impactTimeframeEnd);
  }
  return { ...fields, ...kept };
}

export function setHypercertStepTransition(
  _state: HypercertWizardStore,
  step: number
): Partial<HypercertWizardStore> {
  return {
    currentStep: transitionWizardStep(
      MIN_STEP,
      { type: "GO_TO", step },
      {
        first: MIN_STEP,
        last: MAX_STEP,
      }
    ),
  };
}

export function nextHypercertStepTransition(
  state: HypercertWizardStore
): Partial<HypercertWizardStore> {
  return {
    currentStep: transitionWizardStep(
      state.currentStep,
      { type: "NEXT" },
      {
        first: MIN_STEP,
        last: MAX_STEP,
      }
    ),
  };
}

export function previousHypercertStepTransition(
  state: HypercertWizardStore
): Partial<HypercertWizardStore> {
  return {
    currentStep: transitionWizardStep(
      state.currentStep,
      { type: "PREVIOUS" },
      {
        first: MIN_STEP,
        last: MAX_STEP,
      }
    ),
  };
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
  return withTimeframeDays(updates);
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
  // A draft saved before the wizard kept days can hold the moments themselves.
  const timeframes = withTimeframeDays({
    workTimeframeStart: draft.workTimeframeStart ?? 0,
    workTimeframeEnd: draft.workTimeframeEnd ?? 0,
    impactTimeframeStart: draft.impactTimeframeStart ?? 0,
    impactTimeframeEnd: draft.impactTimeframeEnd,
  });
  const title = asText(draft.title);
  const workScopes = draft.workScopes ?? [];
  // A draft reopens past the metadata step only if it would pass that step
  // now. Next has not always waited on the order, and an end no calendar holds
  // is kept above as not set, so a saved draft can sit on a later step with
  // metadata the step would hold back. It reopens on the metadata step, where
  // the step shows what is wrong and Next waits, not one press from Mint.
  const currentStep = selectHypercertMetadataComplete({ title, workScopes, ...timeframes })
    ? draft.stepNumber
    : Math.min(draft.stepNumber, METADATA_STEP);

  return {
    currentStep,
    selectedAttestationIds: draft.attestationIds,
    title,
    description: asText(draft.description),
    workScopes,
    impactScopes: draft.impactScopes ?? [],
    ...timeframes,
    sdgs: draft.sdgs ?? [],
    capitals: draft.capitals ?? [],
    outcomes: draft.outcomes ?? { predefined: {}, custom: {} },
    allowlist: draft.allowlist ?? [],
    externalUrl: asText(draft.externalUrl),
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

/**
 * Whether each of a draft's time frames is in order: it ends on or after the
 * day it starts, or one of its ends is not set. With no start of its own the
 * impact time frame starts with the work, as its picker shows and the minted
 * metadata writes. The metadata step shows its date-range error, and Next
 * waits, from this one answer.
 */
export function selectHypercertTimeframeOrder(draft: HypercertTimeframes): {
  workInOrder: boolean;
  impactInOrder: boolean;
} {
  const inOrder = (start: number, end: number | null) => !start || !end || start <= end;
  return {
    workInOrder: inOrder(draft.workTimeframeStart, draft.workTimeframeEnd),
    impactInOrder: inOrder(
      draft.impactTimeframeStart || draft.workTimeframeStart,
      draft.impactTimeframeEnd
    ),
  };
}

/**
 * Whether a draft may leave the metadata step: it has a title, a work scope and
 * both ends of the work time frame (the fields the step marks as required), and
 * its time frames are in order. Next waits on this, and a restored draft
 * reopens no further than the metadata step without it.
 */
export function selectHypercertMetadataComplete(
  draft: HypercertTimeframes & Pick<HypercertDraft, "title" | "workScopes">
): boolean {
  const { workInOrder, impactInOrder } = selectHypercertTimeframeOrder(draft);
  return (
    draft.title.trim().length > 0 &&
    draft.workScopes.length > 0 &&
    draft.workTimeframeStart > 0 &&
    draft.workTimeframeEnd > 0 &&
    workInOrder &&
    impactInOrder
  );
}

export function selectHypercertDirtyState({
  currentStep,
  mintingStatus,
  selectedAttestationIds,
}: {
  currentStep: number;
  mintingStatus: MintingState["status"];
  selectedAttestationIds: string[];
}) {
  const isDirty =
    !["pending", "confirmed"].includes(mintingStatus) &&
    (selectedAttestationIds.length > 0 || currentStep > 1);
  return { isDirty, isPristine: !isDirty };
}
