import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../../../utils/styles/cn";
import { formatRelativeTime } from "../../../utils/time";
import { getStatusColors } from "../../StatusBadge";
import { ImageWithFallback } from "../../Display/ImageWithFallback";
import { RiCloseLine, RiImageLine } from "@remixicon/react";

const workCardVariants = tv({
  base: "@container flex w-full flex-col overflow-hidden rounded-lg border border-stroke-soft-200 bg-bg-white text-left transition-all duration-300 sm:flex-row",
  variants: {
    variant: {
      compact: "",
      detailed: "",
      auto: "",
    },
    interactive: {
      true: "cursor-pointer hover:shadow-md active:brightness-98",
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
  mediaPreviewAlt?: string;
  closePreview?: string;
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
  mediaPreviewAlt: "Work media preview",
  closePreview: "Close preview",
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
  const labels = {
    ...defaultLabels,
    ...labelsProp,
    status: { ...defaultLabels.status, ...labelsProp?.status },
  };

  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);

  const timeAgo = formatRelativeTime(work.createdAt);
  const thumbUrl = work.mediaPreview?.[0];
  const displayStatus = labels.status[work.status] ?? work.status;
  const statusColors = getStatusColors(work.status).combined;
  const hasFeedback = Boolean(work.feedback && work.feedback.trim().length > 0);
  const hasError = Boolean(work.error);
  const mediaCount = work.imageCount ?? work.mediaPreview?.length ?? 0;
  const canOpenPreview = Boolean(thumbUrl) && !interactive;

  React.useEffect(() => {
    if (!isPreviewOpen) return;

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPreviewOpen(false);
      }
    };

    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("keydown", onEscape);
    };
  }, [isPreviewOpen]);

  const Wrapper = interactive ? "button" : "div";
  const wrapperProps = interactive ? { onClick, type: "button" as const } : {};

  return (
    <>
      <Wrapper
        className={cn(workCardVariants({ variant, interactive }), className)}
        {...wrapperProps}
      >
        <div className="relative w-full overflow-hidden bg-bg-weak-50 aspect-video sm:w-56 sm:flex-shrink-0">
          {thumbUrl ? (
            canOpenPreview ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsPreviewOpen(true);
                }}
                className="h-full w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base/50"
                aria-label={labels.mediaPreviewAlt}
              >
                <ImageWithFallback
                  src={thumbUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  fallbackClassName="h-full w-full"
                />
              </button>
            ) : (
              <ImageWithFallback
                src={thumbUrl}
                alt=""
                className="h-full w-full object-cover"
                fallbackClassName="h-full w-full"
              />
            )
          ) : (
            <div className="flex h-full w-full items-center justify-center text-text-soft-400">
              <RiImageLine className="h-6 w-6" />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col px-3 py-3">
          <div className="flex items-start justify-between gap-2">
            <h4 className="truncate pr-2 text-sm font-medium text-text-strong-950">
              {work.title || labels.untitledWork}
            </h4>
            <span
              className={cn(
                "flex-shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
                statusColors
              )}
            >
              {displayStatus}
            </span>
          </div>

          <div className="mt-0.5 truncate text-xs text-text-sub-600">
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

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {showMediaCount && mediaCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-information-light bg-information-lighter px-1.5 py-0.5 text-information-dark">
                <RiImageLine className="h-3 w-3" /> {mediaCount}
              </span>
            )}
            {showErrorBadge && hasError && (
              <span className="inline-flex items-center gap-1 rounded-full border border-error-light bg-error-lighter px-1.5 py-0.5 text-error-dark">
                {labels.error}
              </span>
            )}
            {showRetryBadge && work.retryCount && work.retryCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-warning-light bg-warning-lighter px-1.5 py-0.5 text-warning-dark">
                ↻ {work.retryCount}
              </span>
            )}
            {showFeedbackBadge && hasFeedback && (
              <span className="inline-flex items-center gap-1 rounded-full border border-feature-light bg-feature-lighter px-1.5 py-0.5 text-feature-dark">
                {labels.feedback}
              </span>
            )}
            {badges?.map((badge, index) => (
              <React.Fragment key={index}>{badge}</React.Fragment>
            ))}
            {renderActions?.()}
          </div>
        </div>
      </Wrapper>

      {isPreviewOpen && thumbUrl ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-static-black/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setIsPreviewOpen(false)}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIsPreviewOpen(false);
            }}
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-bg-white/10 text-static-white transition hover:bg-bg-white/20"
            aria-label={labels.closePreview}
          >
            <RiCloseLine className="h-5 w-5" />
          </button>
          <img
            src={thumbUrl}
            alt={work.title || labels.mediaPreviewAlt}
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            onClick={(event) => {
              event.stopPropagation();
            }}
          />
        </div>
      ) : null}
    </>
  );
};

export { workCardVariants };
