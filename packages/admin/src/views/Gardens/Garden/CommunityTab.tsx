import {
  type Address,
  ErrorBoundary,
  formatAddress,
  formatTokenAmount,
  type GardenRole,
} from "@green-goods/shared";
import { RiArrowRightSLine, RiUserLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { AddressDisplay } from "@/components/AddressDisplay";
import { getRoleLabel } from "@/components/Garden/gardenUtils";
import { GardenCommunityCard } from "@/components/Garden/GardenCommunityCard";
import { GardenRolesPanel } from "@/components/Garden/GardenRolesPanel";
import { GardenYieldCard } from "@/components/Garden/GardenYieldCard";
import { CookieJarPayoutPanel } from "@/components/Work/CookieJarPayoutPanel";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionStateCard } from "./GardenDetailHelpers";
import type { GardenTab, RoleDirectoryEntry, TabBadgeSeverity } from "./gardenDetail.types";

export interface CommunityTabProps {
  garden: { id: string; name: string };
  gardenId: string;
  canManage: boolean;
  canManageRoles: boolean;
  isOwner: boolean;
  section: string | undefined;
  clearSection: () => void;
  openSection: (tab: GardenTab, section: string, itemId?: string) => void;
  community: unknown;
  communityLoading: boolean;
  pools: unknown;
  createPools: () => void;
  isCreatingPools: boolean;
  convictionStrategyCount: number;
  vaultsLoading: boolean;
  hasVaults: boolean;
  vaultNetDeposited: bigint;
  treasurySeverity: Exclude<TabBadgeSeverity, never>;
  allocations: Array<{
    txHash: string;
    timestamp: number;
    cookieJarAmount: bigint;
    fractionsAmount: bigint;
    juiceboxAmount: bigint;
  }>;
  allocationsLoading: boolean;
  roleMembers: Record<GardenRole, Address[]>;
  isOperationLoading: boolean;
  roleSummary: Array<{ role: GardenRole; count: number; firstMember?: Address }>;
  roleIcons: Record<GardenRole, React.ComponentType<{ className?: string }>>;
  filteredDirectory: RoleDirectoryEntry[];
  visibleDirectory: RoleDirectoryEntry[];
  memberSearch: string;
  setMemberSearch: (search: string) => void;
  openAddMemberModal: (type: GardenRole) => void;
  openMembersModal: (type: GardenRole) => void;
  setMemberToRemove: (member: { address: Address; role: GardenRole } | null) => void;
  scheduleBackgroundRefetch: () => void;
}

