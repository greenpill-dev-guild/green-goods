import {
  type Action,
  type ActionFiltersState,
  type ActionSortOrder,
  Button,
  CanvasStageTabRail,
  CanvasWorkbenchList,
  CanvasWorkbenchRow,
  EmptyState,
  ListToolbar,
  SortSelect,
  DEFAULT_CHAIN_ID,
  DOMAIN_CONFIG,
  Domain,
  adminRoutes,
  cn,
  useActions,
  useFabConfig,
  useFilteredActions,
  useRole,
  useUrlFilters,
  formatDate,
} from "@green-goods/shared";
import { RiAddLine, RiCheckLine, RiFileListLine, RiRefreshLine } from "@remixicon/react";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/Layout/PageHeader";

const DOMAIN_FILTER_OPTIONS = (
  Object.entries(DOMAIN_CONFIG) as [string, (typeof DOMAIN_CONFIG)[Domain]][]
).map(([key, config]) => ({
  value: Number(key) as Domain,
  labelId: config.labelId,
  colors: config.colors,
}));

const ACTION_FILTER_DEFAULTS: Record<string, string | undefined> = {
  sort: "default",
  domain: undefined,
  search: undefined,
  lifecycle: "all",
};

type LifecycleStage = "all" | "active" | "upcoming" | "completed";

const LIFECYCLE_TABS: { id: LifecycleStage; labelId: string; defaultLabel: string }[] = [
  { id: "all", labelId: "cockpit.actions.stage.all", defaultLabel: "All" },
  { id: "active", labelId: "cockpit.actions.stage.active", defaultLabel: "Active" },
  { id: "upcoming", labelId: "cockpit.actions.stage.upcoming", defaultLabel: "Upcoming" },
  { id: "completed", labelId: "cockpit.actions.stage.completed", defaultLabel: "Completed" },
];

function normalizeTimestamp(value: number): number {
  return value > 10_000_000_000 ? value : value * 1000;
}

function getActionLifecycleState(action: Pick<Action, "startTime" | "endTime">) {
  const now = Date.now();
  const start = normalizeTimestamp(action.startTime);
  const end = normalizeTimestamp(action.endTime);

  if (now < start) {
    return "upcoming" as const;
  }

  if (now > end) {
    return "completed" as const;
  }

  return "active" as const;
}

function getWorkbenchTone(action: Pick<Action, "startTime" | "endTime">) {
  const lifecycle = getActionLifecycleState(action);
  if (lifecycle === "upcoming") return "pending" as const;
  if (lifecycle === "active") return "approved" as const;
  return "history" as const;
}

