import type { Address } from "../../types/domain";
import { greenGoodsIndexer } from "../data/graphql-client";
import type {
  CommitmentCycleRecord,
  CommitmentPoolRecord,
  CommitmentUnitSummaryRecord,
} from "./types";
import { type RawRow, integer, mapUnitSummary, number, optionalInteger, string } from "./data-core";
import { resolveCycleMetadataName } from "./cycle-metadata";

const PUBLIC_CYCLE_METADATA_CONCURRENCY = 4;

const PUBLIC_POOL_FIELDS = /* GraphQL */ `
  id chainId poolId state commitmentsOffered commitmentsAccepted commitmentsFulfilled
  commitmentsCancelled commitmentsExpired commitmentsDisputed commitmentsDue openCommitmentCount
  distinctProviderCount
`;

const PUBLIC_CYCLE_FIELDS = /* GraphQL */ `
  id chainId cycleId poolId cycleType state startTime endTime metadataCID
  commitmentsAccepted commitmentsReadyForConfirmation commitmentsFulfilled commitmentsCancelled
  commitmentsExpired commitmentsDisputed commitmentsDue openCommitmentCount
`;

const PUBLIC_UNIT_SUMMARY_FIELDS = /* GraphQL */ `
  id chainId scope scopeId poolId cycleId unitLabel unitLabelHash expectedUnits approvedUnits
  fulfilledUnits openUnits updatedAt
`;

export interface PublicCommitmentPoolRecord {
  id: string;
  chainId: number;
  poolId: bigint;
  state: CommitmentPoolRecord["state"];
  commitmentsOffered: bigint;
  commitmentsAccepted: bigint;
  commitmentsFulfilled: bigint;
  commitmentsCancelled: bigint;
  commitmentsExpired: bigint;
  commitmentsDisputed: bigint;
  commitmentsDue: bigint;
  openCommitmentCount: bigint;
  distinctProviderCount: bigint;
}

export interface PublicCommitmentCycleRecord {
  id: string;
  chainId: number;
  cycleId: bigint;
  poolId: bigint;
  cycleType: CommitmentCycleRecord["cycleType"];
  state: CommitmentCycleRecord["state"];
  startTime: bigint | null;
  endTime: bigint | null;
  name: string | null;
  nameUnavailable: boolean;
  commitmentsAccepted: bigint;
  commitmentsReadyForConfirmation: bigint;
  commitmentsFulfilled: bigint;
  commitmentsCancelled: bigint;
  commitmentsExpired: bigint;
  commitmentsDisputed: bigint;
  commitmentsDue: bigint;
  openCommitmentCount: bigint;
}

export interface PublicGardenPoolRecord {
  pool: PublicCommitmentPoolRecord;
  openSeason: PublicCommitmentCycleRecord | null;
  openCampaigns: PublicCommitmentCycleRecord[];
  finishedCycles: PublicCommitmentCycleRecord[];
  poolUnitSummaries: CommitmentUnitSummaryRecord[];
  cycleUnitSummaries: CommitmentUnitSummaryRecord[];
}

function mapPublicPool(row: RawRow): PublicCommitmentPoolRecord {
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    poolId: integer(row.poolId),
    state: (row.state ?? null) as CommitmentPoolRecord["state"],
    commitmentsOffered: integer(row.commitmentsOffered),
    commitmentsAccepted: integer(row.commitmentsAccepted),
    commitmentsFulfilled: integer(row.commitmentsFulfilled),
    commitmentsCancelled: integer(row.commitmentsCancelled),
    commitmentsExpired: integer(row.commitmentsExpired),
    commitmentsDisputed: integer(row.commitmentsDisputed),
    commitmentsDue: integer(row.commitmentsDue),
    openCommitmentCount: integer(row.openCommitmentCount),
    distinctProviderCount: integer(row.distinctProviderCount),
  };
}

interface IndexedPublicCommitmentCycleRecord
  extends Omit<PublicCommitmentCycleRecord, "name" | "nameUnavailable"> {
  metadataCID: string | null;
}

function mapPublicCycle(row: RawRow): IndexedPublicCommitmentCycleRecord {
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    cycleId: integer(row.cycleId),
    poolId: integer(row.poolId),
    cycleType: (row.cycleType ?? null) as CommitmentCycleRecord["cycleType"],
    state: (row.state ?? null) as CommitmentCycleRecord["state"],
    startTime: optionalInteger(row.startTime),
    endTime: optionalInteger(row.endTime),
    metadataCID: string(row.metadataCID),
    commitmentsAccepted: integer(row.commitmentsAccepted),
    commitmentsReadyForConfirmation: integer(row.commitmentsReadyForConfirmation),
    commitmentsFulfilled: integer(row.commitmentsFulfilled),
    commitmentsCancelled: integer(row.commitmentsCancelled),
    commitmentsExpired: integer(row.commitmentsExpired),
    commitmentsDisputed: integer(row.commitmentsDisputed),
    commitmentsDue: integer(row.commitmentsDue),
    openCommitmentCount: integer(row.openCommitmentCount),
  };
}

