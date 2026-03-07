/**
 * Shared UI Components
 * EXPLICIT EXPORTS for tree-shaking
 *
 * NOTE: SuspenseBoundary components have been moved to the client package
 * at @/components/Boundaries to comply with the "shared = hooks only" guideline.
 *
 * This file exports reusable UI primitives (Badge, Card, Form, Spinner, Toast)
 * that are used across both client and admin packages.
 */

// Audio Components
export { AudioPlayer, type AudioPlayerProps } from "./Audio";
export { AudioRecorder, type AudioRecorderProps } from "./Audio";

// DatePicker Components
export { DatePicker, type DatePickerProps } from "./DatePicker";
export { DateRangePicker, type DateRangePickerProps } from "./DatePicker";

// Dialog Components
export { ConfirmDialog, type ConfirmDialogProps } from "./Dialog";

// Error Boundary
export { ErrorBoundary, type ErrorBoundaryProps } from "./ErrorBoundary";

// Display Components
export { ImageWithFallback, type ImageWithFallbackProps } from "./Display";

// Badge Component
export { Badge, badgeVariants, type BadgeProps, type BadgeVariantProps } from "./Badge";

// UI Foundation Tokens
export {
  cardDescriptionClassName,
  cardSectionVariants,
  cardShellVariants,
  cardTitleClassName,
  controlInputVariants,
  controlStyleSizes,
  controlTextareaVariants,
  formErrorClassName,
  formHelperClassName,
  formLabelClassName,
  iconButtonIconVariants,
  iconButtonVariants,
  selectTriggerVariants,
} from "./Tokens/foundation";

// Card Components
export {
  CardBase,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  cardVariants,
  type CardBaseProps,
  type CardVariantProps,
  WorkCard,
  workCardVariants,
  type WorkCardProps,
  type WorkCardData,
  type WorkCardLabels,
  type WorkCardVariantProps,
  type WorkStatus,
  GardenCard,
  gardenCardVariants,
  type GardenCardProps,
  type GardenCardData,
  type GardenCardLabels,
  type GardenCardVariantProps,
} from "./Cards";

// Form Components
export type { FormFieldWrapperProps } from "./Form/FormFieldWrapper";
export { FormFieldWrapper } from "./Form/FormFieldWrapper";
export type { FormInputProps } from "./Form/FormInput";
export { FormInput } from "./Form/FormInput";
export type { FormLayoutProps } from "./Form/FormLayout";
export { FormLayout } from "./Form/FormLayout";
export type { FormTextareaProps } from "./Form/FormTextarea";
export { FormTextarea } from "./Form/FormTextarea";
export type {
  CheckboxGroupOption,
  CheckboxGroupProps,
  FormCheckboxProps,
} from "./Form/FormCheckbox";
export { CheckboxGroup, FormCheckbox } from "./Form/FormCheckbox";
// Confidence & Verification Selectors
export type { ConfidenceSelectorProps } from "./Form/ConfidenceSelector";
export { ConfidenceSelector } from "./Form/ConfidenceSelector";
export type { MethodSelectorProps } from "./Form/MethodSelector";
export { MethodSelector } from "./Form/MethodSelector";
// Select Components
export type { FormSelectOption, FormSelectProps } from "./Form/Select";
export {
  FormSelect,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./Form/Select";
// Utility Components
export type { HydrationFallbackProps } from "./HydrationFallback";
export { HydrationFallback } from "./HydrationFallback";
// Spinner
export type { CenteredSpinnerProps, SpinnerProps } from "./Spinner";
export { CenteredSpinner, Spinner } from "./Spinner";
// Status Badge
export type { StatusBadgeProps } from "./StatusBadge";
export { getStatusColors, StatusBadge } from "./StatusBadge";
// Toast Preset i18n Factory Functions
export type { FormatMessageFn } from "./Toast/presets";
// Toast Presets (default English)
export {
  approvalToasts,
  createApprovalToasts,
  createLocalizedToasts,
  createQueueToasts,
  createUpdateToasts,
  createValidationToasts,
  createWalletProgressToasts,
  createWorkToasts,
  queueToasts,
  showWalletProgress,
  toastMessageIds,
  toastMessageIdsUpdate,
  updateToasts,
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
export { SyncStatusBar } from "./SyncStatusBar";

// Vault Components
export type { AssetSelectorProps } from "./Vault/AssetSelector";
export { AssetSelector } from "./Vault/AssetSelector";

// Progress Components
export type { SubmissionProgressState, SubmissionStage } from "../hooks/work/useSubmissionProgress";
export { SubmissionProgress } from "./Progress/SubmissionProgress";
export type { SyncStatus } from "./Progress/SyncIndicator";
export { SyncIndicator } from "./Progress/SyncIndicator";
export { ENSProgressTimeline } from "./Progress/ENSProgressTimeline";
