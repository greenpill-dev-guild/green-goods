import { useCommitmentPools } from "@green-goods/shared/commitment-pooling";
import { GardenBannerFallback } from "@green-goods/shared/components/Display/GardenBannerFallback";
import { ImageWithFallback } from "@green-goods/shared/components/Display/ImageWithFallback";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useBrowserNavigation } from "@green-goods/shared/hooks/app/useBrowserNavigation";
import { useNavigateToTop } from "@green-goods/shared/hooks/app/useNavigateToTop";
import { useScrollToTop } from "@green-goods/shared/hooks/app/useScrollToTop";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import {
  useActions,
  useGardeners,
  useGardens,
} from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useConvictionStrategies } from "@green-goods/shared/hooks/conviction/useConvictionStrategies";
import { GardenTab, useGardenTabs } from "@green-goods/shared/hooks/garden/useGardenTabs";
import {
  isGardenMember,
  useJoinGarden,
  usePendingJoinsVersion,
} from "@green-goods/shared/hooks/garden/useJoinGarden";
import { useHasRole } from "@green-goods/shared/hooks/roles/useHasRole";
import { useGardenVaults } from "@green-goods/shared/hooks/vault/useGardenVaults";
import { useVaultDeposits } from "@green-goods/shared/hooks/vault/useVaultDeposits";
import { useWorks } from "@green-goods/shared/hooks/work/useWorks";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import type { Address } from "@green-goods/shared/types/domain";
import {
  RiCalendarEventFill,
  RiErrorWarningLine,
  RiLoader4Line,
  RiMapPin2Fill,
  RiUserAddLine,
} from "@remixicon/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { Outlet, useLocation, useParams } from "react-router-dom";
import { isAddress } from "viem";
import { Button } from "@/components/Actions";
import { ConvictionDrawer, EndowmentDrawer } from "@/components/Dialogs";
import { GardenErrorBoundary } from "@/components/Errors";
import {
  GardenAssessments,
  GardenGardeners,
  GardenJoinRequestDialog,
  type GardenMember,
  GardenWork,
} from "@/components/Features";
import { StandardTabs, TopNav } from "@/components/Navigation";
import { buildGardenTabs } from "./gardenTabs";
import { GardenPool } from "./Pool";

