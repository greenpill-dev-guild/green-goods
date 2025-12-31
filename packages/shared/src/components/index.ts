// Shared UI Components
// EXPLICIT EXPORTS for tree-shaking

// Form Components
export type { FormInputProps } from "./Form/FormInput";
export { FormInput } from "./Form/FormInput";
export type { FormLayoutProps } from "./Form/FormLayout";
export { FormLayout } from "./Form/FormLayout";
export type { FormTextareaProps } from "./Form/FormTextarea";
export { FormTextarea } from "./Form/FormTextarea";
// Utility Components
export type { HydrationFallbackProps } from "./HydrationFallback";
export { HydrationFallback } from "./HydrationFallback";
// Spinner
export type { CenteredSpinnerProps, SpinnerProps } from "./Spinner";
export { CenteredSpinner, Spinner } from "./Spinner";
// Status Badge
export type { StatusBadgeProps, WorkStatus } from "./StatusBadge";
export { getStatusColors, StatusBadge } from "./StatusBadge";
// Toast Preset i18n Factory Functions
export type { FormatMessageFn } from "./Toast/presets";
// Toast Presets (default English)
export {
  approvalToasts,
  createApprovalToasts,
  createLocalizedToasts,
  createQueueToasts,
  createValidationToasts,
  createWalletProgressToasts,
  createWorkToasts,
  queueToasts,
  showWalletProgress,
  toastMessageIds,
  validationToasts,
  walletProgressToasts,
  workToasts,
} from "./Toast/presets";
// Toast Components
export type { ToastViewportProps } from "./Toast/ToastViewport";
export { ToastViewport } from "./Toast/ToastViewport";
export type {
  ToastAction,
  ToastDescriptor,
  ToastHandle,
  ToastStatus,
  ToastTranslator,
} from "./Toast/toast.service";
export { setToastTranslator, toastService } from "./Toast/toast.service";
export { TranslationBadge } from "./TranslationBadge";
