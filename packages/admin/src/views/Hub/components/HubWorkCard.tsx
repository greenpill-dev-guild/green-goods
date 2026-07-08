import {
  type Domain,
  DOMAIN_CONFIG,
  DomainBadge,
  cn,
  formatDateTime,
  resolveIPFSUrl,
  stripGeneratedWorkTitleTimestamp,
  type Work,
} from "@green-goods/shared";
import { RiArrowRightLine } from "@remixicon/react";
import { useState, type CSSProperties } from "react";
import { useIntl } from "react-intl";
import { adminCardVariants } from "@/components/AdminCard";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface HubWorkCardProps {
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
  selected?: boolean;
  /** true for first 6 cards (above the fold) */
  eagerImages?: boolean;
  onClick?: () => void;
}

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

const DOMAIN_FALLBACK_SLUGS = ["solar", "agro", "education", "waste"] as const;

function DomainGradientFallback({ domain, className }: { domain?: Domain; className?: string }) {
  const config = domain !== undefined ? DOMAIN_CONFIG[domain] : undefined;
  const slug = domain !== undefined ? DOMAIN_FALLBACK_SLUGS[domain] : undefined;
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
// HubWorkCard
// ---------------------------------------------------------------------------

export function HubWorkCard({
  work,
  actionDomain,
  actionTitle,
  gardenName,
  gardenerDisplayName,
  statusLabel,
  selected = false,
  eagerImages,
  onClick,
}: HubWorkCardProps) {
  const { formatMessage } = useIntl();
  const mediaUrls = work.media ?? [];
  const totalMedia = mediaUrls.length;
  const submittedLabel = formatMessage({ id: "app.work.detail.submitted" });
  const submittedAtText = `${submittedLabel} · ${formatDateTime(work.createdAt, {
    dateStyle: "medium",
    timeStyle: "short",
  })}`;
  const resolvedStatusLabel =
    statusLabel ??
    (work.status === "approved"
      ? formatMessage({ id: "app.admin.work.filter.approved", defaultMessage: "Approved" })
      : formatMessage({ id: "app.admin.work.filter.pending", defaultMessage: "Pending" }));

  const rawTitle =
    work.title ||
    formatMessage({ id: "app.admin.work.untitledWork", defaultMessage: "Untitled Work" });
  const title = stripGeneratedWorkTitleTimestamp(rawTitle, actionTitle) || rawTitle;
  const visibleActionTitle =
    actionTitle && actionTitle.trim().toLowerCase() !== title.trim().toLowerCase()
      ? actionTitle
      : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      data-selected={selected ? "true" : "false"}
      className={cn(
        adminCardVariants({ variant: "elevated", density: "none", interactive: true }),
        "hub-work-card group block h-full w-full overflow-hidden text-left",
        "active:translate-y-0 motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0 motion-reduce:transition-none",
        "outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--tone-primary,var(--primary-base))))] focus-visible:ring-offset-2"
      )}
    >
      <div className="relative overflow-hidden border-b border-stroke-soft">
        {totalMedia === 0 ? (
          <DomainGradientFallback domain={actionDomain} className="aspect-[16/9]" />
        ) : totalMedia === 1 ? (
          <ImageCell
            src={mediaUrls[0]}
            alt={title}
            eager={eagerImages}
            domain={actionDomain}
            className="aspect-[16/9]"
          />
        ) : totalMedia === 2 ? (
          <div className="grid aspect-[16/9] grid-cols-2 gap-px bg-stroke-soft">
            <ImageCell
              src={mediaUrls[0]}
              alt={`${title} — 1`}
              eager={eagerImages}
              domain={actionDomain}
              className="h-full"
            />
            <ImageCell
              src={mediaUrls[1]}
              alt={`${title} — 2`}
              eager={eagerImages}
              domain={actionDomain}
              className="h-full"
            />
          </div>
        ) : (
          <div className="grid aspect-[16/9] grid-cols-[1.35fr_1fr] gap-px bg-stroke-soft">
            <ImageCell
              src={mediaUrls[0]}
              alt={`${title} — 1`}
              eager={eagerImages}
              domain={actionDomain}
              className="h-full"
            />
            <div className="grid h-full gap-px">
              <ImageCell
                src={mediaUrls[1]}
                alt={`${title} — 2`}
                eager={eagerImages}
                domain={actionDomain}
                className="h-full"
              />
              <ImageCell
                src={mediaUrls[2]}
                alt={`${title} — 3`}
                eager={eagerImages}
                domain={actionDomain}
                className="h-full"
              />
            </div>
          </div>
        )}

        <div className="admin-media-readability-overlay pointer-events-none absolute inset-0" />

        {actionDomain !== undefined && (
          <DomainBadge domain={actionDomain} size="sm" className="absolute bottom-2 left-2" />
        )}

        {totalMedia > 1 && (
          <span className="absolute bottom-2 right-2 inline-flex items-center rounded-full bg-static-black/60 px-2 py-1 text-[11px] font-medium text-static-white">
            1 / {totalMedia}
          </span>
        )}
      </div>

      <div className="space-y-3 p-3 sm:p-3.5">
        <div className="flex items-start justify-between gap-3">
          <h3
            className="min-w-0 flex-1 text-title-sm font-semibold leading-5 text-text-strong line-clamp-2"
            title={title}
          >
            {title}
          </h3>
          <span className="inline-flex shrink-0 rounded-full bg-bg-soft/90 px-2.5 py-1 text-label-sm font-medium text-text-sub shadow-[inset_0_0_0_1px_rgb(var(--text-strong-950)/0.06)]">
            {resolvedStatusLabel}
          </span>
        </div>

        <div
          className="min-w-0 space-y-1 text-body-sm text-text-sub"
          title={`${gardenerDisplayName} · ${gardenName}`}
        >
          {visibleActionTitle ? (
            <p className="line-clamp-2 font-medium leading-5 text-text-sub">{visibleActionTitle}</p>
          ) : null}
          <p
            className={cn(
              "truncate leading-5",
              visibleActionTitle ? "text-text-soft" : "font-medium text-text-sub"
            )}
          >
            {gardenerDisplayName}
          </p>
          {/* Garden name removed from visible body — chrome (AppBar GardenChip) declares
              garden context. Kept in hover-title above for accessibility. See Rule 17. */}
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-label-sm text-text-soft">{submittedAtText}</p>
          <span className="inline-flex shrink-0 text-text-soft transition-colors group-hover:text-primary-dark">
            <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
      </div>
    </button>
  );
}
