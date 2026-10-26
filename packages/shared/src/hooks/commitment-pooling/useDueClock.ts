/**
 * useDueClock Hook
 *
 * The clock a surface that offers take-up reads due dates on (`isPastDue`): the chain's time,
 * ticking when a listed promise falls due, and the end of each cycle that a listed promise
 * without a due date of its own falls due at. The pool's cycles are read, under the Pool tab's
 * key, only when such a promise is still open to take up; until they are, and while a cycle one
 * of them needs is missing from the read, the clock is not known and the surface offers no
 * take-up.
 *
 * @module hooks/commitment-pooling/useDueClock
 */

import { useMemo } from "react";

import { type DueClock, fallsDueWithItsCycle } from "../../modules/commitment-pooling/due-dates";
import type { CommitmentReadModel } from "../../modules/commitment-pooling/types-core";
import { useCommitmentCycles } from "./useCommitmentPooling";
import { useExpiryClock } from "./useExpiryClock";

export interface DueClockRead {
  clock: DueClock;
  /** Every open promise's due date can be read: false while a cycle's end it needs is unread. */
  known: boolean;
  /**
   * The cycles an open promise falls due with could not be read, or the read did not return one
   * of them, so that promise's due date cannot be known yet.
   */
  isError: boolean;
  retry: () => void;
}

type Clocked = Pick<CommitmentReadModel, "onchainState" | "cycleId" | "dueDate">;

/** Only a promise still open to take up needs its due date here; a settled one never falls due. */
function openToTakeUp(promise: Clocked): boolean {
  return promise.onchainState === "OFFERED" || promise.onchainState === "REQUESTED";
}

export function useDueClock(input: {
  chainId: number;
  /** The pool the promises are in, or null while it is unknown. */
  poolId: bigint | null;
  commitments: readonly Clocked[];
}): DueClockRead {
  const { chainId, poolId, commitments } = input;
  const { open, undated } = useMemo(() => {
    const stillOpen = commitments.filter(openToTakeUp);
    return { open: stillOpen, undated: stillOpen.filter(fallsDueWithItsCycle) };
  }, [commitments]);
  const needsCycleEnds = undated.length > 0;
  const cycles = useCommitmentCycles(
    { chainId, poolId: poolId ?? 0n },
    { enabled: poolId !== null && needsCycleEnds }
  );
  const cycleEndTimes = useMemo(
    () => new Map((cycles.data ?? []).map((cycle) => [cycle.cycleId.toString(), cycle.endTime])),
    [cycles.data]
  );
  const now = useExpiryClock({ commitments: open, cycleEndTimes });
  const clock = useMemo(() => ({ now, cycleEndTimes }), [now, cycleEndTimes]);
  const unread = needsCycleEnds && cycles.data === undefined;
  // A cycle the read did not return (not reconstructed yet, or another pool's) leaves the
  // promise that falls due with it without a due date, so the clock stays unknown.
  const missing = !unread && undated.some((promise) => !cycleEndTimes.has(String(promise.cycleId)));

  return {
    clock,
    known: !unread && !missing,
    isError: (unread && cycles.isError) || missing,
    retry: () => void cycles.refetch(),
  };
}
