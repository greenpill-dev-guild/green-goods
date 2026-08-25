export type PwaStatusTone = "primary" | "information" | "warning" | "success" | "error" | "neutral";

export interface PwaStatusStyle {
  text: string;
  icon: string;
  surface: string;
  border: string;
  dot: string;
  badge: string;
  progress: string;
  spinnerBorder: string;
  focus: string;
  foreground: string;
}

export const pwaStatusStyles = {
  primary: {
    text: "text-primary",
    icon: "text-primary",
    surface: "bg-primary-alpha-10",
    border: "border-primary-alpha-24",
    dot: "bg-primary",
    badge: "bg-primary text-primary-accent-foreground",
    progress: "bg-primary",
    spinnerBorder: "border-t-primary",
    focus:
      "focus-visible:ring-2 focus-visible:ring-primary-alpha-24 focus-visible:border-primary active:border-primary",
    foreground: "text-primary-accent-foreground",
  },
  information: {
    text: "text-information-dark",
    icon: "text-information-base",
    surface: "bg-information-lighter",
    border: "border-information-light",
    dot: "bg-information-base",
    badge: "bg-information-base text-static-white",
    progress: "bg-information-base",
    spinnerBorder: "border-t-information-base",
    focus:
      "focus-visible:ring-2 focus-visible:ring-information-light focus-visible:border-information-base active:border-information-base",
    foreground: "text-static-white",
  },
  warning: {
    text: "text-warning-dark",
    icon: "text-warning-base",
    surface: "bg-warning-lighter",
    border: "border-warning-light",
    dot: "bg-warning-base",
    badge: "bg-warning-base text-static-white",
    progress: "bg-warning-base",
    spinnerBorder: "border-t-warning-base",
    focus:
      "focus-visible:ring-2 focus-visible:ring-warning-light focus-visible:border-warning-base active:border-warning-base",
    foreground: "text-static-white",
  },
  success: {
    text: "text-success-dark",
    icon: "text-success-base",
    surface: "bg-success-lighter",
    border: "border-success-light",
    dot: "bg-success-base",
    badge: "bg-success-base text-static-white",
    progress: "bg-success-base",
    spinnerBorder: "border-t-success-base",
    focus:
      "focus-visible:ring-2 focus-visible:ring-success-light focus-visible:border-success-base active:border-success-base",
    foreground: "text-static-white",
  },
  error: {
    text: "text-error-dark",
    icon: "text-error-base",
    surface: "bg-error-lighter",
    border: "border-error-light",
    dot: "bg-error-base",
    badge: "bg-error-base text-static-white",
    progress: "bg-error-base",
    spinnerBorder: "border-t-error-base",
    focus:
      "focus-visible:ring-2 focus-visible:ring-error-light focus-visible:border-error-base active:border-error-base",
    foreground: "text-static-white",
  },
  neutral: {
    text: "text-text-sub-600",
    icon: "text-text-sub-600",
    surface: "bg-bg-weak-50",
    border: "border-stroke-soft-200",
    dot: "bg-text-soft-400",
    badge: "bg-bg-soft-200 text-text-strong-950",
    progress: "bg-bg-soft-200",
    spinnerBorder: "border-t-text-sub-600",
    focus:
      "focus-visible:ring-2 focus-visible:ring-stroke-soft-200 focus-visible:border-stroke-sub-300 active:border-stroke-sub-300",
    foreground: "text-text-strong-950",
  },
} satisfies Record<PwaStatusTone, PwaStatusStyle>;
