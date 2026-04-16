import {
  Alert,
  adminRoutes,
  Button,
  EmptyStateShell,
  MetaStrip,
  useCanvasMobileChromeHidden,
  useLeftSheetConfig,
  WorkbenchList,
  WorkbenchRow,
  EmptyState,
  formatAddress,
  formatRelativeTime,
  resolveIPFSUrl,
  type SortOption,
  Surface,
  useActions,
  useAdminStore,
  useCanvasPortal,
  useCanvasResponsiveFab,
  useCanvasSearchParams,
  useEligibleAdminGardens,
  useGardenDerivedState,
  useGardenDetailData,
  useGardenPermissions,
  useSheetOrchestrator,
  type Work,
} from "@green-goods/shared";
import { AdminTabRail } from "@/components/AdminTabRail";
import { AdminSearchToolbar } from "@/components/AdminSearchToolbar";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import {
  RiAddLine,
  RiCheckboxCircleLine,
  RiCheckLine,
  RiExternalLinkLine,
  RiFileList3Line,
  RiInboxLine,
  RiMedalLine,
  RiRefreshLine,
  RiSearchLine,
} from "@remixicon/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { CanvasWorkspaceSelectionState, PageHeader } from "@/components/Layout";
import { SubmitWorkPanel } from "@/views/Gardens/Garden/SubmitWork";
import { WorkDetailPanel } from "@/views/Gardens/Garden/WorkDetail";

type HubPipelineStage = "work" | "assess" | "certify" | "history";
type SortDirection = "newest" | "oldest";

type ActivityEvent = ReturnType<typeof useGardenDerivedState>["activityEvents"][number];

const WORK_DETAIL_CONTENT_ID_PREFIX = "hub:work-detail:";
const CERTIFICATION_CONTENT_ID_PREFIX = "hub:certify:";
const HISTORY_CONTENT_ID_PREFIX = "hub:history:";
const SUBMIT_WORK_CONTENT_ID = "hub:submit-work";
const HUB_STAGE_RAIL_ID = "hub-stage";
const HUB_META_PILL_CLASSNAME =
  "inline-flex items-center rounded-full bg-bg-white/80 px-2.5 py-[0.34rem] text-[0.74rem] font-semibold text-text-sub shadow-[var(--edge-rest)]";
const HUB_CERTIFY_STATUS_CLASSNAME =
  "inline-flex items-center rounded-full bg-primary-alpha-10 px-2.5 py-1 text-[0.72rem] font-bold tracking-[0.01em] text-text-strong";
const HUB_HISTORY_STATUS_CLASSNAME =
  "inline-flex items-center rounded-full bg-bg-white/85 px-2.5 py-1 text-[0.72rem] font-bold tracking-[0.01em] text-text-sub shadow-[var(--edge-rest)]";

function resolvePipelineStageFromPath(pathname: string): HubPipelineStage {
  if (pathname.startsWith("/hub/assess")) return "assess";
  if (pathname.startsWith("/hub/certify")) return "certify";
  if (pathname.startsWith("/hub/history")) return "history";
  return "work";
}

function parseSortDirection(value: string | null): SortDirection {
  return value === "oldest" ? "oldest" : "newest";
}

function toWorkDetailContentId(workId: string) {
  return `${WORK_DETAIL_CONTENT_ID_PREFIX}${workId}`;
}

function parseWorkDetailContentId(contentId: string | null) {
  if (!contentId?.startsWith(WORK_DETAIL_CONTENT_ID_PREFIX)) return null;
  return contentId.slice(WORK_DETAIL_CONTENT_ID_PREFIX.length) || null;
}

function toCertificationContentId(assessmentId: string) {
  return `${CERTIFICATION_CONTENT_ID_PREFIX}${assessmentId}`;
}

function parseCertificationContentId(contentId: string | null) {
  if (!contentId?.startsWith(CERTIFICATION_CONTENT_ID_PREFIX)) return null;
  return contentId.slice(CERTIFICATION_CONTENT_ID_PREFIX.length) || null;
}

function toHistoryContentId(eventId: string) {
  return `${HISTORY_CONTENT_ID_PREFIX}${eventId}`;
}

function parseHistoryContentId(contentId: string | null) {
  if (!contentId?.startsWith(HISTORY_CONTENT_ID_PREFIX)) return null;
  return contentId.slice(HISTORY_CONTENT_ID_PREFIX.length) || null;
}

