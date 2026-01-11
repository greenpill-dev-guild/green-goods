import { useEnsName } from "@green-goods/shared/hooks";
import {
  cn,
  formatAddress,
  formatFileSize,
  formatRelativeTime,
  truncateAddress,
} from "@green-goods/shared/utils";
import { getStatusColors, StatusBadge } from "@green-goods/shared/components";
import type { Work } from "@green-goods/shared";
import { RiFileTextLine, RiImageLine, RiRefreshLine } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";
import { ImageWithFallback } from "@/components/Display";

export interface WorkCardItem {
  id: string;
  type: "work" | "work_approval";
  title: string;
  description?: string;
  gardenId: string;
  gardenName?: string;
  status: "approved" | "rejected" | "pending" | "syncing" | "failed";
  createdAt: number;
  lastAttempt?: number;
  retryCount: number;
  error?: string;
  size: number;
  images?: {
    count: number;
    totalSize: number;
  };
  mediaPreview?: string[];
}

export interface WorkCardProps {
  work: WorkCardItem;
  className?: string;
  variant?: "full" | "minimal";
  onClick?: () => void;
}

export interface MinimalWorkCardProps {
  work: Work;
  onClick: () => void;
  className?: string;
  actionTitle?: string;
  showGardenInfo?: boolean;
  badges?: React.ReactNode[];
  style?: React.CSSProperties;
  /** Variant controls subtitle content: "compact" (default) shows time only, "detailed" shows gardener + time */
  variant?: "compact" | "detailed";
}

// Type for media items which can be strings, objects with url, or File objects
type MediaItem = string | { url: string } | { file: File } | File;

// Use shared getStatusColors utility for inline status styling
const getStatusColor = (status: string) => {
  return getStatusColors(status as "approved" | "rejected" | "pending" | "syncing" | "failed")
    .combined;
};

export const WorkCard: React.FC<WorkCardProps> = ({
  work,
  className,
  variant = "full",
  onClick,
}) => {
  const intl = useIntl();
  const displayStatus = work.status.charAt(0).toUpperCase() + work.status.slice(1);
  const timeAgo = formatRelativeTime(work.createdAt);
  const thumbUrl = work.mediaPreview?.[0];

  return (
    <button
      onClick={onClick}
      type="button"
      className={cn(
        // Container query: enables responsive layout based on card width
        "@container flex items-stretch gap-0 border border-stroke-soft-200 rounded-lg overflow-hidden transition-all duration-300 cursor-pointer bg-bg-white-0 w-full text-left tap-feedback",
        className
      )}
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
          <h4 className="font-medium text-sm text-text-strong-950 truncate pr-2">{work.title}</h4>
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 status-transition",
              getStatusColor(work.status)
            )}
          >
            {displayStatus}
          </span>
        </div>

        {/* Subtitle */}
        <div className="mt-0.5 text-xs text-text-sub-600 truncate">
          {timeAgo}
          <span className="mx-1">•</span>
          {work.gardenName || truncateAddress(work.gardenId)}
        </div>

        {/* Meta / Tags */}
        <div className="mt-2 flex items-center gap-2 text-xs">
          {work.images && work.images.count > 0 && (
            <span className="badge-pill-blue">
              <RiImageLine className="w-3 h-3" /> {work.images.count}
            </span>
          )}
          {work.error && (
            <span className="badge-pill-red">
              {intl.formatMessage({ id: "app.workCard.error", defaultMessage: "Error" })}
            </span>
          )}
          {work.retryCount > 0 && (
            <span className="badge-pill-amber">
              <RiRefreshLine className="w-3 h-3" /> {work.retryCount}
            </span>
          )}
          {variant === "full" && work.size > 0 && (
            <span className="text-text-sub-600">{formatFileSize(work.size)}</span>
          )}
        </div>
      </div>
    </button>
  );
};

