import { cn, type DraftWithImages, formatRelativeTime } from "@green-goods/shared";
import { RiDeleteBinLine, RiDraftLine, RiImageLine } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";
import { ImageWithFallback } from "@/components/Display";
import { pwaStatusStyles } from "@/styles/pwaStatusStyles";

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
  const imageCount = draft.images.length;
  const thumbUrl = draft.thumbnailUrl;

  // Determine step progress
  const stepProgress = getStepProgress(draft.firstIncompleteStep);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <div
      className={cn(
        "relative flex items-stretch gap-0 overflow-hidden rounded-[var(--radius-lg)] border w-full cursor-pointer text-left tap-feedback transition-[background-color,border-color,box-shadow,transform] duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)] hover:border-warning-base hover:shadow-sm",
        pwaStatusStyles.warning.surface,
        pwaStatusStyles.warning.border,
        className
      )}
    >
      <button
        onClick={onResume}
        type="button"
        className="flex min-w-0 flex-1 items-stretch gap-0 text-left focus:outline-none focus-visible:shadow-button-primary-focus"
      >
        {/* Media thumbnail */}
        <div className="w-22 flex-shrink-0 bg-warning-light overflow-hidden relative aspect-square">
          {thumbUrl ? (
            <ImageWithFallback
              src={thumbUrl}
              alt=""
              className="w-full h-full object-cover"
              fallbackClassName="w-22 aspect-square"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-warning-base">
              <RiDraftLine className="w-6 h-6" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pl-2 pr-14 py-3">
          {/* Title row */}
          <div className="flex items-start justify-between">
            <h4
              className="truncate pr-2 text-label-md font-medium text-text-strong-950"
              title={
                actionTitle ||
                intl.formatMessage({ id: "app.draft.untitled", defaultMessage: "Untitled Draft" })
              }
            >
              {actionTitle ||
                intl.formatMessage({ id: "app.draft.untitled", defaultMessage: "Untitled Draft" })}
            </h4>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 bg-warning-lighter text-warning-dark border-warning-light">
              {intl.formatMessage({ id: "app.draft.status", defaultMessage: "Draft" })}
            </span>
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

          {/* Meta / Tags */}
          <div className="mt-2 flex items-center gap-2 text-xs">
            {imageCount > 0 && (
              <span className="badge-pill-blue">
                <RiImageLine className="w-3 h-3" /> {imageCount}
              </span>
            )}
            <span className="badge-pill-amber">
              {intl.formatMessage(
                { id: "app.draft.stepProgress", defaultMessage: "Step {step}/4" },
                { step: stepProgress }
              )}
            </span>
          </div>
        </div>
      </button>

      {/* Delete button — vertically centered, 44x44 px tap target separated
          from the Resume button content. */}
      <button
        type="button"
        onClick={handleDelete}
        className="absolute top-1/2 right-2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full text-text-soft-400 transition-colors duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] hover:bg-error-lighter hover:text-error-base focus:outline-none focus-visible:shadow-button-primary-focus"
        aria-label={intl.formatMessage({
          id: "app.draft.delete",
          defaultMessage: "Delete draft",
        })}
      >
        <RiDeleteBinLine className="w-4 h-4" />
      </button>
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
