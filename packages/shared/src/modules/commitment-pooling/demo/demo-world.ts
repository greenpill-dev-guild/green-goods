/**
 * The demo fixture world: one garden pool in a real local garden, the
 * protocol pool, a paused pool, two open cycles, and enough commitments to
 * put the signed-in reader in every seat the screens draw.
 *
 * @module modules/commitment-pooling/demo/demo-world
 */

import type { Address } from "../../../types/domain";
import type {
  CommitmentClaimRequestRecord,
  CommitmentContributorRecord,
  CommitmentCycleRecord,
  CommitmentPoolRecord,
  CommitmentReadModel,
  CommitmentRequirementRecord,
} from "../types-core";
import type { CommitmentWorkAttributionRecord } from "../types-relations";
import {
  ACTION_CLEANUP,
  ACTION_MAINTENANCE,
  ACTION_PLANTING,
  ACTION_SURVIVAL,
  APR_12,
  claim,
  contributor,
  cycle,
  DEMO_CAMPAIGN_ID,
  DEMO_CHAIN_ID,
  DEMO_GARDEN,
  DEMO_GARDEN_POOL_ID,
  DEMO_PAUSED_GARDEN,
  DEMO_PAUSED_POOL_ID,
  DEMO_PROTOCOL_GARDEN,
  DEMO_PROTOCOL_POOL_ID,
  DEMO_SEASON_ID,
  EDU,
  MARIA,
  metadata,
  NOW,
  pool,
  requirement,
  ROSA,
  TUNDE,
} from "./demo-builders";
import { demoCommitments } from "./demo-commitments";

export * from "./demo-builders";

export interface DemoDocument {
  [key: string]: unknown;
}

export interface DemoEvidenceAttribution {
  chainId: number;
  commitmentId: bigint;
  cid: string;
  contributor: Address;
  attacher: Address;
  createdAt: number;
}

export interface DemoWorld {
  viewer: Address;
  pools: CommitmentPoolRecord[];
  cycles: CommitmentCycleRecord[];
  commitments: CommitmentReadModel[];
  requirements: CommitmentRequirementRecord[];
  contributors: CommitmentContributorRecord[];
  claimRequests: CommitmentClaimRequestRecord[];
  workAttributions: CommitmentWorkAttributionRecord[];
  /** The proof behind every non-zero evidenceCount, so the demo detail and
   * confirm sheet can never disagree about what was attached. */
  evidenceAttributions: DemoEvidenceAttribution[];
  /** Documents behind every fixture CID: titles, reasons, cycle names. */
  documents: Record<string, DemoDocument>;
}

