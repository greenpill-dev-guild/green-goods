import type { JobQueueHandle } from "../../modules/job-queue/ports";
import type { WalletSubmissionStage } from "../../modules/work/wallet-submission/types";
import type { Action, Address } from "../../types/domain";

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
  onProgress?: (stage: WalletSubmissionStage, message: string) => void;
  onSuccess?: (txHash: `0x${string}` | string) => void;
  onError?: (error: unknown) => void;
  onSettled?: () => void;
  dependencies?: {
    jobQueue?: Pick<JobQueueHandle, "processJob">;
  };
}
