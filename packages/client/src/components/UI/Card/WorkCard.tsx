import { useEnsName } from "@green-goods/shared/hooks";
import { cn, formatAddress } from "@green-goods/shared/utils";
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
import { Card } from "./Card";
import { StatusBadge } from "./StatusBadge";

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
}

const WorkTypeIcon: React.FC<{ type: string; className?: string }> = ({ type, className }) => {
  const Icon = type === "work_approval" ? RiUserLine : RiTaskLine;
  return <Icon className={className} />;
};

const toMs = (timestamp: number): number => {
  // Normalize seconds to milliseconds if needed
  return timestamp < 1e12 ? timestamp * 1000 : timestamp;
};

const formatTimeAgo = (timestamp: number): string => {
  const ts = toMs(timestamp);
  const now = Date.now();
  const diff = now - ts;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const truncateAddress = (address: string): string => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "approved":
      return "text-green-600 bg-green-50 border-green-200";
    case "rejected":
      return "text-red-600 bg-red-50 border-red-200";
    case "pending":
      return "text-blue-600 bg-blue-50 border-blue-200";
    case "syncing":
      return "text-orange-600 bg-orange-50 border-orange-200";
    case "failed":
      return "text-red-600 bg-red-50 border-red-200";
    default:
      return "text-slate-600 bg-slate-50 border-slate-200";
  }
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
          "flex gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer w-full text-left",
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
                "text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0",
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
            <span>{formatTimeAgo(work.createdAt)}</span>
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
        "p-4 border-l-4 transition-all duration-200",
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
                <img
                  key={i}
                  src={url}
                  alt=""
                  className="w-6 h-6 rounded-full border-2 border-white object-cover"
                />
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
            {formatTimeAgo(work.createdAt)}
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
}) => {
  const intl = useIntl();
  const { data: gardenerEnsName } = useEnsName(work.gardenerAddress);
  const { data: gardenEnsName } = useEnsName(showGardenInfo ? work.gardenAddress : null, {
    enabled: Boolean(showGardenInfo && work.gardenAddress),
  });
  const displayStatus = work.status.charAt(0).toUpperCase() + work.status.slice(1);
  // Resolve thumbnail from media entry (supports string URL, {url}, or File)
  const initialCandidate =
    Array.isArray(work.media) && work.media.length > 0 ? work.media[0] : undefined;
  const [thumbUrl, setThumbUrl] = React.useState<string | undefined>(
    typeof initialCandidate === "string" ? initialCandidate : undefined
  );
  React.useEffect(() => {
    let createdUrl: string | undefined;
    try {
      const m0 =
        Array.isArray(work.media) && work.media.length > 0 ? (work.media as any[])[0] : undefined;
      let url: string | undefined;
      if (typeof m0 === "string") {
        url = m0;
      } else if (m0 && typeof m0 === "object") {
        if (typeof (m0 as any).url === "string") {
          url = (m0 as any).url as string;
        } else if ((m0 as any).file instanceof File) {
          createdUrl = URL.createObjectURL((m0 as any).file as File);
          url = createdUrl;
        } else if (m0 instanceof File) {
          createdUrl = URL.createObjectURL(m0 as File);
          url = createdUrl;
        }
      }
      setThumbUrl(url);
    } catch {
      setThumbUrl(undefined);
    }
    return () => {
      if (createdUrl) {
        try {
          URL.revokeObjectURL(createdUrl);
        } catch {}
      }
    };
  }, [work.media]);
  const hasFeedback = Boolean(work.feedback && work.feedback.trim().length > 0);
  const mediaCount = Array.isArray(work.media) ? work.media.length : 0;
  const name = gardenerName || formatAddress(work.gardenerAddress, { ensName: gardenerEnsName });
  const action = actionTitle || work.title;
  const timeAgo = formatTimeAgo(work.createdAt);

  return (
    <button
      onClick={onClick}
      type="button"
      className={cn(
        "flex items-stretch gap-0 border border-slate-200 rounded-lg overflow-hidden transition-colors cursor-pointer bg-white w-full text-left",
        "hover:bg-slate-50",
        className
      )}
    >
      {/* Media thumbnail - flush to left edge */}
      <div className="w-20 h-20 flex-shrink-0 bg-slate-100 overflow-hidden">
        {thumbUrl ? (
          <img src={thumbUrl} alt="" className="w-full h-full object-cover aspect-square" />
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
              "text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0",
              getStatusColor(work.status)
            )}
          >
            {displayStatus}
          </span>
        </div>

        {/* Subtitle: gardener and time */}
        <div className="mt-0.5 text-xs text-slate-600 truncate">
          {name}
          <span className="mx-1">•</span>
          {timeAgo}
        </div>

        {/* Meta / Tags */}
        <div className="mt-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {mediaCount > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border bg-blue-50 text-blue-600 border-blue-100">
                <RiImageLine className="w-3 h-3" /> {mediaCount}
              </span>
            )}
            {hasFeedback && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border bg-purple-50 text-purple-600 border-purple-100">
                <RiFileTextLine className="w-3 h-3" />
                {intl.formatMessage({ id: "app.workCard.feedback", defaultMessage: "Feedback" })}
              </span>
            )}
            {badges?.map((badge, i) => (
              <React.Fragment key={i}>{badge}</React.Fragment>
            ))}
          </div>
          {showGardenInfo && (
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

// Re-export StatusBadge for convenience
export { StatusBadge, type StatusBadgeProps } from "./StatusBadge";
