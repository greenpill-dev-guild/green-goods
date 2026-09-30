/**
 * Submit Work as the design frames draw it, on the journeys' fictional data:
 * Amara transplanting seedlings for the garden's east-beds promise, chosen at
 * Start, so every later step names the promise (D16, O9). Nothing here is a
 * real account, garden or record.
 */
import { commitmentFixture } from "../src/__tests__/test-utils/commitment-pooling-fixtures";
import type { useWorkSubmissionFlowController } from "../src/hooks/client-ui/work/useWorkSubmissionFlowController";
import type { WorkLinkIntent } from "../src/modules/commitment-pooling/work-link-intent";
import { WorkTab } from "../src/stores/workFlowTypes";
import type { Action } from "../src/types/domain";
import { JOURNEY_GARDEN, JOURNEY_GARDEN_RECORD } from "./clientJourneyFixtures";
import SEEDLINGS_SVG from "./fixture-art/seedlings.svg?raw";

type SubmitWorkController = ReturnType<typeof useWorkSubmissionFlowController>;

export const SEEDLING_PROMISE = "Transplant 36 seedlings into the east beds";

/** The promise, as the pinned card's sheet reads it: live, in Autumn Planting 2026. */
export const SEEDLING_COMMITMENT = commitmentFixture({
  commitmentId: 12n,
  direction: "REQUEST",
  cycleId: 3n,
  poolId: 7n,
  derivedState: "ACTIVE",
  onchainState: "ACCEPTED",
  unitLabel: "plants",
  targetUnits: 36n,
});

export const SEEDLING_INTENT: WorkLinkIntent = {
  commitmentId: 12n,
  requirementIndex: 0,
  actionUID: 5,
  garden: JOURNEY_GARDEN,
  commitmentTitle: SEEDLING_PROMISE,
  requirementLabel: "Seedling Transplant · 36 plants",
  returnTo: `/home/${JOURNEY_GARDEN}/commitments/12`,
};

const SEEDLING_ACTION = {
  id: "42161-5",
  slug: "riverside.5",
  title: "Seedling Transplant",
  description: "Move seedlings from trays into the beds.",
  inputs: [
    {
      key: "plantsMoved",
      title: "Plants moved",
      placeholder: "",
      type: "number",
      required: true,
      options: [],
    },
  ],
  mediaInfo: {
    title: "Upload Media",
    description: "Take a clear photo of the moved seedlings, or choose one from your photos.",
    required: true,
    minImageCount: 1,
    maxImageCount: 4,
  },
} as unknown as Action;

/** A small drawing of seedlings in their bed, as a photo on the phone. */
function seedlingPhoto(name: string): File {
  return new File([SEEDLINGS_SVG], name, { type: "image/svg+xml" });
}

const noop = () => undefined;

/**
 * The page's controller on one step: Media with one photo, or Review with the
 * details filled in. Everything the page asks of it answers as it would once
 * the draft has loaded and nothing is being sent.
 */
export function submitWorkControllerFixture(
  step: "media" | "review",
  { linked = true }: { linked?: boolean } = {}
): SubmitWorkController {
  const images = step === "media" ? [seedlingPhoto("seedlings-1.svg")] : [
    seedlingPhoto("seedlings-1.svg"),
    seedlingPhoto("seedlings-2.svg"),
  ];
  return {
    actionUID: 5,
    actions: [SEEDLING_ACTION],
    activeTab: step === "media" ? WorkTab.Media : WorkTab.Review,
    audioNotes: [],
    authMode: "passkey",
    brokenMediaIds: new Set<string>(),
    cameraClickRef: { current: null },
    canProceed: true,
    changeTab: noop,
    control: {},
    detailsConfig: undefined,
    detailInputs: [],
    draft: {
      saveState: "saved",
      missingAttachments: [],
      legacyRecovery: null,
      showDraftSheet: false,
      retry: async () => undefined,
      close: noop,
      recover: noop,
      manage: noop,
      handleContinueDraft: noop,
      startFresh: noop,
    },
    ensureWorkSubmissionJourneyId: () => "journey-seedlings",
    exit: noop,
    feedback: "",
    gardenAddress: JOURNEY_GARDEN,
    gardens: [JOURNEY_GARDEN_RECORD],
    hasJoinedGardens: true,
    heicStateOf: () => undefined,
    images,
    isJoiningCommunityGarden: false,
    isLoading: false,
    isRecording: false,
    isWalletRequestExpired: false,
    joinableCommunityGarden: null,
    joinCommunityGarden: noop,
    linkIntent: linked ? SEEDLING_INTENT : null,
    linkIntentStatus: linked ? "valid" : "none",
    commitmentLinkChoices: linked ? [SEEDLING_INTENT] : [],
    commitmentLinkChoicesLoading: false,
    commitmentLinkChoicesError: null,
    refetchCommitmentLinkChoices: async () => undefined,
    isSchedulingDependentLink: false,
    isQueueingDependentLink: false,
    linkSchedulingError: null,
    linkSchedulingSucceeded: false,
    linkSchedulingWorkSent: null,
    hasPendingLinkRecovery: false,
    retryLinkOnly: async () => undefined,
    clearLinkIntent: noop,
    selectLinkIntent: noop,
    markMediaPreviewFailed: noop,
    mediaClickRef: { current: null },
    mediaConfig: SEEDLING_ACTION.mediaInfo,
    minRequired: 1,
    queueStatusMessage: null,
    recordingElapsed: 0,
    register: () => ({}),
    removeBrokenMedia: noop,
    removeMedia: noop,
    retryHeicConversion: noop,
    reviewConfig: undefined,
    reviewData: { garden: JOURNEY_GARDEN_RECORD, action: SEEDLING_ACTION },
    selectedDomain: null,
    setActionUID: noop,
    setAudioNotes: noop,
    setGardenAddress: noop,
    setImages: noop,
    setSelectedDomain: noop,
    setValue: noop,
    showSkeleton: false,
    submissionCompleted: false,
    submissionOutcome: null,
    submit: noop,
    timeSpentMinutes: undefined,
    toggleAudioRecording: noop,
    values: { plantsMoved: 36 },
    workSubmissionJourneyId: "journey-seedlings",
  } as unknown as SubmitWorkController;
}
