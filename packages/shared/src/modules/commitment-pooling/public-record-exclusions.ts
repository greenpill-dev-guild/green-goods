import { publicCommitmentExclusionIds } from "../../config/public-record-visibility";
import { greenGoodsIndexer } from "../data/graphql-client";
import { integer, type RawRow } from "./data-core";

/** Read current contributions, rather than freezing today's rehearsal counts. */
export async function readPublicCommitmentExclusions(chainId: number, poolId?: bigint) {
  const ids = publicCommitmentExclusionIds(chainId, poolId);
  if (ids.length === 0) return [];
  const result = await greenGoodsIndexer.query<{ Commitment?: RawRow[] }>(
    `query PublicCommitmentExclusions($chainId: Int!, $ids: [String!]!) {
      Commitment(where: { chainId: { _eq: $chainId }, poolId: { _eq: 1 },
        id: { _in: $ids }, creationSeen: { _eq: true } }) {
        id cycleId direction state acceptanceSeen countedLifecycleStates
        unitLabel targetUnits approvedUnits
      }
    }`,
    { chainId, ids },
    "getPublicCommitmentExclusions"
  );
  if (result.error) throw result.error;
  const rows = result.data?.Commitment;
  if (
    !rows ||
    rows.length !== ids.length ||
    new Set(rows.map((row) => row.id)).size !== ids.length
  ) {
    throw new Error("Rehearsal commitment history is incomplete");
  }
  return rows;
}

export function countedMilestone(row: RawRow, milestone: string): boolean {
  return (
    Array.isArray(row.countedLifecycleStates) && row.countedLifecycleStates.includes(milestone)
  );
}

/** A broken correction must surface as unavailable, never as a negative or clamped claim. */
export function subtractPublicCount(total: bigint, excluded: bigint): bigint {
  if (excluded > total) throw new Error("Rehearsal correction exceeds the indexed total");
  return total - excluded;
}

export function excludedUnitTotals(rows: RawRow[]) {
  const totals = { expectedUnits: 0n, approvedUnits: 0n, fulfilledUnits: 0n, openUnits: 0n };
  for (const row of rows) {
    const committed = row.direction === "OFFER" || row.acceptanceSeen === true;
    const units = integer(row.targetUnits);
    const terminal = ["FULFILLED", "CANCELLED", "EXPIRED"].includes(String(row.state));
    totals.expectedUnits += committed ? units : 0n;
    totals.approvedUnits += integer(row.approvedUnits);
    totals.fulfilledUnits += countedMilestone(row, "FULFILLED") ? units : 0n;
    totals.openUnits += committed && !terminal ? units : 0n;
  }
  return totals;
}
