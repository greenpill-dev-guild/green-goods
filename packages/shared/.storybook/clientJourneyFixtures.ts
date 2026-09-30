/**
 * Fictional data for the client journeys stories (promises, proof, pending work):
 * Riverside Commons Garden and its neighbours, the same people, seasons and
 * promises the design frames draw, so a story's capture can sit beside its frame.
 * Nothing here is a real account, garden or record.
 */
import {
  commitmentDetailFixture,
  contributorFixture,
} from "../src/__tests__/test-utils/commitment-pooling-fixtures";
import {
  gardenCommitmentControllerFixture,
  proofComposerControllerFixture,
} from "../src/__tests__/test-utils/controller-fixtures";
import type {
  CommitmentCycleRecord,
  CommitmentEventRecord,
  CommitmentPoolRecord,
  CommitmentReadModel,
  InboxCommitment,
} from "../src/commitment-pooling";
import { commitmentPoolingKeys } from "../src/config/query-keys/commitment-pooling";
import type { GardenCommitmentController } from "../src/hooks/client-ui/commitment/controller.types";
import type { ProofComposerController } from "../src/hooks/client-ui/commitment/proof-controller.types";
import type { useGardenPoolController } from "../src/hooks/client-ui/pool/useGardenPoolController";
import type { CommitmentEvidenceDocumentV1 } from "../src/modules/commitment-pooling/evidence";
import type { Address, Garden } from "../src/types/domain";
import FENCE_LEANING_SVG from "./fixture-art/fence-leaning.svg?raw";
import FENCE_UPRIGHT_SVG from "./fixture-art/fence-upright.svg?raw";

export const JOURNEY_GARDEN = "0x5eed000000000000000000000000000000000001" as Address;
export const JOURNEY_VIEWER = "0x5eed0000000000000000000000000000000000a1" as Address; // Amara
export const JOURNEY_NEIGHBOUR = "0x5eed0000000000000000000000000000000000b2" as Address; // Tomás
export const JOURNEY_HELPER = "0x5eed0000000000000000000000000000000000c3" as Address; // Dele

/**
 * The neighbours' Green Goods names, the way `AddressDisplay` shows a member
 * who has one. The frames draw first names; the app shows these.
 */
export const JOURNEY_NAMES: Readonly<Record<string, string>> = {
  [JOURNEY_VIEWER.toLowerCase()]: "amara.greengoods.eth",
  [JOURNEY_NEIGHBOUR.toLowerCase()]: "tomas.greengoods.eth",
  [JOURNEY_HELPER.toLowerCase()]: "dele.greengoods.eth",
};

/**
 * A time on the stories' day, in local time, for lines that say "today". The
 * preview freezes the clock when it loads, before any story module does, so
 * this reads the frozen day wherever a story calls it.
 */
export function todayAt(hours: number, minutes: number): number {
  const at = new Date(Date.now());
  at.setHours(hours, minutes, 0, 0);
  return at.getTime();
}

/** Noon UTC, so rendered dates do not drift with the viewer's timezone. */
const SEP_1 = 1_788_264_000n;
const NOV_30 = 1_796_040_000n;
const OCT_10 = 1_791_633_600n;
const OCT_11 = 1_791_720_000n;
const JUN_1 = 1_780_315_200n;
const AUG_31 = 1_788_177_600n;

export const JOURNEY_POOL: CommitmentPoolRecord = {
  id: "42161-7",
  chainId: 42161,
  poolId: 7n,
  registrationSeen: true,
  garden: JOURNEY_GARDEN,
  gardenId: JOURNEY_GARDEN,
  poolType: "GARDEN",
  state: "OPEN",
  charterCID: null,
  pauseReasonCID: null,
  pauseReasonBlockNumber: null,
  openSeasonCycleId: 3n,
  openSeasonCycleEntityId: "42161-3",
  openCampaignIds: [4n],
  openCampaignEntityIds: ["42161-4"],
  providerOpenCommitmentCap: 5n,
  liveCommitmentCount: 7n,
  nonTerminalCycleCount: 2n,
  commitmentsOffered: 4n,
  commitmentsRequested: 3n,
  commitmentsAccepted: 2n,
  commitmentsReadyForConfirmation: 1n,
  commitmentsFulfilled: 2n,
  commitmentsCancelled: 1n,
  commitmentsExpired: 1n,
  commitmentsDisputed: 0n,
  workLinkedCount: 0n,
  workApprovedCount: 0n,
  openCommitmentCount: 4n,
  distinctProviderCount: 5n,
  commitmentsDue: 9n,
  createdAt: 1_780_000_000,
  updatedAt: 1_790_000_000,
};