/** Build the world around the reader. Pure: the same viewer gives the same world. */
export function buildDemoWorld(viewer: Address): DemoWorld {
  const V = viewer;

  const pools = [
    pool({
      poolId: DEMO_GARDEN_POOL_ID,
      garden: DEMO_GARDEN,
      poolType: "GARDEN",
      state: "OPEN",
      openSeasonCycleId: DEMO_SEASON_ID,
      openSeasonCycleEntityId: `${DEMO_CHAIN_ID}-${DEMO_SEASON_ID.toString()}`,
      openCampaignIds: [DEMO_CAMPAIGN_ID],
      openCampaignEntityIds: [`${DEMO_CHAIN_ID}-${DEMO_CAMPAIGN_ID.toString()}`],
      liveCommitmentCount: 12n,
      nonTerminalCycleCount: 2n,
      commitmentsOffered: 9n,
      commitmentsRequested: 5n,
      commitmentsAccepted: 6n,
      commitmentsReadyForConfirmation: 4n,
      commitmentsFulfilled: 2n,
      commitmentsCancelled: 1n,
      commitmentsExpired: 1n,
      commitmentsDisputed: 1n,
      openCommitmentCount: 3n,
      distinctProviderCount: 5n,
    }),
    pool({
      poolId: DEMO_PROTOCOL_POOL_ID,
      garden: DEMO_PROTOCOL_GARDEN,
      poolType: "PROTOCOL",
      state: "OPEN",
      liveCommitmentCount: 1n,
      commitmentsOffered: 1n,
      openCommitmentCount: 1n,
    }),
    pool({
      poolId: DEMO_PAUSED_POOL_ID,
      garden: DEMO_PAUSED_GARDEN,
      poolType: "GARDEN",
      state: "PAUSED",
      pauseReasonCID: "bafy-demo-pause-102",
      pauseReasonBlockNumber: 497_000_000n,
    }),
  ];

  const cycles = [
    cycle({
      cycleId: DEMO_SEASON_ID,
      cycleType: "SEASON",
      metadataCID: "bafy-demo-season-7",
      liveCommitmentCount: 10n,
      commitmentsAccepted: 6n,
      commitmentsReadyForConfirmation: 4n,
      commitmentsFulfilled: 2n,
      commitmentsDue: 6n,
      openCommitmentCount: 3n,
    }),
    cycle({
      cycleId: DEMO_CAMPAIGN_ID,
      cycleType: "CAMPAIGN",
      metadataCID: "bafy-demo-campaign-8",
      startTime: APR_12,
      endTime: APR_12,
      liveCommitmentCount: 2n,
      commitmentsAccepted: 1n,
      commitmentsDue: 1n,
      openCommitmentCount: 1n,
    }),
  ];

  const commitments = demoCommitments(V);

  const requirements = [
    requirement(1002n, 0, ACTION_MAINTENANCE, 2, 0),
    requirement(1007n, 0, ACTION_PLANTING, 3, 1),
    requirement(1007n, 1, ACTION_SURVIVAL, 1, 0),
    requirement(1010n, 0, ACTION_CLEANUP, 2, 2),
    requirement(1012n, 0, ACTION_MAINTENANCE, 2, 2),
    requirement(1016n, 0, ACTION_PLANTING, 4, 1),
    requirement(1017n, 0, ACTION_CLEANUP, 3, 1),
    requirement(1017n, 1, ACTION_MAINTENANCE, 2, 0),
  ];

  const contributors = [
    contributor(1006n, ROSA, { isLead: true }),
    contributor(1007n, V, {
      isLead: true,
      requirementIndexes: [0],
      approvedWorkCredits: 1,
      evidenceCredits: 1,
    }),
    contributor(1007n, TUNDE, { requirementIndexes: [1] }),
    contributor(1008n, V, { isLead: true, evidenceCredits: 2 }),
    contributor(1009n, MARIA, { isLead: true, evidenceCredits: 2 }),
    contributor(1010n, TUNDE, { isLead: true, approvedWorkCredits: 2, evidenceCredits: 3 }),
    contributor(1011n, V, { isLead: true, evidenceCredits: 1 }),
    contributor(1012n, V, { isLead: true, approvedWorkCredits: 2, evidenceCredits: 2 }),
    contributor(1015n, V, { isLead: true, evidenceCredits: 1 }),
    contributor(1016n, ROSA, { isLead: true, requirementIndexes: [0], approvedWorkCredits: 1 }),
    contributor(1016n, EDU, {}),
    contributor(1017n, TUNDE, { isLead: true, requirementIndexes: [0], approvedWorkCredits: 1 }),
    contributor(1017n, V, { requirementIndexes: [1] }),
    contributor(1017n, MARIA, { active: false, removedBy: TUNDE, removedAt: NOW - 86_400 }),
    contributor(1018n, EDU, { isLead: true, evidenceCredits: 1 }),
    contributor(1019n, TUNDE, { isLead: true, evidenceCredits: 2 }),
    contributor(1020n, TUNDE, { isLead: true, evidenceCredits: 1 }),
  ];

  const claimRequests = [
    claim(1004n, V, "PENDING"),
    claim(1005n, V, "DECLINED", { reasonCID: "bafy-demo-reason-1005", resolutionCode: "DECLINED" }),
    claim(1006n, V, "SUPERSEDED"),
    claim(1006n, TUNDE, "ACCEPTED", { requestedAt: NOW - 86_400 * 4 }),
  ];

  const workAttributions: CommitmentWorkAttributionRecord[] = [
    {
      id: `${DEMO_CHAIN_ID}-1007-work-1`,
      chainId: DEMO_CHAIN_ID,
      // A real work in the demo garden, so the Work screen can show its Fulfills row.
      workUID: "0xc460b5e2e899bf64fbdd44eab1ed974a03c17bfaa5c96c821ca0a59f8d601856",
      commitmentId: 1007n,
      linkSeen: true,
      contributor: V,
      requirementIndex: 0,
      operationKey: "0x0000000000000000000000000000000000000000000000000000000000001007",
      linked: true,
      creditActive: true,
      linkedBy: V,
      linkedAt: NOW - 86_400 * 2,
      unlinkedBy: null,
      unlinkedAt: null,
      updatedAt: NOW - 86_400 * 2,
    },
  ];

  // One attribution row per counted piece of proof, each with a readable
  // note document — the fixture world never says "2 proofs" and shows none.
  const evidence = (
    commitmentId: bigint,
    who: Address,
    notes: string[]
  ): DemoEvidenceAttribution[] =>
    notes.map((_, index) => ({
      chainId: DEMO_CHAIN_ID,
      commitmentId,
      cid: `bafy-demo-e${commitmentId.toString()}-${index + 1}`,
      contributor: who,
      attacher: who,
      createdAt: NOW - 86_400 * (notes.length - index) - 3_600 * index,
    }));

  const evidenceNotes: Array<[bigint, Address, string[]]> = [
    [1007n, V, ["First planting event done — 40 saplings in on the north strip."]],
    [
      1008n,
      V,
      [
        "Sharpened the hand tools before the work day.",
        "Second session done — the loppers and both spades.",
      ],
    ],
    [
      1009n,
      MARIA,
      ["Saturday ride done, four crates delivered.", "Second trip done — brought back the crates."],
    ],
    [
      1010n,
      TUNDE,
      [
        "Cleared the brambles up to the gate.",
        "Gravel down on the worst stretch.",
        "Path swept and the edges trimmed.",
      ],
    ],
    [1011n, V, ["Six portions delivered warm at noon."]],
    [1012n, V, ["Three rows mulched before the rain.", "Finished the last two rows."]],
    [1015n, V, ["Walked the lines with Rosa; two drippers replaced."]],
    [1018n, EDU, ["Field day held — photos with the group at the end."]],
    [1019n, TUNDE, ["New hinge fitted.", "Door closes flush now; latch adjusted."]],
    [1020n, TUNDE, ["Delivery made to the garden gate."]],
  ];
  const evidenceAttributions = evidenceNotes.flatMap(([commitmentId, who, notes]) =>
    evidence(commitmentId, who, notes)
  );
  const evidenceDocuments = Object.fromEntries(
    evidenceNotes.flatMap(([commitmentId, , notes]) =>
      notes.map((note, index) => [
        `bafy-demo-e${commitmentId.toString()}-${index + 1}`,
        { version: 1, note } satisfies DemoDocument,
      ])
    )
  );

  const documents: Record<string, DemoDocument> = {
    ...evidenceDocuments,
    "bafy-demo-charter": { version: 1, title: "Green Goods Community Garden pool charter" },
    "bafy-demo-pause-102": {
      version: 1,
      reason: "Paused while the stewards settle the spring season.",
    },
    "bafy-demo-season-7": { version: 1, name: "Spring 2026" },
    "bafy-demo-campaign-8": { version: 1, name: "Community work day" },
    "bafy-demo-reason-1005": {
      version: 1,
      reason: "We already have two people on repairs this month. Ask again in May.",
    },
    "bafy-demo-c1001": metadata(
      "Compost delivery to the beds",
      "Three trips with the cart from the depot, any weekday morning."
    ),
    "bafy-demo-c1002": metadata(
      "Prune the north beds",
      "Hedge trimmer and ladder are in the shed."
    ),
    "bafy-demo-c1003": metadata(
      "Two seed-saving sessions",
      "For the new members, one in April and one in May."
    ),
    "bafy-demo-c1004": metadata("Meals for the work day", "Six portions, vegetarian."),
    "bafy-demo-c1005": metadata("Fix the rain barrel tap"),
    "bafy-demo-c1006": metadata("Ride to the nursery", "Two trips, Saturday mornings."),
    "bafy-demo-c1007": metadata(
      "Plant the agroforestry strip",
      "Three planting events and one survival check.",
      [{ url: "https://example.org/planting-plan", label: "Planting plan" }]
    ),
    "bafy-demo-c1008": metadata("Tool sharpening sessions"),
    "bafy-demo-c1009": metadata("Ride to the market"),
    "bafy-demo-c1010": metadata("Clear the south path"),
    "bafy-demo-c1011": metadata("Meals for the spring planting"),
    "bafy-demo-c1012": metadata("Mulch the orchard rows"),
    "bafy-demo-c1013": metadata("Repair the compost bay"),
    "bafy-demo-c1014": metadata("Ride to the seed swap"),
    "bafy-demo-c1015": metadata("Irrigation walkthrough"),
    "bafy-demo-c1016": metadata("Plant the hedge line", "Open to anyone with a Saturday."),
    "bafy-demo-c1017": metadata("Clear and mulch the entrance beds"),
    "bafy-demo-c1018": metadata("Field day recorded for Edu"),
    "bafy-demo-c1019": metadata("Fix the greenhouse door"),
    "bafy-demo-c1020": metadata("Compost delivery, taken up by the garden"),
    "bafy-demo-c1021": metadata(
      "Facilitation for a neighbouring garden",
      "Any garden in the network may take this up."
    ),
  };

  return {
    viewer: V,
    pools,
    cycles,
    commitments,
    requirements,
    contributors,
    claimRequests,
    workAttributions,
    evidenceAttributions,
    documents,
  };
}
