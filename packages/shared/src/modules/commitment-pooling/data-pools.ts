import type { Address } from "../../types/domain";
import { greenGoodsIndexer, type GraphQLReader } from "../data/graphql-client";
import { getCommitmentCycleId, getCommitmentPoolId } from "./ids";
import type {
  CommitmentCycleDetail,
  CommitmentCycleRecord,
  CommitmentPoolDetail,
  CommitmentPoolRecord,
  CommitmentProviderExposureRecord,
} from "./types";
import {
  CYCLE_FIELDS,
  POOL_FIELDS,
  UNIT_SUMMARY_FIELDS,
  type RawRow,
  address,
  integer,
  mapCycle,
  mapPool,
  mapUnitSummary,
  number,
  queryRows,
} from "./data-core";
import { mapSeriesCycleSummary } from "./data-series";

export async function getCommitmentPools(
  chainId: number,
  garden?: Address,
  reader: GraphQLReader = greenGoodsIndexer
): Promise<CommitmentPoolRecord[]> {
  const gardenClause = garden ? ", garden: { _eq: $garden }" : "";
  const query = `query CommitmentPools($chainId: Int!${garden ? ", $garden: String!" : ""}) {
    CommitmentPool(where: { chainId: { _eq: $chainId }, registrationSeen: { _eq: true }${gardenClause} }, order_by: { poolId: asc }) { ${POOL_FIELDS} }
  }`;
  const rows = await queryRows(
    query,
    { chainId, ...(garden ? { garden: garden.toLowerCase() } : {}) },
    "CommitmentPool",
    "getCommitmentPools",
    reader
  );
  return rows.map(mapPool);
}

export async function getCommitmentPoolDetail(
  chainId: number,
  poolId: bigint,
  reader: GraphQLReader = greenGoodsIndexer
): Promise<CommitmentPoolDetail | null> {
  const id = getCommitmentPoolId(chainId, poolId);
  const query = `query CommitmentPoolDetail($chainId: Int!, $id: String!, $poolId: numeric!) {
    CommitmentPool(where: { id: { _eq: $id }, registrationSeen: { _eq: true } }, limit: 1) { ${POOL_FIELDS} }
    CommitmentUnitSummary(where: { chainId: { _eq: $chainId }, scope: { _eq: POOL }, scopeId: { _eq: $poolId } }, order_by: { unitLabelHash: asc }) { ${UNIT_SUMMARY_FIELDS} }
    CommitmentProviderExposure(where: { chainId: { _eq: $chainId }, poolId: { _eq: $poolId } }, order_by: { provider: asc }) { id chainId poolId provider openCommitmentCount updatedAt }
  }`;
  const result = await reader.query<Record<string, RawRow[]>>(
    query,
    { chainId, id, poolId: poolId.toString() },
    "getCommitmentPoolDetail"
  );
  if (result.error) throw result.error;
  const pool = result.data?.CommitmentPool?.[0];
  if (!pool) return null;
  return {
    pool: mapPool(pool),
    unitSummaries: (result.data?.CommitmentUnitSummary ?? []).map(mapUnitSummary),
    providerExposures: (result.data?.CommitmentProviderExposure ?? []).map(
      (row): CommitmentProviderExposureRecord => ({
        id: String(row.id),
        chainId: number(row.chainId),
        poolId: integer(row.poolId),
        provider: address(row.provider)!,
        openCommitmentCount: integer(row.openCommitmentCount),
        updatedAt: number(row.updatedAt),
      })
    ),
  };
}

export async function getCommitmentCycles(
  input: {
    chainId: number;
    poolId: bigint;
    cycleType?: string;
    state?: string;
  },
  reader: GraphQLReader = greenGoodsIndexer
): Promise<CommitmentCycleRecord[]> {
  const clauses = [
    "chainId: { _eq: $chainId }",
    "poolId: { _eq: $poolId }",
    "seedSeen: { _eq: true }",
  ];
  const declarations = ["$chainId: Int!", "$poolId: numeric!"];
  const variables: Record<string, unknown> = {
    chainId: input.chainId,
    poolId: input.poolId.toString(),
  };
  if (input.cycleType) {
    declarations.push("$cycleType: CommitmentCycleType!");
    clauses.push("cycleType: { _eq: $cycleType }");
    variables.cycleType = input.cycleType;
  }
  if (input.state) {
    declarations.push("$state: CommitmentCycleState!");
    clauses.push("state: { _eq: $state }");
    variables.state = input.state;
  }
  const query = `query CommitmentCycles(${declarations.join(", ")}) { CommitmentCycle(where: { ${clauses.join(", ")} }, order_by: { cycleId: desc }) { ${CYCLE_FIELDS} } }`;
  return (await queryRows(query, variables, "CommitmentCycle", "getCommitmentCycles", reader)).map(
    mapCycle
  );
}

export async function getCommitmentCycleDetail(
  chainId: number,
  cycleId: bigint,
  reader: GraphQLReader = greenGoodsIndexer
): Promise<CommitmentCycleDetail | null> {
  const id = getCommitmentCycleId(chainId, cycleId);
  const query = `query CommitmentCycleDetail($id: String!, $chainId: Int!, $cycleId: numeric!) {
    CommitmentCycle(where: { id: { _eq: $id }, seedSeen: { _eq: true } }, limit: 1) { ${CYCLE_FIELDS} }
    CommitmentUnitSummary(where: { chainId: { _eq: $chainId }, scope: { _eq: CYCLE }, scopeId: { _eq: $cycleId } }, order_by: { unitLabelHash: asc }) { ${UNIT_SUMMARY_FIELDS} }
    CommitmentSeriesCycleSummary(where: { chainId: { _eq: $chainId }, cycleId: { _eq: $cycleId } }, order_by: { seriesId: asc }) {
      id chainId seriesId seriesEntityId cycleId cycleEntityId poolId poolEntityId instanceCount
      offeredCount acceptedCount readyCount fulfilledCount cancelledCount expiredCount disputedCount updatedAt
    }
  }`;
  const result = await reader.query<Record<string, RawRow[]>>(
    query,
    { id, chainId, cycleId: cycleId.toString() },
    "getCommitmentCycleDetail"
  );
  if (result.error) throw result.error;
  const cycle = result.data?.CommitmentCycle?.[0];
  if (!cycle) return null;
  return {
    cycle: mapCycle(cycle),
    unitSummaries: (result.data?.CommitmentUnitSummary ?? []).map(mapUnitSummary),
    seriesSummaries: (result.data?.CommitmentSeriesCycleSummary ?? []).map(mapSeriesCycleSummary),
  };
}
