import {
  type AdminHubRouteContext,
  adminRoutes,
  formatRelativeTime,
  type SortOption,
  useActions,
  useAdminGardenWorkspaceSelection,
  useCanvasSearchParams,
  useDebouncedValue,
  useGardenDerivedState,
  useGardenDetailData,
  useGardenPermissions,
  useGardenStateStore,
  useMediaQuery,
  useRefreshAction,
  useSheetOrchestrator,
  useViewActions,
} from "@green-goods/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  type ActivityEvent,
  type HubPipelineStage,
  type SortDirection,
  buildHubViewActions,
  getSearchPlaceholder,
  getStageDescription,
  getStageTitle,
  isRouteSheetContentId,
  resolveOpenSectionRoute,
} from "./hub.utils";
import {
  filterAssessmentQueue,
  filterCertificationQueue,
  filterHistoryEvents,
  filterPendingWorks,
} from "./hub.filters";
import {
  buildActionTitleMap,
  buildHubStageModel,
  buildHubWorkspaceState,
  getHubResultCount,
  normalizeHubSearch,
  resolveHubRouteSelection,
  resolveHubRouteState,
} from "./hub.workbenchModel";

export function useHubWorkbenchController() {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    workId: routedWorkIdParam,
    assessmentId: routedAssessmentIdParam,
    historyEventId: routedHistoryEventIdParam,
  } = useParams<{
    workId?: string;
    assessmentId?: string;
    historyEventId?: string;
  }>();
  const { searchParams, updateSearch } = useCanvasSearchParams();
  const { activeSheet, activeContentId, closeSheet, openSheet } = useSheetOrchestrator();
  const { selectedGarden, gardenOptions, handleSelectGarden } = useAdminGardenWorkspaceSelection();
  const gardenPermissions = useGardenPermissions();
  const gardenStateKey = selectedGarden?.id ?? "";
  const getGardenWorkspaceState = useGardenStateStore((state) => state.getGardenWorkspaceState);
  const setGardenWorkspaceState = useGardenStateStore((state) => state.setGardenWorkspaceState);
  const lastHydratedGardenStateKeyRef = useRef<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState(() => Date.now());
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm, 220);
  const {
    activeCertificationId,
    activeWorkDetailId,
    isSubmitRoute,
    requestedStage,
    routeCertificationId,
    routeHistoryEventId,
    routeSheetContentId,
    routeSheetSide,
    routeWorkId,
    sortDirection,
  } = resolveHubRouteState({
    pathname: location.pathname,
    sortParam: searchParams.get("sort"),
    routedWorkIdParam,
    routedAssessmentIdParam,
    routedHistoryEventIdParam,
    activeContentId,
  });
  const isDesktop = useMediaQuery("(min-width: 600px)");
  const hubContext = useMemo<AdminHubRouteContext>(
    () => ({
      gardenAddress: selectedGarden?.tokenAddress ?? selectedGarden?.id,
      sort: sortDirection,
    }),
    [selectedGarden?.id, selectedGarden?.tokenAddress, sortDirection]
  );

  useEffect(() => {
    if (lastHydratedGardenStateKeyRef.current === gardenStateKey) return;

    const persistedState = getGardenWorkspaceState(gardenStateKey, "hub");
    setSearchTerm(persistedState.search);
    lastHydratedGardenStateKeyRef.current = gardenStateKey;
  }, [gardenStateKey, getGardenWorkspaceState]);

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

  const { stage, stages } = useMemo(
    () =>
      buildHubStageModel({
        requestedStage,
        canManage,
        canAssess,
        canCertify,
        canBrowseHistory,
        works,
        assessments,
        hypercerts,
      }),
    [
      assessments,
      canAssess,
      canBrowseHistory,
      canCertify,
      canManage,
      hypercerts,
      requestedStage,
      works,
    ]
  );

  useEffect(() => {
    if (!selectedGarden) return;
    if (requestedStage === stage) return;
    navigate(adminRoutes.hubMode(stage, hubContext), { replace: true });
  }, [hubContext, navigate, requestedStage, selectedGarden, stage]);

  const openSection = useCallback(
    (tab: "overview" | "impact" | "work" | "community", section: string, itemId?: string) => {
      if (!selectedGarden) return;
      navigate(resolveOpenSectionRoute(tab, section, sortDirection, itemId, hubContext));
    },
    [hubContext, navigate, selectedGarden, sortDirection]
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
  const actionsMap = useMemo(() => buildActionTitleMap(actions), [actions]);

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

  const normalizedSearch = normalizeHubSearch(debouncedSearch);

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
    return routeHistoryEventId ? historyEventMap.get(routeHistoryEventId) : undefined;
  }, [historyEventMap, routeHistoryEventId]);

  const { hasOpenHubInspector, persistedSelectedItem } = resolveHubRouteSelection({
    routeWorkId,
    routeCertificationId,
    routeHistoryEventId,
    activeWorkDetailId,
    activeCertificationId,
    isSubmitRoute,
    selectedWork,
    selectedCertification,
    selectedHistoryEvent,
  });

  useEffect(() => {
    if (!selectedGarden) return;

    setGardenWorkspaceState(
      gardenStateKey,
      "hub",
      buildHubWorkspaceState({
        stage,
        sortDirection,
        searchTerm,
        persistedSelectedItem,
        hasOpenHubInspector,
      })
    );
  }, [
    gardenStateKey,
    hasOpenHubInspector,
    persistedSelectedItem,
    searchTerm,
    selectedGarden,
    setGardenWorkspaceState,
    sortDirection,
    stage,
  ]);

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

  const navigateToHubBase = useCallback(() => {
    navigate(adminRoutes.hubMode(stage, hubContext));
  }, [hubContext, navigate, stage]);

  const routeSheetCloseTo = useMemo(
    () => adminRoutes.hubMode(stage, hubContext),
    [hubContext, stage]
  );

  const handleCloseSheet = useCallback(() => {
    closeSheet();
  }, [closeSheet]);

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
        navigate(adminRoutes.hubWorkDetail(event.itemId, hubContext));
        return;
      }

      navigate(adminRoutes.hubHistoryDetail(event.id, hubContext));
    },
    [hubContext, navigate]
  );

  useEffect(() => {
    if (!routedHistoryEventIdParam) return;
    if (worksLoading || fetchingAssessments || hypercertsLoading || allocationsLoading) return;
    if (selectedHistoryEvent) return;

    navigate(adminRoutes.hubHistory(hubContext), { replace: true });
  }, [
    allocationsLoading,
    fetchingAssessments,
    hubContext,
    hypercertsLoading,
    navigate,
    routedHistoryEventIdParam,
    selectedHistoryEvent,
    worksLoading,
  ]);

  const handleRefresh = useCallback(() => {
    void Promise.resolve(refreshWorks()).finally(() => setLastRefreshAt(Date.now()));
  }, [refreshWorks]);

  const viewActions = useMemo(
    () =>
      selectedGarden ? buildHubViewActions(stage, canManage, canReview, navigate, hubContext) : [],
    [canManage, canReview, hubContext, navigate, selectedGarden, stage]
  );

  const { desktopActions } = useViewActions({
    actions: viewActions,
    isDesktop,
    blocked: hasOpenHubInspector,
  });

  // Mobile/tablet: refresh icon in the AppBar (next to notifications). Desktop
  // keeps refresh implicit — the action set in the page header is the only
  // chrome the operator needs.
  useRefreshAction(
    selectedGarden && !isDesktop ? { onRefresh: handleRefresh, isFetching: worksFetching } : null
  );

  const resultCount = getHubResultCount(stage, {
    pendingWorks: pendingWorks.length,
    assessmentQueue: assessmentQueue.length,
    certificationQueue: certificationQueue.length,
    historyEvents: historyEvents.length,
  });

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
  const headerDescription = getStageDescription(stage, formatMessage);
  const searchPlaceholder = getSearchPlaceholder(stage, formatMessage);

  const handleClearSearch = useCallback(() => {
    setSearchTerm("");
    setGardenWorkspaceState(gardenStateKey, "hub", { search: "" });
  }, [gardenStateKey, setGardenWorkspaceState]);

  const handleSearchTermChange = useCallback(
    (nextSearchTerm: string) => {
      setSearchTerm(nextSearchTerm);
      setGardenWorkspaceState(gardenStateKey, "hub", { search: nextSearchTerm });
    },
    [gardenStateKey, setGardenWorkspaceState]
  );

  const handleStageChange = useCallback(
    (nextStage: string) => {
      closeSheet();
      navigate(
        adminRoutes.hubMode(nextStage as HubPipelineStage, {
          gardenAddress: hubContext.gardenAddress,
          sort: nextStage === "work" || nextStage === "history" ? sortDirection : undefined,
        })
      );
    },
    [closeSheet, hubContext.gardenAddress, navigate, sortDirection]
  );

  return {
    actionsMap,
    activeWorkDetailId,
    allocationsLoading,
    assessmentQueue,
    canManage,
    certificationQueue,
    debouncedSearch,
    desktopActions,
    fetchingAssessments,
    gardenOptions,
    handleClearSearch,
    handleCloseSheet,
    handleOpenCertification,
    handleOpenHistoryEvent,
    handleOpenWorkDetail,
    handleRefresh,
    handleSelectGarden,
    handleStageChange,
    hasDataError,
    headerDescription,
    historyEvents,
    hubContext,
    hypercertsLoading,
    isSubmitRoute,
    normalizedSearch,
    pendingWorks,
    refreshAgoText,
    resultCount,
    routeSheetContentId,
    routeSheetCloseTo,
    routeCertificationId,
    routeHistoryEventId,
    routeWorkId,
    searchPlaceholder,
    searchTerm,
    selectedCertification,
    selectedGarden,
    selectedHistoryEvent,
    selectedWork,
    setSearchTerm: handleSearchTermChange,
    sortDirection,
    sortOptions,
    stage,
    stageTitle,
    stages,
    updateSearch,
    worksFetching,
    worksLoading,
    navigateToHubBase,
  };
}
