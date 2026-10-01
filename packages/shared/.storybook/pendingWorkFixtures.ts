/**
 * Your Work › Pending as the design frames draw it, on the journeys' fictional
 * data: ten rows, eight still on the phone. Blocked work first, then what's
 * ready to upload, drafts, anything being checked and work waiting for review.
 * Nothing here is a real account, garden or record.
 */
import type { PendingProof } from "../src/hooks/client-ui/commitment/usePendingProof";
import type { DraftWithImages } from "../src/hooks/work/useDrafts";
import type { Action, Work } from "../src/types/domain";
import {
  FENCE_TITLE,
  fenceFile,
  JOURNEY_GARDEN,
  JOURNEY_VIEWER,
  todayAt,
} from "./clientJourneyFixtures";
import { FIXTURE_IMAGE_AGROFORESTRY, FIXTURE_IMAGE_SOLAR, FIXTURE_WORK_MEDIA } from "./fixtures";

const HOUR = 3_600_000;

function action(id: number, title: string): Action {
  return { id: `42161-${id}`, slug: `riverside.${id}`, title } as unknown as Action;
}

/** The garden's actions that name the work and drafts below. */
export const PENDING_ACTIONS: Action[] = [
  action(1, "Seed Library Count"),
  action(2, "Compost Turn"),
  action(3, "Herb Spiral Weeding"),
  action(4, "Mulching"),
  action(5, "Seedling Transplant"),
  action(6, "Path Edging"),
  action(7, "Mulch Delivery Log"),
  action(8, "Pond Clean-Up"),
];

/** Work saved on this phone, in the state preparation or a send left it. */
function queued(
  id: string,
  actionUID: number,
  title: string,
  savedAt: number,
  state: { submissionState: string; blockedReason?: string },
  media = [FIXTURE_IMAGE_AGROFORESTRY]
): Work {
  return {
    id,
    title,
    actionUID,
    gardenerAddress: JOURNEY_VIEWER,
    gardenAddress: JOURNEY_GARDEN,
    feedback: "",
    metadata: JSON.stringify({ clientWorkId: `client-${id}`, ...state }),
    media,
    createdAt: Math.floor(savedAt / 1000),
    status: "offline",
  };
}

/** Work on the garden record, waiting for someone to review it. */
function submitted(id: string, actionUID: number, title: string, submittedAt: number): Work {
  return {
    id,
    title,
    actionUID,
    gardenerAddress: JOURNEY_VIEWER,
    gardenAddress: JOURNEY_GARDEN,
    feedback: "",
    metadata: "",
    media: [FIXTURE_WORK_MEDIA[2]],
    createdAt: Math.floor(submittedAt / 1000),
    status: "pending",
  };
}

const SEEDS = queued("job-seeds", 1, "Seed Library Count", new Date(2026, 9, 4, 18, 12).getTime(), {
  submissionState: "blocked",
  blockedReason: "NotActiveAction",
});
const COMPOST = queued("job-compost", 2, "Compost Turn", todayAt(9, 40), {
  submissionState: "ready",
}, [FIXTURE_IMAGE_SOLAR]);
const HERBS = queued("job-herbs", 3, "Herb Spiral Weeding", todayAt(8, 5), {
  submissionState: "photo-pending",
});
const SEEDLING_QUEUED = queued("job-seedling", 5, "Seedling Transplant", todayAt(10, 31), {
  submissionState: "ready",
});
const EDGING = queued("job-edging", 6, "Path Edging", todayAt(7, 58), {
  submissionState: "checking-submission",
}, [FIXTURE_WORK_MEDIA[3]]);
const MULCH_LOG = submitted(
  "0x5eed00000000000000000000000000000000000000000000000000000000c0de",
  7,
  "Mulch Delivery Log",
  new Date(2026, 9, 2, 11, 0).getTime()
);
const POND = submitted(
  "0x5eed00000000000000000000000000000000000000000000000000000000d0d0",
  8,
  "Pond Clean-Up",
  new Date(2026, 8, 30, 15, 0).getTime()
);

