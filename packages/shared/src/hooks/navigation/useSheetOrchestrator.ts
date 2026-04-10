import { useCallback } from "react";
import {
  useSheetOrchestratorStore,
  type ViewSheetState,
} from "../../stores/useSheetOrchestratorStore";

/** Duration in ms matching --spring-spatial CSS transition. */
const CLOSE_ANIMATION_MS = 300;

export interface UseSheetOrchestratorReturn {
  activeSheet: "left" | "right" | null;
  activeContentId: string | null;
  isReceded: boolean;
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

      return new Promise<void>((resolve) => {
        setTimeout(resolve, CLOSE_ANIMATION_MS);
      });
    },
    [storeSaveViewState, storeCloseSheet]
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
    isReceded: activeSheet !== null,
    openSheet,
    closeSheet,
    onNavigateAway,
    onNavigateArrive,
  };
}
