import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  useLocation,
  useNavigate,
  useNavigationType,
  type NavigateOptions,
  type To,
} from "react-router-dom";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { logger } from "../../modules/app/logger";
import {
  useUIStore,
  type DashboardSnapshot,
  type WorkDashboardPendingFilter,
  type WorkDashboardTab,
} from "../../stores/useUIStore";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";

type DashboardEntry = {
  scope: string;
  path: string;
  snapshot: DashboardSnapshot;
  id?: string;
  restoreOnReplace?: false;
};
type DashboardBack = { scope: string; path: string };
type DashboardHistoryState = {
  dashboardEntry?: DashboardEntry;
  dashboardBack?: DashboardBack;
  dashboardOrigin?: DashboardEntry;
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
  const current = useRef({ path: location.pathname + location.search + location.hash, scope });
  const leaving = useRef(false);
  useLayoutEffect(() => {
    current.current = { path: location.pathname + location.search + location.hash, scope };
  }, [location, scope]);
  useEffect(
    () => () => {
      current.current = { path: "", scope: null };
    },
    []
  );
  return useMemo(() => {
    const path = location.pathname + location.search + location.hash;
    const state = (location.state ?? {}) as DashboardHistoryState;
    const previous = scope && state.dashboardBack?.scope === scope ? state.dashboardBack : null;
    const origin = scope && state.dashboardOrigin?.scope === scope ? state.dashboardOrigin : null;
    const forward = (to: To, options: NavigateOptions = {}) =>
      navigate(to, {
        ...options,
        ...(origin ? { viewTransition: false } : {}),
        state: {
          ...options.state,
          ...(previous ? { dashboardBack: options.replace ? previous : { scope, path } } : {}),
          ...(origin ? { dashboardOrigin: origin } : {}),
        },
      });
    return {
      isDashboardCovered: location.pathname.replace(/\/$/, "") !== "/home",
      leave: (snapshot: DashboardSnapshot, to: To, rowState?: Record<string, unknown>) => {
        if (leaving.current) return;
        leaving.current = true;
        const entry = scope
          ? { scope, path, snapshot, id: crypto.randomUUID(), restoreOnReplace: false as const }
          : null;
        const openRecord = () =>
          navigate(to, {
            viewTransition: false,
            state: {
              ...rowState,
              ...(scope ? { dashboardBack: { scope, path }, dashboardOrigin: entry } : {}),
            },
          });
        const saved = scope
          ? navigate(path, {
              replace: true,
              state: {
                ...state,
                dashboardEntry: entry,
              },
            })
          : undefined;
        // Data routers commit asynchronously. Save the source before pushing the record,
        // otherwise the push cancels the replacement and Back has no dashboard to restore.
        if (saved)
          return saved
            .then(() => {
              if (current.current.path === path && current.current.scope === scope)
                return openRecord();
            })
            .catch((error: unknown) => {
              logger.error("[DashboardNavigation] Could not open the record", {
                error: error instanceof Error ? error.message : String(error),
              });
            })
            .finally(() => {
              leaving.current = false;
            });
        try {
          return openRecord();
        } finally {
          leaving.current = false;
        }
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
  const navigationType = useNavigationType();
  const retained = useRef<DashboardEntry | null>(null);
  useLayoutEffect(() => {
    const path = location.pathname + location.search + location.hash;
    const state = location.state as DashboardHistoryState | null;
    const entry = state?.dashboardEntry;
    const snapshot = scope && entry?.scope === scope && entry.path === path ? entry.snapshot : null;
    const origin = scope && state?.dashboardOrigin?.scope === scope ? state.dashboardOrigin : null;
    const store = useUIStore.getState();
    const remember = (saved: DashboardEntry) => {
      if (saved.snapshot.kind === "work") store.rememberWorkDashboard(saved.snapshot);
      else useUIStore.setState({ commitmentsSheetReturnState: saved.snapshot });
      retained.current = saved;
    };
    // Saving the outgoing entry is history bookkeeping, not a request to reopen it.
    // A changed identity still closes the previous reader's sheet.
    if (snapshot && entry && navigationType === "REPLACE" && entry.restoreOnReplace === false) {
      remember(entry);
      return;
    }
    // An inspected record covers the still-open workspace; it does not dismiss it.
    if (origin) {
      remember(origin);
      return;
    }
    const alreadyOpen =
      snapshot?.kind === "work" ? store.isWorkDashboardOpen : store.isCommitmentsSheetOpen;
    if (snapshot && entry?.id && retained.current?.id === entry.id && alreadyOpen) return;
    retained.current = entry ?? null;
    store.closeWorkDashboard();
    store.closeCommitmentsSheet();
    if (snapshot?.kind === "work") {
      store.rememberWorkDashboard(snapshot);
      useUIStore.getState().restoreWorkDashboard();
    } else if (snapshot?.kind === "commitments") {
      useUIStore.setState({
        isCommitmentsSheetOpen: true,
        commitmentsSheetReturnState: snapshot,
      });
    }
  }, [location, scope, navigationType]);
}
