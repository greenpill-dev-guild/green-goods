import {
  cn,
  formatTokenAmount,
  parseGardenRange,
  type Address,
  useAdminStore,
  useGardenDerivedState,
  useGardenDetailData,
  useGardens,
} from "@green-goods/shared";
import { useCallback, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CockpitWorkspaceSelectionState } from "@/components/Layout/CockpitWorkspaceSelectionState";
import { PageHeader } from "@/components/Layout/PageHeader";
import { GardenSettingsEditor } from "@/components/Garden/GardenSettingsEditor";
import { GardenStatsGrid } from "@/components/Garden/GardenStatsGrid";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ImpactTab } from "@/views/Gardens/Garden/ImpactTab";
import { OverviewTab } from "@/views/Gardens/Garden/OverviewTab";
import "../Gardens/Garden/GardenDetailLayout.css";

type GardenWorkspaceView = "overview" | "impact" | "settings";

function parseGardenView(value: string | null): GardenWorkspaceView {
  if (value === "impact" || value === "settings") {
    return value;
  }
  return "overview";
}

export default function GardenView() {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: gardens = [] } = useGardens();
  const selectedGarden = useAdminStore((state) => state.selectedGarden);
  const setSelectedGarden = useAdminStore((state) => state.setSelectedGarden);
  const [activityFilter, setActivityFilter] = useState<"all" | "work" | "impact" | "community">(
    "all"
  );

  const view = parseGardenView(searchParams.get("view"));
  const range = parseGardenRange(searchParams.get("range"));
  const selectedItem = searchParams.get("item") ?? undefined;

  const {
    garden,
    fetching,
    error,
    canManage,
    canReview,
    isOwner,
    assessments,
    fetchingAssessments,
    assessmentsError,
    community,
    communityLoading,
    weightSchemeLabel,
    gardenVaults,
    vaultsLoading,
    vaultNetDeposited,
    vaultHarvestCount,
    vaultDepositorCount,
    allocations,
    works,
    hypercerts,
    roleMembers,
  } = useGardenDetailData(selectedGarden?.id);

  const updateSearch = useCallback(
    (
      updates: Partial<Record<"garden" | "view" | "range" | "item", string | undefined>>,
      replace = true
    ) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          for (const [key, value] of Object.entries(updates)) {
            if (!value) {
              next.delete(key);
            } else {
              next.set(key, value);
            }
          }
          return next;
        },
        { replace }
      );
    },
    [setSearchParams]
  );

  const openSection = useCallback(
    (
      tab: "overview" | "impact" | "work" | "community",
      section: string,
      itemId?: string
    ) => {
      if (!selectedGarden) return;

      if (tab === "work") {
        navigate(
          `/work?garden=${selectedGarden.id}&view=queue${itemId ? `&item=${itemId}` : ""}`
        );
        return;
      }

      if (tab === "community") {
        const card =
          section === "members"
            ? "members"
            : section === "yield"
              ? "yield"
              : section === "pools"
                ? "pools"
                : "treasury";
        navigate(
          `/community?garden=${selectedGarden.id}&card=${card}${itemId ? `&item=${itemId}` : ""}`
        );
        return;
      }

      updateSearch(
        {
          view: tab === "impact" ? "impact" : "overview",
          item: itemId,
        },
        false
      );
    },
    [navigate, selectedGarden, updateSearch]
  );

  const derived = useGardenDerivedState({
    garden: garden ?? { id: selectedGarden?.id ?? "", domainMask: 0, name: "", chainId: 0 },
    works,
    assessments,
    hypercerts,
    allocations,
    gardenVaults,
    vaultNetDeposited,
    roleMembers,
    selectedRange: range,
    activityFilter,
    memberSearch: "",
    section: undefined,
    formatMessage,
    openSection,
  });

  const cockpitActivityEvents = useMemo(() => {
    if (!selectedGarden) return derived.filteredActivityEvents;

    return derived.filteredActivityEvents.map((event) => {
      if (event.category === "work") {
        return {
          ...event,
          href: `/work?garden=${selectedGarden.id}&view=queue${
            event.itemId ? `&item=${event.itemId}` : ""
          }`,
        };
      }

      if (event.category === "impact") {
        return {
          ...event,
          href: `/garden?garden=${selectedGarden.id}&view=impact${
            event.itemId ? `&item=${event.itemId}` : ""
          }`,
        };
      }

      return {
        ...event,
        href: `/community?garden=${selectedGarden.id}&card=yield`,
      };
    });
  }, [derived.filteredActivityEvents, selectedGarden]);

  const renderContent = () => {
    if (!selectedGarden) {
      return (
        <CockpitWorkspaceSelectionState
          workspaceLabel={formatMessage({ id: "cockpit.nav.garden", defaultMessage: "Garden" })}
          gardens={gardens.map((gardenItem) => ({
            id: gardenItem.id,
            name: gardenItem.name,
            location: gardenItem.location,
          }))}
          onSelectGarden={(gardenItem) => {
            const fullGarden = gardens.find((entry) => entry.id === gardenItem.id);
            setSelectedGarden(fullGarden ?? null);
          }}
        />
      );
    }

    if (fetching) {
      return (
        <div className="mt-6 px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" role="status" aria-live="polite">
            <div className="h-40 rounded-lg skeleton-shimmer" />
            <div className="h-40 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.08s" }} />
            <div
              className="h-72 rounded-lg skeleton-shimmer lg:col-span-2"
              style={{ animationDelay: "0.16s" }}
            />
          </div>
        </div>
      );
    }

    if (!garden || error) {
      return (
        <div className="mt-6 px-4 sm:px-6">
          <Card role="alert">
            <Card.Body className="py-10 text-center">
              <h2 className="text-lg font-semibold text-text-strong">
                {formatMessage({
                  id: "cockpit.garden.loadFailed",
                  defaultMessage: "Unable to load this garden",
                })}
              </h2>
              <p className="mt-2 text-sm text-text-sub">
                {error?.message ??
                  formatMessage({
                    id: "cockpit.garden.loadFailedDescription",
                    defaultMessage: "Try choosing a different garden or refreshing the page.",
                  })}
              </p>
            </Card.Body>
          </Card>
        </div>
      );
    }

    return (
      <div className="mt-6 space-y-6 px-4 sm:px-6">
        <GardenStatsGrid
          gardenerCount={garden.gardeners.length}
          operatorCount={garden.operators.length}
          workCount={works.length}
          assessmentCount={assessments.length}
          hasVaults={derived.hasVaults}
          vaultNetDeposited={vaultNetDeposited}
          vaultHarvestCount={vaultHarvestCount}
          vaultDepositorCount={vaultDepositorCount}
          communityLoading={communityLoading || vaultsLoading}
          communityLabel={weightSchemeLabel}
        />

        {view === "overview" ? (
          <OverviewTab
            section={undefined}
            selectedItem={selectedItem}
            selectedRange={range}
            clearSection={() => updateSearch({ item: undefined }, false)}
            openSection={openSection}
            updateQueryState={(updates, replace) => {
              if (updates.tab) {
                openSection(updates.tab, updates.section ?? "", updates.item);
                return;
              }
              updateSearch(
                {
                  range: updates.range,
                  item: updates.item,
                },
                replace ?? true
              );
            }}
            setTab={(tab) => openSection(tab, tab === "community" ? "treasury" : "queue")}
            overviewAlerts={derived.overviewAlerts}
            gardenHealthLabel={derived.gardenHealthLabel}
            approvedInRangeCount={derived.approvedInRangeCount}
            impactVelocityDelta={derived.impactVelocityDelta}
            medianReviewAgeHours={derived.medianReviewAgeHours}
            activityFilter={activityFilter}
            setActivityFilter={setActivityFilter}
            filteredActivityEvents={cockpitActivityEvents}
            isLoading={fetching}
            pendingWorkCount={derived.pendingWorks.length}
            assessmentCount30d={assessments.length}
            gardenerCount={garden.gardeners.length}
            treasuryBalance={formatTokenAmount(vaultNetDeposited)}
          />
        ) : null}

        {view === "impact" ? (
          <ImpactTab
            garden={{ id: garden.id, chainId: garden.chainId }}
            gardenId={garden.id}
            canManage={canManage}
            canReview={canReview}
            section={undefined}
            selectedItem={selectedItem}
            clearSection={() => updateSearch({ item: undefined }, false)}
            openSection={openSection}
            assessments={assessments}
            fetchingAssessments={fetchingAssessments}
            assessmentsError={assessmentsError}
            hypercerts={hypercerts}
            hypercertsLoading={fetching}
            domainLabels={derived.domainLabels}
            approvedInLastThirtyDays={derived.approvedInLastThirtyDays}
          />
        ) : null}

        {view === "settings" ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
            <GardenSettingsEditor
              gardenAddress={garden.id as Address}
              garden={{
                name: garden.name,
                description: garden.description,
                location: garden.location,
                bannerImage: garden.bannerImage,
                openJoining: garden.openJoining,
                maxGardeners: garden.maxGardeners,
              }}
              canManage={canManage}
              isOwner={isOwner}
            />

            <div className="space-y-4">
              <Alert variant="info">
                {formatMessage({
                  id: "cockpit.garden.settingsHint",
                  defaultMessage:
                    "Profile, joining rules, and membership limits now live in the cockpit garden workspace.",
                })}
              </Alert>

              <Card>
                <Card.Header>
                  <h3 className="label-md text-text-strong">
                    {formatMessage({
                      id: "cockpit.garden.contextCard",
                      defaultMessage: "Garden context",
                    })}
                  </h3>
                </Card.Header>
                <Card.Body className="space-y-2 text-sm text-text-sub">
                  <p>
                    <span className="font-medium text-text-strong">{garden.name}</span>
                  </p>
                  {garden.location ? <p>{garden.location}</p> : null}
                  {community ? (
                    <p>
                      {formatMessage({
                        id: "cockpit.garden.communityConnected",
                        defaultMessage: "Community connected",
                      })}
                    </p>
                  ) : null}
                </Card.Body>
              </Card>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="pb-6">
      <PageHeader
        title={formatMessage({ id: "cockpit.garden.title", defaultMessage: "Garden" })}
        description={formatMessage({
          id: "cockpit.garden.description",
          defaultMessage: "Manage your garden overview, impact metrics, and settings",
        })}
        metadata={selectedGarden?.name}
        sticky
        actions={
          selectedGarden && view === "impact" && canReview ? (
            <Button size="sm" asChild>
              <Link to={`/gardens/${selectedGarden.id}/assessments/create`}>
                {formatMessage({ id: "app.garden.admin.newAssessment" })}
              </Link>
            </Button>
          ) : undefined
        }
        toolbar={
          <div
            className="flex flex-wrap items-center gap-2"
            role="tablist"
            aria-label={formatMessage({
              id: "cockpit.garden.viewSwitcher",
              defaultMessage: "Garden views",
            })}
          >
            {(
              [
                {
                  id: "overview",
                  labelId: "cockpit.garden.overview",
                  defaultMessage: "Overview",
                },
                { id: "impact", labelId: "cockpit.garden.impact", defaultMessage: "Impact" },
                {
                  id: "settings",
                  labelId: "cockpit.garden.settings",
                  defaultMessage: "Settings",
                },
              ] as const
            ).map((option) => {
              const active = view === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => updateSearch({ view: option.id, item: undefined })}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary-alpha-16 text-primary-darker"
                      : "bg-bg-soft text-text-sub hover:bg-bg-weak"
                  )}
                >
                  {formatMessage({ id: option.labelId, defaultMessage: option.defaultMessage })}
                </button>
              );
            })}
          </div>
        }
      />

      {renderContent()}
    </div>
  );
}
