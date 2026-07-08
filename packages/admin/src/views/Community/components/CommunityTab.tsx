import {
  type Address,
  AddressDisplay,
  adminRoutes,
  Card,
  EmptyState,
  ErrorBoundary,
  formatTokenAmount,
  type GardenRole,
  type GardenSignalPool,
  PoolType,
  type RoleDirectoryEntry,
  type TabBadgeSeverity,
  useGardenOperations,
  useGardenYieldWiringState,
  WEIGHT_SCHEME_VALUES,
  WeightScheme,
  type YieldAllocation,
} from "@green-goods/shared";
import {
  RiAlertLine,
  RiArrowRightSLine,
  RiCheckLine,
  RiGroupLine,
  RiQuestionLine,
  RiUserSettingsLine,
} from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard } from "@/components/AdminCard";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { AdminSearchToolbar } from "@/components/AdminSearchToolbar";
import { EnsAddressText } from "@/components/EnsAddressText";
import { VaultContractDetails } from "@/components/Vault";
import { AddMembersDialog } from "@/components/Garden/AddMembersDialog";
import { ManageMembersDialog } from "@/components/Garden/ManageMembersDialog";
import { getRoleLabel } from "@/components/Garden/gardenUtils";
import GardenVaultView from "@/views/Garden/Vault";
import { CookieJarPayoutPanel } from "@/views/Hub/components/CookieJarPayoutPanel";
import { SectionStateCard } from "@/views/Garden/components/GardenDetailHelpers";
import { GovernancePanel } from "./GovernancePanel";

export interface CommunityTabProps {
  mode: "members" | "coordination" | "endowment" | "payouts";
  garden: { id: string; name: string };
  gardenId: string;
  canManage: boolean;
  section: string | undefined;
  selectedItem: string | null;
  showSectionStateCard?: boolean;
  clearSection: () => void;
  closeMembersModal: () => void;
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
  roleMembers: Record<GardenRole, Address[]>;
  visibleDirectory: RoleDirectoryEntry[];
  memberSearch: string;
  setMemberSearch: (search: string) => void;
  roleIcons: Record<GardenRole, React.ComponentType<{ className?: string }>>;
  scheduleBackgroundRefetch: () => void;
}

