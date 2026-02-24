/**
 * Work Mutation with Progress Tracking
 *
 * Combines useWorkMutation with useSubmissionProgress for a seamless
 * experience showing multi-stage visual feedback during work submission.
 *
 * @module hooks/work/useWorkMutationWithProgress
 */

import type { SmartAccountClient } from "permissionless";
import type { Action, Address, WorkDraft } from "../../types/domain";
import { useCallback, useMemo } from "react";
import { useWorkMutation } from "./useWorkMutation";
import { useSubmissionProgress, type SubmissionStage } from "./useSubmissionProgress";

interface UseWorkMutationWithProgressOptions {
  authMode: "wallet" | "passkey" | null;
  smartAccountClient: SmartAccountClient | null;
  gardenAddress: Address | null;
  actionUID: number | null;
  actions: Action[];
  userAddress: Address | null;
}

/**
 * Known wallet submission stages
 */
type WalletStage = "validating" | "uploading" | "confirming" | "syncing" | "complete";

/**
 * Maps wallet submission stages to our unified submission stages
 */
function mapWalletStage(stage: WalletStage | string): SubmissionStage {
  switch (stage) {
    case "validating":
      return "compressing"; // Validation happens during compression prep
    case "uploading":
      return "uploading";
    case "confirming":
      return "confirming";
    case "syncing":
      return "syncing";
    case "complete":
      return "complete";
    default:
      return "idle";
  }
}

/**
 * Hook combining work mutation with visual progress tracking.
 *
 * Provides both the mutation instance and progress state that can be
 * used with the SubmissionProgress component.
 *
 * @example
 * ```tsx
 * function WorkSubmitForm() {
 *   const {
 *     mutation,
 *     progress,
 *     submitWork,
 *   } = useWorkMutationWithProgress({
 *     authMode,
 *     smartAccountClient,
 *     gardenAddress,
 *     actionUID,
 *     actions,
 *     userAddress,
 *   });
 *
 *   return (
 *     <div>
 *       <SubmissionProgress progress={progress} />
 *       <button
 *         onClick={() => submitWork({ draft, images })}
 *         disabled={mutation.isPending}
 *       >
 *         Submit Work
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useWorkMutationWithProgress(options: UseWorkMutationWithProgressOptions) {
  const { authMode, smartAccountClient, gardenAddress, actionUID, actions, userAddress } = options;

  const {
    progress,
    setStage,
    setStageProgress,
    setError,
    reset: resetProgress,
    isInProgress,
  } = useSubmissionProgress();

  const mutation = useWorkMutation({
    authMode,
    smartAccountClient,
    gardenAddress,
    actionUID,
    actions,
    userAddress,
  });

  /**
   * Submit work with progress tracking
   * Wraps the mutation with progress state management
   */
  const submitWork = useCallback(
    async ({ draft, images }: { draft: WorkDraft; images: File[] }) => {
      // Reset progress for new submission
      resetProgress();

      // Start with compressing stage
      setStage("compressing", {
        totalFiles: images.length,
        message: `Compressing ${images.length} image${images.length !== 1 ? "s" : ""}...`,
      });

      try {
        const result = await mutation.mutateAsync({ draft, images });

        // Mark complete on success
        setStage("complete");

        return result;
      } catch (error) {
        // Set error state
        const errorMessage = error instanceof Error ? error.message : "Submission failed";
        setError(errorMessage);
        throw error;
      }
    },
    [mutation, resetProgress, setStage, setError]
  );

  /**
   * Update progress from external source (e.g., wallet submission callback)
   */
  const updateProgress = useCallback(
    (stage: string) => {
      const mappedStage = mapWalletStage(stage);
      setStage(mappedStage);
    },
    [setStage]
  );

  /**
   * Reset both mutation and progress state
   */
  const reset = useCallback(() => {
    mutation.reset();
    resetProgress();
  }, [mutation, resetProgress]);

  return useMemo(
    () => ({
      // Mutation instance
      mutation,
      // Progress state (for SubmissionProgress component)
      progress,
      // Progress controls
      setStage,
      setStageProgress,
      updateProgress,
      // Convenience methods
      submitWork,
      reset,
      // State flags
      isInProgress,
      isPending: mutation.isPending,
      isSuccess: mutation.isSuccess,
      isError: mutation.isError,
      error: mutation.error,
    }),
    [
      mutation,
      progress,
      setStage,
      setStageProgress,
      updateProgress,
      submitWork,
      reset,
      isInProgress,
    ]
  );
}

export type UseWorkMutationWithProgressReturn = ReturnType<typeof useWorkMutationWithProgress>;
