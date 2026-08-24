import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import { Alert } from "@green-goods/shared/components/Alert";
import type { CommunityWorkspace } from "@green-goods/shared/hooks/admin-ui/community/useCommunityWorkspaceController";
import { useGardenYieldWiringState } from "@green-goods/shared/hooks/yield/useGardenYieldWiringState";
import type { Address } from "@green-goods/shared/types/domain";
import {
  PoolType,
  WEIGHT_SCHEME_VALUES,
  WeightScheme,
} from "@green-goods/shared/types/gardens-community";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { RiArrowRightSLine, RiCheckLine, RiQuestionLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard } from "@/components/AdminCard";
import { GovernancePanel } from "./GovernancePanel";

export type CommunityCoordinationTabProps = Pick<
  CommunityWorkspace,
  "canManage" | "community" | "createPools" | "gardenId" | "isCreatingPools" | "pools"
> & {
  garden: NonNullable<CommunityWorkspace["garden"]>;
};

export function CommunityCoordinationTab({
  garden,
  gardenId,
  canManage,
  community,
  pools,
  createPools,
  isCreatingPools,
}: CommunityCoordinationTabProps) {
  const { formatMessage } = useIntl();
  const { wiringState, wiringStatus, repairHref } = useGardenYieldWiringState(gardenId as Address);
  const gardenRouteContext = { gardenId: garden.id };
  const hypercertPool = pools.find((pool) => pool.poolType === PoolType.Hypercert);
  const actionPool = pools.find((pool) => pool.poolType === PoolType.Action);
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
  const showWiringSection = Boolean(communityConfig) && pools.length > 0;
  const canShowReconnectLink =
    (wiringStatus === "missing-resolver-wiring" || wiringStatus === "mismatch") &&
    Boolean(wiringState?.expectedHypercertPoolAddress) &&
    Boolean(repairHref);

  return (
    <div className="garden-tab-shell">
      <div className="garden-tab-layout">
        <div className="garden-tab-main">
          <AdminCard variant="elevated" className="space-y-4">
            <div>
              <h3 className="text-title-md font-semibold text-[rgb(var(--m3-on-surface))]">
                {formatMessage({ id: "cockpit.community.coordination.proposals" })}
              </h3>
              <p className="mt-1 text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
                {formatMessage({ id: "cockpit.community.coordination.proposalsDescription" })}
              </p>
            </div>
            <GovernancePanel pools={pools} gardenId={gardenId} />
          </AdminCard>
        </div>

        <aside className="garden-tab-rail">
          <div className="garden-tab-rail-sticky">
            <AdminCard variant="filled" className="space-y-3">
              <h3 className="text-title-sm font-semibold text-[rgb(var(--m3-on-surface))]">
                {formatMessage({ id: "cockpit.community.coordination.status" })}
              </h3>
              <div className="garden-stat-row">
                <span className="garden-stat-row-label">
                  {formatMessage({ id: "cockpit.community.coordination.community" })}
                </span>
                <span className="inline-flex items-center gap-1 text-body-sm font-medium text-[rgb(var(--m3-on-surface))]">
                  {communityConfig ? (
                    <RiCheckLine className="h-4 w-4 text-success-dark" />
                  ) : (
                    <RiQuestionLine className="h-4 w-4 text-[rgb(var(--m3-on-surface-variant))]" />
                  )}
                  {communityConfig
                    ? formatMessage({ id: "app.community.statusConnected" })
                    : formatMessage({ id: "app.community.statusNotConnected" })}
                </span>
              </div>

              {weightScheme !== undefined && weightSchemeLabel && weightSchemeValues ? (
                <AdminCard variant="outlined" density="compact">
                  <p className="text-label-sm text-[rgb(var(--m3-on-surface-variant))]">
                    {formatMessage({ id: "app.community.weightScheme" })}
                  </p>
                  <p className="mt-1 text-title-sm font-semibold text-[rgb(var(--m3-on-surface))]">
                    {formatMessage({ id: `app.community.weightScheme.${weightSchemeLabel}` })}
                  </p>
                  <p className="mt-1 text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
                    {formatMessage(
                      { id: "cockpit.community.coordination.weightSummary" },
                      {
                        community: weightSchemeValues.community / 10_000,
                        gardener: weightSchemeValues.gardener / 10_000,
                        operator: weightSchemeValues.operator / 10_000,
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
                          <p className="text-label-sm text-[rgb(var(--m3-on-surface-variant))]">
                            {formatMessage({ id: labelId })}
                          </p>
                          <div className="mt-1 text-body-sm text-[rgb(var(--m3-on-surface))]">
                            {pool ? (
                              <AddressDisplay address={pool.poolAddress} className="text-sm" />
                            ) : (
                              formatMessage({ id: "cockpit.community.coordination.poolMissing" })
                            )}
                          </div>
                        </div>
                        {pool ? (
                          <Link
                            to={linkTarget}
                            aria-label={formatMessage({ id: "app.actions.view" })}
                            className="mt-0.5 text-[rgb(var(--tone-on-surface-accent,var(--m3-primary)))]"
                          >
                            <RiArrowRightSLine className="h-4 w-4" />
                          </Link>
                        ) : null}
                      </div>
                    </AdminCard>
                  );
                })}
              </div>

              {showWiringSection &&
              (wiringStatus === "missing-resolver-wiring" || wiringStatus === "mismatch") ? (
                <Alert
                  variant="warning"
                  className="p-3"
                  action={
                    canShowReconnectLink && repairHref ? (
                      <Link
                        to={repairHref}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {formatMessage({ id: "app.community.yield.connectAction" })}
                      </Link>
                    ) : undefined
                  }
                >
                  {wiringStatus === "mismatch"
                    ? formatMessage({ id: "app.community.yield.mismatch" })
                    : formatMessage({ id: "app.community.yield.notConnected" })}
                </Alert>
              ) : null}
              {canManage && communityConfig && pools.length === 0 ? (
                <AdminButton
                  type="button"
                  variant="tonal"
                  size="sm"
                  onClick={createPools}
                  disabled={isCreatingPools}
                  loading={isCreatingPools}
                  className="w-full"
                >
                  {formatMessage({ id: "app.community.createPools" })}
                </AdminButton>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                {showWiringSection && wiringStatus === "connected" ? (
                  <p className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] bg-success-lighter px-3 text-xs text-success-dark">
                    <RiCheckLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {formatMessage({ id: "app.community.yield.connected" })}
                  </p>
                ) : null}
                <AdminButton asChild variant="text" size="sm" className="px-0">
                  <Link to={adminRoutes.communityCoordinationStrategies(gardenRouteContext)}>
                    {formatMessage({ id: "app.conviction.manageStrategies" })}
                    <RiArrowRightSLine className="h-4 w-4" />
                  </Link>
                </AdminButton>
              </div>
            </AdminCard>
          </div>
        </aside>
      </div>
    </div>
  );
}
