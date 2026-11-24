/**
 * useCycleClock Hook
 *
 * The clock seasons and campaigns are read on (`cycleStanding`, DL-162): the chain's time from
 * `useExpiryClock`, the clock promises fall due on, ticking the second one of the listed cycles
 * ends, so a season reads Ended exactly when a promise that falls due with it is past due.
 *
 * @module hooks/commitment-pooling/useCycleClock
 */

import { useMemo } from "react";

import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import type {
  CommitmentCycleRecord,
  CommitmentReadModel,
} from "../../modules/commitment-pooling/types-core";
import { useExpiryClock } from "./useExpiryClock";

const NO_PROMISES: readonly CommitmentReadModel[] = [];
const NO_CYCLE_ENDS: ReadonlyMap<string, bigint | null> = new Map();

/** The chain's time in Unix seconds, ticking as each listed cycle ends. */
export function useCycleClock(
  cycles: readonly Pick<CommitmentCycleRecord, "chainId" | "endTime">[]
): bigint {
  const deadlines = useMemo(
    () => cycles.flatMap((cycle) => (cycle.endTime ? [cycle.endTime] : [])),
    [cycles]
  );
  return useExpiryClock({
    // A pool's cycles are read on its chain, so they all carry it.
    chainId: cycles[0]?.chainId ?? DEFAULT_CHAIN_ID,
    commitments: NO_PROMISES,
    cycleEndTimes: NO_CYCLE_ENDS,
    deadlines,
  });
}
