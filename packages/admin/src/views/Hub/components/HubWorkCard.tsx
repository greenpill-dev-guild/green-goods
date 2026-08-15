import {
  type Domain,
  DOMAIN_CONFIG,
  cn,
  formatRelativeTime,
  resolveIPFSUrl,
  stripGeneratedWorkTitleTimestamp,
  type Work,
} from "@green-goods/shared";
import { useState, type CSSProperties } from "react";
import { useIntl } from "react-intl";
import { adminCardVariants } from "@/components/AdminCard";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type HubWorkCardStatusTone = "neutral" | "success" | "warning" | "error";

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
  /**
   * Semantic pair for the status chip (success/warning/error lighter bg + dark
   * fg; neutral = the stone chip). Defaults from work.status: approved reads
   * success, everything else neutral.
   */
  statusTone?: HubWorkCardStatusTone;
  selected?: boolean;
  /** true for first 6 cards (above the fold) */
  eagerImages?: boolean;
  onClick?: () => void;
}

// Status chip — 1a spec: pill, 3px 10px, 11px/600, semantic lighter bg + dark
// fg pair; the neutral state is the warm stone chip.
const STATUS_CHIP_TONE_CLASSES: Record<HubWorkCardStatusTone, string> = {
  neutral: "bg-[rgb(var(--m3-surface-container-high))] text-[rgb(var(--m3-on-surface-variant))]",
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
  statusTone,
  selected = false,
  eagerImages,
  onClick,
}: HubWorkCardProps) {
  const { formatMessage } = useIntl();
  const mediaUrls = work.media ?? [];
  const totalMedia = mediaUrls.length;
  const submittedAgoText = formatRelativeTime(work.createdAt);
  const resolvedStatusLabel =
    statusLabel ??
    (work.status === "approved"
      ? formatMessage({ id: "app.admin.work.filter.approved", defaultMessage: "Approved" })
      : formatMessage({ id: "app.admin.work.filter.pending", defaultMessage: "Pending" }));
  const resolvedStatusTone: HubWorkCardStatusTone =
    statusTone ?? (work.status === "approved" ? "success" : "neutral");
  const domainConfig = actionDomain !== undefined ? DOMAIN_CONFIG[actionDomain] : undefined;

  const rawTitle =
    work.title ||
    formatMessage({ id: "app.admin.work.untitledWork", defaultMessage: "Untitled Work" });
  const title = stripGeneratedWorkTitleTimestamp(rawTitle, actionTitle) || rawTitle;

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

        {/* Domain chip — 1a spec: white/90 pill bottom-left, 11px/600 neutral ink
            (never domain- or tone-colored on the card surface). */}
        {domainConfig && (
          <span className="absolute bottom-2 left-2 inline-flex items-center rounded-full bg-[rgb(var(--admin-surface-0)/0.9)] px-2.5 py-[3px] text-label-sm font-semibold text-[rgb(var(--m3-on-surface-variant))]">
            {formatMessage({ id: domainConfig.labelId })}
          </span>
        )}

        {totalMedia > 1 && (
          <span className="absolute bottom-2 right-2 inline-flex items-center rounded-full bg-static-black/60 px-2 py-1 text-label-sm font-medium text-static-white">
            1 / {totalMedia}
          </span>
        )}
      </div>

      {/* Body — 14px padding, 10px column gap (1a card anatomy). */}
      <div
        className="space-y-2.5 p-3.5"
        title={actionTitle ? `${actionTitle} · ${gardenName}` : gardenName}
      >
        <div className="flex items-start justify-between gap-2.5">
          <h3
            className="min-w-0 flex-1 text-title-sm font-semibold leading-5 text-text-strong line-clamp-2"
            title={title}
          >
            {title}
          </h3>
          <span
            className={cn(
              "inline-flex shrink-0 rounded-full px-2.5 py-[3px] text-label-sm font-semibold",
              STATUS_CHIP_TONE_CLASSES[resolvedStatusTone]
            )}
          >
            {resolvedStatusLabel}
          </span>
        </div>

        {/* Meta row — gardener (500, sub ink) · relative timestamp (soft ink).
            Garden name lives in the hover title only; chrome declares garden
            context (Frontend Rule 17). */}
        <div className="flex items-center justify-between gap-3 text-label-md">
          <p className="min-w-0 truncate font-medium text-text-sub" title={gardenerDisplayName}>
            {gardenerDisplayName}
          </p>
          <p className="shrink-0 text-text-soft">{submittedAgoText}</p>
        </div>
      </div>
    </button>
  );
}
