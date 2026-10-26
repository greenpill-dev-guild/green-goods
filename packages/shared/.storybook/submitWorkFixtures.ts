/**
 * Submit Work as the design frames draw it, on the journeys' fictional data:
 * Amara transplanting seedlings for the garden's east-beds promise, chosen at
 * Start, so every later step names the promise (D16, O9). Nothing here is a
 * real account, garden or record.
 */
import {
  claimFixture,
  commitmentFixture,
} from "../src/__tests__/test-utils/commitment-pooling-fixtures";
import type { useWorkSubmissionFlowController } from "../src/hooks/client-ui/work/useWorkSubmissionFlowController";
import { takeUpAsk } from "../src/hooks/commitment-pooling/useTakeUpChoices";
import { oneTapAsks, viewerTakeUps } from "../src/modules/garden/journal";
import type {
  WorkablePromise,
  WorkLinkIntent,
} from "../src/modules/commitment-pooling/work-link-intent";
import { WorkTab } from "../src/stores/workFlowTypes";
import { type Action, Domain } from "../src/types/domain";
import {
  JOURNEY_GARDEN,
  JOURNEY_GARDEN_RECORD,
  JOURNEY_NEIGHBOUR,
  JOURNEY_VIEWER,
} from "./clientJourneyFixtures";
import DOCUMENTATION_SEEDLINGS_JPEG from "./fixture-art/documentation-seedlings.jpg?inline";
import DOCUMENTATION_SEEDLINGS_URL from "./fixture-art/documentation-seedlings.jpg?url";
import SEEDLINGS_JPEG from "./fixture-art/seedlings.jpg?inline";
import { stagedWorkPhoto } from "./workPhotoFixtures";

type SubmitWorkController = ReturnType<typeof useWorkSubmissionFlowController>;
type StartStep = SubmitWorkController["start"];

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

/** Trays of seedlings, as a photo on the phone. */
function seedlingPhoto(name: string): File {
  return stagedWorkPhoto(name, 0, SEEDLINGS_JPEG);
}

const noop = () => undefined;

/** One fictional record for docs captures; the sourced photo does not prove these values. */
export const DOCUMENTATION_SUBMISSION = {
  action: SEEDLING_ACTION,
  photo: DOCUMENTATION_SEEDLINGS_URL,
  fileDataUrl: DOCUMENTATION_SEEDLINGS_JPEG,
  timeSpentMinutes: 90,
  values: { plantsMoved: 36 },
  note: "Moved 36 lettuce seedlings into the east bed and watered them after transplanting.",
};

/** One of the garden's actions on the Start step, with its reviewed Spanish and Portuguese titles. */
function startAction(
  uid: number,
  title: string,
  domain: Domain,
  translated: { es: string; pt: string }
): Action {
  return {
    id: `42161-${uid}`,
    slug: `riverside.${uid}`,
    title,
    description: "",
    domain,
    startTime: 0,
    endTime: Number.MAX_SAFE_INTEGER,
    capitals: [],
    // No picture of its own: the banner is the domain's.
    media: [],
    createdAt: 0,
    inputs: [],
    mediaInfo: { title: "Upload Media", required: true, minImageCount: uid % 3 === 0 ? 2 : 1 },
    translations: {
      es: { status: "reviewed", data: { title: translated.es } },
      pt: { status: "reviewed", data: { title: translated.pt } },
    },
  } as Action;
}

/** The garden's live actions on the Start step: Solar, Education and Waste, as the lab drew them. */
export const START_ACTIONS: Action[] = [
  startAction(
    1,
    "Workshop Delivered",
    Domain.EDU,
    { es: "Taller impartido", pt: "Oficina realizada" }
  ),
  startAction(
    2,
    "Node Operation Log",
    Domain.SOLAR,
    { es: "Registro de operación del nodo", pt: "Registro de operação do nó" }
  ),
  startAction(3, "Energy Audit", Domain.SOLAR, {
    es: "Auditoría energética",
    pt: "Auditoria energética",
  }),
  startAction(
    4,
    "Panel Cleaning",
    Domain.SOLAR,
    { es: "Limpieza de paneles", pt: "Limpeza de painéis" }
  ),
  startAction(5, "Hub Service Session", Domain.EDU, {
    es: "Sesión de servicio en el centro",
    pt: "Sessão de serviço no centro",
  }),
  startAction(6, "Mentoring Session", Domain.EDU, {
    es: "Sesión de mentoría",
    pt: "Sessão de mentoria",
  }),
  // A long title clips at the tile's second line.
  startAction(
    7,
    "Sorting & Breakdown with a per-category weight for every bag",
    Domain.WASTE,
    {
      es: "Clasificación y desglose con el peso de cada categoría por bolsa",
      pt: "Triagem e separação com o peso de cada categoria por saco",
    }
  ),
];

