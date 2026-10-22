import {
  publicRehearsalCycles,
  publicReviewedWorkExclusionIds,
} from "../../config/public-record-visibility";
import { greenGoodsIndexer } from "../data/graphql-client";
import { integer, type RawRow } from "./data-core";

/** Keyset pagination keeps later QA records in scope without a frozen ID list. */
export async function readPublicCommitmentExclusions(chainId: number, poolId?: bigint) {
  const cycles = publicRehearsalCycles(chainId, poolId);
  if (cycles.length === 0) return [];
  const filter = cycles
    .map((cycle) => `{ poolId: { _eq: ${cycle.poolId} }, cycleId: { _eq: ${cycle.cycleId} } }`)
    .join(",");
  const rows: RawRow[] = [];
  const deadline = AbortSignal.timeout(30000);
  let after = "";
  while (true) {
    deadline.throwIfAborted();
    const result = await greenGoodsIndexer.query<{ Commitment?: RawRow[] }>(
      `query PublicCommitmentExclusions($chainId: Int!, $after: String!) {
        Commitment(where: { chainId: { _eq: $chainId }, _or: [${filter}],
          id: { _gt: $after }, creationSeen: { _eq: true } }, order_by: { id: asc }, limit: 100) {
          id commitmentId poolId cycleId direction state acceptanceSeen countedLifecycleStates
          unitLabel targetUnits approvedUnits workUIDs assessmentUID
        }
      }`,
      { chainId, after },
      "getPublicCommitmentExclusions"
    );
    if (result.error) throw result.error;
    const page = result.data?.Commitment;
    if (!page) throw new Error("Rehearsal commitment history is unavailable");
    for (const row of page) {
      if (typeof row.id !== "string" || row.id <= after) {
        throw new Error("Rehearsal commitment history did not advance");
      }
      after = row.id;
      rows.push(row);
    }
    if (page.length < 100) return rows;
  }
}

export function publicRehearsalRecordLinks(chainId: number, rows: readonly RawRow[]) {
  const workUIDs = new Set(publicReviewedWorkExclusionIds(chainId));
  const assessmentUIDs = new Set<string>();
  const addUID = (set: Set<string>, value: unknown) => {
    if (typeof value === "string" && /^0x[0-9a-f]{64}$/i.test(value) && !/^0x0+$/i.test(value)) {
      set.add(value.toLowerCase());
    }
  };
  for (const row of rows) {
    if (Array.isArray(row.workUIDs)) for (const uid of row.workUIDs) addUID(workUIDs, uid);
    addUID(assessmentUIDs, row.assessmentUID);
  }
  return {
    workUIDs,
    assessmentUIDs,
    commitmentEntityIds: rows.map((row) => String(row.id)),
    attestationUIDs: [...new Set([...workUIDs, ...assessmentUIDs])],
  };
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
