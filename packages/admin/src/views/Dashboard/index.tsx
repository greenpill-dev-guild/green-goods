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
  RiCheckLine,
  RiGlobalLine,
  RiLoader4Line,
  RiPlantLine,
  RiUserLine,
  RiWifiOffLine,
} from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { useAccount } from "wagmi";

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
            <h1 className="text-2xl font-bold text-text-strong">
              Welcome back,{" "}
              {intl.formatMessage({
                id: `admin.dashboard.role.${role}`,
                defaultMessage:
                  role === "deployer" ? "Deployer" : role === "operator" ? "Operator" : "User",
              })}
            </h1>
            <p className="text-text-sub mt-1">
              {role === "deployer"
                ? "Manage gardens, deploy contracts, and oversee platform operations"
                : role === "operator"
                  ? `Manage your ${operatorGardens.length} garden${operatorGardens.length !== 1 ? "s" : ""}`
                  : "View gardens and explore the Green Goods ecosystem"}
            </p>
          </div>

          <div className="bg-bg-white rounded-lg shadow-sm transition-shadow duration-200 hover:shadow-md border border-stroke-soft p-6">
            <h2 className="text-lg font-medium text-text-strong mb-4">
              {intl.formatMessage({
                id: "admin.dashboard.quickActions",
                defaultMessage: "Quick Actions",
              })}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <a
                href="/gardens"
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
              </a>
              {role === "deployer" && (
                <a
                  href="/contracts"
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
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-strong">
          Welcome back,{" "}
          {intl.formatMessage({
            id: `admin.dashboard.role.${role}`,
            defaultMessage:
              role === "deployer" ? "Deployer" : role === "operator" ? "Operator" : "User",
          })}
        </h1>
        <p className="text-text-sub mt-1">
          {role === "deployer"
            ? "Manage gardens, deploy contracts, and oversee platform operations"
            : role === "operator"
              ? `Manage your ${operatorGardens.length} garden${operatorGardens.length !== 1 ? "s" : ""}`
              : "View gardens and explore the Green Goods ecosystem"}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-bg-white p-6 rounded-lg shadow-sm border border-stroke-soft">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <RiPlantLine className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-text-soft">
                {intl.formatMessage({
                  id:
                    role === "operator"
                      ? "admin.dashboard.stats.yourGardens"
                      : "admin.dashboard.stats.totalGardens",
                  defaultMessage: role === "operator" ? "Your Gardens" : "Total Gardens",
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
                <div className="p-2 bg-blue-100 rounded-lg">
                  <RiUserLine className="h-6 w-6 text-blue-600" />
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
                <div className="p-2 bg-purple-100 rounded-lg">
                  <RiUserLine className="h-6 w-6 text-purple-600" />
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

      {/* ENS Claim Card */}
      {showENSCard && (
        <div className="bg-bg-white rounded-lg shadow-sm border border-stroke-soft p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-green-100 rounded-lg shrink-0">
              <RiGlobalLine className="h-6 w-6 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-medium text-text-strong">Claim your ENS name</h2>
              <p className="text-sm text-text-sub mt-1 mb-4">
                As a protocol member, you can claim a personal{" "}
                <span className="font-mono">.greengoods.eth</span> subdomain. Registration takes
                ~15-20 minutes via Chainlink CCIP cross-chain messaging. You will pay the CCIP fee.
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
                    className="w-full rounded-lg border border-stroke-soft bg-bg-weak px-3 py-2 pr-10 font-mono text-sm text-text-strong shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200/80"
                  />
                  {slugValue && slugValue.length >= 3 && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isCheckingSlug ? (
                        <RiLoader4Line className="h-4 w-4 animate-spin text-text-soft" />
                      ) : isSlugAvailable ? (
                        <RiCheckLine className="h-4 w-4 text-green-500" />
                      ) : isSlugAvailable === false ? (
                        <span className="text-xs text-error-base">Taken</span>
                      ) : null}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleAdminENSClaim}
                  disabled={
                    !isOnline ||
                    ensClaim.isPending ||
                    !isSlugAvailable ||
                    isCheckingSlug ||
                    !slugValue
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  {!isOnline ? (
                    <RiWifiOffLine className="h-4 w-4" />
                  ) : ensClaim.isPending ? (
                    <RiLoader4Line className="h-4 w-4 animate-spin" />
                  ) : (
                    <RiGlobalLine className="h-4 w-4" />
                  )}
                  {!isOnline ? "Offline" : ensClaim.isPending ? "Claiming..." : "Claim name"}
                </button>
              </div>
              {slugValue && (
                <p className="text-xs text-text-soft mt-2 font-mono">{slugValue}.greengoods.eth</p>
              )}
              {slugForm.formState.errors.slug && (
                <p className="text-xs text-error-base mt-1">
                  {slugForm.formState.errors.slug.message}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ENS Registration Progress */}
      {claimedSlug && registrationData && registrationData.status !== "available" && (
        <div className="mb-8">
          <ENSProgressTimeline data={registrationData} slug={claimedSlug} />
        </div>
      )}

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
                    <p className="text-sm text-text-soft">Operator Garden</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-text-soft">Managed Garden</p>
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
                    <p className="text-sm text-text-soft">{garden.location || "No location"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-text-soft">
                      {garden.operators?.length || 0} operators, {garden.gardeners?.length || 0}{" "}
                      gardeners
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
