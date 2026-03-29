import { useActions, useGardens, usePlatformStats, useRole } from "@green-goods/shared";
import {
  RiAwardLine,
  RiFileListLine,
  RiFlashlightLine,
  RiPlantLine,
  RiTeamLine,
  RiTimeLine,
} from "@remixicon/react";
import { useIsRestoring } from "@tanstack/react-query";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { Link, useNavigate } from "react-router-dom";
import { GardenSummaryList } from "@/components/Dashboard/GardenSummaryList";
import { RecentActivitySection } from "@/components/Dashboard/RecentActivitySection";
import { PageHeader } from "@/components/Layout/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonGrid } from "@/components/ui/Skeleton";

function useDashboardHeader(intl: ReturnType<typeof useIntl>, role: string, gardenCount: number) {
  const roleLabel =
    role === "deployer"
      ? intl.formatMessage({ id: "admin.dashboard.role.deployer", defaultMessage: "Deployer" })
      : role === "operator"
        ? intl.formatMessage({ id: "admin.dashboard.role.operator", defaultMessage: "Operator" })
        : intl.formatMessage({ id: "admin.dashboard.role.user", defaultMessage: "Explorer" });

  const title = intl.formatMessage(
    { id: "admin.dashboard.welcome", defaultMessage: "Welcome back, {role}" },
    { role: roleLabel }
  );

  const description =
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
            defaultMessage: "Explore gardens and discover regenerative impact across the network",
          });

  return { title, description };
}

export default function Dashboard() {
  const intl = useIntl();
  const navigate = useNavigate();
  const isRestoring = useIsRestoring();
  const { role, operatorGardens } = useRole();
  const { data: gardens = [], isLoading, error } = useGardens();
  const { data: actions = [] } = useActions();
  const { title: welcomeTitle, description: welcomeDescription } = useDashboardHeader(
    intl,
    role,
    operatorGardens.length
  );

  // Memoize garden addresses for platform stats query
  const gardenAddresses = useMemo(() => gardens.map((g) => g.id), [gardens]);

  // Platform-wide work/assessment stats from EAS
  const { data: platformStats } = usePlatformStats(gardenAddresses);

  // Memoize all derived stats to avoid recomputing on every render (Phase 5)
  const stats = useMemo(() => {
    const operatorSet = new Set(gardens.flatMap((g) => g.operators));
    const gardenerSet = new Set(gardens.flatMap((g) => g.gardeners));
    const evaluatorSet = new Set(gardens.flatMap((g) => g.evaluators));

    // Deduplicate across all role sets for total members
    const allMembers = new Set([...operatorSet, ...gardenerSet, ...evaluatorSet]);

    return {
      totalMembers: allMembers.size,
      activeActions: actions.length,
    };
  }, [gardens, actions]);

  const displayGardens = role === "operator" ? operatorGardens : gardens;

  if (isLoading || isRestoring) {
    return (
      <div className="pb-6">
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
      <div className="pb-6">
        <Alert
          variant="warning"
          title={intl.formatMessage({
            id: "admin.dashboard.indexerError.title",
            defaultMessage: "Indexer Connection Issue",
          })}
        >
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
        </Alert>

        {/* Fallback dashboard without stats */}
        <div className="mt-8">
          <PageHeader title={welcomeTitle} description={welcomeDescription} />

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
    <div className="pb-6">
      <PageHeader title={welcomeTitle} description={welcomeDescription} />

      {/* Stats Grid */}
      <div className="stagger-children grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 mb-8 px-4 sm:px-6">
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
          value={role === "operator" ? operatorGardens.length : gardens.length}
          colorScheme="success"
          to="/gardens"
        />

        {(role === "deployer" || role === "operator") && (
          <>
            <StatCard
              icon={<RiTeamLine className="h-5 w-5" />}
              label={intl.formatMessage({
                id: "admin.dashboard.stats.totalMembers",
                defaultMessage: "Total Members",
              })}
              value={stats.totalMembers}
              colorScheme="info"
            />

            <StatCard
              icon={<RiFlashlightLine className="h-5 w-5" />}
              label={intl.formatMessage({
                id: "admin.dashboard.stats.activeActions",
                defaultMessage: "Active Actions",
              })}
              value={stats.activeActions}
              colorScheme="warning"
              to="/actions"
            />

            <StatCard
              icon={<RiFileListLine className="h-5 w-5" />}
              label={intl.formatMessage({
                id: "admin.dashboard.stats.workSubmissions",
                defaultMessage: "Work Submissions",
              })}
              value={platformStats?.totalWorks ?? "—"}
              colorScheme="info"
            />

            <StatCard
              icon={<RiTimeLine className="h-5 w-5" />}
              label={intl.formatMessage({
                id: "admin.dashboard.stats.pendingReviews",
                defaultMessage: "Pending Reviews",
              })}
              value={platformStats?.pendingWorks ?? "—"}
              colorScheme="warning"
              to="/gardens?scope=mine"
            />

            <StatCard
              icon={<RiAwardLine className="h-5 w-5" />}
              label={intl.formatMessage({
                id: "admin.dashboard.stats.assessments",
                defaultMessage: "Assessments",
              })}
              value={platformStats?.totalAssessments ?? "—"}
              colorScheme="success"
              to="/assessments"
            />
          </>
        )}
      </div>

      {/* Two-column layout: Garden list + Activity feed */}
      <div className="px-4 sm:px-6">
        {displayGardens.length === 0 ? (
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
            action={
              role === "deployer"
                ? {
                    label: intl.formatMessage({
                      id: "admin.dashboard.noGardens.cta.create",
                      defaultMessage: "Create Garden",
                    }),
                    onClick: () => navigate("/gardens/create"),
                  }
                : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <GardenSummaryList
              gardens={displayGardens}
              works={platformStats?.works}
              assessments={platformStats?.assessments}
              className="lg:col-span-2"
            />
            <RecentActivitySection
              gardens={displayGardens}
              works={platformStats?.works}
              assessments={platformStats?.assessments}
              workApprovals={platformStats?.workApprovals}
              className="lg:col-span-1"
            />
          </div>
        )}
      </div>
    </div>
  );
}
