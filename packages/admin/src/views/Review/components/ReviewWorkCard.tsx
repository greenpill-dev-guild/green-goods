import { MediaCard, type MediaCardLayout } from "@green-goods/shared/components/Cards/MediaCard";
import { DOMAIN_CONFIG } from "@green-goods/shared/config/domain";
import { resolveIPFSUrl } from "@green-goods/shared/modules/data/ipfs/resolve";
import { DOMAIN_TOKEN_SLUG, type Domain, type Work } from "@green-goods/shared/types/domain";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { formatDateTime, normalizeTimestamp } from "@green-goods/shared/utils/time";
import { toWorkDisplayTitle } from "@green-goods/shared/utils/work/workTitles";
import { getRelativeTimeParts } from "@green-goods/shared/utils/relativeTime";
import { useState, type CSSProperties, type ReactNode } from "react";
import { type IntlShape, useIntl } from "react-intl";
import { localizeCanonicalActionTitle } from "@/components/Action/actionDisplay";
import { reviewWorkTitle } from "./reviewWorkTitle";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type ReviewWorkCardStatusTone = "neutral" | "success" | "warning" | "error";

/**
 * What a work's own status reads as in Review. A waiting work is a neutral Pending, since its
 * age is metadata and never an alarm (DL-044). A day's list shows every status, so a rejected
 * work says Rejected rather than passing for one still waiting.
 */
export function reviewWorkStatus(
  status: Work["status"],
  formatMessage: IntlShape["formatMessage"]
): { label: string; tone: ReviewWorkCardStatusTone } {
  if (status === "approved") {
    return {
      label: formatMessage({ id: "app.admin.work.filter.approved", defaultMessage: "Approved" }),
      tone: "success",
    };
  }
  if (status === "rejected") {
    return {
      label: formatMessage({ id: "app.work.status.rejected", defaultMessage: "Rejected" }),
      tone: "error",
    };
  }
  return {
    label: formatMessage({ id: "app.admin.work.filter.pending", defaultMessage: "Pending" }),
    tone: "neutral",
  };
}

export interface ReviewWorkCardProps {
  work: Work;
  /** Domain for the badge; undefined = hide badge */
  actionDomain?: Domain;
  /** Action title connected to the submission, if available */
  actionTitle?: string;
  gardenName: string;
  /** Pre-resolved ENS name or formatted address */
  gardenerDisplayName: string;
  /** Status/state label, e.g. Pending or Approved */
  statusLabel?: string;
  /**
   * Semantic pair for the status chip (success/warning/error lighter bg + dark
   * fg; neutral = the stone chip). Defaults from work.status: approved reads
   * success, everything else neutral.
   */
  statusTone?: ReviewWorkCardStatusTone;
  /**
   * `wide` lays the mosaic on the left with the text beside it, the desktop
   * queue's card (F12); `stacked` puts it on top.
   */
  layout?: MediaCardLayout;
  selected?: boolean;
  /** true for first 6 cards (above the fold) */
  eagerImages?: boolean;
  onClick?: () => void;
}

// Status chip — 1a spec: pill, 3px 10px, 11px/600, semantic lighter bg + dark
// fg pair; the neutral state is the warm stone chip.
const STATUS_CHIP_TONE_CLASSES: Record<ReviewWorkCardStatusTone, string> = {
  neutral: "bg-bg-sub text-text-sub",
  success: "bg-success-lighter text-success-dark",
  warning: "bg-warning-lighter text-warning-dark",
  error: "bg-error-lighter text-error-dark",
};

// ---------------------------------------------------------------------------
// ImageCell — single image with error fallback
// ---------------------------------------------------------------------------

