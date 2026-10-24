import { RiImageLine } from "@remixicon/react";
import type * as React from "react";
import { useIntl } from "react-intl";
import { useLocalizedRelativeTime } from "../../../hooks/app/useLocalizedRelativeTime";
import type { Address, WorkDisplayStatus } from "../../../types/domain";
import { toWorkDisplayTitle } from "../../../utils/work/workTitles";
import { normalizeTimestamp } from "../../../utils/time";
import {
  ItemRow,
  type ItemRowDetail,
  type ItemRowProps,
  ItemRowSkeleton,
  type ItemRowTone,
} from "../ItemRow";

export interface WorkCardData {
  id: string;
  title: string;
  status: WorkDisplayStatus;
  createdAt: number;
  mediaPreview?: string[];
  gardenerAddress?: Address;
  gardenerDisplayName?: string;
  gardenName?: string;
  gardenAddress?: Address;
  description?: string;
  imageCount?: number;
  feedback?: string;
  error?: string;
  retryCount?: number;
}

/** Translatable labels for the WorkCard component */
export interface WorkCardLabels {
  /** Title for a work with none of its own: empty, or only a generated name or timestamps */
  untitledWork?: string;
  /** The pill's words when the work failed to load or send */
  error?: string;
  /** Status display labels */
  status?: {
    approved?: string;
    rejected?: string;
    pending?: string;
    syncing?: string;
    sync_failed?: string;
    uploading?: string;
    offline?: string;
  };
}

/** Default English labels */
const defaultLabels: Required<WorkCardLabels> = {
  untitledWork: "Untitled Work",
  error: "Error",
  status: {
    approved: "Approved",
    rejected: "Rejected",
    pending: "Pending",
    syncing: "Syncing",
    sync_failed: "Sync Failed",
    uploading: "Uploading",
    offline: "Offline",
  },
};

/** A work's status as a pill and status edge tone. */
const STATUS_TONE: Record<WorkDisplayStatus, ItemRowTone> = {
  approved: "success",
  pending: "warning",
  rejected: "error",
  sync_failed: "error",
  syncing: "info",
  uploading: "info",
  offline: "neutral",
};

/** Maps work status to a left-border accent color class. */
export function getStatusBorderClass(status: WorkDisplayStatus | string): string {
  switch (status) {
    case "approved":
      return "border-l-2 border-l-success-base";
    case "pending":
      return "border-l-2 border-l-warning-base";
    case "rejected":
    case "sync_failed":
      return "border-l-2 border-l-error-base";
    case "syncing":
    case "uploading":
      return "border-l-2 border-l-information-base";
    case "offline":
    default:
      return "border-l-2 border-l-stroke-soft";
  }
}

export interface WorkCardProps {
  work: WorkCardData;
  className?: string;
  onClick?: () => void;
  /** A row with nothing to open is content, not a button. */
  interactive?: boolean;
  /** The gardener leads the detail line: who, then the age. */
  showGardener?: boolean;
  /** The photo count, on the photo. */
  showMediaCount?: boolean;
  /** A work that failed says so in its pill, in place of its status. */
  showErrorBadge?: boolean;
  /** The pill's words, when a list words the state its own way. */
  statusLabel?: string;
  /** The pill's and the status edge's tone, when a list reads the state its own way. */
  statusTone?: ItemRowTone;
  /** The first detail, in place of the gardener. */
  contextLabel?: string;
  /** The second detail, in place of the age: feedback, for one. */
  supportingText?: string;
  /** The work the list has open. */
  selected?: boolean;
  /** Translated labels - defaults to English */
  labels?: WorkCardLabels;
}

/**
 * The work row on both surfaces (F7): the shared item row with the work's first photo
 * and its photo count on it, a one-line title, the status pill under it, and the work's
 * two details, who and how long ago, in their short form ("2 hr. ago"). The garden name
 * stays off the line, since the chrome names the garden. The 2px edge takes the status
 * tone. A row with nothing to open is content and opens nothing.
 */
export const WorkCard: React.FC<WorkCardProps> = ({
  work,
  interactive = true,
  className,
  onClick,
  showGardener = false,
  showMediaCount = true,
  showErrorBadge = false,
  statusLabel,
  statusTone,
  contextLabel,
  supportingText,
  selected,
  labels: labelsProp,
}) => {
  const labels = {
    ...defaultLabels,
    ...labelsProp,
    status: { ...defaultLabels.status, ...labelsProp?.status },
  };
  const { formatMessage, formatDate } = useIntl();
  // Through react-intl, so the age follows the reader's language, in the short form
  // every card's detail line takes; the plain util is English-only.
  const formatAge = useLocalizedRelativeTime({ style: "short" });

  // Hosted titles can end in the timestamps older submissions appended; the row never shows them.
  const title = toWorkDisplayTitle(work.title, "") || labels.untitledWork;
  const failed = showErrorBadge && Boolean(work.error);
  const tone = failed ? "error" : (statusTone ?? STATUS_TONE[work.status] ?? "neutral");
  const pill = failed ? labels.error : (statusLabel ?? labels.status[work.status] ?? work.status);
  const mediaCount = work.imageCount ?? work.mediaPreview?.length ?? 0;
  // Who, then how long ago: the work's order, most important first. The age is a
  // moment, so it carries its exact time on hover and in its machine-readable form.
  const createdAtMs = normalizeTimestamp(work.createdAt);
  const age: ItemRowDetail =
    supportingText ??
    (Number.isNaN(createdAtMs)
      ? formatAge(work.createdAt)
      : {
          text: formatAge(work.createdAt),
          tone: "soft",
          dateTime: new Date(createdAtMs).toISOString(),
          title: formatDate(createdAtMs, { dateStyle: "medium", timeStyle: "short" }),
        });
  const who = contextLabel ?? (showGardener ? work.gardenerDisplayName : undefined);
  const details: ItemRowProps["details"] = who ? [who, age] : [age];
  const photoCount =
    showMediaCount && mediaCount > 0 ? (
      <>
        <RiImageLine aria-hidden="true" />
        <span aria-hidden="true">{mediaCount}</span>
        <span className="sr-only">
          {formatMessage(
            {
              id: "app.proof.contents.photos",
              defaultMessage: "{count, plural, one {# photo} other {# photos}}",
            },
            { count: mediaCount }
          )}
        </span>
      </>
    ) : undefined;

  return (
    <ItemRow
      className={className}
      data-component="WorkCard"
      lead={{ kind: "photo", src: work.mediaPreview?.[0], mark: photoCount }}
      title={title}
      status={{ label: pill, tone }}
      details={details}
      edge={tone}
      selected={selected}
      onOpen={interactive ? onClick : undefined}
    />
  );
};

/**
 * The work row's frame with nothing in it, for a list that is still loading: the
 * square photo inside the status edge, the title line, the pill and the detail line,
 * so the rows that arrive land where these stood (D28).
 */
export function WorkCardSkeleton() {
  return <ItemRowSkeleton edge="neutral" />;
}
