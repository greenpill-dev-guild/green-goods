import { useLayoutEffect, useMemo } from "react";
import { useLocation, useNavigate, type NavigateOptions, type To } from "react-router-dom";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import {
  useUIStore,
  type DashboardSnapshot,
  type WorkDashboardPendingFilter,
  type WorkDashboardTab,
} from "../../stores/useUIStore";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";

type DashboardEntry = { scope: string; path: string; snapshot: DashboardSnapshot };
type DashboardBack = { scope: string; path: string };
type DashboardHistoryState = {
  dashboardEntry?: DashboardEntry;
  dashboardBack?: DashboardBack;
};

function useDashboardScope() {
  const account = usePrimaryAddress();
  const session = useUIStore((state) => state.dashboardNavigationId);
  return account ? `${DEFAULT_CHAIN_ID}:${account.toLowerCase()}:${session}` : null;
}

/** Dashboard snapshots belong to the source history entry, so POP and the app's Back agree. */
export function useDashboardNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const scope = useDashboardScope();
  return useMemo(() => {
    const path = location.pathname + location.search + location.hash;
    const state = (location.state ?? {}) as DashboardHistoryState;
    const previous = scope && state.dashboardBack?.scope === scope ? state.dashboardBack : null;
    const forward = (to: To, options: NavigateOptions = {}) =>
      navigate(to, {
        ...options,
        state: {
          ...options.state,
          ...(previous ? { dashboardBack: options.replace ? previous : { scope, path } } : {}),
        },
      });
    return {
      leave: (snapshot: DashboardSnapshot, to: To, rowState?: Record<string, unknown>) => {
        if (scope)
          navigate(path, {
            replace: true,
            state: { ...state, dashboardEntry: { scope, path, snapshot } },
          });
        navigate(to, {
          viewTransition: true,
          state: { ...rowState, ...(scope ? { dashboardBack: { scope, path } } : {}) },
        });
      },
      forward,
      /** True only when this session recorded the immediately preceding page. */
      back: () => {
        if (!previous) return false;
        navigate(-1);
        return true;
      },
      returnTo: (to: string, options: NavigateOptions = {}) => {
        if (previous?.path === to) navigate(-1);
        else forward(to, { ...options, replace: true });
      },
      clear: () => {
        if (state.dashboardEntry)
          navigate(path, {
            replace: true,
            state: { ...state, dashboardEntry: undefined },
          });
      },
      openWork: (
        tab: WorkDashboardTab = "pending",
        pendingFilter: WorkDashboardPendingFilter = "all",
        options: NavigateOptions = {}
      ) => {
        const snapshot: DashboardSnapshot = {
          kind: "work",
          tab,
          pendingFilter,
          completedFilter: "all",
          timeFilter: "month",
          scrollTop: 0,
        };
        navigate("/home", {
          ...options,
          state: { ...(scope ? { dashboardEntry: { scope, path: "/home", snapshot } } : {}) },
        });
      },
    };
  }, [location, navigate, scope]);
}

/** The shell restores only the visited entry, never a global last-opened dashboard. */
export function useDashboardRestoration() {
  const location = useLocation();
  const scope = useDashboardScope();
  useLayoutEffect(() => {
    const path = location.pathname + location.search + location.hash;
    const entry = (location.state as DashboardHistoryState | null)?.dashboardEntry;
    const snapshot = scope && entry?.scope === scope && entry.path === path ? entry.snapshot : null;
    const store = useUIStore.getState();
    store.closeWorkDashboard();
    store.closeCommitmentsSheet();
    if (snapshot?.kind === "work") {
      store.rememberWorkDashboard(snapshot);
      useUIStore.getState().restoreWorkDashboard();
    } else if (snapshot?.kind === "commitments") {
      useUIStore.setState({ isCommitmentsSheetOpen: true, commitmentsSheetReturnState: snapshot });
    }
  }, [location, scope]);
}
