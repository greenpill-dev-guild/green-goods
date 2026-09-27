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
