/**
 * Toast Presets
 *
 * Pre-configured toast configurations for common operations.
 * Reduces duplication and ensures consistent messaging.
 *
 * Supports internationalization via factory functions that accept
 * a formatMessage function from react-intl.
 *
 * @module components/Toast/presets
 */

export { createApprovalToasts } from "./presets/approval";
export { createQueueToasts } from "./presets/queue";
export type { FormatMessageFn } from "./presets/types";
export { toastMessageIds, toastMessageIdsUpdate } from "./presets/types";
export { createUpdateToasts } from "./presets/update";
export { createValidationToasts, validationToasts } from "./presets/validation";
export {
  createWalletProgressToasts,
  showWalletProgress,
  walletProgressToasts,
} from "./presets/wallet";
export { createWorkToasts, workToasts } from "./presets/work";
