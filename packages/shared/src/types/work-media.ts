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
  transactionReverted?: boolean;
  transactionHash?: `0x${string}`;
  submittedAt: string;
  files: Record<string, { attachmentId: string; contentHash: string; cid: string }>;
  metadata?: { contentHash: string; cid: string };
}
