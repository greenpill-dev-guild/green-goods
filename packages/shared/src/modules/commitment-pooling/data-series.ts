import type { Address } from "../../types/domain";
import { greenGoodsIndexer } from "../data/graphql-client";
import { getCommitmentSeriesId } from "./ids";
import type { CommitmentSeriesCycleSummaryRecord, CommitmentSeriesRecord } from "./types";
import { SERIES_FIELDS, type RawRow, integer, mapSeries, number, queryRows } from "./data-core";

export async function getCommitmentSeries(input: {
  chainId: number;
  poolId?: bigint;
  holder?: Address;
  state?: string;
}): Promise<CommitmentSeriesRecord[]> {
  const declarations = ["$chainId: Int!"];
  const clauses = ["chainId: { _eq: $chainId }", "creationSeen: { _eq: true }"];
  const variables: Record<string, unknown> = { chainId: input.chainId };
  if (input.poolId !== undefined) {
    declarations.push("$poolId: numeric!");
    clauses.push("poolId: { _eq: $poolId }");
    variables.poolId = input.poolId.toString();
  }
  if (input.holder) {
    declarations.push("$holder: String!");
    clauses.push("currentHolder: { _eq: $holder }");
    variables.holder = input.holder.toLowerCase();
  }
  if (input.state) {
    declarations.push("$state: CommitmentSeriesState!");
    clauses.push("state: { _eq: $state }");
    variables.state = input.state;
  }
  const query = `query CommitmentSeriesList(${declarations.join(", ")}) { CommitmentSeries(where: { ${clauses.join(", ")} }, order_by: { seriesId: desc }) { ${SERIES_FIELDS} } }`;
  return (await queryRows(query, variables, "CommitmentSeries", "getCommitmentSeries")).map(
    mapSeries
  );
}

export async function getCommitmentSeriesDetail(
  chainId: number,
  seriesId: bigint
): Promise<{
  series: CommitmentSeriesRecord;
  cycleSummaries: CommitmentSeriesCycleSummaryRecord[];
} | null> {
  const id = getCommitmentSeriesId(chainId, seriesId);
  const query = `query CommitmentSeriesDetail($id: String!, $chainId: Int!, $seriesId: numeric!) {
    CommitmentSeries(where: { id: { _eq: $id }, creationSeen: { _eq: true } }, limit: 1) { ${SERIES_FIELDS} }
    CommitmentSeriesCycleSummary(where: { chainId: { _eq: $chainId }, seriesId: { _eq: $seriesId } }, order_by: { cycleId: desc }) {
      id chainId seriesId seriesEntityId cycleId cycleEntityId poolId poolEntityId instanceCount
      offeredCount acceptedCount readyCount fulfilledCount cancelledCount expiredCount disputedCount updatedAt
    }
  }`;
  const result = await greenGoodsIndexer.query<Record<string, RawRow[]>>(
    query,
    { id, chainId, seriesId: seriesId.toString() },
    "getCommitmentSeriesDetail"
  );
  if (result.error) throw result.error;
  const series = result.data?.CommitmentSeries?.[0];
  return series
    ? {
        series: mapSeries(series),
        cycleSummaries: (result.data?.CommitmentSeriesCycleSummary ?? []).map(
          mapSeriesCycleSummary
        ),
      }
    : null;
}

export function mapSeriesCycleSummary(row: RawRow): CommitmentSeriesCycleSummaryRecord {
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    seriesId: integer(row.seriesId),
    seriesEntityId: String(row.seriesEntityId),
    cycleId: integer(row.cycleId),
    cycleEntityId: String(row.cycleEntityId),
    poolId: integer(row.poolId),
    poolEntityId: String(row.poolEntityId),
    instanceCount: integer(row.instanceCount),
    offeredCount: integer(row.offeredCount),
    acceptedCount: integer(row.acceptedCount),
    readyCount: integer(row.readyCount),
    fulfilledCount: integer(row.fulfilledCount),
    cancelledCount: integer(row.cancelledCount),
    expiredCount: integer(row.expiredCount),
    disputedCount: integer(row.disputedCount),
    updatedAt: number(row.updatedAt),
  };
}
