import { useEffect, useRef, useState } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { useSheetOrchestrator } from "@green-goods/shared";
import { isRouteSheetRestorable } from "@/routes/sheetRegistry";

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

    if (prevPath === newPath) return;

    const transitionToken = ++transitionTokenRef.current;
    let isCancelled = false;

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
      };

      // Cross-fade using the View Transitions API
      if (document.startViewTransition) {
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
