import type { DraftWithImages } from "@green-goods/shared/hooks";
import { cn, formatRelativeTime } from "@green-goods/shared/utils";
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
  const imageCount = draft.images.length;
  const thumbUrl = draft.thumbnailUrl;

  // Determine step progress
  const stepProgress = getStepProgress(draft.firstIncompleteStep);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <button
      onClick={onResume}
      type="button"
      className={cn(
        "flex items-stretch gap-0 border border-warning-light rounded-lg overflow-hidden transition-all duration-300 cursor-pointer bg-warning-lighter/50 w-full text-left tap-feedback hover:border-warning-base/40 hover:bg-warning-lighter",
        className
      )}
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
      <div className="flex-1 min-w-0 pl-2 pr-3 py-3">
        {/* Title row */}
        <div className="flex items-start justify-between">
          <h4 className="font-medium text-sm text-text-strong-950 truncate pr-2">
            {actionTitle ||
              intl.formatMessage({ id: "app.draft.untitled", defaultMessage: "Untitled Draft" })}
          </h4>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 bg-warning-lighter text-warning-dark border-warning-light">
            {intl.formatMessage({ id: "app.draft.status", defaultMessage: "Draft" })}
          </span>
        </div>

        {/* Subtitle */}
        <div className="mt-0.5 text-xs text-text-sub-600 truncate">
          {gardenName && (
            <>
              {gardenName}
              <span className="mx-1">•</span>
            </>
          )}
          {timeAgo}
        </div>

        {/* Meta / Tags */}
        <div className="mt-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
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

          {/* Delete button */}
          <button
            type="button"
            onClick={handleDelete}
            className="p-1.5 rounded-full text-text-soft-400 hover:text-error-base hover:bg-error-lighter transition-colors"
            aria-label={intl.formatMessage({
              id: "app.draft.delete",
              defaultMessage: "Delete draft",
            })}
          >
            <RiDeleteBinLine className="w-4 h-4" />
          </button>
        </div>
      </div>
    </button>
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

export default DraftCard;
