import {
  ENSProgressTimeline,
  useENSClaim,
  useENSRegistrationStatus,
  useGardens,
  useProtocolMemberStatus,
  useRole,
  useSlugAvailability,
  useSlugForm,
  useWindowEvent,
} from "@green-goods/shared";
import {
  RiAddLine,
  RiAlertLine,
  RiArrowRightSLine,
  RiCheckLine,
  RiFileList3Line,
  RiGlobalLine,
  RiLoader4Line,
  RiPlantLine,
  RiSafeLine,
  RiUserLine,
  RiWifiOffLine,
} from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { useAccount } from "wagmi";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export default function Dashboard() {
  const intl = useIntl();
  const { role, operatorGardens } = useRole();
  const { data: gardens = [], isLoading, error } = useGardens();
  const totalGardens = gardens.length;
  const userOperatorGardens = operatorGardens.length;
  const totalOperators = new Set(gardens.flatMap((g) => g.operators)).size;
  const totalGardeners = new Set(gardens.flatMap((g) => g.gardeners)).size;

  // ── Network Status ────────────────────────────────
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useWindowEvent("online", () => setIsOnline(true));
  useWindowEvent("offline", () => setIsOnline(false));

  // ── ENS Claim (Self-Funded) ────────────────────────
  const { address } = useAccount();
  const { data: isProtocolMember = false } = useProtocolMemberStatus(address);
  const slugForm = useSlugForm();
  const slugValue = slugForm.watch("slug");
  const { data: isSlugAvailable, isFetching: isCheckingSlug } = useSlugAvailability(
    slugValue || undefined
  );
  const ensClaim = useENSClaim();
  const [claimedSlug, setClaimedSlug] = useState<string | null>(null);
  const { data: registrationData } = useENSRegistrationStatus(claimedSlug ?? undefined);

  const hasExistingName =
    registrationData?.status === "pending" || registrationData?.status === "active";
  const showENSCard = isProtocolMember && !hasExistingName;

  const handleAdminENSClaim = async () => {
    const isValid = await slugForm.trigger("slug");
    if (!isValid) return;
    const slug = slugForm.getValues("slug");
    try {
      await ensClaim.mutateAsync({ slug });
      setClaimedSlug(slug);
      slugForm.reset();
    } catch {
      // Error handled in mutation hook
    }
  };
  // ─────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-6" role="status" aria-live="polite">
        <span className="sr-only">Loading dashboard</span>
        <div className="space-y-4">
          <div className="h-8 skeleton-shimmer rounded w-1/4" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} padding="feature">
                <div className="flex items-center">
                  <div
                    className="h-10 w-10 rounded-lg skeleton-shimmer"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  />
                  <div className="ml-4 flex-1">
                    <div
                      className="h-4 w-20 rounded skeleton-shimmer"
                      style={{ animationDelay: `${i * 0.1}s` }}
                    />
                    <div
                      className="mt-2 h-7 w-12 rounded skeleton-shimmer"
                      style={{ animationDelay: `${i * 0.1 + 0.05}s` }}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-warning-lighter border border-warning-light rounded-md p-4" role="alert">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <RiAlertLine className="h-5 w-5 text-warning-base" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-warning-dark">
                {intl.formatMessage({
                  id: "admin.dashboard.indexer.error",
                  defaultMessage: "Indexer Connection Issue",
                })}
              </h3>
              <div className="mt-2 text-sm text-warning-dark">
                <p>
                  Unable to connect to the indexer:{" "}
                  {error instanceof Error ? error.message : "Unknown error"}
                </p>
                <p className="mt-1">
                  The dashboard will work with limited functionality. Garden operations are still
                  available.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Fallback dashboard without stats */}
        <div className="mt-8">
          <div className="mb-8">
            <h1 className="font-heading text-2xl font-bold text-text-strong">
              Welcome back,{" "}
              {intl.formatMessage({
                id: `admin.dashboard.role.${role}`,
                defaultMessage:
                  role === "deployer" ? "Deployer" : role === "operator" ? "Operator" : "User",
              })}
            </h1>
            <p className="text-text-sub mt-1">
              {role === "deployer"
                ? intl.formatMessage({
                    id: "admin.dashboard.desc.deployer",
                    defaultMessage:
                      "Manage gardens, deploy contracts, and oversee platform operations",
                  })
                : role === "operator"
                  ? intl.formatMessage(
                      {
                        id: "admin.dashboard.desc.operator",
                        defaultMessage:
                          "Manage your {count} {count, plural, one {garden} other {gardens}}",
                      },
                      { count: operatorGardens.length }
                    )
                  : intl.formatMessage({
                      id: "admin.dashboard.desc.user",
                      defaultMessage: "View gardens and explore the Green Goods ecosystem",
                    })}
            </p>
          </div>

          <Card padding="feature" variant="interactive">
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
                    id: "admin.dashboard.actions.viewGardens",
                    defaultMessage: "View Gardens",
                  })}
                </h3>
                <p className="text-sm text-text-sub mt-1">
                  {intl.formatMessage({
                    id: "admin.dashboard.actions.viewGardens.desc",
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
                      id: "admin.dashboard.actions.contracts",
                      defaultMessage: "Contract Management",
                    })}
                  </h3>
                  <p className="text-sm text-text-sub mt-1">
                    {intl.formatMessage({
                      id: "admin.dashboard.actions.contracts.desc",
                      defaultMessage: "Deploy and manage contracts",
                    })}
                  </p>
                </Link>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold text-text-strong">
          Welcome back,{" "}
          {role === "deployer"
            ? intl.formatMessage({
                id: "admin.dashboard.role.deployer",
                defaultMessage: "Deployer",
              })
            : role === "operator"
              ? intl.formatMessage({
                  id: "admin.dashboard.role.operator",
                  defaultMessage: "Operator",
                })
              : intl.formatMessage({
                  id: "admin.dashboard.role.user",
                  defaultMessage: "User",
                })}
        </h1>
        <p className="text-text-sub mt-1">
          {role === "deployer"
            ? intl.formatMessage({
                id: "admin.dashboard.desc.deployer",
                defaultMessage: "Manage gardens, deploy contracts, and oversee platform operations",
              })
            : role === "operator"
              ? intl.formatMessage(
                  {
                    id: "admin.dashboard.desc.operator",
                    defaultMessage:
                      "Manage your {count} {count, plural, one {garden} other {gardens}}",
                  },
                  { count: operatorGardens.length }
                )
              : intl.formatMessage({
                  id: "admin.dashboard.desc.user",
                  defaultMessage: "View gardens and explore the Green Goods ecosystem",
                })}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="stagger-children grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={<RiPlantLine className="h-6 w-6" />}
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
              icon={<RiUserLine className="h-6 w-6" />}
              label={intl.formatMessage({
                id: "admin.dashboard.stats.totalOperators",
                defaultMessage: "Total Operators",
              })}
              value={totalOperators}
              colorScheme="info"
            />

            <StatCard
              icon={<RiUserLine className="h-6 w-6" />}
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

      {/* ENS Claim Card */}
      {showENSCard && (
        <Card padding="feature" colorAccent="info" className="mb-8">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-primary-alpha-16 rounded-lg shrink-0">
              <RiGlobalLine className="h-6 w-6 text-primary-base" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-medium text-text-strong">
                {intl.formatMessage({
                  id: "admin.dashboard.ens.title",
                  defaultMessage: "Claim your ENS name",
                })}
              </h2>
              <p className="text-sm text-text-sub mt-1 mb-4">
                {intl.formatMessage({
                  id: "admin.dashboard.ens.description",
                  defaultMessage:
                    "As a protocol member, you can claim a personal .greengoods.eth subdomain. Registration takes ~15-20 minutes via Chainlink CCIP cross-chain messaging. You will pay the CCIP fee.",
                })}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <input
                    {...slugForm.register("slug")}
                    placeholder="your-name"
                    inputMode="text"
                    autoCapitalize="none"
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full rounded-lg border border-stroke-soft bg-bg-weak px-3 py-2 pr-10 font-mono text-sm text-text-strong shadow-sm focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-alpha-24"
                  />
                  {slugValue && slugValue.length >= 3 && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isCheckingSlug ? (
                        <RiLoader4Line className="h-4 w-4 animate-spin text-text-soft" />
                      ) : isSlugAvailable ? (
                        <RiCheckLine className="h-4 w-4 text-primary-base" />
                      ) : isSlugAvailable === false ? (
                        <span className="text-xs text-error-base">
                          {intl.formatMessage({
                            id: "admin.dashboard.ens.taken",
                            defaultMessage: "Taken",
                          })}
                        </span>
                      ) : null}
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  onClick={handleAdminENSClaim}
                  disabled={
                    !isOnline ||
                    ensClaim.isPending ||
                    !isSlugAvailable ||
                    isCheckingSlug ||
                    !slugValue
                  }
                  loading={ensClaim.isPending}
                  className="shrink-0"
                >
                  {!isOnline ? (
                    <RiWifiOffLine className="h-4 w-4" />
                  ) : !ensClaim.isPending ? (
                    <RiGlobalLine className="h-4 w-4" />
                  ) : null}
                  {!isOnline
                    ? intl.formatMessage({
                        id: "admin.dashboard.ens.offline",
                        defaultMessage: "Offline",
                      })
                    : ensClaim.isPending
                      ? intl.formatMessage({
                          id: "admin.dashboard.ens.claiming",
                          defaultMessage: "Claiming...",
                        })
                      : intl.formatMessage({
                          id: "admin.dashboard.ens.claimName",
                          defaultMessage: "Claim name",
                        })}
                </Button>
              </div>
              {slugValue && (
                <p className="text-xs text-text-soft mt-2 font-mono">{slugValue}.greengoods.eth</p>
              )}
              {slugForm.formState.errors.slug && (
                <p className="text-xs text-error-base mt-1" role="alert">
                  {slugForm.formState.errors.slug.message}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ENS Registration Progress */}
      {claimedSlug && registrationData && registrationData.status !== "available" && (
        <div className="mb-8">
          <ENSProgressTimeline data={registrationData} slug={claimedSlug} />
        </div>
      )}

      {/* Quick Actions */}
      <Card padding="feature" colorAccent="primary" className="mb-8 animate-fade-in-up">
        <h2 className="font-heading text-lg font-medium text-text-strong mb-4">
          {intl.formatMessage({
            id: "admin.dashboard.quickActions",
            defaultMessage: "Quick Actions",
          })}
        </h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" size="sm" asChild>
            <Link to="/gardens/create">
              <RiAddLine className="h-4 w-4" />
              {intl.formatMessage({
                id: "admin.dashboard.quickActions.createGarden",
                defaultMessage: "Create Garden",
              })}
            </Link>
          </Button>
          {(role === "deployer" || role === "operator") && (
            <Button variant="secondary" size="sm" asChild>
              <Link to="/actions/create">
                <RiFileList3Line className="h-4 w-4" />
                {intl.formatMessage({
                  id: "admin.dashboard.quickActions.createAction",
                  defaultMessage: "Create Action",
                })}
              </Link>
            </Button>
          )}
          {(role === "deployer" || role === "operator") && (
            <Button variant="secondary" size="sm" asChild>
              <Link to="/treasury">
                <RiSafeLine className="h-4 w-4" />
                {intl.formatMessage({
                  id: "admin.dashboard.quickActions.viewTreasury",
                  defaultMessage: "View Treasury",
                })}
              </Link>
            </Button>
          )}
        </div>
      </Card>

      {/* Recent Gardens */}
      <Card colorAccent="success" className="animate-fade-in-up">
        <Card.Header>
          <h2 className="font-heading text-lg font-medium text-text-strong">
            {intl.formatMessage({
              id: "admin.dashboard.recentGardens",
              defaultMessage: "Recent Gardens",
            })}
          </h2>
          <Link
            to="/gardens"
            className="text-sm text-primary-base hover:text-primary-darker transition-colors"
          >
            {intl.formatMessage({
              id: "admin.dashboard.viewAll",
              defaultMessage: "View all",
            })}
          </Link>
        </Card.Header>
        <div className="divide-y divide-stroke-soft">
          {(role === "operator" ? operatorGardens : gardens).slice(0, 5).map((garden) => (
            <Link
              key={garden.id}
              to={`/gardens/${garden.id}`}
              className="group flex items-center gap-3 px-6 py-3 transition-colors hover:bg-bg-weak"
            >
              {/* Garden monogram */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary-dark to-primary-darker text-xs font-bold text-primary-foreground">
                {garden.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="label-sm text-text-strong group-hover:text-primary-base transition-colors">
                  {garden.name}
                </h3>
                <p className="body-xs text-text-soft">
                  {garden.location ||
                    intl.formatMessage({
                      id: "admin.dashboard.noLocation",
                      defaultMessage: "No location",
                    })}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="hidden items-center gap-3 sm:flex">
                  <span className="inline-flex items-center gap-1 body-xs tabular-nums text-text-soft">
                    <RiUserLine className="h-3.5 w-3.5" />
                    {garden.operators?.length || 0}
                  </span>
                  <span className="inline-flex items-center gap-1 body-xs tabular-nums text-text-soft">
                    <RiPlantLine className="h-3.5 w-3.5" />
                    {garden.gardeners?.length || 0}
                  </span>
                </div>
                {/* Sparkline-ready slot */}
                <div className="hidden w-16 lg:block" />
                <RiArrowRightSLine className="h-4 w-4 text-text-disabled group-hover:text-primary-base transition-colors" />
              </div>
            </Link>
          ))}
          {(role === "operator" ? operatorGardens : gardens).length === 0 && (
            <Card.Body>
              <EmptyState
                icon={<RiPlantLine className="h-6 w-6" />}
                title={intl.formatMessage({
                  id: "admin.dashboard.noGardens",
                  defaultMessage: "No gardens found",
                })}
                description={intl.formatMessage({
                  id: "admin.dashboard.noGardens.description",
                  defaultMessage: "Gardens will appear here once they are created.",
                })}
              />
            </Card.Body>
          )}
        </div>
      </Card>
    </div>
  );
}
