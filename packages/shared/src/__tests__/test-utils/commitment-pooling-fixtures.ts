import type { CommitmentsToConfirm } from "../../hooks/commitment-pooling/useCommitmentsToConfirm";
import {
  DEMO_GARDEN,
  DEMO_GARDEN_POOL_ID,
  DEMO_SEASON_ID,
  MARIA,
  claim,
  commitment,
  contributor,
  cycle,
  pool,
} from "../../modules/commitment-pooling/demo/demo-builders";
import type {
  CommitmentClaimRequestRecord,
  CommitmentContributorRecord,
  CommitmentCycleRecord,
  CommitmentDetail,
  CommitmentPoolRecord,
  CommitmentReadModel,
  PoolClaimRequestRow,
} from "../../modules/commitment-pooling/types";
import type { OntologyChainCapability } from "../../ontology/types";

export const availableCapability: OntologyChainCapability = {
  deployment: "deployed",
  activation: "active",
  integration: "integrated",
  availability: "available",
  evidence: [],
  verified_at: "2026-08-23",
};

export function poolFixture(overrides: Partial<CommitmentPoolRecord> = {}): CommitmentPoolRecord {
  return pool({
    poolId: DEMO_GARDEN_POOL_ID,
    garden: DEMO_GARDEN,
    poolType: "GARDEN",
    state: "OPEN",
    ...overrides,
  });
}

export function cycleFixture(
  overrides: Partial<CommitmentCycleRecord> = {}
): CommitmentCycleRecord {
  return cycle({ cycleId: DEMO_SEASON_ID, cycleType: "SEASON", ...overrides });
}

export function commitmentFixture(
  overrides: Partial<CommitmentReadModel> = {}
): CommitmentReadModel {
  return commitment({
    commitmentId: 1001n,
    direction: "OFFER",
    commitmentType: "SUPPORT_SERVICE",
    onchainState: "ACCEPTED",
    creator: MARIA,
    leadProvider: MARIA,
    ...overrides,
  });
}

export function contributorFixture(
  overrides: Partial<CommitmentContributorRecord> = {}
): CommitmentContributorRecord {
  const commitmentId = overrides.commitmentId ?? 1001n;
  const who = overrides.contributor ?? MARIA;
  return contributor(commitmentId, who, overrides);
}

export function claimFixture(
  overrides: Partial<CommitmentClaimRequestRecord> = {}
): CommitmentClaimRequestRecord {
  const commitmentId = overrides.commitmentId ?? 1001n;
  const claimant = overrides.claimant ?? MARIA;
  return claim(commitmentId, claimant, overrides.state ?? "PENDING", overrides);
}

export function commitmentDetailFixture(
  overrides: Partial<CommitmentDetail> = {}
): CommitmentDetail {
  const commitmentRecord = overrides.commitment ?? commitmentFixture();
  return {
    commitment: commitmentRecord,
    requirements: [],
    contributors: [contributorFixture({ commitmentId: commitmentRecord.commitmentId })],
    assignments: [],
    workAttributions: [],
    evidenceAttributions: [],
    claimRequests: [],
    counterpartCommitments: [],
    ...overrides,
  };
}

export function toConfirmFixture(
  overrides: Partial<CommitmentsToConfirm> = {}
): CommitmentsToConfirm {
  const ordinary = commitmentFixture({
    commitmentId: 1001n,
    onchainState: "READY_FOR_CONFIRMATION",
  });
  const fallback = commitmentFixture({
    commitmentId: 1002n,
    onchainState: "READY_FOR_CONFIRMATION",
  });
  const disputed = commitmentFixture({ commitmentId: 1003n, onchainState: "DISPUTED" });
  return {
    groups: [
      {
        garden: DEMO_GARDEN,
        gardenName: "Green Goods Community Garden",
        rows: [
          {
            commitment: ordinary,
            seat: "confirmer",
            needsYou: true,
            poolGarden: DEMO_GARDEN,
            canDispute: true,
          },
        ],
      },
    ],
    fallback: [
      {
        commitment: fallback,
        path: "POOL_FALLBACK",
        garden: DEMO_GARDEN,
        gardenName: "Green Goods Community Garden",
        activeContributors: [],
        poolGarden: DEMO_GARDEN,
        canDispute: true,
      },
    ],
    disputed: [
      {
        commitment: disputed,
        garden: DEMO_GARDEN,
        gardenName: "Green Goods Community Garden",
      },
    ],
    count: 3,
    isSteward: true,
    isProtocolSteward: false,
    availability: { status: "available", capability: availableCapability },
    isLoading: false,
    isError: false,
    refetch: async () => undefined,
    ...overrides,
  };
}

export function poolClaimRowFixture(
  overrides: Partial<PoolClaimRequestRow> = {}
): PoolClaimRequestRow {
  const commitmentRecord = overrides.commitment ?? commitmentFixture();
  return {
    commitment: commitmentRecord,
    claim: overrides.claim ?? claimFixture({ commitmentId: commitmentRecord.commitmentId }),
  };
}
