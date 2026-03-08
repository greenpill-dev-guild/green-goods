import {
  type Address,
  ConfirmDialog,
  formatAddress,
  formatTokenAmount,
  GARDEN_ROLE_COLORS,
  type GardenRole,
  toastService,
  useGardenDetailData,
} from "@green-goods/shared";
import * as Tabs from "@radix-ui/react-tabs";
import {
  RiCheckboxCircleLine,
  RiErrorWarningLine,
  RiFileList3Line,
  RiGroupLine,
  RiShieldCheckLine,
  RiUserLine,
} from "@remixicon/react";
import { useCallback, useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AddMemberModal } from "@/components/Garden/AddMemberModal";
import { GardenDomainModal } from "@/components/Garden/GardenDomainEditor";
import { GardenProfileModal } from "@/components/Garden/GardenProfileModal";
import { getRoleLabel } from "@/components/Garden/gardenUtils";
import { ManageRolesModal } from "@/components/Garden/ManageRolesModal";
import { MembersModal } from "@/components/Garden/MembersModal";
import { PageHeader } from "@/components/Layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CommunityTab } from "./CommunityTab";
import { GardenHeroBanner, TabBadge } from "./GardenDetailHelpers";
import { TAB_SECTIONS, TAB_TRIGGER_BASE } from "./gardenDetail.constants";
import type { ActivityFilter, GardenTab } from "./gardenDetail.types";
import { parseGardenRange, parseGardenTab } from "./gardenDetail.utils";
import { ImpactTab } from "./ImpactTab";
import { OverviewTab } from "./OverviewTab";
import { useGardenDerivedState } from "./useGardenDerivedState";
import { WorkTab } from "./WorkTab";
import "./GardenDetailLayout.css";

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
  const activeTab = parseGardenTab(searchParams.get("tab"));
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
    (tab: GardenTab, nextSection: string, itemId?: string) => {
      updateQueryState({ tab, section: nextSection, item: itemId }, false);
    },
    [updateQueryState]
  );

  const clearSection = useCallback(() => {
    updateQueryState({ section: undefined, item: undefined }, false);
  }, [updateQueryState]);

  const setTab = useCallback(
    (tab: GardenTab) => {
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

  const activeRole = membersModalType;
  const ActiveRoleIcon = roleIcons[activeRole];

  const baseHeaderProps = {
    backLink: { to: "/gardens", label: formatMessage({ id: "app.garden.admin.backToGardens" }) },
    sticky: true,
  } as const;

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

  const derived = useGardenDerivedState({
    garden,
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

  const tabActions: Record<GardenTab, React.ReactNode> = {
    overview: canManage ? (
      <Button size="sm" onClick={() => setProfileModalOpen(true)}>
        {formatMessage({ id: "app.garden.detail.action.manageProfile" })}
      </Button>
    ) : null,
    impact: canReview ? (
      <Button size="sm" asChild>
        <Link to={`/gardens/${gardenId}/assessments/create`}>
          <RiFileList3Line className="h-4 w-4" />
          {formatMessage({ id: "app.garden.admin.newAssessment" })}
        </Link>
      </Button>
    ) : (
      <Button size="sm" variant="secondary" asChild>
        <Link to={`/gardens/${gardenId}/assessments`}>
          {formatMessage({ id: "app.garden.admin.viewAssessments" })}
        </Link>
      </Button>
    ),
    work: (
      <div className="flex items-center gap-1.5">
        <Button size="sm" onClick={() => openSection("work", "queue")}>
          {formatMessage({ id: "app.garden.detail.action.reviewPending" })}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => openSection("work", "decisions")}>
          {formatMessage({ id: "app.garden.detail.action.openDecisions" })}
        </Button>
      </div>
    ),
    community: (
      <div className="flex items-center gap-1.5">
        <Button size="sm" asChild>
          <Link to={`/gardens/${gardenId}/vault`}>
            {formatMessage({ id: "app.treasury.manageVault" })}
          </Link>
        </Button>
        {canManageRoles ? (
          <Button size="sm" variant="secondary" onClick={() => setRolesModalOpen(true)}>
            {formatMessage({ id: "app.garden.detail.action.manageRoles" })}
          </Button>
        ) : null}
      </div>
    ),
  };

  return (
    <Tabs.Root
      value={activeTab}
      onValueChange={(value) => {
        setTab(parseGardenTab(value));
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
          <div className="garden-tab-bar-actions hidden sm:flex">{tabActions[activeTab]}</div>
        </div>
      </GardenHeroBanner>

      <div className="px-4 sm:px-6">
        {/* Mobile-only tab actions (below tab bar, visible on small screens) */}
        <div className="flex items-center gap-1.5 pt-3 empty:hidden sm:hidden">
          {tabActions[activeTab]}
        </div>

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

      <GardenProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        gardenAddress={garden.id as Address}
        garden={garden}
        canManage={canManage}
        isOwner={isOwner}
      />

      <ManageRolesModal
        isOpen={rolesModalOpen}
        onClose={() => setRolesModalOpen(false)}
        roleMembers={roleMembers}
        canManageRoles={canManageRoles}
        isLoading={isOperationLoading}
        onOpenAddMember={openAddMemberModal}
        onOpenMembersModal={openMembersModal}
        onRemoveMember={(address, role) => setMemberToRemove({ address, role })}
      />

      <GardenDomainModal
        isOpen={domainModalOpen}
        onClose={() => setDomainModalOpen(false)}
        gardenAddress={garden.id as Address}
      />

      <AddMemberModal
        isOpen={addMemberModalOpen}
        onClose={() => setAddMemberModalOpen(false)}
        memberType={memberType}
        onAdd={async (address: Address) => {
          const result = await roleActions[memberType].add(address);
          if (result.success) {
            scheduleBackgroundRefetch();
          }
        }}
        isLoading={isOperationLoading}
      />

      <MembersModal
        isOpen={membersModalOpen}
        onClose={() => setMembersModalOpen(false)}
        title={formatMessage(
          { id: "app.admin.roles.all" },
          { role: getRoleLabel(activeRole, formatMessage).plural }
        )}
        members={roleMembers[activeRole]}
        canManage={canManageRoles}
        onRemove={async (member: string) => {
          const result = await roleActions[activeRole].remove(member);
          if (result.success) {
            scheduleBackgroundRefetch();
          } else {
            toastService.error({
              title: formatMessage(
                { id: "app.admin.roles.removeFailed" },
                { role: getRoleLabel(activeRole, formatMessage).singular }
              ),
              message:
                result.error?.message ??
                formatMessage(
                  { id: "app.admin.roles.removeFailed" },
                  { role: getRoleLabel(activeRole, formatMessage).singular }
                ),
            });
          }
        }}
        isLoading={isOperationLoading}
        icon={<ActiveRoleIcon className="h-5 w-5" />}
        colorScheme={GARDEN_ROLE_COLORS[activeRole]}
      />

      <ConfirmDialog
        isOpen={memberToRemove !== null}
        onClose={() => setMemberToRemove(null)}
        title={formatMessage({ id: "app.admin.roles.confirmRemoveTitle" })}
        description={formatMessage(
          { id: "app.admin.roles.confirmRemoveDescription" },
          {
            address: formatAddress(memberToRemove?.address),
            role: memberToRemove ? getRoleLabel(memberToRemove.role, formatMessage).singular : "",
          }
        )}
        confirmLabel={formatMessage({ id: "app.admin.roles.confirmRemoveAction" })}
        variant="danger"
        isLoading={isOperationLoading}
        onConfirm={async () => {
          if (!memberToRemove) return;
          const removeMemberRole = memberToRemove.role;
          const removeMemberAddress = memberToRemove.address;
          const roleLabel = getRoleLabel(removeMemberRole, formatMessage);
          setMemberToRemove(null);

          const result = await roleActions[removeMemberRole].remove(removeMemberAddress);
          if (result.success) {
            scheduleBackgroundRefetch();
          } else {
            toastService.error({
              title: formatMessage(
                { id: "app.admin.roles.removeFailed" },
                { role: roleLabel.singular }
              ),
              message:
                result.error?.message ??
                formatMessage({ id: "app.admin.roles.removeFailed" }, { role: roleLabel.singular }),
            });
          }
        }}
      />
    </Tabs.Root>
  );
}
