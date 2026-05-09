// Toast barrel file
// All internal imports should use this barrel file

// Type exports
export type { FormatMessageFn } from "./Toast/presets";
// Toast presets for common operations (default English fallbacks)
// i18n factory functions for localized toasts
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
export {
  clearLocalizedToastsFormatter,
  getLocalizedToastsFormatter,
  setLocalizedToastsFormatter,
} from "./Toast/presets/registry";
export { LocalizedToastsBridge } from "./Toast/LocalizedToastsBridge";
export type {
  ToastAction,
  ToastDescriptor,
  ToastHandle,
  ToastStatus,
  ToastTranslator,
} from "./Toast/toast.service";

// Toast service
export { setToastTranslator, toastService } from "./Toast/toast.service";
