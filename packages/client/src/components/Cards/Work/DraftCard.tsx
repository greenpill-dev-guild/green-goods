import { IconButton } from "@green-goods/shared/components/IconButton";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { useDraftThumbnail, type DraftWithImages } from "@green-goods/shared/hooks/work/useDrafts";
import { formatRelativeTime } from "@green-goods/shared/utils/relativeTime";
import { RiDeleteBinLine, RiDraftLine, RiImageLine } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";
import { ImageWithFallback } from "@/components/Display";

export interface DraftCardProps {
  draft: DraftWithImages;
  actionTitle?: string;
  gardenName?: string;
  className?: string;
  onResume: () => void;
  onDelete: () => void;
}

/**
 * Card component for displaying work drafts.
 * Shows thumbnail, action/garden info, image count, and last updated time.
 * Provides Continue and Delete actions.
 */
export const DraftCard: React.FC<DraftCardProps> = ({
  draft,
  actionTitle,
  gardenName,
  className,
  onResume,
  onDelete,
}) => {
  const intl = useIntl();
  const timeAgo = formatRelativeTime(draft.updatedAt);
  const imageCount = draft.attachmentCount ?? draft.images.length;
  const thumbnail = useDraftThumbnail(draft);
  const thumbUrl = draft.thumbnailUrl ?? thumbnail.url;

  // Determine step progress
  const stepProgress = getStepProgress(draft.firstIncompleteStep);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <div
      ref={thumbnail.ref}
      className={cn(
        "relative flex h-22 w-full items-stretch overflow-hidden rounded-lg border border-stroke-soft-200 bg-bg-white text-left transition-all duration-[var(--spring-spatial-duration)] ease-[var(--spring-spatial-easing)] hover:shadow-md active:brightness-98",
        className
      )}
    >
      <button
        onClick={onResume}
        type="button"
        data-pressable="card"
        className="flex min-w-0 flex-1 cursor-pointer items-stretch gap-0 text-left focus:outline-none focus-visible:shadow-button-primary-focus"
      >
        {/* Media thumbnail: a fixed square the photo can't resize, same as work cards (DL-019) */}
        <div className="relative h-full aspect-square flex-shrink-0 overflow-hidden bg-bg-weak-50">
          {thumbUrl ? (
            <ImageWithFallback
              src={thumbUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              fallbackClassName="absolute inset-0 h-full w-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-soft-400">
              <RiDraftLine className="w-6 h-6" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 overflow-hidden px-3 py-2 pr-16">
          <div className="flex min-w-0 items-start">
            <h4
              className="min-w-0 flex-1 truncate text-label-md font-medium text-text-strong-950"
              title={
                actionTitle ||
                intl.formatMessage({ id: "app.draft.untitled", defaultMessage: "Untitled Draft" })
              }
            >
              {actionTitle ||
                intl.formatMessage({ id: "app.draft.untitled", defaultMessage: "Untitled Draft" })}
            </h4>
          </div>

          {/* Subtitle */}
          <div
            className="mt-0.5 text-xs text-text-sub-600 truncate"
            title={[gardenName, timeAgo].filter(Boolean).join(" • ")}
          >
            {gardenName && (
              <>
                {gardenName}
                <span className="mx-1">•</span>
              </>
            )}
            {timeAgo}
          </div>

          <div className="mt-1 flex min-w-0 items-center gap-1 truncate text-xs text-text-sub-600">
            <span className="shrink-0">
              {intl.formatMessage(
                { id: "app.draft.stepProgress", defaultMessage: "Step {step}/4" },
                { step: stepProgress }
              )}
            </span>
            {imageCount > 0 && (
              <span
                className="min-w-0 truncate"
                aria-label={intl.formatMessage(
                  {
                    id: "app.draft.photoCount",
                    defaultMessage: "{count, plural, one {# photo} other {# photos}}",
                  },
                  { count: imageCount }
                )}
              >
                <span aria-hidden="true" className="mx-0.5">
                  ·
                </span>
                <RiImageLine className="inline-block h-3 w-3" aria-hidden="true" /> {imageCount}
              </span>
            )}
          </div>
        </div>
      </button>

      <span className="absolute right-2 top-2 rounded-full border border-warning-light bg-warning-lighter px-2 py-0.5 text-xs font-medium text-warning-dark">
        {intl.formatMessage({ id: "app.draft.status", defaultMessage: "Draft" })}
      </span>

      {/* Delete button — vertically centered, 44x44 px tap target separated
          from the Resume button content. */}
      <IconButton
        onClick={handleDelete}
        className="absolute bottom-1 right-2"
        aria-label={intl.formatMessage({
          id: "app.draft.delete",
          defaultMessage: "Delete Draft",
        })}
        icon={<RiDeleteBinLine aria-hidden="true" />}
      />
    </div>
  );
};

/**
 * Get step number (1-4) based on first incomplete step
 */
function getStepProgress(step: string): number {
  switch (step) {
    case "intro":
      return 1;
    case "media":
      return 2;
    case "details":
      return 3;
    case "review":
      return 4;
    default:
      return 1;
  }
}
