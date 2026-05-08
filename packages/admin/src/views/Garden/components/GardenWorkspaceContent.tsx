import {
  type Address,
  AddressDisplay,
  Alert,
  EmptyState,
  GARDEN_ROLE_I18N_KEYS,
  type GardenRole,
  Surface,
  type AdminWorkspaceSectionTab,
  type useGardenWorkspaceController,
} from "@green-goods/shared";
import { RiPulseLine, RiTeamLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { GardenDomainModal } from "@/components/Garden/GardenDomainEditor";
import { GardenSettingsEditor } from "@/components/Garden/GardenSettingsEditor";
import {
  CanvasRouteErrorState,
  CanvasWorkspaceLoadingState,
  CanvasWorkspaceSelectionGate,
} from "@/components/Layout/CanvasRouteState";
import { OverviewTab } from "./OverviewTab";
import { GardenDomainSummaryRow } from "./GardenDetailHelpers";

interface GardenWorkspaceContentProps {
  workspace: ReturnType<typeof useGardenWorkspaceController>;
}

export function GardenWorkspaceContent({ workspace }: GardenWorkspaceContentProps) {
  const { formatMessage } = useIntl();

  if (!workspace.selectedGarden) {
    return (
      <CanvasWorkspaceSelectionGate
        workspaceLabel={formatMessage({ id: "cockpit.nav.garden", defaultMessage: "Garden" })}
        gardens={workspace.gardenOptions}
        onSelectGarden={workspace.handleSelectGarden}
      />
    );
  }

  if (workspace.fetching) {
    return <CanvasWorkspaceLoadingState />;
  }

  if (!workspace.garden || workspace.error) {
    return (
      <CanvasRouteErrorState
        message={
          workspace.error?.message ??
          formatMessage({
            id: "cockpit.garden.loadFailedDescription",
            defaultMessage: "Try choosing a different garden or refreshing the page.",
          })
        }
      />
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <GardenDomainSummaryRow domainMask={workspace.garden.domainMask} />
      {workspace.view === "overview" ? (
        <OverviewTab
          section={workspace.section}
          selectedItem={workspace.selectedItem}
          selectedRange={workspace.range}
          clearSection={workspace.clearSection}
          openSection={workspace.openSection}
          updateQueryState={workspace.updateOverviewQueryState}
          setTab={(tab) =>
            workspace.openSection(
              tab as AdminWorkspaceSectionTab,
              tab === "community" ? "treasury" : "queue"
            )
          }
          overviewAlerts={workspace.derived.overviewAlerts}
          gardenHealthLabel={workspace.derived.gardenHealthLabel}
          approvedInRangeCount={workspace.derived.approvedInRangeCount}
          impactVelocityDelta={workspace.derived.impactVelocityDelta}
          medianReviewAgeHours={workspace.derived.medianReviewAgeHours}
          activityFilter={workspace.activityFilter}
          setActivityFilter={workspace.setActivityFilter}
          filteredActivityEvents={workspace.canvasActivityEvents}
          isLoading={workspace.fetching}
          pendingWorkCount={workspace.derived.pendingWorks.length}
          assessmentCount30d={workspace.assessments.length}
          gardenerCount={workspace.garden.gardeners.length}
          treasuryBalance={workspace.treasuryBalance}
        />
      ) : null}

      {workspace.view === "activity" ? (
        <EmptyState
          icon={<RiPulseLine className="h-6 w-6" />}
          title={formatMessage({
            id: "cockpit.garden.activity.empty.title",
            defaultMessage: "Activity feed coming soon",
          })}
          description={formatMessage({
            id: "cockpit.garden.activity.empty.description",
            defaultMessage:
              "Submitted Work, plot updates, plantings, and milestones will surface here as the gardener-floor of this Garden.",
          })}
        />
      ) : null}

      {workspace.view === "members" ? (
        <GardenMembersList
          gardeners={workspace.garden.gardeners}
          operators={workspace.garden.operators ?? []}
          evaluators={workspace.garden.evaluators ?? []}
          funders={workspace.garden.funders ?? []}
          owners={workspace.garden.owners ?? []}
          gardenName={workspace.garden.name}
        />
      ) : null}

      {workspace.view === "settings" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <GardenSettingsEditor
            gardenAddress={workspace.garden.id as Address}
            garden={{
              name: workspace.garden.name,
              description: workspace.garden.description,
              location: workspace.garden.location,
              bannerImage: workspace.garden.bannerImage,
              openJoining: workspace.garden.openJoining,
              maxGardeners: workspace.garden.maxGardeners,
            }}
            canManage={workspace.canManage}
            isOwner={workspace.isOwner}
          />

          <div className="space-y-4">
            <Alert variant="info">
              {formatMessage({
                id: "cockpit.garden.settingsHint",
                defaultMessage:
                  "Profile, joining rules, and membership limits now live in the canvas garden workspace.",
              })}
            </Alert>

            <Surface
              elevation="ground"
              padding="compact"
              className="space-y-2 text-sm text-text-sub"
            >
              <h3 className="label-md text-text-strong">
                {formatMessage({
                  id: "cockpit.garden.contextCard",
                  defaultMessage: "Garden context",
                })}
              </h3>
              <p>
                <span className="font-medium text-text-strong">{workspace.garden.name}</span>
              </p>
              {workspace.garden.location ? <p>{workspace.garden.location}</p> : null}
              {workspace.community ? (
                <p>
                  {formatMessage({
                    id: "cockpit.garden.communityConnected",
                    defaultMessage: "Community connected",
                  })}
                </p>
              ) : null}
            </Surface>
          </div>
        </div>
      ) : null}
      {workspace.canManage ? (
        <GardenDomainModal
          isOpen={workspace.domainEditorOpen}
          onClose={workspace.closeDomainEditor}
          gardenAddress={workspace.garden.id as Address}
        />
      ) : null}
    </div>
  );
}

interface GardenMembersListProps {
  gardeners: Address[];
  operators: Address[];
  evaluators: Address[];
  funders: Address[];
  owners: Address[];
  gardenName: string;
}

/**
 * Tier 5c shipped real Members tab data; cleanup A5 extends the chip strip
 * from operator-only to operator / gardener / evaluator / funder / owner per
 * the audit-then-ship plan handoff. Uses AddressDisplay for ENS resolution +
 * truncation; the chip palette intentionally preserves operator=success from
 * Tier 5c instead of switching to GARDEN_ROLE_COLORS.operator=info, which
 * would silently change the visual identity of every existing row.
 */
type GardenMembersFilter = "all" | "operators" | "reviewers" | "gardeners" | "pending";

/**
 * Roles displayed as chips on each member row, in canonical privilege order.
 * "community" is excluded — Members tab focuses on active roster, not
 * passive community participants.
 */
const MEMBER_ROLE_DISPLAY_ORDER = [
  "owner",
  "operator",
  "evaluator",
  "gardener",
  "funder",
] as const satisfies readonly GardenRole[];

type MemberDisplayRole = (typeof MEMBER_ROLE_DISPLAY_ORDER)[number];

const MEMBER_ROLE_CHIP_CLASSES: Record<MemberDisplayRole, string> = {
  owner: "bg-warning-lighter text-warning-dark",
  operator: "bg-success-lighter text-success-dark",
  evaluator: "bg-feature-lighter text-feature-dark",
  gardener: "bg-information-lighter text-information-dark",
  funder: "bg-primary-lighter text-primary-dark",
};

export interface MemberRoleSets {
  owner: Set<string>;
  operator: Set<string>;
  evaluator: Set<string>;
  gardener: Set<string>;
  funder: Set<string>;
}

/**
 * Build lowercase role sets from per-role address arrays. Exported for unit
 * tests so the role-derivation contract is pinned without rendering the row.
 */
export function buildMemberRoleSets(input: {
  owners: Address[];
  operators: Address[];
  evaluators: Address[];
  gardeners: Address[];
  funders: Address[];
}): MemberRoleSets {
  return {
    owner: new Set(input.owners.map((address) => address.toLowerCase())),
    operator: new Set(input.operators.map((address) => address.toLowerCase())),
    evaluator: new Set(input.evaluators.map((address) => address.toLowerCase())),
    gardener: new Set(input.gardeners.map((address) => address.toLowerCase())),
    funder: new Set(input.funders.map((address) => address.toLowerCase())),
  };
}

/**
 * Roles a member holds, returned in MEMBER_ROLE_DISPLAY_ORDER so chip rows
 * are visually stable across members. Address comparison is lowercase-safe.
 */
export function memberRolesForAddress(address: Address, sets: MemberRoleSets): MemberDisplayRole[] {
  const lower = address.toLowerCase();
  return MEMBER_ROLE_DISPLAY_ORDER.filter((role) => sets[role].has(lower));
}

const GARDEN_MEMBERS_FILTERS: ReadonlyArray<{
  id: GardenMembersFilter;
  labelId: string;
  defaultMessage: string;
}> = [
  { id: "all", labelId: "cockpit.garden.members.filter.all", defaultMessage: "All" },
  {
    id: "operators",
    labelId: "cockpit.garden.members.filter.operators",
    defaultMessage: "Operators",
  },
  {
    id: "reviewers",
    labelId: "cockpit.garden.members.filter.reviewers",
    defaultMessage: "Reviewers",
  },
  {
    id: "gardeners",
    labelId: "cockpit.garden.members.filter.gardeners",
    defaultMessage: "Gardeners",
  },
  { id: "pending", labelId: "cockpit.garden.members.filter.pending", defaultMessage: "Pending" },
];

function GardenMembersList({
  gardeners,
  operators,
  evaluators,
  funders,
  owners,
  gardenName,
}: GardenMembersListProps) {
  const { formatMessage } = useIntl();
  const [filter, setFilter] = useState<GardenMembersFilter>("all");

  const roleSets = useMemo(
    () => buildMemberRoleSets({ owners, operators, evaluators, gardeners, funders }),
    [gardeners, operators, evaluators, funders, owners]
  );

  const visibleGardeners = useMemo(() => {
    // Filter chips: All / Operators / Reviewers / Gardeners / Pending.
    // Cleanup A5 wires Reviewers to the evaluator role (was an empty stub
    // before the role-set extension). "Gardeners" narrows to members whose
    // only display role is "gardener" — operators-and-evaluators-and-funders
    // surface in their own chip filters. Pending stays inert; no pending-
    // member data exists yet.
    if (filter === "operators") {
      return gardeners.filter((address) => roleSets.operator.has(address.toLowerCase()));
    }
    if (filter === "reviewers") {
      return gardeners.filter((address) => roleSets.evaluator.has(address.toLowerCase()));
    }
    if (filter === "gardeners") {
      return gardeners.filter((address) => {
        const roles = memberRolesForAddress(address, roleSets);
        return roles.length === 1 && roles[0] === "gardener";
      });
    }
    if (filter === "pending") {
      return [];
    }
    return gardeners;
  }, [filter, gardeners, roleSets]);

  if (gardeners.length === 0) {
    return (
      <EmptyState
        icon={<RiTeamLine className="h-6 w-6" />}
        title={formatMessage({
          id: "cockpit.garden.members.empty.title",
          defaultMessage: "No gardeners yet",
        })}
        description={formatMessage(
          {
            id: "cockpit.garden.members.empty.solo.description",
            defaultMessage:
              "{name} is open for joining — gardeners will appear here as they sign up.",
          },
          { name: gardenName }
        )}
      />
    );
  }

  return (
    <div className="space-y-3" data-component="GardenMembersList">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-title-md font-semibold text-text-strong">
          {formatMessage({
            id: "cockpit.garden.members.title",
            defaultMessage: "Gardeners",
          })}
        </h2>
        <p className="text-label-sm font-medium text-text-soft tabular-nums">
          {formatMessage(
            {
              id: "cockpit.garden.members.count",
              defaultMessage: "{count, plural, one {# gardener} other {# gardeners}}",
            },
            { count: gardeners.length }
          )}
        </p>
      </header>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Member filters">
        {GARDEN_MEMBERS_FILTERS.map((chip) => (
          <AdminFilterChip
            key={chip.id}
            selected={filter === chip.id}
            onClick={() => setFilter(chip.id)}
          >
            {formatMessage({ id: chip.labelId, defaultMessage: chip.defaultMessage })}
          </AdminFilterChip>
        ))}
      </div>

      <ul className="flex flex-col gap-2" role="list">
        {visibleGardeners.length === 0 ? (
          <li className="rounded-[var(--r-md,12px)] border border-dashed border-stroke-soft px-3 py-4 text-center text-label-sm text-text-soft">
            {formatMessage({
              id: "cockpit.garden.members.filterEmpty",
              defaultMessage: "No members in this filter yet.",
            })}
          </li>
        ) : null}
        {visibleGardeners.map((address) => {
          const memberRoles = memberRolesForAddress(address, roleSets);
          const primaryRole = memberRoles[0] ?? "gardener";
          return (
            <li
              key={address}
              data-slot="member-row"
              data-role={primaryRole}
              className="flex items-center justify-between gap-3 rounded-[var(--r-md,12px)] border border-stroke-soft bg-bg-white-0 px-3 py-2.5 shadow-[var(--edge-rest)]"
            >
              <AddressDisplay address={address} className="min-w-0 flex-1" />
              {memberRoles.length > 0 ? (
                <div
                  className="flex flex-wrap items-center justify-end gap-1"
                  aria-label={formatMessage({
                    id: "cockpit.garden.members.rolesLabel",
                    defaultMessage: "Roles",
                  })}
                >
                  {memberRoles.map((role) => {
                    const label = formatMessage({ id: GARDEN_ROLE_I18N_KEYS[role].singular });
                    return (
                      <span
                        key={role}
                        data-role-chip={role}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-label-sm font-medium ${MEMBER_ROLE_CHIP_CLASSES[role]}`}
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
