import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../../../utils/styles/cn";
import { formatRelativeTime } from "../../../utils/time";
import { getStatusColors } from "../../StatusBadge";
import { ImageWithFallback } from "../../Display/ImageWithFallback";
import { RiImageLine } from "@remixicon/react";
import { cardShellVariants } from "../../Tokens/foundation";

const workCardVariants = tv({
  base: "@container flex items-stretch gap-0 overflow-hidden w-full text-left rounded-2xl",
  variants: {
    variant: {
      compact: "",
      detailed: "",
      auto: "",
    },
    interactive: {
      true: cardShellVariants({ interactive: true }),
      false: "",
    },
  },
  defaultVariants: {
    variant: "auto",
    interactive: true,
  },
});

export type WorkCardVariantProps = VariantProps<typeof workCardVariants>;

export type WorkStatus = "approved" | "rejected" | "pending" | "syncing" | "failed";

export interface WorkCardData {
  id: string;
  title: string;
  status: WorkStatus;
  createdAt: number;
  mediaPreview?: string[];
  gardenerAddress?: string;
  gardenerDisplayName?: string;
  gardenName?: string;
  gardenAddress?: string;
  description?: string;
  imageCount?: number;
  feedback?: string;
  error?: string;
  retryCount?: number;
}

/** Translatable labels for the WorkCard component */
export interface WorkCardLabels {
  /** Default title when work.title is empty */
  untitledWork?: string;
  /** Label for error badge */
  error?: string;
  /** Label for feedback badge */
  feedback?: string;
  /** Status display labels */
  status?: {
    approved?: string;
    rejected?: string;
    pending?: string;
    syncing?: string;
    failed?: string;
  };
}

/** Default English labels */
const defaultLabels: Required<WorkCardLabels> = {
  untitledWork: "Untitled Work",
  error: "Error",
  feedback: "Feedback",
  status: {
    approved: "Approved",
    rejected: "Rejected",
    pending: "Pending",
    syncing: "Syncing",
    failed: "Failed",
  },
};

export interface WorkCardProps extends WorkCardVariantProps {
  work: WorkCardData;
  className?: string;
  onClick?: () => void;
  renderActions?: () => React.ReactNode;
  showGardener?: boolean;
  showMediaCount?: boolean;
  showFeedbackBadge?: boolean;
  showErrorBadge?: boolean;
  showRetryBadge?: boolean;
  badges?: React.ReactNode[];
  /** Translated labels - defaults to English */
  labels?: WorkCardLabels;
}

export const WorkCard: React.FC<WorkCardProps> = ({
  work,
  variant = "auto",
  interactive = true,
  className,
  onClick,
  renderActions,
  showGardener = false,
  showMediaCount = true,
  showFeedbackBadge = false,
  showErrorBadge = false,
  showRetryBadge = false,
  badges,
  labels: labelsProp,
}) => {
  // Merge provided labels with defaults
  const labels = {
    ...defaultLabels,
    ...labelsProp,
    status: { ...defaultLabels.status, ...labelsProp?.status },
  };

  const timeAgo = formatRelativeTime(work.createdAt);
  const thumbUrl = work.mediaPreview?.[0];
  const displayStatus = labels.status[work.status] ?? work.status;
  const statusColors = getStatusColors(work.status).combined;
  const hasFeedback = Boolean(work.feedback && work.feedback.trim().length > 0);
  const hasError = Boolean(work.error);
  const mediaCount = work.imageCount ?? work.mediaPreview?.length ?? 0;

  const Wrapper = interactive ? "button" : "div";
  const wrapperProps = interactive ? { onClick, type: "button" as const } : {};

  return (
    <Wrapper
      className={cn(
        cardShellVariants({ interactive }),
        workCardVariants({ variant, interactive }),
        className
      )}
      {...wrapperProps}
    >
      {/* Media thumbnail - adapts size based on container width */}
      <div className="w-18 @[280px]:w-22 @[400px]:w-26 flex-shrink-0 bg-bg-weak-50 overflow-hidden relative aspect-square">
        {thumbUrl ? (
          <ImageWithFallback
            src={thumbUrl}
            alt=""
            className="w-full h-full object-cover"
            fallbackClassName="w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-soft-400">
            <RiImageLine className="w-6 h-6" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 px-4 py-4 sm:px-5 sm:py-5">
        {/* Title row */}
        <div className="flex items-start justify-between">
          <h4 className="text-label-sm text-text-strong-950 truncate pr-2">
            {work.title || labels.untitledWork}
          </h4>
          <span
            className={cn(
              "text-paragraph-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0",
              statusColors
            )}
          >
            {displayStatus}
          </span>
        </div>

        {/* Subtitle */}
        <div className="mt-0.5 text-paragraph-xs text-text-sub-600 truncate">
          {showGardener && work.gardenerDisplayName && (
            <>
              {work.gardenerDisplayName}
              <span className="mx-1">•</span>
            </>
          )}
          {timeAgo}
          {work.gardenName && (
            <>
              <span className="mx-1">•</span>
              {work.gardenName}
            </>
          )}
        </div>

        {/* Meta / Tags row */}
        <div className="mt-2 flex items-center gap-2 text-paragraph-xs">
          {showMediaCount && mediaCount > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-information-lighter text-information-dark border border-information-light">
              <RiImageLine className="w-3 h-3" /> {mediaCount}
            </span>
          )}
          {showErrorBadge && hasError && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-error-lighter text-error-dark border border-error-light">
              {labels.error}
            </span>
          )}
          {showRetryBadge && work.retryCount && work.retryCount > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-warning-lighter text-warning-dark border border-warning-light">
              ↻ {work.retryCount}
            </span>
          )}
          {showFeedbackBadge && hasFeedback && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-feature-lighter text-feature-dark border border-feature-light">
              {labels.feedback}
            </span>
          )}
          {badges?.map((badge, i) => (
            <React.Fragment key={i}>{badge}</React.Fragment>
          ))}
          {renderActions?.()}
        </div>
      </div>
    </Wrapper>
  );
};

export { workCardVariants };
