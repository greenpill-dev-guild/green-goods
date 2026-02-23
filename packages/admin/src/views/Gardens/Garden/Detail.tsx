import {
  type Address,
  ConfirmDialog,
  DEFAULT_CHAIN_ID,
  ErrorBoundary,
  GARDEN_ROLE_COLORS,
  GARDEN_ROLE_I18N_KEYS,
  type GardenOperationResult,
  type GardenRole,
  getNetDeposited,
  queryInvalidation,
  toastService,
  useConvictionStrategies,
  useCreateGardenPools,
  useDelayedInvalidation,
  useGardenAssessments,
  useGardenCommunity,
  useGardenOperations,
  useGardenPermissions,
  useGardenPools,
  useGardens,
  useGardenCookieJars,
  useGardenVaults,
  useWorks,
  useYieldAllocations,
  WeightScheme,
} from "@green-goods/shared";
import { RiCheckboxCircleLine, RiMedalLine, RiShieldCheckLine, RiUserLine } from "@remixicon/react";
import * as Tabs from "@radix-ui/react-tabs";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useParams } from "react-router-dom";
import { AddMemberModal } from "@/components/Garden/AddMemberModal";
import { GardenAssessmentsPanel } from "@/components/Garden/GardenAssessmentsPanel";
import { GardenCommunityCard } from "@/components/Garden/GardenCommunityCard";
import { GardenHeroSection } from "@/components/Garden/GardenHeroSection";
import { GardenMetadata } from "@/components/Garden/GardenMetadata";
import { GardenRolesPanel } from "@/components/Garden/GardenRolesPanel";
import { GardenStatsGrid } from "@/components/Garden/GardenStatsGrid";
import { GardenYieldCard } from "@/components/Garden/GardenYieldCard";
import { MembersModal } from "@/components/Garden/MembersModal";
import { PageHeader } from "@/components/Layout/PageHeader";
import { WorkSubmissionsView } from "@/components/Work/WorkSubmissionsView";
import "./GardenDetailLayout.css";

const TAB_TRIGGER_BASE =
  "border-b-2 border-transparent px-4 py-2 text-sm font-medium text-text-soft transition-colors hover:text-text-sub hover:border-stroke-sub data-[state=active]:border-primary-base data-[state=active]:text-primary-dark";

