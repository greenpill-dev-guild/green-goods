import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import type {
  KarmaIntegrationController,
  KarmaIntegrationStatusName,
} from "@green-goods/shared/hooks/garden/useKarmaIntegration";
import { RiExternalLinkLine } from "@remixicon/react";
import { useId } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard } from "@/components/AdminCard";

interface KarmaStatusPresentation {
  badgeId: string;
  badgeDefault: string;
  bodyId: string;
  bodyDefault: string;
  variant: "success" | "warning" | "error" | "info" | "neutral";
}

const STATUS_PRESENTATION = {
  unsupported: {
    badgeId: "cockpit.garden.karma.status.unsupported",
    badgeDefault: "Unavailable",
    bodyId: "cockpit.garden.karma.body.unsupported",
    bodyDefault: "Karma sync is not available for this network.",
    variant: "neutral",
  },
  "upgrade-needed": {
    badgeId: "cockpit.garden.karma.status.upgradeNeeded",
    badgeDefault: "Migration needed",
    bodyId: "cockpit.garden.karma.body.upgradeNeeded",
    bodyDefault:
      "This legacy Garden account needs a reviewed compatibility migration before Karma can be repaired.",
    variant: "warning",
  },
  "no-project": {
    badgeId: "cockpit.garden.karma.status.noProject",
    badgeDefault: "No profile",
    bodyId: "cockpit.garden.karma.body.noProject",
    bodyDefault: "This Garden does not have a Karma profile yet.",
    variant: "warning",
  },
  "stale-details": {
    badgeId: "cockpit.garden.karma.status.staleDetails",
    badgeDefault: "Details pending",
    bodyId: "cockpit.garden.karma.body.staleDetails",
    bodyDefault: "Garden details changed and are waiting to be reflected on Karma.",
    variant: "warning",
  },
  "access-pending": {
    badgeId: "cockpit.garden.karma.status.accessPending",
    badgeDefault: "Access pending",
    bodyId: "cockpit.garden.karma.body.accessPending",
    bodyDefault: "Garden roles changed and Karma access still needs to catch up.",
    variant: "warning",
  },
  failed: {
    badgeId: "cockpit.garden.karma.status.failed",
    badgeDefault: "Sync failed",
    bodyId: "cockpit.garden.karma.body.failed",
    bodyDefault: "The last Karma sync did not finish. Your Garden data is safe and you can retry.",
    variant: "error",
  },
  retrying: {
    badgeId: "cockpit.garden.karma.status.retrying",
    badgeDefault: "Syncing",
    bodyId: "cockpit.garden.karma.body.retrying",
    bodyDefault: "Karma is reconciling the project, details, and role access.",
    variant: "info",
  },
  synced: {
    badgeId: "cockpit.garden.karma.status.synced",
    badgeDefault: "Synced",
    bodyId: "cockpit.garden.karma.body.synced",
    bodyDefault: "The Karma profile and Garden role access are current.",
    variant: "success",
  },
} satisfies Record<KarmaIntegrationStatusName, KarmaStatusPresentation>;

const RECONCILABLE_STATES = new Set<KarmaIntegrationStatusName>([
  "no-project",
  "stale-details",
  "access-pending",
  "failed",
]);

export interface KarmaIntegrationPanelProps {
  integration: KarmaIntegrationController;
}

export function KarmaIntegrationPanel({ integration }: KarmaIntegrationPanelProps) {
  const { formatMessage } = useIntl();
  const titleId = useId();

  if (integration.isLoading) {
    return (
      <AdminCard
        variant="elevated"
        density="compact"
        className="space-y-3"
        aria-hidden
        data-component="KarmaIntegrationPanel"
        data-state="loading"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="h-4 w-28 rounded skeleton-shimmer" />
          <div className="h-5 w-20 rounded-full skeleton-shimmer" />
        </div>
        <div className="h-8 rounded skeleton-shimmer" />
        <div className="h-8 w-32 rounded-full skeleton-shimmer" />
      </AdminCard>
    );
  }

  const presentation = STATUS_PRESENTATION[integration.status.status];
  const canRunReconcile =
    RECONCILABLE_STATES.has(integration.status.status) && integration.canReconcile;
  const showPendingAction = integration.status.status === "retrying" || integration.isPending;

  const run = (action: () => Promise<unknown>) => {
    void action().catch(() => undefined);
  };

  return (
    <AdminCard
      variant="elevated"
      density="compact"
      className="space-y-3"
      role="region"
      aria-labelledby={titleId}
      data-component="KarmaIntegrationPanel"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={titleId} className="label-md text-text-strong">
            {formatMessage({
              id: "cockpit.garden.karma.title",
              defaultMessage: "Karma integration",
            })}
          </h3>
          <p className="mt-1 text-xs text-text-soft">
            {formatMessage({
              id: "cockpit.garden.karma.description",
              defaultMessage:
                "Check the public Karma profile and repair project or role sync when needed.",
            })}
          </p>
        </div>
        <StatusBadge
          variant={presentation.variant}
          size="sm"
          aria-live={integration.status.status === "retrying" ? "off" : "polite"}
        >
          {formatMessage({
            id: presentation.badgeId,
            defaultMessage: presentation.badgeDefault,
          })}
        </StatusBadge>
      </div>

      <p className="text-sm text-text-sub">
        {formatMessage({
          id: presentation.bodyId,
          defaultMessage: presentation.bodyDefault,
        })}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {showPendingAction ? (
          <AdminButton type="button" variant="tonal" size="sm" loading disabled>
            {formatMessage({
              id: "cockpit.garden.karma.action.retrying",
              defaultMessage: "Syncing…",
            })}
          </AdminButton>
        ) : canRunReconcile ? (
          <AdminButton
            type="button"
            variant="tonal"
            size="sm"
            onClick={() => run(integration.reconcile)}
          >
            {formatMessage({
              id:
                integration.status.status === "failed"
                  ? "cockpit.garden.karma.action.retry"
                  : "cockpit.garden.karma.action.reconcile",
              defaultMessage:
                integration.status.status === "failed" ? "Retry Karma sync" : "Retry sync",
            })}
          </AdminButton>
        ) : null}

        {integration.profileUrl ? (
          <a
            href={integration.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="admin-hit-target inline-flex h-8 items-center gap-1 rounded-[var(--m3-shape-full)] px-2 text-label-sm font-medium text-[rgb(var(--tone-on-surface-accent,var(--m3-primary)))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))] focus-visible:ring-offset-2"
            aria-label={formatMessage({
              id: "cockpit.garden.karma.profileLinkLabel",
              defaultMessage: "Open This Garden's Karma Profile",
            })}
          >
            {formatMessage({
              id: "cockpit.garden.karma.profileLink",
              defaultMessage: "Open Karma Profile",
            })}
            <RiExternalLinkLine className="h-4 w-4" aria-hidden />
          </a>
        ) : null}
      </div>
    </AdminCard>
  );
}
