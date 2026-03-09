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

/**
 * Submission phase where the error occurred.
 * Used by error handlers to determine category and user message.
 */
export type SubmissionPhase = "upload" | "transaction" | "sync";

/**
 * Typed error that preserves the phase where submission failed.
 * Allows the mutation error handler to distinguish IPFS failures
 * from transaction failures and show the right message.
 */
export class WorkSubmissionError extends Error {
  override readonly name = "WorkSubmissionError";

  constructor(
    message: string,
    public readonly phase: SubmissionPhase,
    public readonly uploadBatchId?: string,
    originalError?: unknown
  ) {
    super(message, { cause: originalError });
  }
}
