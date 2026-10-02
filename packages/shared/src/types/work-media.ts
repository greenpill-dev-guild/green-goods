export interface ApproximateWorkLocation {
  lat: number;
  lng: number;
}

export interface WorkUploadCheckpoint {
  broadcast?: import("../modules/transactions/types").BroadcastReference;
  /** Durable signing intent. A missing hash after interruption must not authorize another send. */
  broadcastPending?: boolean;
  /** When the intent was recorded, so an intent that never reached the chain can be resolved. */
  broadcastPendingAt?: string;
  /**
   * The chain's latest block time when the intent was recorded, in seconds.
   * Whatever this send did lands at or after it, and an earlier ask before it.
   */
  intentChainTime?: number;
  /**
   * The chain's latest block when the intent was recorded. Whatever this send
   * did lands in a later block, since that one was already sealed.
   */
  intentBlock?: bigint;
  /**
   * The chain's head block when a lost send was last found idle, its window
   * past: no tab held it, its account had nothing pending and its bundler
   * could not land it. Anything it sent before then landed by this block or
   * would still be pending, so it reads absent only once an indexer has
   * passed this block.
   */
  idleBlock?: bigint;
  /**
   * The nonce the recorded transaction used, read off the transaction while the
   * network held it, with the hash it was read for. Only this can show that
   * another transaction took its nonce: the account's next nonce read before
   * the prompt is a floor, since the wallet may know sends this network does not.
   */
  transactionNonce?: { hash: `0x${string}`; nonce: number };
  transactionReverted?: boolean;
  /**
   * The wallet saw this transaction replaced by a different call, so it can
   * never be included. What landed in its place is still unknown until the job
   * inspects it; unlike a Safe's own id, its absence then settles it.
   */
  transactionReplaced?: boolean;
  transactionHash?: `0x${string}`;
  submittedAt: string;
  files: Record<string, { attachmentId: string; contentHash: string; cid: string }>;
  metadata?: { contentHash: string; cid: string };
}
