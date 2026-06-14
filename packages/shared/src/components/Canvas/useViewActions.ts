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
   * The visible actions for desktop rendering, in declaration order. Empty
   * array if blocked or no visible actions. Declaration order is part of the
   * stable-trio contract: a workspace's actions keep their positions across
   * tab changes — only the filled (`primary`) emphasis moves.
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

    // The FAB is the mobile vehicle for the mode's primary action. A view
    // with no explicit `primary: true` (read-only modes, panel-owned flows)
    // declares no FAB rather than promoting an arbitrary first action.
    const primary = visibleActions.find((action) => action.primary);
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
    // Declaration order, always. Reordering by emphasis would shuffle button
    // positions as the active tab (and with it the filled action) changes —
    // the stable-trio grammar keeps positions frozen and moves only the fill.
    return visibleActions;
  }, [blocked, isDesktop, visibleActions]);

  return { desktopActions, mobilePrimaryAction };
}
