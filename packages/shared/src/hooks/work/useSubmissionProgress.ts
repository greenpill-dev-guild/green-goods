/**
 * Submission Progress Hook
 *
 * Tracks multi-stage progress for work submissions with detailed stage information.
 * Provides real-time feedback during:
 * - Image compression
 * - IPFS uploads
 * - Wallet confirmation
 * - Blockchain sync
 *
 * @module hooks/work/useSubmissionProgress
 */

import { useCallback, useRef, useState } from "react";

/**
 * Submission stages in order of execution
 */
export type SubmissionStage =
  | "idle"
  | "compressing"
  | "uploading"
  | "confirming"
  | "syncing"
  | "complete"
  | "error";

/**
 * Detailed progress state for a submission
 */
export interface SubmissionProgressState {
  /** Current stage of submission */
  stage: SubmissionStage;
  /** Progress percentage (0-100) for current stage */
  stageProgress: number;
  /** Overall progress percentage (0-100) across all stages */
  overallProgress: number;
  /** Human-readable message for current stage */
  message: string;
  /** Number of files being processed (for compression/upload stages) */
  totalFiles?: number;
  /** Number of files completed in current stage */
  completedFiles?: number;
  /** Error message if stage is 'error' */
  error?: string;
  /** Timestamp when submission started */
  startedAt?: number;
  /** Estimated time remaining in ms */
  estimatedTimeRemaining?: number;
}

/**
 * Stage weights for calculating overall progress
 * Total should equal 100
 */
const STAGE_WEIGHTS = {
  idle: 0,
  compressing: 15,
  uploading: 35,
  confirming: 35,
  syncing: 15,
  complete: 0,
  error: 0,
} as const satisfies Record<SubmissionStage, number>;

/**
 * Cumulative weights for calculating overall progress at each stage
 */
const CUMULATIVE_WEIGHTS = {
  idle: 0,
  compressing: 0,
  uploading: 15,
  confirming: 50,
  syncing: 85,
  complete: 100,
  error: 0,
} as const satisfies Record<SubmissionStage, number>;

/**
 * Human-readable messages for each stage
 */
const STAGE_MESSAGES: Record<SubmissionStage, string> = {
  idle: "Ready to submit",
  compressing: "Compressing images...",
  uploading: "Uploading to IPFS...",
  confirming: "Confirm in your wallet...",
  syncing: "Syncing with blockchain...",
  complete: "Submission complete!",
  error: "Submission failed",
};

/**
 * Initial progress state
 */
const INITIAL_STATE: SubmissionProgressState = {
  stage: "idle",
  stageProgress: 0,
  overallProgress: 0,
  message: STAGE_MESSAGES.idle,
};

/**
 * Hook for tracking work submission progress across multiple stages.
 *
 * @returns Progress state and control functions
 *
 * @example
 * ```tsx
 * function SubmitButton() {
 *   const { progress, setStage, setStageProgress, reset } = useSubmissionProgress();
 *
 *   const handleSubmit = async () => {
 *     setStage('compressing', { totalFiles: 3 });
 *     await compressImages(files, (p) => setStageProgress(p));
 *
 *     setStage('uploading');
 *     await uploadToIPFS(files, (p) => setStageProgress(p));
 *
 *     setStage('confirming');
 *     await submitTransaction();
 *
 *     setStage('syncing');
 *     await pollForConfirmation();
 *
 *     setStage('complete');
 *   };
 *
 *   return (
 *     <div>
 *       <SubmissionProgress progress={progress} />
 *       <button onClick={handleSubmit}>Submit</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSubmissionProgress() {
  const [progress, setProgress] = useState<SubmissionProgressState>(INITIAL_STATE);
  const startTimeRef = useRef<number | null>(null);

  /**
   * Calculate overall progress based on stage and stage progress
   */
  const calculateOverallProgress = useCallback(
    (stage: SubmissionStage, stageProgress: number): number => {
      const baseProgress = CUMULATIVE_WEIGHTS[stage];
      const stageWeight = STAGE_WEIGHTS[stage];
      const stageContribution = (stageProgress / 100) * stageWeight;
      return Math.min(Math.round(baseProgress + stageContribution), 100);
    },
    []
  );

  /**
   * Set the current submission stage
   */
  const setStage = useCallback(
    (
      stage: SubmissionStage,
      options?: {
        totalFiles?: number;
        error?: string;
        message?: string;
      }
    ) => {
      // Track start time on first non-idle stage
      if (stage !== "idle" && !startTimeRef.current) {
        startTimeRef.current = Date.now();
      }

      // Reset start time on complete or error
      if (stage === "complete" || stage === "error" || stage === "idle") {
        startTimeRef.current = null;
      }

      setProgress((prev) => ({
        ...prev,
        stage,
        stageProgress: 0,
        overallProgress: calculateOverallProgress(stage, 0),
        message: options?.message || STAGE_MESSAGES[stage],
        totalFiles: options?.totalFiles ?? prev.totalFiles,
        completedFiles: 0,
        error: options?.error,
        startedAt: startTimeRef.current ?? undefined,
      }));
    },
    [calculateOverallProgress]
  );

  /**
   * Update progress within the current stage
   */
  const setStageProgress = useCallback(
    (
      stageProgress: number,
      options?: {
        completedFiles?: number;
        message?: string;
      }
    ) => {
      setProgress((prev) => {
        const clampedProgress = Math.min(Math.max(stageProgress, 0), 100);
        return {
          ...prev,
          stageProgress: clampedProgress,
          overallProgress: calculateOverallProgress(prev.stage, clampedProgress),
          completedFiles: options?.completedFiles ?? prev.completedFiles,
          message: options?.message || prev.message,
        };
      });
    },
    [calculateOverallProgress]
  );

  /**
   * Set error state with message
   */
  const setError = useCallback((error: string) => {
    startTimeRef.current = null;
    setProgress((prev) => ({
      ...prev,
      stage: "error",
      error,
      message: error,
    }));
  }, []);

  /**
   * Reset progress to initial state
   */
  const reset = useCallback(() => {
    startTimeRef.current = null;
    setProgress(INITIAL_STATE);
  }, []);

  /**
   * Check if submission is in progress
   */
  const isInProgress =
    progress.stage !== "idle" && progress.stage !== "complete" && progress.stage !== "error";

  return {
    progress,
    setStage,
    setStageProgress,
    setError,
    reset,
    isInProgress,
  };
}

export type UseSubmissionProgressReturn = ReturnType<typeof useSubmissionProgress>;