function cycle(overrides: Partial<CommitmentCycleRecord>): CommitmentCycleRecord {
  return {
    id: "42161-3",
    chainId: 42161,
    cycleId: 3n,
    seedSeen: true,
    poolId: 7n,
    poolEntityId: "42161-7",
    garden: JOURNEY_GARDEN,
    gardenId: JOURNEY_GARDEN,
    cycleType: "SEASON",
    state: "OPEN",
    startTime: SEP_1,
    endTime: NOV_30,
    metadataCID: "bafyautumnplanting",
    gardenersBps: 0,
    treasuryBps: 0,
    operatorBps: 0,
    evaluatorBps: 0,
    communityBps: 0,
    funderBps: 0,
    equalParticipationBps: 0,
    verifiedContributionBps: 0,
    liveCommitmentCount: 5n,
    commitmentsAccepted: 4n,
    commitmentsReadyForConfirmation: 1n,
    commitmentsFulfilled: 3n,
    commitmentsCancelled: 0n,
    commitmentsExpired: 0n,
    commitmentsDisputed: 0n,
    commitmentsDue: 7n,
    openCommitmentCount: 2n,
    createdAt: 1_780_000_000,
    updatedAt: 1_790_000_000,
    ...overrides,
  };
}

export const AUTUMN_PLANTING = cycle({});
export const SEED_SWAP = cycle({
  id: "42161-4",
  cycleId: 4n,
  cycleType: "CAMPAIGN",
  startTime: OCT_10,
  endTime: OCT_11,
  metadataCID: "bafyseedswap",
  liveCommitmentCount: 2n,
  commitmentsFulfilled: 0n,
  commitmentsDue: 2n,
});
export const SUMMER_2026 = cycle({
  id: "42161-2",
  cycleId: 2n,
  state: "RECONCILED",
  startTime: JUN_1,
  endTime: AUG_31,
  metadataCID: "bafysummer",
  liveCommitmentCount: 0n,
  commitmentsFulfilled: 9n,
  commitmentsDue: 11n,
});
export const JOURNEY_CYCLES = [AUTUMN_PLANTING, SEED_SWAP, SUMMER_2026];

/** Seeds for `withSeededQueryClient`: the cycles' names, as the gateway would resolve them. */
export const JOURNEY_CYCLE_NAMES: [readonly unknown[], unknown][] = [
  [
    commitmentPoolingKeys.cycleMetadata("bafyautumnplanting"),
    { status: "resolved", name: "Autumn Planting 2026" },
  ],
  [
    commitmentPoolingKeys.cycleMetadata("bafyseedswap"),
    { status: "resolved", name: "Seed Swap Weekend" },
  ],
  [commitmentPoolingKeys.cycleMetadata("bafysummer"), { status: "resolved", name: "Summer 2026" }],
];

let nextId = 20;
function promise(overrides: Partial<CommitmentReadModel>): CommitmentReadModel {
  const commitmentId = BigInt((nextId += 1));
  return {
    id: `42161-${commitmentId}`,
    chainId: 42161,
    commitmentId,
    creationSeen: true,
    onchainState: "ACCEPTED",
    derivedState: "ACTIVE",
    state: "ACCEPTED",
    approvedUnits: 0n,
    evidenceCount: 0,
    cycleId: 3n,
    declaredUnitValue: null,
    declaredValueBasis: null,
    targetUnits: 1n,
    unitLabel: null,
    poolId: 7n,
    creator: JOURNEY_NEIGHBOUR,
    leadProvider: JOURNEY_NEIGHBOUR,
    counterparty: null,
    direction: "OFFER",
    confirmers: [],
    contributorCount: 1,
    contributorsFrozen: false,
    ...overrides,
  };
}

interface JourneyRow {
  row: InboxCommitment;
  title: string;
}

