import { useGardens, useRole } from "@green-goods/shared";
import { RiPlantLine, RiUserLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";

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

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-bg-soft rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-bg-soft rounded"></div>
            ))}
          </div>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-bg-white p-6 rounded-lg shadow-sm border border-stroke-soft">
          <div className="flex items-center">
            <div className="p-2 bg-success-lighter rounded-lg">
              <RiPlantLine className="h-6 w-6 text-success-dark" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-text-soft">
                {role === "operator"
                  ? intl.formatMessage({
                      id: "admin.dashboard.stats.yourGardens",
                      defaultMessage: "Your Gardens",
                    })
                  : intl.formatMessage({
                      id: "admin.dashboard.stats.totalGardens",
                      defaultMessage: "Total Gardens",
                    })}
              </p>
              <p className="text-2xl font-bold text-text-strong">
                {role === "operator" ? userOperatorGardens : totalGardens}
              </p>
            </div>
          </div>
        </div>

        {(role === "deployer" || role === "operator") && (
          <>
            <div className="bg-bg-white p-6 rounded-lg shadow-sm border border-stroke-soft">
              <div className="flex items-center">
                <div className="p-2 bg-information-lighter rounded-lg">
                  <RiUserLine className="h-6 w-6 text-information-dark" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-text-soft">
                    {intl.formatMessage({
                      id: "admin.dashboard.stats.totalOperators",
                      defaultMessage: "Total Operators",
                    })}
                  </p>
                  <p className="text-2xl font-bold text-text-strong">{totalOperators}</p>
                </div>
              </div>
            </div>

            <div className="bg-bg-white p-6 rounded-lg shadow-sm border border-stroke-soft">
              <div className="flex items-center">
                <div className="p-2 bg-warning-lighter rounded-lg">
                  <RiUserLine className="h-6 w-6 text-warning-dark" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-text-soft">
                    {intl.formatMessage({
                      id: "admin.dashboard.stats.totalGardeners",
                      defaultMessage: "Total Gardeners",
                    })}
                  </p>
                  <p className="text-2xl font-bold text-text-strong">{totalGardeners}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Recent Activity */}
      <div className="bg-bg-white rounded-lg shadow-sm border border-stroke-soft">
        <div className="p-6 border-b border-stroke-soft">
          <h2 className="text-lg font-medium text-text-strong">
            {intl.formatMessage({
              id: "admin.dashboard.recentGardens",
              defaultMessage: "Recent Gardens",
            })}
          </h2>
        </div>
        <div className="p-6">
          {role === "operator"
            ? operatorGardens.slice(0, 5).map((garden) => (
                <div
                  key={garden.id}
                  className="flex items-center justify-between py-3 border-b border-stroke-soft last:border-b-0"
                >
                  <div>
                    <h3 className="text-sm font-medium text-text-strong">{garden.name}</h3>
                    <p className="text-sm text-text-soft">
                      {intl.formatMessage({
                        id: "admin.dashboard.operatorGarden",
                        defaultMessage: "Operator Garden",
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-text-soft">
                      {intl.formatMessage({
                        id: "admin.dashboard.managedGarden",
                        defaultMessage: "Managed Garden",
                      })}
                    </p>
                  </div>
                </div>
              ))
            : gardens.slice(0, 5).map((garden) => (
                <div
                  key={garden.id}
                  className="flex items-center justify-between py-3 border-b border-stroke-soft last:border-b-0"
                >
                  <div>
                    <h3 className="text-sm font-medium text-text-strong">{garden.name}</h3>
                    <p className="text-sm text-text-soft">
                      {garden.location ||
                        intl.formatMessage({
                          id: "admin.dashboard.noLocation",
                          defaultMessage: "No location",
                        })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-text-soft">
                      {intl.formatMessage(
                        {
                          id: "admin.dashboard.gardenMembers",
                          defaultMessage: "{operators} operators, {gardeners} gardeners",
                        },
                        {
                          operators: garden.operators?.length || 0,
                          gardeners: garden.gardeners?.length || 0,
                        }
                      )}
                    </p>
                  </div>
                </div>
              ))}
          {(role === "operator" ? operatorGardens : gardens).length === 0 && (
            <p className="text-text-soft text-center py-8">
              {intl.formatMessage({
                id: "admin.dashboard.noGardens",
                defaultMessage: "No gardens found",
              })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
