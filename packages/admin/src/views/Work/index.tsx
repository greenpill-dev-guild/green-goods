import {
  cn,
  type Domain,
  type Work,
  formatAddress,
  formatRelativeTime,
  resolveIPFSUrl,
  SideSheet,
  BottomSheet,
  useActions,
  useAdminStore,
  useCockpitSearchParams,
  useGardenDerivedState,
  useGardenDetailData,
  useGardens,
} from "@green-goods/shared";
import {
  RiAddLine,
  RiCheckLine,
  RiRefreshLine,
  RiSearchLine,
} from "@remixicon/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { Link, useNavigate } from "react-router-dom";
import { CockpitWorkspaceSelectionState } from "@/components/Layout/CockpitWorkspaceSelectionState";
import { PageHeader } from "@/components/Layout/PageHeader";
import { HubWorkCard } from "@/components/Work/HubWorkCard";

// Paradigm: Command Surface — review queue, high-density controls visible.

// ---------------------------------------------------------------------------
// Pipeline stage types
// ---------------------------------------------------------------------------

type HubPipelineStage = "work" | "assess" | "certify" | "history";

function parsePipelineStage(value: string | null): HubPipelineStage {
  if (value === "assess" || value === "certify" || value === "history") return value;
  // "review" is a legacy alias for "work"
  if (value === "review") return "work";
  return "work";
}

type SortDirection = "newest" | "oldest";

function parseSortDirection(value: string | null): SortDirection {
  return value === "oldest" ? "oldest" : "newest";
}

// ---------------------------------------------------------------------------
// useMediaQuery — lightweight breakpoint hook
// ---------------------------------------------------------------------------

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

// ---------------------------------------------------------------------------
// Hub View
// ---------------------------------------------------------------------------