function row(
  title: string,
  commitment: Partial<CommitmentReadModel>,
  seat: InboxCommitment["seat"] = null,
  needsYou = false
): JourneyRow {
  const metadataCID = `bafy-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return { title, row: { commitment: promise({ ...commitment, metadataCID }), seat, needsYou } };
}

/** The live promises the Promises tab frame lists, in its order. */
export const LIVE_PROMISES: JourneyRow[] = [
  row(
    "Repair the north fence panel by the compost bays before the first frost",
    { direction: "REQUEST", derivedState: "ACTIVE", creator: JOURNEY_NEIGHBOUR, counterparty: JOURNEY_VIEWER, leadProvider: JOURNEY_VIEWER, unitLabel: "repairs" },
    "provider",
    true
  ),
  // The frame draws a group of ten here (PRD-1029); until groups land it is one ordinary row.
  row("Survey one household about rain barrel use", { direction: "REQUEST", derivedState: "ACTIVE", unitLabel: "survey" }),
  row(
    "Water the seedling beds every morning while the Okafor family is travelling",
    { direction: "OFFER", derivedState: "OFFERED", onchainState: "OFFERED", state: "OFFERED", targetUnits: 7n, unitLabel: "mornings" }
  ),
  row(
    "Survey one household about rain barrel use",
    { direction: "REQUEST", derivedState: "ACTIVE", leadProvider: JOURNEY_VIEWER, unitLabel: "survey" },
    "provider"
  ),
  row(
    "Lend the seed dibber set for the swap weekend",
    { direction: "OFFER", derivedState: "READY_FOR_CONFIRMATION", onchainState: "READY_FOR_CONFIRMATION", state: "READY_FOR_CONFIRMATION", unitLabel: "loan", cycleId: 4n }
  ),
  row(
    "Two hours sorting the seed library",
    { direction: "REQUEST", derivedState: "REQUESTED", onchainState: "REQUESTED", state: "REQUESTED", targetUnits: 2n, unitLabel: "hours", cycleId: 4n }
  ),
  row(
    "Teach the composting basics workshop for new members",
    { direction: "OFFER", derivedState: "OFFERED", onchainState: "OFFERED", state: "OFFERED", targetUnits: 2n, unitLabel: "sessions" }
  ),
];

/** The settled promises: the history, from Status › Settled. */
export const SETTLED_PROMISES: JourneyRow[] = [
  row(
    "Clear the drainage channel along the east path",
    { direction: "REQUEST", derivedState: "FULFILLED", onchainState: "FULFILLED", state: "FULFILLED", leadProvider: JOURNEY_VIEWER, cycleId: 2n },
    "provider"
  ),
  row("Deliver 20 kg of woodchips for the paths", { direction: "OFFER", derivedState: "FULFILLED", onchainState: "FULFILLED", state: "FULFILLED", unitLabel: "delivery", cycleId: 2n }),
  row("Build a shade frame for the nursery bench", { direction: "OFFER", derivedState: "CANCELLED", onchainState: "CANCELLED", state: "CANCELLED", unitLabel: "build", cycleId: 2n }),
  row(
    "Harvest-day bike cart rides between the plots and the market",
    { direction: "REQUEST", derivedState: "EXPIRED", onchainState: "EXPIRED", state: "EXPIRED", targetUnits: 4n, unitLabel: "rides", cycleId: 2n }
  ),
];

type GardenPoolController = ReturnType<typeof useGardenPoolController>;

/**
 * What `useGardenPoolController` returns for the Promises tab, from the rows given.
 * `commitments` stands in for the query result the tab reads states from.
 */
export function gardenPoolControllerFixture(
  rows: JourneyRow[],
  overrides: Partial<Omit<GardenPoolController, "commitments">> & {
    commitments?: Partial<GardenPoolController["commitments"]>;
  } = {}
): GardenPoolController {
  const titles = new Map(rows.map(({ row: r, title }) => [r.commitment.metadataCID, title]));
  const { commitments: commitmentOverrides, ...rest } = overrides;
  return {
    chainId: 42161,
    isOnline: true,
    cycles: JOURNEY_CYCLES,
    selectedCycleId: null,
    setSelectedCycleId: () => undefined,
    direction: "all",
    setDirection: () => undefined,
    liveness: "live",
    setLiveness: () => undefined,
    settledCount: SETTLED_PROMISES.length,
    busyJobId: null,
    ownCreations: [],
    rows: rows.map(({ row: r }) => r),
    titleOf: (cid) => (cid ? (titles.get(cid) ?? null) : null),
    commitments: {
      commitments: rows.map(({ row: r }) => r.commitment),
      availability: { status: "available", capability: {} },
      isLoading: false,
      isError: false,
      refetch: () => Promise.resolve(),
      // Read at 10:02 AM today, so the offline line gives the time, as the frame does.
      dataUpdatedAt: todayAt(10, 2),
      ...commitmentOverrides,
    } as GardenPoolController["commitments"],
    poolState: "OPEN",
    isParticipating: true,
    canCreate: true,
    stewardsPool: false,
    acts: { retry: () => Promise.resolve(), discard: () => Promise.resolve() },
    ...rest,
  } as GardenPoolController;
}

/** Riverside Commons as a garden record: Amara and Dele garden there, Tomás stewards it. */
export const JOURNEY_GARDEN_RECORD: Garden = {
  id: JOURNEY_GARDEN,
  chainId: 42161,
  tokenAddress: JOURNEY_GARDEN,
  tokenID: 1n,
  name: "Riverside Commons Garden",
  description: "",
  location: "Riverside District",
  bannerImage: "",
  createdAt: 1_710_374_400_000,
  gardeners: [JOURNEY_VIEWER, JOURNEY_HELPER],
  stewards: [JOURNEY_NEIGHBOUR],
  evaluators: [],
  owners: [],
  funders: [],
  communities: [],
  assessments: [],
  works: [],
};

export const FENCE_TITLE = "Repair the north fence panel by the compost bays before the first frost";
const FENCE_PROOF_CID = "bafy-fence-proof";
/** Noon UTC on Oct 20, 2026. */
const OCT_20 = 1_792_497_600n;

/** A small drawing of the fence, before (a post leaning) or after the repair, for the proof's photos. */
function fenceSketch(leaning: boolean): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(leaning ? FENCE_LEANING_SVG : FENCE_UPRIGHT_SVG)}`;
}

