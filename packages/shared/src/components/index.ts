// Shared UI Components
// EXPLICIT EXPORTS for tree-shaking

// Display Components
export { ImageWithFallback, type ImageWithFallbackProps } from "./Display";

// Badge Component
export { Badge, badgeVariants, type BadgeProps, type BadgeVariantProps } from "./Badge";

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
