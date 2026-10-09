import type { CategorizedError, ErrorCategory } from "../../../utils/errors/categorize-error";

/**
 * Data passed to onComplete for optimistic UI rendering.
 * Allows the detail page to show content immediately while indexer syncs.
 */
export interface HypercertCompletionData {
  hypercertId: string;
  title: string;
  description: string;
  workScopes: string[];
  imageUri?: string;
  attestationCount: number;
  mintedAt: number;
  txHash?: `0x${string}`;
}

export interface HypercertWizardProps {
  gardenId: string;
  gardenName: string;
  /** The mint confirmed; the flow stays on its Review with Done (DL-080). */
  onComplete: (data: HypercertCompletionData) => void;
  onCancel: () => void;
  /** Done, after the mint confirmed. */
  onDone: () => void;
}

/** Maps error categories to i18n message keys for user-facing error display */
const ERROR_CATEGORY_KEYS: Record<ErrorCategory, string> = {
  network: "app.errors.network",
  blockchain: "app.errors.blockchain",
  auth: "app.errors.auth",
  validation: "app.errors.validation",
  permission: "app.errors.permission",
  storage: "app.errors.storage",
  unknown: "app.hypercerts.mint.error.generic.message",
};

/** Get the i18n message key for a categorized error */
export function getErrorMessageKey(categorized: CategorizedError): string {
  return ERROR_CATEGORY_KEYS[categorized.category];
}