/** A silent WAV, so a voice note has something to point at. */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

const FENCE_PROOF: CommitmentEvidenceDocumentV1 = {
  version: 1,
  media: [
    { cid: fenceSketch(true), mime: "image/svg+xml", kind: "photo" },
    { cid: fenceSketch(false), mime: "image/svg+xml", kind: "photo" },
  ],
  audio: [{ cid: SILENT_WAV, mime: "audio/wav", durationSeconds: 24 }],
  links: [{ url: "https://example.org/riverside/fence-repair", label: "Repair notes" }],
};

/** Seeds for `withSeededQueryClient`: the proof document the promise page reads. */
export const PROMISE_PAGE_SEEDS: [readonly unknown[], unknown][] = [
  [commitmentPoolingKeys.evidence(FENCE_PROOF_CID), FENCE_PROOF],
];

/**
 * `working` is the frame `commitment` (proof still to add), `sending` is
 * `commitment-proof-sending` (Amara's proof on its way), `added` is
 * `commitment-proof-added`, `waiting` is `commitment-waiting` (sent today),
 * `kept` is `commitment-kept`; `queued`, `notSent`, `checking` and `failed` are
 * the proof still on this phone (`commitment-proof-queued`, `-notsent`,
 * `-checking`, `-failed`).
 */
export type PromiseStage =
  | "working"
  | "sending"
  | "added"
  | "waiting"
  | "kept"
  | "queued"
  | "notSent"
  | "checking"
  | "failed";

function historyEvent(
  eventType: string,
  actor: Address,
  at: number,
  tx: number
): CommitmentEventRecord {
  return {
    id: `42161-9-${eventType}`,
    chainId: 42161,
    poolId: 7n,
    cycleId: 3n,
    commitmentId: 9n,
    eventType,
    actor,
    configurationKey: null,
    previousValue: null,
    newValue: null,
    units: null,
    data: null,
    txHash: `0x${tx.toString(16).padStart(64, "0")}`,
    timestamp: Math.floor(at / 1000),
  };
}

/**
 * The fence repair on its own page, as the frames draw it: Tomás asked for it,
 * Amara leads, Dele helps, and Tomás confirms. Returns what the page's
 * controller gives and its history, newest first.
 */
