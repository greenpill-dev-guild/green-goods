import {
  Button,
  Card,
  DOMAIN_COLORS,
  DOMAIN_LABEL_IDS,
  type Domain,
  expandDomainMask,
  GardenBannerFallback,
  ImageWithFallback,
  resolveIPFSUrl,
  type TabBadgeSeverity,
  type TabBadgeState,
} from "@green-goods/shared";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard } from "@/components/AdminCard";
import { AdminTooltip } from "@/components/AdminTooltip";
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
import { ALERT_LABEL_CLASSES, BADGE_TONE_CLASSES } from "./gardenDetail.constants";

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

        <span className="absolute left-4 top-4 z-10">
          <AdminTooltip content={backLabel} placement="bottom-start">
            <Link
              to={backTo}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-static-black/40 text-static-white/80 transition hover:bg-static-black/55 hover:text-static-white sm:h-10 sm:w-10"
              aria-label={backLabel}
            >
              <RiArrowLeftLine className="h-5 w-5" />
            </Link>
          </AdminTooltip>
        </span>

        <div className="garden-hero-banner-content">
          <h1
            className="truncate font-heading text-lg font-semibold text-static-white sm:text-2xl"
            title={name}
          >
            {name}
          </h1>
          {description ? (
            <div className="mt-0.5 max-w-xl">
              <p
                className={`text-xs text-static-white/80 sm:text-sm ${
                  !descExpanded && isLongDescription ? "line-clamp-2" : ""
                }`}
                title={description}
              >
                {description}
              </p>
              {isLongDescription ? (
                <AdminButton
                  type="button"
                  variant="text"
                  size="sm"
                  onClick={() => setDescExpanded((prev) => !prev)}
                  className="mt-1 text-xs text-static-white/70 hover:text-static-white/90"
                >
                  {descExpanded
                    ? formatMessage({ id: "app.common.showLess", defaultMessage: "Show less" })
                    : formatMessage({ id: "app.common.showMore", defaultMessage: "Show more" })}
                </AdminButton>
              ) : null}
            </div>
          ) : null}
          {domains.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {domains.map((domain) => (
                <span
                  key={domain}
                  className="inline-flex items-center gap-1.5 rounded-full bg-static-white/20 px-2.5 py-0.5 text-xs font-medium text-static-white"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: DOMAIN_COLORS[domain] }}
                  />
                  {formatMessage({ id: DOMAIN_LABEL_IDS[domain] })}
                </span>
              ))}
              {canManage && onEditDomains ? (
                <AdminTooltip content={formatMessage({ id: "app.garden.detail.editDomains" })}>
                  <AdminButton
                    type="button"
                    variant="text"
                    size="sm"
                    onClick={onEditDomains}
                    className="h-6 w-6 min-w-0 rounded-full bg-static-white/20 p-0 text-static-white/80 hover:bg-static-white/30 hover:text-static-white"
                    aria-label={formatMessage({ id: "app.garden.detail.editDomains" })}
                  >
                    <RiPencilLine className="h-3 w-3" />
                  </AdminButton>
                </AdminTooltip>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {children}
    </div>
  );
}

interface GardenDomainSummaryRowProps {
  domainMask?: number;
}

export function GardenDomainSummaryRow({ domainMask }: GardenDomainSummaryRowProps) {
  const { formatMessage } = useIntl();
  const domains: Domain[] = typeof domainMask === "number" ? expandDomainMask(domainMask) : [];

  return (
    <div className="flex flex-col gap-3 border-b border-stroke-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <p className="label-xs text-text-soft">
          {formatMessage({ id: "app.garden.detail.domains" })}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {domains.length > 0 ? (
            domains.map((domain) => (
              <span
                key={domain}
                className="inline-flex items-center gap-1.5 rounded-full border border-stroke-soft bg-bg-white px-2.5 py-1 text-xs font-medium text-text-strong"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: DOMAIN_COLORS[domain] }}
                />
                {formatMessage({ id: DOMAIN_LABEL_IDS[domain] })}
              </span>
            ))
          ) : (
            <span className="inline-flex items-center rounded-full border border-warning-light bg-warning-lighter px-2.5 py-1 text-xs font-medium text-warning-dark">
              {formatMessage({ id: "app.garden.detail.domainsNone" })}
            </span>
          )}
        </div>
      </div>
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
    <AdminCard variant="outlined" className="flex items-start justify-between gap-3 px-3 py-2.5">
      <div className="flex min-w-0 items-start gap-2">
        <RiAlertLine className={`mt-0.5 h-4 w-4 flex-shrink-0 ${ALERT_LABEL_CLASSES[severity]}`} />
        <p className="text-sm text-text-sub">{label}</p>
      </div>
      <AdminButton type="button" variant="text" size="sm" onClick={onAction} className="gap-1 px-0">
        {actionLabel}
        <RiArrowRightSLine className="h-4 w-4" />
      </AdminButton>
    </AdminCard>
  );
}
