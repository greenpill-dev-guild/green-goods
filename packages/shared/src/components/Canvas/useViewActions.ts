import { useMemo } from "react";
import { useCanvasResponsiveFab, type CanvasMobilePrimaryAction } from "./useCanvasResponsiveFab";
import type { FabConfig } from "./NavigationBar";
import type { ViewAction, ViewActionsConfig } from "./viewActions.types";

interface UseViewActionsOptions extends ViewActionsConfig {
  /** Same breakpoint signal CanvasLayout already computes. */
  isDesktop: boolean;
}

interface UseViewActionsResult {
  /**
   * The visible, ordered actions for desktop rendering. Empty array if
   * blocked or no visible actions. Order: secondary/ghost/danger first
   * (left), primary last (right) — matches the M3 button-row convention.
   */
  desktopActions: ViewAction[];
  /**
   * The mobile-only primary action signal that `useCanvasResponsiveFab`
   * already exposes. Surfaced for views that render an iOS-style hero
   * action above the FAB.
   */
  mobilePrimaryAction: CanvasMobilePrimaryAction | null;
}

/**
 * Single source of truth for view-level actions. A workspace declares its
 * action set once; this hook drives both the desktop header buttons and the
 * mobile FAB speed-dial.
 *
 * @example
 * ```tsx
 * const { desktopActions } = useViewActions({
 *   isDesktop,
 *   blocked: hasOpenInspector,
 *   actions: [
 *     { id: "submit-work", label: "Submit Work", labelId: "hub.submit", icon: RiAddLine,
 *       onClick: () => navigate("/hub/submit"), variant: "primary", primary: true,
 *       visible: canManage },
 *     { id: "create-assessment", ... },
 *   ],
 * });
 *
 * // Pass to PageHeader:
 * <PageHeader actions={isDesktop ? <AdminViewActions items={desktopActions} /> : null} />
 * ```
 */
export function useViewActions({
  actions,
  blocked = false,
  isDesktop,
}: UseViewActionsOptions): UseViewActionsResult {
  const visibleActions = useMemo(
    () => actions.filter((action) => action.visible !== false),
    [actions]
  );

  const fabConfig = useMemo<FabConfig | null>(() => {
    if (visibleActions.length === 0) return null;

    // Choose the primary FAB action: explicit `primary: true` if set,
    // otherwise the first visible action.
    const primary = visibleActions.find((action) => action.primary) ?? visibleActions[0];
    if (!primary) return null;

    return {
      icon: primary.icon,
      label: primary.label,
      actions: visibleActions.map((action) => ({
        id: action.id,
        icon: action.icon,
        label: action.label,
        labelId: action.labelId,
      })),
      onAction: (actionId: string) => {
        const target = visibleActions.find((action) => action.id === actionId);
        target?.onClick();
      },
    };
  }, [visibleActions]);

  const mobilePrimaryAction = useCanvasResponsiveFab({
    fab: fabConfig,
    isDesktop,
    blocked,
  });

  const desktopActions = useMemo(() => {
    if (blocked || !isDesktop) return [];
    // Order: secondary/ghost/danger first (left side), primary last (right).
    // The chosen primary is whatever `primary: true` marks, OR the first
    // visible action if none is marked — same logic as the FAB.
    const primaryId = visibleActions.find((action) => action.primary)?.id ?? visibleActions[0]?.id;
    if (!primaryId) return [];
    return [
      ...visibleActions.filter((action) => action.id !== primaryId),
      ...visibleActions.filter((action) => action.id === primaryId),
    ];
  }, [blocked, isDesktop, visibleActions]);

  return { desktopActions, mobilePrimaryAction };
}
