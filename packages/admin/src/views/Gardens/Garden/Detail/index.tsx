import {
  type ActivityFilter,
  type Address,
  formatTokenAmount,
  type GardenDetailTab,
  type GardenRole,
  parseGardenDetailTab,
  parseGardenRange,
  useGardenDerivedState,
  useGardenDetailData,
} from "@green-goods/shared";
import * as Tabs from "@radix-ui/react-tabs";
import {
  RiCheckboxCircleLine,
  RiErrorWarningLine,
  RiGroupLine,
  RiShieldCheckLine,
  RiUserLine,
} from "@remixicon/react";
import { useCallback, useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/Layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CommunityTab } from "../CommunityTab";
import { GardenHeroBanner, TabBadge } from "../GardenDetailHelpers";
import { TAB_SECTIONS, TAB_TRIGGER_BASE } from "../gardenDetail.constants";
import { ImpactTab } from "../ImpactTab";
import { OverviewTab } from "../OverviewTab";
import { WorkTab } from "../WorkTab";
import "../GardenDetailLayout.css";
import { GardenModals } from "./GardenModals";
import { TabActions } from "./TabActions";

export default function GardenDetail() {
  const { id } = useParams<{ id: string }>();
  const { formatMessage } = useIntl();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    garden,
    fetching,
    error,
    gardenId,
    canManage,
    canReview,
    canManageRoles,
    isOwner,
    assessments,
    fetchingAssessments,
    assessmentsError,
    roleMembers,
    roleActions,
    isOperationLoading,
    community,
    communityLoading,
    pools,
    createPools,
    isCreatingPools,
    gardenVaults,
    vaultsLoading,
    vaultNetDeposited,
    allocations,
    allocationsLoading,
    works,
    worksLoading,
    worksFetching,
    refreshWorks,
    hypercerts,
    hypercertsLoading,
    scheduleBackgroundRefetch,
  } = useGardenDetailData(id);

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [rolesModalOpen, setRolesModalOpen] = useState(false);
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [memberType, setMemberType] = useState<GardenRole>("gardener");
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [membersModalType, setMembersModalType] = useState<GardenRole>("gardener");
  const [memberToRemove, setMemberToRemove] = useState<{
    address: Address;
    role: GardenRole;
  } | null>(null);
  const [domainModalOpen, setDomainModalOpen] = useState(false);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [memberSearch, setMemberSearch] = useState("");
  const [lastWorkRefreshAt, setLastWorkRefreshAt] = useState<number>(Date.now());

  const searchKey = searchParams.toString();
  const activeTab = parseGardenDetailTab(searchParams.get("tab"));
  const selectedRange = parseGardenRange(searchParams.get("range"));
  const requestedSection = searchParams.get("section");
  const section =
    requestedSection && TAB_SECTIONS[activeTab].includes(requestedSection)
      ? requestedSection
      : undefined;
  const selectedItem = section ? (searchParams.get("item") ?? undefined) : undefined;

  useEffect(() => {
    const normalized = new URLSearchParams(searchParams);
    let changed = false;

    if (searchParams.get("tab") !== activeTab) {
      normalized.set("tab", activeTab);
      changed = true;
    }

    if (searchParams.get("range") !== selectedRange) {
      normalized.set("range", selectedRange);
      changed = true;
    }

    const activeSection = normalized.get("section");
    if (activeSection && !TAB_SECTIONS[activeTab].includes(activeSection)) {
      normalized.delete("section");
      normalized.delete("item");
      changed = true;
    }

    if (!activeSection && normalized.has("item")) {
      normalized.delete("item");
      changed = true;
    }

    if (changed) {
      setSearchParams(normalized, { replace: true });
    }
  }, [activeTab, searchKey, searchParams, selectedRange, setSearchParams]);

  const updateQueryState = useCallback(
    (
      updates: Partial<Record<"tab" | "range" | "section" | "item", string | undefined>>,
      replace = false
    ) => {
      const next = new URLSearchParams(searchParams);

      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === "") {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }

      setSearchParams(next, { replace });
    },
    [searchParams, setSearchParams]
  );

  const openSection = useCallback(
    (tab: GardenDetailTab, nextSection: string, itemId?: string) => {
      updateQueryState({ tab, section: nextSection, item: itemId }, false);
    },
    [updateQueryState]
  );

  const clearSection = useCallback(() => {
    updateQueryState({ section: undefined, item: undefined }, false);
  }, [updateQueryState]);

  const setTab = useCallback(
    (tab: GardenDetailTab) => {
      updateQueryState({ tab, section: undefined, item: undefined }, false);
    },
    [updateQueryState]
  );

  const refreshWorkData = useCallback(() => {
    void refreshWorks().finally(() => {
      setLastWorkRefreshAt(Date.now());
    });
  }, [refreshWorks]);

  useEffect(() => {
    if (worksLoading) return;
    setLastWorkRefreshAt(Date.now());
  }, [works.length, worksLoading]);

  useEffect(() => {
    if (activeTab !== "work") return;
    if (typeof window === "undefined") return;

    const interval = window.setInterval(() => {
      refreshWorkData();
    }, 60_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [activeTab, refreshWorkData]);

  const openAddMemberModal = (type: GardenRole) => {
    setMemberType(type);
    setAddMemberModalOpen(true);
  };

  const openMembersModal = (type: GardenRole) => {
    setMembersModalType(type);
    setMembersModalOpen(true);
  };

  const roleIcons = {
    owner: RiShieldCheckLine,
    operator: RiUserLine,
    evaluator: RiCheckboxCircleLine,
    gardener: RiUserLine,
    funder: RiUserLine,
    community: RiGroupLine,
  } as const;

  const baseHeaderProps = {
    backLink: { to: "/gardens", label: formatMessage({ id: "app.garden.admin.backToGardens" }) },
    sticky: true,
  } as const;

  // Must be called unconditionally (Rules of Hooks) — before early returns
  const derived = useGardenDerivedState({
    garden: garden ?? { id: "", domainMask: 0, name: "", chainId: 0 },
    works,
    assessments,
    hypercerts,
    allocations,
    gardenVaults,
    vaultNetDeposited,
    roleMembers,
    selectedRange,
    activityFilter,
    memberSearch,
    section,
    formatMessage,
    openSection,
  });

  if (fetching) {
    return (
      <div className="pb-6">
        <PageHeader
          title={formatMessage({ id: "app.garden.admin.loadingGarden" })}
          description={formatMessage({ id: "app.garden.admin.loadingDescription" })}
          {...baseHeaderProps}
        />
        <div className="mt-6 px-6" role="status" aria-live="polite">
          <span className="sr-only">{formatMessage({ id: "app.garden.admin.loadingGarden" })}</span>
          <div className="space-y-4 rounded-lg border border-stroke-soft bg-bg-white p-6 shadow-sm">
            <div className="h-8 w-1/4 rounded skeleton-shimmer" />
            <div className="h-44 rounded skeleton-shimmer" style={{ animationDelay: "0.1s" }} />
            <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 md:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 rounded-lg skeleton-shimmer"
                  style={{ animationDelay: `${0.15 + i * 0.05}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !garden) {
    return (
      <div className="pb-6">
        <PageHeader
          title={formatMessage({ id: "app.garden" })}
          description={formatMessage({ id: "app.garden.admin.unableToLoad" })}
          {...baseHeaderProps}
        />
        <div className="mt-6 px-6">
          <Card className="mx-auto max-w-lg" role="alert">
            <Card.Body className="flex flex-col items-center py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error-lighter">
                <RiErrorWarningLine className="h-6 w-6 text-error-base" />
              </div>
              <h2 className="mt-4 font-heading text-lg font-semibold text-text-strong">
                {formatMessage({ id: "app.garden.admin.notFound" })}
              </h2>
              <p className="mt-2 text-sm text-text-sub">
                {error?.message ?? formatMessage({ id: "app.garden.admin.unableToLoad" })}
              </p>
              <Button variant="secondary" className="mt-6" asChild>
                <Link to="/gardens">{formatMessage({ id: "app.garden.admin.backToGardens" })}</Link>
              </Button>
            </Card.Body>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <Tabs.Root
      value={activeTab}
      onValueChange={(value) => {
        setTab(parseGardenDetailTab(value));
      }}
      className="garden-detail-container pb-6"
    >
      <GardenHeroBanner
        name={garden.name}
        description={garden.description}
        bannerImage={garden.bannerImage}
        domainMask={garden.domainMask}
        backTo="/gardens"
        backLabel={formatMessage({ id: "app.garden.admin.backToGardens" })}
        canManage={canManage}
        onEditDomains={() => setDomainModalOpen(true)}
      >
        <div className="garden-tab-bar">
          <Tabs.List className="garden-tabs-list -mb-[1px] flex">
            <Tabs.Trigger value="overview" className={TAB_TRIGGER_BASE}>
              {formatMessage({ id: "app.garden.admin.tab.overview" })}
              <TabBadge badge={derived.tabBadges.overview} />
            </Tabs.Trigger>
            <Tabs.Trigger value="impact" className={TAB_TRIGGER_BASE}>
              {formatMessage({ id: "app.garden.admin.tab.impact" })}
              <TabBadge badge={derived.tabBadges.impact} />
            </Tabs.Trigger>
            <Tabs.Trigger value="work" className={TAB_TRIGGER_BASE}>
              {formatMessage({ id: "app.garden.admin.tab.work" })}
              <TabBadge badge={derived.tabBadges.work} />
            </Tabs.Trigger>
            <Tabs.Trigger value="community" className={TAB_TRIGGER_BASE}>
              {formatMessage({ id: "app.garden.admin.tab.community" })}
              <TabBadge badge={derived.tabBadges.community} />
            </Tabs.Trigger>
          </Tabs.List>
        </div>
      </GardenHeroBanner>

      <div className="px-4 sm:px-6">
        {/* Tab actions — unified bar below tabs on all screen sizes */}
        <TabActions
          gardenId={gardenId}
          activeTab={activeTab}
          canManage={canManage}
          canReview={canReview}
          canManageRoles={canManageRoles}
          onManageProfile={() => setProfileModalOpen(true)}
          onManageRoles={() => setRolesModalOpen(true)}
          openSection={openSection}
        />

        <Tabs.Content
          value="overview"
          className="garden-tab-content"
          aria-label={formatMessage({ id: "app.garden.admin.tab.overview" })}
        >
          <OverviewTab
            section={section}
            selectedItem={selectedItem}
            selectedRange={selectedRange}
            clearSection={clearSection}
            openSection={openSection}
            updateQueryState={updateQueryState}
            setTab={setTab}
            overviewAlerts={derived.overviewAlerts}
            gardenHealthLabel={derived.gardenHealthLabel}
            approvedInRangeCount={derived.approvedInRangeCount}
            impactVelocityDelta={derived.impactVelocityDelta}
            medianReviewAgeHours={derived.medianReviewAgeHours}
            activityFilter={activityFilter}
            setActivityFilter={setActivityFilter}
            filteredActivityEvents={derived.filteredActivityEvents}
            isLoading={worksLoading || fetchingAssessments}
            pendingWorkCount={derived.pendingWorks.length}
            assessmentCount30d={derived.approvedInLastThirtyDays}
            gardenerCount={roleMembers.gardener.length}
            treasuryBalance={formatTokenAmount(vaultNetDeposited)}
          />
        </Tabs.Content>

        <Tabs.Content
          value="impact"
          className="garden-tab-content"
          aria-label={formatMessage({ id: "app.garden.admin.tab.impact" })}
        >
          <ImpactTab
            garden={garden}
            gardenId={gardenId}
            canManage={canManage}
            canReview={canReview}
            section={section}
            selectedItem={selectedItem}
            clearSection={clearSection}
            openSection={openSection}
            assessments={assessments}
            fetchingAssessments={fetchingAssessments}
            assessmentsError={assessmentsError}
            hypercerts={hypercerts}
            hypercertsLoading={hypercertsLoading}
            domainLabels={derived.domainLabels}
            approvedInLastThirtyDays={derived.approvedInLastThirtyDays}
          />
        </Tabs.Content>

        <Tabs.Content
          value="work"
          className="garden-tab-content"
          aria-label={formatMessage({ id: "app.garden.admin.tab.work" })}
        >
          <WorkTab
            garden={garden}
            canReview={canReview}
            section={section}
            selectedItem={selectedItem}
            clearSection={clearSection}
            openSection={openSection}
            works={works}
            worksLoading={worksLoading}
            worksFetching={worksFetching}
            refreshWorkData={refreshWorkData}
            lastWorkRefreshAt={lastWorkRefreshAt}
            pendingWorks={derived.pendingWorks}
            pendingWarningCount={derived.pendingWarningCount}
            pendingCriticalCount={derived.pendingCriticalCount}
            reviewedWorks={derived.reviewedWorks}
            approvedWorks={derived.approvedWorks}
            medianReviewAgeHours={derived.medianReviewAgeHours}
          />
        </Tabs.Content>

        <Tabs.Content
          value="community"
          className="garden-tab-content"
          aria-label={formatMessage({ id: "app.garden.admin.tab.community" })}
        >
          <CommunityTab
            garden={garden}
            gardenId={gardenId}
            canManage={canManage}
            isOwner={isOwner}
            section={section}
            clearSection={clearSection}
            openSection={openSection}
            community={community}
            communityLoading={communityLoading}
            pools={pools}
            createPools={createPools}
            isCreatingPools={isCreatingPools}
            vaultsLoading={vaultsLoading}
            hasVaults={derived.hasVaults}
            vaultNetDeposited={vaultNetDeposited}
            treasurySeverity={derived.treasurySeverity}
            allocations={allocations}
            allocationsLoading={allocationsLoading}
            roleSummary={derived.roleSummary}
            roleIcons={roleIcons}
            filteredDirectory={derived.filteredDirectory}
            visibleDirectory={derived.visibleDirectory}
            memberSearch={memberSearch}
            setMemberSearch={setMemberSearch}
            openMembersModal={openMembersModal}
            scheduleBackgroundRefetch={scheduleBackgroundRefetch}
          />
        </Tabs.Content>
      </div>

      <GardenModals
        garden={garden}
        canManage={canManage}
        canManageRoles={canManageRoles}
        isOwner={isOwner}
        isOperationLoading={isOperationLoading}
        roleMembers={roleMembers}
        roleActions={roleActions}
        scheduleBackgroundRefetch={scheduleBackgroundRefetch}
        profileModalOpen={profileModalOpen}
        setProfileModalOpen={setProfileModalOpen}
        rolesModalOpen={rolesModalOpen}
        setRolesModalOpen={setRolesModalOpen}
        domainModalOpen={domainModalOpen}
        setDomainModalOpen={setDomainModalOpen}
        addMemberModalOpen={addMemberModalOpen}
        setAddMemberModalOpen={setAddMemberModalOpen}
        memberType={memberType}
        openAddMemberModal={openAddMemberModal}
        membersModalOpen={membersModalOpen}
        setMembersModalOpen={setMembersModalOpen}
        membersModalType={membersModalType}
        openMembersModal={openMembersModal}
        memberToRemove={memberToRemove}
        setMemberToRemove={setMemberToRemove}
        roleIcons={roleIcons}
      />
    </Tabs.Root>
  );
}