// Midday UTC, so the date reads the same in every time zone a reviewer opens it in.
const DUE_DEC_15 = 1_797_336_000n; // 15 December 2026
const DUE_JAN_31 = 1_801_396_800n; // 31 January 2027

function startChoice(
  commitmentId: bigint,
  title: string,
  actionUID: number,
  requirementIndex: number,
  approvedCount: number,
  requiredCount: number
) {
  return {
    commitmentId,
    requirementIndex,
    actionUID,
    garden: JOURNEY_GARDEN,
    commitmentTitle: title,
    requirementLabel: String(requirementIndex + 1),
    returnTo: `/home/${JOURNEY_GARDEN}/commitments/${commitmentId}`,
    approvedCount,
    requiredCount,
  };
}

/** A promise of Amara's with one action: the workshop photos the hub asked for. */
export const START_PROMISE_ONE_ACTION: WorkablePromise = {
  commitmentId: 21n,
  title: "Workshop photos",
  direction: "REQUEST",
  state: "ACTIVE",
  dueDate: DUE_JAN_31,
  targetUnits: 12n,
  unitLabel: "photos",
  progress: { approved: 3, required: 12 },
  choices: [startChoice(21n, "Workshop photos", 1, 0, 3, 12)],
  takesEvidence: false,
};

/** A promise with three actions that also takes evidence: the solar node's uptime log. */
export const START_PROMISE_THREE_ACTIONS: WorkablePromise = {
  commitmentId: 22n,
  title: "Node uptime log",
  direction: "OFFER",
  state: "PARTIALLY_APPROVED",
  dueDate: DUE_DEC_15,
  targetUnits: 8n,
  unitLabel: "reports",
  progress: { approved: 3, required: 8 },
  choices: [
    startChoice(22n, "Node uptime log", 2, 0, 2, 4),
    startChoice(22n, "Node uptime log", 3, 1, 1, 2),
    startChoice(22n, "Node uptime log", 4, 2, 0, 2),
  ],
  takesEvidence: true,
};

/** One of the garden's asks as its pool lists it: Tomás asks for two reports of one action. */
function poolAsk(commitmentId: bigint, claimMode: "OPEN" | "APPROVAL_GATED", actionUID: bigint) {
  return commitmentFixture({
    id: `42161-${commitmentId}`,
    commitmentId,
    poolId: 7n,
    direction: "REQUEST",
    onchainState: "REQUESTED",
    derivedState: "REQUESTED",
    claimMode,
    claimType: "INDIVIDUAL",
    creator: JOURNEY_NEIGHBOUR,
    leadProvider: null,
    counterparty: JOURNEY_NEIGHBOUR,
    metadataCID: null,
    requirements: [{ actionUID, requiredCount: 2 }],
    dueDate: DUE_DEC_15,
    targetUnits: 2n,
    unitLabel: "reports",
  });
}

export const START_ASK_TITLES = new Map([
  [31n, "Node logs for the open day"],
  [32n, "Hub keys handover"],
  [33n, "Panel cleaning before the rains"],
]);

/**
 * The garden's asks on Amara's Start step, run through the rule the step reads them with
 * (`oneTapAsks`, `takeUpAsk`): an Open ask she can take up in one tap is listed, while an
 * approval-gated ask and one she already asked for, which no steward has answered, are not.
 */