export function CommunityTab({
  mode,
  garden,
  gardenId,
  canManage,
  section,
  selectedItem,
  showSectionStateCard = true,
  clearSection,
  closeMembersModal,
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
  roleMembers,
  visibleDirectory,
  memberSearch,
  setMemberSearch,
  roleIcons,
  scheduleBackgroundRefetch,
}: CommunityTabProps) {
  const { formatMessage } = useIntl();
  const [manageMembersOpen, setManageMembersOpen] = useState(selectedItem === "manage-members");
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState<GardenRole | "all">("all");
  const operations = useGardenOperations(garden.id);
  const { wiringState, wiringStatus, repairHref } = useGardenYieldWiringState(gardenId as Address);

  const isLoading =
    mode === "members"
      ? communityLoading
      : mode === "coordination"
        ? communityLoading
        : mode === "endowment"
          ? vaultsLoading
          : allocationsLoading;
  const totalMembers = roleSummary.reduce((sum, entry) => sum + entry.count, 0);
  const gardenRouteContext = { gardenId: garden.id };
  const filteredDirectory = useMemo(
    () =>
      roleFilter === "all"
        ? visibleDirectory
        : visibleDirectory.filter((entry) => entry.roles.includes(roleFilter)),
    [roleFilter, visibleDirectory]
  );
  const missingCriticalRoles = useMemo(
    () =>
      roleSummary.filter(
        (entry) =>
          entry.count === 0 &&
          (entry.role === "owner" || entry.role === "operator" || entry.role === "evaluator")
      ),
    [roleSummary]
  );
  const hypercertPool = pools.find((pool) => pool.poolType === PoolType.Hypercert);
  const actionPool = pools.find((pool) => pool.poolType === PoolType.Action);
  const communityConfig = community as { weightScheme?: number } | null | undefined;
  const weightScheme =
    typeof communityConfig?.weightScheme === "number"
      ? (communityConfig.weightScheme as WeightScheme)
      : undefined;
  const weightSchemeLabel =
    weightScheme !== undefined && WeightScheme[weightScheme]
      ? WeightScheme[weightScheme].toLowerCase()
      : undefined;
  const weightSchemeValues =
    weightScheme !== undefined ? WEIGHT_SCHEME_VALUES[weightScheme] : undefined;
  const showWiringSection = Boolean(communityConfig) && pools.length > 0;
  const expectedHypercertPoolKnown = Boolean(wiringState?.expectedHypercertPoolAddress);
  const canShowReconnectLink =
    (wiringStatus === "missing-resolver-wiring" || wiringStatus === "mismatch") &&
    expectedHypercertPoolKnown &&
    Boolean(repairHref);

  useEffect(() => {
    if (selectedItem === "manage-members") {
      setManageMembersOpen(true);
    }
    if (selectedItem === "add-member") {
      setAddMembersOpen(true);
    }
  }, [selectedItem]);

  const addByRole = useMemo<
    Record<GardenRole, (address: Address) => Promise<{ success: boolean }>>
  >(
    () => ({
      gardener: operations.addGardener,
      operator: operations.addOperator,
      evaluator: operations.addEvaluator,
      owner: operations.addOwner,
      funder: operations.addFunder,
      community: operations.addCommunity,
    }),
    [operations]
  );
  const removeByRole = useMemo<
    Record<GardenRole, (address: Address) => Promise<{ success: boolean }>>
  >(
    () => ({
      gardener: operations.removeGardener,
      operator: operations.removeOperator,
      evaluator: operations.removeEvaluator,
      owner: operations.removeOwner,
      funder: operations.removeFunder,
      community: operations.removeCommunity,
    }),
    [operations]
  );
  const closeManageMembers = () => {
    setManageMembersOpen(false);
    if (selectedItem === "manage-members") closeMembersModal();
  };
  const closeAddMembers = () => {
    setAddMembersOpen(false);
    if (selectedItem === "add-member") closeMembersModal();
  };
  const handleRemoveMember = async (address: Address, role: GardenRole) => {
    const result = await removeByRole[role](address);
    if (!result.success) {
      scheduleBackgroundRefetch();
    }
    return result;
  };

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
    const mainSkeleton =
      mode === "members" ? (
        <>
          <div className="h-12 rounded-lg skeleton-shimmer" />
          <div className="h-10 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.06s" }} />
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className="h-16 rounded-lg skeleton-shimmer"
              style={{ animationDelay: `${0.1 + index * 0.04}s` }}
            />
          ))}
        </>
      ) : mode === "coordination" ? (
        <>
          <div className="h-28 rounded-lg skeleton-shimmer" />
          <div
            className="h-6 w-40 rounded-md skeleton-shimmer"
            style={{ animationDelay: "0.08s" }}
          />
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-20 rounded-lg skeleton-shimmer"
              style={{ animationDelay: `${0.12 + index * 0.05}s` }}
            />
          ))}
        </>
      ) : mode === "endowment" ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="h-20 rounded-lg skeleton-shimmer" />
            <div className="h-20 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.06s" }} />
            <div className="h-20 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.1s" }} />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="h-64 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.14s" }} />
            <div className="h-64 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.18s" }} />
          </div>
          <div className="h-40 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.22s" }} />
        </>
      ) : (
        <>
          <div className="h-10 w-48 rounded-md skeleton-shimmer" />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="h-52 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.06s" }} />
            <div className="h-52 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.1s" }} />
          </div>
        </>
      );
    const railSkeleton =
      mode === "members" ? (
        <>
          <div className="h-12 rounded-lg skeleton-shimmer" />
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div
              key={index}
              className="h-9 rounded-md skeleton-shimmer"
              style={{ animationDelay: `${0.08 + index * 0.04}s` }}
            />
          ))}
        </>
      ) : (
        <>
          <div className="h-28 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.16s" }} />
          <div className="h-28 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.22s" }} />
        </>
      );

    return (
      <div className="garden-tab-shell" role="status" aria-live="polite">
        <span className="sr-only">
          {formatMessage({ id: "app.garden.detail.community.loading" })}
        </span>
        <div className="garden-tab-layout">
          <div className="garden-tab-main space-y-4">{mainSkeleton}</div>
          <aside className="garden-tab-rail">
            <div className="garden-tab-rail-sticky space-y-4">{railSkeleton}</div>
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

          <ErrorBoundary context="GardenDetail.CommunityIA">
            {mode === "members" ? (
              <>
                <Card>
                  <Card.Header className="flex-wrap gap-3">
                    <div>
                      <h3 className="label-md text-text-strong sm:text-lg">
                        {formatMessage({ id: "cockpit.community.members.directory" })}
                      </h3>
                      <p className="mt-1 body-sm text-text-sub">
                        {formatMessage({ id: "cockpit.community.members.directoryDescription" })}
                      </p>
                    </div>
                    {canManage ? (
                      <AdminButton asChild variant="tonal" size="sm">
                        <Link
                          to={adminRoutes.communityMembers({
                            ...gardenRouteContext,
                            item: "manage-members",
                          })}
                        >
                          {formatMessage({ id: "cockpit.community.action.manageMembers" })}
                        </Link>
                      </AdminButton>
                    ) : null}
                  </Card.Header>
                  <Card.Body className="space-y-4">
                    <AdminSearchToolbar
                      search={memberSearch}
                      onSearchChange={setMemberSearch}
                      placeholder={formatMessage({
                        id: "app.garden.detail.community.memberSearch",
                      })}
                    />

                    <div
                      className="flex flex-wrap gap-2"
                      aria-label={formatMessage({ id: "cockpit.community.members.filterAria" })}
                    >
                      <AdminFilterChip
                        label={formatMessage({ id: "cockpit.community.members.filterAll" })}
                        selected={roleFilter === "all"}
                        onToggle={() => setRoleFilter("all")}
                      />
                      {roleSummary.map((entry) => {
                        const roleLabel = getRoleLabel(entry.role, formatMessage);
                        const Icon = roleIcons[entry.role];
                        return (
                          <AdminFilterChip
                            key={entry.role}
                            label={`${roleLabel.plural} (${entry.count})`}
                            selected={roleFilter === entry.role}
                            leadingIcon={Icon}
                            onToggle={() => setRoleFilter(entry.role)}
                          />
                        );
                      })}
                    </div>

                    {filteredDirectory.length === 0 ? (
                      <EmptyState
                        icon={<RiGroupLine className="h-6 w-6" />}
                        title={
                          memberSearch.trim() || roleFilter !== "all"
                            ? formatMessage({ id: "app.garden.detail.community.membersEmpty" })
                            : formatMessage({ id: "app.admin.garden.members.empty" })
                        }
                        description={
                          roleFilter !== "all"
                            ? formatMessage({ id: "cockpit.community.members.emptyFiltered" })
                            : undefined
                        }
                      />
                    ) : (
                      <div className="divide-y divide-stroke-soft rounded-lg border border-stroke-soft bg-bg-white">
                        {filteredDirectory.map((entry) => (
                          <div
                            key={entry.address}
                            className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0 space-y-2">
                              <EnsAddressText address={entry.address} />
                              <div className="flex flex-wrap gap-1.5">
                                {entry.roles.map((role) => {
                                  const roleLabel = getRoleLabel(role, formatMessage);
                                  return (
                                    <span
                                      key={`${entry.address}-${role}`}
                                      className="rounded-full bg-bg-soft px-2 py-0.5 text-xs font-medium text-text-sub"
                                    >
                                      {roleLabel.singular}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                            {canManage ? (
                              <AdminButton
                                asChild
                                variant="text"
                                size="sm"
                                className="self-start sm:self-center"
                              >
                                <Link
                                  to={adminRoutes.communityMembers({
                                    ...gardenRouteContext,
                                    item: "manage-members",
                                  })}
                                >
                                  <RiUserSettingsLine className="h-4 w-4" />
                                  {formatMessage({ id: "cockpit.community.members.manageRoles" })}
                                </Link>
                              </AdminButton>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </>
            ) : null}

            {mode === "coordination" ? (
              <>
                <Card>
                  <Card.Header>
                    <div>
                      <h3 className="label-md text-text-strong sm:text-lg">
                        {formatMessage({ id: "cockpit.community.coordination.proposals" })}
                      </h3>
                      <p className="mt-1 body-sm text-text-sub">
                        {formatMessage({
                          id: "cockpit.community.coordination.proposalsDescription",
                        })}
                      </p>
                    </div>
                  </Card.Header>
                  <Card.Body>
                    <GovernancePanel pools={pools} gardenId={gardenId} />
                  </Card.Body>
                </Card>
              </>
            ) : null}

            {mode === "endowment" ? <GardenVaultView layout="sheet" /> : null}

            {mode === "payouts" ? (
              <CookieJarPayoutPanel
                gardenAddress={garden.id as Address}
                routeAction={selectedItem === "fund-jar" ? "deposit" : null}
                allocationCount={allocations.length}
              />
            ) : null}
          </ErrorBoundary>
        </div>

        <aside className="garden-tab-rail">
          <div className="garden-tab-rail-sticky">
            {mode === "members" ? (
              <Card>
                <Card.Header>
                  <h3 className="label-md text-text-strong">
                    {formatMessage({ id: "cockpit.community.members.coverage" })}
                  </h3>
                </Card.Header>
                <Card.Body className="space-y-3">
                  <div className="garden-stat-row">
                    <span className="garden-stat-row-label">
                      {formatMessage({ id: "cockpit.community.members.total" })}
                    </span>
                    <span className="garden-stat-row-value">{totalMembers}</span>
                  </div>
                  {missingCriticalRoles.length > 0 ? (
                    <div className="rounded-lg border border-warning-light bg-warning-lighter px-3 py-2 text-xs text-warning-dark">
                      {formatMessage(
                        { id: "cockpit.community.members.missingCritical" },
                        {
                          roles: missingCriticalRoles
                            .map((entry) => getRoleLabel(entry.role, formatMessage).plural)
                            .join(", "),
                        }
                      )}
                    </div>
                  ) : null}
                  {roleSummary.map((entry) => {
                    const roleLabel = getRoleLabel(entry.role, formatMessage);
                    const Icon = roleIcons[entry.role];
                    const isCriticalEmpty =
                      entry.count === 0 &&
                      (entry.role === "owner" ||
                        entry.role === "operator" ||
                        entry.role === "evaluator");
                    return (
                      <Link
                        key={entry.role}
                        to={adminRoutes.communityMembers({
                          ...gardenRouteContext,
                          item: "manage-members",
                        })}
                        className={`garden-stat-row w-full h-auto min-w-0 rounded px-2 py-1 text-left ${
                          isCriticalEmpty ? "bg-warning-lighter text-warning-dark" : ""
                        }`}
                      >
                        <span className="inline-flex items-center gap-1.5 garden-stat-row-label">
                          <Icon className="h-3.5 w-3.5" />
                          {roleLabel.plural}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="garden-stat-row-value">{entry.count}</span>
                          <RiArrowRightSLine className="h-4 w-4 text-text-soft" />
                        </span>
                      </Link>
                    );
                  })}
                  {canManage ? (
                    <div className="grid grid-cols-1 gap-2 border-t border-stroke-soft pt-3">
                      <AdminButton asChild variant="filled" size="sm">
                        <Link
                          to={adminRoutes.communityMembers({
                            ...gardenRouteContext,
                            item: "add-member",
                          })}
                        >
                          {formatMessage({ id: "cockpit.community.action.addMember" })}
                        </Link>
                      </AdminButton>
                      <AdminButton asChild variant="tonal" size="sm">
                        <Link
                          to={adminRoutes.communityMembers({
                            ...gardenRouteContext,
                            item: "manage-members",
                          })}
                        >
                          {formatMessage({ id: "cockpit.community.action.manageMembers" })}
                        </Link>
                      </AdminButton>
                    </div>
                  ) : null}
                </Card.Body>
              </Card>
            ) : null}

            {mode === "coordination" ? (
              <Card>
                <Card.Header>
                  <h3 className="label-md text-text-strong">
                    {formatMessage({ id: "cockpit.community.coordination.status" })}
                  </h3>
                </Card.Header>
                <Card.Body className="space-y-3">
                  <div className="garden-stat-row">
                    <span className="garden-stat-row-label">
                      {formatMessage({ id: "cockpit.community.coordination.community" })}
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-text-strong">
                      {communityConfig ? (
                        <RiCheckLine className="h-4 w-4 text-success-dark" />
                      ) : (
                        <RiQuestionLine className="h-4 w-4 text-text-soft" />
                      )}
                      {communityConfig
                        ? formatMessage({ id: "app.community.statusConnected" })
                        : formatMessage({ id: "app.community.statusNotConnected" })}
                    </span>
                  </div>

                  {weightScheme !== undefined && weightSchemeLabel && weightSchemeValues ? (
                    <AdminCard variant="outlined" className="px-3 py-2">
                      <p className="body-xs text-text-soft">
                        {formatMessage({ id: "app.community.weightScheme" })}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-text-strong">
                        {formatMessage({ id: `app.community.weightScheme.${weightSchemeLabel}` })}
                      </p>
                      <p className="mt-1 text-xs text-text-soft">
                        {formatMessage(
                          { id: "cockpit.community.coordination.weightSummary" },
                          {
                            community: weightSchemeValues.community / 10_000,
                            gardener: weightSchemeValues.gardener / 10_000,
                            operator: weightSchemeValues.operator / 10_000,
                          }
                        )}
                      </p>
                    </AdminCard>
                  ) : null}

                  <div className="space-y-2">
                    {[hypercertPool, actionPool].map((pool, index) => {
                      const labelId =
                        index === 0
                          ? "app.community.poolType.hypercert"
                          : "app.community.poolType.action";
                      const linkTarget =
                        index === 0
                          ? adminRoutes.communityCoordinationSignalPool(
                              "hypercert",
                              gardenRouteContext
                            )
                          : adminRoutes.communityCoordinationSignalPool(
                              "action",
                              gardenRouteContext
                            );
                      return (
                        <AdminCard key={labelId} variant="outlined" className="px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="body-xs text-text-soft">
                                {formatMessage({ id: labelId })}
                              </p>
                              <p className="mt-1 text-sm text-text-strong">
                                {pool ? (
                                  <AddressDisplay address={pool.poolAddress} className="text-sm" />
                                ) : (
                                  formatMessage({
                                    id: "cockpit.community.coordination.poolMissing",
                                  })
                                )}
                              </p>
                            </div>
                            {pool ? (
                              <Link
                                to={linkTarget}
                                aria-label={formatMessage({ id: "app.actions.view" })}
                                className="mt-0.5 text-primary-base hover:text-primary-darker"
                              >
                                <RiArrowRightSLine className="h-4 w-4" />
                              </Link>
                            ) : null}
                          </div>
                        </AdminCard>
                      );
                    })}
                  </div>

                  {showWiringSection && wiringStatus === "connected" ? (
                    <p className="inline-flex items-start gap-1.5 rounded-lg bg-success-lighter px-3 py-2 text-xs text-success-dark">
                      <RiCheckLine className="mt-0.5 h-4 w-4 shrink-0" />
                      {formatMessage({ id: "app.community.yield.connected" })}
                    </p>
                  ) : null}
                  {showWiringSection &&
                  (wiringStatus === "missing-resolver-wiring" || wiringStatus === "mismatch") ? (
                    <div className="rounded-lg border border-warning-light bg-warning-lighter px-3 py-2 text-xs text-warning-dark">
                      <p className="inline-flex items-start gap-1.5">
                        <RiAlertLine className="mt-0.5 h-4 w-4 shrink-0" />
                        {wiringStatus === "mismatch"
                          ? formatMessage({ id: "app.community.yield.mismatch" })
                          : formatMessage({ id: "app.community.yield.notConnected" })}
                      </p>
                      {canShowReconnectLink && repairHref ? (
                        <Link
                          to={repairHref}
                          className="mt-2 inline-flex font-medium text-warning-dark underline-offset-2 hover:underline"
                        >
                          {formatMessage({ id: "app.community.yield.connectAction" })}
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                  {canManage && communityConfig && pools.length === 0 ? (
                    <AdminButton
                      type="button"
                      variant="tonal"
                      size="sm"
                      onClick={createPools}
                      disabled={isCreatingPools}
                      loading={isCreatingPools}
                      className="w-full"
                    >
                      {formatMessage({ id: "app.community.createPools" })}
                    </AdminButton>
                  ) : null}
                  <AdminButton asChild variant="text" size="sm" className="h-auto rounded p-0">
                    <Link to={adminRoutes.communityCoordinationStrategies(gardenRouteContext)}>
                      {formatMessage({ id: "app.conviction.manageStrategies" })}
                      <RiArrowRightSLine className="h-4 w-4" />
                    </Link>
                  </AdminButton>
                </Card.Body>
              </Card>
            ) : null}

            {mode === "endowment" ? (
              <>
                <Card>
                  <Card.Header>
                    <h3 className="label-md text-text-strong">
                      {formatMessage({ id: "cockpit.community.endowment.status" })}
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
                  </Card.Body>
                </Card>
                {hasVaults ? <VaultContractDetails gardenAddress={garden.id as Address} /> : null}
              </>
            ) : null}

            {mode === "payouts" ? (
              <Card>
                <Card.Header>
                  <h3 className="label-md text-text-strong">
                    {formatMessage({
                      id: "cockpit.community.payouts.readiness",
                      defaultMessage: "Payout readiness",
                    })}
                  </h3>
                </Card.Header>
                <Card.Body className="space-y-2">
                  <AdminCard variant="outlined" className="px-3 py-2">
                    <p className="body-xs text-text-soft">
                      {formatMessage({
                        id: "cockpit.community.payouts.historyCount",
                        defaultMessage: "Allocation events",
                      })}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-text-strong">
                      {allocations.length}
                    </p>
                  </AdminCard>
                  {allocationSplits ? (
                    <div className="space-y-1.5 border-t border-stroke-soft pt-2">
                      <p className="mb-1.5 text-[11px] text-text-soft">
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
                </Card.Body>
              </Card>
            ) : null}
          </div>
        </aside>
      </div>
      <ManageMembersDialog
        open={manageMembersOpen}
        onClose={closeManageMembers}
        tone="community"
        roleMembers={roleMembers}
        canManage={canManage}
        isLoading={operations.isLoading}
        onRemoveMember={handleRemoveMember}
        onAddMembers={() => setAddMembersOpen(true)}
      />
      <AddMembersDialog
        key={garden.id}
        open={addMembersOpen}
        onClose={closeAddMembers}
        tone="community"
        isLoading={operations.isLoading}
        onAdd={(role, address) => addByRole[role](address)}
      />
    </div>
  );
}
