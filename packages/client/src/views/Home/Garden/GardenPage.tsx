import { useCommitmentPools } from "@green-goods/shared/commitment-pooling";
import { GardenBannerFallback } from "@green-goods/shared/components/Display/GardenBannerFallback";
import { ImageWithFallback } from "@green-goods/shared/components/Display/ImageWithFallback";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { GOVERNANCE_ENABLED } from "@green-goods/shared/config/app";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import { useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useConvictionStrategies } from "@green-goods/shared/hooks/conviction/useConvictionStrategies";
import { GardenTab, useGardenTabs } from "@green-goods/shared/hooks/garden/useGardenTabs";
import {
  isGardenMember,
  usePendingJoinsVersion,
} from "@green-goods/shared/hooks/garden/useJoinGarden";
import { useHasRole } from "@green-goods/shared/hooks/roles/useHasRole";
import { useElementHeight } from "@green-goods/shared/hooks/utils/useElementHeight";
import { useGardenVaults } from "@green-goods/shared/hooks/vault/useGardenVaults";
import { useVaultDeposits } from "@green-goods/shared/hooks/vault/useVaultDeposits";
import { useWorks } from "@green-goods/shared/hooks/work/useWorks";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import type { Address, Garden } from "@green-goods/shared/types/domain";
import { RiCalendarEventFill, RiMapPin2Fill } from "@remixicon/react";
import { type ReactNode, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { isAddress } from "viem";
import { GardenJoinRequestDialog, JoinGardenButton } from "@/components/Features";
import { StandardTabs, TopNav } from "@/components/Navigation";
import { ConvictionSheet, EndowmentSheet } from "@/components/Sheets";
import { GardenSection } from "./GardenSection";
import { buildGardenTabs } from "./gardenTabs";
import { shareGarden } from "./shareGarden";

export interface GardenPageProps {
  garden: Garden;
  /**
   * `route`: the garden's own page, as a visit by link, from Explore or from a row opens it: a
   * fixed banner header with Back over the tabs, with the garden's child pages (a work, a
   * promise) in `children`. `home`: the same banner, tabs and actions in Home's flow under
   * Home's header, without Back, until the journal replaces it.
   */
  layout: "route" | "home";
  /** Back, on the garden's own page. */
  onBack?: () => void;
  /** On the garden's own page, false while a child page covers the header and tabs. */
  showHeader?: boolean;
  /** The garden's child pages, on its own page. */
  children?: ReactNode;
}

/**
 * A garden's page: its banner with the page actions (notifications for reviewers, governance,
 * Endowment for stewards and depositors, Share), its title and join action, the Work, Pool,
 * Insights and Gardeners tabs, and the Endowment and governance sheets. The review, request,
 * governance and Endowment predicates live here, so the garden's own page and Home's body
 * read the same ones.
 */
export function GardenPage({
  garden,
  layout,
  onBack,
  showHeader = true,
  children,
}: GardenPageProps) {
  const intl = useIntl();
  const { primaryAddress } = useUser();
  const isEndowmentOpen = useUIStore((s) => s.isEndowmentSheetOpen);
  const openEndowmentSheet = useUIStore((s) => s.openEndowmentSheet);
  const closeEndowmentSheet = useUIStore((s) => s.closeEndowmentSheet);
  const [isGovernanceOpen, setIsGovernanceOpen] = useState(false);
  // The spacer under the fixed header matches its measured height, whatever the
  // title wraps to. The header is absent on child routes (work, assessments,
  // commitments); the hook observes each header element on its own so a removed
  // one never reports 0 (see useElementHeight).
  const [measureHeader, headerHeight] = useElementHeight();

  const { activeTab, setActiveTab } = useGardenTabs();
  const chainId = DEFAULT_CHAIN_ID;
  const { isFetching: gardensLoading } = useGardens(chainId);
  // One read of the garden's work serves the Work tab, the rail and the reviewers' notifications.
  const workRead = useWorks(garden.id, { offline: true });
  const { works: mergedWorks, isFetching: worksFetching } = workRead;
  const { vaults: gardenVaults = [] } = useGardenVaults(garden.id as Address, {
    enabled: Boolean(garden.id),
  });
  const { deposits: myVaultDeposits = [] } = useVaultDeposits(garden.id as Address, {
    userAddress: primaryAddress ?? undefined,
    enabled: Boolean(garden.id && primaryAddress),
  });
  const hasEndowmentDeposits = useMemo(
    () => myVaultDeposits.some((deposit) => deposit.shares > 0n),
    [myVaultDeposits]
  );

  const validGardenAddress = isAddress(garden.id) ? garden.id : undefined;

  const { pools: commitmentPools } = useCommitmentPools({
    chainId: DEFAULT_CHAIN_ID,
    garden: validGardenAddress as Address | undefined,
  });
  const commitmentPool = commitmentPools[0];
  const { strategies: convictionStrategies } = useConvictionStrategies(validGardenAddress, {
    enabled: GOVERNANCE_ENABLED && Boolean(validGardenAddress),
  });
  const hasGovernanceConfigured = convictionStrategies.length > 0;

  // Check if current user is a steward (can approve/reject work)
  const isSteward = useMemo(() => {
    if (!primaryAddress || !garden.stewards) return false;
    const normalizedUserAddress = primaryAddress.toLowerCase();
    return garden.stewards.some((addr) => addr.toLowerCase() === normalizedUserAddress);
  }, [primaryAddress, garden.stewards]);

  const { hasRole: canReviewOnChain } = useHasRole(
    garden.id as Address,
    primaryAddress as Address | undefined,
    "evaluator"
  );
  const canReview = isSteward || canReviewOnChain;
  const canManageRequests = useMemo(() => {
    if (!primaryAddress) return false;
    const account = primaryAddress.toLowerCase();
    return [...(garden.stewards ?? []), ...(garden.owners ?? [])].some(
      (address) => address.toLowerCase() === account
    );
  }, [garden, primaryAddress]);

  // Gate header drawers behind steward/funder roles. Default gardeners should not see
  // governance or endowment chrome — those drawers expose protocol-shaped surfaces (signal pool,
  // hypercert, vault, treasury) that don't belong on the gardener-default path.
  const hasOwnEndowmentDeposit = hasEndowmentDeposits;
  const showGovernanceButton = GOVERNANCE_ENABLED && hasGovernanceConfigured && canReview;
  const showEndowmentButton = gardenVaults.length > 0 && (canReview || hasOwnEndowmentDeposit);
  const hasGovernance = showGovernanceButton;

  // The version counter refreshes membership as in-tab joins confirm or expire,
  // so the header does not keep showing stale join controls.
  const pendingJoinsVersion = usePendingJoinsVersion();
  const isMember = useMemo(() => {
    const { gardeners, stewards, id } = garden;
    return canManageRequests || isGardenMember(primaryAddress, gardeners, stewards, id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version counter is a deliberate cache-buster, not a read dependency
  }, [primaryAddress, garden, canManageRequests, pendingJoinsVersion]);

  // Determine if join button should be shown
  const showJoinButton = useMemo(() => {
    if (!primaryAddress) return false;
    if (isMember) return false;
    if (!garden.openJoining) return false;
    return true;
  }, [primaryAddress, isMember, garden.openJoining]);
  const showJoinRequestButton = Boolean(primaryAddress && !isMember && !garden.openJoining);

  const handleShareGarden = () => {
    shareGarden(garden.id, garden.name).catch(() => {
      toastService.error({ title: intl.formatMessage({ id: "app.garden.shareFailed" }) });
    });
  };

  const { name, bannerImage, location, createdAt } = garden;
  const foundedLabel = `${intl.formatMessage({ id: "app.home.founded" })} ${new Date(createdAt).toLocaleDateString()}`;

  const tabs = buildGardenTabs(intl, { hasPool: Boolean(commitmentPool) });

  const isHome = layout === "home";
  // The page actions, without Back on Home, where the chip carries the garden.
  const pageActions = (
    <TopNav
      className={
        isHome
          ? "flex w-full justify-between items-start p-3"
          : "flex w-full justify-between items-start p-4 pt-[var(--app-top-offset)]"
      }
      onBackClick={isHome ? undefined : onBack}
      works={mergedWorks}
      garden={garden}
      isSteward={canReview}
      showGovernanceButton={showGovernanceButton}
      onGovernanceClick={() => setIsGovernanceOpen(true)}
      showEndowmentButton={showEndowmentButton}
      hasEndowmentDeposits={hasEndowmentDeposits}
      onEndowmentClick={openEndowmentSheet}
      onShareClick={handleShareGarden}
    />
  );

  const titleBlock = (
    <div className="px-4 sm:px-5 md:px-6 mt-3 flex flex-col gap-1.5 pb-3">
      <h1 className="line-clamp-2 text-2xl font-bold" title={name}>
        {name}
      </h1>
      <div className="flex items-center gap-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5 text-sm text-text-sub-600">
            <RiMapPin2Fill className="h-4 w-4 text-primary-on-surface flex-shrink-0" />
            <span className="truncate" title={location}>
              {location}
            </span>
          </div>
          <span className="hidden sm:inline text-text-soft-400">•</span>
          <div className="flex min-w-0 items-center gap-1.5 text-sm text-text-sub-600">
            <RiCalendarEventFill className="h-4 w-4 text-primary-on-surface flex-shrink-0" />
            <span className="truncate" title={foundedLabel}>
              {foundedLabel}
            </span>
          </div>
        </div>
        {/* One compact action at most; Share lives in the banner actions (DL-020). */}
        {showJoinButton && <JoinGardenButton gardenId={garden.id} gardenName={name} />}
        {showJoinRequestButton ? (
          <GardenJoinRequestDialog gardenAddress={garden.id as Address} />
        ) : null}
      </div>
    </div>
  );

  const tabRail = (
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
  );

  const sheets = (
    <>
      <EndowmentSheet
        isOpen={isEndowmentOpen}
        onClose={closeEndowmentSheet}
        gardenAddress={garden.id as Address}
        gardenName={garden.name}
      />
      {hasGovernance && (
        <ConvictionSheet
          isOpen={isGovernanceOpen}
          onClose={() => setIsGovernanceOpen(false)}
          gardenAddress={garden.id as Address}
          gardenName={garden.name}
        />
      )}
    </>
  );

  if (isHome) {
    return (
      <div className="flex w-full flex-col" data-testid="home-garden-page">
        {/* The banner keeps the page's actions; Home's header above it carries the garden. */}
        <div className="padded relative h-36 overflow-hidden rounded-2xl md:h-44">
          <ImageWithFallback
            src={bannerImage || ""}
            alt={`${name} banner`}
            loading="eager"
            className="absolute inset-0 w-full h-full object-cover object-center"
            backgroundFallback={<GardenBannerFallback name={name} className="rounded-2xl" />}
          />
          <div className="absolute top-0 left-0 right-0 z-10">{pageActions}</div>
        </div>
        {titleBlock}
        <div className="w-full bg-bg-canvas">{tabRail}</div>
        <div className="px-4 sm:px-5 md:px-6 pt-3 sm:pt-4 pb-6" aria-busy={worksFetching}>
          <GardenSection
            garden={garden}
            tab={activeTab}
            workRead={workRead}
            pool={commitmentPool}
            canManageRequests={canManageRequests}
          />
        </div>
        {sheets}
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 w-full flex flex-col relative overflow-hidden">
      {showHeader ? (
        <>
          {/* Fixed Header (banner + TopNav + title/metadata) */}
          <div
            ref={measureHeader}
            data-testid="garden-header"
            className="fixed top-0 left-0 right-0 bg-bg-canvas z-20"
          >
            {/* The banner runs up under the status bar, so it grows by the top inset
                and keeps its height below it. */}
            <div className="relative w-full h-[calc(9rem+env(safe-area-inset-top,0px))] md:h-[calc(11rem+env(safe-area-inset-top,0px))] overflow-hidden rounded-b-2xl">
              <ImageWithFallback
                src={bannerImage || ""}
                alt={`${name} banner`}
                loading="eager"
                className="absolute inset-0 w-full h-full object-cover object-center"
                backgroundFallback={<GardenBannerFallback name={name} className="rounded-b-2xl" />}
              />
              <div className="absolute top-0 left-0 right-0 z-20">{pageActions}</div>
            </div>

            {/* Title and meta below banner */}
            {titleBlock}

            {/* Tabs sticky under header */}
            <div className="sticky top-0 left-0 right-0 w-full bg-bg-canvas z-10 shadow-sm">
              {tabRail}
            </div>
          </div>

          {/* Spacer matches the measured fixed-header height so the
              scrollable content below starts at the right place even when
              the garden name wraps to 3+ lines. Falls back to a sensible
              static height for the brief moment before ResizeObserver
              reports a value. */}
          <div
            data-testid="garden-header-spacer"
            className="flex-shrink-0"
            style={{ height: headerHeight !== null ? `${headerHeight}px` : undefined }}
            aria-hidden="true"
          >
            {headerHeight === null && (
              <div
                className="h-[calc(288px+env(safe-area-inset-top,0px))] md:h-[calc(320px+env(safe-area-inset-top,0px))] w-full"
                aria-hidden="true"
              />
            )}
          </div>

          {/* Scrollable content below fixed header */}
          <div
            className="flex-1 min-h-0 px-4 sm:px-5 md:px-6 pt-3 sm:pt-4 pb-24 overflow-y-auto overflow-x-hidden"
            aria-busy={worksFetching}
          >
            <GardenSection
              garden={garden}
              tab={activeTab}
              workRead={workRead}
              pool={commitmentPool}
              canManageRequests={canManageRequests}
            />
          </div>
        </>
      ) : null}
      {sheets}
      {children}
    </div>
  );
}
