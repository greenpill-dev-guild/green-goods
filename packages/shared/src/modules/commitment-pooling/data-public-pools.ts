import type { Address } from "../../types/domain";
import { logger } from "../app/logger";
import { greenGoodsIndexer } from "../data/graphql-client";
import { hypercertExclusionClauses } from "../data/hypercerts-exclusions";
import { resolveCycleMetadataName } from "./cycle-metadata";
import { integer, mapUnitSummary, number, optionalInteger, type RawRow, string } from "./data-core";
import { publicRehearsalCycles } from "../../config/public-record-visibility";
import {
  countedMilestone,
  excludedUnitTotals,
  readPublicCommitmentExclusions,
  publicRehearsalRecordLinks,
  subtractPublicCount,
} from "./public-record-exclusions";
import type {
  CommitmentCycleRecord,
  CommitmentPoolRecord,
  CommitmentUnitSummaryRecord,
} from "./types";

const PUBLIC_CYCLE_METADATA_CONCURRENCY = 4;

/**
 * Finished cycles a public read resolves metadata for by default. Cycle
 * creation has no lifetime cap and every metadata CID is an IPFS round trip
 * that can sit on the resolver's timeout, so a mature Garden must not wait
 * for its whole history before the page can show the newest window.
 */
export const PUBLIC_HISTORY_PAGE_SIZE = 12;

export interface PublicGardenPoolReadOptions {
  /**
   * How many finished cycles, newest first, to resolve and return. Rows
   * beyond it are counted in `finishedCycleTotal` but neither resolved nor
   * returned; the caller asks again with a larger window to page.
   */
  historyLimit?: number;
}

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
  /**
   * Every finished cycle the Garden has, including the ones outside the
   * returned window, so a page can say "12 of 47" without resolving 47 names.
   */
  finishedCycleTotal: number;
  /**
   * At least one of the Garden's Impact Certificates bundles commitments
   * (`Hypercert.bundleKind == COMMITMENT`). Certificate presence alone is not
   * linkage: a legacy Work bundle says nothing about the pool. `false` also
   * when the read failed, because a failed read cannot prove a link.
   */
  hasCommitmentCertificates: boolean;
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

function excludeRehearsalCounters(
  record: PublicCommitmentPoolRecord,
  rows: RawRow[]
): PublicCommitmentPoolRecord {
  const count = (predicate: (row: RawRow) => boolean) => BigInt(rows.filter(predicate).length);
  const result = { ...record };
  const milestones = {
    commitmentsFulfilled: "FULFILLED",
    commitmentsCancelled: "CANCELLED",
    commitmentsExpired: "EXPIRED",
    commitmentsDisputed: "DISPUTED",
  } as const;
  for (const [key, milestone] of Object.entries(milestones)) {
    const counter = key as keyof typeof milestones;
    result[counter] = subtractPublicCount(
      record[counter],
      count((row) => countedMilestone(row, milestone))
    );
  }
  result.commitmentsAccepted = subtractPublicCount(
    record.commitmentsAccepted,
    count((row) => row.acceptanceSeen === true)
  );
  result.commitmentsDue = subtractPublicCount(
    record.commitmentsDue,
    count((row) => row.acceptanceSeen === true && row.state !== "CANCELLED")
  );
  result.openCommitmentCount = subtractPublicCount(
    record.openCommitmentCount,
    count(
      (row) =>
        (row.direction === "OFFER" || row.acceptanceSeen === true) &&
        !["FULFILLED", "CANCELLED", "EXPIRED"].includes(String(row.state))
    )
  );
  result.commitmentsOffered = subtractPublicCount(
    result.commitmentsOffered,
    count((row) => row.direction === "OFFER")
  );
  return result;
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
  left: Pick<PublicCommitmentCycleRecord, "endTime" | "startTime" | "cycleId">,
  right: Pick<PublicCommitmentCycleRecord, "endTime" | "startTime" | "cycleId">
): number {
  const leftPosition = left.endTime ?? left.startTime ?? left.cycleId;
  const rightPosition = right.endTime ?? right.startTime ?? right.cycleId;
  if (leftPosition === rightPosition) return left.cycleId > right.cycleId ? -1 : 1;
  return leftPosition > rightPosition ? -1 : 1;
}

/**
 * Whether any of the Garden's certificates bundles commitments. Read on its
 * own, best-effort: the pool record stays publishable when this read fails,
 * and a failure answers "no" — the public page claims an anchor only when the
 * indexer positively reports one.
 */
async function hasCommitmentCertificates(
  chainId: number,
  garden: Address,
  excluded: RawRow[]
): Promise<boolean> {
  const links = publicRehearsalRecordLinks(chainId, excluded);
  const query = `query PublicGardenCommitmentCertificates($chainId: Int!, $garden: String!, $excludedRecords: [Hypercert_bool_exp!]!) {
    Hypercert(where: { chainId: { _eq: $chainId }, garden: { _eq: $garden }, bundleKind: { _eq: COMMITMENT }, metadataReconciliationRequired: { _eq: false },
      _not: { _or: $excludedRecords }
    }, limit: 1) { id }
  }`;
  const result = await greenGoodsIndexer.query<Record<string, RawRow[]>>(
    query,
    {
      chainId,
      garden: garden.toLowerCase(),
      excludedRecords: hypercertExclusionClauses(links),
    },
    "getPublicGardenCommitmentCertificates"
  );
  if (result.error) {
    logger.warn("[getPublicGardenPool] commitment certificate read failed", {
      error: result.error,
      garden,
    });
    return false;
  }
  return (result.data?.Hypercert ?? []).length > 0;
}