export const Garden: React.FC = () => {
  const intl = useIntl();
  const { primaryAddress } = useUser();
  const isEndowmentOpen = useUIStore((s) => s.isEndowmentDrawerOpen);
  const openEndowmentDrawer = useUIStore((s) => s.openEndowmentDrawer);
  const closeEndowmentDrawer = useUIStore((s) => s.closeEndowmentDrawer);
  const [isGovernanceOpen, setIsGovernanceOpen] = useState(false);
  // Track the actual rendered height of the fixed header so the spacer below
  // matches whatever the title section rendered as (including 1, 2, or 3+ line
  // garden names). Avoids overflow when names exceed the previous hardcoded
  // ~288px estimate.
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState<number | null>(null);
  useEffect(() => {
    const element = headerRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeaderHeight(entry.contentRect.height);
      }
    });
    observer.observe(element);
    setHeaderHeight(element.getBoundingClientRect().height);
    return () => observer.disconnect();
  }, []);

  // Ensure proper re-rendering on browser navigation
  useBrowserNavigation();

  // Reset scroll position before paint — prevents flash from stale scroll state
  useScrollToTop();

  const navigate = useNavigateToTop();
  const { activeTab, setActiveTab } = useGardenTabs();

  // Header uses CSS sticky; no JS height measurement needed

  const { id: gardenIdParam } = useParams<{ id: string }>();
  const { pathname } = useLocation();
  const chainId = DEFAULT_CHAIN_ID;
  const {
    data: allGardens = [],
    isLoading: gardensInitialLoading,
    isFetching: gardensLoading,
    isError: gardensError,
    refetch: refetchGardens,
  } = useGardens(chainId);
  // Addresses arrive in either case: the list is checksummed, the indexer's
  // pool and work rows are lowercase, and a link may be typed. One garden.
  const garden = allGardens.find((g) => g.id.toLowerCase() === gardenIdParam?.toLowerCase());
  const gardenStatus: "error" | "success" | "pending" = gardensError
    ? "error"
    : garden
      ? "success"
      : "pending";
  const { data: allGardeners = [] } = useGardeners();
  const { data: actions = [] } = useActions(chainId);
  const {
    works: mergedWorks,
    isLoading: worksLoading,
    isFetching: worksFetching,
    isError: worksError,
    refetch: refetchWorks,
  } = useWorks(gardenIdParam || "", { offline: true });
  const members = useMemo<GardenMember[]>(() => {
    if (!garden) return [];

    const stewardSet = new Set((garden.stewards ?? []).map((addr) => addr.toLowerCase()));
    const gardenerSet = new Set((garden.gardeners ?? []).map((addr) => addr.toLowerCase()));
    const seen = new Set<string>();
    const orderedAddresses: string[] = [];

    for (const list of [garden.stewards ?? [], garden.gardeners ?? []]) {
      for (const address of list) {
        const normalized = address.toLowerCase();
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        orderedAddresses.push(address);
      }
    }

    const fallbackRegisteredAt = garden.createdAt ?? Date.now();

    return orderedAddresses.map((address) => {
      const normalized = address.toLowerCase();
      const match = allGardeners.find((g) => g.account?.toLowerCase() === normalized);

      return {
        id: match?.id || address,
        account: address as Address,
        username: match?.username || undefined,
        email: match?.email || undefined,
        phone: match?.phone || undefined,
        avatar: match?.avatar || undefined,
        registeredAt: match?.registeredAt ?? fallbackRegisteredAt,
        isSteward: stewardSet.has(normalized),
        isGardener: gardenerSet.has(normalized),
      };
    });
  }, [allGardeners, garden]);

  const { vaults: gardenVaults = [] } = useGardenVaults(garden?.id as Address | undefined, {
    enabled: Boolean(garden?.id),
  });
  const { deposits: myVaultDeposits = [] } = useVaultDeposits(garden?.id as Address | undefined, {
    userAddress: primaryAddress ?? undefined,
    enabled: Boolean(garden?.id && primaryAddress),
  });
  const hasEndowmentDeposits = useMemo(
    () => myVaultDeposits.some((deposit) => deposit.shares > 0n),
    [myVaultDeposits]
  );

  const validGardenAddress = gardenIdParam && isAddress(gardenIdParam) ? gardenIdParam : undefined;

  const { pools: commitmentPools } = useCommitmentPools({
    chainId: DEFAULT_CHAIN_ID,
    garden: validGardenAddress as Address | undefined,
  });
  const commitmentPool = commitmentPools[0];
  const { strategies: convictionStrategies } = useConvictionStrategies(validGardenAddress, {
    enabled: Boolean(validGardenAddress),
  });
  const hasGovernanceConfigured = convictionStrategies.length > 0;

  // Check if current user is a steward (can approve/reject work)
  const isSteward = useMemo(() => {
    if (!primaryAddress || !garden?.stewards) return false;
    const normalizedUserAddress = primaryAddress.toLowerCase();
    return garden.stewards.some((addr) => addr.toLowerCase() === normalizedUserAddress);
  }, [primaryAddress, garden?.stewards]);

  const { hasRole: canReviewOnChain } = useHasRole(
    garden?.id as Address | undefined,
    primaryAddress as Address | undefined,
    "evaluator"
  );
  const canReview = isSteward || canReviewOnChain;
  const canManageRequests = useMemo(() => {
    if (!primaryAddress || !garden) return false;
    const account = primaryAddress.toLowerCase();
    return [...(garden.stewards ?? []), ...(garden.owners ?? [])].some(
      (address) => address.toLowerCase() === account
    );
  }, [garden, primaryAddress]);

  // Gate header drawers behind steward/funder roles. Default gardeners should not see
  // governance or endowment chrome — those drawers expose protocol-shaped surfaces (signal pool,
  // hypercert, vault, treasury) that don't belong on the gardener-default path.
  const hasOwnEndowmentDeposit = hasEndowmentDeposits;
  const showGovernanceButton = hasGovernanceConfigured && canReview;
  const showEndowmentButton = gardenVaults.length > 0 && (canReview || hasOwnEndowmentDeposit);
  const hasGovernance = showGovernanceButton;

  // The version counter refreshes membership as in-tab joins confirm or expire,
  // so the header does not keep showing stale join controls.
  const pendingJoinsVersion = usePendingJoinsVersion();
  const isMember = useMemo(() => {
    if (!garden) return false;
    const { gardeners, stewards, id } = garden;
    return canManageRequests || isGardenMember(primaryAddress, gardeners, stewards, id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version counter is a deliberate cache-buster, not a read dependency
  }, [primaryAddress, garden, canManageRequests, pendingJoinsVersion]);

  // Join garden functionality
  const { joinGarden, isJoining } = useJoinGarden();

  const handleJoinGarden = useCallback(async () => {
    if (!garden?.id) return;

    try {
      const result = await joinGarden(garden.id);
      if (result === "already-member") {
        toastService.success({
          title: intl.formatMessage({
            id: "app.garden.alreadyMember",
            defaultMessage: "You are already a member of this garden",
          }),
        });
      } else {
        toastService.success({
          title: intl.formatMessage({
            id: "app.garden.joinSuccess",
            defaultMessage: "Successfully joined garden",
          }),
        });
      }
    } catch {
      toastService.error({
        title: intl.formatMessage({
          id: "app.garden.joinError",
          defaultMessage: "Failed to join garden",
        }),
      });
    }
  }, [garden?.id, joinGarden, intl]);

  // Determine if join button should be shown
  const showJoinButton = useMemo(() => {
    if (!primaryAddress) return false;
    if (isMember) return false;
    if (!garden?.openJoining) return false;
    return true;
  }, [primaryAddress, isMember, garden?.openJoining]);
  const showJoinRequestButton = Boolean(primaryAddress && !isMember && !garden?.openJoining);

  if (!garden) {
    if (gardensInitialLoading) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-4 p-6">
          <TopNav onBackClick={() => navigate("/home")} />
          <RiLoader4Line className="w-8 h-8 text-text-soft-400 animate-spin" />
          <p className="text-sm text-text-sub-600 text-center">
            {intl.formatMessage({
              id: "app.garden.loading",
              defaultMessage: "Loading garden...",
            })}
          </p>
        </div>
      );
    }
    if (gardensError) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-4 p-6">
          <TopNav onBackClick={() => navigate("/home")} />
          <RiErrorWarningLine className="w-10 h-10 text-error-base" />
          <p className="text-sm text-text-sub-600 text-center max-w-xs">
            {intl.formatMessage({
              id: "app.garden.loadError",
              defaultMessage: "Couldn't load this garden. Check your connection and try again.",
            })}
          </p>
          <Button
            variant="primary"
            mode="filled"
            size="small"
            onClick={() => refetchGardens()}
            label={intl.formatMessage({
              id: "app.garden.loadRetry",
              defaultMessage: "Try Again",
            })}
          />
        </div>
      );
    }
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6">
        <TopNav onBackClick={() => navigate("/home")} />
        <RiMapPin2Fill className="w-10 h-10 text-text-soft-400" />
        <p className="text-sm text-text-sub-600 text-center">
          {intl.formatMessage({
            id: "app.garden.notFound",
            defaultMessage: "Garden not found",
          })}
        </p>
      </div>
    );
  }

  const { name, bannerImage, location, createdAt, assessments, description } = garden;

  // Restore scroll position when switching tabs

  const tabs = buildGardenTabs(intl, { hasPool: Boolean(commitmentPool) });

  const renderTabContent = () => {
    switch (activeTab) {
      case GardenTab.Work: {
        // Determine fetch status from actual hook states
        const workFetchStatus: "pending" | "success" | "error" = worksError
          ? "error"
          : worksLoading
            ? "pending"
            : "success";
        return (
          <GardenWork
            workFetchStatus={workFetchStatus}
            actions={actions}
            works={mergedWorks}
            isFetching={worksFetching}
            onRefresh={refetchWorks}
          />
        );
      }
      case GardenTab.Pool:
        return commitmentPool ? <GardenPool pool={commitmentPool} /> : null;
      case GardenTab.Insights:
        return (
          <GardenAssessments
            assessmentFetchStatus={gardensLoading ? "pending" : gardenStatus}
            assessments={assessments}
            description={description}
          />
        );
      case GardenTab.Gardeners:
        return (
          <GardenGardeners
            members={members}
            garden={garden}
            canManageRequests={canManageRequests}
          />
        );
    }
  };

  // No custom scroll restoration; StandardTabs resets nearest scroll container

  return (
    <GardenErrorBoundary>
      <div className="h-full min-h-0 w-full flex flex-col relative overflow-hidden">
        {pathname.includes("work") ||
        pathname.includes("assessments") ||
        pathname.includes("commitments") ? null : (
          <>
            {/* Fixed Header (banner + TopNav + title/metadata) */}
            <div ref={headerRef} className="fixed top-0 left-0 right-0 bg-bg-white-0 z-20">
              <div className="relative w-full h-36 md:h-44 overflow-hidden rounded-b-3xl">
                <ImageWithFallback
                  src={bannerImage || ""}
                  alt={`${name} banner`}
                  loading="eager"
                  className="absolute inset-0 w-full h-full object-cover object-center"
                  backgroundFallback={
                    <GardenBannerFallback name={name} className="rounded-b-3xl" />
                  }
                />
                <div className="absolute top-0 left-0 right-0 z-20">
                  <TopNav
                    className="flex w-full justify-between items-start p-4 pt-6"
                    onBackClick={() => navigate("/home")}
                    works={mergedWorks}
                    garden={garden}
                    isSteward={canReview}
                    showGovernanceButton={showGovernanceButton}
                    onGovernanceClick={() => setIsGovernanceOpen(true)}
                    showEndowmentButton={showEndowmentButton}
                    hasEndowmentDeposits={hasEndowmentDeposits}
                    onEndowmentClick={openEndowmentDrawer}
                  />
                </div>
              </div>

              {/* Title and meta below banner */}
              <div className="px-4 sm:px-5 md:px-6 mt-3 flex flex-col gap-1.5 pb-3 bg-bg-white-0">
                <h1 className="title-section line-clamp-2" title={name}>
                  {name}
                </h1>
                <div className="flex items-center gap-2">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5 text-sm text-text-sub-600">
                      <RiMapPin2Fill className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="truncate" title={location}>
                        {location}
                      </span>
                    </div>
                    <span className="hidden sm:inline text-text-soft-400">•</span>
                    <div className="flex items-center gap-1.5 text-sm text-text-sub-600">
                      <RiCalendarEventFill className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>
                        {intl.formatMessage({ id: "app.home.founded" })}{" "}
                        {new Date(createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {showJoinButton && (
                    <Button
                      label={intl.formatMessage({
                        id: "app.garden.join",
                        defaultMessage: "Join Garden",
                      })}
                      leadingIcon={<RiUserAddLine className="w-4 h-4" />}
                      variant="primary"
                      mode="filled"
                      size="small"
                      onClick={handleJoinGarden}
                      disabled={isJoining}
                    />
                  )}
                  {showJoinRequestButton ? (
                    <GardenJoinRequestDialog gardenAddress={garden.id as Address} />
                  ) : null}
                </div>
              </div>

              {/* Tabs sticky under header */}
              <div className="sticky top-0 left-0 right-0 w-full bg-bg-white-0 z-10 shadow-sm">
                <StandardTabs
                  tabs={tabs}
                  activeTab={activeTab}
                  onTabChange={(tabId) => setActiveTab(tabId as GardenTab)}
                  ariaLabel={intl.formatMessage({
                    id: "app.garden.tabs.label",
                    defaultMessage: "Garden sections",
                  })}
                  variant="compact"
                  isLoading={gardensLoading || worksFetching}
                />
              </div>
            </div>

            {/* Spacer matches the measured fixed-header height so the
                scrollable content below starts at the right place even when
                the garden name wraps to 3+ lines. Falls back to a sensible
                static height for the brief moment before ResizeObserver
                reports a value. */}
            <div
              className="flex-shrink-0"
              style={{ height: headerHeight !== null ? `${headerHeight}px` : undefined }}
              aria-hidden="true"
            >
              {headerHeight === null && (
                <div className="h-[288px] md:h-[320px] w-full" aria-hidden="true" />
              )}
            </div>

            {/* Scrollable content below fixed header */}
            <div
              className="flex-1 min-h-0 px-4 sm:px-5 md:px-6 pt-3 sm:pt-4 pb-24 overflow-y-auto overflow-x-hidden"
              aria-busy={worksFetching}
            >
              {renderTabContent()}
            </div>
          </>
        )}
        {garden && (
          <EndowmentDrawer
            isOpen={isEndowmentOpen}
            onClose={closeEndowmentDrawer}
            gardenAddress={garden.id as Address}
            gardenName={garden.name}
          />
        )}
        {garden && hasGovernance && (
          <ConvictionDrawer
            isOpen={isGovernanceOpen}
            onClose={() => setIsGovernanceOpen(false)}
            gardenAddress={garden.id as Address}
            gardenName={garden.name}
          />
        )}
        <Outlet context={{ gardenId: garden.id }} />
      </div>
    </GardenErrorBoundary>
  );
};
