import {
  adminRoutes,
  Button,
  MetaStrip,
  useCanvasMobileChromeHidden,
  formatRelativeTime,
  type SortOption,
  useActions,
  useAdminStore,
  useCanvasPortal,
  useCanvasResponsiveFab,
  useCanvasSearchParams,
  useEligibleAdminGardens,
  useGardenDerivedState,
  useGardenDetailData,
  useGardenPermissions,
  useMediaQuery,
  useSheetOrchestrator,
} from "@green-goods/shared";
import { AdminTabRail } from "@/components/AdminTabRail";
import { AdminSearchToolbar } from "@/components/AdminSearchToolbar";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { RiRefreshLine } from "@remixicon/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { CanvasWorkspaceSelectionState, PageHeader } from "@/components/Layout";
import {
  HubAssessmentQueue,
  HubCertificationQueue,
  HubHistoryQueue,
  HubSheetDescriptor,
  HubWorkQueue,
} from "./components";
import {
  type HubPipelineStage,
  type SortDirection,
  type ActivityEvent,
  SUBMIT_WORK_CONTENT_ID,
  HUB_STAGE_RAIL_ID,
  resolvePipelineStageFromPath,
  parseSortDirection,
  toWorkDetailContentId,
  parseWorkDetailContentId,
  toCertificationContentId,
  parseCertificationContentId,
  toHistoryContentId,
  parseHistoryContentId,
  isRouteSheetContentId,
  getStageTitle,
  getStageDescription,
  getSearchPlaceholder,
  resolveOpenSectionRoute,
  buildHubFabConfig,
  PIPELINE_STAGE_CONFIG,
} from "./hub.utils";
import {
  filterPendingWorks,
  filterAssessmentQueue,
  filterCertificationQueue,
  filterHistoryEvents,
} from "./hub.filters";

