import { DEFAULT_CHAIN_ID, useActions, useGardens } from "@green-goods/shared";
import { RiArrowRightSLine } from "@remixicon/react";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { Link, useLocation } from "react-router-dom";

/** Static route label i18n keys, keyed by first path segment. */
const ROUTE_LABELS: Record<string, { id: string; defaultMessage: string }> = {
  dashboard: { id: "app.admin.nav.dashboard", defaultMessage: "Dashboard" },
  gardens: { id: "app.admin.nav.gardens", defaultMessage: "Gardens" },
  endowments: { id: "app.admin.nav.treasury", defaultMessage: "Endowments" },
  actions: { id: "app.admin.nav.actions", defaultMessage: "Actions" },
  contracts: { id: "app.admin.nav.contracts", defaultMessage: "Contracts" },
  deployment: { id: "app.admin.nav.deployment", defaultMessage: "Deployment" },
};

/** Sub-route labels for known child segments. */
const SUB_ROUTE_LABELS: Record<string, { id: string; defaultMessage: string }> = {
  create: { id: "app.admin.nav.create", defaultMessage: "Create" },
  edit: { id: "app.admin.nav.edit", defaultMessage: "Edit" },
  assessments: { id: "app.admin.nav.assessments", defaultMessage: "Assessments" },
  hypercerts: { id: "app.admin.nav.hypercerts", defaultMessage: "Hypercerts" },
  vault: { id: "app.admin.nav.vault", defaultMessage: "Vault" },
  "cookie-jars": { id: "app.admin.nav.cookieJars", defaultMessage: "Cookie Jars" },
  strategies: { id: "app.admin.nav.strategies", defaultMessage: "Strategies" },
  "signal-pool": { id: "app.admin.nav.signalPool", defaultMessage: "Signal Pool" },
  work: { id: "app.admin.nav.work", defaultMessage: "Work" },
};

interface BreadcrumbSegment {
  label: string;
  href: string;
}

export function Breadcrumbs() {
  const location = useLocation();
  const { pathname } = location;
  const { formatMessage } = useIntl();
  const { data: gardens } = useGardens();
  const { data: actions } = useActions(DEFAULT_CHAIN_ID);
  const routeState =
    (location.state as { returnTo?: string; returnLabelId?: string } | null) ?? null;

  const segments = useMemo(() => {
    if (routeState?.returnTo && /^\/gardens\/[^/]+\/vault$/.test(pathname)) {
      const returnRoot = routeState.returnTo.split("/").filter(Boolean)[0];
      const returnRouteLabel = returnRoot ? ROUTE_LABELS[returnRoot] : undefined;
      const returnLabel = routeState.returnLabelId
        ? formatMessage({
            id: routeState.returnLabelId,
            defaultMessage: returnRouteLabel?.defaultMessage ?? "Back",
          })
        : returnRouteLabel
          ? formatMessage(returnRouteLabel)
          : routeState.returnTo;

      return [
        { label: returnLabel, href: routeState.returnTo },
        { label: formatMessage(SUB_ROUTE_LABELS.vault), href: pathname },
      ];
    }

    const parts = pathname.split("/").filter(Boolean);
    if (parts.length === 0) return [];

    const result: BreadcrumbSegment[] = [];
    let href = "";

    for (let i = 0; i < parts.length; i++) {
      const segment = parts[i];
      href += `/${segment}`;

      // Top-level route
      if (i === 0) {
        const routeLabel = ROUTE_LABELS[segment];
        if (routeLabel) {
          result.push({ label: formatMessage(routeLabel), href });
        }
        continue;
      }

      // Known sub-route keywords
      const subLabel = SUB_ROUTE_LABELS[segment];
      if (subLabel) {
        result.push({ label: formatMessage(subLabel), href });
        continue;
      }

      // Dynamic ID segment — resolve from data
      const parentSegment = parts[i - 1];
      if (parentSegment === "gardens") {
        const garden = gardens?.find((g) => g.id === segment);
        result.push({ label: garden?.name ?? segment, href });
        continue;
      }

      if (parentSegment === "actions") {
        const action = actions?.find((a) => a.id === segment);
        result.push({ label: action?.title ?? segment, href });
        continue;
      }

      // Nested ID under a garden sub-route (e.g., /gardens/:id/work/:workId)
      // or /gardens/:id/hypercerts/:hypercertId — just show the raw ID truncated
      result.push({ label: segment.length > 12 ? `${segment.slice(0, 8)}...` : segment, href });
    }

    return result;
  }, [pathname, gardens, actions, formatMessage, routeState?.returnLabelId, routeState?.returnTo]);

  if (segments.length <= 1) return null;

  return (
    <nav
      aria-label={formatMessage({ id: "app.admin.nav.breadcrumb", defaultMessage: "Breadcrumb" })}
    >
      <ol className="flex items-center gap-1 text-sm min-w-0">
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          // On mobile (< lg), show only the last 2 segments
          const mobileStart = Math.max(0, segments.length - 2);
          const hiddenOnMobile = index < mobileStart;
          // Hide the separator arrow when this is the first visible mobile segment
          const hideArrowOnMobile = !hiddenOnMobile && index === mobileStart && mobileStart > 0;

          return (
            <li
              key={segment.href}
              className={`flex items-center gap-1 min-w-0${hiddenOnMobile ? " hidden lg:flex" : ""}`}
            >
              {index > 0 && (
                <RiArrowRightSLine
                  className={`h-4 w-4 shrink-0 text-text-soft${hideArrowOnMobile ? " hidden lg:block" : ""}`}
                  aria-hidden="true"
                />
              )}
              {isLast ? (
                <span
                  className="truncate font-medium text-text-strong"
                  title={segment.label}
                  aria-current="page"
                >
                  {segment.label}
                </span>
              ) : (
                <Link
                  to={segment.href}
                  className="truncate text-text-sub hover:text-text-strong transition-colors"
                  title={segment.label}
                >
                  {segment.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
