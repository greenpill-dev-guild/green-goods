/**
 * Submission Progress Component
 *
 * Visual progress indicator for multi-stage work submissions.
 * Shows current stage, progress bar, and stage-specific details.
 *
 * @module components/Progress/SubmissionProgress
 */

import React from "react";
import { useIntl } from "react-intl";
import type {
  SubmissionProgressState,
  SubmissionStage,
} from "../../hooks/work/useSubmissionProgress";

/**
 * Stage configuration for visual display
 */
interface StageConfig {
  label: string;
  icon: string;
  color: string;
}

/**
 * Stage configuration for visual display
 * Note: labelKey is the i18n key suffix (e.g., "compressing" -> "app.submission.stage.compressing")
 */
interface StageConfigWithKey extends StageConfig {
  labelKey: string;
}

const STAGE_CONFIG: Record<SubmissionStage, StageConfigWithKey> = {
  idle: { label: "Ready", labelKey: "idle", icon: "○", color: "text-gray-400" },
  compressing: { label: "Compressing", labelKey: "compressing", icon: "◐", color: "text-blue-500" },
  uploading: { label: "Uploading", labelKey: "uploading", icon: "↑", color: "text-indigo-500" },
  confirming: { label: "Confirming", labelKey: "confirming", icon: "⟳", color: "text-amber-500" },
  syncing: { label: "Syncing", labelKey: "syncing", icon: "◉", color: "text-purple-500" },
  complete: { label: "Complete", labelKey: "complete", icon: "✓", color: "text-green-500" },
  error: { label: "Error", labelKey: "error", icon: "✕", color: "text-red-500" },
};

const ORDERED_STAGES = ["compressing", "uploading", "confirming", "syncing"] as const;
type OrderedStage = (typeof ORDERED_STAGES)[number];

/**
 * Type guard to check if a stage is an ordered (non-terminal) stage
 */
function isOrderedStage(stage: SubmissionStage): stage is OrderedStage {
  return (ORDERED_STAGES as readonly string[]).includes(stage);
}

interface SubmissionProgressProps {
  /** Current progress state from useSubmissionProgress */
  progress: SubmissionProgressState;
  /** Whether to show compact version (single line) */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Compact progress indicator showing only current stage
 */
function CompactProgress({ progress }: { progress: SubmissionProgressState }) {
  const config = STAGE_CONFIG[progress.stage];

  if (progress.stage === "idle") {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`animate-pulse ${config.color}`}>{config.icon}</span>
      <span className="text-gray-600 dark:text-gray-300">{progress.message}</span>
      {progress.stage !== "complete" && progress.stage !== "error" && (
        <span className="text-gray-400">{progress.overallProgress}%</span>
      )}
    </div>
  );
}

/**
 * Get the i18n key for a stage status
 */
function getStatusKey(isCurrent: boolean, isComplete: boolean, isPending: boolean): string {
  if (isCurrent) return "app.submission.status.inProgress";
  if (isComplete) return "app.submission.status.completed";
  if (isPending) return "app.submission.status.pending";
  return "app.submission.status.error";
}

/**
 * Stage indicator dot for the progress stepper
 */
function StageDot({
  stage,
  currentStage,
  stageProgress,
  intl,
}: {
  stage: SubmissionStage;
  currentStage: SubmissionStage;
  stageProgress: number;
  intl: ReturnType<typeof useIntl>;
}) {
  const config = STAGE_CONFIG[stage];

  // Safe index computation - only use indices for ordered stages
  const stageIsOrdered = isOrderedStage(stage);
  const currentIsOrdered = isOrderedStage(currentStage);

  // Compute indices only when both stages are ordered
  const stageIndex = stageIsOrdered ? ORDERED_STAGES.indexOf(stage) : -1;
  const currentIndex = currentIsOrdered ? ORDERED_STAGES.indexOf(currentStage) : -1;

  // Determine state with explicit handling of terminal states
  // Note: When currentIsOrdered is true, currentStage is narrowed to OrderedStage,
  // so we check for "error" before the ordered-stage checks
  const isError = currentStage === "error";
  const isComplete =
    currentStage === "complete" ||
    (stageIsOrdered && currentIsOrdered && currentIndex > stageIndex);
  const isCurrent = !isError && stageIsOrdered && currentIsOrdered && currentIndex === stageIndex;
  const isPending =
    !isComplete && !isCurrent && stageIsOrdered && currentIsOrdered && currentIndex < stageIndex;

  let bgColor = "bg-gray-200 dark:bg-gray-700";
  let textColor = "text-gray-400";
  let icon = config.icon;

  if (isComplete) {
    bgColor = "bg-green-500";
    textColor = "text-white";
    icon = "✓";
  } else if (isCurrent) {
    bgColor = "bg-blue-500";
    textColor = "text-white";
  } else if (isError) {
    bgColor = "bg-red-500";
    textColor = "text-white";
    icon = "✕";
  }

  const statusKey = getStatusKey(isCurrent, isComplete, isPending);
  const statusText = intl.formatMessage({ id: statusKey });

  // Use localized label for aria-label
  const localizedLabel = intl.formatMessage({
    id: `app.submission.stage.${config.labelKey}`,
  });

  return (
    <div className="flex flex-col items-center">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={isCurrent ? stageProgress : isComplete ? 100 : 0}
        aria-label={`${localizedLabel}: ${statusText}`}
        aria-current={isCurrent ? "step" : undefined}
        className={`
          w-8 h-8 rounded-full flex items-center justify-center
          ${bgColor} ${textColor}
          ${isCurrent ? "animate-pulse ring-2 ring-blue-300 ring-offset-2" : ""}
          transition-all duration-300
        `}
      >
        {icon}
      </div>
      <span
        className={`
          mt-1 text-xs font-medium
          ${isCurrent ? "text-blue-600 dark:text-blue-400" : ""}
          ${isComplete ? "text-green-600 dark:text-green-400" : ""}
          ${isPending ? "text-gray-400" : ""}
          ${isError ? "text-red-600 dark:text-red-400" : ""}
        `}
      >
        {localizedLabel}
      </span>
      {isCurrent && stageProgress > 0 && stageProgress < 100 && (
        <span className="text-[10px] text-gray-500">{stageProgress}%</span>
      )}
    </div>
  );
}

