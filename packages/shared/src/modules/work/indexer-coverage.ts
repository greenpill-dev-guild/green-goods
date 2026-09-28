/**
 * Whether an indexer has covered a lost send's grace window
 *
 * An empty answer from an indexer proves a send absent only once the indexer
 * has processed past the send's grace window: one that trails or stalls holds
 * nothing for a send it has not reached. Both sides are timed on the chain's
 * clock. The indexer's side is its processed block's time. The send's side is
 * its intent, as kept with the intent, or else the device's clock set against
 * the chain's latest block, so a device clock that runs fast or slow moves
 * neither.
 *
 * The lookups read the processed block before anything it covers. An indexer
 * writes a batch's rows no later than it moves its processed block, so a block
 * read first covers every row the reads that follow can miss, while a block
 * read after them may cover a row that landed in between.
 *
 * @module modules/work/indexer-coverage
 */

import { getBlock } from "@wagmi/core";
import { getWagmiConfig } from "../../config/appkit";
import { STRANDED_INTENT_GRACE_MS } from "./stranded-intent";

/** The chain's time at a block, in seconds: the latest block when none is named. */
export type ReadBlockTime = (chainId: number, blockNumber?: bigint) => Promise<number>;

export const chainBlockTime: ReadBlockTime = async (chainId, blockNumber) => {
  const block = await getBlock(getWagmiConfig(), {
    chainId,
    ...(blockNumber === undefined ? {} : { blockNumber }),
  });
  return Number(block.timestamp);
};

/** Whether an indexer that processed through `indexedBlock` has passed the send's grace window. */
export async function indexedPastGraceWindow(input: {
  chainId: number;
  indexedBlock: bigint;
  /** When the send's intent was recorded, on the device's clock. */
  sentAtMs: number;
  /**
   * The chain's time the send's window counts from, when kept: its intent, or
   * later when its answer was lost.
   */
  intentChainTime?: number;
  readBlockTime: ReadBlockTime;
  now: () => number;
}): Promise<boolean> {
  const { chainId, readBlockTime } = input;
  const indexedThroughS = await readBlockTime(chainId, input.indexedBlock);
  const intentOnChainS =
    input.intentChainTime ??
    input.sentAtMs / 1000 - (input.now() / 1000 - (await readBlockTime(chainId)));
  return indexedThroughS >= intentOnChainS + STRANDED_INTENT_GRACE_MS / 1000;
}
