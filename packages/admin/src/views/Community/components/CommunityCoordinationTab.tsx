import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import { Button } from "@green-goods/shared/components/Button";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import type { CommunityWorkspace } from "@green-goods/shared/hooks/admin-ui/community/useCommunityWorkspaceController";
import {
  PoolType,
  WEIGHT_SCHEME_VALUES,
  WeightScheme,
} from "@green-goods/shared/types/gardens-community";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import {
  RiArrowRightSLine,
  RiCheckLine,
  RiErrorWarningLine,
  RiLoader4Line,
  RiQuestionLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { AdminCard, AdminCardTitle } from "@/components/AdminCard";
import { GovernancePanel } from "./GovernancePanel";

export type CommunityCoordinationTabProps = Pick<
  CommunityWorkspace,
  | "canManage"
  | "community"
  | "createPools"
  | "gardenId"
  | "isCreatingPools"
  | "pools"
  | "poolsRead"
  | "poolsUnread"
  | "rereadPools"
> & {
  garden: NonNullable<CommunityWorkspace["garden"]>;
};

export function CommunityCoordinationTab({
  garden,
  gardenId,
  canManage,
  community,
  pools,
  poolsRead,
  poolsUnread,
  rereadPools,
  createPools,
  isCreatingPools,
}: CommunityCoordinationTabProps) {
  const { formatMessage } = useIntl();
  const gardenRouteContext = { gardenId: garden.id };
  const hypercertPool = pools.find((pool) => pool.poolType === PoolType.HypercertSignal);
  const actionPool = pools.find((pool) => pool.poolType === PoolType.ActionSignal);
  const communityConfig = community as { weightScheme?: number } | null | undefined;
  const weightScheme =
    typeof communityConfig?.weightScheme === "number"
      ? (communityConfig.weightScheme as WeightScheme)
      : undefined;
  const weightSchemeLabel =
    weightScheme !== undefined && WeightScheme[weightScheme]
      ? WeightScheme[weightScheme].toLowerCase()
      : undefined;
  const weightSchemeValues =
    weightScheme !== undefined ? WEIGHT_SCHEME_VALUES[weightScheme] : undefined;

  return (
    <div className="garden-tab-shell">
      <div className="garden-tab-layout">
        <div className="garden-tab-main">
          <AdminCard variant="elevated" className="space-y-4">
            <div>
              <AdminCardTitle>
                {formatMessage({ id: "cockpit.community.coordination.proposals" })}
              </AdminCardTitle>
              <p className="mt-1 type-body text-text-sub">
                {formatMessage({ id: "cockpit.community.coordination.proposalsDescription" })}
              </p>
            </div>
            {poolsUnread ? (
              <EmptyState
                tone="error"
                icon={<RiErrorWarningLine />}
                title={formatMessage({ id: "app.conviction.loadError.title" })}
                description={formatMessage({ id: "app.conviction.loadError.description" })}
                action={
                  <Button type="button" emphasis="secondary" size="compact" onClick={rereadPools}>
                    {formatMessage({ id: "app.common.retry" })}
                  </Button>
                }
              />
            ) : poolsRead ? (
              <GovernancePanel pools={pools} gardenId={gardenId} />
            ) : (
              <EmptyState
                busy
                icon={<RiLoader4Line className="animate-spin motion-reduce:animate-none" />}
                title={formatMessage({ id: "app.signal.loading" })}
              />
            )}
          </AdminCard>
        </div>

        <aside className="garden-tab-rail">
          <div className="garden-tab-rail-sticky">
            <AdminCard variant="filled" className="space-y-3">
              <AdminCardTitle>
                {formatMessage({ id: "cockpit.community.coordination.status" })}
              </AdminCardTitle>
              <FactList frame="inset">
                <FactRow
                  label={formatMessage({ id: "cockpit.community.coordination.community" })}
                  value={
                    <span className="inline-flex items-center gap-1">
                      {communityConfig ? (
                        <RiCheckLine className="h-4 w-4 text-success-dark" />
                      ) : (
                        <RiQuestionLine className="h-4 w-4 text-text-sub" />
                      )}
                      {communityConfig
                        ? formatMessage({ id: "app.community.statusConnected" })
                        : formatMessage({ id: "app.community.statusNotConnected" })}
                    </span>
                  }
                />
              </FactList>

              {weightScheme !== undefined && weightSchemeLabel && weightSchemeValues ? (
                <AdminCard variant="outlined" density="compact">
                  <p className="type-meta-sm text-text-sub">
                    {formatMessage({ id: "app.community.weightScheme" })}
                  </p>
                  <p className="mt-1 type-title-sm font-semibold text-text-strong">
                    {formatMessage({ id: `app.community.weightScheme.${weightSchemeLabel}` })}
                  </p>
                  <p className="mt-1 type-body text-text-sub">
                    {formatMessage(
                      { id: "cockpit.community.coordination.weightSummary" },
                      {
                        community: weightSchemeValues.community / 10_000,
                        gardener: weightSchemeValues.gardener / 10_000,
                        steward: weightSchemeValues.steward / 10_000,
                      }
                    )}
                  </p>
                </AdminCard>
              ) : null}

              <div className="space-y-2">
                {[hypercertPool, actionPool].map((pool, index) => {
                  const labelId =
                    index === 0
                      ? "app.community.poolType.hypercert"
                      : "app.community.poolType.action";
                  const linkTarget =
                    index === 0
                      ? adminRoutes.communityCoordinationSignalPool("hypercert", gardenRouteContext)
                      : adminRoutes.communityCoordinationSignalPool("action", gardenRouteContext);
                  return (
                    <AdminCard key={labelId} variant="outlined" density="compact">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="type-meta-sm text-text-sub">
                            {formatMessage({ id: labelId })}
                          </p>
                          <div className="mt-1 type-meta text-text-strong">
                            {pool ? (
                              <AddressDisplay address={pool.poolAddress} className="type-body" />
                            ) : poolsRead ? (
                              formatMessage({ id: "cockpit.community.coordination.poolMissing" })
                            ) : (
                              "—"
                            )}
                          </div>
                        </div>
                        {pool ? (
                          <Link
                            to={linkTarget}
                            aria-label={formatMessage({ id: "app.actions.view" })}
                            className="mt-0.5 text-[rgb(var(--tone-on-surface-accent,var(--primary-base)))]"
                          >
                            <RiArrowRightSLine className="h-4 w-4" />
                          </Link>
                        ) : null}
                      </div>
                    </AdminCard>
                  );
                })}
              </div>

              {/* An unread list is not an empty one: offer creation only once it has been read. */}
              {canManage && communityConfig && poolsRead && pools.length === 0 ? (
                <Button
                  type="button"
                  emphasis="secondary"
                  size="compact"
                  onClick={createPools}
                  disabled={isCreatingPools}
                  loading={isCreatingPools}
                  className="w-full"
                >
                  {formatMessage({ id: "app.community.createPools" })}
                </Button>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild emphasis="tertiary" size="compact" className="px-0">
                  <Link to={adminRoutes.communityCoordinationStrategies(gardenRouteContext)}>
                    {formatMessage({ id: "app.conviction.manageStrategies" })}
                    <RiArrowRightSLine className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </AdminCard>
          </div>
        </aside>
      </div>
    </div>
  );
}