export function promisePageFixture(stage: PromiseStage): {
  controller: GardenCommitmentController;
  history: CommitmentEventRecord[];
} {
  const today = stage !== "kept";
  const proofAt = today ? todayAt(10, 24) : new Date(2026, 9, 12, 10, 24).getTime();
  const sentAt = today ? todayAt(10, 41) : new Date(2026, 9, 12, 10, 41).getTime();
  const keptAt = new Date(2026, 9, 14, 8, 3).getTime();
  // Proof on the promise's record, and proof still on this phone.
  const landed = stage === "added" || stage === "waiting" || stage === "kept";
  const onPhone =
    stage === "queued" || stage === "notSent" || stage === "checking" || stage === "failed";
  const commitment = promise({
    id: "42161-9",
    commitmentId: 9n,
    direction: "REQUEST",
    creator: JOURNEY_NEIGHBOUR,
    // On a Request the contract stores the taker here too.
    counterparty: JOURNEY_VIEWER,
    leadProvider: JOURNEY_VIEWER,
    unitLabel: "repair",
    dueDate: OCT_20,
    contributorCount: 2,
    metadataCID: "bafy-fence",
    evidenceCount: landed ? 1 : 0,
    ...(stage === "added"
      ? {
          derivedState: "EVIDENCE_SUBMITTED",
          onchainState: "ACCEPTED",
          state: "ACCEPTED",
        }
      : stage === "waiting"
      ? {
          derivedState: "READY_FOR_CONFIRMATION",
          onchainState: "READY_FOR_CONFIRMATION",
          state: "READY_FOR_CONFIRMATION",
        }
      : stage === "kept"
        ? {
            derivedState: "FULFILLED",
            onchainState: "FULFILLED",
            state: "FULFILLED",
            fulfilledBy: JOURNEY_NEIGHBOUR,
            confirmationPath: "ORDINARY",
          }
        : {}),
  });
  const detail = commitmentDetailFixture({
    commitment,
    contributors: [
      contributorFixture({ commitmentId: 9n, contributor: JOURNEY_VIEWER, isLead: true }),
      contributorFixture({ commitmentId: 9n, contributor: JOURNEY_HELPER }),
    ],
    evidenceAttributions: !landed
      ? []
      : [
            {
              cid: FENCE_PROOF_CID,
              contributor: JOURNEY_VIEWER,
              attacher: JOURNEY_VIEWER,
              createdAt: Math.floor(proofAt / 1000),
            },
          ],
  });
  const controller = gardenCommitmentControllerFixture({
    chainId: 42161,
    routeGarden: JOURNEY_GARDEN,
    workGarden: JOURNEY_GARDEN,
    viewer: JOURNEY_VIEWER,
    detail,
    metadata: {
      version: 1,
      title: FENCE_TITLE,
      note: "Two posts are leaning after the storm. Materials are in the tool shed.",
    },
    pool: JOURNEY_POOL,
    seat: "provider",
    // A proof on its way or waiting on this phone holds every act; one that
    // gave up leaves the promise's own acts in place under its alert.
    actKind:
      stage === "working" || stage === "failed"
        ? "addProof"
        : stage === "added"
          ? "sendForConfirmation"
          : null,
    linkable: stage === "working" || stage === "failed",
    membership: { isMember: true, garden: null, unavailable: false, retry: () => undefined },
  });
  const proofJob = { jobId: "proof-9", kind: "evidence" as const, createdAt: todayAt(10, 24) };
  const queue: GardenCommitmentController["queue"] = {
    ...controller.queue,
    hasPendingJob: stage === "sending" || (onPhone && stage !== "failed"),
    pendingAct:
      stage === "sending" || stage === "checking"
        ? { ...proofJob, waitingReason: "awaiting-confirmation", discardable: false }
        : stage === "queued"
          ? { ...proofJob, waitingReason: null, discardable: true }
          : stage === "notSent"
            ? { ...proofJob, waitingReason: "send-intent-expired", discardable: true }
            : null,
    sendFailed: stage === "failed",
    failedJob:
      stage === "failed"
        ? {
            jobId: proofJob.jobId,
            kind: "evidence",
            at: todayAt(10, 26),
            discardable: true,
            reason: null,
            retryable: true,
          }
        : null,
    proofSending: stage === "sending",
    proofOnItsWay:
      stage === "sending" ? { photos: 2, videos: 0, voiceNotes: 1, links: 1, words: true } : null,
  };

  const taken = [
    historyEvent("ACCEPTED", JOURNEY_VIEWER, new Date(2026, 9, 3, 9, 12).getTime(), 2),
    historyEvent("CREATED", JOURNEY_NEIGHBOUR, new Date(2026, 9, 2, 16, 40).getTime(), 1),
  ];
  const sent = [
    historyEvent("READY_FOR_CONFIRMATION", JOURNEY_VIEWER, sentAt, 4),
    historyEvent("EVIDENCE_ATTACHED", JOURNEY_VIEWER, proofAt, 3),
  ];
  const history =
    stage === "added"
      ? [sent[1], ...taken]
      : stage === "waiting"
        ? [...sent, ...taken]
        : stage !== "kept"
          ? taken
          : [
            // Kept in the transaction that recorded the confirmation: one line says both.
            historyEvent("CONFIRMATION_RECORDED", JOURNEY_NEIGHBOUR, keptAt, 5),
            historyEvent("FULFILLED", JOURNEY_NEIGHBOUR, keptAt, 5),
            ...sent,
            ...taken,
          ];
  // The route garden's record, as the page's roles read it: Tomás stewards it.
  return {
    controller: {
      ...controller,
      queue,
      roles: { ...controller.roles, garden: JOURNEY_GARDEN_RECORD },
    },
    history,
  };
}