export default function Actions() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { role } = useRole();
  const { data: actions = [], isLoading, isFetching, refetch } = useActions(DEFAULT_CHAIN_ID);
  const canManageActions = role === "deployer";

  const actionsFabConfig = useMemo(() => {
    if (!canManageActions) return null;
    return {
      icon: RiAddLine,
      label: "Create Action",
      actions: [
        {
          id: "create-action",
          icon: RiAddLine,
          label: "Create Action",
          labelId: "cockpit.actions.fab.createAction",
        },
      ],
      onAction: (actionId: string) => {
        if (actionId === "create-action") {
          navigate(adminRoutes.actionCreate());
        }
      },
    };
  }, [canManageActions, navigate]);
  useFabConfig(actionsFabConfig);

  const { filters: urlFilters, setFilter, resetFilters } = useUrlFilters(ACTION_FILTER_DEFAULTS);
  const filters: ActionFiltersState = {
    sort: (urlFilters.sort as ActionSortOrder) ?? "default",
    domain: urlFilters.domain ? (Number(urlFilters.domain) as Domain) : undefined,
    search: urlFilters.search,
  };
  const lifecycle = (urlFilters.lifecycle as LifecycleStage) ?? "all";
  const isRefreshing = isFetching && !isLoading;

  const { filteredActions } = useFilteredActions(actions, filters);

  const lifecycleCounts = useMemo(() => {
    const counts = { all: actions.length, active: 0, upcoming: 0, completed: 0 };
    for (const action of actions) {
      counts[getActionLifecycleState(action)] += 1;
    }
    return counts;
  }, [actions]);

  const stageFilteredActions = useMemo(() => {
    if (lifecycle === "all") return filteredActions;
    return filteredActions.filter((action) => getActionLifecycleState(action) === lifecycle);
  }, [filteredActions, lifecycle]);

  const toggleDomain = (domain: Domain) => {
    setFilter("domain", filters.domain === domain ? undefined : String(domain));
  };

  const sortOptions = [
    {
      value: "default" as const,
      label: intl.formatMessage({ id: "admin.actions.sort.default", defaultMessage: "Default" }),
    },
    {
      value: "title" as const,
      label: intl.formatMessage({ id: "admin.actions.sort.title", defaultMessage: "Title" }),
    },
    {
      value: "recent" as const,
      label: intl.formatMessage({ id: "admin.actions.sort.recent", defaultMessage: "Recent" }),
    },
  ];

  const showToolbar = !isLoading && actions.length > 0;

  return (
    <div className="pb-6">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 sm:px-6">
        <PageHeader
          title={intl.formatMessage({ id: "app.admin.nav.actions", defaultMessage: "Actions" })}
          description={intl.formatMessage({
            id: "cockpit.actions.description",
            defaultMessage:
              "Scan the registry, review lifecycle status, and maintain submission requirements.",
          })}
          variant="canvas"
          sticky
          actions={
            <Button
              size="sm"
              variant="secondary"
              loading={isRefreshing}
              onClick={() => {
                void refetch();
              }}
            >
              {!isRefreshing && <RiRefreshLine className="h-4 w-4" />}
              {intl.formatMessage({
                id: isRefreshing ? "app.common.refreshing" : "app.common.refresh",
              })}
            </Button>
          }
          toolbar={
            showToolbar ? (
              <div className="flex flex-col gap-3">
                <CanvasStageTabRail
                  ariaLabel={intl.formatMessage({
                    id: "cockpit.actions.lifecycleSwitcher",
                    defaultMessage: "Filter actions by lifecycle",
                  })}
                  activeId={lifecycle}
                  onChange={(next) => setFilter("lifecycle", next === "all" ? undefined : next)}
                  tabs={LIFECYCLE_TABS.map((tab) => ({
                    id: tab.id,
                    label: intl.formatMessage({
                      id: tab.labelId,
                      defaultMessage: tab.defaultLabel,
                    }),
                    count: lifecycleCounts[tab.id] || undefined,
                  }))}
                />
                <ListToolbar
                  search={filters.search ?? ""}
                  onSearchChange={(value) => setFilter("search", value || undefined)}
                  searchPlaceholder={intl.formatMessage({
                    id: "admin.actions.searchPlaceholder",
                    defaultMessage: "Search actions...",
                  })}
                >
                  <SortSelect
                    value={filters.sort}
                    onChange={(value) => setFilter("sort", value)}
                    options={sortOptions}
                  />
                  <div
                    className="flex flex-wrap items-center gap-1.5"
                    role="group"
                    aria-label={intl.formatMessage({
                      id: "admin.actions.filterByDomain",
                      defaultMessage: "Filter by domain",
                    })}
                  >
                    {DOMAIN_FILTER_OPTIONS.map((tag) => {
                      const isActive = filters.domain === tag.value;
                      return (
                        <button
                          key={tag.value}
                          type="button"
                          onClick={() => toggleDomain(tag.value)}
                          className={cn(
                            "group inline-flex items-center gap-1 rounded-sm px-3 py-1.5 text-label-lg font-medium",
                            "transition-colors duration-[var(--spring-micro-duration,150ms)]",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ws-primary,var(--primary-base)))]",
                            isActive
                              ? "bg-[rgb(var(--ws-primary-container,var(--red-100)))] text-[rgb(var(--ws-on-primary-container,var(--red-900)))]"
                              : "glass-ground text-text-sub hover:bg-bg-soft"
                          )}
                          aria-pressed={isActive}
                        >
                          {isActive && <RiCheckLine className="h-3.5 w-3.5" aria-hidden="true" />}
                          {intl.formatMessage({ id: tag.labelId })}
                        </button>
                      );
                    })}
                  </div>
                </ListToolbar>
              </div>
            ) : undefined
          }
        />

        {isLoading ? (
          <div className="canvas-route-shell space-y-3" role="status" aria-live="polite">
            <span className="sr-only">
              {intl.formatMessage({
                id: "admin.actions.loadingMessage",
                defaultMessage: "Loading actions...",
              })}
            </span>
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`action-skeleton-${index}`}
                className="h-20 rounded-sm skeleton-shimmer"
                style={{ animationDelay: `${index * 0.05}s` }}
              />
            ))}
          </div>
        ) : null}

        {!isLoading && actions.length === 0 ? (
          <div className="canvas-route-shell">
            <EmptyState
              icon={<RiFileListLine className="h-6 w-6" />}
              title={intl.formatMessage({
                id: "admin.actions.noActions",
                defaultMessage: "No actions yet",
              })}
              description={intl.formatMessage({
                id: "admin.actions.noActionsDescription",
                defaultMessage: "Get started by creating your first action.",
              })}
              action={
                canManageActions
                  ? {
                      label: intl.formatMessage({
                        id: "app.actions.createFirst",
                        defaultMessage: "Create your first action",
                      }),
                      onClick: () => navigate(adminRoutes.actionCreate()),
                    }
                  : undefined
              }
            />
          </div>
        ) : null}

        {!isLoading && actions.length > 0 && stageFilteredActions.length === 0 ? (
          <div className="canvas-route-shell">
            <EmptyState
              icon={<RiFileListLine className="h-6 w-6" />}
              title={intl.formatMessage({
                id: "admin.actions.noResults",
                defaultMessage: "No actions match your filters",
              })}
              action={{
                label: intl.formatMessage({
                  id: "admin.actions.resetFilters",
                  defaultMessage: "Reset filters",
                }),
                onClick: resetFilters,
              }}
            />
          </div>
        ) : null}

        {!isLoading && stageFilteredActions.length > 0 ? (
          <CanvasWorkbenchList aria-label={intl.formatMessage({ id: "app.admin.nav.actions" })}>
            {stageFilteredActions.map((action) => {
              const stage = getActionLifecycleState(action);
              const domainLabel = intl.formatMessage({
                id: DOMAIN_CONFIG[action.domain]?.labelId ?? "app.admin.nav.actions",
              });

              return (
                <CanvasWorkbenchRow
                  key={action.id}
                  eyebrow={domainLabel}
                  title={action.title}
                  description={
                    action.description ||
                    intl.formatMessage({
                      id: "admin.actions.noDescription",
                      defaultMessage: "No description",
                    })
                  }
                  meta={[
                    `${formatDate(action.startTime)} - ${formatDate(action.endTime)}`,
                    intl.formatMessage(
                      {
                        id: "cockpit.actions.inputsCount",
                        defaultMessage: "{count} {count, plural, one {field} other {fields}}",
                      },
                      { count: action.inputs.length }
                    ),
                    intl.formatMessage(
                      {
                        id: "app.actions.detail.capitalsForms",
                        defaultMessage: "{count} capital forms",
                      },
                      { count: action.capitals.length }
                    ),
                  ]}
                  statusLabel={intl.formatMessage({
                    id: `cockpit.actions.status.${stage}`,
                    defaultMessage:
                      stage === "active"
                        ? "Active"
                        : stage === "upcoming"
                          ? "Upcoming"
                          : "Completed",
                  })}
                  statusTone={getWorkbenchTone(action)}
                  leadingIcon={RiFileListLine}
                  thumbnailSrc={action.media[0] ?? undefined}
                  onClick={() => navigate(adminRoutes.actionDetail(action.id))}
                />
              );
            })}
          </CanvasWorkbenchList>
        ) : null}
      </div>
    </div>
  );
}
