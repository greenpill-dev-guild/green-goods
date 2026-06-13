import { useCallback } from "react";
import {
  useSheetOrchestratorStore,
  type ViewSheetState,
} from "../../stores/useSheetOrchestratorStore";

const DEFAULT_CLOSE_ANIMATION_MS = 300;

function parseCssTimeToMs(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.endsWith("ms")) return Number.parseFloat(trimmed);
  if (trimmed.endsWith("s")) return Number.parseFloat(trimmed) * 1000;
  return null;
}

export function getSheetCloseAnimationMs(): number {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return DEFAULT_CLOSE_ANIMATION_MS;
  }

  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    return 0;
  }

  const tokenValue = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue("--spring-spatial-duration");
  const parsed = parseCssTimeToMs(tokenValue);
  return Number.isFinite(parsed) && parsed !== null ? parsed : DEFAULT_CLOSE_ANIMATION_MS;
}

export interface UseSheetOrchestratorReturn {
  activeSheet: "left" | "right" | null;
  activeContentId: string | null;
  openSheet: (side: "left" | "right", contentId: string) => void;
  closeSheet: () => void;
  onNavigateAway: (currentPath: string) => Promise<void>;
  onNavigateArrive: (newPath: string) => ViewSheetState | null;
}

/**
 * Navigation-aware sheet orchestrator.
 *
 * Wraps the sheet orchestrator store with lifecycle methods for
 * view transitions. Saves sheet state on navigate-away and returns
 * it on navigate-arrive without auto-opening.
 */
export function useSheetOrchestrator(): UseSheetOrchestratorReturn {
  const activeSheet = useSheetOrchestratorStore((s) => s.activeSheet);
  const activeContentId = useSheetOrchestratorStore((s) => s.activeContentId);

  const storeOpenSheet = useSheetOrchestratorStore((s) => s.openSheet);
  const storeCloseSheet = useSheetOrchestratorStore((s) => s.closeSheet);
  const storeSaveViewState = useSheetOrchestratorStore((s) => s.saveViewState);
  const storeRestoreViewState = useSheetOrchestratorStore((s) => s.restoreViewState);

  const openSheet = useCallback(
    (side: "left" | "right", contentId: string) => {
      storeOpenSheet(side, contentId);
    },
    [storeOpenSheet]
  );

  const closeSheet = useCallback(() => {
    storeCloseSheet();
  }, [storeCloseSheet]);

  const onNavigateAway = useCallback(
    (currentPath: string): Promise<void> => {
      storeSaveViewState(currentPath);
      storeCloseSheet();

      if (!activeSheet) {
        return Promise.resolve();
      }

      return new Promise<void>((resolve) => {
        setTimeout(resolve, getSheetCloseAnimationMs());
      });
    },
    [activeSheet, storeSaveViewState, storeCloseSheet]
  );

  const onNavigateArrive = useCallback(
    (newPath: string): ViewSheetState | null => {
      return storeRestoreViewState(newPath);
    },
    [storeRestoreViewState]
  );

  return {
    activeSheet,
    activeContentId,
    openSheet,
    closeSheet,
    onNavigateAway,
    onNavigateArrive,
  };
}