/** One of the fence sketches as a file on the phone, as the composer holds it. */
export function fenceFile(name: string, leaning: boolean): File {
  return new File([leaning ? FENCE_LEANING_SVG : FENCE_UPRIGHT_SVG], name, { type: "image/svg+xml" });
}

function voiceNoteFile(): File {
  const bytes = Uint8Array.from(atob(SILENT_WAV.split(",")[1] ?? ""), (c) => c.charCodeAt(0));
  return new File([bytes], "voice-note.wav", { type: "audio/wav" });
}

/**
 * The proof frames: `media`, `mediaAdded` and `recording` are the Media step;
 * `details`, `detailsEmpty` and `detailsLink` the Details step; `review`,
 * `reviewSend`, `reviewTeammate` and `reviewOffline` the Review step; `signing`
 * and `signingSend` are Review while the prompt is open.
 */
export type ProofStage =
  | "media"
  | "mediaAdded"
  | "recording"
  | "details"
  | "detailsEmpty"
  | "detailsLink"
  | "review"
  | "reviewSend"
  | "reviewTeammate"
  | "reviewOffline"
  | "signing"
  | "signingSend";

const PROOF_NOTE = "Replaced two posts and re-hung the panel. Dele helped with the digging.";
const PROOF_LINK = "https://riverside-commons.example/receipts/fence-posts";

/**
 * Amara's proof for the fence repair at one step of the flow, as its frame draws
 * it; in `reviewTeammate` it is Dele's. Amara leads and Dele is on the team, so
 * "Send for confirmation too" starts off.
 */
export function proofFlowFixture(stage: ProofStage): ProofComposerController {
  const { controller: page } = promisePageFixture("working");
  const detail = page.detail;
  const teammate = stage === "reviewTeammate";
  const reviewing = stage.startsWith("review") || stage.startsWith("signing");
  const withMedia = stage !== "media" && stage !== "detailsEmpty" && stage !== "detailsLink";
  return proofComposerControllerFixture({
    viewer: teammate ? JOURNEY_HELPER : JOURNEY_VIEWER,
    detail,
    commitment: detail?.commitment ?? null,
    metadata: page.metadata,
    roster: [
      { address: JOURNEY_VIEWER, isLead: true },
      { address: JOURNEY_HELPER, isLead: false },
    ],
    seat: teammate ? "contributor" : "provider",
    stewards: JOURNEY_GARDEN_RECORD.stewards,
    leads: !teammate,
    media: withMedia
      ? [fenceFile("fence-before.svg", true), fenceFile("fence-after.svg", false)]
      : [],
    audioNotes: withMedia ? [voiceNoteFile()] : [],
    note:
      stage === "details" || reviewing
        ? teammate
          ? "Dug the two post holes and set the new posts in gravel."
          : PROOF_NOTE
        : "",
    links: stage === "details" || stage === "detailsLink" || reviewing ? [PROOF_LINK] : [],
    credited: teammate ? [JOURNEY_HELPER] : [JOURNEY_VIEWER, JOURNEY_HELPER],
    isOnline: stage !== "reviewOffline",
    isRecording: stage === "recording",
    recordingElapsed: stage === "recording" ? 12 : 0,
    isPending: stage === "signing" || stage === "signingSend",
    canSendToo: reviewing && !teammate,
    sendToo: stage === "reviewSend" || stage === "signingSend",
  });
}
