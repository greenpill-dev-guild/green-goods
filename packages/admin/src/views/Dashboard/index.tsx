import { resolveIPFSUrl, useGardens, useRole } from "@green-goods/shared";
import { RiPlantLine, RiShieldCheckLine, RiUserLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonGrid } from "@/components/ui/Skeleton";

function DashboardHeader({
  role,
  gardenCount,
  intl,
}: {
  role: string;
  gardenCount: number;
  intl: ReturnType<typeof useIntl>;
}) {
  const roleLabel =
    role === "deployer"
      ? intl.formatMessage({ id: "admin.dashboard.role.deployer", defaultMessage: "Deployer" })
      : role === "operator"
        ? intl.formatMessage({ id: "admin.dashboard.role.operator", defaultMessage: "Operator" })
        : intl.formatMessage({ id: "admin.dashboard.role.user", defaultMessage: "User" });

  const subtitle =
    role === "deployer"
      ? intl.formatMessage({
          id: "admin.dashboard.subtitle.deployer",
          defaultMessage: "Manage gardens, deploy contracts, and oversee platform operations",
        })
      : role === "operator"
        ? intl.formatMessage(
            {
              id: "admin.dashboard.subtitle.operator",
              defaultMessage: "Manage your {count, plural, one {# garden} other {# gardens}}",
            },
            { count: gardenCount }
          )
        : intl.formatMessage({
            id: "admin.dashboard.subtitle.user",
            defaultMessage: "View gardens and explore the Green Goods ecosystem",
          });

  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold text-text-strong">
        {intl.formatMessage(
          { id: "admin.dashboard.welcome", defaultMessage: "Welcome back, {role}" },
          { role: roleLabel }
        )}
      </h1>
      <p className="text-text-sub mt-1">{subtitle}</p>
    </div>
  );
}

