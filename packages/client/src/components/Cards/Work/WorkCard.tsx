import { formatAddress, formatEnsNameForDisplay } from "@green-goods/shared/utils/app/text";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import type { Work } from "@green-goods/shared/types/domain";
import { WorkCard as SharedWorkCard } from "@green-goods/shared/components/Cards/WorkCard/WorkCard";
import React from "react";
import { useIntl } from "react-intl";

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
  const { data: gardenerGreenGoodsEnsName } = useGreenGoodsEnsName(
    variant === "detailed" ? work.gardenerAddress : null
  );
  const { data: gardenEnsName } = useEnsName(showGardenInfo ? work.gardenAddress : null, {
    enabled: Boolean(showGardenInfo && work.gardenAddress),
  });
  const isOfflineWork = work.id.startsWith("0xoffline_");
  const effectiveStatus = isOfflineWork ? "uploading" : work.status;
  const mediaPreview = work.media.length > 0 ? work.media : undefined;
  const hasFeedback = Boolean(work.feedback && work.feedback.trim().length > 0);
  const mediaCount = Array.isArray(work.media) ? work.media.length : 0;
  const action = actionTitle || work.title;
  const gardenerName = formatAddress(work.gardenerAddress, {
    ensName: gardenerGreenGoodsEnsName || gardenerEnsName,
  });
  const gardenName = formatEnsNameForDisplay(gardenEnsName) ?? undefined;
  const extraBadges = [...(badges ?? [])];

  return (
    <SharedWorkCard
      className={`${confirmed ? "work-confirmed-shimmer " : ""}${className ?? ""}`.trim()}
      onClick={onClick}
      variant="compact"
      work={{
        id: work.id,
        title: action,
        status: effectiveStatus,
        createdAt: work.createdAt,
        mediaPreview,
        gardenerDisplayName: variant === "detailed" ? gardenerName : undefined,
        gardenName: variant === "compact" && showGardenInfo ? gardenName : undefined,
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

export type { StatusBadgeProps } from "@green-goods/shared/components/StatusBadge";
// Re-export StatusBadge from shared for convenience
export { StatusBadge } from "@green-goods/shared/components/StatusBadge";