function isRouteSheetContentId(contentId: string | null) {
  return (
    contentId === SUBMIT_WORK_CONTENT_ID ||
    Boolean(parseWorkDetailContentId(contentId)) ||
    Boolean(parseCertificationContentId(contentId))
  );
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

function HubWorkbenchSkeletonRows({ count }: { count: number }) {
  return (
    <WorkbenchList aria-busy="true">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={`hub-skeleton-${index}`}
          aria-hidden="true"
          className="pointer-events-none grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[0.875rem] px-4 py-3 max-[599px]:grid-cols-[auto_minmax(0,1fr)] max-[599px]:gap-3 max-[599px]:px-[0.8rem] max-[599px]:py-[0.85rem]"
        >
          <div className="flex w-[3.75rem] items-center justify-center max-[599px]:w-12">
            <div className="h-14 w-14 rounded-2xl skeleton-shimmer max-[599px]:h-11 max-[599px]:w-11 max-[599px]:rounded-[0.85rem]" />
          </div>
          <div className="min-w-0">
            <div className="h-3 w-24 rounded-full skeleton-shimmer" />
            <div className="mt-3 h-5 w-3/5 rounded-full skeleton-shimmer" />
            <div className="mt-2 h-4 w-4/5 rounded-full skeleton-shimmer" />
            <div className="mt-3 flex flex-wrap gap-2">
              <div className="h-7 w-20 rounded-full skeleton-shimmer" />
              <div className="h-7 w-16 rounded-full skeleton-shimmer" />
            </div>
          </div>
          <div className="hidden h-9 w-9 rounded-full skeleton-shimmer min-[600px]:block" />
        </div>
      ))}
    </WorkbenchList>
  );
}

function HubCertificationInspector({
  assessment,
  canMint,
  onOpenMintFlow,
}: {
  assessment: {
    id: string;
    title?: string | null;
    description?: string | null;
    assessmentType?: string | null;
    createdAt: number;
  };
  canMint: boolean;
  onOpenMintFlow: () => void;
}) {
  const { formatMessage } = useIntl();

  return (
    <div className="flex flex-col gap-4 p-1.5">
      <Surface elevation="ground" padding="compact" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={HUB_CERTIFY_STATUS_CLASSNAME}>
            {canMint
              ? formatMessage({
                  id: "cockpit.hub.certify.readyLabel",
                  defaultMessage: "Ready to certify",
                })
              : formatMessage({
                  id: "cockpit.hub.certify.readOnlyLabel",
                  defaultMessage: "Read-only handoff",
                })}
          </span>
          <span className="text-xs text-text-soft">{formatRelativeTime(assessment.createdAt)}</span>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-text-strong">
            {assessment.title ||
              formatMessage({
                id: "app.garden.admin.assessmentFallback",
                defaultMessage: "Assessment",
              })}
          </h3>
          <p className="mt-1 text-sm text-text-sub">
            {assessment.description ||
              formatMessage({
                id: "cockpit.hub.certify.fallbackDescription",
                defaultMessage:
                  "Review the assessment package and hand it off for hypercert minting.",
              })}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {assessment.assessmentType ? (
            <span className={HUB_META_PILL_CLASSNAME}>{assessment.assessmentType}</span>
          ) : null}
          <span className={HUB_META_PILL_CLASSNAME}>
            {formatMessage({ id: "cockpit.hub.tab.certify", defaultMessage: "Certify" })}
          </span>
        </div>
      </Surface>

      {canMint ? (
        <Surface elevation="ground" padding="compact" className="flex flex-col gap-3">
          <p className="text-sm text-text-sub">
            {formatMessage({
              id: "cockpit.hub.certify.operatorDescription",
              defaultMessage:
                "This bundle is ready for the minting flow. Open the hypercert form when you are ready to finalize it.",
            })}
          </p>
          <Button onClick={onOpenMintFlow}>
            <RiExternalLinkLine className="h-4 w-4" />
            {formatMessage({
              id: "cockpit.hub.certify.openMintFlow",
              defaultMessage: "Open mint flow",
            })}
          </Button>
        </Surface>
      ) : (
        <Alert variant="info">
          {formatMessage({
            id: "cockpit.hub.certify.readOnlyDescription",
            defaultMessage:
              "You can review the certification handoff here, but only garden owners or operators can mint the hypercert.",
          })}
        </Alert>
      )}
    </div>
  );
}

