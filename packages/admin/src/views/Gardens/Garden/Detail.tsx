import {
  type Address,
  ConfirmDialog,
  ErrorBoundary,
  GARDEN_ROLE_COLORS,
  type GardenRole,
  formatAddress,
  toastService,
} from "@green-goods/shared";
import {
  RiCheckboxCircleLine,
  RiErrorWarningLine,
  RiMedalLine,
  RiShieldCheckLine,
  RiUserLine,
} from "@remixicon/react";
import * as Tabs from "@radix-ui/react-tabs";
import { useState } from "react";
import { useIntl } from "react-intl";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getRoleLabel } from "@/components/Garden/gardenUtils";
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
import { useGardenDetailData } from "./useGardenDetailData";
import "./GardenDetailLayout.css";

const TAB_TRIGGER_BASE =
  "border-b-2 border-transparent px-4 py-2 text-sm font-medium text-text-soft transition-colors hover:text-text-sub hover:border-stroke-sub data-[state=active]:border-primary-base data-[state=active]:text-primary-dark";

export default function GardenDetail() {
  const { id } = useParams<{ id: string }>();
  const { formatMessage } = useIntl();

  const {
    garden,
    fetching,
    error,
    gardenId,
    canManage,
    canReview,
    canManageRoles,
    assessments,
    fetchingAssessments,
    assessmentsError,
    roleMembers,
    roleActions,
    isOperationLoading,
    community,
    communityLoading,
    weightSchemeLabel,
    pools,
    createPools,
    isCreatingPools,
    gardenVaults,
    vaultsLoading,
    vaultNetDeposited,
    vaultHarvestCount,
    vaultDepositorCount,
    allocations,
    allocationsLoading,
    works,
    cookieJarCount,
    convictionStrategyCount,
    scheduleBackgroundRefetch,
  } = useGardenDetailData(id);

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

  const roleIcons = {
    owner: RiShieldCheckLine,
    operator: RiUserLine,
    evaluator: RiCheckboxCircleLine,
    gardener: RiUserLine,
    funder: RiMedalLine,
    community: RiUserLine,
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
    <Tabs.Root defaultValue="overview" className="garden-detail-container pb-6">
      <PageHeader title={garden.name} {...baseHeaderProps}>
        <Tabs.List className="-mb-[1px] flex">
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
      </PageHeader>

      <div className="px-4 sm:px-6">
        <Tabs.Content
          value="overview"
          className="garden-tab-content"
          aria-label={formatMessage({ id: "app.garden.admin.tab.overview" })}
        >
          <GardenHeroSection
            garden={garden}
            gardenId={gardenId}
            canManage={canManage}
            canReview={canReview}
            gardenerCount={garden.gardeners.length}
            operatorCount={garden.operators.length}
            workCount={works.length}
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
            chainId={garden.chainId}
          />
        </Tabs.Content>

        <Tabs.Content
          value="work"
          className="garden-tab-content"
          aria-label={formatMessage({ id: "app.garden.admin.tab.work" })}
        >
          <WorkSubmissionsView gardenId={garden.id} canManage={canReview} />
        </Tabs.Content>

        <Tabs.Content
          value="roles"
          className="garden-tab-content"
          aria-label={formatMessage({ id: "app.garden.admin.tab.roles" })}
        >
          <GardenRolesPanel
            roleMembers={roleMembers}
            canManageRoles={canManageRoles}
            isLoading={isOperationLoading}
            onOpenAddMember={openAddMemberModal}
            onOpenMembersModal={openMembersModal}
            onRemoveMember={(address, role) => setMemberToRemove({ address, role })}
          />
        </Tabs.Content>

        <Tabs.Content
          value="community"
          className="garden-tab-content"
          aria-label={formatMessage({ id: "app.garden.admin.tab.community" })}
        >
          <ErrorBoundary context="GardenDetail.YieldCommunity">
            <GardenCommunityCard
              community={community}
              communityLoading={communityLoading}
              pools={pools}
              gardenId={gardenId}
              canManage={canManage}
              cookieJarCount={cookieJarCount}
              gardenName={garden.name}
              convictionStrategyCount={convictionStrategyCount}
              vaultsLoading={vaultsLoading}
              hasVaults={gardenVaults.length > 0}
              isCreatingPools={isCreatingPools}
              onCreatePools={createPools}
              onScheduleRefetch={scheduleBackgroundRefetch}
            />
            <GardenYieldCard allocations={allocations} allocationsLoading={allocationsLoading} />
          </ErrorBoundary>
        </Tabs.Content>
      </div>

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
