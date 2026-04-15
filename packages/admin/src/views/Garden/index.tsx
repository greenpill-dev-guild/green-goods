import {
  type Address,
  Alert,
  BottomSheet,
  MetaStrip,
  Surface,
  formatTokenAmount,
  parseGardenRange,
  LeftSheet,
  adminRoutes,
  useAdminStore,
  useCanvasPortal,
  useCanvasSearchParams,
  useFabConfig,
  useGardenDerivedState,
  useGardenDetailData,
  useEligibleAdminGardens,
  useSheetWidth,
} from "@green-goods/shared";
import { AdminTabRail } from "@/components/AdminTabRail";
import { RiAddLine, RiSettings3Line } from "@remixicon/react";
import { useCallback, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { GardenSettingsEditor } from "@/components/Garden/GardenSettingsEditor";
import { CanvasWorkspaceSelectionState } from "@/components/Layout/CanvasWorkspaceSelectionState";
import { PageHeader } from "@/components/Layout/PageHeader";
import { ImpactTab } from "@/views/Garden/components/ImpactTab";
import { OverviewTab } from "@/views/Garden/components/OverviewTab";
import HypercertDetail from "@/views/Gardens/Garden/HypercertDetail";

// Paradigm: Mixed — overview = Data Landscape, impact = Data Landscape, settings = Command Surface.

type GardenWorkspaceView = "overview" | "impact" | "settings";

function resolveGardenView(pathname: string): GardenWorkspaceView {
  if (pathname.startsWith("/garden/impact")) return "impact";
  if (pathname.startsWith("/garden/settings")) return "settings";
  return "overview";
}

export default function GardenView() {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const location = useLocation();
  const { hypercertId } = useParams<{ hypercertId?: string }>();
  const { searchParams, updateSearch } = useCanvasSearchParams();
  const { portalTarget } = useCanvasPortal();
  const { eligibleGardens } = useEligibleAdminGardens();
  const selectedGarden = useAdminStore((state) => state.selectedGarden);
  const setSelectedGarden = useAdminStore((state) => state.setSelectedGarden);
  const { containerRef, isDesktop } = useSheetWidth();
  const [activityFilter, setActivityFilter] = useState<"all" | "work" | "impact" | "community">(
    "all"
  );

  const view = resolveGardenView(location.pathname);
  const range = parseGardenRange(searchParams.get("range"));
  const section = searchParams.get("section") ?? undefined;
  const selectedItem = searchParams.get("item") ?? undefined;
  const showHypercertSheet = view === "impact" && Boolean(hypercertId);

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
    gardenVaults,
    vaultNetDeposited,
    allocations,
    works,
    hypercerts,
    roleMembers,
  } = useGardenDetailData(selectedGarden?.id);

  // FAB: Garden management actions (operators only, hidden on settings tab)
  const gardenFabConfig = useMemo(() => {
    if (!selectedGarden || !canManage || view === "settings") return null;
    return {
      icon: RiAddLine,
      label: "Garden Actions",
      actions: [
        {
          id: "edit-garden",
          icon: RiSettings3Line,
          label: "Edit Garden",
          labelId: "cockpit.garden.fab.editGarden",
        },
      ],
      onAction: (actionId: string) => {
        if (actionId === "edit-garden") navigate(adminRoutes.gardenSettings());
      },
    };
  }, [selectedGarden, canManage, view, navigate]);
  useFabConfig(gardenFabConfig);

  const openSection = useCallback(
    (tab: "overview" | "impact" | "work" | "community", section: string, itemId?: string) => {
      if (!selectedGarden) return;

      if (tab === "work") {
        navigate(adminRoutes.hubWork({ item: itemId }));
        return;
      }

      if (tab === "community") {
        const destination =
          section === "members"
            ? adminRoutes.communityMembers({ item: itemId })
            : section === "cookie-jars" || section === "payouts"
              ? adminRoutes.communityPayouts({ item: itemId })
              : section === "pools" || section === "governance"
                ? adminRoutes.communityGovernance({ item: itemId })
                : adminRoutes.communityTreasury({ item: itemId });
        navigate(destination);
        return;
      }

      navigate(
        tab === "impact"
          ? adminRoutes.gardenImpact({ item: itemId, section })
          : adminRoutes.gardenOverview({ item: itemId, section })
      );
    },
    [navigate, section, selectedGarden]
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

  const canvasActivityEvents = useMemo(() => {
    if (!selectedGarden) return derived.filteredActivityEvents;

    return derived.filteredActivityEvents.map((event) => {
      if (event.category === "work") {
        return {
          ...event,
          href: adminRoutes.hubWork({ item: event.itemId }),
        };
      }

      if (event.category === "impact") {
        return {
          ...event,
          href: adminRoutes.gardenImpact({ item: event.itemId }),
        };
      }

      return {
        ...event,
        href: adminRoutes.communityTreasury(),
      };
    });
  }, [derived.filteredActivityEvents, selectedGarden]);

  const renderContent = () => {
    if (!selectedGarden) {
      return (
        <CanvasWorkspaceSelectionState
          workspaceLabel={formatMessage({ id: "cockpit.nav.garden", defaultMessage: "Garden" })}
          gardens={eligibleGardens.map((gardenItem) => ({
            id: gardenItem.id,
            name: gardenItem.name,
            location: gardenItem.location,
          }))}
          onSelectGarden={(gardenItem) => {
            const fullGarden = eligibleGardens.find((entry) => entry.id === gardenItem.id);
            setSelectedGarden(fullGarden ?? null);
          }}
        />
      );
    }

    if (fetching) {
      return (
        <div className="mt-6 px-4 sm:px-6">
          <div className="mx-auto w-full max-w-[1400px]">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" role="status" aria-live="polite">
              <div className="h-36 rounded-lg skeleton-shimmer" />
              <div
                className="h-36 rounded-lg skeleton-shimmer"
                style={{ animationDelay: "0.05s" }}
              />
              <div
                className="h-64 rounded-lg skeleton-shimmer sm:col-span-2"
                style={{ animationDelay: "0.1s" }}
              />
            </div>
          </div>
        </div>
      );
    }

    if (!garden || error) {
      return (
        <div className="mt-6 px-4 sm:px-6">
          <div className="mx-auto w-full max-w-[1400px]">
            <Alert variant="error">
              {error?.message ??
                formatMessage({
                  id: "cockpit.garden.loadFailedDescription",
                  defaultMessage: "Try choosing a different garden or refreshing the page.",
                })}
            </Alert>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-4 px-4 sm:px-6">
        <div className="mx-auto w-full max-w-[1400px]">
          <div className="canvas-route-shell overflow-hidden">
            {view === "overview" ? (
              <OverviewTab
                section={section}
                selectedItem={selectedItem}
                selectedRange={range}
                clearSection={() => updateSearch({ section: undefined, item: undefined }, false)}
                openSection={openSection}
                updateQueryState={(updates, replace) => {
                  if (updates.tab) {
                    openSection(updates.tab, updates.section ?? "", updates.item);
                    return;
                  }
                  updateSearch(
                    {
                      range: updates.range,
                      section: updates.section,
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
                filteredActivityEvents={canvasActivityEvents}
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
                section={section}
                selectedItem={selectedItem}
                clearSection={() => updateSearch({ section: undefined, item: undefined }, false)}
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
                        "Profile, joining rules, and membership limits now live in the canvas garden workspace.",
                    })}
                  </Alert>

                  <Surface
                    elevation="ground"
                    padding="default"
                    className="space-y-2 text-sm text-text-sub"
                  >
                    <h3 className="label-md text-text-strong">
                      {formatMessage({
                        id: "cockpit.garden.contextCard",
                        defaultMessage: "Garden context",
                      })}
                    </h3>
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
                  </Surface>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const handleCloseHypercertSheet = useCallback(() => {
    navigate(
      adminRoutes.gardenImpact({
        range,
        section: section ?? "hypercerts",
      })
    );
  }, [navigate, range, section]);

  return (
    <div ref={containerRef} className="pb-6">
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6">
        <PageHeader
          title={formatMessage({ id: "cockpit.garden.title", defaultMessage: "Garden" })}
          description={formatMessage({
            id: "cockpit.garden.description",
            defaultMessage: "Manage your garden overview, impact metrics, and settings",
          })}
          variant="canvas"
          metadata={
            selectedGarden ? (
              <MetaStrip items={[{ id: "garden", label: selectedGarden.name }]} />
            ) : undefined
          }
          sticky
        >
          <AdminTabRail
            ariaLabel={formatMessage({
              id: "cockpit.garden.viewSwitcher",
              defaultMessage: "Garden views",
            })}
            activeId={view}
            onChange={(nextView) =>
              navigate(
                nextView === "impact"
                  ? adminRoutes.gardenImpact({ range })
                  : nextView === "settings"
                    ? adminRoutes.gardenSettings()
                    : adminRoutes.gardenOverview({ range })
              )
            }
            tabs={[
              {
                id: "overview",
                label: formatMessage({
                  id: "cockpit.garden.overview",
                  defaultMessage: "Overview",
                }),
                count: derived.overviewAlerts.length || undefined,
              },
              {
                id: "impact",
                label: formatMessage({
                  id: "cockpit.garden.impact",
                  defaultMessage: "Impact",
                }),
                count: hypercerts.length || undefined,
              },
              {
                id: "settings",
                label: formatMessage({
                  id: "cockpit.garden.settings",
                  defaultMessage: "Settings",
                }),
              },
            ]}
          />
        </PageHeader>
      </div>

      {renderContent()}

      {showHypercertSheet ? (
        isDesktop ? (
          <LeftSheet
            open
            onClose={handleCloseHypercertSheet}
            title={formatMessage({ id: "app.hypercerts.detail.title" })}
            container={portalTarget}
          >
            <HypercertDetail layout="sheet" hypercertId={hypercertId} />
          </LeftSheet>
        ) : (
          <BottomSheet
            open
            onClose={handleCloseHypercertSheet}
            title={formatMessage({ id: "app.hypercerts.detail.title" })}
            maxHeight={92}
          >
            <HypercertDetail layout="sheet" hypercertId={hypercertId} />
          </BottomSheet>
        )
      ) : null}
    </div>
  );
}