async function resolvePublicCycle(
  cycle: IndexedPublicCommitmentCycleRecord
): Promise<PublicCommitmentCycleRecord> {
  const { metadataCID, ...record } = cycle;
  const resolution = await resolveCycleMetadataName(metadataCID);
  return {
    ...record,
    name: resolution.name,
    nameUnavailable: resolution.status === "unavailable",
  };
}

async function resolvePublicCycles(
  cycles: readonly IndexedPublicCommitmentCycleRecord[]
): Promise<PublicCommitmentCycleRecord[]> {
  const resolved = new Array<PublicCommitmentCycleRecord>(cycles.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < cycles.length) {
      const index = nextIndex++;
      const cycle = cycles[index];
      if (cycle) resolved[index] = await resolvePublicCycle(cycle);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(PUBLIC_CYCLE_METADATA_CONCURRENCY, cycles.length) }, worker)
  );
  return resolved;
}

function newestFirst(
  left: PublicCommitmentCycleRecord,
  right: PublicCommitmentCycleRecord
): number {
  const leftPosition = left.endTime ?? left.startTime ?? left.cycleId;
  const rightPosition = right.endTime ?? right.startTime ?? right.cycleId;
  if (leftPosition === rightPosition) return left.cycleId > right.cycleId ? -1 : 1;
  return leftPosition > rightPosition ? -1 : 1;
}

export async function getPublicGardenPool(
  chainId: number,
  garden: Address
): Promise<PublicGardenPoolRecord | null> {
  const poolQuery = `query PublicGardenPool($chainId: Int!, $garden: String!) {
    CommitmentPool(where: { chainId: { _eq: $chainId }, garden: { _eq: $garden }, registrationSeen: { _eq: true } }, limit: 1) { ${PUBLIC_POOL_FIELDS} }
  }`;
  const poolResult = await greenGoodsIndexer.query<Record<string, RawRow[]>>(
    poolQuery,
    { chainId, garden: garden.toLowerCase() },
    "getPublicGardenPool"
  );
  if (poolResult.error) throw poolResult.error;
  const poolRow = poolResult.data?.CommitmentPool?.[0];
  if (!poolRow) return null;
  const pool = mapPublicPool(poolRow);

  const detailsQuery = `query PublicGardenPoolDetails($chainId: Int!, $poolId: numeric!) {
    CommitmentCycle(where: { chainId: { _eq: $chainId }, poolId: { _eq: $poolId }, seedSeen: { _eq: true }, state: { _in: [OPEN, RECONCILED, COMPOSTED] } }) { ${PUBLIC_CYCLE_FIELDS} }
    CommitmentUnitSummary(where: { chainId: { _eq: $chainId }, poolId: { _eq: $poolId }, scope: { _in: [POOL, CYCLE] } }, order_by: { unitLabelHash: asc }) { ${PUBLIC_UNIT_SUMMARY_FIELDS} }
  }`;
  const detailsResult = await greenGoodsIndexer.query<Record<string, RawRow[]>>(
    detailsQuery,
    { chainId, poolId: pool.poolId.toString() },
    "getPublicGardenPoolDetails"
  );
  if (detailsResult.error) throw detailsResult.error;

  const indexedCycles = (detailsResult.data?.CommitmentCycle ?? [])
    .map(mapPublicCycle)
    .filter(
      (cycle) =>
        cycle.state === "OPEN" || cycle.state === "RECONCILED" || cycle.state === "COMPOSTED"
    );
  const cycles = await resolvePublicCycles(indexedCycles);
  const includedCycleIds = new Set(cycles.map((cycle) => cycle.cycleId.toString()));
  const summaries = (detailsResult.data?.CommitmentUnitSummary ?? []).map(mapUnitSummary);

  return {
    pool,
    openSeason:
      cycles.find((cycle) => cycle.state === "OPEN" && cycle.cycleType === "SEASON") ?? null,
    openCampaigns: cycles
      .filter((cycle) => cycle.state === "OPEN" && cycle.cycleType === "CAMPAIGN")
      .sort(newestFirst),
    finishedCycles: cycles
      .filter((cycle) => cycle.state === "RECONCILED" || cycle.state === "COMPOSTED")
      .sort(newestFirst),
    poolUnitSummaries: summaries.filter((summary) => summary.scope === "POOL"),
    cycleUnitSummaries: summaries.filter(
      (summary) =>
        summary.scope === "CYCLE" &&
        summary.cycleId !== null &&
        includedCycleIds.has(summary.cycleId.toString())
    ),
  };
}
