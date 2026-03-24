import {
  GardenBannerFallback,
  type GardenFilterScope,
  type GardenFiltersState,
  type GardenSortOrder,
  ImageWithFallback,
  useAuth,
  useDeploymentRegistry,
  useFilteredGardens,
  useGardenPermissions,
  useGardens,
  useOpenMinting,
  usePlatformStats,
  useUrlFilters,
} from "@green-goods/shared";
import { RiGroupLine, RiPlantLine, RiShieldCheckLine, RiUserLine } from "@remixicon/react";
import { type ReactNode, useMemo } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { CreateGardenAction } from "@/components/Garden/CreateGardenAction";
import { PageHeader } from "@/components/Layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListToolbar } from "@/components/ui/ListToolbar";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { SortSelect } from "@/components/ui/SortSelect";

/** Banner with automatic fallback on image load error */
function GardenCardBanner({
  name,
  bannerImage,
  children,
}: {
  name: string;
  bannerImage?: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative h-48 overflow-hidden">
      <ImageWithFallback
        src={bannerImage || ""}
        alt={name}
        className="absolute inset-0 h-full w-full object-cover"
        backgroundFallback={<GardenBannerFallback name={name} />}
      />
      {children}
    </div>
  );
}

const GARDEN_FILTER_DEFAULTS: Record<string, string | undefined> = {
  scope: "all",
  sort: "default",
  search: undefined,
};