export default function Dashboard() {
  const intl = useIntl();
  const { role, operatorGardens } = useRole();
  const { data: gardens = [], isLoading, error } = useGardens();
  const totalGardens = gardens.length;
  const userOperatorGardens = operatorGardens.length;
  const totalOperators = new Set(gardens.flatMap((g) => g.operators)).size;
  const totalGardeners = new Set(gardens.flatMap((g) => g.gardeners)).size;

  const displayGardens = role === "operator" ? operatorGardens : gardens;

  if (isLoading) {
    return (
      <div className="p-6">
        <div role="status" aria-live="polite">
          <span className="sr-only">
            {intl.formatMessage({
              id: "admin.dashboard.loading",
              defaultMessage: "Loading dashboard...",
            })}
          </span>
          <SkeletonGrid count={6} columns={3} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-warning-lighter border border-warning-light rounded-md p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-warning-base" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-warning-dark">
                {intl.formatMessage({
                  id: "admin.dashboard.indexerError.title",
                  defaultMessage: "Indexer Connection Issue",
                })}
              </h3>
              <div className="mt-2 text-sm text-warning-dark">
                <p>
                  {intl.formatMessage(
                    {
                      id: "admin.dashboard.indexerError.message",
                      defaultMessage: "Unable to connect to the indexer: {error}",
                    },
                    {
                      error:
                        error instanceof Error
                          ? error.message
                          : intl.formatMessage({
                              id: "admin.gardens.unknownError",
                              defaultMessage: "Unknown error",
                            }),
                    }
                  )}
                </p>
                <p className="mt-1">
                  {intl.formatMessage({
                    id: "admin.dashboard.indexerError.fallback",
                    defaultMessage:
                      "The dashboard will work with limited functionality. Garden operations are still available.",
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Fallback dashboard without stats */}
        <div className="mt-8">
          <DashboardHeader role={role} gardenCount={operatorGardens.length} intl={intl} />

          <div className="bg-bg-white rounded-lg shadow-sm transition-shadow duration-200 hover:shadow-md border border-stroke-soft p-6">
            <h2 className="text-lg font-medium text-text-strong mb-4">
              {intl.formatMessage({
                id: "admin.dashboard.quickActions",
                defaultMessage: "Quick Actions",
              })}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                to="/gardens"
                className="block p-4 border border-stroke-soft rounded-lg hover:bg-bg-weak transition-all duration-200"
              >
                <h3 className="font-medium text-text-strong">
                  {intl.formatMessage({
                    id: "admin.dashboard.viewGardens",
                    defaultMessage: "View Gardens",
                  })}
                </h3>
                <p className="text-sm text-text-sub mt-1">
                  {intl.formatMessage({
                    id: "admin.dashboard.viewGardens.description",
                    defaultMessage: "Browse and manage gardens",
                  })}
                </p>
              </Link>
              {role === "deployer" && (
                <Link
                  to="/contracts"
                  className="block p-4 border border-stroke-soft rounded-lg hover:bg-bg-weak transition-all duration-200"
                >
                  <h3 className="font-medium text-text-strong">
                    {intl.formatMessage({
                      id: "admin.dashboard.contractManagement",
                      defaultMessage: "Contract Management",
                    })}
                  </h3>
                  <p className="text-sm text-text-sub mt-1">
                    {intl.formatMessage({
                      id: "admin.dashboard.contractManagement.description",
                      defaultMessage: "Deploy and manage contracts",
                    })}
                  </p>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <DashboardHeader role={role} gardenCount={operatorGardens.length} intl={intl} />

      {/* Stats Grid */}
      <div className="stagger-children grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          icon={<RiPlantLine className="h-5 w-5" />}
          label={
            role === "operator"
              ? intl.formatMessage({
                  id: "admin.dashboard.stats.yourGardens",
                  defaultMessage: "Your Gardens",
                })
              : intl.formatMessage({
                  id: "admin.dashboard.stats.totalGardens",
                  defaultMessage: "Total Gardens",
                })
          }
          value={role === "operator" ? userOperatorGardens : totalGardens}
          colorScheme="success"
        />

        {(role === "deployer" || role === "operator") && (
          <>
            <StatCard
              icon={<RiUserLine className="h-5 w-5" />}
              label={intl.formatMessage({
                id: "admin.dashboard.stats.totalOperators",
                defaultMessage: "Total Operators",
              })}
              value={totalOperators}
              colorScheme="info"
            />

            <StatCard
              icon={<RiUserLine className="h-5 w-5" />}
              label={intl.formatMessage({
                id: "admin.dashboard.stats.totalGardeners",
                defaultMessage: "Total Gardeners",
              })}
              value={totalGardeners}
              colorScheme="warning"
            />
          </>
        )}
      </div>

      {/* Garden Cards */}
      <div className="mb-4">
        <h2 className="text-lg font-medium text-text-strong">
          {intl.formatMessage({
            id: "admin.dashboard.recentGardens",
            defaultMessage: "Recent Gardens",
          })}
        </h2>
      </div>

      {displayGardens.length === 0 && (
        <EmptyState
          icon={<RiPlantLine className="h-6 w-6" />}
          title={intl.formatMessage({
            id: "admin.dashboard.noGardens",
            defaultMessage: "No gardens found",
          })}
          description={intl.formatMessage({
            id: "admin.dashboard.noGardens.description",
            defaultMessage: "Gardens will appear here once created.",
          })}
        />
      )}

      {displayGardens.length > 0 && (
        <div className="stagger-children grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {displayGardens.slice(0, 6).map((garden) => {
            const resolvedBannerImage = garden.bannerImage
              ? resolveIPFSUrl(garden.bannerImage)
              : null;

            return (
              <Link
                key={garden.id}
                to={`/gardens/${garden.id}`}
                className="group overflow-hidden rounded-lg border border-stroke-soft bg-bg-white shadow-sm transition-shadow hover:shadow-md hover:border-primary-base"
              >
                <div className="relative h-36">
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
                  {role === "operator" && (
                    <div className="absolute top-2 right-2 flex items-center rounded-full bg-success-lighter px-2 py-1 text-xs font-medium text-success-dark">
                      <RiShieldCheckLine className="mr-1 h-3 w-3" />
                      {intl.formatMessage({
                        id: "admin.dashboard.operatorBadge",
                        defaultMessage: "Operator",
                      })}
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-medium text-text-strong group-hover:text-primary-dark line-clamp-1">
                    {garden.name}
                  </h3>
                  <p className="text-xs text-text-soft mt-0.5 line-clamp-1">
                    {garden.location ||
                      intl.formatMessage({
                        id: "admin.dashboard.noLocation",
                        defaultMessage: "No location",
                      })}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-text-soft">
                    <div className="flex items-center gap-1">
                      <RiUserLine className="h-3 w-3" />
                      <span>
                        {intl.formatMessage(
                          {
                            id: "admin.dashboard.gardenOperators",
                            defaultMessage: "{count, plural, one {# op} other {# ops}}",
                          },
                          { count: garden.operators?.length || 0 }
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <RiPlantLine className="h-3 w-3" />
                      <span>
                        {intl.formatMessage(
                          {
                            id: "admin.dashboard.gardenGardeners",
                            defaultMessage: "{count, plural, one {# gardener} other {# gardeners}}",
                          },
                          { count: garden.gardeners?.length || 0 }
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