export function CommunityTab({
  garden,
  gardenId,
  canManage,
  canManageRoles,
  isOwner,
  section,
  clearSection,
  openSection,
  community,
  communityLoading,
  pools,
  createPools,
  isCreatingPools,
  convictionStrategyCount,
  vaultsLoading,
  hasVaults,
  vaultNetDeposited,
  treasurySeverity,
  allocations,
  allocationsLoading,
  roleMembers,
  isOperationLoading,
  roleSummary,
  roleIcons,
  filteredDirectory,
  visibleDirectory,
  memberSearch,
  setMemberSearch,
  openAddMemberModal,
  openMembersModal,
  setMemberToRemove,
  scheduleBackgroundRefetch,
}: CommunityTabProps) {
  const { formatMessage } = useIntl();

  const isLoading = communityLoading || allocationsLoading || vaultsLoading;

  // Compute allocation split percentages from the most recent allocation
  const latestAllocation = allocations.length > 0 ? allocations[0] : null;
  let allocationSplits: { cookieJar: number; fractions: number; endowment: number } | null = null;
  if (latestAllocation) {
    const total =
      latestAllocation.cookieJarAmount +
      latestAllocation.fractionsAmount +
      latestAllocation.juiceboxAmount;
    if (total > 0n) {
      const toPercent = (amount: bigint) => Number((amount * 1000n) / total) / 10;
      allocationSplits = {
        cookieJar: toPercent(latestAllocation.cookieJarAmount),
        fractions: toPercent(latestAllocation.fractionsAmount),
        endowment: toPercent(latestAllocation.juiceboxAmount),
      };
    }
  }

  if (isLoading) {
    return (
      <div className="garden-tab-shell" role="status" aria-live="polite">
        <span className="sr-only">
          {formatMessage({ id: "app.garden.detail.community.loading" })}
        </span>
        <div className="garden-tab-layout">
          <div className="garden-tab-main space-y-4">
            <div className="h-44 rounded-lg skeleton-shimmer" />
            <div className="h-32 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.1s" }} />
            <div className="h-56 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.15s" }} />
          </div>
          <aside className="garden-tab-rail">
            <div className="garden-tab-rail-sticky space-y-4">
              <div
                className="h-28 rounded-lg skeleton-shimmer"
                style={{ animationDelay: "0.2s" }}
              />
              <div
                className="h-28 rounded-lg skeleton-shimmer"
                style={{ animationDelay: "0.25s" }}
              />
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="garden-tab-shell">
      <div className="garden-tab-layout">
        <div className="garden-tab-main">
          {section ? (
            <SectionStateCard
              title={formatMessage({ id: `app.garden.detail.section.${section}.title` })}
              description={formatMessage({
                id: `app.garden.detail.section.${section}.description`,
              })}
              closeLabel={formatMessage({ id: "app.common.close" })}
              onClose={clearSection}
            />
          ) : null}

          <ErrorBoundary context="GardenDetail.CommunityRevamp">
            {(section === undefined || section === "treasury" || section === "pools") && (
              <GardenCommunityCard
                community={community}
                communityLoading={communityLoading}
                pools={pools}
                gardenId={gardenId}
                canManage={canManage}
                gardenName={garden.name}
                convictionStrategyCount={convictionStrategyCount}
                vaultsLoading={vaultsLoading}
                hasVaults={hasVaults}
                isCreatingPools={isCreatingPools}
                onCreatePools={createPools}
                onScheduleRefetch={scheduleBackgroundRefetch}
              />
            )}

            {(section === undefined || section === "yield") && (
              <GardenYieldCard allocations={allocations} allocationsLoading={allocationsLoading} />
            )}

            {(section === undefined || section === "cookie-jars") && (
              <CookieJarPayoutPanel
                gardenAddress={garden.id as Address}
                canManage={canManage}
                isOwner={isOwner}
              />
            )}

            {(section === undefined || section === "roles") && (
              <Card>
                <Card.Header className="flex-wrap gap-3">
                  <h3 className="label-md text-text-strong sm:text-lg">
                    {formatMessage({ id: "app.garden.detail.community.rolesSummary" })}
                  </h3>
                  {canManageRoles && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openSection("community", "roles")}
                    >
                      {formatMessage({ id: "app.garden.detail.action.manageRoles" })}
                    </Button>
                  )}
                </Card.Header>
                <Card.Body>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {roleSummary.map((entry) => {
                      const roleLabel = getRoleLabel(entry.role, formatMessage);
                      const Icon = roleIcons[entry.role];
                      return (
                        <div
                          key={entry.role}
                          className="rounded-lg border border-stroke-soft bg-bg-weak px-3 py-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-text-strong">
                              <Icon className="h-4 w-4 text-text-soft" />
                              {roleLabel.plural}
                            </p>
                            <span className="text-sm font-semibold text-text-strong">
                              {entry.count}
                            </span>
                          </div>
                          {entry.firstMember ? (
                            <button
                              type="button"
                              onClick={() => openMembersModal(entry.role)}
                              className="mt-1 inline-flex text-xs text-primary-base hover:text-primary-darker"
                            >
                              {formatAddress(entry.firstMember)}
                            </button>
                          ) : (
                            <p className="mt-1 text-xs text-text-soft">
                              {formatMessage(
                                { id: "app.admin.roles.empty" },
                                { role: roleLabel.plural }
                              )}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card.Body>
              </Card>
            )}

            {section === "roles" ? (
              <GardenRolesPanel
                roleMembers={roleMembers}
                canManageRoles={canManageRoles}
                isLoading={isOperationLoading}
                onOpenAddMember={openAddMemberModal}
                onOpenMembersModal={openMembersModal}
                onRemoveMember={(address, role) => setMemberToRemove({ address, role })}
              />
            ) : null}

            {(section === undefined || section === "members") && (
              <Card>
                <Card.Header className="flex-wrap gap-3">
                  <div>
                    <h3 className="label-md text-text-strong sm:text-lg">
                      {formatMessage({ id: "app.garden.detail.community.membersTitle" })}
                    </h3>
                    <p className="mt-1 text-sm text-text-sub">
                      {formatMessage({ id: "app.garden.detail.community.membersDescription" })}
                    </p>
                  </div>
                  {section !== "members" && filteredDirectory.length > 8 ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openSection("community", "members")}
                    >
                      {formatMessage({ id: "app.garden.admin.viewAll" })}
                    </Button>
                  ) : null}
                </Card.Header>
                <Card.Body>
                  <div className="mb-3">
                    <input
                      type="search"
                      value={memberSearch}
                      onChange={(event) => setMemberSearch(event.target.value)}
                      placeholder={formatMessage({
                        id: "app.garden.detail.community.memberSearch",
                      })}
                      className="w-full rounded-md border border-stroke-sub bg-bg-white px-3 py-2 text-sm text-text-strong placeholder:text-text-soft focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-base/20"
                    />
                  </div>

                  {visibleDirectory.length === 0 ? (
                    <EmptyState
                      icon={<RiUserLine className="h-6 w-6" />}
                      title={formatMessage({ id: "app.garden.detail.community.membersEmpty" })}
                    />
                  ) : (
                    <div className="space-y-2">
                      {visibleDirectory.map((entry) => (
                        <div
                          key={entry.address}
                          className="rounded-lg border border-stroke-soft bg-bg-weak px-3 py-2.5"
                        >
                          <div className="flex min-w-0 items-center justify-between gap-3">
                            <AddressDisplay address={entry.address} className="min-w-0 flex-1" />
                            <div className="flex flex-wrap items-center gap-1.5">
                              {entry.roles.map((role) => {
                                const label = getRoleLabel(role, formatMessage);
                                return (
                                  <button
                                    key={`${entry.address}-${role}`}
                                    type="button"
                                    onClick={() => openMembersModal(role)}
                                    className="inline-flex items-center rounded-full bg-bg-soft px-2 py-0.5 text-[11px] font-medium text-text-sub hover:bg-bg-sub"
                                  >
                                    {label.singular}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card.Body>
              </Card>
            )}
          </ErrorBoundary>
        </div>

        <aside className="garden-tab-rail">
          <div className="garden-tab-rail-sticky">
            <Card>
              <Card.Header>
                <h3 className="label-md text-text-strong">
                  {formatMessage({ id: "app.garden.detail.community.treasuryStatus" })}
                </h3>
              </Card.Header>
              <Card.Body className="space-y-2">
                <div className="rounded-lg border border-stroke-soft bg-bg-weak px-3 py-2">
                  <p className="text-xs text-text-soft">
                    {formatMessage({ id: "app.treasury.totalValueLocked" })}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-text-strong">
                    {hasVaults
                      ? formatTokenAmount(vaultNetDeposited)
                      : formatMessage({ id: "app.garden.detail.community.noVault" })}
                  </p>
                </div>
                {treasurySeverity !== "none" ? (
                  <p
                    className={`text-sm ${
                      treasurySeverity === "critical" ? "text-error-dark" : "text-warning-dark"
                    }`}
                  >
                    {treasurySeverity === "critical"
                      ? formatMessage({ id: "app.garden.detail.alert.treasuryEmpty" })
                      : formatMessage({ id: "app.garden.detail.alert.treasuryMissing" })}
                  </p>
                ) : null}
                {allocationSplits ? (
                  <div className="space-y-1.5 border-t border-stroke-soft pt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-sub">
                        {formatMessage({ id: "app.garden.detail.community.cookieJar" })}
                      </span>
                      <span className="font-medium text-text-strong">
                        {allocationSplits.cookieJar}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-sub">
                        {formatMessage({ id: "app.garden.detail.community.hypercertFrac" })}
                      </span>
                      <span className="font-medium text-text-strong">
                        {allocationSplits.fractions}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-sub">
                        {formatMessage({ id: "app.garden.detail.community.endowment" })}
                      </span>
                      <span className="font-medium text-text-strong">
                        {allocationSplits.endowment}%
                      </span>
                    </div>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => openSection("community", "treasury")}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary-base hover:text-primary-darker"
                >
                  {formatMessage({ id: "app.actions.view" })}
                  <RiArrowRightSLine className="h-4 w-4" />
                </button>
              </Card.Body>
            </Card>

            <Card>
              <Card.Header>
                <h3 className="label-md text-text-strong">
                  {formatMessage({ id: "app.garden.detail.rolesOverview" })}
                </h3>
              </Card.Header>
              <Card.Body className="space-y-2">
                {roleSummary.map((entry) => {
                  const roleLabel = getRoleLabel(entry.role, formatMessage);
                  const Icon = roleIcons[entry.role];
                  return (
                    <button
                      key={entry.role}
                      type="button"
                      onClick={() => openMembersModal(entry.role)}
                      className="garden-stat-row w-full"
                    >
                      <span className="inline-flex items-center gap-1.5 garden-stat-row-label">
                        <Icon className="h-3.5 w-3.5" />
                        {roleLabel.plural}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="garden-stat-row-value">{entry.count}</span>
                        <RiArrowRightSLine className="h-4 w-4 text-text-soft" />
                      </span>
                    </button>
                  );
                })}
              </Card.Body>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );
}
