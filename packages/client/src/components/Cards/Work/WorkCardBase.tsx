/**
 * WorkCardBase - Shared base component for work cards
 *
 * Provides consistent layout and styling for WorkCard and MinimalWorkCard.
 * Uses container queries for responsive sizing.
 */

import { cn } from "@green-goods/shared/utils";
import { getStatusColors } from "@green-goods/shared/components";
import { RiImageLine } from "@remixicon/react";
import React from "react";
import { ImageWithFallback } from "@/components/Display";

export interface WorkCardBaseProps {
  /** Click handler for the card */
  onClick?: () => void;
  /** Additional class names */
  className?: string;
  /** Thumbnail image URL */
  thumbUrl?: string;
  /** Title text */
  title: string;
  /** Status for the badge */
  status: "approved" | "rejected" | "pending" | "syncing" | "failed";
  /** Subtitle content (rendered as-is) */
  subtitle: React.ReactNode;
  /** Meta/badge content (rendered as-is) */
  meta?: React.ReactNode;
  /** Custom style */
  style?: React.CSSProperties;
}

/**
 * Base card component with shared layout for work cards.
 *
 * @example
 * ```tsx
 * <WorkCardBase
 *   onClick={() => navigate(workUrl)}
 *   thumbUrl={work.media[0]}
 *   title={work.title}
 *   status={work.status}
 *   subtitle={<span>{timeAgo} • {gardenName}</span>}
 *   meta={
 *     <>
 *       <span className="badge-pill-blue">
 *         <RiImageLine className="w-3 h-3" /> 3
 *       </span>
 *     </>
 *   }
 * />
 * ```
 */
export const WorkCardBase: React.FC<WorkCardBaseProps> = ({
  onClick,
  className,
  thumbUrl,
  title,
  status,
  subtitle,
  meta,
  style,
}) => {
  const displayStatus = status.charAt(0).toUpperCase() + status.slice(1);
  const statusColor = getStatusColors(status).combined;

  return (
    <button
      onClick={onClick}
      type="button"
      className={cn(
        // Container query: enables responsive layout based on card width
        "@container flex items-stretch gap-0 border border-stroke-soft-200 rounded-lg overflow-hidden transition-all duration-300 cursor-pointer bg-bg-white-0 w-full text-left tap-feedback",
        className
      )}
      style={style}
    >
      {/* Media thumbnail - adapts size based on container */}
      <div className="w-18 @[280px]:w-22 @[400px]:w-26 flex-shrink-0 bg-bg-weak-50 overflow-hidden relative aspect-square">
        {thumbUrl ? (
          <ImageWithFallback
            src={thumbUrl}
            alt=""
            className="w-full h-full object-cover"
            fallbackClassName="w-22 aspect-square"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-soft-400">
            <RiImageLine className="w-6 h-6" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pl-2 pr-3 py-3">
        {/* Title row */}
        <div className="flex items-start justify-between">
          <h4 className="font-medium text-sm text-text-strong-950 truncate pr-2">{title}</h4>
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 status-transition",
              statusColor
            )}
          >
            {displayStatus}
          </span>
        </div>

        {/* Subtitle */}
        <div className="mt-0.5 text-xs text-text-sub-600 truncate">{subtitle}</div>

        {/* Meta / Tags */}
        {meta && <div className="mt-2 flex items-center gap-2 text-xs">{meta}</div>}
      </div>
    </button>
  );
};
