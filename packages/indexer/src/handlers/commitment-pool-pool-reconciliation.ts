import type { CommitmentPool } from "envio";

import { cursorWins, sortedUnique } from "./commitment-pool-projections";

export function withCycleChild(pool: CommitmentPool, cycleEntityId: string): CommitmentPool {
  if (pool.registrationSeen) return pool;
  return {
    ...pool,
    childCycleEntityIds: sortedUnique([...pool.childCycleEntityIds, cycleEntityId]),
  };
}

export function withCommitmentChild(
  pool: CommitmentPool,
  commitmentEntityId: string
): CommitmentPool {
  if (pool.registrationSeen) return pool;
  return {
    ...pool,
    childCommitmentEntityIds: sortedUnique([...pool.childCommitmentEntityIds, commitmentEntityId]),
  };
}

export function retainPendingPoolClose(
  pool: CommitmentPool,
  blockNumber: number,
  logIndex: number,
  timestamp: number
): CommitmentPool {
  if (!cursorWins(blockNumber, logIndex, pool.pendingCloseBlockNumber, pool.pendingCloseLogIndex))
    return pool;
  return {
    ...pool,
    pendingCloseBlockNumber: BigInt(blockNumber),
    pendingCloseLogIndex: logIndex,
    pendingCloseTimestamp: timestamp,
    updatedAt: Math.max(pool.updatedAt, timestamp),
  };
}

export function reconcilePendingPoolClose(pool: CommitmentPool, timestamp: number): CommitmentPool {
  const pendingBlock = pool.pendingCloseBlockNumber;
  const pendingLogIndex = pool.pendingCloseLogIndex;
  if (pendingBlock === undefined || pendingLogIndex === undefined) return pool;
  if (
    !cursorWins(
      Number(pendingBlock),
      pendingLogIndex,
      pool.lifecycleBlockNumber,
      pool.lifecycleLogIndex
    )
  ) {
    return {
      ...pool,
      pendingCloseBlockNumber: undefined,
      pendingCloseLogIndex: undefined,
      pendingCloseTimestamp: undefined,
    };
  }
  if (pool.liveCommitmentCount !== 0n || pool.nonTerminalCycleCount !== 0n) return pool;
  return {
    ...pool,
    state: "CLOSED",
    lifecycleBlockNumber: pendingBlock,
    lifecycleLogIndex: pendingLogIndex,
    pendingCloseBlockNumber: undefined,
    pendingCloseLogIndex: undefined,
    pendingCloseTimestamp: undefined,
    updatedAt: Math.max(pool.updatedAt, pool.pendingCloseTimestamp ?? timestamp),
  };
}
