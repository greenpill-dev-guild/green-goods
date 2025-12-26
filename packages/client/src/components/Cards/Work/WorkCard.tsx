import { useEnsName } from "@green-goods/shared/hooks";
import {
  cn,
  formatAddress,
  formatFileSize,
  formatRelativeTime,
  truncateAddress,
} from "@green-goods/shared/utils";
import { getStatusColors, StatusBadge } from "@green-goods/shared/components";
import {
  RiCheckLine,
  RiCloseLine,
  RiFileTextLine,
  RiImageLine,
  RiPlantLine,
  RiRefreshLine,
  RiTaskLine,
  RiTimeLine,
  RiUserLine,
} from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";
import { ImageWithFallback } from "@/components/Display";
import { Card } from "../Base/Card";

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
  gardenerName?: string;
  showGardenInfo?: boolean;
  badges?: React.ReactNode[];
  style?: React.CSSProperties;
  variant?: "default" | "dashboard"; // dashboard variant hides gardener info
}

// Type for media items which can be strings, objects with url, or File objects
type MediaItem = string | { url: string } | { file: File } | File;

const WorkTypeIcon: React.FC<{ type: string; className?: string }> = ({ type, className }) => {
  const Icon = type === "work_approval" ? RiUserLine : RiTaskLine;
  return <Icon className={className} />;
};

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

  const isCompleted = work.status === "approved" || work.status === "rejected";
  const isPending = ["pending", "syncing"].includes(work.status);
  const isFailed = work.status === "failed";

  // Render minimal variant
  if (variant === "minimal") {
    return (
      <button
        onClick={onClick}
        type="button"
        className={cn(
          "flex gap-3 p-3 border border-slate-200 rounded-lg transition-all duration-300 cursor-pointer w-full text-left tap-feedback",
          className
        )}
      >
        {/* Image placeholder */}
        <div className="w-16 h-16 bg-slate-100 rounded-lg flex-shrink-0 flex items-center justify-center">
          <RiTimeLine className="w-6 h-6 text-slate-400" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-1">
            <h4 className="font-medium text-sm text-slate-900 truncate pr-2">{work.title}</h4>
            <span
              className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 status-transition",
                getStatusColor(work.status)
              )}
            >
              {work.status}
            </span>
          </div>

          {work.description && (
            <p className="text-xs text-slate-600 mb-2 line-clamp-2">{work.description}</p>
          )}

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{formatRelativeTime(work.createdAt)}</span>
            <span>
              Garden: {work.gardenId.slice(0, 6)}...{work.gardenId.slice(-4)}
            </span>
          </div>
        </div>
      </button>
    );
  }

  // Render full variant (default)
  return (
    <Card
      className={cn(
        "p-4 border-l-4 transition-all duration-300 tap-feedback",
        isCompleted && "border-l-green-400 bg-green-50/30",
        isPending && "border-l-blue-400 bg-blue-50/30",
        isFailed && "border-l-red-400 bg-red-50/30",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <WorkTypeIcon type={work.type} className="w-4 h-4 flex-shrink-0 text-slate-500" />
            <h3 className="font-semibold text-sm truncate">{work.title}</h3>
            <StatusBadge status={work.status} size="sm" />
          </div>

          {/* Garden Info */}
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            <RiPlantLine className="w-3 h-3" />
            <span>
              {intl.formatMessage({
                id: "app.workCard.garden",
                defaultMessage: "Garden:",
              })}{" "}
              {work.gardenName || truncateAddress(work.gardenId)}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      {work.description && (
        <p className="text-sm text-slate-600 mb-3 line-clamp-2">{work.description}</p>
      )}

      {/* Media Preview */}
      {work.images && work.images.count > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <RiImageLine className="w-3 h-3" />
            <span>
              {work.images.count} {work.images.count === 1 ? "image" : "images"}(
              {formatFileSize(work.images.totalSize)})
            </span>
          </div>
          {work.mediaPreview && work.mediaPreview.length > 0 && (
            <div className="flex -space-x-1">
              {work.mediaPreview.slice(0, 3).map((url, i) => (
                <div
                  key={i}
                  className="relative w-6 h-6 rounded-full border-2 border-white overflow-hidden"
                >
                  <ImageWithFallback
                    src={url}
                    alt=""
                    className="w-full h-full object-cover"
                    fallbackClassName="w-6 h-6 rounded-full"
                  />
                </div>
              ))}
              {work.mediaPreview.length > 3 && (
                <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-xs text-slate-500">
                  +{work.mediaPreview.length - 3}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {work.error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-md">
          <p className="text-xs text-red-700">{work.error}</p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <RiTimeLine className="w-3 h-3" />
            {formatRelativeTime(work.createdAt)}
          </span>

          {work.lastAttempt && work.retryCount > 0 && (
            <span className="flex items-center gap-1">
              <RiRefreshLine className="w-3 h-3" />
              {work.retryCount} {work.retryCount === 1 ? "retry" : "retries"}
            </span>
          )}

          <span className="flex items-center gap-1">
            <RiFileTextLine className="w-3 h-3" />
            {formatFileSize(work.size)}
          </span>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-1">
          {work.status === "syncing" && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              <span className="text-xs text-blue-600">
                {intl.formatMessage({
                  id: "app.workCard.syncing",
                  defaultMessage: "Syncing...",
                })}
              </span>
            </div>
          )}

          {isCompleted && (
            <div className="flex items-center gap-1 text-xs">
              {work.status === "approved" ? (
                <RiCheckLine className="w-3 h-3 text-green-600" />
              ) : (
                <RiCloseLine className="w-3 h-3 text-red-600" />
              )}
              <span className={work.status === "approved" ? "text-green-600" : "text-red-600"}>
                {work.status === "approved"
                  ? intl.formatMessage({
                      id: "app.workCard.approved",
                      defaultMessage: "Approved",
                    })
                  : intl.formatMessage({
                      id: "app.workCard.rejected",
                      defaultMessage: "Rejected",
                    })}
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

// Export MinimalWorkCard as a wrapper around WorkCard with variant="minimal"
export const MinimalWorkCard: React.FC<MinimalWorkCardProps> = ({
  work,
  onClick,
  className,
  actionTitle,
  gardenerName,
  showGardenInfo = false,
  badges,
  variant = "default",
}) => {
  const intl = useIntl();
  const { data: gardenerEnsName } = useEnsName(work.gardenerAddress);
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
  const name = gardenerName || formatAddress(work.gardenerAddress, { ensName: gardenerEnsName });
  const action = actionTitle || work.title;
  const timeAgo = formatRelativeTime(work.createdAt);

  return (
    <button
      onClick={onClick}
      type="button"
      className={cn(
        "flex items-stretch gap-0 border border-slate-200 rounded-lg overflow-hidden transition-all duration-300 cursor-pointer bg-white w-full text-left tap-feedback",
        className
      )}
    >
      {/* Media thumbnail - flush to edges with 1:1 aspect ratio */}
      <div className="w-22 flex-shrink-0 bg-slate-100 overflow-hidden relative aspect-square">
        {thumbUrl ? (
          <ImageWithFallback
            src={thumbUrl}
            alt=""
            className="w-full h-full object-cover"
            fallbackClassName="w-22 aspect-square"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400">
            <RiImageLine className="w-6 h-6" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pl-2 pr-3 py-3">
        {/* Title row */}
        <div className="flex items-start justify-between">
          <h4 className="font-medium text-sm text-slate-900 truncate pr-2">{action}</h4>
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 status-transition",
              getStatusColor(work.status)
            )}
          >
            {displayStatus}
          </span>
        </div>

        {/* Subtitle: conditionally show gardener info based on variant */}
        {variant === "dashboard" ? (
          <div className="mt-0.5 text-xs text-slate-600 truncate">
            {timeAgo}
            {showGardenInfo && gardenEnsName && (
              <>
                <span className="mx-1">•</span>
                {gardenEnsName}
              </>
            )}
          </div>
        ) : (
          <div className="mt-0.5 text-xs text-slate-600 truncate">
            {name}
            <span className="mx-1">•</span>
            {timeAgo}
          </div>
        )}

        {/* Meta / Tags */}
        <div className="mt-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
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
          {showGardenInfo && variant !== "dashboard" && (
            <div className="flex items-center gap-2 text-slate-500">
              <span>
                {intl.formatMessage({ id: "app.workCard.garden", defaultMessage: "Garden:" })}{" "}
                {formatAddress(work.gardenAddress, { ensName: gardenEnsName, variant: "card" })}
              </span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
};

// Re-export StatusBadge from shared for convenience
export { StatusBadge } from "@green-goods/shared/components";
export type { StatusBadgeProps } from "@green-goods/shared/components";