function ImageCell({
  src,
  alt,
  eager,
  domain,
  className,
}: {
  src: string;
  alt: string;
  eager?: boolean;
  domain?: Domain;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <DomainGradientFallback domain={domain} className={className} />;
  }

  return (
    <div className={cn("overflow-hidden", className)}>
      <img
        src={`${resolveIPFSUrl(src)}?w=400&h=300`}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// DomainGradientFallback — shown when no images or image load fails
// ---------------------------------------------------------------------------

function DomainGradientFallback({ domain, className }: { domain?: Domain; className?: string }) {
  const config = domain !== undefined ? DOMAIN_CONFIG[domain] : undefined;
  const slug = domain !== undefined ? DOMAIN_TOKEN_SLUG[domain] : undefined;
  const fallbackStyle = {
    "--domain-fallback-soft-rgb": slug ? `var(--domain-${slug}-soft-rgb)` : undefined,
    "--domain-fallback-ink-rgb": slug ? `var(--domain-${slug}-rgb)` : undefined,
  } as CSSProperties;

  return (
    <div
      className={cn("domain-gradient-fallback flex items-center justify-center", className)}
      style={fallbackStyle}
    >
      {config && <config.icon className="h-8 w-8 opacity-30" />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WorkMosaic — the work's own picture: up to three of its photos, or its
// domain's gradient. It fills the media card's frame at either layout.
// ---------------------------------------------------------------------------

function WorkMosaic({
  mediaUrls,
  title,
  eager,
  domain,
}: {
  mediaUrls: string[];
  title: string;
  eager?: boolean;
  domain?: Domain;
}) {
  const photo = (index: number, className = "h-full") => (
    <ImageCell
      key={index}
      src={mediaUrls[index]}
      alt={mediaUrls.length === 1 ? title : `${title} — ${index + 1}`}
      eager={eager}
      domain={domain}
      className={className}
    />
  );

  let photos: ReactNode;
  if (mediaUrls.length === 0) {
    photos = <DomainGradientFallback domain={domain} className="h-full" />;
  } else if (mediaUrls.length === 1) {
    photos = photo(0);
  } else if (mediaUrls.length === 2) {
    photos = (
      <div className="grid h-full grid-cols-2 gap-px bg-stroke-soft">
        {photo(0)}
        {photo(1)}
      </div>
    );
  } else {
    photos = (
      <div className="grid h-full grid-cols-[1.35fr_1fr] grid-rows-2 gap-px bg-stroke-soft">
        {photo(0, "row-span-2 h-full")}
        {photo(1)}
        {photo(2)}
      </div>
    );
  }

  return (
    <>
      {photos}
      <div className="admin-media-readability-overlay pointer-events-none absolute inset-0" />
    </>
  );
}

// ---------------------------------------------------------------------------
// ReviewWorkCard
// ---------------------------------------------------------------------------

export function ReviewWorkCard({
  work,
  actionDomain,
  actionTitle,
  gardenName,
  gardenerDisplayName,
  statusLabel,
  statusTone,
  layout = "stacked",
  selected = false,
  eagerImages,
  onClick,
}: ReviewWorkCardProps) {
  const { formatMessage, formatRelativeTime } = useIntl();
  const mediaUrls = work.media ?? [];
  const totalMedia = mediaUrls.length;

  // Relative age through react-intl so es/pt stewards don't get English.
  // `numeric: "always"` keeps "1 day ago" rather than "yesterday" — the queue
  // reads as a uniform age column, not prose.
  const submittedAgeParts = getRelativeTimeParts(work.createdAt);
  const submittedAge = submittedAgeParts
    ? formatRelativeTime(submittedAgeParts.value, submittedAgeParts.unit, { numeric: "always" })
    : formatMessage({ id: "hub.review.workCard.justNow", defaultMessage: "just now" });
  const submittedAgoText = formatMessage(
    { id: "hub.review.workCard.submittedAgo", defaultMessage: "submitted {age}" },
    { age: submittedAge }
  );
  const submittedAtMs = normalizeTimestamp(work.createdAt);
  const submittedAtIso = Number.isNaN(submittedAtMs)
    ? undefined
    : new Date(submittedAtMs).toISOString();
  const submittedAtExact = formatDateTime(work.createdAt, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const ownStatus = reviewWorkStatus(work.status, formatMessage);
  const resolvedStatusLabel = statusLabel ?? ownStatus.label;
  const resolvedStatusTone: ReviewWorkCardStatusTone = statusTone ?? ownStatus.tone;
  const domainConfig = actionDomain !== undefined ? DOMAIN_CONFIG[actionDomain] : undefined;
  // Action titles can carry generated stamps too, so both go through the display title.
  const actionDisplayTitle = toWorkDisplayTitle(actionTitle, "");
  const localizedActionTitle = actionDisplayTitle
    ? localizeCanonicalActionTitle(actionDisplayTitle, formatMessage)
    : undefined;
  // A work whose own title is generated or missing reads as its action.
  const title = reviewWorkTitle(work.title, actionTitle, formatMessage);
  const visibleActionTitle =
    localizedActionTitle && localizedActionTitle.trim().toLowerCase() !== title.trim().toLowerCase()
      ? localizedActionTitle
      : undefined;

  return (
    <MediaCard
      className="review-work-card"
      layout={layout}
      selected={selected}
      onClick={onClick}
      media={
        <WorkMosaic mediaUrls={mediaUrls} title={title} eager={eagerImages} domain={actionDomain} />
      }
      // The domain and the photo count are marks on the picture (one pill per
      // card): the domain a neutral chip, never a domain or tone color.
      mediaLabel={domainConfig ? formatMessage({ id: domainConfig.labelId }) : undefined}
      mediaCount={totalMedia > 1 ? `1 / ${totalMedia}` : undefined}
      title={title}
      status={
        <span
          className={cn(
            "inline-flex shrink-0 rounded-full px-2.5 py-0.75 type-meta-sm font-semibold",
            STATUS_CHIP_TONE_CLASSES[resolvedStatusTone]
          )}
        >
          {resolvedStatusLabel}
        </span>
      }
      // Action title — the Work tab's search matches on it (filterWorksByScope),
      // so it has to stay visible or a hit renders a card with no matching text.
      // Suppressed when the work title already carries it, which is the common
      // generated-title case; the empty line keeps stacked cards one height.
      subtitle={visibleActionTitle ?? ""}
      // Detail line — gardener (500, sub ink) · relative timestamp (soft ink).
      // Garden name lives in the hover title only; chrome declares garden
      // context (Frontend Rule 17).
      details={<span title={gardenerDisplayName}>{gardenerDisplayName}</span>}
      detailsEnd={
        <time dateTime={submittedAtIso} title={submittedAtExact}>
          {submittedAgoText}
        </time>
      }
      detailsTitle={localizedActionTitle ? `${localizedActionTitle} · ${gardenName}` : gardenName}
    />
  );
}
