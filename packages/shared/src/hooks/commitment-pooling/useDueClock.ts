/**
 * useDueClock Hook
 *
 * The clock a surface that offers take-up reads due dates on (`isPastDue`): the chain's time,
 * ticking when a listed promise falls due, and the end of each cycle that a listed promise
 * without a due date of its own falls due at. The pool's cycles are read, under the Pool tab's
 * key, only when such a promise is listed; until they are, the clock is not known and the
 * surface offers no take-up.
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
  /** Every listed promise's due date can be read: false while a cycle's end it needs is unread. */
  known: boolean;
  /** The cycles a listed promise falls due with could not be read. */
  isError: boolean;
  retry: () => void;
}

export function useDueClock(input: {
  chainId: number;
  /** The pool the promises are in, or null while it is unknown. */
  poolId: bigint | null;
  commitments: readonly Pick<CommitmentReadModel, "onchainState" | "cycleId" | "dueDate">[];
}): DueClockRead {
  const { chainId, poolId, commitments } = input;
  const needsCycleEnds = commitments.some(fallsDueWithItsCycle);
  const cycles = useCommitmentCycles(
    { chainId, poolId: poolId ?? 0n },
    { enabled: poolId !== null && needsCycleEnds }
  );
  const cycleEndTimes = useMemo(
    () => new Map((cycles.data ?? []).map((cycle) => [cycle.cycleId.toString(), cycle.endTime])),
    [cycles.data]
  );
  const now = useExpiryClock({ commitments, cycleEndTimes });
  const clock = useMemo(() => ({ now, cycleEndTimes }), [now, cycleEndTimes]);
  const unread = needsCycleEnds && cycles.data === undefined;

  return {
    clock,
    known: !unread,
    isError: unread && cycles.isError,
    retry: () => void cycles.refetch(),
  };
}
