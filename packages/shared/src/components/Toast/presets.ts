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

export { approvalToasts, createApprovalToasts } from "./presets/approval";
export { createQueueToasts, queueToasts } from "./presets/queue";
export type { FormatMessageFn } from "./presets/types";
export { toastMessageIds, toastMessageIdsUpdate } from "./presets/types";
export { createUpdateToasts, updateToasts } from "./presets/update";
export { createValidationToasts, validationToasts } from "./presets/validation";
export {
  createWalletProgressToasts,
  showWalletProgress,
  walletProgressToasts,
} from "./presets/wallet";
export { createWorkToasts, workToasts } from "./presets/work";

import { createApprovalToasts } from "./presets/approval";
import { createQueueToasts } from "./presets/queue";
import type { FormatMessageFn } from "./presets/types";
import { createUpdateToasts } from "./presets/update";
import { createValidationToasts } from "./presets/validation";
import { createWalletProgressToasts } from "./presets/wallet";
import { createWorkToasts } from "./presets/work";

/**
 * Create all i18n-aware toast presets at once
 * @param formatMessage - react-intl formatMessage function
 */
export function createLocalizedToasts(formatMessage: FormatMessageFn) {
  return {
    work: createWorkToasts(formatMessage),
    approval: createApprovalToasts(formatMessage),
    queue: createQueueToasts(formatMessage),
    validation: createValidationToasts(formatMessage),
    walletProgress: createWalletProgressToasts(formatMessage),
    update: createUpdateToasts(formatMessage),
  };
}
