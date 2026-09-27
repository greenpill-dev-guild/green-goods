import type { PublicClient } from "viem";

import { settledRead } from "./data-pool-funding-chain-support";
import type { PoolFundingProcessedBlock } from "./data-pool-funding-indexed-queries";

/** How old the settlement ledger may be before availability is not calculated from it. */
export const LEDGER_MAX_AGE_SECONDS = 120;

/**
 * How far behind the chains the ledger is: the age of the oldest processed
 * block, in seconds, or null when any chain's time is unknown. A ledger that
 * an indexer keeps writing stays young whether or not anything happens in the
 * garden; one the indexer has stopped writing ages with the clock.
 */
export function ledgerAgeSeconds(
  blockTimestamps: readonly (number | null)[],
  now: number
): number | null {
  if (blockTimestamps.length === 0) return null;
  let oldest = Number.POSITIVE_INFINITY;
  for (const timestamp of blockTimestamps) {
    if (timestamp === null) return null;
    oldest = Math.min(oldest, timestamp);
  }
  return Math.max(0, now - oldest);
}

/** Reads when each processed block was made, from its own chain; a failed read stays unknown. */
export async function readProcessedBlockTimestamps(
  processed: readonly PoolFundingProcessedBlock[],
  createClient: (chainId: number) => PublicClient
): Promise<(number | null)[]> {
  return Promise.all(
    processed.map(async ({ chainId, block }) => {
      const read = await settledRead(createClient(chainId).getBlock({ blockNumber: block }));
      return read === null ? null : Number(read.timestamp);
    })
  );
}
