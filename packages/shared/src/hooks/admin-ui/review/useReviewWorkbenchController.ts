import { useViewActions } from "../../../components/Canvas/useViewActions";
import { useGardenStateStore } from "../../../stores/useGardenStateStore";
import type { Address } from "../../../types/domain";
import {
  type AdminReviewRouteContext,
  adminRoutes,
  parseReviewFlowItem,
} from "../../../utils/navigation/admin-routes";
import { useActions } from "../../blockchain/useBaseLists";
import { useAdminGardenWorkspaceSelection } from "../../garden/useAdminGardenWorkspaceSelection";
import { useGardenDerivedState } from "../../garden/useGardenDerivedState";
import { useGardenDetailData } from "../../garden/useGardenDetailData";
import { useCanvasSearchParams } from "../../navigation/useCanvasSearchParams";
import { useSheetOrchestrator } from "../../navigation/useSheetOrchestrator";
import { useMediaQuery } from "../../ui/useMediaQuery";
import { useDebouncedValue } from "../../utils/useDebouncedValue";
import { useReviewBatch } from "../../work/useReviewBatch";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useLocalizedRelativeTime } from "../../app/useLocalizedRelativeTime";
import {
  buildReviewViewActions,
  buildSortOptions,
  getSearchPlaceholder,
  getStageTitle,
  type ReviewPipelineStage,
  isRouteSheetContentId,
  resolveOpenSectionRoute,
} from "./review.utils";
import {
  buildActionTitleMap,
  buildReviewStageModel,
  buildReviewWorkspaceState,
  getReviewResultCount,
  hasReviewStageDataError,
  normalizeReviewSearch,
  resolveReviewRouteSelection,
  resolveReviewRouteState,
} from "./review.workbenchModel";
import { useReviewConfirmStage } from "./useReviewConfirmStage";
import { useReviewOlderRecords } from "./useReviewOlderRecords";
import { useReviewStageQueues } from "./useReviewStageQueues";
import { useReviewStageRefresh } from "./useReviewStageRefresh";
import { useReviewWaitingBands } from "./useReviewWaitingBands";
import { useReviewWorkDay } from "./useReviewWorkDay";

