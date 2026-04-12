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

// Progress Components
export type { SubmissionProgressState, SubmissionStage } from "../hooks/work/useSubmissionProgress";
// Audio Components
export {
  AudioPlayer,
  type AudioPlayerProps,
  AudioRecorder,
  type AudioRecorderProps,
} from "./Audio";
// Admin / Shared foundation primitives
export {
  AddressDisplay,
  type AddressDisplayProps,
} from "./AddressDisplay";
export { Alert, type AlertProps, type AlertVariant } from "./Alert";
// Badge Component
export { Badge, type BadgeProps, type BadgeVariantProps, badgeVariants } from "./Badge";
export { Button, type ButtonProps, buttonVariants } from "./Button";
// Card Components
export {
  Card,
  type CardProps,
  CardBase,
  CardBody,
  type CardBaseProps,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  type CardVariantProps,
  cardVariants,
  surfaceCardVariants,
  GardenCard,
  type GardenCardData,
  type GardenCardLabels,
  type GardenCardProps,
  type GardenCardVariantProps,
  gardenCardVariants,
  VaultPositionCard,
  type VaultPositionCardProps,
  getStatusBorderClass,
  WorkCard,
  type WorkCardData,
  type WorkCardLabels,
  type WorkCardProps,
  type WorkCardVariantProps,
  type WorkStatus,
  workCardVariants,
} from "./Cards";
// Surface Component (unified surface primitive — preferred over Card/CardBase for new code)
export { Surface, surfaceVariants } from "./Surface";
export type { SurfaceProps, SurfaceVariantProps } from "./Surface";
// Feedback Components
export type { TxInlineFeedbackProps, TxInlineFeedbackSeverity } from "./feedback/TxInlineFeedback";
export { TxInlineFeedback } from "./feedback/TxInlineFeedback";
// Canvas Components (Sheets + Navigation + MainSheet)
export {
  BottomSheet,
  type BottomSheetProps,
  MainSheet,
  type MainSheetProps,
  CanvasEmptyStateShell,
  CanvasMetaStrip,
  CanvasMobileActionSlot,
  CanvasSheetFrame,
  CanvasStageTabRail,
  CanvasWorkbenchList,
  CanvasWorkbenchRow,
  type CanvasMetaStripItem,
  type CanvasMetaStripProps,
  type CanvasMobilePrimaryAction,
  type CanvasStageTab,
  type CanvasStageTabRailProps,
  type CanvasWorkbenchRowProps,
  type CanvasWorkbenchTone,
  FabProvider,
  useCanvasPortal,
  useCanvasResponsiveFab,
  useFabConfig,
  useFabConfigValue,
  type ToolbarSlot,
  GardenChip,
  type GardenChipProps,
  NavigationBar,
  type NavigationBarProps,
  type FabAction,
  type FabConfig,
  NotificationPanel,
  SheetErrorBoundary,
  type SheetErrorBoundaryProps,
  SideSheet,
  type SideSheetProps,
  TopContextBar,
  type TopContextBarProps,
  type UseCanvasResponsiveFabOptions,
} from "./Canvas";
// DatePicker Components
export {
  DatePicker,
  type DatePickerProps,
  DateRangePicker,
  type DateRangePickerProps,
} from "./DatePicker";
// Dialog Components
export { ConfirmDialog, type ConfirmDialogProps } from "./Dialog";
export { DialogShell, type DialogShellProps } from "./Dialog";
export { ImagePreviewDialog, type ImagePreviewDialogProps } from "./Dialog";
// Display Components
export {
  ActionBannerFallback,
  type ActionBannerFallbackProps,
} from "./Display";
export {
  GardenBannerFallback,
  type GardenBannerFallbackProps,
} from "./Display";
export { ImageWithFallback, type ImageWithFallbackProps } from "./Display";
// Error Boundary
export { ErrorBoundary, type ErrorBoundaryProps } from "./ErrorBoundary";
export {
  FileUploadField,
  type FileUploadFieldProps,
} from "./FileUploadField";
// Confidence & Verification Selectors
export type { ConfidenceSelectorProps } from "./Form/ConfidenceSelector";
export { ConfidenceSelector } from "./Form/ConfidenceSelector";
export type {
  CheckboxGroupOption,
  CheckboxGroupProps,
  FormCheckboxProps,
} from "./Form/FormCheckbox";
export { CheckboxGroup, FormCheckbox } from "./Form/FormCheckbox";
// Form Components
export type { FormFieldWrapperProps } from "./Form/FormFieldWrapper";
export type { FormFieldProps } from "./Form/FormFieldWrapper";
export { FormField, FormFieldWrapper } from "./Form/FormFieldWrapper";
export type { FormInputProps } from "./Form/FormInput";
export { FormInput } from "./Form/FormInput";
export type { FormLayoutProps } from "./Form/FormLayout";
export { FormLayout } from "./Form/FormLayout";
export type { FormTextareaProps } from "./Form/FormTextarea";
export { FormTextarea } from "./Form/FormTextarea";
export {
  FormWizard,
  type FormWizardProps,
} from "./Form/FormWizard";
export type { MethodSelectorProps } from "./Form/MethodSelector";
export { MethodSelector } from "./Form/MethodSelector";
export type { Step } from "./Form/StepIndicator";
export { StepIndicator } from "./Form/StepIndicator";
// Select Components
export type { FormSelectOption, FormSelectProps } from "./Form/Select";
export {
  EmptyState,
  type EmptyStateProps,
  ListToolbar,
  type ListToolbarProps,
  SortSelect,
  type SortOption,
  type SortSelectProps,
} from "./ListPrimitives";
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
export { ENSProgressTimeline } from "./Progress/ENSProgressTimeline";
export { SubmissionProgress } from "./Progress/SubmissionProgress";
export type { SyncStatus } from "./Progress/SyncIndicator";
export { SyncIndicator } from "./Progress/SyncIndicator";
// Spinner
export type { CenteredSpinnerProps, SpinnerProps } from "./Spinner";
export { CenteredSpinner, Spinner } from "./Spinner";
export type {
  SkeletonCardProps,
  SkeletonGridProps,
  SkeletonTextProps,
} from "./Skeleton";
export {
  SkeletonCard,
  SkeletonGrid,
  SkeletonText,
} from "./Skeleton";
// Domain Badge
export { DomainBadge } from "./DomainBadge";
// Status Badge
export type { StatusBadgeProps } from "./StatusBadge";
export { getStatusColors, StatusBadge } from "./StatusBadge";
export {
  StatCard,
  type StatCardProps,
} from "./StatCard";
export { SyncStatusBar } from "./SyncStatusBar";
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
// Vault Components
export type { AssetSelectorProps } from "./Vault/AssetSelector";
export { AssetSelector } from "./Vault/AssetSelector";
