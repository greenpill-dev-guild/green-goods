import { useRefreshAction } from "../../../components/Canvas/RefreshActionContext";
import { useViewActions } from "../../../components/Canvas/useViewActions";
import type { SortOption } from "../../../components/ListPrimitives";
import { useGardenStateStore } from "../../../stores/useGardenStateStore";
import { type AdminHubRouteContext, adminRoutes } from "../../../utils/navigation/admin-routes";
import { useActions } from "../../blockchain/useBaseLists";
import { useAdminGardenWorkspaceSelection } from "../../garden/useAdminGardenWorkspaceSelection";
import { useGardenDerivedState } from "../../garden/useGardenDerivedState";
import { useGardenDetailData } from "../../garden/useGardenDetailData";
import { useGardenPermissions } from "../../garden/useGardenPermissions";
import { useCanvasSearchParams } from "../../navigation/useCanvasSearchParams";
import { useSheetOrchestrator } from "../../navigation/useSheetOrchestrator";
import { useMediaQuery } from "../../ui/useMediaQuery";
import { useDebouncedValue } from "../../utils/useDebouncedValue";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useLocalizedRelativeTime } from "../../app/useLocalizedRelativeTime";
import {
  buildHubViewActions,
  getSearchPlaceholder,
  getStageDescription,
  getStageTitle,
  type HubPipelineStage,
  isRouteSheetContentId,
  resolveOpenSectionRoute,
  type SortDirection,
} from "./hub.utils";
import {
  buildActionTitleMap,
  buildHubStageModel,
  buildHubWorkspaceState,
  getHubResultCount,
  normalizeHubSearch,
  resolveHubRouteSelection,
  resolveHubRouteState,
} from "./hub.workbenchModel";
import { useHubConfirmStage } from "./useHubConfirmStage";
import { useHubStageQueues } from "./useHubStageQueues";

export function useHubWorkbenchController() {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    workId: routedWorkIdParam,
    assessmentId: routedAssessmentIdParam,
    commitmentId: routeCommitmentId,
  } = useParams<{
    workId?: string;
    assessmentId?: string;
    commitmentId?: string;
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
    routeSheetContentId,
    routeSheetSide,
    routeWorkId,
    sortDirection,
  } = resolveHubRouteState({
    pathname: location.pathname,
    sortParam: searchParams.get("sort"),
    routedWorkIdParam,
    routedAssessmentIdParam,
    activeContentId,
  });
  const isDesktop = useMediaQuery("(min-width: 600px)");
  const selectedGardenId = selectedGarden?.id;
  const hubContext = useMemo<AdminHubRouteContext>(
    () => ({
      gardenId: selectedGardenId,
      sort: sortDirection,
    }),
    [selectedGardenId, sortDirection]
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

  const { chainId, viewer, toConfirm, handleOpenCommitment, handleCloseCommitment } =
    useHubConfirmStage({ navigate, hubContext });

  const { stage, stages, stageCounts } = useMemo(
    () =>
      buildHubStageModel({
        requestedStage,
        canManage,
        canAssess,
        canCertify,
        canConfirm: toConfirm.isSteward,
        confirmCount: toConfirm.count,
        works,
        assessments,
        hypercerts,
      }),
    [
      assessments,
      canAssess,
      canCertify,
      canManage,
      hypercerts,
      requestedStage,
      toConfirm.count,
      toConfirm.isSteward,
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
    section: "work",
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

  const { pendingWorks, assessmentQueue, certificationQueue, selectedWork, selectedCertification } =
    useHubStageQueues({
      works,
      actionsMap,
      normalizedSearch,
      sortDirection,
      assessments,
      hypercerts,
      routeWorkId,
      activeWorkDetailId,
      routeCertificationId,
      activeCertificationId,
    });
  const { hasOpenHubInspector, persistedSelectedItem } = resolveHubRouteSelection({
    routeWorkId,
    routeCertificationId,
    activeWorkDetailId,
    activeCertificationId,
    isSubmitRoute,
    selectedWork,
    selectedCertification,
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

  const handleRefresh = useCallback(() => {
    void Promise.resolve(refreshWorks()).finally(() => setLastRefreshAt(Date.now()));
  }, [refreshWorks]);

  const viewActions = useMemo(
    () =>
      selectedGardenId
        ? buildHubViewActions(stage, canManage, canReview, navigate, hubContext)
        : [],
    [canManage, canReview, hubContext, navigate, selectedGardenId, stage]
  );

  const { desktopActions } = useViewActions({
    actions: viewActions,
    isDesktop,
    blocked: hasOpenHubInspector,
  });

  // Mobile/tablet: refresh icon in the AppBar (next to notifications). Desktop
  // keeps refresh implicit — the action set in the page header is the only
  // chrome the steward needs.
  const mobileRefreshAction = useMemo(
    () =>
      selectedGardenId && !isDesktop
        ? { onRefresh: handleRefresh, isFetching: worksFetching }
        : null,
    [handleRefresh, isDesktop, selectedGardenId, worksFetching]
  );
  useRefreshAction(mobileRefreshAction);

  const resultCount = getHubResultCount(stage, {
    pendingWorks: pendingWorks.length,
    assessmentQueue: assessmentQueue.length,
    certificationQueue: certificationQueue.length,
    confirmQueue: toConfirm.count,
  });

  const formatEventAge = useLocalizedRelativeTime();
  const refreshAgoText = useMemo(
    () => formatEventAge(lastRefreshAt),
    [formatEventAge, lastRefreshAt]
  );
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
          gardenId: hubContext.gardenId,
          sort: nextStage === "work" ? sortDirection : undefined,
        })
      );
    },
    [closeSheet, hubContext.gardenId, navigate, sortDirection]
  );

  return {
    actionsMap,
    activeWorkDetailId,
    allocationsLoading,
    assessmentQueue,
    canManage,
    certificationQueue,
    chainId,
    toConfirm,
    viewer,
    debouncedSearch,
    desktopActions,
    fetchingAssessments,
    gardenOptions,
    handleClearSearch,
    handleCloseCommitment,
    handleCloseSheet,
    handleOpenCertification,
    handleOpenCommitment,
    handleOpenWorkDetail,
    handleRefresh,
    handleSelectGarden,
    handleStageChange,
    hasDataError,
    headerDescription,
    hubContext,
    hypercertsLoading,
    isSubmitRoute,
    normalizedSearch,
    pendingCriticalCount: derived.pendingCriticalCount,
    pendingWarningCount: derived.pendingWarningCount,
    pendingWorks,
    refreshAgoText,
    resultCount,
    routeSheetContentId,
    routeSheetCloseTo,
    routeCertificationId,
    routeCommitmentId,
    routeWorkId,
    searchPlaceholder,
    searchTerm,
    selectedCertification,
    selectedGarden,
    selectedWork,
    setSearchTerm: handleSearchTermChange,
    sortDirection,
    sortOptions,
    stage,
    stageCounts,
    stageTitle,
    stages,
    updateSearch,
    worksFetching,
    worksLoading,
    navigateToHubBase,
  };
}
