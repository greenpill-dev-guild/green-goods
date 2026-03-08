import {
  DOMAIN_COLORS,
  type Domain,
  expandDomainMask,
  GardenBannerFallback,
  ImageWithFallback,
  resolveIPFSUrl,
} from "@green-goods/shared";
import {
  RiAlertLine,
  RiArrowLeftLine,
  RiArrowRightSLine,
  RiCloseLine,
  RiPencilLine,
} from "@remixicon/react";
import { type ReactNode, useState } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  ALERT_LABEL_CLASSES,
  BADGE_TONE_CLASSES,
  DOMAIN_LABEL_IDS,
} from "./gardenDetail.constants";
import type { TabBadgeSeverity, TabBadgeState } from "./gardenDetail.types";

export function TabBadge({ badge }: { badge: TabBadgeState }) {
  if (badge.severity === "none" || !badge.count) {
    return null;
  }

  return (
    <span
      className={`ml-2 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${BADGE_TONE_CLASSES[badge.severity]}`}
    >
      {badge.count}
    </span>
  );
}

interface GardenHeroBannerProps {
  name: string;
  description?: string;
  bannerImage?: string;
  domainMask?: number;
  backTo: string;
  backLabel: string;
  canManage: boolean;
  onEditDomains?: () => void;
  children?: ReactNode;
}

export function GardenHeroBanner({
  name,
  description,
  bannerImage,
  domainMask,
  backTo,
  backLabel,
  canManage,
  onEditDomains,
  children,
}: GardenHeroBannerProps) {
  const { formatMessage } = useIntl();
  const [descExpanded, setDescExpanded] = useState(false);
  const bannerUrl = bannerImage ? resolveIPFSUrl(bannerImage) : "";
  const domains: Domain[] = typeof domainMask === "number" ? expandDomainMask(domainMask) : [];
  const isLongDescription = Boolean(description && description.length > 100);

  return (
    <div>
      <div className="garden-hero-banner">
        <ImageWithFallback
          src={bannerUrl}
          alt={formatMessage({ id: "app.garden.detail.bannerAlt" }, { name })}
          className="garden-hero-banner-image"
          backgroundFallback={
            <div className="garden-hero-banner-fallback">
              <GardenBannerFallback name={name} />
            </div>
          }
        />
        <div className="garden-hero-banner-gradient" />

        <Link
          to={backTo}
          className="absolute left-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-lg bg-black/30 text-white/80 backdrop-blur-sm transition hover:bg-black/50 hover:text-white sm:h-10 sm:w-10"
          aria-label={backLabel}
        >
          <RiArrowLeftLine className="h-5 w-5" />
        </Link>

        <div className="garden-hero-banner-content">
          <h1
            className="truncate font-heading text-lg font-semibold text-white sm:text-2xl"
            title={name}
          >
            {name}
          </h1>
          {description ? (
            <div className="mt-0.5 max-w-xl">
              <p
                className={`text-xs text-white/80 sm:text-sm ${
                  !descExpanded && isLongDescription ? "line-clamp-2" : ""
                }`}
                title={description}
              >
                {description}
              </p>
              {isLongDescription ? (
                <button
                  type="button"
                  onClick={() => setDescExpanded((prev) => !prev)}
                  className="mt-1 text-xs text-white/70 hover:text-white/90 transition-colors"
                >
                  {descExpanded
                    ? formatMessage({ id: "app.common.showLess", defaultMessage: "Show less" })
                    : formatMessage({ id: "app.common.showMore", defaultMessage: "Show more" })}
                </button>
              ) : null}
            </div>
          ) : null}
          {domains.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {domains.map((domain) => (
                <span
                  key={domain}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: DOMAIN_COLORS[domain] }}
                  />
                  {formatMessage({ id: DOMAIN_LABEL_IDS[domain] })}
                </span>
              ))}
              {canManage && onEditDomains ? (
                <button
                  type="button"
                  onClick={onEditDomains}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white/80 backdrop-blur-sm transition hover:bg-white/30 hover:text-white"
                  aria-label={formatMessage({ id: "app.garden.detail.editDomains" })}
                >
                  <RiPencilLine className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {children}
    </div>
  );
}

interface SectionStateProps {
  title: string;
  description: string;
  closeLabel: string;
  onClose: () => void;
}

export function SectionStateCard({ title, description, closeLabel, onClose }: SectionStateProps) {
  return (
    <Card colorAccent="info">
      <Card.Body className="flex items-start justify-between gap-3">
        <div>
          <h3 className="label-md text-text-strong">{title}</h3>
          <p className="mt-1 text-sm text-text-sub">{description}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label={closeLabel}>
          <RiCloseLine className="h-4 w-4" />
        </Button>
      </Card.Body>
    </Card>
  );
}

interface AlertRowProps {
  severity: Exclude<TabBadgeSeverity, "none">;
  label: string;
  actionLabel: string;
  onAction: () => void;
}

export function AlertRow({ severity, label, actionLabel, onAction }: AlertRowProps) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-stroke-soft bg-bg-weak px-3 py-2.5">
      <div className="flex min-w-0 items-start gap-2">
        <RiAlertLine className={`mt-0.5 h-4 w-4 flex-shrink-0 ${ALERT_LABEL_CLASSES[severity]}`} />
        <p className="text-sm text-text-sub">{label}</p>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary-base hover:text-primary-darker"
      >
        {actionLabel}
        <RiArrowRightSLine className="h-4 w-4" />
      </button>
    </div>
  );
}
