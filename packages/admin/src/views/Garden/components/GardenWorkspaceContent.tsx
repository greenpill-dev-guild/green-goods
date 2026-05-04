import {
  type Address,
  AddressDisplay,
  Alert,
  EmptyState,
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
  const [domainModalOpen, setDomainModalOpen] = useState(false);

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
    <div className="mt-4 px-4 sm:px-6">
      <div className="mx-auto w-full max-w-[1400px]">
        <Surface elevation="solid-raised" padding="default" className="overflow-hidden">
          <GardenDomainSummaryRow
            domainMask={workspace.garden.domainMask}
            canManage={workspace.canManage}
            onEditDomains={workspace.canManage ? () => setDomainModalOpen(true) : undefined}
          />
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
        </Surface>
        {workspace.canManage ? (
          <GardenDomainModal
            isOpen={domainModalOpen}
            onClose={() => setDomainModalOpen(false)}
            gardenAddress={workspace.garden.id as Address}
          />
        ) : null}
      </div>
    </div>
  );
}

interface GardenMembersListProps {
  gardeners: Address[];
  operators: Address[];
  gardenName: string;
}

/**
 * Tier 5c: real Members tab roster — replaces the Tier 4 EmptyState
 * placeholder with a list of gardeners + operator chips. Uses
 * AddressDisplay for ENS resolution + truncation. Activity-state /
 * role chips beyond operator/gardener defer to a later iteration when
 * the data layer surfaces last-active timestamps.
 */
type GardenMembersFilter = "all" | "operators" | "reviewers" | "gardeners" | "pending";

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

function GardenMembersList({ gardeners, operators, gardenName }: GardenMembersListProps) {
  const { formatMessage } = useIntl();
  const [filter, setFilter] = useState<GardenMembersFilter>("all");
  const operatorSet = new Set(operators.map((address) => address.toLowerCase()));

  const visibleGardeners = useMemo(() => {
    // Per handoff Garden chips (All / Operators / Reviewers / Gardeners / Pending):
    // Operators + Gardeners + All are wired against existing role data.
    // Reviewers + Pending are inert chips — no role data exists yet so they
    // collapse to an empty set on click, matching the audit's "stub the rest"
    // direction lock.
    if (filter === "operators") {
      return gardeners.filter((address) => operatorSet.has(address.toLowerCase()));
    }
    if (filter === "gardeners") {
      return gardeners.filter((address) => !operatorSet.has(address.toLowerCase()));
    }
    if (filter === "reviewers" || filter === "pending") {
      return [];
    }
    return gardeners;
  }, [filter, gardeners, operatorSet]);

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
          const isOperator = operatorSet.has(address.toLowerCase());
          return (
            <li
              key={address}
              data-slot="member-row"
              data-role={isOperator ? "operator" : "gardener"}
              className="flex items-center justify-between gap-3 rounded-[var(--r-md,12px)] border border-stroke-soft bg-bg-white-0 px-3 py-2.5 shadow-[var(--edge-rest)]"
            >
              <AddressDisplay address={address} className="min-w-0 flex-1" />
              {isOperator ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-success-lighter px-2 py-0.5 text-label-sm font-medium text-success-dark"
                  aria-label={formatMessage({
                    id: "cockpit.garden.members.operatorBadge",
                    defaultMessage: "Operator",
                  })}
                >
                  {formatMessage({
                    id: "cockpit.garden.members.operatorBadge",
                    defaultMessage: "Operator",
                  })}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
