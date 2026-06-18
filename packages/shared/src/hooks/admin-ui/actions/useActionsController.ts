import {
  type ActionFiltersState,
  type ActionSortOrder,
  ALL_GARDENS_KEY,
  adminRoutes,
  DEFAULT_CHAIN_ID,
  Domain,
  useActions,
  useFilteredActions,
  useGardenStateStore,
  useMediaQuery,
  useRole,
  useSheetOrchestrator,
  useUrlFilters,
  useViewActions,
  type ViewAction,
} from "@green-goods/shared";
import { RiAddLine } from "@remixicon/react";
import { useCallback, useEffect, useMemo } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ACTION_FILTER_DEFAULTS,
  getActionsListSearch,
  getActionLifecycleState,
  type LifecycleStage,
} from "./actions.utils";
import { isActionsRouteSheetContentId } from "../navigation/sheetRegistry";
import { resolveActionsRouteState } from "./actions.workspaceModel";
import type { UserRole } from "../../gardener/useRole";

export function canManageActionsForRole(role: UserRole): boolean {
  return role === "deployer";
}

export function useActionsController() {
  const intl = useIntl();
  const navigate = useNavigate();
  const location = useLocation();
  const { activeSheet, activeContentId, openSheet, closeSheet } = useSheetOrchestrator();
  const { role } = useRole();
  const { data: actions = [], isLoading, isFetching, refetch } = useActions(DEFAULT_CHAIN_ID);
  const canManageActions = canManageActionsForRole(role);
  const setGardenWorkspaceState = useGardenStateStore((state) => state.setGardenWorkspaceState);
  const listSearch = useMemo(
    () => getActionsListSearch(new URLSearchParams(location.search)),
    [location.search]
  );
  const actionsListHref = useMemo(() => adminRoutes.actions(listSearch), [listSearch]);
  const createActionHref = useMemo(() => adminRoutes.actionCreate(listSearch), [listSearch]);
  const routeState = useMemo(
    () => resolveActionsRouteState(location.pathname, new URLSearchParams(location.search)),
    [location.pathname, location.search]
  );

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const viewActions = useMemo<ViewAction[]>(
    () => [
      {
        id: "create-action",
        label: "Create action",
        labelId: "cockpit.actions.action.createAction",
        icon: RiAddLine,
        onClick: () => navigate(createActionHref),
        variant: "primary",
        visible: canManageActions,
        primary: true,
      },
    ],
    [canManageActions, createActionHref, navigate]
  );
  const { desktopActions } = useViewActions({
    actions: viewActions,
    isDesktop,
  });

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

  useEffect(() => {
    setGardenWorkspaceState(ALL_GARDENS_KEY, "actions", {
      activeMode: lifecycle,
      filter: filters.sort ?? "",
      selectedItem: routeState.actionId,
      sheetOpen: routeState.contentId !== null,
    });
  }, [filters.sort, lifecycle, routeState.actionId, routeState.contentId, setGardenWorkspaceState]);

  const openActionDetail = useCallback(
    (actionId: string) => {
      setGardenWorkspaceState(ALL_GARDENS_KEY, "actions", { selectedItem: actionId });
      navigate(adminRoutes.actionDetail(actionId, listSearch));
    },
    [listSearch, navigate, setGardenWorkspaceState]
  );

  const openCreateAction = useCallback(() => {
    navigate(createActionHref);
  }, [createActionHref, navigate]);

  useEffect(() => {
    if (routeState.contentId) {
      if (activeSheet !== "left" || activeContentId !== routeState.contentId) {
        openSheet("left", routeState.contentId);
      }
      return;
    }

    if (activeSheet === "left" && isActionsRouteSheetContentId(activeContentId)) {
      closeSheet();
    }
  }, [activeContentId, activeSheet, closeSheet, openSheet, routeState.contentId]);

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
    actionsListHref,
    canManageActions,
    createActionHref,
    desktopActions,
    filters,
    isLoading,
    isRefreshing,
    lifecycle,
    lifecycleCounts,
    navigate,
    openActionDetail,
    openCreateAction,
    refetch,
    resetFilters,
    routeState,
    setFilter,
    showToolbar: !isLoading && actions.length > 0,
    sortOptions,
    stageFilteredActions,
    toggleDomain,
  };
}
