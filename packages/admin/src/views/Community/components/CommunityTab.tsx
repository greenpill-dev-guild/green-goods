import {
  type Address,
  AddressDisplay,
  Button,
  Card,
  EmptyState,
  ErrorBoundary,
  formatTokenAmount,
  type GardenDetailTab,
  type GardenRole,
  type GardenSignalPool,
  type RoleDirectoryEntry,
  type TabBadgeSeverity,
  type YieldAllocation,
} from "@green-goods/shared";
import { RiArrowRightSLine, RiSearchLine, RiUserLine, RiUserSettingsLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard } from "@/components/AdminCard";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { AdminTextField } from "@/components/AdminTextField";
import { EnsAddressText } from "@/components/EnsAddressText";
import { GardenCommunityCard } from "@/components/Garden/GardenCommunityCard";
import { GardenYieldCard } from "@/components/Garden/GardenYieldCard";
import { getRoleLabel } from "@/components/Garden/gardenUtils";
import { CookieJarPayoutPanel } from "@/views/Hub/components/CookieJarPayoutPanel";
import { SectionStateCard } from "@/views/Garden/components/GardenDetailHelpers";
import { GovernancePanel } from "./GovernancePanel";

export interface CommunityTabProps {
  garden: { id: string; name: string };
  gardenId: string;
  canManage: boolean;
  isOwner: boolean;
  section: string | undefined;
  showSectionStateCard?: boolean;
  clearSection: () => void;
  openSection: (tab: GardenDetailTab, section: string, itemId?: string) => void;
  community: unknown;
  communityLoading: boolean;
  /** Tightened from `unknown` per Tier-5 audit finding #8 — the actual shape
   *  is GardenSignalPool[] (returned by useGardenPools). */
  pools: GardenSignalPool[];
  createPools: () => void;
  isCreatingPools: boolean;
  vaultsLoading: boolean;
  hasVaults: boolean;
  vaultNetDeposited: bigint;
  treasurySeverity: Exclude<TabBadgeSeverity, never>;
  allocations: YieldAllocation[];
  allocationsLoading: boolean;
  roleSummary: Array<{ role: GardenRole; count: number; firstMember?: Address }>;
  roleIcons: Record<GardenRole, React.ComponentType<{ className?: string }>>;
  filteredDirectory: RoleDirectoryEntry[];
  visibleDirectory: RoleDirectoryEntry[];
  memberSearch: string;
  setMemberSearch: (search: string) => void;
  openMembersModal: (type: GardenRole) => void;
  /** Clear link from People (engagement/read-only) to Garden → Members
   *  (the management surface). Role mutations never happen on this tab. */
  onManageMembers: () => void;
  scheduleBackgroundRefetch: () => void;
}

/** Read-only role chip palette — mirrors the Garden Members chip colors so a
 *  person reads the same across both surfaces. */
const PEOPLE_ROLE_CHIP_CLASSES: Record<GardenRole, string> = {
  owner: "bg-warning-lighter text-warning-dark",
  operator: "bg-success-lighter text-success-dark",
  evaluator: "bg-feature-lighter text-feature-dark",
  gardener: "bg-information-lighter text-information-dark",
  funder: "bg-primary-lighter text-primary-dark",
  community: "bg-bg-weak text-text-sub",
};

