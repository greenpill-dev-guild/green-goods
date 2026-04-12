import {
  type Domain,
  DOMAIN_LABEL_IDS,
  cn,
  formatRelativeTime,
  resolveIPFSUrl,
  type Work,
} from "@green-goods/shared";
import { RiBookOpenLine, RiPlantLine, RiRecycleLine, RiSunLine } from "@remixicon/react";
import { type ComponentType, type SVGProps, useState } from "react";
import { useIntl } from "react-intl";

// ---------------------------------------------------------------------------
// Domain badge styles
// ---------------------------------------------------------------------------

interface DomainBadgeStyle {
  bg: string;
  text: string;
  Icon: ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;
}

const DOMAIN_BADGE_STYLES: Record<number, DomainBadgeStyle> = {
  0: { bg: "bg-warning-lighter", text: "text-warning-dark", Icon: RiSunLine }, // SOLAR
  1: { bg: "bg-success-lighter", text: "text-success-dark", Icon: RiPlantLine }, // AGRO
  2: { bg: "bg-information-lighter", text: "text-information-dark", Icon: RiBookOpenLine }, // EDU
  3: {
    bg: "bg-[rgb(var(--orange-100))]",
    text: "text-[rgb(var(--orange-700))]",
    Icon: RiRecycleLine,
  }, // WASTE
};

// ---------------------------------------------------------------------------
// Domain gradient fallbacks (when no images available)
// ---------------------------------------------------------------------------

const DOMAIN_GRADIENT_STYLES: Record<number, string> = {
  0: "from-yellow-100 to-yellow-50",
  1: "from-green-100 to-green-50",
  2: "from-blue-100 to-blue-50",
  3: "from-orange-100 to-orange-50",
};

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
        className="h-full w-full object-cover transition-transform duration-300 ease-out hover:scale-105 motion-reduce:hover:scale-100"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// DomainGradientFallback — shown when no images or image load fails
// ---------------------------------------------------------------------------

function DomainGradientFallback({ domain, className }: { domain?: Domain; className?: string }) {
  const gradientClasses =
    domain !== undefined
      ? (DOMAIN_GRADIENT_STYLES[domain] ?? "from-gray-100 to-gray-50")
      : "from-gray-100 to-gray-50";

  const badgeStyle = domain !== undefined ? DOMAIN_BADGE_STYLES[domain] : undefined;

  return (
    <div
      className={cn(
        "flex items-center justify-center bg-gradient-to-br",
        gradientClasses,
        className
      )}
    >
      {badgeStyle && <badgeStyle.Icon className="h-8 w-8 opacity-30" />}
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

  const badgeStyle = actionDomain !== undefined ? DOMAIN_BADGE_STYLES[actionDomain] : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group w-full cursor-pointer overflow-hidden rounded-[1.65rem] text-left",
        "bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(249,247,242,0.95)_100%)] dark:bg-bg-soft",
        "shadow-[var(--edge-rest),0_18px_38px_rgba(133,109,70,0.08)]",
        "transition-[transform,box-shadow,background-color] duration-200",
        "hover:-translate-y-1 hover:shadow-[var(--edge-hover),0_26px_48px_rgba(133,109,70,0.14)]",
        "active:translate-y-0 active:scale-[0.992]",
        "motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 motion-reduce:active:scale-100 motion-reduce:transition-none",
        "outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
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

        {badgeStyle && (
          <span
            className={cn(
              "absolute bottom-2 left-2 inline-flex items-center gap-1",
              "rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur-md",
              badgeStyle.bg,
              badgeStyle.text
            )}
          >
            <badgeStyle.Icon className="h-3 w-3" />
            {formatMessage({
              id: DOMAIN_LABEL_IDS[actionDomain!],
            })}
          </span>
        )}

        {totalMedia > 1 && (
          <span className="absolute bottom-2 right-2 inline-flex items-center rounded-full bg-black/45 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-md">
            1 / {totalMedia}
          </span>
        )}
      </div>

      <div className="space-y-3 p-4 sm:p-[1.125rem]">
        <div className="flex items-start justify-between gap-3">
          <h3
            className="min-w-0 flex-1 text-sm font-semibold leading-5 text-text-strong line-clamp-2 sm:text-[0.95rem]"
            title={title}
          >
            {title}
          </h3>
          <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.08em] text-text-soft">
            {formatRelativeTime(work.createdAt)}
          </span>
        </div>

        <div
          className="flex items-center justify-between gap-3 text-xs text-text-sub"
          title={`${gardenerDisplayName} · ${gardenName}`}
        >
          <div className="min-w-0">
            <p className="truncate font-medium text-text-sub">{gardenerDisplayName}</p>
            <p className="truncate text-text-soft">{gardenName}</p>
          </div>
          <span className="rounded-full bg-bg-soft/90 px-2.5 py-1 text-[11px] font-medium text-text-soft shadow-[inset_0_0_0_1px_rgb(0_0_0_/_0.04)] transition-colors group-hover:bg-bg-weak">
            {formatMessage({ id: "cockpit.hub.tab.review", defaultMessage: "Review" })}
          </span>
        </div>
      </div>
    </button>
  );
}
