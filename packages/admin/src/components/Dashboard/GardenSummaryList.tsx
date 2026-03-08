import {
  cn,
  Domain,
  formatRelativeTime,
  ImageWithFallback,
  resolveIPFSUrl,
  type Garden,
} from "@green-goods/shared";
import { RiArrowRightLine, RiUserLine } from "@remixicon/react";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";

const DOMAIN_LABELS: Record<Domain, string> = {
  [Domain.SOLAR]: "Solar",
  [Domain.AGRO]: "Agro",
  [Domain.EDU]: "Edu",
  [Domain.WASTE]: "Waste",
};

const DOMAIN_DOT_COLORS: Record<Domain, string> = {
  [Domain.SOLAR]: "bg-yellow-400",
  [Domain.AGRO]: "bg-green-500",
  [Domain.EDU]: "bg-blue-500",
  [Domain.WASTE]: "bg-orange-500",
};

/** Extract enabled domains from a bitmask (bit 0=Solar, 1=Agro, 2=Edu, 3=Waste) */
function getEnabledDomains(mask?: number): Domain[] {
  if (!mask) return [];
  const domains: Domain[] = [];
  for (const d of [Domain.SOLAR, Domain.AGRO, Domain.EDU, Domain.WASTE]) {
    if (mask & (1 << d)) domains.push(d);
  }
  return domains;
}

interface GardenSummaryListProps {
  gardens: Garden[];
  maxItems?: number;
  viewAllLink?: string;
  className?: string;
}

export function GardenSummaryList({
  gardens,
  maxItems = 8,
  viewAllLink = "/gardens",
  className,
}: GardenSummaryListProps) {
  const intl = useIntl();

  // Memoize slicing to avoid creating new arrays on every render (Phase 5)
  const displayGardens = useMemo(() => gardens.slice(0, maxItems), [gardens, maxItems]);

  return (
    <Card className={className}>
      <Card.Header>
        <h2 className="text-base font-semibold text-text-strong">
          {intl.formatMessage({
            id: "admin.dashboard.recentGardens",
            defaultMessage: "Recent Gardens",
          })}
        </h2>
        <Link
          to={viewAllLink}
          className="flex items-center gap-1 text-sm font-medium text-primary-base hover:text-primary-dark transition-colors"
        >
          {intl.formatMessage({
            id: "admin.dashboard.viewAll",
            defaultMessage: "View All",
          })}
          <RiArrowRightLine className="h-4 w-4" />
        </Link>
      </Card.Header>
      <div className="divide-y divide-stroke-soft">
        {displayGardens.map((garden) => {
          const resolvedBanner = garden.bannerImage ? resolveIPFSUrl(garden.bannerImage) : null;
          const operatorCount = garden.operators?.length ?? 0;
          const gardenerCount = garden.gardeners?.length ?? 0;
          const evaluatorCount = garden.evaluators?.length ?? 0;
          const memberCount = operatorCount + gardenerCount + evaluatorCount;
          const isActive = garden.createdAt > 0;
          const enabledDomains = getEnabledDomains(garden.domainMask);

          // Tooltip with role breakdown
          const memberTooltip = intl.formatMessage(
            {
              id: "admin.dashboard.garden.memberBreakdown",
              defaultMessage:
                "{operators} {operators, plural, one {operator} other {operators}}, {gardeners} {gardeners, plural, one {gardener} other {gardeners}}, {evaluators} {evaluators, plural, one {evaluator} other {evaluators}}",
            },
            {
              operators: operatorCount,
              gardeners: gardenerCount,
              evaluators: evaluatorCount,
            }
          );

          // Accessible label
          const ariaLabel = intl.formatMessage(
            {
              id: "admin.dashboard.garden.ariaLabel",
              defaultMessage: "{name} garden in {location} — {memberCount} members",
            },
            {
              name: garden.name,
              location:
                garden.location ||
                intl.formatMessage({
                  id: "admin.dashboard.noLocation",
                  defaultMessage: "No location",
                }),
              memberCount,
            }
          );

          return (
            <Link
              key={garden.id}
              to={`/gardens/${garden.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-bg-weak transition-colors"
              aria-label={ariaLabel}
            >
              {/* Thumbnail */}
              <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg">
                {resolvedBanner ? (
                  <ImageWithFallback
                    src={resolvedBanner}
                    alt={garden.name}
                    className="h-10 w-10 object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center bg-primary-lighter text-primary-dark font-semibold text-sm rounded-lg">
                    {garden.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Name + Location + Creation date */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-strong" title={garden.name}>
                  {garden.name}
                </p>
                <p className="truncate text-xs text-text-soft">
                  <span title={garden.location || undefined}>
                    {garden.location ||
                      intl.formatMessage({
                        id: "admin.dashboard.noLocation",
                        defaultMessage: "No location",
                      })}
                  </span>
                  {garden.createdAt > 0 && (
                    <>
                      {" · "}
                      <span>{formatRelativeTime(garden.createdAt)}</span>
                    </>
                  )}
                </p>
              </div>

              {/* Domain dots */}
              {enabledDomains.length > 0 && (
                <div
                  className="flex items-center gap-0.5"
                  title={enabledDomains.map((d) => DOMAIN_LABELS[d]).join(", ")}
                >
                  {enabledDomains.map((d) => (
                    <div key={d} className={cn("h-2 w-2 rounded-full", DOMAIN_DOT_COLORS[d])} />
                  ))}
                </div>
              )}

              {/* Member count with tooltip */}
              <div className="flex items-center gap-1 text-xs text-text-soft" title={memberTooltip}>
                <RiUserLine className="h-3.5 w-3.5" />
                <span>{memberCount}</span>
              </div>

              {/* Status dot */}
              <div
                className={cn(
                  "h-2.5 w-2.5 flex-shrink-0 rounded-full",
                  isActive ? "bg-success-base" : "bg-text-soft"
                )}
                title={
                  isActive
                    ? intl.formatMessage({
                        id: "admin.dashboard.gardenStatus.active",
                        defaultMessage: "Active",
                      })
                    : intl.formatMessage({
                        id: "admin.dashboard.gardenStatus.inactive",
                        defaultMessage: "Inactive",
                      })
                }
              />
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