export default function GardenDetail() {
  const { id } = useParams<{ id: string }>();
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const gardenPermissions = useGardenPermissions();
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [memberType, setMemberType] = useState<GardenRole>("gardener");
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [membersModalType, setMembersModalType] = useState<GardenRole>("gardener");
  const [memberToRemove, setMemberToRemove] = useState<{
    address: Address;
    role: GardenRole;
  } | null>(null);

  const openAddMemberModal = (type: GardenRole) => {
    setMemberType(type);
    setAddMemberModalOpen(true);
  };

  const openMembersModal = (type: GardenRole) => {
    setMembersModalType(type);
    setMembersModalOpen(true);
  };

  const { data: gardens = [], isLoading: fetching, error } = useGardens();
  const garden = gardens.find((g) => g.id === id);

  const { start: scheduleBackgroundRefetch } = useDelayedInvalidation(() => {
    const keysToInvalidate = queryInvalidation.invalidateGardens(DEFAULT_CHAIN_ID);
    keysToInvalidate.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
  }, 5000);

  const {
    data: assessmentList = [],
    isLoading: fetchingAssessments,
    error: assessmentsError,
  } = useGardenAssessments(id);

  const assessments = assessmentList.slice(0, 5);
  const gardenId = id ?? "";

  const {
    addGardener,
    removeGardener,
    addOperator,
    removeOperator,
    addEvaluator,
    removeEvaluator,
    addOwner,
    removeOwner,
    addFunder,
    removeFunder,
    addCommunity,
    removeCommunity,
    isLoading,
  } = useGardenOperations(gardenId);

  const canManage = garden ? gardenPermissions.canManageGarden(garden) : false;
  const canReview = garden ? gardenPermissions.canReviewGarden(garden) : false;
  const canManageRoles = garden ? gardenPermissions.canAddMembers(garden) : false;

  const { vaults: gardenVaults = [], isLoading: vaultsLoading } = useGardenVaults(id, {
    enabled: Boolean(id),
  });

  const { jarCount: cookieJarCount } = useGardenCookieJars(id, {
    enabled: Boolean(id),
  });

  const { strategies: convictionStrategies } = useConvictionStrategies(
    (id as `0x${string}`) ?? undefined,
    { enabled: Boolean(id) && canManage }
  );

  const { community, isLoading: communityLoading } = useGardenCommunity(id as Address | undefined, {
    enabled: Boolean(id),
  });
  const { pools } = useGardenPools(id as Address | undefined, { enabled: Boolean(id) });
  const { createPools, isCreating: isCreatingPools } = useCreateGardenPools(
    id as Address | undefined
  );
  const { allocations, isLoading: allocationsLoading } = useYieldAllocations(
    id as Address | undefined,
    { enabled: Boolean(id) }
  );

  const weightSchemeLabel = community ? WeightScheme[community.weightScheme] : undefined;

  const { vaultNetDeposited, vaultHarvestCount, vaultDepositorCount } = useMemo(() => {
    let netDeposited = 0n;
    let harvestCount = 0;
    let depositorCount = 0;
    for (const vault of gardenVaults) {
      netDeposited += getNetDeposited(vault.totalDeposited, vault.totalWithdrawn);
      harvestCount += vault.totalHarvestCount;
      depositorCount += vault.depositorCount;
    }
    return {
      vaultNetDeposited: netDeposited,
      vaultHarvestCount: harvestCount,
      vaultDepositorCount: depositorCount,
    };
  }, [gardenVaults]);

  const { works } = useWorks(gardenId);

  const roleMembers: Record<GardenRole, Address[]> = {
    owner: garden?.owners ?? [],
    operator: garden?.operators ?? [],
    evaluator: garden?.evaluators ?? [],
    gardener: garden?.gardeners ?? [],
    funder: garden?.funders ?? [],
    community: garden?.communities ?? [],
  };

  const roleActions = {
    owner: { add: addOwner, remove: removeOwner },
    operator: { add: addOperator, remove: removeOperator },
    evaluator: { add: addEvaluator, remove: removeEvaluator },
    gardener: { add: addGardener, remove: removeGardener },
    funder: { add: addFunder, remove: removeFunder },
    community: { add: addCommunity, remove: removeCommunity },
  } satisfies Record<
    GardenRole,
    {
      add: (address: Address) => Promise<GardenOperationResult>;
      remove: (address: Address) => Promise<GardenOperationResult>;
    }
  >;

  const roleIcons = {
    owner: RiShieldCheckLine,
    operator: RiUserLine,
    evaluator: RiCheckboxCircleLine,
    gardener: RiUserLine,
    funder: RiMedalLine,
    community: RiUserLine,
  } as const;

  const getRoleLabel = (role: GardenRole) => ({
    singular: formatMessage({ id: GARDEN_ROLE_I18N_KEYS[role].singular }),
    plural: formatMessage({ id: GARDEN_ROLE_I18N_KEYS[role].plural }),
  });

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
            <div className="h-48 rounded skeleton-shimmer" style={{ animationDelay: "0.1s" }} />
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
          <div className="rounded-md border border-error-light bg-error-lighter p-4" role="alert">
            <p className="text-sm text-error-dark">
              {error?.message ?? formatMessage({ id: "app.garden.admin.notFound" })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="garden-detail-container pb-6">
      <PageHeader title={garden.name} {...baseHeaderProps} />

      <Tabs.Root defaultValue="overview" className="mt-6 px-4 sm:px-6">
        <Tabs.List className="flex border-b border-stroke-soft">
          <Tabs.Trigger value="overview" className={TAB_TRIGGER_BASE}>
            {formatMessage({ id: "app.garden.admin.tab.overview" })}
          </Tabs.Trigger>
          <Tabs.Trigger value="work" className={TAB_TRIGGER_BASE}>
            {formatMessage({ id: "app.garden.admin.tab.work" })}
          </Tabs.Trigger>
          <Tabs.Trigger value="roles" className={TAB_TRIGGER_BASE}>
            {formatMessage({ id: "app.garden.admin.tab.roles" })}
          </Tabs.Trigger>
          <Tabs.Trigger value="community" className={TAB_TRIGGER_BASE}>
            {formatMessage({ id: "app.garden.admin.tab.community" })}
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="overview" className="garden-tab-content mt-4">
          <GardenHeroSection
            garden={garden}
            gardenId={gardenId}
            canManage={canManage}
            canReview={canReview}
          />

          <GardenStatsGrid
            gardenerCount={garden.gardeners.length}
            operatorCount={garden.operators.length}
            workCount={works.length}
            assessmentCount={assessments.length}
            hasVaults={gardenVaults.length > 0}
            vaultNetDeposited={vaultNetDeposited}
            vaultHarvestCount={vaultHarvestCount}
            vaultDepositorCount={vaultDepositorCount}
            communityLoading={communityLoading}
            communityLabel={weightSchemeLabel}
          />

          <GardenMetadata
            gardenId={garden.id}
            tokenAddress={garden.tokenAddress}
            tokenId={garden.tokenID}
            chainId={garden.chainId}
          />

          <GardenAssessmentsPanel
            assessments={assessments}
            isLoading={fetchingAssessments}
            error={assessmentsError}
            gardenId={gardenId}
          />
        </Tabs.Content>

        <Tabs.Content value="work" className="garden-tab-content mt-4">
          <WorkSubmissionsView gardenId={garden.id} canManage={canReview} />
        </Tabs.Content>

        <Tabs.Content value="roles" className="garden-tab-content mt-4">
          <GardenRolesPanel
            roleMembers={roleMembers}
            canManageRoles={canManageRoles}
            isLoading={isLoading}
            onOpenAddMember={openAddMemberModal}
            onOpenMembersModal={openMembersModal}
            onRemoveMember={(address, role) => setMemberToRemove({ address, role })}
          />
        </Tabs.Content>

        <Tabs.Content value="community" className="garden-tab-content mt-4">
          <ErrorBoundary context="GardenDetail.YieldCommunity">
            <GardenCommunityCard
              community={community}
              communityLoading={communityLoading}
              pools={pools}
              gardenId={gardenId}
              canManage={canManage}
              cookieJarCount={cookieJarCount}
              gardenName={garden.name}
              convictionStrategyCount={convictionStrategies.length}
              vaultsLoading={vaultsLoading}
              hasVaults={gardenVaults.length > 0}
              isCreatingPools={isCreatingPools}
              onCreatePools={createPools}
              onScheduleRefetch={scheduleBackgroundRefetch}
            />
            <GardenYieldCard allocations={allocations} allocationsLoading={allocationsLoading} />
          </ErrorBoundary>
        </Tabs.Content>
      </Tabs.Root>

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
        isLoading={isLoading}
      />

      <MembersModal
        isOpen={membersModalOpen}
        onClose={() => setMembersModalOpen(false)}
        title={formatMessage(
          { id: "app.admin.roles.all" },
          { role: getRoleLabel(activeRole).plural }
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
                { role: getRoleLabel(activeRole).singular }
              ),
              message:
                result.error?.message ??
                formatMessage(
                  { id: "app.admin.roles.removeFailed" },
                  { role: getRoleLabel(activeRole).singular }
                ),
            });
          }
        }}
        isLoading={isLoading}
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
            address: memberToRemove?.address ?? "",
            role: memberToRemove ? getRoleLabel(memberToRemove.role).singular : "",
          }
        )}
        confirmLabel={formatMessage({ id: "app.admin.roles.confirmRemoveAction" })}
        variant="danger"
        isLoading={isLoading}
        onConfirm={async () => {
          if (!memberToRemove) return;
          const removeMemberRole = memberToRemove.role;
          const removeMemberAddress = memberToRemove.address;
          const roleLabel = getRoleLabel(removeMemberRole);
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
    </div>
  );
}