export function useReviewWorkbenchController() {
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
  // A create flow open over the stage, named in the URL (DL-140).
  const routeItem = parseReviewFlowItem(searchParams.get("item"));
  const { activeSheet, activeContentId, closeSheet, openSheet } = useSheetOrchestrator();
  const { selectedGarden, gardenOptions, handleSelectGarden } = useAdminGardenWorkspaceSelection();
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
    workDay,
    workScope,
    waitingBand,
  } = resolveReviewRouteState({
    pathname: location.pathname,
    sortParam: searchParams.get("sort"),
    scopeParam: searchParams.get("scope"),
    dayParam: searchParams.get("day"),
    waitingParam: searchParams.get("waiting"),
    routedWorkIdParam,
    routedAssessmentIdParam,
    activeContentId,
  });
  const isDesktop = useMediaQuery("(min-width: 600px)");
  const selectedGardenId = selectedGarden?.id;
  const reviewContext = useMemo<AdminReviewRouteContext>(
    () => ({
      gardenId: selectedGardenId,
      sort: sortDirection,
      // Carried so a work opened from a scope or a day's list closes back onto it. The route
      // writes a scope only where it is not the default.
      scope: workScope,
      day: workDay ?? undefined,
      waiting: waitingBand ?? undefined,
    }),
    [selectedGardenId, sortDirection, waitingBand, workDay, workScope]
  );
  const dayView = useReviewWorkDay({
    gardenId: selectedGardenId as Address | undefined,
    day: workDay,
    workScope,
    updateSearch,
  });

  useEffect(() => {
    if (lastHydratedGardenStateKeyRef.current === gardenStateKey) return;

    const persistedState = getGardenWorkspaceState(gardenStateKey, "review");
    setSearchTerm(persistedState.search);
    lastHydratedGardenStateKeyRef.current = gardenStateKey;
  }, [gardenStateKey, getGardenWorkspaceState]);

  const {
    garden,
    canManage,
    canReview,
    works,
    worksComplete,
    gardenReviewQueue,
    worksLoading,
    worksFetching,
    worksError,
    isWorksPaused,
    refreshWorks,
    workPages,
    assessments,
    fetchingAssessments,
    assessmentsFetching,
    assessmentsError,
    refreshAssessments,
    error,
    hypercerts,
    hypercertsLoading,
    hypercertsFetching,
    hypercertsError,
    refreshHypercerts,
    hypercertPages,
    refreshGardens,
    gardensFetching,
    allocations,
    allocationsLoading,
    gardenVaults,
    hasEndowment,
    roleMembers,
  } = useGardenDetailData(selectedGarden?.id);

  const { chainId, viewer, toConfirm, handleOpenCommitment, handleCloseCommitment } =
    useReviewConfirmStage({
      navigate,
      reviewContext,
      garden: (selectedGarden?.id as Address | undefined) ?? null,
      canManage,
      active: requestedStage === "confirm",
    });

  const { stage, stages, stageCounts } = useMemo(
    () =>
      buildReviewStageModel({
        requestedStage,
        canManage,
        canReview,
        canConfirm: toConfirm.isSteward,
        confirmCount: toConfirm.count,
        works,
      }),
    [canManage, canReview, requestedStage, toConfirm.count, toConfirm.isSteward, works]
  );

  useEffect(() => {
    if (!selectedGarden) return;
    if (requestedStage === stage) return;
    navigate(adminRoutes.reviewMode(stage, { ...reviewContext, item: routeItem }), {
      replace: true,
    });
  }, [reviewContext, navigate, requestedStage, routeItem, selectedGarden, stage]);

  const openSection = useCallback(
    (tab: "overview" | "impact" | "work" | "community", section: string, itemId?: string) => {
      if (!selectedGarden) return;
      navigate(resolveOpenSectionRoute(tab, section, sortDirection, itemId, reviewContext));
    },
    [reviewContext, navigate, selectedGarden, sortDirection]
  );

  const derived = useGardenDerivedState({
    garden: garden ?? { id: selectedGarden?.id ?? "", domainMask: 0, name: "", chainId: 0 },
    works,
    worksComplete,
    gardenReviewQueue,
    assessments,
    hypercerts,
    allocations,
    gardenVaults,
    hasEndowment,
    roleMembers,
    selectedRange: "30d",
    activityFilter: "all",
    section: "work",
    formatMessage,
    openSection,
  });

  const waitingView = useReviewWaitingBands({
    works,
    workScope,
    workDay,
    waitingBand,
    reviewQueue: derived.reviewQueue,
    updateSearch,
  });
  const older = useReviewOlderRecords({
    garden: selectedGardenId,
    stage,
    // A waiting-time band reads older pages until its oldest work is in.
    readsAllWork: sortDirection === "oldest" || waitingView.needsOlderWork,
    workPages,
    hypercertPages,
    // A day's list is read on its own, so its sort never pages the garden's whole history.
    workReadable: !worksError && !isWorksPaused && !workDay,
  });

  const { data: actions = [] } = useActions();
  const actionsMap = useMemo(() => buildActionTitleMap(actions), [actions]);
  // Up here, not on the Work tab, so a send in flight outlives a change of tab.
  const reviewBatch = useReviewBatch(selectedGarden?.id ?? "", { works });

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

  const normalizedSearch = normalizeReviewSearch(debouncedSearch);

  const { scopedWorks, assessmentList, hypercertList, selectedWork, selectedCertification } =
    useReviewStageQueues({
      works: workDay ? dayView.workDayWorks : waitingView.bandWorks,
      selectableWorks: workDay ? dayView.workDayWorks : works,
      unknownIds: workDay ? dayView.workDayUnknownIds : undefined,
      workScope,
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
  const { hasOpenReviewInspector, persistedSelectedItem } = resolveReviewRouteSelection({
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
      "review",
      buildReviewWorkspaceState({
        stage,
        sortDirection,
        searchTerm,
        persistedSelectedItem,
        hasOpenReviewInspector,
      })
    );
  }, [
    gardenStateKey,
    hasOpenReviewInspector,
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

  const navigateToReviewBase = useCallback(() => {
    navigate(adminRoutes.reviewMode(stage, reviewContext));
  }, [reviewContext, navigate, stage]);

  const routeSheetCloseTo = useMemo(
    () => adminRoutes.reviewMode(stage, reviewContext),
    [reviewContext, stage]
  );

  const handleCloseSheet = useCallback(() => {
    closeSheet();
  }, [closeSheet]);

  const handleOpenWorkDetail = useCallback(
    (workId: string) => {
      navigate(adminRoutes.reviewWorkDetail(workId, reviewContext));
    },
    [reviewContext, navigate]
  );

  const handleOpenCertification = useCallback(
    (assessmentId: string) => {
      navigate(adminRoutes.reviewAssessDetail(assessmentId, reviewContext));
    },
    [reviewContext, navigate]
  );

  // A hypercert's record lives on Garden → Impact, where Create Hypercert
  // already lands after a mint.
  const handleOpenHypercert = useCallback(
    (hypercertId: string) => {
      navigate(adminRoutes.gardenHypercertDetail(hypercertId, { gardenId: selectedGardenId }));
    },
    [navigate, selectedGardenId]
  );

  const viewActions = useMemo(
    () =>
      selectedGardenId
        ? buildReviewViewActions(stage, canManage, canReview, navigate, reviewContext)
        : [],
    [canManage, canReview, reviewContext, navigate, selectedGardenId, stage]
  );

  const { desktopActions } = useViewActions({
    actions: viewActions,
    isDesktop,
    blocked: hasOpenReviewInspector,
  });

  // The AppBar shows this refresh on phones and tablets; desktop keeps none.
  const markRefreshed = useCallback(() => setLastRefreshAt(Date.now()), []);
  const handleRefresh = useReviewStageRefresh({
    stage,
    enabled: Boolean(selectedGardenId),
    reads: {
      // A day's list is its own read, so refreshing the day reads that day again.
      work: workDay
        ? { refresh: dayView.refreshWorkDay, isFetching: dayView.workDayFetching }
        : { refresh: refreshWorks, isFetching: worksFetching },
      assess: { refresh: refreshAssessments, isFetching: assessmentsFetching },
      certify: { refresh: refreshHypercerts, isFetching: hypercertsFetching },
      confirm: { refresh: toConfirm.refetch, isFetching: toConfirm.isFetching ?? false },
    },
    failedShared: error ? { refresh: refreshGardens, isFetching: gardensFetching } : undefined,
    onRefreshed: markRefreshed,
  });

  const resultCount = getReviewResultCount(stage, {
    works: scopedWorks.length,
    assessments: assessmentList.length,
    hypercerts: hypercertList.length,
    confirmQueue: toConfirm.count,
  });

  const formatEventAge = useLocalizedRelativeTime();
  const refreshAgoText = useMemo(
    () => formatEventAge(lastRefreshAt),
    [formatEventAge, lastRefreshAt]
  );
  const hasDataError = hasReviewStageDataError(stage, {
    gardenError: error,
    worksError,
    assessmentsError,
    assessmentCount: assessments.length,
    hypercertsError,
    hypercertCount: hypercerts.length,
  });

  const sortOptions = useMemo(() => buildSortOptions(formatMessage), [formatMessage]);

  const stageTitle = getStageTitle(stage, formatMessage);
  const searchPlaceholder = getSearchPlaceholder(stage, formatMessage);

  const handleClearSearch = useCallback(() => {
    setSearchTerm("");
    setGardenWorkspaceState(gardenStateKey, "review", { search: "" });
  }, [gardenStateKey, setGardenWorkspaceState]);

  const handleSearchTermChange = useCallback(
    (nextSearchTerm: string) => {
      setSearchTerm(nextSearchTerm);
      setGardenWorkspaceState(gardenStateKey, "review", { search: nextSearchTerm });
    },
    [gardenStateKey, setGardenWorkspaceState]
  );

  const handleStageChange = useCallback(
    (nextStage: string) => {
      closeSheet();
      navigate(
        adminRoutes.reviewMode(nextStage as ReviewPipelineStage, {
          gardenId: reviewContext.gardenId,
          sort: nextStage === "work" ? sortDirection : undefined,
        })
      );
    },
    [closeSheet, reviewContext.gardenId, navigate, sortDirection]
  );

  return {
    ...older,
    ...dayView,
    ...waitingView,
    actionsMap,
    activeWorkDetailId,
    allocationsLoading,
    assessmentList,
    canManage,
    canReview,
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
    handleOpenHypercert,
    handleOpenWorkDetail,
    handleRefresh,
    handleSelectGarden,
    handleStageChange,
    hasDataError,
    reviewContext,
    hypercertList,
    hypercertsLoading,
    isSubmitRoute,
    normalizedSearch,
    waitingOverWeekCount: derived.reviewQueue.waitingOverWeekCount,
    refreshAgoText,
    resultCount,
    reviewBatch,
    routeSheetContentId,
    routeSheetCloseTo,
    routeCertificationId,
    routeCommitmentId,
    routeItem,
    routeWorkId,
    scopedWorks,
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
    workScope,
    worksFetching,
    worksLoading,
    navigateToReviewBase,
  };
}
