// Toast barrel file
// All internal imports should use this barrel file

// Toast presets for common operations
export {
  approvalToasts,
  queueToasts,
  validationToasts,
  workToasts,
} from "./Toast/presets";
export type {
  ToastAction,
  ToastDescriptor,
  ToastHandle,
  ToastStatus,
  ToastTranslator,
} from "./Toast/toast.service";
export { setToastTranslator, toastService } from "./Toast/toast.service";
