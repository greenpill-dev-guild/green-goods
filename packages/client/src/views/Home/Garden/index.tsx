import {
  DEFAULT_CHAIN_ID,
  GardenTab,
  isGardenMember,
  useActions,
  useBrowserNavigation,
  useConvictionStrategies,
  useGardeners,
  useGardenVaults,
  useGardens,
  useGardenTabs,
  useHasRole,
  useJoinGarden,
  useNavigateToTop,
  useUser,
  useVaultDeposits,
  useWorks,
  toastService,
  type Address,
} from "@green-goods/shared";
import {
  RiCalendarEventFill,
  RiFileChartFill,
  RiGroupFill,
  RiHammerFill,
  RiLoader4Line,
  RiMapPin2Fill,
  RiUserAddLine,
} from "@remixicon/react";
import React, { useCallback, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { Outlet, useLocation, useParams } from "react-router-dom";
import { isAddress } from "viem";
import { Button } from "@/components/Actions";
import { ConvictionDrawer, EndowmentDrawer } from "@/components/Dialogs";
import { GardenErrorBoundary } from "@/components/Errors";
import {
  GardenAssessments,
  GardenGardeners,
  type GardenMember,
  GardenWork,
} from "@/components/Features";
import { type StandardTab, StandardTabs, TopNav } from "@/components/Navigation";

type GardenProps = {};

export const Garden: React.FC<GardenProps> = () => {
  const intl = useIntl();
  const { primaryAddress } = useUser();
  const [isEndowmentOpen, setIsEndowmentOpen] = useState(false);
  const [isGovernanceOpen, setIsGovernanceOpen] = useState(false);

  // Ensure proper re-rendering on browser navigation
  useBrowserNavigation();

  // Removed JS-based scroll toggling; use CSS-only containment instead

  const tabNames = {
    [GardenTab.Work]: intl.formatMessage({
      id: "app.garden.work",
      defaultMessage: "Work",
    }),
    [GardenTab.Insights]: intl.formatMessage({
      id: "app.garden.insights",
      defaultMessage: "Insights",
    }),
    [GardenTab.Gardeners]: intl.formatMessage({
      id: "app.garden.gardeners",
      defaultMessage: "Gardeners",
    }),
  };

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
  } = useGardens(chainId);
  const garden = allGardens.find((g) => g.id === gardenIdParam);
  const gardenStatus: "error" | "success" | "pending" = garden ? "success" : "pending";
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

    const operatorSet = new Set((garden.operators ?? []).map((addr) => addr.toLowerCase()));
    const gardenerSet = new Set((garden.gardeners ?? []).map((addr) => addr.toLowerCase()));
    const seen = new Set<string>();
    const orderedAddresses: string[] = [];

    for (const list of [garden.operators ?? [], garden.gardeners ?? []]) {
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
        account: address,
        username: match?.username || undefined,
        email: match?.email || undefined,
        phone: match?.phone || undefined,
        avatar: match?.avatar || undefined,
        registeredAt: match?.registeredAt ?? fallbackRegisteredAt,
        isOperator: operatorSet.has(normalized),
        isGardener: gardenerSet.has(normalized),
      };
    });
  }, [allGardeners, garden]);

  const { vaults: gardenVaults = [] } = useGardenVaults(garden?.id, {
    enabled: Boolean(garden?.id),
  });
  const { deposits: myVaultDeposits = [] } = useVaultDeposits(garden?.id, {
    userAddress: primaryAddress ?? undefined,
    enabled: Boolean(garden?.id && primaryAddress),
  });
  const hasEndowmentDeposits = useMemo(
    () => myVaultDeposits.some((deposit) => deposit.shares > 0n),
    [myVaultDeposits]
  );

  const validGardenAddress = gardenIdParam && isAddress(gardenIdParam) ? gardenIdParam : undefined;
  const { strategies: convictionStrategies } = useConvictionStrategies(validGardenAddress, {
    enabled: Boolean(validGardenAddress),
  });
  const hasGovernance = convictionStrategies.length > 0;

  // Check if current user is an operator (can approve/reject work)
  const isOperator = useMemo(() => {
    if (!primaryAddress || !garden?.operators) return false;
    const normalizedUserAddress = primaryAddress.toLowerCase();
    return garden.operators.some((addr) => addr.toLowerCase() === normalizedUserAddress);
  }, [primaryAddress, garden?.operators]);

  const { hasRole: canReviewOnChain } = useHasRole(
    garden?.id as Address | undefined,
    primaryAddress as Address | undefined,
    "evaluator"
  );
  const canReview = isOperator || canReviewOnChain;

  // Check if current user is already a member of this garden
  const isMember = useMemo(() => {
    if (!garden) return false;
    return isGardenMember(primaryAddress, garden.gardeners, garden.operators, garden.id);
  }, [primaryAddress, garden]);

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
            defaultMessage: "You're already a member of this garden",
          }),
        });
      } else {
        toastService.success({
          title: intl.formatMessage({
            id: "app.garden.joinSuccess",
            defaultMessage: "Successfully joined the garden!",
          }),
        });
      }
    } catch {
      toastService.error({
        title: intl.formatMessage({
          id: "app.garden.joinError",
          defaultMessage: "Failed to join garden. Please try again.",
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

  // Standard tabs configuration - removed counts
  const tabs: StandardTab[] = [
    {
      id: GardenTab.Work,
      label: tabNames[GardenTab.Work],
      icon: <RiHammerFill className="w-4 h-4" />,
    },
    {
      id: GardenTab.Insights,
      label: tabNames[GardenTab.Insights],
      icon: <RiFileChartFill className="w-4 h-4" />,
    },
    {
      id: GardenTab.Gardeners,
      label: tabNames[GardenTab.Gardeners],
      icon: <RiGroupFill className="w-4 h-4" />,
    },
  ];

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
      case GardenTab.Insights:
        return (
          <GardenAssessments
            assessmentFetchStatus={gardensLoading ? "pending" : gardenStatus}
            assessments={assessments}
            description={description}
          />
        );
      case GardenTab.Gardeners:
        return <GardenGardeners members={members} garden={garden} />;
    }
  };

  // No custom scroll restoration; StandardTabs resets nearest scroll container

  return (
    <GardenErrorBoundary>
      <div className="h-full min-h-0 w-full flex flex-col relative overflow-hidden">
        {pathname.includes("work") || pathname.includes("assessments") ? null : (
          <>
            {/* Fixed Header (banner + TopNav + title/metadata) */}
            <div className="fixed top-0 left-0 right-0 bg-bg-white-0 z-20">
              <div className="relative w-full">
                <img
                  src={bannerImage}
                  className="w-full object-cover object-center rounded-b-3xl h-44 md:h-52"
                  alt={`${name} banner`}
                  loading="eager"
                  decoding="async"
                />
                <div className="absolute top-0 left-0 right-0 z-20">
                  <TopNav
                    className="flex w-full justify-between items-center p-4 pt-6"
                    onBackClick={() => navigate("/home")}
                    works={mergedWorks}
                    garden={garden}
                    isOperator={canReview}
                    showGovernanceButton={hasGovernance}
                    onGovernanceClick={() => setIsGovernanceOpen(true)}
                    showEndowmentButton={gardenVaults.length > 0}
                    hasEndowmentDeposits={hasEndowmentDeposits}
                    onEndowmentClick={() => setIsEndowmentOpen(true)}
                  />
                </div>
              </div>

              {/* Title and meta below banner */}
              <div className="px-4 md:px-6 mt-3 flex flex-col gap-1.5 pb-3 bg-bg-white-0">
                <div className="flex items-start justify-between gap-3">
                  <h1 className="text-xl md:text-2xl font-semibold line-clamp-1">{name}</h1>
                  {showJoinButton && (
                    <Button
                      label={intl.formatMessage({
                        id: "app.garden.join",
                        defaultMessage: "Join",
                      })}
                      leadingIcon={<RiUserAddLine className="w-4 h-4" />}
                      variant="primary"
                      mode="filled"
                      size="small"
                      onClick={handleJoinGarden}
                      disabled={isJoining}
                    />
                  )}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex items-center gap-1.5 text-sm text-text-sub-600">
                    <RiMapPin2Fill className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>{location}</span>
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
              </div>

              {/* Tabs sticky under header */}
              <div className="sticky top-0 left-0 right-0 w-full bg-bg-white-0 z-10 shadow-sm">
                <StandardTabs
                  tabs={tabs}
                  activeTab={activeTab}
                  onTabChange={(tabId) => setActiveTab(tabId as GardenTab)}
                  variant="compact"
                  isLoading={gardensLoading || worksFetching}
                />
              </div>
            </div>

            {/* Spacer for fixed header - matches header height without duplicating content
                Height breakdown: banner (176px/208px) + title section (~80px) + tabs (~48px) = ~304px/336px */}
            <div className="h-[304px] md:h-[336px] flex-shrink-0" aria-hidden="true" />

            {/* Scrollable content below fixed header */}
            <div
              className="flex-1 min-h-0 px-4 md:px-6 pb-24 overflow-y-auto overflow-x-hidden"
              aria-busy={worksFetching}
            >
              {renderTabContent()}
            </div>
          </>
        )}
        {garden && (
          <EndowmentDrawer
            isOpen={isEndowmentOpen}
            onClose={() => setIsEndowmentOpen(false)}
            gardenAddress={garden.id}
            gardenName={garden.name}
          />
        )}
        {garden && hasGovernance && (
          <ConvictionDrawer
            isOpen={isGovernanceOpen}
            onClose={() => setIsGovernanceOpen(false)}
            gardenAddress={garden.id}
            gardenName={garden.name}
          />
        )}
        <Outlet context={{ gardenId: garden.id }} />
      </div>
    </GardenErrorBoundary>
  );
};
