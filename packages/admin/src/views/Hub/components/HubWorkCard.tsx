import {
  type Domain,
  DOMAIN_CONFIG,
  DomainBadge,
  cn,
  formatRelativeTime,
  resolveIPFSUrl,
  type Work,
} from "@green-goods/shared";
import { useState } from "react";
import { useIntl } from "react-intl";
import { adminCardVariants } from "@/components/AdminCard";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface HubWorkCardProps {
  work: Work;
  /** Domain for the badge; undefined = hide badge */
  actionDomain?: Domain;
  gardenName: string;
  /** Pre-resolved ENS name or formatted address */
  gardenerDisplayName: string;
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
        className="h-full w-full object-cover transition-transform duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)] hover:scale-105 motion-reduce:hover:scale-100"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// DomainGradientFallback — shown when no images or image load fails
// ---------------------------------------------------------------------------

function DomainGradientFallback({ domain, className }: { domain?: Domain; className?: string }) {
  const config = domain !== undefined ? DOMAIN_CONFIG[domain] : undefined;
  const gradientClasses = config
    ? `${config.gradient.from} ${config.gradient.to}`
    : "from-gray-100 to-gray-50";

  return (
    <div
      className={cn(
        "flex items-center justify-center bg-gradient-to-br",
        gradientClasses,
        className
      )}
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
  gardenName,
  gardenerDisplayName,
  eagerImages,
  onClick,
}: HubWorkCardProps) {
  const { formatMessage } = useIntl();
  const mediaUrls = work.media ?? [];
  const totalMedia = mediaUrls.length;

  const title =
    work.title ||
    formatMessage({ id: "app.admin.work.untitledWork", defaultMessage: "Untitled Work" });

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        adminCardVariants({ variant: "elevated", interactive: true }),
        "group block w-full overflow-hidden text-left",
        "active:translate-y-0 active:scale-[0.992]",
        "motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 motion-reduce:active:scale-100 motion-reduce:transition-none",
        "outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ws-primary,var(--primary-base)))] focus-visible:ring-offset-2"
      )}
    >
      <div className="relative overflow-hidden border-b border-black/5">
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
          <div className="grid aspect-[16/9] grid-cols-2 gap-0.5">
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
          <div className="grid aspect-[16/9] grid-cols-[1.35fr_1fr] gap-0.5">
            <ImageCell
              src={mediaUrls[0]}
              alt={`${title} — 1`}
              eager={eagerImages}
              domain={actionDomain}
              className="h-full"
            />
            <div className="grid h-full gap-0.5">
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

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/8 via-transparent to-white/10 opacity-80" />

        {actionDomain !== undefined && (
          <DomainBadge domain={actionDomain} size="sm" className="absolute bottom-2 left-2" />
        )}

        {totalMedia > 1 && (
          <span className="absolute bottom-2 right-2 inline-flex items-center rounded-full bg-static-black/60 px-2 py-1 text-[11px] font-medium text-static-white">
            1 / {totalMedia}
          </span>
        )}
      </div>

      <div className="space-y-3 p-4 sm:p-[1.125rem]">
        <div className="flex items-start justify-between gap-3">
          <h3
            className="min-w-0 flex-1 text-title-sm font-semibold leading-5 text-text-strong line-clamp-2"
            title={title}
          >
            {title}
          </h3>
          <span className="shrink-0 text-label-sm font-medium uppercase text-text-soft">
            {formatRelativeTime(work.createdAt)}
          </span>
        </div>

        <div
          className="flex items-center justify-between gap-3 text-body-sm text-text-sub"
          title={`${gardenerDisplayName} · ${gardenName}`}
        >
          <div className="min-w-0">
            <p className="truncate text-body-sm font-medium text-text-sub">{gardenerDisplayName}</p>
            <p className="truncate text-body-sm text-text-soft">{gardenName}</p>
          </div>
          <span className="rounded-full bg-bg-soft/90 px-2.5 py-1 text-label-sm font-medium text-text-soft shadow-[inset_0_0_0_1px_rgb(0_0_0_/_0.04)] transition-colors group-hover:bg-bg-weak">
            {formatMessage({ id: "cockpit.hub.tab.review", defaultMessage: "Review" })}
          </span>
        </div>
      </div>
    </button>
  );
}
