import { isRouteSheetRestorable, useSheetOrchestrator } from "@green-goods/shared";
import { useEffect, useRef, useState } from "react";
import { useLocation, useOutlet } from "react-router-dom";

/**
 * Top-level workspace key = first path segment (garden / community / actions /
 * hub). Intentionally a raw first-segment compare rather than the canonical
 * `getAdminWorkspaceForPath()` — we only need "did the top-level segment
 * change", and a raw compare also distinguishes any future top-level route not
 * yet registered in `ADMIN_WORKSPACE_ROOTS`, which the canonical helper would
 * collapse into its `"hub"` fallback and wrongly treat as the same workspace
 * (suppressing the cross-fade + scroll reset).
 */
function getViewKey(pathname: string): string {
  return pathname.split("/")[1] ?? "";
}

export function PageTransition() {
  const location = useLocation();
  const outlet = useOutlet();
  const [renderedOutlet, setRenderedOutlet] = useState(outlet);
  const prevPathRef = useRef(location.pathname);
  const orchestrator = useSheetOrchestrator();
  const transitionTokenRef = useRef(0);

  // Capture orchestrator values in a ref so the effect callback sees the
  // values at the time of the pathname change, not stale closure values.
  const orchestratorRef = useRef(orchestrator);
  orchestratorRef.current = orchestrator;

  useEffect(() => {
    const prevPath = prevPathRef.current;
    const newPath = location.pathname;

    if (prevPath === newPath) {
      setRenderedOutlet((currentOutlet) => (currentOutlet === outlet ? currentOutlet : outlet));
      return;
    }

    const transitionToken = ++transitionTokenRef.current;
    let isCancelled = false;

    // Cross-fading on every tab change — which stays within one workspace,
    // e.g. /garden → /garden/activity — read as a glitch; only a real
    // workspace switch earns the cross-fade + scroll reset (QA refinement).
    const isViewChange = getViewKey(prevPath) !== getViewKey(newPath);

    const runTransition = async () => {
      const orch = orchestratorRef.current;

      // If a sheet is open, close it first and wait for the animation
      if (orch.activeSheet !== null) {
        await orch.onNavigateAway(prevPath);
      }

      const commitOutletSwap = () => {
        if (isCancelled || transitionTokenRef.current !== transitionToken) return;
        setRenderedOutlet(outlet);
        prevPathRef.current = newPath;
        if (isViewChange) {
          // Every workspace switch lands at the top. The canvas scroll
          // container persists across outlet swaps, so without this reset it
          // would retain the previous view's scroll. (Per-view scroll memory
          // was removed from the workspace controllers — QA: all views should
          // start at the top on switch.)
          document.getElementById("main-content")?.scrollTo({ top: 0 });
        }
      };

      // Cross-fade using the View Transitions API — view switches only; tab
      // changes within a view swap instantly for a smoother feel.
      if (isViewChange && document.startViewTransition) {
        const transition = document.startViewTransition(commitOutletSwap);
        await transition.finished;
      } else {
        commitOutletSwap();
      }

      if (isCancelled || transitionTokenRef.current !== transitionToken) return;

      // Check for saved sheet state on the new path and restore if present
      const savedState = orch.onNavigateArrive(newPath);
      if (savedState?.sheetOpen) {
        if (!isRouteSheetRestorable(savedState.sheetContentId, location.pathname)) {
          return;
        }
        orch.openSheet(savedState.sheetOpen, savedState.sheetContentId ?? "");
      }
    };

    void runTransition();

    return () => {
      isCancelled = true;
    };
  }, [location.pathname, location.search, outlet]);

  return renderedOutlet;
}