export default function WorkView() {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const { searchParams, updateSearch } = useCockpitSearchParams();
  const { data: gardens = [] } = useGardens();
  const selectedGarden = useAdminStore((state) => state.selectedGarden);
  const setSelectedGarden = useAdminStore((state) => state.setSelectedGarden);
  const [lastWorkRefreshAt, setLastWorkRefreshAt] = useState(() => Date.now());

  const stage = parsePipelineStage(searchParams.get("view"));
  const sortDirection = parseSortDirection(searchParams.get("sort"));
  const selectedItem = searchParams.get("item") ?? undefined;

  // Local search state (not in URL — too volatile)
  const [searchTerm, setSearchTerm] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchTerm]);

  // Reset search and sort on tab switch
  const prevStageRef = useRef(stage);
  useEffect(() => {
    if (prevStageRef.current !== stage) {
      setSearchTerm("");
      setDebouncedSearch("");
      prevStageRef.current = stage;
    }
  }, [stage]);

  // Desktop breakpoint for SideSheet vs BottomSheet
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
    hypercerts,
    allocations,
    gardenVaults,
    vaultNetDeposited,
    roleMembers,
  } = useGardenDetailData(selectedGarden?.id);

  const openSection = useCallback(
    (tab: "overview" | "impact" | "work" | "community", section: string, itemId?: string) => {
      if (!selectedGarden) return;

      if (tab === "work") {
        updateSearch(
          { view: section === "decisions" ? "history" : "work", item: itemId },
          false
        );
        return;
      }

      if (tab === "impact" || tab === "overview") {
        const targetView = tab === "impact" ? "impact" : "overview";
        navigate(
          `/garden?garden=${selectedGarden.id}&view=${targetView}${itemId ? `&item=${itemId}` : ""}`
        );
        return;
      }

      const card = section === "members" ? "members" : section === "yield" ? "yield" : "treasury";
      navigate(
        `/community?garden=${selectedGarden.id}&card=${card}${itemId ? `&item=${itemId}` : ""}`
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
    selectedRange: "30d",
    activityFilter: "all",
    memberSearch: "",
    section: stage === "history" ? "decisions" : "queue",  // maps Hub stages to derived state sections
    formatMessage,
    openSection,
  });

  // Actions data — for domain badge resolution
  const { data: actions = [] } = useActions();
  const actionsMap = useMemo(
    () => new Map(actions.map((a) => [Number(a.id), { domain: a.domain as Domain, title: a.title }])),
    [actions]
  );

  useEffect(() => {
    if (!worksLoading) {
      setLastWorkRefreshAt(Date.now());
    }
  }, [works.length, worksLoading]);

  // Filter works for active pipeline stage
  const stageWorks = useMemo(() => {
    let filtered: Work[];
    if (stage === "work") {
      filtered = works.filter((w) => w.status === "pending");
    } else if (stage === "history") {
      filtered = [...works];
    } else {
      return [];
    }

    // Sort
    const dir = sortDirection === "oldest" ? 1 : -1;
    filtered.sort((a, b) => dir * (b.createdAt - a.createdAt));

    // Search filter
    if (debouncedSearch) {
      const term = debouncedSearch.toLowerCase();
      filtered = filtered.filter((w) => {
        const title = (w.title || "").toLowerCase();
        const addr = formatAddress(w.gardenerAddress, { variant: "card" }).toLowerCase();
        return title.includes(term) || addr.includes(term);
      });
    }

    return filtered;
  }, [works, stage, sortDirection, debouncedSearch]);

  // Pipeline tab counts
  const pendingCount = derived.pendingWorks.length;
  const approvedCount = useMemo(
    () => works.filter((w) => w.status === "approved").length,
    [works]
  );
  const certifyCount = useMemo(
    () => assessments.filter((a) => !hypercerts.some((h) => h.id === a.id)).length,
    [assessments, hypercerts]
  );

  // Pipeline stage definitions
  const stages: {
    id: HubPipelineStage;
    labelId: string;
    defaultMessage: string;
    icon?: typeof RiCheckLine;
    count?: number;
  }[] = [
    { id: "work", labelId: "cockpit.hub.tab.work", defaultMessage: "Work", icon: RiCheckLine, count: pendingCount },
    { id: "assess", labelId: "cockpit.hub.tab.assess", defaultMessage: "Assess", count: approvedCount },
    { id: "certify", labelId: "cockpit.hub.tab.certify", defaultMessage: "Certify", count: certifyCount },
    { id: "history", labelId: "cockpit.hub.tab.history", defaultMessage: "History" },
  ];

  // Selected work for SideSheet
  const selectedWork = useMemo(
    () => (selectedItem ? works.find((w) => w.id === selectedItem) : undefined),
    [works, selectedItem]
  );

  const handleCloseSheet = useCallback(() => {
    updateSearch({ item: undefined }, false);
  }, [updateSearch]);

  const handleRefresh = useCallback(() => {
    void refreshWorks().finally(() => setLastWorkRefreshAt(Date.now()));
  }, [refreshWorks]);

  // Time since last refresh for tooltip
  const refreshAgoText = useMemo(() => formatRelativeTime(lastWorkRefreshAt), [lastWorkRefreshAt]);

  // FAB config per stage
  const fabConfig = useMemo(() => {
    if (!selectedGarden || !canManage) return null;
    const gardenId = selectedGarden.id;
    if (stage === "assess") return { labelId: "cockpit.hub.fab.createAssessment", to: `/gardens/${gardenId}/assessments/create`, icon: RiAddLine };
    if (stage === "certify") return { labelId: "cockpit.hub.fab.mintHypercert", to: `/gardens/${gardenId}/hypercerts/create`, icon: RiAddLine };
    return { labelId: "cockpit.hub.fab.createWork", to: `/gardens/${gardenId}/submit-work`, icon: RiAddLine };
  }, [selectedGarden, canManage, stage]);

  // Sheet content for selected work
  const sheetTitle = selectedWork?.title || formatMessage({ id: "app.admin.work.untitledWork", defaultMessage: "Untitled Work" });
  const sheetOpen = !!selectedWork;

  const sheetContent = selectedWork ? (
    <div className="p-4 space-y-4">
      {/* Hero image */}
      {selectedWork.media && selectedWork.media.length > 0 && (
        <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden">
          {selectedWork.media.slice(0, 4).map((m, i) => (
            <img
              key={m}
              src={resolveIPFSUrl(m)}
              alt={`${sheetTitle} — ${i + 1}`}
              className="aspect-[4/3] w-full object-cover"
            />
          ))}
        </div>
      )}

      {/* Status */}
      <div className="flex items-center gap-2">
        <span className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
          selectedWork.status === "approved" && "bg-success-lighter text-success-dark",
          selectedWork.status === "rejected" && "bg-error-lighter text-error-dark",
          selectedWork.status === "pending" && "bg-warning-lighter text-warning-dark",
        )}>
          {selectedWork.status}
        </span>
        <span className="text-xs text-text-sub">
          {formatRelativeTime(selectedWork.createdAt)}
        </span>
      </div>

      {/* Metadata */}
      <div className="space-y-2 text-sm">
        <div>
          <span className="text-text-sub">Gardener: </span>
          <span className="font-mono text-text-strong">{formatAddress(selectedWork.gardenerAddress, { variant: "card" })}</span>
        </div>
        {selectedGarden && (
          <div>
            <span className="text-text-sub">Garden: </span>
            <span className="text-text-strong">{selectedGarden.name}</span>
          </div>
        )}
        {actionsMap.get(selectedWork.actionUID) && (
          <div>
            <span className="text-text-sub">Action: </span>
            <span className="text-text-strong">{actionsMap.get(selectedWork.actionUID)!.title}</span>
          </div>
        )}
        {selectedWork.feedback && (
          <div>
            <span className="text-text-sub">Feedback: </span>
            <span className="text-text-strong">{selectedWork.feedback}</span>
          </div>
        )}
      </div>

      {/* Full detail link */}
      <Link
        to={`/gardens/${selectedWork.gardenAddress}/work/${selectedWork.id}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-primary-base hover:text-primary-darker transition-colors"
      >
        {formatMessage({ id: "app.admin.work.viewDetails", defaultMessage: "View full detail" })}
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  ) : null;

  return (
    <div className="pb-6">
      <PageHeader
        title={formatMessage({ id: "cockpit.hub.title", defaultMessage: "Hub" })}
        description={
          selectedGarden
            ? formatMessage(
                { id: "cockpit.hub.description", defaultMessage: "{garden} — Impact pipeline" },
                { garden: selectedGarden.name }
              )
            : formatMessage({
                id: "cockpit.work.description",
                defaultMessage: "Review and manage work submissions across your gardens",
              })
        }
        sticky
        toolbar={
          <div
            className="flex flex-nowrap items-center gap-2 overflow-x-auto scrollbar-hide"
            role="tablist"
            aria-label={formatMessage({ id: "cockpit.hub.viewSwitcher", defaultMessage: "Pipeline stages" })}
          >
            {stages.map((option) => {
              const active = stage === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => updateSearch({ view: option.id, item: undefined, sort: undefined })}
                  className={cn(
                    "inline-flex items-center gap-1.5 min-h-11 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    "motion-reduce:transition-none",
                    active
                      ? "bg-primary-alpha-16 text-primary-darker"
                      : "bg-bg-soft text-text-sub hover:bg-bg-weak"
                  )}
                >
                  {option.icon && active && <option.icon className="h-4 w-4" />}
                  {formatMessage({ id: option.labelId, defaultMessage: option.defaultMessage })}
                  {option.count !== undefined && (
                    <span
                      className={cn(
                        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums",
                        active ? "bg-primary-base text-static-white" : "bg-bg-sub text-text-sub"
                      )}
                    >
                      {option.count > 99 ? "99+" : option.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        }
      />

      {!selectedGarden ? (
        <CockpitWorkspaceSelectionState
          workspaceLabel={formatMessage({ id: "cockpit.nav.hub", defaultMessage: "Hub" })}
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
      ) : (
        <div
          className={cn(
            "mt-4 px-4 sm:px-6 lg:px-8 transition-all duration-300 motion-reduce:transition-none",
            sheetOpen && "scale-[0.97] opacity-85 blur-[2px]"
          )}
          style={sheetOpen ? { transformOrigin: "center top" } : undefined}
          role="tabpanel"
        >
          {/* Search + Refresh + Sort row (Review and History only) */}
          {(stage === "work" || stage === "history") && (
            <div className="mb-4 flex items-center gap-3" role="search" aria-label={formatMessage({ id: "cockpit.hub.search.placeholder", defaultMessage: "Search submissions" })}>
              {/* Search */}
              <div className="relative flex-1">
                <RiSearchLine className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-soft pointer-events-none" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={formatMessage({ id: "cockpit.hub.search.placeholder", defaultMessage: "Search submissions" })}
                  className="h-10 w-full rounded-xl border border-stroke-soft bg-bg-white pl-9 pr-3 text-sm text-text-strong placeholder:text-text-soft focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-base/20"
                />
              </div>

              {/* Refresh */}
              <button
                type="button"
                onClick={handleRefresh}
                title={`Last refreshed: ${refreshAgoText}`}
                aria-label={formatMessage({ id: "app.common.refresh", defaultMessage: "Refresh" })}
                className={cn(
                  "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-stroke-soft bg-bg-white",
                  "text-text-sub hover:bg-bg-soft transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base",
                  worksFetching && "animate-spin"
                )}
              >
                <RiRefreshLine className="h-4 w-4" />
              </button>

              {/* Sort dropdown */}
              <select
                value={sortDirection}
                onChange={(e) => updateSearch({ sort: e.target.value }, false)}
                aria-label={formatMessage({ id: "cockpit.hub.sort.newest", defaultMessage: "Sort order" })}
                className="h-10 flex-shrink-0 rounded-full border border-stroke-soft bg-bg-white px-3 pr-8 text-sm text-text-strong focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-base/20 appearance-none cursor-pointer"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}
              >
                <option value="newest">{formatMessage({ id: "cockpit.hub.sort.newest", defaultMessage: "Newest" })}</option>
                <option value="oldest">{formatMessage({ id: "cockpit.hub.sort.oldest", defaultMessage: "Oldest" })}</option>
              </select>
            </div>
          )}

          {/* A11y live region for search result count */}
          <div aria-live="polite" className="sr-only">
            {debouncedSearch && (stage === "work" || stage === "history") &&
              formatMessage(
                { id: "cockpit.hub.resultsCount", defaultMessage: "{count, plural, one {# submission found} other {# submissions found}}" },
                { count: stageWorks.length }
              )
            }
          </div>

          {/* Tab content with fade animation */}
          <div key={stage} className="animate-[hub-fade-in_150ms_ease_both] motion-reduce:animate-none">
            {/* Review and History: HubWorkCard grid */}
            {(stage === "work" || stage === "history") && (
              <>
                {worksLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="rounded-2xl bg-bg-white overflow-hidden">
                        <div className="aspect-[4/3] skeleton-shimmer" />
                        <div className="p-3 space-y-2">
                          <div className="h-4 w-3/4 rounded skeleton-shimmer" />
                          <div className="h-3 w-1/2 rounded skeleton-shimmer" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : debouncedSearch && stageWorks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <p className="text-sm text-text-sub">
                      {formatMessage(
                        { id: "cockpit.hub.noResults", defaultMessage: "No submissions matching \"{query}\"" },
                        { query: debouncedSearch }
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={() => { setSearchTerm(""); setDebouncedSearch(""); }}
                      className="mt-3 rounded-full bg-bg-soft px-4 py-2 text-sm font-medium text-text-sub hover:bg-bg-weak transition-colors"
                    >
                      {formatMessage({ id: "cockpit.hub.clearSearch", defaultMessage: "Clear search" })}
                    </button>
                  </div>
                ) : stageWorks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <h3 className="text-lg font-semibold text-text-strong">
                      {formatMessage({
                        id: stage === "work" ? "cockpit.work.allCaughtUp" : "cockpit.work.emptyQueue",
                        defaultMessage: stage === "work" ? "All caught up" : "No work submissions yet",
                      })}
                    </h3>
                    <p className="mt-2 max-w-md text-sm text-text-sub">
                      {formatMessage({
                        id: stage === "work" ? "cockpit.work.allCaughtUpDescription" : "cockpit.work.noGardensDescription",
                        defaultMessage: "No pending work items across your gardens.",
                      })}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
                    {stageWorks.map((work, index) => (
                      <HubWorkCard
                        key={work.id}
                        work={work}
                        actionDomain={actionsMap.get(work.actionUID)?.domain}
                        gardenName={selectedGarden.name}
                        gardenerDisplayName={formatAddress(work.gardenerAddress, { variant: "card" })}
                        eagerImages={index < 6}
                        onClick={() => updateSearch({ item: work.id }, false)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {stage === "assess" && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <h3 className="text-lg font-semibold text-text-strong">
                  {formatMessage({ id: "cockpit.hub.assess.placeholder.title", defaultMessage: "Assessment pipeline" })}
                </h3>
                <p className="mt-2 max-w-md text-sm text-text-sub">
                  {formatMessage({ id: "cockpit.hub.assess.placeholder.description", defaultMessage: "Approved work will appear here for bundling into assessments." })}
                </p>
              </div>
            )}

            {stage === "certify" && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <h3 className="text-lg font-semibold text-text-strong">
                  {formatMessage({ id: "cockpit.hub.certify.placeholder.title", defaultMessage: "Certification pipeline" })}
                </h3>
                <p className="mt-2 max-w-md text-sm text-text-sub">
                  {formatMessage({ id: "cockpit.hub.certify.placeholder.description", defaultMessage: "Completed assessments will appear here for minting as hypercerts." })}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* URL-driven SideSheet (desktop) / BottomSheet (mobile) */}
      {isDesktop ? (
        <SideSheet
          open={sheetOpen}
          onClose={handleCloseSheet}
          title={sheetTitle}
          width={Math.min(Math.max(400, window.innerWidth * 0.5), 640)}
        >
          {sheetContent}
        </SideSheet>
      ) : (
        <BottomSheet
          open={sheetOpen}
          onClose={handleCloseSheet}
          title={sheetTitle}
        >
          {sheetContent}
        </BottomSheet>
      )}

      {/* Context-sensitive FAB */}
      {fabConfig && (
        <Link
          to={fabConfig.to}
          aria-label={formatMessage({ id: fabConfig.labelId })}
          className={cn(
            "fixed z-20 flex h-14 w-14 items-center justify-center rounded-full",
            "bg-primary-base text-static-white shadow-elevation-3",
            "hover:bg-primary-dark hover:shadow-elevation-4",
            "active:scale-95",
            "transition-all duration-150",
            "motion-reduce:transition-none",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2",
            // Position: clear NavigationBar
            "right-4 bottom-24 max-[599px]:bottom-20"
          )}
        >
          <fabConfig.icon className="h-6 w-6" />
        </Link>
      )}
    </div>
  );
}