function draft(id: string, actionUID: number, step: DraftWithImages["firstIncompleteStep"], photos: number, updatedAt: number): DraftWithImages {
  return {
    id,
    userAddress: JOURNEY_VIEWER,
    chainId: 42161,
    gardenAddress: JOURNEY_GARDEN,
    actionUID,
    feedback: "",
    currentStep: step,
    firstIncompleteStep: step,
    createdAt: updatedAt - HOUR,
    updatedAt,
    images: [],
    attachmentCount: photos,
    thumbnailUrl: FIXTURE_WORK_MEDIA[1],
  } as DraftWithImages;
}

const MULCH_DRAFT = draft("draft-mulch", 4, "media", 3, Date.now() - 2 * HOUR);
const SEEDLING_DRAFT: DraftWithImages = {
  ...draft("draft-seedling", 5, "review", 2, Date.now() - 24 * HOUR),
  // Started from the garden's east-beds promise, which the draft keeps.
  linkIntent: {
    commitmentId: "12",
    requirementIndex: 0,
    actionUID: 5,
    garden: JOURNEY_GARDEN,
    commitmentTitle: "Transplant 36 seedlings into the east beds",
    requirementLabel: "Seedling Transplant · 36 plants",
    returnTo: `/home/${JOURNEY_GARDEN}/commitments/12`,
  },
};

function proof(overrides: Partial<PendingProof>): PendingProof {
  return {
    id: "proof-fence",
    source: "queued",
    commitmentId: 7n,
    garden: JOURNEY_GARDEN,
    commitment: null,
    title: FENCE_TITLE,
    savedAt: todayAt(10, 24),
    contents: { photos: 2, videos: 0, voiceNotes: 1, links: 1, words: true },
    waitingReason: null,
    failed: false,
    sending: false,
    discardable: true,
    firstPhoto: fenceFile("fence-after.svg", false),
    ...overrides,
  };
}

const FENCE_PROOF = proof({});
const WORKSHOP_PROOF_DRAFT = proof({
  id: `proof:42161:${JOURNEY_VIEWER.toLowerCase()}:9`,
  source: "draft",
  commitmentId: 9n,
  title: "Teach the composting basics workshop for new members",
  savedAt: Date.now() - 24 * HOUR,
  contents: { photos: 2, videos: 0, voiceNotes: 0, links: 0, words: false },
  firstPhoto: null,
});

export interface PendingWorkFixture {
  /** Your own work: queued on this phone, or on the record waiting for review. */
  submissions: Work[];
  drafts: DraftWithImages[];
  proofs: PendingProof[];
  /** Queued work a queued link ties to a promise. */
  linkedWorkIds: ReadonlySet<string>;
  /** Work on the record that counts toward a promise. */
  linkedWorkUIDs: ReadonlySet<string>;
  /** Everything still on this phone: the Home badge and the Pending tab's count (D1). */
  onPhone: number;
}

/**
 * The list at a moment in the frames: everything (`work`), after Upload Work
 * was cancelled so the Seedling Transplant draft became work to upload
 * (`work-cancelled`), or after Compost Turn was discarded (`work-discarded`).
 */
export function pendingWorkFixture(
  moment: "all" | "afterCancel" | "afterDiscard" = "all"
): PendingWorkFixture {
  const afterCancel = moment !== "all";
  const submissions = [
    SEEDS,
    ...(afterCancel ? [SEEDLING_QUEUED] : []),
    ...(moment === "afterDiscard" ? [] : [COMPOST]),
    HERBS,
    EDGING,
    MULCH_LOG,
    POND,
  ];
  const drafts = afterCancel ? [MULCH_DRAFT] : [MULCH_DRAFT, SEEDLING_DRAFT];
  const proofs = [FENCE_PROOF, WORKSHOP_PROOF_DRAFT];
  const onPhone =
    submissions.filter((work) => work.status === "offline").length + drafts.length + proofs.length;
  return {
    submissions,
    drafts,
    proofs,
    linkedWorkIds: new Set([HERBS.id, SEEDLING_QUEUED.id]),
    linkedWorkUIDs: new Set([POND.id.toLowerCase()]),
    onPhone,
  };
}

/** The work pages the frames open: waiting to upload, blocked, and maybe already sent. */
export const QUEUED_WORK_PAGES = { ready: COMPOST, attention: SEEDS, checking: EDGING } as const;
