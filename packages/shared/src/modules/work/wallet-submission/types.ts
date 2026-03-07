export type WalletSubmissionStage =
  | "validating"
  | "uploading"
  | "confirming"
  | "syncing"
  | "complete";

export type OnProgressCallback = (stage: WalletSubmissionStage, message: string) => void;

export interface WalletSubmissionOptions {
  onProgress?: OnProgressCallback;
  txTimeout?: number;
}

export interface BatchApprovalOptions {
  onProgress?: OnProgressCallback;
  txTimeout?: number;
}