export function CommunityTab({
  garden,
  gardenId,
  canManage,
  isOwner,
  section,
  showSectionStateCard = true,
  clearSection,
  openSection,
  community,
  communityLoading,
  pools,
  createPools,
  isCreatingPools,
  vaultsLoading,
  hasVaults,
  vaultNetDeposited,
  treasurySeverity,
  allocations,
  allocationsLoading,
  roleSummary,
  roleIcons,
  filteredDirectory,
  visibleDirectory,
  memberSearch,
  setMemberSearch,
  openMembersModal,
  onManageMembers,
  scheduleBackgroundRefetch,
}: CommunityTabProps) {
  const { formatMessage } = useIntl();

  // Tier-6 alignment with handoff filter-chip pattern. Community People tab
  // gets a 5-chip rail mirroring Garden Members (All / Operators / Evaluators
  // / Gardeners / Funders). Roles that aren't represented in the current
  // directory data still render — they collapse the list to empty per the
  // "stub the rest as inert" direction lock from the audit.
  const [peopleFilter, setPeopleFilter] = useState<"all" | GardenRole>("all");
  const isPeopleMode = section === "members";
  const filteredVisibleDirectory = useMemo(() => {
    if (peopleFilter === "all") return visibleDirectory;
    return visibleDirectory.filter((entry) => entry.roles.includes(peopleFilter));
  }, [peopleFilter, visibleDirectory]);

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
          {showSectionStateCard && section ? (
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
            {(section === undefined ||
              section === "treasury" ||
              section === "pools" ||
              section === "governance") && (
              <GardenCommunityCard
                community={community}
                communityLoading={communityLoading}
                pools={pools}
                gardenId={gardenId}
                canManage={canManage}
                isCreatingPools={isCreatingPools}
                onCreatePools={createPools}
                onScheduleRefetch={scheduleBackgroundRefetch}
              />
            )}

            {(section === undefined || section === "governance") && (
              <GovernancePanel pools={pools} gardenId={gardenId} />
            )}

            {(section === undefined || section === "governance") && (
              <Card>
                <Card.Header>
                  <h3 className="label-md text-text-strong sm:text-lg">
                    {formatMessage({ id: "app.garden.detail.community.rolesSummary" })}
                  </h3>
                </Card.Header>
                <Card.Body>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {roleSummary.map((entry) => {
                      const roleLabel = getRoleLabel(entry.role, formatMessage);
                      const Icon = roleIcons[entry.role];
                      return (
                        <AdminCard variant="outlined" key={entry.role} className="px-3 py-2.5">
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
                            <AdminButton
                              type="button"
                              variant="text"
                              size="sm"
                              className="mt-1 h-auto min-w-0 rounded p-0 text-xs"
                              onClick={() => openMembersModal(entry.role)}
                            >
                              <EnsAddressText address={entry.firstMember} />
                            </AdminButton>
                          ) : (
                            <p className="mt-1 body-xs text-text-soft">
                              {formatMessage(
                                { id: "app.admin.roles.empty" },
                                { role: roleLabel.plural }
                              )}
                            </p>
                          )}
                        </AdminCard>
                      );
                    })}
                  </div>
                </Card.Body>
              </Card>
            )}

            {(section === undefined || section === "members") && (
              <Card>
                <Card.Header className="flex-wrap gap-3">
                  <div>
                    <h3 className="label-md text-text-strong sm:text-lg">
                      {formatMessage({ id: "app.garden.detail.community.membersTitle" })}
                    </h3>
                    <p className="mt-1 body-sm text-text-sub">
                      {formatMessage({ id: "app.garden.detail.community.membersDescription" })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!isPeopleMode && filteredDirectory.length > 8 ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openSection("community", "members")}
                      >
                        {formatMessage({ id: "app.garden.admin.viewAll" })}
                      </Button>
                    ) : null}
                    {canManage ? (
                      // People stays engagement/read-only — this is the one
                      // management affordance, and it leaves the tab.
                      <AdminButton
                        type="button"
                        variant="outlined"
                        size="sm"
                        leadingIcon={<RiUserSettingsLine />}
                        onClick={onManageMembers}
                      >
                        {formatMessage({
                          id: "cockpit.community.action.manageMembers",
                          defaultMessage: "Manage members",
                        })}
                      </AdminButton>
                    ) : null}
                  </div>
                </Card.Header>
                <Card.Body>
                  <div className="mb-3 space-y-3">
                    <AdminTextField
                      label={formatMessage({
                        id: "app.garden.detail.community.memberSearch",
                      })}
                      variant="outlined"
                      type="search"
                      value={memberSearch}
                      onChange={(event) => setMemberSearch(event.target.value)}
                      placeholder={formatMessage({
                        id: "app.garden.detail.community.memberSearch",
                      })}
                      leadingIcon={RiSearchLine}
                    />
                    <div
                      className="flex flex-wrap gap-1.5"
                      role="group"
                      aria-label={formatMessage({
                        id: "cockpit.community.people.filterAria",
                        defaultMessage: "Filter people by role",
                      })}
                    >
                      {(
                        [
                          {
                            id: "all",
                            labelId: "cockpit.community.people.filter.all",
                            fallback: "All",
                          },
                          {
                            id: "operator",
                            labelId: "cockpit.community.people.filter.operators",
                            fallback: "Operators",
                          },
                          {
                            id: "evaluator",
                            labelId: "cockpit.community.people.filter.evaluators",
                            fallback: "Evaluators",
                          },
                          {
                            id: "gardener",
                            labelId: "cockpit.community.people.filter.gardeners",
                            fallback: "Gardeners",
                          },
                          {
                            id: "funder",
                            labelId: "cockpit.community.people.filter.funders",
                            fallback: "Funders",
                          },
                        ] as ReadonlyArray<{
                          id: "all" | GardenRole;
                          labelId: string;
                          fallback: string;
                        }>
                      ).map((chip) => (
                        <AdminFilterChip
                          key={chip.id}
                          label={formatMessage({ id: chip.labelId, defaultMessage: chip.fallback })}
                          selected={peopleFilter === chip.id}
                          onToggle={() => setPeopleFilter(chip.id)}
                        />
                      ))}
                    </div>
                  </div>

                  {filteredVisibleDirectory.length === 0 ? (
                    <EmptyState
                      icon={<RiUserLine className="h-6 w-6" />}
                      title={formatMessage({ id: "app.garden.detail.community.membersEmpty" })}
                    />
                  ) : (
                    <div className="space-y-2">
                      {filteredVisibleDirectory.map((entry) => (
                        <AdminCard variant="outlined" key={entry.address} className="px-3 py-2.5">
                          <div className="flex min-w-0 items-center justify-between gap-3">
                            <AddressDisplay address={entry.address} className="min-w-0 flex-1" />
                            <div
                              className="flex flex-wrap items-center justify-end gap-1"
                              aria-label={formatMessage({
                                id: "cockpit.garden.members.rolesLabel",
                                defaultMessage: "Roles",
                              })}
                            >
                              {/* Read-only role indicators. The previous
                                  AdminButtons navigated back to this same
                                  route — a no-op pretending People manages
                                  roles. Management lives on Garden → Members. */}
                              {entry.roles.map((role) => {
                                const label = getRoleLabel(role, formatMessage);
                                return (
                                  <span
                                    key={`${entry.address}-${role}`}
                                    data-role-chip={role}
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-label-sm font-medium ${PEOPLE_ROLE_CHIP_CLASSES[role]}`}
                                  >
                                    {label.singular}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </AdminCard>
                      ))}
                    </div>
                  )}
                </Card.Body>
              </Card>
            )}

            {(section === undefined || section === "cookie-jars" || section === "payouts") && (
              <CookieJarPayoutPanel
                gardenAddress={garden.id as Address}
                canManage={canManage}
                isOwner={isOwner}
              />
            )}

            {(section === undefined || section === "yield" || section === "treasury") && (
              <GardenYieldCard
                allocations={allocations}
                allocationsLoading={allocationsLoading}
                gardenAddress={garden.id as Address}
              />
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
                <AdminCard variant="outlined" className="px-3 py-2">
                  <p className="body-xs text-text-soft">
                    {formatMessage({ id: "app.treasury.totalValueLocked" })}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-text-strong">
                    {hasVaults
                      ? formatTokenAmount(vaultNetDeposited)
                      : formatMessage({ id: "app.garden.detail.community.noVault" })}
                  </p>
                </AdminCard>
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
                    <p className="text-[11px] text-text-soft mb-1.5">
                      {formatMessage({
                        id: "app.garden.detail.community.yieldAllocationHint",
                        defaultMessage: "How yield is distributed",
                      })}
                    </p>
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
                <AdminButton
                  type="button"
                  variant="text"
                  size="sm"
                  className="h-auto min-w-0 rounded p-0 text-xs"
                  onClick={() => openSection("community", "treasury")}
                >
                  {formatMessage({ id: "app.actions.view" })}
                  <RiArrowRightSLine className="h-4 w-4" />
                </AdminButton>
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
                  // On the People mode these rows would navigate to the route
                  // the operator is already on — render plain count rows there
                  // and keep the navigation affordance on the other modes.
                  if (isPeopleMode) {
                    return (
                      <div key={entry.role} className="garden-stat-row w-full">
                        <span className="inline-flex items-center gap-1.5 garden-stat-row-label">
                          <Icon className="h-3.5 w-3.5" />
                          {roleLabel.plural}
                        </span>
                        <span className="garden-stat-row-value">{entry.count}</span>
                      </div>
                    );
                  }
                  return (
                    <AdminButton
                      key={entry.role}
                      type="button"
                      variant="text"
                      size="sm"
                      className="garden-stat-row w-full h-auto min-w-0 rounded p-0"
                      onClick={() => openMembersModal(entry.role)}
                    >
                      <span className="inline-flex items-center gap-1.5 garden-stat-row-label">
                        <Icon className="h-3.5 w-3.5" />
                        {roleLabel.plural}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="garden-stat-row-value">{entry.count}</span>
                        <RiArrowRightSLine className="h-4 w-4 text-text-soft" />
                      </span>
                    </AdminButton>
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