// Compact work card for list views
export const MinimalWorkCard: React.FC<MinimalWorkCardProps> = ({
  work,
  onClick,
  className,
  actionTitle,
  showGardenInfo = false,
  badges,
  variant = "compact",
}) => {
  const intl = useIntl();
  // ENS name resolution for gardener and garden addresses
  const { data: gardenerEnsName } = useEnsName(
    variant === "detailed" ? work.gardenerAddress : null,
    { enabled: variant === "detailed" }
  );
  const { data: gardenEnsName } = useEnsName(showGardenInfo ? work.gardenAddress : null, {
    enabled: Boolean(showGardenInfo && work.gardenAddress),
  });
  const displayStatus = work.status
    ? work.status.charAt(0).toUpperCase() + work.status.slice(1)
    : "Pending";

  // Resolve thumbnail from media entry (supports string URL, {url}, or File)
  const initialCandidate =
    Array.isArray(work.media) && work.media.length > 0 ? work.media[0] : undefined;
  const [thumbUrl, setThumbUrl] = React.useState<string | undefined>(
    typeof initialCandidate === "string" ? initialCandidate : undefined
  );

  React.useEffect(() => {
    let createdUrl: string | undefined;
    try {
      const mediaArray = work.media as MediaItem[] | undefined;
      const m0: MediaItem | undefined =
        Array.isArray(mediaArray) && mediaArray.length > 0 ? mediaArray[0] : undefined;

      let url: string | undefined;
      if (typeof m0 === "string") {
        url = m0;
      } else if (m0 && typeof m0 === "object") {
        if ("url" in m0 && typeof m0.url === "string") {
          url = m0.url;
        } else if ("file" in m0 && m0.file instanceof File) {
          createdUrl = URL.createObjectURL(m0.file);
          url = createdUrl;
        } else if (m0 instanceof File) {
          createdUrl = URL.createObjectURL(m0);
          url = createdUrl;
        }
      }

      setThumbUrl(url);
    } catch (error) {
      console.error("[MinimalWorkCard] Error processing media:", error);
      setThumbUrl(undefined);
    }
    return () => {
      if (createdUrl) {
        try {
          URL.revokeObjectURL(createdUrl);
        } catch {}
      }
    };
  }, [work.media, work.id]);
  const hasFeedback = Boolean(work.feedback && work.feedback.trim().length > 0);
  const mediaCount = Array.isArray(work.media) ? work.media.length : 0;
  const action = actionTitle || work.title;
  const timeAgo = formatRelativeTime(work.createdAt);
  const gardenerName = formatAddress(work.gardenerAddress, { ensName: gardenerEnsName });

  return (
    <button
      onClick={onClick}
      type="button"
      className={cn(
        // Container query: enables responsive layout based on card width
        "@container flex items-stretch gap-0 border border-stroke-soft-200 rounded-lg overflow-hidden transition-all duration-300 cursor-pointer bg-bg-white-0 w-full text-left tap-feedback",
        className
      )}
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
          <h4 className="font-medium text-sm text-text-strong-950 truncate pr-2">{action}</h4>
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 status-transition",
              getStatusColor(work.status)
            )}
          >
            {displayStatus}
          </span>
        </div>

        {/* Subtitle */}
        <div className="mt-0.5 text-xs text-text-sub-600 truncate">
          {variant === "detailed" ? (
            <>
              {gardenerName}
              <span className="mx-1">•</span>
              {timeAgo}
            </>
          ) : (
            <>
              {timeAgo}
              {showGardenInfo && gardenEnsName && (
                <>
                  <span className="mx-1">•</span>
                  {gardenEnsName}
                </>
              )}
            </>
          )}
        </div>

        {/* Meta / Tags */}
        <div className="mt-2 flex items-center gap-2 text-xs">
          {mediaCount > 0 && (
            <span className="badge-pill-blue">
              <RiImageLine className="w-3 h-3" /> {mediaCount}
            </span>
          )}
          {hasFeedback && (
            <span className="badge-pill-purple">
              <RiFileTextLine className="w-3 h-3" />
              {intl.formatMessage({ id: "app.workCard.feedback", defaultMessage: "Feedback" })}
            </span>
          )}
          {badges?.map((badge, i) => (
            <React.Fragment key={i}>{badge}</React.Fragment>
          ))}
        </div>
      </div>
    </button>
  );
};

// Re-export StatusBadge from shared for convenience
export { StatusBadge } from "@green-goods/shared/components";
export type { StatusBadgeProps } from "@green-goods/shared/components";
