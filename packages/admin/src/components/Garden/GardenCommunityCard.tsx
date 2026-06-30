import {
  type Address,
  AddressDisplay,
  Button,
  Card,
  logger,
  PoolType,
  toastService,
  useGardenYieldWiringState,
  WEIGHT_SCHEME_VALUES,
  WeightScheme,
  adminRoutes,
} from "@green-goods/shared";
import { RiAddLine, RiAlertLine, RiCheckLine, RiGroupLine, RiQuestionLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";

interface GardenPool {
  poolType: PoolType;
  poolAddress: Address;
}

interface Community {
  weightScheme: number;
}

interface GardenCommunityCardProps {
  community: Community | undefined;
  communityLoading: boolean;
  pools: GardenPool[];
  gardenId: string;
  canManage: boolean;
  isCreatingPools: boolean;
  onCreatePools: () => Promise<void>;
  onScheduleRefetch: () => void;
}

export const GardenCommunityCard: React.FC<GardenCommunityCardProps> = ({
  community,
  communityLoading,
  pools,
  gardenId: _gardenId,
  canManage,
  isCreatingPools,
  onCreatePools,
  onScheduleRefetch,
}) => {
  const { formatMessage } = useIntl();

  const hypercertPool = pools.find((p) => p.poolType === PoolType.Hypercert);
  const actionPool = pools.find((p) => p.poolType === PoolType.Action);
  const weightSchemeLabel = community ? WeightScheme[community.weightScheme] : undefined;

  const { wiringState, wiringStatus, repairHref } = useGardenYieldWiringState(_gardenId as Address);
  const showWiringSection = Boolean(community) && pools.length > 0;
  const expectedHypercertPoolKnown = Boolean(wiringState?.expectedHypercertPoolAddress);
  const canShowReconnectLink =
    (wiringStatus === "missing-resolver-wiring" || wiringStatus === "mismatch") &&
    expectedHypercertPoolKnown &&
    Boolean(repairHref);

  return (
    <section
      className="flex flex-col gap-4"
      aria-label={formatMessage({
        id: "app.garden.admin.tab.community",
        defaultMessage: "Community",
      })}
    >
      <Card padding="compact" className="sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-feature-lighter">
              <RiGroupLine className="h-5 w-5 text-feature-dark" />
            </div>
            <div>
              <h3 className="label-md text-text-strong sm:text-lg">
                {formatMessage({ id: "app.community.title" })}
              </h3>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-text-sub">
                <span
                  className={`inline-flex h-2 w-2 flex-shrink-0 rounded-full ${community ? "bg-success-base" : "bg-text-soft"}`}
                  aria-hidden="true"
                />
                {community
                  ? formatMessage({ id: "app.community.statusConnected" })
                  : formatMessage({ id: "app.community.statusNotConnected" })}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-bg-weak p-3">
          <p className="label-xs text-text-soft">
            {formatMessage({ id: "app.community.weightScheme" })}
          </p>
          {communityLoading ? (
            <p className="mt-1 text-sm text-text-sub">
              {formatMessage({ id: "app.community.loading" })}
            </p>
          ) : community ? (
            <div className="mt-1">
              <p className="text-sm font-medium text-text-strong">
                {formatMessage({
                  id: `app.community.weightScheme.${weightSchemeLabel?.toLowerCase()}`,
                })}
              </p>
              <p className="mt-0.5 text-xs text-text-sub">
                {formatMessage({
                  id: `app.community.weightScheme.${weightSchemeLabel?.toLowerCase()}Description`,
                })}
              </p>
              <div className="mt-2 flex gap-3 text-xs text-text-sub">
                <span>
                  {formatMessage({ id: "app.roles.community" })}:{" "}
                  {WEIGHT_SCHEME_VALUES[community.weightScheme].community / 10_000}x
                </span>
                <span>
                  {formatMessage({ id: "app.roles.gardener" })}:{" "}
                  {WEIGHT_SCHEME_VALUES[community.weightScheme].gardener / 10_000}x
                </span>
                <span>
                  {formatMessage({ id: "app.roles.operator" })}:{" "}
                  {WEIGHT_SCHEME_VALUES[community.weightScheme].operator / 10_000}x
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-sm text-text-sub">
              {formatMessage({ id: "app.community.noCommunity" })}
            </p>
          )}
        </div>

        {showWiringSection && wiringStatus === "connected" ? (
          <div className="mt-3 rounded-lg bg-bg-weak p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-text-strong">
              <RiCheckLine className="h-4 w-4 flex-shrink-0 text-success-base" aria-hidden="true" />
              {formatMessage({ id: "app.community.yield.connected" })}
            </p>
            <p className="mt-0.5 text-xs text-text-sub">
              {formatMessage({ id: "app.community.yield.connectedDescription" })}
            </p>
          </div>
        ) : null}

        {showWiringSection &&
        (wiringStatus === "missing-resolver-wiring" || wiringStatus === "mismatch") ? (
          <div className="mt-3 rounded-lg border border-warning-light bg-warning-lighter p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-warning-dark">
              <RiAlertLine className="h-4 w-4 flex-shrink-0 text-warning-dark" aria-hidden="true" />
              {wiringStatus === "mismatch"
                ? formatMessage({ id: "app.community.yield.mismatch" })
                : formatMessage({ id: "app.community.yield.notConnected" })}
            </p>
            {canShowReconnectLink && repairHref ? (
              <Link
                to={repairHref}
                className="mt-2 inline-flex text-xs font-medium text-primary-base hover:text-primary-darker"
              >
                {formatMessage({ id: "app.community.yield.connectAction" })}
              </Link>
            ) : null}
          </div>
        ) : null}

        {showWiringSection && wiringStatus === "missing-pool" ? (
          <div className="mt-3 rounded-lg border border-information-light bg-information-lighter p-3">
            <p className="flex items-center gap-1.5 text-sm text-information-dark">
              <RiQuestionLine
                className="h-4 w-4 flex-shrink-0 text-information-dark"
                aria-hidden="true"
              />
              {formatMessage({ id: "app.community.yield.poolNeedsReview" })}
            </p>
          </div>
        ) : null}

        {showWiringSection && wiringState?.readStatus === "unavailable" ? (
          <div className="mt-3 rounded-lg bg-bg-weak p-3">
            <p className="flex items-center gap-1.5 text-sm text-text-soft">
              <RiQuestionLine className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              {formatMessage({ id: "app.community.yield.unavailable" })}
            </p>
          </div>
        ) : null}

        {pools.length > 0 ? (
          <>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-bg-weak p-3">
                <p className="label-xs text-text-soft">
                  {formatMessage({ id: "app.community.poolType.hypercert" })}
                </p>
                <div className="mt-1 text-sm text-text-sub">
                  {hypercertPool ? (
                    <AddressDisplay address={hypercertPool.poolAddress} className="text-sm" />
                  ) : (
                    <>&mdash;</>
                  )}
                </div>
              </div>
              <div className="rounded-lg bg-bg-weak p-3">
                <p className="label-xs text-text-soft">
                  {formatMessage({ id: "app.community.poolType.action" })}
                </p>
                <div className="mt-1 text-sm text-text-sub">
                  {actionPool ? (
                    <AddressDisplay address={actionPool.poolAddress} className="text-sm" />
                  ) : (
                    <>&mdash;</>
                  )}
                </div>
              </div>
            </div>
            {canManage && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link
                  to={adminRoutes.communityGovernanceSignalPool("hypercert")}
                  className="text-xs font-medium text-primary-base hover:text-primary-darker"
                >
                  {formatMessage({ id: "app.signal.viewHypercertPool" })}
                </Link>
                <span className="text-text-soft" aria-hidden="true">
                  &middot;
                </span>
                <Link
                  to={adminRoutes.communityGovernanceSignalPool("action")}
                  className="text-xs font-medium text-primary-base hover:text-primary-darker"
                >
                  {formatMessage({ id: "app.signal.viewActionPool" })}
                </Link>
                <span className="text-text-soft" aria-hidden="true">
                  &middot;
                </span>
                <Link
                  to={adminRoutes.communityGovernanceStrategies()}
                  className="text-xs font-medium text-primary-base hover:text-primary-darker"
                >
                  {formatMessage({ id: "app.conviction.manageStrategies" })}
                </Link>
              </div>
            )}
          </>
        ) : (
          <div className="mt-3 rounded-lg border border-warning-light bg-warning-lighter p-3">
            <p className="text-sm text-warning-dark">
              {formatMessage({ id: "app.community.noPoolsYet" })}
            </p>
            {canManage && community && (
              <Button
                size="sm"
                className="mt-2"
                onClick={async () => {
                  try {
                    await onCreatePools();
                    toastService.success({
                      title: formatMessage({ id: "app.community.poolsCreated" }),
                    });
                    onScheduleRefetch();
                  } catch (error) {
                    logger.error("Failed to create community pools", { error });
                    toastService.error({
                      title: formatMessage({ id: "app.community.poolsCreateFailed" }),
                    });
                  }
                }}
                disabled={isCreatingPools}
                loading={isCreatingPools}
              >
                {!isCreatingPools && <RiAddLine className="h-4 w-4" />}
                {formatMessage({ id: "app.community.createPools" })}
              </Button>
            )}
          </div>
        )}
      </Card>
    </section>
  );
};
