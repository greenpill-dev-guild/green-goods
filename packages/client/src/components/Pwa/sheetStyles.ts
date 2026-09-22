import { pwaStatusStyles } from "./statusStyles";

export const PWA_SHEET_CLOSE_DURATION_VAR = "--spring-spatial-duration";

export interface PwaSheetStyle {
  dialogOverlay: string;
  overlayTransition: string;
  tabs: string;
  tabTrigger: string;
  tabActive: string;
  tabInactive: string;
  tabBadge: string;
  tabIndicator: string;
  workFeedbackSheet: string;
  workActionBar: string;
  workActionBarStandalone: string;
}

export const pwaSheetStyles = {
  dialogOverlay: "fixed inset-0 z-overlay bg-[var(--color-scrim)]",
  overlayTransition:
    "transition-opacity duration-[var(--spring-effects-duration)] ease-[var(--spring-effects-easing)]",
  tabs: "flex border-b border-stroke-soft-200 flex-shrink-0 bg-bg-weak-50",
  tabTrigger:
    "flex min-h-11 items-center justify-center gap-1 px-1.5 py-2.5 text-xs font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] relative flex-1 min-w-0 tap-feedback sm:min-h-12 sm:gap-2 sm:px-3 sm:py-3 sm:text-label-sm focus:outline-none focus-visible:shadow-button-primary-focus active:text-primary",
  tabActive: `${pwaStatusStyles.primary.text} ${pwaStatusStyles.primary.surface}`,
  tabInactive: pwaStatusStyles.neutral.text,
  tabBadge: pwaStatusStyles.primary.badge,
  tabIndicator: pwaStatusStyles.primary.progress,
  workFeedbackSheet:
    "absolute bottom-full left-0 right-0 bg-[var(--color-material-solid)] rounded-t-[var(--radius-lg)] shadow-[var(--shadow-float)] border border-stroke-soft-200 border-b-0 overflow-hidden transition-transform duration-[var(--spring-spatial-duration)] ease-[var(--spring-spatial-easing)] origin-bottom",
  workActionBar: "bg-[var(--color-material-solid)] overflow-hidden",
  workActionBarStandalone:
    "border-t border-stroke-soft-200 rounded-t-[var(--radius-lg)] shadow-[var(--shadow-float)]",
} satisfies PwaSheetStyle;

export function parsePwaCssDurationToMs(value: string): number {
  const trimmed = value.trim();
  const numeric = Number.parseFloat(trimmed);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  if (trimmed.endsWith("ms")) {
    return numeric;
  }

  if (trimmed.endsWith("s")) {
    return numeric * 1000;
  }

  return numeric;
}

export function getPwaSheetCloseDelayMs(): number {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return 0;
  }

  return parsePwaCssDurationToMs(
    window.getComputedStyle(document.documentElement).getPropertyValue(PWA_SHEET_CLOSE_DURATION_VAR)
  );
}

/**
 * How long a parent keeps a closing sheet mounted. `PwaSheet` leaves the tree
 * 40ms after its exit token; this waits a little longer so the parent never
 * removes a sheet that is still on screen.
 */
export function getPwaSheetExitMs(): number {
  return getPwaSheetCloseDelayMs() + 80;
}
