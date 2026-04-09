import {
  type Domain,
  DOMAIN_LABEL_IDS,
  cn,
  formatRelativeTime,
  resolveIPFSUrl,
  type Work,
} from "@green-goods/shared";
import {
  RiBookOpenLine,
  RiPlantLine,
  RiRecycleLine,
  RiSunLine,
} from "@remixicon/react";
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
  3: { bg: "bg-[rgb(var(--orange-100))]", text: "text-[rgb(var(--orange-700))]", Icon: RiRecycleLine }, // WASTE
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

function DomainGradientFallback({
  domain,
  className,
}: {
  domain?: Domain;
  className?: string;
}) {
  const gradientClasses = domain !== undefined
    ? DOMAIN_GRADIENT_STYLES[domain] ?? "from-gray-100 to-gray-50"
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
        // Shape — Warm Glass concentric: outer 2xl
        "rounded-2xl bg-bg-white shadow-elevation-1 overflow-hidden cursor-pointer w-full text-left",
        // Hover lift (Warm Glass spec)
        "hover:scale-[1.008] hover:shadow-elevation-2",
        // Press
        "active:scale-[0.985]",
        // Transition
        "transition-all duration-150",
        // Reduced motion
        "motion-reduce:hover:scale-100 motion-reduce:active:scale-100 motion-reduce:transition-none",
        // Focus
        "outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
      )}
    >
      {/* Image gallery — 4:3 aspect, inner rounded-xl (concentric) */}
      <div className="relative">
        {totalMedia === 0 ? (
          <DomainGradientFallback
            domain={actionDomain}
            className="aspect-[4/3] rounded-t-xl"
          />
        ) : totalMedia === 1 ? (
          <ImageCell
            src={mediaUrls[0]}
            alt={title}
            eager={eagerImages}
            domain={actionDomain}
            className="aspect-[4/3]"
          />
        ) : (
          <div className="grid grid-cols-2 gap-0.5">
            <ImageCell
              src={mediaUrls[0]}
              alt={`${title} — 1`}
              eager={eagerImages}
              domain={actionDomain}
              className="aspect-[4/3]"
            />
            <ImageCell
              src={mediaUrls[1]}
              alt={`${title} — 2`}
              eager={eagerImages}
              domain={actionDomain}
              className="aspect-[4/3]"
            />
          </div>
        )}

        {/* Domain badge — bottom-left of image area */}
        {badgeStyle && (
          <span
            className={cn(
              "absolute bottom-2 left-2 inline-flex items-center gap-1",
              "rounded-full px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm",
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

        {/* Media count badge — bottom-right of image area */}
        {totalMedia > 1 && (
          <span className="absolute bottom-2 right-2 inline-flex items-center rounded-full bg-black/50 px-1.5 py-0.5 text-[11px] text-white backdrop-blur-sm">
            1 / {totalMedia}
          </span>
        )}
      </div>

      {/* Text area — compact p-3 */}
      <div className="p-3">
        <h3
          className="font-semibold text-sm text-text-strong line-clamp-2"
          title={title}
        >
          {title}
        </h3>
        <p className="mt-1 text-xs text-text-sub truncate" title={`${gardenerDisplayName} · ${gardenName}`}>
          {gardenerDisplayName} · {gardenName} · {formatRelativeTime(work.createdAt)}
        </p>
      </div>
    </button>
  );
}
