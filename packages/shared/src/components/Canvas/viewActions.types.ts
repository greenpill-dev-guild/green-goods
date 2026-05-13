import type { ComponentType } from "react";

/**
 * One action a workspace exposes — rendered inline in the page header on
 * desktop (≥1024px) and as a FAB speed-dial action on tablet/mobile.
 *
 * Exactly one action in a set may carry `primary: true`. That action drives
 * the main FAB button (single-action mode if it's the only visible action,
 * speed-dial main if there are siblings) and renders as the rightmost filled
 * button on desktop. All other actions render as outlined / ghost / danger
 * variants depending on their `variant`.
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
   * Marks this action as the primary FAB button. Exactly one action per set
   * should set this. If none is marked, the first visible action becomes
   * primary by default.
   */
  primary?: boolean;
}

export interface ViewActionsConfig {
  actions: ViewAction[];
  /** Hide everything (e.g., when an inspector sheet is open). */
  blocked?: boolean;
}
