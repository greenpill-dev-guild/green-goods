import type { AddMembersOutcome } from "@green-goods/shared/hooks/garden/useGardenOperations";
import type { Address } from "@green-goods/shared/types/domain";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import { memberRowKey, type StagedMember } from "./addMembersEntry";

type OnLanded = (rows: readonly StagedMember[]) => void;

interface AddMembersRunInput {
  rows: readonly StagedMember[];
  /** Commits one person. A `{ success: false }` result or a throw keeps that row for retry. */
  addOne: (role: GardenRole, address: Address) => Promise<{ success: boolean }>;
  /** Present when a list can go under fewer signatures now. */
  addBatch?: (rows: readonly StagedMember[], onLanded: OnLanded) => Promise<AddMembersOutcome>;
  onLanded: OnLanded;
}

export interface AddMembersRun {
  /** What stays listed, in list order. A row with an unknown outcome is here until a read locks it. */
  remaining: StagedMember[];
  /** Rows the person can send again as they are. */
  failedCount: number;
  /** What stopped a write, when that is more than a failed result. */
  thrown?: unknown;
  /** Rows past their ceilings: nothing went out, and they now take more signatures than promised. */
  needsMoreSignatures: boolean;
}

async function addOneAtATime(
  rows: readonly StagedMember[],
  addOne: AddMembersRunInput["addOne"],
  onLanded: OnLanded
): Promise<{ failed: StagedMember[]; thrown?: unknown }> {
  const failed: StagedMember[] = [];
  // Sequential on purpose: one signature at a time, and each row shows it has landed.
  for (const [index, row] of rows.entries()) {
    try {
      const { success } = await addOne(row.role, row.address);
      if (success) onLanded([row]);
      else failed.push(row);
    } catch (error) {
      return { failed: [...failed, ...rows.slice(index)], thrown: error };
    }
  }
  return { failed };
}

/**
 * Runs one press of Add. The list goes through `addBatch` when the person's rail
 * can do that, even for one person, because its journal is what refuses a row
 * another tab's add still holds. Otherwise it goes one person at a time. A list
 * past its ceilings comes back untried: it was promised fewer signatures, so
 * going one at a time takes another press.
 */
export async function runAddMembers({
  rows: staged,
  addOne,
  addBatch,
  onLanded,
}: AddMembersRunInput): Promise<AddMembersRun> {
  // Each attempt starts clean: a reason from the last one says nothing about this one.
  const rows = staged.map(({ address, role }): StagedMember => ({ address, role }));
  if (!addBatch) {
    const { failed, thrown } = await addOneAtATime(rows, addOne, onLanded);
    return { remaining: failed, failedCount: failed.length, thrown, needsMoreSignatures: false };
  }

  const outcome = await addBatch(rows, onLanded);
  const reasons = new Map(outcome.refused.map((row) => [memberRowKey(row), row.reason]));
  const open = new Set(
    [...outcome.notSent, ...outcome.notBatchable, ...outcome.unknown].map(memberRowKey)
  );
  return {
    remaining: rows.flatMap((row): StagedMember[] => {
      const key = memberRowKey(row);
      const refusal = reasons.get(key);
      if (refusal) return [{ ...row, refusal }];
      return open.has(key) ? [row] : [];
    }),
    // After an unknown add the hold explains why the rest did not go.
    failedCount: outcome.unknown.length > 0 ? 0 : outcome.notSent.length,
    thrown: outcome.failure,
    needsMoreSignatures: outcome.notBatchable.length > 0,
  };
}

/** The list after a read: what landed leaves, what is held joins, and the rest stays as it was. */
export function stagedAfterRead(
  staged: readonly StagedMember[],
  held: readonly StagedMember[],
  saved: readonly StagedMember[]
): StagedMember[] {
  const landed = new Set(saved.map(memberRowKey));
  const kept = staged.filter((row) => !landed.has(memberRowKey(row)));
  const listed = new Set(kept.map(memberRowKey));
  return [...kept, ...held.filter((row) => !listed.has(memberRowKey(row)))];
}