function HubHistoryInspector({ event }: { event: ActivityEvent }) {
  const { formatMessage } = useIntl();

  const categoryLabel =
    event.category === "work"
      ? formatMessage({ id: "cockpit.hub.tab.work", defaultMessage: "Work" })
      : event.category === "impact"
        ? formatMessage({ id: "cockpit.garden.impact", defaultMessage: "Impact" })
        : formatMessage({ id: "cockpit.nav.community", defaultMessage: "Community" });

  return (
    <div className="flex flex-col gap-4 p-1.5">
      <Surface elevation="ground" padding="compact" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={HUB_HISTORY_STATUS_CLASSNAME}>{categoryLabel}</span>
          <span className="text-xs text-text-soft">{formatRelativeTime(event.timestamp)}</span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-text-strong">{event.title}</h3>
          <p className="mt-1 text-sm text-text-sub">{event.description}</p>
        </div>
      </Surface>

      {event.href ? (
        <Surface elevation="ground" padding="compact" className="flex flex-col gap-3">
          <p className="text-sm text-text-sub">
            {formatMessage({
              id: "cockpit.hub.history.readOnlyDescription",
              defaultMessage:
                "This event is summarized inside Hub. Open the linked surface only if you need the full workflow or record context.",
            })}
          </p>
          <Button variant="secondary" asChild>
            <a href={event.href}>
              <RiExternalLinkLine className="h-4 w-4" />
              {formatMessage({
                id: "cockpit.hub.history.openLinkedView",
                defaultMessage: "Open linked view",
              })}
            </a>
          </Button>
        </Surface>
      ) : null}
    </div>
  );
}

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

  const allStages = useMemo(
    () => [
      {
        id: "work" as const,
        labelId: "cockpit.hub.tab.work",
        defaultMessage: "Work",
        icon: RiCheckLine,
        count: works.filter((work) => work.status === "pending").length,
        visible: canManage,
      },
      {
        id: "assess" as const,
        labelId: "cockpit.hub.tab.assess",
        defaultMessage: "Assess",
        icon: RiFileList3Line,
        count: works.filter((work) => work.status === "approved").length,
        visible: canAssess,
      },
      {
        id: "certify" as const,
        labelId: "cockpit.hub.tab.certify",
        defaultMessage: "Certify",
        icon: RiMedalLine,
        count: assessments.filter(
          (assessment) => !hypercerts.some((item) => item.id === assessment.id)
        ).length,
        visible: canCertify,
      },
      {
        id: "history" as const,
        labelId: "cockpit.hub.tab.history",
        defaultMessage: "History",
        icon: RiCheckboxCircleLine,
        count: undefined,
        visible: canBrowseHistory,
      },
    ],
    [assessments, canAssess, canBrowseHistory, canCertify, canManage, hypercerts, works]
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

      if (tab === "work") {
        navigate(
          section === "decisions"
            ? adminRoutes.hubHistory({ sort: sortDirection, item: itemId })
            : adminRoutes.hubWork({ sort: sortDirection, item: itemId })
        );
        return;
      }

      if (tab === "impact" || tab === "overview") {
        navigate(
          tab === "impact"
            ? adminRoutes.gardenImpact({ item: itemId, section })
            : adminRoutes.gardenOverview({ item: itemId, section })
        );
        return;
      }

      const destination =
        section === "members"
          ? adminRoutes.communityMembers({ item: itemId })
          : section === "cookie-jars" || section === "payouts"
            ? adminRoutes.communityPayouts({ item: itemId })
            : section === "pools" || section === "governance"
              ? adminRoutes.communityGovernance({ item: itemId })
              : adminRoutes.communityTreasury({ item: itemId });
      navigate(destination);
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

  const pendingWorks = useMemo(() => {
    const filtered = works.filter((work) => work.status === "pending");
    const direction = sortDirection === "oldest" ? 1 : -1;

    return filtered
      .filter((work) => {
        if (!normalizedSearch) return true;
        const actionTitle = actionsMap.get(work.actionUID)?.title?.toLowerCase() ?? "";
        const gardener = formatAddress(work.gardenerAddress, { variant: "card" }).toLowerCase();
        return (
          (work.title || "").toLowerCase().includes(normalizedSearch) ||
          actionTitle.includes(normalizedSearch) ||
          gardener.includes(normalizedSearch)
        );
      })
      .sort((a, b) => direction * (a.createdAt - b.createdAt));
  }, [actionsMap, normalizedSearch, sortDirection, works]);

  const assessmentQueue = useMemo(() => {
    return works
      .filter((work) => work.status === "approved")
      .filter((work) => {
        if (!normalizedSearch) return true;
        const actionTitle = actionsMap.get(work.actionUID)?.title?.toLowerCase() ?? "";
        return (
          (work.title || "").toLowerCase().includes(normalizedSearch) ||
          actionTitle.includes(normalizedSearch) ||
          formatAddress(work.gardenerAddress, { variant: "card" })
            .toLowerCase()
            .includes(normalizedSearch)
        );
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [actionsMap, normalizedSearch, works]);

  const certificationQueue = useMemo(() => {
    return assessments
      .filter((assessment) => !hypercerts.some((item) => item.id === assessment.id))
      .filter((assessment) => {
        if (!normalizedSearch) return true;
        return (
          (assessment.title || "").toLowerCase().includes(normalizedSearch) ||
          (assessment.description || "").toLowerCase().includes(normalizedSearch)
        );
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [assessments, hypercerts, normalizedSearch]);

  const historyEvents = useMemo(() => {
    const filteredEvents = derived.activityEvents.filter((event) => {
      if (!normalizedSearch) return true;
      return (
        event.title.toLowerCase().includes(normalizedSearch) ||
        event.description.toLowerCase().includes(normalizedSearch)
      );
    });

    return [...filteredEvents].sort((a, b) =>
      sortDirection === "oldest" ? a.timestamp - b.timestamp : b.timestamp - a.timestamp
    );
  }, [derived.activityEvents, normalizedSearch, sortDirection]);

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

  const navFabConfig = useMemo(() => {
    if (!selectedGarden) return null;

    if (stage === "work" && canManage) {
      return {
        icon: RiAddLine,
        label: "Submit Work",
        actions: [
          {
            id: "submit-work",
            icon: RiAddLine,
            label: "Submit Work",
            labelId: "cockpit.hub.fab.submitWork",
          },
        ],
        onAction: (actionId: string) => {
          if (actionId === "submit-work") navigate(adminRoutes.hubWorkSubmit(hubContext));
        },
      };
    }

    if (stage === "assess" && canReview) {
      return {
        icon: RiAddLine,
        label: "Create Assessment",
        actions: [
          {
            id: "create-assessment",
            icon: RiAddLine,
            label: "Create Assessment",
            labelId: "cockpit.hub.fab.createAssessment",
          },
        ],
        onAction: (actionId: string) => {
          if (actionId === "create-assessment") {
            navigate(adminRoutes.hubAssessCreate());
          }
        },
      };
    }

    if (stage === "certify" && canManage) {
      return {
        icon: RiAddLine,
        label: "Mint Hypercert",
        actions: [
          {
            id: "mint-hypercert",
            icon: RiAddLine,
            label: "Mint Hypercert",
            labelId: "cockpit.hub.fab.mintHypercert",
          },
        ],
        onAction: (actionId: string) => {
          if (actionId === "mint-hypercert") {
            navigate(adminRoutes.hubCertifyCreate());
          }
        },
      };
    }

    return null;
  }, [canManage, canReview, hubContext, navigate, selectedGarden, stage]);
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

  const stageTitle =
    stage === "work"
      ? formatMessage({ id: "cockpit.hub.tab.work", defaultMessage: "Work" })
      : stage === "assess"
        ? formatMessage({ id: "cockpit.hub.tab.assess", defaultMessage: "Assess" })
        : stage === "certify"
          ? formatMessage({ id: "cockpit.hub.tab.certify", defaultMessage: "Certify" })
          : formatMessage({ id: "cockpit.hub.tab.history", defaultMessage: "History" });

  const headerDescription =
    stage === "work"
      ? formatMessage(
          {
            id: "cockpit.hub.description",
            defaultMessage: "Review, assess, and certify work flowing through {garden}.",
          },
          {
            garden:
              selectedGarden?.name ??
              formatMessage({ id: "cockpit.nav.hub", defaultMessage: "Hub" }),
          }
        )
      : stage === "assess"
        ? formatMessage({
            id: "cockpit.hub.assess.placeholder.description",
            defaultMessage: "Approved work appears here for assessment packaging and handoff.",
          })
        : stage === "certify"
          ? formatMessage({
              id: "cockpit.hub.certify.placeholder.description",
              defaultMessage:
                "Certification bundles stay inside Hub until they are ready for minting.",
            })
          : formatMessage({
              id: "cockpit.hub.history.description",
              defaultMessage:
                "Audit the recent work, impact, and community decisions tied to this garden.",
            });

  const searchPlaceholder =
    stage === "history"
      ? formatMessage({
          id: "cockpit.hub.search.historyPlaceholder",
          defaultMessage: "Search audit trail",
        })
      : stage === "certify"
        ? formatMessage({
            id: "cockpit.hub.search.certifyPlaceholder",
            defaultMessage: "Search certification bundles",
          })
        : stage === "assess"
          ? formatMessage({
              id: "cockpit.hub.search.assessPlaceholder",
              defaultMessage: "Search approved work",
            })
          : formatMessage({
              id: "cockpit.hub.search.placeholder",
              defaultMessage: "Search submissions",
            });

  const sheetDescriptor = useMemo(() => {
    if (routeSheetContentId === SUBMIT_WORK_CONTENT_ID) {
      return {
        title: formatMessage({ id: "app.admin.work.submit.title", defaultMessage: "Submit Work" }),
        side: "left" as const,
        content: (
          <SubmitWorkPanel
            layout="sheet"
            onSuccess={navigateToHubBase}
            onCancel={handleCloseSheet}
          />
        ),
      };
    }

    const resolvedWorkDetailId = routeWorkId ?? activeWorkDetailId;

    if (selectedWork && resolvedWorkDetailId) {
      return {
        title:
          selectedWork?.title ??
          formatMessage({ id: "app.work.detail.reviewTitle", defaultMessage: "Review Work" }),
        side: "left" as const,
        content: (
          <WorkDetailPanel
            workId={resolvedWorkDetailId}
            layout="sheet"
            onSuccess={navigateToHubBase}
          />
        ),
      };
    }

    if (selectedCertification) {
      return {
        title:
          selectedCertification.title ??
          formatMessage({
            id: "app.garden.admin.assessmentFallback",
            defaultMessage: "Assessment",
          }),
        side: "left" as const,
        content: (
          <HubCertificationInspector
            assessment={selectedCertification}
            canMint={canManage}
            onOpenMintFlow={() => navigate(adminRoutes.hubCertifyCreate())}
          />
        ),
      };
    }

    if (selectedHistoryEvent) {
      return {
        title: selectedHistoryEvent.title,
        side: "left" as const,
        content: <HubHistoryInspector event={selectedHistoryEvent} />,
      };
    }

    return null;
  }, [
    canManage,
    formatMessage,
    handleCloseSheet,
    navigate,
    navigateToHubBase,
    activeWorkDetailId,
    routeSheetContentId,
    routeWorkId,
    selectedCertification,
    selectedHistoryEvent,
    selectedWork,
  ]);

  // Declare left sheet content — CanvasLayout renders the persistent sheet
  useLeftSheetConfig(
    sheetDescriptor
      ? {
          title: sheetDescriptor.title,
          content: sheetDescriptor.content,
          onClose: handleCloseSheet,
        }
      : null
  );

  const renderErrorState = () => (
    <EmptyStateShell>
      <Alert variant="error">
        {formatMessage({
          id: "cockpit.hub.error",
          defaultMessage: "Hub data could not be loaded. Refresh the workspace and try again.",
        })}
      </Alert>
    </EmptyStateShell>
  );

  const renderWorkQueue = (items: Work[]) => {
    if (hasDataError) return renderErrorState();

    if (worksLoading) {
      return <HubWorkbenchSkeletonRows count={5} />;
    }

    if (normalizedSearch && items.length === 0) {
      return (
        <EmptyStateShell>
          <EmptyState
            icon={<RiSearchLine className="h-6 w-6" />}
            title={formatMessage(
              {
                id: "cockpit.hub.noResults",
                defaultMessage: 'No submissions matching "{query}"',
              },
              { query: debouncedSearch }
            )}
            action={{
              label: formatMessage({
                id: "cockpit.hub.clearSearch",
                defaultMessage: "Clear search",
              }),
              variant: "ghost",
              size: "sm",
              onClick: () => {
                setSearchTerm("");
                setDebouncedSearch("");
              },
            }}
          />
        </EmptyStateShell>
      );
    }

    if (items.length === 0) {
      return (
        <EmptyStateShell>
          <EmptyState
            icon={<RiCheckboxCircleLine className="h-6 w-6" />}
            title={formatMessage({
              id: "cockpit.work.allCaughtUp",
              defaultMessage: "All caught up",
            })}
            description={formatMessage({
              id: "cockpit.work.allCaughtUpDescription",
              defaultMessage: "No pending work items across your gardens.",
            })}
          />
        </EmptyStateShell>
      );
    }

    return (
      <WorkbenchList>
        {items.map((work) => {
          const actionTitle = actionsMap.get(work.actionUID)?.title;
          const gardenerDisplayName = formatAddress(work.gardenerAddress, { variant: "card" });
          return (
            <WorkbenchRow
              key={work.id}
              eyebrow={
                selectedGarden?.name ??
                formatMessage({ id: "cockpit.nav.hub", defaultMessage: "Hub" })
              }
              title={
                work.title ||
                formatMessage({
                  id: "app.admin.work.untitledWork",
                  defaultMessage: "Untitled Work",
                })
              }
              description={
                actionTitle ? `${actionTitle} · ${gardenerDisplayName}` : gardenerDisplayName
              }
              meta={[
                formatMessage({ id: "app.admin.work.filter.pending", defaultMessage: "Pending" }),
                formatRelativeTime(work.createdAt),
                `${work.media.length} media`,
              ]}
              statusLabel={formatMessage({
                id: "app.admin.work.filter.pending",
                defaultMessage: "Pending",
              })}
              statusTone="pending"
              leadingIcon={RiInboxLine}
              thumbnailSrc={work.media[0] ? `${resolveIPFSUrl(work.media[0])}?w=160&h=160` : null}
              selected={selectedWork?.id === work.id}
              onClick={() => handleOpenWorkDetail(work.id)}
            />
          );
        })}
      </WorkbenchList>
    );
  };

  const renderAssessmentQueue = () => {
    if (hasDataError) return renderErrorState();

    if (worksLoading) {
      return renderWorkQueue([]);
    }

    if (assessmentQueue.length === 0) {
      return (
        <EmptyStateShell>
          <EmptyState
            icon={<RiFileList3Line className="h-6 w-6" />}
            title={formatMessage({
              id: "cockpit.hub.assess.placeholder.title",
              defaultMessage: "Assessment pipeline",
            })}
            description={formatMessage({
              id: "cockpit.hub.assess.placeholder.description",
              defaultMessage: "Approved work will appear here for bundling into assessments.",
            })}
          />
        </EmptyStateShell>
      );
    }

    return (
      <WorkbenchList>
        {assessmentQueue.map((work) => {
          const actionTitle = actionsMap.get(work.actionUID)?.title;
          return (
            <WorkbenchRow
              key={work.id}
              eyebrow={formatMessage({ id: "cockpit.hub.tab.assess", defaultMessage: "Assess" })}
              title={
                work.title ||
                formatMessage({
                  id: "app.admin.work.untitledWork",
                  defaultMessage: "Untitled Work",
                })
              }
              description={
                actionTitle
                  ? `${actionTitle} · ${formatAddress(work.gardenerAddress, { variant: "card" })}`
                  : formatAddress(work.gardenerAddress, { variant: "card" })
              }
              meta={[
                formatMessage({ id: "app.admin.work.filter.approved", defaultMessage: "Approved" }),
                formatRelativeTime(work.createdAt),
                selectedGarden?.name ?? "",
              ].filter(Boolean)}
              statusLabel={formatMessage({
                id: "app.admin.work.filter.approved",
                defaultMessage: "Approved",
              })}
              statusTone="approved"
              leadingIcon={RiFileList3Line}
              thumbnailSrc={work.media[0] ? `${resolveIPFSUrl(work.media[0])}?w=160&h=160` : null}
              selected={selectedWork?.id === work.id}
              onClick={() => handleOpenWorkDetail(work.id)}
            />
          );
        })}
      </WorkbenchList>
    );
  };

  const renderCertificationQueue = () => {
    if (hasDataError) return renderErrorState();

    if (fetchingAssessments || hypercertsLoading) {
      return <HubWorkbenchSkeletonRows count={3} />;
    }

    if (certificationQueue.length === 0) {
      return (
        <EmptyStateShell>
          <EmptyState
            icon={<RiMedalLine className="h-6 w-6" />}
            title={formatMessage({
              id: "cockpit.hub.certify.placeholder.title",
              defaultMessage: "Certification pipeline",
            })}
            description={formatMessage({
              id: "cockpit.hub.certify.placeholder.description",
              defaultMessage: "Completed assessments will appear here for minting as hypercerts.",
            })}
          />
        </EmptyStateShell>
      );
    }

    return (
      <WorkbenchList>
        {certificationQueue.map((assessment) => {
          const hasMintAuthority = canManage;
          return (
            <WorkbenchRow
              key={assessment.id}
              eyebrow={formatMessage({ id: "cockpit.hub.tab.certify", defaultMessage: "Certify" })}
              title={
                assessment.title ||
                formatMessage({
                  id: "app.garden.admin.assessmentFallback",
                  defaultMessage: "Assessment",
                })
              }
              description={
                hasMintAuthority
                  ? formatMessage({
                      id: "cockpit.hub.certify.queueDescription",
                      defaultMessage:
                        "Open the certification inspector to validate the package before minting.",
                    })
                  : formatMessage({
                      id: "cockpit.hub.certify.readOnlyDescription",
                      defaultMessage:
                        "You can review the certification handoff here, but only garden owners or operators can mint the hypercert.",
                    })
              }
              meta={[
                assessment.assessmentType ||
                  formatMessage({ id: "cockpit.garden.impact", defaultMessage: "Impact" }),
                formatRelativeTime(assessment.createdAt),
              ]}
              statusLabel={
                hasMintAuthority
                  ? formatMessage({
                      id: "cockpit.hub.certify.readyLabel",
                      defaultMessage: "Ready to certify",
                    })
                  : formatMessage({
                      id: "cockpit.hub.certify.readOnlyLabel",
                      defaultMessage: "Read-only handoff",
                    })
              }
              statusTone="certify"
              leadingIcon={RiMedalLine}
              selected={selectedCertification?.id === assessment.id}
              onClick={() => handleOpenCertification(assessment.id)}
            />
          );
        })}
      </WorkbenchList>
    );
  };

  const renderHistory = () => {
    if (hasDataError) return renderErrorState();

    if (worksLoading || fetchingAssessments || hypercertsLoading || allocationsLoading) {
      return <HubWorkbenchSkeletonRows count={4} />;
    }

    if (historyEvents.length === 0) {
      return (
        <EmptyStateShell>
          <EmptyState
            icon={<RiInboxLine className="h-6 w-6" />}
            title={formatMessage({
              id: "cockpit.work.section.history",
              defaultMessage: "Submission history",
            })}
            description={formatMessage({
              id: "cockpit.hub.history.description",
              defaultMessage:
                "Audit the recent work, impact, and community decisions tied to this garden.",
            })}
          />
        </EmptyStateShell>
      );
    }

    return (
      <WorkbenchList>
        {historyEvents.map((event) => {
          const leadingIcon =
            event.category === "work"
              ? RiCheckboxCircleLine
              : event.category === "impact"
                ? RiFileList3Line
                : RiMedalLine;

          const categoryLabel =
            event.category === "work"
              ? formatMessage({ id: "cockpit.hub.tab.work", defaultMessage: "Work" })
              : event.category === "impact"
                ? formatMessage({ id: "cockpit.garden.impact", defaultMessage: "Impact" })
                : formatMessage({ id: "cockpit.nav.community", defaultMessage: "Community" });

          return (
            <WorkbenchRow
              key={event.id}
              eyebrow={categoryLabel}
              title={event.title}
              description={event.description}
              meta={[formatRelativeTime(event.timestamp)]}
              statusLabel={categoryLabel}
              statusTone="history"
              leadingIcon={leadingIcon}
              selected={selectedHistoryEvent?.id === event.id || selectedWork?.id === event.itemId}
              onClick={() => handleOpenHistoryEvent(event)}
            />
          );
        })}
      </WorkbenchList>
    );
  };

  const primaryContent =
    stage === "work"
      ? renderWorkQueue(pendingWorks)
      : stage === "assess"
        ? renderAssessmentQueue()
        : stage === "certify"
          ? renderCertificationQueue()
          : renderHistory();

  return (
    <div className="hub-route-shell">
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