export default function HubView() {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const location = useLocation();
  const { workId: routedWorkIdParam, assessmentId: routedAssessmentIdParam } = useParams<{
    workId?: string;
    assessmentId?: string;
  }>();
  const { searchParams, updateSearch } = useCanvasSearchParams();
  const { activeSheet, activeContentId, closeSheet, openSheet } = useSheetOrchestrator();
  const { portalTarget } = useCanvasPortal();
  const { eligibleGardens } = useEligibleAdminGardens();
  const selectedGarden = useAdminStore((state) => state.selectedGarden);
  const setSelectedGarden = useAdminStore((state) => state.setSelectedGarden);
  const gardenPermissions = useGardenPermissions();
  const [lastRefreshAt, setLastRefreshAt] = useState(() => Date.now());
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requestedStage = resolvePipelineStageFromPath(location.pathname);
  const sortDirection = parseSortDirection(searchParams.get("sort"));
  const legacyItemId = searchParams.get("item") ?? undefined;
  const isSubmitRoute = location.pathname.endsWith("/work/submit");
  const isDesktop = useMediaQuery("(min-width: 600px)");

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(searchTerm), 220);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchTerm]);

  const {
    garden,
    canManage,
    canReview,
    works,
    worksLoading,
    worksFetching,
    refreshWorks,
    assessments,
    fetchingAssessments,
    assessmentsError,
    error,
    hypercerts,
    hypercertsLoading,
    allocations,
    allocationsLoading,
    gardenVaults,
    vaultNetDeposited,
    roleMembers,
  } = useGardenDetailData(selectedGarden?.id);

  const canAssess = garden ? gardenPermissions.isEvaluatorOfGarden(garden) : false;
  const canCertify = canReview;
  const canBrowseHistory = canManage || canReview;

  const stageCounts: Record<HubPipelineStage, number | undefined> = useMemo(
    () => ({
      work: works.filter((w) => w.status === "pending").length,
      assess: works.filter((w) => w.status === "approved").length,
      certify: assessments.filter((a) => !hypercerts.some((h) => h.id === a.id)).length,
      history: undefined,
    }),
    [assessments, hypercerts, works]
  );

  const stageVisibility: Record<HubPipelineStage, boolean> = useMemo(
    () => ({
      work: canManage,
      assess: canAssess,
      certify: canCertify,
      history: canBrowseHistory,
    }),
    [canAssess, canBrowseHistory, canCertify, canManage]
  );

  const allStages = useMemo(
    () =>
      PIPELINE_STAGE_CONFIG.map((cfg) => ({
        ...cfg,
        count: stageCounts[cfg.id],
        visible: stageVisibility[cfg.id],
      })),
    [stageCounts, stageVisibility]
  );

  const stages = useMemo(() => allStages.filter((stage) => stage.visible), [allStages]);
  const fallbackStage = stages[0]?.id ?? "history";
  const stage = stages.some((option) => option.id === requestedStage)
    ? requestedStage
    : fallbackStage;

  useEffect(() => {
    if (!selectedGarden) return;
    if (requestedStage === stage) return;
    navigate(adminRoutes.hubMode(stage, { sort: sortDirection }), { replace: true });
  }, [navigate, requestedStage, selectedGarden, sortDirection, stage]);

  const openSection = useCallback(
    (tab: "overview" | "impact" | "work" | "community", section: string, itemId?: string) => {
      if (!selectedGarden) return;
      navigate(resolveOpenSectionRoute(tab, section, sortDirection, itemId));
    },
    [navigate, selectedGarden, sortDirection]
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
    selectedRange: "30d",
    activityFilter: "all",
    memberSearch: "",
    section: stage === "history" ? "decisions" : "work",
    formatMessage,
    openSection,
  });

  const { data: actions = [] } = useActions();
  const actionsMap = useMemo(
    () => new Map(actions.map((action) => [Number(action.id), { title: action.title }])),
    [actions]
  );

  useEffect(() => {
    if (!worksLoading && !fetchingAssessments && !hypercertsLoading) {
      setLastRefreshAt(Date.now());
    }
  }, [
    works.length,
    worksLoading,
    assessments.length,
    fetchingAssessments,
    hypercerts.length,
    hypercertsLoading,
  ]);

  const normalizedSearch = debouncedSearch.trim().toLowerCase();

  const pendingWorks = useMemo(
    () => filterPendingWorks(works, actionsMap, normalizedSearch, sortDirection),
    [actionsMap, normalizedSearch, sortDirection, works]
  );

  const assessmentQueue = useMemo(
    () => filterAssessmentQueue(works, actionsMap, normalizedSearch),
    [actionsMap, normalizedSearch, works]
  );

  const certificationQueue = useMemo(
    () => filterCertificationQueue(assessments, hypercerts, normalizedSearch),
    [assessments, hypercerts, normalizedSearch]
  );

  const historyEvents = useMemo(
    () => filterHistoryEvents(derived.activityEvents, normalizedSearch, sortDirection),
    [derived.activityEvents, normalizedSearch, sortDirection]
  );

  const historyEventMap = useMemo(
    () => new Map(historyEvents.map((event) => [event.id, event])),
    [historyEvents]
  );

  const legacyWorkId = useMemo(() => {
    if (!legacyItemId) return undefined;
    return works.some((work) => work.id === legacyItemId) ? legacyItemId : undefined;
  }, [legacyItemId, works]);

  const legacyCertificationId = useMemo(() => {
    if (!legacyItemId) return undefined;
    return certificationQueue.some((assessment) => assessment.id === legacyItemId)
      ? legacyItemId
      : undefined;
  }, [certificationQueue, legacyItemId]);

  const legacyHistoryEventId = useMemo(() => {
    if (!legacyItemId) return undefined;
    return historyEvents.some((event) => event.id === legacyItemId) ? legacyItemId : undefined;
  }, [historyEvents, legacyItemId]);

  const routeWorkId =
    routedWorkIdParam ??
    (stage === "work" || stage === "assess" || stage === "history" ? legacyWorkId : undefined);
  const routeCertificationId =
    routedAssessmentIdParam ?? (stage === "certify" ? legacyCertificationId : undefined);
  const activeWorkDetailId = parseWorkDetailContentId(activeContentId);
  const activeCertificationId = parseCertificationContentId(activeContentId);
  const activeHistoryId = parseHistoryContentId(activeContentId);

  const selectedWork = useMemo(() => {
    const resolvedId = routeWorkId ?? activeWorkDetailId;
    return resolvedId ? works.find((work) => work.id === resolvedId) : undefined;
  }, [activeWorkDetailId, routeWorkId, works]);

  const selectedCertification = useMemo(() => {
    const resolvedId = routeCertificationId ?? activeCertificationId;
    return resolvedId
      ? certificationQueue.find((assessment) => assessment.id === resolvedId)
      : undefined;
  }, [activeCertificationId, certificationQueue, routeCertificationId]);

  const selectedHistoryEvent = useMemo(() => {
    const resolvedId =
      stage === "history" && legacyHistoryEventId ? legacyHistoryEventId : activeHistoryId;
    return resolvedId ? historyEventMap.get(resolvedId) : undefined;
  }, [activeHistoryId, historyEventMap, legacyHistoryEventId, stage]);

  const hasOpenHubInspector = Boolean(
    routeWorkId ||
      routeCertificationId ||
      isSubmitRoute ||
      selectedWork ||
      selectedCertification ||
      selectedHistoryEvent
  );

  const routeSheetSide = isSubmitRoute || routeWorkId || routeCertificationId ? "left" : null;
  const routeSheetContentId = isSubmitRoute
    ? SUBMIT_WORK_CONTENT_ID
    : routeWorkId
      ? toWorkDetailContentId(routeWorkId)
      : routeCertificationId
        ? toCertificationContentId(routeCertificationId)
        : null;

  useEffect(() => {
    if (!routeSheetContentId || !routeSheetSide) {
      if (isRouteSheetContentId(activeContentId)) {
        closeSheet();
      }
      return;
    }

    if (activeSheet !== routeSheetSide || activeContentId !== routeSheetContentId) {
      openSheet(routeSheetSide, routeSheetContentId);
    }
  }, [activeContentId, activeSheet, closeSheet, openSheet, routeSheetContentId, routeSheetSide]);

  const hubContext = useMemo(
    () => ({
      sort: sortDirection,
      item: undefined,
    }),
    [sortDirection]
  );

  const navigateToHubBase = useCallback(() => {
    navigate(adminRoutes.hubMode(stage, hubContext));
  }, [hubContext, navigate, stage]);

  const handleCloseSheet = useCallback(() => {
    closeSheet();

    if (routeSheetContentId || legacyItemId) {
      navigateToHubBase();
    }
  }, [closeSheet, legacyItemId, navigateToHubBase, routeSheetContentId]);

  const handleOpenWorkDetail = useCallback(
    (workId: string) => {
      navigate(adminRoutes.hubWorkDetail(workId, hubContext));
    },
    [hubContext, navigate]
  );

  const handleOpenCertification = useCallback(
    (assessmentId: string) => {
      navigate(adminRoutes.hubCertifyDetail(assessmentId, hubContext));
    },
    [hubContext, navigate]
  );

  const handleOpenHistoryEvent = useCallback(
    (event: ActivityEvent) => {
      if (event.category === "work" && event.itemId) {
        openSheet("left", toWorkDetailContentId(event.itemId));
        return;
      }

      openSheet("left", toHistoryContentId(event.id));
    },
    [openSheet]
  );

  const handleRefresh = useCallback(() => {
    void refreshWorks().finally(() => setLastRefreshAt(Date.now()));
  }, [refreshWorks]);

  const navFabConfig = useMemo(
    () =>
      selectedGarden ? buildHubFabConfig(stage, canManage, canReview, navigate, hubContext) : null,
    [canManage, canReview, hubContext, navigate, selectedGarden, stage]
  );
  const mobileFabAction = useCanvasResponsiveFab({
    fab: navFabConfig,
    isDesktop,
    blocked: hasOpenHubInspector,
  });
  const hideMobileChrome = useCanvasMobileChromeHidden();

  const resultCount =
    stage === "work"
      ? pendingWorks.length
      : stage === "assess"
        ? assessmentQueue.length
        : stage === "certify"
          ? certificationQueue.length
          : historyEvents.length;

  const refreshAgoText = useMemo(() => formatRelativeTime(lastRefreshAt), [lastRefreshAt]);
  const hasDataError = Boolean(error || assessmentsError);

  const sortOptions = useMemo<SortOption<SortDirection>[]>(
    () => [
      {
        value: "newest",
        label: formatMessage({ id: "cockpit.hub.sort.newest", defaultMessage: "Newest" }),
      },
      {
        value: "oldest",
        label: formatMessage({ id: "cockpit.hub.sort.oldest", defaultMessage: "Oldest" }),
      },
    ],
    [formatMessage]
  );

  const stageTitle = getStageTitle(stage, formatMessage);
  const headerDescription = getStageDescription(stage, selectedGarden?.name, formatMessage);
  const searchPlaceholder = getSearchPlaceholder(stage, formatMessage);

  // Sheet content resolved by HubSheetDescriptor (rendered in JSX below)

  const handleClearSearch = useCallback(() => {
    setSearchTerm("");
    setDebouncedSearch("");
  }, []);

  const primaryContent =
    stage === "work" ? (
      <HubWorkQueue
        items={pendingWorks}
        worksLoading={worksLoading}
        hasDataError={hasDataError}
        normalizedSearch={normalizedSearch}
        debouncedSearch={debouncedSearch}
        actionsMap={actionsMap}
        selectedGardenName={selectedGarden?.name}
        selectedWorkId={selectedWork?.id}
        onOpenWorkDetail={handleOpenWorkDetail}
        onClearSearch={handleClearSearch}
      />
    ) : stage === "assess" ? (
      <HubAssessmentQueue
        items={assessmentQueue}
        worksLoading={worksLoading}
        hasDataError={hasDataError}
        actionsMap={actionsMap}
        selectedGardenName={selectedGarden?.name}
        selectedWorkId={selectedWork?.id}
        onOpenWorkDetail={handleOpenWorkDetail}
      />
    ) : stage === "certify" ? (
      <HubCertificationQueue
        items={certificationQueue}
        fetchingAssessments={fetchingAssessments}
        hypercertsLoading={hypercertsLoading}
        hasDataError={hasDataError}
        canManage={canManage}
        selectedCertificationId={selectedCertification?.id}
        onOpenCertification={handleOpenCertification}
      />
    ) : (
      <HubHistoryQueue
        items={historyEvents}
        worksLoading={worksLoading}
        fetchingAssessments={fetchingAssessments}
        hypercertsLoading={hypercertsLoading}
        allocationsLoading={allocationsLoading}
        hasDataError={hasDataError}
        selectedHistoryEventId={selectedHistoryEvent?.id}
        selectedWorkItemId={selectedWork?.id}
        onOpenHistoryEvent={handleOpenHistoryEvent}
      />
    );

  return (
    <div className="hub-route-shell">
      <HubSheetDescriptor
        routeSheetContentId={routeSheetContentId}
        routeWorkId={routeWorkId}
        activeWorkDetailId={activeWorkDetailId}
        selectedWork={selectedWork}
        selectedCertification={selectedCertification}
        selectedHistoryEvent={selectedHistoryEvent}
        canManage={canManage}
        onNavigateToBase={navigateToHubBase}
        onClose={handleCloseSheet}
      />
      {!selectedGarden && !routeWorkId && !isSubmitRoute ? (
        <CanvasWorkspaceSelectionState
          workspaceLabel={formatMessage({ id: "cockpit.nav.hub", defaultMessage: "Hub" })}
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
      ) : (
        <div
          className="hub-route-stack"
          role="tabpanel"
          id={`${HUB_STAGE_RAIL_ID}-panel`}
          aria-labelledby={`${HUB_STAGE_RAIL_ID}-tab-${stage}`}
        >
          <div className="hub-route-content mx-auto flex w-full max-w-[1400px] flex-col gap-3 sm:gap-4">
            <PageHeader
              title={stageTitle}
              description={headerDescription}
              variant="canvas"
              metadata={
                selectedGarden ? (
                  <MetaStrip items={[{ id: "garden", label: selectedGarden.name }]} />
                ) : undefined
              }
              toolbar={
                <div className="hub-toolbar-shell">
                  <AdminSearchToolbar
                    search={searchTerm}
                    onSearchChange={setSearchTerm}
                    placeholder={searchPlaceholder}
                  >
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleRefresh}
                      title={`Last refreshed: ${refreshAgoText}`}
                      aria-label={formatMessage({
                        id: "app.common.refresh",
                        defaultMessage: "Refresh",
                      })}
                      className={
                        worksFetching
                          ? "hub-refresh-button [&>svg]:animate-spin"
                          : "hub-refresh-button"
                      }
                    >
                      <RiRefreshLine className="h-4 w-4" />
                    </Button>
                    {(stage === "work" || stage === "history") &&
                      sortOptions.map((option) => (
                        <AdminFilterChip
                          key={option.value}
                          label={option.label}
                          selected={sortDirection === option.value}
                          onToggle={() => updateSearch({ sort: option.value }, false)}
                        />
                      ))}
                  </AdminSearchToolbar>
                </div>
              }
            >
              <AdminTabRail
                idBase={HUB_STAGE_RAIL_ID}
                tabs={stages.map((s) => ({
                  id: s.id,
                  label: formatMessage({ id: s.labelId, defaultMessage: s.defaultMessage }),
                  icon: s.icon,
                  count: s.count,
                }))}
                activeId={stage}
                ariaLabel={formatMessage({
                  id: "cockpit.hub.tabRail",
                  defaultMessage: "Hub pipeline stages",
                })}
                onChange={(nextStage) => {
                  closeSheet();
                  navigate(
                    adminRoutes.hubMode(nextStage as HubPipelineStage, {
                      sort:
                        nextStage === "work" || nextStage === "history" ? sortDirection : undefined,
                    })
                  );
                }}
              />
            </PageHeader>
          </div>

          <div className="hub-route-content mx-auto flex w-full max-w-[1400px] flex-col gap-3 sm:gap-4">
            <section className="hub-results-shell surface-section" aria-label={stageTitle}>
              <div aria-live="polite" className="sr-only">
                {debouncedSearch &&
                  formatMessage(
                    {
                      id: "cockpit.hub.resultsCount",
                      defaultMessage:
                        "{count, plural, one {# submission found} other {# submissions found}}",
                    },
                    { count: resultCount }
                  )}
              </div>

              <div
                key={stage}
                className="hub-results-pane animate-[hub-fade-in_150ms_ease_both] motion-reduce:animate-none"
              >
                {primaryContent}
              </div>
            </section>

            {!hideMobileChrome && mobileFabAction && (
              <div className="pointer-events-none sticky bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-[7] flex justify-end px-3 pb-2 pt-1 min-[600px]:hidden">
                <div className="pointer-events-auto ml-auto w-auto max-w-full">
                  <Button
                    onClick={mobileFabAction.onClick}
                    size="lg"
                    className="min-h-12 min-w-[10rem] max-w-[min(15rem,calc(100vw-1.5rem))] justify-center rounded-full px-4.5 shadow-[0_14px_30px_rgba(38,28,18,0.14)] transition-[transform,box-shadow] duration-200 ease-out motion-reduce:transition-none active:translate-y-px active:shadow-[0_8px_18px_rgba(38,28,18,0.16)]"
                  >
                    <mobileFabAction.icon className="h-5 w-5" />
                    {mobileFabAction.label}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
