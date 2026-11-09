import type { JobQueueHandle } from "../../modules/job-queue/ports";
import type { WalletSubmissionStage } from "../../modules/work/wallet-submission/types";
import type { SubmitWorkOutcome } from "../../modules/work/submit-work-command";
import type { Action, Address, WorkUploadConsent } from "../../types/domain";

export interface UseWorkMutationOptions {
  authMode: "wallet" | "passkey" | "embedded" | null;
  gardenAddress: Address | null;
  actionUID: number | null;
  actions: Action[];
  /** User address (smart account or wallet) for scoping jobs */
  userAddress: Address | null;
  /** Disable only when a non-client surface owns its completion UX. */
  completeClientFlow?: boolean;
  /** Disable when queue fallback must not represent a completed submission. */
  allowOfflineQueue?: boolean;
  /** Persist an online submission for confirmation-only recovery. */
  retainSubmission?: boolean;
  onProgress?: (stage: WalletSubmissionStage, message: string) => void;
  onSuccess?: (txHash: `0x${string}` | string) => void;
  onError?: (error: unknown) => void;
  onSettled?: () => void;
  dependencies?: {
    jobQueue?: Pick<JobQueueHandle, "processJob">;
  };
}

export interface WorkMutationOrigin {
  identity: string;
  generation: number;
  activeDraftId: string | null | undefined;
  journeyId: string;
  clientWorkId?: string;
  outcome?: SubmitWorkOutcome;
  /** The queue took the work, so the draft is no longer its only copy. */
  admitted?: boolean;
  uploadConsent?: WorkUploadConsent;
}
