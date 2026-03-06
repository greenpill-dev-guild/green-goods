import {
  type Address,
  PoolType,
  toastService,
  WEIGHT_SCHEME_VALUES,
  WeightScheme,
} from "@green-goods/shared";
import { RiAddLine, RiGroupLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { AddressDisplay } from "@/components/AddressDisplay";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

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
  gardenId,
  canManage,
  isCreatingPools,
  onCreatePools,
  onScheduleRefetch,
}) => {
  const { formatMessage } = useIntl();

  const hypercertPool = pools.find((p) => p.poolType === PoolType.Hypercert);
  const actionPool = pools.find((p) => p.poolType === PoolType.Action);
  const weightSchemeLabel = community ? WeightScheme[community.weightScheme] : undefined;

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

        {pools.length > 0 ? (
          <>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-bg-weak p-3">
                <p className="label-xs text-text-soft">
                  {formatMessage({ id: "app.community.poolType.hypercert" })}
                </p>
                <p className="mt-1 text-sm text-text-sub">
                  {hypercertPool ? (
                    <AddressDisplay address={hypercertPool.poolAddress} className="text-sm" />
                  ) : (
                    <>&mdash;</>
                  )}
                </p>
              </div>
              <div className="rounded-lg bg-bg-weak p-3">
                <p className="label-xs text-text-soft">
                  {formatMessage({ id: "app.community.poolType.action" })}
                </p>
                <p className="mt-1 text-sm text-text-sub">
                  {actionPool ? (
                    <AddressDisplay address={actionPool.poolAddress} className="text-sm" />
                  ) : (
                    <>&mdash;</>
                  )}
                </p>
              </div>
            </div>
            {canManage && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link
                  to={`/gardens/${gardenId}/signal-pool/hypercert`}
                  className="text-xs font-medium text-primary-base hover:text-primary-darker"
                >
                  {formatMessage({ id: "app.signal.viewHypercertPool" })}
                </Link>
                <span className="text-text-soft" aria-hidden="true">
                  &middot;
                </span>
                <Link
                  to={`/gardens/${gardenId}/signal-pool/action`}
                  className="text-xs font-medium text-primary-base hover:text-primary-darker"
                >
                  {formatMessage({ id: "app.signal.viewActionPool" })}
                </Link>
                <span className="text-text-soft" aria-hidden="true">
                  &middot;
                </span>
                <Link
                  to={`/gardens/${gardenId}/strategies`}
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
                  } catch {
                    toastService.error({
                      title: formatMessage({ id: "app.community.poolsCreateFailed" }),
                    });
                  }
                }}
                disabled={isCreatingPools}
                loading={isCreatingPools}
              >
                {!isCreatingPools && <RiAddLine className="h-4 w-4" />}
                {isCreatingPools
                  ? formatMessage({ id: "app.community.creatingPools" })
                  : formatMessage({ id: "app.community.createPools" })}
              </Button>
            )}
          </div>
        )}
      </Card>
    </section>
  );
};