/**
 * Connector line between stage dots
 */
function StageConnector({
  stage,
  currentStage,
}: {
  stage: SubmissionStage;
  currentStage: SubmissionStage;
}) {
  // Safe index computation - only use indices for ordered stages
  const stageIsOrdered = isOrderedStage(stage);
  const currentIsOrdered = isOrderedStage(currentStage);

  const stageIndex = stageIsOrdered ? ORDERED_STAGES.indexOf(stage) : -1;
  const currentIndex = currentIsOrdered ? ORDERED_STAGES.indexOf(currentStage) : -1;

  // Complete if current stage is "complete" or we're past this stage
  const isComplete =
    currentStage === "complete" ||
    (stageIsOrdered && currentIsOrdered && currentIndex > stageIndex);

  return (
    <div
      className={`
        flex-1 h-0.5 mx-1 mt-4
        transition-all duration-500
        ${isComplete ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"}
      `}
    />
  );
}

/**
 * Full progress indicator with all stages
 */
function FullProgress({
  progress,
  className,
}: {
  progress: SubmissionProgressState;
  className?: string;
}) {
  const intl = useIntl();
  const config = STAGE_CONFIG[progress.stage];

  if (progress.stage === "idle") {
    return null;
  }

  const errorSuffix =
    progress.stage === "error" ? intl.formatMessage({ id: "app.submission.errorSuffix" }) : "";

  return (
    <div
      className={`rounded-lg bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700 ${className || ""}`}
    >
      {/* Stage stepper */}
      <div className="flex items-start justify-between mb-4">
        {ORDERED_STAGES.map((stage, index) => (
          <React.Fragment key={stage}>
            <StageDot
              stage={stage}
              currentStage={progress.stage}
              stageProgress={progress.stageProgress}
              intl={intl}
            />
            {index < ORDERED_STAGES.length - 1 && (
              <StageConnector stage={stage} currentStage={progress.stage} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Overall progress bar */}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.overallProgress}
        aria-label={intl.formatMessage(
          { id: "app.submission.overallProgress" },
          { percent: progress.overallProgress, stageSuffix: errorSuffix }
        )}
        className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-3"
      >
        <div
          className={`
            h-full transition-all duration-300 ease-out rounded-full
            ${progress.stage === "error" ? "bg-red-500" : "bg-gradient-to-r from-blue-500 to-green-500"}
          `}
          style={{ width: `${progress.overallProgress}%` }}
        />
      </div>

      {/* Status message */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`${config.color} ${progress.stage !== "complete" && progress.stage !== "error" ? "animate-pulse" : ""}`}
          >
            {config.icon}
          </span>
          <span className="text-sm text-gray-700 dark:text-gray-300">{progress.message}</span>
        </div>

        {/* File progress if applicable */}
        {progress.totalFiles !== undefined && progress.completedFiles !== undefined && (
          <span className="text-xs text-gray-500">
            {progress.completedFiles}/{progress.totalFiles} files
          </span>
        )}
      </div>

      {/* Error message */}
      {progress.stage === "error" && progress.error && (
        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600 dark:text-red-400">
          {progress.error}
        </div>
      )}
    </div>
  );
}

/**
 * Submission Progress Indicator
 *
 * Displays multi-stage progress for work submissions.
 * Supports compact (single line) and full (stepper) modes.
 *
 * @example
 * ```tsx
 * function WorkSubmitForm() {
 *   const { progress, ... } = useSubmissionProgress();
 *
 *   return (
 *     <div>
 *       <SubmissionProgress progress={progress} />
 *       // ... form fields
 *     </div>
 *   );
 * }
 * ```
 */
export function SubmissionProgress({
  progress,
  compact = false,
  className,
}: SubmissionProgressProps) {
  if (compact) {
    return <CompactProgress progress={progress} />;
  }

  return <FullProgress progress={progress} className={className} />;
}