export const START_ASKS: WorkablePromise[] = oneTapAsks({
  commitments: [poolAsk(31n, "OPEN", 2n), poolAsk(32n, "APPROVAL_GATED", 1n), poolAsk(33n, "APPROVAL_GATED", 4n)],
  metadataByCID: new Map(),
  viewer: JOURNEY_VIEWER,
  poolOpen: true,
  takeUps: viewerTakeUps({
    viewer: JOURNEY_VIEWER,
    pendingRequests: [claimFixture({ commitmentId: 33n, claimant: JOURNEY_VIEWER, state: "PENDING" })],
    queued: new Set(),
  }),
}).map((commitment) =>
  takeUpAsk(commitment, {
    workGarden: JOURNEY_GARDEN,
    returnGarden: JOURNEY_GARDEN,
    title: START_ASK_TITLES.get(commitment.commitmentId) ?? "",
  })
);

const START_DOMAINS = [Domain.SOLAR, Domain.EDU, Domain.WASTE];

/** The Start step's model as the controller hands it to the view, here on its actions. */
export function startStepFixture(overrides: Partial<StartStep> = {}): StartStep {
  return {
    skipped: false,
    waiting: false,
    actions: START_ACTIONS,
    domains: START_DOMAINS,
    promises: [],
    asks: [],
    askPromptCount: 3,
    promisesFailed: false,
    retryPromises: noop,
    screen: { kind: "actions" },
    pickPromise: noop,
    logWorkOnItsOwn: noop,
    chooseAction: noop,
    choosePromiseAction: noop,
    chooseGarden: noop,
    addEvidence: noop,
    back: () => false,
    ...overrides,
  };
}

/**
 * The page's controller on one step: Start on its actions, Media with one photo, or Review with
 * the details filled in. Everything the page asks of it answers as it would once the draft has
 * loaded and nothing is being sent.
 */
export function submitWorkControllerFixture(
  step: "start" | "media" | "review",
  {
    linked = step !== "start",
    takesUp = false,
    documentationPhoto = false,
    start = startStepFixture(),
    namedGarden = null,
  }: {
    linked?: boolean;
    /** The promise is the hub's Open ask, which Submit takes up first (decision 18). */
    takesUp?: boolean;
    documentationPhoto?: boolean;
    start?: StartStep;
    /** The submission garden, named under the steps while it is not the active one. */
    namedGarden?: typeof JOURNEY_GARDEN_RECORD | null;
  } = {}
): SubmitWorkController {
  // Leon Brooks' public-domain Seedlings photograph illustrates this fictional
  // example. It is not evidence of the garden, count, time or note below.
  // Source and normalization are recorded in the community-docs image ledger.
  const images = documentationPhoto
    ? [stagedWorkPhoto("lettuce-seedlings.jpg", 0, DOCUMENTATION_SUBMISSION.fileDataUrl)]
    : step === "media"
      ? [seedlingPhoto("seedlings-1.jpg")]
      : [seedlingPhoto("seedlings-1.jpg"), seedlingPhoto("seedlings-2.jpg")];
  return {
    actionUID: step === "start" ? null : 5,
    actions: step === "start" ? START_ACTIONS : [SEEDLING_ACTION],
    activeTab:
      step === "start" ? WorkTab.Intro : step === "media" ? WorkTab.Media : WorkTab.Review,
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
    feedback: documentationPhoto ? DOCUMENTATION_SUBMISSION.note : "",
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
    linkIntent: linked
      ? takesUp
        ? { ...SEEDLING_INTENT, direction: "REQUEST", takesUp: true }
        : SEEDLING_INTENT
      : null,
    linkIntentStatus: linked ? "valid" : "none",
    takeUpPrompts: linked && takesUp ? 3 : null,
    promptCount: linked ? (takesUp ? 3 : 2) : 1,
    namedSubmissionGarden: namedGarden,
    submissionGardenSettled: true,
    refetchCommitmentLinkChoices: async () => undefined,
    isSchedulingDependentLink: false,
    isQueueingDependentLink: false,
    linkSchedulingError: null,
    linkSchedulingSucceeded: false,
    linkSchedulingWorkSent: null,
    hasPendingLinkRecovery: false,
    retryLinkOnly: async () => undefined,
    clearLinkIntent: noop,
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
    start,
    submissionCompleted: false,
    submissionOutcome: null,
    submit: noop,
    timeSpentMinutes: documentationPhoto ? DOCUMENTATION_SUBMISSION.timeSpentMinutes : undefined,
    toggleAudioRecording: noop,
    values: { plantsMoved: 36 },
    workSubmissionJourneyId: "journey-seedlings",
  } as unknown as SubmitWorkController;
}
