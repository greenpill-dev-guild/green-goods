import {
  type GardenFiltersState,
  useFilteredGardens,
} from "@green-goods/shared";
import { useAuth, useGardenPermissions, useGardens } from "@green-goods/shared/hooks";
import { resolveIPFSUrl } from "@green-goods/shared/modules";
import { RiAddLine, RiPlantLine, RiShieldCheckLine, RiUserLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/Layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListToolbar } from "@/components/ui/ListToolbar";
import { SortSelect } from "@/components/ui/SortSelect";

export default function Gardens() {
  const intl = useIntl();
  const { eoaAddress } = useAuth();
  const gardenPermissions = useGardenPermissions();
  const { data: gardens = [], isLoading, error } = useGardens();
  const [filters, setFilters] = useState<GardenFiltersState>({ scope: "all", sort: "default" });

  const { filteredGardens, myGardensCount } = useFilteredGardens(
    gardens,
    filters,
    eoaAddress?.toLowerCase() ?? null
  );

  const sortOptions = [
    { value: "default" as const, label: intl.formatMessage({ id: "admin.gardens.sort.default", defaultMessage: "Default" }) },
    { value: "name" as const, label: intl.formatMessage({ id: "admin.gardens.sort.name", defaultMessage: "Name" }) },
    { value: "recent" as const, label: intl.formatMessage({ id: "admin.gardens.sort.recent", defaultMessage: "Recent" }) },
  ];

  const scopeOptions = [
    { value: "all" as const, label: intl.formatMessage({ id: "admin.gardens.scope.all", defaultMessage: "All gardens" }) },
    { value: "mine" as const, label: intl.formatMessage({ id: "admin.gardens.scope.mine", defaultMessage: "My gardens ({count})" }, { count: myGardensCount }) },
  ];

  const errorMessage = error instanceof Error
    ? error.message
    : error
      ? intl.formatMessage({ id: "admin.gardens.unknownError", defaultMessage: "Unknown error" })
      : null;

  const headerDescription = errorMessage
    ? intl.formatMessage({ id: "admin.gardens.indexerOffline" })
    : intl.formatMessage({ id: "admin.gardens.description" });

  const resetFilters = () => setFilters({ scope: "all", sort: "default" });

  const showToolbar = !isLoading && !errorMessage && gardens.length > 0;

  return (
    <div className="pb-6">
      <PageHeader
        title={intl.formatMessage({ id: "admin.gardens.title" })}
        description={headerDescription}
        sticky
        actions={
          <Button size="sm" asChild>
            <Link to="/gardens/create">
              <RiAddLine className="mr-1.5 h-4 w-4" />
              {intl.formatMessage({ id: "admin.gardens.createGarden" })}
            </Link>
          </Button>
        }
        toolbar={
          showToolbar ? (
            <ListToolbar
              search={filters.search ?? ""}
              onSearchChange={(value) => setFilters((prev) => ({ ...prev, search: value || undefined }))}
              searchPlaceholder={intl.formatMessage({ id: "admin.gardens.searchPlaceholder", defaultMessage: "Search gardens..." })}
            >
              {eoaAddress && (
                <SortSelect
                  value={filters.scope}
                  onChange={(value) => setFilters((prev) => ({ ...prev, scope: value }))}
                  options={scopeOptions}
                  aria-label={intl.formatMessage({ id: "admin.gardens.filterScope", defaultMessage: "Filter scope" })}
                />
              )}
              <SortSelect
                value={filters.sort}
                onChange={(value) => setFilters((prev) => ({ ...prev, sort: value }))}
                options={sortOptions}
              />
            </ListToolbar>
          ) : undefined
        }
      />

      <div className="mt-6 space-y-6 px-4 sm:px-6">
        {isLoading && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse overflow-hidden rounded-lg border border-stroke-soft bg-bg-white shadow-sm"
              >
                <div className="h-48 bg-bg-soft" />
                <div className="space-y-4 p-6">
                  <div className="space-y-2">
                    <div className="h-6 rounded bg-bg-soft" />
                    <div className="h-4 w-24 rounded bg-bg-soft" />
                  </div>
                  <div className="h-4 rounded bg-bg-soft" />
                  <div className="h-4 w-3/4 rounded bg-bg-soft" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && errorMessage && (
          <div className="space-y-8">
            <div className="rounded-md border border-warning-light bg-warning-lighter p-4">
              <div className="flex items-start gap-3">
                <svg
                  className="h-5 w-5 flex-shrink-0 text-warning-base"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <h3 className="text-sm font-medium text-warning-dark">
                    {intl.formatMessage({ id: "admin.gardens.indexerError.title" })}
                  </h3>
                  <div className="mt-2 space-y-1 text-sm text-warning-dark/80">
                    <p>{intl.formatMessage({ id: "admin.gardens.indexerError.message" }, { error: errorMessage })}</p>
                    <p>{intl.formatMessage({ id: "admin.gardens.indexerError.fallback" })}</p>
                  </div>
                </div>
              </div>
            </div>

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
            title={intl.formatMessage({ id: "admin.gardens.noResults", defaultMessage: "No gardens match your filters" })}
            action={{
              label: intl.formatMessage({ id: "admin.gardens.resetFilters", defaultMessage: "Reset filters" }),
              onClick: resetFilters,
            }}
          />
        )}

        {!isLoading && filteredGardens.length > 0 && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {filteredGardens.map((garden) => {
              const canManage = gardenPermissions.canManageGarden(garden);
              const resolvedBannerImage = garden.bannerImage
                ? resolveIPFSUrl(garden.bannerImage)
                : null;

              return (
                <Link
                  key={garden.id}
                  to={`/gardens/${garden.id}`}
                  data-testid="garden-card"
                  className="group overflow-hidden rounded-lg border border-stroke-soft bg-bg-white shadow-sm transition-shadow hover:shadow-md hover:border-primary-base"
                >
                  <div className="relative h-48">
                    {resolvedBannerImage ? (
                      <img
                        src={resolvedBannerImage}
                        alt={garden.name}
                        className="h-full w-full object-cover"
                        onError={(event) => {
                          const placeholder = event.currentTarget
                            .nextElementSibling as HTMLElement | null;
                          if (placeholder) {
                            placeholder.style.display = "flex";
                          }
                          event.currentTarget.style.display = "none";
                        }}
                        loading="lazy"
                      />
                    ) : null}
                    <div
                      className={`absolute inset-0 items-center justify-center bg-gradient-to-br from-primary-dark via-primary-base to-primary-darker text-primary-foreground ${resolvedBannerImage ? "hidden" : "flex"}`}
                      style={{ display: resolvedBannerImage ? "none" : "flex" }}
                    >
                      <div className="text-center">
                        <div className="text-2xl font-bold opacity-80">{garden.name.charAt(0)}</div>
                      </div>
                    </div>
                    {canManage && (
                      <div className="absolute top-2 right-2 flex items-center rounded-full bg-success-lighter px-2 py-1 text-xs font-medium text-success-dark">
                        <RiShieldCheckLine className="mr-1 h-3 w-3" />
                        Operator
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    <div className="mb-2">
                      <h3 className="mb-1 text-lg font-medium text-text-strong group-hover:text-primary-dark">{garden.name}</h3>
                      <p className="text-sm text-text-soft">{garden.location}</p>
                    </div>
                    <p className="mb-4 line-clamp-2 text-sm text-text-sub">{garden.description}</p>

                    <div className="flex items-center text-sm text-text-soft">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center">
                          <RiUserLine className="mr-1 h-4 w-4" />
                          <span>{intl.formatMessage({ id: "admin.gardens.operatorCount", defaultMessage: "{count, plural, one {# operator} other {# operators}}" }, { count: garden.operators?.length ?? 0 })}</span>
                        </div>
                        <div className="flex items-center">
                          <RiUserLine className="mr-1 h-4 w-4" />
                          <span>{intl.formatMessage({ id: "admin.gardens.gardenerCount", defaultMessage: "{count, plural, one {# gardener} other {# gardeners}}" }, { count: garden.gardeners?.length ?? 0 })}</span>
                        </div>
                      </div>
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
