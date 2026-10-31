import type { ItemRowTone } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { WorkCard as SharedWorkCard } from "@green-goods/shared/components/Cards/WorkCard/WorkCard";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import type { Work } from "@green-goods/shared/types/domain";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import { toWorkDisplayTitle } from "@green-goods/shared/utils/work/workTitles";
import React from "react";
import { useIntl } from "react-intl";
import { queuedWorkStatusMessage, readQueuedWorkState } from "./queuedWorkCopy";

export interface MinimalWorkCardProps {
  work: Work;
  onClick: () => void;
  className?: string;
  actionTitle?: string;
  presentation?: WorkCardPresentation;
  style?: React.CSSProperties;
  confirmed?: boolean;
  /** The detail line: "compact" (default) gives the age alone, "detailed" the gardener, then the age */
  variant?: "compact" | "detailed";
}

/** How a list words a row: its pill, and its two details in place of who and how long ago. */
export interface WorkCardPresentation {
  statusLabel?: string;
  statusTone?: ItemRowTone;
  contextLabel?: string;
  supportingText?: string;
}

/** The work row's words, in the reader's language: its untitled name and its status pills. */
function getWorkCardLabels(formatMessage: ReturnType<typeof useIntl>["formatMessage"]) {
  return {
    untitledWork: formatMessage({
      id: "app.workCard.untitledWork",
      defaultMessage: "Untitled Work",
    }),
    error: formatMessage({ id: "app.workCard.error", defaultMessage: "Error loading work" }),
    status: {
      approved: formatMessage({ id: "app.status.approved", defaultMessage: "Approved" }),
      rejected: formatMessage({ id: "app.status.rejected", defaultMessage: "Rejected" }),
      pending: formatMessage({ id: "app.status.pending", defaultMessage: "Pending" }),
      syncing: formatMessage({ id: "app.status.syncing", defaultMessage: "Syncing" }),
      uploading: formatMessage({ id: "app.status.uploading", defaultMessage: "Uploading" }),
      sync_failed: formatMessage({
        id: "app.status.syncFailed",
        defaultMessage: "Sync failed",
      }),
      offline: formatMessage({ id: "app.status.offline", defaultMessage: "Offline" }),
    },
  };
}

// The work row for list views, with the gardener's name resolved
export const MinimalWorkCard: React.FC<MinimalWorkCardProps> = ({
  work,
  onClick,
  className,
  actionTitle,
  presentation,
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
  const effectiveStatus = work.status;
  // Work still on this device names where it stands instead of reading "Offline".
  const queuedStatus = queuedWorkStatusMessage(readQueuedWorkState(work.metadata).submissionState);
  if (queuedStatus) labels.status.offline = formatMessage(queuedStatus);
  const mediaPreview = work.media.length > 0 ? work.media : undefined;
  const mediaCount = Array.isArray(work.media) ? work.media.length : 0;
  // The action names the work when it is known. A generated name gives way to the work's own
  // title, and the shared card drops timestamps and says untitled when nothing real is left.
  const title = toWorkDisplayTitle(actionTitle, "") || work.title;
  const gardenerName = formatAddress(work.gardenerAddress, {
    ensName: gardenerGreenGoodsEnsName || gardenerEnsName,
  });
  // The detail line gives who, then how long ago; the work's page carries any feedback (DL-132).

  return (
    <SharedWorkCard
      className={`${confirmed ? "work-confirmed-shimmer " : ""}${className ?? ""}`.trim()}
      onClick={onClick}
      work={{
        id: work.id,
        title,
        status: effectiveStatus,
        createdAt: work.createdAt,
        mediaPreview,
        gardenerDisplayName: variant === "detailed" ? gardenerName : undefined,
        feedback: work.feedback,
        imageCount: mediaCount,
      }}
      showGardener={variant === "detailed"}
      showMediaCount={mediaCount > 0}
      statusLabel={presentation?.statusLabel}
      statusTone={presentation?.statusTone}
      contextLabel={presentation?.contextLabel}
      supportingText={presentation?.supportingText}
      labels={labels}
    />
  );
};
