import {
  type ActionFiltersState,
  type ActionSortOrder,
  adminRoutes,
  DEFAULT_CHAIN_ID,
  Domain,
  useActions,
  useFabConfig,
  useFilteredActions,
  useRole,
  useUrlFilters,
} from "@green-goods/shared";
import { RiAddLine } from "@remixicon/react";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import {
  ACTION_FILTER_DEFAULTS,
  getActionLifecycleState,
  type LifecycleStage,
} from "./actions.utils";

export function useActionsController() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { role } = useRole();
  const { data: actions = [], isLoading, isFetching, refetch } = useActions(DEFAULT_CHAIN_ID);
  const canManageActions = role === "deployer";

  useFabConfig(
    useMemo(() => {
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
    }, [canManageActions, navigate])
  );

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

  return {
    actions,
    canManageActions,
    filters,
    isLoading,
    isRefreshing,
    lifecycle,
    lifecycleCounts,
    navigate,
    refetch,
    resetFilters,
    setFilter,
    showToolbar: !isLoading && actions.length > 0,
    sortOptions,
    stageFilteredActions,
    toggleDomain,
  };
}
