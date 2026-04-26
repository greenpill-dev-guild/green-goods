import {
  type ActionFiltersState,
  type ActionSortOrder,
  ALL_GARDENS_KEY,
  adminRoutes,
  DEFAULT_CHAIN_ID,
  Domain,
  useActions,
  useFabConfig,
  useFilteredActions,
  useGardenStateStore,
  useRole,
  useSheetOrchestrator,
  useUrlFilters,
} from "@green-goods/shared";
import { RiAddLine } from "@remixicon/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ACTION_FILTER_DEFAULTS,
  getActionsListSearch,
  getActionLifecycleState,
  type LifecycleStage,
} from "./actions.utils";
import { isActionsRouteSheetContentId } from "@/routes/sheetRegistry";
import { resolveActionsRouteState } from "./actions.workspaceModel";
import {
  bindCanvasScrollPositionPersistence,
  restoreCanvasScrollPosition,
} from "../workspaceScroll";

export function useActionsController() {
  const intl = useIntl();
  const navigate = useNavigate();
  const location = useLocation();
  const { activeSheet, activeContentId, openSheet, closeSheet } = useSheetOrchestrator();
  const { role } = useRole();
  const { data: actions = [], isLoading, isFetching, refetch } = useActions(DEFAULT_CHAIN_ID);
  const canManageActions = role === "deployer" || role === "operator";
  const getGardenWorkspaceState = useGardenStateStore((state) => state.getGardenWorkspaceState);
  const setGardenWorkspaceState = useGardenStateStore((state) => state.setGardenWorkspaceState);
  const hydratedRef = useRef(false);
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
            navigate(createActionHref);
          }
        },
      };
    }, [canManageActions, createActionHref, navigate])
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

  useEffect(() => {
    if (hydratedRef.current) return;

    const persistedState = getGardenWorkspaceState(ALL_GARDENS_KEY, "actions");
    restoreCanvasScrollPosition(persistedState.scrollPosition);
    hydratedRef.current = true;
  }, [getGardenWorkspaceState]);

  useEffect(() => {
    setGardenWorkspaceState(ALL_GARDENS_KEY, "actions", {
      activeMode: lifecycle,
      filter: filters.sort ?? "",
      selectedItem: routeState.actionId,
      sheetOpen: routeState.contentId !== null,
    });
  }, [filters.sort, lifecycle, routeState.actionId, routeState.contentId, setGardenWorkspaceState]);

  useEffect(() => {
    return bindCanvasScrollPositionPersistence((scrollPosition) => {
      setGardenWorkspaceState(ALL_GARDENS_KEY, "actions", { scrollPosition });
    });
  }, [setGardenWorkspaceState]);

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
