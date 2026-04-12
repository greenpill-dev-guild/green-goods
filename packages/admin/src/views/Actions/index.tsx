import {
  type Action,
  type ActionFiltersState,
  type ActionSortOrder,
  Button,
  CanvasWorkbenchList,
  CanvasWorkbenchRow,
  EmptyState,
  ListToolbar,
  SortSelect,
  DEFAULT_CHAIN_ID,
  Domain,
  adminRoutes,
  useActions,
  useFabConfig,
  useFilteredActions,
  useRole,
  useUrlFilters,
  formatDate,
} from "@green-goods/shared";
import { RiAddLine, RiFileListLine, RiRefreshLine } from "@remixicon/react";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/Layout/PageHeader";

const DOMAIN_TAGS: { value: Domain; labelId: string; activeClass: string }[] = [
  {
    value: Domain.SOLAR,
    labelId: "app.domain.tab.solar",
    activeClass: "bg-away-lighter text-away-dark border-away-light",
  },
  {
    value: Domain.AGRO,
    labelId: "app.domain.tab.agro",
    activeClass: "bg-success-lighter text-success-dark border-success-light",
  },
  {
    value: Domain.EDU,
    labelId: "app.domain.tab.education",
    activeClass: "bg-information-lighter text-information-dark border-information-light",
  },
  {
    value: Domain.WASTE,
    labelId: "app.domain.tab.waste",
    activeClass: "bg-warning-lighter text-warning-dark border-warning-light",
  },
];

const ACTION_FILTER_DEFAULTS: Record<string, string | undefined> = {
  sort: "default",
  domain: undefined,
  search: undefined,
};

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
  const isRefreshing = isFetching && !isLoading;

  const { filteredActions } = useFilteredActions(actions, filters);

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
                  {DOMAIN_TAGS.map((tag) => {
                    const isActive = filters.domain === tag.value;
                    return (
                      <button
                        key={tag.value}
                        type="button"
                        onClick={() => toggleDomain(tag.value)}
                        className={[
                          "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                          isActive
                            ? tag.activeClass
                            : "border-stroke-soft bg-bg-white text-text-sub hover:bg-bg-soft",
                        ].join(" ")}
                        aria-pressed={isActive}
                      >
                        {intl.formatMessage({ id: tag.labelId })}
                      </button>
                    );
                  })}
                </div>
              </ListToolbar>
            ) : undefined
          }
        />

        {isLoading ? (
          <div
            className="space-y-3 rounded-[1.6rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(248,246,241,0.92)_100%)] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.74),0_18px_38px_rgba(38,28,18,0.08)] sm:p-5"
            role="status"
            aria-live="polite"
          >
            <span className="sr-only">
              {intl.formatMessage({
                id: "admin.actions.loadingMessage",
                defaultMessage: "Loading actions...",
              })}
            </span>
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`action-skeleton-${index}`}
                className="h-24 rounded-xl skeleton-shimmer"
                style={{ animationDelay: `${index * 0.06}s` }}
              />
            ))}
          </div>
        ) : null}

        {!isLoading && actions.length === 0 ? (
          <div className="rounded-[1.6rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(248,246,241,0.92)_100%)] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.74),0_18px_38px_rgba(38,28,18,0.08)] sm:p-5">
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

        {!isLoading && actions.length > 0 && filteredActions.length === 0 ? (
          <div className="rounded-[1.6rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(248,246,241,0.92)_100%)] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.74),0_18px_38px_rgba(38,28,18,0.08)] sm:p-5">
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

        {!isLoading && filteredActions.length > 0 ? (
          <CanvasWorkbenchList aria-label={intl.formatMessage({ id: "app.admin.nav.actions" })}>
            {filteredActions.map((action) => {
              const lifecycle = getActionLifecycleState(action);
              const domainLabel = intl.formatMessage({
                id:
                  DOMAIN_TAGS.find((tag) => tag.value === action.domain)?.labelId ??
                  "app.admin.nav.actions",
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
                    id: `cockpit.actions.status.${lifecycle}`,
                    defaultMessage:
                      lifecycle === "active"
                        ? "Active"
                        : lifecycle === "upcoming"
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
