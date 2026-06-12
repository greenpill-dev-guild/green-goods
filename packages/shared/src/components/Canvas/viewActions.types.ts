import type { ComponentType } from "react";

/**
 * One action a workspace exposes — rendered inline in the page header on
 * desktop (≥1024px) and as a FAB speed-dial action on tablet/mobile.
 *
 * Stable-trio grammar: a workspace declares the SAME action set, in the SAME
 * order, on every tab; positions never shift. At most one action per tab
 * carries `primary: true` — the tab whose workflow it opens — and renders
 * filled with the workspace tone; it also drives the main FAB button on
 * mobile. Tabs with no `primary` (read surfaces) show every action outlined
 * / ghost and declare no FAB.
 */
export interface ViewAction {
  id: string;
  /** Full label, used for tooltips, aria-labels, and desktop button text. */
  label: string;
  /** i18n message id matching the resolved `label`. Required for FAB labelId. */
  labelId: string;
  /** Optional shorter form used at narrow desktop widths (≥1024 but <1280). */
  shortLabel?: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
  /**
   * Visual emphasis on desktop. `primary` is filled with workspace tone;
   * `secondary` is outlined; `ghost` is text-only; `danger` is filled error.
   * Defaults to `secondary`.
   */
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /**
   * Role / permission gate. `false` removes the action from both the desktop
   * row and the FAB. Defaults to `true`.
   */
  visible?: boolean;
  disabled?: boolean;
  /**
   * Marks this action as the active tab's filled action and the primary FAB
   * button. At most one action per tab sets this; when none is marked the
   * tab is a read surface — all actions render outlined and no FAB shows.
   */
  primary?: boolean;
}

export interface ViewActionsConfig {
  actions: ViewAction[];
  /** Hide everything (e.g., when an inspector sheet is open). */
  blocked?: boolean;
}