export async function getPublicGardenPool(
  chainId: number,
  garden: Address,
  options: PublicGardenPoolReadOptions = {}
): Promise<PublicGardenPoolRecord | null> {
  const historyLimit = Math.max(0, options.historyLimit ?? PUBLIC_HISTORY_PAGE_SIZE);
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
  let pool = mapPublicPool(poolRow);
  const rehearsalCycles = publicRehearsalCycles(chainId, pool.poolId);
  const excluded = await readPublicCommitmentExclusions(chainId, pool.poolId);

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
        (cycle.state === "OPEN" || cycle.state === "RECONCILED" || cycle.state === "COMPOSTED") &&
        !rehearsalCycles.some((rehearsal) => rehearsal.cycleId === cycle.cycleId)
    );
  let summaries = (detailsResult.data?.CommitmentUnitSummary ?? []).map(mapUnitSummary);
  if (excluded.length > 0) {
    const filter = `chainId: { _eq: $chainId }, poolId: { _eq: $poolId }, creationSeen: { _eq: true }, id: { _nin: $ids }`;
    // Count providers after exclusion so rehearsals cannot unlock a public reliability rate.
    // Select one record ID per provider, never participant addresses. Bound the
    // read and fail visibly if the public provider count would be truncated.
    const eligible = await greenGoodsIndexer.query<Record<string, { id: string }[]>>(
      `query PublicPoolEligibleRecords($chainId: Int!, $poolId: numeric!, $ids: [String!]!) {
        providers: Commitment(where: { ${filter}, leadProvider: { _is_null: false }, _or: [{ direction: { _eq: OFFER } }, { acceptanceSeen: { _eq: true } }] }, distinct_on: [leadProvider], limit: 1001) { id }
      }`,
      {
        chainId,
        poolId: pool.poolId.toString(),
        ids: excluded.map((row) => String(row.id)),
      },
      "getPublicPoolEligibleRecords"
    );
    if (eligible.error) throw eligible.error;
    const counts = eligible.data;
    if (!counts?.providers || counts.providers.length > 1000) {
      throw new Error("Eligible pool history is unavailable");
    }
    pool = excludeRehearsalCounters(pool, excluded);
    pool.distinctProviderCount = BigInt(counts.providers.length);
    summaries = summaries
      .map((summary) => {
        const units = excludedUnitTotals(
          excluded.filter(
            (row) =>
              row.unitLabel === summary.unitLabel &&
              (summary.scope === "POOL" || String(row.cycleId) === summary.cycleId?.toString())
          )
        );
        return {
          ...summary,
          expectedUnits: subtractPublicCount(summary.expectedUnits, units.expectedUnits),
          approvedUnits: subtractPublicCount(summary.approvedUnits, units.approvedUnits),
          fulfilledUnits: subtractPublicCount(summary.fulfilledUnits, units.fulfilledUnits),
          openUnits: subtractPublicCount(summary.openUnits, units.openUnits),
        };
      })
      .filter(
        (summary) =>
          summary.expectedUnits > 0n ||
          summary.approvedUnits > 0n ||
          summary.fulfilledUnits > 0n ||
          summary.openUnits > 0n
      );
  }
  // Open cycles always resolve; finished ones only inside the requested
  // window, newest first. Metadata resolution is the expensive part of this
  // read, so the window is cut before it, not after.
  const openCycles = indexedCycles.filter((cycle) => cycle.state === "OPEN");
  const finishedIndexed = indexedCycles
    .filter((cycle) => cycle.state === "RECONCILED" || cycle.state === "COMPOSTED")
    .sort(newestFirst);
  const cycles = await resolvePublicCycles([
    ...openCycles,
    ...finishedIndexed.slice(0, historyLimit),
  ]);
  const includedCycleIds = new Set(cycles.map((cycle) => cycle.cycleId.toString()));

  return {
    pool,
    hasCommitmentCertificates: await hasCommitmentCertificates(chainId, garden, excluded),
    openSeason:
      cycles.find((cycle) => cycle.state === "OPEN" && cycle.cycleType === "SEASON") ?? null,
    openCampaigns: cycles
      .filter((cycle) => cycle.state === "OPEN" && cycle.cycleType === "CAMPAIGN")
      .sort(newestFirst),
    finishedCycles: cycles
      .filter((cycle) => cycle.state === "RECONCILED" || cycle.state === "COMPOSTED")
      .sort(newestFirst),
    finishedCycleTotal: finishedIndexed.length,
    poolUnitSummaries: summaries.filter((summary) => summary.scope === "POOL"),
    cycleUnitSummaries: summaries.filter(
      (summary) =>
        summary.scope === "CYCLE" &&
        summary.cycleId !== null &&
        includedCycleIds.has(summary.cycleId.toString())
    ),
  };
}
