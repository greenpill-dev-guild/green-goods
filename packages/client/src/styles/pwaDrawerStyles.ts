import { pwaStatusStyles } from "./pwaStatusStyles";

export const PWA_DRAWER_CLOSE_DURATION_VAR = "--spring-spatial-duration";

export interface PwaDrawerStyle {
  overlay: string;
  dialogOverlay: string;
  overlayTransition: string;
  panel: string;
  dialogSurface: string;
  header: string;
  tabs: string;
  tabTrigger: string;
  tabActive: string;
  tabInactive: string;
  tabBadge: string;
  tabIndicator: string;
  footer: string;
  closeButtonBase: string;
  closeIcon: string;
  workFeedbackDrawer: string;
  workActionBar: string;
  workCloseButton: string;
}

export const pwaDrawerStyles = {
  overlay: "fixed inset-0 z-modal flex items-end justify-center bg-[var(--color-scrim)]",
  dialogOverlay: "fixed inset-0 z-overlay bg-[var(--color-scrim)]",
  overlayTransition:
    "transition-opacity duration-[var(--spring-effects-duration)] ease-[var(--spring-effects-easing)]",
  panel:
    "bg-[var(--color-material-solid)] rounded-t-[var(--radius-lg)] shadow-[var(--shadow-float)] border border-stroke-soft-200 border-b-0 w-full overflow-hidden flex flex-col h-modal",
  dialogSurface:
    "bg-[var(--color-material-solid)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-float)] border border-stroke-soft-200",
  header:
    "flex items-center justify-between p-4 border-b border-stroke-soft-200 flex-shrink-0 bg-[var(--color-material-solid)]",
  tabs: "flex border-b border-stroke-soft-200 flex-shrink-0 bg-bg-weak-50",
  tabTrigger:
    "flex min-h-11 items-center justify-center gap-1 px-1.5 py-2.5 text-xs font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] relative flex-1 min-w-0 tap-feedback sm:min-h-12 sm:gap-2 sm:px-3 sm:py-3 sm:text-label-sm focus:outline-none focus-visible:shadow-button-primary-focus active:text-primary",
  tabActive: `${pwaStatusStyles.primary.text} ${pwaStatusStyles.primary.surface}`,
  tabInactive: pwaStatusStyles.neutral.text,
  tabBadge: pwaStatusStyles.primary.badge,
  tabIndicator: pwaStatusStyles.primary.progress,
  footer: "flex-shrink-0 border-t border-stroke-soft-200 bg-[var(--color-material-solid)] p-4",
  closeButtonBase:
    "group rounded-full border border-stroke-soft-200 transition-[color,border-color,background-color,box-shadow,transform] duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] flex-shrink-0 tap-feedback hover:bg-bg-weak-50 focus:outline-none focus-visible:shadow-button-primary-focus active:border-primary active:scale-95",
  closeIcon:
    "text-text-soft-400 transition-colors duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] group-focus-visible:text-primary group-active:text-primary",
  workFeedbackDrawer:
    "absolute bottom-full left-0 right-0 bg-[var(--color-material-solid)] rounded-t-[var(--radius-lg)] shadow-[var(--shadow-float)] border border-stroke-soft-200 border-b-0 overflow-hidden transition-transform duration-[var(--spring-spatial-duration)] ease-[var(--spring-spatial-easing)] origin-bottom",
  workActionBar:
    "bg-[var(--color-material-solid)] border-t border-stroke-soft-200 rounded-t-[var(--radius-lg)] overflow-hidden shadow-[var(--shadow-float)]",
  workCloseButton:
    "rounded-[var(--radius-md)] text-text-soft-400 transition-[color,box-shadow,transform] duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] hover:text-text-strong-950 focus:outline-none focus-visible:shadow-button-primary-focus active:text-primary active:scale-95",
} satisfies PwaDrawerStyle;

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

export function getPwaDrawerCloseDelayMs(): number {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return 0;
  }

  return parsePwaCssDurationToMs(
    window
      .getComputedStyle(document.documentElement)
      .getPropertyValue(PWA_DRAWER_CLOSE_DURATION_VAR)
  );
}
