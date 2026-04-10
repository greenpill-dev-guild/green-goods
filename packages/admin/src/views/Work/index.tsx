import {
  adminRoutes,
  Button,
  BottomSheet,
  cn,
  EmptyState,
  formatAddress,
  formatRelativeTime,
  ListToolbar,
  type SortOption,
  SortSelect,
  Surface,
  type Work,
  resolveIPFSUrl,
  SideSheet,
  useActions,
  useAdminStore,
  useCanvasPortal,
  useCockpitSearchParams,
  useFabConfig,
  useGardenDerivedState,
  useGardenDetailData,
  useGardenPermissions,
  useEligibleAdminGardens,
  useSheetOrchestrator,
} from "@green-goods/shared";
import {
  RiAddLine,
  RiArrowRightLine,
  RiCheckboxCircleLine,
  RiCheckLine,
  RiFileList3Line,
  RiInboxLine,
  RiMedalLine,
  RiRefreshLine,
  RiSearchLine,
} from "@remixicon/react";
import { type ComponentType, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { Link, useNavigate } from "react-router-dom";
import { CockpitWorkspaceSelectionState, PageHeader } from "@/components/Layout";

type HubPipelineStage = "work" | "assess" | "certify" | "history";
type SortDirection = "newest" | "oldest";
type HubRowTone = "pending" | "approved" | "certify" | "history";

const WORK_DETAIL_CONTENT_ID_PREFIX = "work-detail:";

function parsePipelineStage(value: string | null): HubPipelineStage {
  if (value === "assess" || value === "certify" || value === "history") return value;
  if (value === "queue" || value === "review") return "work";
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

interface HubWorkbenchRowProps {
  eyebrow: string;
  title: string;
  description: string;
  meta: string[];
  statusLabel: string;
  statusTone: HubRowTone;
  leadingIcon: ComponentType<{ className?: string }>;
  thumbnailSrc?: string | null;
  selected?: boolean;
  onClick?: () => void;
}

function HubWorkbenchRow({
  eyebrow,
  title,
  description,
  meta,
  statusLabel,
  statusTone,
  leadingIcon: LeadingIcon,
  thumbnailSrc,
  selected = false,
  onClick,
}: HubWorkbenchRowProps) {
  const content = (
    <>
      <div className="hub-workbench-leading" aria-hidden="true">
        {thumbnailSrc ? (
          <img
            src={thumbnailSrc}
            alt=""
            loading="lazy"
            className="hub-workbench-thumb"
            draggable={false}
          />
        ) : (
          <div className="hub-workbench-icon-shell">
            <LeadingIcon className="h-5 w-5" />
          </div>
        )}
      </div>

      <div className="hub-workbench-copy">
        <div className="hub-workbench-topline">
          <span className="hub-workbench-eyebrow">{eyebrow}</span>
          <span className="hub-workbench-status" data-tone={statusTone}>
            {statusLabel}
          </span>
        </div>
        <h3 className="hub-workbench-title">{title}</h3>
        <p className="hub-workbench-description">{description}</p>
        <div className="hub-workbench-meta">
          {meta.map((value) => (
            <span key={`${title}-${value}`} className="hub-workbench-meta-pill">
              {value}
            </span>
          ))}
        </div>
      </div>

      <div className="hub-workbench-tail" aria-hidden="true">
        <RiArrowRightLine className="h-4 w-4" />
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        data-active={selected ? "true" : "false"}
        onClick={onClick}
        className="hub-workbench-row"
      >
        {content}
      </button>
    );
  }

  return (
    <div data-active={selected ? "true" : "false"} className="hub-workbench-row">
      {content}
    </div>
  );
}

export default function HubView() {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const { searchParams, updateSearch } = useCockpitSearchParams();
  const { activeSheet, activeContentId, closeSheet, openSheet } = useSheetOrchestrator();
  const { portalTarget } = useCanvasPortal();
  const { eligibleGardens } = useEligibleAdminGardens();
  const selectedGarden = useAdminStore((state) => state.selectedGarden);
  const setSelectedGarden = useAdminStore((state) => state.setSelectedGarden);
  const gardenPermissions = useGardenPermissions();
  const [lastRefreshAt, setLastRefreshAt] = useState(() => Date.now());

  const requestedStage = parsePipelineStage(searchParams.get("view"));
  const sortDirection = parseSortDirection(searchParams.get("sort"));
  const routedItemId = searchParams.get("item") ?? undefined;

  const [searchTerm, setSearchTerm] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(searchTerm), 220);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchTerm]);

  const isDesktop = useMediaQuery("(min-width: 600px)");

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
        count: assessments.filter((assessment) => !hypercerts.some((item) => item.id === assessment.id))
          .length,
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
  const stage = stages.some((option) => option.id === requestedStage) ? requestedStage : fallbackStage;
  const activeStageDefinition = stages.find((option) => option.id === stage) ?? allStages[0];

  useEffect(() => {
    if (!selectedGarden) return;
    if (requestedStage === stage) return;
    updateSearch({ view: stage, item: undefined }, true);
  }, [requestedStage, selectedGarden, stage, updateSearch]);

  const openSection = useCallback(
    (tab: "overview" | "impact" | "work" | "community", section: string, itemId?: string) => {
      if (!selectedGarden) return;

      if (tab === "work") {
        updateSearch({ view: section === "decisions" ? "history" : "work", item: itemId }, false);
        return;
      }

      if (tab === "impact" || tab === "overview") {
        navigate(adminRoutes.garden({ view: tab === "impact" ? "impact" : "overview", item: itemId }));
        return;
      }

      const card = section === "members" ? "members" : section === "yield" ? "yield" : "treasury";
      navigate(adminRoutes.community({ card, item: itemId }));
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
  }, [works.length, worksLoading, assessments.length, fetchingAssessments, hypercerts.length, hypercertsLoading]);

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

  const resultCount =
    stage === "work"
      ? pendingWorks.length
      : stage === "assess"
        ? assessmentQueue.length
        : stage === "certify"
          ? certificationQueue.length
          : historyEvents.length;

  const historyCount = historyEvents.length;
  const refreshAgoText = useMemo(() => formatRelativeTime(lastRefreshAt), [lastRefreshAt]);

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

  const activeWorkDetailId = useMemo(
    () => (activeSheet === "right" ? parseWorkDetailContentId(activeContentId) : null),
    [activeContentId, activeSheet]
  );
  const blockingSheetOpen = activeSheet !== null && activeWorkDetailId === null;

  const selectedWork = useMemo(() => {
    const resolvedItemId = activeWorkDetailId ?? (blockingSheetOpen ? undefined : routedItemId);
    return resolvedItemId ? works.find((work) => work.id === resolvedItemId) : undefined;
  }, [activeWorkDetailId, blockingSheetOpen, routedItemId, works]);

  const handleCloseSheet = useCallback(() => {
    if (parseWorkDetailContentId(activeContentId)) {
      closeSheet();
    }
    updateSearch({ item: undefined }, false);
  }, [activeContentId, closeSheet, updateSearch]);

  const handleOpenWorkDetail = useCallback(
    (workId: string) => {
      openSheet("right", toWorkDetailContentId(workId));
      updateSearch({ item: workId }, false);
    },
    [openSheet, updateSearch]
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
            labelId: "cockpit.hub.fab.createWork",
          },
        ],
        onAction: (actionId: string) => {
          if (actionId === "submit-work") navigate(adminRoutes.workSubmit());
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
          if (actionId === "create-assessment") navigate(adminRoutes.gardenAssessmentsCreate());
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
          if (actionId === "mint-hypercert") navigate(adminRoutes.gardenHypercertCreate());
        },
      };
    }

    return null;
  }, [canManage, canReview, navigate, selectedGarden, stage]);
  useFabConfig(navFabConfig);

  useEffect(() => {
    if (!routedItemId) {
      if (activeWorkDetailId) {
        closeSheet();
      }
      return;
    }

    if (stage !== "work" && stage !== "assess") return;
    if (!selectedWork || blockingSheetOpen || activeWorkDetailId === routedItemId) {
      return;
    }

    openSheet("right", toWorkDetailContentId(routedItemId));
  }, [
    activeWorkDetailId,
    blockingSheetOpen,
    closeSheet,
    openSheet,
    routedItemId,
    selectedWork,
    stage,
  ]);

  const sheetTitle =
    selectedWork?.title ||
    formatMessage({ id: "app.admin.work.untitledWork", defaultMessage: "Untitled Work" });
  const sheetOpen = !!selectedWork && !blockingSheetOpen;
  const detailSheetWidth =
    typeof window === "undefined" ? 440 : Math.min(Math.max(420, window.innerWidth * 0.46), 680);

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
          { garden: selectedGarden?.name ?? formatMessage({ id: "cockpit.nav.hub", defaultMessage: "Hub" }) }
        )
      : stage === "assess"
        ? formatMessage({
            id: "cockpit.hub.assess.placeholder.description",
            defaultMessage: "Approved work will appear here for bundling into assessments.",
          })
        : stage === "certify"
          ? formatMessage({
              id: "cockpit.hub.certify.placeholder.description",
              defaultMessage: "Completed assessments will appear here for minting as hypercerts.",
            })
          : formatMessage({
              id: "cockpit.work.description",
              defaultMessage: "Review and manage work submissions across your gardens",
            });

  const queueMeta = (
    <div className="hub-meta-strip">
      {stages.map((option) => (
        <span key={option.id} className="hub-meta-pill">
          <span className="hub-meta-value">
            {option.id === "history" ? historyCount : option.count ?? 0}
          </span>
          <span>
            {formatMessage({
              id: option.labelId,
              defaultMessage: option.defaultMessage,
            })}
          </span>
        </span>
      ))}
    </div>
  );

  const sheetContent = selectedWork ? (
    <div className="flex flex-col gap-section p-4">
      {selectedWork.media && selectedWork.media.length > 0 ? (
        <div className="grid overflow-hidden rounded-xl grid-cols-2 gap-1">
          {selectedWork.media.slice(0, 4).map((media, index) => (
            <img
              key={media}
              src={resolveIPFSUrl(media)}
              alt={`${sheetTitle} — ${index + 1}`}
              className="aspect-[4/3] w-full object-cover"
            />
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 label-xs",
            selectedWork.status === "approved" && "bg-success-lighter text-success-dark",
            selectedWork.status === "rejected" && "bg-error-lighter text-error-dark",
            selectedWork.status === "pending" && "bg-warning-lighter text-warning-dark"
          )}
        >
          {selectedWork.status}
        </span>
        <span className="body-xs text-text-sub">{formatRelativeTime(selectedWork.createdAt)}</span>
      </div>

      <Surface elevation="ground" padding="compact" className="flex flex-col gap-content">
        <div className="flex items-baseline justify-between">
          <span className="label-xs text-text-sub">Gardener</span>
          <span className="font-mono body-xs text-text-strong">
            {formatAddress(selectedWork.gardenerAddress, { variant: "card" })}
          </span>
        </div>
        {selectedGarden ? (
          <div className="flex items-baseline justify-between">
            <span className="label-xs text-text-sub">Garden</span>
            <span className="body-xs text-text-strong">{selectedGarden.name}</span>
          </div>
        ) : null}
        {actionsMap.get(selectedWork.actionUID) ? (
          <div className="flex items-baseline justify-between">
            <span className="label-xs text-text-sub">Action</span>
            <span className="body-xs text-text-strong">
              {actionsMap.get(selectedWork.actionUID)?.title}
            </span>
          </div>
        ) : null}
        {selectedWork.feedback ? (
          <div>
            <span className="label-xs text-text-sub">Feedback</span>
            <p className="mt-1 body-sm text-text-strong">{selectedWork.feedback}</p>
          </div>
        ) : null}
      </Surface>

      <Button variant="secondary" size="sm" asChild>
        <Link to={adminRoutes.workDetail(selectedWork.id)}>
          {formatMessage({ id: "app.admin.work.viewDetails", defaultMessage: "View full detail" })}
          <span aria-hidden="true" className="ml-1">
            →
          </span>
        </Link>
      </Button>
    </div>
  ) : null;

  const renderWorkQueue = (items: Work[]) => {
    if (worksLoading) {
      return (
        <div className="hub-workbench-list" aria-busy="true">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={`work-skeleton-${index}`}
              className="hub-workbench-row hub-workbench-row--skeleton"
              aria-hidden="true"
            >
              <div className="hub-workbench-leading">
                <div className="hub-workbench-thumb skeleton-shimmer" />
              </div>
              <div className="hub-workbench-copy">
                <div className="h-3 w-24 rounded-full skeleton-shimmer" />
                <div className="mt-3 h-5 w-3/5 rounded-full skeleton-shimmer" />
                <div className="mt-2 h-4 w-4/5 rounded-full skeleton-shimmer" />
                <div className="mt-3 flex gap-2">
                  <div className="h-7 w-20 rounded-full skeleton-shimmer" />
                  <div className="h-7 w-16 rounded-full skeleton-shimmer" />
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (normalizedSearch && items.length === 0) {
      return (
        <Surface elevation="ground" radius="xl" className="hub-stage-placeholder">
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
        </Surface>
      );
    }

    if (items.length === 0) {
      return (
        <Surface elevation="ground" radius="xl" className="hub-stage-placeholder">
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
        </Surface>
      );
    }

    return (
      <div className="hub-workbench-list">
        {items.map((work) => {
          const actionTitle = actionsMap.get(work.actionUID)?.title;
          const gardenerDisplayName = formatAddress(work.gardenerAddress, { variant: "card" });
          return (
            <HubWorkbenchRow
              key={work.id}
              eyebrow={selectedGarden?.name ?? formatMessage({ id: "cockpit.nav.hub", defaultMessage: "Hub" })}
              title={
                work.title ||
                formatMessage({ id: "app.admin.work.untitledWork", defaultMessage: "Untitled Work" })
              }
              description={
                actionTitle
                  ? `${actionTitle} · ${gardenerDisplayName}`
                  : gardenerDisplayName
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
      </div>
    );
  };

  const renderAssessmentQueue = () => {
    if (worksLoading) {
      return renderWorkQueue([]);
    }

    if (assessmentQueue.length === 0) {
      return (
        <Surface elevation="ground" radius="xl" className="hub-stage-placeholder">
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
        </Surface>
      );
    }

    return (
      <div className="hub-workbench-list">
        {assessmentQueue.map((work) => {
          const actionTitle = actionsMap.get(work.actionUID)?.title;
          return (
            <HubWorkbenchRow
              key={work.id}
              eyebrow={formatMessage({ id: "cockpit.hub.tab.assess", defaultMessage: "Assess" })}
              title={
                work.title ||
                formatMessage({ id: "app.admin.work.untitledWork", defaultMessage: "Untitled Work" })
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
      </div>
    );
  };

  const renderCertificationQueue = () => {
    if (fetchingAssessments || hypercertsLoading) {
      return (
        <div className="hub-workbench-list" aria-busy="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`certify-skeleton-${index}`}
              className="hub-workbench-row hub-workbench-row--skeleton"
              aria-hidden="true"
            >
              <div className="hub-workbench-leading">
                <div className="hub-workbench-icon-shell skeleton-shimmer" />
              </div>
              <div className="hub-workbench-copy">
                <div className="h-3 w-24 rounded-full skeleton-shimmer" />
                <div className="mt-3 h-5 w-1/2 rounded-full skeleton-shimmer" />
                <div className="mt-2 h-4 w-2/3 rounded-full skeleton-shimmer" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (certificationQueue.length === 0) {
      return (
        <Surface elevation="ground" radius="xl" className="hub-stage-placeholder">
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
        </Surface>
      );
    }

    return (
      <div className="hub-workbench-list">
        {certificationQueue.map((assessment) => {
          const hasMintAuthority = canManage;
          return (
            <HubWorkbenchRow
              key={assessment.id}
              eyebrow={formatMessage({ id: "cockpit.hub.tab.certify", defaultMessage: "Certify" })}
              title={
                assessment.title ||
                formatMessage({ id: "app.garden.admin.assessmentFallback", defaultMessage: "Assessment" })
              }
              description={
                assessment.description ||
                formatMessage({
                  id: "app.garden.detail.impact.actionDescription",
                  defaultMessage: "Track assessments, hypercerts, and reporting progress.",
                })
              }
              meta={[
                assessment.assessmentType || formatMessage({ id: "cockpit.garden.impact", defaultMessage: "Impact" }),
                formatRelativeTime(assessment.createdAt),
                hasMintAuthority
                  ? formatMessage({
                      id: "cockpit.hub.tab.certify",
                      defaultMessage: "Certify",
                    })
                  : formatMessage({ id: "cockpit.hub.tab.assess", defaultMessage: "Assess" }),
              ]}
              statusLabel={
                hasMintAuthority
                  ? formatMessage({
                      id: "cockpit.hub.tab.certify",
                      defaultMessage: "Certify",
                    })
                  : formatMessage({
                      id: "cockpit.hub.tab.assess",
                      defaultMessage: "Assess",
                    })
              }
              statusTone="certify"
              leadingIcon={RiMedalLine}
              selected={routedItemId === assessment.id}
              onClick={() => {
                updateSearch({ item: assessment.id }, false);
                if (hasMintAuthority) {
                  navigate(adminRoutes.gardenHypercertCreate());
                  return;
                }
                navigate(adminRoutes.garden({ view: "impact", item: assessment.id }));
              }}
            />
          );
        })}
      </div>
    );
  };

  const renderHistory = () => {
    if (worksLoading || fetchingAssessments || hypercertsLoading || allocationsLoading) {
      return (
        <div className="hub-workbench-list" aria-busy="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`history-skeleton-${index}`}
              className="hub-workbench-row hub-workbench-row--skeleton"
              aria-hidden="true"
            >
              <div className="hub-workbench-leading">
                <div className="hub-workbench-icon-shell skeleton-shimmer" />
              </div>
              <div className="hub-workbench-copy">
                <div className="h-3 w-20 rounded-full skeleton-shimmer" />
                <div className="mt-3 h-5 w-3/5 rounded-full skeleton-shimmer" />
                <div className="mt-2 h-4 w-4/5 rounded-full skeleton-shimmer" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (historyEvents.length === 0) {
      return (
        <Surface elevation="ground" radius="xl" className="hub-stage-placeholder">
          <EmptyState
            icon={<RiInboxLine className="h-6 w-6" />}
            title={formatMessage({
              id: "cockpit.work.section.history",
              defaultMessage: "Submission history",
            })}
            description={formatMessage({
              id: "cockpit.work.description",
              defaultMessage: "Review and manage work submissions across your gardens",
            })}
          />
        </Surface>
      );
    }

    return (
      <div className="hub-workbench-list">
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
            <HubWorkbenchRow
              key={event.id}
              eyebrow={categoryLabel}
              title={event.title}
              description={event.description}
              meta={[formatRelativeTime(event.timestamp)]}
              statusLabel={categoryLabel}
              statusTone="history"
              leadingIcon={leadingIcon}
              selected={routedItemId === event.itemId}
              onClick={event.href ? () => navigate(event.href) : undefined}
            />
          );
        })}
      </div>
    );
  };

  const resultsTitle =
    stage === "work"
      ? formatMessage({ id: "cockpit.work.section.pending", defaultMessage: "Pending submissions" })
      : stage === "assess"
        ? formatMessage({ id: "cockpit.work.section.assess", defaultMessage: "Assessment preparation" })
        : stage === "certify"
          ? formatMessage({
              id: "cockpit.work.section.certify",
              defaultMessage: "Certification preparation",
            })
          : formatMessage({ id: "cockpit.work.section.history", defaultMessage: "Submission history" });

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

  return (
    <div className="pb-6">
      {!selectedGarden ? (
        <CockpitWorkspaceSelectionState
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
        <div className="px-4 py-4 sm:px-5 lg:px-6" role="tabpanel">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
            <PageHeader
              sticky
              title={stageTitle}
              description={headerDescription}
              metadata={queueMeta}
              toolbar={
                <div className="hub-toolbar-shell">
                  <ListToolbar
                    search={searchTerm}
                    onSearchChange={setSearchTerm}
                    searchPlaceholder={searchPlaceholder}
                    className="hub-list-toolbar"
                  >
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleRefresh}
                      title={`Last refreshed: ${refreshAgoText}`}
                      aria-label={formatMessage({ id: "app.common.refresh", defaultMessage: "Refresh" })}
                      className={cn("hub-refresh-button", worksFetching && "[&>svg]:animate-spin")}
                    >
                      <RiRefreshLine className="h-4 w-4" />
                    </Button>
                    {(stage === "work" || stage === "history") && (
                      <SortSelect
                        value={sortDirection}
                        onChange={(value) => updateSearch({ sort: value }, false)}
                        options={sortOptions}
                        className="hub-sort-select"
                      />
                    )}
                  </ListToolbar>
                </div>
              }
              className="hub-page-header"
            >
              <div
                className="hub-stage-rail"
                style={{ gridTemplateColumns: `repeat(${Math.max(stages.length, 1)}, minmax(0, 1fr))` }}
                role="tablist"
                aria-label={formatMessage({
                  id: "cockpit.hub.viewSwitcher",
                  defaultMessage: "Pipeline stages",
                })}
              >
                {stages.map((option) => {
                  const active = stage === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      data-active={active ? "true" : "false"}
                      onClick={() =>
                        updateSearch({ view: option.id, item: undefined, sort: undefined }, false)
                      }
                      className="hub-stage-tab"
                    >
                      <span className="flex items-center gap-1.5">
                        {active ? <option.icon className="h-4 w-4" /> : null}
                        {formatMessage({
                          id: option.labelId,
                          defaultMessage: option.defaultMessage,
                        })}
                      </span>
                      {option.count !== undefined ? (
                        <span className="hub-stage-count">
                          {option.count > 99 ? "99+" : option.count}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </PageHeader>

            <section className="hub-results-shell surface-section">
              <div className="hub-results-intro">
                <div>
                  <p className="hub-results-eyebrow">
                    {selectedGarden.name}
                    <span className="mx-2 text-text-soft">·</span>
                    {formatMessage({
                      id: activeStageDefinition.labelId,
                      defaultMessage: activeStageDefinition.defaultMessage,
                    })}
                  </p>
                  <h2 className="hub-results-title">{resultsTitle}</h2>
                </div>
                <div className="hub-results-meta">
                  <span className="hub-meta-pill">
                    <span className="hub-meta-value">{resultCount}</span>
                    <span>
                      {formatMessage({
                        id:
                          stage === "history"
                            ? "cockpit.work.meta.records"
                            : "cockpit.work.meta.items",
                        defaultMessage: stage === "history" ? "records" : "items",
                      })}
                    </span>
                  </span>
                  <span className="hub-meta-pill">
                    <span>{formatMessage({ id: "app.common.refresh", defaultMessage: "Refresh" })}</span>
                    <span className="hub-meta-value">{refreshAgoText}</span>
                  </span>
                </div>
              </div>

              <div className="hub-results-pane">
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

                <div key={stage} className="animate-[hub-fade-in_150ms_ease_both] motion-reduce:animate-none">
                  {stage === "work"
                    ? renderWorkQueue(pendingWorks)
                    : stage === "assess"
                      ? renderAssessmentQueue()
                      : stage === "certify"
                        ? renderCertificationQueue()
                        : renderHistory()}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {isDesktop ? (
        <SideSheet
          open={sheetOpen}
          onClose={handleCloseSheet}
          title={sheetTitle}
          width={detailSheetWidth}
          container={portalTarget}
        >
          {sheetContent}
        </SideSheet>
      ) : (
        <BottomSheet
          open={sheetOpen}
          onClose={handleCloseSheet}
          title={sheetTitle}
          container={portalTarget}
        >
          {sheetContent}
        </BottomSheet>
      )}
    </div>
  );
}
