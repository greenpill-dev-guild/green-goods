export interface ApproximateWorkLocation {
  lat: number;
  lng: number;
}

export interface WorkUploadCheckpoint {
  transactionReverted?: boolean;
  transactionHash?: `0x${string}`;
  submittedAt: string;
  files: Record<string, { attachmentId: string; contentHash: string; cid: string }>;
  metadata?: { contentHash: string; cid: string };
}
