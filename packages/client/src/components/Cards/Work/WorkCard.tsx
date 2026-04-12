import {
  formatAddress,
  formatFileSize,
  truncateAddress,
  useEnsName,
  type Work,
} from "@green-goods/shared";
import { WorkCard as SharedWorkCard } from "@green-goods/shared/components";
import React from "react";
import { useIntl } from "react-intl";

export interface WorkCardItem {
  id: string;
  type: "work" | "work_approval";
  title: string;
  description?: string;
  gardenId: string;
  gardenName?: string;
  status: "approved" | "rejected" | "pending" | "syncing" | "uploading" | "sync_failed" | "offline";
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
  confirmed?: boolean;
  /** Variant controls subtitle content: "compact" (default) shows time only, "detailed" shows gardener + time */
  variant?: "compact" | "detailed";
}

type MediaItem = string | { url: string } | { file: File } | File;

function getWorkCardLabels(formatMessage: ReturnType<typeof useIntl>["formatMessage"]) {
  return {
    error: formatMessage({ id: "app.workCard.error", defaultMessage: "Error" }),
    feedback: formatMessage({ id: "app.workCard.feedback", defaultMessage: "Feedback" }),
    status: {
      approved: formatMessage({ id: "app.status.approved", defaultMessage: "Approved" }),
      rejected: formatMessage({ id: "app.status.rejected", defaultMessage: "Rejected" }),
      pending: formatMessage({ id: "app.status.pending", defaultMessage: "Pending" }),
      syncing: formatMessage({ id: "app.status.syncing", defaultMessage: "Syncing" }),
      uploading: formatMessage({ id: "app.status.uploading", defaultMessage: "Uploading" }),
      sync_failed: formatMessage({
        id: "app.status.syncFailed",
        defaultMessage: "Sync Failed",
      }),
      offline: formatMessage({ id: "app.status.offline", defaultMessage: "Offline" }),
    },
  };
}

function useMediaPreview(media: Work["media"] | undefined): string[] | undefined {
  const [preview, setPreview] = React.useState<string[] | undefined>(undefined);

  React.useEffect(() => {
    const createdUrls: string[] = [];
    const urls = Array.isArray(media)
      ? media.flatMap((item) => {
          if (typeof item === "string") {
            return [item];
          }

          if (item && typeof item === "object") {
            if ("url" in item && typeof item.url === "string") {
              return [item.url];
            }

            if ("file" in item && item.file instanceof File) {
              const objectUrl = URL.createObjectURL(item.file);
              createdUrls.push(objectUrl);
              return [objectUrl];
            }

            if (item instanceof File) {
              const objectUrl = URL.createObjectURL(item);
              createdUrls.push(objectUrl);
              return [objectUrl];
            }
          }

          return [];
        })
      : [];

    setPreview(urls.length > 0 ? urls : undefined);

    return () => {
      for (const url of createdUrls) {
        URL.revokeObjectURL(url);
      }
    };
  }, [media]);

  return preview;
}

export const WorkCard: React.FC<WorkCardProps> = ({
  work,
  className,
  variant = "full",
  onClick,
}) => {
  const { formatMessage } = useIntl();
  const labels = getWorkCardLabels(formatMessage);
  const badges =
    variant === "full" && work.size > 0
      ? [
          <span key="size" className="text-text-sub-600">
            {formatFileSize(work.size)}
          </span>,
        ]
      : undefined;

  return (
    <SharedWorkCard
      className={className}
      onClick={onClick}
      variant={variant === "full" ? "auto" : "compact"}
      work={{
        id: work.id,
        title: work.title,
        status: work.status,
        createdAt: work.createdAt,
        mediaPreview: work.mediaPreview,
        gardenName: work.gardenName || truncateAddress(work.gardenId),
        error: work.error,
        retryCount: work.retryCount,
        imageCount: work.images?.count,
      }}
      showMediaCount={Boolean(work.images?.count)}
      showErrorBadge={Boolean(work.error)}
      showRetryBadge={work.retryCount > 0}
      badges={badges}
      labels={labels}
    />
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
  confirmed = false,
  variant = "compact",
}) => {
  const { formatMessage } = useIntl();
  const labels = getWorkCardLabels(formatMessage);
  const { data: gardenerEnsName } = useEnsName(
    variant === "detailed" ? work.gardenerAddress : null,
    { enabled: variant === "detailed" }
  );
  const { data: gardenEnsName } = useEnsName(showGardenInfo ? work.gardenAddress : null, {
    enabled: Boolean(showGardenInfo && work.gardenAddress),
  });
  const isOfflineWork = work.id.startsWith("0xoffline_");
  const effectiveStatus = isOfflineWork ? "uploading" : work.status;
  const mediaPreview = useMediaPreview(work.media as MediaItem[] | undefined);
  const hasFeedback = Boolean(work.feedback && work.feedback.trim().length > 0);
  const mediaCount = Array.isArray(work.media) ? work.media.length : 0;
  const action = actionTitle || work.title;
  const gardenerName = formatAddress(work.gardenerAddress, { ensName: gardenerEnsName });
  const extraBadges = [...(badges ?? [])];

  return (
    <SharedWorkCard
      className={`${confirmed ? "work-confirmed-shimmer " : ""}${className ?? ""}`.trim()}
      onClick={onClick}
      variant="auto"
      work={{
        id: work.id,
        title: action,
        status: effectiveStatus,
        createdAt: work.createdAt,
        mediaPreview,
        gardenerDisplayName: variant === "detailed" ? gardenerName : undefined,
        gardenName:
          variant === "compact" && showGardenInfo ? (gardenEnsName ?? undefined) : undefined,
        feedback: work.feedback,
        imageCount: mediaCount,
      }}
      showGardener={variant === "detailed"}
      showMediaCount={mediaCount > 0}
      showFeedbackBadge={hasFeedback}
      badges={extraBadges}
      labels={labels}
    />
  );
};

export type { StatusBadgeProps } from "@green-goods/shared";
// Re-export StatusBadge from shared for convenience
export { StatusBadge } from "@green-goods/shared";