export default function Gardens() {
  const intl = useIntl();
  const { eoaAddress } = useAuth();
  const { canDeploy, loading: deployLoading } = useDeploymentRegistry();
  const { data: isOpenMinting, isLoading: openMintingLoading } = useOpenMinting();
  const gardenPermissions = useGardenPermissions();
  const { data: gardens = [], isLoading, error } = useGardens();

  const gardenAddresses = useMemo(() => gardens.map((g) => g.id), [gardens]);
  const { data: platformStats } = usePlatformStats(gardenAddresses);

  const pendingByGarden = useMemo(() => {
    if (!platformStats?.works || !platformStats?.workApprovals) return new Map<string, number>();
    const approvedWorkIds = new Set(
      platformStats.workApprovals.filter((a) => a.approved).map((a) => a.workUID)
    );
    const map = new Map<string, number>();
    for (const work of platformStats.works) {
      if (!approvedWorkIds.has(work.id)) {
        const key = work.gardenAddress.toLowerCase();
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    }
    return map;
  }, [platformStats]);

  const { filters: urlFilters, setFilter, resetFilters } = useUrlFilters(GARDEN_FILTER_DEFAULTS);
  const filters: GardenFiltersState = {
    scope: (urlFilters.scope as GardenFilterScope) ?? "all",
    sort: (urlFilters.sort as GardenSortOrder) ?? "default",
    search: urlFilters.search,
  };

  const { filteredGardens, myGardensCount } = useFilteredGardens(
    gardens,
    filters,
    eoaAddress?.toLowerCase() ?? null
  );

  const sortOptions = [
    {
      value: "default" as const,
      label: intl.formatMessage({ id: "admin.gardens.sort.default", defaultMessage: "Default" }),
    },
    {
      value: "name" as const,
      label: intl.formatMessage({ id: "admin.gardens.sort.name", defaultMessage: "Name" }),
    },
    {
      value: "recent" as const,
      label: intl.formatMessage({ id: "admin.gardens.sort.recent", defaultMessage: "Recent" }),
    },
  ];

  const scopeOptions = [
    {
      value: "all" as const,
      label: intl.formatMessage({ id: "admin.gardens.scope.all", defaultMessage: "All gardens" }),
    },
    {
      value: "mine" as const,
      label: intl.formatMessage(
        { id: "admin.gardens.scope.mine", defaultMessage: "My gardens ({count})" },
        { count: myGardensCount }
      ),
    },
  ];

  const errorMessage =
    error instanceof Error
      ? error.message
      : error
        ? intl.formatMessage({ id: "admin.gardens.unknownError", defaultMessage: "Unknown error" })
        : null;

  const headerDescription = errorMessage
    ? intl.formatMessage({ id: "admin.gardens.indexerOffline" })
    : intl.formatMessage({ id: "admin.gardens.description" });
  const createGardenTooltip = intl.formatMessage({
    id: "admin.gardens.createGarden.noPermission",
  });

  const showToolbar = !isLoading && !errorMessage && gardens.length > 0;

  return (
    <div className="pb-6">
      <PageHeader
        title={intl.formatMessage({ id: "admin.gardens.title" })}
        description={headerDescription}
        sticky
        actions={
          <CreateGardenAction
            canDeploy={canDeploy || !!isOpenMinting}
            isLoading={deployLoading || openMintingLoading}
            createLabel={intl.formatMessage({ id: "admin.gardens.createGarden" })}
            tooltip={createGardenTooltip}
          />
        }
        toolbar={
          showToolbar ? (
            <ListToolbar
              search={filters.search ?? ""}
              onSearchChange={(value) => setFilter("search", value || undefined)}
              searchPlaceholder={intl.formatMessage({
                id: "admin.gardens.searchPlaceholder",
                defaultMessage: "Search gardens...",
              })}
            >
              {eoaAddress && (
                <SortSelect
                  value={filters.scope}
                  onChange={(value) => setFilter("scope", value)}
                  options={scopeOptions}
                  aria-label={intl.formatMessage({
                    id: "admin.gardens.filterScope",
                    defaultMessage: "Filter scope",
                  })}
                />
              )}
              <SortSelect
                value={filters.sort}
                onChange={(value) => setFilter("sort", value)}
                options={sortOptions}
              />
            </ListToolbar>
          ) : undefined
        }
      />

      <div className="mt-6 space-y-6 px-4 sm:px-6">
        {isLoading && (
          <div role="status" aria-live="polite">
            <span className="sr-only">
              {intl.formatMessage({
                id: "admin.gardens.loadingMessage",
                defaultMessage: "Loading gardens...",
              })}
            </span>
            <SkeletonGrid count={8} columns={4} />
          </div>
        )}

        {!isLoading && errorMessage && (
          <div className="space-y-8">
            <Alert
              variant="warning"
              title={intl.formatMessage({ id: "admin.gardens.indexerError.title" })}
            >
              <div className="space-y-1">
                <p>
                  {intl.formatMessage(
                    { id: "admin.gardens.indexerError.message" },
                    { error: errorMessage }
                  )}
                </p>
                <p>{intl.formatMessage({ id: "admin.gardens.indexerError.fallback" })}</p>
              </div>
            </Alert>

            <EmptyState
              icon={<RiPlantLine className="h-6 w-6" />}
              title={intl.formatMessage({ id: "admin.gardens.unavailable.title" })}
              description={intl.formatMessage({ id: "admin.gardens.unavailable.description" })}
            />
          </div>
        )}

        {!isLoading && !errorMessage && gardens.length === 0 && (
          <EmptyState
            icon={<RiPlantLine className="h-6 w-6" />}
            title={intl.formatMessage({ id: "admin.gardens.empty.title" })}
            description={intl.formatMessage({ id: "admin.gardens.empty.description" })}
          />
        )}

        {!isLoading && !errorMessage && gardens.length > 0 && filteredGardens.length === 0 && (
          <EmptyState
            icon={<RiPlantLine className="h-6 w-6" />}
            title={intl.formatMessage({
              id: "admin.gardens.noResults",
              defaultMessage: "No gardens match your filters",
            })}
            action={{
              label: intl.formatMessage({
                id: "admin.gardens.resetFilters",
                defaultMessage: "Reset filters",
              }),
              onClick: resetFilters,
            }}
          />
        )}

        {!isLoading && filteredGardens.length > 0 && (
          <div className="stagger-children grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {filteredGardens.map((garden) => {
              const canManage = gardenPermissions.canManageGarden(garden);

              return (
                <Link
                  key={garden.id}
                  to={`/gardens/${garden.id}`}
                  data-testid="garden-card"
                  className="group overflow-hidden rounded-lg border border-stroke-soft bg-bg-white shadow-sm transition-shadow hover:shadow-md hover:border-primary-base"
                >
                  <GardenCardBanner name={garden.name} bannerImage={garden.bannerImage}>
                    {(() => {
                      const pending = pendingByGarden.get(garden.id.toLowerCase()) ?? 0;
                      return pending > 0 && gardenPermissions.canManageGarden(garden) ? (
                        <span className="absolute top-2 left-2 z-[2] rounded-full bg-warning-lighter px-2 py-0.5 text-xs font-semibold text-warning-dark shadow-sm">
                          {intl.formatMessage(
                            { id: "admin.gardens.pendingBadge", defaultMessage: "{count} pending" },
                            { count: pending }
                          )}
                        </span>
                      ) : null;
                    })()}
                    {canManage && (
                      <div className="absolute top-2 right-2 z-[2] flex items-center rounded-full bg-success-lighter px-2 py-1 text-xs font-medium text-success-dark">
                        <RiShieldCheckLine className="mr-1 h-3 w-3" />
                        Operator
                      </div>
                    )}
                  </GardenCardBanner>
                  <div className="p-6">
                    <div className="mb-2">
                      <h3
                        className="mb-1 text-lg font-medium text-text-strong group-hover:text-primary-dark truncate"
                        title={garden.name}
                      >
                        {garden.name}
                      </h3>
                      <p className="text-sm text-text-soft">{garden.location}</p>
                    </div>
                    <p
                      className="mb-4 line-clamp-2 text-sm text-text-sub"
                      title={garden.description}
                    >
                      {garden.description}
                    </p>

                    <div className="flex items-center gap-4 text-sm text-text-soft">
                      <div
                        className="flex items-center"
                        title={intl.formatMessage(
                          {
                            id: "admin.gardens.totalMembersTooltip",
                            defaultMessage:
                              "{operators} operators, {gardeners} gardeners, {evaluators} evaluators",
                          },
                          {
                            operators: garden.operators?.length ?? 0,
                            gardeners: garden.gardeners?.length ?? 0,
                            evaluators: garden.evaluators?.length ?? 0,
                          }
                        )}
                      >
                        <RiGroupLine className="mr-1 h-4 w-4" />
                        <span>
                          {intl.formatMessage(
                            {
                              id: "admin.gardens.totalMembers",
                              defaultMessage: "{count, plural, one {# member} other {# members}}",
                            },
                            {
                              count: new Set([
                                ...(garden.operators ?? []),
                                ...(garden.gardeners ?? []),
                                ...(garden.evaluators ?? []),
                              ]).size,
                            }
                          )}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <RiUserLine className="mr-1 h-4 w-4" />
                        <span>
                          {intl.formatMessage(
                            {
                              id: "admin.gardens.operatorCount",
                              defaultMessage:
                                "{count, plural, one {# operator} other {# operators}}",
                            },
                            { count: garden.operators?.length ?? 0 }
                          )}
                        </span>
                      </div>
                      {garden.openJoining && (
                        <span
                          className="inline-flex items-center text-xs text-success-dark"
                          title={intl.formatMessage({
                            id: "admin.gardens.openJoiningTooltip",
                            defaultMessage: "Anyone can join this garden as a gardener",
                          })}
                        >
                          {intl.formatMessage({
                            id: "admin.gardens.openJoining",
                            defaultMessage: "Open",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
