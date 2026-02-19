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

export type { FormatMessageFn } from "./presets/types";
export { toastMessageIds, toastMessageIdsUpdate } from "./presets/types";

export { workToasts, createWorkToasts } from "./presets/work";
export { approvalToasts, createApprovalToasts } from "./presets/approval";
export { queueToasts, createQueueToasts } from "./presets/queue";
export { validationToasts, createValidationToasts } from "./presets/validation";
export {
  walletProgressToasts,
  createWalletProgressToasts,
  showWalletProgress,
} from "./presets/wallet";
export { updateToasts, createUpdateToasts } from "./presets/update";

import type { FormatMessageFn } from "./presets/types";
import { createWorkToasts } from "./presets/work";
import { createApprovalToasts } from "./presets/approval";
import { createQueueToasts } from "./presets/queue";
import { createValidationToasts } from "./presets/validation";
import { createWalletProgressToasts } from "./presets/wallet";
import { createUpdateToasts } from "./presets/update";

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
